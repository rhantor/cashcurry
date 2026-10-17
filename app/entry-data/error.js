"use client";
import { House, RotateCw, TriangleAlert } from "lucide-react";
import StatusScreen from "@/app/components/common/StatusScreen";

export default function EntryDataError({ error, reset }) {
  return (
    <StatusScreen
      full={false}
      icon={TriangleAlert}
      title="This form couldn't load"
      message="Something went wrong opening it. What was already saved is safe — trying again usually clears it."
      detail={error?.message}
      actions={[
        { label: "Home", icon: House, href: "/" },
        { label: "Try again", icon: RotateCw, onClick: () => reset(), primary: true },
      ]}
    />
  );
}
