import React from 'react';
import { Building2, CheckCircle, Eye, FileText, Paperclip, RefreshCw, Sparkles, Trash2, XCircle } from 'lucide-react';
import { Button } from '../../ui/Common';
import type { BankAccount, PaymentRequest, Project } from '../../../types';
import { formatCurrency } from '../../../utils/formatUtils';
import { CopyButton, PaymentRequestStatusBadge } from './paymentRequestUi';

interface FinancePaymentRequestsPanelProps {
  loading: boolean;
  financeListError: string | null;
  requests: PaymentRequest[];
  projects: Project[];
  bankAccounts: BankAccount[];
  financeListLimit: number;
  expandedId: string | null;
  actioningId: string | null;
  canSeeBankDetails: boolean;
  isApprover: boolean;
  isAdmin: boolean;
  isDeveloper: boolean;
  listSkeleton: React.ReactNode;
  onRetry: () => void;
  onToggleExpanded: (id: string) => void;
  onPreviewPDF: (request: PaymentRequest) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRetryExpenseTx: (id: string) => void;
  onDelete: (id: string) => void;
  onLoadMore: () => void;
}

export const FinancePaymentRequestsPanel: React.FC<FinancePaymentRequestsPanelProps> = ({
  loading,
  financeListError,
  requests,
  projects,
  bankAccounts,
  financeListLimit,
  expandedId,
  actioningId,
  canSeeBankDetails,
  isApprover,
  isAdmin,
  isDeveloper,
  listSkeleton,
  onRetry,
  onToggleExpanded,
  onPreviewPDF,
  onApprove,
  onReject,
  onRetryExpenseTx,
  onDelete,
  onLoadMore,
}) => {
  if (loading) return <>{listSkeleton}</>;

  if (financeListError) {
    return (
      <div className="text-center py-14 bg-red-50 rounded-xl border border-dashed border-red-200">
        <RefreshCw className="mx-auto text-red-300 mb-3" size={36} />
        <p className="text-slate-600 font-semibold">Could not load applications</p>
        <p className="text-slate-400 text-sm mt-1">{financeListError}</p>
        <Button variant="ghost" size="sm" onClick={onRetry} className="mt-3 text-red-600 hover:bg-red-100">
          <RefreshCw size={14} className="mr-1" /> Retry
        </Button>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-14 bg-slate-50 rounded-xl border border-dashed border-slate-200">
        <FileText className="mx-auto text-slate-300 mb-3" size={36} />
        <p className="text-slate-600 font-semibold">No applications found</p>
        <p className="text-slate-400 text-sm mt-1">Try adjusting your status filter</p>
      </div>
    );
  }

  const visibleRequests = requests.slice(0, financeListLimit);
  const remainingCount = requests.length - financeListLimit;

  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-2 px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-px whitespace-nowrap">Reference</th>
              <th className="text-left py-2 px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Applicant / Project</th>
              <th className="text-right py-2 px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-px whitespace-nowrap">Amount</th>
              <th className="text-right py-2 px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-px whitespace-nowrap">Date</th>
              <th className="text-right py-2 px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-px whitespace-nowrap">Status / Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {visibleRequests.map((request) => (
              <React.Fragment key={request.id}>
                <tr
                  className={`group hover:bg-slate-50/80 transition-colors cursor-pointer ${expandedId === request.id ? 'bg-sky-50/40' : ''}`}
                  onClick={() => onToggleExpanded(request.id)}
                >
                  <td className="py-3 px-2 w-px whitespace-nowrap">
                    <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{request.referenceNumber}</span>
                  </td>
                  <td className="py-3 px-2">
                    <p className="font-medium text-slate-800 truncate">{request.applicantName || '"'}</p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate flex items-center gap-1">
                      {request.category === 'administrative'
                        ? <><Building2 size={11} />{request.activityId || '"'}</>
                        : <><Sparkles size={11} className="text-orange-400" />{projects.find(p => p.id === request.activityId)?.name || request.activityRef || '"'}</>
                      }
                    </p>
                  </td>
                  <td className="py-3 px-2 text-right font-bold text-jci-blue whitespace-nowrap w-px">{formatCurrency(request.totalAmount || request.amount)}</td>
                  <td className="py-3 px-2 text-right text-xs text-slate-500 whitespace-nowrap w-px">{new Date(request.createdAt).toLocaleDateString()}</td>
                  <td className="py-3 px-2 w-px">
                    <div className="flex items-center gap-1.5 justify-end">
                      <PaymentRequestStatusBadge status={request.status} />
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); onPreviewPDF(request); }} title="View PDF">
                          <Eye size={13} />
                        </Button>
                        {request.status === 'submitted' && (isApprover || isAdmin) && (
                          <>
                            <Button size="sm" variant="success" onClick={(e) => { e.stopPropagation(); onApprove(request.id); }} disabled={actioningId !== null} title="Approve">
                              <CheckCircle size={13} />
                            </Button>
                            <Button size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); onReject(request.id); }} disabled={actioningId !== null} title="Reject">
                              <XCircle size={13} />
                            </Button>
                          </>
                        )}
                        {request.status === 'approved' && request.expenseTxFailed && (
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onRetryExpenseTx(request.id); }} disabled={actioningId !== null} title="Retry creating expense transaction" className="text-orange-600 border-orange-300 hover:bg-orange-50 text-[10px]">
                            <RefreshCw size={11} className="mr-1" />Retry Tx
                          </Button>
                        )}
                        {request.status === 'cancelled' && request.expenseTxFailed && (
                          <span title="Expense transaction could not be deleted — finance must void it manually" className="inline-flex items-center gap-1 text-[10px] font-medium text-orange-600 border border-orange-300 rounded px-1.5 py-0.5 bg-orange-50">
                            <RefreshCw size={10} />Orphan Tx
                          </span>
                        )}
                        {request.amountSyncFailed && (
                          <span title="PR amount changed but expense transaction amount is out of sync — finance must update manually" className="inline-flex items-center gap-1 text-[10px] font-medium text-yellow-700 border border-yellow-300 rounded px-1.5 py-0.5 bg-yellow-50">
                            ⚠ Amt Mismatch
                          </span>
                        )}
                        {(isDeveloper || isAdmin) && (
                          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onDelete(request.id); }} disabled={actioningId !== null} className="text-red-600 hover:bg-red-50 border border-red-200" title="Delete (Dev)">
                            <Trash2 size={13} />
                          </Button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
                {expandedId === request.id && (
                  <tr className="bg-sky-50/30">
                    <td colSpan={5} className="px-4 pb-4 pt-2">
                      <div className="grid md:grid-cols-3 gap-4">
                        {request.items && request.items.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Claim Items</p>
                            <div className="space-y-1">
                              {request.items.map((item, i) => (
                                <div key={i} className="flex justify-between text-xs">
                                  <span className="text-slate-600 truncate">{item.purpose}</span>
                                  <span className="font-medium ml-3 shrink-0">{formatCurrency(item.amount)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {request.bankName && (
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bank Details</p>
                              {canSeeBankDetails && <CopyButton text={`${request.bankName}\n${request.accountHolder}\n${request.accountNumber}`} label="Copy All" />}
                            </div>
                            <div className="space-y-1.5 text-xs">
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-slate-400 shrink-0">Bank</span>
                                {canSeeBankDetails
                                  ? <span className="font-medium text-slate-700 flex items-center gap-1 truncate">{request.bankName} <CopyButton text={request.bankName || ''} /></span>
                                  : <span className="text-slate-400 tracking-widest">●●●●</span>}
                              </div>
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-slate-400 shrink-0">Holder</span>
                                {canSeeBankDetails
                                  ? <span className="font-medium text-slate-700 flex items-center gap-1 truncate">{request.accountHolder} <CopyButton text={request.accountHolder || ''} /></span>
                                  : <span className="text-slate-400 tracking-widest">●●●●</span>}
                              </div>
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-slate-400 shrink-0">A/C No</span>
                                {canSeeBankDetails
                                  ? <span className="font-mono font-bold text-slate-700 flex items-center gap-1">{request.accountNumber} <CopyButton text={request.accountNumber || ''} /></span>
                                  : <span className="text-slate-400 tracking-widest">●●●● ●●●●</span>}
                              </div>
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-slate-400 shrink-0">Claim From</span>
                                <span className="font-medium text-slate-700 truncate">{bankAccounts.find(a => a.id === request.claimFromBankAccountId)?.name || '—'}</span>
                              </div>
                            </div>
                          </div>
                        )}
                        {request.remark && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Remark</p>
                            <p className="text-xs text-slate-600 whitespace-pre-wrap">{request.remark}</p>
                          </div>
                        )}
                      </div>
                      {request.attachmentUrls && request.attachmentUrls.length > 0 && (
                        <p className="text-xs text-jci-blue mt-2.5 flex items-center gap-1">
                          <Paperclip size={11} />
                          {request.attachmentUrls.length} attachment{request.attachmentUrls.length > 1 ? 's' : ''} " view in PDF
                        </p>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {remainingCount > 0 && (
        <div className="hidden md:flex justify-center pt-3">
          <Button variant="outline" size="sm" onClick={onLoadMore}>
            Load more ({remainingCount} remaining)
          </Button>
        </div>
      )}

      <div className="md:hidden divide-y divide-slate-100">
        {visibleRequests.map((request) => (
          <div key={request.id}>
            <button
              type="button"
              className="w-full text-left py-3 active:bg-slate-50"
              onClick={() => onToggleExpanded(request.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <PaymentRequestStatusBadge status={request.status} />
                  <p className="font-medium text-slate-800 text-sm truncate">{request.applicantName || '"'}</p>
                </div>
                <p className="font-bold text-jci-blue text-sm shrink-0">{formatCurrency(request.totalAmount || request.amount)}</p>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">{request.referenceNumber}</span>
                <span className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                  {request.category === 'administrative'
                    ? <><Building2 size={10} />{request.activityId || '"'}</>
                    : <><Sparkles size={10} className="text-orange-400" />{projects.find(p => p.id === request.activityId)?.name || request.activityRef || '"'}</>
                  }
                </span>
                <span className="text-[10px] text-slate-300 ml-auto shrink-0">{new Date(request.createdAt).toLocaleDateString()}</span>
              </div>
            </button>
            {expandedId === request.id && (
              <div className="pb-3 pt-1 bg-slate-50/60 rounded-lg px-3 mb-2">
                {request.bankName && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bank Details</p>
                      {canSeeBankDetails && <CopyButton text={`${request.bankName}\n${request.accountHolder}\n${request.accountNumber}`} label="Copy All" />}
                    </div>
                    <div className="bg-white rounded-lg border border-slate-200 p-2.5 space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Bank</span>
                        {canSeeBankDetails
                          ? <span className="font-medium text-slate-700 flex items-center gap-1">{request.bankName} <CopyButton text={request.bankName || ''} /></span>
                          : <span className="text-slate-400 tracking-widest">●●●●</span>}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Holder</span>
                        {canSeeBankDetails
                          ? <span className="font-medium text-slate-700 flex items-center gap-1">{request.accountHolder} <CopyButton text={request.accountHolder || ''} /></span>
                          : <span className="text-slate-400 tracking-widest">●●●●</span>}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">A/C No</span>
                        {canSeeBankDetails
                          ? <span className="font-mono font-bold text-slate-700 flex items-center gap-1">{request.accountNumber} <CopyButton text={request.accountNumber || ''} /></span>
                          : <span className="text-slate-400 tracking-widest">●●●● ●●●●</span>}
                      </div>
                    </div>
                  </div>
                )}
                {request.items && request.items.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Items</p>
                    <div className="space-y-1">
                      {request.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-slate-600 truncate">{item.purpose}</span>
                          <span className="font-medium ml-4 shrink-0">{formatCurrency(item.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => onPreviewPDF(request)}>
                    <Eye size={13} className="mr-1" /> PDF
                  </Button>
                  {request.status === 'submitted' && (isApprover || isAdmin) && (
                    <>
                      <Button size="sm" variant="success" onClick={() => onApprove(request.id)} disabled={actioningId !== null} className="flex-1">Approve</Button>
                      <Button size="sm" variant="danger" onClick={() => onReject(request.id)} disabled={actioningId !== null} className="flex-1">Reject</Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {remainingCount > 0 && (
          <div className="md:hidden flex justify-center pt-3 pb-1">
            <Button variant="outline" size="sm" onClick={onLoadMore}>
              Load more ({remainingCount} remaining)
            </Button>
          </div>
        )}
      </div>
    </>
  );
};
