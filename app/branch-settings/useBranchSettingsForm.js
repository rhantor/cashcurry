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
import useSession from "@/app/hooks/useSession";

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
  // the branch being viewed: a branch user's own, or the one a company role picked
  const { companyId, branchId, role } = useSession();

  const skip = !companyId || !branchId;
  const { data: branch, error: branchError } = useGetSingleBranchQuery(
    { companyId, branchId },
    { skip }
  );
  const { data: settings, error: settingsError } = useGetBranchSettingsQuery(
    { companyId, branchId },
    { skip }
  );

  const [form, setForm] = useState(null);
  const [initialFormText, setInitialFormText] = useState(null);
  const [saveError, setSaveError] = useState("");

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
      email: settings.basic?.email ?? branch.email ?? "",
      companyName: settings.basic?.companyName ?? branch.companyName ?? "",
      companyRegistration: settings.basic?.companyRegistration ?? branch.companyRegistration ?? "",
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

    // Prepare Attendance
    const attendance = settings.attendance || {
      payPeriodStart: 1,
      startDayOfWeek: "Monday",
      // No cut-off was ever set, which everything reads as midnight. Don't
      // invent one here: saving any other setting would silently move the
      // branch's business day (sales, costs, attendance, POS).
      dayCutoffTime: "",
      duplicatePunchInterval: 5,
      maxWorkHoursPerDay: 16,
      hoursFormat: "decimal",
      useBiometrics: false,
      useCamera: true,
    };

    const newForm = {
      ...settings,
      companyId,
      branchId,
      basic,
      financeSales: {
        ...fs,
        openingBalance, // Ensure this is set in the form state
        tenders: normalizedTenders,
      },
      attendance,
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
    if (!form) return false;
    setSaveError("");

    // 1) Split updates: what goes to branch vs settings
    const branchUpdates = {};
    const settingsPatch = { ...form };

    // Move locked fields into branchUpdates — but only the ones that actually
    // changed. Writing branch metadata needs owner/branchAdmin rights, so
    // re-sending an unchanged name/code used to make every manager save fail
    // before the settings write was even attempted.
    BRANCH_LOCKED_FIELDS.forEach((k) => {
      const next = form.basic?.[k];
      if (next !== undefined && next !== (branch?.[k] ?? "")) {
        branchUpdates[k] = next;
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
    try {
      if (Object.keys(branchUpdates).length) {
        await updateBranch({
          companyId,
          branchId,
          updates: branchUpdates,
        }).unwrap();
      }
      await updateSettings({
        companyId,
        branchId,
        patch: settingsPatch,
      }).unwrap();
    } catch (e) {
      setSaveError(
        e?.message || e?.error?.message || "Could not save settings."
      );
      return false;
    }

    // Reset dirty state on successful save
    setInitialFormText(JSON.stringify({ ...form, basic: { ...form.basic, ...branchUpdates } }));
    return true;
  };

  // Put the form back as it was last saved.
  const discard = () => initialFormText && setForm(JSON.parse(initialFormText));

  return {
    companyId,
    branchId,
    role,
    branch,
    settings,
    form,
    setForm,
    save,
    discard,
    saving,
    saveError,
    loadError: branchError || settingsError,
    isDirty: form ? JSON.stringify(form) !== initialFormText : false,
  };
}