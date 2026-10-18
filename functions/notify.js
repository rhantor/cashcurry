// functions/notify.js
// Notifications (roadmap 4.3): who is told what lives in lib/notify/model.js
// (bundled to ./notify.cjs); this file reads the people and settings, writes
// each person's inbox (companies/{c}/users/{uid}/inbox) and sends the push.
//
// In the local emulators there is no push service: the inbox is written and
// the push is only logged.
const N = require("./notify.cjs");

const IN_EMULATOR = process.env.FUNCTIONS_EMULATOR === "true";
const INVALID_TOKEN = new Set(["messaging/registration-token-not-registered", "messaging/invalid-argument", "messaging/invalid-registration-token"]);

module.exports = function makeNotify({ db, fcm, FieldValue }) {
  // ── reading ────────────────────────────────────────────────────────────────
  async function people(companyId) {
    const snap = await db.collection("users").where("companyId", "==", companyId).get();
    return snap.docs.map((d) => {
      const u = d.data();
      return { uid: d.id, role: u.role, branchId: u.branchId || null, staffId: u.staffId || null };
    });
  }

  async function branch(companyId, branchId) {
    const [b, s, n] = await Promise.all([
      db.doc(`companies/${companyId}/branches/${branchId}`).get(),
      db.doc(`companies/${companyId}/branches/${branchId}/settings/settings`).get(),
      db.doc(`companies/${companyId}/branches/${branchId}/settings/notifications`).get(),
    ]);
    const settings = s.exists ? s.data() : {};
    return {
      name: (b.exists && (b.data().name || b.data().branchName)) || branchId,
      settings,
      config: n.exists ? n.data() : {},
      currency: settings?.financeSales?.currency || "MYR",
      timeZone: settings?.basic?.timeZone || "Asia/Kuala_Lumpur",
      cutoff: settings?.attendance?.dayCutoffTime || "00:00",
    };
  }

  async function prefs(companyId, uids) {
    const snaps = await Promise.all(uids.map((u) => db.doc(`companies/${companyId}/users/${u}/prefs/notifications`).get()));
    return Object.fromEntries(snaps.map((s, i) => [uids[i], s.exists ? s.data() : {}]));
  }

  // ── sending ────────────────────────────────────────────────────────────────
  /** One message to some people: their inbox, then a push to their devices. */
  // inbox: false for chat — messages are seen in the chat, not the bell.
  // muted(uid, prefs) can drop more people (e.g. a chat they muted).
  async function deliver({ companyId, branchId, uids, type, message, link, ref, inbox = true, tag, muted: mutedToo }) {
    const to = [...new Set(uids)].filter(Boolean);
    if (!to.length || !message) return 0;
    const muted = await prefs(companyId, to);
    const list = N.withoutMuted(to, type, muted).filter((u) => !mutedToo?.(u, muted[u] || {}));
    if (!list.length) return 0;

    if (inbox) {
      const batch = db.batch();
      for (const uid of list) {
        batch.set(db.collection(`companies/${companyId}/users/${uid}/inbox`).doc(), {
          type, title: message.title, body: message.body, link: link || "/", branchId: branchId || null,
          ref: ref || null, createdAt: FieldValue.serverTimestamp(), readAt: null,
        });
      }
      await batch.commit();
    }

    const tokenSnaps = await Promise.all(list.map((uid) => db.collection(`companies/${companyId}/users/${uid}/fcmTokens`).get()));
    const tokens = tokenSnaps.flatMap((s, i) => s.docs.map((d) => ({ token: d.id, ref: d.ref, uid: list[i] })));
    if (IN_EMULATOR) {
      console.log(`[notify] ${type} → ${list.length} ${inbox ? "inbox(es)" : "person(s), push only"}, push skipped in the emulator: ${message.title} — ${message.body}`);
      return list.length;
    }
    if (!tokens.length) return list.length;
    const res = await fcm.sendEachForMulticast({
      tokens: tokens.map((t) => t.token),
      notification: { title: message.title, body: message.body },
      data: { link: link || "/", companyId, type, ...(tag ? { tag } : {}) },
      webpush: { fcmOptions: { link: link || "/" } },
    });
    // forget devices that no longer exist
    await Promise.all(res.responses.map((r, i) => (!r.success && INVALID_TOKEN.has(r.error?.code) ? tokens[i].ref.delete().catch(() => {}) : null)));
    return list.length;
  }

  // ── requests: advances, staff loans, leave ────────────────────────────────
  /** A request was written: tell those who should know about each change. */
  async function onRequest({ companyId, branchId, type, id, before, after }) {
    const events = N.requestEvents(before, after);
    if (!events.length) return;
    const r = N.toRequest(type, { id, ...after });
    const [all, b] = await Promise.all([people(companyId), branch(companyId, branchId)]);
    const staff = all.filter((p) => p.branchId === branchId || !p.branchId);
    const office = N.branchPeople(all, branchId);
    const money = (v) => N.formatMoney(v, b.currency);
    const actor = (e) => (e === "new" ? r.createdBy?.uid : e === "approved" ? r.approvedBy?.id : e === "rejected" ? r.rejectedBy?.uid : e === "paid" ? r.paidOut?.by?.uid : null);

    for (const e of events) {
      const kind = N.EVENT_TYPE[e];
      const by = actor(e);
      // whoever asked, and the staff member it is for (their login, if any)
      const requesters = ["approved", "rejected", "paid"].includes(e)
        ? [...new Set([r.createdBy?.uid, ...staff.filter((p) => r.staffId && p.staffId === r.staffId).map((p) => p.uid)])].filter((u) => u && u !== by)
        : [];
      const watchers = N.recipientsFor(kind, { config: b.config, people: office }).filter((u) => u !== by && !requesters.includes(u));
      await deliver({ companyId, branchId, uids: watchers, type: kind, message: N.requestMessage(e, r, { money, branchName: b.name }), link: N.requestLink(e), ref: `${type}/${id}` });
      for (const u of requesters) {
        const role = all.find((p) => p.uid === u)?.role;
        await deliver({ companyId, branchId, uids: [u], type: "requests.mine", message: N.requesterMessage(e, r, { money }), link: N.requestLink(e, { forRequester: true, role }), ref: `${type}/${id}` });
      }
    }
  }

  // ── purchase orders waiting for approval ───────────────────────────────────
  async function onPurchaseOrder({ companyId, branchId, id, before, after }) {
    if (!after || after.status !== "Pending" || before?.status === "Pending") return;
    const [all, b] = await Promise.all([people(companyId), branch(companyId, branchId)]);
    if (b.settings?.purchases?.requirePoApproval !== true) return; // no approval step at this branch
    const by = after.createdBy || after.lastEditedBy;
    const uids = N.recipientsFor("purchases.approval", { config: b.config, people: N.branchPeople(all, branchId) }).filter((u) => u !== by);
    const message = {
      title: `Purchase order to approve · ${b.name}`,
      body: `${after.vendorName || "A supplier"} · ${N.formatMoney(after.totalEst || 0, b.currency)}${after.createdByName ? ` — raised by ${after.createdByName}` : ""}`,
    };
    await deliver({ companyId, branchId, uids, type: "purchases.approval", message, link: "/purchases/purchase-orders", ref: `requisitions/${id}` });
  }

  // ── the daily summary ──────────────────────────────────────────────────────
  /**
   * Once an hour: every branch whose clock has reached its summary time
   * (settings/notifications.dailyAt, default 09:00) gets the summary of the
   * business day before. A marker per branch and day means it goes out once.
   */
  async function dailySummaries(now = new Date()) {
    for (const company of await db.collection("companies").listDocuments()) {
      let all = null;
      for (const branchRef of await company.collection("branches").listDocuments()) {
        try {
          const b = await branch(company.id, branchRef.id);
          if (N.localHour(now, b.timeZone) !== N.hourOf(b.config.dailyAt)) continue;
          const today = N.businessDateFor(now, b.cutoff, b.timeZone);
          const d = new Date(`${today}T12:00:00Z`);
          d.setUTCDate(d.getUTCDate() - 1);
          const day = d.toISOString().slice(0, 10);
          try {
            await branchRef.collection("notifyLog").doc(`daily-${day}`).create({ at: FieldValue.serverTimestamp() });
          } catch {
            continue; // already sent
          }
          all = all || (await people(company.id));
          const office = N.branchPeople(all, branchRef.id);
          const wantsSales = N.recipientsFor("daily.sales", { config: b.config, people: office });
          const wantsCosts = N.recipientsFor("daily.costs", { config: b.config, people: office });
          const everyone = [...new Set([...wantsSales, ...wantsCosts])];
          if (!everyone.length) continue;

          const [sales, costs] = await Promise.all(["sales", "costs"].map((c) => branchRef.collection(c).where("date", "==", day).get().then((s) => s.docs.map((x) => ({ id: x.id, ...x.data() })))));
          const { totals } = N.buildLedger({ branchId: branchRef.id, settings: b.settings, records: { sales, costs }, from: day, to: day });
          const money = (v) => N.formatMoney(v, b.currency);
          const dayLabel = new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
          const muted = await prefs(company.id, everyone);
          for (const uid of everyone) {
            const wants = [
              ...(wantsSales.includes(uid) && !(muted[uid]?.muted || []).includes("daily.sales") ? ["daily.sales"] : []),
              ...(wantsCosts.includes(uid) && !(muted[uid]?.muted || []).includes("daily.costs") ? ["daily.costs"] : []),
            ];
            const message = N.dailyMessage({ day, dayLabel, branchName: b.name, sales: totals.totalSales, costs: totals.costCash + totals.costBank, wants, money });
            if (message && !sales.length && wants.includes("daily.sales")) message.body += " — no sales entered yet";
            // one push for both; muting was applied above
            await deliver({ companyId: company.id, branchId: branchRef.id, uids: [uid], type: "daily", message, link: `/reports?branch=${branchRef.id}`, ref: `daily/${day}` });
          }
        } catch (err) {
          console.error("[notify daily]", company.id, branchRef.id, err);
        }
      }
    }
  }

  // ── chat (4.4) ─────────────────────────────────────────────────────────────
  /** A message was sent: a push to everyone who can see the chat, except the sender and those who muted it. */
  async function onChatMessage({ companyId, chatId, message: m }) {
    if (!m || m.deleted) return;
    const chatSnap = await db.doc(`companies/${companyId}/chats/${chatId}`).get();
    if (!chatSnap.exists) return;
    const chat = chatSnap.data();
    const all = await people(companyId);
    const muted = await prefs(companyId, N.chatAudience(chat, all, m.byUid));
    // not those who muted this chat (or chat altogether)
    const uids = Object.keys(muted).filter((u) => !(muted[u].mutedChats || []).includes(chatId) && !(muted[u].muted || []).includes("chat"));
    if (!uids.length) return;
    const preview = N.previewOf(m);
    const branchNames = chat.kind === "branch" ? { [chat.branchId]: (await db.doc(`companies/${companyId}/branches/${chat.branchId}`).get()).data()?.name } : {};
    const name = chat.kind === "direct" ? m.byName || "New message" : N.chatTitle(chat, null, {}, branchNames);
    const link = `/messages?c=${chatId}`;

    // The bell: one line per chat, counting what's new since the person last
    // opened it (opening the chat marks it read — lib/chat/client.js markRead).
    const refs = uids.map((u) => db.doc(`companies/${companyId}/users/${u}/inbox/chat_${chatId}`));
    const before = await db.getAll(...refs);
    const batch = db.batch();
    before.forEach((snap, i) => {
      const prev = snap.exists ? snap.data() : null;
      const count = prev && !prev.readAt ? (prev.count || 1) + 1 : 1;
      const line = chat.kind === "direct" ? preview : `${m.byName || "Someone"}: ${preview}`;
      batch.set(refs[i], {
        type: "chat", title: name, body: count > 1 ? `${count} new messages · ${line}` : line, count,
        link, branchId: chat.branchId || null, ref: `chats/${chatId}`, createdAt: FieldValue.serverTimestamp(), readAt: null,
      });
    });
    await batch.commit();

    // the push: one per message, replacing the last one from this chat on the device
    const title = chat.kind === "direct" ? name : `${m.byName || "Someone"} · ${name}`;
    await deliver({ companyId, branchId: chat.branchId || null, uids, type: "chat", message: { title, body: preview }, link, ref: `chats/${chatId}`, inbox: false, tag: `chat-${chatId}` });
  }

  /** users/{uid} changed: keep the chat directory (names and roles only) in step. */
  async function onUser({ uid, before, after }) {
    if (before?.companyId && before.companyId !== after?.companyId) await db.doc(`companies/${before.companyId}/chatPeople/${uid}`).delete().catch(() => {});
    if (!after?.companyId) return;
    await db.doc(`companies/${after.companyId}/chatPeople/${uid}`).set({
      name: N.personName(after) || after.username || after.userName || "—",
      role: after.role || "",
      branchId: after.branchId || null,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  return { deliver, onRequest, onPurchaseOrder, dailySummaries, onChatMessage, onUser };
};
