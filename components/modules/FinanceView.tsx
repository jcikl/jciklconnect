import React, { useState, useEffect, useMemo } from 'react';
import { DollarSign, PieChart, ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle, FileText, Plus, X, Download, Calendar, TrendingUp, TrendingDown, BarChart3, CheckCircle, AlertTriangle, Edit, Trash2, Briefcase, Upload, Layers, Settings, Search, Link2, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { Card, Button, Badge, ProgressBar, StatCard, StatCardsContainer, Modal, useToast, Tabs, Drawer } from '../ui/Common';
import { Input, Select } from '../ui/Form';
import { Combobox } from '../ui/Combobox';
import { LoadingState } from '../ui/Loading';
import { FinanceService } from '../../services/financeService';
import { PaymentRequestService } from '../../services/paymentRequestService';
import { formatCurrency } from '../../utils/formatUtils';
import { formatDate } from '../../utils/dateUtils';
import { Transaction, BankAccount, ProjectFinancialAccount, TransactionSplit, InventoryItem } from '../../types';
import type { PaymentRequest } from '../../types';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../hooks/useAuth';
import { TransactionSplitModal } from './Finance/TransactionSplitModal';
import { DuesRenewalDashboard } from './Finance/DuesRenewalDashboard';
import TransactionForm from './Finance/TransactionForm';
import BankTransactionImportModal from './Finance/BankTransactionImportModal';
import { BankMatchingModal } from './Finance/BankMatchingModal';
import { BatchCategoryModal } from './Finance/BatchCategoryModal';
import { FirstUseBanner } from '../ui/FirstUseBanner';
import { projectFinancialService } from '../../services/projectFinancialService';
import { ProjectsService } from '../../services/projectsService';
import { useHelpModal } from '../../contexts/HelpModalContext';
import { MembersService } from '../../services/membersService';
import { MembershipConfigService, resolveMembershipPurpose } from '../../services/membershipConfigService';
import { getAdministrativeProjectIds, addAdministrativeProjectId } from '../../utils/administrativeProjectsStorage';
import { InventoryService } from '../../services/inventoryService';
import { ADMINISTRATIVE_PURPOSES } from '../../config/constants';
import type { Project, MembershipType } from '../../types';
import { useBatchMode } from '../../contexts/BatchModeContext';

const UNASSIGNED_PROJECT_ID = 'UNASSIGNED_PROJECT'; // Consistent internal ID for uncategorized projects

export const FinanceView: React.FC<{ searchQuery?: string }> = ({ searchQuery }) => {
  const helpModal = useHelpModal();
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
  const [fiscalYearStart, setFiscalYearStart] = useState<number>(0); // 0 = Calendar Year (Jan), 3 = Fiscal Year (Apr), etc.
  const [summary, setSummary] = useState<{
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    byCategory: Record<string, { income: number; expenses: number }>;
  } | null>(null);
  const [isDuesRenewalModalOpen, setIsDuesRenewalModalOpen] = useState(false);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [matchingAccount, setMatchingAccount] = useState<import('../../types').BankAccount | null>(null);
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
  const [transactionLimit, setTransactionLimit] = useState(50); // Initial display limit
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
  // PR reconciliation panel
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

  const selectedProjectInfo = useMemo(() => {
    if (!selectedProjectFilter || selectedProjectFilter === UNASSIGNED_PROJECT_ID) return null;
    return projects.find(p => p.id === selectedProjectFilter) || null;
  }, [selectedProjectFilter, projects]);

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

  const handleAddProjectTrx = async () => {
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
  };

  const handleUpdateProjectTrx = async (id: string) => {
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
  };

  const handleDeleteProjectTrx = async (id: string) => {
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
  };

  const handleProjectTrxPaste = async (pastedText: string) => {
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

        // If row has a description but no amount in either column, it's a Purpose header
        if (description && !incomeStr && !expenseStr) {
          dynamicPurpose = description;
          continue;
        }

        const amount = incomeAmount > 0 ? incomeAmount : expenseAmount;
        if (!description || !amount) continue;

        let txType: 'Income' | 'Expense' = 'Expense';
        if (incomeAmount > 0) txType = 'Income';
        else if (expenseAmount > 0) txType = 'Expense';

        // Check 5th column for date. If empty, dateStr will be '' representing unpaid payment request.
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
  };

  const getLinkedBankTxInfo = (projectTxId: string) => {
    // 1. Search in main transactions
    const directTx = transactions.find(bt =>
      (bt.projectTransactionIds && bt.projectTransactionIds.includes(projectTxId)) ||
      bt.projectTransactionId === projectTxId
    );
    if (directTx) {
      const bankAccountName = accounts.find(a => a.id === directTx.bankAccountId)?.name || 'Bank';
      return {
        date: directTx.date,
        description: directTx.description,
        amount: directTx.amount,
        type: directTx.type,
        bankAccountName,
        isSplit: false
      };
    }

    // 2. Search in splits
    let matchedSplit: TransactionSplit | undefined;
    let parentTxId: string | undefined;
    for (const [pId, splits] of Object.entries(transactionSplits)) {
      const found = splits.find(s =>
        (s.projectTransactionIds && s.projectTransactionIds.includes(projectTxId)) ||
        s.projectTransactionId === projectTxId
      );
      if (found) {
        matchedSplit = found;
        parentTxId = pId;
        break;
      }
    }

    if (matchedSplit && parentTxId) {
      const parentTx = transactions.find(t => t.id === parentTxId);
      const bankAccountName = accounts.find(a => a.id === parentTx?.bankAccountId)?.name || 'Bank';
      return {
        date: parentTx?.date || '',
        description: matchedSplit.description || parentTx?.description || '',
        amount: matchedSplit.amount,
        type: parentTx?.type || 'Expense',
        bankAccountName,
        isSplit: true
      };
    }

    return null;
  };



  const isTransactionInCategory = (tx: Transaction, category: string): boolean => {
    if (tx.category === category) return true;
    if (tx.isSplit && transactionSplits[tx.id]) {
      return transactionSplits[tx.id].some(split => split.category === category);
    }
    return false;
  };

  const [projectPurposes, setProjectPurposes] = useState<string[]>([]);
  const [projectAccountYearFilter, setProjectAccountYearFilter] = useState<number>(new Date().getFullYear()); // Default to current year
  const [adminAccountYearFilter, setAdminAccountYearFilter] = useState<number>(new Date().getFullYear());

  const adminAccountYearOptions = useMemo(() => {
    const years = new Set<number>();
    transactions.forEach(t => {
      if (isTransactionInCategory(t, 'Administrative')) {
        years.add(new Date(t.date).getFullYear());
      }
    });
    // Ensure current year is always an option
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions, transactionSplits]);
  // Batch category editing state
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [selectedSplitIds, setSelectedSplitIds] = useState<Set<string>>(new Set());
  const { setIsBatchMode } = useBatchMode();

  useEffect(() => {
    setIsBatchMode((selectedTxIds.size + selectedSplitIds.size) > 1);
    return () => setIsBatchMode(false);
  }, [selectedTxIds.size, selectedSplitIds.size, setIsBatchMode]);
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

    // Filter for only parent transactions (exclude split children to avoid double counting)
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

      return {
        month: m,
        openingBalance,
        income,
        expenses,
        closingBalance
      };
    });
  }, [detailAccount, detailYear, transactions, historicalNetFlows]);

  const { showToast } = useToast();
  const { hasPermission, isDeveloper } = usePermissions();
  const { user } = useAuth();

  const getTransactionAccountLabel = (
    item: Partial<Transaction | TransactionSplit>,
    parent?: Partial<Transaction>
  ) => {
    const category = item.category || parent?.category || '';
    const projectId = item.projectId || parent?.projectId || '';
    const memberId = item.memberId || parent?.memberId || '';
    const bankAccountId = ('bankAccountId' in item ? item.bankAccountId : undefined) || parent?.bankAccountId || '';
    const bankAccountName = accounts.find(a => a.id === bankAccountId)?.name;

    if (category === 'Projects & Activities') {
      if (projectId === UNASSIGNED_PROJECT_ID) return 'Unassigned';

      return projectAccounts.find(a => a.projectId === projectId || a.id === projectId)?.projectName
        || projects.find(p => p.id === projectId)?.name
        || projects.find(p => p.id === projectId)?.title
        || projectId
        || bankAccountName
        || '—';
    }

    if (category === 'Administrative') {
      return projectId || bankAccountName || '—';
    }

    if (category === 'Membership') {
      return members.find(m => m.id === memberId)?.name || bankAccountName || '—';
    }

    return bankAccountName || projectId || memberId || '—';
  };

  const projectTransactions = useMemo(() => {
    // Filter for Projects & Activities category
    // Exclude split parent transactions (isSplit=true), include unsplit and split children
    const pt = transactions.filter(tx => {
      // Must be Projects & Activities category
      if (!isTransactionInCategory(tx, 'Projects & Activities')) return false;

      // Exclude split parent transactions
      if (tx.isSplit && tx.splitIds && tx.splitIds.length > 0) return false;

      return true;
    });

    // Also include split child transactions from transactionSplits
    const splitChildren: Transaction[] = [];
    Object.entries(transactionSplits).forEach(([parentId, splits]) => {
      const parentTx = transactions.find(t => t.id === parentId);
      splits.forEach(split => {
        if (split.category === 'Projects & Activities') {
          // Create a Transaction-like object from the split
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
    if (selectedProjectFilter === UNASSIGNED_PROJECT_ID) { // '未设定'
      return allPt.filter(tx => tx.projectId === null || tx.projectId === '');
    }
    return allPt.filter(tx => tx.projectId === selectedProjectFilter);
  }, [transactions, selectedProjectFilter, transactionSplits]);

  // Debugging Project Account Production Data
  const uncategorizedProjectTxCount = useMemo(() => {
    return transactions.filter(tx => isTransactionInCategory(tx, 'Projects & Activities') && (tx.projectId === null || tx.projectId === '')).length;
  }, [transactions, transactionSplits]);

  // Get unique years from approved projects for the project account year filter
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
    // Ensure current year is always an option
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [projects]);

  // Filter project accounts by selected year
  const filteredProjectAccounts = useMemo(() => {
    if (projectAccountYearFilter === 0) return projectAccounts; // All years

    return projectAccounts.filter(acc => {
      const project = projects.find(p => p.id === acc.projectId);
      if (!project) return false;

      const pDate = project.eventStartDate || project.startDate || project.date || project.proposedDate || project.createdAt || project.updatedAt;
      if (!pDate) return false;

      const pYear = new Date(pDate).getFullYear();
      return pYear === projectAccountYearFilter;
    });
  }, [projectAccounts, projectAccountYearFilter, projects]);

  // Get unique years from projects for the split modal year filter
  const projectYears = useMemo(() => {
    const years = new Set<number>();
    const currentYear = new Date().getFullYear();
    years.add(currentYear); // Always include current year

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

  // Get dynamic admin accounts from defaults + existing transactions
  const dynamicAdministrativeProjectIds = useMemo(() => {
    const defaultIds = administrativeProjectIds;
    const txProjectIds = transactions
      .filter(t => isTransactionInCategory(t, 'Administrative') && t.projectId && t.projectId.trim() !== '')
      .map(t => t.projectId!.trim());

    // Combine and remove duplicates
    const combined = Array.from(new Set([...defaultIds, ...txProjectIds]));
    return combined.sort((a, b) => a.localeCompare(b));
  }, [administrativeProjectIds, transactions]);

  const displayTransactions = useMemo(() => {
    // 1. Filter transactions based on active UI filters
    const filtered = transactions.filter(tx => {
      // Category filter
      if (txCategoryFilter === 'All') {
        // Keep all
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

      // Bank account filter
      if (bankAccountFilter !== 'All' && tx.bankAccountId !== bankAccountFilter) {
        return false;
      }

      // Search term (Multi-keyword fuzzy search)
      const termToUse = searchQuery || debouncedSearchTerm;
      if (termToUse) {
        const terms = termToUse.toLowerCase().split(/\s+/).filter(t => t !== '');

        // Every term must match at least one field (AND logic across terms)
        const isMatch = terms.every(term => {
          // 1. Basic fields from parent transaction
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

          const parentMatch = parentFields.some(field => field.includes(term));
          if (parentMatch) return true;

          // 2. Search in splits if applicable
          const splitMatch = transactionSplits[tx.id]?.some(s =>
            s.category.toLowerCase().includes(term) ||
            s.description.toLowerCase().includes(term) ||
            s.purpose?.toLowerCase().includes(term) ||
            String(s.amount).includes(term) ||
            (projects.find(p => p.id === s.projectId)?.name || '').toLowerCase().includes(term)
          );

          return splitMatch;
        });

        if (!isMatch) return false;
      }

      return true;
    });

    // 2. Sort by date Ascending (Oldest -> Newest) to calculate cumulative sum
    const sorted = [...filtered].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 3. Calculate running balance
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

    // 4. Sort Newest -> Oldest for display and Apply limit
    const totalTransactions = [...withBalance].reverse();
    return totalTransactions.slice(0, transactionLimit);
  }, [transactions, txCategoryFilter, debouncedSearchTerm, bankAccountFilter, accounts, transactionSplits, transactionLimit, historicalNetFlows]);

  // Apply type + status quick-filters on top of displayTransactions (balance calc is preserved)
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
    // We need to know if there are more than current limit
    // To be efficient, we calculate this based on the filtered count
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

  const handleSelectAllTransactions = React.useCallback(() => {
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
      setDebouncedSearchTerm(txSearchTerm);
      setTransactionLimit(50); // Reset limit on search
    }, 400);
    return () => clearTimeout(handler);
  }, [txSearchTerm]);

  useEffect(() => {
    loadData(reportYear);
  }, [reportYear]);

  const loadProjectAccounts = async (year: number = projectAccountYearFilter) => {
    setLoadingProjectAccounts(true);
    try {
      const [list, ptTrx] = await Promise.all([
        projectFinancialService.getAllProjectAccounts(year),
        projectFinancialService.getAllProjectTrackerTransactions()
      ]);
      setProjectAccounts(list);

      // Aggregate PT transactions by project
      const ptSummary: Record<string, { income: number; expenses: number }> = {};
      ptTrx.forEach(tx => {
        const pid = tx.projectId;
        if (!pid) return; // Skip if no project ID (though unlikely for projectTrx)

        if (!ptSummary[pid]) {
          ptSummary[pid] = { income: 0, expenses: 0 };
        }

        const type = (tx.type || '').toLowerCase();
        const amount = Math.abs(tx.amount || 0);

        if (type === 'income') {
          ptSummary[pid].income += amount;
        } else {
          // Fallback: assume expense for any other type or if type is missing but amount exists
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

  useEffect(() => {
    if (moduleTab === 'Project Account') {
      loadProjectAccounts(projectAccountYearFilter);
    }
  }, [moduleTab, projectAccountYearFilter]);

  useEffect(() => {
    setDetailYear(reportYear);
  }, [reportYear]);

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
        // Filter for uncompleted (submitted/draft)
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
        const accounts = new Set<string>();

        const allTx = await FinanceService.getAllTransactions();
        allTx.forEach(t => {
          if (t.category === 'Administrative') {
            if (t.purpose) {
              purposes.add(t.purpose);
            }
            if (t.projectId) {
              accounts.add(t.projectId);
            }
          }
        });

        // Also include from stored administrativeProjectIds
        administrativeProjectIds.forEach(id => accounts.add(id));

        setEditingAdminPurposes(Array.from(purposes).sort());
        setEditingAdminAccounts(Array.from(accounts).sort());
      } catch (e) {
        console.error('Failed to load admin purposes', e);
      }
    };

    loadAdminPurposes();
  }, [isEditModalOpen, editingTransaction?.category]);

  const loadData = async (targetYear: number = reportYear) => {
    try {
      setLoading(true);
      setError(null);
      const [txs, accts, summ, inventory, projList, memberList, histFlows, allYears] = await Promise.all([
        FinanceService.getAllTransactions(targetYear),
        FinanceService.getAllBankAccounts(),
        FinanceService.getFinancialSummary(targetYear),
        InventoryService.getAllItems(),
        ProjectsService.getAllProjects(),
        MembersService.getAllMembers(),
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

      const mappedMembers = memberList.map(m => ({
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
      })).sort((a, b) => a.name.localeCompare(b.name));
      setMembers(mappedMembers);

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
          const txs = await FinanceService.getBankTransactionsByProject(selectedProjectFilter);
          setSelectedProjectTransactions(txs);
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

  const handleAddTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const category = formData.get('category') as Transaction['category'];

    try {
      setLoading(true);
      let projectId: string | undefined;
      let purpose: string | undefined;
      let memberId: string | undefined;

      if (category === 'Membership') {
        memberId = (formData.get('memberId') as string)?.trim() || undefined;
        const year = parseInt((formData.get('year') as string) || String(new Date().getFullYear()), 10);
        projectId = `${year} membership`;
        const amount = parseFloat(formData.get('amount') as string) || 0;
        const rules = await MembershipConfigService.getRules();
        purpose = resolveMembershipPurpose(amount, year, rules);
      } else {
        projectId = (formData.get('projectId') as string)?.trim() || undefined;
        purpose = (formData.get('purpose') as string)?.trim() || undefined;
      }

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
  };

  const handleSendReminders = () => {
    showToast('32 Payment reminders sent via Email & Push', 'success');
  }

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    const txYear = new Date(transaction.date).getFullYear();
    setEditingModalYear(String(txYear));

    // Ensure members are loaded when editing a Membership transaction
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
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) {
      return;
    }

    try {
      // If it's a split transaction, we should also delete its splits
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
  };

  const handleBatchDelete = async () => {
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
      // 1. Delete main transactions in parallel
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

      // 2. Delete individual splits in parallel
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
  };

  const handleBatchApprove = async () => {
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
      // 1. Approve main transactions
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

      // 2. Clear individual splits in progress tracking (they don't have separate status in types)
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
  };

  // Load approved PRs that don't yet have a linked bank transaction
  const loadPrPendingReconciliation = async () => {
    setPrReconcileLoading(true);
    try {
      const { items } = await PaymentRequestService.list({ pageSize: 200 });
      const approved = items.filter(pr => pr.status === 'approved');
      // Find which ones already have a matching expense transaction with paymentRequestId
      const linkedPrIds = new Set(
        transactions.filter(t => t.paymentRequestId && t.status === 'Reconciled').map(t => t.paymentRequestId!)
      );
      const pending = approved.filter(pr => !linkedPrIds.has(pr.id));
      setPrPendingReconciliation(pending);
      // Build auto-suggestions: bank_import expense txs within ±14 days with same amount
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
      // Pre-select first suggestion
      const initial: Record<string, string> = {};
      for (const pr of pending) { if (suggestions[pr.id]?.[0]) initial[pr.id] = suggestions[pr.id][0].id; }
      setPrSelectedBankTx(initial);
    } catch (e) {
      showToast('Failed to load PR reconciliation data', 'error');
    } finally {
      setPrReconcileLoading(false);
    }
  };

  // Link an approved PR's expense transaction to a bank import transaction
  const handleLinkPrToBankTx = async (prId: string) => {
    const bankTxId = prSelectedBankTx[prId];
    if (!bankTxId || !user?.uid) return;
    setPrLinkingId(prId);
    try {
      // Find the expense transaction for this PR (auto-created on approval)
      const expenseTx = transactions.find(t => t.paymentRequestId === prId && t.type === 'Expense');
      if (expenseTx?.id) {
        // Link expense tx to bank tx
        await FinanceService.matchTransactions(expenseTx.id, bankTxId, user.uid);
      } else {
        // No auto-created tx yet — just mark bank tx as reconciled and tag it
        await FinanceService.updateTransaction(bankTxId, {
          paymentRequestId: prId,
          status: 'Reconciled',
          reconciledAt: new Date().toISOString(),
          reconciledBy: user.uid,
        });
      }
      showToast('PR linked to bank transaction', 'success');
      await loadData();
      await loadPrPendingReconciliation();
    } catch (e) {
      showToast('Failed to link', 'error');
    } finally {
      setPrLinkingId(null);
    }
  };

  const handleReconciliationQuery = async () => {
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
  };

  const handleMarkReconciled = async (transactionId: string) => {
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
  };

  const handleUpdateTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingTransaction) return;

    const formData = new FormData(e.currentTarget);
    const category = editingTransaction.category; // Category is not changed in edit modal or is handled via state

    // Common fields with fallback to existing values if form fields are missing/empty
    const description = (formData.get('description') as string) || editingTransaction.description;
    const amountStr = formData.get('amount') as string;
    const amount = amountStr ? parseFloat(amountStr) : editingTransaction.amount;
    const type = (formData.get('type') as 'Income' | 'Expense') || editingTransaction.type;
    const date = (formData.get('date') as string) || editingTransaction.date;
    const bankAccountId = formData.has('bankAccountId') ? (formData.get('bankAccountId') as string)?.trim() || undefined : editingTransaction.bankAccountId;
    const referenceNumber = formData.has('referenceNumber') ? (formData.get('referenceNumber') as string)?.trim() || null : editingTransaction.referenceNumber;
    const paymentRequestId = formData.has('paymentRequestId') ? (formData.get('paymentRequestId') as string)?.trim() || null : editingTransaction.paymentRequestId;

    let projectIdVal: string | undefined = editingTransaction.projectId;
    let purposeVal: string | undefined = editingTransaction.purpose;
    let memberIdVal: string | undefined = editingTransaction.memberId;

    if (category === 'Membership') {
      memberIdVal = formData.has('memberId') ? (formData.get('memberId') as string)?.trim() || undefined : editingTransaction.memberId;
      const year = editingMembershipYear;
      projectIdVal = `${year} membership`;
      const rules = await MembershipConfigService.getRules();
      purposeVal = resolveMembershipPurpose(amount, year, rules);
    } else if (category === 'Administrative') {
      projectIdVal = formData.has('projectId') ? (formData.get('projectId') as string)?.trim() || undefined : editingTransaction.projectId;
      const year = editingAdministrativeYear;
      const purposeBase = formData.has('purpose') ? (formData.get('purpose') as string)?.trim() || '' : editingAdministrativePurposeBase;
      purposeVal = purposeBase ? `${year} ${purposeBase}` : editingTransaction.purpose;
    } else {
      // For 'Projects & Activities' and other generic categories
      projectIdVal = formData.has('projectId') ? (formData.get('projectId') as string)?.trim() || undefined : editingTransaction.projectId;
      purposeVal = formData.has('purpose') ? (formData.get('purpose') as string)?.trim() || undefined : editingTransaction.purpose;
    }

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

      // If the 'inventoryLinkId' field is NOT present in formData, it means the section was hidden (unchecked)
      // So we should explicitly set them to null (or empty string/undefined depending on backend logic)
      // to trigger the "Linkage removed" logic in FinanceService.
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
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Financial Management</h2>
          <p className="text-slate-500 text-sm">Bookkeeping · dues collection · budgeting</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-28 shrink-0">
            <Select
              value={reportYear.toString()}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setReportYear(val);
                setProjectAccountYearFilter(val);
              }}
              options={[
                { label: 'All Years', value: '0' },
                ...allTransactionYears.map(y => ({ label: y.toString(), value: y.toString() }))
              ]}
            />
          </div>
          {/* Secondary actions: icon-only on mobile, text+icon on sm+ */}
          <Button variant="outline" size="sm" onClick={() => setIsReportsModalOpen(true)} title="Reports" className="px-2 sm:px-3">
            <FileText size={14} className="sm:mr-1.5" /><span className="hidden sm:inline">Reports</span>
          </Button>
          {hasPermission('canEditFinance') && (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsDuesRenewalModalOpen(true)} title="Renew Dues" className="px-2 sm:px-3">
                <Calendar size={14} className="sm:mr-1.5" /><span className="hidden sm:inline">Renew Dues</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsImportModalOpen(true)} title="Batch Import" className="px-2 sm:px-3">
                <Upload size={14} className="sm:mr-1.5" /><span className="hidden sm:inline">Batch Import</span>
              </Button>
            </>
          )}
          <Button onClick={() => { setAddDefaultCategory(null); setRecordFormCategory('Projects & Activities'); setIsModalOpen(true); }}>
            <DollarSign size={16} className="mr-2" /><span className="hidden xs:inline">New </span>Transaction
          </Button>
        </div>
      </div>

      <div className="px-4 md:px-6">
        <Tabs
          tabs={['Dashboard', 'Transactions', 'Project Account', 'Membership', 'Administrative', 'Reconciliation']}
          activeTab={moduleTab}
          onTabChange={setModuleTab}
        />
      </div>

      {moduleTab === 'Dashboard' && (
        <div className="space-y-6">
          {/* KPI strip */}
          <LoadingState loading={loading} error={error}>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Total Cash */}
              <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-jci-navy to-jci-blue rounded-xl p-4 text-white shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Total Cash on Hand</p>
                <p className="text-2xl font-bold mt-1 tabular-nums">{formatCurrency(dashboardStats.totalCash, accounts[0]?.currency || 'MYR')}</p>
                <p className="text-xs text-white/60 mt-1">Across {accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
                {summary && (
                  <div className="mt-2 flex gap-3 border-t border-white/20 pt-2">
                    <span className="text-[10px] text-green-300 font-mono tabular-nums">↑ {formatCurrency(summary.totalIncome)}</span>
                    <span className="text-[10px] text-red-300 font-mono tabular-nums">↓ {formatCurrency(summary.totalExpenses)}</span>
                  </div>
                )}
              </div>
              {/* Net Balance */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Net Balance</p>
                <p className={`text-xl font-bold mt-1 leading-tight tabular-nums ${summary && summary.netBalance >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                  {summary ? formatCurrency(summary.netBalance) : '—'}
                </p>
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                    <span className="text-[10px] text-slate-400 font-mono tabular-nums truncate">{summary ? formatCurrency(summary.totalIncome) : '—'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                    <span className="text-[10px] text-slate-400 font-mono tabular-nums truncate">{summary ? formatCurrency(summary.totalExpenses) : '—'}</span>
                  </div>
                </div>
              </div>
              {/* Pending */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 cursor-pointer hover:border-amber-300 hover:bg-amber-50/30 transition-colors" onClick={() => setModuleTab('Transactions')}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Pending Txs</p>
                <p className="text-2xl font-bold text-amber-500 mt-1 tabular-nums">{dashboardStats.pendingCount}</p>
                <p className="text-[10px] text-slate-400 mt-1">{dashboardStats.pendingExpensesCount} exp. need review</p>
              </div>
            </div>
          </LoadingState>

          <div className="grid md:grid-cols-3 gap-6 min-w-0">
            {/* Main Content: Transactions — order-2 on mobile so Bank Accounts appears first */}
            <div className="md:col-span-2 space-y-6 order-2 md:order-1 min-w-0">
              <Card
                title="Recent Transactions"
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setModuleTab('Transactions')}
                  >
                    View All
                  </Button>
                }
              >
                <LoadingState loading={loading} error={error} empty={transactions.length === 0} emptyMessage="No transactions found">
                  <>
                    {/* Desktop View */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            <th className="pb-3 font-semibold pl-2">Date</th>
                            <th className="pb-3 font-semibold">Description</th>
                            <th className="pb-3 font-semibold">Category</th>
                            <th className="pb-3 font-semibold text-right pr-2">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transactions.slice(0, 10).map(tx => (
                            <tr key={tx.id} className="hover:bg-slate-50">
                              <td className="py-3 pl-2 text-slate-500">{formatDate(tx.date)}</td>
                              <td className="py-3 font-medium text-slate-900">
                                {tx.description}
                                {tx.status === 'Pending' && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-amber-400"></span>}
                              </td>
                              <td className="py-3">
                                <Badge variant="neutral">{tx.category}</Badge>
                              </td>
                              <td className={`py-3 text-right pr-2 font-mono font-medium ${tx.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                                {tx.type === 'Income' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile View */}
                    <div className="md:hidden space-y-2">
                      {transactions.slice(0, 8).map(tx => (
                        <div key={tx.id} className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm flex">
                          <div className={`w-1 shrink-0 ${tx.type === 'Income' ? 'bg-green-400' : 'bg-red-400'}`} />
                          <div className="flex-1 px-3 py-2.5">
                            <div className="flex justify-between items-baseline gap-2">
                              <span className="text-[11px] text-slate-400">{formatDate(tx.date)}</span>
                              <span className={`font-mono font-bold text-sm shrink-0 ${tx.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                                {tx.type === 'Income' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-slate-900 leading-snug mt-0.5 truncate">{tx.description}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <Badge variant="neutral" className="text-[10px] py-0">{tx.category}</Badge>
                              {tx.status === 'Pending' && <span className="text-[10px] text-amber-500 font-medium">Pending</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                </LoadingState>
              </Card>

              {/* Automated Dues Section */}
              <Card title="Membership Dues Automation" action={
                hasPermission('canEditFinance') && (
                  <Button variant="outline" size="sm" onClick={() => setIsDuesRenewalModalOpen(true)}>
                    <Calendar size={14} className="mr-1" />
                    Initiate Renewal
                  </Button>
                )
              }>
                {(() => {
                  const currentYear = new Date().getFullYear();
                  const duesTxs = transactions.filter(t => {
                    const txYear = new Date(t.date).getFullYear();
                    return txYear === currentYear && isTransactionInCategory(t, 'Membership');
                  });
                  const duesPendingCount = duesTxs.filter(t => t.status === 'Pending').length;
                  const duesClearedCount = duesTxs.filter(t => t.status === 'Cleared').length;
                  const incomeTxs = duesTxs.filter(t => t.type === 'Income');
                  const clearedDues = incomeTxs.filter(t => t.status === 'Cleared').reduce((sum, t) => sum + t.amount, 0);
                  const target = incomeTxs.length * 150;
                  const progress = target > 0 ? (clearedDues / target) * 100 : 0;
                  return (
                    <>
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5 text-center">
                          <p className="text-xl font-bold text-amber-600 tabular-nums">{duesPendingCount}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Pending</p>
                        </div>
                        <div className="bg-green-50 border border-green-100 rounded-lg p-2.5 text-center">
                          <p className="text-xl font-bold text-green-600 tabular-nums">{duesClearedCount}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Paid</p>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 text-center">
                          <p className="text-xl font-bold text-slate-700 tabular-nums">{Math.round(progress)}%</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Collected</p>
                        </div>
                      </div>
                      <ProgressBar progress={progress} label="Collection Progress" />
                      <p className="text-xs text-slate-400 text-right mt-1 tabular-nums">
                        {formatCurrency(clearedDues)} / {formatCurrency(target)}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <Button variant="outline" size="sm" onClick={async () => {
                          try {
                            const remindersSent = await FinanceService.sendDuesReminders(currentYear, 30);
                            showToast(`${remindersSent} reminder notifications sent`, 'success');
                          } catch (err) {
                            showToast('Failed to send reminders', 'error');
                          }
                        }}>Send Reminders</Button>
                        <Button variant="outline" size="sm" onClick={() => setIsDuesRenewalModalOpen(true)}>Configure</Button>
                      </div>
                    </>
                  );
                })()}
              </Card>
            </div>

            {/* Sidebar: Accounts */}
            <div className="order-1 md:order-2 min-w-0">
              <Card title="Bank Accounts" action={
                <Button variant="ghost" size="sm" onClick={() => setIsAddAccountModalOpen(true)}>
                  <Plus size={14} className="mr-1" /> Add
                </Button>
              }>
                {accounts.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">No bank accounts configured</p>
                ) : (
                  <>
                    {/* Mobile: horizontal scroll */}
                    <div className="md:hidden flex gap-2.5 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
                      {accounts.map(acc => (
                        <div
                          key={acc.id}
                          className="shrink-0 w-52 p-3 rounded-xl border border-slate-200 bg-slate-50 hover:border-jci-blue/40 hover:bg-blue-50/30 transition-all cursor-pointer"
                          onClick={() => { setDetailAccount(acc); setDetailYear(new Date().getFullYear()); setIsAccountDetailOpen(true); }}
                        >
                          <div className="flex items-start justify-between gap-1 mb-1">
                            <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider truncate leading-tight">
                              {acc.bankName ? `${acc.bankName} · ` : ''}{acc.name}
                            </p>
                            {acc.accountNumber && (
                              <span className="text-[10px] text-slate-400 font-mono shrink-0">···{acc.accountNumber.slice(-4)}</span>
                            )}
                          </div>
                          <p className="text-base font-bold text-slate-900 tabular-nums">{formatCurrency(acc.balance, acc.currency)}</p>
                          <div className="flex items-center justify-between mt-1.5">
                            <div className="flex items-center gap-1">
                              <CheckCircle size={10} className="text-green-500 shrink-0" />
                              <span className="text-[10px] text-slate-400">{formatDate(acc.lastReconciled)}</span>
                            </div>
                            <button className="text-[10px] text-blue-500 hover:text-blue-700 font-medium" onClick={e => { e.stopPropagation(); setMatchingAccount(acc); }}>Match</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Desktop: stacked list */}
                    <div className="hidden md:block space-y-2">
                      {accounts.map(acc => (
                        <div
                          key={acc.id}
                          className="p-3 rounded-lg border border-slate-100 bg-slate-50 hover:border-jci-blue/40 hover:bg-blue-50/30 transition-all cursor-pointer"
                          onClick={() => { setDetailAccount(acc); setDetailYear(new Date().getFullYear()); setIsAccountDetailOpen(true); }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[11px] text-slate-400 uppercase font-semibold tracking-wider truncate">
                                {acc.bankName ? `${acc.bankName} · ` : ''}{acc.name}
                              </p>
                              <p className="text-base font-bold text-slate-900 mt-0.5 tabular-nums">{formatCurrency(acc.balance, acc.currency)}</p>
                            </div>
                            {acc.accountNumber && (
                              <span className="text-[11px] text-slate-400 font-mono shrink-0 mt-1">···{acc.accountNumber.slice(-4)}</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-1.5">
                            <div className="flex items-center gap-1">
                              <CheckCircle size={11} className="text-green-500 shrink-0" />
                              <span className="text-[10px] text-slate-400">Reconciled {formatDate(acc.lastReconciled)}</span>
                            </div>
                            <button className="text-[10px] text-blue-500 hover:text-blue-700 font-medium" onClick={e => { e.stopPropagation(); setMatchingAccount(acc); }}>Match txs</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}

      {moduleTab === 'Membership' && hasPermission('canViewFinance') && (
        <DuesRenewalDashboard
          membershipTransactions={transactions.filter(t => isTransactionInCategory(t, 'Membership'))}
          onEditMembershipTransaction={(tx, filterYear) => {
            setEditingTransaction(tx);
            setEditingMembershipFilterYear(filterYear);
            setEditingMembershipMemberId(tx.memberId || '');
            const yearFromProjectId = tx.projectId?.match(/^(\d+)\s+membership$/)?.[1];
            setEditingMembershipYear(yearFromProjectId ? parseInt(yearFromProjectId, 10) : new Date(tx.date).getFullYear());
            setIsEditModalOpen(true);
          }}
          hasEditPermission={hasPermission('canEditFinance')}
          formatCurrency={(n) => formatCurrency(n)}
          formatDate={(d) => formatDate(d)}
          onMembershipDataChanged={loadData}
          members={members}
        />
      )}

      {moduleTab === 'Administrative' && hasPermission('canViewFinance') && (
        <div className="space-y-6">
          {(() => {
            const activeYear = adminAccountYearFilter;
            const adminTransactions = transactions.filter(t => isTransactionInCategory(t, 'Administrative'));
            const adminFiltered = activeYear === 0
              ? adminTransactions
              : adminTransactions.filter(t => new Date(t.date).getFullYear() === activeYear);

            const adminIncome = adminFiltered.filter(t => t.type === 'Income').reduce((s, t) => s + t.amount, 0);
            const adminExpenses = adminFiltered.filter(t => t.type === 'Expense').reduce((s, t) => s + Math.abs(t.amount), 0);
            const adminNet = adminIncome - adminExpenses;
            const allAdminProjectIds = dynamicAdministrativeProjectIds;
            let adminByProjectId = allAdminProjectIds.map(projectId => {
              const txList = adminFiltered.filter(t => (t.projectId || '').trim() === projectId.trim());
              const inc = txList.filter(t => t.type === 'Income').reduce((s, t) => s + t.amount, 0);
              const exp = txList.filter(t => t.type === 'Expense').reduce((s, t) => s + Math.abs(t.amount), 0);
              return { projectId, income: inc, expenses: exp, net: inc - exp };
            });
            const uncategorized = adminFiltered.filter(t => !(t.projectId || '').trim());
            const uncatInc = uncategorized.filter(t => t.type === 'Income').reduce((s, t) => s + t.amount, 0);
            const uncatExp = uncategorized.filter(t => t.type === 'Expense').reduce((s, t) => s + Math.abs(t.amount), 0);
            adminByProjectId = [{ projectId: UNASSIGNED_PROJECT_ID, income: uncatInc, expenses: uncatExp, net: uncatInc - uncatExp }, ...adminByProjectId];

            // Filter out accounts with no activity in the selected year
            if (activeYear !== 0) {
              adminByProjectId = adminByProjectId.filter(acc => acc.income !== 0 || acc.expenses !== 0);
            }

            return (
              <>
                {/* Top: Admin Accounts Card (Full Width) */}
                <Card
                  title="Admin Accounts"
                  action={hasPermission('canEditFinance') && (
                    <Button size="sm" onClick={() => setIsAddAdministrativeProjectOpen(true)}>
                      <Plus size={14} className="mr-1" /> Add Account
                    </Button>
                  )}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {adminByProjectId.length === 0 ? (
                      <p className="py-4 text-sm text-slate-500 col-span-full">No admin accounts found.</p>
                    ) : (
                      adminByProjectId.map(({ projectId, income, expenses, net }) => {
                        const isActive = adminProjectIdFilter === projectId;
                        return (
                          <div
                            key={projectId}
                            role="button"
                            tabIndex={0}
                            onClick={() => setAdminProjectIdFilter(isActive ? null : projectId)}
                            onKeyDown={(e) => e.key === 'Enter' && setAdminProjectIdFilter(isActive ? null : projectId)}
                            className={`p-4 cursor-pointer rounded-xl transition-all border shadow-sm flex flex-col justify-between ${isActive
                              ? 'bg-jci-blue/5 border-jci-blue ring-1 ring-jci-blue/20 shadow-md shadow-jci-blue/5'
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow'
                              }`}
                          >
                            <div className="flex justify-between items-center mb-2">
                              <div className="flex items-center gap-2 overflow-hidden">
                                <Briefcase size={18} className={`text-slate-600 shrink-0 ${isActive ? 'text-jci-blue' : ''}`} />
                                <span className={`font-medium truncate ${isActive ? 'text-jci-blue' : 'text-slate-900'}`}>
                                  {projectId === UNASSIGNED_PROJECT_ID ? 'Unassigned' : projectId}
                                </span>
                              </div>
                            </div>

                            <div className="bg-slate-50/50 rounded-lg p-2 text-xs border border-slate-100/50">
                              <div className="flex justify-between py-1 border-b border-slate-200">
                                <span className="text-slate-500">Incomes</span>
                                <span className="font-mono text-green-600">+{formatCurrency(income)}</span>
                              </div>
                              <div className="flex justify-between py-1">
                                <span className="text-slate-500">Expenses</span>
                                <span className="font-mono text-red-600">-{formatCurrency(expenses)}</span>
                              </div>
                              <div className="flex justify-between py-1 border-t border-slate-200 mt-1 pt-1 font-medium">
                                <span className="text-slate-900">Net Flow</span>
                                <span className={`font-mono ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(net)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </Card>

                {/* Bottom Section: Summary on Left, Transactions Table on Right */}
                <div className="grid grid-cols-1 md:grid-cols-7 gap-6">
                  {/* Left Column: Summary */}
                  <div className="md:col-span-2">
                    <Card title={`Administrative Summary ${activeYear === 0 ? '(All Time)' : `(${activeYear})`}`}>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-500">Income</span>
                          <span className="font-semibold text-green-600">{formatCurrency(adminIncome)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-500">Expenses</span>
                          <span className="font-semibold text-red-600">{formatCurrency(adminExpenses)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                          <span className="text-sm font-medium text-slate-700">Net</span>
                          <span className={`font-semibold ${adminNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(adminNet)}</span>
                        </div>
                        <p className="text-xs text-slate-400">{adminFiltered.filter(t => t.type === 'Income').length} income / {adminFiltered.filter(t => t.type === 'Expense').length} expense entries</p>
                      </div>
                    </Card>
                  </div>

                  {/* Right Column: Admin Transactions Table */}
                  <div className="md:col-span-5">
                    <Card
                      title={adminProjectIdFilter === UNASSIGNED_PROJECT_ID ? 'Admin Transactions · Unassigned' : (adminProjectIdFilter ? `Admin Transactions · ${adminProjectIdFilter}` : 'Admin Transactions')}
                      action={adminProjectIdFilter && (
                        <Button variant="ghost" size="sm" onClick={() => setAdminProjectIdFilter(null)}>Clear Filter</Button>
                      )}
                    >
                      {(() => {
                        const activeYear = adminAccountYearFilter;
                        const adminTransactionsWithFilter = activeYear === 0
                          ? adminTransactions
                          : adminTransactions.filter(t => new Date(t.date).getFullYear() === activeYear);

                        const filteredAdminTx = adminProjectIdFilter
                          ? adminProjectIdFilter === UNASSIGNED_PROJECT_ID
                            ? adminTransactionsWithFilter.filter(t => !(t.projectId || '').trim())
                            : adminTransactionsWithFilter.filter(t => (t.projectId || '').trim() === adminProjectIdFilter)
                          : adminTransactionsWithFilter;
                        return (
                          <LoadingState loading={loading} error={error} empty={filteredAdminTx.length === 0} emptyMessage={adminProjectIdFilter ? `No transactions for this account.` : "No admin transactions found. Use 'New Transaction' above to add one."}>
                            {/* Desktop View */}
                            <div className="hidden md:block overflow-x-auto">
                              <table className="w-full table-fixed text-left text-sm">
                                <thead className="bg-slate-50 text-slate-500">
                                  <tr>
                                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Date</th>
                                    <th className="py-3 px-4 font-semibold">Description</th>
                                    <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Amount</th>
                                    <th className="py-3 px-4 font-semibold text-center">Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filteredAdminTx
                                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                    .map(tx => (
                                      <tr key={tx.id} className="hover:bg-slate-50">
                                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{formatDate(tx.date)}</td>
                                        <td className="py-3 px-4 max-w-0 overflow-hidden">
                                          <div className="flex items-center gap-2 overflow-hidden">
                                            {(() => {
                                              const hasProjectId = tx.projectId && tx.projectId.trim() !== '';
                                              const hasPurpose = tx.purpose && tx.purpose.trim() !== '';
                                              if (tx.isSplit) {
                                                return <Badge variant="info" className="text-[10px] py-0 px-1.5 h-4.5 flex items-center shrink-0">Split</Badge>;
                                              } else if (hasProjectId && hasPurpose) {
                                                return <Badge variant="success" className="text-[10px] py-0 px-1.5 h-4.5 flex items-center shrink-0">Categorized</Badge>;
                                              } else {
                                                return <Badge variant="warning" className="text-[10px] py-0 px-1.5 h-4.5 flex items-center shrink-0">Uncategorized</Badge>;
                                              }
                                            })()}
                                            <span className="font-medium text-slate-900 truncate min-w-0">{tx.description}</span>
                                            {tx.referenceNumber && (
                                              <span className="text-[11px] text-slate-400 font-mono shrink-0">({tx.referenceNumber})</span>
                                            )}
                                          </div>
                                          <div className="flex flex-wrap items-center gap-2 mt-1">
                                            <Badge variant={tx.type === 'Income' ? 'success' : 'neutral'} className="text-[10px] py-0 px-1.5 h-4.5 flex items-center">
                                              {tx.type}
                                            </Badge>
                                            <span className="text-xs text-slate-500 font-medium">
                                              {tx.projectId ? (projects.find(p => p.id === tx.projectId)?.name ?? tx.projectId) : '—'}
                                            </span>
                                          </div>
                                        </td>
                                        <td className={`py-3 px-4 text-right font-mono font-medium ${tx.type === 'Income' ? 'text-green-600' : 'text-slate-900'}`}>
                                          {tx.type === 'Income' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                          {hasPermission('canEditFinance') && (
                                            <div className="flex justify-center gap-1">
                                              <Button variant="ghost" size="sm" onClick={() => handleEditTransaction(tx)}>
                                                <Edit size={14} />
                                              </Button>
                                              <Button variant="ghost" size="sm" onClick={() => handleDeleteTransaction(tx.id)}>
                                                <Trash2 size={14} />
                                              </Button>
                                            </div>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Mobile View */}
                            <div className="md:hidden space-y-4 p-2">
                              {filteredAdminTx
                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                .map(tx => (
                                  <div key={tx.id} className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
                                    <div className="flex justify-between items-start mb-3">
                                      <div className="flex flex-col">
                                        <span className="text-xs text-slate-500">{formatDate(tx.date)}</span>
                                        <span className="text-sm font-bold text-slate-900 mt-1">{tx.description}</span>
                                      </div>
                                      <div className={`text-right font-mono font-bold ${tx.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                                        {tx.type === 'Income' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                      <div>
                                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Account</span>
                                        <p className="text-xs text-slate-700 truncate">{tx.projectId ? (projects.find(p => p.id === tx.projectId)?.name ?? tx.projectId) : '—'}</p>
                                      </div>
                                      {tx.referenceNumber && (
                                        <div>
                                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Ref No.</span>
                                          <p className="text-xs text-slate-700 font-mono truncate">{tx.referenceNumber}</p>
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                                      <div className="flex gap-2">
                                        <Badge variant={tx.type === 'Income' ? 'success' : 'neutral'} className="text-[10px]">{tx.type}</Badge>
                                        {(() => {
                                          const hasProjectId = tx.projectId && tx.projectId.trim() !== '';
                                          const hasPurpose = tx.purpose && tx.purpose.trim() !== '';
                                          if (tx.isSplit) return <Badge variant="info" className="text-[10px]">Split</Badge>;
                                          if (hasProjectId && hasPurpose) return <Badge variant="success" className="text-[10px]">Categorized</Badge>;
                                          return <Badge variant="warning" className="text-[10px]">Uncategorized</Badge>;
                                        })()}
                                      </div>
                                      {hasPermission('canEditFinance') && (
                                        <div className="flex gap-1">
                                          <Button variant="ghost" size="sm" onClick={() => handleEditTransaction(tx)} className="p-1">
                                            <Edit size={16} className="text-slate-500" />
                                          </Button>
                                          <Button variant="ghost" size="sm" onClick={() => handleDeleteTransaction(tx.id)} className="p-1">
                                            <Trash2 size={16} className="text-red-500" />
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </LoadingState>
                        );
                      })()}
                    </Card>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {moduleTab === 'Reconciliation' && hasPermission('canViewFinance') && (
        <>
        {/* PR → Bank Transaction reconciliation panel */}
        <Card title="Payment Request Reconciliation" action={
          <Button variant="ghost" size="sm" onClick={loadPrPendingReconciliation} disabled={prReconcileLoading}>
            <RefreshCw size={13} className={prReconcileLoading ? 'animate-spin' : ''} />
          </Button>
        }>
          <p className="text-xs text-slate-500 mb-4">
            Approved Payment Requests that have not yet been linked to a bank payment. Match each PR to its corresponding bank import transaction to complete the expense trail.
          </p>
          {prReconcileLoading ? (
            <LoadingState loading>{null}</LoadingState>
          ) : prPendingReconciliation.length === 0 ? (
            <div className="flex items-center gap-2 py-5 text-sm text-green-600">
              <CheckCircle size={15} />
              All approved Payment Requests have been reconciled.
            </div>
          ) : (
            <div className="space-y-3">
              {prPendingReconciliation.map(pr => {
                const suggestions = prBankSuggestions[pr.id] || [];
                const selectedId = prSelectedBankTx[pr.id] ?? '';
                const bankExpenses = transactions.filter(t => t.source === 'bank_import' && t.type === 'Expense' && t.status !== 'Reconciled');
                return (
                  <div key={pr.id} className="rounded-xl border border-slate-200 overflow-hidden">
                    {/* PR row */}
                    <div className="flex items-start gap-3 p-3 bg-white">
                      <div className="w-1.5 self-stretch rounded-full shrink-0 bg-amber-400" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="warning" className="text-[10px] shrink-0">PR</Badge>
                          <span className="text-[11px] text-slate-400 font-mono">{pr.referenceNumber}</span>
                          <span className="text-[11px] text-slate-400">{formatDate(pr.date)}</span>
                        </div>
                        <p className="text-sm text-slate-800 font-medium mt-0.5 truncate">{pr.purpose || pr.items?.[0]?.purpose || '—'}</p>
                        <p className="text-sm font-semibold text-rose-600 mt-0.5">{formatCurrency(pr.totalAmount || pr.amount)}</p>
                      </div>
                    </div>
                    {/* Match area */}
                    <div className="border-t border-slate-100 px-3 pb-3 pt-2 bg-slate-50/60 space-y-2">
                      {suggestions.length > 0 && (
                        <p className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold">
                          {suggestions.length} suggested bank transaction{suggestions.length > 1 ? 's' : ''}
                        </p>
                      )}
                      <select
                        value={selectedId}
                        onChange={e => setPrSelectedBankTx(prev => ({ ...prev, [pr.id]: e.target.value }))}
                        className="w-full text-sm border border-slate-200 rounded-lg px-2 py-2 bg-white"
                      >
                        <option value="">— select bank transaction —</option>
                        {/* Suggestions first */}
                        {suggestions.length > 0 && (
                          <optgroup label="Suggested (same amount, ±14 days)">
                            {suggestions.map(t => (
                              <option key={t.id} value={t.id}>
                                {formatDate(t.date)} · {t.description} · {formatCurrency(t.amount)}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {/* All other unreconciled bank expenses */}
                        {bankExpenses.filter(t => !suggestions.find(s => s.id === t.id)).length > 0 && (
                          <optgroup label="Other bank expenses">
                            {bankExpenses.filter(t => !suggestions.find(s => s.id === t.id)).map(t => (
                              <option key={t.id} value={t.id}>
                                {formatDate(t.date)} · {t.description} · {formatCurrency(t.amount)}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      <Button
                        size="sm"
                        onClick={() => handleLinkPrToBankTx(pr.id)}
                        disabled={!selectedId || prLinkingId === pr.id}
                        className="w-full"
                      >
                        <Link2 size={13} className="mr-1.5" />
                        {prLinkingId === pr.id ? 'Linking…' : 'Confirm — PR paid via this bank transaction'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
        <Card title="Reconcile by Reference Number">
          <FirstUseBanner flowId="reconciliation" dismissLabel="Got it" variant="teal" onHelpClick={helpModal?.openHelp}>
            Enter a reference number (e.g. PR-default-lo-20250216-001) to search both bank transactions and payment requests. Once verified, click "Mark Reconciled" to record the action.
          </FirstUseBanner>
          <p className="text-sm text-slate-500 mb-4 mt-4">Enter a reference number (e.g. PR-default-lo-20250216-001) to find matching transactions and payment requests, then mark as received.</p>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Reference Number"
              value={refNumberQuery}
              onChange={(e) => setRefNumberQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleReconciliationQuery()}
              className="flex-1 sm:max-w-sm"
              aria-label="Search transactions and payment requests by reference number"
            />
            <Button onClick={handleReconciliationQuery} disabled={reconciliationLoading} className="shrink-0">{reconciliationLoading ? 'Searching…' : 'Search'}</Button>
          </div>
          {reconciliationLoading ? (
            <LoadingState loading>{null}</LoadingState>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                  <span>Transactions</span>
                  {reconciliationTx.length > 0 && <Badge variant="neutral" className="text-[10px]">{reconciliationTx.length}</Badge>}
                </h4>
                <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {reconciliationTx.length === 0 ? (
                    <li className="py-5 px-4 text-slate-400 text-sm text-center">No matching transactions found.</li>
                  ) : (
                    reconciliationTx.map((tx) => (
                      <li key={tx.id} className="py-3 px-4 bg-white flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{tx.description}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{formatDate(tx.date)} · <span className={`font-mono font-semibold ${tx.type === 'Income' ? 'text-green-600' : 'text-slate-700'}`}>{formatCurrency(tx.amount)}</span></p>
                        </div>
                        <div className="shrink-0">
                          {tx.status === 'Reconciled' ? (
                            <Badge variant="success">Reconciled</Badge>
                          ) : (
                            <Button size="sm" onClick={() => handleMarkReconciled(tx.id)} disabled={reconcilingId !== null}>
                              {reconcilingId === tx.id ? 'Processing…' : 'Mark Reconciled'}
                            </Button>
                          )}
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                  <span>Payment Requests</span>
                  {reconciliationPRs.length > 0 && <Badge variant="neutral" className="text-[10px]">{reconciliationPRs.length}</Badge>}
                </h4>
                <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {reconciliationPRs.length === 0 ? (
                    <li className="py-5 px-4 text-slate-400 text-sm text-center">No matching payment requests found.</li>
                  ) : (
                    reconciliationPRs.map((pr) => (
                      <li key={pr.id} className="py-3 px-4 bg-white flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{pr.purpose}</p>
                          <p className="text-xs text-slate-500 mt-0.5 font-mono">{pr.referenceNumber} · <span className="font-semibold text-slate-700">{formatCurrency(pr.amount)}</span></p>
                        </div>
                        <div className="shrink-0">
                          <Badge variant={pr.status === 'approved' ? 'success' : pr.status === 'rejected' ? 'error' : 'warning'}>{pr.status === 'approved' ? 'Approved' : pr.status === 'rejected' ? 'Rejected' : 'Pending'}</Badge>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          )}
        </Card>
        </>
      )}



      {moduleTab === 'Project Account' && (
        <div className="space-y-6">
          {/* Top: Project Accounts Card (Full Width) */}
          <Card title="Project Accounts">
            <LoadingState loading={loadingProjectAccounts} error={null} empty={filteredProjectAccounts.length === 0 && uncategorizedProjectTxCount === 0} emptyMessage="No project accounts found. Create a project in the 'Projects' section and set up its financial account.">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  ...(uncategorizedProjectTxCount > 0 ? [{
                    id: 'uncategorized',
                    projectId: UNASSIGNED_PROJECT_ID,
                    projectName: 'Unassigned',
                    currentBalance: 0,
                    totalIncome: 0,
                    totalExpenses: 0,
                  }] : []),
                  ...filteredProjectAccounts
                ].map(acc => {
                  const isActive = selectedProjectFilter === acc.projectId;

                  // Logic for PT vs Bank comparison
                  const bankIncome = acc.totalIncome || 0;
                  const bankExpenses = acc.totalExpenses || 0;
                  const bankNet = bankIncome - bankExpenses;

                  // PT Values from projectTrackerSummary
                  const ptData = projectTrackerSummary[acc.projectId] || { income: 0, expenses: 0 };
                  const ptIncome = ptData.income;
                  const ptExpenses = ptData.expenses;
                  const ptNet = ptIncome - ptExpenses;

                  // Match logic: Check if values match exactly
                  const isMatch = ptIncome === bankIncome && ptExpenses === bankExpenses && ptNet === bankNet;

                  return (
                    <div
                      key={acc.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedProjectFilter(isActive ? null : acc.projectId)}
                      onKeyDown={(e) => e.key === 'Enter' && setSelectedProjectFilter(isActive ? null : acc.projectId)}
                      className={`p-4 cursor-pointer rounded-xl transition-all border shadow-sm flex flex-col justify-between ${isActive
                        ? 'bg-jci-blue/5 border-jci-blue ring-1 ring-jci-blue/20 shadow-md shadow-jci-blue/5'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow'
                        }`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <Briefcase size={18} className={`text-slate-600 shrink-0 ${isActive ? 'text-jci-blue' : ''}`} />
                          <span className={`font-medium truncate ${isActive ? 'text-jci-blue' : 'text-slate-900'}`}>{acc.projectName}</span>
                          {acc.projectId !== UNASSIGNED_PROJECT_ID && isMatch && (
                            <CheckCircle size={16} className="text-green-600 ml-1 shrink-0" />
                          )}
                        </div>
                      </div>

                      {acc.projectId === UNASSIGNED_PROJECT_ID ? (
                        <div className="bg-slate-50/50 rounded-lg p-3 text-xs border border-slate-100/50 flex flex-col justify-center items-center h-[98px]">
                          <span className="text-slate-400 font-medium">Pending Categorization</span>
                          <span className="text-lg font-bold text-slate-700 mt-1">{uncategorizedProjectTxCount}</span>
                          <span className="text-[10px] text-slate-400">Transactions</span>
                        </div>
                      ) : (
                        <div className="bg-slate-50/50 rounded-lg p-2 text-xs border border-slate-100/50">
                          <div className="grid grid-cols-3 gap-2 border-b border-slate-200 pb-1 mb-1 font-semibold text-slate-500">
                            <div></div>
                            <div className="text-right">PT</div>
                            <div className="text-right">HT</div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 py-0.5">
                            <div className="text-slate-500">Incomes</div>
                            <div className="text-right font-mono text-slate-700">{formatCurrency(ptIncome)}</div>
                            <div className="text-right font-mono text-slate-700">{formatCurrency(bankIncome)}</div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 py-0.5">
                            <div className="text-slate-500">Expenses</div>
                            <div className="text-right font-mono text-slate-700">{formatCurrency(ptExpenses)}</div>
                            <div className="text-right font-mono text-slate-700">{formatCurrency(bankExpenses)}</div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 py-0.5 border-t border-slate-200 mt-1 pt-1 font-medium">
                            <div className="text-slate-900">Net</div>
                            <div className={`text-right font-mono ${ptNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(ptNet)}</div>
                            <div className={`text-right font-mono ${bankNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(bankNet)}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </LoadingState>
          </Card>

          {/* Bottom Section: Stats on Left, Transactions Table on Right */}
          <div className="grid grid-cols-1 md:grid-cols-7 gap-6">
            {/* Left Column: Project Statistics */}
            <div className="md:col-span-2">
              <Card title="Project Statistics">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Projects</span>
                      <p className="text-sm font-bold text-slate-800">{filteredProjectAccounts.length}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Balance</span>
                      <p className="text-sm font-bold text-slate-800 truncate" title={formatCurrency(filteredProjectAccounts.reduce((sum, acc) => sum + acc.currentBalance, 0))}>
                        {formatCurrency(filteredProjectAccounts.reduce((sum, acc) => sum + acc.currentBalance, 0))}
                      </p>
                    </div>
                  </div>
                  <div className="border-t border-slate-100 pt-3 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Avg. Balance</span>
                      <span className="font-semibold text-slate-800">
                        {formatCurrency(filteredProjectAccounts.length > 0 ? filteredProjectAccounts.reduce((sum, acc) => sum + acc.currentBalance, 0) / filteredProjectAccounts.length : 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Positive Balance</span>
                      <span className="font-semibold text-green-600">
                        {filteredProjectAccounts.filter(acc => acc.currentBalance >= 0).length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Negative Balance</span>
                      <span className="font-semibold text-red-600">
                        {filteredProjectAccounts.filter(acc => acc.currentBalance < 0).length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Unassigned Txs</span>
                      <span className="font-semibold text-amber-600">
                        {uncategorizedProjectTxCount}
                      </span>
                    </div>
                  </div>

                  {selectedProjectInfo && (
                    <div className="border-t border-slate-100 pt-3 mt-3">
                      <h4 className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-2">Selected Project</h4>
                      <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-100">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500 font-medium">Project Name:</span>
                          <span className="font-semibold text-slate-800 truncate max-w-[120px]" title={selectedProjectInfo.name || selectedProjectInfo.title}>
                            {selectedProjectInfo.name || selectedProjectInfo.title}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500 font-medium">LO Budget:</span>
                          <span className="font-semibold text-slate-800">
                            {formatCurrency(selectedProjectInfo.budget || selectedProjectInfo.proposedBudget || 0)}
                          </span>
                        </div>
                        <Button
                          className="w-full mt-2 bg-jci-blue hover:bg-jci-blue/90 text-white font-semibold flex items-center justify-center gap-1.5 text-xs py-2 shadow-sm"
                          size="sm"
                          onClick={() => {
                            loadProjectTrxList(selectedProjectFilter);
                            setIsProjectTrxModalOpen(true);
                          }}
                        >
                          <Settings size={14} />
                          Configure Project Trx (PT)
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Right Column: Project Transactions Table */}
            <div className="md:col-span-5">
              <Card
                title={selectedProjectFilter === UNASSIGNED_PROJECT_ID ? 'Project Transactions · Unassigned' : (selectedProjectFilter ? `Project Transactions · ${projectAccounts.find(p => p.projectId === selectedProjectFilter)?.projectName || selectedProjectFilter}` : 'Project Transactions')}
                action={selectedProjectFilter && (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedProjectFilter(null)}>Clear Filter</Button>
                )}
              >
                {(() => {
                  const filteredProjectTx = (selectedProjectFilter && selectedProjectFilter !== UNASSIGNED_PROJECT_ID)
                    ? selectedProjectTransactions
                    : projectTransactions;
                  return (
                    <LoadingState loading={loading || loadingSelectedProjectTransactions} error={error} empty={filteredProjectTx.length === 0} emptyMessage={selectedProjectFilter ? `No transactions for this project.` : "No project transactions found. Use 'New Transaction' above to add one."}>
                      {/* Desktop View */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full table-fixed text-left text-sm">
                          <colgroup>
                            <col className="w-32" />
                            <col />
                            <col className="w-36" />
                            <col className="w-24" />
                          </colgroup>
                          <thead className="bg-slate-50 text-slate-500">
                            <tr>
                              <th className="py-3 px-4 font-semibold whitespace-nowrap">Date</th>
                              <th className="py-3 px-4 font-semibold">Description</th>
                              <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Amount</th>
                              <th className="py-3 px-4 font-semibold text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredProjectTx
                              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                              .map(tx => (
                                <tr key={tx.id} className="hover:bg-slate-50">
                                  <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{formatDate(tx.date)}</td>
                                  <td className="py-3 px-4 max-w-0 overflow-hidden">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                      {(() => {
                                        const hasProjectId = tx.projectId && tx.projectId.trim() !== '';
                                        const hasPurpose = tx.purpose && tx.purpose.trim() !== '';
                                        if (tx.isSplit) {
                                          return <Badge variant="info" className="text-[10px] py-0 px-1.5 h-4.5 flex items-center shrink-0">Split</Badge>;
                                        } else if (hasProjectId && hasPurpose) {
                                          return <Badge variant="success" className="text-[10px] py-0 px-1.5 h-4.5 flex items-center shrink-0">Categorized</Badge>;
                                        } else {
                                          return <Badge variant="warning" className="text-[10px] py-0 px-1.5 h-4.5 flex items-center shrink-0">Uncategorized</Badge>;
                                        }
                                      })()}
                                      <span className="font-medium text-slate-900 truncate min-w-0">{tx.description}</span>
                                      {tx.referenceNumber && (
                                        <span className="text-[11px] text-slate-400 font-mono shrink-0">({tx.referenceNumber})</span>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                      <Badge variant={tx.type === 'Income' ? 'success' : 'neutral'} className="text-[10px] py-0 px-1.5 h-4.5 flex items-center">
                                        {tx.type}
                                      </Badge>
                                      <span className="text-xs text-slate-500 font-medium">
                                        {tx.projectId ? (projects.find(p => p.id === tx.projectId)?.name || tx.projectId) : '—'}
                                      </span>
                                    </div>
                                  </td>
                                  <td className={`py-3 px-4 text-right font-mono font-medium ${tx.type === 'Income' ? 'text-green-600' : 'text-slate-900'}`}>
                                    {tx.type === 'Income' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    {hasPermission('canEditFinance') && (
                                      <div className="flex justify-center gap-1">
                                        <Button variant="ghost" size="sm" onClick={() => handleEditTransaction(tx)}>
                                          <Edit size={14} />
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => handleDeleteTransaction(tx.id)}>
                                          <Trash2 size={14} />
                                        </Button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile View */}
                      <div className="md:hidden space-y-4 p-2">
                        {filteredProjectTx
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .map(tx => (
                            <div key={tx.id} className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex flex-col">
                                  <span className="text-xs text-slate-500">{formatDate(tx.date)}</span>
                                  <span className="text-sm font-bold text-slate-900 mt-1">{tx.description}</span>
                                </div>
                                <div className={`text-right font-mono font-bold ${tx.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                                  {tx.type === 'Income' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 mb-3">
                                <div>
                                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Project</span>
                                  <p className="text-xs text-slate-700 truncate">{tx.projectId ? (projects.find(p => p.id === tx.projectId)?.name || tx.projectId) : '—'}</p>
                                </div>
                                {tx.referenceNumber && (
                                  <div>
                                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Ref No.</span>
                                    <p className="text-xs text-slate-700 font-mono truncate">{tx.referenceNumber}</p>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                                <div className="flex gap-2">
                                  <Badge variant={tx.type === 'Income' ? 'success' : 'neutral'} className="text-[10px]">{tx.type}</Badge>
                                  {(() => {
                                    const hasProjectId = tx.projectId && tx.projectId.trim() !== '';
                                    const hasPurpose = tx.purpose && tx.purpose.trim() !== '';
                                    if (tx.isSplit) return <Badge variant="info" className="text-[10px]">Split</Badge>;
                                    if (hasProjectId && hasPurpose) return <Badge variant="success" className="text-[10px]">Categorized</Badge>;
                                    return <Badge variant="warning" className="text-[10px]">Uncategorized</Badge>;
                                  })()}
                                </div>
                                {hasPermission('canEditFinance') && (
                                  <div className="flex gap-1">
                                    <Button variant="ghost" size="sm" onClick={() => handleEditTransaction(tx)} className="p-1">
                                      <Edit size={16} className="text-slate-500" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDeleteTransaction(tx.id)} className="p-1">
                                      <Trash2 size={16} className="text-red-500" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </LoadingState>
                  );
                })()}
              </Card>
            </div>
          </div>
        </div>
      )}
      {moduleTab === 'Transactions' && (
        <div className="space-y-4">
          <div>
            {(() => {
              const activeFilterCount = [
                txTypeFilter !== 'All',
                txStatusFilter !== 'All',
                txCategoryFilter !== 'All',
                bankAccountFilter !== 'All',
                reportYear !== 0,
              ].filter(Boolean).length;
              return (
                <div className="mb-3 space-y-2">
                  {/* Row 1: Search + mobile filter toggle */}
                  <div className="flex gap-2 items-center">
                    <div className="flex-1">
                      <Input
                        type="text"
                        placeholder="Search date, description, ref no…"
                        value={txSearchTerm}
                        onChange={(e) => setTxSearchTerm(e.target.value)}
                        icon={<Search size={16} />}
                        className="w-full"
                      />
                    </div>
                    <button
                      onClick={() => setTxFiltersOpen(p => !p)}
                      className={`md:hidden shrink-0 relative flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${txFiltersOpen ? 'bg-jci-blue text-white border-jci-blue' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                    >
                      <SlidersHorizontal size={15} />
                      {activeFilterCount > 0 && (
                        <span className={`text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center ${txFiltersOpen ? 'bg-white text-jci-blue' : 'bg-jci-blue text-white'}`}>{activeFilterCount}</span>
                      )}
                    </button>
                  </div>

                  {/* Filter panel: always on desktop, toggle on mobile */}
                  <div className={`space-y-2 ${txFiltersOpen ? 'block' : 'hidden'} md:block`}>
                    {/* Dropdowns — pill style */}
                    <div className="flex gap-1.5 flex-wrap">
                      {/* Year */}
                      <div className="relative">
                        <select
                          value={reportYear.toString()}
                          onChange={(e) => { const v = parseInt(e.target.value, 10); setReportYear(v); setProjectAccountYearFilter(v); }}
                          className={`appearance-none cursor-pointer pl-3 pr-6 py-1.5 rounded-full text-xs font-semibold outline-none border transition-colors ${
                            reportYear !== 0
                              ? 'bg-jci-blue text-white border-jci-blue'
                              : 'bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200'
                          }`}
                        >
                          <option value="0">All Years</option>
                          {allTransactionYears.map(y => <option key={y} value={y.toString()}>{y}</option>)}
                        </select>
                        <ChevronDown size={11} className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${reportYear !== 0 ? 'text-white' : 'text-slate-400'}`} />
                      </div>
                      {/* Account */}
                      <div className="relative">
                        <select
                          value={bankAccountFilter}
                          onChange={(e) => setBankAccountFilter(e.target.value)}
                          className={`appearance-none cursor-pointer pl-3 pr-6 py-1.5 rounded-full text-xs font-semibold outline-none border transition-colors max-w-[140px] truncate ${
                            bankAccountFilter !== 'All'
                              ? 'bg-jci-blue text-white border-jci-blue'
                              : 'bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200'
                          }`}
                        >
                          <option value="All">All Accounts</option>
                          {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                        </select>
                        <ChevronDown size={11} className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${bankAccountFilter !== 'All' ? 'text-white' : 'text-slate-400'}`} />
                      </div>
                      {/* Category */}
                      <div className="relative">
                        <select
                          value={txCategoryFilter}
                          onChange={(e) => setTxCategoryFilter(e.target.value)}
                          className={`appearance-none cursor-pointer pl-3 pr-6 py-1.5 rounded-full text-xs font-semibold outline-none border transition-colors max-w-[150px] truncate ${
                            txCategoryFilter !== 'All'
                              ? 'bg-jci-blue text-white border-jci-blue'
                              : 'bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200'
                          }`}
                        >
                          <option value="All">All Categories</option>
                          <option value="Projects & Activities">Projects & Activities</option>
                          <option value="Membership">Membership</option>
                          <option value="Administrative">Administrative</option>
                          <option value="Uncategorized">Uncategorized</option>
                        </select>
                        <ChevronDown size={11} className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${txCategoryFilter !== 'All' ? 'text-white' : 'text-slate-400'}`} />
                      </div>
                    </div>
                    {/* Chips — Type + Status in one row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                        {(['All', 'Income', 'Expense'] as const).map(t => (
                          <button key={t} onClick={() => setTxTypeFilter(t)}
                            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                              txTypeFilter === t
                                ? t === 'Income' ? 'bg-green-500 text-white' : t === 'Expense' ? 'bg-red-500 text-white' : 'bg-white text-slate-700 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}>
                            {t === 'Income' ? '↑ Inc' : t === 'Expense' ? '↓ Exp' : 'All'}
                          </button>
                        ))}
                      </div>
                      <div className="w-px h-4 bg-slate-200 shrink-0" />
                      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                        {(['All', 'Pending', 'Cleared'] as const).map(s => (
                          <button key={s} onClick={() => setTxStatusFilter(s)}
                            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                              txStatusFilter === s
                                ? s === 'Pending' ? 'bg-amber-500 text-white' : s === 'Cleared' ? 'bg-blue-500 text-white' : 'bg-white text-slate-700 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}>{s}</button>
                        ))}
                      </div>
                      {activeFilterCount > 0 && (
                        <button
                          onClick={() => { setTxTypeFilter('All'); setTxStatusFilter('All'); setTxCategoryFilter('All'); setBankAccountFilter('All'); setReportYear(new Date().getFullYear()); }}
                          className="text-xs text-blue-500 hover:text-blue-700 font-medium ml-1"
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Summary strip */}
            {visibleTransactions.length > 0 && (() => {
              const incomeTotal = visibleTransactions.filter(t => t.type === 'Income').reduce((s, t) => s + t.amount, 0);
              const expenseTotal = visibleTransactions.filter(t => t.type === 'Expense').reduce((s, t) => s + t.amount, 0);
              const pendingCount = visibleTransactions.filter(t => t.status === 'Pending').length;
              return (
                <div className="flex items-center gap-2 px-1 pb-3 border-b border-slate-100 overflow-x-auto no-scrollbar">
                  <span className="text-xs text-slate-500 font-medium whitespace-nowrap shrink-0">{visibleTransactions.length} txns</span>
                  <span className="w-px h-3.5 bg-slate-200 shrink-0" />
                  <span className="text-xs font-mono font-semibold text-green-600 whitespace-nowrap shrink-0">+{formatCurrency(incomeTotal)}</span>
                  <span className="text-xs font-mono font-semibold text-red-500 whitespace-nowrap shrink-0">−{formatCurrency(expenseTotal)}</span>
                  {pendingCount > 0 && (
                    <>
                      <span className="w-px h-3.5 bg-slate-200 shrink-0" />
                      <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 whitespace-nowrap shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                        {pendingCount} pending
                      </span>
                    </>
                  )}
                </div>
              );
            })()}

            <LoadingState loading={loading} error={error} empty={transactions.length === 0} emptyMessage="No transactions found">
              {/* Desktop View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full table-fixed text-left text-sm">
                  <colgroup>
                    <col style={{ width: '2.5rem' }} />
                    <col style={{ width: '7.5rem' }} />
                    <col style={{ width: '35%' }} />
                    <col style={{ width: '9rem' }} />
                    <col style={{ width: '10rem' }} />
                    <col style={{ width: '9rem' }} />
                  </colgroup>
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="py-3 px-2 font-semibold">
                        <input
                          type="checkbox"
                          checked={(() => {
                            const allVisibleTxIds = visibleTransactions.map(t => t.id);
                            const allVisibleSplitIds = visibleTransactions.flatMap(t =>
                              t.isSplit && transactionSplits[t.id] ? transactionSplits[t.id].map(s => s.id) : []
                            );
                            return allVisibleTxIds.length > 0 && allVisibleTxIds.every(id => selectedTxIds.has(id)) &&
                              (allVisibleSplitIds.length === 0 || allVisibleSplitIds.every(id => selectedSplitIds.has(id)));
                          })()}
                          onChange={handleSelectAllTransactions}
                          className="accent-blue-600 cursor-pointer"
                        />
                      </th>
                      <th className="py-3 px-3 font-semibold whitespace-nowrap">Date</th>
                      <th className="py-3 px-3 font-semibold">Description</th>
                      <th className="py-3 px-3 font-semibold text-right whitespace-nowrap">Amount</th>
                      <th className="py-3 px-3 font-semibold text-right whitespace-nowrap">Bal.</th>
                      <th className="py-3 px-3 font-semibold text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedTransactions.map(group => (
                      <React.Fragment key={group.key}>
                        <tr>
                          <td colSpan={6} className="py-1.5 px-3 bg-slate-50 border-y border-slate-100">
                            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{group.label}</span>
                          </td>
                        </tr>
                        {group.txs.map(tx => (
                      <React.Fragment key={tx.id}>
                        {/* Parent Transaction Row */}
                        <tr className={`border-l-2 ${tx.type === 'Income' ? 'border-l-green-400' : 'border-l-red-400'} hover:bg-slate-50/80 transition-colors ${selectedTxIds.has(tx.id) ? 'bg-blue-50/60' : tx.status === 'Pending' ? 'bg-amber-50/40' : ''}`}>
                          <td className="py-4 px-2 w-8">
                            <input
                              type="checkbox"
                              checked={selectedTxIds.has(tx.id)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                const nextTx = new Set(selectedTxIds);
                                const nextSplits = new Set(selectedSplitIds);

                                if (checked) {
                                  nextTx.add(tx.id);
                                  // If it's a split, select all its splits too
                                  if (tx.isSplit && transactionSplits[tx.id]) {
                                    transactionSplits[tx.id].forEach(s => nextSplits.add(s.id));
                                  }
                                } else {
                                  nextTx.delete(tx.id);
                                  // If it's a split, deselect all its splits too
                                  if (tx.isSplit && transactionSplits[tx.id]) {
                                    transactionSplits[tx.id].forEach(s => nextSplits.delete(s.id));
                                  }
                                }
                                setSelectedTxIds(nextTx);
                                setSelectedSplitIds(nextSplits);
                              }}
                              className="accent-blue-600 cursor-pointer"
                            />
                          </td>
                          <td className="py-4 px-4 text-slate-500 whitespace-nowrap">{formatDate(tx.date)}</td>
                          <td className="py-4 px-4 max-w-0 overflow-hidden">
                            <div className="flex items-center gap-2 overflow-hidden">
                              {(() => {
                                const hasProjectId = tx.projectId && tx.projectId.trim() !== '';
                                const hasPurpose = tx.purpose && tx.purpose.trim() !== '';
                                if (tx.isSplit) {
                                  return <Badge variant="info" className="text-[10px] py-0 px-1.5 shrink-0">Split</Badge>;
                                } else if (hasProjectId && hasPurpose) {
                                  return <Badge variant="success" className="text-[10px] py-0 px-1.5 shrink-0">Categorized</Badge>;
                                } else {
                                  return <Badge variant="warning" className="text-[10px] py-0 px-1.5 shrink-0">Uncategorized</Badge>;
                                }
                              })()}
                              <span className="font-medium text-slate-900 truncate min-w-0">{tx.description}</span>
                              {tx.referenceNumber && (
                                <span className="text-[11px] text-slate-400 font-mono shrink-0">({tx.referenceNumber})</span>
                              )}
                            </div>
                            <div
                              className="mt-1 overflow-hidden text-xs text-slate-500 whitespace-nowrap text-ellipsis flex items-center gap-1.5"
                              title={`${tx.isSplit ? 'Split' : (tx.category || '—')} | ${getTransactionAccountLabel(tx)} | ${tx.purpose || '—'}`}
                            >
                              {tx.status === 'Pending' && <span className="shrink-0 inline-flex items-center px-1.5 py-0 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">Pending</span>}
                              <span className="font-medium text-slate-600">
                                {tx.isSplit ? 'Split' : (tx.category || '—')}
                              </span>
                              <span className="text-slate-300">|</span>
                              <span>{getTransactionAccountLabel(tx)}</span>
                              <span className="text-slate-300">|</span>
                              <span>{tx.purpose || '—'}</span>
                              {tx.isSplit && (
                                <>
                                  <span className="text-slate-300">|</span>
                                  <span className="text-blue-600">Split into {transactionSplits[tx.id]?.length || 0} parts</span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className={`py-4 px-4 text-right font-mono font-bold ${tx.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                            {tx.type === 'Income' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                          </td>
                          <td className={`py-4 px-4 text-right font-mono font-semibold ${tx.runningBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(tx.runningBalance)}
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditTransaction(tx)}
                                className="text-slate-600 hover:text-blue-600 p-1"
                                title="Edit transaction"
                              >
                                <Edit size={16} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteTransaction(tx.id)}
                                className="text-slate-600 hover:text-red-600 p-1"
                                title="Delete transaction"
                              >
                                <Trash2 size={16} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedTransaction(tx);
                                  setIsSplitModalOpen(true);
                                  // Load members and projects for the modal
                                  if (members.length === 0) loadMembers();
                                  if (projects.length === 0) loadProjects();
                                  // Load project purposes from multiple sources (filtered by projectId)
                                  const loadPurposes = async () => {
                                    const purposes = new Set<string>();
                                    const targetProjectId = tx.projectId;

                                    try {
                                      const ptTrx = await projectFinancialService.getAllProjectTrackerTransactions();
                                      ptTrx.forEach(t => {
                                        // Filter by projectId matching
                                        if (t.projectId === targetProjectId && t.description) purposes.add(t.description);
                                      });
                                    } catch (e) { console.error('Failed to load PT purposes', e); }

                                    let allTx: Transaction[] = [];
                                    try {
                                      allTx = await FinanceService.getAllTransactions();
                                      // Filter by current transaction's projectId
                                      allTx.forEach(t => {
                                        if (t.projectId === targetProjectId && t.purpose) purposes.add(t.purpose);
                                      });
                                    } catch (e) { console.error('Failed to load tx purposes', e); }

                                    try {
                                      const splitTx = allTx.filter(t => t.isSplit && t.splitIds);
                                      for (const t of splitTx) {
                                        try {
                                          const splits = await FinanceService.getTransactionSplits(t.id);
                                          splits.forEach(s => {
                                            if (s.projectId === targetProjectId && s.purpose) purposes.add(s.purpose);
                                          });
                                        } catch (e) { }
                                      }
                                    } catch (e) { console.error('Failed to load split purposes', e); }

                                    setProjectPurposes(Array.from(purposes).sort());
                                  };
                                  loadPurposes();
                                }}
                                className="text-blue-600 hover:text-blue-700 text-xs px-2"
                                title={tx.isSplit ? "Edit split" : "Split transaction"}
                              >
                                {tx.isSplit ? 'Edit Split' : 'Split'}
                              </Button>
                            </div>
                          </td>
                        </tr>

                        {/* Split Transaction Rows */}
                        {tx.isSplit && transactionSplits[tx.id] && transactionSplits[tx.id].map((split, idx) => (
                          <tr key={`${tx.id}-split-${idx}`} className={`bg-blue-50/30 ${selectedSplitIds.has(split.id) ? 'bg-blue-100/50' : ''}`}>
                            <td className="py-2 px-2">
                              <input
                                type="checkbox"
                                checked={selectedSplitIds.has(split.id)}
                                onChange={(e) => {
                                  const next = new Set(selectedSplitIds);
                                  if (e.target.checked) next.add(split.id);
                                  else next.delete(split.id);
                                  setSelectedSplitIds(next);
                                }}
                                className="accent-blue-600 cursor-pointer"
                              />
                            </td>
                            <td className="py-2 px-4 pl-12"></td>
                            <td className="py-2 px-4 pl-12 max-w-0 overflow-hidden">
                              <div className="flex items-center gap-2 overflow-hidden">
                                <span className="text-slate-400 shrink-0">↳</span>
                                <span className="text-slate-600 truncate min-w-0">{split.description}</span>
                              </div>
                              <div
                                className="mt-0.5 overflow-hidden text-xs text-slate-500 whitespace-nowrap text-ellipsis"
                                title={`${split.category || '—'} | ${getTransactionAccountLabel(split, tx)} | ${split.purpose || '—'}`}
                              >
                                <span className="font-medium text-slate-600">{split.category || '—'}</span>
                                <span className="mx-1 text-slate-300">|</span>
                                <span>{getTransactionAccountLabel(split, tx)}</span>
                                <span className="mx-1 text-slate-300">|</span>
                                <span>{split.purpose || '—'}</span>
                              </div>
                            </td>
                            <td className={`py-2 px-4 text-right font-mono text-sm ${(split.type || tx.type) === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                              {(split.type || tx.type) === 'Income' ? '+' : '-'}{formatCurrency(Math.abs(split.amount))}
                            </td>
                            <td className="py-2 px-4"></td>
                            <td className="py-2 px-4"></td>
                          </tr>
                        ))}
                      </React.Fragment>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="md:hidden space-y-3 p-1">
                {groupedTransactions.map(group => (
                  <div key={group.key}>
                    <div className="py-1 px-1 mb-1.5">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{group.label}</span>
                    </div>
                    {group.txs.map(tx => (
                  <div key={tx.id} className={`bg-white border rounded-xl overflow-hidden shadow-sm relative ${selectedTxIds.has(tx.id) ? 'ring-2 ring-blue-500 bg-blue-50/20 border-blue-200' : tx.status === 'Pending' ? 'border-amber-200 bg-amber-50/20' : 'border-slate-100'}`}>
                    {/* Left color bar: absolute positioned */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${tx.type === 'Income' ? 'bg-green-400' : 'bg-red-400'}`} />
                    <div className="pl-4 pr-3 pt-2.5 pb-2.5">
                      {/* Row 1: checkbox + date + pending | amount */}
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={selectedTxIds.has(tx.id)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              const nextTx = new Set(selectedTxIds);
                              const nextSplits = new Set(selectedSplitIds);
                              if (checked) {
                                nextTx.add(tx.id);
                                if (tx.isSplit && transactionSplits[tx.id]) {
                                  transactionSplits[tx.id].forEach(s => nextSplits.add(s.id));
                                }
                              } else {
                                nextTx.delete(tx.id);
                                if (tx.isSplit && transactionSplits[tx.id]) {
                                  transactionSplits[tx.id].forEach(s => nextSplits.delete(s.id));
                                }
                              }
                              setSelectedTxIds(nextTx);
                              setSelectedSplitIds(nextSplits);
                            }}
                            className="accent-blue-600 w-4 h-4 cursor-pointer shrink-0"
                          />
                          <span className="text-[11px] text-slate-400 font-medium shrink-0">{formatDate(tx.date)}</span>
                          {tx.status === 'Pending' && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1 shrink-0">
                              <span className="w-1 h-1 rounded-full bg-amber-400 inline-block" />
                              Pending
                            </span>
                          )}
                        </div>
                        <span className={`font-mono font-bold text-sm shrink-0 ${tx.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.type === 'Income' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                        </span>
                      </div>
                      {/* Row 2: description */}
                      <p className="text-sm font-semibold text-slate-900 leading-snug truncate mb-2">{tx.description}</p>
                      {/* Row 3: meta (category + account + balance) | actions */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                          <Badge variant={tx.isSplit ? "info" : "neutral"} className="text-[10px] shrink-0">{tx.isSplit ? "Split" : (tx.category || "—")}</Badge>
                          {(() => {
                            const acc = accounts.find(a => a.id === tx.bankAccountId);
                            if (acc) return <span className="text-[10px] text-slate-400 truncate">{acc.name}</span>;
                            return null;
                          })()}
                          <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap shrink-0">Bal {formatCurrency(tx.runningBalance)}</span>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button onClick={() => handleEditTransaction(tx)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="Edit">
                            <Edit size={14} />
                          </button>
                          <button onClick={() => handleDeleteTransaction(tx.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete">
                            <Trash2 size={14} />
                          </button>
                          <button onClick={() => {
                            setSelectedTransaction(tx);
                            setIsSplitModalOpen(true);
                            if (members.length === 0) loadMembers();
                            if (projects.length === 0) loadProjects();
                          }} className="px-2 py-1 rounded-lg text-[11px] font-bold text-blue-600 hover:bg-blue-50 transition-colors">
                            {tx.isSplit ? 'Edit Split' : 'Split'}
                          </button>
                        </div>
                      </div>
                      {/* Split details */}
                      {tx.isSplit && transactionSplits[tx.id] && (
                        <div className="mt-2 space-y-1.5 bg-blue-50/40 p-2 rounded-lg border border-blue-100/60">
                          {transactionSplits[tx.id].map((split, idx) => (
                            <div key={idx} className="flex justify-between items-center text-[11px]">
                              <div className="flex items-center gap-1 min-w-0">
                                <span className="text-blue-400 shrink-0">↳</span>
                                <span className="text-slate-600 truncate">{split.description}</span>
                              </div>
                              <span className={`font-mono font-medium whitespace-nowrap shrink-0 ${(split.type || tx.type) === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                                {(split.type || tx.type) === 'Income' ? '+' : '-'}{formatCurrency(Math.abs(split.amount))}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                    ))}
                  </div>
                ))}
              </div>
              {hasMoreTransactions && (
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTransactionLimit(prev => prev + 100)}
                    className="text-jci-blue hover:bg-jci-blue/10 font-medium"
                  >
                    Show More Transactions
                  </Button>
                </div>
              )}
            </LoadingState>
          </div>
        </div>
      )
      }

      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setAddDefaultCategory(null); setRecordFormCategory('Projects & Activities'); setRecordFormMemberId(''); setRecordFormYear(new Date().getFullYear()); setRecordFormProjectId(''); }}
        title="Record Transaction"
        size="2xl"
        bottomSheet
        drawerOnMobile
        footer={
          <div className="flex gap-2 w-full">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button className="flex-1" type="submit" form="record-transaction-form">Save Transaction</Button>
          </div>
        }
      >
        <form id="record-transaction-form" onSubmit={handleAddTransaction} className="space-y-6">
          <TransactionForm
            mode="create"
            accounts={accounts}
            projects={projects.map(p => ({ id: p.id, name: p.name || p.id }))}
            members={members}
            administrativeProjectIds={dynamicAdministrativeProjectIds}
            adminPurposes={[...ADMINISTRATIVE_PURPOSES]}
            projectYears={projectYears}
            groupedProjectsForModal={groupedProjectsForModal}
            filteredProjectsForModal={filteredProjectsForModal.map(p => ({ id: p.id, name: p.name || p.id }))}
            editingProjectPurposesByProject={editingProjectPurposesByProject}
            recordFormCategory={recordFormCategory}
            setRecordFormCategory={setRecordFormCategory}
            recordFormMemberId={recordFormMemberId}
            setRecordFormMemberId={setRecordFormMemberId}
            recordFormYear={recordFormYear}
            setRecordFormYear={setRecordFormYear}
            recordFormProjectId={recordFormProjectId}
            setRecordFormProjectId={setRecordFormProjectId}
            editingModalYear={editingModalYear}
            setEditingModalYear={setEditingModalYear}
            inventoryItems={inventoryItems}
          />
        </form>
      </Modal>

      {/* Edit Transaction Modal */}
      {editingTransaction && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => { setIsEditModalOpen(false); setEditingTransaction(null); setEditingMembershipFilterYear(null); setEditingMembershipMemberId(''); setEditingMembershipYear(new Date().getFullYear()); setEditingAdministrativeYear(new Date().getFullYear()); setEditingAdministrativePurposeBase(''); }}
          title="Edit Transaction"
          size="2xl"
          bottomSheet
          drawerOnMobile
          footer={
            <div className="flex gap-2 w-full">
              <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
              <Button className="flex-1 shadow-sm" type="submit" form="edit-transaction-form">Update Transaction</Button>
            </div>
          }
        >
          <form id="edit-transaction-form" onSubmit={handleUpdateTransaction} className="space-y-6">
            <TransactionForm
              mode="edit"
              accounts={accounts}
              projects={projects.map(p => ({ id: p.id, name: p.name || p.id }))}
              members={members}
              administrativeProjectIds={dynamicAdministrativeProjectIds}
              adminPurposes={[...ADMINISTRATIVE_PURPOSES]}
              projectYears={projectYears}
              groupedProjectsForModal={groupedProjectsForModal}
              filteredProjectsForModal={filteredProjectsForModal.map(p => ({ id: p.id, name: p.name || p.id }))}
              editingProjectPurposesByProject={editingProjectPurposesByProject}
              editingTransaction={editingTransaction}
              setEditingTransaction={setEditingTransaction}
              editingMembershipYear={editingMembershipYear}
              setEditingMembershipYear={setEditingMembershipYear}
              editingAdministrativeYear={editingAdministrativeYear}
              setEditingAdministrativeYear={setEditingAdministrativeYear}
              editingAdministrativePurposeBase={editingAdministrativePurposeBase}
              setEditingAdministrativePurposeBase={setEditingAdministrativePurposeBase}
              editingModalYear={editingModalYear}
              setEditingModalYear={setEditingModalYear}
              inventoryItems={inventoryItems}
            />
          </form>
        </Modal>
      )}

      {/* Project Tracker Transactions (Project Trx) Modal */}
      {selectedProjectFilter && selectedProjectInfo && (
        <Modal
          isOpen={isProjectTrxModalOpen}
          onClose={() => setIsProjectTrxModalOpen(false)}
          title={`Configure Project Tracker Transactions - ${selectedProjectInfo.name || selectedProjectInfo.title}`}
          size="4xl"
          bottomSheet={false}
          drawerOnMobile={false}
          footer={
            <div className="flex justify-end w-full">
              <Button variant="ghost" onClick={() => setIsProjectTrxModalOpen(false)}>
                Close
              </Button>
            </div>
          }
        >
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
            {/* Quick Stats Section */}
            <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Project Budget</span>
                <p className="text-sm font-bold text-slate-800">
                  {formatCurrency(selectedProjectInfo.budget || selectedProjectInfo.proposedBudget || 0)}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">PT Total Income</span>
                <p className="text-sm font-bold text-green-600">
                  {formatCurrency(projectTrxList.filter(t => t.type === 'Income').reduce((sum, t) => sum + (t.amount || 0), 0))}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">PT Total Expense</span>
                <p className="text-sm font-bold text-red-600">
                  {formatCurrency(projectTrxList.filter(t => t.type === 'Expense').reduce((sum, t) => sum + (t.amount || 0), 0))}
                </p>
              </div>
            </div>

            {/* Paste Area */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Paste Transactions from Excel / Google Sheets
              </label>
              <p className="text-[11px] text-slate-500 mb-2">
                Copy columns from your spreadsheet: <strong>Description | Remarks | Income | Expense | Date</strong> and paste them in the box below to batch import.
              </p>
              <textarea
                placeholder="Paste copied cells from Excel/Google Sheets here..."
                className="w-full h-14 p-2 text-xs border border-slate-200 rounded focus:outline-none focus:border-jci-blue font-mono"
                onPaste={(e) => {
                  const pastedText = e.clipboardData.getData('Text');
                  if (pastedText) {
                    e.preventDefault();
                    handleProjectTrxPaste(pastedText);
                  }
                }}
                onChange={(e) => {
                  if (e.target.value) {
                    handleProjectTrxPaste(e.target.value);
                    e.target.value = ''; // clear it immediately
                  }
                }}
              />
            </div>

            {/* Add Transaction Section */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Add Single Transaction</h4>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Date</label>
                  <Input
                    type="date"
                    value={projectTrxAddForm.date || ''}
                    onChange={(e) => setProjectTrxAddForm({ ...projectTrxAddForm, date: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-slate-500 mb-1">Description</label>
                  <Input
                    type="text"
                    placeholder="Transaction description"
                    value={projectTrxAddForm.description || ''}
                    onChange={(e) => setProjectTrxAddForm({ ...projectTrxAddForm, description: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Amount</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={projectTrxAddForm.amount || ''}
                    onChange={(e) => setProjectTrxAddForm({ ...projectTrxAddForm, amount: parseFloat(e.target.value) || undefined })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Type</label>
                  <Select
                    value={projectTrxAddForm.type || 'Expense'}
                    onChange={(e) => setProjectTrxAddForm({ ...projectTrxAddForm, type: e.target.value as 'Income' | 'Expense' })}
                    options={[
                      { label: 'Expense', value: 'Expense' },
                      { label: 'Income', value: 'Income' }
                    ]}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                <div className="md:col-span-2">
                  <label className="block text-xs text-slate-500 mb-1">Ref / Remarks</label>
                  <Input
                    type="text"
                    placeholder="e.g. Receipt No, Member Name"
                    value={projectTrxAddForm.referenceNumber || ''}
                    onChange={(e) => setProjectTrxAddForm({ ...projectTrxAddForm, referenceNumber: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Purpose / Section</label>
                  <Input
                    type="text"
                    placeholder="e.g. F&B, Logistics"
                    value={projectTrxAddForm.purpose || ''}
                    onChange={(e) => setProjectTrxAddForm({ ...projectTrxAddForm, purpose: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2 flex gap-2">
                  <Button
                    type="button"
                    onClick={handleAddProjectTrx}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2"
                  >
                    Add
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setProjectTrxAddForm({})}
                    className="py-2"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </div>

            {/* List of Tracker Transactions */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Transaction List ({projectTrxList.length} items)
                </h4>
              </div>
              {projectTrxLoading ? (
                <div className="p-8 flex justify-center">
                  <RefreshCw className="animate-spin text-jci-blue" size={24} />
                </div>
              ) : projectTrxList.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  No project tracker transactions found. Copy and paste or use the form above to add some.
                </div>
              ) : (
                <div className="overflow-x-auto font-sans">
                  <table
                    className="w-full text-left text-xs"
                    onPaste={(e) => {
                      const pastedText = e.clipboardData.getData('Text');
                      if (pastedText && pastedText.includes('\t')) {
                        e.preventDefault();
                        handleProjectTrxPaste(pastedText);
                      }
                    }}
                  >
                    <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] border-b border-slate-100">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Description</th>
                        <th className="p-3">Remarks</th>
                        <th className="p-3">Purpose</th>
                        <th className="p-3">Bank Transaction</th>
                        <th className="p-3 text-right">Amount</th>
                        <th className="p-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {projectTrxList.map((tx) => {
                        const isEditing = projectTrxEditingId === tx.id;
                        return (
                          <tr key={tx.id} className="hover:bg-slate-50/50">
                            <td className="p-3 font-mono">
                              {isEditing ? (
                                <Input
                                  type="date"
                                  className="py-1 px-2 text-xs"
                                  value={projectTrxEditForm.date || ''}
                                  onChange={(e) => setProjectTrxEditForm({ ...projectTrxEditForm, date: e.target.value })}
                                />
                              ) : (
                                formatDate(tx.date)
                              )}
                            </td>
                            <td className="p-3">
                              {isEditing ? (
                                <Select
                                  className="py-1 px-2 text-xs"
                                  value={projectTrxEditForm.type || 'Expense'}
                                  onChange={(e) => setProjectTrxEditForm({ ...projectTrxEditForm, type: e.target.value as 'Income' | 'Expense' })}
                                  options={[
                                    { label: 'Expense', value: 'Expense' },
                                    { label: 'Income', value: 'Income' }
                                  ]}
                                />
                              ) : (
                                <Badge variant={tx.type === 'Income' ? 'success' : 'error'}>
                                  {tx.type}
                                </Badge>
                              )}
                            </td>
                            <td className="p-3 font-medium">
                              {isEditing ? (
                                <Input
                                  type="text"
                                  className="py-1 px-2 text-xs"
                                  value={projectTrxEditForm.description || ''}
                                  onChange={(e) => setProjectTrxEditForm({ ...projectTrxEditForm, description: e.target.value })}
                                />
                              ) : (
                                tx.description
                              )}
                            </td>
                            <td className="p-3 text-slate-500">
                              {isEditing ? (
                                <Input
                                  type="text"
                                  className="py-1 px-2 text-xs"
                                  value={projectTrxEditForm.referenceNumber || ''}
                                  onChange={(e) => setProjectTrxEditForm({ ...projectTrxEditForm, referenceNumber: e.target.value })}
                                />
                              ) : (
                                tx.referenceNumber || '—'
                              )}
                            </td>
                            <td className="p-3 text-slate-500">
                              {isEditing ? (
                                <Input
                                  type="text"
                                  className="py-1 px-2 text-xs"
                                  value={projectTrxEditForm.purpose || ''}
                                  onChange={(e) => setProjectTrxEditForm({ ...projectTrxEditForm, purpose: e.target.value })}
                                />
                              ) : (
                                tx.purpose || '—'
                              )}
                            </td>
                            <td className="p-3">
                              {(() => {
                                const bankInfo = getLinkedBankTxInfo(tx.id);
                                if (!bankInfo) {
                                  return <span className="text-slate-400 italic text-[11px]">Unlinked</span>;
                                }
                                return (
                                  <div className="text-[11px] bg-blue-50/70 text-blue-800 p-1.5 rounded border border-blue-100 flex flex-col gap-0.5 max-w-[180px]">
                                    <div className="flex justify-between items-center text-[9px] text-blue-600 font-medium">
                                      <span className="uppercase font-bold tracking-wider">
                                        {bankInfo.isSplit ? 'Split Match' : 'Bank Match'}
                                      </span>
                                      <span className="font-mono">{formatDate(bankInfo.date)}</span>
                                    </div>
                                    <p className="font-semibold text-slate-800 truncate" title={bankInfo.description}>
                                      {bankInfo.description}
                                    </p>
                                    <div className="flex justify-between items-center text-[9px] text-blue-500 font-semibold">
                                      <span>{bankInfo.bankAccountName}</span>
                                      <span className="font-bold text-blue-700">{formatCurrency(bankInfo.amount)}</span>
                                    </div>
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="p-3 text-right font-semibold">
                              {isEditing ? (
                                <Input
                                  type="number"
                                  step="0.01"
                                  className="py-1 px-2 text-xs text-right"
                                  value={projectTrxEditForm.amount || ''}
                                  onChange={(e) => setProjectTrxEditForm({ ...projectTrxEditForm, amount: parseFloat(e.target.value) || undefined })}
                                />
                              ) : (
                                <span className={tx.type === 'Income' ? 'text-green-600' : 'text-slate-700'}>
                                  {formatCurrency(tx.amount)}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex justify-center gap-1.5">
                                {isEditing ? (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="success"
                                      onClick={() => handleUpdateProjectTrx(tx.id)}
                                      className="py-1 px-2 text-[10px]"
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setProjectTrxEditingId(null)}
                                      className="py-1 px-2 text-[10px]"
                                    >
                                      Cancel
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="p-1"
                                      onClick={() => {
                                        setProjectTrxEditingId(tx.id);
                                        setProjectTrxEditForm(tx);
                                      }}
                                    >
                                      <Edit size={14} className="text-slate-500" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="p-1"
                                      onClick={() => handleDeleteProjectTrx(tx.id)}
                                    >
                                      <Trash2 size={14} className="text-red-500" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Financial Reports Modal */}
      <FinancialReportsModal
        isOpen={isReportsModalOpen}
        onClose={() => setIsReportsModalOpen(false)}
        transactions={transactions}
        accounts={accounts}
        summary={summary}
        reportYear={reportYear}
        reportMonth={reportMonth}
        fiscalYearStart={fiscalYearStart}
        onYearChange={setReportYear}
        onMonthChange={setReportMonth}
        onFiscalYearStartChange={setFiscalYearStart}
      />



      {/* Dues Renewal Modal */}
      <DuesRenewalModal
        isOpen={isDuesRenewalModalOpen}
        onClose={() => setIsDuesRenewalModalOpen(false)}
        year={renewalYear}
        duesAmount={duesAmount}
        onYearChange={setRenewalYear}
        onAmountChange={setDuesAmount}
        onRenew={async () => {
          setIsRenewing(true);
          try {
            const result = await FinanceService.initiateDuesRenewal(renewalYear);
            showToast(
              `Dues renewal initiated: ${result.totalMembers} members processed, ${result.notificationsSent} notifications sent`,
              'success'
            );
            await loadData();
            setIsDuesRenewalModalOpen(false);
          } catch (err) {
            showToast('Failed to initiate dues renewal', 'error');
          } finally {
            setIsRenewing(false);
          }
        }}
        isRenewing={isRenewing}
      />

      {/* Batch Import Modal */}
      <BankTransactionImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImported={async () => {
          await loadData();
        }}
      />

      {/* Transaction Split Modal */}
      {
        selectedTransaction && (
          <TransactionSplitModal
            transaction={selectedTransaction}
            isOpen={isSplitModalOpen}
            adminProjectIds={dynamicAdministrativeProjectIds}
            memberOptions={members}
            projectOptions={projects.map(p => {
              const pDate = p.eventStartDate || p.startDate || p.date || p.proposedDate;
              return {
                id: p.id,
                name: p.name || p.id,
                year: pDate ? new Date(pDate).getFullYear() : undefined
              };
            })}
            administrativePurposes={[...ADMINISTRATIVE_PURPOSES]}
            projectYears={projectYears}
            projectPurposes={projectPurposes}
            onClose={() => {
              setIsSplitModalOpen(false);
              setSelectedTransaction(null);
            }}
            onSuccess={() => {
              showToast('Transaction split created successfully', 'success');
              loadData(); // Reload transactions to show updated data
            }}
          />
        )
      }

      {/* Batch Category Modal */}
      <BatchCategoryModal
        isOpen={isBatchCategoryModalOpen}
        onClose={() => setIsBatchCategoryModalOpen(false)}
        onSuccess={() => {
          showToast('Batch category update applied successfully', 'success');
          setSelectedTxIds(new Set());
          setSelectedSplitIds(new Set());
          loadData();
        }}
        selectedTransactionIds={Array.from(selectedTxIds)}
        selectedSplitIds={Array.from(selectedSplitIds)}
        projects={projects.map(p => {
          const pDate = p.eventStartDate || p.startDate || p.date || p.proposedDate;
          return {
            id: p.id,
            name: p.name || p.title || p.id,
            year: pDate ? new Date(pDate).getFullYear() : undefined
          };
        })}
        members={members}
        administrativeProjectIds={dynamicAdministrativeProjectIds}
        adminPurposes={[...ADMINISTRATIVE_PURPOSES]}
        projectYears={projectYears}
        projectPurposesByProject={editingProjectPurposesByProject}
      />

      {/* Bank Account Detail Drawer */}
      <Drawer
        isOpen={isAccountDetailOpen}
        onClose={() => setIsAccountDetailOpen(false)}
        title={detailAccount ? (detailAccount.bankName ? `${detailAccount.bankName} · ${detailAccount.name}` : detailAccount.name) : 'Account Details'}
        size="lg"
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Monthly Performance</h4>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Reporting Year:</span>
              <select
                value={detailYear}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setDetailYear(val);
                  setReportYear(val);
                  setProjectAccountYearFilter(val);
                }}
                className="text-sm border-slate-200 rounded-lg py-1.5 pl-3 pr-10 focus:ring-jci-blue focus:border-jci-blue bg-white border shadow-sm outline-none transition-all duration-200"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-hidden border border-slate-100 rounded-xl shadow-sm bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] md:text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="py-3 px-4 font-bold text-slate-700 uppercase tracking-tight">Month</th>
                    <th className="py-3 px-4 font-bold text-slate-700 uppercase tracking-tight text-right">Initial</th>
                    <th className="py-3 px-4 font-bold text-green-700 uppercase tracking-tight text-right">Income</th>
                    <th className="py-3 px-4 font-bold text-red-700 uppercase tracking-tight text-right">Expense</th>
                    <th className="py-3 px-4 font-bold text-slate-900 uppercase tracking-tight text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {monthlyAccountSummary.map((data) => (
                    <tr key={data.month} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-600">
                        {new Date(detailYear, data.month).toLocaleString('en', { month: 'short' })}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-right font-mono">
                        {formatCurrency(data.openingBalance, detailAccount?.currency)}
                      </td>
                      <td className="py-3 px-4 text-green-600 font-medium text-right font-mono">
                        {data.income > 0 ? `+${formatCurrency(data.income)}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-red-600 font-medium text-right font-mono">
                        {data.expenses > 0 ? `-${formatCurrency(data.expenses)}` : '—'}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 text-right font-mono">
                        {formatCurrency(data.closingBalance, detailAccount?.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-jci-blue" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Annual Summary</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-0.5">Year Net Flow</p>
                <p className={`text-sm font-bold ${monthlyAccountSummary.reduce((acc, m) => acc + (m.income - m.expenses), 0) >= 0
                  ? 'text-green-600' : 'text-red-600'
                  }`}>
                  {formatCurrency(monthlyAccountSummary.reduce((acc, m) => acc + (m.income - m.expenses), 0))}
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-0.5">Year-End Position</p>
                <p className="text-sm font-bold text-slate-900">
                  {formatCurrency(monthlyAccountSummary[11]?.closingBalance || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Drawer>

      {/* Fixed Bottom Action Bar for Batch Selection */}
      {moduleTab === 'Transactions' && displayTransactions.length > 0 && (selectedTxIds.size + selectedSplitIds.size) > 1 && (
        <div className="fixed bottom-6 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 z-[40] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between md:justify-start gap-2 md:gap-6 bg-slate-900/95 backdrop-blur-md px-4 md:px-6 py-3 md:py-4 rounded-2xl shadow-2xl border border-white/10">
            <div className="flex items-center gap-3 pr-2 md:pr-4 md:border-r border-slate-700">
              <div className="p-1.5 bg-blue-500 rounded-lg flex items-center justify-center">
                <Layers size={18} className="text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] md:text-sm font-bold text-white leading-tight">
                  {batchOperationProgress
                    ? `Processing...`
                    : `${selectedTxIds.size + selectedSplitIds.size} Selected`
                  }
                </span>
                <span className="text-[10px] text-slate-400 font-medium hidden sm:block mt-0.5">
                  {batchOperationProgress
                    ? `${batchOperationProgress.current}/${batchOperationProgress.total}`
                    : `${selectedTxIds.size} main • ${selectedSplitIds.size} splits`
                  }
                </span>
              </div>
            </div>

            {batchOperationProgress ? (
              <div className="flex-1 max-w-[200px] md:w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                <div
                  className="h-full bg-blue-500 transition-all duration-300 ease-out"
                  style={{ width: `${(batchOperationProgress.current / batchOperationProgress.total) * 100}%` }}
                />
              </div>
            ) : (
              <div className="flex items-center gap-1 sm:gap-4">
                <button
                  onClick={() => setIsBatchCategoryModalOpen(true)}
                  className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-blue-400 hover:text-blue-300 transition-all px-2 py-1 rounded-lg hover:bg-white/5"
                >
                  <Settings size={18} />
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Batch Set</span>
                </button>
                <button
                  onClick={handleBatchDelete}
                  className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-red-400 hover:text-red-300 transition-all px-2 py-1 rounded-lg hover:bg-white/5"
                >
                  <Trash2 size={18} />
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Delete</span>
                </button>
                <button
                  onClick={() => {
                    setSelectedTxIds(new Set());
                    setSelectedSplitIds(new Set());
                  }}
                  className="ml-2 p-1.5 text-slate-400 hover:text-white transition-colors"
                  title="Clear selection"
                >
                  <X size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Bank Account Modal */}
      <AddBankAccountModal
        isOpen={isAddAccountModalOpen}
        onClose={() => setIsAddAccountModalOpen(false)}
        onAdded={loadData}
      />

      {/* Bank Transaction Matching Modal */}
      {matchingAccount && (
        <BankMatchingModal
          isOpen={!!matchingAccount}
          onClose={() => setMatchingAccount(null)}
          account={matchingAccount}
          currentUserId={user?.uid ?? ''}
          onComplete={() => { setMatchingAccount(null); loadData(); }}
        />
      )}

      {/* Add Administrative Project ID Modal (行政费户口) */}
      <Modal
        isOpen={isAddAdministrativeProjectOpen}
        onClose={() => setIsAddAdministrativeProjectOpen(false)}
        title="Add Admin Account"
        size="md"
        bottomSheet
        drawerOnMobile
        footer={
          <div className="flex gap-2 w-full">
            <Button variant="ghost" onClick={() => setIsAddAdministrativeProjectOpen(false)}>Cancel</Button>
            <Button className="flex-1" type="submit" form="add-admin-account-form">Add Account</Button>
          </div>
        }
      >
        <form
          id="add-admin-account-form"
          onSubmit={(e) => {
            e.preventDefault();
            const name = (new FormData(e.currentTarget).get('projectId') as string)?.trim();
            if (name) {
              addAdministrativeProjectId(name);
              setAdministrativeProjectIds(getAdministrativeProjectIds());
              showToast('Admin account added successfully', 'success');
              setIsAddAdministrativeProjectOpen(false);
            }
          }}
          className="space-y-4"
        >
          <Input name="projectId" label="Account Name" placeholder="e.g. National Due, Maintenance" required />
        </form>
      </Modal>
    </div>
  );
};

interface FinancialReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  accounts: BankAccount[];
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    byCategory: Record<string, { income: number; expenses: number }>;
  } | null;
  reportYear: number;
  reportMonth: number | null;
  fiscalYearStart?: number; // Month (0-11) when fiscal year starts, default is 0 (January = Calendar Year)
  onYearChange: (year: number) => void;
  onMonthChange: (month: number | null) => void;
  onFiscalYearStartChange?: (month: number) => void;
}

const FinancialReportsModal: React.FC<FinancialReportsModalProps> = ({
  isOpen,
  onClose,
  transactions,
  accounts,
  summary,
  reportYear,
  reportMonth,
  fiscalYearStart = 0,
  onYearChange,
  onMonthChange,
  onFiscalYearStartChange,
}) => {
  const [activeTab, setActiveTab] = useState<'income' | 'expense' | 'balance' | 'cashflow'>('income');
  const { showToast } = useToast();

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const txDate = new Date(t.date);
      const matchesYear = txDate.getFullYear() === reportYear;
      const matchesMonth = reportMonth === null || txDate.getMonth() === reportMonth;
      return matchesYear && matchesMonth;
    });
  }, [transactions, reportYear, reportMonth]);

  const incomeTransactions = useMemo(() => {
    return filteredTransactions.filter(t => t.type === 'Income');
  }, [filteredTransactions]);

  const expenseTransactions = useMemo(() => {
    return filteredTransactions.filter(t => t.type === 'Expense');
  }, [filteredTransactions]);

  const categoryBreakdown = useMemo(() => {
    const breakdown: Record<string, { income: number; expenses: number; count: number }> = {};
    filteredTransactions.forEach(t => {
      if (!breakdown[t.category]) {
        breakdown[t.category] = { income: 0, expenses: 0, count: 0 };
      }
      if (t.type === 'Income') {
        breakdown[t.category].income += t.amount;
      } else {
        breakdown[t.category].expenses += Math.abs(t.amount);
      }
      breakdown[t.category].count += 1;
    });
    return breakdown;
  }, [filteredTransactions]);

  const totalCash = accounts.reduce((sum, acc) => sum + acc.balance, 0);
  const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = expenseTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const netBalance = totalIncome - totalExpenses;

  const handleExport = async () => {
    try {
      // Generate report with fiscal year support
      const report = await FinanceService.generateFinancialReport(
        activeTab,
        reportYear,
        reportMonth || undefined,
        fiscalYearStart
      );

      // Export as CSV (using existing export method but with fiscal year context)
      const csv = await FinanceService.exportFinancialReportAsCSV(
        activeTab,
        reportYear,
        reportMonth || undefined
      );
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `financial-report-${activeTab}-${reportYear}${reportMonth !== null ? `-${reportMonth + 1}` : ''}-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      showToast('Financial report exported successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export report';
      showToast(errorMessage, 'error');
    }
  };

  const handleExportTransactions = async () => {
    try {
      const csv = await FinanceService.exportTransactionsAsCSV(
        reportYear,
        reportMonth || undefined
      );
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `transactions-${reportYear}${reportMonth !== null ? `-${reportMonth + 1}` : ''}-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      showToast('Transactions exported successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export transactions';
      showToast(errorMessage, 'error');
    }
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Financial Reports"
      size="xl"
      bottomSheet
      drawerOnMobile
      footer={
        <div className="flex flex-wrap gap-2 w-full justify-between sm:justify-end">
          <Button variant="outline" onClick={handleExport} className="flex-1 sm:flex-none">
            <Download size={16} className="mr-2" />
            Export Report
          </Button>
          <Button variant="outline" onClick={handleExportTransactions} className="flex-1 sm:flex-none">
            <Download size={16} className="mr-2" />
            Export Transactions
          </Button>
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto mt-2 sm:mt-0">
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Report Filters */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-sm font-medium text-slate-700 mb-1">Year</label>
            <Select
              value={reportYear.toString()}
              onChange={(e) => onYearChange(parseInt(e.target.value))}
              options={years.map(y => ({ label: y.toString(), value: y.toString() }))}
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-sm font-medium text-slate-700 mb-1">Month (Optional)</label>
            <Select
              value={reportMonth === null ? 'all' : reportMonth.toString()}
              onChange={(e) => onMonthChange(e.target.value === 'all' ? null : parseInt(e.target.value))}
              options={[
                { label: 'All Months', value: 'all' },
                ...monthNames.map((name, index) => ({ label: name, value: index.toString() }))
              ]}
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-slate-700 mb-1">Fiscal Year Start</label>
            <Select
              value={fiscalYearStart.toString()}
              onChange={(e) => onFiscalYearStartChange?.(parseInt(e.target.value))}
              options={[
                { label: 'Calendar Year (Jan)', value: '0' },
                { label: 'Fiscal Year (Apr)', value: '3' },
                { label: 'Fiscal Year (Jul)', value: '6' },
                { label: 'Fiscal Year (Oct)', value: '9' },
              ]}
            />
            <p className="text-[10px] text-slate-500 mt-1">
              {fiscalYearStart === 0
                ? 'Calendar Year (Jan-Dec)'
                : `${monthNames[fiscalYearStart]} - ${monthNames[fiscalYearStart - 1] || monthNames[11]}`}
            </p>
          </div>
        </div>

        {/* Report Tabs */}
        <Tabs
          tabs={['Income Statement', 'Expense Report', 'Balance Sheet', 'Cash Flow']}
          activeTab={activeTab === 'income' ? 'Income Statement' : activeTab === 'expense' ? 'Expense Report' : activeTab === 'balance' ? 'Balance Sheet' : 'Cash Flow'}
          onTabChange={(tab) => {
            if (tab === 'Income Statement') setActiveTab('income');
            else if (tab === 'Expense Report') setActiveTab('expense');
            else if (tab === 'Balance Sheet') setActiveTab('balance');
            else setActiveTab('cashflow');
          }}
        />

        {/* Report Content */}
        <div className="min-h-[400px]">
          {activeTab === 'income' && (
            <div className="space-y-4">
              <Card>
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-4 border-b">
                    <h3 className="text-lg font-bold text-slate-900">Income Statement</h3>
                    <div className="text-right">
                      <p className="text-sm text-slate-500">Period</p>
                      <p className="font-semibold text-slate-900">
                        {reportMonth !== null
                          ? `${monthNames[reportMonth]} ${reportYear}`
                          : fiscalYearStart === 0
                            ? `Calendar Year ${reportYear}`
                            : `Fiscal Year ${reportYear} (${monthNames[fiscalYearStart]} - ${monthNames[fiscalYearStart - 1] || monthNames[11]})`}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2">
                      <span className="text-slate-700">Total Income</span>
                      <span className="font-bold text-green-600">{formatCurrency(totalIncome)}</span>
                    </div>
                    <div className="space-y-2 pl-4 border-l-2 border-slate-200">
                      {Object.entries(categoryBreakdown)
                        .filter(([_, data]) => data.income > 0)
                        .map(([category, data]) => (
                          <div key={category} className="flex justify-between items-center text-sm">
                            <span className="text-slate-600">{category}</span>
                            <span className="text-green-600">{formatCurrency(data.income)}</span>
                          </div>
                        ))}
                    </div>
                    <div className="flex justify-between items-center py-2 border-t">
                      <span className="text-slate-700">Total Expenses</span>
                      <span className="font-bold text-red-600">-{formatCurrency(totalExpenses)}</span>
                    </div>
                    <div className="space-y-2 pl-4 border-l-2 border-slate-200">
                      {Object.entries(categoryBreakdown)
                        .filter(([_, data]) => data.expenses > 0)
                        .map(([category, data]) => (
                          <div key={category} className="flex justify-between items-center text-sm">
                            <span className="text-slate-600">{category}</span>
                            <span className="text-red-600">-{formatCurrency(data.expenses)}</span>
                          </div>
                        ))}
                    </div>
                    <div className="flex justify-between items-center py-3 border-t-2 border-slate-300 font-bold text-lg">
                      <span className="text-slate-900">Net Balance</span>
                      <span className={netBalance >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(netBalance)}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'expense' && (
            <div className="space-y-4">
              <Card>
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-900">Expense Report</h3>
                  <div className="space-y-4">
                    {Object.entries(categoryBreakdown)
                      .filter(([_, data]) => data.expenses > 0)
                      .sort(([_, a], [__, b]) => b.expenses - a.expenses)
                      .map(([category, data]) => {
                        const percentage = (data.expenses / totalExpenses) * 100;
                        return (
                          <div key={category} className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-slate-900">{category}</span>
                              <div className="text-right">
                                <span className="font-bold text-slate-900">{formatCurrency(data.expenses)}</span>
                                <span className="text-sm text-slate-500 ml-2">({percentage.toFixed(1)}%)</span>
                              </div>
                            </div>
                            <ProgressBar progress={percentage} />
                            <p className="text-xs text-slate-500">{data.count} transaction{data.count !== 1 ? 's' : ''}</p>
                          </div>
                        );
                      })}
                  </div>
                  <div className="pt-4 border-t flex justify-between items-center font-bold">
                    <span>Total Expenses</span>
                    <span className="text-red-600">{formatCurrency(totalExpenses)}</span>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'balance' && (
            <div className="space-y-4">
              <Card>
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-900">Balance Sheet</h3>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-slate-700 mb-2">Assets</h4>
                      <div className="space-y-2 pl-4">
                        {accounts.map(acc => (
                          <div key={acc.id} className="flex justify-between items-center">
                            <span className="text-slate-600">{acc.name}</span>
                            <span className="font-medium text-slate-900">{formatCurrency(acc.balance, acc.currency)}</span>
                          </div>
                        ))}
                        <div className="pt-2 border-t flex justify-between items-center font-semibold">
                          <span>Total Cash & Bank</span>
                          <span>{formatCurrency(totalCash)}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-700 mb-2">Liabilities</h4>
                      <div className="pl-4">
                        <div className="flex justify-between items-center text-slate-600">
                          <span>No outstanding liabilities</span>
                          <span>{formatCurrency(0)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="pt-4 border-t-2 border-slate-300">
                      <div className="flex justify-between items-center font-bold text-lg">
                        <span>Net Assets</span>
                        <span className="text-green-600">{formatCurrency(totalCash)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'cashflow' && (
            <div className="space-y-4">
              <Card>
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-900">Cash Flow Statement</h3>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                        <TrendingUp className="text-green-600" size={16} />
                        Cash Inflows
                      </h4>
                      <div className="space-y-2 pl-4">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600">Operating Income</span>
                          <span className="font-medium text-green-600">{formatCurrency(totalIncome)}</span>
                        </div>
                        <div className="pt-2 border-t flex justify-between items-center font-semibold">
                          <span>Total Cash Inflows</span>
                          <span className="text-green-600">{formatCurrency(totalIncome)}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                        <TrendingDown className="text-red-600" size={16} />
                        Cash Outflows
                      </h4>
                      <div className="space-y-2 pl-4">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600">Operating Expenses</span>
                          <span className="font-medium text-red-600">-{formatCurrency(totalExpenses)}</span>
                        </div>
                        <div className="pt-2 border-t flex justify-between items-center font-semibold">
                          <span>Total Cash Outflows</span>
                          <span className="text-red-600">-{formatCurrency(totalExpenses)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="pt-4 border-t-2 border-slate-300">
                      <div className="flex justify-between items-center font-bold text-lg">
                        <span>Net Cash Flow</span>
                        <span className={netBalance >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {formatCurrency(netBalance)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

const CheckCircleIcon = ({ size, className }: { size: number, className: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
);


// Add Bank Account Modal
interface AddBankAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded: () => Promise<void>;
}

const AddBankAccountModal: React.FC<AddBankAccountModalProps> = ({ isOpen, onClose, onAdded }) => {
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      setLoading(true);
      await FinanceService.createBankAccount({
        bankName: formData.get('bankName') as string,
        name: formData.get('name') as string,
        accountType: formData.get('type') as 'Current' | 'Savings' | 'Investment' | 'Fixed Deposit' | 'Cash' | 'Other',
        accountNumber: formData.get('accountNumber') as string,
        balance: 0, // This will be dynamically calculated now
        initialBalance: parseFloat(formData.get('initialBalance') as string) || 0,
        currency: formData.get('currency') as string,
        lastReconciled: new Date().toISOString(),
      });

      showToast('Bank account added successfully', 'success');
      await onAdded();
      onClose();
    } catch (error) {
      showToast('Failed to add bank account', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Bank Account"
      size="lg"
      bottomSheet
      drawerOnMobile
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="ghost" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" form="add-bank-account-form" disabled={loading} className="flex-1 sm:flex-none">
            {loading ? 'Adding...' : 'Add Account'}
          </Button>
        </div>
      }
    >
      <form id="add-bank-account-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input name="bankName" label="Bank" placeholder="e.g. Maybank, CIMB" required />
          <Input name="name" label="Account Name" placeholder="e.g. Main Operating Account" required />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            name="type"
            label="Account Type"
            defaultValue="Current"
            options={[
              { label: 'Current', value: 'Current' },
              { label: 'Savings', value: 'Savings' },
              { label: 'Investment', value: 'Investment' },
              { label: 'Fixed Deposit', value: 'Fixed Deposit' },
              { label: 'Cash', value: 'Cash' },
              { label: 'Other', value: 'Other' },
            ]}
            required
          />
          <Input
            name="accountNumber"
            label="Account Number"
            placeholder="e.g. 1234567890"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            onChange={(e: any) => {
              e.target.value = e.target.value.replace(/[^0-9]/g, '');
            }}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input name="initialBalance" label="Initial Balance (Starting Balance)" type="number" step="0.01" placeholder="0.00" required />
          <Select
            name="currency"
            label="Currency"
            defaultValue="MYR"
            options={[
              { label: 'MYR', value: 'MYR' },
              { label: 'USD', value: 'USD' },
              { label: 'SGD', value: 'SGD' },
            ]}
            required
          />
        </div>
      </form>
    </Modal>
  );
};



// Dues Renewal Modal
interface DuesRenewalModalProps {
  isOpen: boolean;
  onClose: () => void;
  year: number;
  duesAmount: number;
  onYearChange: (year: number) => void;
  onAmountChange: (amount: number) => void;
  onRenew: () => Promise<void>;
  isRenewing: boolean;
}

const DuesRenewalModal: React.FC<DuesRenewalModalProps> = ({
  isOpen,
  onClose,
  year,
  duesAmount,
  onYearChange,
  onAmountChange,
  onRenew,
  isRenewing,
}) => {
  const { showToast } = useToast();
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 3 }, (_, i) => currentYear + i);

  const handleRenew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (year < currentYear) {
      showToast('Cannot renew for past years', 'error');
      return;
    }
    await onRenew();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Initiate Annual Dues Renewal"
      size="lg"
      bottomSheet
      drawerOnMobile
      footer={
        <div className="flex gap-3 w-full">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="dues-renewal-form" className="flex-1" disabled={isRenewing}>
            {isRenewing ? 'Initiating...' : 'Initiate Renewal'}
          </Button>
        </div>
      }
    >
      <form id="dues-renewal-form" onSubmit={handleRenew} className="space-y-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-blue-600 mt-0.5" size={20} />
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900 mb-1">Annual Dues Renewal (Calendar Year)</h4>
              <p className="text-sm text-blue-700">
                This will create renewal transactions for all members who paid dues in the previous year ({year - 1}).
                Pro-rata payments will be automatically calculated for mid-year joiners. Notifications will be automatically sent to all affected members.
              </p>
            </div>
          </div>
        </div>

        <Select
          label="Renewal Year"
          value={year.toString()}
          onChange={(e) => onYearChange(parseInt(e.target.value))}
          options={years.map(y => ({ label: y.toString(), value: y.toString() }))}
          required
        />

        <Input
          label="Dues Amount"
          type="number"
          step="0.01"
          value={duesAmount.toString()}
          onChange={(e) => onAmountChange(parseFloat(e.target.value) || 0)}
          placeholder="150.00"
          required
        />

        <div className="p-4 bg-slate-50 rounded-lg space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Previous Year:</span>
            <span className="font-semibold text-slate-900">{year - 1}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Renewal Year:</span>
            <span className="font-semibold text-slate-900">{year}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Full Year Dues Amount:</span>
            <span className="font-semibold text-slate-900">{formatCurrency(duesAmount)}</span>
          </div>
          <div className="pt-2 border-t border-slate-200 mt-2">
            <p className="text-xs text-slate-500">
              <strong>Note:</strong> Pro-rata payments will be automatically calculated for members who joined mid-year ({year}).
              The system calculates: (Full Amount / 12) Ã— Remaining Months.
            </p>
          </div>
        </div>
      </form>
    </Modal>
  );
};
