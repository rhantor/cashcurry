import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

/**
 * Upload invoice file and return { url, path }.
 * path scheme: bills/{companyId}/{branchId}/{vendorId}/{invoiceDate}_{invoiceNo}.{ext}
 */
export function uploadInvoiceFile(
  { companyId, branchId, vendorId, invoiceNo, invoiceDate },
  file,
  onProgress
) {
  return new Promise((resolve, reject) => {
    try {
      const ext = file.name.split(".").pop();
      const safeInv = (invoiceNo || "noinv").replace(/[^\w-]+/g, "_");
      const safeDate = (
        invoiceDate || new Date().toISOString().slice(0, 10)
      ).replace(/[^\d-]/g, "");
      const path = `bills/${companyId}/${branchId}/${vendorId}/${safeDate}_${safeInv}.${ext}`;
      const storageRef = ref(storage, path);
      const task = uploadBytesResumable(storageRef, file);

      task.on(
        "state_changed",
        (snap) => {
          const pct = (snap.bytesTransferred / snap.totalBytes) * 100;
          onProgress?.(pct);
        },
        (err) => reject(err),
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve({ url, path });
        }
      );
    } catch (e) {
      reject(e);
    }
  });
}
