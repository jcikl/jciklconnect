import React, { useState, useCallback, useEffect } from 'react';
import { CreditCard, ExternalLink, Plus, RefreshCw, Download, AlertCircle, Link2, Briefcase, Users, Settings, CheckCircle2, XCircle, Copy, Eye, EyeOff, Undo2 } from 'lucide-react';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { COLLECTIONS } from '../../config/constants';
import { Card, Button, Badge, Modal, useToast, ConfirmDialog, CONFIRM_CLOSED, Tabs } from '../ui/Common';
import type { ConfirmState } from '../ui/Common';
import { Input } from '../ui/Form';
import { ToyyibService, ToyyibBillRecord, ToyyibCategory } from '../../services/toyyibService';
import { ProjectsService } from '../../services/projectsService';
import { CreateBillForm } from '../shared/toyyib/CreateBillForm';
import { BillPaymentLink, billPaymentUrl } from '../shared/toyyib/BillPaymentLink';
import { TOYYIB_CONFIG } from '../../config/constants';
import { useToyyibMode } from '../../hooks/useToyyibMode';
import { PaymentButton } from '../shared/toyyib/PaymentButton';
import { MembersService } from '../../services/membersService';
import { EventRegistrationService } from '../../services/eventRegistrationService';
import { Combobox } from '../ui/Combobox';
import { billStatusBadge, linkedLabel } from './Toyyib/toyyibUi';
import { ToyyibCategoriesTab } from './Toyyib/ToyyibCategoriesTab';
import { ToyyibBillsTab } from './Toyyib/ToyyibBillsTab';

export const ToyyibView: React.FC<{ embedded?: boolean }> = ({ embedded }) => {
  const { showToast } = useToast();
  const [confirmState, setConfirmState] = useState<ConfirmState>(CONFIRM_CLOSED);
  const [activeTab, setActiveTab] = useState<'category' | 'bill' | 'settlement'>('category');
  const [categories, setCategories] = useState<ToyyibCategory[]>([]);
  const [bills, setBills] = useState<ToyyibBillRecord[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);

  // Bill creation — category picker drives CreateBillForm props
  const [billCategoryCode, setBillCategoryCode] = useState('');

  // Category creation modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createType, setCreateType] = useState<'membership' | 'project'>('membership');
  const [createYear, setCreateYear] = useState(String(new Date().getFullYear()));
  const [createMembershipType, setCreateMembershipType] = useState('');
  const [createProjectId, setCreateProjectId] = useState('');
  const [isCreatingCat, setIsCreatingCat] = useState(false);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importCode, setImportCode] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Link modal — assign a category to an event or annual dues
  const [linkCat, setLinkCat] = useState<ToyyibCategory | null>(null);
  const [linkType, setLinkType] = useState<'membership' | 'project'>('membership');
  const [linkProjectId, setLinkProjectId] = useState('');
  const [linkMembershipType, setLinkMembershipType] = useState('');
  const [isSavingLink, setIsSavingLink] = useState(false);

  const [detailsCat, setDetailsCat] = useState<any>(null);
  const [syncingBill, setSyncingBill] = useState<string | null>(null);

  // Bills tab
  const [billFilter, setBillFilter] = useState<'all' | '1' | '2' | '3'>('all');
  const [showCreateBill, setShowCreateBill] = useState(false);

  // Settings panel
  const [showSettings, setShowSettings] = useState(false);
  const [connStatus, setConnStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [showSecretKey, setShowSecretKey] = useState(false);
  const { isSandbox, hasProdKey, loading: modeLoading } = useToyyibMode();
  const [togglingMode, setTogglingMode] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Test payment panel
  const [testMembers, setTestMembers] = useState<any[]>([]);
  const [testMemberId, setTestMemberId] = useState('');
  const [testProjectId, setTestProjectId] = useState('');
  const [testYear, setTestYear] = useState(new Date().getFullYear());
  const [testSyncing, setTestSyncing] = useState(false);
  const [testMemberEventIds, setTestMemberEventIds] = useState<Set<string>>(new Set());

  const handleSyncBillStatus = async (billCode: string) => {
    setSyncingBill(billCode);
    try {
      const result = await ToyyibService.syncBillStatus(billCode);
      if (result) {
        setBills(prev => prev.map(b => b.billCode === billCode ? { ...b, ...result } : b));
        const isPaid = result.billpaymentStatus === '1';
        showToast(isPaid ? 'Marked as Paid' : `Status updated (${result.billpaymentStatus})`, isPaid ? 'success' : 'info');
      } else {
        showToast('No transaction data from ToyyibPay', 'warning');
      }
    } catch {
      showToast('Failed to sync status', 'error');
    } finally {
      setSyncingBill(null);
    }
  };

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [catList, billList, projectList] = await Promise.all([
        ToyyibService.getCategories(),
        ToyyibService.getBills(),
        ProjectsService.getAllProjects(),
      ]);
      setCategories(Array.isArray(catList) ? catList : []);
      setBills(Array.isArray(billList) ? billList : []);
      setProjects((Array.isArray(projectList) ? projectList : []).map(p => ({ id: p.id!, title: p.title || p.name || '' })));
    } catch (error) {
      showToast('Failed to load data', 'error');
    } finally {
      setIsRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (showSettings && testMembers.length === 0) {
      MembersService.getAllMembers().then(list => setTestMembers(list ?? [])).catch(() => { });
    }
  }, [showSettings, testMembers.length]);

  const openLinkModal = (cat: ToyyibCategory) => {
    setLinkCat(cat);
    setLinkType(cat.linkedType ?? 'membership');
    setLinkProjectId(cat.linkedProjectId ?? '');
    setLinkMembershipType(cat.membershipType ?? '');
  };

  const handleSaveLink = async () => {
    if (!linkCat) return;
    if (linkType === 'membership' && !linkMembershipType) { showToast('Select a membership type', 'warning'); return; }
    if (linkType === 'project' && !linkProjectId) { showToast('Select a project', 'warning'); return; }
    setIsSavingLink(true);
    try {
      const selectedProject = projects.find(p => p.id === linkProjectId);
      await ToyyibService.updateCategoryLink(linkCat.categoryCode, {
        linkedType: linkType,
        linkedProjectId: linkType === 'project' ? linkProjectId : undefined,
        linkedProjectName: linkType === 'project' ? selectedProject?.title : undefined,
        membershipType: linkType === 'membership' ? linkMembershipType : undefined,
      });
      showToast('Link saved!', 'success');
      setLinkCat(null);
      loadData();
    } catch {
      showToast('Failed to save link', 'error');
    } finally {
      setIsSavingLink(false);
    }
  };

  const handleCreateCategory = async () => {
    if (createType === 'membership' && !createMembershipType) { showToast('Select a membership type', 'warning'); return; }
    if (createType === 'project' && !createProjectId) { showToast('Select a project', 'warning'); return; }

    const selectedProject = projects.find(p => p.id === createProjectId);
    const catName = createType === 'membership'
      ? `${createYear} Membership`
      : selectedProject?.title ?? '';
    const catDesc = catName;

    setIsCreatingCat(true);
    try {
      const result = await ToyyibService.createCategory(catName, catDesc);
      const newCode = Array.isArray(result) ? result[0]?.CategoryCode : null;
      // Auto-link immediately after creation
      if (newCode) {
        await ToyyibService.updateCategoryLink(newCode, {
          linkedType: createType,
          linkedProjectId: createType === 'project' ? createProjectId : undefined,
          linkedProjectName: createType === 'project' ? selectedProject?.title : undefined,
          membershipType: createType === 'membership' ? createMembershipType : undefined,
        });
      }
      showToast('Category created!', 'success');
      setIsCreateModalOpen(false);
      setCreateMembershipType(''); setCreateProjectId('');
      loadData();
    } catch (e) { showToast('Failed to create category', 'error'); }
    finally { setIsCreatingCat(false); }
  };

  const handleImport = async () => {
    if (!importCode.trim()) { showToast('Enter a category code', 'warning'); return; }
    setIsImporting(true);
    try {
      await ToyyibService.importCategory(importCode.trim());
      showToast('Category imported!', 'success');
      setIsImportModalOpen(false); setImportCode('');
      loadData();
    } catch (e) { showToast(e instanceof Error ? e.message : 'Failed', 'error'); }
    finally { setIsImporting(false); }
  };

  const handleDelete = async (categoryCode: string) => {
    try {
      await ToyyibService.deleteCategory(categoryCode);
      showToast('Removed from system', 'success');
      loadData();
    } catch { showToast('Failed to remove', 'error'); }
  };

  const handleShowCategoryDetails = (category: ToyyibCategory) => {
    ToyyibService.getCategoryDetails(category.categoryCode)
      .then(details => setDetailsCat(details?.[0] ?? category))
      .catch(() => setDetailsCat(category));
  };

  const totalBillAmount = bills.reduce((s, b) => s + (b.billAmount || 0), 0);
  const paidBills = bills.filter(b => b.billpaymentStatus === '1');

  // ── Tab bar ────────────────────────────────────────────────────────────────
  const TABS = [
    { key: 'category' as const, label: 'Categories' },
    { key: 'bill' as const, label: 'Bills' },
    { key: 'settlement' as const, label: 'Settlement' },
  ];

  // ── Helpers ────────────────────────────────────────────────────────────────
  // ── Settings ───────────────────────────────────────────────────────────────
  const copyField = (value: string, key: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const testConnection = async () => {
    setConnStatus('testing');
    try {
      const result = await ToyyibService.getCategoryDetails(TOYYIB_CONFIG.CATEGORY_CODE);
      setConnStatus(Array.isArray(result) && result.length > 0 ? 'ok' : 'fail');
    } catch {
      setConnStatus('fail');
    }
  };

  const renderSettings = () => {
    const masked = (s: string) => s.length > 8 ? s.slice(0, 4) + '·'.repeat(s.length - 8) + s.slice(-4) : '••••••••';
    const callbackUrl = window.location.origin + TOYYIB_CONFIG.CALLBACK_URL_SUFFIX;
    const returnUrl = window.location.origin + TOYYIB_CONFIG.RETURN_URL_SUFFIX;

    const configRows: { label: string; value: string; key: string; mono?: boolean }[] = [
      { label: 'Secret Key', value: TOYYIB_CONFIG.USER_SECRET_KEY, key: 'secret', mono: true },
      { label: 'Default Category Code', value: TOYYIB_CONFIG.CATEGORY_CODE, key: 'catcode', mono: true },
      { label: 'Callback URL', value: callbackUrl, key: 'callback', mono: true },
      { label: 'Return URL', value: returnUrl, key: 'return', mono: true },
      { label: 'Endpoint', value: isSandbox ? TOYYIB_CONFIG.SANDBOX_ENDPOINT : TOYYIB_CONFIG.ENDPOINT, key: 'endpoint', mono: true },
    ];

    return (
      <div className="space-y-4 pt-1">
        {/* Settings section title */}
        <div className="flex items-center gap-2 pb-1">
          <Settings size={14} className="text-slate-400" />
          <h3 className="text-sm font-bold text-slate-700 tracking-wide uppercase">Settings</h3>
        </div>

        {/* Connection status card */}
        <Card>
          {/* Header */}
          <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-bold text-slate-900 text-sm leading-tight">Connection Status</p>
                <p className="text-[11px] text-slate-400 mt-0.5">ToyyibPay API connectivity</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {connStatus === 'ok' && <span className="flex items-center gap-1 text-xs font-semibold text-green-600"><CheckCircle2 size={13} /> OK</span>}
                {connStatus === 'fail' && <span className="flex items-center gap-1 text-xs font-semibold text-red-500"><XCircle size={13} /> Fail</span>}
                <Button size="sm" variant="outline" isLoading={connStatus === 'testing'} onClick={testConnection} className="h-8 px-3 text-xs">
                  Test
                </Button>
              </div>
            </div>
          </div>

          {/* Environment toggle */}
          <div className="px-4 sm:px-5 py-3 flex items-center gap-3 border-b border-slate-50">
            <span className="text-xs text-slate-500 font-medium w-28 sm:w-36 flex-shrink-0">Environment</span>
            <div className="flex items-center gap-3 flex-1">
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${isSandbox ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
                {modeLoading ? '…' : isSandbox ? 'Sandbox' : 'Production'}
              </span>
              <button
                onClick={async () => {
                  if (!hasProdKey && isSandbox) {
                    showToast('TOYYIBPAY_SECRET_KEY_PROD is not configured — add it to Netlify env vars first', 'warning');
                    return;
                  }
                  setTogglingMode(true);
                  try {
                    await ToyyibService.setMode(!isSandbox);
                    showToast(`Switched to ${!isSandbox ? 'Sandbox' : 'Production'} mode`, 'success');
                    // Reload page data after mode switch so bill URLs update
                    loadData();
                  } catch {
                    showToast('Failed to switch mode', 'error');
                  } finally {
                    setTogglingMode(false);
                  }
                }}
                disabled={togglingMode || modeLoading}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-lg border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800 disabled:opacity-50 transition-colors"
              >
                {togglingMode ? <RefreshCw size={11} className="animate-spin" /> : null}
                Switch to {isSandbox ? 'Production' : 'Sandbox'}
              </button>
              {!hasProdKey && (
                <span className="text-[10px] text-amber-600 flex items-center gap-1">
                  <AlertCircle size={10} />
                  No prod key
                </span>
              )}
            </div>
          </div>

          {/* Config rows — stack label+value on mobile, inline on desktop */}
          <div className="divide-y divide-slate-50">
            {configRows.map(row => (
              <div key={row.key} className="px-4 sm:px-5 py-3 flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium w-28 sm:w-36 flex-shrink-0">{row.label}</span>
                <span className={`flex-1 text-xs text-slate-800 min-w-0 truncate ${row.mono ? 'font-mono' : ''}`}>
                  {row.key === 'secret' ? (showSecretKey ? row.value : masked(row.value)) : row.value}
                </span>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  {row.key === 'secret' && (
                    <button onClick={() => setShowSecretKey(v => !v)} className="p-1.5 rounded text-slate-400 hover:text-slate-600 transition-colors">
                      {showSecretKey ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  )}
                  <button onClick={() => copyField(row.value, row.key)} className="p-1.5 rounded text-slate-400 hover:text-jci-blue transition-colors">
                    {copiedField === row.key ? <CheckCircle2 size={13} className="text-green-500" /> : <Copy size={13} />}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Info note */}
          <div className="px-4 sm:px-5 py-3 border-t border-slate-100">
            <p className="text-[11px] text-slate-400 flex items-start gap-1.5">
              <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
              <span>API keys live in Netlify env vars. Update <code className="font-mono bg-slate-100 px-1 rounded">TOYYIB_SECRET_KEY</code> and redeploy.</span>
            </p>
          </div>
        </Card>

        {/* Webhook URLs */}
        <Card>
          <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100">
            <p className="font-bold text-slate-900 text-sm">Webhook Setup</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Configure in your ToyyibPay dashboard</p>
          </div>
          <div className="divide-y divide-slate-50">
            {[
              { label: 'Callback URL', desc: 'Receives payment confirmation (POST)', value: callbackUrl },
              { label: 'Return URL', desc: 'Redirects user after payment', value: returnUrl },
            ].map(row => (
              <div key={row.label} className="px-4 sm:px-5 py-3.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700">{row.label}</span>
                  <button onClick={() => copyField(row.value, row.label)} className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-jci-blue transition-colors">
                    {copiedField === row.label ? <CheckCircle2 size={11} className="text-green-500" /> : <Copy size={11} />}
                    {copiedField === row.label ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">{row.desc}</p>
                <p className="text-[11px] font-mono text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg break-all leading-relaxed">{row.value}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Test Payment Panel ── */}
        <Card>
          <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 text-sm">Test Payment</h3>
            <p className="text-xs text-slate-400 mt-0.5">选择会员测试会费 / 活动付款流程</p>
          </div>
          <div className="p-4 sm:p-5 space-y-4">
            {/* Member picker */}
            {(() => {
              const memberOptions = testMembers.map(m => `${m.name} (${m.membershipType})`);
              const memberByLabel = Object.fromEntries(testMembers.map(m => [`${m.name} (${m.membershipType})`, m]));
              const selectedMemberLabel = testMemberId ? `${testMembers.find(m => m.id === testMemberId)?.name} (${testMembers.find(m => m.id === testMemberId)?.membershipType})` : '';
              return (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">会员 Member</label>
                  <Combobox
                    options={memberOptions}
                    value={selectedMemberLabel}
                    onChange={async label => {
                      const m = memberByLabel[label];
                      setTestMemberId(m?.id ?? '');
                      setTestProjectId('');
                      setTestMemberEventIds(new Set());
                      if (!m) return;
                      // Auto-sync membership dues bill status
                      const rec = m.membership?.[String(testYear)];
                      if (rec?.toyyibBillCode) {
                        setTestSyncing(true);
                        try {
                          const result = await ToyyibService.syncBillStatus(rec.toyyibBillCode);
                          if (result) {
                            setTestMembers(prev => prev.map(x => x.id !== m.id ? x : {
                              ...x,
                              membership: { ...x.membership, [String(testYear)]: { ...x.membership?.[String(testYear)], toyyibPaymentStatus: result.billpaymentStatus, toyyibPaymentDate: result.billPaymentDate } },
                            }));
                          }
                        } catch { /* silent */ } finally { setTestSyncing(false); }
                      }
                      // Load event registrations for this member
                      if (m.id) {
                        try {
                          const regs = await EventRegistrationService.listByMember(m.id);
                          const eventIds = new Set(regs.map(r => r.eventId));
                          setTestMemberEventIds(eventIds);
                          // Pre-populate __eventReg cache
                          const regMap = Object.fromEntries(regs.map(r => [r.eventId, r]));
                          setTestMembers(prev => prev.map(x => x.id !== m.id ? x : { ...x, __eventReg: regMap } as any));
                        } catch { /* silent */ }
                      }
                    }}
                    placeholder="搜索会员名字..."
                  />
                </div>
              );
            })()}

            {testMemberId && (() => {
              const member = testMembers.find(m => m.id === testMemberId);
              if (!member) return null;
              const testProject = projects.find(p => p.id === testProjectId);
              const isFirstYear = !member.membership ||
                !Object.keys(member.membership).some((y: string) =>
                  Number(y) < testYear &&
                  (member.membership[y]?.status === 'paid' || member.membership[y]?.status === 'over paid')
                );
              const yearRec = member.membership?.[String(testYear)];
              return (
                <div className="space-y-3">
                  {/* Year picker */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">付款年份</label>
                    <select
                      className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-jci-blue/30"
                      value={testYear}
                      onChange={async e => {
                        const yr = Number(e.target.value);
                        setTestYear(yr);
                        const rec = member.membership?.[String(yr)];
                        if (rec?.toyyibBillCode) {
                          setTestSyncing(true);
                          try {
                            const result = await ToyyibService.syncBillStatus(rec.toyyibBillCode);
                            if (result) {
                              setTestMembers(prev => prev.map(m => m.id !== testMemberId ? m : {
                                ...m,
                                membership: { ...m.membership, [String(yr)]: { ...m.membership?.[String(yr)], toyyibPaymentStatus: result.billpaymentStatus, toyyibPaymentDate: result.billPaymentDate } },
                              }));
                            }
                          } catch { /* silent */ } finally { setTestSyncing(false); }
                        }
                      }}
                    >
                      {[2024, 2025, 2026, 2027].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                    <span className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${isFirstYear ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                      {isFirstYear ? '首年' : '续费'}
                    </span>
                  </div>

                  {/* Membership dues test */}
                  {(() => {
                    const toStr = (v: any): string | null => {
                      if (v == null) return null;
                      if (typeof v === 'object' && 'seconds' in v) return new Date(v.seconds * 1000).toLocaleDateString();
                      if (typeof v === 'object') return null;
                      return String(v);
                    };
                    const rawDues = yearRec?.dues ?? yearRec?.amount;
                    const duesAmount = (rawDues != null && typeof rawDues !== 'object') ? rawDues : null;
                    const recStatus = yearRec?.status;
                    const statusColor =
                      recStatus === 'paid' || recStatus === 'over paid' ? 'text-green-600 bg-green-50' :
                        recStatus === 'overdue' ? 'text-red-600 bg-red-50' :
                          recStatus === 'partial' ? 'text-amber-600 bg-amber-50' :
                            'text-slate-500 bg-slate-100';
                    const toyyibStatusLabel =
                      yearRec?.toyyibPaymentStatus === '1' ? '已付款' :
                        yearRec?.toyyibPaymentStatus === '2' ? 'Pending' :
                          yearRec?.toyyibPaymentStatus === '3' ? '失败' :
                            yearRec?.toyyibPaymentStatus === '4' ? 'Settling' : null;

                    return (
                      <div className="rounded-xl border border-slate-100 bg-slate-50 overflow-hidden">
                        {/* Card header */}
                        <div className="px-3.5 py-2.5 bg-white border-b border-slate-100 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-700 leading-tight">
                              {isFirstYear ? '新会员' : '续费'} Membership Dues
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">{member.name} · {member.membershipType}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {yearRec?.toyyibBillCode && (
                              <button
                                title="撤回 — 清除 ToyyibPay 账单记录"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                onClick={() => {
                                  if (!member.id) return;
                                  setConfirmState({
                                    open: true,
                                    title: '撤回账单记录',
                                    message: `撤回 ${member.name} ${testYear} 年会费账单记录？`,
                                    variant: 'danger',
                                    onConfirm: async () => {
                                      setConfirmState(CONFIRM_CLOSED);
                                      try {
                                        await updateDoc(doc(db, COLLECTIONS.MEMBERS, member.id!), {
                                          [`membership.${testYear}.toyyibBillCode`]: deleteField(),
                                          [`membership.${testYear}.toyyibPaymentUrl`]: deleteField(),
                                          [`membership.${testYear}.toyyibPaymentStatus`]: deleteField(),
                                        });
                                        setTestMembers(prev => prev.map(m => m.id !== testMemberId ? m : {
                                          ...m,
                                          membership: {
                                            ...m.membership,
                                            [String(testYear)]: {
                                              ...m.membership?.[String(testYear)],
                                              toyyibBillCode: undefined,
                                              toyyibPaymentUrl: undefined,
                                              toyyibPaymentStatus: undefined,
                                            },
                                          },
                                        }));
                                        showToast('已撤回账单记录', 'success');
                                      } catch {
                                        showToast('撤回失败', 'error');
                                      }
                                    },
                                  });
                                }}
                              >
                                <Undo2 size={13} />
                              </button>
                            )}
                            <PaymentButton
                              key={`${member.id}-${testYear}`}
                              type="membership"
                              member={member}
                              year={testYear}
                              size="sm"
                              label="Test Pay"
                              existingPaymentUrl={yearRec?.toyyibPaymentUrl}
                              existingBillStatus={yearRec?.toyyibPaymentStatus}
                              onSuccess={result => {
                                setTestMembers(prev => prev.map(m => m.id !== testMemberId ? m : {
                                  ...m,
                                  membership: {
                                    ...m.membership,
                                    [String(testYear)]: {
                                      ...m.membership?.[String(testYear)],
                                      toyyibBillCode: result.billCode,
                                      toyyibPaymentUrl: result.paymentUrl,
                                      toyyibPaymentStatus: '2',
                                      toyyibBillName: `${testYear} Renewal Membership`,
                                    },
                                  },
                                }));
                              }}
                            />
                          </div>
                        </div>

                        {/* Details grid */}
                        <div className="px-3.5 py-3 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2.5">
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">会费金额</p>
                            <p className="text-xs font-semibold text-slate-800 mt-0.5">
                              {duesAmount != null ? `RM ${Number(duesAmount).toFixed(2)}` : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">缴费状态</p>
                            <div className="mt-0.5">
                              {recStatus
                                ? <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusColor}`}>{recStatus}</span>
                                : <p className="text-xs text-slate-400">—</p>}
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">ToyyibPay</p>
                            <p className="text-xs text-slate-700 mt-0.5">{toyyibStatusLabel ?? '—'}</p>
                          </div>
                          <div className="flex items-start justify-between gap-2 col-span-2 sm:col-span-1">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-1.5">
                                <p className="text-[10px] text-slate-400 uppercase tracking-wide flex-shrink-0">Bill Code</p>
                                <p className="text-[10px] font-mono text-slate-500 truncate">{yearRec?.toyyibBillCode ?? '—'}</p>
                              </div>
                              <div className="flex items-baseline gap-1.5 mt-0.5">
                                <p className="text-[10px] text-slate-400 uppercase tracking-wide flex-shrink-0">Ref</p>
                                <p className="text-[10px] font-mono text-slate-500 truncate">{yearRec?.billExternalReferenceNo ?? '—'}</p>
                              </div>
                            </div>
                            {yearRec?.toyyibBillCode && (
                              <button
                                disabled={testSyncing}
                                className="flex-shrink-0 flex items-center gap-1 text-[11px] text-slate-400 hover:text-jci-blue disabled:opacity-40 transition-colors mt-0.5"
                                onClick={async () => {
                                  setTestSyncing(true);
                                  try {
                                    const result = await ToyyibService.syncBillStatus(yearRec.toyyibBillCode);
                                    if (result) {
                                      setTestMembers(prev => prev.map(m => {
                                        if (m.id !== testMemberId) return m;
                                        return {
                                          ...m,
                                          membership: {
                                            ...m.membership,
                                            [String(testYear)]: {
                                              ...m.membership?.[String(testYear)],
                                              toyyibPaymentStatus: result.billpaymentStatus,
                                              toyyibPaymentDate: result.billPaymentDate,
                                            },
                                          },
                                        };
                                      }));
                                      showToast(result.billpaymentStatus === '1' ? '已付款' : `状态已更新 (${result.billpaymentStatus})`, result.billpaymentStatus === '1' ? 'success' : 'info');
                                    } else {
                                      showToast('ToyyibPay 无交易记录', 'warning');
                                    }
                                  } catch {
                                    showToast('同步失败', 'error');
                                  } finally {
                                    setTestSyncing(false);
                                  }
                                }}
                              >
                                <RefreshCw size={11} className={testSyncing ? 'animate-spin' : ''} />
                                {testSyncing ? '同步中…' : '检查状态'}
                              </button>
                            )}
                          </div>
                          {toStr(yearRec?.paymentDate) && (
                            <div className="col-span-2 sm:col-span-4">
                              <p className="text-[10px] text-slate-400 uppercase tracking-wide">付款日期</p>
                              <p className="text-xs text-slate-700 mt-0.5">{toStr(yearRec.paymentDate)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Event ticket test */}
                  {(() => {
                    const evtReg = (member as any).__eventReg?.[testProjectId];
                    const evtToyyibLabel =
                      evtReg?.toyyibPaymentStatus === '1' ? '已付款' :
                      evtReg?.toyyibPaymentStatus === '2' ? 'Pending' :
                      evtReg?.toyyibPaymentStatus === '3' ? '失败' :
                      evtReg?.toyyibPaymentStatus === '4' ? 'Settling' : null;
                    return (
                      <div className="rounded-xl border border-slate-100 bg-slate-50 overflow-hidden">
                        <div className="px-3.5 py-2.5 bg-white border-b border-slate-100">
                          <p className="text-xs font-semibold text-slate-700">活动付款 Event Ticket</p>
                        </div>
                        <div className="p-3.5 space-y-3">
                          <select
                            className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-jci-blue/30 ${testMemberId && testMemberEventIds.size === 0 ? 'hidden' : ''}`}
                            value={testProjectId}
                            onChange={async e => {
                              const pid = e.target.value;
                              setTestProjectId(pid);
                              if (!pid || !member.id) return;
                              try {
                                const { collection: col, query: q, where: w, getDocs: gd, limit: lim } = await import('firebase/firestore');
                                const { db: fireDb } = await import('../../config/firebase');
                                const { COLLECTIONS: COLS } = await import('../../config/constants');
                                const snap = await gd(q(col(fireDb, COLS.EVENT_REGISTRATIONS), w('eventId', '==', pid), w('memberId', '==', member.id), lim(1)));
                                const reg = snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
                                setTestMembers(prev => prev.map(m => m.id !== testMemberId ? m : {
                                  ...m,
                                  __eventReg: { ...(m as any).__eventReg, [pid]: reg },
                                } as any));
                              } catch { /* silent */ }
                            }}
                          >
                            <option value="">— 选择活动 —</option>
                            {projects
                              .filter(p => !testMemberId || testMemberEventIds.has(p.id))
                              .map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                          </select>
                          {testMemberId && testMemberEventIds.size === 0 && (
                            <p className="text-[11px] text-slate-400 text-center py-1">暂无报名任一活动</p>
                          )}

                          {testProject && (
                            <>
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-[11px] text-slate-500 truncate">{member.name} · {testProject.title}</p>
                                  {evtReg === undefined && <p className="text-[10px] text-slate-400 mt-0.5">加载注册记录中…</p>}
                                  {evtReg === null && <p className="text-[10px] text-amber-500 mt-0.5">无注册记录</p>}
                                </div>
                                <PaymentButton
                                  key={`${member.id}-evt-${testProjectId}`}
                                  type="event"
                                  member={member}
                                  project={{ id: testProject.id, title: testProject.title, ticketPrice: 50 }}
                                  size="sm"
                                  label="Test Pay"
                                  existingPaymentUrl={evtReg?.toyyibPaymentUrl}
                                  existingBillStatus={evtReg?.toyyibPaymentStatus}
                                  onSuccess={result => {
                                    setTestMembers(prev => prev.map(m => m.id !== testMemberId ? m : {
                                      ...m,
                                      __eventReg: {
                                        ...(m as any).__eventReg,
                                        [testProjectId]: {
                                          ...(m as any).__eventReg?.[testProjectId],
                                          toyyibBillCode: result.billCode,
                                          toyyibPaymentUrl: result.paymentUrl,
                                          toyyibPaymentStatus: '2',
                                        },
                                      },
                                    } as any));
                                  }}
                                />
                              </div>
                              {evtReg && (
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t border-slate-200/60">
                                  <div>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">注册状态</p>
                                    <p className="text-xs text-slate-700 mt-0.5">{evtReg.status ?? '—'}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">ToyyibPay</p>
                                    <p className="text-xs text-slate-700 mt-0.5">{evtToyyibLabel ?? '—'}</p>
                                  </div>
                                  <div className="col-span-2 flex items-baseline gap-2">
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wide flex-shrink-0">Bill Code</p>
                                    <p className="text-[10px] font-mono text-slate-500 truncate">{evtReg.toyyibBillCode ?? '—'}</p>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wide flex-shrink-0">Ref</p>
                                    <p className="text-[10px] font-mono text-slate-500 truncate">{evtReg.billExternalReferenceNo ?? '—'}</p>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}
          </div>
        </Card>
      </div>
    );
  };

  // ── Category Management ────────────────────────────────────────────────────
  const renderCategories = () => (
    <ToyyibCategoriesTab
      categories={categories}
      projects={projects}
      isRefreshing={isRefreshing}
      isCreateModalOpen={isCreateModalOpen}
      createType={createType}
      createYear={createYear}
      createMembershipType={createMembershipType}
      createProjectId={createProjectId}
      isCreatingCat={isCreatingCat}
      onRefresh={loadData}
      onOpenImport={() => setIsImportModalOpen(true)}
      onCreateTypeChange={setCreateType}
      onCreateYearChange={setCreateYear}
      onCreateMembershipTypeChange={setCreateMembershipType}
      onCreateProjectIdChange={setCreateProjectId}
      onResetCreate={() => { setCreateType('membership'); setCreateMembershipType(''); setCreateProjectId(''); setCreateYear(String(new Date().getFullYear())); }}
      onCreateCategory={handleCreateCategory}
      onOpenLink={openLinkModal}
      onShowDetails={handleShowCategoryDetails}
      onDelete={handleDelete}
    />
  );
  // ── Bill Management ────────────────────────────────────────────────────────
  const renderBills = () => (
    <ToyyibBillsTab
      bills={bills}
      categories={categories}
      billFilter={billFilter}
      showCreateBill={showCreateBill}
      billCategoryCode={billCategoryCode}
      syncingBill={syncingBill}
      isRefreshing={isRefreshing}
      onBillFilterChange={setBillFilter}
      onToggleCreateBill={() => { setShowCreateBill(v => !v); setBillCategoryCode(''); }}
      onBillCategoryCodeChange={setBillCategoryCode}
      onRefresh={loadData}
      onSyncBillStatus={handleSyncBillStatus}
      onCreateBillSuccess={() => { showToast('Bill created!', 'success'); setShowCreateBill(false); loadData(); }}
      onCreateBillError={error => showToast(error.message, 'error')}
    />
  );
  // ── Settlement ─────────────────────────────────────────────────────────────
  const renderSettlement = () => (
    <div className="py-16 text-center space-y-3">
      <Download size={36} className="mx-auto text-slate-200" />
      <p className="font-semibold text-slate-500">Settlement not available</p>
      <p className="text-sm text-slate-400 max-w-xs mx-auto">
        Get Settlement Summary requires an Enterprise Partner account with ToyyibPay.
      </p>
      <a href="https://toyyibpay.com" target="_blank" rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-jci-blue hover:underline mt-1">
        <ExternalLink size={12} /> Learn more on ToyyibPay
      </a>
    </div>
  );

  // ── Root ───────────────────────────────────────────────────────────────────
  return (
    <div className={embedded ? 'space-y-4' : 'space-y-5 max-w-5xl mx-auto py-4 px-3 md:py-6 md:px-4'}>

      {/* Page header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className={`font-black text-slate-900 ${embedded ? 'text-base' : 'text-lg md:text-xl'}`}>
            ToyyibPay Integration
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">Payment gateway management</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-600 border border-amber-100">
            Sandbox
          </span>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full border border-slate-200"
            onClick={() => setShowSettings(v => !v)} title="Settings">
            <Settings size={14} className={showSettings ? 'text-jci-blue' : 'text-slate-500'} />
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <Tabs
        tabs={TABS.map(t => ({ id: t.key, label: t.label }))}
        activeTab={activeTab}
        onTabChange={(tab) => { setActiveTab(tab as typeof activeTab); setShowSettings(false); }}
      />

      {/* Content */}
      <div>
        {showSettings ? renderSettings() : (
          <>
            {activeTab === 'category' && renderCategories()}
            {activeTab === 'bill' && renderBills()}
            {activeTab === 'settlement' && renderSettlement()}
          </>
        )}
      </div>

      {/* Import Category modal */}
      <Modal isOpen={isImportModalOpen} onClose={() => { setIsImportModalOpen(false); setImportCode(''); }} title="Import Existing Category">
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            Enter the ToyyibPay category code to re-link it to this system. The category must already exist in your account.
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">Category Code</label>
            <Input value={importCode} onChange={e => setImportCode(e.target.value)} placeholder="e.g. 6x9mw99z"
              onKeyDown={e => e.key === 'Enter' && handleImport()} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => { setIsImportModalOpen(false); setImportCode(''); }}>Cancel</Button>
            <Button variant="primary" isLoading={isImporting} onClick={handleImport}>Import</Button>
          </div>
        </div>
      </Modal>

      {/* Category details modal */}
      <Modal isOpen={!!detailsCat} onClose={() => setDetailsCat(null)} title="Category Details">
        {detailsCat && (
          <div className="divide-y divide-slate-100 text-sm">
            {[
              ['Code', <span className="font-mono text-slate-700">{detailsCat.categoryCode}</span>],
              ['Name', <span className="font-semibold">{detailsCat.CategoryName || detailsCat.categoryName}</span>],
              ['Description', detailsCat.categoryDescription || detailsCat.CategoryDescription || '—'],
              ['Status', <Badge variant={detailsCat.categoryStatus === '1' ? 'success' : 'neutral'}>{detailsCat.categoryStatus === '1' ? 'Active' : 'Inactive'}</Badge>],
            ].map(([label, val]) => (
              <div key={String(label)} className="flex items-center justify-between gap-4 py-3">
                <span className="text-slate-400 text-xs font-medium flex-shrink-0">{label}</span>
                <span className="text-right">{val as React.ReactNode}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Link / Assign modal */}
      <Modal isOpen={!!linkCat} onClose={() => setLinkCat(null)} title={`Link Category: ${linkCat?.categoryName}`}>
        {linkCat && (
          <div className="space-y-4">
            {/* Type toggle */}
            <div className="grid grid-cols-2 gap-2">
              {(['membership', 'project'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setLinkType(t)}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${linkType === t
                    ? 'border-jci-blue bg-jci-blue/5 text-jci-blue'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                >
                  {t === 'membership' ? <><Users size={14} /> Membership</> : <><Briefcase size={14} /> Project</>}
                </button>
              ))}
            </div>

            {linkType === 'membership' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Membership Type</label>
                <select
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-jci-blue/30"
                  value={linkMembershipType}
                  onChange={e => setLinkMembershipType(e.target.value)}
                >
                  <option value="">— Select type —</option>
                  {(['Guest', 'Probation', 'Official', 'Honorary', 'Senator', 'Visiting', 'Associate'] as const).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400">Amount auto-resolved from membership config</p>
              </div>
            )}

            {linkType === 'project' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Select Project</label>
                <select
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-jci-blue/30"
                  value={linkProjectId}
                  onChange={e => setLinkProjectId(e.target.value)}
                >
                  <option value="">— Select project —</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
                {projects.length === 0 && <p className="text-[11px] text-slate-400">No projects found</p>}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setLinkCat(null)}>Cancel</Button>
              <Button variant="primary" isLoading={isSavingLink} onClick={handleSaveLink}>Save Link</Button>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} variant={confirmState.variant} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(CONFIRM_CLOSED)} />
    </div>
  );
};
