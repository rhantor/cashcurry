import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'

export const uploadCostFile = ({
  storage,
  file,
  companyId,
  branchId,
  resolvedCategory,
  paidFromOffice,
  date,
  onProgress
}) => {
  if (!file || !companyId || !branchId) return Promise.resolve(null)

  return new Promise((resolve, reject) => {
    try {
      const ext = file.name.split('.').pop()
      const safeCategory = (resolvedCategory || 'uncategorized').replace(
        /[^\w-]+/g,
        '_'
      )
      const officeFolder = paidFromOffice === 'front' ? 'front' : 'back'

      // ✅ Avoid overwrite on same date/category/office
      const uniqueSuffix = Date.now()
      const filePath = `costs/${companyId}/${branchId}/${safeCategory}/${officeFolder}/${date}_${uniqueSuffix}.${ext}`

      const storageRef = ref(storage, filePath)
      const task = uploadBytesResumable(storageRef, file)

      task.on(
        'state_changed',
        snap => {
          const progress = (snap.bytesTransferred / snap.totalBytes) * 100
          onProgress?.(progress)
        },
        err => reject(err),
        async () => resolve(await getDownloadURL(task.snapshot.ref))
      )
    } catch (err) {
      reject(err)
    }
  })
}
