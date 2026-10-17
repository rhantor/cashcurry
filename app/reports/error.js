"use client";
import { House, RotateCw, TriangleAlert } from "lucide-react";
import StatusScreen from "@/app/components/common/StatusScreen";

export default function ReportsError({ error, reset }) {
  return (
    <StatusScreen
      full={false}
      icon={TriangleAlert}
      title="This report couldn't load"
      message="Something went wrong working it out. Try again, or pick a shorter period."
      detail={error?.message}
      actions={[
        { label: "All reports", icon: House, href: "/reports" },
        { label: "Try again", icon: RotateCw, onClick: () => reset(), primary: true },
      ]}
    />
  );
}
