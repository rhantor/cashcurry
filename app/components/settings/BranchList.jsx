"use client";
import { useRouter } from "next/navigation";
import React from "react";

const BranchList = ({ branches }) => {
  const router = useRouter();

  return (
    <div>
      <h3 className="font-medium mb-2">All Branches</h3>
      <div className="space-y-2">
        {branches.map((b) => (
          <div
            key={b.id}
            onClick={() => router.push(`/branches/${b.id}`)}
            className="border px-4 py-3 rounded bg-surface-2/60 shadow-sm cursor-pointer hover:bg-surface-2 transition flex flex-col"
          >
            <h4 className="font-semibold text-fg">{b.name}</h4>
            <p className="text-sm text-muted">{b.address}</p>
            <div className="text-sm text-muted">
              📞 {b.contact} | ✉️ {b.email}
            </div>
            {b.note && (
              <p className="text-xs text-subtle mt-1">Note: {b.note}</p>
            )}
            {b.admins ? (
              b.admins.map((admin) => (
                <p className="text-sm text-brand mt-1" key={admin.id}>
                  👤 Admin: {admin.name} ({admin.email})
                </p>
              ))
            ) : (
              <p className="text-sm text-danger mt-1">No admin assigned</p>
            )}
            {b.users ? (
              b.users.map((user) => (
                <p className="text-sm text-brand mt-1" key={user.id}>
                  👤  {user.role} ({user.email})
                </p>
              ))
            ) : (
              <p className="text-sm text-danger mt-1">No User Assign</p>
            )}
          </div>
        ))}
        {branches.length === 0 && (
          <p className="text-muted text-sm">No branches yet.</p>
        )}
      </div>
    </div>
  );
};

export default BranchList;
