// Payment Requests – submit, my applications, finance list and review
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, RefreshCw, CheckCircle, XCircle, Search, X, FileText, Download, Trash2, Eye } from 'lucide-react';
import { Button, Card, Modal, useToast, Tabs, Badge } from '../ui/Common';
import { Input, Select } from '../ui/Form';
import { MemberSelector } from '../ui/MemberSelector';
import { FirstUseBanner } from '../ui/FirstUseBanner';
import { useHelpModal } from '../../contexts/HelpModalContext';
import { LoadingState } from '../ui/Loading';
import { PaymentRequestService } from '../../services/paymentRequestService';
import { FinanceService } from '../../services/financeService';
import { ProjectsService } from '../../services/projectsService';
import { PaymentRequest, PaymentRequestStatus, PaymentRequestItem, BankAccount, Project } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { useMembers } from '../../hooks/useMembers';
import { DEFAULT_LO_ID } from '../../config/constants';
import { formatCurrency } from '../../utils/formatUtils';
import { jsPDF } from 'jspdf';

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

  // Data for Selects
  const [projects, setProjects] = useState<Project[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

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

  // Pre-fill applicant details
  useEffect(() => {
    if (submitModalOpen && (user || member)) {
      setFormApplicantName(member?.name || user?.displayName || '');
      setFormApplicantEmail(user?.email || '');
      // Try to find current position if any
    }
  }, [submitModalOpen, user, member]);

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

    const blobUrl = doc.output('bloburl');
    window.open(blobUrl, '_blank');
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

      const { referenceNumber } = await PaymentRequestService.create(payload, user.uid);

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
          <Button onClick={() => { setSuccessRef(null); setSubmitModalOpen(true); }}>
            <Plus size={18} className="mr-1" /> New Payment Request
          </Button>
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

      <Card noPadding>
        <div className="p-4">
          <Tabs
            tabs={[
              { id: 'my', label: 'My Applications' },
              ...(canViewFinance ? [{ id: 'all', label: 'All Applications (Finance)' }] : []),
            ]}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as 'my' | 'all')}
          />

          {activeTab === 'all' && (
            <div className="flex-1 flex gap-2 w-full">
              <div className="w-40 shrink-0">
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
                      <Card key={pr.id} noPadding className="border-slate-100 p-4 hover:border-jci-blue/30 transition-colors">
                        <div className="flex flex-col md:flex-row justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 justify-between">
                              <span className="text-sm font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded leading-none">{pr.referenceNumber}</span>
                              <StatusBadge status={pr.status} />
                            </div>
                            <h4 className="font-bold text-slate-800">{pr.purpose}</h4>
                            <p className="text-xs text-slate-500 mt-1">
                              {pr.category === 'administrative'
                                ? `Admin Account: ${pr.activityId || 'N/A'}`
                                : 'Project: ' + (projects.find(p => p.id === pr.activityId)?.name || pr.activityRef || 'N/A')}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-bold">Requested on {new Date(pr.createdAt).toLocaleDateString()}</p>
                          </div>
                          <div className="flex flex-row md:flex-col items-end justify-between md:justify-center gap-2 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-4">
                            <span className="text-xl font-bold text-jci-blue">{formatCurrency(pr.totalAmount || pr.amount)}</span>
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
                      <Card key={pr.id} noPadding className="p-4 border-slate-100 hover:border-slate-200">
                        <div className="flex flex-col md:flex-row justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 justify-between flex-wrap mb-1">
                              <span className="font-mono font-bold text-xs">{pr.referenceNumber}</span>
                              <StatusBadge status={pr.status} />
                            </div>
                            <h5 className="font-semibold text-slate-800 truncate">{pr.purpose}</h5>
                            <p className="text-xs text-slate-500">{pr.category === 'administrative' ? `Admin Account: ${pr.activityId || 'N/A'}` : 'Project'}</p>
                            <p className="text-xs text-slate-400">Applicant: {pr.applicantName || 'Unknown'}</p>

                          </div>
                          <div className="flex items-center gap-4 border-t md:border-t-0 pt-2 md:pt-0">
                            <span className="font-bold text-slate-900">{formatCurrency(pr.totalAmount || pr.amount)}</span>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => handlePreviewPDF(pr)} title="View PDF">
                                <Eye size={16} />
                              </Button>
                              {pr.status === 'submitted' && (
                                <div className="flex gap-1 ml-2">
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
        onClose={() => !submitting && setSubmitModalOpen(false)}
        title="Submit Payment Request"
        size="lg"
        drawerOnMobile
      >
        <form onSubmit={handleSubmit} className="space-y-6">
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
            <Select
              label="Category"
              value={formCategory}
              onChange={(e) => {
                setFormCategory(e.target.value as any);
                setFormActivityId('');
              }}
              options={[
                { value: 'administrative', label: 'Administrative' },
                { value: 'projects_activities', label: 'Projects & Activities' },
              ]}
              required
            />
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
              <Input
                label="Admin Account"
                value={formActivityId}
                onChange={(e) => setFormActivityId(e.target.value)}
                placeholder="e.g. Maintenance / Utilities"
                required
              />
            )}
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-slate-900">Request Items</h4>
              <Button type="button" size="sm" variant="secondary" onClick={addItem}>
                <Plus size={14} className="mr-1" /> Add Item
              </Button>
            </div>

            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
              {formItems.map((item, idx) => (
                <div key={idx} className="flex gap-3 items-end">
                  <div className="flex-1">
                    <Input
                      label={idx === 0 ? "Description / Purpose" : ""}
                      value={item.purpose}
                      onChange={(e) => updateItem(idx, { purpose: e.target.value })}
                      placeholder="e.g. Venue rental"
                      required
                    />
                  </div>
                  <div className="w-32">
                    <Input
                      label={idx === 0 ? "Amount" : ""}
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
                    <Button type="button" variant="ghost" className="text-red-500 mb-[4px] p-2" onClick={() => removeItem(idx)}>
                      <Trash2 size={18} />
                    </Button>
                  )}
                </div>
              ))}
              <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Claim Amount</span>
                <span className="text-lg font-bold text-jci-blue">{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t pt-4">
            <h4 className="font-bold text-slate-900">Payment Details (Remit to)</h4>
            <div className="grid md:grid-cols-2 gap-4">
              <Select
                label="Claim From Account"
                value={formClaimFromBankAccountId}
                onChange={(e) => setFormClaimFromBankAccountId(e.target.value)}
                options={[
                  { value: '', label: 'Select Bank Account...' },
                  ...bankAccounts.map(a => ({ value: a.id, label: a.name })),
                ]}
                required
              />
              <Input
                label="Recipient Bank Name"
                value={formBankName}
                onChange={(e) => setFormBankName(e.target.value)}
                placeholder="e.g. Maybank / Public Bank"
                required
              />
              <Input
                label="Account Holder Name"
                value={formAccountHolder}
                onChange={(e) => setFormAccountHolder(e.target.value)}
                placeholder="Receiver name"
                required
              />
              <Input
                label="Account Number"
                value={formAccountNumber}
                onChange={(e) => setFormAccountNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="Number only"
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

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => setSubmitModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="min-w-[120px]">
              {submitting ? (
                <>
                  <RefreshCw size={16} className="mr-2 animate-spin" />
                  Submitting...
                </>
              ) : 'Submit Request'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
