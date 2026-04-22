// lib/validation.js

const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim())

const isMyPhone = v =>
  /^(\+?60)?1[0-9]{8,9}$/.test(String(v || '').replace(/[\s-]/g, ''))

const isIcNo = v =>
  /^\d{6}-?\d{2}-?\d{4}$/.test(String(v || '').replace(/\s/g, ''))

const isPassport = v => /^[A-Za-z0-9]{6,20}$/.test(String(v || '').trim())

export const RULES = {
  firstName: v => (!String(v || '').trim() ? 'First name is required' : null),
  lastName: v => (!String(v || '').trim() ? 'Last name is required' : null),
  email: v =>
    !String(v || '').trim()
      ? 'Email is required'
      : !isEmail(v)
      ? 'Invalid email'
      : null,
  phone: v =>
    !String(v || '').trim()
      ? 'Phone is required'
      : !isMyPhone(v)
      ? 'Invalid MY phone (+60)'
      : null,
  role: v => (!v ? 'Select a role' : null),
  pinCode: v => (!/^\d{4}$/.test(String(v || '')) ? 'PIN must be exactly 4 digits' : null),

  // ✅ Conditional (needs full form)
  icNumber: (v, form) => {
    const nat = String(form?.nationality || '').toLowerCase()
    const isMY = nat === 'malaysian'

    if (!isMY) return null // not required for non-MY

    if (!String(v || '').trim())
      return 'IC number is required for Malaysian staff'
    if (!isIcNo(v)) return 'Format: 000000-00-0000'
    return null
  },

  passportNumber: (v, form) => {
    const nat = String(form?.nationality || '').toLowerCase()
    const isMY = nat === 'malaysian'

    if (isMY) {
      // optional for Malaysian
      if (String(v || '').trim() && !isPassport(v))
        return 'Invalid passport number'
      return null
    }

    // ✅ required for non-MY (when nationality chosen)
    if (!nat) return null // if they didn't select nationality yet, don’t block save
    if (!String(v || '').trim())
      return 'Passport number is required for non-Malaysian staff'
    if (!isPassport(v)) return 'Invalid passport number'
    return null
  }
}

export function validate (form) {
  const errs = {}

  Object.keys(RULES).forEach(k => {
    const rule = RULES[k]
    const msg = typeof rule === 'function' ? rule(form?.[k], form) : null
    if (msg) errs[k] = msg
  })

  return errs
}
