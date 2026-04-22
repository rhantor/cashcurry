/* eslint-disable react/prop-types */
"use client";
import React from "react";

const NotificationsSettings = ({ notifications, setNotifications }) => {
  const toggle = (key) =>
    setNotifications({ ...notifications, [key]: !notifications[key] });

  return (
    <div className="p-4 border rounded-lg shadow-sm space-y-3">
      <h2 className="text-lg font-semibold">Notifications</h2>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={notifications?.email}
          onChange={() => toggle("email")}
        />
        Email Reports
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={notifications?.inApp}
          onChange={() => toggle("inApp")}
        />
        In-App Alerts
      </label>
    </div>
  );
};

export default NotificationsSettings;
