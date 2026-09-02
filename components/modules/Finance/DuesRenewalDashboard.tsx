import React, { useState, useEffect } from 'react';
import { useToast } from '../../ui/Common';
import {
  Users,
  DollarSign,
  Calendar,
  CheckCircle,
  Clock,
  RefreshCw,
  Edit,
  MessageCircle,
  ChevronDown,
  MoreHorizontal,
} from 'lucide-react';
import { FinanceService } from '../../../services/financeService';
import { MembersService } from '../../../services/membersService';
import {
  MembershipType,
  MembershipDues,
  MembershipRecord,
  MembershipStatus,
  MembershipRuleConfig
} from '../../../types';

interface DuesRenewalTransaction {
  id?: string;
  memberId: string;
  membershipType: MembershipType;
  duesYear: number;
  amount: number;
  status: MembershipStatus;
  dueDate: string;
  paidDate?: string;
  isRenewal: boolean;
}

interface DuesRenewalSummary {
  year: number;
  totalMembers: number;
  renewalMembers: number;
  newMembers: number;
  byMembershipType: Partial<Record<MembershipType, { total: number; paid: number; pending: number; overdue: number; totalAmount: number; paidAmount: number }>>;
  overallStats: { totalAmount: number; paidAmount: number; pendingAmount: number; overdueAmount: number; collectionRate: number };
}
import {
  MembershipConfigService,
  DEFAULT_MEMBERSHIP_RULES,
  getTargetDuesForMembershipType,
  resolveMembershipTypeFromDues,
  getPendingWhatsAppCampaign,
  dismissWhatsAppCampaign,
  type WhatsAppCampaign,
} from '../../../services/membershipConfigService';
import type { Transaction } from '../../../types';
import { buildCategoryFields } from '../../../utils/transactionCategoryUtils';
import { PaymentButton } from '../../shared/toyyib/PaymentButton';
import { Tabs, ConfirmDialog, CONFIRM_CLOSED } from '../../ui/Common';
import type { ConfirmState } from '../../ui/Common';
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

/**
 * Open a WhatsApp chat link pre-filled with a dues reminder message.
 * Works for both individual and bulk sends (caller delays between opens).
 */
const sendWhatsAppDuesReminder = (
  memberName: string,
  phone: string | undefined,
  year: number,
  outstanding: number
) => {
  const cleaned = (phone || '').replace(/\D/g, '');
  if (!cleaned) return false;
  // Normalize Malaysian numbers: strip leading 0, prefix country code
  const normalized = cleaned.startsWith('60') ? cleaned : `60${cleaned.replace(/^0/, '')}`;
  const message = encodeURIComponent(
    `Hi ${memberName}! 😊 这里是 JCI 吉隆坡秘书处。\n\n` +
    `温馨提醒：您 ${year} 年度的会费 RM${outstanding} 尚未缴清。` +
    `请尽快完成缴费以维持您的会籍权益。\n\n` +
    `如有任何疑问，欢迎回复此消息。谢谢！🙏\n\nJCI Kuala Lumpur`
  );
  window.open(`https://wa.me/${normalized}?text=${message}`, '_blank');
  return true;
};

interface DuesRenewalDashboardProps {
  year?: number;
  /** 会费流水（category=Membership 的交易） */
  membershipTransactions?: Transaction[];
  onEditMembershipTransaction?: (tx: Transaction, filterYear: number) => void;
  onDeleteMembershipTransaction?: (txId: string) => void;
  hasEditPermission?: boolean;
  /** 仅 ADMIN / SUPER_ADMIN 可见的管理按钮 */
  isAdminUser?: boolean;
  formatCurrency?: (amount: number) => string;
  formatDate?: (date: string) => string;
  /** 批量修复会员首次会费后刷新父级数据 */
  onMembershipDataChanged?: () => void | Promise<void>;
  /** 手动触发年度续费（Cloud Function 自动跑，此为备用入口） */
  onInitiateRenewal?: () => void;
  /** 年份切换回调，让父层重新加载对应年份的交易数据 */
  onYearChange?: (year: number) => void;
  /** 会员列表，用于显示 memberId 对应的姓名 */
  members?: Array<{
    id: string;
    name: string;
    fullName?: string;
    phone?: string;
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
  isAdminUser = false,
  formatCurrency: fmtCurrency = (n) => n.toLocaleString('en-MY', { style: 'currency', currency: 'MYR' }),
  formatDate: fmtDate = (d) => new Date(d).toLocaleDateString(),
  onMembershipDataChanged,
  members = [],
  onInitiateRenewal,
  onYearChange,
}) => {
  const { showToast } = useToast();
  const [confirmState, setConfirmState] = useState<ConfirmState>(CONFIRM_CLOSED);
  const [filterType, setFilterType] = useState<MembershipType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<MembershipStatus | 'all'>('all');
  const [filterPrevYearPaid, setFilterPrevYearPaid] = useState(false);
  const [autoMatching, setAutoMatching] = useState(false);
  const [fixingFirstDues, setFixingFirstDues] = useState(false);
  const [syncingMembershipTypes, setSyncingMembershipTypes] = useState(false);
  const [syncingMembershipRecords, setSyncingMembershipRecords] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [showAdvancedMenu, setShowAdvancedMenu] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'members' | 'payments'>('members');
  const [mobileStatPanel, setMobileStatPanel] = useState<'stats' | 'breakdown'>('stats');
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);

  /** One-click: fuzzy-match all unlinked membership transactions and persist memberId to Firestore */
  const handleAutoMatchMembers = async () => {
    setAutoMatching(true);
    try {
      // Filter to current year
      const filteredByYear = membershipTransactions.filter((tx) => {
        const yearFromProjectId = tx.projectId?.match(/^(\d+)\s+membership$/)?.[1];
        const txYear = yearFromProjectId ? parseInt(yearFromProjectId, 10) : new Date(tx.date).getFullYear();
        return txYear === year;
      });

      const unlinked = filteredByYear.filter(tx => !tx.memberId);
      let matched = 0;
      let skipped = 0;
      const rules = await MembershipConfigService.getRules();

      for (const tx of unlinked) {
        const member = findMatchingMember(tx, members);
        if (member) {
          const catFields = buildCategoryFields({
            category: 'Membership',
            amount: tx.amount,
            year: year,
            memberId: member.id,
            rules,
          });
          await FinanceService.updateTransaction(tx.id, {
            memberId: member.id,
            projectId: catFields.projectId,
            category: 'Membership',
            purpose: catFields.purpose,
          });
          matched++;
        } else {
          skipped++;
        }
      }

      showToast(`自动匹配完成！成功关联: ${matched} 笔，未匹配: ${skipped} 笔`, 'success');

      // Reload page data to reflect changes
      window.location.reload();
    } catch (err: any) {
      showToast(`自动匹配失败: ${err.message}`, 'error');
    } finally {
      setAutoMatching(false);
    }
  };

  const handleFixFirstMembershipDues = () => {
    setConfirmState({ open: true, title: 'Confirm', message: '将所有会员「首个会费年份」的应缴 dues 调整为 RM350，并根据已付金额重新计算状态？\n\n仅影响 members.membership 中最早年份的记录。', variant: 'warning', onConfirm: async () => { setConfirmState(CONFIRM_CLOSED); await _doFixFirstMembershipDues(); } });
  };
  const _doFixFirstMembershipDues = async () => {
    setFixingFirstDues(true);
    try {
      const result = await MembersService.fixFirstMembershipDuesTo350();
      showToast(
        `首次会费调整完成：扫描 ${result.scanned}，更新 ${result.updated}，已是RM350 ${result.alreadyCorrect}${result.errors.length > 0 ? `，失败 ${result.errors.length}（见控制台）` : ''}`,
        result.errors.length > 0 ? 'warning' : 'success'
      );
      if (result.errors.length > 0) {
        console.error('fixFirstMembershipDuesTo350 errors:', result.errors);
      }
      await onMembershipDataChanged?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误';
      showToast(`首次会费调整失败: ${message}`, 'error');
    } finally {
      setFixingFirstDues(false);
    }
  };

  const handleBatchSyncMembershipTypes = () => {
    setConfirmState({ open: true, title: 'Confirm', message: `根据 ${year} 年会费记录、角色与 Membership Config，批量推断并写入 members.membershipType？\n\n不会修改 membership 字段。建议先确保 membership 数据准确，或之后执行「同步 membership」。`, variant: 'warning', onConfirm: async () => { setConfirmState(CONFIRM_CLOSED); await _doBatchSyncMembershipTypes(); } });
  };
  const _doBatchSyncMembershipTypes = async () => {
    setSyncingMembershipTypes(true);
    try {
      const result = await MembersService.batchSyncMembershipTypes({ year: year });
      showToast(
        `membershipType 同步完成（${result.year} 年）：扫描 ${result.scanned}，更新 ${result.updated}${result.errors.length > 0 ? `，失败 ${result.errors.length}（见控制台）` : ''}`,
        result.errors.length > 0 ? 'warning' : 'success'
      );
      if (result.errors.length > 0) {
        console.error('batchSyncMembershipTypes errors:', result.errors);
      }
      await onMembershipDataChanged?.();
    } catch (err: unknown) {
      showToast(`membershipType 同步失败: ${err instanceof Error ? err.message : '未知错误'}`, 'error');
    } finally {
      setSyncingMembershipTypes(false);
    }
  };

  const handleBatchSyncMembershipRecords = () => {
    setConfirmState({ open: true, title: 'Confirm', message: `根据每位会员的 membershipType 与 Membership Config，批量更新 ${year} 年的 members.membership？\n\n将写入 dues / status 等；可为符合条件会员新建该年记录。不会修改 membershipType。`, variant: 'warning', onConfirm: async () => { setConfirmState(CONFIRM_CLOSED); await _doBatchSyncMembershipRecords(); } });
  };
  const _doBatchSyncMembershipRecords = async () => {
    setSyncingMembershipRecords(true);
    try {
      const result = await MembersService.batchSyncMembershipRecords({
        year: year,
        membershipTransactions,
        onlyExistingRecords: false,
      });
      showToast(
        `membership 同步完成（${result.year} 年）：扫描 ${result.scanned}，更新 ${result.updated}，新建 ${result.created}${result.errors.length > 0 ? `，失败 ${result.errors.length}（见控制台）` : ''}`,
        result.errors.length > 0 ? 'warning' : 'success'
      );
      if (result.errors.length > 0) {
        console.error('batchSyncMembershipRecords errors:', result.errors);
      }
      await onMembershipDataChanged?.();
    } catch (err: unknown) {
      showToast(`membership 同步失败: ${err instanceof Error ? err.message : '未知错误'}`, 'error');
    } finally {
      setSyncingMembershipRecords(false);
    }
  };

  const handleFullSync = () => {
    const currentYear = new Date().getFullYear();
    setConfirmState({ open: true, title: 'Full Membership Sync', message: `将根据所有会员的加入日期，分两步同步截至 ${currentYear} 年的会籍数据：\n1. 推断并写入 membershipType\n2. 从各会员入会年起，逐年同步 membership 记录至 ${currentYear} 年\n\n继续？`, variant: 'warning', onConfirm: async () => { setConfirmState(CONFIRM_CLOSED); await _doFullSync(); } });
  };
  const _doFullSync = async () => {
    setSyncingAll(true);
    const currentYear = new Date().getFullYear();
    try {
      // Step 1: infer membershipType for each member based on current year
      const typesResult = await MembersService.batchSyncMembershipTypes({ year: currentYear });
      if (typesResult.errors.length > 0) console.error('batchSyncMembershipTypes errors:', typesResult.errors);
      // Step 2: sync membership records for ALL years from each member's join year up to current year
      const recordsResult = await MembersService.batchSyncMembershipRecords({
        year: currentYear,
        toYear: currentYear,
        membershipTransactions,
        onlyExistingRecords: false,
      });
      if (recordsResult.errors.length > 0) console.error('batchSyncMembershipRecords errors:', recordsResult.errors);
      const hasErrors = typesResult.errors.length > 0 || recordsResult.errors.length > 0;
      showToast(
        `全量同步完成（截至 ${currentYear} 年）：类型更新 ${typesResult.updated}，记录更新 ${recordsResult.updated} / 新建 ${recordsResult.created}${hasErrors ? '，部分失败（见控制台）' : ''}`,
        hasErrors ? 'warning' : 'success'
      );
      await onMembershipDataChanged?.();
    } catch (err: unknown) {
      showToast(`全量同步失败: ${err instanceof Error ? err.message : '未知错误'}`, 'error');
    } finally {
      setSyncingAll(false);
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


  const [waCampaign, setWaCampaign] = useState<WhatsAppCampaign | null>(null);
  const [waDismissing, setWaDismissing] = useState(false);

  useEffect(() => {
    getPendingWhatsAppCampaign().then(setWaCampaign);
  }, []);

  const handleDismissWaCampaign = async () => {
    setWaDismissing(true);
    await dismissWhatsAppCampaign();
    setWaCampaign(null);
    setWaDismissing(false);
  };

  const handleRunWaCampaign = () => {
    if (!waCampaign) return;
    const targets = waCampaign.memberIds
      .map(id => members.find(m => m.id === id))
      .filter(Boolean) as typeof members;
    setConfirmState({ open: true, title: 'Send WhatsApp Reminders', message: `将为 ${targets.length} 位未缴会费会员逐一打开 WhatsApp 提醒。\n浏览器可能拦截弹出窗口，请确保已允许此页面弹窗。\n\n继续？`, variant: 'info', onConfirm: async () => { setConfirmState(CONFIRM_CLOSED); await _doRunWaCampaign(targets); } });
  };
  const _doRunWaCampaign = async (targets: typeof members) => {
    let sent = 0;
    for (const m of targets) {
      if (!m?.phone) continue;
      const rec = (m as any).membership?.[String(waCampaign.year)];
      const outstanding = Math.max(0, (rec?.dues ?? 0) - (rec?.amount ?? 0));
      sendWhatsAppDuesReminder(m.name, m.phone, waCampaign.year, outstanding);
      sent++;
      await new Promise(r => setTimeout(r, 600));
    }

    showToast(`已打开 ${sent} 个 WhatsApp 会话。`, 'success');
    await handleDismissWaCampaign();
  };

  /** Bulk WhatsApp: open wa.me links for all overdue/pending members in current view */
  const handleBulkWhatsApp = () => {
    const targets = mergedRenewals.filter(r =>
      (r.status === 'overdue' || r.status === 'pending' || r.status === 'partial') &&
      (filterType === 'all' || r.membershipType === filterType)
    );
    if (targets.length === 0) {
      showToast('没有符合条件的待提醒会员（overdue / pending / partial）。', 'warning');
      return;
    }
    setConfirmState({ open: true, title: 'Send WhatsApp Reminders', message: `将为 ${targets.length} 位会员逐一打开 WhatsApp 提醒。\n浏览器可能拦截弹出窗口，请确保已允许此页面弹窗。\n\n继续？`, variant: 'info', onConfirm: async () => { setConfirmState(CONFIRM_CLOSED); await _doBulkWhatsApp(targets); } });
  };
  const _doBulkWhatsApp = async (targets: RenewalWithTargetDues[]) => {
    let sent = 0;
    for (const renewal of targets) {
      const m = members.find(mem => mem.id === renewal.memberId);
      if (!m?.phone) continue;
      const targetDues = (renewal as any).targetDues ?? renewal.amount ?? 0;
      const paidAmt = renewal.amount ?? 0;
      const outstanding = Math.max(0, targetDues - paidAmt);
      const ok = sendWhatsAppDuesReminder(m.name, m.phone, year, outstanding);
      if (ok) {
        sent++;
        // Small delay so browser doesn't block rapid popup opens
        await new Promise(r => setTimeout(r, 600));
      }
    }
    showToast(`已打开 ${sent} 个 WhatsApp 会话。${targets.length - sent > 0 ? ` ${targets.length - sent} 位会员没有电话号码，已跳过。` : ''}`, sent > 0 ? 'success' : 'warning');
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

      if (!m.joinDate) return year;
      const date = new Date(m.joinDate);
      const calendarYear = date.getFullYear();
      const month = date.getMonth(); // 0-indexed: 9 = Oct
      const day = date.getDate();
      if (month > 9 || (month === 9 && day >= 1)) {
        return calendarYear + 1;
      }
      return calendarYear;
    };

    // Only show people whose effective join year is in or before the selected year.
    // Guest members are excluded: they pay a one-time entry fee (RM350) on joining and are
    // promoted to Probation upon payment. Annual dues belong to Probation and above.
    const yearMembers = members.filter(m => {
      if (m.membershipType === 'Guest') return false;
      if (!m.joinDate && calculationMode === 'calendar') return false;
      const effYear = getEffectiveJoinYear(m);
      return effYear <= year;
    });

    const merged = yearMembers.map(m => {
      const membershipData = m.membership?.[String(year)];
      const rules = membershipRules || DEFAULT_MEMBERSHIP_RULES;

      const joinYear = getEffectiveJoinYear(m);
      // Probation members always pay renewal dues (RM300) — they already paid the
      // one-time RM350 entry fee as a Guest. Never treat them as "first year".
      const rawMembershipType = m.membershipType || 'Probation';
      const isFirstYear = joinYear === year && rawMembershipType !== 'Probation';

      const getTargetDues = (mType: MembershipType) =>
        getTargetDuesForMembershipType(mType, isFirstYear, rules);

      const resolveTypeFromDues = (amt: number, currentType: MembershipType) =>
        resolveMembershipTypeFromDues(amt, rules, currentType);

      const rawType = m.membershipType || 'Probation';
      const duesVal = membershipData
        ? (Number(membershipData.dues) || getTargetDues(rawType))
        : getTargetDues(rawType);
      const resolvedType = resolveTypeFromDues(duesVal, rawType);
      return {
        id: `summary-${m.id}-${year}`,
        memberId: m.id,
        membershipType: resolvedType,
        duesYear: year,
        amount: membershipData?.amount,
        targetDues: duesVal,
        status: membershipData?.status ?? 'pending',
        dueDate: new Date(year, 2, 31).toISOString(),
        isRenewal: !isFirstYear,
      } as RenewalWithTargetDues;
    });

    return merged.filter((r): r is RenewalWithTargetDues => r !== null);
  }, [members, year, membershipRules, calculationMode, membershipTransactions]);

  const summary = React.useMemo((): DuesRenewalSummary | null => {
    if (!mergedRenewals.length) return null;
    const byMembershipType: DuesRenewalSummary['byMembershipType'] = {
      // Guest excluded: one-time entry fee only, no annual renewal dues tracked here.
      Probation: { total: 0, paid: 0, pending: 0, overdue: 0, totalAmount: 0, paidAmount: 0 },
      Official: { total: 0, paid: 0, pending: 0, overdue: 0, totalAmount: 0, paidAmount: 0 },
      Honorary: { total: 0, paid: 0, pending: 0, overdue: 0, totalAmount: 0, paidAmount: 0 },
      Senator: { total: 0, paid: 0, pending: 0, overdue: 0, totalAmount: 0, paidAmount: 0 },
      Visiting: { total: 0, paid: 0, pending: 0, overdue: 0, totalAmount: 0, paidAmount: 0 },
      Associate: { total: 0, paid: 0, pending: 0, overdue: 0, totalAmount: 0, paidAmount: 0 },
    };
    let totalAmount = 0, paidAmount = 0, pendingAmount = 0, overdueAmount = 0;
    mergedRenewals.forEach(r => {
      const type = (r.membershipType && byMembershipType[r.membershipType]) ? r.membershipType : 'Probation';
      const t = byMembershipType[type]!;
      const dues = (r as RenewalWithTargetDues).targetDues || (membershipRules ?? DEFAULT_MEMBERSHIP_RULES)[type]?.duesAmount || 0;
      t.total++; t.totalAmount += dues; totalAmount += dues;
      const s = (r.status || '').toLowerCase();
      if (s === 'paid' || s === 'over paid') {
        t.paid++; t.paidAmount += r.amount ?? 0; paidAmount += r.amount ?? 0;
      } else if (s === 'overdue') {
        t.overdue++; overdueAmount += dues;
      } else {
        t.pending++; pendingAmount += dues - (r.amount ?? 0);
      }
    });
    return {
      year: year,
      totalMembers: mergedRenewals.length,
      renewalMembers: mergedRenewals.filter(r => r.isRenewal).length,
      newMembers: mergedRenewals.filter(r => !r.isRenewal).length,
      byMembershipType,
      overallStats: { totalAmount, paidAmount, pendingAmount, overdueAmount, collectionRate: totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 1000) / 10 : 0 },
    };
  }, [mergedRenewals, year]);

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
        if (filterPrevYearPaid) {
          const prevYearRec = members.find(m => m.id === renewal.memberId)?.membership?.[String(year - 1)];
          const prevStatus = prevYearRec?.status ?? '';
          if (prevStatus !== 'paid' && prevStatus !== 'over paid') return false;
        }
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
  }, [mergedRenewals, members, filterType, filterStatus, filterPrevYearPaid]);

  const membershipTypeColors: Record<MembershipType, string> = {
    Guest: 'bg-blue-100 text-blue-800',
    Probation: 'bg-blue-100 text-blue-800',
    Official: 'bg-green-100 text-green-800',
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

  const renderMembershipHistory = (m: typeof members[0] | undefined) => {
    if (!m) return null;

    // Calendar year the member physically joined
    const joinDate = m.joinDate ? new Date(m.joinDate) : null;
    const joinCalendarYear = joinDate ? joinDate.getFullYear() : null;

    // Members joining Oct 1 or later get membership extended to Dec 31 of the NEXT year,
    // so their first annual dues year is joinCalendarYear + 1.
    // joinCalendarYear itself has no dues obligation (shown as "joined" row).
    const joinMonth = joinDate ? joinDate.getMonth() : null; // 0-indexed; 9 = Oct
    const isLateYearJoiner = joinMonth !== null && joinMonth >= 9;
    const effectiveJoinYear = joinCalendarYear !== null
      ? (isLateYearJoiner ? joinCalendarYear + 1 : joinCalendarYear)
      : null;

    const storedYears = m.membership ? Object.keys(m.membership).map(Number) : [];
    const earliestStored = storedYears.length > 0 ? Math.min(...storedYears) : null;
    const startYear = joinCalendarYear ?? earliestStored ?? year;
    const endYear = new Date().getFullYear();

    if (startYear > endYear) {
      return <p className="text-xs text-slate-400 italic py-2">No membership history recorded.</p>;
    }

    const rules = membershipRules || DEFAULT_MEMBERSHIP_RULES;
    const rawType = (m.membershipType || 'Probation') as MembershipType;

    // Index membership transactions for this member by dues year.
    // Year extracted from tx.projectId ("2024 membership"), tx.year field, or tx.date.
    const txsByYear = new Map<number, typeof membershipTransactions>();
    membershipTransactions.forEach(tx => {
      if (tx.memberId !== m.id) return;
      const yearFromProjectId = tx.projectId?.match(/^(\d{4})\s/)?.[1];
      const txYear = yearFromProjectId
        ? parseInt(yearFromProjectId, 10)
        : ((tx as any).year ? Number((tx as any).year) : new Date(tx.date).getFullYear());
      const bucket = txsByYear.get(txYear) ?? [];
      bucket.push(tx);
      txsByYear.set(txYear, bucket);
    });

    const years: number[] = [];
    for (let y = endYear; y >= startYear; y--) years.push(y);

    return (
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="py-1.5 px-2 text-left font-semibold text-slate-500">Year</th>
            <th className="py-1.5 px-2 text-right font-semibold text-slate-500">Dues</th>
            <th className="py-1.5 px-2 text-right font-semibold text-slate-500">Paid</th>
            <th className="py-1.5 px-2 text-right font-semibold text-slate-500">Outstanding</th>
            <th className="py-1.5 px-2 text-center font-semibold text-slate-500">Status</th>
            <th className="py-1.5 px-2 text-left font-semibold text-slate-500">Paid Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {years.map(yr => {
            const isSelectedYear = yr === year;

            // Join year for late-year joiners (Oct+): no dues obligation.
            // The entry fee is attributed to effectiveJoinYear (next calendar year).
            if (effectiveJoinYear !== null && yr < effectiveJoinYear) {
              return (
                <tr key={yr} className={isSelectedYear ? 'bg-indigo-50/60' : 'hover:bg-slate-50/60'}>
                  <td className={`py-1.5 px-2 font-bold ${isSelectedYear ? 'text-indigo-700' : 'text-slate-400'}`}>{yr}</td>
                  <td className="py-1.5 px-2 text-right text-slate-400">—</td>
                  <td className="py-1.5 px-2 text-right text-slate-400">—</td>
                  <td className="py-1.5 px-2 text-right text-slate-400">—</td>
                  <td className="py-1.5 px-2 text-center">
                    <span className="px-1.5 py-0 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">joined</span>
                  </td>
                  <td className="py-1.5 px-2 text-slate-400">{joinDate ? fmtDate(m.joinDate!) : '—'}</td>
                </tr>
              );
            }

            const txsThisYear = txsByYear.get(yr) ?? [];
            const paid = txsThisYear.reduce((sum, tx) => sum + (tx.amount || 0), 0);
            const paidDate = txsThisYear.length > 0
              ? [...txsThisYear].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0].date
              : null;

            // Dues: prefer stored record value, then derive from config.
            // First-year (entry fee RM350) applies to all types in their effectiveJoinYear.
            const storedRec = m.membership?.[String(yr)] as MembershipRecord | undefined;
            const isFirstYear = effectiveJoinYear !== null ? yr === effectiveJoinYear : false;
            const dues = storedRec?.dues
              ? Number(storedRec.dues)
              : getTargetDuesForMembershipType(rawType, isFirstYear, rules);

            const outstanding = dues - paid;
            const isPast = yr < new Date().getFullYear();

            let status: string;
            if (dues > 0 && paid >= dues) {
              status = 'paid';
            } else if (paid > 0 && paid < dues) {
              status = 'partial';
            } else if (paid === 0 && isPast) {
              status = 'overdue';
            } else {
              status = 'pending';
            }

            return (
              <tr key={yr} className={isSelectedYear ? 'bg-indigo-50/60' : 'hover:bg-slate-50/60'}>
                <td className={`py-1.5 px-2 font-bold ${isSelectedYear ? 'text-indigo-700' : 'text-slate-700'}`}>{yr}</td>
                <td className="py-1.5 px-2 text-right text-slate-600">RM{dues.toLocaleString()}</td>
                <td className="py-1.5 px-2 text-right text-green-600 font-semibold">RM{paid.toLocaleString()}</td>
                <td className={`py-1.5 px-2 text-right font-bold ${outstanding < 0 ? 'text-purple-600' : outstanding === 0 ? 'text-green-600' : 'text-amber-700'}`}>
                  {outstanding < 0 ? `-RM${Math.abs(outstanding).toLocaleString()}` : `RM${outstanding.toLocaleString()}`}
                </td>
                <td className="py-1.5 px-2 text-center">
                  <span className={`px-1.5 py-0 rounded-full font-semibold ${statusColors[status] || 'bg-slate-100 text-slate-600'}`}>{status}</span>
                </td>
                <td className="py-1.5 px-2 text-slate-500">{paidDate ? fmtDate(paidDate) : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  return (
    <div className="space-y-4">

      {/* ── WhatsApp campaign banner (triggered by Jan 1 Cloud Function) ── */}
      {waCampaign && hasEditPermission && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-green-50 border border-green-200">
          <MessageCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-green-800">
              {waCampaign.year} 年度 WhatsApp 会费提醒待发送
            </p>
            <p className="text-xs text-green-700 mt-0.5">
              系统已于 1 月 1 日自动发送站内通知，共 {waCampaign.memberIds.length} 位会员待缴费。点击下方按钮逐一打开 WhatsApp 发送催缴短信。
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleRunWaCampaign}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              发送 WhatsApp
            </button>
            <button
              type="button"
              onClick={handleDismissWaCampaign}
              disabled={waDismissing}
              className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
            >
              忽略
            </button>
          </div>
        </div>
      )}

      {/* ── Header row ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Membership Dues</h2>
          <p className="text-xs text-slate-500 mt-0.5">Annual dues collection and renewal tracking</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {/* Admin-only buttons */}
          {isAdminUser && (
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Full Sync: step 1 infer membershipType, step 2 write membership[year] */}
              <button
                type="button"
                onClick={handleFullSync}
                disabled={syncingAll}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                title="推断 membershipType，再同步当年 membership 记录（两步连续执行）"
              >
                {syncingAll ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {syncingAll ? 'Syncing...' : 'Full Sync'}
              </button>
              {onInitiateRenewal && (
                <button
                  type="button"
                  onClick={onInitiateRenewal}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-jci-blue text-white hover:bg-jci-blue/90 transition-colors"
                  title="手动触发年度续费（自动化在 10 月 1 日运行）"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Initiate Renewal
                </button>
              )}
              {/* Advanced overflow menu: Fix 1st Dues (one-time data repair) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowAdvancedMenu(prev => !prev)}
                  className="inline-flex items-center px-2 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100 transition-colors"
                  title="高级操作"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
                {showAdvancedMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowAdvancedMenu(false)} />
                    <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1">
                      <button
                        type="button"
                        onClick={() => { setShowAdvancedMenu(false); handleFixFirstMembershipDues(); }}
                        disabled={fixingFirstDues}
                        className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50"
                        title="将每位会员 membership 中最早年份的 dues 设为 RM350"
                      >
                        {fixingFirstDues ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <DollarSign className="w-3.5 h-3.5" />}
                        Fix 1st Dues
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile tab switcher: Stats / Breakdown ── */}
      {summary && (
        <div className="md:hidden">
          <Tabs
           
            fullWidth
            tabs={[
              { id: 'stats', label: '指标概览' },
              { id: 'breakdown', label: '类型明细' },
            ]}
            activeTab={mobileStatPanel}
            onTabChange={(tab) => setMobileStatPanel(tab as 'stats' | 'breakdown')}
          />
        </div>
      )}

      {/* ── KPI Summary Strip ── */}
      {summary && (
        <>
        {/* Mobile: single-card summary table */}
        <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden md:hidden ${mobileStatPanel !== 'stats' ? 'hidden' : ''}`}>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="py-2.5 px-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">指标</th>
                <th className="py-2.5 px-2 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wide">人数</th>
                <th className="py-2.5 px-2 text-center text-[11px] font-semibold text-green-600 uppercase tracking-wide">金额</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50/60">
                <td className="py-2.5 px-3">
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="w-3 h-3 text-blue-400" />
                    <span className="font-semibold text-slate-700">Members</span>
                  </span>
                  <span className="block text-[10px] text-slate-400 mt-0.5">
                    <span className="text-green-600 font-semibold">{summary.renewalMembers}</span> renewal · <span className="text-blue-600 font-semibold">{summary.newMembers}</span> new
                  </span>
                </td>
                <td className="py-2.5 px-2 text-center font-bold text-slate-800 text-sm">{summary.totalMembers}</td>
                <td className="py-2.5 px-2 text-center text-[11px] text-slate-400">
                  {summary.overallStats.collectionRate}%
                </td>
              </tr>
              <tr className="hover:bg-slate-50/60">
                <td className="py-2.5 px-3">
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    <span className="font-semibold text-green-700">Paid</span>
                  </span>
                </td>
                <td className="py-2.5 px-2 text-center font-bold text-green-600 text-sm">
                  {Object.values(summary.byMembershipType).reduce((sum, t) => sum + t.paid, 0)}
                </td>
                <td className="py-2.5 px-2 text-center font-semibold text-green-600 text-[11px]">
                  RM{summary.overallStats.paidAmount.toLocaleString()}
                </td>
              </tr>
              <tr className="hover:bg-slate-50/60">
                <td className="py-2.5 px-3">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-amber-500" />
                    <span className="font-semibold text-amber-700">Pending</span>
                  </span>
                </td>
                <td className="py-2.5 px-2 text-center font-bold text-amber-600 text-sm">
                  {Object.values(summary.byMembershipType).reduce((sum, t) => sum + t.pending, 0)}
                </td>
                <td className="py-2.5 px-2 text-center font-semibold text-amber-600 text-[11px]">
                  RM{summary.overallStats.pendingAmount.toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Desktop: 4-card grid */}
        <div className="hidden md:grid grid-cols-4 gap-3">
          {/* Members */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                <Users className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Members</p>
            </div>
            <p className="text-2xl font-bold text-slate-900">{summary.totalMembers}</p>
            <p className="text-[11px] mt-0.5 font-mono text-slate-500">
              <span className="text-green-600 font-semibold">{summary.renewalMembers}</span> renewal · <span className="text-blue-600 font-semibold">{summary.newMembers}</span> first-year
            </p>
          </div>
          {/* Collection */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center shrink-0">
                <DollarSign className="w-3.5 h-3.5 text-green-500" />
              </div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Collection</p>
            </div>
            <p className="text-2xl font-bold text-slate-900">{summary.overallStats.collectionRate}%</p>
            <p className="text-[11px] mt-0.5 font-mono text-slate-500">
              RM{summary.overallStats.paidAmount.toLocaleString()} / {summary.overallStats.totalAmount.toLocaleString()}
            </p>
          </div>
          {/* Paid */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center shrink-0">
                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
              </div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Paid</p>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {Object.values(summary.byMembershipType).reduce((sum, t) => sum + t.paid, 0)}
            </p>
            <p className="text-[11px] mt-0.5 font-mono text-slate-500">
              RM{summary.overallStats.paidAmount.toLocaleString()}
            </p>
          </div>
          {/* Pending */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pending</p>
            </div>
            <p className="text-2xl font-bold text-amber-600">
              {Object.values(summary.byMembershipType).reduce((sum, t) => sum + t.pending, 0)}
            </p>
            <p className="text-[11px] mt-0.5 font-mono text-slate-500">
              RM{summary.overallStats.pendingAmount.toLocaleString()}
            </p>
          </div>
        </div>
        </>
      )}

      {/* ── Membership Breakdown Table ── */}
      {summary && (
        <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${mobileStatPanel !== 'breakdown' ? 'hidden md:block' : ''}`}>
          {/* Card header */}
          <div className="flex items-center justify-between px-4 pt-3.5 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                <Users className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <span className="text-sm font-bold text-slate-800">
                Membership Breakdown · {year}
              </span>
            </div>
          </div>
          {/* Mobile: single-card table */}
          <div className="overflow-x-auto md:hidden">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="py-2.5 px-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                  <th className="py-2.5 px-2 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Total</th>
                  <th className="py-2.5 px-2 text-center text-[11px] font-semibold text-green-600 uppercase tracking-wide">Paid</th>
                  <th className="py-2.5 px-2 text-center text-[11px] font-semibold text-amber-600 uppercase tracking-wide">Pending</th>
                  <th className="py-2.5 px-2 text-center text-[11px] font-semibold text-red-500 uppercase tracking-wide">Overdue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {Object.entries(summary.byMembershipType).map(([type, stats]) => {
                  const rules = membershipRules || DEFAULT_MEMBERSHIP_RULES;
                  const standardDues = rules[type as MembershipType]?.duesAmount ?? MembershipDues[type as MembershipType] ?? 0;
                  const s = stats as any;
                  return (
                    <tr key={type} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${membershipTypeColors[type as MembershipType] || 'bg-slate-100 text-slate-700'}`}>
                          {type}
                          <span className="opacity-60 font-normal">/ RM{standardDues}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-slate-800">{s.total}</td>
                      <td className="py-2.5 px-2 text-center font-bold text-green-600">{s.paid}</td>
                      <td className="py-2.5 px-2 text-center font-bold text-amber-600">{s.pending}</td>
                      <td className="py-2.5 px-2 text-center font-bold text-red-500">{s.overdue}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block p-4 overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider sticky left-0 bg-white pr-4 z-10">
                    Type
                  </th>
                  {Object.entries(summary.byMembershipType).map(([type]) => (
                    <th key={type} className="pb-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${membershipTypeColors[type as MembershipType] || 'bg-slate-100 text-slate-700'}`}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                <tr>
                  <td className="py-2.5 font-medium text-slate-500 sticky left-0 bg-white pr-4 z-10">Standard Dues</td>
                  {Object.entries(summary.byMembershipType).map(([type]) => {
                    const rules = membershipRules || DEFAULT_MEMBERSHIP_RULES;
                    const standardDues = rules[type as MembershipType]?.duesAmount ?? MembershipDues[type as MembershipType] ?? 0;
                    return (
                      <td key={type} className="py-2.5 text-center text-slate-500 font-medium px-3">RM{standardDues}</td>
                    );
                  })}
                </tr>
                {[
                  { label: 'Total',   key: 'total',   color: 'text-slate-900', newVal: newMembershipBreakdown.total },
                  { label: 'Paid',    key: 'paid',    color: 'text-green-600', newVal: newMembershipBreakdown.paid },
                  { label: 'Pending', key: 'pending', color: 'text-amber-600', newVal: newMembershipBreakdown.pending },
                  { label: 'Overdue', key: 'overdue', color: 'text-red-600',   newVal: newMembershipBreakdown.overdue },
                ].map(({ label, key, color, newVal }) => (
                  <tr key={key}>
                    <td className={`py-2.5 font-semibold sticky left-0 bg-white pr-4 z-10 ${color}`}>{label}</td>
                    {Object.entries(summary.byMembershipType).map(([type, stats]) => (
                      <td key={type} className={`py-2.5 text-center font-bold px-3 ${color}`}>{(stats as any)[key]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Two-column grid: Renewal Members + Membership Payments ── */}

      {/* Mobile tab switcher */}
      <div className="md:hidden">
        <Tabs
         
          fullWidth
          tabs={[
            { id: 'members', label: 'Renewal Members' },
            { id: 'payments', label: 'Payments' },
          ]}
          activeTab={mobilePanel}
          onTabChange={(tab) => setMobilePanel(tab as 'members' | 'payments')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Left: Renewal Members */}
        <div className={`lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${mobilePanel !== 'members' ? 'hidden md:block' : ''}`}>
          {/* Card header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between px-4 pt-3.5 pb-3 border-b border-slate-100 gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              </div>
              <span className="text-sm font-bold text-slate-800">Renewal Members</span>
              <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5 shrink-0">
                {displayRenewals.length}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <select
                value={year}
                onChange={(e) => onYearChange?.(Number(e.target.value))}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-jci-blue/30 focus:border-jci-blue"
              >
                {Array.from({ length: new Date().getFullYear() - 2018 }, (_, i) => new Date().getFullYear() - i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as MembershipType | 'all')}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-jci-blue/30 focus:border-jci-blue"
              >
                <option value="all">All Types</option>
                <option value="Probation">Probation</option>
                <option value="Official">Official</option>
                <option value="Honorary">Honorary</option>
                <option value="Senator">Senator</option>
                <option value="Visiting">Visiting</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'all' | 'paid' | 'pending' | 'overdue')}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-jci-blue/30 focus:border-jci-blue"
              >
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
              </select>
              <button
                type="button"
                onClick={handleBulkWhatsApp}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors shrink-0"
                title="向所有 overdue / pending 会员发送 WhatsApp 会费催缴提醒"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterPrevYearPaid(v => !v)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors shrink-0 ${
                  filterPrevYearPaid
                    ? 'bg-jci-blue text-white border-jci-blue'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
                title={`${filterPrevYearPaid ? '取消' : '仅显示'}上一年已缴费会员（续费会员）`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{year - 1} 已缴</span>
              </button>
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto overflow-y-auto max-h-[520px]">
            {displayRenewals.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">No renewal records found for the selected filters.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="py-2.5 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-10">#</th>
                    <th className="py-2.5 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Member</th>
                    <th className="py-2.5 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                    <th className="py-2.5 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Outstanding</th>
                    <th className="py-2.5 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="py-2.5 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Due Date</th>
                    <th className="py-2.5 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Paid Date</th>
                    <th className="py-2.5 px-3 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {displayRenewals.map((renewal, index) => {
                    const m = members.find(mem => mem.id === renewal.memberId);
                    const targetDues = (renewal as any).targetDues ?? renewal.amount ?? 0;
                    const paidAmt = renewal.amount ?? 0;
                    const outstanding = targetDues - paidAmt;
                    const statusBarColor =
                      renewal.status === 'paid' || renewal.status === 'over paid' ? 'border-l-green-400' :
                      renewal.status === 'overdue' ? 'border-l-red-400' :
                      renewal.status === 'partial' ? 'border-l-orange-400' :
                      'border-l-amber-400';
                    const canWhatsApp = m?.phone && (renewal.status === 'overdue' || renewal.status === 'pending' || renewal.status === 'partial');
                    const isExpanded = expandedMemberId === renewal.memberId;
                    return (
                      <React.Fragment key={renewal.id}>
                        <tr
                          className={`border-l-2 ${statusBarColor} hover:bg-slate-50/80 transition-colors cursor-pointer`}
                          onClick={() => setExpandedMemberId(isExpanded ? null : renewal.memberId)}
                        >
                          <td className="py-2.5 px-3 text-xs text-slate-400 font-mono">{index + 1}</td>
                          <td className="py-2.5 px-3 text-xs font-semibold text-slate-800">
                            <span className="flex items-center gap-1">
                              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              {m?.name || renewal.memberId}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${renewal.membershipType ? membershipTypeColors[renewal.membershipType] : 'bg-slate-100 text-slate-600'}`}>
                              {renewal.membershipType ? renewal.membershipType.charAt(0).toUpperCase() + renewal.membershipType.slice(1) : 'Unknown'}
                            </span>
                          </td>
                          <td
                            className={`py-2.5 px-3 text-xs font-bold ${outstanding < 0 ? 'text-purple-600' : outstanding === 0 ? 'text-green-600' : 'text-slate-900'}`}
                            title={`应缴: RM${targetDues} | 已付: RM${paidAmt}`}
                          >
                            {outstanding < 0 ? `-RM${Math.abs(outstanding).toLocaleString()}` : `RM${outstanding.toLocaleString()}`}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColors[renewal.status]}`}>
                              {renewal.status.charAt(0).toUpperCase() + renewal.status.slice(1)}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-xs text-slate-600">{fmtDate(renewal.dueDate)}</td>
                          <td className="py-2.5 px-3 text-xs text-slate-500">
                            {renewal.status === 'paid' && renewal.paidDate ? fmtDate(renewal.paidDate) : '—'}
                          </td>
                          <td className="py-2.5 px-3" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-1.5">
                              {canWhatsApp && (
                                <button
                                  type="button"
                                  onClick={() => sendWhatsAppDuesReminder(m!.name, m!.phone, year, Math.max(0, outstanding))}
                                  className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-green-50 text-green-600 border border-green-200 hover:bg-green-100 transition-colors"
                                  title={`WhatsApp 提醒 ${m?.name}`}
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {m && renewal.status !== 'paid' && renewal.status !== 'over paid' &&
                                renewal.membershipType !== 'Honorary' && renewal.membershipType !== 'Senator' && (
                                <PaymentButton
                                  type="membership"
                                  member={m as any}
                                  year={year}
                                  size="sm"
                                  label="Pay"
                                  existingPaymentUrl={(m as any).membership?.[String(year)]?.toyyibPaymentUrl}
                                  existingBillStatus={(m as any).membership?.[String(year)]?.toyyibPaymentStatus}
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-l-2 border-l-indigo-300 bg-slate-50/70">
                            <td colSpan={8} className="px-6 py-3">
                              <p className="text-[11px] font-semibold text-indigo-700 mb-1.5">Membership History</p>
                              {renderMembershipHistory(m)}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2 p-3 overflow-y-auto max-h-[520px]">
            {displayRenewals.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-400 text-sm italic">No records found</p>
              </div>
            ) : displayRenewals.map((renewal, index) => {
              const m = members.find(mem => mem.id === renewal.memberId);
              const targetDues = (renewal as any).targetDues ?? renewal.amount ?? 0;
              const paidAmt = renewal.amount ?? 0;
              const outstanding = targetDues - paidAmt;
              const barColor =
                renewal.status === 'paid' || renewal.status === 'over paid' ? 'bg-green-400' :
                renewal.status === 'overdue' ? 'bg-red-400' :
                renewal.status === 'partial' ? 'bg-orange-400' :
                'bg-amber-400';
              const isExpanded = expandedMemberId === renewal.memberId;
              return (
                <div key={renewal.id} className="relative bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${barColor}`} />
                  <button
                    type="button"
                    className="w-full text-left pl-4 pr-3 pt-2.5 pb-2.5 focus:outline-none"
                    onClick={() => setExpandedMemberId(isExpanded ? null : renewal.memberId)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1 truncate">
                          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          #{index + 1} {m?.name || renewal.memberId}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5 ml-4">
                          <span className={`px-1.5 py-0 rounded-full text-[10px] font-semibold ${renewal.membershipType ? membershipTypeColors[renewal.membershipType] : 'bg-slate-100 text-slate-600'}`}>
                            {renewal.membershipType || 'Unknown'}
                          </span>
                          <span className={`px-1.5 py-0 rounded-full text-[10px] font-semibold ${statusColors[renewal.status]}`}>
                            {renewal.status}
                          </span>
                        </div>
                      </div>
                      <div className={`text-xs font-bold shrink-0 ${outstanding < 0 ? 'text-purple-600' : outstanding === 0 ? 'text-green-600' : 'text-slate-900'}`}>
                        {outstanding < 0 ? `-RM${Math.abs(outstanding).toLocaleString()}` : `RM${outstanding.toLocaleString()}`}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                      <span>Due: <span className="font-medium text-slate-700">{fmtDate(renewal.dueDate)}</span></span>
                    </div>
                  </button>
                  {/* Action buttons row — stops click-through to expand toggle */}
                  <div className="flex items-center justify-end gap-1.5 px-3 pb-2.5">
                    {renewal.status === 'paid' && renewal.paidDate && (
                      <span className="text-[10px] text-green-600 font-medium mr-auto">Paid: {fmtDate(renewal.paidDate)}</span>
                    )}
                    {m?.phone && (renewal.status === 'overdue' || renewal.status === 'pending' || renewal.status === 'partial') && (
                      <button
                        type="button"
                        onClick={() => sendWhatsAppDuesReminder(m.name, m.phone, year, Math.max(0, outstanding))}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors text-[10px] font-semibold"
                        title={`WhatsApp 提醒 ${m.name}`}
                      >
                        <MessageCircle className="w-3 h-3" /> WA
                      </button>
                    )}
                    {m && renewal.status !== 'paid' && renewal.status !== 'over paid' &&
                      renewal.membershipType !== 'Honorary' && renewal.membershipType !== 'Senator' && (
                      <PaymentButton
                        type="membership"
                        member={m as any}
                        year={year}
                        size="sm"
                        label="Pay"
                        existingPaymentUrl={(m as any).membership?.[String(year)]?.toyyibPaymentUrl}
                        existingBillStatus={(m as any).membership?.[String(year)]?.toyyibPaymentStatus}
                      />
                    )}
                  </div>
                  {/* Expanded: full membership history */}
                  {isExpanded && (
                    <div className="border-t border-indigo-100 bg-indigo-50/40 px-4 py-3">
                      <p className="text-[11px] font-semibold text-indigo-700 mb-2">Membership History</p>
                      {renderMembershipHistory(m)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Membership Payments */}
        <div className={`lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col ${mobilePanel !== 'payments' ? 'hidden md:flex' : ''}`}>
          {/* Card header */}
          <div className="flex items-center justify-between px-4 pt-3.5 pb-3 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center shrink-0">
                <DollarSign className="w-3.5 h-3.5 text-green-500" />
              </div>
              <div className="min-w-0">
                <span className="text-sm font-bold text-slate-800 block">Membership Payments</span>
                <span className="text-[10px] text-slate-400">{year}</span>
              </div>
            </div>
            {hasEditPermission && (
              <button
                type="button"
                onClick={handleAutoMatchMembers}
                disabled={autoMatching}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-50 shrink-0"
                title="根据交易描述/参考号自动匹配关联会员"
              >
                {autoMatching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                {autoMatching ? 'Matching...' : 'Auto-match'}
              </button>
            )}
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto max-h-[500px]">
            {(() => {
              const filteredByYear = membershipTransactions.filter((tx) => {
                const yearFromProjectId = tx.projectId?.match(/^(\d+)\s+membership$/)?.[1];
                const txYear = yearFromProjectId ? parseInt(yearFromProjectId, 10) : new Date(tx.date).getFullYear();
                return txYear === year;
              });

              if (filteredByYear.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <DollarSign className="w-10 h-10 text-slate-300 mb-3" />
                    <p className="text-slate-400 text-sm">No payments for {year}</p>
                  </div>
                );
              }

              const sorted = filteredByYear.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

              return (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block">
                    <table className="w-full">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="py-2.5 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                          <th className="py-2.5 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Description · Member</th>
                          <th className="py-2.5 px-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {sorted.map((tx) => {
                          const matchedMember = findMatchingMember(tx, members);
                          const isIncome = tx.type === 'Income';
                          const barColor = isIncome ? 'border-l-green-400' : 'border-l-red-400';
                          return (
                            <tr key={tx.id} className={`border-l-2 ${barColor} hover:bg-slate-50/80 transition-colors`}>
                              <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">
                                {fmtDate(tx.date)}
                              </td>
                              <td className="py-2.5 px-3 max-w-[160px]">
                                <div className="text-xs text-slate-700 truncate" title={tx.description}>{tx.description}</div>
                                <div className="text-[10px] mt-0.5">
                                  {tx.memberId ? (
                                    <span className="text-slate-500 font-medium">{matchedMember?.name || tx.memberId}</span>
                                  ) : matchedMember ? (
                                    <span className="inline-flex items-center gap-0.5 px-1 py-0 rounded text-amber-700 font-semibold bg-amber-50 border border-amber-200/60" title="系统自动匹配">
                                      ✨ {matchedMember.name}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 italic">—</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <div className={`text-xs font-bold ${isIncome ? 'text-green-600' : 'text-red-500'}`}>
                                  {isIncome ? '+' : '-'}{fmtCurrency(Math.abs(tx.amount))}
                                </div>
                                {hasEditPermission && (
                                  <button
                                    type="button"
                                    onClick={() => onEditMembershipTransaction?.(tx, year)}
                                    className="inline-flex items-center gap-0.5 mt-0.5 text-[10px] font-bold text-slate-400 hover:text-jci-blue transition-colors uppercase tracking-wider"
                                  >
                                    <Edit size={10} /> Edit
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="md:hidden space-y-2 p-3">
                    {sorted.map((tx) => {
                      const matchedMember = findMatchingMember(tx, members);
                      const isIncome = tx.type === 'Income';
                      const barColor = isIncome ? 'bg-green-400' : 'bg-red-400';
                      return (
                        <div key={tx.id} className="relative bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                          <div className={`absolute left-0 top-0 bottom-0 w-1 ${barColor}`} />
                          <div className="pl-4 pr-3 pt-2.5 pb-2.5">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] text-slate-400 font-medium">{fmtDate(tx.date)}</span>
                              <span className={`text-xs font-bold ${isIncome ? 'text-green-600' : 'text-red-500'}`}>
                                {isIncome ? '+' : '-'}{fmtCurrency(Math.abs(tx.amount))}
                              </span>
                            </div>
                            <div className="text-xs font-semibold text-slate-700 truncate mb-1">{tx.description}</div>
                            <div className="flex items-center justify-between">
                              <div className="text-[10px] text-slate-500 truncate max-w-[160px]">
                                {tx.memberId ? (
                                  <span>{matchedMember?.name || tx.memberId}</span>
                                ) : matchedMember ? (
                                  <span className="text-amber-700 font-semibold">✨ {matchedMember.name}</span>
                                ) : (
                                  <span className="italic">—</span>
                                )}
                              </div>
                              {hasEditPermission && (
                                <button
                                  type="button"
                                  onClick={() => onEditMembershipTransaction?.(tx, year)}
                                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition-colors"
                                >
                                  <Edit size={10} /> Edit
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        </div>

      </div>
      <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} variant={confirmState.variant} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(CONFIRM_CLOSED)} />
    </div>
  );
};
