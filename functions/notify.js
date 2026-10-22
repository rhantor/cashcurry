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
      // the staff Android app (Capacitor): show at once; one line per chat / thing
      android: { priority: "high", notification: tag ? { tag } : {} },
    });
    // forget devices that no longer exist
    await Promise.all(res.responses.map((r, i) => (!r.success && INVALID_TOKEN.has(r.error?.code) ? tokens[i].ref.delete().catch(() => {}) : null)));
    return list.length;
  }

  /**
   * Someone already acted on it: the "to approve" notes the others got now say
   * what happened and open where it went — not a list that is empty by now.
   */
  async function closeOut({ companyId, uids, ref, type, message, link }) {
    for (const uid of [...new Set(uids)].filter(Boolean)) {
      const snap = await db.collection(`companies/${companyId}/users/${uid}/inbox`).where("ref", "==", ref).get();
      const open = snap.docs.filter((d) => d.data().type === type && !d.data().closed);
      if (!open.length) continue;
      const batch = db.batch();
      for (const d of open) batch.update(d.ref, { title: message.title, body: message.body, link, closed: true, closedAt: FieldValue.serverTimestamp() });
      await batch.commit();
    }
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
      await deliver({ companyId, branchId, uids: watchers, type: kind, message: N.requestMessage(e, r, { money, branchName: b.name }), link: N.requestLink(e, { type }), ref: `${type}/${id}` });
      // decided: the "new request" notes say so, and open where it went
      if (e === "approved" || e === "rejected") {
        const asked = N.recipientsFor("requests.new", { config: b.config, people: office });
        await closeOut({ companyId, uids: asked, ref: `${type}/${id}`, type: "requests.new", message: N.requestMessage(e, r, { money, branchName: b.name }), link: N.requestLink(e, { type }) });
      }
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

  // ── pay-out bills and vouchers (4.9, 4.10) ─────────────────────────────────
  /** Those who approve at this branch, minus the people involved. */
  async function approvers(companyId, branchId, b, without = []) {
    const all = await people(companyId);
    return N.recipientsFor("costs.approval", { config: b.config, people: N.branchPeople(all, branchId) }).filter((u) => !without.includes(u));
  }

  /** A pay-out's bill: waiting → approvers; approved / sent back → whoever brought it. */
  async function onPayout({ companyId, branchId, id, before, after }) {
    if (!after || after.kind !== "settle") return;
    const b = await branch(companyId, branchId);
    const money = (v) => N.formatMoney(v, b.currency);
    const what = `${after.to?.name || "Someone"} · ${after.category || after.purpose || "a bill"} · ${money(after.billAmount)} of ${money(after.floatAmount)}`;
    if (after.status === "pending" && before?.status !== "pending") {
      const uids = await approvers(companyId, branchId, b, [after.by?.uid, after.payoutBy?.uid]);
      await deliver({ companyId, branchId, uids, type: "costs.approval", message: { title: `Bill to approve · ${b.name}`, body: what }, link: "/requested-panel?tab=bills", ref: `payouts/${id}`, tag: `payout_${id}` });
    } else if ((after.status === "approved" || after.status === "rejected") && before?.status === "pending" && after.by?.uid) {
      const by = after.review?.by?.name || "a manager";
      const message = after.status === "approved"
        ? { title: "Bill approved", body: `${what} — ${by}` }
        : { title: "Bill sent back", body: `${what} — ${by}${after.review?.note ? `: “${after.review.note}”` : ""}` };
      await deliver({ companyId, branchId, uids: [after.by.uid], type: "requests.mine", message, link: "/payouts", ref: `payouts/${id}` });
      const done = after.status === "approved"
        ? { title: `Bill approved · ${b.name}`, body: `${what} — approved by ${by}` }
        : { title: `Bill sent back · ${b.name}`, body: `${what} — sent back by ${by}` };
      await closeOut({ companyId, uids: await approvers(companyId, branchId, b), ref: `payouts/${id}`, type: "costs.approval", message: done, link: after.status === "approved" ? "/reports/cost-report" : "/payouts" });
    }
  }

  /** A cost saved with no invoice: its voucher waits → approvers; decided → whoever made it. */
  async function onCostVoucher({ companyId, branchId, id, before, after }) {
    const v = after?.voucher;
    if (!v || after?.meta?.type === "payout") return; // a pay-out's bill was decided with the bill
    const was = before?.voucher?.status;
    const b = await branch(companyId, branchId);
    const what = `${after.category || "A cost"} · ${N.formatMoney(after.amount, b.currency)}${after.paidTo ? ` · ${after.paidTo}` : ""}`;
    if (v.status === "pending" && was !== "pending") {
      const uids = await approvers(companyId, branchId, b, [v.by?.uid, after.createdBy?.uid]);
      await deliver({ companyId, branchId, uids, type: "costs.approval", message: { title: `Voucher to approve · ${b.name}`, body: `${what} — no invoice: ${v.reason || "no reason given"}` }, link: "/requested-panel?tab=vouchers", ref: `costs/${id}`, tag: `voucher_${id}` });
    } else if ((v.status === "approved" || v.status === "rejected") && was === "pending" && v.by?.uid) {
      const by = v.decidedBy?.name || "a manager";
      const message = v.status === "approved"
        ? { title: "Voucher approved", body: `${what} — ${by}` }
        : { title: "Voucher sent back", body: `${what} — ${by}${v.note ? `: “${v.note}”` : ""}` };
      // sent back → straight to the voucher on Cost Entry, where it is fixed
      const link = v.status === "rejected" ? `/entry-data/cost-entry?voucher=${id}` : "/reports/cost-report";
      await deliver({ companyId, branchId, uids: [v.by.uid], type: "requests.mine", message, link, ref: `costs/${id}` });
      const done = v.status === "approved"
        ? { title: `Voucher approved · ${b.name}`, body: `${what} — approved by ${by}` }
        : { title: `Voucher sent back · ${b.name}`, body: `${what} — sent back by ${by}` };
      await closeOut({ companyId, uids: await approvers(companyId, branchId, b), ref: `costs/${id}`, type: "costs.approval", message: done, link: "/reports/cost-report" });
    }
  }

  // ── task reminders (4.11) ──────────────────────────────────────────────────
  /**
   * Once an hour: at a branch's morning time (settings/notifications.tasksMorningAt,
   * default 09:00) everyone with tasks hears what is on today; at its evening
   * time (tasksEveningAt, default two hours before the day ends) those with
   * something still left hear what. A marker per branch, day and time means
   * each goes out once. Muting "tasks.reminder" turns it off for oneself.
   */
  async function taskReminders(now = new Date()) {
    for (const company of await db.collection("companies").listDocuments()) {
      let all = null;
      for (const branchRef of await company.collection("branches").listDocuments()) {
        try {
          const b = await branch(company.id, branchRef.id);
          const hour = N.localHour(now, b.timeZone);
          const when =
            hour === N.hourOf(b.config.tasksMorningAt || N.DEFAULT_MORNING_AT) ? "morning" : hour === N.hourOf(b.config.tasksEveningAt || N.defaultEveningAt(b.cutoff)) ? "evening" : null;
          if (!when) continue;
          const tasks = (await branchRef.collection("tasks").get()).docs.map((d) => ({ id: d.id, ...d.data() }));
          if (!tasks.length) continue;
          const today = N.businessDateFor(now, b.cutoff, b.timeZone);
          try {
            await branchRef.collection("notifyLog").doc(`tasks-${when}-${today}`).create({ at: FieldValue.serverTimestamp() });
          } catch {
            continue; // already sent
          }
          const from = N.addDays(today, -N.CATCH_UP_DAYS);
          const checkSnap = await branchRef.collection("taskChecks").where("date", ">=", from).where("date", "<=", today).get();
          const checks = Object.fromEntries(checkSnap.docs.map((d) => [d.id, d.data()]));
          all = all || (await people(company.id));
          const roleOf = (uid) => all.find((p) => p.uid === uid)?.role;
          const byPerson = new Map();
          for (const t of tasks) if (t.assigneeUid) byPerson.set(t.assigneeUid, [...(byPerson.get(t.assigneeUid) || []), t]);
          for (const [uid, mine] of byPerson) {
            if (!roleOf(uid)) continue; // no longer has a login
            const message = N.reminderMessage(when, N.agenda(mine, checks, today), { branchName: b.name });
            if (!message) continue;
            await deliver({
              companyId: company.id,
              branchId: branchRef.id,
              uids: [uid],
              type: "tasks.reminder",
              message,
              link: roleOf(uid) === "staff" ? "/my-tasks" : "/tasks?tab=mine",
              ref: `tasks/reminder-${when}-${today}`,
              tag: `tasks_${when}`,
            });
          }
        } catch (err) {
          console.error("[notify task reminders]", company.id, branchRef.id, err);
        }
      }
    }
  }

  // ── late deliveries (22 Oct 2026) ───────────────────────────────────────────
  /**
   * Once an hour: at a branch's summary time (settings/notifications.dailyAt,
   * default 09:00) the orders sent to a supplier and not here by their day go
   * to those chosen for "Late deliveries" and to whoever sent each one. A
   * marker per branch and day means it goes out once.
   */
  async function lateOrders(now = new Date()) {
    for (const company of await db.collection("companies").listDocuments()) {
      let all = null;
      for (const branchRef of await company.collection("branches").listDocuments()) {
        try {
          const b = await branch(company.id, branchRef.id);
          if (N.localHour(now, b.timeZone) !== N.hourOf(b.config.dailyAt)) continue;
          const today = N.businessDateFor(now, b.cutoff, b.timeZone);
          const sent = (await branchRef.collection("requisitions").where("status", "==", "Sent").get()).docs.map((d) => ({ id: d.id, ...d.data() }));
          const late = sent.map((o) => ({ ...o, days: N.lateDays(o, today) })).filter((o) => o.days > 0);
          if (!late.length) continue;
          try {
            await branchRef.collection("notifyLog").doc(`orders-late-${today}`).create({ at: FieldValue.serverTimestamp() });
          } catch {
            continue; // already sent
          }
          all = all || (await people(company.id));
          const office = N.branchPeople(all, branchRef.id);
          const chosen = N.recipientsFor("purchases.late", { config: b.config, people: office });
          const mayHear = (uid) => office.some((p) => p.uid === uid && N.mayGet("purchases.late", p.role));
          // each person hears about the orders that are theirs to chase: all of
          // them if chosen for the branch, else the ones they sent
          const forWhom = new Map(chosen.map((u) => [u, late]));
          for (const o of late) {
            const by = o.sentBy || o.createdBy;
            if (by && mayHear(by) && !forWhom.has(by)) forWhom.set(by, late.filter((x) => (x.sentBy || x.createdBy) === by));
          }
          for (const [uid, list] of forWhom) {
            const message = N.lateOrdersMessage(list, { branchName: b.name });
            if (!message) continue;
            await deliver({ companyId: company.id, branchId: branchRef.id, uids: [uid], type: "purchases.late", message, link: "/purchases/purchase-orders", ref: `requisitions/late-${today}`, tag: "orders_late" });
          }
        } catch (err) {
          console.error("[notify late orders]", company.id, branchRef.id, err);
        }
      }
    }
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

  // ── issues (4.5) ───────────────────────────────────────────────────────────
  const issueLink = (role, branchId, id) => `${role === "staff" ? "/my-issues" : "/issues"}?i=${branchId}/${id}`;

  /** An issue was written: who reported it, who has it, and management, as it changes. */
  async function onIssue({ companyId, branchId, id, before, after }) {
    if (!after) return;
    const [all, b] = await Promise.all([people(companyId), branch(companyId, branchId)]);
    const roleOf = (uid) => all.find((p) => p.uid === uid)?.role;
    const cat = N.categoryOf(after.category);
    const what = `${after.priority === "urgent" ? "🚩 " : ""}${after.title}`;
    const tell = (uids, type, title, body) =>
      Promise.all(
        [...new Set(uids)].filter(Boolean).map((u) => deliver({ companyId, branchId, uids: [u], type, message: { title, body }, link: issueLink(roleOf(u), branchId, id), ref: `issues/${id}` }))
      );

    if (!before) {
      // a new issue: management at the branch (as chosen in its notification settings)
      const managers = N.recipientsFor("issues.new", { config: b.config, people: N.branchPeople(all, branchId) }).filter((u) => u !== after.reporterUid);
      await tell(managers, "issues.new", `${after.priority === "urgent" ? "Urgent issue" : "New issue"} · ${b.name}`, `${cat.emoji} ${after.title} — reported by ${after.reportedBy?.name || "someone"}`);
    }
    if (after.assigneeUid && after.assigneeUid !== before?.assigneeUid && after.assigneeUid !== after.reporterUid) {
      await tell([after.assigneeUid], "issues.mine", `Issue for you · ${b.name}`, `${what}${after.dueDate ? ` — fix by ${after.dueDate}` : ""}`);
    }
    if (before && before.status !== "resolved" && after.status === "resolved" && after.resolvedBy?.uid !== after.reporterUid) {
      await tell([after.reporterUid], "issues.mine", "Issue resolved", `${what} — ${after.resolvedBy?.name || "someone"}${after.resolution ? `: “${after.resolution}”` : ""}`);
    }
    if (before && before.status === "resolved" && after.status === "open" && after.assigneeUid) {
      await tell([after.assigneeUid], "issues.mine", "Issue reopened", what);
    }
  }

  /**
   * Tasks (4.11): given (or handed over) → whoever has it now; a one-off done →
   * whoever gave it. Ticks of a daily checklist tell no one — the Team tab shows them.
   */
  async function onTask({ companyId, branchId, id, before, after }) {
    if (!after) return;
    const [all, b] = await Promise.all([people(companyId), branch(companyId, branchId)]);
    const linkFor = (uid) => (all.find((p) => p.uid === uid)?.role === "staff" ? "/my-tasks" : "/tasks");
    const what = `${after.priority === "urgent" ? "🚩 " : ""}${after.title}`;
    const day = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
    const when = after.repeat ? N.repeatText(after) : after.dueDate ? `by ${day(after.dueDate)}` : "";
    // who gave it last: the supervisor who handed it on, else whoever made it
    const passer = after.via?.length ? after.via[after.via.length - 1] : null;
    if (after.assigneeUid && after.assigneeUid !== before?.assigneeUid && after.assigneeUid !== after.creatorUid) {
      const by = passer?.name || after.createdBy?.name || "Your manager";
      await deliver({ companyId, branchId, uids: [after.assigneeUid], type: "tasks.mine", message: { title: `New task · ${b.name}`, body: `${what}${when ? ` — ${when}` : ""} · from ${by}` }, link: `${linkFor(after.assigneeUid)}?task=${id}`, ref: `tasks/${id}` });
    }
    // handed on by a supervisor: whoever gave it hears who is doing it now
    if (before && (after.via?.length || 0) > (before.via?.length || 0) && after.creatorUid && after.creatorUid !== passer?.uid) {
      await deliver({ companyId, branchId, uids: [after.creatorUid], type: "tasks.mine", message: { title: "Task handed on", body: `${what} — ${passer?.name || "Your supervisor"} gave it to ${after.assignee?.name || "someone"}` }, link: `${linkFor(after.creatorUid)}?task=${id}`, ref: `tasks/${id}` });
    }
    if (!after.repeat && before?.status !== "done" && after.status === "done" && after.creatorUid && after.done?.by?.uid !== after.creatorUid) {
      await deliver({ companyId, branchId, uids: [after.creatorUid], type: "tasks.mine", message: { title: "Task done", body: `${what} — ${after.done?.by?.name || "someone"}${after.done?.note ? `: “${after.done.note}”` : ""}` }, link: `${linkFor(after.creatorUid)}?task=${id}`, ref: `tasks/${id}` });
    }
  }

  /** A question or answer on a task: everyone involved in it — who has it, leads it, gave it or passed it on — but the writer. */
  async function onTaskComment({ companyId, branchId, taskId, comment }) {
    if (!comment) return;
    const snap = await db.doc(`companies/${companyId}/branches/${branchId}/tasks/${taskId}`).get();
    if (!snap.exists) return;
    const t = snap.data();
    const all = await people(companyId);
    const roleOf = (uid) => all.find((p) => p.uid === uid)?.role;
    const uids = [t.assigneeUid, t.teamLeadUid, t.creatorUid, ...(t.via || []).map((v) => v.uid)].filter((u) => u && u !== comment.byUid && roleOf(u));
    const asking = comment.byUid === t.assigneeUid;
    const text = comment.text ? `“${String(comment.text).slice(0, 120)}”` : comment.voice ? "🎤 sent a voice message" : "sent a photo";
    for (const u of [...new Set(uids)]) {
      await deliver({
        companyId,
        branchId,
        uids: [u],
        type: "tasks.mine",
        message: { title: `${asking ? "Question" : "Reply"} on “${t.title}”`, body: `${comment.byName || "Someone"}: ${text}` },
        link: `${roleOf(u) === "staff" ? "/my-tasks" : "/tasks"}?task=${taskId}`,
        ref: `tasks/${taskId}`,
        tag: `task_${taskId}`,
      });
    }
  }

  /** A comment on an issue: everyone involved but whoever wrote it. */
  async function onIssueComment({ companyId, branchId, issueId, comment }) {
    if (!comment || comment.kind !== "comment") return;
    const snap = await db.doc(`companies/${companyId}/branches/${branchId}/issues/${issueId}`).get();
    if (!snap.exists) return;
    const issue = snap.data();
    const all = await people(companyId);
    const to = [...new Set([...(issue.watchers || []), issue.reporterUid, issue.assigneeUid])].filter((u) => u && u !== comment.byUid);
    const body = `${comment.byName || "Someone"}: ${comment.text || "📷 Photo"}`;
    for (const u of to) {
      const role = all.find((p) => p.uid === u)?.role;
      await deliver({ companyId, branchId, uids: [u], type: "issues.mine", message: { title: `Comment · ${issue.title}`, body }, link: issueLink(role, branchId, issueId), ref: `issues/${issueId}` });
    }
  }

  /**
   * A staff record (or its private half) changed: if it has a login, keep the
   * phone / IC lookups (staffLogins) in step — old numbers stop working,
   * new ones start (docs/STAFF_APP.md).
   */
  async function onStaffLogin({ companyId, branchId, staffId }) {
    const branch = db.doc(`companies/${companyId}/branches/${branchId}`);
    const [s, p] = await Promise.all([branch.collection("staff").doc(staffId).get(), branch.collection("staffPrivate").doc(staffId).get()]);
    if (!s.exists) return;
    const staff = s.data();
    if (!staff.uid) return;
    const priv = p.exists ? p.data() : {};
    const keys = await N.loginKeys({ phone: staff.phone, ic: priv.icNumber || priv.passportNumber });
    const old = await db.collection("staffLogins").where("uid", "==", staff.uid).get();
    const batch = db.batch();
    old.docs.filter((d) => !keys.includes(d.id)).forEach((d) => batch.delete(d.ref));
    keys.forEach((k) => batch.set(db.collection("staffLogins").doc(k), { uid: staff.uid, email: staff.loginEmail || "" }));
    await batch.commit();
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

  return { deliver, onRequest, onPurchaseOrder, lateOrders, onPayout, onCostVoucher, dailySummaries, onChatMessage, onUser, onIssue, onIssueComment, onTask, onTaskComment, taskReminders, onStaffLogin };
};
