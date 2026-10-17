"use client";
import { House, RotateCw, TriangleAlert } from "lucide-react";
import StatusScreen from "@/app/components/common/StatusScreen";

export default function DashboardError({ error, reset }) {
  return (
    <StatusScreen
      full={false}
      icon={TriangleAlert}
      title="The dashboard couldn't load"
      message="Something went wrong loading the branch's figures. Trying again usually clears it."
      detail={error?.message}
      actions={[
        { label: "Home", icon: House, href: "/" },
        { label: "Try again", icon: RotateCw, onClick: () => reset(), primary: true },
      ]}
    />
  );
}
