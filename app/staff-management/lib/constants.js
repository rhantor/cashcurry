export const ROLES = [
  { value: '', label: '— Select role —' },
  { value: 'staff', label: 'Staff' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'manager', label: 'Manager' },
  { value: 'driver', label: 'Driver' },
  { value: 'technician', label: 'Technician' },
  { value: 'intern', label: 'Intern' }
]

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
  bankAccountHolderName: '',
  pinCode: '',
  employmentType: 'full-time',
  basicHoursPerDay: 8,
  hasPaidBreak: false,
  requireFullShiftForBreak: false,
  fullShiftHours: 7.5
}

/**
 * Photo upload constraints
 */
export const PHOTO_TARGET_MAX_MB = 0.6
export const PHOTO_MAX_DIMENSION = 1400
