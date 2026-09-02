import React from 'react';
import { AlertCircle, CheckCircle, LogOut, Package } from 'lucide-react';

export interface InventoryStats {
  total: number;
  available: number;
  checkedOut: number;
  needsAction: number;
}

interface InventoryStatsStripProps {
  stats: InventoryStats;
}

export const InventoryStatsStrip: React.FC<InventoryStatsStripProps> = ({ stats }) => {
  const rows = [
    { label: 'Total Assets',  value: stats.total,       icon: <Package      className="w-4 h-4 text-blue-500" />,    c: 'text-blue-700' },
    { label: 'Available',     value: stats.available,   icon: <CheckCircle  className="w-4 h-4 text-emerald-500" />, c: 'text-emerald-700' },
    { label: 'Checked Out',   value: stats.checkedOut,  icon: <LogOut       className="w-4 h-4 text-amber-500" />,   c: 'text-amber-700' },
    { label: 'Action Needed', value: stats.needsAction, icon: <AlertCircle  className="w-4 h-4 text-red-500" />,     c: 'text-red-600' },
  ];
  return (
    <div className="rounded-xl border border-slate-100 bg-white shadow-sm px-4 py-3 space-y-1">
      {rows.map(r => (
        <div key={r.label} className="flex items-center gap-2">
          {r.icon}
          <span className="text-xs text-slate-500 flex-1">{r.label}</span>
          <span className={`text-sm font-bold tabular-nums ${r.c}`}>{r.value}</span>
        </div>
      ))}
    </div>
  );
};
