import React, { useState, useEffect } from 'react';
import {
  Users,
  DollarSign,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter,
  Send,
  RefreshCw,
  Download,
  Plus,
  Edit
} from 'lucide-react';
import { DuesRenewalService } from '../../../services/duesRenewalService';
import { FinanceService } from '../../../services/financeService';
import { MembersService } from '../../../services/membersService';
import {
  MembershipType,
  MembershipDues,
  DuesRenewalTransaction,
  DuesRenewalSummary,
  MembershipRecord,
  MembershipStatus,
  MembershipRuleConfig
} from '../../../types';
import {
  MembershipConfigService,
  resolveMembershipPurpose,
  DEFAULT_MEMBERSHIP_RULES,
  getTargetDuesForMembershipType,
  resolveMembershipTypeFromDues,
} from '../../../services/membershipConfigService';
import type { Transaction } from '../../../types';
// Re-scan trigger

/** First-year membership dues (base + registration), shown as "New" in breakdown */
const NEW_MEMBERSHIP_DUES = 350;

type RenewalWithTargetDues = DuesRenewalTransaction & { targetDues: number };

/** Fuzzy-match a transaction to a member via description / referenceNumber */
const findMatchingMember = (
  tx: Transaction,
  membersList: Array<{ id: string; name: string; fullName?: string }>
) => {
  // If already linked by memberId, return exact match
  if (tx.memberId) {
    return membersList.find(m => m.id === tx.memberId) || null;
  }

  // Normalize: lowercase + strip all non-alphanumeric chars
  const norm = (s?: string | null) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const cleanDesc = norm(tx.description);
  const cleanRef = norm(tx.referenceNumber);
  if (!cleanDesc && !cleanRef) return null;

  for (const member of membersList) {
    const candidates = [norm(member.name), norm(member.fullName)];
    for (const c of candidates) {
      if (c && c.length >= 3 && (cleanDesc.includes(c) || cleanRef.includes(c))) {
        return member;
      }
    }
  }
  return null;
};

interface DuesRenewalDashboardProps {
  year?: number;
  /** 会费流水（category=Membership 的交易） */
  membershipTransactions?: Transaction[];
  onEditMembershipTransaction?: (tx: Transaction, filterYear: number) => void;
  onDeleteMembershipTransaction?: (txId: string) => void;
  hasEditPermission?: boolean;
  formatCurrency?: (amount: number) => string;
  formatDate?: (date: string) => string;
  /** 批量修复会员首次会费后刷新父级数据 */
  onMembershipDataChanged?: () => void | Promise<void>;
  /** 会员列表，用于显示 memberId 对应的姓名 */
  members?: Array<{
    id: string;
    name: string;
    fullName?: string;
    membershipType?: MembershipType;
    introducer?: string;
    tshirtSize?: string;
    jacketSize?: string;
    joinDate?: string;
    membership?: Record<string, MembershipRecord>;
  }>;
}

export const DuesRenewalDashboard: React.FC<DuesRenewalDashboardProps> = ({
  year = new Date().getFullYear(),
  membershipTransactions = [],
  onEditMembershipTransaction,
  onDeleteMembershipTransaction,
  hasEditPermission = false,
  formatCurrency: fmtCurrency = (n) => n.toLocaleString('en-MY', { style: 'currency', currency: 'MYR' }),
  formatDate: fmtDate = (d) => new Date(d).toLocaleDateString(),
  onMembershipDataChanged,
  members = [],
}) => {
  const [summary, setSummary] = useState<DuesRenewalSummary | null>(null);
  const [renewals, setRenewals] = useState<DuesRenewalTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const availableYears = React.useMemo(() => {
    const endYear = new Date().getFullYear();
    return Array.from({ length: endYear - 2000 + 1 }, (_, i) => endYear - i);
  }, []);

  const [selectedYear, setSelectedYear] = useState(year);
  const [filterType, setFilterType] = useState<MembershipType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<MembershipStatus | 'all'>('all');
  const [creatingRenewals, setCreatingRenewals] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [autoMatching, setAutoMatching] = useState(false);
  const [fixingFirstDues, setFixingFirstDues] = useState(false);
  const [syncingMembershipTypes, setSyncingMembershipTypes] = useState(false);
  const [syncingMembershipRecords, setSyncingMembershipRecords] = useState(false);

  /** One-click: fuzzy-match all unlinked membership transactions and persist memberId to Firestore */
  const handleAutoMatchMembers = async () => {
    setAutoMatching(true);
    try {
      // Filter to current year
      const filteredByYear = membershipTransactions.filter((tx) => {
        const yearFromProjectId = tx.projectId?.match(/^(\d+)\s+membership$/)?.[1];
        const txYear = yearFromProjectId ? parseInt(yearFromProjectId, 10) : new Date(tx.date).getFullYear();
        return txYear === selectedYear;
      });

      const unlinked = filteredByYear.filter(tx => !tx.memberId);
      let matched = 0;
      let skipped = 0;
      const rules = await MembershipConfigService.getRules();

      for (const tx of unlinked) {
        const member = findMatchingMember(tx, members);
        if (member) {
          const purpose = resolveMembershipPurpose(tx.amount, selectedYear, rules);
          await FinanceService.updateTransaction(tx.id, {
            memberId: member.id,
            projectId: `${selectedYear} membership`,
            category: 'Membership',
            purpose,
          });
          matched++;
        } else {
          skipped++;
        }
      }

      alert(`自动匹配完成！\n✅ 成功关联: ${matched} 笔\n⏭️ 未匹配: ${skipped} 笔\n📌 已关联: ${filteredByYear.length - unlinked.length} 笔（跳过）`);

      // Reload page data to reflect changes
      window.location.reload();
    } catch (err: any) {
      alert(`自动匹配失败: ${err.message}`);
    } finally {
      setAutoMatching(false);
    }
  };

  const handleFixFirstMembershipDues = async () => {
    const confirmed = window.confirm(
      '将所有会员「首个会费年份」的应缴 dues 调整为 RM350，并根据已付金额重新计算状态？\n\n仅影响 members.membership 中最早年份的记录。'
    );
    if (!confirmed) return;

    setFixingFirstDues(true);
    try {
      const result = await MembersService.fixFirstMembershipDuesTo350();
      alert(
        `首次会费调整完成\n` +
          `扫描会员: ${result.scanned}\n` +
          `已更新: ${result.updated}\n` +
          `无 membership 记录: ${result.skippedNoMembership}\n` +
          `已是 RM350: ${result.alreadyCorrect}` +
          (result.errors.length > 0 ? `\n失败: ${result.errors.length}（见控制台）` : '')
      );
      if (result.errors.length > 0) {
        console.error('fixFirstMembershipDuesTo350 errors:', result.errors);
      }
      await onMembershipDataChanged?.();
      await loadDashboardData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误';
      alert(`首次会费调整失败: ${message}`);
    } finally {
      setFixingFirstDues(false);
    }
  };

  const handleBatchSyncMembershipTypes = async () => {
    const confirmed = window.confirm(
      `根据 ${selectedYear} 年会费记录、角色与 Membership Config，批量推断并写入 members.membershipType？\n\n` +
        '不会修改 membership 字段。建议先确保 membership 数据准确，或之后执行「同步 membership」。'
    );
    if (!confirmed) return;

    setSyncingMembershipTypes(true);
    try {
      const result = await MembersService.batchSyncMembershipTypes({ year: selectedYear });
      alert(
        `membershipType 同步完成（${result.year} 年）\n` +
          `扫描: ${result.scanned}\n` +
          `已更新: ${result.updated}\n` +
          `无需变更: ${result.alreadyCorrect}` +
          (result.errors.length > 0 ? `\n失败: ${result.errors.length}（见控制台）` : '')
      );
      if (result.errors.length > 0) {
        console.error('batchSyncMembershipTypes errors:', result.errors);
      }
      await onMembershipDataChanged?.();
      await loadDashboardData();
    } catch (err: unknown) {
      alert(`membershipType 同步失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setSyncingMembershipTypes(false);
    }
  };

  const handleBatchSyncMembershipRecords = async () => {
    const confirmed = window.confirm(
      `根据每位会员的 membershipType 与 Membership Config，批量更新 ${selectedYear} 年的 members.membership？\n\n` +
        '将写入 dues / status 等；可为符合条件会员新建该年记录。不会修改 membershipType。'
    );
    if (!confirmed) return;

    setSyncingMembershipRecords(true);
    try {
      const result = await MembersService.batchSyncMembershipRecords({
        year: selectedYear,
        membershipTransactions,
        onlyExistingRecords: false,
      });
      alert(
        `membership 同步完成（${result.year} 年）\n` +
          `扫描: ${result.scanned}\n` +
          `更新: ${result.updated}\n` +
          `新建: ${result.created}\n` +
          `未达本年度: ${result.skippedNotEligible}\n` +
          `已是最新: ${result.alreadyCorrect}` +
          (result.errors.length > 0 ? `\n失败: ${result.errors.length}（见控制台）` : '')
      );
      if (result.errors.length > 0) {
        console.error('batchSyncMembershipRecords errors:', result.errors);
      }
      await onMembershipDataChanged?.();
      await loadDashboardData();
    } catch (err: unknown) {
      alert(`membership 同步失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setSyncingMembershipRecords(false);
    }
  };

  const [membershipRules, setMembershipRules] = useState<Record<MembershipType, MembershipRuleConfig> | null>(null);
  const [calculationMode, setCalculationMode] = useState<'calendar' | 'payment_date'>('calendar');

  useEffect(() => {
    const fetchConfig = async () => {
      const config = await MembershipConfigService.getConfig();
      setMembershipRules(config.rules);
      setCalculationMode(config.calculationMode);
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [selectedYear]);

  useEffect(() => {
    if (!availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0] ?? new Date().getFullYear());
    }
  }, [availableYears]);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, renewalsData] = await Promise.all([
        DuesRenewalService.generateRenewalSummary(selectedYear),
        DuesRenewalService.getRenewalTransactionsByYear(selectedYear),
      ]);
      setSummary(summaryData);
      setRenewals(renewalsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRenewals = async () => {
    setCreatingRenewals(true);
    try {
      const result = await DuesRenewalService.createRenewalTransactions(selectedYear);
      alert(`Created ${result.created} renewal transactions. Skipped ${result.skipped}. Errors: ${result.errors.length}`);
      await loadDashboardData();
    } catch (err: any) {
      alert(`Error creating renewals: ${err.message}`);
    } finally {
      setCreatingRenewals(false);
    }
  };

  const handleSendReminders = async () => {
    setSendingReminders(true);
    try {
      const remindersSent = await DuesRenewalService.sendDuesReminders(selectedYear);
      alert(`Sent ${remindersSent} reminder notifications`);
    } catch (err: any) {
      alert(`Error sending reminders: ${err.message}`);
    } finally {
      setSendingReminders(false);
    }
  };

  const mergedRenewals = React.useMemo((): RenewalWithTargetDues[] => {
    const getEffectiveJoinYear = (m: any): number => {
      if (calculationMode === 'payment_date') {
        const memberTxs = membershipTransactions.filter(
          tx => tx.memberId === m.id && tx.category === 'Membership'
        );
        if (memberTxs.length > 0) {
          const sorted = [...memberTxs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          return new Date(sorted[0].date).getFullYear();
        }
      }

      if (!m.joinDate) return selectedYear;
      const date = new Date(m.joinDate);
      const calendarYear = date.getFullYear();
      const month = date.getMonth(); // 0-indexed: 9 = Oct
      const day = date.getDate();
      if (month > 9 || (month === 9 && day >= 1)) {
        return calendarYear + 1;
      }
      return calendarYear;
    };

    // Only show people whose effective join year is in or before the selected year
    const yearMembers = members.filter(m => {
      if (!m.joinDate && calculationMode === 'calendar') return false;
      const effYear = getEffectiveJoinYear(m);
      return effYear <= selectedYear;
    });

    const existingMap = new Map<string, DuesRenewalTransaction>();
    renewals.forEach(r => existingMap.set(r.memberId, r));

    const merged = yearMembers.map(m => {
      // Check for structured membership record in member object first
      const membershipData = m.membership?.[String(selectedYear)];
      const rules = membershipRules || DEFAULT_MEMBERSHIP_RULES;

      const joinYear = getEffectiveJoinYear(m);
      const isFirstYear = joinYear === selectedYear;

      const getTargetDues = (mType: MembershipType) =>
        getTargetDuesForMembershipType(mType, isFirstYear, rules);

      const resolveTypeFromDues = (amt: number, currentType: MembershipType) =>
        resolveMembershipTypeFromDues(amt, rules, currentType);

      if (membershipData) {
        const rawType = m.membershipType || 'Probation';
        const duesVal = Number(membershipData.dues) || getTargetDues(rawType);
        const resolvedType = resolveTypeFromDues(duesVal, rawType);
        return {
          id: `summary-${m.id}-${selectedYear}`,
          memberId: m.id,
          membershipType: resolvedType,
          duesYear: selectedYear,
          amount: membershipData.amount, // Keep actual paid amount
          targetDues: duesVal, // Configured dues amount
          status: membershipData.status,
          dueDate: new Date(selectedYear, 2, 31).toISOString(),
          isRenewal: !isFirstYear,
        } as DuesRenewalTransaction & { targetDues: number };
      }

      // Fallback to duesRenewals collection if no summary found
      const existing = existingMap.get(m.id);
      if (existing) {
        const duesVal = existing.amount > 0 ? existing.amount : getTargetDues(existing.membershipType);
        const resolvedType = resolveTypeFromDues(duesVal, existing.membershipType);
        return {
          ...existing,
          membershipType: resolvedType,
          targetDues: duesVal,
          isRenewal: !isFirstYear,
        } as DuesRenewalTransaction & { targetDues: number };
      }

      const type = (m.membershipType && MembershipDues[m.membershipType])
        ? m.membershipType
        : 'Probation';

      const duesVal = getTargetDues(type);
      const resolvedType = resolveTypeFromDues(duesVal, type);

      return {
        id: `virtual-${m.id}`,
        memberId: m.id,
        membershipType: resolvedType,
        duesYear: selectedYear,
        amount: 0,
        targetDues: duesVal,
        status: 'pending',
        dueDate: new Date(selectedYear, 2, 31).toISOString(),
        isRenewal: !isFirstYear,
      } as RenewalWithTargetDues;
    });

    return merged;
  }, [renewals, members, selectedYear, membershipRules, calculationMode, membershipTransactions]);

  const newMembershipBreakdown = React.useMemo(() => {
    const stats = { total: 0, paid: 0, pending: 0, overdue: 0 };
    mergedRenewals.forEach((renewal) => {
      if (renewal.targetDues !== NEW_MEMBERSHIP_DUES) return;
      stats.total += 1;
      const status = (renewal.status || '').toLowerCase();
      if (status === 'paid' || status === 'over paid') {
        stats.paid += 1;
      } else if (status === 'overdue') {
        stats.overdue += 1;
      } else {
        stats.pending += 1;
      }
    });
    return stats;
  }, [mergedRenewals]);

  const displayRenewals = React.useMemo(() => {
    const statusWeight = (status: string) => {
      const s = status?.toLowerCase() || '';
      if (s === 'paid' || s === 'over paid') return 1;
      if (s === 'overdue' || s === 'partial') return 2;
      if (s === 'pending') return 3;
      return 4;
    };

    return mergedRenewals
      .filter(renewal => {
        if (filterType !== 'all' && renewal.membershipType !== filterType) return false;
        if (filterStatus === 'all') return true;

        // Special case: 'paid' filter also shows 'over paid'
        if (filterStatus === 'paid') {
          return renewal.status === 'paid' || renewal.status === 'over paid';
        }

        return renewal.status === filterStatus;
      })
      .sort((a, b) => {
        const weightA = statusWeight(a.status);
        const weightB = statusWeight(b.status);

        if (weightA !== weightB) {
          return weightA - weightB;
        }

        // Secondary sort: alphabetically by member name
        const nameA = (members.find(m => m.id === a.memberId)?.name || a.memberId).toLowerCase();
        const nameB = (members.find(m => m.id === b.memberId)?.name || b.memberId).toLowerCase();

        return nameA.localeCompare(nameB);
      });
  }, [mergedRenewals, members, filterType, filterStatus]);

  const membershipTypeColors: Record<MembershipType, string> = {
    guest: 'bg-blue-100 text-blue-800',
    'probation member': 'bg-blue-100 text-blue-800',
    'official member': 'bg-green-100 text-green-800',
    'visiting member': 'bg-orange-100 text-orange-800',
    'associate member': 'bg-cyan-100 text-cyan-800',
    'lifetime member': 'bg-purple-100 text-purple-800',
    Guest: 'bg-blue-100 text-blue-800',
    Probation: 'bg-blue-100 text-blue-800',
    Full: 'bg-green-100 text-green-800',
    Honorary: 'bg-purple-100 text-purple-800',
    Senator: 'bg-yellow-100 text-yellow-800',
    Visiting: 'bg-orange-100 text-orange-800',
    Associate: 'bg-cyan-100 text-cyan-800',
  };

  const statusColors: Record<string, string> = {
    paid: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    overdue: 'bg-red-100 text-red-800',
    partial: 'bg-orange-100 text-orange-800',
    'over paid': 'bg-purple-100 text-purple-800',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
        <span className="ml-3 text-gray-600">Loading dues renewal dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-red-600" />
        <span className="text-red-800">{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Membership Dues</h2>
          <p className="text-sm text-slate-500">Annual dues collection and renewal tracking</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {/* Year + refresh row */}
          <div className="flex items-center gap-2">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button
              onClick={loadDashboardData}
              disabled={loading}
              className="p-1.5 text-slate-500 hover:text-blue-600 transition-colors rounded-lg hover:bg-slate-100"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {/* Admin sync buttons */}
          {hasEditPermission && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleBatchSyncMembershipTypes}
                disabled={syncingMembershipTypes || syncingMembershipRecords || loading}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="从会费记录/角色推断并写入 membershipType"
              >
                {syncingMembershipTypes ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                {syncingMembershipTypes ? '同步中...' : '同步 membershipType'}
              </button>
              <button
                type="button"
                onClick={handleBatchSyncMembershipRecords}
                disabled={syncingMembershipTypes || syncingMembershipRecords || loading}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="按 membershipType + Config 写入 membership[年份]"
              >
                {syncingMembershipRecords ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
                {syncingMembershipRecords ? '同步中...' : '同步 membership'}
              </button>
              <button
                type="button"
                onClick={handleFixFirstMembershipDues}
                disabled={fixingFirstDues || loading}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-violet-50 text-violet-800 border border-violet-200 hover:bg-violet-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="将每位会员 membership 中最早年份的 dues 设为 RM350"
              >
                {fixingFirstDues ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <DollarSign className="w-3.5 h-3.5" />}
                {fixingFirstDues ? '调整中...' : '首次会费 → RM350'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-blue-500 shrink-0" />
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Members</p>
            </div>
            <p className="text-2xl font-bold text-slate-900">{summary.totalMembers}</p>
            <p className="text-xs text-slate-500 mt-1">
              <span className="text-green-600 font-medium">{summary.renewalMembers}</span> renewal · <span className="text-blue-600 font-medium">{summary.newMembers}</span> new
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-green-500 shrink-0" />
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Collection</p>
            </div>
            <p className="text-2xl font-bold text-slate-900">{summary.overallStats.collectionRate}%</p>
            <p className="text-xs text-slate-500 mt-1 font-mono">RM{summary.overallStats.paidAmount.toLocaleString()} / {summary.overallStats.totalAmount.toLocaleString()}</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Paid</p>
            </div>
            <p className="text-2xl font-bold text-green-600">{Object.values(summary.byMembershipType).reduce((sum, type) => sum + type.paid, 0)}</p>
            <p className="text-xs text-slate-500 mt-1 font-mono">RM{summary.overallStats.paidAmount.toLocaleString()}</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-amber-500 shrink-0" />
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pending</p>
            </div>
            <p className="text-2xl font-bold text-amber-600">{Object.values(summary.byMembershipType).reduce((sum, type) => sum + type.pending, 0)}</p>
            <p className="text-xs text-slate-500 mt-1 font-mono">RM{summary.overallStats.pendingAmount.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Membership Type Breakdown */}
      {summary && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider sticky left-0 bg-white pr-4 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                    Membership Type
                  </th>
                  {Object.entries(summary.byMembershipType).map(([type]) => (
                    <th key={type} className="pb-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${membershipTypeColors[type as MembershipType] || 'bg-slate-100 text-slate-800'}`}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </span>
                    </th>
                  ))}
                  <th className="pb-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4">
                    <span
                      className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-800"
                      title="首年会费 RM350（含注册费）"
                    >
                      New
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                <tr>
                  <td className="py-3.5 font-medium text-gray-500 sticky left-0 bg-white pr-4 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                    Standard Dues
                  </td>
                  {Object.entries(summary.byMembershipType).map(([type]) => {
                    const rules = membershipRules || DEFAULT_MEMBERSHIP_RULES;
                    const standardDues = rules[type as MembershipType]?.duesAmount ?? MembershipDues[type as MembershipType] ?? 0;
                    return (
                      <td key={type} className="py-3.5 text-center text-gray-500 font-medium px-4">
                        RM{standardDues}
                      </td>
                    );
                  })}
                  <td className="py-3.5 text-center text-teal-700 font-semibold px-4">
                    RM{NEW_MEMBERSHIP_DUES}
                  </td>
                </tr>
                <tr>
                  <td className="py-3.5 font-semibold text-gray-700 sticky left-0 bg-white pr-4 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                    Total
                  </td>
                  {Object.entries(summary.byMembershipType).map(([type, stats]) => (
                    <td key={type} className="py-3.5 text-center font-bold text-gray-900 px-4">
                      {stats.total}
                    </td>
                  ))}
                  <td className="py-3.5 text-center font-bold text-teal-800 px-4">
                    {newMembershipBreakdown.total}
                  </td>
                </tr>
                <tr>
                  <td className="py-3.5 font-semibold text-green-600 sticky left-0 bg-white pr-4 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                    Paid
                  </td>
                  {Object.entries(summary.byMembershipType).map(([type, stats]) => (
                    <td key={type} className="py-3.5 text-center font-bold text-green-600 px-4">
                      {stats.paid}
                    </td>
                  ))}
                  <td className="py-3.5 text-center font-bold text-green-600 px-4">
                    {newMembershipBreakdown.paid}
                  </td>
                </tr>
                <tr>
                  <td className="py-3.5 font-semibold text-yellow-600 sticky left-0 bg-white pr-4 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                    Pending
                  </td>
                  {Object.entries(summary.byMembershipType).map(([type, stats]) => (
                    <td key={type} className="py-3.5 text-center font-bold text-yellow-600 px-4">
                      {stats.pending}
                    </td>
                  ))}
                  <td className="py-3.5 text-center font-bold text-yellow-600 px-4">
                    {newMembershipBreakdown.pending}
                  </td>
                </tr>
                <tr>
                  <td className="py-3.5 font-semibold text-red-600 sticky left-0 bg-white pr-4 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                    Overdue
                  </td>
                  {Object.entries(summary.byMembershipType).map(([type, stats]) => (
                    <td key={type} className="py-3.5 text-center font-bold text-red-600 px-4">
                      {stats.overdue}
                    </td>
                  ))}
                  <td className="py-3.5 text-center font-bold text-red-600 px-4">
                    {newMembershipBreakdown.overdue}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}



      {/* Renewal Transactions + 会费流水 grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {/* Renewals List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm h-full">
            <div className="px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-800">Renewal Transactions</h3>
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as MembershipType | 'all')}
                  className="flex-1 sm:flex-none px-2 py-1 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Types</option>
                  <option value="Probation">Probation</option>
                  <option value="Full">Full</option>
                  <option value="Honorary">Honorary</option>
                  <option value="Senator">Senator</option>
                  <option value="Visiting">Visiting</option>
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as 'all' | 'paid' | 'pending' | 'overdue')}
                  className="flex-1 sm:flex-none px-2 py-1 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
            </div>

            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">#</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Membership Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dues</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paid Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reminders</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {displayRenewals.map((renewal, index) => {
                    const targetDues = (renewal as any).targetDues ?? renewal.amount ?? 0;
                    const paidAmount = renewal.amount ?? 0;
                    const outstanding = targetDues - paidAmount;

                    return (
                      <tr key={renewal.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 font-mono w-16">
                          {index + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {(() => {
                            const m = members.find(mem => mem.id === renewal.memberId);
                            return (
                              <div className="flex flex-col">
                                <div className="text-sm font-medium text-gray-900">
                                  {m?.name || renewal.memberId}
                                </div>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="mb-1">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${renewal.membershipType ? membershipTypeColors[renewal.membershipType] : ''}`}>
                              {renewal.membershipType ? renewal.membershipType.charAt(0).toUpperCase() + renewal.membershipType.slice(1) : 'Unknown'}
                            </span>
                          </div>
                        </td>
                        <td 
                          className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${outstanding < 0 ? 'text-purple-600' : 'text-gray-900'}`}
                          title={`应缴: RM${targetDues} | 已付: RM${paidAmount}`}
                        >
                          {outstanding < 0 ? `-RM${Math.abs(outstanding).toLocaleString()}` : `RM${outstanding.toLocaleString()}`}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[renewal.status]}`}>
                            {renewal.status.charAt(0).toUpperCase() + renewal.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {fmtDate(renewal.dueDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {renewal.status === 'paid' && renewal.paidDate ? fmtDate(renewal.paidDate) : '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {renewal.remindersSent || 0}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {displayRenewals.length === 0 && (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No renewal transactions found for the selected filters.</p>
                </div>
              )}
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-4 p-4">
              {displayRenewals.map((renewal, index) => {
                const m = members.find(mem => mem.id === renewal.memberId);
                const targetDues = (renewal as any).targetDues ?? renewal.amount ?? 0;
                const paidAmount = renewal.amount ?? 0;
                const outstanding = targetDues - paidAmount;

                return (
                  <div key={renewal.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-900">
                          #{index + 1} - {m?.name || renewal.memberId}
                        </span>
                        <div className="mt-1">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${renewal.membershipType ? membershipTypeColors[renewal.membershipType] : ''}`}>
                            {renewal.membershipType || 'Unknown'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div 
                          className={`text-sm font-bold ${outstanding < 0 ? 'text-purple-600' : 'text-gray-900'}`}
                          title={`应缴: RM${targetDues} | 已付: RM${paidAmount}`}
                        >
                          {outstanding < 0 ? `-RM${Math.abs(outstanding).toLocaleString()}` : `RM${outstanding.toLocaleString()}`}
                        </div>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[renewal.status]}`}>
                          {renewal.status}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-y-2 pt-3 border-t border-gray-50 text-[11px]">
                      <div className="text-gray-500">Due: <span className="text-gray-900 font-medium">{fmtDate(renewal.dueDate)}</span></div>
                      <div className="text-gray-500 text-right">Reminders: <span className="text-gray-900 font-medium">{renewal.remindersSent || 0}</span></div>
                      {renewal.status === 'paid' && (
                        <div className="text-gray-500 col-span-2">Paid on: <span className="text-green-600 font-medium">{renewal.paidDate ? fmtDate(renewal.paidDate) : '—'}</span></div>
                      )}
                    </div>
                  </div>
                );
              })}

              {displayRenewals.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-400 text-sm italic">No records found</p>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* 会费流水 Card */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">会费流水</h2>
                <p className="text-sm text-gray-500 mt-1">按年份筛选：{selectedYear}</p>
              </div>
              {hasEditPermission && (
                <button
                  type="button"
                  onClick={handleAutoMatchMembers}
                  disabled={autoMatching}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="根据交易描述/参考号自动匹配关联会员"
                >
                  {autoMatching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                  {autoMatching ? '匹配中...' : '✨ 一键匹配会员'}
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            {(() => {
              const filteredByYear = membershipTransactions.filter((tx) => {
                const yearFromProjectId = tx.projectId?.match(/^(\d+)\s+membership$/)?.[1];
                const txYear = yearFromProjectId ? parseInt(yearFromProjectId, 10) : new Date(tx.date).getFullYear();
                return txYear === selectedYear;
              });
              return filteredByYear.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 text-sm">暂无会费流水（{selectedYear} 年）</p>
                </div>
              ) : (
                <>
                  {/* Desktop View */}
                  <div className="hidden md:block">
                    <table className="w-full">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">日期 / 描述</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">会员 / 项目</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">金额 / 操作</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredByYear
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .map((tx) => (
                            <tr key={tx.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2">
                                <div className="text-sm text-gray-900 font-medium whitespace-nowrap">{fmtDate(tx.date)}</div>
                                <div className="text-xs text-gray-500 truncate max-w-[150px]" title={tx.description}>{tx.description}</div>
                              </td>
                              <td className="px-4 py-2">
                                {(() => {
                                  const matchedMember = findMatchingMember(tx, members);
                                  if (tx.memberId) {
                                    return (
                                      <div className="text-sm font-medium text-gray-900 truncate max-w-[150px]" title={matchedMember?.name || tx.memberId}>
                                        {matchedMember?.name || tx.memberId}
                                      </div>
                                    );
                                  } else if (matchedMember) {
                                    return (
                                      <div className="flex flex-col">
                                        <span
                                          className="inline-flex items-center gap-1 w-fit px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/60"
                                          title="系统通过交易描述/银行参考号自动匹配"
                                        >
                                          ✨ {matchedMember.name}
                                        </span>
                                      </div>
                                    );
                                  } else {
                                    return <div className="text-xs text-gray-400 italic">—</div>;
                                  }
                                })()}
                                <div className="text-xs text-gray-500 truncate max-w-[150px]" title={tx.projectId || '—'}>{tx.projectId || '—'}</div>
                              </td>
                              <td className="px-4 py-2 text-right">
                                <div className="flex flex-col items-end gap-1">
                                  <span className="text-sm font-medium text-gray-900">
                                    {tx.type === 'Income' ? '+' : '-'}{fmtCurrency(Math.abs(tx.amount))}
                                  </span>
                                  {hasEditPermission && (
                                    <button
                                      type="button"
                                      onClick={() => onEditMembershipTransaction?.(tx, selectedYear)}
                                      className="py-0 min-h-0 min-w-0 text-gray-400 hover:text-blue-600 transition-colors flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider"
                                    >
                                      <Edit size={12} /> 编辑
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile View */}
                  <div className="md:hidden space-y-3 p-4">
                    {filteredByYear
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((tx) => (
                        <div key={tx.id} className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] text-gray-400 font-medium">{fmtDate(tx.date)}</span>
                            <span className={`text-xs font-bold ${tx.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                              {tx.type === 'Income' ? '+' : '-'}{fmtCurrency(Math.abs(tx.amount))}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-gray-800 mb-1 truncate">{tx.description}</div>
                          <div className="flex justify-between items-center mt-2">
                            <div className="text-[10px] text-gray-500 truncate max-w-[180px]">
                              {(() => {
                                const matchedMember = findMatchingMember(tx, members);
                                if (tx.memberId) {
                                  return <span>👤 {matchedMember?.name || tx.memberId}</span>;
                                } else if (matchedMember) {
                                  return <span className="text-amber-700 font-semibold">✨ 智能匹配: {matchedMember.name}</span>;
                                }
                                return '—';
                              })()}
                            </div>
                            {hasEditPermission && (
                              <button
                                type="button"
                                onClick={() => onEditMembershipTransaction?.(tx, selectedYear)}
                                className="text-blue-600 text-[10px] font-bold"
                              >
                                Edit
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};
