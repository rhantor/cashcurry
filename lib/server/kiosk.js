// Server side of the branch kiosk (lib/attendance/kiosk.js). A tablet is set
// up once by someone who may open the kiosk; it then holds a device token
// (only its SHA-256 is kept, kioskDevices/{hash} — never readable from the
// app) and needs no sign-in. Everything the tablet does goes through here:
// the staff list without PINs, and punches — PIN checked here, in or out
// decided here, photo kept in storage, the day taken on the branch's clock.
import admin from "firebase-admin";
import { adminAuth, adminDb } from "@/lib/server/firebaseAdmin";
import { can, isCompanyRole } from "@/lib/authz/permissions";
import { hashToken, putFile } from "@/lib/server/hires";
import { isValidTimeZone } from "@/lib/region/businessDay";
import { otRequestId, resolveStaffShift, shiftRules } from "@/lib/attendance/shifts";
import {
  afterWrongPin, cleanPunch, kioskStaff, lastPunchBefore, minutesBeforeShift, minutesToWait,
  nextPunchType, photoFrom, pinLocked, punchDate, punchMoment,
} from "@/lib/attendance/kiosk";

export const branchRef = (companyId, branchId) => adminDb.collection("companies").doc(companyId).collection("branches").doc(branchId);
export const deviceRef = (hash) => adminDb.collection("kioskDevices").doc(hash);

/** The signed-in caller (Authorization header) if they may do `permission` at this branch; otherwise { status, error }. */
export async function callerMay(req, companyId, branchId, permission) {
  if (!adminAuth || !adminDb) return { status: 500, error: "Server is not configured." };
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return { status: 401, error: "Sign in first." };
  let caller;
  try {
    caller = await adminAuth.verifyIdToken(token);
  } catch {
    return { status: 401, error: "Your session has expired. Sign in again." };
  }
  const snap = await adminDb.collection("users").doc(caller.uid).get();
  const me = snap.exists ? snap.data() : null;
  const ok = me && me.companyId === companyId && can(me.role, permission) && (isCompanyRole(me.role) || me.branchId === branchId);
  if (!ok) return { status: 403, error: "You can't do this at this branch." };
  return { caller, me };
}

/** The tablet behind a kiosk token: { ref, device } — null when unknown or switched off. */
export async function kioskDevice(token) {
  if (!adminDb || !/^[A-Za-z0-9_-]{20,64}$/.test(String(token || ""))) return null;
  const ref = deviceRef(hashToken(token));
  const snap = await ref.get();
  if (!snap.exists || snap.data().active === false) return null;
  return { ref, device: { id: snap.id, ...snap.data() } };
}

async function settingsOf(companyId, branchId) {
  const s = await branchRef(companyId, branchId).collection("settings").doc("settings").get();
  return s.exists ? s.data() : {};
}

/** The branch's clock: its own zone when set, else the tablet's. */
function clockOf(settings, device, sentZone) {
  const zone = [settings?.basic?.timeZone, device?.timeZone, sentZone].find((z) => z && isValidTimeZone(z)) || null;
  return { timeZone: zone, cutoff: settings?.attendance?.dayCutoffTime || "00:00" };
}

const dayBefore = (date) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/** Punches filed under these business days (one field, no index needed). */
async function punchesOn(companyId, branchId, dates) {
  const snap = await branchRef(companyId, branchId).collection("attendance").where("date", "in", [...new Set(dates)]).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** What the tablet shows: the branch, its kiosk settings and everyone with whether they are in. */
export async function kioskState({ ref, device }, { timeZone: sentZone } = {}) {
  const { companyId, branchId } = device;
  const branch = branchRef(companyId, branchId);
  const [branchSnap, settings, staffSnap] = await Promise.all([branch.get(), settingsOf(companyId, branchId), branch.collection("staff").get()]);
  const att = settings.attendance || {};
  const clock = clockOf(settings, device, sentZone);
  const now = new Date();
  const today = punchDate(now, clock);
  const punches = await punchesOn(companyId, branchId, [dayBefore(today), today]);
  const staff = staffSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .map((s) => kioskStaff(s, { last: lastPunchBefore(punches.filter((p) => p.staffId === s.id), now), now, biometrics: !!att.useBiometrics }))
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  // seen now and then, for the manager's list of tablets
  if (!device.lastSeenAt || now - device.lastSeenAt.toDate() > 5 * 60000) ref.update({ lastSeenAt: admin.firestore.FieldValue.serverTimestamp() }).catch(() => {});
  return {
    branch: { name: branchSnap.data()?.name || "" },
    device: { name: device.name || "Kiosk" },
    settings: { camera: att.useCamera !== false, biometrics: !!att.useBiometrics },
    today,
    punchesToday: punches.filter((p) => p.date === today).length,
    staff,
    serverTime: now.toISOString(),
  };
}

const fail = (code, error, extra = {}) => ({ ok: false, code, error, ...extra });

/**
 * One punch from the tablet (or, with `check`, only the PIN). Returns
 * { ok, type, at, name, earlyOt } or { ok:false, code, error }. A punch already
 * saved (the same id sent twice) comes back as it was.
 */
export async function kioskPunch({ ref: devRef, device }, body) {
  const p = cleanPunch(body);
  if (p.error) return fail("bad", p.error);
  const { companyId, branchId } = device;
  const branch = branchRef(companyId, branchId);
  const punchRef = branch.collection("attendance").doc(p.id);

  const done = await punchRef.get();
  if (done.exists) {
    const d = done.data();
    return { ok: true, type: d.type, at: d.timestamp.toDate().toISOString(), name: d.staffName, again: true };
  }

  const [staffSnap, settings, devSnap] = await Promise.all([branch.collection("staff").doc(p.staffId).get(), settingsOf(companyId, branchId), devRef.get()]);
  if (!staffSnap.exists) return fail("no_staff", "This person is not on the staff list any more.");
  const staff = { id: staffSnap.id, ...staffSnap.data() };
  const name = `${staff.firstName || ""} ${staff.lastName || ""}`.trim();
  const att = settings.attendance || {};

  // who it is: their PIN (checked here, never sent to the tablet), or the tablet's fingerprint check
  if (p.method === "biometric") {
    if (!att.useBiometrics || !staff.biometric?.credentialId) return fail("no_biometric", "Use your PIN.");
  } else {
    if (!/^\d{4}$/.test(String(staff.pinCode || ""))) return fail("no_pin", `${staff.firstName || "They"} have no kiosk PIN yet — ask the manager to set one.`);
    const fails = devSnap.data()?.pinFails?.[p.staffId];
    if (pinLocked(fails)) return fail("locked", "Too many wrong PINs. Try again in a few minutes, or ask the manager.");
    if (String(staff.pinCode) !== p.pin) {
      const next = afterWrongPin(fails);
      await devRef.update({ [`pinFails.${p.staffId}`]: next.fails }).catch(() => {});
      return next.left ? fail("wrong_pin", `Wrong PIN — ${next.left} ${next.left === 1 ? "try" : "tries"} left.`, { left: next.left }) : fail("locked", "Too many wrong PINs. Try again in 5 minutes, or ask the manager.");
    }
    if (fails) await devRef.update({ [`pinFails.${p.staffId}`]: admin.firestore.FieldValue.delete() }).catch(() => {});
  }

  const clock = clockOf(settings, device, p.timeZone);
  const moment = punchMoment({ offline: p.offline, clientAt: p.clientAt });
  const date = punchDate(moment.at, clock);
  const theirs = (await punchesOn(companyId, branchId, [dayBefore(dayBefore(date)), dayBefore(date), date])).filter((x) => x.staffId === p.staffId);
  const last = lastPunchBefore(theirs, moment.at);
  const type = nextPunchType(last, moment.at);
  const wait = minutesToWait(last, moment.at, att.duplicatePunchInterval);
  if (wait) return fail("too_soon", `You punched a moment ago. Wait ${wait} more minute${wait === 1 ? "" : "s"}.`, { type });
  if (p.check) return { ok: true, check: true, type, name };

  let photoPath = null;
  const photo = photoFrom(p.photo);
  if (photo) {
    photoPath = `attendance/${companyId}/${branchId}/${date}/${p.id}.jpg`;
    try {
      await putFile(photoPath, photo.buffer, photo.contentType);
    } catch (e) {
      console.warn("[kiosk] photo not kept:", e?.message);
      photoPath = null;
    }
  }

  const record = {
    staffId: p.staffId,
    staffName: name,
    type,
    date,
    timestamp: admin.firestore.Timestamp.fromDate(moment.at),
    method: p.method,
    photoPath,
    source: "kiosk",
    device: { id: devRef.id.slice(0, 12), name: device.name || "Kiosk" },
    offline: moment.offline,
    ...(moment.doubtful ? { timeDoubtful: true } : {}),
    recordedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  try {
    await punchRef.create(record);
  } catch (e) {
    // sent twice at once: the first one stands
    if (e?.code !== 6) throw e;
  }

  // well before their shift: the extra minutes wait for approval (Requested Panel)
  let earlyOt = null;
  const shift = type === "in" ? resolveStaffShift(staff, att) : null;
  if (shift) {
    const early = minutesBeforeShift(moment.at, shift, clock);
    if (early != null && early >= shiftRules(att).earlyOtMinutes) {
      earlyOt = Math.round(early);
      await branch
        .collection("otRequests")
        .doc(otRequestId(staff.id, date))
        .create({
          staffId: staff.id,
          staffName: name,
          date,
          shiftStart: shift.start,
          shiftEnd: shift.end,
          punchInAt: moment.at.toISOString(),
          earlyMinutes: earlyOt,
          status: "pending",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        })
        .catch(() => {}); // one a day; never blocks the punch
    }
  }
  return { ok: true, type, at: moment.at.toISOString(), name, earlyOt, offline: moment.offline };
}
