"use client";
// Send to supplier (22 Oct 2026): the order really goes out — a WhatsApp
// message ready to send, the PDF shared from the phone, an email — and the
// order remembers who sent it, how, and the day it should come
// (lib/purchases/orders.js).
import React, { useEffect, useState } from "react";
import { Copy, FileText, Mail, MessageCircle, Phone } from "lucide-react";
import { DatePicker, Field, Textarea } from "@/app/components/ui";
import Sheet from "@/app/components/purchases/Sheet";
import { personName } from "@/lib/people";
import { regionOf } from "@/lib/region";
import buildPurchaseOrderPdf, { loadLogo, poReference } from "@/lib/purchases/purchaseOrderPdf";
import { defaultDeliverBy, mailLink, orderMessage, sentPatch, waLink, waNumber } from "@/lib/purchases/orders";
import { useOrdersContext } from "../OrdersContext";

const btn =
  "min-h-[52px] rounded-2xl px-4 font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-40 active:brightness-95";

export default function SendOrderSheet({ today }) {
  const { sendingOrder: order, setSendingOrder, vendors, company, branch, branchSettings, currency, user, runStatusChange, toastOk, toastError } = useOrdersContext();
  const vendor = vendors.find((v) => v.id === order?.vendorId);
  const basic = branchSettings?.basic || {};
  const timeZone = regionOf(branchSettings).timeZone;
  const [deliverBy, setDeliverBy] = useState("");
  const [text, setText] = useState("");
  const [edited, setEdited] = useState(false);
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState(false);

  const ref = order ? poReference(order) : "";
  const from = [company?.name || basic.companyName, branch?.name].filter(Boolean).join(" · ");
  const compose = (day) => orderMessage(order, { ref, from, address: basic.address, phone: basic.phone, deliverBy: day });

  useEffect(() => {
    if (!order) return;
    const day = order.deliverBy || defaultDeliverBy(today, vendor);
    setDeliverBy(day);
    setText(compose(day));
    setEdited(false);
    setCopied(false);
    setBusy("");
  }, [order?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickDay = (day) => {
    setDeliverBy(day);
    if (!edited) setText(compose(day));
  };

  const close = () => setSendingOrder(null);
  const markSent = async (via) => {
    await runStatusChange(order, sentPatch({ via, deliverBy, user: { uid: user?.uid, name: personName(user) } }), `Sent to ${order.vendorName}.`);
    close();
  };

  const phone = waNumber(vendor?.phone, timeZone);
  const email = vendor?.email || vendor?.enquiriesEmail || "";

  const viaWhatsApp = async () => {
    window.open(waLink(vendor.phone, text, timeZone), "_blank", "noopener");
    await markSent("whatsapp");
  };

  const viaPdf = async () => {
    setBusy("pdf");
    try {
      const logoDataUrl = await loadLogo(company?.logo);
      const args = { order, vendor, company, branch, branchBasic: basic, currency, logoDataUrl, deliverBy };
      const file = buildPurchaseOrderPdf({ ...args, save: false });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: ref, text });
        } catch (e) {
          if (e?.name === "AbortError") return; // closed the share sheet: not sent
          throw e;
        }
      } else {
        // a computer: download it, to attach in WhatsApp Web or an email
        buildPurchaseOrderPdf(args);
        toastOk("PDF downloaded — attach it to your message to the supplier.");
      }
      await markSent("pdf");
    } catch (e) {
      console.error(e);
      toastError("Could not make the PDF.");
    } finally {
      setBusy("");
    }
  };

  const viaEmail = async () => {
    window.location.href = mailLink(email, `Purchase order ${ref}`, text);
    await markSent("email");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      toastError("Could not copy — select the text and copy it.");
    }
  };

  return (
    <Sheet
      open={!!order}
      title={order?.status === "Sent" ? "Send again" : "Send to supplier"}
      subtitle={order ? `${order.vendorName} · ${ref}` : ""}
      onClose={close}
      maxWidth="max-w-2xl"
      footer={
        <button onClick={() => markSent(copied ? "copy" : "other")} className={`${btn} w-full bg-surface-2 text-fg`}>
          <Phone className="w-4 h-4" /> {copied ? "I sent the copied message" : "Already sent (phone call or in person)"}
        </button>
      }
    >
      {order && (
        <div className="space-y-4">
          <Field label="Deliver by" hint={vendor?.leadDays != null && vendor?.leadDays !== "" ? `${order.vendorName} usually delivers in ${vendor.leadDays} day${Number(vendor.leadDays) === 1 ? "" : "s"}` : "Set how many days this supplier takes in Vendors"}>
            {() => <DatePicker size="lg" value={deliverBy} onChange={pickDay} />}
          </Field>

          <Field label="Message" hint="Items and quantities — no prices. Change it if you need to.">
            {({ id }) => (
              <Textarea
                id={id}
                rows={9}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setEdited(true);
                }}
                className="font-mono text-[13px]"
              />
            )}
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button onClick={viaWhatsApp} disabled={!phone} className={`${btn} bg-[#25D366] text-white`}>
              <MessageCircle className="w-5 h-5" /> WhatsApp
            </button>
            <button onClick={viaPdf} disabled={!!busy} className={`${btn} bg-info text-white`}>
              <FileText className={`w-5 h-5 ${busy === "pdf" ? "animate-pulse" : ""}`} /> Share the PDF
            </button>
            <button onClick={viaEmail} disabled={!email} className={`${btn} bg-surface-2 text-fg`}>
              <Mail className="w-5 h-5" /> Email
            </button>
            <button onClick={copy} className={`${btn} bg-surface-2 text-fg`}>
              <Copy className="w-5 h-5" /> {copied ? "Copied" : "Copy the message"}
            </button>
          </div>
          {(!phone || !email) && (
            <p className="text-xs text-muted">
              {!phone && !email ? "No phone or email for this supplier" : !phone ? "No phone number for this supplier" : "No email for this supplier"} — add it in Purchases → Vendors.
            </p>
          )}
          <p className="text-xs text-subtle">The order is marked as sent when you pick how it goes; it then waits for the goods.</p>
        </div>
      )}
    </Sheet>
  );
}
