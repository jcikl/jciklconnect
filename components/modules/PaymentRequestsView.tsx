// Payment Requests “ submit, my applications, finance list and review
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Plus, RefreshCw, CheckCircle, XCircle, Search, X, FileText, Download, Eye, Clock, Copy, Check, Landmark, DollarSign, Paperclip, Sparkles, Building2, User, Trash2 } from 'lucide-react';
import { Button, Card, Modal, useToast, Tabs, Badge } from '../ui/Common';
import { SubmitPaymentRequestModal } from './PaymentRequests/SubmitPaymentRequestModal';
import { Input, Select } from '../ui/Form';
import { FirstUseBanner } from '../ui/FirstUseBanner';
import { useHelpModal } from '../../contexts/HelpModalContext';
import { LoadingState } from '../ui/Loading';
import { PaymentRequestService } from '../../services/paymentRequestService';
import { ProjectsService } from '../../services/projectsService';
import { FinanceService } from '../../services/financeService';
import { PaymentRequest, PaymentRequestStatus, Project, BankAccount } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { useMembers } from '../../hooks/useMembers';
import { DEFAULT_LO_ID } from '../../config/constants';
import { formatCurrency } from '../../utils/formatUtils';
// jsPDF and pdf-lib are dynamically imported inside handlePreviewPDF to keep
// this chunk small — they total ~800 KB and are only needed when the user
// clicks "View PDF".

const STATUS_LABEL: Record<PaymentRequestStatus, string> = {
  draft: 'Draft',
  submitted: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  paid: 'Paid',
};

const CopyButton: React.FC<{ text: string; label?: string }> = ({ text, label }) => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-jci-blue bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded transition-all border-none"
      title="Copy to clipboard"
    >
      {copied ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
      {copied ? 'Copied' : (label || 'Copy')}
    </button>
  );
};

function StatusBadge({ status }: { status: PaymentRequestStatus }) {
  let bg = '';
  let text = '';
  let icon = null;

  switch (status) {
    case 'approved':
      bg = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      text = 'Approved';
      icon = <CheckCircle size={12} className="inline mr-1 shrink-0" />;
      break;
    case 'rejected':
      bg = 'bg-rose-50 text-rose-700 border border-rose-200';
      text = 'Rejected';
      icon = <XCircle size={12} className="inline mr-1 shrink-0" />;
      break;
    case 'cancelled':
      bg = 'bg-slate-100 text-slate-600 border border-slate-200';
      text = 'Cancelled';
      icon = <X size={12} className="inline mr-1 shrink-0" />;
      break;
    case 'submitted':
      bg = 'bg-amber-50 text-amber-700 border border-amber-200';
      text = 'Pending';
      icon = <Clock size={12} className="inline mr-1 shrink-0" />;
      break;
    default:
      bg = 'bg-slate-100 text-slate-600 border border-slate-200';
      text = 'Draft';
      icon = <FileText size={12} className="inline mr-1 shrink-0" />;
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold leading-5 ${bg}`}>
      {icon}
      <span>{text}</span>
    </span>
  );
}

export const PaymentRequestsView: React.FC<{ searchQuery?: string }> = ({ searchQuery }) => {
  const { showToast } = useToast();
  const helpModal = useHelpModal();
  const { user, member } = useAuth();
  const { hasPermission, isActivityFinance, isDeveloper, isAdmin } = usePermissions();
  const [myList, setMyList] = useState<PaymentRequest[]>([]);
  const [financeList, setFinanceList] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [financeLoading, setFinanceLoading] = useState(false);
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

  const canViewFinance = hasPermission('canViewFinance');
  const loId = (member as { loId?: string })?.loId ?? DEFAULT_LO_ID;
  const activityRefFilter = isActivityFinance ? (member as { activityFinanceActivityId?: string | null })?.activityFinanceActivityId ?? null : null;

  const { members: memberOptions } = useMembers(loId);

  const [projects, setProjects] = useState<Project[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  useEffect(() => {
    ProjectsService.getAllProjects().then(setProjects).catch(() => { });
    FinanceService.getAllBankAccounts(false).then(setBankAccounts).catch(() => { });
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
    if (!confirm('Permanently delete this payment request? This cannot be undone.')) return;
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

  const handlePreviewPDF = async (pr: PaymentRequest) => {
    const [{ jsPDF }, { PDFDocument }] = await Promise.all([
      import('jspdf'),
      import('pdf-lib'),
    ]);
    const doc = new jsPDF();
    const primaryColor = [0, 151, 215]; // JCI Blue
    const secondaryColor = [243, 156, 18]; // Gold
    const lightGray = [248, 250, 252];
    const borderGray = [226, 232, 240];
    const textMain = [30, 41, 59];
    const textSecondary = [100, 116, 139];

    // Load Logo
    const img = new Image();
    img.src = '/JCI Kuala Lumpur-transparent.png';
    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
    });

    // --- 1. MODERN HEADER ---
    const jciBlue = [0, 151, 215]; // #0097D7
    const jciGold = [237, 189, 39]; // #EDBD27

    // Column 1: Logo
    if (img.complete && img.naturalWidth > 0) {
      const logoH = 16;
      const logoW = (img.naturalWidth * logoH) / img.naturalHeight;
      doc.addImage(img, 'PNG', 15, 12, logoW, logoH);
    }

    // Column 2: Logo Organisation Info (Starts at infoX)
    const infoX = 55;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);

    // Joint Title: JCI + Kuala Lumpur (Malaysia)
    // Aligning baseline to 16.5 makes the cap-height top roughly at y=12
    doc.setTextColor(jciBlue[0], jciBlue[1], jciBlue[2]);
    doc.text("JCI", infoX, 16.5);
    const jciWidth = doc.getTextWidth("JCI ");

    doc.setTextColor(jciGold[0], jciGold[1], jciGold[2]);
    doc.text("Kuala Lumpur (Malaysia)", infoX + jciWidth, 16.5);
    const klWidth = doc.getTextWidth("Kuala Lumpur (Malaysia) ");

    doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("Established since 1954", infoX + jciWidth + klWidth, 16.5);

    // Organization Details
    doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
    doc.setFontSize(8);
    doc.text("25-3-2, Jalan 3/50, Off, Jln Gombak, Diamond Square, 53000 Kuala Lumpur", infoX, 21);
    doc.text("Patron: JCI Senator Dato™ Seri Dr Derek Goh BBM(L)", infoX, 24);

    doc.setTextColor(jciBlue[0], jciBlue[1], jciBlue[2]);
    doc.text("www.jcikl.cc", infoX, 28, { link: { url: "https://www.jcikl.cc" } } as any);
    doc.text("\u2022", infoX + 18, 28);
    doc.text("www.jcimalaysia.cc", infoX + 21, 28, { link: { url: "https://www.jcimalaysia.cc" } } as any);
    doc.text("\u2022", infoX + 46, 28);
    doc.text("www.jci.cc", infoX + 49, 28, { link: { url: "https://www.jci.cc" } } as any);

    // --- 2. MAIN TITLE ---
    let y = 40;
    doc.setTextColor(textMain[0], textMain[1], textMain[2]);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("PAYMENT REQUEST", 105, y, { align: "center" });
    y += 7;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`REF: ${pr.referenceNumber}`, 105, y, { align: "center" });

    y += 10;

    // --- 3. SUMMARY INFO (Applicant & Meta) ---
    doc.setTextColor(textMain[0], textMain[1], textMain[2]);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("APPLICANT DETAILS", 15, y);
    y += 4;
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.5);
    doc.line(15, y, 30, y);
    y += 8;

    // Two-column layout for details
    doc.setFontSize(9);
    doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
    doc.setFont("helvetica", "normal");

    // Left Col
    doc.text("Name", 15, y);
    doc.text("Position", 15, y + 5);

    doc.setTextColor(textMain[0], textMain[1], textMain[2]);
    doc.setFont("helvetica", "bold");
    doc.text(pr.applicantName || 'N/A', 40, y);
    doc.text(pr.applicantPosition || 'N/A', 40, y + 5);

    // Right Col
    doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
    doc.setFont("helvetica", "normal");
    doc.text("Date", 120, y);
    doc.text("Category", 120, y + 5);
    doc.text("Project", 120, y + 10);

    doc.setTextColor(textMain[0], textMain[1], textMain[2]);
    doc.setFont("helvetica", "bold");
    doc.text(pr.date || 'N/A', 145, y);
    doc.text(pr.category === 'administrative' ? 'Administrative' : 'Projects & Activities', 145, y + 5);
    const prjName = pr.category === 'administrative' ? pr.activityId : (projects.find(p => p.id === pr.activityId)?.name || pr.activityRef || 'N/A');
    const splitPrj = doc.splitTextToSize(String(prjName), 45);
    doc.text(splitPrj, 145, y + 10);

    y += 20;

    // --- 3. ITEMS TABLE ---
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("CLAIM BREAKDOWN", 15, y);
    y += 4;
    doc.line(15, y, 30, y);
    y += 8;

    // Table Header
    doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
    doc.rect(15, y, 180, 10, 'F');
    doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("No.", 20, y + 6);
    doc.text("Description / Purpose", 35, y + 6);
    doc.text("Amount (RM)", 190, y + 6, { align: "right" });
    y += 10;

    // Table Body
    doc.setTextColor(textMain[0], textMain[1], textMain[2]);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    (pr.items || []).forEach((item, idx) => {
      // Row Background (zebra)
      if (idx % 2 === 1) {
        doc.setFillColor(252, 253, 254);
        doc.rect(15, y, 180, 10, 'F');
      }
      doc.text(String(idx + 1), 20, y + 6);
      doc.text(item.purpose, 35, y + 6);
      doc.text(Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }), 190, y + 6, { align: "right" });

      // Bottom border for each row
      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
      doc.setLineWidth(0.1);
      doc.line(15, y + 10, 195, y + 10);

      y += 10;
      if (y > 250) { doc.addPage(); y = 20; }
    });

    // Total Section
    y += 5;
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(130, y, 65, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL", 135, y + 7.5);
    doc.text(formatCurrency(pr.totalAmount || pr.amount), 190, y + 7.5, { align: "right" });

    // --- FOOTER AREA: REMARKS + BANKING + GENERATED TEXT ---
    // These sections are rendered at a fixed position at the bottom of the page.
    let footerY = 200; // Start footer content from a fixed bottom area

    // --- 4. REMARKS ---
    if (pr.remark) {
      doc.setTextColor(textMain[0], textMain[1], textMain[2]);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("REMARKS", 15, footerY);
      footerY += 3;
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setLineWidth(0.5);
      doc.line(15, footerY, 30, footerY);
      footerY += 5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
      const lines = doc.splitTextToSize(pr.remark, 175);
      doc.text(lines, 15, footerY);
      footerY += lines.length * 3.5 + 5;
    }

    // --- 5. REMIT TO / BANKING ---
    doc.setTextColor(textMain[0], textMain[1], textMain[2]);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("PAYMENT METHOD", 15, footerY);
    footerY += 3;
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.5);
    doc.line(15, footerY, 30, footerY);
    footerY += 5;

    // Banking Box
    doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
    doc.rect(15, footerY, 180, 30, 'F');
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.rect(15, footerY, 180, 30, 'S');

    const labelX = 20;
    const valueX = 55;
    const splitX = 105;

    doc.setFontSize(8);
    doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
    doc.setFont("helvetica", "normal");

    // Row 1: Claim From (Horizontal)
    doc.text("Claim From", labelX, footerY + 7);
    doc.setTextColor(textMain[0], textMain[1], textMain[2]);
    doc.setFont("helvetica", "bold");
    const bankAcc = bankAccounts.find(a => a.id === pr.claimFromBankAccountId);
    doc.text(bankAcc?.name || 'N/A', valueX, footerY + 7);

    // Row 2: Bank (Horizontal)
    doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
    doc.setFont("helvetica", "normal");
    doc.text("Recipient Bank", labelX, footerY + 14);
    doc.setTextColor(textMain[0], textMain[1], textMain[2]);
    doc.setFont("helvetica", "bold");
    doc.text(pr.bankName || 'N/A', valueX, footerY + 14);

    // Row 3: Holder & Number (Vertical Stack)
    doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
    doc.setFont("helvetica", "normal");
    doc.text("Account Holder", labelX, footerY + 21);
    doc.text("Account Number", splitX, footerY + 21);

    doc.setTextColor(textMain[0], textMain[1], textMain[2]);
    doc.setFont("helvetica", "bold");
    doc.text(pr.accountHolder || 'N/A', labelX, footerY + 27);
    doc.text(pr.accountNumber || 'N/A', splitX, footerY + 27);

    // --- GENERATED BY ---
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
    doc.text(`Generated by JCI Connect Digital Finance on ${new Date().toLocaleString()}`, 105, 285, { align: "center" });
    doc.text("This is a computer-generated document and no signature is required.", 105, 289, { align: "center" });

    // --- ATTACHMENTS MERGING (Story Extension) ---
    const attachmentUrls = pr.attachmentUrls || [];
    let finalBlobUrl = '';

    if (attachmentUrls.length > 0) {
      try {
        // Convert jsPDF to ArrayBuffer
        const mainPdfBytes = doc.output('arraybuffer');
        const mergedPdf = await PDFDocument.load(mainPdfBytes);

        for (const url of attachmentUrls) {
          try {
            const resp = await fetch(url);
            const fileBytes = await resp.arrayBuffer();
            const contentType = resp.headers.get('content-type') || '';

            if (contentType.includes('pdf')) {
              const attachmentPdf = await PDFDocument.load(fileBytes);
              const copiedPages = await mergedPdf.copyPages(attachmentPdf, attachmentPdf.getPageIndices());
              copiedPages.forEach((page) => mergedPdf.addPage(page));
            } else if (contentType.includes('image')) {
              let image;
              if (contentType.includes('png')) {
                image = await mergedPdf.embedPng(fileBytes);
              } else {
                image = await mergedPdf.embedJpg(fileBytes);
              }

              const page = mergedPdf.addPage();
              const { width, height } = page.getSize();
              const imgDims = image.scaleToFit(width - 40, height - 40);
              page.drawImage(image, {
                x: width / 2 - imgDims.width / 2,
                y: height / 2 - imgDims.height / 2,
                width: imgDims.width,
                height: imgDims.height,
              });
            }
          } catch (fileErr) {
            console.warn('Failed to attach file (skipped):', url, fileErr);
          }
        }

        const finalPdfBytes = await mergedPdf.save();
        const blob = new Blob([finalPdfBytes as BlobPart], { type: 'application/pdf' });
        finalBlobUrl = URL.createObjectURL(blob);
      } catch (mergeErr) {
        console.error('PDF merging failed, falling back to basic PDF:', mergeErr);
        showToast('PDF merging failed. Generating basic PDF without attachments.', 'warning');
        finalBlobUrl = doc.output('bloburl').toString();
      }
    } else {
      finalBlobUrl = doc.output('bloburl').toString();
    }

    if (finalBlobUrl) {
      setPdfPreviewFileName(`${pr.referenceNumber || 'payment-request'}.pdf`);
      setPdfPreviewUrl(finalBlobUrl);
    }
  };

  const ListSkeleton = () => (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-[72px] bg-slate-100 rounded-xl animate-pulse" />
      ))}
    </div>
  );

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Payment Requests</h2>
          <p className="text-sm text-slate-500">Submit and track reimbursement claims</p>
        </div>
      </div>

      {successRef && (
        <Card className="p-4 bg-emerald-50 border-emerald-200">
          <div className="flex items-start gap-3">
            <CheckCircle className="text-emerald-600 shrink-0 mt-0.5" size={18} />
            <div className="min-w-0 flex-1">
              <p className="text-emerald-800 font-bold text-sm">Submitted Successfully</p>
              <p className="text-emerald-700 text-sm mt-0.5">Reference: <span className="font-mono font-bold">{successRef}</span></p>
              <p className="text-emerald-600 text-xs mt-1">Include this reference in your bank transfer memo.</p>
            </div>
            <button onClick={() => setSuccessRef(null)} className="text-emerald-400 hover:text-emerald-600 shrink-0">
              <X size={16} />
            </button>
          </div>
        </Card>
      )}

      {/* Stats chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-100 shrink-0">
          <Clock size={12} className="text-amber-500 shrink-0" />
          <span className="text-xs font-semibold text-amber-700 whitespace-nowrap">Pending</span>
          <span className="text-xs font-bold text-amber-600 whitespace-nowrap">{formatCurrency(stats.pendingAmount)}</span>
          <span className="text-[10px] text-amber-400">· {stats.pendingCount}</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 shrink-0">
          <CheckCircle size={12} className="text-emerald-500 shrink-0" />
          <span className="text-xs font-semibold text-emerald-700 whitespace-nowrap">Approved</span>
          <span className="text-xs font-bold text-emerald-600 whitespace-nowrap">{formatCurrency(stats.approvedAmount)}</span>
          <span className="text-[10px] text-emerald-400">· {stats.approvedCount}</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 shrink-0">
          <XCircle size={12} className="text-slate-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Rejected</span>
          <span className="text-xs font-bold text-slate-600">{stats.rejectedCount}</span>
        </div>
      </div>

      {/* Tabs + List */}
      <div>
        <div className="flex items-center justify-between gap-2 pb-2">
          {/* Mobile: segmented control + filter on same row */}
          <div className="md:hidden flex items-center gap-2 w-full p-1.5 bg-white rounded-xl border border-slate-200 shadow-sm">
            <Tabs
              variant="button"
              fullWidth
              tabs={[
                { id: 'my', label: 'My Requests' },
                ...(canViewFinance ? [{ id: 'all', label: 'All' }] : []),
              ]}
              activeTab={activeTab}
              onTabChange={(id) => { setActiveTab(id as 'my' | 'all'); setExpandedId(null); }}
            />
            <div className="w-28 shrink-0">
              <Select
                label=""
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as PaymentRequestStatus | '')}
                options={[
                  { value: '', label: 'All' },
                  { value: 'submitted', label: 'Pending' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'rejected', label: 'Rejected' },
                  { value: 'cancelled', label: 'Cancelled' },
                ]}
              />
            </div>
          </div>
          {/* Desktop: underline tabs */}
          <div className="hidden md:block">
            <Tabs
              tabs={[
                { id: 'my', label: 'My Applications' },
                ...(canViewFinance ? [{ id: 'all', label: 'All Applications' }] : []),
              ]}
              activeTab={activeTab}
              onTabChange={(id) => { setActiveTab(id as 'my' | 'all'); setExpandedId(null); }}
            />
          </div>
          {activeTab === 'all' && (
            <div className="hidden md:block w-36">
              <Select
                label=""
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as PaymentRequestStatus | '')}
                options={[
                  { value: '', label: 'All Statuses' },
                  { value: 'submitted', label: 'Pending' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'rejected', label: 'Rejected' },
                ]}
              />
            </div>
          )}
        </div>

        <div>
          {activeTab === 'my' ? (
            loading ? <ListSkeleton /> :
              filteredMyList.length === 0 ? (
                <div className="text-center py-14 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <FileText className="mx-auto text-slate-300 mb-3" size={36} />
                  <p className="text-slate-600 font-semibold">No payment requests yet</p>
                  <p className="text-slate-400 text-sm mt-1">Submit your first reimbursement claim</p>
                  <Button variant="ghost" size="sm" onClick={() => { setSuccessRef(null); setSubmitModalOpen(true); }} className="mt-3">
                    <Plus size={14} className="mr-1" /> Create Request
                  </Button>
                </div>
              ) : (
                <>
                  {/* Desktop table */}
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
                        {member && (
                          <tr className="group cursor-pointer hover:bg-blue-50/50 transition-colors" onClick={() => { setSuccessRef(null); setSubmitModalOpen(true); }}>
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
                        {filteredMyList.map((pr) => (
                          <React.Fragment key={pr.id}>
                            <tr
                              className={`group hover:bg-slate-50/80 transition-colors cursor-pointer ${expandedId === pr.id ? 'bg-sky-50/40' : ''}`}
                              onClick={() => setExpandedId(expandedId === pr.id ? null : pr.id)}
                            >
                              <td className="py-3 px-2 w-px whitespace-nowrap">
                                <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{pr.referenceNumber}</span>
                              </td>
                              <td className="py-3 px-2">
                                <p className="font-medium text-slate-800 truncate">{pr.purpose}</p>
                                <p className="text-xs text-slate-400 mt-0.5 truncate flex items-center gap-1">
                                  {pr.category === 'administrative'
                                    ? <><Building2 size={11} />{pr.activityId || '”'}</>
                                    : <><Sparkles size={11} className="text-orange-400" />{projects.find(p => p.id === pr.activityId)?.name || pr.activityRef || '”'}</>
                                  }
                                </p>
                              </td>
                              <td className="py-3 px-2 text-right font-bold text-jci-blue whitespace-nowrap w-px">{formatCurrency(pr.totalAmount || pr.amount)}</td>
                              <td className="py-3 px-2 text-right text-xs text-slate-500 whitespace-nowrap w-px">{new Date(pr.createdAt).toLocaleDateString()}</td>
                              <td className="py-3 px-2 w-px">
                                <div className="flex items-center gap-1.5 justify-end">
                                  <StatusBadge status={pr.status} />
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); handlePreviewPDF(pr); }} title="View PDF">
                                      <Eye size={13} />
                                    </Button>
                                    {pr.status === 'submitted' && (
                                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleCancel(pr.id); }} disabled={actioningId !== null} className="text-red-500 hover:bg-red-50" title="Cancel">
                                        <X size={13} />
                                      </Button>
                                    )}
                                    {(isDeveloper || isAdmin) && (
                                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleDeletePR(pr.id); }} disabled={actioningId !== null} className="text-red-600 hover:bg-red-50 border border-red-200" title="Delete (Dev)">
                                        <Trash2 size={13} />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                            {expandedId === pr.id && (
                              <tr className="bg-sky-50/30">
                                <td colSpan={5} className="px-4 pb-4 pt-2">
                                  <div className="grid md:grid-cols-2 gap-4">
                                    {pr.items && pr.items.length > 0 && (
                                      <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Claim Items</p>
                                        <div className="space-y-1">
                                          {pr.items.map((item, i) => (
                                            <div key={i} className="flex justify-between text-xs">
                                              <span className="text-slate-600 truncate">{item.purpose}</span>
                                              <span className="font-medium text-slate-700 ml-4 shrink-0">{formatCurrency(item.amount)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {pr.bankName && (
                                      <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Remit To</p>
                                        <p className="text-xs text-slate-600">{pr.bankName} · {pr.accountHolder}</p>
                                        <p className="text-xs font-mono text-slate-700 mt-0.5">{pr.accountNumber}</p>
                                      </div>
                                    )}
                                  </div>
                                  {pr.attachmentUrls && pr.attachmentUrls.length > 0 && (
                                    <p className="text-xs text-jci-blue mt-2.5 flex items-center gap-1">
                                      <Paperclip size={11} />
                                      {pr.attachmentUrls.length} attachment{pr.attachmentUrls.length > 1 ? 's' : ''} ” view in PDF
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

                  {/* Mobile list */}
                  <div className="md:hidden divide-y divide-slate-100">
                    {member && (
                      <div onClick={() => { setSuccessRef(null); setSubmitModalOpen(true); }}
                        className="flex items-center gap-3 py-3 text-slate-400 hover:text-jci-blue transition-colors cursor-pointer">
                        <div className="w-7 h-7 rounded border-2 border-dashed border-current flex items-center justify-center shrink-0">
                          <Plus size={13} />
                        </div>
                        <span className="text-sm font-semibold">New Request</span>
                      </div>
                    )}
                    {filteredMyList.map((pr) => (
                      <div key={pr.id}>
                        <button
                          type="button"
                          className="w-full text-left py-3 active:bg-slate-50 group"
                          onClick={() => setExpandedId(expandedId === pr.id ? null : pr.id)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <StatusBadge status={pr.status} />
                              <p className="font-medium text-slate-800 text-sm truncate">{pr.purpose}</p>
                            </div>
                            <p className="font-bold text-jci-blue text-sm shrink-0">{formatCurrency(pr.totalAmount || pr.amount)}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">{pr.referenceNumber}</span>
                            <span className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                              {pr.category === 'administrative'
                                ? <><Building2 size={10} />{pr.activityId || '”'}</>
                                : <><Sparkles size={10} className="text-orange-400" />{projects.find(p => p.id === pr.activityId)?.name || pr.activityRef || '”'}</>
                              }
                            </span>
                            <span className="text-[10px] text-slate-300 ml-auto shrink-0">{new Date(pr.createdAt).toLocaleDateString()}</span>
                          </div>
                        </button>
                        {expandedId === pr.id && (
                          <div className="pb-3 pt-1 bg-slate-50/60 rounded-lg px-3 mb-2">
                            {pr.items && pr.items.length > 0 && (
                              <div className="mb-3">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Items</p>
                                <div className="space-y-1">
                                  {pr.items.map((item, i) => (
                                    <div key={i} className="flex justify-between text-xs">
                                      <span className="text-slate-600 truncate">{item.purpose}</span>
                                      <span className="font-medium text-slate-700 ml-4 shrink-0">{formatCurrency(item.amount)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {pr.bankName && (
                              <div className="mb-3">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Remit To</p>
                                <p className="text-xs text-slate-600">{pr.bankName} · <span className="font-mono">{pr.accountNumber}</span></p>
                                <p className="text-xs text-slate-500">{pr.accountHolder}</p>
                              </div>
                            )}
                            <div className="flex gap-2">
                              <Button size="sm" variant="secondary" onClick={() => handlePreviewPDF(pr)} className="flex-1">
                                <Eye size={13} className="mr-1" /> View PDF
                              </Button>
                              {pr.status === 'submitted' && (
                                <Button size="sm" variant="ghost" onClick={() => handleCancel(pr.id)} disabled={actioningId !== null} className="text-red-500 hover:bg-red-50">
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
              )
          ) : (
            financeLoading ? <ListSkeleton /> :
              filteredFinanceList.length === 0 ? (
                <div className="text-center py-14 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <FileText className="mx-auto text-slate-300 mb-3" size={36} />
                  <p className="text-slate-600 font-semibold">No applications found</p>
                  <p className="text-slate-400 text-sm mt-1">Try adjusting your status filter</p>
                </div>
              ) : (
                <>
                  {/* Desktop table */}
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
                        {filteredFinanceList.map((pr) => (
                          <React.Fragment key={pr.id}>
                            <tr
                              className={`group hover:bg-slate-50/80 transition-colors cursor-pointer ${expandedId === pr.id ? 'bg-sky-50/40' : ''}`}
                              onClick={() => setExpandedId(expandedId === pr.id ? null : pr.id)}
                            >
                              <td className="py-3 px-2 w-px whitespace-nowrap">
                                <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{pr.referenceNumber}</span>
                              </td>
                              <td className="py-3 px-2">
                                <p className="font-medium text-slate-800 truncate">{pr.applicantName || '”'}</p>
                                <p className="text-xs text-slate-400 mt-0.5 truncate flex items-center gap-1">
                                  {pr.category === 'administrative'
                                    ? <><Building2 size={11} />{pr.activityId || '”'}</>
                                    : <><Sparkles size={11} className="text-orange-400" />{projects.find(p => p.id === pr.activityId)?.name || pr.activityRef || '”'}</>
                                  }
                                </p>
                              </td>
                              <td className="py-3 px-2 text-right font-bold text-jci-blue whitespace-nowrap w-px">{formatCurrency(pr.totalAmount || pr.amount)}</td>
                              <td className="py-3 px-2 text-right text-xs text-slate-500 whitespace-nowrap w-px">{new Date(pr.createdAt).toLocaleDateString()}</td>
                              <td className="py-3 px-2 w-px">
                                <div className="flex items-center gap-1.5 justify-end">
                                  <StatusBadge status={pr.status} />
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); handlePreviewPDF(pr); }} title="View PDF">
                                      <Eye size={13} />
                                    </Button>
                                    {pr.status === 'submitted' && (
                                      <>
                                        <Button size="sm" variant="success" onClick={(e) => { e.stopPropagation(); handleApproveReject(pr.id, 'approved'); }} disabled={actioningId !== null} title="Approve">
                                          <CheckCircle size={13} />
                                        </Button>
                                        <Button size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); handleRejectClick(pr.id); }} disabled={actioningId !== null} title="Reject">
                                          <XCircle size={13} />
                                        </Button>
                                      </>
                                    )}
                                    {pr.status === 'approved' && pr.expenseTxFailed && (
                                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleRetryExpenseTx(pr.id); }} disabled={actioningId !== null} title="Retry creating expense transaction" className="text-orange-600 border-orange-300 hover:bg-orange-50 text-[10px]">
                                        <RefreshCw size={11} className="mr-1" />Retry Tx
                                      </Button>
                                    )}
                                    {pr.status === 'cancelled' && pr.expenseTxFailed && (
                                      <span title="Expense transaction could not be deleted — finance must void it manually" className="inline-flex items-center gap-1 text-[10px] font-medium text-orange-600 border border-orange-300 rounded px-1.5 py-0.5 bg-orange-50">
                                        <RefreshCw size={10} />Orphan Tx
                                      </span>
                                    )}
                                    {pr.amountSyncFailed && (
                                      <span title="PR amount changed but expense transaction amount is out of sync — finance must update manually" className="inline-flex items-center gap-1 text-[10px] font-medium text-yellow-700 border border-yellow-300 rounded px-1.5 py-0.5 bg-yellow-50">
                                        ⚠ Amt Mismatch
                                      </span>
                                    )}
                                    {(isDeveloper || isAdmin) && (
                                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleDeletePR(pr.id); }} disabled={actioningId !== null} className="text-red-600 hover:bg-red-50 border border-red-200" title="Delete (Dev)">
                                        <Trash2 size={13} />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                            {expandedId === pr.id && (
                              <tr className="bg-sky-50/30">
                                <td colSpan={5} className="px-4 pb-4 pt-2">
                                  <div className="grid md:grid-cols-3 gap-4">
                                    {pr.items && pr.items.length > 0 && (
                                      <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Claim Items</p>
                                        <div className="space-y-1">
                                          {pr.items.map((item, i) => (
                                            <div key={i} className="flex justify-between text-xs">
                                              <span className="text-slate-600 truncate">{item.purpose}</span>
                                              <span className="font-medium ml-3 shrink-0">{formatCurrency(item.amount)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {pr.bankName && (
                                      <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bank Details</p>
                                          <CopyButton text={`${pr.bankName}\n${pr.accountHolder}\n${pr.accountNumber}`} label="Copy All" />
                                        </div>
                                        <div className="space-y-1.5 text-xs">
                                          <div className="flex justify-between items-center gap-2">
                                            <span className="text-slate-400 shrink-0">Bank</span>
                                            <span className="font-medium text-slate-700 flex items-center gap-1 truncate">{pr.bankName} <CopyButton text={pr.bankName || ''} /></span>
                                          </div>
                                          <div className="flex justify-between items-center gap-2">
                                            <span className="text-slate-400 shrink-0">Holder</span>
                                            <span className="font-medium text-slate-700 flex items-center gap-1 truncate">{pr.accountHolder} <CopyButton text={pr.accountHolder || ''} /></span>
                                          </div>
                                          <div className="flex justify-between items-center gap-2">
                                            <span className="text-slate-400 shrink-0">A/C No</span>
                                            <span className="font-mono font-bold text-slate-700 flex items-center gap-1">{pr.accountNumber} <CopyButton text={pr.accountNumber || ''} /></span>
                                          </div>
                                          <div className="flex justify-between items-center gap-2">
                                            <span className="text-slate-400 shrink-0">Claim From</span>
                                            <span className="font-medium text-slate-700 truncate">{bankAccounts.find(a => a.id === pr.claimFromBankAccountId)?.name || '”'}</span>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                    {pr.remark && (
                                      <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Remark</p>
                                        <p className="text-xs text-slate-600 whitespace-pre-wrap">{pr.remark}</p>
                                      </div>
                                    )}
                                  </div>
                                  {pr.attachmentUrls && pr.attachmentUrls.length > 0 && (
                                    <p className="text-xs text-jci-blue mt-2.5 flex items-center gap-1">
                                      <Paperclip size={11} />
                                      {pr.attachmentUrls.length} attachment{pr.attachmentUrls.length > 1 ? 's' : ''} ” view in PDF
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

                  {/* Mobile list */}
                  <div className="md:hidden divide-y divide-slate-100">
                    {filteredFinanceList.map((pr) => (
                      <div key={pr.id}>
                        <button
                          type="button"
                          className="w-full text-left py-3 active:bg-slate-50"
                          onClick={() => setExpandedId(expandedId === pr.id ? null : pr.id)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <StatusBadge status={pr.status} />
                              <p className="font-medium text-slate-800 text-sm truncate">{pr.applicantName || '”'}</p>
                            </div>
                            <p className="font-bold text-jci-blue text-sm shrink-0">{formatCurrency(pr.totalAmount || pr.amount)}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">{pr.referenceNumber}</span>
                            <span className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                              {pr.category === 'administrative'
                                ? <><Building2 size={10} />{pr.activityId || '”'}</>
                                : <><Sparkles size={10} className="text-orange-400" />{projects.find(p => p.id === pr.activityId)?.name || pr.activityRef || '”'}</>
                              }
                            </span>
                            <span className="text-[10px] text-slate-300 ml-auto shrink-0">{new Date(pr.createdAt).toLocaleDateString()}</span>
                          </div>
                        </button>
                        {expandedId === pr.id && (
                          <div className="pb-3 pt-1 bg-slate-50/60 rounded-lg px-3 mb-2">
                            {pr.bankName && (
                              <div className="mb-3">
                                <div className="flex items-center justify-between mb-1.5">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bank Details</p>
                                  <CopyButton text={`${pr.bankName}\n${pr.accountHolder}\n${pr.accountNumber}`} label="Copy All" />
                                </div>
                                <div className="bg-white rounded-lg border border-slate-200 p-2.5 space-y-1.5 text-xs">
                                  <div className="flex justify-between items-center">
                                    <span className="text-slate-400">Bank</span>
                                    <span className="font-medium text-slate-700 flex items-center gap-1">{pr.bankName} <CopyButton text={pr.bankName || ''} /></span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-slate-400">Holder</span>
                                    <span className="font-medium text-slate-700 flex items-center gap-1">{pr.accountHolder} <CopyButton text={pr.accountHolder || ''} /></span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-slate-400">A/C No</span>
                                    <span className="font-mono font-bold text-slate-700 flex items-center gap-1">{pr.accountNumber} <CopyButton text={pr.accountNumber || ''} /></span>
                                  </div>
                                </div>
                              </div>
                            )}
                            {pr.items && pr.items.length > 0 && (
                              <div className="mb-3">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Items</p>
                                <div className="space-y-1">
                                  {pr.items.map((item, i) => (
                                    <div key={i} className="flex justify-between text-xs">
                                      <span className="text-slate-600 truncate">{item.purpose}</span>
                                      <span className="font-medium ml-4 shrink-0">{formatCurrency(item.amount)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="flex gap-2">
                              <Button size="sm" variant="secondary" onClick={() => handlePreviewPDF(pr)}>
                                <Eye size={13} className="mr-1" /> PDF
                              </Button>
                              {pr.status === 'submitted' && (
                                <>
                                  <Button size="sm" variant="success" onClick={() => handleApproveReject(pr.id, 'approved')} disabled={actioningId !== null} className="flex-1">Approve</Button>
                                  <Button size="sm" variant="danger" onClick={() => handleRejectClick(pr.id)} disabled={actioningId !== null} className="flex-1">Reject</Button>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )
          )}
        </div>
      </div>

      {/* PDF Preview Modal */}
      <Modal
        isOpen={!!pdfPreviewUrl}
        onClose={() => { setPdfPreviewUrl(null); }}
        title={
          <div className="flex items-center gap-2 text-slate-700">
            <div className="bg-slate-100 p-2 rounded-lg">
              <FileText size={18} className="text-slate-500" />
            </div>
            <span className="font-bold text-base truncate">{pdfPreviewFileName}</span>
          </div>
        }
        size="2xl"
        footer={
          <div className="flex justify-between items-center w-full">
            <Button variant="ghost" onClick={() => setPdfPreviewUrl(null)}>Close</Button>
            <a href={pdfPreviewUrl || '#'} download={pdfPreviewFileName}>
              <Button>
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                Download PDF
              </Button>
            </a>
          </div>
        }
      >
        <div className="w-full" style={{ height: '70vh' }}>
          <iframe
            src={pdfPreviewUrl || ''}
            className="w-full h-full rounded border border-slate-200"
            title="PDF Preview"
          />
        </div>
      </Modal>

      <SubmitPaymentRequestModal
        isOpen={submitModalOpen}
        onClose={() => setSubmitModalOpen(false)}
        preselectedProjectId={submitPreselectedProjectId}
        preselectedCategory={submitPreselectedCategory}
        onSuccess={(ref) => { setSuccessRef(ref); loadMyList(); }}
      />

      {/* Rejection reason dialog */}
      <Modal isOpen={!!rejectDialogId} onClose={() => setRejectDialogId(null)} title="Reject Payment Request">
        <div className="space-y-4 p-1">
          <p className="text-sm text-slate-600">Please provide a reason for rejecting this payment request. The applicant will be notified.</p>
          <textarea
            className="w-full border border-slate-300 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-400"
            rows={3}
            placeholder="e.g. Missing receipts, incorrect amount, out of budget…"
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setRejectDialogId(null)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={handleRejectConfirm} disabled={actioningId !== null || !rejectReason.trim()}>
              Confirm Reject
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
