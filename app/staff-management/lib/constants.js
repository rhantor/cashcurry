// A staff member's job (what they do — not their login role). The first
// seven were here from the start and stay as they were saved; anything else
// can be typed in ("Other…") and is then offered for the branch's next staff.
export const ROLES = [
  { value: '', label: '— Select role —' },
  { value: 'staff', label: 'Staff', group: 'General' },
  { value: 'manager', label: 'Manager', group: 'Management' },
  { value: 'assistantManager', label: 'Assistant manager', group: 'Management' },
  { value: 'supervisor', label: 'Supervisor', group: 'Management' },
  { value: 'captain', label: 'Captain', group: 'Front of house' },
  { value: 'waiter', label: 'Waiter / Server', group: 'Front of house' },
  { value: 'cashier', label: 'Cashier', group: 'Front of house' },
  { value: 'barista', label: 'Barista', group: 'Front of house' },
  { value: 'host', label: 'Host / Receptionist', group: 'Front of house' },
  { value: 'headChef', label: 'Head chef', group: 'Kitchen' },
  { value: 'chef', label: 'Chef', group: 'Kitchen' },
  { value: 'cook', label: 'Cook', group: 'Kitchen' },
  { value: 'tandoor', label: 'Tandoor / Grill', group: 'Kitchen' },
  { value: 'kitchenHelper', label: 'Kitchen helper', group: 'Kitchen' },
  { value: 'steward', label: 'Dishwasher / Steward', group: 'Kitchen' },
  { value: 'storeKeeper', label: 'Store keeper', group: 'Support' },
  { value: 'cleaner', label: 'Cleaner', group: 'Support' },
  { value: 'rider', label: 'Delivery rider', group: 'Support' },
  { value: 'driver', label: 'Driver', group: 'Support' },
  { value: 'technician', label: 'Technician', group: 'Support' },
  { value: 'security', label: 'Security', group: 'Support' },
  { value: 'accountant', label: 'Accountant', group: 'Office' },
  { value: 'intern', label: 'Intern', group: 'General' }
]

/** A job's name: a listed one's label, or the typed-in name as it is. */
export const roleLabelOf = value => ROLES.find(r => r.value && r.value === value)?.label || value || ''

/** The listed jobs in their groups, in order: [[group, [roles]]]. */
export const ROLE_GROUPS = ROLES.filter(r => r.value).reduce((m, r) => {
  const g = m.find(x => x[0] === r.group)
  if (g) g[1].push(r)
  else m.push([r.group, [r]])
  return m
}, [])

export const STATES_MY = [
  'Johor',
  'Kedah',
  'Kelantan',
  'Melaka',
  'Negeri Sembilan',
  'Pahang',
  'Perak',
  'Perlis',
  'Pulau Pinang',
  'Sabah',
  'Sarawak',
  'Selangor',
  'Terengganu',
  'Kuala Lumpur',
  'Putrajaya',
  'Labuan'
]

export const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  gender: '',
  dob: '',
  email: '',
  phone: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  icNumber: '',
  passportNumber: '',
  nationality: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'Malaysia',
  role: '',
  department: '',
  supervisorUid: '', // who leads their work (4.11): a supervisor's login at this branch
  supervisorName: '',
  daysOff: [], // weekly days off (31 Oct), Sunday = 0: their daily tasks go to the supervisor those days
  daysOffSince: '', // from when the days off count (set when they change): earlier days stay as they were
  startDate: '',
  notes: '',
  photoUrl: null,
  basicSalary: '',
  basicPerHour: '',
  OTPerHour: '',
  allowance: '',
  // Payroll config (overrides branch defaults when set)
  salaryMode: '',          // 'hours' | 'days' | '' (blank = use branch default)
  standardHours: '',       // override branch default standard hours/month
  workingDays: '',         // override branch default working days/month
  deductionSettings: {},   // { [deductionKey]: { enabled, employeeRateOverride, employerRateOverride } }
  bankName: '',
  bankAccountNumber: '',
  bankAccountHolderName: '',
  pinCode: '',
  employmentType: 'full-time',
  // Salaried staff (e.g. owner/manager) paid a flat monthly amount with no
  // kiosk attendance — payroll's "Import from Attendance" skips them.
  fixedSalaryNoAttendance: false,
  basicHoursPerDay: 8,
  // This staff member's shift. Blank start/end = no shift, so hours fall back
  // to basicHoursPerDay. End before start means the shift crosses midnight.
  shiftStart: '',
  shiftEnd: '',
  shiftBreakMinutes: '',
  hasPaidBreak: false,
  requireFullShiftForBreak: false,
  fullShiftHours: 7.5,
}

/**
 * Photo upload constraints
 */
export const PHOTO_TARGET_MAX_MB = 0.6
export const PHOTO_MAX_DIMENSION = 1400
