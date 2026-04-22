import { configureStore } from '@reduxjs/toolkit'
import { authApiSlice } from '../api/authApiSlice'
import { salesApiSlice } from '../api/salesApiSlice'
import { notificationApi } from '../api/notificationApiSlice'
import { branchApiSlice } from '../api/branchApiSlice'
import { costApiSlice } from '../api/costApiSlice'
import { depositApiSlice } from '../api/depositApiSlice'
import { advanceApiSlice } from '../api/AdvanceApiSlice'
import { loanApiSlice } from '../api/loanApiSlice'
import { salaryApiSlice } from '../api/salaryApiSlice'
import { cashWithdrawApiSlice } from '../api/cashWithdrawApiSlice'
import { branchSettingsApi } from '../api/branchSettingsApiSlice'
import { vendorsApiSlice } from '../api/vendorsApiSlice'
import { vendorBillsApiSlice } from '../api/vendorBillsApiSlice'
import { vendorPaymentsApiSlice } from '../api/vendorPaymentsApiSlice'
import { staffApiSlice } from '../api/staffApiSlice'
import { salarySheetApiSlice } from '../api/salarySheetApiSlice'
import { staffLoanApiSlice } from '../api/staffLoanApiSlice'
import { auditApiSlice } from '../api/auditApiSlice'
import { payrollRunApiSlice } from '../api/payrollRunApiSlice'
import { feedsApiSlice } from '../api/feedsApiSlice'
import { chatApiSlice } from '../api/chatApiSlice'
import { attendanceApiSlice } from '../api/attendanceApiSlice'
import { summaryApiSlice } from '../api/summaryApiSlice'
import { itemsApiSlice } from '../api/itemsApiSlice'
import { requisitionsApiSlice } from '../api/requisitionsApiSlice'

export default configureStore({
  reducer: {
    authApi: authApiSlice.reducer,
    salesApi: salesApiSlice.reducer,
    costApiSlice: costApiSlice.reducer,
    depositApiSlice: depositApiSlice.reducer,
    notificationApi: notificationApi.reducer,
    branchApi: branchApiSlice.reducer,
    advanceApiSlice: advanceApiSlice.reducer,
    loanApiSlice: loanApiSlice.reducer,
    salaryApiSlice: salaryApiSlice.reducer,
    cashWithdrawApi: cashWithdrawApiSlice.reducer,
    branchSettingsApi: branchSettingsApi.reducer,
    vendorsApiSlice: vendorsApiSlice.reducer,
    vendorBillsApiSlice: vendorBillsApiSlice.reducer,
    vendorPaymentsApiSlice: vendorPaymentsApiSlice.reducer,
    staffApiSlice: staffApiSlice.reducer,
    salarySheetApiSlice: salarySheetApiSlice.reducer,
    staffLoanApiSlice: staffLoanApiSlice.reducer,
    auditApiSlice: auditApiSlice.reducer,
    payrollRunApiSlice: payrollRunApiSlice.reducer,
    feedsApi: feedsApiSlice.reducer,
    chatApi: chatApiSlice.reducer,
    attendanceApi: attendanceApiSlice.reducer,
    summaryApi: summaryApiSlice.reducer,
    itemsApiSlice: itemsApiSlice.reducer,
    requisitionsApiSlice: requisitionsApiSlice.reducer,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: false
    })
      .concat(authApiSlice.middleware)
      .concat(salesApiSlice.middleware)
      .concat(notificationApi.middleware)
      .concat(branchApiSlice.middleware)
      .concat(costApiSlice.middleware)
      .concat(depositApiSlice.middleware)
      .concat(advanceApiSlice.middleware)
      .concat(loanApiSlice.middleware)
      .concat(salaryApiSlice.middleware)
      .concat(cashWithdrawApiSlice.middleware)
      .concat(branchSettingsApi.middleware)
      .concat(vendorsApiSlice.middleware)
      .concat(vendorBillsApiSlice.middleware)
      .concat(vendorPaymentsApiSlice.middleware)
      .concat(staffApiSlice.middleware)
      .concat(salarySheetApiSlice.middleware)
      .concat(staffLoanApiSlice.middleware)
      .concat(auditApiSlice.middleware)
      .concat(payrollRunApiSlice.middleware)
      .concat(feedsApiSlice.middleware)
      .concat(chatApiSlice.middleware)
      .concat(attendanceApiSlice.middleware)
      .concat(summaryApiSlice.middleware)
      .concat(itemsApiSlice.middleware)
      .concat(requisitionsApiSlice.middleware)
})
