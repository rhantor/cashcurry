"use client";
// Live chat data (roadmap 4.4): the person's chats with unread marks, one
// chat's messages (newest 50, more on request), who has seen what, and the
// directory of people to message.
import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { isCompanyRole } from "@/lib/authz/permissions";
import { COMPANY_CHAT, PAGE_SIZE, branchChatId, isUnread, timeOf } from "@/lib/chat/model";
import { chatDoc, chatsCol, ensureChat, labelsDoc, messagesCol, readsCol, stickersCol } from "@/lib/chat/client";

/** Everyone in the company who can be messaged: [{ uid, name, role, branchId }]. */
export function useChatPeople(companyId) {
  const [people, setPeople] = useState([]);
  useEffect(() => {
    if (!companyId) return;
    getDocs(collection(db, "companies", companyId, "chatPeople"))
      .then((s) => setPeople(s.docs.map((d) => ({ uid: d.id, ...d.data() })).sort((a, b) => String(a.name).localeCompare(String(b.name)))))
      .catch(() => setPeople([]));
  }, [companyId]);
  return people;
}

/**
 * This person's chats, newest activity first, each with `unread`.
 * branches: [{ id, name }] — company roles see every branch's chat.
 */
export function useChats(user, branches = []) {
  const companyId = user?.companyId;
  const uid = user?.uid;
  const company = isCompanyRole(user?.role);
  const branchIds = useMemo(() => (company ? branches.map((b) => b.id) : user?.branchId ? [user.branchId] : []), [company, branches, user?.branchId]);
  const branchKey = branchIds.join(",");
  const [fixed, setFixed] = useState({}); // company + branch chats by id
  const [member, setMember] = useState([]); // groups and personal chats
  const [reads, setReads] = useState({});
  const [ready, setReady] = useState(false);

  // the company chat and the branch chats: make sure they exist, then follow them
  useEffect(() => {
    if (!companyId || !uid) return;
    const names = Object.fromEntries(branches.map((b) => [b.id, b.name]));
    const ids = [COMPANY_CHAT, ...branchIds.map(branchChatId)];
    const stops = [];
    let cancelled = false;
    (async () => {
      await ensureChat(companyId, { kind: "company" }).catch(() => {});
      await Promise.all(branchIds.map((b) => ensureChat(companyId, { kind: "branch", branchId: b, name: names[b] }).catch(() => {})));
      if (cancelled) return;
      for (const id of ids) {
        stops.push(
          onSnapshot(
            chatDoc(companyId, id),
            (s) => setFixed((m) => ({ ...m, [id]: s.exists() ? { id, ...s.data() } : null })),
            () => setFixed((m) => ({ ...m, [id]: null }))
          )
        );
      }
    })();
    return () => {
      cancelled = true;
      stops.forEach((s) => s());
    };
  }, [companyId, uid, branchKey]);

  // groups and personal chats this person is in
  useEffect(() => {
    if (!companyId || !uid) return;
    return onSnapshot(
      query(chatsCol(companyId), where("members", "array-contains", uid)),
      (s) => {
        setMember(s.docs.map((d) => ({ id: d.id, ...d.data() })));
        setReady(true);
      },
      () => setReady(true)
    );
  }, [companyId, uid]);

  const chats = useMemo(() => [...Object.values(fixed).filter(Boolean), ...member], [fixed, member]);
  const idsKey = chats.map((c) => c.id).sort().join(",");

  // when this person last looked at each
  useEffect(() => {
    if (!companyId || !uid || !idsKey) return;
    const stops = idsKey.split(",").map((id) =>
      onSnapshot(
        doc(readsCol(companyId, id), uid),
        // "estimate": a read mark just written counts at once (not as "never" until the server answers)
        (s) => setReads((r) => ({ ...r, [id]: s.exists() ? s.data({ serverTimestamps: "estimate" }) : null })),
        () => {}
      )
    );
    return () => stops.forEach((s) => s());
  }, [companyId, uid, idsKey]);

  const list = useMemo(
    () =>
      chats
        // unread only once we know when this person last looked — not while that is still loading
        .map((c) => ({ ...c, unread: c.id in reads && isUnread(c, reads[c.id], uid) }))
        .sort((a, b) => timeOf(b.lastMessage?.at || b.updatedAt) - timeOf(a.lastMessage?.at || a.updatedAt)),
    [chats, reads, uid]
  );
  return { chats: list, unread: list.filter((c) => c.unread).length, ready };
}

/** One chat's messages, oldest first; `more()` loads 50 earlier ones. */
export function useMessages(companyId, chatId) {
  const [count, setCount] = useState(PAGE_SIZE);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  useEffect(() => setCount(PAGE_SIZE), [chatId]);
  useEffect(() => {
    if (!companyId || !chatId) return;
    setLoading(true);
    return onSnapshot(
      query(messagesCol(companyId, chatId), orderBy("createdAt", "desc"), limit(count)),
      { includeMetadataChanges: true }, // so "sending…" turns into ✓ when the server has it
      (s) => {
        setMessages(s.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }), pending: d.metadata.hasPendingWrites })).reverse());
        setHasMore(s.size >= count);
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, [companyId, chatId, count]);
  return { messages, loading, hasMore, more: () => setCount((c) => c + PAGE_SIZE) };
}

/** When everyone in a chat last looked: { uid: { at } }. */
export function useReads(companyId, chatId) {
  const [reads, setReads] = useState({});
  useEffect(() => {
    if (!companyId || !chatId) return;
    return onSnapshot(
      readsCol(companyId, chatId),
      (s) => setReads(Object.fromEntries(s.docs.map((d) => [d.id, d.data({ serverTimestamps: "estimate" })]))),
      () => setReads({})
    );
  }, [companyId, chatId]);
  return reads;
}

/** The company's own stickers, newest last. */
export function useCompanyStickers(companyId) {
  const [stickers, setStickers] = useState([]);
  useEffect(() => {
    if (!companyId) return;
    return onSnapshot(
      query(stickersCol(companyId), orderBy("createdAt")),
      (s) => setStickers(s.docs.map((d) => ({ id: d.id, ...d.data(), pack: "company" }))),
      () => setStickers([])
    );
  }, [companyId]);
  return stickers;
}

/** This person's chat labels: { labels: [{ id, name, color }], chats: { chatId: [ids] } }. */
export function useChatLabels(companyId, uid) {
  const [prefs, setPrefs] = useState({ labels: [], chats: {} });
  useEffect(() => {
    if (!companyId || !uid) return;
    return onSnapshot(
      labelsDoc(companyId, uid),
      (s) => setPrefs(s.exists() ? { labels: s.data().labels || [], chats: s.data().chats || {} } : { labels: [], chats: {} }),
      () => {}
    );
  }, [companyId, uid]);
  return prefs;
}

/** The company's branches ({ id, name }), followed live — names for branch chats. */
export function useBranchList(companyId) {
  const [branches, setBranches] = useState([]);
  useEffect(() => {
    if (!companyId) return;
    return onSnapshot(
      collection(db, "companies", companyId, "branches"),
      (s) => setBranches(s.docs.map((d) => ({ id: d.id, name: d.data().name || d.id }))),
      () => setBranches([])
    );
  }, [companyId]);
  return branches;
}
