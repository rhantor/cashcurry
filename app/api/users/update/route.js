import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { adminAuth, adminDb } from "@/lib/server/firebaseAdmin";
import { hasChanges, planAccountEdit } from "@/lib/users/accountEdit";
import { personName } from "@/lib/people";

// Change someone's office login from User Management (owner, 15 Nov 2026):
// role, name, email, username. Only the server may write a role into
// /users/{uid} (the rules let a person edit their own profile, never a role),
// so the screens send it here. Writes the login, the company or branch list it
// shows in (moving between a branch's admins and users when the role crosses
// branch admin), the username lookup and the Firebase sign-in email together,
// and an audit entry. A new role signs them out everywhere: they sign in again
// and get the new role's menu and rights.

const fail = (status, error) => NextResponse.json({ error }, { status });

export async function POST(req) {
  try {
    if (!adminAuth || !adminDb) return fail(500, "Server is not configured to change logins.");
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return fail(401, "Sign in first.");
    let callerId;
    try {
      callerId = (await adminAuth.verifyIdToken(token)).uid;
    } catch {
      return fail(401, "Your session has expired. Sign in again.");
    }
    const { uid, changes = {} } = await req.json();
    if (!uid) return fail(400, "Which login?");

    const [meSnap, targetSnap] = await Promise.all([
      adminDb.collection("users").doc(callerId).get(),
      adminDb.collection("users").doc(uid).get(),
    ]);
    if (!meSnap.exists) return fail(403, "Only the owner or a super admin can change logins.");
    if (!targetSnap.exists) return fail(404, "That login was not found.");
    const me = { uid: callerId, ...meSnap.data() };
    const target = { uid, ...targetSnap.data() };
    const companyId = target.companyId;
    const branchId = target.branchId || null;
    const branchRef = branchId ? adminDb.doc(`companies/${companyId}/branches/${branchId}`) : null;

    const adminsInBranch = branchRef ? (await branchRef.collection("admins").get()).size : 0;
    const plan = planAccountEdit({ caller: me, target, changes, adminsInBranch });
    if (plan.error) return fail(403, plan.error);
    const v = plan.value;
    if (!hasChanges(v)) return NextResponse.json({ success: true, changed: false });

    // the username must be free
    const oldKey = String(target.userName || target.username || "").toLowerCase().trim();
    if (v.userName) {
      const taken = await adminDb.collection("usernames").doc(v.userName).get();
      if (taken.exists && taken.data().uid !== uid) return fail(409, "That username is taken. Pick another.");
    }
    // the sign-in email first: if Firebase refuses it, nothing else changes
    if (v.email) {
      try {
        await adminAuth.updateUser(uid, { email: v.email });
      } catch (e) {
        if (e?.code === "auth/email-already-exists") return fail(409, "That email is used by another login.");
        throw e;
      }
    }

    const stamp = admin.firestore.FieldValue.serverTimestamp();
    const byName = personName(me) || me.userName || me.email || "";
    const patch = {
      ...(v.role ? { role: v.role.to, roleChangedAt: stamp, roleChangedBy: { uid: callerId, name: byName } } : {}),
      ...(v.fullName ? { fullName: v.fullName, ...(target.name != null ? { name: v.fullName } : {}) } : {}),
      ...(v.email ? { email: v.email } : {}),
      ...(v.userName ? { userName: v.userName } : {}),
    };
    const listPatch = {
      ...(v.role ? { role: v.role.to } : {}),
      ...(v.fullName ? { fullName: v.fullName } : {}),
      ...(v.email ? { email: v.email } : {}),
      ...(v.userName ? { userName: v.userName } : {}),
    };

    const batch = adminDb.batch();
    batch.update(targetSnap.ref, patch);

    // the list it shows in
    const companyRow = adminDb.doc(`companies/${companyId}/users/${uid}`);
    const companyRowSnap = await companyRow.get();
    if (companyRowSnap.exists) batch.update(companyRow, listPatch);
    if (branchRef) {
      const adminRow = branchRef.collection("admins").doc(uid);
      const userRow = branchRef.collection("users").doc(uid);
      const [a, u] = await Promise.all([adminRow.get(), userRow.get()]);
      const was = a.exists ? a : u.exists ? u : null;
      const base = was ? was.data() : { userName: target.userName || "", fullName: target.fullName || target.name || "", email: target.email || "", createdAt: stamp };
      if (v.move === "toAdmins") {
        batch.set(adminRow, { ...base, ...listPatch, branchId, role: "branchAdmin" });
        if (u.exists) batch.delete(userRow);
      } else if (v.move === "toUsers") {
        const { branchId: _b, ...rest } = base;
        batch.set(userRow, { ...rest, ...listPatch });
        if (a.exists) batch.delete(adminRow);
      } else if (was) {
        batch.update(was.ref, listPatch);
      }
    }

    // the username lookup moves with the username, and follows the email
    if (v.userName) {
      const old = oldKey ? await adminDb.collection("usernames").doc(oldKey).get() : null;
      const entry = old?.exists ? old.data() : { uid, companyId, ...(branchId ? { branchId } : {}) };
      batch.set(adminDb.collection("usernames").doc(v.userName), { ...entry, uid, email: v.email || entry.email || target.email || "" });
      if (old?.exists && old.data().uid === uid) batch.delete(old.ref);
    } else if (v.email && oldKey) {
      const old = await adminDb.collection("usernames").doc(oldKey).get();
      if (old.exists && old.data().uid === uid) batch.update(old.ref, { email: v.email });
    }

    // the audit log: who changed whose login, from what to what
    const pick = (o) => ({ role: o.role || "", fullName: o.fullName || o.name || "", email: o.email || "", userName: o.userName || o.username || "" });
    batch.set(adminDb.collection(`companies/${companyId}/auditLog`).doc(), {
      companyId,
      branchId,
      collection: "users",
      docId: uid,
      action: "updated",
      actorUid: callerId,
      actorName: byName || "unknown",
      actorFrom: "account",
      before: pick(target),
      after: pick({ ...target, ...patch, role: v.role ? v.role.to : target.role }),
      timestamp: stamp,
    });

    await batch.commit();
    // a new role: signed out everywhere, so the old role's rights stop now
    if (v.role) await adminAuth.revokeRefreshTokens(uid).catch(() => {});
    return NextResponse.json({ success: true, changed: true, role: v.role?.to || null });
  } catch (e) {
    console.error("[users/update]", e);
    return fail(500, "Couldn't save the change. Try again.");
  }
}
