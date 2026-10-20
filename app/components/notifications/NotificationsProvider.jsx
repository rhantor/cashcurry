"use client";
// The signed-in person's notifications (roadmap 4.3): their inbox, live
// (companies/{c}/users/{uid}/inbox, written by the server), shared by the bell
// and anything else that shows a count. A new one while the app is open pops
// up as a toast — with or without push on this device.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp, writeBatch, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { enablePush, pushState, refreshPush } from "@/lib/notify/push";
import { toast } from "@/app/components/ui";

const Ctx = createContext(null);
const EMPTY = { items: [], unread: 0, ready: false, push: "unavailable" };

export function useNotifications() {
  return useContext(Ctx) || { ...EMPTY, markRead: () => {}, markAllRead: () => {}, clearAll: () => {}, open: () => {}, turnOnPush: async () => "unavailable" };
}

export default function NotificationsProvider({ user, children }) {
  const router = useRouter();
  const companyId = user?.companyId;
  const uid = user?.uid;
  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);
  const [push, setPush] = useState("unavailable");
  const seen = useRef(null); // ids already shown, so only new ones toast

  // push on this device: where it stands, and a quiet token refresh if allowed
  useEffect(() => {
    if (!companyId || !uid) return;
    pushState().then(setPush);
    refreshPush({ companyId, uid });
  }, [companyId, uid]);

  const open = useCallback(
    (n) => {
      if (n && !n.readAt) updateDoc(doc(db, "companies", companyId, "users", uid, "inbox", n.id), { readAt: serverTimestamp() }).catch(() => {});
      if (n?.link) router.push(n.link);
    },
    [companyId, uid, router]
  );

  useEffect(() => {
    if (!companyId || !uid) return;
    seen.current = null;
    const q = query(collection(db, "companies", companyId, "users", uid, "inbox"), orderBy("createdAt", "desc"), limit(50));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data(), at: d.data().createdAt?.toDate?.() || null }));
        // new = an id not seen before, or one updated since (a chat's line in the bell is
        // one document that each new message updates)
        if (seen.current) {
          const inChat = window.location.pathname.startsWith("/messages");
          for (const n of list) {
            const at = n.at?.getTime?.() || 0;
            const fresh = !seen.current.has(n.id) || seen.current.get(n.id) < at;
            if (fresh && !n.readAt && !(n.type === "chat" && inChat)) toast.info(n.title, { description: n.body });
          }
        }
        seen.current = new Map(list.map((n) => [n.id, n.at?.getTime?.() || 0]));
        setItems(list);
        setReady(true);
      },
      () => setReady(true) // not readable yet (rules not deployed) — an empty bell, not an error
    );
  }, [companyId, uid, open]);

  const value = useMemo(() => {
    const ref = (id) => doc(db, "companies", companyId, "users", uid, "inbox", id);
    return {
      items,
      ready,
      unread: items.filter((n) => !n.readAt).length,
      push,
      open,
      markRead: (id) => updateDoc(ref(id), { readAt: serverTimestamp() }).catch(() => {}),
      markAllRead: async () => {
        const batch = writeBatch(db);
        items.filter((n) => !n.readAt).forEach((n) => batch.update(ref(n.id), { readAt: serverTimestamp() }));
        await batch.commit().catch(() => {});
      },
      clearAll: async () => {
        await Promise.all(items.map((n) => deleteDoc(ref(n.id)).catch(() => {})));
      },
      turnOnPush: async () => {
        const s = await enablePush({ companyId, uid }).catch(() => "off");
        setPush(s);
        return s;
      },
    };
  }, [items, ready, push, open, companyId, uid]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
