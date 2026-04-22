"use client";

import {React, useState, useEffect } from "react";
import { useGetNotificationsQuery } from "@/lib/redux/api/notificationApiSlice";
import { FaBell } from "react-icons/fa";
import { messaging, onMessage } from "@/lib/firebase"; // ✅ import FCM

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [companyId, setCompanyId] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      setCompanyId(parsed.companyId);
    }
  }, []);

  // ✅ Polling fallback
  const { data: notifications = [], refetch } = useGetNotificationsQuery(
    { companyId },
    { skip: !companyId, pollingInterval: 30000 }
  );

  // ✅ Listen for real-time FCM notifications (foreground only)
  useEffect(() => {
    if (!messaging) return;

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log("📩 Foreground message:", payload);

      // Refetch Firestore
      refetch();

      // Only try native Notification if permission is granted
      if (payload?.notification && Notification.permission === "granted") {
        new Notification(payload.notification.title, {
          body: payload.notification.body,
        });
      }
    });

    return () => unsubscribe();
  }, [refetch]);

  return (
    <div className="relative">
      {/* Bell Icon */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-full hover:bg-gray-200"
      >
        <FaBell className="w-6 h-6" />
        {notifications?.length > 0 && (
          <span className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full px-1">
            {notifications.length}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white shadow-lg rounded-lg border p-2 z-50">
          <h4 className="font-semibold text-gray-700 mb-2">Notifications</h4>
          {notifications.length === 0 ? (
            <p className="text-sm text-gray-500">No notifications</p>
          ) : (
            <ul className="max-h-64 overflow-y-auto space-y-2">
              {notifications
                .slice()
                .sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds)
                .map((n) => (
                  <li
                    key={n.id}
                    className="text-sm bg-gray-50 px-2 py-1 rounded-md border"
                  >
                    {n.message}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
