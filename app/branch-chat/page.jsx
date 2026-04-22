"use client";
import React, { useState, useEffect, useRef } from "react";
import { useGetChatMessagesQuery, useSendMessageMutation } from "@/lib/redux/api/chatApiSlice";
import { Send, Hash, MessageCircle } from "lucide-react";
import Cookies from "js-cookie";

export default function BranchChatPage() {
  const [user, setUser] = useState(null);
  const [text, setText] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored));
  }, []);

  // Branch admins/managers use cookie-based branch selection
  const companyId = user?.companyId;
  const cookieKey = companyId ? `activeBranch_${companyId}` : "activeBranch";
  const branchId = user?.role === "owner" || user?.role === "gm" || user?.role === "superAdmin"
    ? (typeof window !== "undefined" ? Cookies.get(cookieKey) : null)
    : user?.branchId;

  const skip = !companyId || !branchId;
  const { data: messages = [], isLoading } = useGetChatMessagesQuery(
    !skip ? { companyId, branchId } : { skip: true }
  );

  const [sendMessage, { isLoading: sending }] = useSendMessageMutation();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() || !user) return;

    const content = text;
    setText("");

    try {
      await sendMessage({
        companyId,
        branchId,
        senderUid: user.uid,
        senderName: user.userName || user.username || user.firstName || "Admin",
        senderPhotoUrl: user.photoUrl || null,
        text: content,
      }).unwrap();
    } catch (err) {
      alert("Failed to send: " + err.message);
      setText(content);
    }
  };

  if (!user) return <div className="p-8 text-center text-gray-400">Loading...</div>;

  return (
    <div className="p-0 lg:p-6 h-[calc(100vh-60px)]">
      <div className="bg-white rounded-none lg:rounded-2xl border-0 lg:border border-gray-100 shadow-none lg:shadow-sm h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center gap-3 bg-gray-50/50">
          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
            <Hash size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 leading-tight">Branch General Chat</h2>
            <p className="text-xs text-gray-500">All staff & management can see this chat</p>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {isLoading && <div className="text-center text-xs text-gray-400">Loading messages...</div>}
          {messages.length === 0 && !isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-20">
              <MessageCircle size={40} className="mb-2 opacity-50" />
              <p>No messages yet</p>
            </div>
          ) : (
            messages.map((msg, i) => {
              const isMe = msg.senderUid === user.uid;
              const prevMsg = i > 0 ? messages[i - 1] : null;
              const isGroup = prevMsg && prevMsg.senderUid === msg.senderUid;

              return (
                <div key={msg.id} className={`flex gap-3 ${isMe ? "flex-row-reverse" : "flex-row"} ${isGroup ? "mt-1" : "mt-4"}`}>
                  {/* Photo Column */}
                  <div className="w-8 shrink-0">
                    {!isGroup && (
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden border border-white shadow-sm font-bold text-blue-600 text-[10px]">
                        {msg.senderPhotoUrl ? (
                          <img src={msg.senderPhotoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span>{msg.senderName?.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className={`flex flex-col ${isMe ? "items-end text-right" : "items-start text-left"}`}>
                    {!isMe && !isGroup && (
                      <span className="text-[11px] font-bold text-gray-500 mb-1 ml-1">{msg.senderName}</span>
                    )}
                    <div className={`px-4 py-2.5 max-w-[100%] text-sm shadow-sm ${
                      isMe
                        ? "bg-blue-600 text-white rounded-2xl rounded-tr-sm"
                        : "bg-white text-gray-800 border-gray-100 border rounded-2xl rounded-tl-sm"
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Input */}
        <div className="bg-white p-3 border-t">
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-gray-100 border-none rounded-full px-5 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-100 transition"
            />
            <button
              type="submit"
              disabled={!text.trim() || sending}
              className="w-11 h-11 flex items-center justify-center bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:bg-gray-300 transition shadow-md"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
