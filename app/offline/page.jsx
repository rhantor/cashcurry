// app/offline/page.js
import React from "react";
export default function OfflinePage() {
  return (
    <main className="p-6 text-center">
      <h1 className="text-xl font-semibold">You’re offline</h1>
      <p className="mt-2 opacity-80">
        Some features need internet. Try again when you’re back online.
      </p>
    </main>
  );
}
