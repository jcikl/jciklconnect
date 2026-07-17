import React, { useState, useEffect } from 'react';
import { Plus, RefreshCw, FileText, Trash2, Paperclip, X } from 'lucide-react';
import { Button, Modal, useToast, ProgressBar } from '../../ui/Common';
import { Input, Select } from '../../ui/Form';
import { Combobox } from '../../ui/Combobox';
import { MemberSelector } from '../../ui/MemberSelector';
import { PaymentRequestService } from '../../../services/paymentRequestService';
import { FinanceService } from '../../../services/financeService';
import { ProjectsService } from '../../../services/projectsService';
import { PaymentRequestItem, BankAccount, Project } from '../../../types';
import { useAuth } from '../../../hooks/useAuth';
import { useMembers } from '../../../hooks/useMembers';
import { DEFAULT_LO_ID } from '../../../config/constants';
import { formatCurrency } from '../../../utils/formatUtils';
import { uploadToCloudinary } from '../../../services/cloudinaryService';
import imageCompression from 'browser-image-compression';
import { getAdministrativeProjectIds } from '../../../utils/administrativeProjectsStorage';

interface SubmitPaymentRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedProjectId?: string;
  preselectedCategory?: 'administrative' | 'projects_activities';
  onSuccess?: (referenceNumber: string) => void;
}

export const SubmitPaymentRequestModal: React.FC<SubmitPaymentRequestModalProps> = ({
  isOpen,
  onClose,
  preselectedProjectId,
  preselectedCategory,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const { user, member } = useAuth();
  const loId = (member as { loId?: string })?.loId ?? DEFAULT_LO_ID;
  const { members: memberOptions } = useMembers(loId);

  const [submitStep, setSubmitStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [attachmentUploadProgress, setAttachmentUploadProgress] = useState(0);

  const [formApplicantId, setFormApplicantId] = useState('');
  const [formApplicantName, setFormApplicantName] = useState('');
  const [formApplicantEmail, setFormApplicantEmail] = useState('');
  const [formApplicantPosition, setFormApplicantPosition] = useState('');
  const [formCategory, setFormCategory] = useState<'administrative' | 'projects_activities'>(
    preselectedCategory ?? 'administrative'
  );
  const [formActivityId, setFormActivityId] = useState(preselectedProjectId ?? '');
  const [formRemark, setFormRemark] = useState('');
  const [formItems, setFormItems] = useState<PaymentRequestItem[]>([{ purpose: '', amount: 0 }]);
  const [formClaimFromBankAccountId, setFormClaimFromBankAccountId] = useState('');
  const [formBankName, setFormBankName] = useState('');
  const [formAccountHolder, setFormAccountHolder] = useState('');
  const [formAccountNumber, setFormAccountNumber] = useState('');
  const [formAttachments, setFormAttachments] = useState<File[]>([]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [adminAccountOptions, setAdminAccountOptions] = useState<string[]>([]);

  // Reset & pre-fill when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setSubmitStep(1);
    setFormCategory(preselectedCategory ?? 'administrative');
    setFormActivityId(preselectedProjectId ?? '');
    setFormItems([{ purpose: '', amount: 0 }]);
    setFormRemark('');
    setFormAttachments([]);

    if (user || member) {
      setFormApplicantName(member?.name || user?.displayName || '');
      setFormApplicantEmail(user?.email || '');
      // SEC-A-003: Bank account details are no longer persisted in localStorage (PII risk).
      // Pre-populate from the member's existing paymentInfo stored in Firestore instead.
      const paymentInfo = (member as { paymentInfo?: { bankName?: string; accountHolder?: string; accountNumber?: string } })?.paymentInfo;
      if (paymentInfo?.bankName) setFormBankName(paymentInfo.bankName);
      if (paymentInfo?.accountHolder) setFormAccountHolder(paymentInfo.accountHolder);
      if (paymentInfo?.accountNumber) setFormAccountNumber(paymentInfo.accountNumber);
      const savedClaimFromBankAccountId = localStorage.getItem('pr_claim_from_bank_account_id');

      // Auto-fill position from project committee role when opened from budget tab
      if (preselectedProjectId && member?.id) {
        ProjectsService.getProjectById(preselectedProjectId).then(project => {
          const entry = project?.committee?.find(c => c.memberId === member.id);
          if (entry?.role) {
            setFormApplicantPosition(entry.role);
          } else {
            const savedPosition = localStorage.getItem('pr_applicant_position');
            if (savedPosition) setFormApplicantPosition(savedPosition);
          }
        }).catch(() => {
          const savedPosition = localStorage.getItem('pr_applicant_position');
          if (savedPosition) setFormApplicantPosition(savedPosition);
        });
      } else {
        const savedPosition = localStorage.getItem('pr_applicant_position');
        if (savedPosition) setFormApplicantPosition(savedPosition);
      }
    }
  }, [isOpen, preselectedProjectId, preselectedCategory, user, member]);

  // Load select data
  useEffect(() => {
    if (!member) return;
    const load = async () => {
      try {
        const prjList = await ProjectsService.getAllProjects();
        setProjects(prjList);
      } catch { /* ignore */ }
      try {
        const accounts = await FinanceService.getAllBankAccounts(false);
        setBankAccounts(accounts);
      } catch { /* ignore */ }
      try {
        const adminIds = getAdministrativeProjectIds();
        const allProjects = await ProjectsService.getAllProjects();
        const adminProjects = allProjects.filter(p => adminIds.includes(p.id));
        setAdminAccountOptions(adminProjects.map(p => p.name));
      } catch { /* ignore */ }
    };
    load();
  }, [member]);

  const addItem = () => setFormItems(prev => [...prev, { purpose: '', amount: 0 }]);
  const removeItem = (index: number) => setFormItems(prev => prev.filter((_, i) => i !== index));
  const updateItem = (index: number, updates: Partial<PaymentRequestItem>) =>
    setFormItems(prev => prev.map((item, i) => (i === index ? { ...item, ...updates } : item)));
  const totalAmount = formItems.reduce((sum, item) => sum + (item.amount || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formItems.some(item => !item.purpose || item.amount <= 0)) {
      showToast('Please fill all item descriptions and amounts', 'error'); return;
    }
    if (formCategory === 'projects_activities' && !formActivityId) {
      showToast('Please select a project/activity', 'error'); return;
    }
    if (!user?.uid || !member) { showToast('Please log in first', 'error'); return; }

    setSubmitting(true);
    try {
      const now = new Date();
      const applicantId = formApplicantId || user.uid;
      const attachmentUrls: string[] = [];

      if (formAttachments.length > 0) {
        setAttachmentUploadProgress(0);
        for (let i = 0; i < formAttachments.length; i++) {
          const file = formAttachments[i];
          let fileToUpload = file;
          if (file.type.startsWith('image/')) {
            try {
              const compressed = await imageCompression(file, { maxSizeMB: 0.2, maxWidthOrHeight: 1920, useWebWorker: true });
              fileToUpload = new File([compressed], file.name, { type: compressed.type, lastModified: Date.now() });
            } catch { /* use original */ }
          }
          const baseProgress = (i / formAttachments.length) * 100;
          const url = await uploadToCloudinary(
            fileToUpload,
            `payment-requests/${loId}`,
            (progress) => setAttachmentUploadProgress(Math.round(baseProgress + (progress / formAttachments.length))),
            { resourceType: 'auto' }
          );
          attachmentUrls.push(url);
        }
      }

      const { referenceNumber } = await PaymentRequestService.create({
        applicantId,
        applicantName: formApplicantName,
        applicantEmail: formApplicantEmail,
        applicantPosition: formApplicantPosition,
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0],
        category: formCategory,
        activityId: formActivityId || null,
        totalAmount,
        remark: formRemark,
        items: formItems,
        claimFromBankAccountId: formClaimFromBankAccountId || null,
        bankName: formBankName,
        accountHolder: formAccountHolder,
        accountNumber: formAccountNumber,
        amount: totalAmount,
        purpose: formItems[0].purpose,
        activityRef: formActivityId || null,
        status: 'submitted',
        loId,
        attachmentUrls,
      }, user.uid);

      // SEC-A-003: Bank account details (name, holder, number) are NOT stored in localStorage.
      localStorage.setItem('pr_claim_from_bank_account_id', formClaimFromBankAccountId || '');
      localStorage.setItem('pr_applicant_position', formApplicantPosition);

      showToast(`Application submitted. Reference: ${referenceNumber}`, 'success');
      onClose();
      onSuccess?.(referenceNumber);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Submit failed', 'error');
    } finally {
      setSubmitting(false);
      setAttachmentUploadProgress(0);
    }
  };

  const stepTitle = (
    <div className="space-y-3 w-full">
      <div className="flex items-center gap-2 text-jci-blue">
        <div className="bg-sky-100 p-1.5 rounded-lg">
          <FileText size={18} className="text-jci-blue" />
        </div>
        <span className="font-bold text-base">Submit Payment Request</span>
      </div>
      <div className="flex items-center gap-0">
        {(['Claim Details', 'Attachments', 'Payment & Submit'] as const).map((label, i) => {
          const step = (i + 1) as 1 | 2 | 3;
          const done = submitStep > step;
          const active = submitStep === step;
          return (
            <div key={step} className="flex items-center flex-1 min-w-0">
              <div className={`flex items-center gap-1.5 shrink-0 ${active ? 'text-jci-blue' : done ? 'text-emerald-500' : 'text-slate-300'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${active ? 'border-jci-blue bg-jci-blue text-white' : done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-200 bg-white text-slate-400'}`}>
                  {done ? '✓' : step}
                </div>
                <span className={`text-[11px] font-semibold hidden sm:block whitespace-nowrap ${active ? 'text-jci-blue' : done ? 'text-emerald-600' : 'text-slate-400'}`}>{label}</span>
              </div>
              {i < 2 && <div className={`flex-1 h-px mx-2 transition-colors ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
            </div>
          );
        })}
      </div>
    </div>
  );

  const footer = (
    <div className="flex justify-between items-center w-full">
      <Button type="button" variant="ghost" onClick={() => submitStep > 1 ? setSubmitStep((s) => (s - 1) as 1 | 2 | 3) : onClose()} disabled={submitting}>
        {submitStep === 1 ? 'Cancel' : '← Back'}
      </Button>
      {submitStep < 3 ? (
        <Button type="button" onClick={() => {
          if (submitStep === 1) {
            if (formItems.some(item => !item.purpose || item.amount <= 0)) { showToast('Please fill all item descriptions and amounts', 'error'); return; }
            if (formCategory === 'projects_activities' && !formActivityId) { showToast('Please select a project/activity', 'error'); return; }
            if (!formApplicantPosition) { showToast('Please enter the applicant position', 'error'); return; }
          }
          setSubmitStep((s) => (s + 1) as 1 | 2 | 3);
        }}>
          Next →
        </Button>
      ) : (
        <Button type="submit" form="submit-pr-form" disabled={submitting} className="min-w-[140px]">
          {submitting ? <><RefreshCw size={15} className="mr-2 animate-spin" />Submitting...</> : `Submit · ${formatCurrency(totalAmount)}`}
        </Button>
      )}
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={stepTitle} size="lg" footer={footer}>
      <form id="submit-pr-form" onSubmit={handleSubmit}>
        {/* Step 1: Claim Details */}
        {submitStep === 1 && (
          <div className="space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <MemberSelector
                label="Applicant"
                members={memberOptions}
                value={formApplicantId}
                onChange={(id) => {
                  setFormApplicantId(id);
                  const sel = memberOptions.find(m => m.id === id);
                  if (sel) { setFormApplicantName(sel.name); setFormApplicantEmail(sel.email); }
                  else if (id === '') { setFormApplicantName(member?.name || user?.displayName || ''); setFormApplicantEmail(user?.email || ''); }
                }}
                selfOption
                selfLabel="Self"
                placeholder="Select applicant..."
                disabled={!!preselectedProjectId}
              />
              <Input label="Applicant Position" value={formApplicantPosition} onChange={(e) => { if (!preselectedProjectId) setFormApplicantPosition(e.target.value); }} placeholder="e.g. Project Lead / Secretary" required readOnly={!!preselectedProjectId} className={preselectedProjectId ? 'bg-slate-50 cursor-not-allowed' : ''} />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <div className={`flex bg-slate-100 p-1 rounded-lg ${preselectedProjectId ? 'opacity-60 pointer-events-none' : ''}`}>
                  <button type="button" onClick={() => { setFormCategory('administrative'); setFormActivityId(''); }}
                    className={`flex-1 py-1.5 px-2 text-sm font-medium rounded-md transition-all ${formCategory === 'administrative' ? 'bg-white text-jci-blue shadow-sm border border-slate-200/50' : 'text-slate-600 hover:text-slate-900'}`}>
                    Administrative
                  </button>
                  <button type="button" onClick={() => { setFormCategory('projects_activities'); if (!preselectedProjectId) setFormActivityId(''); }}
                    className={`flex-1 py-1.5 px-2 text-sm font-medium rounded-md transition-all ${formCategory === 'projects_activities' ? 'bg-white text-jci-blue shadow-sm border border-slate-200/50' : 'text-slate-600 hover:text-slate-900'}`}>
                    Projects & Activities
                  </button>
                </div>
              </div>
              {formCategory === 'projects_activities' ? (
                <Select label="Associated Project" value={formActivityId} onChange={(e) => { if (!preselectedProjectId) setFormActivityId(e.target.value); }}
                  options={[{ value: '', label: 'Select a project...' }, ...projects.map(p => ({ value: p.id, label: p.name }))]} required
                  disabled={!!preselectedProjectId} className={preselectedProjectId ? 'bg-slate-50 cursor-not-allowed' : ''} />
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Admin Account</label>
                  <Combobox options={adminAccountOptions} value={formActivityId} onChange={(value) => setFormActivityId(value)} placeholder="Select or type admin account..." />
                </div>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold text-slate-900">Request Items</h4>
                <Button type="button" size="sm" variant="secondary" onClick={addItem}>
                  <Plus size={14} className="mr-1" /> Add Item
                </Button>
              </div>
              <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                {formItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-end bg-white p-2.5 rounded-lg border border-slate-100">
                    <div className="flex-1 min-w-0">
                      <Input label={`Item ${idx + 1}`} value={item.purpose} onChange={(e) => updateItem(idx, { purpose: e.target.value })} placeholder="Description (e.g. Venue rental)" required />
                    </div>
                    <div className="w-28 shrink-0">
                      <Input label="RM" type="number" min="0.01" max={50000} step="0.01" value={item.amount || ''} onChange={(e) => updateItem(idx, { amount: parseFloat(e.target.value) || 0 })} placeholder="0.00" required />
                    </div>
                    {formItems.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)} className="mb-0.5 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors shrink-0">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center px-1">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</span>
                  <span className="text-lg font-bold text-jci-blue">{formatCurrency(totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Attachments */}
        {submitStep === 2 && (
          <div className="space-y-4">
            <div className="relative p-6 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 hover:border-jci-blue hover:bg-blue-50/20 transition-all cursor-pointer">
              <input type="file" multiple accept="image/*,.pdf" onChange={(e) => { if (e.target.files) setFormAttachments(prev => [...prev, ...Array.from(e.target.files!)]); }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              <div className="flex flex-col items-center text-center">
                <Paperclip size={26} className="text-slate-400 mb-2" />
                <p className="text-sm font-semibold text-slate-700">Tap to add receipts / invoices</p>
                <p className="text-xs text-slate-400 mt-1">Images or PDFs · multiple files allowed</p>
              </div>
            </div>
            {attachmentUploadProgress > 0 && (
              <ProgressBar progress={attachmentUploadProgress} label={`Uploading... ${attachmentUploadProgress}%`} />
            )}
            {formAttachments.length > 0 ? (
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                {formAttachments.map((file, idx) => {
                  const isImage = file.type.startsWith('image/');
                  const fileUrl = isImage ? URL.createObjectURL(file) : null;
                  return (
                    <div key={idx} className="flex items-center gap-3 px-3 py-2.5 bg-white">
                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-slate-100 flex items-center justify-center">
                        {isImage && fileUrl
                          ? <img src={fileUrl} className="w-full h-full object-cover" alt={file.name} onLoad={() => URL.revokeObjectURL(fileUrl)} />
                          : <FileText size={20} className="text-red-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
                        <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <button type="button" onClick={() => setFormAttachments(prev => prev.filter((_, i) => i !== idx))}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-sm text-slate-400 py-2">No attachments added yet — you can skip this step</p>
            )}
          </div>
        )}

        {/* Step 3: Payment Details */}
        {submitStep === 3 && (
          <div className="space-y-5">
            <div className="bg-sky-50 rounded-xl border border-sky-100 p-3.5 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-sky-700 uppercase tracking-wider">Claim Summary</p>
                <p className="text-sm text-slate-700 mt-0.5 truncate">
                  {formItems.length} item{formItems.length > 1 ? 's' : ''} · {formCategory === 'administrative' ? 'Administrative' : projects.find(p => p.id === formActivityId)?.name || 'Project'}
                </p>
              </div>
              <span className="text-xl font-bold text-jci-blue shrink-0">{formatCurrency(totalAmount)}</span>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Select label="Claim From JCI Account" value={formClaimFromBankAccountId} onChange={(e) => setFormClaimFromBankAccountId(e.target.value)}
                options={[{ value: '', label: 'Select JCI Account...' }, ...bankAccounts.map(a => ({ value: a.id, label: a.name }))]} required />
              <Input label="Your Recipient Bank" value={formBankName} onChange={(e) => setFormBankName(e.target.value)} placeholder="e.g. Maybank, CIMB, Public Bank" required autoComplete="organization" />
              <Input label="Account Holder Name" value={formAccountHolder} onChange={(e) => setFormAccountHolder(e.target.value)} placeholder="Must match bank record" required autoComplete="name" />
              <Input label="Bank Account Number" value={formAccountNumber} onChange={(e) => setFormAccountNumber(e.target.value.replace(/\D/g, ''))} placeholder="Numbers only" inputMode="numeric" required autoComplete="off" />
            </div>
            <Input label="Remark / Special Instructions (Optional)" value={formRemark} onChange={(e) => setFormRemark(e.target.value)} placeholder="Add any additional notes here..." />
          </div>
        )}
      </form>
    </Modal>
  );
};
