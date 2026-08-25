// Payment Requests " submit, my applications, finance list and review
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, useToast, PageScaffold, ConfirmDialog } from '../ui/Common';
import { SubmitPaymentRequestModal } from './PaymentRequests/SubmitPaymentRequestModal';
import { PaymentRequestPdfPreviewModal } from './PaymentRequests/PaymentRequestPdfPreviewModal';
import { PaymentRequestRejectDialog } from './PaymentRequests/PaymentRequestRejectDialog';
import { MyPaymentRequestsPanel } from './PaymentRequests/MyPaymentRequestsPanel';
import { FinancePaymentRequestsPanel } from './PaymentRequests/FinancePaymentRequestsPanel';
import { generatePaymentRequestPdfPreview } from './PaymentRequests/paymentRequestPdf';
import { PaymentRequestStatsStrip } from './PaymentRequests/PaymentRequestStatsStrip';
import { PaymentRequestSuccessBanner } from './PaymentRequests/PaymentRequestSuccessBanner';
import { PaymentRequestTabsBar } from './PaymentRequests/PaymentRequestTabsBar';
import { FirstUseBanner } from '../ui/FirstUseBanner';
import { useHelpModal } from '../../contexts/HelpModalContext';
import { PaymentRequestService } from '../../services/paymentRequestService';
import { ProjectsService } from '../../services/projectsService';
import { FinanceService } from '../../services/financeService';
import { PaymentRequest, PaymentRequestStatus, Project, BankAccount } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { useMembers } from '../../hooks/useMembers';
import { DEFAULT_LO_ID } from '../../config/constants';

export const PaymentRequestsView: React.FC<{ searchQuery?: string }> = ({ searchQuery }) => {
  const { showToast } = useToast();
  const helpModal = useHelpModal();
  const { user, member } = useAuth();
  const { hasPermission, isActivityFinance, isDeveloper, isAdmin } = usePermissions();
  const [myList, setMyList] = useState<PaymentRequest[]>([]);
  const [financeList, setFinanceList] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [myListError, setMyListError] = useState<string | null>(null);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeListError, setFinanceListError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'my' | 'all'>('my');
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submitPreselectedProjectId, setSubmitPreselectedProjectId] = useState<string | undefined>();
  const [submitPreselectedCategory, setSubmitPreselectedCategory] = useState<'administrative' | 'projects_activities' | undefined>();

  const [successRef, setSuccessRef] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [rejectDialogId, setRejectDialogId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewFileName, setPdfPreviewFileName] = useState<string>('payment-request.pdf');
  const [searchRef, setSearchRef] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentRequestStatus | ''>('');
  const [financeListLimit, setFinanceListLimit] = useState(50);
  // Reset pagination when filters change so results aren't artificially truncated.
  useEffect(() => { setFinanceListLimit(50); }, [searchQuery, statusFilter]);

  type PRConfirmState = { type: 'delete' | 'cancel'; id: string } | null;
  const [prConfirmState, setPrConfirmState] = useState<PRConfirmState>(null);

  const canViewFinance = hasPermission('canViewFinance');
  const canEditFinance = hasPermission('canEditFinance');
  const loId = (member as { loId?: string })?.loId ?? DEFAULT_LO_ID;
  const activityRefFilter = isActivityFinance ? (member as { activityFinanceActivityId?: string | null })?.activityFinanceActivityId ?? null : null;

  // Approve/reject: only current-term President, Secretary, or Honorary Treasurer
  const APPROVER_BOARD_TITLES = ['President', 'Secretary', 'Honorary Treasurer'];
  const currentBoardPos: string = (member as any)?.currentBoardPosition ?? (member as any)?.jciCareer?.currentBoardPosition ?? '';
  const isApprover = APPROVER_BOARD_TITLES.some(t => currentBoardPos.includes(t));

  const { members: memberOptions } = useMembers(loId);

  const [projects, setProjects] = useState<Project[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  // Committee member: regular member who is on the committee of any project
  const committeeActivityIds = useMemo(
    () => projects
      .filter(p => (p as any).committee?.some((c: any) => c.memberId === user?.uid))
      .map(p => p.id),
    [projects, user?.uid]
  );
  const isCommitteeMember = !canViewFinance && committeeActivityIds.length > 0;
  const canSeeAllTab = canViewFinance || isCommitteeMember;
  // Bank details (bankName, accountHolder, accountNumber) visible only to Board/Admin with finance access
  const canSeeBankDetails = canViewFinance;

  useEffect(() => {
    ProjectsService.getAllProjects().then(setProjects).catch((e) => { console.error(e); showToast('参考数据加载失败，部分字段可能显示为空', 'warning'); });
    FinanceService.getAllBankAccounts(false).then(setBankAccounts).catch((e) => { console.error(e); showToast('参考数据加载失败，部分字段可能显示为空', 'warning'); });
  }, []);

  // Check for auto-open and preselected values from Events Management page
  useEffect(() => {
    const autoOpen = sessionStorage.getItem('pr_auto_open_submit');
    if (autoOpen === 'true') {
      const preselectedProj = sessionStorage.getItem('pr_preselected_project_id');
      const preselectedCat = sessionStorage.getItem('pr_preselected_category');
      sessionStorage.removeItem('pr_auto_open_submit');
      sessionStorage.removeItem('pr_preselected_project_id');
      sessionStorage.removeItem('pr_preselected_category');
      setSubmitPreselectedProjectId(preselectedProj ?? undefined);
      setSubmitPreselectedCategory(
        preselectedCat === 'projects_activities' || preselectedCat === 'administrative'
          ? preselectedCat
          : undefined
      );
      setSuccessRef(null);
      setSubmitModalOpen(true);
    }
  }, []);


  const loadMyList = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    setMyListError(null);
    try {
      const { items } = await PaymentRequestService.list({ applicantId: user.uid, pageSize: 100 });
      setMyList(items);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to load', 'error');
      setMyListError('Failed to load requests. Click to retry.');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, showToast]);

  const loadFinanceList = useCallback(async () => {
    if (!canViewFinance && !isCommitteeMember) return;
    setFinanceLoading(true);
    setFinanceListError(null);
    try {
      if (canViewFinance) {
        const { items } = await PaymentRequestService.list({
          loId,
          ...(activityRefFilter ? { activityRef: activityRefFilter } : {}),
          ...(searchRef.trim() ? { referenceNumber: searchRef.trim() } : {}),
          ...(statusFilter ? { status: statusFilter as PaymentRequestStatus } : {}),
          pageSize: 200,
        });
        setFinanceList(items);
      } else {
        // Committee member: load PRs per activity they're in
        const results = await Promise.all(
          committeeActivityIds.map(actId =>
            PaymentRequestService.list({ activityRef: actId, pageSize: 100 })
              .then(r => r.items)
              .catch(() => [] as PaymentRequest[])
          )
        );
        const seen = new Set<string>();
        setFinanceList(
          results.flat().filter(pr => { if (seen.has(pr.id)) return false; seen.add(pr.id); return true; })
        );
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to load finance list', 'error');
      setFinanceListError('Failed to load requests. Click to retry.');
    } finally {
      setFinanceLoading(false);
    }
  }, [canViewFinance, isCommitteeMember, committeeActivityIds, loId, activityRefFilter, searchRef, statusFilter, showToast]);

  useEffect(() => {
    loadMyList();
  }, [loadMyList]);

  useEffect(() => {
    if (activeTab === 'all' && canSeeAllTab) loadFinanceList();
  }, [activeTab, canSeeAllTab, loadFinanceList]);

  const filteredMyList = useMemo(() => {
    const term = (searchQuery || '').toLowerCase();
    return myList.filter(pr => {
      if (statusFilter && pr.status !== statusFilter) return false;
      if (!term) return true;
      const projectName = projects.find(p => p.id === pr.activityId)?.name || '';
      const adminAccountName = bankAccounts.find(b => b.id === pr.claimFromBankAccountId)?.name || '';
      return (
        (pr.referenceNumber ?? '').toLowerCase().includes(term) ||
        (pr.bankName ?? '').toLowerCase().includes(term) ||
        (pr.accountHolder ?? '').toLowerCase().includes(term) ||
        (pr.accountNumber ?? '').toLowerCase().includes(term) ||
        (pr.activityId ?? '').toLowerCase().includes(term) ||
        projectName.toLowerCase().includes(term) ||
        adminAccountName.toLowerCase().includes(term) ||
        pr.items?.some(item => (item.purpose ?? '').toLowerCase().includes(term))
      );
    });
  }, [myList, searchQuery, statusFilter, projects, bankAccounts]);

  const filteredFinanceList = useMemo(() => {
    const term = (searchQuery || '').toLowerCase();
    if (!term) return financeList;

    return financeList.filter(pr => {
      const projectName = projects.find(p => p.id === pr.activityId)?.name || '';
      const adminAccountName = bankAccounts.find(b => b.id === pr.claimFromBankAccountId)?.name || '';
      return (
        (pr.referenceNumber ?? '').toLowerCase().includes(term) ||
        (pr.bankName ?? '').toLowerCase().includes(term) ||
        (pr.accountHolder ?? '').toLowerCase().includes(term) ||
        (pr.accountNumber ?? '').toLowerCase().includes(term) ||
        (pr.activityId ?? '').toLowerCase().includes(term) ||
        (pr.applicantName ?? '').toLowerCase().includes(term) ||
        projectName.toLowerCase().includes(term) ||
        adminAccountName.toLowerCase().includes(term) ||
        pr.items?.some(item => (item.purpose ?? '').toLowerCase().includes(term))
      );
    });
  }, [financeList, searchQuery, projects, bankAccounts]);

  const stats = useMemo(() => {
    const listToUse = activeTab === 'my' ? filteredMyList : filteredFinanceList;
    const pending = listToUse.filter(r => r.status === 'submitted');
    const approved = listToUse.filter(r => r.status === 'approved');
    const rejected = listToUse.filter(r => r.status === 'rejected');

    const totalPendingAmount = pending.reduce((sum, r) => sum + (r.totalAmount || r.amount || 0), 0);
    const totalApprovedAmount = approved.reduce((sum, r) => sum + (r.totalAmount || r.amount || 0), 0);

    return {
      pendingCount: pending.length,
      pendingAmount: totalPendingAmount,
      approvedCount: approved.length,
      approvedAmount: totalApprovedAmount,
      rejectedCount: rejected.length + listToUse.filter(r => r.status === 'cancelled').length,
    };
  }, [activeTab, filteredMyList, filteredFinanceList]);

  const handleApproveReject = async (id: string, status: 'approved' | 'rejected', rejectionReason?: string) => {
    if (!user?.uid) return;
    if (!isApprover && !isAdmin) { showToast('Only President, Secretary, or Honorary Treasurer may approve/reject', 'error'); return; }
    setActioningId(id);
    const reviewerBoardTitle = (member as any)?.currentBoardPosition ?? (member as any)?.jciCareer?.currentBoardPosition;
    try {
      await PaymentRequestService.updateStatus(id, status, user.uid, {
        ...(rejectionReason ? { rejectionReason } : {}),
        ...(reviewerBoardTitle ? { reviewerBoardTitle } : {}),
      });
      showToast(status === 'approved' ? 'Approved' : 'Rejected', 'success');
      await loadFinanceList();
      await loadMyList();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Operation failed', 'error');
    } finally {
      setActioningId(null);
    }
  };

  const handleRejectClick = (id: string) => {
    setRejectReason('');
    setRejectDialogId(id);
  };

  const handleRejectConfirm = async () => {
    if (!rejectDialogId) return;
    if (!rejectReason.trim()) { showToast('Rejection reason is required', 'error'); return; }
    await handleApproveReject(rejectDialogId, 'rejected', rejectReason.trim());
    setRejectDialogId(null);
  };

  const handleRetryExpenseTx = async (id: string) => {
    if (!user?.uid) return;
    setActioningId(id);
    try {
      await PaymentRequestService.retryCreateExpenseTransaction(id, user.uid);
      showToast('Expense transaction created successfully', 'success');
      await loadFinanceList();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Retry failed', 'error');
    } finally {
      setActioningId(null);
    }
  };

  const handleDeletePR = async (id: string) => {
    const DELETABLE_STATUSES: PaymentRequestStatus[] = ['draft', 'cancelled', 'rejected'];
    const pr = [...myList, ...financeList].find(p => p.id === id);
    if (pr && !DELETABLE_STATUSES.includes(pr.status)) {
      showToast('只能删除草稿、已取消或已拒绝的申请', 'error');
      return;
    }
    setPrConfirmState({ type: 'delete', id });
  };

  const executeDeletePR = async (id: string) => {
    const DELETABLE_STATUSES: PaymentRequestStatus[] = ['draft', 'cancelled', 'rejected'];
    const pr = [...myList, ...financeList].find(p => p.id === id);
    if (pr && !DELETABLE_STATUSES.includes(pr.status)) {
      showToast('只能删除草稿、已取消或已拒绝的申请', 'error');
      return;
    }
    setActioningId(id);
    try {
      await PaymentRequestService.deletePR(id);
      showToast('Payment request deleted', 'success');
      await loadFinanceList();
      await loadMyList();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Delete failed', 'error');
    } finally {
      setActioningId(null);
    }
  };

  const handleCancel = (id: string) => {
    if (!user?.uid) return;
    setPrConfirmState({ type: 'cancel', id });
  };

  const executeCancel = async (id: string) => {
    if (!user?.uid) return;
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

  const handlePreviewPDF = async (pr: PaymentRequest) => {
    const preview = await generatePaymentRequestPdfPreview({
      request: pr,
      projects,
      bankAccounts,
      onMergeError: () => {
        showToast('PDF merging failed. Generating basic PDF without attachments.', 'warning');
      },
    });

    setPdfPreviewFileName(preview.fileName);
    setPdfPreviewUrl(preview.url);
  };
  
  const ListSkeleton = () => (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-[72px] bg-slate-100 rounded-xl animate-pulse" />
      ))}
    </div>
  );

  return (
    <>
      <PageScaffold
        title="Payment Requests"
        description="Submit and track reimbursement claims"
        className="space-y-2"
        contentClassName="space-y-2"
      >
      {successRef && (
        <PaymentRequestSuccessBanner
          referenceNumber={successRef}
          onClose={() => setSuccessRef(null)}
        />
      )}

      <PaymentRequestStatsStrip stats={stats} />

      {/* Tabs + List */}
      <div>
        <PaymentRequestTabsBar
          activeTab={activeTab}
          canSeeAllTab={canSeeAllTab}
          statusFilter={statusFilter}
          onTabChange={(id) => { setActiveTab(id); setExpandedId(null); }}
          onStatusFilterChange={setStatusFilter}
        />

        <div>
          {activeTab === 'my' ? (
            <MyPaymentRequestsPanel
              loading={loading}
              myListError={myListError}
              requests={filteredMyList}
              projects={projects}
              memberExists={!!member}
              expandedId={expandedId}
              actioningId={actioningId}
              isDeveloper={isDeveloper}
              isAdmin={isAdmin}
              listSkeleton={<ListSkeleton />}
              onRetry={loadMyList}
              onCreate={() => { setSuccessRef(null); setSubmitModalOpen(true); }}
              onToggleExpanded={(id) => setExpandedId(expandedId === id ? null : id)}
              onPreviewPDF={handlePreviewPDF}
              onCancel={handleCancel}
              onDelete={handleDeletePR}
            />
          ) : (
            <FinancePaymentRequestsPanel
              loading={financeLoading}
              financeListError={financeListError}
              requests={filteredFinanceList}
              projects={projects}
              bankAccounts={bankAccounts}
              financeListLimit={financeListLimit}
              expandedId={expandedId}
              actioningId={actioningId}
              canSeeBankDetails={canSeeBankDetails}
              isApprover={isApprover}
              isAdmin={isAdmin}
              isDeveloper={isDeveloper}
              listSkeleton={<ListSkeleton />}
              onRetry={loadFinanceList}
              onToggleExpanded={(id) => setExpandedId(expandedId === id ? null : id)}
              onPreviewPDF={handlePreviewPDF}
              onApprove={(id) => handleApproveReject(id, 'approved')}
              onReject={handleRejectClick}
              onRetryExpenseTx={handleRetryExpenseTx}
              onDelete={handleDeletePR}
              onLoadMore={() => setFinanceListLimit(prev => prev + 50)}
            />
          )}
        </div>
      </div>
      </PageScaffold>

      <PaymentRequestPdfPreviewModal
        pdfPreviewUrl={pdfPreviewUrl}
        pdfPreviewFileName={pdfPreviewFileName}
        onClose={() => { setPdfPreviewUrl(null); }}
      />

      <SubmitPaymentRequestModal
        isOpen={submitModalOpen}
        onClose={() => setSubmitModalOpen(false)}
        preselectedProjectId={submitPreselectedProjectId}
        preselectedCategory={submitPreselectedCategory}
        onSuccess={(ref) => { setSuccessRef(ref); loadMyList(); }}
      />

      {/* P1: Delete / Cancel confirmation dialog */}
      <ConfirmDialog
        open={!!prConfirmState}
        title={prConfirmState?.type === 'delete' ? 'Delete Payment Request' : 'Cancel Payment Request'}
        message={prConfirmState?.type === 'delete'
          ? 'Permanently delete this payment request? This cannot be undone.'
          : 'Are you sure you want to cancel this payment request?'}
        confirmLabel={prConfirmState?.type === 'delete' ? 'Delete' : 'Cancel Request'}
        cancelLabel="Go Back"
        variant="danger"
        onConfirm={() => {
          if (!prConfirmState) return;
          const { type, id } = prConfirmState;
          setPrConfirmState(null);
          if (type === 'delete') executeDeletePR(id);
          else executeCancel(id);
        }}
        onCancel={() => setPrConfirmState(null)}
      />

      <PaymentRequestRejectDialog
        isOpen={!!rejectDialogId}
        rejectReason={rejectReason}
        actioningId={actioningId}
        onClose={() => setRejectDialogId(null)}
        onReasonChange={setRejectReason}
        onConfirm={handleRejectConfirm}
      />
    </>
  );
};
