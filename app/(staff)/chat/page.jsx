"use client";
import React, { useState, useEffect, useRef } from "react";
import { useGetChatMessagesQuery, useSendMessageMutation } from "@/lib/redux/api/chatApiSlice";
import { Send, Hash, MessageCircle } from "lucide-react";

export default function StaffChatPage() {
  const [user, setUser] = useState(null);
  const [text, setText] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored));
  }, []);

  const skip = !user?.companyId || !user?.branchId;
  const { data: messages = [], isLoading } = useGetChatMessagesQuery(
    !skip ? { companyId: user.companyId, branchId: user.branchId } : { skip: true }
  );
  
  const [sendMessage, { isLoading: sending }] = useSendMessageMutation();

  useEffect(() => {
    // Auto-scroll to bottom on new messages
    if (scrollRef.current) {
       scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() || !user) return;
    
    const content = text;
    setText(""); // optimistically clear

    try {
      await sendMessage({
        companyId: user.companyId,
        branchId: user.branchId,
        senderUid: user.uid,
        senderName: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username || "Staff",
        senderPhotoUrl: user.photoUrl || null,
        text: content
      }).unwrap();
    } catch(err) {
      alert("Failed to send message: " + err.message);
      setText(content); // revert
    }
  };

  if (!user) return <div className="p-8 text-center text-gray-400">Loading chat...</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-130px)] md:h-[calc(100vh-60px)]">
       {/* Chat Header */}
       <div className="bg-white px-4 py-3 border-b flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
             <Hash size={20} strokeWidth={2.5}/>
          </div>
          <div>
            <h2 className="font-bold text-gray-900 leading-tight">Branch General</h2>
            <p className="text-xs text-green-600 font-medium tracking-wide">Online</p>
          </div>
       </div>

       {/* Messages Area */}
       <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 flex flex-col">
          {isLoading && <div className="text-center text-sm text-gray-400">Syncing messages...</div>}
          
          {messages.length === 0 && !isLoading ? (
             <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
               <MessageCircle size={40} className="mb-2 opacity-50"/>
               <p>No messages yet. Say hi!</p>
             </div>
          ) : (
            messages.map((msg, i) => {
              const isMe = msg.senderUid === user.uid;
              // Add simple grouping logic if previous message is same sender
              const prevMsg = i > 0 ? messages[i-1] : null;
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
                    <div className={`px-4 py-2.5 max-w-[100%] text-[15px] shadow-sm ${
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

       {/* Input Area */}
       <div className="bg-white p-3 border-t">
          <form onSubmit={handleSend} className="flex items-center gap-2 max-w-lg mx-auto w-full md:max-w-3xl">
             <input 
               type="text" 
               value={text} 
               onChange={e => setText(e.target.value)}
               placeholder="Message Branch General..."
               className="flex-1 bg-gray-100 border-none rounded-full px-5 py-3 text-[15px] outline-none focus:ring-2 focus:ring-blue-100 transition-all"
             />
             <button 
               type="submit" 
               disabled={!text.trim() || sending}
               className="w-12 h-12 flex items-center justify-center bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:bg-gray-300 transition-colors shadow-md"
             >
               <Send size={20} className={!text.trim() ? "translate-x-[-1px]" : "translate-x-[2px]"}/>
             </button>
          </form>
       </div>
    </div>
  );
}
// Note: MessageCircle icon needs to be imported or removed. Quick fix mapping missing import inside the same file would fail. I will fix it.
