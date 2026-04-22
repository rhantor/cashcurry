/* eslint-disable react/prop-types */
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  useAddSalesEntryMutation,
  useGetSalesEntriesQuery,
  useUpdateSalesEntryMutation,
  useDeleteSalesEntryMutation,
} from "@/lib/redux/api/salesApiSlice";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useGetBranchSettingsQuery } from "@/lib/redux/api/branchSettingsApiSlice";
import { useGetSingleBranchQuery } from "@/lib/redux/api/branchApiSlice";
import imageCompression from "browser-image-compression";

import ConfirmDeleteModal from "@/app/components/common/ConfirmDeleteModal";
import useCrudActions from "@/app/components/common/useCrudActions";
import { getCurrentUser } from "@/lib/authz/roles";
import ItemsReportModal from "@/app/reports/sales-report/SalesReportModal";

// --- IMPORT NEW SUB-COMPONENTS ---
import SalesForm from "./SalesForm";
import SalesTable from "./SalesTable";

export default function SalesEntry() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [companyId, setCompanyId] = useState(null);
  const [branchId, setBranchId] = useState(null);
  const [userRole, setUserRole] = useState(null);

  const [errorMessage, setErrorMessage] = useState("");
  const [confirmMode, setConfirmMode] = useState("create"); // "create" | "update"
  const [openNote, setOpenNote] = useState(null);
  const [selectedSale, setSelectedSale] = useState(null); // for view modal
  const [editingSale, setEditingSale] = useState(null); // entry being edited
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Form State
  const [form, setForm] = useState({});
  const [notes, setNotes] = useState({});

  const [addSalesEntry, { isLoading: isCreating }] = useAddSalesEntryMutation();

  // File Upload State
  const [zReportFile, setZReportFile] = useState(null);
  const [zReportPreview, setZReportPreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [zReportUrl, setZReportUrl] = useState(null);

  const TARGET_MAX_MB = 1.2;
  const MAX_DIMENSION = 2200;

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      setCompanyId(parsed.companyId);
      setBranchId(parsed.branchId);
      setUserRole(parsed.role);
    }
  }, []);

  const { data: settings, isLoading: settingsLoading } = useGetBranchSettingsQuery(
    { companyId, branchId },
    { skip: !companyId || !branchId }
  );

  const { data: branchData = {} } = useGetSingleBranchQuery(
    { companyId, branchId },
    { skip: !companyId || !branchId }
  );

  const tendersConfig = useMemo(() => {
    const list = settings?.financeSales?.tenders || [];
    return list.filter((t) => t.enabled !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [settings]);

  // Init form
  useEffect(() => {
    if (!tendersConfig.length) return;
    setForm((prev) => {
      const next = {};
      tendersConfig.forEach((t) => { next[t.key] = prev?.[t.key] ?? ""; });
      return next;
    });
    setNotes((prev) => {
        const next = {};
        tendersConfig.forEach((t) => { next[t.key] = prev?.[t.key] ?? ""; });
        return next;
    });
  }, [tendersConfig]);

  const resetToCreateMode = () => {
    setEditingSale(null);
    setConfirmMode("create");
    setForm(tendersConfig.reduce((acc, t) => ((acc[t.key] = ""), acc), {}));
    setNotes(tendersConfig.reduce((acc, t) => ((acc[t.key] = ""), acc), {}));
    setDate(today);
    setZReportFile(null);
    setZReportPreview(null);
    setUploadProgress(0);
    setZReportUrl(null);
    setOpenNote(null);
    setErrorMessage("");
  };

  const handleChange = (field, value) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) setForm((prev) => ({ ...prev, [field]: value }));
    else if (value === "") setForm((prev) => ({ ...prev, [field]: "" }));
  };

  const handleNoteChange = (field, value) => setNotes((prev) => ({ ...prev, [field]: value }));

  const total = useMemo(() => {
    return tendersConfig.reduce((sum, t) => {
      if (t.includeInTotal === false) return sum;
      return sum + (parseFloat(form[t.key]) || 0);
    }, 0);
  }, [form, tendersConfig]);

  // File Handlers
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type?.startsWith("image/")) {
      setErrorMessage("Please select an image file.");
      return;
    }

    try {
      let workingFile = file;
      if (file.size > TARGET_MAX_MB * 1024 * 1024) {
        workingFile = await imageCompression(file, {
          maxSizeMB: TARGET_MAX_MB,
          maxWidthOrHeight: MAX_DIMENSION,
          useWebWorker: true,
        });
      }
      
      setErrorMessage("");
      setZReportFile(workingFile);
      setZReportPreview(URL.createObjectURL(workingFile));
      setUploadProgress(0);
    } catch (err) {
      console.error("Compression failed:", err);
      setErrorMessage("Failed to process image.");
    }
  };

  const removeFile = () => {
    setZReportFile(null);
    setZReportPreview(editingSale?.zReportUrl || null); // revert to existing if editing
    setUploadProgress(0);
  };

  const uploadZReport = () => {
    if (!zReportFile || !companyId || !branchId) return null;
    const ext = zReportFile.name.split('.').pop() || 'jpg';
    const filePath = `zReports/${companyId}/${branchId}/${date}-${Date.now()}.${ext}`;
    const storageRef = ref(storage, filePath);
    
    return new Promise((resolve, reject) => {
      const uploadTask = uploadBytesResumable(storageRef, zReportFile);
      uploadTask.on(
        "state_changed",
        (snap) => setUploadProgress((snap.bytesTransferred / snap.totalBytes) * 100),
        reject,
        async () => resolve(await getDownloadURL(uploadTask.snapshot.ref))
      );
    });
  };

  const proofRequired = useMemo(() => 
    tendersConfig.some(t => t.requireProof && (parseFloat(form[t.key]) || 0) > 0), 
  [tendersConfig, form]);

  const handleSubmit = async () => {
    if (confirmBusy) return;
    setConfirmBusy(true);
    setErrorMessage("");

    try {
        // Check duplication (if date changed or creating new)
        if (!editingSale || (editingSale && editingSale.date !== date)) {
            const salesRef = collection(db, "companies", companyId, "branches", branchId, "sales");
            const q = query(salesRef, where("date", "==", date));
            const snapshot = await getDocs(q);
            // If editing, check if ID is different. If creating, just check existence.
            const exists = snapshot.docs.some(d => editingSale ? d.id !== editingSale.id : true);
            
            if (exists) {
                setErrorMessage("Sales entry already exists for this date.");
                setConfirmBusy(false);
                return;
            }
        }

        // Check Proof
        if (proofRequired && !(zReportFile || zReportUrl || editingSale?.zReportUrl)) {
            setErrorMessage("Proof is required: please attach Z Report image.");
            setConfirmBusy(false);
            return;
        }

        // Upload
        let finalUrl = zReportUrl || editingSale?.zReportUrl || null;
        if (zReportFile) {
            finalUrl = await uploadZReport();
        }

        const payload = {
            date,
            ...form,
            notes,
            total,
            zReportUrl: finalUrl,
            tenderMeta: tendersConfig.map(t => ({
                key: t.key,
                label: t.label,
                includeInTotal: t.includeInTotal !== false,
                banked: !!t.banked,
                requireProof: !!t.requireProof,
                order: t.order ?? null,
            })),
        };

        if (confirmMode === "create") {
            const createdBy = getCurrentUser() || {};
            await addSalesEntry({ 
                companyId, 
                branchId, 
                data: { ...payload, createdBy, createdAt: new Date().toISOString() } 
            }).unwrap();
        } else {
            await doUpdate({ 
                companyId, 
                branchId, 
                id: editingSale.id, 
                patch: payload 
            });
        }
        
        resetToCreateMode();

    } catch (err) {
        console.error("Submit Error:", err);
        setErrorMessage("Failed to save entry. Please try again.");
    } finally {
        setConfirmBusy(false);
    }
  };

  // CRUD Hooks
  function useSalesCrud() {
    const base = useCrudActions({
      useUpdateMutationHook: useUpdateSalesEntryMutation,
      useDeleteMutationHook: useDeleteSalesEntryMutation,
      idFieldName: "saleId",
    });
    const doUpdate = async ({ companyId, branchId, id, patch }) => base.doUpdate({ companyId, branchId, id, patch });
    const doDelete = async ({ companyId, branchId, id }) => base.doDelete({ companyId, branchId, id });
    return { ...base, doUpdate, doDelete };
  }
  
  const { canEdit, canDelete, confirmingDelete, setConfirmingDelete, doUpdate, doDelete, updating } = useSalesCrud();
  
  // Fetch this month's sales to compute "Grand Total (This Month)" for the modal
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString().split("T")[0];

  const { data: sales = [], isLoading: salesLoading, isError: salesError } = useGetSalesEntriesQuery(
    { companyId, branchId, startDate: monthStart, endDate: monthEnd },
    { skip: !companyId || !branchId }
  );

  const lastFiveSales = useMemo(() => {
    const list = Array.isArray(sales) ? [...sales] : [];
    return list.sort((a, b) => (new Date(b.date) - new Date(a.date))).slice(0, 5);
  }, [sales]);

  // Edit Handler
  const startEdit = (entry) => {
    setEditingSale(entry);
    setConfirmMode("update");
    setDate(entry.date);
    
    const nextForm = {};
    const nextNotes = entry.notes || {};
    tendersConfig.forEach((t) => { nextForm[t.key] = entry[t.key] ? String(entry[t.key]) : ""; });
    
    setForm(nextForm);
    setNotes(nextNotes);
    
    if (entry.zReportUrl) {
        setZReportPreview(entry.zReportUrl);
        setZReportUrl(entry.zReportUrl);
    } else {
        setZReportPreview(null);
        setZReportUrl(null);
    }
    setZReportFile(null);
    setUploadProgress(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isUploading = uploadProgress > 0 && uploadProgress < 100;
  
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
        Sales Entry <span className="text-mint-500">{editingSale ? "(Edit Mode)" : ""}</span>
      </h1>

      <SalesForm 
        date={date}
        setDate={setDate}
        tendersConfig={tendersConfig}
        form={form}
        handleChange={handleChange}
        notes={notes}
        handleNoteChange={handleNoteChange}
        openNote={openNote}
        setOpenNote={setOpenNote}
        zReportFile={zReportFile}
        zReportPreview={zReportPreview}
        handleFileChange={handleFileChange}
        removeFile={removeFile}
        uploadProgress={uploadProgress}
        total={total}
        onSubmit={handleSubmit}
        isSubmitDisabled={confirmBusy || isCreating || updating || isUploading || settingsLoading}
        submitLabel={
            confirmBusy || isCreating || updating 
            ? "Saving..." 
            : isUploading 
            ? "Uploading..." 
            : editingSale 
            ? "Update Entry" 
            : "Save Entry"
        }
        onCancel={resetToCreateMode}
        showCancel={!!editingSale}
        errorMessage={errorMessage}
      />

      <SalesTable
        sales={lastFiveSales}
        loading={salesLoading}
        error={salesError}
        canEdit={canEdit}
        role={userRole}
        onEdit={startEdit}
        onView={setSelectedSale}
      />

      {selectedSale && (() => {
        // Compute Grand Total for the same month as the selected entry
        const selectedMonth = selectedSale.date?.slice(0, 7); // "YYYY-MM"
        const monthTotal = sales
          .filter(s => s.date?.startsWith(selectedMonth))
          .reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0)
          .toFixed(2);

        return (
          <ItemsReportModal
            item={selectedSale}
            branchData={branchData}
            monthTotal={monthTotal}
            onClose={() => setSelectedSale(null)}
          />
        );
      })()}

      <ConfirmDeleteModal
        visible={!!confirmingDelete}
        onClose={() => setConfirmingDelete(null)}
        date={confirmingDelete?.date}
        onConfirm={async () => {
          await doDelete({ companyId, branchId, id: confirmingDelete.id });
        }}
      />
    </div>
  );
}