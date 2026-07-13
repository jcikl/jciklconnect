import { useState, useEffect, useMemo, useCallback, useTransition } from 'react';
import { useToast } from '../components/ui/Common';
import { usePermissions } from './usePermissions';
import { useAuth } from './useAuth';
import { useBatchMode } from '../contexts/BatchModeContext';
import { FinanceService } from '../services/financeService';
import { PaymentRequestService } from '../services/paymentRequestService';
import { projectFinancialService } from '../services/projectFinancialService';
import { ProjectsService } from '../services/projectsService';
import { MembersService } from '../services/membersService';
import { MembershipConfigService } from '../services/membershipConfigService';
import { InventoryService } from '../services/inventoryService';
import { getAdministrativeProjectIds } from '../utils/administrativeProjectsStorage';
import { ADMINISTRATIVE_PURPOSES } from '../config/constants';
import {
  getLinkedBankTxInfo as getLinkedBankTxInfoUtil,
  isTransactionInCategory as isTransactionInCategoryUtil,
  getTransactionAccountLabel as getTransactionAccountLabelUtil,
} from '../utils/financeUtils';
import {
  buildCategoryFields,
  buildAdministrativePurpose,
} from '../utils/transactionCategoryUtils';
import type { Transaction, BankAccount, ProjectFinancialAccount, TransactionSplit, InventoryItem } from '../types';
import type { PaymentRequest, Project, MembershipType } from '../types';

export const UNASSIGNED_PROJECT_ID = 'UNASSIGNED_PROJECT';

export function useFinanceData(searchQuery?: string) {
  const [, startTransition] = useTransition();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isReportsModalOpen, setIsReportsModalOpen] = useState(false);
  const [reportType, setReportType] = useState<'income' | 'expense' | 'balance' | 'cashflow'>('income');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string | null>(null);
  const [reportYear, setReportYear] = useState<number>(new Date().getFullYear());
  const [historicalNetFlows, setHistoricalNetFlows] = useState<Record<string, number>>({});
  const [reportMonth, setReportMonth] = useState<number | null>(null);
  const [fiscalYearStart, setFiscalYearStart] = useState<number>(0);
  const [summary, setSummary] = useState<{
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    byCategory: Record<string, { income: number; expenses: number }>;
  } | null>(null);
  const [isDuesRenewalModalOpen, setIsDuesRenewalModalOpen] = useState(false);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [matchingAccount, setMatchingAccount] = useState<BankAccount | null>(null);
  const [renewalYear, setRenewalYear] = useState<number>(new Date().getFullYear());
  const [duesAmount, setDuesAmount] = useState<number>(150);
  const [isRenewing, setIsRenewing] = useState(false);
  const [moduleTab, setModuleTab] = useState('Dashboard');
  const [txSearchTerm, setTxSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [txCategoryFilter, setTxCategoryFilter] = useState('All');
  const [bankAccountFilter, setBankAccountFilter] = useState('All');
  const [txTypeFilter, setTxTypeFilter] = useState<'All' | 'Income' | 'Expense'>('All');
  const [txStatusFilter, setTxStatusFilter] = useState<'All' | 'Pending' | 'Cleared'>('All');
  const [transactionLimit, setTransactionLimit] = useState(50);
  const [txFiltersOpen, setTxFiltersOpen] = useState(false);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [projectAccounts, setProjectAccounts] = useState<ProjectFinancialAccount[]>([]);
  const [projectTrackerSummary, setProjectTrackerSummary] = useState<Record<string, { income: number; expenses: number }>>({});
  const [loadingProjectAccounts, setLoadingProjectAccounts] = useState(false);
  const [refNumberQuery, setRefNumberQuery] = useState('');
  const [reconciliationTx, setReconciliationTx] = useState<Transaction[]>([]);
  const [reconciliationPRs, setReconciliationPRs] = useState<PaymentRequest[]>([]);
  const [reconciliationLoading, setReconciliationLoading] = useState(false);
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);
  const [prPendingReconciliation, setPrPendingReconciliation] = useState<PaymentRequest[]>([]);
  const [prReconcileLoading, setPrReconcileLoading] = useState(false);
  const [prBankSuggestions, setPrBankSuggestions] = useState<Record<string, Transaction[]>>({});
  const [prSelectedBankTx, setPrSelectedBankTx] = useState<Record<string, string>>({});
  const [prLinkingId, setPrLinkingId] = useState<string | null>(null);
  const [addDefaultCategory, setAddDefaultCategory] = useState<string | null>(null);
  const [recordFormCategory, setRecordFormCategory] = useState<string>('Projects & Activities');
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<Array<{ id: string; name: string; membershipType?: MembershipType }>>([]);
  const [editingMembershipFilterYear, setEditingMembershipFilterYear] = useState<number | null>(null);
  const [editingMembershipMemberId, setEditingMembershipMemberId] = useState<string>('');
  const [editingMembershipYear, setEditingMembershipYear] = useState<number>(new Date().getFullYear());
  const [editingAdministrativeYear, setEditingAdministrativeYear] = useState<number>(new Date().getFullYear());
  const [editingAdministrativePurposeBase, setEditingAdministrativePurposeBase] = useState<string>('');
  const [editingProjectYear, setEditingProjectYear] = useState<number | undefined>(new Date().getFullYear());
  const [editingProjectPurpose, setEditingProjectPurpose] = useState<string>('');
  const [editingProjectPurposesByProject, setEditingProjectPurposesByProject] = useState<Record<string, string[]>>({});
  const [editingAdminPurposes, setEditingAdminPurposes] = useState<string[]>([]);
  const [editingAdminAccounts, setEditingAdminAccounts] = useState<string[]>([]);
  const [administrativeProjectIds, setAdministrativeProjectIds] = useState<string[]>(() => getAdministrativeProjectIds());
  const [isAddAdministrativeProjectOpen, setIsAddAdministrativeProjectOpen] = useState(false);
  const [adminProjectIdFilter, setAdminProjectIdFilter] = useState<string | null>(null);
  const [recordFormMemberId, setRecordFormMemberId] = useState('');
  const [recordFormYear, setRecordFormYear] = useState<number>(new Date().getFullYear());
  const [recordFormProjectId, setRecordFormProjectId] = useState<string>('');
  const [uncompletedPRs, setUncompletedPRs] = useState<PaymentRequest[]>([]);
  const [editingModalYear, setEditingModalYear] = useState<string>('All');
  const [transactionSplits, setTransactionSplits] = useState<Record<string, TransactionSplit[]>>({});

  // Project Tracker Transactions (Project Trx) Modal states
  const [isProjectTrxModalOpen, setIsProjectTrxModalOpen] = useState(false);
  const [projectTrxLoading, setProjectTrxLoading] = useState(false);
  const [projectTrxList, setProjectTrxList] = useState<Transaction[]>([]);
  const [projectTrxAddForm, setProjectTrxAddForm] = useState<Partial<Transaction>>({});
  const [projectTrxEditingId, setProjectTrxEditingId] = useState<string | null>(null);
  const [projectTrxEditForm, setProjectTrxEditForm] = useState<Partial<Transaction>>({});

  const [projectPurposes, setProjectPurposes] = useState<string[]>([]);
  const [projectAccountYearFilter, setProjectAccountYearFilter] = useState<number>(new Date().getFullYear());
  const [adminAccountYearFilter, setAdminAccountYearFilter] = useState<number>(new Date().getFullYear());

  // Batch category editing state
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [selectedSplitIds, setSelectedSplitIds] = useState<Set<string>>(new Set());
  const { setIsBatchMode } = useBatchMode();
  const [isBatchCategoryModalOpen, setIsBatchCategoryModalOpen] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [batchOperationProgress, setBatchOperationProgress] = useState<{ current: number; total: number } | null>(null);
  const [isAccountDetailOpen, setIsAccountDetailOpen] = useState(false);
  const [detailAccount, setDetailAccount] = useState<BankAccount | null>(null);
  const [detailYear, setDetailYear] = useState<number>(new Date().getFullYear());
  const [detailAccountYears, setDetailAccountYears] = useState<number[]>([new Date().getFullYear()]);
  const [allTransactionYears, setAllTransactionYears] = useState<number[]>([new Date().getFullYear()]);
  const [selectedProjectTransactions, setSelectedProjectTransactions] = useState<Transaction[]>([]);
  const [loadingSelectedProjectTransactions, setLoadingSelectedProjectTransactions] = useState<boolean>(false);

  const { showToast } = useToast();
  const { hasPermission, isDeveloper } = usePermissions();
  const { user } = useAuth();

  // ── Helper wrappers (close over local state) ──────────────────────────────

  const isTransactionInCategory = (tx: Transaction, category: string): boolean =>
    isTransactionInCategoryUtil(tx, category, transactionSplits);

  const getLinkedBankTxInfo = (projectTxId: string) =>
    getLinkedBankTxInfoUtil(projectTxId, transactions, accounts, transactionSplits);

  const getTransactionAccountLabel = (
    item: Partial<Transaction | TransactionSplit>,
    parent?: Partial<Transaction>
  ) => getTransactionAccountLabelUtil(item, parent, accounts, projectAccounts, projects, members, UNASSIGNED_PROJECT_ID);

  // ── selectedProjectInfo ───────────────────────────────────────────────────

  const selectedProjectInfo = useMemo(() => {
    if (!selectedProjectFilter || selectedProjectFilter === UNASSIGNED_PROJECT_ID) return null;
    return projects.find(p => p.id === selectedProjectFilter) || null;
  }, [selectedProjectFilter, projects]);

  // ── Project Trx handlers ──────────────────────────────────────────────────

  const loadProjectTrxList = async (projectId: string) => {
    setProjectTrxLoading(true);
    try {
      const txs = await FinanceService.getProjectTransactions(projectId);
      setProjectTrxList(txs);
    } catch (err) {
      console.error('Failed to load project transactions', err);
      showToast('Failed to load project tracker transactions', 'error');
    } finally {
      setProjectTrxLoading(false);
    }
  };

  const handleAddProjectTrx = useCallback(async () => {
    if (!selectedProjectFilter) return;
    const data = projectTrxAddForm;
    if (!data.amount || !data.description || !data.date) {
      showToast('Please fill in all required fields (Amount, Description, Date)', 'warning');
      return;
    }
    try {
      await FinanceService.createProjectTransaction({
        ...data,
        projectId: selectedProjectFilter,
        category: 'Projects & Activities',
        status: 'Pending',
      } as any);
      showToast('Transaction added successfully', 'success');
      setProjectTrxAddForm({});
      await loadProjectTrxList(selectedProjectFilter);
      await loadProjectAccounts();
    } catch (err) {
      showToast('Failed to add transaction', 'error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectFilter, projectTrxAddForm, showToast]);

  const handleUpdateProjectTrx = useCallback(async (id: string) => {
    if (!selectedProjectFilter) return;
    const data = projectTrxEditForm;
    if (!data.amount || !data.description || !data.date) {
      showToast('Please fill in all required fields (Amount, Description, Date)', 'warning');
      return;
    }
    try {
      await FinanceService.updateProjectTransaction(id, data);
      showToast('Transaction updated successfully', 'success');
      setProjectTrxEditingId(null);
      setProjectTrxEditForm({});
      await loadProjectTrxList(selectedProjectFilter);
      await loadProjectAccounts();
    } catch (err) {
      showToast('Failed to update transaction', 'error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectFilter, projectTrxEditForm, showToast]);

  const handleDeleteProjectTrx = useCallback(async (id: string) => {
    if (!selectedProjectFilter) return;
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    try {
      await FinanceService.deleteProjectTransaction(id);
      showToast('Transaction deleted successfully', 'success');
      await loadProjectTrxList(selectedProjectFilter);
      await loadProjectAccounts();
    } catch (err) {
      showToast('Failed to delete transaction', 'error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectFilter, showToast]);

  const handleProjectTrxPaste = useCallback(async (pastedText: string) => {
    if (!selectedProjectFilter) return;
    if (!pastedText || !pastedText.includes('\t')) {
      showToast('Please copy columns from spreadsheet first.', 'warning');
      return;
    }

    const rows = pastedText.split(/\r?\n/).filter(r => r.trim());
    let parsedCount = 0;
    let dynamicPurpose = '';
    setProjectTrxLoading(true);

    const parsePastedDate = (dateStr: string): string => {
      if (!dateStr) return '';
      const clean = dateStr.trim();
      const dmyMatch = clean.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
      if (dmyMatch) {
        return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
      }
      const ymdMatch = clean.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})$/);
      if (ymdMatch) {
        return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
      }
      try {
        const d = new Date(clean);
        if (!isNaN(d.getTime())) {
          return d.toISOString().split('T')[0];
        }
      } catch { }
      return '';
    };

    try {
      for (const row of rows) {
        const cols = row.split('\t');
        if (cols.length === 0) continue;

        const description = cols[0]?.trim();
        const remark = cols.length > 1 ? cols[1]?.trim() : '';
        const incomeStr = cols.length > 2 ? cols[2]?.replace(/[^0-9.-]+/g, '') : '';
        const expenseStr = cols.length > 3 ? cols[3]?.replace(/[^0-9.-]+/g, '') : '';

        const incomeAmount = parseFloat(incomeStr) || 0;
        const expenseAmount = parseFloat(expenseStr) || 0;

        if (description && !incomeStr && !expenseStr) {
          dynamicPurpose = description;
          continue;
        }

        const amount = incomeAmount > 0 ? incomeAmount : expenseAmount;
        if (!description || !amount) continue;

        let txType: 'Income' | 'Expense' = 'Expense';
        if (incomeAmount > 0) txType = 'Income';
        else if (expenseAmount > 0) txType = 'Expense';

        const rawDate = cols.length > 4 ? cols[4]?.trim() : '';
        const dateStr = parsePastedDate(rawDate);

        await FinanceService.createProjectTransaction({
          projectId: selectedProjectFilter,
          type: txType,
          amount: amount,
          description: description,
          referenceNumber: remark || undefined,
          date: dateStr,
          purpose: dynamicPurpose || undefined,
          category: 'Projects & Activities',
          status: 'Pending',
        } as any);
        parsedCount++;
      }

      if (parsedCount > 0) {
        showToast(`Successfully pasted and added ${parsedCount} transactions`, 'success');
        await loadProjectTrxList(selectedProjectFilter);
        await loadProjectAccounts();
      } else {
        showToast('Could not parse any valid transactions from clipboard', 'warning');
      }
    } catch (err) {
      console.error('Error pasting transactions:', err);
      showToast('Error parsing or adding transactions', 'error');
    } finally {
      setProjectTrxLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectFilter, showToast]);

  // ── useMemos ──────────────────────────────────────────────────────────────

  const adminAccountYearOptions = useMemo(() => {
    const years = new Set<number>();
    transactions.forEach(t => {
      if (isTransactionInCategory(t, 'Administrative')) {
        years.add(new Date(t.date).getFullYear());
      }
    });
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions, transactionSplits]);

  useEffect(() => {
    setIsBatchMode((selectedTxIds.size + selectedSplitIds.size) > 1);
    return () => setIsBatchMode(false);
  }, [selectedTxIds.size, selectedSplitIds.size, setIsBatchMode]);

  useEffect(() => {
    const loadSelectedProjectTransactions = async () => {
      if (!selectedProjectFilter || selectedProjectFilter === UNASSIGNED_PROJECT_ID) {
        setSelectedProjectTransactions([]);
        return;
      }
      setLoadingSelectedProjectTransactions(true);
      try {
        const txs = await FinanceService.getBankTransactionsByProject(selectedProjectFilter);
        setSelectedProjectTransactions(txs);
      } catch (err) {
        console.error('Failed to load transactions for selected project:', err);
        setSelectedProjectTransactions([]);
      } finally {
        setLoadingSelectedProjectTransactions(false);
      }
    };
    loadSelectedProjectTransactions();
  }, [selectedProjectFilter]);

  useEffect(() => {
    if (moduleTab === 'Reconciliation' && transactions.length > 0) {
      loadPrPendingReconciliation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleTab, transactions]);

  useEffect(() => {
    const loadYears = async () => {
      if (!detailAccount) return;
      try {
        const years = await FinanceService.getTransactionYearsForAccount(detailAccount.id);
        setDetailAccountYears(years);
      } catch (err) {
        console.error('Failed to load transaction years for account', err);
        setDetailAccountYears([new Date().getFullYear()]);
      }
    };
    loadYears();
  }, [detailAccount]);

  const availableYears = useMemo(() => {
    return detailAccountYears;
  }, [detailAccountYears]);

  const monthlyAccountSummary = useMemo(() => {
    if (!detailAccount || !transactions.length) return [];

    const accountTxs = transactions.filter(t => t.bankAccountId === detailAccount.id && !t.isSplitChild);

    const startOfYear = new Date(detailYear, 0, 1);
    const prevFlow = historicalNetFlows[detailAccount.id] || 0;
    const balanceBeforeYear = accountTxs
      .filter(t => new Date(t.date) < startOfYear)
      .reduce((sum, t) => sum + (t.type === 'Income' ? t.amount : -t.amount), (detailAccount.initialBalance || 0) + prevFlow);

    let runningBalance = balanceBeforeYear;
    const months = Array.from({ length: 12 }, (_, i) => i);

    return months.map(m => {
      const monthTxs = accountTxs.filter(t => {
        const d = new Date(t.date);
        return d.getFullYear() === detailYear && d.getMonth() === m;
      });

      const income = monthTxs.filter(t => t.type === 'Income').reduce((s, t) => s + t.amount, 0);
      const expenses = monthTxs.filter(t => t.type === 'Expense').reduce((s, t) => s + t.amount, 0);
      const openingBalance = runningBalance;
      runningBalance += (income - expenses);
      const closingBalance = runningBalance;

      return { month: m, openingBalance, income, expenses, closingBalance };
    });
  }, [detailAccount, detailYear, transactions, historicalNetFlows]);

  const projectTransactions = useMemo(() => {
    const pt = transactions.filter(tx => {
      if (!isTransactionInCategory(tx, 'Projects & Activities')) return false;
      if (tx.isSplit && tx.splitIds && tx.splitIds.length > 0) return false;
      return true;
    });

    const splitChildren: Transaction[] = [];
    Object.entries(transactionSplits).forEach(([parentId, splits]) => {
      const parentTx = transactions.find(t => t.id === parentId);
      splits.forEach(split => {
        if (split.category === 'Projects & Activities') {
          splitChildren.push({
            id: split.id,
            date: parentTx?.date || '',
            description: split.description,
            purpose: split.purpose,
            amount: split.amount,
            type: parentTx?.type || 'Expense',
            category: 'Projects & Activities',
            status: parentTx?.status || 'Pending',
            projectId: split.projectId,
            memberId: split.memberId,
            bankAccountId: parentTx?.bankAccountId,
            referenceNumber: split.paymentRequestId,
            paymentRequestId: split.paymentRequestId,
            isSplitChild: true,
            parentTransactionId: parentId,
          } as Transaction);
        }
      });
    });

    const allPt = [...pt, ...splitChildren];

    if (!selectedProjectFilter) return allPt;
    if (selectedProjectFilter === UNASSIGNED_PROJECT_ID) {
      return allPt.filter(tx => tx.projectId === null || tx.projectId === '');
    }
    return allPt.filter(tx => tx.projectId === selectedProjectFilter);
  }, [transactions, selectedProjectFilter, transactionSplits]);

  const membershipTransactions = useMemo(() => {
    const direct = transactions.filter(tx => {
      if (!isTransactionInCategory(tx, 'Membership')) return false;
      if (tx.isSplit && tx.splitIds && tx.splitIds.length > 0) return false;
      return true;
    });

    const splitChildren: Transaction[] = [];
    Object.entries(transactionSplits).forEach(([parentId, splits]) => {
      const parentTx = transactions.find(t => t.id === parentId);
      splits.forEach(split => {
        if (split.category === 'Membership') {
          splitChildren.push({
            id: split.id,
            date: parentTx?.date || '',
            description: split.description,
            purpose: split.purpose,
            amount: split.amount,
            type: parentTx?.type || 'Expense',
            category: 'Membership',
            status: parentTx?.status || 'Pending',
            projectId: split.projectId,
            memberId: split.memberId,
            bankAccountId: parentTx?.bankAccountId,
            paymentRequestId: split.paymentRequestId,
            isSplitChild: true,
            parentTransactionId: parentId,
          } as Transaction);
        }
      });
    });

    return [...direct, ...splitChildren];
  }, [transactions, transactionSplits]);

  const administrativeTransactions = useMemo(() => {
    const direct = transactions.filter(tx => {
      if (!isTransactionInCategory(tx, 'Administrative')) return false;
      if (tx.isSplit && tx.splitIds && tx.splitIds.length > 0) return false;
      return true;
    });

    const splitChildren: Transaction[] = [];
    Object.entries(transactionSplits).forEach(([parentId, splits]) => {
      const parentTx = transactions.find(t => t.id === parentId);
      splits.forEach(split => {
        if (split.category === 'Administrative') {
          splitChildren.push({
            id: split.id,
            date: parentTx?.date || '',
            description: split.description,
            purpose: split.purpose,
            amount: split.amount,
            type: parentTx?.type || 'Expense',
            category: 'Administrative',
            status: parentTx?.status || 'Pending',
            projectId: split.projectId,
            memberId: split.memberId,
            bankAccountId: parentTx?.bankAccountId,
            paymentRequestId: split.paymentRequestId,
            isSplitChild: true,
            parentTransactionId: parentId,
          } as Transaction);
        }
      });
    });

    return [...direct, ...splitChildren];
  }, [transactions, transactionSplits]);

  const uncategorizedProjectTxCount = useMemo(() => {
    return transactions.filter(tx => isTransactionInCategory(tx, 'Projects & Activities') && (tx.projectId === null || tx.projectId === '')).length;
  }, [transactions, transactionSplits]);

  const projectAccountYearOptions = useMemo(() => {
    const approvedStatuses = ['Approved', 'Planning', 'Active', 'Completed', 'Review'];
    const years = new Set<number>();
    projects.forEach(p => {
      if (approvedStatuses.includes(p.status as string)) {
        const pDate = p.eventStartDate || p.startDate || p.date || p.proposedDate;
        if (pDate) {
          years.add(new Date(pDate).getFullYear());
        }
      }
    });
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [projects]);

  const filteredProjectAccounts = useMemo(() => {
    if (projectAccountYearFilter === 0) return projectAccounts;

    return projectAccounts.filter(acc => {
      const project = projects.find(p => p.id === acc.projectId);
      if (!project) return false;

      const pDate = project.eventStartDate || project.startDate || project.date || project.proposedDate || project.createdAt || project.updatedAt;
      if (!pDate) return false;

      const pYear = new Date(pDate).getFullYear();
      return pYear === projectAccountYearFilter;
    });
  }, [projectAccounts, projectAccountYearFilter, projects]);

  const projectYears = useMemo(() => {
    const years = new Set<number>();
    const currentYear = new Date().getFullYear();
    years.add(currentYear);

    projects.forEach(p => {
      const pDate = p.eventStartDate || p.startDate || p.date || p.proposedDate || p.createdAt || p.updatedAt;
      if (pDate) {
        try {
          const d = new Date(pDate);
          if (!isNaN(d.getTime())) {
            years.add(d.getFullYear());
          }
        } catch (e) { }
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [projects]);

  const filteredProjectsForModal = useMemo(() => {
    if (editingModalYear === 'All') return projects;
    const yearInt = parseInt(editingModalYear, 10);
    const currentYear = new Date().getFullYear();

    return projects.filter(p => {
      const pDate = p.eventStartDate || p.startDate || p.date || p.proposedDate || p.createdAt || p.updatedAt;
      const pYear = pDate ? new Date(pDate).getFullYear() : currentYear;
      return pYear === yearInt;
    });
  }, [projects, editingModalYear]);

  const groupedProjectsForModal = useMemo(() => {
    const filtered = editingModalYear === 'All' ? projects : filteredProjectsForModal;
    const grouped: Record<number, string[]> = {};
    const currentYear = new Date().getFullYear();

    filtered.forEach(p => {
      const pDate = p.eventStartDate || p.startDate || p.date || p.proposedDate || p.createdAt || p.updatedAt;
      const year = pDate ? new Date(pDate).getFullYear() : currentYear;

      if (!grouped[year]) grouped[year] = [];
      grouped[year].push(p.name || p.id);
    });

    const sortedYears = Object.keys(grouped)
      .map(y => parseInt(y, 10))
      .sort((a, b) => b - a);

    return sortedYears.map(year => ({
      label: String(year),
      options: grouped[year].sort()
    }));
  }, [projects, filteredProjectsForModal, editingModalYear]);

  const dynamicAdministrativeProjectIds = useMemo(() => {
    const defaultIds = administrativeProjectIds;
    const txProjectIds = transactions
      .filter(t => isTransactionInCategory(t, 'Administrative') && t.projectId && t.projectId.trim() !== '')
      .map(t => t.projectId!.trim());

    const combined = Array.from(new Set([...defaultIds, ...txProjectIds]));
    return combined.sort((a, b) => a.localeCompare(b));
  }, [administrativeProjectIds, transactions]);

  const displayTransactions = useMemo(() => {
    const acctNameMap = new Map(accounts.map(a => [a.id, (a.name || '').toLowerCase()]));
    const projNameMap = new Map(projects.map(p => [p.id, (p.name || p.title || '').toLowerCase()]));

    const filtered = transactions.filter(tx => {
      if (txCategoryFilter === 'All') {
        // keep all
      } else if (txCategoryFilter === 'Uncategorized') {
        const hasProjectId = tx.projectId && tx.projectId.trim() !== '';
        const hasPurpose = tx.purpose && tx.purpose.trim() !== '';
        const hasUncategorizedSplit = tx.isSplit && transactionSplits[tx.id]?.some(split => {
          const sHasProjectId = split.projectId && split.projectId.trim() !== '';
          const sHasPurpose = split.purpose && split.purpose.trim() !== '';
          return !sHasProjectId || !sHasPurpose;
        });
        if (!hasUncategorizedSplit && (hasProjectId && hasPurpose)) {
          return false;
        }
      } else if (!isTransactionInCategory(tx, txCategoryFilter)) {
        return false;
      }

      if (bankAccountFilter !== 'All' && tx.bankAccountId !== bankAccountFilter) {
        return false;
      }

      const termToUse = searchQuery || debouncedSearchTerm;
      if (termToUse) {
        const terms = termToUse.toLowerCase().split(/\s+/).filter(t => t !== '');

        const isMatch = terms.every(term => {
          const parentFields = [
            tx.description.toLowerCase(),
            (tx.referenceNumber || '').toLowerCase(),
            (tx.category || '').toLowerCase(),
            (tx.status || '').toLowerCase(),
            tx.date.toLowerCase(),
            String(tx.amount),
            tx.type.toLowerCase(),
            (tx.purpose || '').toLowerCase(),
            (tx.projectId || '').toLowerCase(),
            (tx.memberId || '').toLowerCase(),
            acctNameMap.get(tx.bankAccountId) || '',
            projNameMap.get(tx.projectId ?? '') || '',
          ];

          const parentMatch = parentFields.some(field => field.includes(term));
          if (parentMatch) return true;

          const splitMatch = transactionSplits[tx.id]?.some(s =>
            s.category.toLowerCase().includes(term) ||
            s.description.toLowerCase().includes(term) ||
            s.purpose?.toLowerCase().includes(term) ||
            String(s.amount).includes(term) ||
            (projNameMap.get(s.projectId ?? '') || '').includes(term)
          );

          return splitMatch;
        });

        if (!isMatch) return false;
      }

      return true;
    });

    const sorted = [...filtered].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let rb = 0;
    if (bankAccountFilter !== 'All') {
      const selectedAccount = accounts.find(acc => acc.id === bankAccountFilter);
      const initBal = selectedAccount?.initialBalance || 0;
      const prevFlow = historicalNetFlows[bankAccountFilter] || 0;
      rb = initBal + prevFlow;
    } else {
      const initBal = accounts.reduce((sum, acc) => sum + (acc.initialBalance || 0), 0);
      const prevFlow = Object.values(historicalNetFlows).reduce((sum, val) => sum + val, 0);
      rb = initBal + prevFlow;
    }

    const withBalance = sorted.map(tx => {
      const amountChange = tx.type === 'Income' ? tx.amount : -tx.amount;
      rb += amountChange;
      return { ...tx, runningBalance: rb };
    });

    const totalTransactions = [...withBalance].reverse();
    return totalTransactions.slice(0, transactionLimit);
  }, [transactions, txCategoryFilter, debouncedSearchTerm, bankAccountFilter, accounts, projects, transactionSplits, transactionLimit, historicalNetFlows, searchQuery]);

  const visibleTransactions = useMemo(() => {
    return displayTransactions.filter(tx => {
      if (txTypeFilter !== 'All' && tx.type !== txTypeFilter) return false;
      if (txStatusFilter !== 'All' && tx.status !== txStatusFilter) return false;
      return true;
    });
  }, [displayTransactions, txTypeFilter, txStatusFilter]);

  const groupedTransactions = useMemo(() => {
    const groups: { key: string; label: string; txs: typeof visibleTransactions }[] = [];
    let currentKey = '';
    for (const tx of visibleTransactions) {
      const d = new Date(tx.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = d.toLocaleDateString('en-MY', { month: 'long', year: 'numeric' });
      if (key !== currentKey) {
        groups.push({ key, label, txs: [] });
        currentKey = key;
      }
      groups[groups.length - 1].txs.push(tx);
    }
    return groups;
  }, [visibleTransactions]);

  const hasMoreTransactions = useMemo(() => {
    const filteredCount = transactions.filter(tx => {
      if (txCategoryFilter !== 'All') {
        if (txCategoryFilter === 'Uncategorized') {
          const hasProjectId = tx.projectId && tx.projectId.trim() !== '';
          const hasPurpose = tx.purpose && tx.purpose.trim() !== '';
          const hasUncategorizedSplit = tx.isSplit && transactionSplits[tx.id]?.some(split => {
            const sHasProjectId = split.projectId && split.projectId.trim() !== '';
            const sHasPurpose = split.purpose && split.purpose.trim() !== '';
            return !sHasProjectId || !sHasPurpose;
          });
          if (!hasUncategorizedSplit && (hasProjectId && hasPurpose)) return false;
        } else if (!isTransactionInCategory(tx, txCategoryFilter)) return false;
      }
      if (bankAccountFilter !== 'All' && tx.bankAccountId !== bankAccountFilter) return false;
      const termToUse = searchQuery || debouncedSearchTerm;
      if (termToUse) {
        const terms = termToUse.toLowerCase().split(/\s+/).filter(t => t !== '');
        return terms.every(term => {
          const parentFields = [
            tx.description.toLowerCase(),
            (tx.referenceNumber || '').toLowerCase(),
            (tx.category || '').toLowerCase(),
            (tx.status || '').toLowerCase(),
            tx.date.toLowerCase(),
            String(tx.amount),
            tx.type.toLowerCase(),
            (tx.purpose || '').toLowerCase(),
            (tx.projectId || '').toLowerCase(),
            (tx.memberId || '').toLowerCase(),
            (accounts.find(a => a.id === tx.bankAccountId)?.name || '').toLowerCase(),
            (projects.find(p => p.id === tx.projectId)?.name || '').toLowerCase()
          ];
          if (parentFields.some(field => field.includes(term))) return true;
          return transactionSplits[tx.id]?.some(s =>
            s.category.toLowerCase().includes(term) ||
            s.description.toLowerCase().includes(term) ||
            s.purpose?.toLowerCase().includes(term) ||
            String(s.amount).includes(term) ||
            (s.projectId || '').toLowerCase().includes(term) ||
            (s.memberId || '').toLowerCase().includes(term) ||
            (projects.find(p => p.id === s.projectId)?.name || '').toLowerCase().includes(term)
          );
        });
      }
      return true;
    }).length;

    return filteredCount > transactionLimit;
  }, [transactions, txCategoryFilter, debouncedSearchTerm, bankAccountFilter, transactionSplits, transactionLimit]);

  const dashboardStats = useMemo(() => {
    return {
      totalCash: accounts.reduce((acc, curr) => acc + curr.balance, 0),
      pendingCount: transactions.filter(t => t.status === 'Pending').length,
      pendingExpensesCount: transactions.filter(t => t.status === 'Pending' && t.type === 'Expense').length,
    };
  }, [accounts, transactions]);

  // ── Callbacks ─────────────────────────────────────────────────────────────

  const handleSelectAllTransactions = useCallback(() => {
    const allVisibleTxIds = displayTransactions.map(t => t.id);
    const allVisibleSplitIds = displayTransactions.flatMap(t =>
      t.isSplit && transactionSplits[t.id] ? transactionSplits[t.id].map(s => s.id) : []
    );

    const isAllSelected = allVisibleTxIds.length > 0 && allVisibleTxIds.every(id => selectedTxIds.has(id)) &&
      (allVisibleSplitIds.length === 0 || allVisibleSplitIds.every(id => selectedSplitIds.has(id)));

    if (isAllSelected) {
      const nextTx = new Set(selectedTxIds);
      allVisibleTxIds.forEach(id => nextTx.delete(id));
      setSelectedTxIds(nextTx);

      const nextSplits = new Set(selectedSplitIds);
      allVisibleSplitIds.forEach(id => nextSplits.delete(id));
      setSelectedSplitIds(nextSplits);
    } else {
      const nextTx = new Set(selectedTxIds);
      allVisibleTxIds.forEach(id => nextTx.add(id));
      setSelectedTxIds(nextTx);

      const nextSplits = new Set(selectedSplitIds);
      allVisibleSplitIds.forEach(id => nextSplits.add(id));
      setSelectedSplitIds(nextSplits);
    }
  }, [displayTransactions, transactionSplits, selectedTxIds, selectedSplitIds]);

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        if (moduleTab === 'Transactions' && displayTransactions.length > 0) {
          const target = e.target as HTMLElement;
          if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
            return;
          }
          e.preventDefault();
          handleSelectAllTransactions();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSelectAllTransactions, moduleTab, displayTransactions.length]);

  useEffect(() => {
    const handler = setTimeout(() => {
      startTransition(() => {
        setDebouncedSearchTerm(txSearchTerm);
        setTransactionLimit(50);
      });
    }, 400);
    return () => clearTimeout(handler);
  }, [txSearchTerm, startTransition]);

  useEffect(() => {
    loadData(reportYear);
  }, [reportYear]);

  useEffect(() => {
    if (moduleTab === 'Project Account') {
      loadProjectAccounts(projectAccountYearFilter);
    }
  }, [moduleTab, projectAccountYearFilter]);

  useEffect(() => {
    setDetailYear(reportYear);
  }, [reportYear]);

  useEffect(() => {
    if (moduleTab === 'Membership' || (editingTransaction?.category === 'Membership' && isEditModalOpen) || (isModalOpen && recordFormCategory === 'Membership')) {
      loadMembers();
    }
  }, [moduleTab, editingTransaction?.category, isEditModalOpen, isModalOpen, recordFormCategory]);

  useEffect(() => {
    if (isModalOpen && addDefaultCategory) {
      setRecordFormCategory(addDefaultCategory);
    }
  }, [isModalOpen, addDefaultCategory]);

  useEffect(() => {
    const loadUncompletedPRs = async () => {
      try {
        const { items } = await PaymentRequestService.list({ pageSize: 100 });
        setUncompletedPRs(items.filter(pr => pr.status === 'submitted' || pr.status === 'draft'));
      } catch {
        setUncompletedPRs([]);
      }
    };

    if (isEditModalOpen || isModalOpen) {
      loadUncompletedPRs();
    } else {
      setUncompletedPRs([]);
    }
  }, [isEditModalOpen, isModalOpen]);

  useEffect(() => {
    const loadPurposesForProject = async () => {
      if (!isEditModalOpen || !editingTransaction || editingTransaction.category !== 'Projects & Activities') {
        return;
      }

      const projectId = editingTransaction.projectId;
      if (!projectId) {
        return;
      }

      if (editingProjectPurposesByProject[projectId]) {
        return;
      }

      try {
        const purposes = new Set<string>();

        try {
          const ptTrx = await projectFinancialService.getAllProjectTrackerTransactions();
          ptTrx.forEach(t => {
            if (t.projectId === projectId && t.purpose) purposes.add(t.purpose);
          });
        } catch (e) { console.error('Failed to load PT purposes', e); }

        const allTx = await FinanceService.getAllTransactions();
        allTx.forEach(t => {
          if (t.projectId === projectId && t.purpose) purposes.add(t.purpose);
        });

        const splitTx = allTx.filter(t => t.isSplit && t.splitIds);
        for (const t of splitTx) {
          try {
            const splits = await FinanceService.getTransactionSplits(t.id);
            splits.forEach(s => {
              if (s.projectId === projectId && s.purpose) purposes.add(s.purpose);
            });
          } catch (e) { }
        }

        setEditingProjectPurposesByProject(prev => ({
          ...prev,
          [projectId]: Array.from(purposes).sort()
        }));
      } catch (e) {
        console.error('Failed to load purposes for project', projectId, e);
      }
    };

    loadPurposesForProject();
  }, [isEditModalOpen, editingTransaction?.projectId, editingTransaction?.category]);

  useEffect(() => {
    const loadAdminPurposes = async () => {
      if (!isEditModalOpen || !editingTransaction || editingTransaction.category !== 'Administrative') {
        return;
      }

      if (editingAdminPurposes.length > 0 && editingAdminAccounts.length > 0) {
        return;
      }

      try {
        const purposes = new Set<string>(ADMINISTRATIVE_PURPOSES);
        const accts = new Set<string>();

        const allTx = await FinanceService.getAllTransactions();
        allTx.forEach(t => {
          if (t.category === 'Administrative') {
            if (t.purpose) {
              purposes.add(t.purpose);
            }
            if (t.projectId) {
              accts.add(t.projectId);
            }
          }
        });

        administrativeProjectIds.forEach(id => accts.add(id));

        setEditingAdminPurposes(Array.from(purposes).sort());
        setEditingAdminAccounts(Array.from(accts).sort());
      } catch (e) {
        console.error('Failed to load admin purposes', e);
      }
    };

    loadAdminPurposes();
  }, [isEditModalOpen, editingTransaction?.category]);

  // ── Core data loaders ─────────────────────────────────────────────────────

  const loadData = async (targetYear: number = reportYear) => {
    try {
      setLoading(true);
      setError(null);
      const [txs, accts, summ, inventory, projList, histFlows, allYears] = await Promise.all([
        FinanceService.getAllTransactions(targetYear),
        FinanceService.getAllBankAccounts(),
        FinanceService.getFinancialSummary(targetYear),
        InventoryService.getAllItems(),
        ProjectsService.getAllProjects(),
        targetYear !== 0 ? FinanceService.getHistoricalNetFlowBeforeYear(targetYear) : Promise.resolve({}),
        FinanceService.getAllTransactionYears()
      ]);
      setTransactions(txs);
      setAccounts(accts);
      setSummary(summ);
      setInventoryItems(inventory);
      setProjects(projList);
      setAdministrativeProjectIds(getAdministrativeProjectIds());
      setHistoricalNetFlows(histFlows);
      setAllTransactionYears(allYears);
      try {
        const projectAccountList = await projectFinancialService.getAllProjectAccounts(targetYear);
        setProjectAccounts(projectAccountList);
      } catch (projectAccountError) {
        console.error('Failed to load project account labels', projectAccountError);
      }

      const allSplits = await FinanceService.getAllTransactionSplits(targetYear);
      const splitsMap: Record<string, TransactionSplit[]> = {};
      const txIdsSet = new Set(txs.map(t => t.id));
      allSplits.forEach(split => {
        if (txIdsSet.has(split.parentTransactionId)) {
          if (!splitsMap[split.parentTransactionId]) {
            splitsMap[split.parentTransactionId] = [];
          }
          splitsMap[split.parentTransactionId].push(split);
        }
      });
      setTransactionSplits(splitsMap);

      if (selectedProjectFilter && selectedProjectFilter !== UNASSIGNED_PROJECT_ID) {
        try {
          const selTxs = await FinanceService.getBankTransactionsByProject(selectedProjectFilter);
          setSelectedProjectTransactions(selTxs);
        } catch (selectedTxErr) {
          console.error('Failed to reload selected project transactions in loadData', selectedTxErr);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load financial data';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadProjectAccounts = async (year: number = projectAccountYearFilter) => {
    setLoadingProjectAccounts(true);
    try {
      const [list, ptTrx] = await Promise.all([
        projectFinancialService.getAllProjectAccounts(year),
        projectFinancialService.getAllProjectTrackerTransactions()
      ]);
      setProjectAccounts(list);

      const ptSummary: Record<string, { income: number; expenses: number }> = {};
      ptTrx.forEach(tx => {
        const pid = tx.projectId;
        if (!pid) return;

        if (!ptSummary[pid]) {
          ptSummary[pid] = { income: 0, expenses: 0 };
        }

        const type = (tx.type || '').toLowerCase();
        const amount = Math.abs(tx.amount || 0);

        if (type === 'income') {
          ptSummary[pid].income += amount;
        } else {
          ptSummary[pid].expenses += amount;
        }
      });
      setProjectTrackerSummary(ptSummary);

    } catch (err) {
      console.error('Failed to load project accounts or PT data', err);
      showToast('Failed to load project financial data', 'error');
    } finally {
      setLoadingProjectAccounts(false);
    }
  };

  const loadProjects = async () => {
    try {
      const list = await ProjectsService.getAllProjects();
      setProjects(list);
      return list;
    } catch {
      setProjects([]);
      return [];
    }
  };

  const loadMembers = async () => {
    try {
      const list = await MembersService.getAllMembers();
      const mappedMembers = list.map(m => ({
        id: m.id,
        name: m.fullName && m.name
          ? `${m.fullName} (${m.name})`
          : (m.fullName || m.name || m.email || m.id),
        fullName: m.fullName,
        membershipType: m.membershipType,
        tshirtSize: m.tshirtSize,
        jacketSize: m.jacketSize,
        introducer: m.introducer,
        joinDate: m.joinDate,
        membership: m.membership,
      }));
      setMembers(mappedMembers);
      return mappedMembers;
    } catch {
      setMembers([]);
      return [];
    }
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleAddTransaction = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const category = formData.get('category') as Transaction['category'];

    try {
      setLoading(true);
      let projectId: string | undefined;
      let purpose: string | undefined;
      let memberId: string | undefined;

      const amount = parseFloat(formData.get('amount') as string) || 0;
      const year = parseInt((formData.get('year') as string) || String(new Date().getFullYear()), 10);
      const rules = category === 'Membership' ? await MembershipConfigService.getRules() : undefined;
      const catFields = buildCategoryFields({
        category,
        amount,
        year,
        memberId: (formData.get('memberId') as string)?.trim() || undefined,
        projectId: (formData.get('projectId') as string)?.trim() || undefined,
        purpose: (formData.get('purpose') as string)?.trim() || undefined,
        rules,
      });
      projectId = catFields.projectId;
      purpose = catFields.purpose;
      memberId = catFields.memberId ?? undefined;

      const transactionData = {
        date: formData.get('date') as string,
        description: formData.get('description') as string,
        purpose,
        amount: parseFloat(formData.get('amount') as string),
        type: formData.get('type') as 'Income' | 'Expense',
        category,
        status: 'Pending' as const,
        projectId,
        memberId,
        bankAccountId: formData.get('bankAccountId') as string || undefined,
        referenceNumber: (formData.get('referenceNumber') as string)?.trim() || undefined,
        paymentRequestId: (formData.get('paymentRequestId') as string)?.trim() || undefined,
        inventoryLinkId: formData.get('inventoryLinkId') as string || undefined,
        inventoryVariant: formData.get('inventoryVariant') as string || undefined,
        inventoryQuantity: parseInt(formData.get('inventoryQuantity') as string || '0', 10) || undefined,
      };

      await FinanceService.createTransaction(transactionData);

      showToast('Transaction recorded successfully', 'success');
      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      showToast('Failed to record transaction', 'error');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showToast]);

  const handleSendReminders = useCallback(() => {
    showToast('32 Payment reminders sent via Email & Push', 'success');
  }, [showToast]);

  const handleEditTransaction = useCallback((transaction: Transaction) => {
    setEditingTransaction(transaction);
    const txYear = new Date(transaction.date).getFullYear();
    setEditingModalYear(String(txYear));

    if (transaction.category === 'Membership' && members.length === 0) {
      loadMembers();
    }

    if (transaction.category === 'Membership') {
      setEditingMembershipMemberId(transaction.memberId || '');
      setEditingMembershipFilterYear(txYear);
      const yearFromProjectId = transaction.projectId?.match(/^(\d+)\s+membership$/)?.[1];
      setEditingMembershipYear(yearFromProjectId ? parseInt(yearFromProjectId, 10) : txYear);
      setEditingAdministrativeYear(new Date().getFullYear());
      setEditingAdministrativePurposeBase('');
    } else if (transaction.category === 'Administrative') {
      setEditingMembershipFilterYear(null);
      setEditingMembershipMemberId('');
      const purpose = transaction.purpose ?? '';
      const match = purpose.match(/^(\d{4})\s+(.+)$/);
      const year = match ? parseInt(match[1], 10) : txYear;
      const base = match?.[2] ?? ((ADMINISTRATIVE_PURPOSES as readonly string[]).includes(purpose) ? purpose : '');
      setEditingAdministrativeYear(year);
      setEditingAdministrativePurposeBase(base);
      setEditingModalYear(String(year));
    } else {
      setEditingMembershipFilterYear(null);
      setEditingMembershipMemberId('');
      setEditingAdministrativeYear(new Date().getFullYear());
      setEditingAdministrativePurposeBase('');
    }
    setIsEditModalOpen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members.length]);

  const handleDeleteTransaction = useCallback(async (transactionId: string) => {
    if (!confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) {
      return;
    }

    try {
      const tx = transactions.find(t => t.id === transactionId);
      if (tx?.isSplit) {
        const splits = await FinanceService.getTransactionSplits(transactionId);
        for (const split of splits) {
          await FinanceService.deleteTransactionSplit(split.id);
        }
      }

      await FinanceService.deleteTransaction(transactionId);
      showToast('Transaction deleted successfully', 'success');
      await loadData();
    } catch (err) {
      showToast('Failed to delete transaction', 'error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, showToast]);

  const handleBatchDelete = useCallback(async () => {
    const totalCount = selectedTxIds.size + selectedSplitIds.size;
    if (totalCount === 0) return;

    if (!confirm(`Are you sure you want to delete ${totalCount} selected item(s)? This action cannot be undone.`)) {
      return;
    }

    setLoading(true);
    setBatchOperationProgress({ current: 0, total: totalCount });
    let successCount = 0;
    let failCount = 0;

    try {
      const txResults = await Promise.all(
        Array.from(selectedTxIds).map(async (id) => {
          try {
            const tx = transactions.find(t => t.id === id);
            if (tx?.isSplit) {
              const splits = await FinanceService.getTransactionSplits(id);
              await Promise.all(splits.map(s => FinanceService.deleteTransactionSplit(s.id)));
            }
            await FinanceService.deleteTransaction(id);
            setBatchOperationProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null);
            return { success: true };
          } catch (err) {
            console.error(`Failed to delete transaction ${id}:`, err);
            setBatchOperationProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null);
            return { success: false, id };
          }
        })
      );

      const splitResults = await Promise.all(
        Array.from(selectedSplitIds).map(async (id) => {
          try {
            await FinanceService.deleteTransactionSplit(id);
            setBatchOperationProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null);
            return { success: true };
          } catch (err) {
            console.error(`Failed to delete split ${id}:`, err);
            setBatchOperationProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null);
            return { success: false, id };
          }
        })
      );

      successCount = txResults.filter(r => r.success).length + splitResults.filter(r => r.success).length;
      failCount = txResults.filter(r => !r.success).length + splitResults.filter(r => !r.success).length;

      showToast(
        `Batch delete completed: ${successCount} success${failCount > 0 ? `, ${failCount} failed` : ''}`,
        failCount === 0 ? 'success' : 'warning'
      );

      setSelectedTxIds(new Set());
      setSelectedSplitIds(new Set());
      await loadData();
    } catch (err) {
      showToast('Batch delete failed', 'error');
    } finally {
      setLoading(false);
      setBatchOperationProgress(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTxIds, selectedSplitIds, transactions, showToast]);

  const handleBatchApprove = useCallback(async () => {
    const totalCount = selectedTxIds.size + selectedSplitIds.size;
    if (totalCount === 0) return;

    if (!confirm(`Are you sure you want to approve ${totalCount} selected item(s)? Status will be set to 'Cleared'.`)) {
      return;
    }

    setLoading(true);
    setBatchOperationProgress({ current: 0, total: totalCount });
    let successCount = 0;
    let failCount = 0;

    try {
      const txResults = await Promise.all(
        Array.from(selectedTxIds).map(async (id) => {
          try {
            const tx = transactions.find(t => t.id === id);
            if (tx && tx.status !== 'Cleared') {
              await FinanceService.updateTransaction(id, { ...tx, status: 'Cleared' });
            }
            setBatchOperationProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null);
            return { success: true };
          } catch (err) {
            console.error(`Failed to approve transaction ${id}:`, err);
            setBatchOperationProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null);
            return { success: false };
          }
        })
      );

      const splitResults = Array.from(selectedSplitIds).map(() => {
        setBatchOperationProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null);
        return { success: true };
      });

      successCount = txResults.filter(r => r.success).length + splitResults.length;
      failCount = txResults.filter(r => !r.success).length;

      showToast(
        `Batch approve completed: ${successCount} success${failCount > 0 ? `, ${failCount} failed` : ''}`,
        failCount > 0 ? 'warning' : 'success'
      );
      setSelectedTxIds(new Set());
      setSelectedSplitIds(new Set());
      await loadData();
    } catch (err) {
      showToast('Batch approve failed', 'error');
    } finally {
      setLoading(false);
      setBatchOperationProgress(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTxIds, selectedSplitIds, transactions, showToast]);

  const loadPrPendingReconciliation = async () => {
    setPrReconcileLoading(true);
    try {
      const { items } = await PaymentRequestService.list({ pageSize: 200 });
      const approved = items.filter(pr => pr.status === 'approved');
      const linkedPrIds = new Set(
        transactions.filter(t => t.paymentRequestId && t.status === 'Reconciled').map(t => t.paymentRequestId!)
      );
      const pending = approved.filter(pr => !linkedPrIds.has(pr.id));
      setPrPendingReconciliation(pending);
      const bankExpenses = transactions.filter(t => t.source === 'bank_import' && t.type === 'Expense' && t.status !== 'Reconciled');
      const suggestions: Record<string, Transaction[]> = {};
      for (const pr of pending) {
        const prDate = new Date(pr.date || pr.createdAt);
        const prAmount = pr.totalAmount || pr.amount;
        suggestions[pr.id] = bankExpenses
          .filter(t => Math.abs(t.amount - prAmount) < 0.01 && Math.abs(new Date(t.date).getTime() - prDate.getTime()) <= 14 * 86400000)
          .sort((a, b) => Math.abs(new Date(a.date).getTime() - prDate.getTime()) - Math.abs(new Date(b.date).getTime() - prDate.getTime()));
      }
      setPrBankSuggestions(suggestions);
      const initial: Record<string, string> = {};
      for (const pr of pending) { if (suggestions[pr.id]?.[0]) initial[pr.id] = suggestions[pr.id][0].id; }
      setPrSelectedBankTx(initial);
    } catch (e) {
      showToast('Failed to load PR reconciliation data', 'error');
    } finally {
      setPrReconcileLoading(false);
    }
  };

  const handleLinkPrToBankTx = useCallback(async (prId: string) => {
    const bankTxId = prSelectedBankTx[prId];
    if (!bankTxId || !user?.uid) return;
    setPrLinkingId(prId);
    try {
      const bankTx = transactions.find(t => t.id === bankTxId);
      const expenseTx = transactions.find(t => t.paymentRequestId === prId && t.type === 'Expense');
      if (expenseTx?.id) {
        await FinanceService.matchTransactions(expenseTx.id, bankTxId, user.uid);
      } else {
        await FinanceService.updateTransaction(bankTxId, {
          paymentRequestId: prId,
          status: 'Reconciled',
          reconciledAt: new Date().toISOString(),
          reconciledBy: user.uid,
        });
      }
      // Mark PR as paid with the bank transaction date (情景 26)
      if (bankTx?.date) {
        await PaymentRequestService.markAsPaid(prId, bankTx.date);
      }
      showToast('PR linked to bank transaction', 'success');
      await loadData();
      await loadPrPendingReconciliation();
    } catch (e) {
      showToast('Failed to link', 'error');
    } finally {
      setPrLinkingId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prSelectedBankTx, user, transactions, showToast]);

  const handleReconciliationQuery = useCallback(async () => {
    const ref = refNumberQuery.trim();
    if (!ref) {
      showToast('Please enter a reference number', 'error');
      return;
    }
    setReconciliationLoading(true);
    try {
      const txMatch = transactions.filter((t) => (t.referenceNumber ?? '').trim() === ref);
      const { items: prItems } = await PaymentRequestService.list({ referenceNumber: ref, pageSize: 50 });
      setReconciliationTx(txMatch);
      setReconciliationPRs(prItems);
      if (txMatch.length === 0 && prItems.length === 0) showToast('No transactions or payment requests found for this reference number', 'info');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Search failed', 'error');
    } finally {
      setReconciliationLoading(false);
    }
  }, [refNumberQuery, transactions, showToast]);

  const handleMarkReconciled = useCallback(async (transactionId: string) => {
    if (!user?.uid) return;
    setReconcilingId(transactionId);
    try {
      await FinanceService.updateTransaction(transactionId, {
        status: 'Reconciled',
        reconciledAt: new Date().toISOString(),
        reconciledBy: user.uid,
      });
      showToast('Marked as reconciled', 'success');
      await loadData();
      setReconciliationTx((prev) => prev.map((t) => (t.id === transactionId ? { ...t, status: 'Reconciled' as const } : t)));
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Operation failed', 'error');
    } finally {
      setReconcilingId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, showToast]);

  const handleUpdateTransaction = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingTransaction) return;

    const formData = new FormData(e.currentTarget);
    const category = editingTransaction.category;

    const description = (formData.get('description') as string) || editingTransaction.description;
    const amountStr = formData.get('amount') as string;
    const amount = amountStr ? parseFloat(amountStr) : editingTransaction.amount;
    const type = (formData.get('type') as 'Income' | 'Expense') || editingTransaction.type;
    const date = (formData.get('date') as string) || editingTransaction.date;
    const bankAccountId = formData.has('bankAccountId') ? (formData.get('bankAccountId') as string)?.trim() || undefined : editingTransaction.bankAccountId;
    const referenceNumber = formData.has('referenceNumber') ? (formData.get('referenceNumber') as string)?.trim() || null : editingTransaction.referenceNumber;
    const paymentRequestId = formData.has('paymentRequestId') ? (formData.get('paymentRequestId') as string)?.trim() || null : editingTransaction.paymentRequestId;

    const rules = category === 'Membership' ? await MembershipConfigService.getRules() : undefined;
    const memberIdInput = formData.has('memberId')
      ? (formData.get('memberId') as string)?.trim() || undefined
      : editingTransaction.memberId;
    const projectIdInput = formData.has('projectId')
      ? (formData.get('projectId') as string)?.trim() || undefined
      : editingTransaction.projectId;
    // Administrative: form field is the base part (year prefix added by buildCategoryFields)
    const adminPurposeBase = formData.has('purpose')
      ? (formData.get('purpose') as string)?.trim() || ''
      : editingAdministrativePurposeBase;
    // P&A: form field is the full purpose string
    const paPurpose = formData.has('purpose')
      ? (formData.get('purpose') as string)?.trim() || undefined
      : editingTransaction.purpose;

    const catFields = buildCategoryFields({
      category,
      amount,
      year: category === 'Membership' ? editingMembershipYear : editingAdministrativeYear,
      memberId: memberIdInput,
      projectId: projectIdInput,
      purposeBase: category === 'Administrative' ? adminPurposeBase : undefined,
      purpose: category === 'Projects & Activities' ? paPurpose : undefined,
      rules,
    });

    const projectIdVal: string | undefined = catFields.projectId ?? editingTransaction.projectId;
    const purposeVal: string | undefined = catFields.purpose ?? editingTransaction.purpose;
    const memberIdVal: string | undefined = catFields.memberId ?? editingTransaction.memberId;

    const updatedTransaction: Partial<Transaction> = {
      date,
      description,
      purpose: purposeVal,
      amount,
      type,
      category,
      projectId: projectIdVal,
      memberId: memberIdVal,
      bankAccountId,
      referenceNumber,
      paymentRequestId,
      inventoryLinkId: formData.has('inventoryLinkId') ? (formData.get('inventoryLinkId') as string) : null,
      inventoryVariant: formData.has('inventoryVariant') ? (formData.get('inventoryVariant') as string) : null,
      inventoryQuantity: formData.has('inventoryQuantity') ? parseInt(formData.get('inventoryQuantity') as string || '0', 10) : null,
    };

    try {
      await FinanceService.updateTransaction(editingTransaction.id, updatedTransaction);
      showToast('Transaction updated successfully', 'success');
      setIsEditModalOpen(false);
      setEditingTransaction(null);
      setEditingMembershipFilterYear(null);
      setEditingMembershipMemberId('');
      setEditingMembershipYear(new Date().getFullYear());
      await loadData();
    } catch (err) {
      showToast('Failed to update transaction', 'error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingTransaction, editingMembershipYear, editingAdministrativeYear, editingAdministrativePurposeBase, showToast]);

  // ── Return all state + computed + handlers ────────────────────────────────

  return {
    // auth / permissions (also used in JSX)
    showToast,
    hasPermission,
    isDeveloper,
    user,

    // core data
    transactions, setTransactions,
    accounts, setAccounts,
    loading, setLoading,
    error, setError,
    summary, setSummary,
    projects, setProjects,
    members, setMembers,
    inventoryItems, setInventoryItems,
    transactionSplits, setTransactionSplits,
    historicalNetFlows, setHistoricalNetFlows,
    allTransactionYears, setAllTransactionYears,

    // modal / drawer toggles
    isModalOpen, setIsModalOpen,
    isImportModalOpen, setIsImportModalOpen,
    isReportsModalOpen, setIsReportsModalOpen,
    isDuesRenewalModalOpen, setIsDuesRenewalModalOpen,
    isAddAccountModalOpen, setIsAddAccountModalOpen,
    isSplitModalOpen, setIsSplitModalOpen,
    isEditModalOpen, setIsEditModalOpen,
    isAccountDetailOpen, setIsAccountDetailOpen,
    isBatchCategoryModalOpen, setIsBatchCategoryModalOpen,
    isAddAdministrativeProjectOpen, setIsAddAdministrativeProjectOpen,
    isProjectTrxModalOpen, setIsProjectTrxModalOpen,

    // report / filter state
    reportType, setReportType,
    reportYear, setReportYear,
    reportMonth, setReportMonth,
    fiscalYearStart, setFiscalYearStart,
    selectedProjectFilter, setSelectedProjectFilter,
    moduleTab, setModuleTab,
    txSearchTerm, setTxSearchTerm,
    debouncedSearchTerm,
    txCategoryFilter, setTxCategoryFilter,
    bankAccountFilter, setBankAccountFilter,
    txTypeFilter, setTxTypeFilter,
    txStatusFilter, setTxStatusFilter,
    transactionLimit, setTransactionLimit,
    txFiltersOpen, setTxFiltersOpen,

    // editing state
    selectedTransaction, setSelectedTransaction,
    editingTransaction, setEditingTransaction,
    editingModalYear, setEditingModalYear,
    editingMembershipFilterYear, setEditingMembershipFilterYear,
    editingMembershipMemberId, setEditingMembershipMemberId,
    editingMembershipYear, setEditingMembershipYear,
    editingAdministrativeYear, setEditingAdministrativeYear,
    editingAdministrativePurposeBase, setEditingAdministrativePurposeBase,
    editingProjectYear, setEditingProjectYear,
    editingProjectPurpose, setEditingProjectPurpose,
    editingProjectPurposesByProject, setEditingProjectPurposesByProject,
    editingAdminPurposes, setEditingAdminPurposes,
    editingAdminAccounts, setEditingAdminAccounts,

    // project accounts
    projectAccounts, setProjectAccounts,
    projectTrackerSummary, setProjectTrackerSummary,
    loadingProjectAccounts, setLoadingProjectAccounts,
    projectAccountYearFilter, setProjectAccountYearFilter,
    adminAccountYearFilter, setAdminAccountYearFilter,
    projectPurposes, setProjectPurposes,

    // account detail
    matchingAccount, setMatchingAccount,
    detailAccount, setDetailAccount,
    detailYear, setDetailYear,
    detailAccountYears, setDetailAccountYears,

    // reconciliation
    refNumberQuery, setRefNumberQuery,
    reconciliationTx, setReconciliationTx,
    reconciliationPRs, setReconciliationPRs,
    reconciliationLoading, setReconciliationLoading,
    reconcilingId, setReconcilingId,
    prPendingReconciliation, setPrPendingReconciliation,
    prReconcileLoading, setPrReconcileLoading,
    prBankSuggestions, setPrBankSuggestions,
    prSelectedBankTx, setPrSelectedBankTx,
    prLinkingId, setPrLinkingId,

    // record form
    addDefaultCategory, setAddDefaultCategory,
    recordFormCategory, setRecordFormCategory,
    recordFormMemberId, setRecordFormMemberId,
    recordFormYear, setRecordFormYear,
    recordFormProjectId, setRecordFormProjectId,
    uncompletedPRs, setUncompletedPRs,

    // dues renewal
    renewalYear, setRenewalYear,
    duesAmount, setDuesAmount,
    isRenewing, setIsRenewing,

    // admin
    administrativeProjectIds, setAdministrativeProjectIds,
    adminProjectIdFilter, setAdminProjectIdFilter,
    dynamicAdministrativeProjectIds,

    // batch
    selectedTxIds, setSelectedTxIds,
    selectedSplitIds, setSelectedSplitIds,
    batchOperationProgress, setBatchOperationProgress,

    // project trx modal
    projectTrxLoading, setProjectTrxLoading,
    projectTrxList, setProjectTrxList,
    projectTrxAddForm, setProjectTrxAddForm,
    projectTrxEditingId, setProjectTrxEditingId,
    projectTrxEditForm, setProjectTrxEditForm,

    // selected project transactions
    selectedProjectTransactions, setSelectedProjectTransactions,
    loadingSelectedProjectTransactions,

    // computed memos
    selectedProjectInfo,
    adminAccountYearOptions,
    availableYears,
    monthlyAccountSummary,
    projectTransactions,
    membershipTransactions,
    administrativeTransactions,
    uncategorizedProjectTxCount,
    projectAccountYearOptions,
    filteredProjectAccounts,
    projectYears,
    filteredProjectsForModal,
    groupedProjectsForModal,
    displayTransactions,
    visibleTransactions,
    groupedTransactions,
    hasMoreTransactions,
    dashboardStats,

    // helper wrappers (used in JSX)
    isTransactionInCategory,
    getLinkedBankTxInfo,
    getTransactionAccountLabel,

    // loaders
    loadData,
    loadProjectAccounts,
    loadProjects,
    loadMembers,
    loadPrPendingReconciliation,
    loadProjectTrxList,

    // handlers
    handleAddTransaction,
    handleSendReminders,
    handleEditTransaction,
    handleDeleteTransaction,
    handleBatchDelete,
    handleBatchApprove,
    handleLinkPrToBankTx,
    handleReconciliationQuery,
    handleMarkReconciled,
    handleUpdateTransaction,
    handleSelectAllTransactions,
    handleAddProjectTrx,
    handleUpdateProjectTrx,
    handleDeleteProjectTrx,
    handleProjectTrxPaste,
  };
}
