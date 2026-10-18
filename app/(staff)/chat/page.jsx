"use client";
// Chat moved to its own workspace (roadmap 4.4): /messages. This old address
// sends people there, keeping which chat to open (?c=).
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function OldChatAddress() {
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    router.replace(`/messages${params.toString() ? `?${params}` : ""}`);
  }, [router, params]);
  return null;
}
