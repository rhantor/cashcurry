import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import { db, storage, auth } from '@/lib/firebase' 
import {
  collection,
  serverTimestamp,
  getDocs,
  doc,
  updateDoc,
  query,
  orderBy,
  where,
  getDoc,
  writeBatch,
  deleteField
} from 'firebase/firestore'
import { PRIVATE_FIELDS, splitStaff } from '@/lib/staff/private'
import { can } from '@/lib/authz/permissions'
import { getSessionUser } from '@/lib/session'

import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from 'firebase/storage'

const staffCol = (companyId, branchId) => collection(db, 'companies', companyId, 'branches', branchId, 'staff')
const privateDoc = (companyId, branchId, staffId) => doc(db, 'companies', companyId, 'branches', branchId, 'staffPrivate', staffId)

const toErr = error => ({
  message: error?.message || 'Something went wrong'
})

const uploadStaffPhoto = ({
  companyId,
  branchId,
  staffId,
  file,
  onProgress
}) => {
  if (!file) return Promise.resolve(null)

  const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase()
  const path = `staffPhotos/${companyId}/${branchId}/${staffId}-${Date.now()}.${ext}`
  const storageRef = ref(storage, path)

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file)

    task.on(
      'state_changed',
      snap => {
        if (onProgress) {
          const pct = (snap.bytesTransferred / snap.totalBytes) * 100
          onProgress(pct)
        }
      },
      err => reject(err),
      async () => {
        const url = await getDownloadURL(task.snapshot.ref)
        resolve(url)
      }
    )
  })
}

const safeDeleteByUrl = async url => {
  if (!url) return
  try {
    const fileRef = ref(storage, url) // ✅ can delete via download URL
    await deleteObject(fileRef)
  } catch (e) {
    // Don't hard-fail on delete (file may already be missing)
    console.warn('Photo delete skipped:', e?.message)
  }
}

export const staffApiSlice = createApi({
  reducerPath: 'staffApiSlice',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['Staff'],
  endpoints: builder => ({
    // ✅ Add Staff (with optional photoFile)
    addStaff: builder.mutation({
      async queryFn ({ companyId, branchId, data, photoFile }) {
        try {
          // 1) The record and its private half (pay, IC, bank…), together
          const docRef = doc(staffCol(companyId, branchId))
          const { public: pub, private: priv } = splitStaff(data)
          const batch = writeBatch(db)
          batch.set(docRef, {
            ...pub,
            companyId,
            branchId,
            photoUrl: null,
            createdAt: serverTimestamp()
          })
          batch.set(privateDoc(companyId, branchId, docRef.id), {
            ...priv,
            staffId: docRef.id,
            createdAt: serverTimestamp()
          })
          await batch.commit()

          // 2) Upload photo if provided
          let photoUrl = null
          if (photoFile) {
            photoUrl = await uploadStaffPhoto({
              companyId,
              branchId,
              staffId: docRef.id,
              file: photoFile
            })

            // 3) Save photoUrl into Firestore doc
            await updateDoc(docRef, {
              photoUrl,
              updatedAt: serverTimestamp()
            })
          }

          return { data: { id: docRef.id, ...data, photoUrl } }
        } catch (error) {
          return { error: toErr(error) }
        }
      },
      invalidatesTags: [{ type: 'Staff', id: 'LIST' }]
    }),

    // ✅ Get All Staff
    // uid: only the record linked to that login (the staff app; staff may
    // read no one else's — it holds passport, bank and salary details)
    getStaffList: builder.query({
      async queryFn ({ companyId, branchId, uid }) {
        if (!companyId || !branchId) return { data: [] }
        try {
          const staffRef = staffCol(companyId, branchId)
          const q = uid
            ? query(staffRef, where('uid', '==', uid))
            : query(staffRef, orderBy('createdAt', 'desc'))
          const snapshot = await getDocs(q)
          let staff = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))

          // Private details: everyone's for those who may see pay; one's own
          // in the staff app. Others get the record without them.
          const role = getSessionUser()?.role
          if (!uid && can(role, 'staff.pay')) {
            const priv = await getDocs(collection(db, 'companies', companyId, 'branches', branchId, 'staffPrivate'))
            const byId = Object.fromEntries(priv.docs.map(d => [d.id, d.data()]))
            staff = staff.map(s => ({ ...s, ...(byId[s.id] || {}) }))
          } else if (uid && staff[0]) {
            const own = await getDoc(privateDoc(companyId, branchId, staff[0].id)).catch(() => null)
            if (own?.exists()) staff = [{ ...staff[0], ...own.data() }]
          }
          return { data: staff }
        } catch (error) {
          return { error: toErr(error) }
        }
      },
      providesTags: result =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Staff', id })),
              { type: 'Staff', id: 'LIST' }
            ]
          : [{ type: 'Staff', id: 'LIST' }]
    }),

    // ✅ Update Staff (supports replace/remove photo)
    updateStaff: builder.mutation({
      async queryFn ({
        companyId,
        branchId,
        staffId,
        data,
        photoFile,
        oldPhotoUrl
      }) {
        try {
          const docRef = doc(
            db,
            'companies',
            companyId,
            'branches',
            branchId,
            'staff',
            staffId
          )

          // If caller didn't pass oldPhotoUrl, read it
          let prevUrl = oldPhotoUrl
          if (prevUrl === undefined) {
            const snap = await getDoc(docRef)
            prevUrl = snap.exists() ? snap.data()?.photoUrl : null
          }

          // Upload new if provided
          let newPhotoUrl = prevUrl ?? null
          if (photoFile) {
            newPhotoUrl = await uploadStaffPhoto({
              companyId,
              branchId,
              staffId,
              file: photoFile
            })

            // delete previous after new success
            if (prevUrl) await safeDeleteByUrl(prevUrl)
          }

          // If UI says photoUrl should be cleared, it will send data.photoUrl = null
          // In that case, also delete previous
          if (data?.photoUrl === null && prevUrl) {
            await safeDeleteByUrl(prevUrl)
            newPhotoUrl = null
          }

          // the record without private details (clearing any written before the
          // split), and the private half beside it
          const { public: pub, private: priv } = splitStaff(data)
          const batch = writeBatch(db)
          batch.update(docRef, {
            ...pub,
            ...Object.fromEntries(PRIVATE_FIELDS.map(k => [k, deleteField()])),
            photoUrl: newPhotoUrl,
            updatedAt: serverTimestamp()
          })
          batch.set(privateDoc(companyId, branchId, staffId), { ...priv, staffId, updatedAt: serverTimestamp() }, { merge: true })
          await batch.commit()

          return { data: { id: staffId, ...data, photoUrl: newPhotoUrl } }
        } catch (error) {
          return { error: toErr(error) }
        }
      },
      invalidatesTags: (res, err, { staffId }) => [
        { type: 'Staff', id: staffId },
        { type: 'Staff', id: 'LIST' }
      ]
    }),

    // ✅ Delete Staff (also deletes photo)
    deleteStaff: builder.mutation({
      async queryFn ({ companyId, branchId, staffId }) {
        try {
          const docRef = doc(
            db,
            'companies',
            companyId,
            'branches',
            branchId,
            'staff',
            staffId
          )

          // read photo url then delete doc
          const snap = await getDoc(docRef)
          const photoUrl = snap.exists() ? snap.data()?.photoUrl : null

          const batch = writeBatch(db)
          batch.delete(docRef)
          batch.delete(privateDoc(companyId, branchId, staffId))
          await batch.commit()
          if (photoUrl) await safeDeleteByUrl(photoUrl)

          return { data: staffId }
        } catch (error) {
          return { error: toErr(error) }
        }
      },
      invalidatesTags: [{ type: 'Staff', id: 'LIST' }]
    }),

    // ✅ Generate Login Credentials (via API Route)
    generateStaffLogin: builder.mutation({
      async queryFn(payload) {
        try {
          // The server checks who is asking: send the signed-in user's ID token.
          const idToken = await auth.currentUser?.getIdToken()
          const res = await fetch("/api/auth/create-staff", {
             method: "POST",
             headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken || ''}` },
             body: JSON.stringify(payload)
          });
          const data = await res.json();
          if(!res.ok) throw new Error(data.error || "Failed to generate login");
          return { data };
        } catch (error) {
          return { error: { message: error.message || 'Something went wrong' } };
        }
      },
      invalidatesTags: (res, err, { staffId }) => [
        { type: 'Staff', id: staffId },
        { type: 'Staff', id: 'LIST' }
      ]
    }),

    // A new PIN for a staff member who forgot theirs (their phones are signed out)
    resetStaffPin: builder.mutation({
      async queryFn(payload) {
        try {
          const idToken = await auth.currentUser?.getIdToken()
          const res = await fetch("/api/auth/reset-staff-pin", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken || ''}` },
            body: JSON.stringify(payload)
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || "Couldn't reset the PIN")
          return { data }
        } catch (error) {
          return { error: { message: error.message || 'Something went wrong' } }
        }
      }
    })
  })
})

export const {
  useAddStaffMutation,
  useGetStaffListQuery,
  useUpdateStaffMutation,
  useDeleteStaffMutation,
  useGenerateStaffLoginMutation,
  useResetStaffPinMutation
} = staffApiSlice
