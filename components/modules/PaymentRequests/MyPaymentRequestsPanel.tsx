import React from 'react';
import { Building2, Eye, FileText, Paperclip, Plus, RefreshCw, Sparkles, Trash2, X } from 'lucide-react';
import { Button } from '../../ui/Common';
import type { PaymentRequest, Project } from '../../../types';
import { formatCurrency } from '../../../utils/formatUtils';
import { PaymentRequestStatusBadge } from './paymentRequestUi';

interface MyPaymentRequestsPanelProps {
  loading: boolean;
  myListError: string | null;
  requests: PaymentRequest[];
  projects: Project[];
  memberExists: boolean;
  expandedId: string | null;
  actioningId: string | null;
  isDeveloper: boolean;
  isAdmin: boolean;
  listSkeleton: React.ReactNode;
  onRetry: () => void;
  onCreate: () => void;
  onToggleExpanded: (id: string) => void;
  onPreviewPDF: (request: PaymentRequest) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
}

export const MyPaymentRequestsPanel: React.FC<MyPaymentRequestsPanelProps> = ({
  loading,
  myListError,
  requests,
  projects,
  memberExists,
  expandedId,
  actioningId,
  isDeveloper,
  isAdmin,
  listSkeleton,
  onRetry,
  onCreate,
  onToggleExpanded,
  onPreviewPDF,
  onCancel,
  onDelete,
}) => {
  if (loading) return <>{listSkeleton}</>;

  if (myListError) {
    return (
      <div className="text-center py-14 bg-red-50 rounded-xl border border-dashed border-red-200">
        <RefreshCw className="mx-auto text-red-300 mb-3" size={36} />
        <p className="text-slate-600 font-semibold">Could not load your requests</p>
        <p className="text-slate-400 text-sm mt-1">{myListError}</p>
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
        <p className="text-slate-600 font-semibold">No payment requests yet</p>
        <p className="text-slate-400 text-sm mt-1">Submit your first reimbursement claim</p>
        <Button variant="ghost" size="sm" onClick={onCreate} className="mt-3">
          <Plus size={14} className="mr-1" /> Create Request
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-2 px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-px whitespace-nowrap">Reference</th>
              <th className="text-left py-2 px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Purpose / Project</th>
              <th className="text-right py-2 px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-px whitespace-nowrap">Amount</th>
              <th className="text-right py-2 px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-px whitespace-nowrap">Date</th>
              <th className="text-right py-2 px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-px whitespace-nowrap">Status / Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {memberExists && (
              <tr className="group cursor-pointer hover:bg-blue-50/50 transition-colors" onClick={onCreate}>
                <td colSpan={5} className="py-2.5 px-2">
                  <div className="flex items-center gap-2 text-slate-400 group-hover:text-jci-blue transition-colors">
                    <div className="w-6 h-6 rounded border-2 border-dashed border-current flex items-center justify-center shrink-0">
                      <Plus size={12} />
                    </div>
                    <span className="text-sm font-semibold">New Request</span>
                  </div>
                </td>
              </tr>
            )}
            {requests.map((request) => (
              <React.Fragment key={request.id}>
                <tr
                  className={`group hover:bg-slate-50/80 transition-colors cursor-pointer ${expandedId === request.id ? 'bg-sky-50/40' : ''}`}
                  onClick={() => onToggleExpanded(request.id)}
                >
                  <td className="py-3 px-2 w-px whitespace-nowrap">
                    <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{request.referenceNumber}</span>
                  </td>
                  <td className="py-3 px-2">
                    <p className="font-medium text-slate-800 truncate">{request.purpose}</p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate flex items-center gap-1">
                      {request.category === 'administrative'
                        ? <><Building2 size={11} />{request.activityId || '"'}</>
                        : <><Sparkles size={11} className="text-orange-400" />{projects.find(project => project.id === request.activityId)?.name || request.activityRef || '"'}</>
                      }
                    </p>
                  </td>
                  <td className="py-3 px-2 text-right font-bold text-jci-blue whitespace-nowrap w-px">{formatCurrency(request.totalAmount || request.amount)}</td>
                  <td className="py-3 px-2 text-right text-xs text-slate-500 whitespace-nowrap w-px">{new Date(request.createdAt).toLocaleDateString()}</td>
                  <td className="py-3 px-2 w-px">
                    <div className="flex items-center gap-1.5 justify-end">
                      <PaymentRequestStatusBadge status={request.status} />
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="sm" variant="secondary" onClick={(event) => { event.stopPropagation(); onPreviewPDF(request); }} title="View PDF">
                          <Eye size={13} />
                        </Button>
                        {request.status === 'submitted' && (
                          <Button size="sm" variant="ghost" onClick={(event) => { event.stopPropagation(); onCancel(request.id); }} disabled={actioningId !== null} className="text-red-500 hover:bg-red-50" title="Cancel">
                            <X size={13} />
                          </Button>
                        )}
                        {(isDeveloper || isAdmin) && (
                          <Button size="sm" variant="ghost" onClick={(event) => { event.stopPropagation(); onDelete(request.id); }} disabled={actioningId !== null} className="text-red-600 hover:bg-red-50 border border-red-200" title="Delete (Dev)">
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
                      <div className="grid md:grid-cols-2 gap-4">
                        {request.items && request.items.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Claim Items</p>
                            <div className="space-y-1">
                              {request.items.map((item, index) => (
                                <div key={index} className="flex justify-between text-xs">
                                  <span className="text-slate-600 truncate">{item.purpose}</span>
                                  <span className="font-medium text-slate-700 ml-4 shrink-0">{formatCurrency(item.amount)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {request.bankName && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Remit To</p>
                            <p className="text-xs text-slate-600">{request.bankName} · {request.accountHolder}</p>
                            <p className="text-xs font-mono text-slate-700 mt-0.5">{request.accountNumber}</p>
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

      <div className="md:hidden divide-y divide-slate-100">
        {memberExists && (
          <div onClick={onCreate}
            className="flex items-center gap-3 py-3 text-slate-400 hover:text-jci-blue transition-colors cursor-pointer">
            <div className="w-7 h-7 rounded border-2 border-dashed border-current flex items-center justify-center shrink-0">
              <Plus size={13} />
            </div>
            <span className="text-sm font-semibold">New Request</span>
          </div>
        )}
        {requests.map((request) => (
          <div key={request.id}>
            <button
              type="button"
              className="w-full text-left py-3 active:bg-slate-50 group"
              onClick={() => onToggleExpanded(request.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <PaymentRequestStatusBadge status={request.status} />
                  <p className="font-medium text-slate-800 text-sm truncate">{request.purpose}</p>
                </div>
                <p className="font-bold text-jci-blue text-sm shrink-0">{formatCurrency(request.totalAmount || request.amount)}</p>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">{request.referenceNumber}</span>
                <span className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                  {request.category === 'administrative'
                    ? <><Building2 size={10} />{request.activityId || '"'}</>
                    : <><Sparkles size={10} className="text-orange-400" />{projects.find(project => project.id === request.activityId)?.name || request.activityRef || '"'}</>
                  }
                </span>
                <span className="text-[10px] text-slate-300 ml-auto shrink-0">{new Date(request.createdAt).toLocaleDateString()}</span>
              </div>
            </button>
            {expandedId === request.id && (
              <div className="pb-3 pt-1 bg-slate-50/60 rounded-lg px-3 mb-2">
                {request.items && request.items.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Items</p>
                    <div className="space-y-1">
                      {request.items.map((item, index) => (
                        <div key={index} className="flex justify-between text-xs">
                          <span className="text-slate-600 truncate">{item.purpose}</span>
                          <span className="font-medium text-slate-700 ml-4 shrink-0">{formatCurrency(item.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {request.bankName && (
                  <div className="mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Remit To</p>
                    <p className="text-xs text-slate-600">{request.bankName} · <span className="font-mono">{request.accountNumber}</span></p>
                    <p className="text-xs text-slate-500">{request.accountHolder}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => onPreviewPDF(request)} className="flex-1">
                    <Eye size={13} className="mr-1" /> View PDF
                  </Button>
                  {request.status === 'submitted' && (
                    <Button size="sm" variant="ghost" onClick={() => onCancel(request.id)} disabled={actioningId !== null} className="text-red-500 hover:bg-red-50">
                      <X size={13} className="mr-1" /> Cancel
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
};
