'use client'

import React, { useMemo, useState } from 'react'
import useResolvedCompanyBranch from '@/utils/useResolvedCompanyBranch'
import {
  useGetStaffListQuery,
  useAddStaffMutation,
  useUpdateStaffMutation,
  useDeleteStaffMutation,
  useGenerateStaffLoginMutation
} from '@/lib/redux/api/staffApiSlice'
import { useGetSingleBranchQuery } from '@/lib/redux/api/branchApiSlice'
import { useGetBranchSettingsQuery } from '@/lib/redux/api/branchSettingsApiSlice'
import { skipToken } from '@reduxjs/toolkit/query'
import { AlertTriangle } from 'lucide-react'

import StaffToolbar from './components/StaffToolbar'
import StaffTable from './components/StaffTable'
import StaffModal from './components/StaffModal'
import DeleteConfirm from './components/DeleteConfirm'
import Toast from './components/Toast'
import StaffDetailModal from './components/StaffDetailModal'

export default function StaffManagementPage () {
  const { ready, companyId, branchId } = useResolvedCompanyBranch()
  const args =
    ready && companyId && branchId ? { companyId, branchId } : skipToken

  const { data: staffList = [], isLoading } = useGetStaffListQuery(
    { companyId, branchId },
    { skip: !companyId || !branchId }
  )
  const { data: branchData = {} } = useGetSingleBranchQuery(args)
  const { data: branchSettings } = useGetBranchSettingsQuery(
    companyId && branchId ? { companyId, branchId } : skipToken
  )
  const payrollConfig = branchSettings?.payroll || null
  const branchName = branchData?.name || 'Selected Branch'

  const [addStaff] = useAddStaffMutation()
  const [updateStaff] = useUpdateStaffMutation()
  const [deleteStaff] = useDeleteStaffMutation()
  const [generateAuth, { isLoading: generating }] = useGenerateStaffLoginMutation()

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [modalMode, setModalMode] = useState(null) // "add" | "edit" | null
  const [editTarget, setEditTarget] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [toast, setToast] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [detailTarget, setDetailTarget] = useState(null)
  const [generatedCreds, setGeneratedCreds] = useState(null)

  const showToast = (type, msg) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3000)
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return staffList.filter(s => {
      const matchSearch =
        !q ||
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.phone || '').includes(q) ||
        (s.icNumber || '').includes(q)

      const matchRole = !roleFilter || s.role === roleFilter
      return matchSearch && matchRole
    })
  }, [staffList, search, roleFilter])

  const handleSave = async ({ data, photoFile, oldPhotoUrl, id }) => {
    try {
      if (modalMode === 'add') {
        await addStaff({ companyId, branchId, data, photoFile }).unwrap()
        showToast('ok', `${data.firstName} ${data.lastName} added`)
      } else {
        await updateStaff({
          companyId,
          branchId,
          id,
          staffId: id,
          data,
          photoFile,
          oldPhotoUrl
        }).unwrap()
        showToast('ok', `${data.firstName} ${data.lastName} updated`)
      }
      setModalMode(null)
      setEditTarget(null)
    } catch (err) {
      showToast('err', err?.message || 'Something went wrong')
    }
  }

  const handleDelete = async () => {
    if (!confirmDel || deleteBusy) return
    setDeleteBusy(true)
    try {
      await deleteStaff({
        companyId,
        branchId,
        id: confirmDel.id,
        staffId: confirmDel.id,
        photoUrl: confirmDel.photoUrl
      }).unwrap()

      showToast('ok', `${confirmDel.firstName} ${confirmDel.lastName} deleted`)
      setConfirmDel(null)
    } catch (err) {
      showToast('err', err?.message || 'Delete failed')
    } finally {
      setDeleteBusy(false)
    }
  }

  const handleGenerateLogin = async (staff) => {
    try {
      const res = await generateAuth({
        companyId,
        branchId,
        staffId: staff.id,
        firstName: staff.firstName,
        lastName: staff.lastName,
        email: staff.email,
        icNumber: staff.icNumber
      }).unwrap()

      setGeneratedCreds(res)
    } catch(err) {
      showToast('err', err?.message || 'Generate login failed')
    }
  }

  if (!ready) {
    return (
      <div className='p-12 text-center text-black/50 font-semibold'>
        Loading context...
      </div>
    )
  }

  if (!branchId) {
    return (
      <div className='flex h-[50vh] flex-col items-center justify-center p-8 text-center'>
        <AlertTriangle className='text-red-600 mb-4' size={48} />
        <h2 className='text-xl font-extrabold text-black/80 mb-2'>
          No Branch Selected
        </h2>
        <p className='text-black/55 font-semibold'>
          Please select an active branch to manage staff.
        </p>
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-[var(--color-background)] text-black p-6 md:p-8 pb-16'>
      <div className='max-w-6xl mx-auto'>
        <StaffToolbar
          search={search}
          setSearch={setSearch}
          roleFilter={roleFilter}
          setRoleFilter={setRoleFilter}
          branchName={branchName}
          filteredCount={filtered.length}
          totalCount={staffList.length}
          onAdd={() => {
            setEditTarget(null)
            setModalMode('add')
          }}
        />

        <StaffTable
          rows={filtered}
          loading={isLoading || generating}
          onView={s => setDetailTarget(s)} 
          onEdit={s => {
            setEditTarget(s)
            setModalMode('edit')
          }}
          onDelete={s => setConfirmDel(s)}
          onGenerateLogin={handleGenerateLogin}
        />
      </div>

      {modalMode && (
        <StaffModal
          mode={modalMode}
          initialData={modalMode === 'edit' ? editTarget : null}
          payrollConfig={payrollConfig}
          onSave={handleSave}
          onClose={() => {
            setModalMode(null)
            setEditTarget(null)
          }}
        />
      )}

      <DeleteConfirm
        staff={confirmDel}
        busy={deleteBusy}
        onClose={() => setConfirmDel(null)}
        onConfirm={handleDelete}
      />
      <StaffDetailModal
        isOpen={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        staff={detailTarget}
        onEdit={s => {
          setEditTarget(s)
          setModalMode('edit')
        }}
        onDelete={s => setConfirmDel(s)}
      />

      {generatedCreds && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
           <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95">
              <h3 className="text-xl font-bold mb-4">Login Generated!</h3>
              <p className="mb-4 text-sm text-gray-600">Please copy these credentials and share them with the staff member securely.</p>
              <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg flex flex-col gap-2 mb-6">
                 <div><span className="font-semibold text-sm">Email:</span> <span className="font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded ml-2">{generatedCreds.email}</span></div>
                 <div><span className="font-semibold text-sm">Password:</span> <span className="font-mono bg-red-50 text-red-700 px-2 py-0.5 rounded ml-2">{generatedCreds.password}</span></div>
              </div>
              <div className="flex justify-end">
                <button 
                   onClick={() => setGeneratedCreds(null)} 
                   className="px-6 py-2 bg-black text-white rounded-lg font-semibold hover:bg-black/80"
                >
                  Done
                </button>
              </div>
           </div>
        </div>
      )}

      {toast && <Toast type={toast.type} msg={toast.msg} />}
    </div>
  )
}
