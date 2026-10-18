'use client'


// ─── Print styles ─────────────────────────────────────────────────────────────

export function PrintStyles ({ landscape }) {
  return (
    <style>{`
      @media print {
        @page { size: ${landscape ? 'A4 landscape' : 'A4 portrait'}; margin: 10mm; }
        body * { visibility: hidden; }
        .print-root, .print-root * { visibility: visible; }
        .print-root { position: absolute; left: 0; top: 0; width: 100%; }
        .no-print { display: none !important; }
      }
    `}</style>
  )
}

// ─── Light-ink cell style helpers ────────────────────────────────────────────

export const TH = (extra = {}) => ({
  padding: '4px 6px',
  background: '#f1f5f9',
  color: '#1e293b',
  fontWeight: 700,
  fontSize: 8,
  letterSpacing: 0.2,
  whiteSpace: 'nowrap',
  border: '1px solid #cbd5e1',
  textAlign: 'center',
  ...extra,
})

export const TD = (extra = {}) => ({
  padding: '3px 6px',
  fontSize: 8.5,
  border: '1px solid #e2e8f0',
  color: '#1e293b',
  whiteSpace: 'nowrap',
  ...extra,
})
