import React from 'react';
import { CheckCircle, Plus } from 'lucide-react';
import type { BankAccount } from '../../../types';
import { formatDate } from '../../../utils/dateUtils';
import { formatCurrency } from '../../../utils/formatUtils';
import { Button, Card } from '../../ui/Common';

interface FinanceBankAccountsCardProps {
  accounts: BankAccount[];
  canOperateFinance: boolean;
  onAddAccount: () => void;
  onOpenAccount: (account: BankAccount) => void;
  onMatchAccount: (account: BankAccount) => void;
}

export const FinanceBankAccountsCard: React.FC<FinanceBankAccountsCardProps> = ({
  accounts,
  canOperateFinance,
  onAddAccount,
  onOpenAccount,
  onMatchAccount,
}) => (
  <Card title="Bank Accounts" action={canOperateFinance ? (
    <Button variant="ghost" size="sm" onClick={onAddAccount}>
      <Plus size={14} className="mr-1" /> Add
    </Button>
  ) : undefined}>
    {accounts.length === 0 ? (
      <p className="text-sm text-slate-500 text-center py-4">No bank accounts configured</p>
    ) : (
      <>
        <div className="md:hidden flex gap-2.5 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
          {accounts.map(acc => (
            <div
              key={acc.id}
              className="shrink-0 w-52 p-3 rounded-xl border border-slate-200 bg-slate-50 hover:border-jci-blue/40 hover:bg-blue-50/30 transition-all cursor-pointer"
              onClick={() => onOpenAccount(acc)}
            >
              <div className="flex items-start justify-between gap-1 mb-1">
                <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider truncate leading-tight">
                  {acc.bankName ? `${acc.bankName} · ` : ''}{acc.name}
                </p>
                {acc.accountNumber && (
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">···{acc.accountNumber.slice(-4)}</span>
                )}
              </div>
              <p className="text-base font-bold text-slate-900 tabular-nums">{formatCurrency(acc.balance, acc.currency)}</p>
              <div className="flex items-center justify-between mt-1.5">
                <div className="flex items-center gap-1">
                  <CheckCircle size={10} className="text-green-500 shrink-0" />
                  <span className="text-[10px] text-slate-400">{formatDate(acc.lastReconciled)}</span>
                </div>
                <button className="text-[10px] text-blue-500 hover:text-blue-700 font-medium" onClick={e => { e.stopPropagation(); onMatchAccount(acc); }}>Match</button>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden md:block space-y-2">
          {accounts.map(acc => (
            <div
              key={acc.id}
              className="p-3 rounded-lg border border-slate-100 bg-slate-50 hover:border-jci-blue/40 hover:bg-blue-50/30 transition-all cursor-pointer"
              onClick={() => onOpenAccount(acc)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] text-slate-400 uppercase font-semibold tracking-wider truncate">
                    {acc.bankName ? `${acc.bankName} · ` : ''}{acc.name}
                  </p>
                  <p className="text-base font-bold text-slate-900 mt-0.5 tabular-nums">{formatCurrency(acc.balance, acc.currency)}</p>
                </div>
                {acc.accountNumber && (
                  <span className="text-[11px] text-slate-400 font-mono shrink-0 mt-1">···{acc.accountNumber.slice(-4)}</span>
                )}
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <div className="flex items-center gap-1">
                  <CheckCircle size={11} className="text-green-500 shrink-0" />
                  <span className="text-[10px] text-slate-400">Reconciled {formatDate(acc.lastReconciled)}</span>
                </div>
                {canOperateFinance && (
                  <button className="text-[10px] text-blue-500 hover:text-blue-700 font-medium" onClick={e => { e.stopPropagation(); onMatchAccount(acc); }}>Match txs</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </>
    )}
  </Card>
);
