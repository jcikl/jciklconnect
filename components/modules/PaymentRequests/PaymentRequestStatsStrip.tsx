import React from 'react';
import { CheckCircle, Clock, XCircle } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatUtils';

interface PaymentRequestStatsStripProps {
  stats: {
    pendingAmount: number;
    pendingCount: number;
    approvedAmount: number;
    approvedCount: number;
    rejectedCount: number;
  };
}

export const PaymentRequestStatsStrip: React.FC<PaymentRequestStatsStripProps> = ({ stats }) => (
  <div className="flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar">
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-100 shrink-0">
      <Clock size={12} className="text-amber-500 shrink-0" />
      <span className="text-xs font-bold text-amber-600 whitespace-nowrap">{formatCurrency(stats.pendingAmount)}</span>
      <span className="text-[10px] text-amber-400">· {stats.pendingCount}</span>
    </div>
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 shrink-0">
      <CheckCircle size={12} className="text-emerald-500 shrink-0" />
      <span className="text-xs font-bold text-emerald-600 whitespace-nowrap">{formatCurrency(stats.approvedAmount)}</span>
      <span className="text-[10px] text-emerald-400">· {stats.approvedCount}</span>
    </div>
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 shrink-0">
      <XCircle size={12} className="text-slate-400 shrink-0" />
      <span className="text-xs font-bold text-slate-600">{stats.rejectedCount}</span>
    </div>
  </div>
);
