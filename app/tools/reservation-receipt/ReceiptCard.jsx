"use client";
// The receipt as the customer sees it — the same card becomes the image and
// the PDF (html-to-image), so both look exactly like the preview. Always on
// white paper with fixed colours: it leaves the app.
import React, { forwardRef } from "react";
import { amountInWords, dayText, methodLabel, money, timeText } from "@/lib/reservations/receipt";

const INK = "#111827";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";
const BRAND = "#0f766e";

const Row = ({ label, children }) => (
  <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "5px 0", fontSize: 13 }}>
    <span style={{ color: MUTED }}>{label}</span>
    <span style={{ color: INK, fontWeight: 600, textAlign: "right" }}>{children || "—"}</span>
  </div>
);

const Section = ({ title, children }) => (
  <div style={{ marginTop: 16 }}>
    <div style={{ fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", color: MUTED, fontWeight: 700, marginBottom: 4 }}>{title}</div>
    <div style={{ borderTop: `1px solid ${LINE}` }}>{children}</div>
  </div>
);

/**
 * r: the receipt; business: { name, branch, registration, address, phone, email, logo (data URL) };
 * currency: the branch's sign ("RM").
 */
const ReceiptCard = forwardRef(function ReceiptCard({ r, business, currency }, ref) {
  const created = r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000) : r.createdAt instanceof Date ? r.createdAt : new Date();
  const voided = r.status === "cancelled" || r.status === "refunded";
  return (
    <div
      ref={ref}
      style={{
        width: 420,
        background: "#ffffff",
        color: INK,
        fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        padding: "28px 28px 22px",
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
        borderTop: `6px solid ${BRAND}`,
      }}
    >
      {voided && (
        <div
          style={{
            position: "absolute",
            top: "42%",
            left: "-10%",
            width: "120%",
            textAlign: "center",
            transform: "rotate(-24deg)",
            fontSize: 54,
            fontWeight: 800,
            letterSpacing: 6,
            color: "rgba(220, 38, 38, 0.16)",
            pointerEvents: "none",
          }}
        >
          {r.status === "refunded" ? "REFUNDED" : "CANCELLED"}
        </div>
      )}

      {/* letterhead */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {business.logo && <img src={business.logo} alt="" style={{ width: 56, height: 56, objectFit: "contain", borderRadius: 8 }} />}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>{business.name || "Restaurant"}</div>
          {business.branch && business.branch !== business.name && <div style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>{business.branch}</div>}
          {business.registration && <div style={{ fontSize: 11, color: MUTED }}>Reg. No: {business.registration}</div>}
        </div>
      </div>
      {(business.address || business.phone || business.email) && (
        <div style={{ marginTop: 8, fontSize: 11, color: MUTED, lineHeight: 1.5 }}>
          {business.address && <div style={{ whiteSpace: "pre-line" }}>{business.address}</div>}
          {[business.phone && `Tel: ${business.phone}`, business.email].filter(Boolean).join("  ·  ")}
        </div>
      )}

      {/* title */}
      <div style={{ marginTop: 18, padding: "10px 12px", background: "#f0fdfa", border: `1px solid #99f6e4`, borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1, color: BRAND }}>RESERVATION DEPOSIT RECEIPT</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 12 }}>
        <div>
          <div style={{ color: MUTED }}>Receipt No.</div>
          <div style={{ fontWeight: 700, fontFamily: "Consolas, 'Courier New', monospace", fontSize: 13 }}>{r.receiptNo}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: MUTED }}>Date issued</div>
          <div style={{ fontWeight: 700 }}>
            {created.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}, {created.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true })}
          </div>
        </div>
      </div>

      <Section title="Received from">
        <Row label="Name">{r.customerName}</Row>
        <Row label="Phone">{r.customerPhone}</Row>
      </Section>

      <Section title="Reservation">
        <Row label="Date">{dayText(r.reservationDate)}</Row>
        {r.reservationTime && <Row label="Time">{timeText(r.reservationTime)}</Row>}
        {r.pax ? <Row label="Guests">{r.pax} pax</Row> : null}
        {r.occasion && <Row label="Occasion">{r.occasion}</Row>}
        {r.notes && <Row label="Notes">{r.notes}</Row>}
      </Section>

      {/* amount */}
      <div style={{ marginTop: 16, border: `1.5px solid ${INK}`, borderRadius: 10, padding: "12px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.6 }}>DEPOSIT PAID</span>
          <span style={{ fontSize: 24, fontWeight: 800 }}>{money(r.amount, currency)}</span>
        </div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 4, fontStyle: "italic" }}>{amountInWords(r.amount, currency)}</div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${LINE}` }}>
          <span>
            <span style={{ color: MUTED }}>Paid by </span>
            <b>{methodLabel(r.method)}</b>
          </span>
          {r.reference && (
            <span>
              <span style={{ color: MUTED }}>Ref. </span>
              <b>{r.reference}</b>
            </span>
          )}
        </div>
      </div>

      {r.terms && <div style={{ marginTop: 14, fontSize: 10.5, color: MUTED, lineHeight: 1.5 }}>{r.terms}</div>}

      {/* received by */}
      <div style={{ marginTop: 22, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
        <div style={{ fontSize: 12 }}>
          <div style={{ color: MUTED }}>Received by</div>
          <div style={{ fontWeight: 700 }}>{r.createdBy?.name || r.createdBy?.username || "—"}</div>
        </div>
        <div style={{ width: 150, textAlign: "center" }}>
          <div style={{ borderTop: `1px solid ${INK}`, paddingTop: 4, fontSize: 10, color: MUTED }}>Authorised signature</div>
        </div>
      </div>

      <div style={{ marginTop: 18, paddingTop: 10, borderTop: `1px solid ${LINE}`, textAlign: "center", fontSize: 11, color: MUTED }}>
        <div style={{ color: INK, fontWeight: 700, fontSize: 12 }}>Thank you — we look forward to welcoming you!</div>
        <div style={{ marginTop: 2 }}>This is a computer-generated receipt.</div>
      </div>
    </div>
  );
});

export default ReceiptCard;
