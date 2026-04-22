/* eslint-disable react/prop-types */
'use client'
import React, { useEffect } from 'react'
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform
} from 'framer-motion'
import useCurrency from '@/app/hooks/useCurrency'
import {
  X,
  Mail,
  Phone,
  CreditCard,
  User,
  Calendar,
  MapPin,
  Briefcase,
  Edit,
  Trash2,
  BadgeCheck,
  DollarSign,
  Clock,
  Globe,
  Landmark,
  UserCheck
} from 'lucide-react'

// ── helpers ───────────────────────────────────────────────────────────────────
const fmtDate = val => {
  if (!val) return null
  if (val?.seconds)
    return new Date(val.seconds * 1000).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  if (typeof val === 'string' && val.includes('-')) {
    const [y, m, d] = val.split('-')
    if (y && m && d)
      return new Date(Date.UTC(+y, +m - 1, +d)).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
  }
  return null
}

const fmtTimestamp = ts => {
  if (!ts?.seconds) return null
  return new Date(ts.seconds * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

const fmtRM = (v, currency = 'RM') =>
  v && Number(v) > 0
    ? `${currency} ${Number(v).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`
    : null

const capitalize = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : null)

const fmtAddress = s => {
  const parts = [
    s.addressLine1,
    s.addressLine2,
    s.city,
    s.postalCode,
    s.state,
    s.country
  ].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

// ── InfoRow ───────────────────────────────────────────────────────────────────
function InfoRow ({ icon: Icon, label, value, mono = false }) {
  if (!value) return null
  return (
    <div className='flex items-start gap-3 py-3 border-b border-black/5 last:border-0'>
      <div className='mt-0.5 w-7 h-7 rounded-lg bg-[var(--color-surface)] border border-black/8 flex items-center justify-center flex-shrink-0'>
        <Icon className='w-3.5 h-3.5 text-[var(--color-primary)]' />
      </div>
      <div className='flex-1 min-w-0'>
        <p className='text-[10px] font-bold uppercase tracking-widest text-black/35 mb-0.5'>
          {label}
        </p>
        <p
          className={`text-sm font-semibold text-black/75 break-words ${
            mono ? 'font-mono text-xs' : ''
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  )
}

function SectionLabel ({ children }) {
  return (
    <p className='text-[10px] font-bold uppercase tracking-widest text-black/30 mt-5 mb-1 pb-1.5 border-b border-black/5'>
      {children}
    </p>
  )
}

// ── Role badge ────────────────────────────────────────────────────────────────
function RoleBadge ({ role }) {
  if (!role) return null
  return (
    <span className='inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider bg-[var(--color-primary)]/10 text-[var(--color-primary-dark)] border border-[var(--color-primary)]/15'>
      <BadgeCheck className='w-3 h-3' />
      {role}
    </span>
  )
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar ({ staff, size = 'lg' }) {
  const dim =
    size === 'lg' ? 'w-20 h-20 md:w-24 md:h-24 text-4xl' : 'w-11 h-11 text-xl'
  return (
    <div
      className={`${dim} rounded-2xl bg-[var(--color-surface)] border-2 border-black/10 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm`}
    >
      {staff?.photoUrl ? (
        <img
          src={staff.photoUrl}
          alt=''
          className='w-full h-full object-cover'
        />
      ) : (
        <span className='opacity-40'>👤</span>
      )}
    </div>
  )
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function StaffDetailModal ({
  isOpen,
  onClose,
  staff,
  onEdit,
  onDelete
}) {
  const currency = useCurrency();
  const _dragY = useMotionValue(0)
  const _sheetOpacity = useTransform(_dragY, [0, 300], [1, 0.4])
  if (isOpen) _dragY.set(0)

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleDragEnd = (_, info) => {
    if (info.offset.y > 120 || info.velocity.y > 500) onClose()
    else _dragY.set(0)
  }

  if (!staff) return null

  const fullName =
    `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || 'Staff Member'
  const address = fmtAddress(staff)

  const Content = (
    <>
      {/* Drag handle — mobile only */}
      <div
        className='flex justify-center pt-3 pb-1 md:hidden flex-shrink-0 cursor-grab active:cursor-grabbing'
        style={{ touchAction: 'none' }}
      >
        <motion.div
          className='w-10 h-1 rounded-full bg-black/15'
          whileTap={{ scaleX: 1.3, backgroundColor: 'var(--color-primary)' }}
          transition={{ duration: 0.15 }}
        />
      </div>

      {/* ── Header ── */}
      <div className='flex items-start justify-between px-4 md:px-6 py-3 md:py-4 border-b border-black/8 flex-shrink-0'>
        <div className='flex items-center gap-3'>
          <Avatar staff={staff} size='sm' />
          <div>
            <h2 className='text-base md:text-lg font-extrabold text-black/80 leading-tight'>
              {fullName}
            </h2>
            <div className='flex flex-wrap items-center gap-1.5 mt-1'>
              <RoleBadge role={staff.role} />
              {staff.department && (
                <span className='text-[10px] font-bold text-black/40 uppercase tracking-wider'>
                  · {staff.department}
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className='p-2 hover:bg-black/5 rounded-xl text-black/40 transition-colors -mt-1 -mr-1 flex-shrink-0'
        >
          <X className='w-5 h-5' />
        </button>
      </div>

      {/* ── Body ── */}
      <div className='flex-1 overflow-y-auto overscroll-contain'>
        <div className='flex flex-col md:grid md:grid-cols-2 md:divide-x divide-black/8'>
          {/* ── LEFT: Personal ── */}
          <div className='px-4 md:px-6 py-4 md:py-6'>
            {/* Large avatar — desktop only */}
            <div className='hidden md:flex justify-center mb-5'>
              <Avatar staff={staff} size='lg' />
            </div>
            <div className='hidden md:block text-center mb-4'>
              <h3 className='text-xl font-extrabold text-black/80'>
                {fullName}
              </h3>
              <div className='flex justify-center gap-2 mt-2 flex-wrap'>
                <RoleBadge role={staff.role} />
              </div>
            </div>

            <SectionLabel>Contact</SectionLabel>
            <InfoRow icon={Mail} label='Email' value={staff.email} />
            <InfoRow icon={Phone} label='Phone' value={staff.phone} />

            <SectionLabel>Personal</SectionLabel>
            <InfoRow
              icon={User}
              label='Gender'
              value={capitalize(staff.gender)}
            />
            <InfoRow
              icon={Calendar}
              label='Date of Birth'
              value={fmtDate(staff.dob)}
            />
            <InfoRow
              icon={Globe}
              label='Nationality'
              value={capitalize(staff.nationality)}
            />
            <InfoRow icon={MapPin} label='Address' value={address} />

            {/* Emergency contact */}
            {(staff.emergencyContactName || staff.emergencyContactPhone) && (
              <>
                <SectionLabel>Emergency Contact</SectionLabel>
                <InfoRow
                  icon={UserCheck}
                  label='Name'
                  value={staff.emergencyContactName}
                />
                <InfoRow
                  icon={Phone}
                  label='Phone'
                  value={staff.emergencyContactPhone}
                />
              </>
            )}
          </div>

          {/* ── RIGHT: Work + Finance ── */}
          <div className='px-4 md:px-6 py-4 md:py-6 border-t md:border-t-0 border-black/8'>
            <SectionLabel>Employment</SectionLabel>
            <InfoRow
              icon={Briefcase}
              label='Department'
              value={staff.department}
            />
            <InfoRow
              icon={Calendar}
              label='Start Date'
              value={fmtDate(staff.startDate)}
            />
            <InfoRow
              icon={Calendar}
              label='Joined'
              value={fmtTimestamp(staff.createdAt)}
            />

            <SectionLabel>Identity</SectionLabel>
            <InfoRow
              icon={CreditCard}
              label='IC Number'
              value={staff.icNumber}
              mono
            />
            <InfoRow
              icon={CreditCard}
              label='Passport No.'
              value={staff.passportNumber}
              mono
            />
            <InfoRow icon={User} label='Staff ID' value={staff.id} mono />

            <SectionLabel>Compensation</SectionLabel>
            <InfoRow
              icon={DollarSign}
              label='Basic Salary'
              value={fmtRM(staff.basicSalary, currency)}
            />
            <InfoRow
              icon={Clock}
              label='Basic / Hour'
              value={
                staff.basicPerHour
                  ? `${currency} ${Number(staff.basicPerHour).toFixed(2)} / hr`
                  : null
              }
            />
            <InfoRow
              icon={Clock}
              label='OT / Hour'
              value={
                staff.OTPerHour
                  ? `${currency} ${Number(staff.OTPerHour).toFixed(2)} / hr`
                  : null
              }
            />
            <InfoRow
              icon={DollarSign}
              label='Allowance'
              value={fmtRM(staff.allowance, currency)}
            />

            {/* Bank details — only shown if any field has data */}
            {(staff.bankName ||
              staff.bankAccountNumber ||
              staff.bankAccountHolderName) && (
              <>
                <SectionLabel>Bank Details</SectionLabel>
                <InfoRow
                  icon={Landmark}
                  label='Bank Name'
                  value={staff.bankName}
                />
                <InfoRow
                  icon={Landmark}
                  label='Account No.'
                  value={staff.bankAccountNumber}
                  mono
                />
                <InfoRow
                  icon={User}
                  label='Account Holder'
                  value={staff.bankAccountHolderName}
                />
              </>
            )}

            {/* Notes */}
            {staff.notes && (
              <div className='mt-4 p-3 bg-[var(--color-surface)] rounded-xl border border-black/8'>
                <p className='text-[10px] font-bold uppercase tracking-widest text-black/30 mb-1.5'>
                  Notes
                </p>
                <p className='text-sm text-black/60 leading-relaxed'>
                  {staff.notes}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className='flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 px-4 md:px-6 py-3 md:py-4 border-t border-black/8 bg-[var(--color-surface)]/60 flex-shrink-0'>
        {onDelete && (
          <button
            onClick={() => {
              onClose()
              onDelete(staff)
            }}
            className='flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 text-sm font-semibold text-red-500 hover:bg-red-50 border border-red-200 rounded-xl transition-colors w-full sm:w-auto order-2 sm:order-1'
          >
            <Trash2 className='w-4 h-4' />
            Delete
          </button>
        )}
        {onEdit && (
          <button
            onClick={() => {
              onClose()
              onEdit(staff)
            }}
            className='flex items-center justify-center gap-2 px-5 py-2.5 sm:py-2 text-sm font-semibold text-white bg-[var(--color-primary)] hover:opacity-90 active:scale-[0.99] rounded-xl shadow-sm transition-all w-full sm:w-auto sm:ml-auto order-1 sm:order-2'
          >
            <Edit className='w-4 h-4' />
            Edit Staff
          </button>
        )}
      </div>
    </>
  )

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key='staff-detail-backdrop'
            className='fixed inset-0 bg-black/30 backdrop-blur-sm z-50'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Mobile: drag-to-dismiss bottom sheet */}
          <div className='md:hidden fixed inset-0 z-50 flex items-end justify-center pointer-events-none'>
            <motion.div
              key='staff-detail-mobile'
              className='pointer-events-auto bg-white flex flex-col overflow-hidden w-full rounded-t-2xl max-h-[92vh] shadow-2xl'
              style={{ y: _dragY, opacity: _sheetOpacity }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              drag='y'
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0, bottom: 0.3 }}
              onDragEnd={handleDragEnd}
              onClick={e => e.stopPropagation()}
            >
              {Content}
            </motion.div>
          </div>

          {/* Desktop: centered spring modal */}
          <div className='hidden md:flex fixed inset-0 z-50 items-center justify-center p-4 pointer-events-none'>
            <motion.div
              key='staff-detail-desktop'
              className='pointer-events-auto bg-white flex flex-col overflow-hidden w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl border border-black/8'
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              onClick={e => e.stopPropagation()}
            >
              {Content}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
