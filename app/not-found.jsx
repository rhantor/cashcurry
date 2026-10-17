"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft, Compass, House } from "lucide-react";
import StatusScreen from "@/app/components/common/StatusScreen";

export default function NotFound() {
  const router = useRouter();
  return (
    <StatusScreen
      full={false}
      icon={Compass}
      tone="info"
      code="404"
      title="There's no page here"
      message="The link may be old, or the address has a typo."
      actions={[
        { label: "Go back", icon: ArrowLeft, onClick: () => router.back() },
        { label: "Home", icon: House, href: "/", primary: true },
      ]}
    />
  );
}
