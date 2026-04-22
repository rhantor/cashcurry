import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import { db, storage } from '@/lib/firebase' 
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  getDoc
} from 'firebase/firestore'

import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from 'firebase/storage'

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
          const staffRef = collection(
            db,
            'companies',
            companyId,
            'branches',
            branchId,
            'staff'
          )

          // 1) Create doc first (to get staffId)
          const docRef = await addDoc(staffRef, {
            ...data,
            companyId,
            branchId,
            photoUrl: null,
            createdAt: serverTimestamp()
          })

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
    getStaffList: builder.query({
      async queryFn ({ companyId, branchId }) {
        if (!companyId || !branchId) return { data: [] }
        try {
          const staffRef = collection(
            db,
            'companies',
            companyId,
            'branches',
            branchId,
            'staff'
          )
          const q = query(staffRef, orderBy('createdAt', 'desc'))
          const snapshot = await getDocs(q)
          const staff = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
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

          await updateDoc(docRef, {
            ...data,
            photoUrl: newPhotoUrl,
            updatedAt: serverTimestamp()
          })

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

          await deleteDoc(docRef)
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
          const res = await fetch("/api/auth/create-staff", {
             method: "POST",
             headers: { "Content-Type": "application/json" },
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
    })
  })
})

export const {
  useAddStaffMutation,
  useGetStaffListQuery,
  useUpdateStaffMutation,
  useDeleteStaffMutation,
  useGenerateStaffLoginMutation
} = staffApiSlice
