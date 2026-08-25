import React from 'react';
import type { BankAccount } from '../../../types';
import { formatCurrency } from '../../../utils/formatUtils';
import { Drawer } from '../../ui/Common';

interface MonthlyAccountSummaryItem {
  month: number;
  openingBalance: number;
  income: number;
  expenses: number;
  closingBalance: number;
}

interface FinanceAccountDetailDrawerProps {
  isOpen: boolean;
  account: BankAccount | null;
  detailYear: number;
  availableYears: number[];
  monthlyAccountSummary: MonthlyAccountSummaryItem[];
  onClose: () => void;
  onYearChange: (year: number) => void;
}

export const FinanceAccountDetailDrawer: React.FC<FinanceAccountDetailDrawerProps> = ({
  isOpen,
  account,
  detailYear,
  availableYears,
  monthlyAccountSummary,
  onClose,
  onYearChange,
}) => {
  const annualNetFlow = monthlyAccountSummary.reduce((acc, month) => acc + (month.income - month.expenses), 0);
  const yearEndPosition = monthlyAccountSummary[11]?.closingBalance || 0;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={account ? (account.bankName ? `${account.bankName} · ${account.name}` : account.name) : 'Account Details'}
      size="lg"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Monthly Performance</h4>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Reporting Year:</span>
            <select
              value={detailYear}
              onChange={(event) => onYearChange(Number(event.target.value))}
              className="text-sm border-slate-200 rounded-lg py-1.5 pl-3 pr-10 focus:ring-jci-blue focus:border-jci-blue bg-white border shadow-sm outline-none transition-all duration-200"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-hidden border border-slate-100 rounded-xl shadow-sm bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] md:text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="py-3 px-4 font-bold text-slate-700 uppercase tracking-tight">Month</th>
                  <th className="py-3 px-4 font-bold text-slate-700 uppercase tracking-tight text-right">Initial</th>
                  <th className="py-3 px-4 font-bold text-green-700 uppercase tracking-tight text-right">Income</th>
                  <th className="py-3 px-4 font-bold text-red-700 uppercase tracking-tight text-right">Expense</th>
                  <th className="py-3 px-4 font-bold text-slate-900 uppercase tracking-tight text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {monthlyAccountSummary.map((data) => (
                  <tr key={data.month} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-600">
                      {new Date(detailYear, data.month).toLocaleString('en', { month: 'short' })}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-right font-mono">
                      {formatCurrency(data.openingBalance, account?.currency)}
                    </td>
                    <td className="py-3 px-4 text-green-600 font-medium text-right font-mono">
                      {data.income > 0 ? `+${formatCurrency(data.income)}` : '\u2014'}
                    </td>
                    <td className="py-3 px-4 text-red-600 font-medium text-right font-mono">
                      {data.expenses > 0 ? `-${formatCurrency(data.expenses)}` : '\u2014'}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 text-right font-mono">
                      {formatCurrency(data.closingBalance, account?.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-jci-blue" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Annual Summary</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-0.5">Year Net Flow</p>
              <p className={`text-sm font-bold ${annualNetFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(annualNetFlow)}
              </p>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-0.5">Year-End Position</p>
              <p className="text-sm font-bold text-slate-900">
                {formatCurrency(yearEndPosition)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Drawer>
  );
};
