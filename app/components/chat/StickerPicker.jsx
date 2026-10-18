"use client";
// Stickers: the Cash Curry pack, and the company's own — which management
// adds (an image up to 1 MB) and removes. Picking one sends it.
import { useRef, useState } from "react";
import { ImagePlus, Loader2, Sticker, X } from "lucide-react";
import { Popover, cn, confirmDialog, toast } from "@/app/components/ui";
import { STICKER_PACK, canMakeGroups, isStickerFile } from "@/lib/chat/model";
import { addCompanySticker, deleteCompanySticker } from "@/lib/chat/client";
import { useCompanyStickers } from "./useChat";

export default function StickerPicker({ user, onPick, disabled }) {
  const [tab, setTab] = useState("cashcurry");
  const [busy, setBusy] = useState(false);
  const company = useCompanyStickers(user?.companyId);
  const manage = canMakeGroups(user?.role);
  const picker = useRef(null);
  const list = tab === "cashcurry" ? STICKER_PACK : company;

  const add = async (file) => {
    if (!file) return;
    if (!isStickerFile(file)) return toast.error("Can't use that as a sticker", { description: "An image up to 1 MB (PNG, WebP or GIF work best)." });
    setBusy(true);
    try {
      await addCompanySticker(user.companyId, user, file);
      toast.success("Sticker added for everyone");
    } catch (e) {
      toast.error("Couldn't add the sticker", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover
      align="start"
      width={320}
      className="p-0"
      trigger={({ ref, toggle }) => (
        <button ref={ref} type="button" aria-label="Stickers" onClick={toggle} disabled={disabled} className="mb-0.5 rounded-xl p-2 text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-50">
          <Sticker className="size-5" />
        </button>
      )}
    >
      {({ close }) => (
        <div>
          <div className="flex gap-1 border-b border-line p-2">
            {[
              ["cashcurry", "Cash Curry"],
              ["company", "Our stickers"],
            ].map(([v, label]) => (
              <button key={v} type="button" onClick={() => setTab(v)} className={cn("flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors", tab === v ? "bg-brand-soft text-brand" : "text-muted hover:bg-surface-2")}>
                {label}
              </button>
            ))}
          </div>
          <div className="grid max-h-72 grid-cols-4 gap-1.5 overflow-y-auto p-2">
            {list.map((s) => (
              <div key={s.id} className="group relative">
                <button
                  type="button"
                  title={s.name}
                  onClick={() => {
                    onPick(s);
                    close();
                  }}
                  className="block aspect-square w-full rounded-xl p-1 transition-transform hover:scale-110 hover:bg-surface-2"
                >
                  <img src={s.url} alt={s.name} loading="lazy" className="size-full object-contain" />
                </button>
                {tab === "company" && manage && (
                  <button
                    type="button"
                    aria-label={`Remove ${s.name}`}
                    onClick={async () => {
                      if (await confirmDialog({ title: "Remove this sticker?", message: "It goes for everyone; messages already sent keep it.", confirmLabel: "Remove", danger: true })) deleteCompanySticker(user.companyId, s).catch((e) => toast.error("Couldn't remove", { description: e?.message }));
                    }}
                    className="absolute -right-1 -top-1 hidden rounded-full bg-surface p-0.5 text-muted shadow ring-1 ring-line hover:text-danger group-hover:block"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            ))}
            {tab === "company" && manage && (
              <button
                type="button"
                onClick={() => picker.current?.click()}
                disabled={busy}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line text-[10px] font-semibold text-muted hover:border-brand/50 hover:text-brand"
              >
                {busy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
                Add
              </button>
            )}
          </div>
          {tab === "company" && !company.length && (
            <p className="px-4 pb-4 text-center text-xs text-muted">{manage ? "Add your own — a logo, your team, an inside joke. Up to 1 MB." : "Your company hasn't added any stickers yet."}</p>
          )}
          <input ref={picker} type="file" accept="image/png,image/webp,image/gif,image/jpeg" hidden onChange={(e) => (add(e.target.files?.[0]), (e.target.value = ""))} />
        </div>
      )}
    </Popover>
  );
}
