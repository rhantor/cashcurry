"use client";
// Your own signature (owner, 1 Nov): drawn here or a photo of it, kept on your
// entry in the company's people list. Vouchers you prepare or approve carry it;
// without one, your name goes on in handwriting style.
import { useEffect, useRef, useState } from "react";
import { ImageUp, PenLine, Trash2 } from "lucide-react";
import { Button, Sheet, toast } from "@/app/components/ui";
import SignPad from "@/app/components/common/SignPad";
import { saveSignature, tidySignature, useSignature } from "@/lib/signatures/client";

export default function MySignatureSheet({ open, onClose, user }) {
  const saved = useSignature(open ? user?.companyId : null, user?.uid);
  const [drawn, setDrawn] = useState(null);
  const [redo, setRedo] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setDrawn(null);
      setRedo(false);
    }
  }, [open]);

  const keep = async (src) => {
    setBusy(true);
    try {
      const tidy = await tidySignature(src);
      if (!tidy) return toast.error("Nothing to save", { description: "Draw your signature first." });
      await saveSignature(user.companyId, user.uid, tidy);
      toast.success("Signature saved", { description: "It goes on the vouchers you prepare or approve." });
      onClose();
    } catch (e) {
      toast.error("Couldn't save the signature", { description: e.message });
    } finally {
      setBusy(false);
    }
  };

  const fromPhoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Pick a picture of your signature");
    const reader = new FileReader();
    reader.onload = () => keep(reader.result);
    reader.readAsDataURL(file);
  };

  const remove = async () => {
    setBusy(true);
    try {
      await saveSignature(user.companyId, user.uid, null);
      toast.success("Signature removed");
    } catch (e) {
      toast.error("Couldn't remove it", { description: e.message });
    } finally {
      setBusy(false);
    }
  };

  const drawing = redo || !saved;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="My signature"
      description="It goes on the vouchers you prepare or approve. Without one, your name is written in handwriting style."
      footer={
        drawing ? (
          <Button icon={PenLine} onClick={() => keep(drawn)} loading={busy} disabled={!drawn}>Save signature</Button>
        ) : (
          <Button variant="ghost" onClick={onClose}>Done</Button>
        )
      }
    >
      <div className="space-y-4">
        {saved === undefined ? null : !drawing ? (
          <div className="space-y-3">
            <div className="flex h-32 items-center justify-center rounded-2xl border border-line bg-white p-3">
              <img src={saved} alt="Your saved signature" className="max-h-full max-w-full object-contain" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" icon={PenLine} onClick={() => setRedo(true)}>Sign again</Button>
              <Button size="sm" variant="ghost" icon={Trash2} onClick={remove} loading={busy}>Remove</Button>
            </div>
          </div>
        ) : (
          <>
            <SignPad value={drawn} onChange={setDrawn} />
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-line" />
              <span className="text-xs text-subtle">or</span>
              <span className="h-px flex-1 bg-line" />
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={fromPhoto} />
            <Button size="sm" variant="secondary" icon={ImageUp} onClick={() => fileRef.current?.click()} loading={busy}>
              Use a photo of my signature
            </Button>
            <p className="text-xs text-muted">Sign on white paper and take a clear photo — the white is made clear.</p>
          </>
        )}
      </div>
    </Sheet>
  );
}
