import React from 'react';
import { AlertCircle, CheckCircle2, Copy, Eye, EyeOff, RefreshCw, Settings, Undo2, XCircle } from 'lucide-react';
import { deleteField, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { COLLECTIONS, TOYYIB_CONFIG } from '../../../config/constants';
import { Card, Button, CONFIRM_CLOSED } from '../../ui/Common';
import type { ConfirmState } from '../../ui/Common';
import { Combobox } from '../../ui/Combobox';
import { PaymentButton } from '../../shared/toyyib/PaymentButton';
import { ToyyibService } from '../../../services/toyyibService';
import { EventRegistrationService } from '../../../services/eventRegistrationService';

interface ToyyibSettingsPanelProps {
  connStatus: 'idle' | 'testing' | 'ok' | 'fail';
  showSecretKey: boolean;
  isSandbox: boolean;
  hasProdKey: boolean;
  modeLoading: boolean;
  togglingMode: boolean;
  copiedField: string | null;
  testMembers: any[];
  testMemberId: string;
  testProjectId: string;
  testYear: number;
  testSyncing: boolean;
  testMemberEventIds: Set<string>;
  projects: { id: string; title: string }[];
  onTestConnection: () => void;
  onCopyField: (value: string, key: string) => void;
  showToast: (message: string, type?: any) => void;
  loadData: () => void | Promise<void>;
  setShowSecretKey: React.Dispatch<React.SetStateAction<boolean>>;
  setTogglingMode: React.Dispatch<React.SetStateAction<boolean>>;
  setTestMembers: React.Dispatch<React.SetStateAction<any[]>>;
  setTestMemberId: React.Dispatch<React.SetStateAction<string>>;
  setTestProjectId: React.Dispatch<React.SetStateAction<string>>;
  setTestYear: React.Dispatch<React.SetStateAction<number>>;
  setTestSyncing: React.Dispatch<React.SetStateAction<boolean>>;
  setTestMemberEventIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setConfirmState: React.Dispatch<React.SetStateAction<ConfirmState>>;
}
export const ToyyibSettingsPanel: React.FC<ToyyibSettingsPanelProps> = ({
  connStatus,
  showSecretKey,
  isSandbox,
  hasProdKey,
  modeLoading,
  togglingMode,
  copiedField,
  testMembers,
  testMemberId,
  testProjectId,
  testYear,
  testSyncing,
  testMemberEventIds,
  projects,
  onTestConnection,
  onCopyField,
  showToast,
  loadData,
  setShowSecretKey,
  setTogglingMode,
  setTestMembers,
  setTestMemberId,
  setTestProjectId,
  setTestYear,
  setTestSyncing,
  setTestMemberEventIds,
  setConfirmState,
}) => {
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
                <Button size="sm" variant="outline" isLoading={connStatus === 'testing'} onClick={onTestConnection} className="h-8 px-3 text-xs">
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
                  <button onClick={() => onCopyField(row.value, row.key)} className="p-1.5 rounded text-slate-400 hover:text-jci-blue transition-colors">
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
                  <button onClick={() => onCopyField(row.value, row.label)} className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-jci-blue transition-colors">
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
                                const { db: fireDb } = await import('../../../config/firebase');
                                const { COLLECTIONS: COLS } = await import('../../../config/constants');
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
