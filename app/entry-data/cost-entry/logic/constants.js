export const CATEGORIES = [
  'Utilities',
  'Inventory',
  'Maintenance',
  'Staff Cost',
  'Rent/Deposit',
  'Transport/Delivery',
  'Office Supplies',
  'Operation',
  'New Purchases/Assets',
  'Software/Subscriptions',
  'Taxes/License',
  'compund',
  'Packaging',
  'Marketing/Ads',
  'Bank Charges',
  'Other'
]

// What a saved category is called on screen. The stored value never changes
// (old records keep it); only the words people read do.
const CATEGORY_LABEL = { compund: 'Compounds & fines' }
export const categoryLabel = c => CATEGORY_LABEL[c] || c

export const BACK_OFFICE_METHODS = [
  { value: 'card', label: 'Card' },
  { value: 'qr', label: 'QR' },
  { value: 'online', label: 'Online' },
  { value: 'bank_transfer', label: 'Bank Transfer' }
]

export const DESCRIPTION_CHIPS = [
  { key: 'invoice', text: '- Invoice No: ' },
  { key: 'vendor', text: '- Vendor: ' },
  { key: 'period', text: '- Period: ' },
  { key: 'reason', text: '- Reason: ' },
  { key: 'approved', text: '- Approved by: ' }
]
