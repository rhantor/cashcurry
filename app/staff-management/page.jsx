'use client'

import { moveTasksToLead } from '@/lib/tasks/client'
import React, { useMemo, useState } from 'react'
import useResolvedCompanyBranch from '@/app/hooks/useResolvedCompanyBranch'
import {
  useGetStaffListQuery,
  useAddStaffMutation,
  useUpdateStaffMutation,
  useDeleteStaffMutation,
  useGenerateStaffLoginMutation,
  useResetStaffPinMutation
} from '@/lib/redux/api/staffApiSlice'
import { useGetSingleBranchQuery } from '@/lib/redux/api/branchApiSlice'
import { useGetBranchSettingsQuery } from '@/lib/redux/api/branchSettingsApiSlice'
import { skipToken } from '@reduxjs/toolkit/query'
import { shiftsEnabled } from '@/lib/attendance/shifts'
import { Check, Copy, Eye, KeyRound, MoreHorizontal, Pencil, Plus, Search, Smartphone, Store, Trash2, Users, Wallet } from 'lucide-react'
import { Avatar, Badge, Button, DataTable, Input, Menu, Select, Sheet, Skeleton, cn } from '@/app/components/ui'
import { toast, confirmDialog } from '@/app/components/ui/notify'
import StatTiles from '@/app/components/purchases/StatTiles'
import StatusScreen from '@/app/components/common/StatusScreen'
import useCurrency from '@/app/hooks/useCurrency'
import { formatMoney } from '@/lib/region/currency'
import { ROLES } from './lib/constants'

import StaffModal from './components/StaffModal'
import StaffDetailModal from './components/StaffDetailModal'

const fullName = s => `${s?.firstName || ''} ${s?.lastName || ''}`.trim() || s?.name || 'Unnamed'

/** A value with a copy button — for the login handed to a new staff member. */
function CopyLine ({ label, value }) {
  const [done, setDone] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setDone(true)
      setTimeout(() => setDone(false), 1500)
    } catch {
      toast.error("Couldn't copy — select it and copy by hand.")
    }
  }
  return (
    <div className='flex items-center gap-3 rounded-xl border border-line bg-surface-2/60 px-3 py-2.5'>
      <div className='min-w-0 flex-1'>
        <p className='text-[11px] font-semibold text-muted'>{label}</p>
        <p className='select-all truncate font-mono text-sm text-fg'>{value}</p>
      </div>
      <Button size='sm' variant='secondary' icon={done ? Check : Copy} onClick={copy}>
        {done ? 'Copied' : 'Copy'}
      </Button>
    </div>
  )
}

/** The branch's staff: who works here, what they're paid, and their app login. */
export default function StaffManagementPage () {
  const { ready, companyId, branchId } = useResolvedCompanyBranch()
  const args = ready && companyId && branchId ? { companyId, branchId } : skipToken
  const currency = useCurrency()
  const money = n => formatMoney(Number(n) || 0, currency)

  const { data: staffList = [], isLoading } = useGetStaffListQuery({ companyId, branchId }, { skip: !companyId || !branchId })
  const { data: branchData = {} } = useGetSingleBranchQuery(args)
  const { data: branchSettings } = useGetBranchSettingsQuery(companyId && branchId ? { companyId, branchId } : skipToken)
  const payrollConfig = branchSettings?.payroll || null
  // The modal hides the shift time fields entirely when the branch hasn't
  // turned shift rules on.
  const shiftsOn = shiftsEnabled(branchSettings?.attendance)

  const [addStaff] = useAddStaffMutation()
  const [updateStaff] = useUpdateStaffMutation()
  const [deleteStaff] = useDeleteStaffMutation()
  const [generateAuth] = useGenerateStaffLoginMutation()
  const [resetPin] = useResetStaffPinMutation()

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [modalMode, setModalMode] = useState(null) // "add" | "edit" | null
  const [editTarget, setEditTarget] = useState(null)
  const [detailTarget, setDetailTarget] = useState(null)
  const [generatedCreds, setGeneratedCreds] = useState(null)
  const [generatingFor, setGeneratingFor] = useState(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return staffList.filter(s => {
      const matchSearch =
        !q ||
        fullName(s).toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.phone || '').includes(q) ||
        (s.icNumber || '').toLowerCase().includes(q) ||
        (s.department || '').toLowerCase().includes(q)
      return matchSearch && (!roleFilter || s.role === roleFilter)
    })
  }, [staffList, search, roleFilter])

  const openAdd = () => {
    setEditTarget(null)
    setModalMode('add')
  }
  const openEdit = s => {
    setEditTarget(s)
    setModalMode('edit')
  }

  const handleSave = async ({ data, photoFile, oldPhotoUrl, id }) => {
    try {
      if (modalMode === 'add') {
        await addStaff({ companyId, branchId, data, photoFile }).unwrap()
        toast.success(`${data.firstName} ${data.lastName} added`)
      } else {
        await updateStaff({ companyId, branchId, id, staffId: id, data, photoFile, oldPhotoUrl }).unwrap()
        toast.success(`${data.firstName} ${data.lastName} saved`)
        // a new supervisor leads their unfinished tasks from now on (4.11)
        if ((editTarget?.supervisorUid || '') !== (data.supervisorUid || '') && editTarget?.uid) {
          moveTasksToLead(companyId, branchId, editTarget.uid, data.supervisorUid || null).catch(() => {})
        }
      }
      setModalMode(null)
      setEditTarget(null)
    } catch (err) {
      toast.error(err?.message || 'Something went wrong')
    }
  }

  const handleDelete = async s => {
    const ok = await confirmDialog({
      title: `Delete ${fullName(s)}?`,
      message: 'Their staff record and photo are removed. Sales, advances, loans and payslips already saved stay as they are.',
      confirmLabel: 'Delete',
      danger: true
    })
    if (!ok) return
    try {
      await deleteStaff({ companyId, branchId, id: s.id, staffId: s.id, photoUrl: s.photoUrl }).unwrap()
      if (detailTarget?.id === s.id) setDetailTarget(null)
      toast.success(`${fullName(s)} deleted`)
    } catch (err) {
      toast.error(err?.message || "Couldn't delete")
    }
  }

  const handleGenerateLogin = async staff => {
    setGeneratingFor(staff.id)
    try {
      const res = await generateAuth({
        companyId,
        branchId,
        staffId: staff.id,
        firstName: staff.firstName,
        lastName: staff.lastName,
        email: staff.email
      }).unwrap()
      setGeneratedCreds({ ...res, name: fullName(staff), made: true })
    } catch (err) {
      toast.error(err?.message || "Couldn't make the login")
    } finally {
      setGeneratingFor(null)
    }
  }

  const handleResetPin = async staff => {
    if (!(await confirmDialog({ title: `New PIN for ${fullName(staff)}?`, message: 'Their old PIN stops working and their phones are signed out. You will see the new PIN once, to give them.', confirmLabel: 'Make a new PIN' }))) return
    try {
      const res = await resetPin({ companyId, branchId, staffId: staff.id }).unwrap()
      setGeneratedCreds({ ...res, name: fullName(staff), made: false })
    } catch (err) {
      toast.error(err?.message || "Couldn't reset the PIN")
    }
  }

  if (!ready) return <Skeleton className='m-6 h-64' rounded='rounded-2xl' />
  if (!branchId) {
    return <StatusScreen full={false} icon={Store} tone='warning' title='Pick a branch first' message='Staff belong to a branch — choose one from the top bar to see its staff.' />
  }

  const withLogin = staffList.filter(s => s.uid).length
  const payTotal = staffList.reduce((n, s) => n + (Number(s.basicSalary) || 0), 0)
  const roleLabel = r => ROLES.find(x => x.value === r)?.label || r || 'Staff'

  const columns = [
    {
      key: 'name',
      label: 'Staff member',
      primary: true,
      sortValue: s => fullName(s).toLowerCase(),
      render: s => (
        <div className='flex min-w-0 items-center gap-3'>
          <Avatar name={fullName(s)} src={s.photoUrl} size='md' />
          <div className='min-w-0'>
            <p className='truncate font-semibold text-fg'>{fullName(s)}</p>
            <p className='truncate text-[11px] font-normal text-muted'>
              {roleLabel(s.role)}
              {s.department ? ` · ${s.department}` : ''}
            </p>
          </div>
        </div>
      )
    },
    { key: 'phone', label: 'Phone', render: s => s.phone || <span className='text-subtle'>—</span> },
    {
      key: 'pay',
      label: 'Basic pay',
      align: 'right',
      sortValue: s => Number(s.basicSalary) || 0,
      render: s => (Number(s.basicSalary) > 0 ? money(s.basicSalary) : <span className='text-subtle'>—</span>)
    },
    {
      key: 'login',
      label: 'Staff app',
      sortValue: s => (s.uid ? 1 : 0),
      render: s => (s.uid ? <Badge tone='success' dot>Has a login</Badge> : <Badge>No login yet</Badge>)
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      hideOnMobile: true,
      render: s => (
        <span onClick={e => e.stopPropagation()} className='inline-flex'>
          <Menu
            align='end'
            width={220}
            trigger={p => (
              <Button {...p} size='icon' variant='ghost' className='size-8' aria-label={`More for ${fullName(s)}`}>
                <MoreHorizontal className='size-4' />
              </Button>
            )}
            items={[
              { label: 'Open', icon: Eye, onSelect: () => setDetailTarget(s) },
              { label: 'Edit', icon: Pencil, onSelect: () => openEdit(s) },
              !s.uid && { label: generatingFor === s.id ? 'Making the login…' : 'Make a staff app login', icon: KeyRound, onSelect: () => handleGenerateLogin(s) },
              s.uid && { label: 'Reset PIN', icon: KeyRound, onSelect: () => handleResetPin(s) },
              'divider',
              { label: 'Delete', icon: Trash2, danger: true, onSelect: () => handleDelete(s) }
            ].filter(Boolean)}
          />
        </span>
      )
    }
  ]

  return (
    <div className='mx-auto max-w-6xl space-y-4 px-4 py-5'>
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight text-fg'>Staff</h1>
          <p className='text-sm text-muted'>Everyone working at {branchData?.name || 'this branch'}. Tap someone for their details.</p>
        </div>
        <Button icon={Plus} onClick={openAdd}>
          Add staff
        </Button>
      </div>

      <StatTiles
        loading={isLoading}
        tiles={[
          { label: 'Staff', value: String(staffList.length), note: `At ${branchData?.name || 'this branch'}`, icon: Users, tone: 'bg-brand-soft text-brand' },
          { label: 'Basic pay a month', value: money(payTotal), note: 'Before OT and allowances', icon: Wallet, tone: 'bg-surface-2 text-muted' },
          {
            label: 'Staff app logins',
            value: `${withLogin} of ${staffList.length}`,
            note: withLogin < staffList.length ? 'Make one from a staff member’s menu' : 'Everyone can sign in',
            icon: Smartphone,
            tone: 'bg-info-soft text-info'
          }
        ]}
      />

      {staffList.length > 0 && (
        <div className='flex flex-col gap-2 sm:flex-row'>
          <div className='relative flex-1'>
            <Search className='pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle' />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder='Find by name, phone, IC or department…' className='pl-10' aria-label='Find staff' />
          </div>
          <Select className='sm:w-52' value={roleFilter} onChange={e => setRoleFilter(e.target.value)} aria-label='Role'>
            <option value=''>Every role</option>
            {ROLES.slice(1).map(r => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={filtered}
        loading={isLoading}
        onRowClick={setDetailTarget}
        defaultSort={{ key: 'name', dir: 'asc' }}
        pageSize={25}
        className={cn(isLoading && 'min-h-40')}
        empty={
          staffList.length
            ? { icon: Search, title: 'No one matches', description: 'Try another name or role.' }
            : {
                icon: Users,
                title: 'No staff yet',
                description: 'Add the people who work here — payroll, advances and attendance all use this list.',
                action: (
                  <Button icon={Plus} onClick={openAdd}>
                    Add the first one
                  </Button>
                )
              }
        }
      />

      {modalMode && (
        <StaffModal
          mode={modalMode}
          initialData={modalMode === 'edit' ? editTarget : null}
          payrollConfig={payrollConfig}
          shiftsEnabled={shiftsOn}
          onSave={handleSave}
          onClose={() => {
            setModalMode(null)
            setEditTarget(null)
          }}
        />
      )}

      <StaffDetailModal
        isOpen={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        staff={detailTarget}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      <Sheet
        open={!!generatedCreds}
        onClose={() => setGeneratedCreds(null)}
        title={generatedCreds?.made ? 'Staff app login made' : 'New PIN made'}
        description={generatedCreds?.name ? `For ${generatedCreds.name}` : undefined}
        footer={
          <div className='flex justify-end'>
            <Button onClick={() => setGeneratedCreds(null)}>Done</Button>
          </div>
        }
      >
        {generatedCreds && (
          <div className='space-y-3'>
            <p className='text-sm text-muted'>Give these to them in person. The PIN is only shown now — they can change it in the staff app.</p>
            <CopyLine label='Log in with' value={generatedCreds.phone ? `${generatedCreds.phone}${generatedCreds.byIc ? ' (or their IC number)' : ''}` : generatedCreds.email} />
            <CopyLine label='PIN' value={generatedCreds.pin} />
          </div>
        )}
      </Sheet>
    </div>
  )
}
