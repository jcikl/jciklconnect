import React, { useState } from 'react';
import { Pencil } from 'lucide-react';
import type { BankAccount } from '../../../types';
import { UserRole } from '../../../types';
import { formatCurrency } from '../../../utils/formatUtils';
import { FinanceService } from '../../../services/financeService';
import { usePermissions } from '../../../hooks/usePermissions';
import { Button, Drawer, useToast } from '../../ui/Common';
import { Input, Select } from '../../ui/Form';

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
  onUpdated?: () => Promise<void>;
}

const ACCOUNT_TYPE_OPTIONS = [
  { label: 'Current', value: 'Current' },
  { label: 'Savings', value: 'Savings' },
  { label: 'Investment', value: 'Investment' },
  { label: 'Fixed Deposit', value: 'Fixed Deposit' },
  { label: 'Cash', value: 'Cash' },
  { label: 'Other', value: 'Other' },
];

const CURRENCY_OPTIONS = [
  { label: 'MYR', value: 'MYR' },
  { label: 'USD', value: 'USD' },
  { label: 'SGD', value: 'SGD' },
];

export const FinanceAccountDetailDrawer: React.FC<FinanceAccountDetailDrawerProps> = ({
  isOpen,
  account,
  detailYear,
  availableYears,
  monthlyAccountSummary,
  onClose,
  onYearChange,
  onUpdated,
}) => {
  const { effectiveRole } = usePermissions();
  const isSuperAdmin = effectiveRole === UserRole.SUPER_ADMIN;
  const { showToast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const annualNetFlow = monthlyAccountSummary.reduce((acc, month) => acc + (month.income - month.expenses), 0);
  const yearEndPosition = monthlyAccountSummary[11]?.closingBalance || 0;

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!account) return;
    const formData = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await FinanceService.updateBankAccount(account.id, {
        bankName: formData.get('bankName') as string,
        name: formData.get('name') as string,
        accountType: formData.get('accountType') as BankAccount['accountType'],
        accountNumber: formData.get('accountNumber') as string,
        initialBalance: parseFloat(formData.get('initialBalance') as string) || 0,
        currency: formData.get('currency') as string,
      });
      showToast('Bank account updated', 'success');
      setIsEditing(false);
      await onUpdated?.();
    } catch {
      showToast('Failed to update bank account', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={() => { setIsEditing(false); onClose(); }}
      title={account ? (account.bankName ? `${account.bankName} · ${account.name}` : account.name) : 'Account Details'}
      action={isSuperAdmin && account && !isEditing ? (
        <button
          onClick={() => setIsEditing(true)}
          className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          title="Edit account"
        >
          <Pencil size={14} />
        </button>
      ) : undefined}
      size="lg"
    >
      {isEditing && account ? (
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <h4 className="text-sm font-semibold text-slate-900 mb-2">Edit Account Details</h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input name="bankName" label="Bank" defaultValue={account.bankName || ''} placeholder="e.g. Maybank, CIMB" />
            <Input name="name" label="Account Name" defaultValue={account.name} placeholder="e.g. Main Operating Account" required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              name="accountType"
              label="Account Type"
              defaultValue={account.accountType || 'Current'}
              options={ACCOUNT_TYPE_OPTIONS}
            />
            <Input
              name="accountNumber"
              label="Account Number"
              defaultValue={account.accountNumber || ''}
              placeholder="e.g. 1234567890"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              onChange={(e: any) => { e.target.value = e.target.value.replace(/[^0-9]/g, ''); }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              name="initialBalance"
              label="Initial Balance"
              type="number"
              step="0.01"
              defaultValue={account.initialBalance ?? 0}
              placeholder="0.00"
              required
            />
            <Select
              name="currency"
              label="Currency"
              defaultValue={account.currency || 'MYR'}
              options={CURRENCY_OPTIONS}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsEditing(false)} disabled={saving} className="flex-none">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      ) : (
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
                        {data.income > 0 ? `+${formatCurrency(data.income)}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-red-600 font-medium text-right font-mono">
                        {data.expenses > 0 ? `-${formatCurrency(data.expenses)}` : '—'}
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
      )}
    </Drawer>
  );
};
