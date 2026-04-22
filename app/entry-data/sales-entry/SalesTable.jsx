/* eslint-disable react/prop-types */
import React from "react";
import { format } from "date-fns";
import RowActions from "@/app/components/common/RowActions";
import Link from "next/link";
import { SkeletonTable } from "@/app/components/common/Skeleton";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/utils/formatMoney";

export default function SalesTable({ 
  sales, 
  loading, 
  error, 
  onEdit, 
  canEdit, 
  role,
  onView 
}) {
  if (loading) return (
    <div className="mt-6">
      <SkeletonTable rows={5} cols={canEdit ? 5 : 4} />
    </div>
  );
  if (error) return <div className="p-4 text-center text-red-500">Failed to load sales.</div>;
  if (!sales || sales.length === 0) return <div className="p-4 text-center text-gray-400">No recent sales found.</div>;

  const currency = useCurrency();
  const fmt = (v) => formatMoney(v, currency);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mt-6">
      <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
        <h3 className="font-bold text-gray-700">Recent Entries</h3>
        <Link href="/reports/sales-report" className="text-xs font-medium text-mint-600 hover:text-mint-700">
          View All History →
        </Link>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
            <tr>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">Total</th>
              <th className="px-6 py-3">Proof</th>
              <th className="px-6 py-3">User</th>
              {canEdit && <th className="px-6 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
             {sales.map((sale, index) => {
               const isSupervisor = role === "supervisor";
               // Supervisor can only edit the very last (first in sorted list) report
               const showEdit = isSupervisor ? index === 0 : true;

               return (
                 <tr key={sale.id} className="hover:bg-gray-50/50 transition-colors">
                   <td className="px-6 py-3 font-medium text-gray-800">
                      <button onClick={() => onView(sale)} className="hover:underline hover:text-mint-600">
                        {sale.date ? format(new Date(sale.date), "dd MMM yyyy") : "-"}
                      </button>
                   </td>
                   <td className="px-6 py-3 font-bold text-green-600">
                     {fmt(sale.total)}
                   </td>
                   <td className="px-6 py-3">
                     {sale.zReportUrl ? (
                       <a href={sale.zReportUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline text-xs">
                         View Image
                       </a>
                     ) : (
                       <span className="text-gray-300 text-xs">No Image</span>
                     )}
                   </td>
                   <td className="px-6 py-3 text-gray-500 text-xs">
                     {sale.createdBy?.username || "Unknown"}
                   </td>
                   {canEdit && (
                     <td className="px-6 py-3 text-right">
                       <RowActions
                         compact
                         onEdit={showEdit ? () => onEdit(sale) : null}
                       />
                     </td>
                   )}
                 </tr>
               );
             })}
          </tbody>
        </table>
      </div>
    </div>
  );
}