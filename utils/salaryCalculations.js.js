// Formatting Helper
export const fmt = n =>
  `RM ${(+n || 0).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`

export const getMonthKey = (y, m) => `${y}-${String(m).padStart(2, '0')}`

// 1. Calculate Age
export const calculateAge = dob => {
  if (!dob) return 30
  const diff = Date.now() - new Date(dob).getTime()
  return Math.abs(new Date(diff).getUTCFullYear() - 1970)
}

// 2. Statutory Formulas (Adjusted to match your Boss's Excel Logic)
export const getEPF = (basic, age) => {
  // ⚠️ CUSTOM RULE: Your boss uses a flat 2% instead of the 11% standard.
  // Example from Excel: Nur Zaman Basic RM 3300 * 2% = RM 66.
  return {
    employeeRate: 0.02,
    employerRate: 0.02
  }
}

export const getSOCSO = (amount, age) => {
  const c = Math.min(amount, 5000)
  if (age >= 60)
    return { employee: 0, employer: +(c * 0.0125).toFixed(2), scheme: 2 }

  // Percentage logic that closely mimics the SOCSO wage bracket tables
  return {
    employee: +(c * 0.005).toFixed(2),
    employer: +(c * 0.0175).toFixed(2),
    scheme: 1
  }
}

export const getEIS = amount => {
  const a = +(Math.min(amount, 5000) * 0.002).toFixed(2)
  return { employee: a, employer: a }
}

// 3. Main Calculation Function
export const calcSalary = ({
  staff,
  mode,
  standardHours,
  workedHours,
  workingDays,
  workedDays,
  otHours,
  phHours,
  customAllowance,
  customLoanAmt,
  otherEarnings = 0,
  otherDeductions = 0,
  advanceAmt = 0,
  loanAmt = 0,
  enableEPF = true,
  enableSOCSO = true,
  enableEIS = true
}) => {
  const basic = parseFloat(staff.basicSalary) || 0

  // Use custom allowance if provided in UI, otherwise fallback to staff profile
  const activeAllowance =
    customAllowance !== undefined
      ? parseFloat(customAllowance) || 0
      : parseFloat(staff.allowance) || 0

  const otRate = parseFloat(staff.OTPerHour) || 0
  const strictHourlyRate = parseFloat(staff.basicPerHour) || 0
  const age = calculateAge(staff.dob)

  let basePay = 0
  let absentHours = 0
  let absentDays = 0

  // --- Calculate EXACT Earned Base Pay ---
  // --- Calculate EXACT Earned Base Pay ---
  if (mode === 'hours') {
    const std = standardHours || 312
    const ratePerHour = strictHourlyRate > 0 ? strictHourlyRate : basic / std

    absentHours = Math.max(0, std - workedHours)

    // ✅ THE FIX:
    // If they work the full hours (or more), they get exactly their full Basic Salary.
    // If they are absent, they get paid for the exact hours worked at their strict rate (e.g., 280 * 6.08 = 1702.40).
    if (workedHours >= std) {
      basePay = basic
    } else {
      basePay = workedHours * ratePerHour
    }
  } else {
    const wd = workingDays || 26
    const dailyRate = basic / wd

    absentDays = Math.max(0, wd - workedDays)

    // Apply the same logic for "Days" mode
    if (workedDays >= wd) {
      basePay = basic
    } else {
      basePay = workedDays * dailyRate
    }
  }

  // Earnings
  const otPay = (parseFloat(otHours) || 0) * otRate
  const hourlyRateForPh =
    strictHourlyRate > 0 ? strictHourlyRate : basic / (standardHours || 208)
  const phPay = (parseFloat(phHours) || 0) * (hourlyRateForPh * 2)

  const grossEarnings =
    basePay + activeAllowance + otPay + phPay + (+otherEarnings || 0)

  // --- Statutory Deductions ---
  // EPF calculated on Basic Salary (Now using 2%)
  const epfR = enableEPF
    ? getEPF(basic, age)
    : { employeeRate: 0, employerRate: 0 }
  const epfEmp = enableEPF ? +(basic * epfR.employeeRate).toFixed(2) : 0
  const epfEr = enableEPF ? +(basic * epfR.employerRate).toFixed(2) : 0

  // ⚠️ CUSTOM RULE: Boss calculates SOCSO & EIS on BASIC, not Gross.
  const socso = enableSOCSO
    ? getSOCSO(basic, age)
    : { employee: 0, employer: 0, scheme: 1 }
  const eis = enableEIS ? getEIS(basic) : { employee: 0, employer: 0 }
  const statutory = epfEmp + socso.employee + eis.employee

  // Use custom loan payment if provided in UI, otherwise auto-deduct EMI
  const activeLoanAmt =
    customLoanAmt !== undefined
      ? parseFloat(customLoanAmt) || 0
      : parseFloat(loanAmt) || 0

  // --- Total Deductions ---
  const totalDed =
    (+advanceAmt || 0) + activeLoanAmt + (+otherDeductions || 0) + statutory

  const netPay = Math.max(0, grossEarnings - totalDed)

  return {
    age,
    mode,
    basic,
    allowance: activeAllowance,
    basePay,
    otPay,
    phPay,
    otherEarnings: parseFloat(otherEarnings) || 0,
    grossEarnings,
    absentHours,
    absentDays,
    absentDeduction: 0, // Hardcoded to 0 to prevent double-charging for absences
    epf: { employee: epfEmp, employer: epfEr, ...epfR },
    socso,
    eis,
    statutory,
    advanceAmt: parseFloat(advanceAmt) || 0,
    loanAmt: activeLoanAmt,
    otherDeductions: parseFloat(otherDeductions) || 0,
    totalDeductions: totalDed,
    netPay,
    totalEmployerCost: grossEarnings + epfEr + socso.employer + eis.employer
  }
}
