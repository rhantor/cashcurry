'use client'

import { fmtAmt, periodLabel } from '@/utils/payrollCalculations'

const PreviewRow = ({ label, val, bold, red }) => (
  <div className={`flex justify-between ${bold?'font-bold':''} ${red?'text-red-600':'text-gray-700'}`}>
    <span className='text-gray-500'>{label}</span>
    <span>{val}</span>
  </div>
)

export function ScreenPreviewSingle ({ slip, period, branchName }) {
  return (
    <div className='bg-white rounded-xl border border-gray-200 p-5 text-xs space-y-3'>
      <div className='flex justify-between items-start pb-2 border-b'>
        <div>
          <p className='font-bold text-sm text-gray-900'>{branchName}</p>
          <p className='text-gray-400 text-[10px] uppercase tracking-wide'>Salary Slip · {periodLabel(period)}</p>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${slip.status==='paid'?'bg-green-100 text-green-700':slip.status==='finalized'?'bg-blue-100 text-blue-700':'bg-yellow-100 text-yellow-700'}`}>{slip.status||'draft'}</span>
      </div>
      <div className='font-semibold text-gray-800 text-sm'>{slip.staffName}</div>
      <div className='grid grid-cols-2 gap-x-4 gap-y-1'>
        <PreviewRow label='Basic/Rate'   val={`${fmtAmt(slip.basicSalary)} / ${fmtAmt(slip.salaryMode==='hours' ? (slip.basicSalary/(slip.standardHours||208)) : (slip.basicSalary/(slip.workingDays||26)))}`} />
        <PreviewRow label='Earned Basic' val={fmtAmt(slip.basePay)} />
        {slip.allowance>0    &&<PreviewRow label='Allowance'   val={fmtAmt(slip.allowance)} />}
        {slip.otPay>0        &&<PreviewRow label='OT Pay'      val={fmtAmt(slip.otPay)} />}
        {slip.phPay>0        &&<PreviewRow label='PH Pay'      val={fmtAmt(slip.phPay)} />}
        {slip.otherEarnings>0&&<PreviewRow label='Other Earn.' val={fmtAmt(slip.otherEarnings)} />}
        <PreviewRow label='Gross' val={fmtAmt(slip.grossEarnings)} bold />
        {(slip.statutory||[]).map(s=><PreviewRow key={s.key} label={s.name} val={`- ${fmtAmt(s.employeeAmt)}`} red />)}
        {slip.advanceAmt>0   &&<PreviewRow label='Advance'    val={`- ${fmtAmt(slip.advanceAmt)}`} red />}
        {slip.loanAmt>0      &&<PreviewRow label='Loan EMI'   val={`- ${fmtAmt(slip.loanAmt)}`} red />}
        {slip.otherDeductions>0&&<PreviewRow label='Other Ded.' val={`- ${fmtAmt(slip.otherDeductions)}`} red />}
      </div>
      <div className='flex justify-between items-center border-2 border-gray-900 rounded-xl px-4 py-3'>
        <span className='font-semibold text-xs'>Net Pay</span>
        <span className='text-lg font-extrabold'>RM {fmtAmt(slip.netPay)}</span>
      </div>
    </div>
  )
}

export function ScreenPreviewAll ({ slips, period, branchName, status }) {
  const totals = slips.reduce((a,s)=>({
    basePay:a.basePay+(s.basePay||0), gross:a.gross+(s.grossEarnings||0), ded:a.ded+(s.totalDeductions||0), net:a.net+(s.netPay||0),
    allowance:a.allowance+(s.allowance||0), otPay:a.otPay+(s.otPay||0), phPay:a.phPay+(s.phPay||0), bonus:a.bonus+(s.bonus||0),
    otherEarnings:a.otherEarnings+(s.otherEarnings||0), advanceAmt:a.advanceAmt+(s.advanceAmt||0), loanAmt:a.loanAmt+(s.loanAmt||0),
    penalty:a.penalty+(s.penalty||0), otherDeductions:a.otherDeductions+(s.otherDeductions||0),
  }),{basePay:0,gross:0,ded:0,net:0,allowance:0,otPay:0,phPay:0,bonus:0,otherEarnings:0,advanceAmt:0,loanAmt:0,penalty:0,otherDeductions:0})
  const showAllowance=totals.allowance>0, showOT=totals.otPay>0, showPH=totals.phPay>0, showBonus=totals.bonus>0, showOtherE=totals.otherEarnings>0
  const showAdvance=totals.advanceAmt>0, showLoan=totals.loanAmt>0, showPenalty=totals.penalty>0, showOtherD=totals.otherDeductions>0
  return (
    <div className='bg-white rounded-xl border border-gray-200 overflow-hidden text-xs'>
      <div className='flex justify-between items-center px-4 py-3 border-b'>
        <div>
          <p className='font-bold text-sm text-gray-900'>{branchName}</p>
          <p className='text-gray-400 text-[10px]'>Payroll · {periodLabel(period)} · <span className='capitalize'>{status}</span></p>
        </div>
        <p className='text-gray-500'>{slips.length} staff</p>
      </div>
      <table className='w-full'>
        <thead className='bg-gray-50 text-gray-500 uppercase text-[9px] tracking-wide'>
          <tr>
            <th className='px-3 py-2 text-left'>Employee</th>
            <th className='px-3 py-2 text-right'>Basic/Rate</th>
            <th className='px-3 py-2 text-right'>Earned</th>
            {showAllowance&&<th className='px-3 py-2 text-right'>Allowance</th>}
            {showOT&&<th className='px-3 py-2 text-right'>OT</th>}
            {showPH&&<th className='px-3 py-2 text-right'>PH</th>}
            {showBonus&&<th className='px-3 py-2 text-right'>Bonus</th>}
            {showOtherE&&<th className='px-3 py-2 text-right'>Other</th>}
            {showAdvance&&<th className='px-3 py-2 text-right'>Advance</th>}
            {showLoan&&<th className='px-3 py-2 text-right'>Loan</th>}
            {showPenalty&&<th className='px-3 py-2 text-right'>Penalty</th>}
            {showOtherD&&<th className='px-3 py-2 text-right'>Deduction</th>}
            <th className='px-3 py-2 text-right font-semibold text-gray-700'>Gross</th>
            <th className='px-3 py-2 text-right'>Total Ded.</th>
            <th className='px-3 py-2 text-right font-bold'>Net Pay</th>
          </tr>
        </thead>
        <tbody className='divide-y divide-gray-100'>
          {slips.map((s,i)=>(
            <tr key={s.staffId||i} className='hover:bg-gray-50'>
              <td className='px-3 py-2 font-medium'>{s.staffName}</td>
              <td className='px-3 py-2 text-right text-gray-500 text-[10px]'>{fmtAmt(s.basicSalary)} / {fmtAmt(s.salaryMode==='hours' ? (s.basicSalary/(s.standardHours||208)) : (s.basicSalary/(s.workingDays||26)))}</td>
              <td className='px-3 py-2 text-right text-gray-600'>{fmtAmt(s.basePay)}</td>
              {showAllowance&&<td className='px-3 py-2 text-right text-gray-600'>{fmtAmt(s.allowance||0)}</td>}
              {showOT&&<td className='px-3 py-2 text-right text-gray-600'>{fmtAmt(s.otPay||0)}</td>}
              {showPH&&<td className='px-3 py-2 text-right text-gray-600'>{fmtAmt(s.phPay||0)}</td>}
              {showBonus&&<td className='px-3 py-2 text-right text-green-600'>{fmtAmt(s.bonus||0)}</td>}
              {showOtherE&&<td className='px-3 py-2 text-right text-gray-600'>{fmtAmt(s.otherEarnings||0)}</td>}
              {showAdvance&&<td className='px-3 py-2 text-right text-red-600'>{fmtAmt(s.advanceAmt||0)}</td>}
              {showLoan&&<td className='px-3 py-2 text-right text-red-600'>{fmtAmt(s.loanAmt||0)}</td>}
              {showPenalty&&<td className='px-3 py-2 text-right text-red-600'>{fmtAmt(s.penalty||0)}</td>}
              {showOtherD&&<td className='px-3 py-2 text-right text-red-600'>{fmtAmt(s.otherDeductions||0)}</td>}
              <td className='px-3 py-2 text-right font-semibold'>{fmtAmt(s.grossEarnings)}</td>
              <td className='px-3 py-2 text-right text-red-600'>{fmtAmt(s.totalDeductions)}</td>
              <td className='px-3 py-2 text-right font-bold text-green-700'>{fmtAmt(s.netPay)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className='border-t-2 border-gray-300 bg-gray-50'>
          <tr>
            <td className='px-3 py-2 font-bold'>Total ({slips.length})</td>
            <td className='px-3 py-2 text-right'></td>
            <td className='px-3 py-2 text-right font-semibold'>{fmtAmt(totals.basePay)}</td>
            {showAllowance&&<td className='px-3 py-2 text-right'>{fmtAmt(totals.allowance)}</td>}
            {showOT&&<td className='px-3 py-2 text-right'>{fmtAmt(totals.otPay)}</td>}
            {showPH&&<td className='px-3 py-2 text-right'>{fmtAmt(totals.phPay)}</td>}
            {showBonus&&<td className='px-3 py-2 text-right'>{fmtAmt(totals.bonus)}</td>}
            {showOtherE&&<td className='px-3 py-2 text-right'>{fmtAmt(totals.otherEarnings)}</td>}
            {showAdvance&&<td className='px-3 py-2 text-right'>{fmtAmt(totals.advanceAmt)}</td>}
            {showLoan&&<td className='px-3 py-2 text-right'>{fmtAmt(totals.loanAmt)}</td>}
            {showPenalty&&<td className='px-3 py-2 text-right'>{fmtAmt(totals.penalty)}</td>}
            {showOtherD&&<td className='px-3 py-2 text-right'>{fmtAmt(totals.otherDeductions)}</td>}
            <td className='px-3 py-2 text-right font-bold'>{fmtAmt(totals.gross)}</td>
            <td className='px-3 py-2 text-right text-red-600 font-semibold'>{fmtAmt(totals.ded)}</td>
            <td className='px-3 py-2 text-right font-bold text-green-700'>{fmtAmt(totals.net)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
