// app/components/common/useCrudActions.js
"use client";
import { useCallback, useState } from "react";
import { getCurrentUser, hasRole, ALLOWED_EDIT_ROLES, ALLOWED_DELETE_ROLES } from "@/lib/authz/roles";

/**
 * Generic CRUD action helpers using your RTK hooks.
 * Pass the generated hooks for the resource you are using.
 */
export default function useCrudActions({
  useUpdateMutationHook,
  useDeleteMutationHook,
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(null); // the item being deleted
  const currentUser = getCurrentUser();
  const canEdit = hasRole(currentUser, ALLOWED_EDIT_ROLES);
  const canDelete = hasRole(currentUser, ALLOWED_DELETE_ROLES);

  const [updateMutate, updateState] = useUpdateMutationHook();
  const [deleteMutate, deleteState] = useDeleteMutationHook();

  const doUpdate = useCallback(
    async ({ companyId, branchId, id, patch }) => {
      if (!canEdit) throw new Error("Forbidden: insufficient role");
      await updateMutate({
        companyId,
        branchId,
        saleId: id, // naming for sales API; see adapter below
        currentUser,
        patch,
      }).unwrap();
    },
    [canEdit, currentUser, updateMutate]
  );

  const doDelete = useCallback(
    async ({ companyId, branchId, id }) => {
      if (!canDelete) throw new Error("Forbidden: insufficient role");
      await deleteMutate({
        companyId,
        branchId,
        saleId: id, // naming for sales API; see adapter below
        currentUser,
      }).unwrap();
    },
    [canEdit, currentUser, deleteMutate]
  );

  return {
    canEdit,
    canDelete,
    confirmingDelete,
    setConfirmingDelete,
    doUpdate,
    doDelete,
    updating: updateState.isLoading,
    deleting: deleteState.isLoading,
    updateError: updateState.error,
    deleteError: deleteState.error,
  };
}
