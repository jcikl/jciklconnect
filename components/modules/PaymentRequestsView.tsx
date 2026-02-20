// Payment Requests – submit, my applications, finance list and review (Story 2.2–2.5)
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, RefreshCw, CheckCircle, XCircle, Search, X } from 'lucide-react';
import { Button, Card, Modal, useToast, Tabs, Badge } from '../ui/Common';
import { Input, Select } from '../ui/Form';
import { MemberSelector } from '../ui/MemberSelector';
import { FirstUseBanner } from '../ui/FirstUseBanner';
import { useHelpModal } from '../../contexts/HelpModalContext';
import { LoadingState } from '../ui/Loading';
import { PaymentRequestService } from '../../services/paymentRequestService';
import { PaymentRequest, PaymentRequestStatus } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { useMembers } from '../../hooks/useMembers';
import { DEFAULT_LO_ID } from '../../config/constants';
import type { Member } from '../../types';
import { formatCurrency } from '../../utils/formatUtils';

const STATUS_LABEL: Record<PaymentRequestStatus, string> = {
  draft: 'Draft',
  submitted: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

function StatusBadge({ status }: { status: PaymentRequestStatus }) {
  const variant = status === 'approved' ? 'success' : status === 'rejected' ? 'error' : status === 'cancelled' ? 'neutral' : status === 'submitted' ? 'warning' : 'neutral';
  return <Badge variant={variant}>{STATUS_LABEL[status]}</Badge>;
}

const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h
function duplicateHintSet(items: PaymentRequest[]): Set<string> {
  const key = (pr: PaymentRequest) => `${pr.activityRef ?? ''}|${pr.amount}|${pr.applicantId}`;
  const byKey = new Map<string, PaymentRequest[]>();
  for (const pr of items) {
    const k = key(pr);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(pr);
  }
  const ids = new Set<string>();
  for (const arr of byKey.values()) {
    if (arr.length < 2) continue;
    const sorted = [...arr].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    for (let i = 0; i < sorted.length; i++) {
      const t = new Date(sorted[i].createdAt).getTime();
      const inWindow = sorted.filter((p) => Math.abs(new Date(p.createdAt).getTime() - t) <= DEDUP_WINDOW_MS);
      if (inWindow.length >= 2) inWindow.forEach((p) => ids.add(p.id));
    }
  }
  return ids;
}

export const PaymentRequestsView: React.FC = () => {
  const { showToast } = useToast();
  const helpModal = useHelpModal();
  const { user, member } = useAuth();
  const { hasPermission, isActivityFinance } = usePermissions();
  const [myList, setMyList] = useState<PaymentRequest[]>([]);
  const [financeList, setFinanceList] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'my' | 'all'>('my');
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formPurpose, setFormPurpose] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formActivityRef, setFormActivityRef] = useState('');
  const [formApplicantId, setFormApplicantId] = useState<string>(''); // '' = self
  const [successRef, setSuccessRef] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [searchRef, setSearchRef] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentRequestStatus | ''>('');

  const canViewFinance = hasPermission('canViewFinance');
  const loId = (member as { loId?: string })?.loId ?? DEFAULT_LO_ID;
  const activityRefFilter = isActivityFinance ? (member as { activityFinanceActivityId?: string | null })?.activityFinanceActivityId ?? null : null;

  const { members: memberOptions } = useMembers(loId);
  const selectedMember = formApplicantId ? memberOptions.find((m) => m.id === formApplicantId) : null;

  const loadMyList = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const { items } = await PaymentRequestService.list({ applicantId: user.uid, pageSize: 100 });
      setMyList(items);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to load', 'error');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, showToast]);

  const loadFinanceList = useCallback(async () => {
    if (!canViewFinance) return;
    setFinanceLoading(true);
    try {
      const { items } = await PaymentRequestService.list({
        loId,
        ...(activityRefFilter ? { activityRef: activityRefFilter } : {}),
        ...(searchRef.trim() ? { referenceNumber: searchRef.trim() } : {}),
        ...(statusFilter ? { status: statusFilter as PaymentRequestStatus } : {}),
        pageSize: 200,
      });
      setFinanceList(items);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to load finance list', 'error');
    } finally {
      setFinanceLoading(false);
    }
  }, [canViewFinance, loId, activityRefFilter, searchRef, statusFilter, showToast]);

  useEffect(() => {
    loadMyList();
  }, [loadMyList]);

  useEffect(() => {
    if (activeTab === 'all' && canViewFinance) loadFinanceList();
  }, [activeTab, canViewFinance, loadFinanceList]);

  const dedupIds = useMemo(() => duplicateHintSet(financeList), [financeList]);

  const handleApproveReject = async (id: string, status: 'approved' | 'rejected') => {
    if (!user?.uid) return;
    setActioningId(id);
    try {
      await PaymentRequestService.updateStatus(id, status, user.uid);
      showToast(status === 'approved' ? 'Approved' : 'Rejected', 'success');
      await loadFinanceList();
      await loadMyList();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Operation failed', 'error');
    } finally {
      setActioningId(null);
    }
  };

  const handleCancel = async (id: string) => {
    if (!user?.uid) return;
    if (!confirm('Are you sure you want to cancel this payment request?')) return;
    setActioningId(id);
    try {
      await PaymentRequestService.cancel(id, user.uid);
      showToast('Payment request cancelled', 'success');
      await loadMyList();
      if (canViewFinance && activeTab === 'all') {
        await loadFinanceList();
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Cancel failed', 'error');
    } finally {
      setActioningId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const purpose = formPurpose.trim();
    const amount = parseFloat(formAmount);
    if (!purpose || Number.isNaN(amount) || amount <= 0) {
      showToast('Please enter purpose and a valid amount', 'error');
      return;
    }
    if (!user?.uid || !member) {
      showToast('Please log in first', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const applicantId = formApplicantId || user.uid;
      const applicantName = selectedMember?.name ?? member?.name ?? null;
      const { id, referenceNumber } = await PaymentRequestService.create(
        {
          applicantId,
          amount,
          purpose,
          activityRef: formActivityRef.trim() || null,
          status: 'submitted',
          loId,
          applicantName,
        },
        user.uid
      );
      setSuccessRef(referenceNumber);
      setSubmitModalOpen(false);
      setFormPurpose('');
      setFormAmount('');
      setFormActivityRef('');
      setFormApplicantId('');
      showToast(`Application submitted. Reference: ${referenceNumber}`, 'success');
      await loadMyList();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Submit failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Payment Requests</h2>
          <p className="text-slate-500">Submit requests and view my application status</p>
        </div>
        {member && (
          <Button onClick={() => { setSuccessRef(null); setSubmitModalOpen(true); }}>
            <Plus size={18} className="mr-1" /> Submit Payment Request
          </Button>
        )}
      </div>

      {successRef && (
        <Card className="p-4 bg-green-50 border-green-200">
          <p className="text-green-800 font-medium">Submitted successfully</p>
          <p className="text-green-700 text-sm">Reference: {successRef} (use for bank transfer memo and reconciliation)</p>
        </Card>
      )}

      <FirstUseBanner flowId="payment-requests" dismissLabel="Got it" onHelpClick={helpModal?.openHelp}>
        Submit a payment request with purpose and amount. The system will generate a reference number (e.g. PR-default-lo-20250216-001). Use this reference in your bank transfer memo for reconciliation. You can also select a member to auto-fill their details.
      </FirstUseBanner>

      <Card className="p-6">
        <Tabs
          tabs={[
            { id: 'my', label: 'My Applications' },
            ...(canViewFinance ? [{ id: 'all', label: 'All Applications (Finance)' }] : []),
          ]}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as 'my' | 'all')}
        />
        <div className="mt-4 flex justify-end mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={activeTab === 'my' ? loadMyList : loadFinanceList}
            disabled={activeTab === 'my' ? loading : financeLoading}
          >
            <RefreshCw size={14} className="mr-1" /> Refresh
          </Button>
        </div>
        {activeTab === 'my' && (
          <>
            {loading ? (
              <LoadingState loading={true}><span /></LoadingState>
            ) : myList.length === 0 ? (
              <p className="text-slate-500">No applications yet</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {myList.map((pr) => (
                  <li key={pr.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-medium">{pr.referenceNumber}</span>
                      <span className="text-slate-500 ml-2">{pr.purpose}</span>
                      {pr.activityRef && <span className="text-slate-400 text-sm ml-2">Activity: {pr.activityRef}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span>{formatCurrency(pr.amount)}</span>
                      <StatusBadge status={pr.status} />
                      {pr.status === 'submitted' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCancel(pr.id)}
                          disabled={actioningId !== null}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <X size={14} className="mr-1" /> Cancel
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {activeTab === 'all' && canViewFinance && (
          <>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="flex-1 flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Search by reference (e.g. PR-default-lo-20250216-001)"
                    value={searchRef}
                    onChange={(e) => setSearchRef(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadFinanceList()}
                    className="block w-full rounded-lg border-slate-300 shadow-sm py-2 pl-3 pr-10 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20"
                    aria-label="Search by reference number"
                  />
                  <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                <div className="w-36 shrink-0">
                  <Select
                    label=""
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as PaymentRequestStatus | '')}
                    options={[
                      { value: '', label: 'All statuses' },
                      { value: 'submitted', label: 'Pending' },
                      { value: 'approved', label: 'Approved' },
                      { value: 'rejected', label: 'Rejected' },
                      { value: 'cancelled', label: 'Cancelled' },
                      { value: 'draft', label: 'Draft' },
                    ]}
                    className="w-full"
                    aria-label="Filter by status"
                  />
                </div>
                <Button size="sm" variant="secondary" onClick={loadFinanceList} disabled={financeLoading}>
                  <Search size={14} className="mr-1" /> Search
                </Button>
              </div>
            </div>
            {financeLoading ? (
              <LoadingState loading={true}><span /></LoadingState>
            ) : financeList.length === 0 ? (
              <p className="text-slate-500">No applications</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {financeList.map((pr) => (
                  <li key={pr.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-medium">{pr.referenceNumber}</span>
                      {dedupIds.has(pr.id) && (
                        <Badge variant="warning" className="ml-2 text-xs">Possible duplicate</Badge>
                      )}
                      <span className="text-slate-500 ml-2">{pr.purpose}</span>
                      {pr.activityRef && <span className="text-slate-400 text-sm ml-2">Activity: {pr.activityRef}</span>}
                      {pr.applicantName && <span className="text-slate-400 text-sm ml-2">Applicant: {pr.applicantName}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span>{formatCurrency(pr.amount)}</span>
                      <StatusBadge status={pr.status} />
                      {pr.status === 'submitted' && (
                        <span className="flex gap-1">
                          <Button size="sm" variant="secondary" onClick={() => handleApproveReject(pr.id, 'approved')} disabled={actioningId !== null}><CheckCircle size={14} className="mr-1" /> Approve</Button>
                          <Button size="sm" variant="secondary" onClick={() => handleApproveReject(pr.id, 'rejected')} disabled={actioningId !== null}><XCircle size={14} className="mr-1" /> Reject</Button>
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Card>

      <Modal
        isOpen={submitModalOpen}
        onClose={() => !submitting && setSubmitModalOpen(false)}
        title="Submit Payment Request"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <MemberSelector
            label="Applicant"
            members={memberOptions}
            value={formApplicantId}
            onChange={setFormApplicantId}
            selfOption
            selfLabel="Self"
            placeholder="Search by name, phone, email…"
            showLookupFields
          />
          <Input
            label="Purpose / Description"
            value={formPurpose}
            onChange={(e) => setFormPurpose(e.target.value)}
            placeholder="Required"
            required
          />
          <Input
            label="Amount"
            type="number"
            min="0"
            step="0.01"
            value={formAmount}
            onChange={(e) => setFormAmount(e.target.value)}
            placeholder="0.00"
            required
          />
          <Input
            label="Activity (optional)"
            value={formActivityRef}
            onChange={(e) => setFormActivityRef(e.target.value)}
            placeholder="Activity ID or name"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setSubmitModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
