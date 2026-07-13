import React, { useState, useCallback, useEffect } from 'react';
import { CreditCard, ExternalLink, Plus, RefreshCw, Download, AlertCircle, Link2, Briefcase, Users, Settings, CheckCircle2, XCircle, Copy, Eye, EyeOff, Undo2 } from 'lucide-react';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { COLLECTIONS } from '../../config/constants';
import { Card, Button, Badge, Modal, useToast } from '../ui/Common';
import { Input } from '../ui/Form';
import { ToyyibService, ToyyibBillRecord, ToyyibCategory } from '../../services/toyyibService';
import { ProjectsService } from '../../services/projectsService';
import { CreateBillForm } from '../shared/toyyib/CreateBillForm';
import { BillPaymentLink, billPaymentUrl } from '../shared/toyyib/BillPaymentLink';
import { TOYYIB_CONFIG } from '../../config/constants';
import { PaymentButton } from '../shared/toyyib/PaymentButton';
import { MembersService } from '../../services/membersService';
import { EventRegistrationService } from '../../services/eventRegistrationService';
import { Combobox } from '../ui/Combobox';

export const ToyyibView: React.FC<{ embedded?: boolean }> = ({ embedded }) => {
  const { showToast } = useToast();
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

  const totalBillAmount = bills.reduce((s, b) => s + (b.billAmount || 0), 0);
  const paidBills = bills.filter(b => b.billpaymentStatus === '1');

  // ── Tab bar ────────────────────────────────────────────────────────────────
  const TABS = [
    { key: 'category' as const, label: 'Categories' },
    { key: 'bill' as const, label: 'Bills' },
    { key: 'settlement' as const, label: 'Settlement' },
  ];

  // ── Helpers ────────────────────────────────────────────────────────────────
  const billStatusBadge = (billpaymentStatus: string) => {
    switch (billpaymentStatus) {
      case '1': return { variant: 'success' as const, label: 'PAID' };
      case '3': return { variant: 'error' as const, label: 'FAILED' };
      default: return { variant: 'warning' as const, label: 'PENDING' };
    }
  };

  const linkedLabel = (cat: ToyyibCategory) => {
    if (cat.linkedType === 'membership') return { icon: <Users size={10} />, text: `Membership · ${cat.membershipType || ''}`, color: 'bg-purple-50 text-purple-700' };
    if (cat.linkedType === 'project' && cat.linkedProjectName) return { icon: <Briefcase size={10} />, text: cat.linkedProjectName, color: 'bg-blue-50 text-blue-700' };
    return null;
  };

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
      { label: 'Endpoint', value: TOYYIB_CONFIG.IS_SANDBOX ? TOYYIB_CONFIG.SANDBOX_ENDPOINT : TOYYIB_CONFIG.ENDPOINT, key: 'endpoint', mono: true },
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

          {/* Environment */}
          <div className="px-4 sm:px-5 py-3 flex items-center gap-3 border-b border-slate-50">
            <span className="text-xs text-slate-500 font-medium w-28 sm:w-36 flex-shrink-0">Environment</span>
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${TOYYIB_CONFIG.IS_SANDBOX ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
              {TOYYIB_CONFIG.IS_SANDBOX ? 'Sandbox' : 'Production'}
            </span>
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
                                onClick={async () => {
                                  if (!member.id) return;
                                  if (!window.confirm(`撤回 ${member.name} ${testYear} 年会费账单记录？`)) return;
                                  try {
                                    await updateDoc(doc(db, COLLECTIONS.MEMBERS, member.id), {
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-bold text-slate-800 text-sm md:text-base">Bill Categories</h3>
          <p className="text-xs text-slate-400">{categories.length} categories linked</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 border border-slate-200 rounded-lg" onClick={loadData} isLoading={isRefreshing} title="Refresh">
            <RefreshCw size={14} className="text-slate-500" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 px-3 border border-slate-200 rounded-lg text-xs font-medium" onClick={() => setIsImportModalOpen(true)}>
            Import
          </Button>
        </div>
      </div>

      {/* Mobile: cards */}
      <div className="md:hidden space-y-2">
        {/* Inline create row — mobile, always visible at top */}
        <div className="bg-jci-blue/5 border border-jci-blue/20 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(['membership', 'project'] as const).map(t => (
              <button key={t} onClick={() => setCreateType(t)}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${createType === t ? 'border-jci-blue bg-jci-blue/10 text-jci-blue' : 'border-slate-200 bg-white text-slate-500'
                  }`}>
                {t === 'membership' ? <><Users size={12} /> Membership</> : <><Briefcase size={12} /> Project</>}
              </button>
            ))}
          </div>
          {createType === 'membership' && (
            <div className="grid grid-cols-2 gap-2">
              <Input value={createYear} onChange={e => setCreateYear(e.target.value)} placeholder="Year e.g. 2026" />
              <select className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-jci-blue/30"
                value={createMembershipType} onChange={e => setCreateMembershipType(e.target.value)}>
                <option value="">— Type —</option>
                {(['Guest', 'Probation', 'Official', 'Honorary', 'Senator', 'Visiting', 'Associate'] as const).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}
          {createType === 'project' && (
            <select className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-jci-blue/30"
              value={createProjectId} onChange={e => setCreateProjectId(e.target.value)}>
              <option value="">— Select project —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          )}
          {((createType === 'membership' && createYear && createMembershipType) || (createType === 'project' && createProjectId)) && (
            <p className="text-[11px] text-slate-500">
              Name: <span className="font-semibold text-slate-800">
                {createType === 'membership' ? `${createYear} Membership` : projects.find(p => p.id === createProjectId)?.title}
              </span>
            </p>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="flex-1 h-8 text-xs" onClick={() => { setCreateType('membership'); setCreateMembershipType(''); setCreateProjectId(''); setCreateYear(String(new Date().getFullYear())); }}>Reset</Button>
            <Button size="sm" variant="primary" className="flex-1 h-8 text-xs" isLoading={isCreatingCat} onClick={handleCreateCategory}>Create & Link</Button>
          </div>
        </div>
        {isRefreshing ? (
          [1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)
        ) : categories.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <CreditCard size={32} className="mx-auto text-slate-300" />
            <p className="text-sm text-slate-400">No categories found</p>
            <p className="text-xs text-slate-300">Import a code or create a new category</p>
          </div>
        ) : categories.map((cat, i) => {
          const tag = linkedLabel(cat);
          return (
            <div key={cat.categoryCode || i} className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 text-sm">{cat.categoryName || '—'}</span>
                    <Badge variant={cat.categoryStatus === '1' ? 'success' : 'neutral'} className="text-[10px] flex-shrink-0">
                      {cat.categoryStatus === '1' ? 'ACTIVE' : 'INACTIVE'}
                    </Badge>
                  </div>
                  {tag ? (
                    <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${tag.color}`}>
                      {tag.icon}{tag.text}
                    </span>
                  ) : null}
                  <p className="text-[11px] font-mono text-slate-400 mt-1.5">{cat.categoryCode}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  {cat.billCount ? (
                    <>
                      <p className="font-bold text-slate-800 text-sm">{cat.billCount} bills</p>
                      <p className="text-xs text-jci-blue font-medium">RM {(cat.totalAmount || 0).toFixed(2)}</p>
                    </>
                  ) : <p className="text-xs text-slate-300">No bills</p>}
                </div>
              </div>
              <div className="flex gap-1 mt-3 pt-3 border-t border-slate-50">
                <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs text-slate-500" onClick={() => openLinkModal(cat)}>
                  <Link2 size={11} className="mr-1" />Link
                </Button>
                <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs text-jci-blue" onClick={() => ToyyibService.getCategoryDetails(cat.categoryCode).then(d => setDetailsCat(d?.[0] ?? cat)).catch(() => setDetailsCat(cat))}>
                  Details
                </Button>
                <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs text-red-500 hover:bg-red-50" onClick={() => handleDelete(cat.categoryCode)}>
                  Remove
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100">
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Linked To</th>
                  <th className="px-5 py-3 font-medium">Code</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Bills / Total</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {/* Inline create row — desktop, always visible at top */}
                <tr className="bg-jci-blue/5 border-b border-jci-blue/20">
                  <td colSpan={6} className="px-5 py-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Type toggle */}
                      <div className="flex gap-1.5 flex-shrink-0">
                        {(['membership', 'project'] as const).map(t => (
                          <button key={t} onClick={() => setCreateType(t)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${createType === t ? 'border-jci-blue bg-jci-blue/10 text-jci-blue' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                              }`}>
                            {t === 'membership' ? <><Users size={12} /> Membership</> : <><Briefcase size={12} /> Project</>}
                          </button>
                        ))}
                      </div>

                      {/* Fields */}
                      {createType === 'membership' && (
                        <>
                          <Input value={createYear} onChange={e => setCreateYear(e.target.value)}
                            placeholder="Year" className="w-24 h-8 text-xs" />
                          <select className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 h-8 focus:outline-none focus:ring-2 focus:ring-jci-blue/30"
                            value={createMembershipType} onChange={e => setCreateMembershipType(e.target.value)}>
                            <option value="">— Type —</option>
                            {(['Guest', 'Probation', 'Official', 'Honorary', 'Senator', 'Visiting', 'Associate'] as const).map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </>
                      )}
                      {createType === 'project' && (
                        <select className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 h-8 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-jci-blue/30"
                          value={createProjectId} onChange={e => setCreateProjectId(e.target.value)}>
                          <option value="">— Select project —</option>
                          {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                        </select>
                      )}

                      {/* Name preview */}
                      {((createType === 'membership' && createYear && createMembershipType) || (createType === 'project' && createProjectId)) && (
                        <span className="text-xs text-slate-500">
                          → <span className="font-semibold text-slate-800">
                            {createType === 'membership' ? `${createYear} Membership` : projects.find(p => p.id === createProjectId)?.title}
                          </span>
                        </span>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 ml-auto flex-shrink-0">
                        <Button size="sm" variant="ghost" className="h-8 px-3 text-xs"
                          onClick={() => { setCreateType('membership'); setCreateMembershipType(''); setCreateProjectId(''); setCreateYear(String(new Date().getFullYear())); }}>
                          Reset
                        </Button>
                        <Button size="sm" variant="primary" className="h-8 px-3 text-xs" isLoading={isCreatingCat} onClick={handleCreateCategory}>
                          Create & Link
                        </Button>
                      </div>
                    </div>
                  </td>
                </tr>
                {isRefreshing ? (
                  [1, 2, 3].map(i => (
                    <tr key={i}>
                      {[1, 2, 3, 4, 5, 6].map(j => <td key={j} className="px-5 py-4"><div className="h-3 bg-slate-100 rounded animate-pulse" /></td>)}
                    </tr>
                  ))
                ) : categories.length === 0 && !isCreateModalOpen ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center">
                      <CreditCard size={28} className="mx-auto text-slate-200 mb-2" />
                      <p className="text-slate-400 text-sm">No categories — import a code or create new</p>
                    </td>
                  </tr>
                ) : categories.map((cat, i) => {
                  const tag = linkedLabel(cat);
                  return (
                    <tr key={cat.categoryCode || i} className="group hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">{cat.categoryName || '—'}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{cat.categoryDescription}</p>
                      </td>
                      <td className="px-5 py-4">
                        {tag ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${tag.color}`}>
                            {tag.icon}{tag.text}
                          </span>
                        ) : (
                          <button onClick={() => openLinkModal(cat)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-jci-blue">
                            <Link2 size={11} /> Assign
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-400">{cat.categoryCode}</td>
                      <td className="px-5 py-4">
                        <Badge variant={cat.categoryStatus === '1' ? 'success' : 'neutral'} className="text-[10px]">
                          {cat.categoryStatus === '1' ? 'ACTIVE' : 'INACTIVE'}
                        </Badge>
                      </td>
                      <td className="px-5 py-4">
                        {cat.billCount ? (
                          <div>
                            <span className="font-semibold text-slate-800">{cat.billCount}</span>
                            <p className="text-xs text-slate-400">RM {(cat.totalAmount || 0).toFixed(2)}</p>
                          </div>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-4 text-right space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-slate-500 text-xs" onClick={() => openLinkModal(cat)}>
                          Link
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-jci-blue text-xs"
                          onClick={() => ToyyibService.getCategoryDetails(cat.categoryCode).then(d => setDetailsCat(d?.[0] ?? cat)).catch(() => setDetailsCat(cat))}>
                          Details
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-red-400 hover:bg-red-50 text-xs"
                          onClick={() => handleDelete(cat.categoryCode)}>
                          Remove
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );

  // ── Bill Management ────────────────────────────────────────────────────────

  const renderBills = () => {
    const filteredBills = billFilter === 'all'
      ? bills
      : bills.filter(b => {
        const s = b.billpaymentStatus ?? '2';
        if (billFilter === '1') return s === '1';
        if (billFilter === '3') return s === '3';
        return s === '2' || s === '4'; // pending
      });

    const catMap = Object.fromEntries(categories.map(c => [c.categoryCode, c]));

    const FILTERS: { key: 'all' | '1' | '2' | '3'; label: string }[] = [
      { key: 'all', label: 'All' },
      { key: '2', label: 'Pending' },
      { key: '1', label: 'Paid' },
      { key: '3', label: 'Failed' },
    ];

    const createBillCat = categories.find(c => c.categoryCode === billCategoryCode);
    const createBillCatTag = createBillCat ? linkedLabel(createBillCat) : null;

    return (
      <div className="space-y-4">

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          {[
            { label: 'Total Bills', value: String(bills.length) },
            { label: 'Total Amount', value: `RM ${totalBillAmount.toFixed(2)}` },
            { label: 'Paid', value: bills.length ? `${Math.round(paidBills.length / bills.length * 100)}%` : '0%' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-slate-100 rounded-xl px-3 py-3 shadow-sm text-center">
              <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide leading-tight">{s.label}</p>
              <p className="font-bold text-slate-900 text-sm md:text-base mt-1 leading-tight">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Create Bill — collapsible */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <button
            className="w-full px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
            onClick={() => { setShowCreateBill(v => !v); setBillCategoryCode(''); }}
          >
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-lg bg-jci-blue/10 flex items-center justify-center flex-shrink-0">
                <Plus size={14} className="text-jci-blue" />
              </div>
              <div className="text-left">
                <p className="font-bold text-slate-900 text-sm leading-tight">Manual Bill</p>
                <p className="text-[11px] text-slate-400 leading-tight">Generate a payment link manually</p>
              </div>
            </div>
            <span className={`text-slate-400 text-xs font-medium transition-transform duration-200 ${showCreateBill ? 'rotate-180' : ''}`}>▾</span>
          </button>

          {showCreateBill && (
            <div className="border-t border-slate-100 p-5 space-y-4">
              {/* Category picker */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Category</label>
                <select
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-jci-blue/30 focus:bg-white transition-colors"
                  value={billCategoryCode}
                  onChange={e => setBillCategoryCode(e.target.value)}
                >
                  <option value="">— Select a category —</option>
                  {categories.map(c => {
                    const suffix = c.linkedType === 'membership'
                      ? ` · Membership`
                      : c.linkedProjectName ? ` · ${c.linkedProjectName}` : '';
                    return <option key={c.categoryCode} value={c.categoryCode}>{c.categoryName}{suffix}</option>;
                  })}
                </select>
                {createBillCat && (
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${createBillCatTag ? createBillCatTag.color : 'bg-slate-50 text-slate-500'}`}>
                    {createBillCatTag ? <>{createBillCatTag.icon}<span>{createBillCatTag.text}</span></> : <span className="text-slate-400">No activity linked</span>}
                    <span className="mx-1 opacity-30">·</span>
                    <span className="font-mono opacity-60">{createBillCat.categoryCode}</span>
                  </div>
                )}
              </div>

              {/* Bill form */}
              {billCategoryCode ? (
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                  <CreateBillForm
                    key={billCategoryCode}
                    categoryCode={billCategoryCode}
                    defaultBillName={createBillCat?.linkedType === 'membership'
                      ? `${new Date().getFullYear()} Renewal Membership`
                      : createBillCat?.linkedProjectName}
                    onSuccess={() => { showToast('Bill created!', 'success'); setShowCreateBill(false); loadData(); }}
                    onError={e => showToast(e.message, 'error')}
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center">
                  <p className="text-xs text-slate-400">Select a category above to fill in bill details</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bills list */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* List header */}
          <div className="px-4 md:px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Bills</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {filteredBills.length}{billFilter !== 'all' ? ` of ${bills.length}` : ''} bill{bills.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 border border-slate-200 rounded-lg flex-shrink-0" onClick={loadData} isLoading={isRefreshing} title="Refresh">
              <RefreshCw size={14} className="text-slate-500" />
            </Button>
          </div>

          {/* Filter bar */}
          <div className="px-4 md:px-5 py-2.5 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {FILTERS.map(f => (
              <button key={f.key} onClick={() => setBillFilter(f.key)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${billFilter === f.key
                  ? 'bg-jci-blue text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}>
                {f.label}
                {f.key !== 'all' && (
                  <span className="ml-1 opacity-70">
                    {f.key === '1' ? paidBills.length
                      : f.key === '3' ? bills.filter(b => b.billpaymentStatus === '3').length
                        : bills.filter(b => !b.billpaymentStatus || b.billpaymentStatus === '2' || b.billpaymentStatus === '4').length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-slate-50">
            {isRefreshing ? (
              [1, 2, 3].map(i => <div key={i} className="px-4 py-3"><div className="h-16 bg-slate-100 rounded-lg animate-pulse" /></div>)
            ) : filteredBills.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <CreditCard size={28} className="mx-auto text-slate-200" />
                <p className="text-sm text-slate-400">{billFilter === 'all' ? 'No bills yet' : 'No bills in this filter'}</p>
              </div>
            ) : filteredBills.slice(0, 30).map((b: any, i) => {
              const cat = catMap[b.categoryCode];
              const catTag = cat ? linkedLabel(cat) : null;
              const bs = billStatusBadge(b.billpaymentStatus ?? '2');
              return (
                <div key={b.billCode || i} className="px-4 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 text-sm leading-tight truncate">{b.billTo || b.billName}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">{b.billName}</p>
                      {b.billDescription && (
                        <p className="text-[10px] text-slate-400 truncate">{b.billDescription}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0 space-y-0.5">
                      <p className="font-bold text-slate-900 text-sm">RM {(b.billAmount || 0).toFixed(2)}</p>
                      <Badge variant={bs.variant} className="text-[10px]">{bs.label}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {catTag ? (
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${catTag.color}`}>
                          {catTag.icon}{cat?.categoryName}
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-slate-300 truncate">{b.categoryCode}</span>
                      )}
                      {b.billPaymentDate && typeof b.billPaymentDate !== 'object' && (
                        <span className="text-[10px] text-slate-400 truncate">{b.billPaymentDate}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {b.billCode && b.billpaymentStatus !== '1' && (
                        <button
                          className="text-[11px] text-slate-400 hover:text-jci-blue disabled:opacity-40 transition-colors"
                          disabled={syncingBill === b.billCode}
                          onClick={() => handleSyncBillStatus(b.billCode)}
                        >
                          {syncingBill === b.billCode ? '…' : 'Sync'}
                        </button>
                      )}
                      {b.billCode && <BillPaymentLink billCode={b.billCode} variant="link" label="Open" className="text-[11px]" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100">
                  <th className="px-5 py-3 font-medium">Payer / Bill</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Code</th>
                  <th className="px-5 py-3 font-medium text-right">Amount</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isRefreshing ? (
                  [1, 2, 3].map(i => (
                    <tr key={i}>
                      {[1, 2, 3, 4, 5, 6].map(j => <td key={j} className="px-5 py-4"><div className="h-3 bg-slate-100 rounded animate-pulse" /></td>)}
                    </tr>
                  ))
                ) : filteredBills.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center">
                      <CreditCard size={28} className="mx-auto text-slate-200 mb-2" />
                      <p className="text-slate-400 text-sm">{billFilter === 'all' ? 'No bills yet — create one above' : 'No bills in this filter'}</p>
                    </td>
                  </tr>
                ) : filteredBills.slice(0, 50).map((b: any, i) => {
                  const cat = catMap[b.categoryCode];
                  const catTag = cat ? linkedLabel(cat) : null;
                  const bs = billStatusBadge(b.billpaymentStatus ?? '2');
                  return (
                    <tr key={b.billCode || i} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-slate-900">{b.billTo || '—'}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{b.billName}</p>
                        {b.billDescription && (
                          <p className="text-[10px] text-slate-300 mt-0.5 max-w-xs truncate">{b.billDescription}</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {catTag ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${catTag.color}`}>
                            {catTag.icon}{cat?.categoryName}
                          </span>
                        ) : (
                          <span className="text-xs font-mono text-slate-300">{b.categoryCode || '—'}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-400">{b.billCode}</td>
                      <td className="px-5 py-3.5 text-right font-bold text-slate-900">RM {(b.billAmount || 0).toFixed(2)}</td>
                      <td className="px-5 py-3.5">
                        <Badge variant={bs.variant} className="text-[10px]">{bs.label}</Badge>
                        {b.billPaymentDate && typeof b.billPaymentDate !== 'object' && (
                          <p className="text-[10px] text-slate-400 mt-0.5">{b.billPaymentDate}</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-3">
                          {b.billCode && b.billpaymentStatus !== '1' && (
                            <button
                              className="text-xs text-slate-400 hover:text-jci-blue disabled:opacity-40 transition-colors whitespace-nowrap"
                              disabled={syncingBill === b.billCode}
                              onClick={() => handleSyncBillStatus(b.billCode)}
                            >
                              {syncingBill === b.billCode ? 'Syncing…' : 'Sync'}
                            </button>
                          )}
                          {b.billCode && <BillPaymentLink billCode={b.billCode} variant="link" label="Open" />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

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

      {/* Tab bar — scrollable on mobile */}
      <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-none -mx-3 px-3 md:mx-0 md:px-0">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setActiveTab(t.key); setShowSettings(false); }}
            className={`flex-shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === t.key
              ? 'border-jci-blue text-jci-blue'
              : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

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
    </div>
  );
};
