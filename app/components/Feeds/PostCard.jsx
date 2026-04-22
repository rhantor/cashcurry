"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wrench,
  Megaphone,
  CalendarDays,
  Info,
  Tag,
  CheckCircle,
  MessageCircle,
  Send,
  Trash2,
  HandCoins,
  Banknote
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const iconMap = {
  maintenance: <Wrench className="w-5 h-5 text-orange-500" />,
  notice: <Megaphone className="w-5 h-5 text-red-500" />,
  reservation: <CalendarDays className="w-5 h-5 text-blue-500" />,
  marketing: <Tag className="w-5 h-5 text-purple-500" />,
  general: <Info className="w-5 h-5 text-gray-500" />,
  advance_request: <HandCoins className="w-5 h-5 text-emerald-500" />,
  loan_request: <Banknote className="w-5 h-5 text-teal-500" />
};

const bgMap = {
  maintenance: "bg-orange-50 border-orange-200",
  notice: "bg-red-50 border-red-200",
  reservation: "bg-blue-50 border-blue-200",
  marketing: "bg-purple-50 border-purple-200",
  general: "bg-gray-50 border-gray-200",
  advance_request: "bg-emerald-50 border-emerald-200",
  loan_request: "bg-teal-50 border-teal-200"
};

const PostCard = ({ post, onResolve, onAddComment, comments = [], canManage = false, isAddingComment, onDelete }) => {
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");

  const timeAgo = post.timestamp ? formatDistanceToNow(post.timestamp, { addSuffix: true }) : "Just now";

  const handleCommentSubmit = (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    onAddComment(post.id, newComment);
    setNewComment("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      layout
      className={`rounded-xl border p-4 shadow-sm transition-all ${bgMap[post.type] || bgMap.general} mb-4`}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-full shadow-sm">
            {iconMap[post.type] || iconMap.general}
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">{post.authorName || "Unknown"}</h4>
            <span className="text-xs text-gray-500 capitalize">{post.type} • {timeAgo}</span>
          </div>
        </div>

        {canManage && (
          <div className="flex gap-2">
            {post.type === "maintenance" && (
              <button
                onClick={() => onResolve(post.id, !post.isResolved)}
                title={post.isResolved ? "Mark as Unresolved" : "Mark as Resolved"}
                className={`p-1.5 rounded-full transition-colors ${
                  post.isResolved ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400 hover:bg-green-50 hover:text-green-500"
                }`}
              >
                <CheckCircle className="w-5 h-5" />
              </button>
            )}
            <button
               onClick={() => onDelete(post.id)}
               className="p-1.5 rounded-full bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
               title="Delete Post"
            >
              <Trash2 className="w-5 h-5"/>
            </button>
          </div>
        )}
      </div>

      <div className="mb-4 text-gray-800 whitespace-pre-wrap px-1">
        {post.content}
      </div>

      {post.isResolved && (
        <div className="mb-3 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-md">
          <CheckCircle className="w-3.5 h-3.5" />
          Resolved by {post.resolvedByName || "Admin"}
        </div>
      )}

      <div className="border-t border-black/5 pt-3">
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition"
        >
          <MessageCircle className="w-4 h-4" />
          {comments.length} Comments
        </button>
      </div>

      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-3 pl-2 sm:pl-4 border-l-2 border-black/5">
              {comments.map((c) => (
                <div key={c.id} className="text-sm">
                  <span className="font-semibold text-gray-900 mr-2">{c.authorName}</span>
                  <span className="text-gray-600">{c.content}</span>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {c.timestamp ? formatDistanceToNow(c.timestamp, { addSuffix: true }) : "Just now"}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleCommentSubmit} className="mt-3 flex gap-2">
              <input
                type="text"
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="flex-1 bg-white border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isAddingComment}
              />
              <button
                type="submit"
                disabled={!newComment.trim() || isAddingComment}
                className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default PostCard;
