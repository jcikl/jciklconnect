import React from 'react';
import type { Transaction } from '../../../types';
import { formatDate } from '../../../utils/dateUtils';
import { formatCurrency } from '../../../utils/formatUtils';
import { Badge, Button, Card } from '../../ui/Common';
import { LoadingState } from '../../ui/Loading';

interface FinanceRecentTransactionsCardProps {
  transactions: Transaction[];
  loading: boolean;
  error?: string | null;
  onViewAll: () => void;
}

export const FinanceRecentTransactionsCard: React.FC<FinanceRecentTransactionsCardProps> = ({
  transactions,
  loading,
  error,
  onViewAll,
}) => (
  <Card
    title="Recent Transactions"
    action={
      <Button
        variant="ghost"
        size="sm"
        onClick={onViewAll}
      >
        View All
      </Button>
    }
  >
    <LoadingState loading={loading} error={error} empty={transactions.length === 0} emptyMessage="No transactions found">
      <>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="pb-3 font-semibold pl-2">Date</th>
                <th className="pb-3 font-semibold">Description</th>
                <th className="pb-3 font-semibold">Category</th>
                <th className="pb-3 font-semibold text-right pr-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.slice(0, 10).map(tx => (
                <tr key={tx.id} className="hover:bg-slate-50">
                  <td className="py-3 pl-2 text-slate-500">{formatDate(tx.date)}</td>
                  <td className="py-3 font-medium text-slate-900">
                    {tx.description}
                    {tx.status === 'Pending' && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-amber-400"></span>}
                  </td>
                  <td className="py-3">
                    <Badge variant="neutral">{tx.category}</Badge>
                  </td>
                  <td className={`py-3 text-right pr-2 font-mono font-medium ${tx.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.type === 'Income' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-2">
          {transactions.slice(0, 8).map(tx => (
            <div key={tx.id} className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm flex">
              <div className={`w-1 shrink-0 ${tx.type === 'Income' ? 'bg-green-400' : 'bg-red-400'}`} />
              <div className="flex-1 px-3 py-2.5">
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-[11px] text-slate-400">{formatDate(tx.date)}</span>
                  <span className={`font-mono font-bold text-sm shrink-0 ${tx.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.type === 'Income' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-900 leading-snug mt-0.5 truncate">{tx.description}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge variant="neutral" className="text-[10px] py-0">{tx.category}</Badge>
                  {tx.status === 'Pending' && <span className="text-[10px] text-amber-500 font-medium">Pending</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </>
    </LoadingState>
  </Card>
);
