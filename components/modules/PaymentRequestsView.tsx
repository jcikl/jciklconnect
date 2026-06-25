// Payment Requests – submit, my applications, finance list and review
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, RefreshCw, CheckCircle, XCircle, Search, X, FileText, Download, Trash2, Eye, Clock, Copy, Check, Landmark, DollarSign, Paperclip, Sparkles, Building2, User } from 'lucide-react';
import { Button, Card, Modal, useToast, Tabs, Badge } from '../ui/Common';
import { Input, Select } from '../ui/Form';
import { Combobox } from '../ui/Combobox';
import { MemberSelector } from '../ui/MemberSelector';
import { FirstUseBanner } from '../ui/FirstUseBanner';
import { useHelpModal } from '../../contexts/HelpModalContext';
import { LoadingState } from '../ui/Loading';
import { PaymentRequestService } from '../../services/paymentRequestService';
import { getAdministrativeProjectIds } from '../../utils/administrativeProjectsStorage';
import { FinanceService } from '../../services/financeService';
import { ProjectsService } from '../../services/projectsService';
import { PaymentRequest, PaymentRequestStatus, PaymentRequestItem, BankAccount, Project } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { useMembers } from '../../hooks/useMembers';
import { DEFAULT_LO_ID } from '../../config/constants';
import { formatCurrency } from '../../utils/formatUtils';
import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../config/firebase';
import imageCompression from 'browser-image-compression';

const STATUS_LABEL: Record<PaymentRequestStatus, string> = {
  draft: 'Draft',
  submitted: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

const CopyButton: React.FC<{ text: string; label?: string }> = ({ text, label }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
  const { hasPermission, isActivityFinance } = usePermissions();
  const [myList, setMyList] = useState<PaymentRequest[]>([]);
  const [financeList, setFinanceList] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'my' | 'all'>('my');
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form States
  const [formApplicantId, setFormApplicantId] = useState<string>('');
  const [formApplicantName, setFormApplicantName] = useState('');
  const [formApplicantEmail, setFormApplicantEmail] = useState('');
  const [formApplicantPosition, setFormApplicantPosition] = useState('');
  const [formCategory, setFormCategory] = useState<'administrative' | 'projects_activities'>('administrative');
  const [formActivityId, setFormActivityId] = useState('');
  const [formRemark, setFormRemark] = useState('');
  const [formItems, setFormItems] = useState<PaymentRequestItem[]>([{ purpose: '', amount: 0 }]);
  const [formClaimFromBankAccountId, setFormClaimFromBankAccountId] = useState('');
  const [formBankName, setFormBankName] = useState('');
  const [formAccountHolder, setFormAccountHolder] = useState('');
  const [formAccountNumber, setFormAccountNumber] = useState('');
  const [formAttachments, setFormAttachments] = useState<File[]>([]);

  // Data for Selects
  const [projects, setProjects] = useState<Project[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [adminAccountOptions, setAdminAccountOptions] = useState<string[]>([]);

  const [successRef, setSuccessRef] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [searchRef, setSearchRef] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentRequestStatus | ''>('');

  const canViewFinance = hasPermission('canViewFinance');
  const loId = (member as { loId?: string })?.loId ?? DEFAULT_LO_ID;
  const activityRefFilter = isActivityFinance ? (member as { activityFinanceActivityId?: string | null })?.activityFinanceActivityId ?? null : null;

  const { members: memberOptions } = useMembers(loId);

  // Load Initial Data
  useEffect(() => {
    const loadSelectData = async () => {
      try {
        const prjList = await ProjectsService.getAllProjects();
        setProjects(prjList);
      } catch (err) {
        console.error('Failed to load projects:', err);
      }

      // Load bank accounts for the "Claim From" dropdown in the form
      try {
        const accounts = await FinanceService.getAllBankAccounts(false);
        setBankAccounts(accounts);
      } catch (err) {
        console.error('Failed to load bank accounts:', err);
      }
    };
    if (member) loadSelectData();
  }, [member]);

  // Pre-fill applicant details and load saved bank details from localStorage
  useEffect(() => {
    if (submitModalOpen && (user || member)) {
      setFormApplicantName(member?.name || user?.displayName || '');
      setFormApplicantEmail(user?.email || '');
      
      const savedBankName = localStorage.getItem('pr_bank_name');
      const savedAccountHolder = localStorage.getItem('pr_account_holder');
      const savedAccountNumber = localStorage.getItem('pr_account_number');
      const savedClaimFromBankAccountId = localStorage.getItem('pr_claim_from_bank_account_id');
      const savedPosition = localStorage.getItem('pr_applicant_position');

      if (savedBankName) setFormBankName(savedBankName);
      if (savedAccountHolder) setFormAccountHolder(savedAccountHolder);
      if (savedAccountNumber) setFormAccountNumber(savedAccountNumber);
      if (savedClaimFromBankAccountId) setFormClaimFromBankAccountId(savedClaimFromBankAccountId);
      if (savedPosition) setFormApplicantPosition(savedPosition);
    }
  }, [submitModalOpen, user, member]);

  // Load admin account options when modal opens
  useEffect(() => {
    const loadAdminAccounts = async () => {
      if (!submitModalOpen) return;
      try {
        const accounts = new Set<string>(getAdministrativeProjectIds());
        const allTx = await FinanceService.getAllTransactions();
        allTx.forEach(t => {
          if (t.category === 'Administrative' && t.projectId && t.projectId.trim() !== '') {
            accounts.add(t.projectId.trim());
          }
        });
        setAdminAccountOptions(Array.from(accounts).sort());
      } catch (e) {
        console.error('Failed to load admin account options:', e);
      }
    };
    loadAdminAccounts();
  }, [submitModalOpen]);

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
    if (!term) return myList;

    return myList.filter(pr => {
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
  }, [myList, searchQuery, projects, bankAccounts]);

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

  const addItem = () => {
    setFormItems([...formItems, { purpose: '', amount: 0 }]);
  };

  const removeItem = (index: number) => {
    if (formItems.length > 1) {
      setFormItems(formItems.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, updates: Partial<PaymentRequestItem>) => {
    const newItems = [...formItems];
    newItems[index] = { ...newItems[index], ...updates };
    setFormItems(newItems);
  };

  const totalAmount = formItems.reduce((sum, item) => sum + (item.amount || 0), 0);

  const handlePreviewPDF = async (pr: PaymentRequest) => {
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
    doc.text("Patron: JCI Senator Dato’ Seri Dr Derek Goh BBM(L)", infoX, 24);

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
            console.error('Failed to attach file:', url, fileErr);
            showToast(`Failed to load an attachment (CORS or Network error)`, 'error');
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
      window.open(finalBlobUrl, '_blank');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formItems.some(item => !item.purpose || item.amount <= 0)) {
      showToast('Please fill all item descriptions and amounts', 'error');
      return;
    }

    if (formCategory === 'projects_activities' && !formActivityId) {
      showToast('Please select a project/activity', 'error');
      return;
    }

    if (!user?.uid || !member) {
      showToast('Please log in first', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const now = new Date();
      const applicantId = formApplicantId || user.uid;

      const payload: Omit<PaymentRequest, 'id' | 'createdAt' | 'updatedAt' | 'referenceNumber'> = {
        applicantId,
        applicantName: formApplicantName,
        applicantEmail: formApplicantEmail,
        applicantPosition: formApplicantPosition,
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0],
        category: formCategory,
        activityId: formActivityId || null,
        totalAmount: totalAmount,
        remark: formRemark,
        items: formItems,
        claimFromBankAccountId: formClaimFromBankAccountId || null,
        bankName: formBankName,
        accountHolder: formAccountHolder,
        accountNumber: formAccountNumber,
        // Legacy
        amount: totalAmount,
        purpose: formItems[0].purpose,
        activityRef: formActivityId || null,
        status: 'submitted',
        loId,
      };

      // Handle Attachments
      const attachmentUrls: string[] = [];
      if (formAttachments.length > 0) {
        for (const file of formAttachments) {
          let fileToUpload = file;

          // Compress image if it's an image file
          if (file.type.startsWith('image/')) {
            try {
              const options = {
                maxSizeMB: 1, // Compress down to max 1MB
                maxWidthOrHeight: 1920,
                useWebWorker: true,
              };
              const compressedFile = await imageCompression(file, options);
              // browser-image-compression returns a File/Blob. Reconstruct File object to maintain original name
              fileToUpload = new File([compressedFile], file.name, {
                type: compressedFile.type,
                lastModified: Date.now(),
              });
            } catch (error) {
              console.error('Image compression failed, using original file:', error);
            }
          }

          const fileRef = ref(storage, `payment-requests/${loId}/${Date.now()}_${fileToUpload.name}`);
          const snapshot = await uploadBytes(fileRef, fileToUpload);
          const url = await getDownloadURL(snapshot.ref);
          attachmentUrls.push(url);
        }
      }

      const { referenceNumber } = await PaymentRequestService.create({
        ...payload,
        attachmentUrls
      }, user.uid);

      // Save details to localStorage for future requests
      localStorage.setItem('pr_bank_name', formBankName);
      localStorage.setItem('pr_account_holder', formAccountHolder);
      localStorage.setItem('pr_account_number', formAccountNumber);
      localStorage.setItem('pr_claim_from_bank_account_id', formClaimFromBankAccountId || '');
      localStorage.setItem('pr_applicant_position', formApplicantPosition);

      setSuccessRef(referenceNumber);
      setSubmitModalOpen(false);

      // Reset form
      setFormItems([{ purpose: '', amount: 0 }]);
      setFormRemark('');
      setFormActivityId('');
      setFormApplicantPosition('');
      setFormBankName('');
      setFormAccountHolder('');
      setFormAccountNumber('');
      setFormClaimFromBankAccountId('');
      setFormAttachments([]);

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
          <p className="text-slate-500">Submit claims and manage reimbursement requests</p>
        </div>
        {member && (
          <>
            {/* Desktop Button */}
            <div className="hidden sm:block">
              <Button onClick={() => { setSuccessRef(null); setSubmitModalOpen(true); }}>
                <Plus size={18} className="mr-1" /> New Payment Request
              </Button>
            </div>

            {/* Mobile Floating Action Button (FAB) */}
            <div className="sm:hidden fixed bottom-24 right-6 z-40">
              <button
                onClick={() => { setSuccessRef(null); setSubmitModalOpen(true); }}
                className="w-14 h-14 rounded-full bg-jci-blue text-white shadow-[0_8px_30px_rgb(0,151,215,0.4)] flex items-center justify-center hover:scale-110 active:scale-90 transition-all duration-200 border-none outline-none"
                aria-label="New Payment Request"
              >
                <Plus size={28} />
              </button>
            </div>
          </>
        )}
      </div>

      {successRef && (
        <Card className="p-4 bg-green-50 border-green-200">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="text-green-600" size={18} />
            <p className="text-green-800 font-bold">Submitted Successfully</p>
          </div>
          <p className="text-green-700 text-sm">Reference Number: <span className="font-mono font-bold">{successRef}</span></p>
          <p className="text-green-600 text-xs mt-1 italic">Please include this reference in your bank transfer memo for faster reconciliation.</p>
        </Card>
      )}
      {/* Stats Summary Panel */}
      <Card className="bg-slate-50 border-slate-200/80 p-3 sm:p-4">
        <div className="grid grid-cols-3 divide-x divide-slate-200 text-center">
          <div className="px-1 sm:px-4">
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">Pending</p>
            <h3 className="text-sm sm:text-lg md:text-xl font-bold text-amber-600 mt-1 truncate">{formatCurrency(stats.pendingAmount)}</h3>
            <p className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 truncate">{stats.pendingCount} active</p>
          </div>
          <div className="px-1 sm:px-4">
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">Approved</p>
            <h3 className="text-sm sm:text-lg md:text-xl font-bold text-emerald-600 mt-1 truncate">{formatCurrency(stats.approvedAmount)}</h3>
            <p className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 truncate">{stats.approvedCount} completed</p>
          </div>
          <div className="px-1 sm:px-4">
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">Rejected</p>
            <h3 className="text-sm sm:text-lg md:text-xl font-bold text-slate-600 mt-1 truncate">{stats.rejectedCount}</h3>
            <p className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 truncate">Needs revision</p>
          </div>
        </div>
      </Card>

      <Card noPadding>
        <div className="p-4">
          <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 border-b border-slate-100 pb-3 mb-4">
            <div className="flex-1">
              <Tabs
                tabs={[
                  { id: 'my', label: 'My Applications' },
                  ...(canViewFinance ? [{ id: 'all', label: 'All Applications (Finance)' }] : []),
                ]}
                activeTab={activeTab}
                onTabChange={(id) => setActiveTab(id as 'my' | 'all')}
              />
            </div>

            {activeTab === 'all' && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Filter Status:</span>
                <div className="w-40">
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
              </div>
            )}
          </div>

          <div className="mt-4">
            {activeTab === 'my' ? (
              loading ? <LoadingState loading={true}><span /></LoadingState> :
                myList.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <FileText className="mx-auto text-slate-300 mb-2" size={32} />
                    <p className="text-slate-500 font-medium">No payment requests found</p>
                    <Button variant="ghost" size="sm" onClick={() => setSubmitModalOpen(true)} className="mt-2">Create your first request</Button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {filteredMyList.map((pr) => (
                      <Card key={pr.id} noPadding className="border border-slate-150 p-4 hover:border-jci-blue/30 hover:shadow-sm transition-all duration-300 bg-white">
                        <div className="flex flex-col md:flex-row justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 justify-between">
                              <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded transition-colors">{pr.referenceNumber}</span>
                              <StatusBadge status={pr.status} />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-800 text-base">{pr.purpose}</h4>
                              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                                {pr.category === 'administrative' ? (
                                  <>
                                    <Building2 size={13} className="text-slate-400" />
                                    <span>Admin Account: <strong className="text-slate-700">{pr.activityId || 'N/A'}</strong></span>
                                  </>
                                ) : (
                                  <>
                                    <Sparkles size={13} className="text-orange-400" />
                                    <span>Project: <strong className="text-slate-700">{projects.find(p => p.id === pr.activityId)?.name || pr.activityRef || 'N/A'}</strong></span>
                                  </>
                                )}
                              </p>
                              {pr.bankName && (
                                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                  <Landmark size={12} className="text-slate-400" />
                                  <span>Remit: {pr.bankName} ({pr.accountHolder}) - {pr.accountNumber}</span>
                                </p>
                              )}
                              {pr.items && pr.items.length > 0 && (
                                <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg mt-2 space-y-1 border border-slate-100">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Items Summary:</span>
                                  {pr.items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between">
                                      <span className="truncate max-w-[200px] sm:max-w-xs">{item.purpose}</span>
                                      <span className="font-medium text-slate-700">{formatCurrency(item.amount)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider pt-1">
                              <span>Requested on {new Date(pr.createdAt).toLocaleDateString()}</span>
                              {pr.attachmentUrls && pr.attachmentUrls.length > 0 && (
                                <span className="flex items-center gap-0.5 text-jci-blue bg-sky-50 px-1.5 py-0.5 rounded">
                                  <Paperclip size={10} />
                                  {pr.attachmentUrls.length} Attachment{pr.attachmentUrls.length === 1 ? '' : 's'}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-3 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-4">
                            <div className="text-right">
                              <span className="block text-xs text-slate-400 uppercase tracking-wider font-semibold">Total Amount</span>
                              <span className="text-2xl font-bold text-jci-blue">{formatCurrency(pr.totalAmount || pr.amount)}</span>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="secondary" onClick={() => handlePreviewPDF(pr)}>
                                <Eye size={14} className="mr-1" /> View PDF
                              </Button>
                              {pr.status === 'submitted' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleCancel(pr.id)}
                                  disabled={actioningId !== null}
                                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                >
                                  <X size={14} className="mr-1" /> Cancel
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )
            ) : (
              financeLoading ? <LoadingState loading={true}><span /></LoadingState> :
                financeList.length === 0 ? (
                  <p className="text-center py-8 text-slate-500">No applications matching filters</p>
                ) : (
                  <div className="grid gap-3">
                    {filteredFinanceList.map((pr) => (
                      <Card key={pr.id} noPadding className="p-4 border border-slate-150 hover:border-slate-305 hover:shadow-sm transition-all duration-300 bg-white">
                        <div className="flex flex-col md:flex-row justify-between gap-4">
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex items-center gap-2 justify-between flex-wrap">
                              <span className="font-mono font-bold text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{pr.referenceNumber}</span>
                              <StatusBadge status={pr.status} />
                            </div>
                            <div>
                              <h5 className="font-bold text-slate-800 text-base">{pr.purpose}</h5>
                              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                                {pr.category === 'administrative' ? (
                                  <>
                                    <Building2 size={13} className="text-slate-400" />
                                    <span>Admin Account: <strong className="text-slate-700">{pr.activityId || 'N/A'}</strong></span>
                                  </>
                                ) : (
                                  <>
                                    <Sparkles size={13} className="text-orange-400" />
                                    <span>Project: <strong className="text-slate-700">{projects.find(p => p.id === pr.activityId)?.name || pr.activityRef || 'N/A'}</strong></span>
                                  </>
                                )}
                              </p>
                              <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1.5">
                                <User size={13} className="text-slate-400" />
                                <span>Applicant: <strong className="text-slate-700">{pr.applicantName || 'Unknown'}</strong> ({pr.applicantPosition || 'N/A'})</span>
                              </div>
                            </div>

                            {/* Bank Details section for easy copying */}
                            {pr.bankName && (
                              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 mt-2 space-y-1.5">
                                <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider border-b border-slate-150 pb-1">
                                  <span>Remittance Bank Details</span>
                                  <CopyButton text={`${pr.bankName}\n${pr.accountHolder}\n${pr.accountNumber}`} label="Copy All Info" />
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                  <div>
                                    <span className="text-slate-400">Bank:</span>{' '}
                                    <span className="font-medium text-slate-700">{pr.bankName}</span>
                                    <span className="ml-1"><CopyButton text={pr.bankName || ''} /></span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400">Claim From Account:</span>{' '}
                                    <span className="font-medium text-slate-700">
                                      {bankAccounts.find(a => a.id === pr.claimFromBankAccountId)?.name || 'N/A'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400">Holder:</span>{' '}
                                    <span className="font-medium text-slate-700">{pr.accountHolder}</span>
                                    <span className="ml-1"><CopyButton text={pr.accountHolder || ''} /></span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400">A/C No:</span>{' '}
                                    <span className="font-mono font-bold text-slate-700">{pr.accountNumber}</span>
                                    <span className="ml-1"><CopyButton text={pr.accountNumber || ''} /></span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {pr.items && pr.items.length > 0 && (
                              <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg mt-2 space-y-1 border border-slate-100">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Items Summary:</span>
                                {pr.items.map((item, idx) => (
                                  <div key={idx} className="flex justify-between">
                                    <span className="truncate max-w-[200px] sm:max-w-xs">{item.purpose}</span>
                                    <span className="font-medium text-slate-700">{formatCurrency(item.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider pt-1">
                              <span>Requested on {new Date(pr.createdAt).toLocaleDateString()}</span>
                              {pr.attachmentUrls && pr.attachmentUrls.length > 0 && (
                                <span className="flex items-center gap-0.5 text-jci-blue bg-sky-50 px-1.5 py-0.5 rounded">
                                  <Paperclip size={10} />
                                  {pr.attachmentUrls.length} Attachment{pr.attachmentUrls.length === 1 ? '' : 's'}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-3 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-4">
                            <div className="text-right">
                              <span className="block text-xs text-slate-400 uppercase tracking-wider font-semibold">Total Amount</span>
                              <span className="text-2xl font-bold text-jci-blue">{formatCurrency(pr.totalAmount || pr.amount)}</span>
                            </div>
                            <div className="flex gap-2 items-center">
                              <Button size="sm" variant="secondary" onClick={() => handlePreviewPDF(pr)} title="View PDF">
                                <Eye size={14} className="mr-1" /> PDF
                              </Button>
                              {pr.status === 'submitted' && (
                                <div className="flex gap-1.5">
                                  <Button size="sm" variant="success" onClick={() => handleApproveReject(pr.id, 'approved')} disabled={actioningId !== null}>Approve</Button>
                                  <Button size="sm" variant="danger" onClick={() => handleApproveReject(pr.id, 'rejected')} disabled={actioningId !== null}>Reject</Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )
            )}
          </div>
        </div>
      </Card>

      <Modal
        isOpen={submitModalOpen}
        onClose={() => setSubmitModalOpen(false)}
        title={
          <div className="flex items-center gap-2 text-jci-blue">
            <div className="bg-sky-100 p-2 rounded-lg">
              <FileText size={20} className="text-jci-blue w-5 h-5" />
            </div>
            <span className="font-bold text-lg">Submit Payment Request</span>
          </div>
        }
        size="2xl"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button type="button" variant="secondary" onClick={() => setSubmitModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" form="payment-request-form" disabled={submitting} className="min-w-[120px]">
              {submitting ? (
                <>
                  <RefreshCw size={16} className="mr-2 animate-spin" />
                  Submitting...
                </>
              ) : 'Submit Request'}
            </Button>
          </div>
        }
      >
        <div className="bg-sky-50 p-4 rounded-xl border border-sky-100 mb-6 flex items-start gap-3">
          <Sparkles className="text-jci-blue mt-0.5 shrink-0" size={18} />
          <div>
            <p className="text-sm font-semibold text-sky-900">Tips for Faster Reimbursement</p>
            <p className="text-xs text-sky-700/90 mt-0.5">Please provide detailed itemization. You can upload multiple receipts as PDF or image files. For mileage claims, please consult the treasurer for the standard rate.</p>
          </div>
        </div>

        <form id="payment-request-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <MemberSelector
              label="Applicant"
              members={memberOptions}
              value={formApplicantId}
              onChange={(id) => {
                setFormApplicantId(id);
                const sel = memberOptions.find(m => m.id === id);
                if (sel) {
                  setFormApplicantName(sel.name);
                  setFormApplicantEmail(sel.email);
                } else if (id === '') {
                  setFormApplicantName(member?.name || user?.displayName || '');
                  setFormApplicantEmail(user?.email || '');
                }
              }}
              selfOption
              selfLabel="Self"
              placeholder="Select applicant..."
            />
            <Input
              label="Applicant Position"
              value={formApplicantPosition}
              onChange={(e) => setFormApplicantPosition(e.target.value)}
              placeholder="e.g. Project Lead / Secretary"
              required
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => { setFormCategory('administrative'); setFormActivityId(''); }}
                  className={`flex-1 py-1.5 px-2 text-sm font-medium rounded-md transition-all ${formCategory === 'administrative' ? 'bg-white text-jci-blue shadow-sm border border-slate-200/50' : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  Administrative
                </button>
                <button
                  type="button"
                  onClick={() => { setFormCategory('projects_activities'); setFormActivityId(''); }}
                  className={`flex-1 py-1.5 px-2 text-sm font-medium rounded-md transition-all ${formCategory === 'projects_activities' ? 'bg-white text-jci-blue shadow-sm border border-slate-200/50' : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  Projects & Activities
                </button>
              </div>
            </div>
            {formCategory === 'projects_activities' ? (
              <Select
                label="Associated Project"
                value={formActivityId}
                onChange={(e) => setFormActivityId(e.target.value)}
                options={[
                  { value: '', label: 'Select a project...' },
                  ...projects.map(p => ({ value: p.id, label: p.name })),
                ]}
                required
              />
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Admin Account</label>
                <Combobox
                  options={adminAccountOptions}
                  value={formActivityId}
                  onChange={(value) => setFormActivityId(value)}
                  placeholder="Select or type admin account..."
                />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-slate-900">Request Items</h4>
              <Button type="button" size="sm" variant="secondary" onClick={addItem}>
                <Plus size={14} className="mr-1" /> Add Item
              </Button>
            </div>

            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
              {formItems.map((item, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-white p-3 rounded-lg border border-slate-100 shadow-sm w-full">
                  <div className="flex-1 w-full">
                    <Input
                      label={`Item #${idx + 1} Description`}
                      value={item.purpose}
                      onChange={(e) => updateItem(idx, { purpose: e.target.value })}
                      placeholder="e.g. Venue rental, printing, materials..."
                      required
                    />
                  </div>
                  <div className="w-full sm:w-36">
                    <Input
                      label="Amount (RM)"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.amount || ''}
                      onChange={(e) => updateItem(idx, { amount: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  {formItems.length > 1 && (
                    <Button type="button" variant="ghost" className="text-red-500 self-end sm:self-center p-2 hover:bg-red-50 rounded-lg mt-4 sm:mt-5" onClick={() => removeItem(idx)}>
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
              ))}
              <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Total Claim Amount</span>
                <span className="text-xl font-bold text-jci-blue">{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t pt-4">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                <Paperclip size={18} className="text-slate-500" />
                <span>Attachments (Receipts / Invoices)</span>
              </h4>
              <span className="text-xs text-slate-400">Images or PDF only</span>
            </div>
            
            <div className="p-6 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 hover:border-jci-blue hover:bg-blue-50/20 transition-all cursor-pointer relative">
              <input
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={(e) => {
                  if (e.target.files) {
                    setFormAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
                  }
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                id="file-upload"
              />
              <div className="flex flex-col items-center justify-center text-center">
                <Paperclip size={28} className="text-slate-400 mb-2" />
                <span className="text-sm font-semibold text-slate-700">Drag files here or click to upload</span>
                <span className="text-xs text-slate-400 mt-1">Images or PDFs up to 5MB</span>
              </div>
            </div>

            {formAttachments.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {formAttachments.map((file, idx) => {
                  const isImage = file.type.startsWith('image/');
                  const fileUrl = isImage ? URL.createObjectURL(file) : null;
                  return (
                    <div key={idx} className="relative group bg-white p-2 rounded-lg border border-slate-200 flex flex-col items-center shadow-sm">
                      {isImage && fileUrl ? (
                        <img src={fileUrl} className="w-full h-20 object-cover rounded" alt={file.name} onLoad={() => URL.revokeObjectURL(fileUrl)} />
                      ) : (
                        <div className="w-full h-20 bg-slate-100 flex items-center justify-center rounded">
                          <FileText size={32} className="text-red-500" />
                        </div>
                      )}
                      <span className="text-[10px] text-slate-600 truncate w-full text-center mt-1.5 font-medium px-1">{file.name}</span>
                      <span className="text-[9px] text-slate-400 mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                      <button
                        type="button"
                        onClick={() => setFormAttachments(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute -top-1.5 -right-1.5 bg-red-100 text-red-600 hover:bg-red-200 p-1 rounded-full shadow-md transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-4 border-t pt-4">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <Landmark size={18} className="text-slate-500" />
              <span>Payment Details (Remit to)</span>
            </h4>
            <div className="grid md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <Select
                label="Claim From JCI Account"
                value={formClaimFromBankAccountId}
                onChange={(e) => setFormClaimFromBankAccountId(e.target.value)}
                options={[
                  { value: '', label: 'Select JCI Account...' },
                  ...bankAccounts.map(a => ({ value: a.id, label: a.name })),
                ]}
                required
              />
              <Input
                label="Your Recipient Bank Name"
                value={formBankName}
                onChange={(e) => setFormBankName(e.target.value)}
                placeholder="e.g. Maybank, CIMB, Public Bank"
                required
              />
              <Input
                label="Your Account Holder Name"
                value={formAccountHolder}
                onChange={(e) => setFormAccountHolder(e.target.value)}
                placeholder="Must match bank record"
                required
              />
              <Input
                label="Your Bank Account Number"
                value={formAccountNumber}
                onChange={(e) => setFormAccountNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="Number only (no dashes)"
                inputMode="numeric"
                required
              />
            </div>
          </div>

          <Input
            label="Remark / Special Instructions (Optional)"
            value={formRemark}
            onChange={(e) => setFormRemark(e.target.value)}
            placeholder="Add any additional notes here..."
          />

        </form>
      </Modal>
    </div>
  );
};
