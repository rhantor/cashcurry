import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";

export const chatApiSlice = createApi({
  reducerPath: "chatApi",
  baseQuery: fakeBaseQuery(),
  endpoints: (builder) => ({
    getChatMessages: builder.query({
      queryFn: () => ({ data: [] }),
      async onCacheEntryAdded(arg, { updateCachedData, cacheDataLoaded, cacheEntryRemoved }) {
        const { companyId, branchId } = arg;
        if (!companyId || !branchId) return;

        let unsubscribe = () => {};
        try {
          await cacheDataLoaded;
          const messagesRef = collection(db, "companies", companyId, "branches", branchId, "chat_messages");
          const q = query(messagesRef, orderBy("createdAt", "desc"), limit(100)); // get last 100
          
          unsubscribe = onSnapshot(q, (snapshot) => {
             const msgs = [];
             snapshot.forEach(doc => {
                 msgs.push({ id: doc.id, ...doc.data() });
             });
             msgs.reverse(); // oldest first for chat flow
             updateCachedData((draft) => msgs);
          }, (err) => {
             console.error("Chat Error:", err);
          });
        } catch (error) {
          console.error(error);
        }
        await cacheEntryRemoved;
        unsubscribe();
      }
    }),
    sendMessage: builder.mutation({
      async queryFn({ companyId, branchId, senderName, senderUid, senderPhotoUrl, text }) {
        try {
          if (!text.trim()) return { data: "empty" };
          const messagesRef = collection(db, "companies", companyId, "branches", branchId, "chat_messages");
          await addDoc(messagesRef, {
             senderName,
             senderUid,
             senderPhotoUrl: senderPhotoUrl || null,
             text,
             createdAt: serverTimestamp()
          });
          return { data: "success" };
        } catch (error) {
          return { error: { message: error.message } };
        }
      }
    })
  })
});

export const { useGetChatMessagesQuery, useSendMessageMutation } = chatApiSlice;
