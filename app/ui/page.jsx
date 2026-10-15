import { notFound } from "next/navigation";
import UIPreview from "./UIPreview";

export const metadata = { title: "UI kit — Cash Curry" };

// The component gallery for Phase 3 (design review). Local and preview builds
// only; production shows it only if NEXT_PUBLIC_UI_PREVIEW=1.
export default function Page() {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_UI_PREVIEW !== "1") notFound();
  return <UIPreview />;
}
