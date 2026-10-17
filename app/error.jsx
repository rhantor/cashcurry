"use client";
import { House, RotateCw, TriangleAlert } from "lucide-react";
import StatusScreen from "@/app/components/common/StatusScreen";

export default function GlobalError({ error, reset }) {
  return (
    <StatusScreen
      full={false}
      icon={TriangleAlert}
      title="Something went wrong"
      message="This page hit a problem. Trying again usually fixes it; nothing you saved is lost."
      detail={error?.message}
      actions={[
        { label: "Home", icon: House, href: "/" },
        { label: "Try again", icon: RotateCw, onClick: () => reset(), primary: true },
      ]}
    />
  );
}
