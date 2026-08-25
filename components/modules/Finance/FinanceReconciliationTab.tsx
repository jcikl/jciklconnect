import React from 'react';
import { CheckCircle, Link2, RefreshCw, Search } from 'lucide-react';
import type { PaymentRequest, Transaction } from '../../../types';
import { formatDate } from '../../../utils/dateUtils';
import { formatCurrency } from '../../../utils/formatUtils';
import { FirstUseBanner } from '../../ui/FirstUseBanner';
import { Badge, Button } from '../../ui/Common';
import { Input } from '../../ui/Form';
import { LoadingState } from '../../ui/Loading';

interface FinanceReconciliationTabProps {
  canOperateFinance: boolean;
  refNumberQuery: string;
  reconciliationTx: Transaction[];
  reconciliationPRs: PaymentRequest[];
  reconciliationLoading: boolean;
  reconcilingId: string | null;
  prPendingReconciliation: PaymentRequest[];
  prReconcileLoading: boolean;
  prBankSuggestions: Record<string, Transaction[]>;
  prSelectedBankTx: Record<string, string>;
  prLinkingId: string | null;
  transactions: Transaction[];
  onRunEventAutoMatch: () => void;
  onRefreshPrReconciliation: () => void;
  onRefNumberQueryChange: (query: string) => void;
  onReconciliationQuery: () => void;
  onSelectPrBankTx: (paymentRequestId: string, transactionId: string) => void;
  onLinkPrToBankTx: (paymentRequestId: string) => void;
  onMarkReconciled: (transactionId: string) => void;
  onHelpClick?: () => void;
}

export const FinanceReconciliationTab: React.FC<FinanceReconciliationTabProps> = ({
  canOperateFinance,
  refNumberQuery,
  reconciliationTx,
  reconciliationPRs,
  reconciliationLoading,
  reconcilingId,
  prPendingReconciliation,
  prReconcileLoading,
  prBankSuggestions,
  prSelectedBankTx,
  prLinkingId,
  transactions,
  onRunEventAutoMatch,
  onRefreshPrReconciliation,
  onRefNumberQueryChange,
  onReconciliationQuery,
  onSelectPrBankTx,
  onLinkPrToBankTx,
  onMarkReconciled,
  onHelpClick,
}) => (
  <div className="space-y-4">
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-slate-800">Event income auto-match</h3>
        <p className="text-[11px] text-slate-400">Match Pending event ticket income transactions against imported bank transactions</p>
      </div>
      <Button size="sm" variant="outline" className="shrink-0" onClick={onRunEventAutoMatch}>
        Run auto-match
      </Button>
    </div>

    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
            <Link2 size={14} className="text-amber-600" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-800">Payment Request Reconciliation</h3>
            <p className="text-[11px] text-slate-400 hidden sm:block">Match approved PRs to bank import transactions</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!prReconcileLoading && prPendingReconciliation.length > 0 && (
            <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">{prPendingReconciliation.length} pending</span>
          )}
          <button onClick={onRefreshPrReconciliation} disabled={prReconcileLoading} aria-label="Refresh reconciliation list" className="p-2.5 rounded-lg text-slate-400 hover:text-jci-blue hover:bg-blue-50 transition-colors">
            <RefreshCw size={14} aria-hidden="true" className={prReconcileLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="p-4">
        {prReconcileLoading ? (
          <LoadingState loading>{null}</LoadingState>
        ) : prPendingReconciliation.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <div className="w-10 h-10 rounded-full bg-green-50 border border-green-200 flex items-center justify-center">
              <CheckCircle size={18} className="text-green-500" />
            </div>
            <p className="text-sm font-semibold text-slate-700">All caught up!</p>
            <p className="text-xs text-slate-400">All approved Payment Requests have been reconciled.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {prPendingReconciliation.map(paymentRequest => {
              const suggestions = prBankSuggestions[paymentRequest.id] || [];
              const selectedId = prSelectedBankTx[paymentRequest.id] ?? '';
              const bankExpenses = transactions.filter(transaction => transaction.source === 'bank_import' && transaction.type === 'Expense' && transaction.status !== 'Reconciled');
              const hasSuggestion = suggestions.length > 0;

              return (
                <div key={paymentRequest.id} className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="relative flex items-start gap-3 px-4 py-3 bg-white">
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${hasSuggestion ? 'bg-green-400' : 'bg-amber-400'}`} />
                    <div className="flex-1 min-w-0 pl-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                          <Badge variant="warning" className="text-[10px] shrink-0">PR</Badge>
                          <span className="text-[11px] text-slate-400 font-mono truncate">{paymentRequest.referenceNumber}</span>
                        </div>
                        <span className="text-sm font-bold text-rose-600 shrink-0">{formatCurrency(paymentRequest.totalAmount || paymentRequest.amount)}</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-800 leading-snug truncate">{paymentRequest.purpose || paymentRequest.items?.[0]?.purpose || '\u2014'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-slate-400">{formatDate(paymentRequest.date)}</span>
                        {hasSuggestion && (
                          <span className="text-[10px] font-semibold text-green-600 bg-green-50 border border-green-200 rounded px-1.5 py-0.5 shrink-0">{suggestions.length} suggestion{suggestions.length > 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 px-4 pb-3 pt-2.5 bg-slate-50/60 space-y-2.5">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Select bank transaction</p>
                    <select
                      value={selectedId}
                      onChange={event => onSelectPrBankTx(paymentRequest.id, event.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-jci-blue/30 focus:border-jci-blue"
                    >
                      <option value="">— select bank transaction —</option>
                      {hasSuggestion && (
                        <optgroup label={`Suggested (same amount, \u00b114 days)`}>
                          {suggestions.map(transaction => (
                            <option key={transaction.id} value={transaction.id}>
                              {`\u2713 ${formatDate(transaction.date)} \u00b7 ${transaction.description} \u00b7 ${formatCurrency(transaction.amount)}`}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {bankExpenses.filter(transaction => !suggestions.find(suggestion => suggestion.id === transaction.id)).length > 0 && (
                        <optgroup label="Other bank expenses">
                          {bankExpenses.filter(transaction => !suggestions.find(suggestion => suggestion.id === transaction.id)).map(transaction => (
                            <option key={transaction.id} value={transaction.id}>
                              {`${formatDate(transaction.date)} \u00b7 ${transaction.description} \u00b7 ${formatCurrency(transaction.amount)}`}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <Button
                      size="sm"
                      onClick={() => onLinkPrToBankTx(paymentRequest.id)}
                      disabled={!canOperateFinance || !selectedId || prLinkingId === paymentRequest.id}
                      className="w-full"
                    >
                      <Link2 size={13} className="mr-1.5" />
                      {prLinkingId === paymentRequest.id ? 'Linking...' : 'Confirm Match'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>

    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3 border-b border-slate-100">
        <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
          <Search size={14} className="text-blue-500" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-800">Reconcile by Reference Number</h3>
          <p className="text-[11px] text-slate-400 hidden sm:block">Search transactions and PRs by reference number</p>
        </div>
      </div>

      <div className="px-4 pt-3 pb-3 border-b border-slate-100 bg-slate-50/40">
        <FirstUseBanner flowId="reconciliation" dismissLabel="Got it" variant="teal" onHelpClick={onHelpClick}>
          Enter a reference number (e.g. PR-jcikl-20250216-001) to search both bank transactions and payment requests. Once verified, click "Mark Reconciled" to record the action.
        </FirstUseBanner>
        <div className="flex gap-2 mt-2">
          <Input
            placeholder="e.g. PR-jcikl-20250216-001"
            value={refNumberQuery}
            onChange={(event) => onRefNumberQueryChange(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && onReconciliationQuery()}
            className="flex-1"
            aria-label="Search transactions and payment requests by reference number"
          />
          <Button onClick={onReconciliationQuery} disabled={reconciliationLoading} className="shrink-0">
            {reconciliationLoading ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
            <span className="ml-1.5 hidden sm:inline">{reconciliationLoading ? 'Searching...' : 'Search'}</span>
          </Button>
        </div>
      </div>

      <div className="p-4">
        {reconciliationLoading ? (
          <LoadingState loading>{null}</LoadingState>
        ) : reconciliationTx.length === 0 && reconciliationPRs.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">Enter a reference number above to search.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Transactions</h4>
                {reconciliationTx.length > 0 && <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 rounded-full px-1.5 py-0.5">{reconciliationTx.length}</span>}
              </div>
              <div className="space-y-2">
                {reconciliationTx.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 py-5 text-center text-xs text-slate-400">No matching transactions</div>
                ) : (
                  reconciliationTx.map(transaction => (
                    <div key={transaction.id} className="relative rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${transaction.type === 'Income' ? 'bg-green-400' : 'bg-red-400'}`} />
                      <div className="pl-4 pr-3 pt-2.5 pb-2.5">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[11px] text-slate-400">{formatDate(transaction.date)}</span>
                          <span className={`font-mono font-bold text-sm shrink-0 ${transaction.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                            {transaction.type === 'Income' ? '+' : '-'}{formatCurrency(Math.abs(transaction.amount))}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900 leading-snug truncate mb-1.5">{transaction.description}</p>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            {transaction.status === 'Reconciled'
                              ? <Badge variant="success" className="text-[10px]">Reconciled</Badge>
                              : <Badge variant="warning" className="text-[10px]">{transaction.status || 'Pending'}</Badge>
                            }
                            {transaction.referenceNumber && <span className="text-[10px] text-slate-400 font-mono truncate">{transaction.referenceNumber}</span>}
                          </div>
                          {transaction.status !== 'Reconciled' && (
                            <Button size="sm" onClick={() => onMarkReconciled(transaction.id)} disabled={!canOperateFinance || reconcilingId !== null} className="shrink-0 text-[11px] px-2 py-1">
                              {reconcilingId === transaction.id ? 'Processing...' : 'Mark Reconciled'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Payment Requests</h4>
                {reconciliationPRs.length > 0 && <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 rounded-full px-1.5 py-0.5">{reconciliationPRs.length}</span>}
              </div>
              <div className="space-y-2">
                {reconciliationPRs.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 py-5 text-center text-xs text-slate-400">No matching payment requests</div>
                ) : (
                  reconciliationPRs.map(paymentRequest => (
                    <div key={paymentRequest.id} className="relative rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${paymentRequest.status === 'approved' ? 'bg-green-400' : paymentRequest.status === 'rejected' ? 'bg-red-400' : 'bg-amber-400'}`} />
                      <div className="pl-4 pr-3 pt-2.5 pb-2.5">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[11px] text-slate-400 font-mono truncate">{paymentRequest.referenceNumber}</span>
                          <span className="font-mono font-bold text-sm shrink-0 text-slate-700">{formatCurrency(paymentRequest.totalAmount || paymentRequest.amount)}</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900 leading-snug truncate mb-1.5">{paymentRequest.purpose || '\u2014'}</p>
                        <div className="flex items-center gap-1.5">
                          <Badge variant={paymentRequest.status === 'approved' ? 'success' : paymentRequest.status === 'rejected' ? 'error' : 'warning'} className="text-[10px]">
                            {paymentRequest.status === 'approved' ? 'Approved' : paymentRequest.status === 'rejected' ? 'Rejected' : 'Pending'}
                          </Badge>
                          <span className="text-[11px] text-slate-400">{formatDate(paymentRequest.date)}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);
