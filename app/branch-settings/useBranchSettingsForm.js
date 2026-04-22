import { useEffect, useState } from "react";
import {
  useGetSingleBranchQuery,
  useUpdateBranchMutation,
} from "@/lib/redux/api/branchApiSlice";
import {
  useGetBranchSettingsQuery,
  useUpdateBranchSettingsMutation,
} from "@/lib/redux/api/branchSettingsApiSlice";
import { BRANCH_LOCKED_FIELDS, BASIC_SETTINGS_FIELDS } from "./fieldMaps";

function normalizeTenders(input = []) {
  return input.map((t, i) => {
    // default delivery to false if missing
    let delivery = t.delivery ?? false;

    // auto-mark delivery platforms
    if (["grab", "foodpanda"].includes(String(t.key || "").toLowerCase())) {
      delivery = true;
    }

    return {
      ...t,
      order: i + 1, // keep sequential order
      delivery,
    };
  });
}

export default function useBranchSettingsForm() {
  const [companyId, setCompanyId] = useState(null);
  const [branchId, setBranchId] = useState(null);
  const [role, setRole] = useState(null);

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) return;
    const u = JSON.parse(raw);
    setCompanyId(u.companyId);
    setBranchId(u.branchId);
    setRole(u.role);
  }, []);

  const skip = !companyId || !branchId;
  const { data: branch } = useGetSingleBranchQuery(
    { companyId, branchId },
    { skip }
  );
  const { data: settings } = useGetBranchSettingsQuery(
    { companyId, branchId },
    { skip }
  );

  const [form, setForm] = useState(null);
  const [initialFormText, setInitialFormText] = useState(null);

  // seed the form once both are loaded
  useEffect(() => {
    if (!branch || !settings) return;

    const basic = {
      // locked fields (read from branch)
      name: branch.name || settings.basic?.name || "",
      code: branch.code || settings.basic?.code || "",
      // editable basic fields
      phone: settings.basic?.phone ?? branch.phone ?? "",
      whatsapp: settings.basic?.whatsapp ?? branch.whatsapp ?? "",
      email: (branch.email || settings.basic?.email) ?? branch.email ?? "",
      address: {
        line1:
          (branch.address || settings.basic?.address?.line1) ??
          branch.address?.line1 ??
          "",
        city: settings.basic?.address?.city ?? branch.address?.city ?? "",
        state: settings.basic?.address?.state ?? branch.address?.state ?? "",
        postcode:
          settings.basic?.address?.postcode ?? branch.address?.postcode ?? "",
        country:
          settings.basic?.address?.country ??
          branch.address?.country ??
          "Malaysia",
      },
      openHours: settings.basic?.openHours ?? branch.openHours ?? [],
    };

    // Prepare Finance & Sales
    const fs = settings.financeSales || {};
    const normalizedTenders = normalizeTenders(fs.tenders || []);

    // --- NEW: Populate Opening Balance ---
    // If the new field is missing, check the legacy 'initialCash' or default to 0
    const openingBalance = fs.openingBalance ?? settings.initialCash ?? 0;

    const newForm = {
      ...settings,
      basic,
      financeSales: {
        ...fs,
        openingBalance, // Ensure this is set in the form state
        tenders: normalizedTenders,
      },
    };

    setForm(newForm);
    if (!initialFormText) {
      setInitialFormText(JSON.stringify(newForm));
    }
  }, [branch, settings]);

  const [updateBranch, { isLoading: savingBranch }] = useUpdateBranchMutation();
  const [updateSettings, { isLoading: savingSettings }] =
    useUpdateBranchSettingsMutation();

  const saving = savingBranch || savingSettings;

  const save = async () => {
    if (!form) return;

    // 1) Split updates: what goes to branch vs settings
    const branchUpdates = {};
    const settingsPatch = { ...form };

    // move locked fields into branchUpdates
    BRANCH_LOCKED_FIELDS.forEach((k) => {
      if (form.basic?.[k] !== undefined) {
        branchUpdates[k] = form.basic[k];
      }
    });

    // ensure settings.basic only contains non-locked fields
    const nextBasic = { ...(form.basic || {}) };
    BRANCH_LOCKED_FIELDS.forEach((k) => delete nextBasic[k]);
    Object.keys(nextBasic).forEach((key) => {
      if (![...BASIC_SETTINGS_FIELDS].includes(key)) delete nextBasic[key];
    });
    settingsPatch.basic = nextBasic;

    // 2) Ensure tenders have sequential order AND delivery normalized
    const fs = settingsPatch.financeSales || {};
    const tenders = normalizeTenders(fs.tenders || []);
    settingsPatch.financeSales = { ...fs, tenders };

    // 3) Perform writes
    if (Object.keys(branchUpdates).length) {
      await updateBranch({ companyId, branchId, updates: branchUpdates });
    }
    await updateSettings({ companyId, branchId, patch: settingsPatch });
    
    // Reset dirty state on successful save
    setInitialFormText(JSON.stringify({ ...form, basic: { ...form.basic, ...branchUpdates } }));
  };

  return {
    companyId,
    branchId,
    role,
    branch,
    settings,
    form,
    setForm,
    save,
    saving,
    isDirty: form ? JSON.stringify(form) !== initialFormText : false,
  };
}