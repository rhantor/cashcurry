/**
 * Generic payroll calculation engine.
 *
 * No hardcoded country-specific deductions (EPF/SOCSO/EIS etc.).
 * Statutory deductions are driven entirely by the branch `payroll.statutoryDeductions`
 * config array, making this work for Malaysia, Bangladesh, or any other country.
 */

// ─── Types (JSDoc only) ───────────────────────────────────────────────────────
/**
 * @typedef {Object} StatutoryDeduction  (from branch settings)
 * @property {string}  key            - unique identifier
 * @property {string}  name           - display label (e.g. "EPF", "Provident Fund")
 * @property {number}  employeeRate   - % deducted from employee
 * @property {number}  employerRate   - % employer contributes on top
 * @property {'basic'|'gross'|'capped'} basis
 * @property {number|null} capAmount  - for 'capped' basis: max salary the rate applies to
 * @property {boolean} enabled
 */

/**
 * @typedef {Object} StaffConfig  (from staff document)
 * @property {number}  basicSalary
 * @property {number}  allowance
 * @property {'hours'|'days'} salaryMode
 * @property {number}  standardHours  - standard hours/month (hours mode)
 * @property {number}  workingDays    - working days/month  (days mode)
 * @property {number}  [basicPerHour] - overrides basicSalary/standardHours if > 0
 * @property {number}  [OTPerHour]    - explicit OT rate; if 0/null, derived from hourly × multiplier
 * @property {number}  [otMultiplier] - default 1.5 (overridden by branch default if absent)
 * @property {number}  [phMultiplier] - default 2.0
 * @property {Object}  deductionSettings  - { [key]: { enabled, employeeRateOverride, employerRateOverride } }
 */

/**
 * @typedef {Object} PeriodInputs  (what the user enters per month)
 * @property {number} workedHours
 * @property {number} workedDays
 * @property {number} otHours
 * @property {number} phHours   - public holiday hours (hours mode)
 * @property {number} phDays    - public holiday days  (days mode)
 * @property {number} otherEarnings
 * @property {string} otherEarningsNote
 * @property {number} otherDeductions
 * @property {string} otherDeductionsNote
 * @property {number} advanceAmt  - total advance deduction for this period
 * @property {number} loanAmt     - total loan deduction for this period
 */

// ─── Main calculation ─────────────────────────────────────────────────────────

/**
 * Calculate full payroll breakdown for one staff member for one period.
 *
 * @param {StaffConfig}          staffConfig
 * @param {PeriodInputs}         inputs
 * @param {StatutoryDeduction[]} statutoryDeductions  - from branch payroll settings
 * @param {Object}               branchDefaults       - { otMultiplier, phMultiplier }
 * @returns {Object} full breakdown
 */
export function calcPayroll(
  staffConfig,
  inputs,
  statutoryDeductions = [],
  branchDefaults = {}
) {
  const {
    basicSalary    = 0,
    allowance      = 0,
    salaryMode     = 'hours',
    standardHours  = 208,
    workingDays    = 26,
    basicPerHour   = null,
    OTPerHour      = null,
    deductionSettings = {},
  } = staffConfig;

  const otMultiplier = staffConfig.otMultiplier ?? branchDefaults.otMultiplier ?? 1.5;
  const phMultiplier = staffConfig.phMultiplier ?? branchDefaults.phMultiplier ?? 2.0;

  const {
    workedHours    = 0,
    workedDays     = 0,
    otHours        = 0,
    phHours        = 0,
    phDays         = 0,
    otherEarnings  = 0,
    otherDeductions = 0,
    advanceAmt     = 0,
    loanAmt        = 0,
    bonus          = 0,
    penalty        = 0,
  } = inputs;

  // ── Rates ────────────────────────────────────────────────────────────────
  const basic = r2(parseFloat(basicSalary) || 0);
  const alw   = r2(parseFloat(allowance)   || 0);

  let hourlyRate = 0;
  let dailyRate  = 0;

  if (salaryMode === 'hours') {
    const bph = parseFloat(basicPerHour) || 0;
    hourlyRate = bph > 0
      ? bph
      : (standardHours > 0 ? basic / standardHours : 0);
  } else {
    dailyRate = workingDays > 0 ? basic / workingDays : 0;
  }

  // ── Base pay (handles absences by exact proration) ────────────────────────
  let basePay      = 0;
  let absentAmount = 0;

  if (salaryMode === 'hours') {
    const wh = parseFloat(workedHours) || 0;
    const sh = parseFloat(standardHours) || 0;
    if (wh >= sh) {
      basePay = basic;
    } else {
      basePay      = r2(wh * hourlyRate);
      absentAmount = r2(basic - basePay);
    }
  } else {
    const wd = parseFloat(workedDays)  || 0;
    const md = parseFloat(workingDays) || 0;
    if (wd >= md) {
      basePay = basic;
    } else {
      basePay      = r2(wd * dailyRate);
      absentAmount = r2(basic - basePay);
    }
  }

  // ── OT pay ────────────────────────────────────────────────────────────────
  const oh  = parseFloat(otHours) || 0;
  let otRate = 0;

  if (parseFloat(OTPerHour) > 0) {
    otRate = parseFloat(OTPerHour);
  } else {
    // derive from hourly/daily rate × multiplier
    const effectiveHourly =
      salaryMode === 'hours' ? hourlyRate : dailyRate / 8;
    otRate = effectiveHourly * otMultiplier;
  }
  const otPay = r2(oh * otRate);

  // ── Public holiday pay ────────────────────────────────────────────────────
  let phPay = 0;
  if (salaryMode === 'hours') {
    phPay = r2((parseFloat(phHours) || 0) * hourlyRate * phMultiplier);
  } else {
    phPay = r2((parseFloat(phDays) || 0) * dailyRate * phMultiplier);
  }

  // ── Gross earnings ────────────────────────────────────────────────────────
  const otherEarn  = r2(parseFloat(otherEarnings) || 0);
  const bonusAmt   = r2(parseFloat(bonus)         || 0);
  const grossEarnings = r2(basePay + alw + otPay + phPay + otherEarn + bonusAmt);

  // ── Statutory deductions (fully config-driven) ────────────────────────────
  const statutory = [];
  let totalStatutoryEmployee = 0;
  let totalStatutoryEmployer = 0;

  for (const ded of statutoryDeductions) {
    if (!ded.enabled) continue;

    const override   = deductionSettings?.[ded.key] || {};
    const isEnabled  = override.enabled !== undefined ? override.enabled : true;
    if (!isEnabled) continue;

    const empRate  = override.employeeRateOverride != null
      ? parseFloat(override.employeeRateOverride)
      : (parseFloat(ded.employeeRate) || 0);

    const emplrRate = override.employerRateOverride != null
      ? parseFloat(override.employerRateOverride)
      : (parseFloat(ded.employerRate) || 0);

    // Basis amount
    let basisAmt = 0;
    if (ded.basis === 'basic') {
      basisAmt = basic;
    } else if (ded.basis === 'gross') {
      basisAmt = grossEarnings;
    } else {
      // 'capped'
      const cap = parseFloat(ded.capAmount) || Infinity;
      basisAmt = Math.min(grossEarnings, cap);
    }

    const employeeAmt = r2((basisAmt * empRate)   / 100);
    const employerAmt = r2((basisAmt * emplrRate)  / 100);

    statutory.push({
      key:         ded.key,
      name:        ded.name,
      employeeAmt,
      employerAmt,
      employeeRate: empRate,
      employerRate: emplrRate,
      basis:       ded.basis,
      capAmount:   ded.capAmount ?? null,
      basisAmt,
    });

    totalStatutoryEmployee += employeeAmt;
    totalStatutoryEmployer += employerAmt;
  }

  totalStatutoryEmployee = r2(totalStatutoryEmployee);
  totalStatutoryEmployer = r2(totalStatutoryEmployer);

  // ── Other deductions ──────────────────────────────────────────────────────
  const otherDed   = r2(parseFloat(otherDeductions) || 0);
  const penaltyAmt = r2(parseFloat(penalty)         || 0);
  const advDed     = r2(parseFloat(advanceAmt)      || 0);
  const loanDed    = r2(parseFloat(loanAmt)         || 0);

  const totalDeductions = r2(
    totalStatutoryEmployee + otherDed + penaltyAmt + advDed + loanDed
  );

  // ── Summaries ─────────────────────────────────────────────────────────────
  const netPay          = r2(Math.max(0, grossEarnings - totalDeductions));
  const totalEmployerCost = r2(grossEarnings + totalStatutoryEmployer);

  return {
    // config snapshot (for payslip display)
    basicSalary:   basic,
    allowance:     alw,
    salaryMode,
    standardHours: parseFloat(standardHours) || 0,
    workingDays:   parseFloat(workingDays)   || 0,
    // attendance
    workedHours:  parseFloat(workedHours)  || 0,
    workedDays:   parseFloat(workedDays)   || 0,
    otHours:      oh,
    phHours:      parseFloat(phHours)      || 0,
    phDays:       parseFloat(phDays)       || 0,
    // earnings breakdown
    basePay,
    otPay,
    phPay,
    bonus:          bonusAmt,
    otherEarnings:  otherEarn,
    grossEarnings,
    absentAmount,
    // deductions
    statutory,
    totalStatutoryEmployee,
    totalStatutoryEmployer,
    advanceAmt:      advDed,
    loanAmt:         loanDed,
    penalty:         penaltyAmt,
    otherDeductions: otherDed,
    totalDeductions,
    // totals
    netPay,
    totalEmployerCost,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Round to 2 decimal places (banker-safe). */
function r2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Format a number as a plain 2-decimal string (no currency symbol). */
export function fmtAmt(n) {
  const num = parseFloat(n);
  return Number.isFinite(num) ? num.toFixed(2) : '0.00';
}

/** Generate "YYYY-MM" period key from a Date (or year+month integers). */
export function toPeriodKey(yearOrDate, month) {
  if (yearOrDate instanceof Date) {
    return `${yearOrDate.getFullYear()}-${String(yearOrDate.getMonth() + 1).padStart(2, '0')}`;
  }
  return `${yearOrDate}-${String(month).padStart(2, '0')}`;
}

/** Friendly label for a period key, e.g. "April 2026". */
export function periodLabel(periodKey) {
  if (!periodKey) return '';
  const [y, m] = periodKey.split('-');
  return new Date(parseInt(y), parseInt(m) - 1, 1)
    .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}
