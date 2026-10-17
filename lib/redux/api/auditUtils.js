import { collection, addDoc, serverTimestamp, doc } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'

/**
 * Adds an audit log entry to the company's audit log collection.
 * @param {Object} params
 * @param {string} params.companyId
 * @param {string} params.branchId
 * @param {string} params.branchName
 * @param {Object} params.user - { uid, username, email }
 * @param {string} params.action - e.g., "ADD_SALARY", "DELETE_PAYROLL"
 * @param {string} params.details - Human readable description
 * @param {string} params.targetId - ID of the record being modified
 * @param {Object} [params.batch] - Optional writeBatch to include this in a transaction
 */
export async function createAuditLog({
  companyId,
  branchId,
  branchName = '',
  user = {},
  action,
  details,
  targetId = '',
  batch = null
}) {
  if (!companyId) return

  const logRef = collection(db, 'companies', companyId, 'auditLog')
  const data = {
    branchId: branchId || '',
    branchName: branchName || '',
    // The signed-in account — the database only accepts entries in its own name.
    userId: auth.currentUser?.uid || user.uid || user.id || '',
    username: user.username || user.displayName || 'System',
    name: user.name || user.fullName || user.displayName || user.username || '',
    userEmail: user.email || '',
    action,
    details,
    targetId,
    timestamp: serverTimestamp()
  }

  if (batch) {
    const newLogRef = doc(logRef) // creates a new doc ref with auto-id
    batch.set(newLogRef, data)
    return
  }

  try {
    await addDoc(logRef, data)
  } catch (err) {
    console.error('Failed to create audit log:', err)
  }
}
