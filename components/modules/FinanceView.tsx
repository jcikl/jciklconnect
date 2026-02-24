import React, { useState, useEffect, useMemo } from 'react';
import { DollarSign, PieChart, ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle, FileText, Plus, X, Download, Calendar, TrendingUp, TrendingDown, BarChart3, CheckCircle, AlertTriangle, Edit, Trash2, Briefcase, Upload, Layers } from 'lucide-react';
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
import { BatchCategoryModal } from './Finance/BatchCategoryModal';
import { FirstUseBanner } from '../ui/FirstUseBanner';
import { projectFinancialService } from '../../services/projectFinancialService';
import { ProjectsService } from '../../services/projectsService';
import { useHelpModal } from '../../contexts/HelpModalContext';
import { MembersService } from '../../services/membersService';
import { getAdministrativeProjectIds, addAdministrativeProjectId } from '../../utils/administrativeProjectsStorage';
import { InventoryService } from '../../services/inventoryService';
import { ADMINISTRATIVE_PURPOSES } from '../../config/constants';
import type { Project, MembershipType } from '../../types';

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
  const [reportMonth, setReportMonth] = useState<number | null>(null);
  const [fiscalYearStart, setFiscalYearStart] = useState<number>(0); // 0 = Calendar Year (Jan), 3 = Fiscal Year (Apr), etc.
  const [summary, setSummary] = useState<{
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    byCategory: Record<string, { income: number; expenses: number }>;
  } | null>(null);
  const [isReconciliationModalOpen, setIsReconciliationModalOpen] = useState(false);
  const [isDuesRenewalModalOpen, setIsDuesRenewalModalOpen] = useState(false);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const [renewalYear, setRenewalYear] = useState<number>(new Date().getFullYear());
  const [duesAmount, setDuesAmount] = useState<number>(150);
  const [isRenewing, setIsRenewing] = useState(false);
  const [moduleTab, setModuleTab] = useState('Dashboard');
  const [txSearchTerm, setTxSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [txCategoryFilter, setTxCategoryFilter] = useState('All');
  const [bankAccountFilter, setBankAccountFilter] = useState('All');
  const [transactionLimit, setTransactionLimit] = useState(50); // Initial display limit
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

  const isTransactionInCategory = (tx: Transaction, category: string): boolean => {
    if (tx.category === category) return true;
    if (tx.isSplit && transactionSplits[tx.id]) {
      return transactionSplits[tx.id].some(split => split.category === category);
    }
    return false;
  };

  const [projectPurposes, setProjectPurposes] = useState<string[]>([]);
  const [projectAccountYearFilter, setProjectAccountYearFilter] = useState<number>(0); // 0 = All Years
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
  const [isBatchCategoryModalOpen, setIsBatchCategoryModalOpen] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [batchOperationProgress, setBatchOperationProgress] = useState<{ current: number; total: number } | null>(null);
  const [isAccountDetailOpen, setIsAccountDetailOpen] = useState(false);
  const [detailAccount, setDetailAccount] = useState<BankAccount | null>(null);
  const [detailYear, setDetailYear] = useState<number>(new Date().getFullYear());

  const availableYears = useMemo(() => {
    if (!detailAccount) return [new Date().getFullYear()];
    const years = new Set(transactions
      .filter(t => t.bankAccountId === detailAccount.id)
      .map(t => new Date(t.date).getFullYear())
    );
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [detailAccount, transactions]);

  const monthlyAccountSummary = useMemo(() => {
    if (!detailAccount || !transactions.length) return [];

    // Filter for only parent transactions (exclude split children to avoid double counting)
    const accountTxs = transactions.filter(t => t.bankAccountId === detailAccount.id && !t.isSplitChild);

    const startOfYear = new Date(detailYear, 0, 1);
    const balanceBeforeYear = accountTxs
      .filter(t => new Date(t.date) < startOfYear)
      .reduce((sum, t) => sum + (t.type === 'Income' ? t.amount : -t.amount), detailAccount.initialBalance || 0);

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
  }, [detailAccount, detailYear, transactions]);

  const { showToast } = useToast();
  const { hasPermission, isDeveloper } = usePermissions();
  const { user } = useAuth();

  const UNASSIGNED_PROJECT_ID = 'UNASSIGNED_PROJECT'; // Consistent internal ID for uncategorized projects

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
    return Array.from(years).sort((a, b) => b - a);
  }, [projects]);

  // Filter project accounts by selected year
  const filteredProjectAccounts = useMemo(() => {
    if (projectAccountYearFilter === 0) return projectAccounts; // All years

    return projectAccounts.filter(acc => {
      const project = projects.find(p => p.id === acc.projectId);
      if (!project) return false;

      const pDate = project.eventStartDate || project.startDate || project.date || project.proposedDate;
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
            (tx.memberId || '').toLowerCase()
          ];

          const parentMatch = parentFields.some(field => field.includes(term));
          if (parentMatch) return true;

          // 2. Search in splits if applicable
          const splitMatch = transactionSplits[tx.id]?.some(s =>
            s.category.toLowerCase().includes(term) ||
            s.description.toLowerCase().includes(term) ||
            s.purpose?.toLowerCase().includes(term) ||
            String(s.amount).includes(term)
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
      rb = selectedAccount?.initialBalance || 0;
    } else {
      rb = accounts.reduce((sum, acc) => sum + (acc.initialBalance || 0), 0);
    }

    const withBalance = sorted.map(tx => {
      const amountChange = tx.type === 'Income' ? tx.amount : -tx.amount;
      rb += amountChange;
      return { ...tx, runningBalance: rb };
    });

    // 4. Sort Newest -> Oldest for display and Apply limit
    const totalTransactions = [...withBalance].reverse();
    return totalTransactions.slice(0, transactionLimit);
  }, [transactions, txCategoryFilter, debouncedSearchTerm, bankAccountFilter, accounts, transactionSplits, transactionLimit]);

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
            (tx.memberId || '').toLowerCase()
          ];
          if (parentFields.some(field => field.includes(term))) return true;
          return transactionSplits[tx.id]?.some(s =>
            s.category.toLowerCase().includes(term) ||
            s.description.toLowerCase().includes(term) ||
            s.purpose?.toLowerCase().includes(term) ||
            String(s.amount).includes(term) ||
            (s.projectId || '').toLowerCase().includes(term) ||
            (s.memberId || '').toLowerCase().includes(term)
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
    loadData();
  }, []);

  const loadProjectAccounts = async () => {
    setLoadingProjectAccounts(true);
    try {
      const [list, ptTrx] = await Promise.all([
        projectFinancialService.getAllProjectAccounts(),
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
      loadProjectAccounts();
    }
  }, [moduleTab]);

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
        membershipType: m.membershipType,
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

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [txs, accts, summ, inventory, projList, memberList] = await Promise.all([
        FinanceService.getAllTransactions(),
        FinanceService.getAllBankAccounts(),
        FinanceService.getFinancialSummary(reportYear),
        InventoryService.getAllItems(),
        ProjectsService.getAllProjects(),
        MembersService.getAllMembers()
      ]);
      setTransactions(txs);
      setAccounts(accts);
      setSummary(summ);
      setInventoryItems(inventory);
      setProjects(projList);
      setAdministrativeProjectIds(getAdministrativeProjectIds());

      const mappedMembers = memberList.map(m => ({
        id: m.id,
        name: m.fullName && m.name
          ? `${m.fullName} (${m.name})`
          : (m.fullName || m.name || m.email || m.id),
        membershipType: m.membershipType,
      }));
      setMembers(mappedMembers);

      const allSplits = await FinanceService.getAllTransactionSplits();
      const splitsMap: Record<string, TransactionSplit[]> = {};
      allSplits.forEach(split => {
        if (!splitsMap[split.parentTransactionId]) {
          splitsMap[split.parentTransactionId] = [];
        }
        splitsMap[split.parentTransactionId].push(split);
      });
      setTransactionSplits(splitsMap);
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
        const m = members.find(x => x.id === memberId);
        const membershipType = m?.membershipType ?? 'Full';
        projectId = `${year} membership`;
        purpose = `${year} ${membershipType} membership`;
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
      const m = members.find(x => x.id === memberIdVal);
      const membershipType = m?.membershipType ?? 'Full';
      projectIdVal = `${year} membership`;
      purposeVal = `${year} ${membershipType} membership`;
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Financial Management</h2>
          <p className="text-slate-500">Automated bookkeeping, dues collection, and budgeting.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsReportsModalOpen(true)}>
            <FileText size={16} className="mr-2" /> Reports
          </Button>
          {hasPermission('canEditFinance') && (
            <>
              <Button variant="outline" onClick={() => setIsReconciliationModalOpen(true)}>
                <RefreshCw size={16} className="mr-2" /> Reconcile Account
              </Button>
              <Button variant="outline" onClick={() => setIsDuesRenewalModalOpen(true)}>
                <Calendar size={16} className="mr-2" /> Renew Dues
              </Button>
              <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
                <Upload size={16} className="mr-2" /> Batch Import
              </Button>
            </>
          )}
          <Button onClick={() => { setAddDefaultCategory(null); setRecordFormCategory('Projects & Activities'); setIsModalOpen(true); }}><DollarSign size={16} className="mr-2" /> New Transaction</Button>
        </div>
      </div>

      <div className="px-4 md:px-6">
        <Tabs
          tabs={['Dashboard', 'Transactions', 'Project Account', 'Membership', 'Administrative', 'Reconciliation', 'Cross-Account & Errors']}
          activeTab={moduleTab}
          onTabChange={setModuleTab}
        />
      </div>

      {moduleTab === 'Dashboard' && (
        <div className="space-y-6">
          {/* Stat Cards */}
          <LoadingState loading={loading} error={error}>
            <StatCardsContainer>
              <StatCard
                title="Total Cash on Hand"
                value={formatCurrency(dashboardStats.totalCash, accounts[0]?.currency || 'USD')}
                icon={<DollarSign size={20} />}
                subtext="Across all accounts"
              />
              <StatCard
                title="Net Balance (This Year)"
                value={summary ? formatCurrency(summary.netBalance) : '$0.00'}
                icon={<RefreshCw size={20} />}
                subtext={summary ? `${formatCurrency(summary.totalIncome)} income, ${formatCurrency(summary.totalExpenses)} expenses` : 'Loading...'}
                trend={summary && summary.netBalance > 0 ? 10 : -5}
              />
              <StatCard
                title="Pending Transactions"
                value={dashboardStats.pendingCount.toString()}
                icon={<AlertCircle size={20} />}
                subtext={`${dashboardStats.pendingExpensesCount} expenses need approval`}
              />
            </StatCardsContainer>
          </LoadingState>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Content: Transactions */}
            <div className="lg:col-span-2 space-y-6">
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
                    <div className="overflow-x-auto">
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
                              <td className={`py-3 text-right pr-2 font-mono font-medium ${tx.type === 'Income' ? 'text-green-600' : 'text-slate-900'}`}>
                                {tx.type === 'Income' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-blue-50 rounded-lg text-jci-blue">
                    <RefreshCw size={24} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-900">Annual Renewal Cycle ({new Date().getFullYear()})</h4>
                    <p className="text-sm text-slate-500">
                      {(() => {
                        const currentYear = new Date().getFullYear();
                        const duesTransactions = transactions.filter(t => {
                          const txYear = new Date(t.date).getFullYear();
                          return txYear === currentYear && isTransactionInCategory(t, 'Membership');
                        });
                        const pendingCount = duesTransactions.filter(t => t.status === 'Pending').length;
                        const clearedCount = duesTransactions.filter(t => t.status === 'Cleared').length;
                        return `Pending: ${pendingCount} | Paid: ${clearedCount}`;
                      })()}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {(() => {
                    const currentYear = new Date().getFullYear();
                    const duesTransactions = transactions.filter(t => {
                      const txYear = new Date(t.date).getFullYear();
                      return txYear === currentYear && isTransactionInCategory(t, 'Membership') && t.type === 'Income';
                    });
                    const totalDues = duesTransactions.reduce((sum, t) => sum + t.amount, 0);
                    const clearedDues = duesTransactions.filter(t => t.status === 'Cleared').reduce((sum, t) => sum + t.amount, 0);
                    const target = duesTransactions.length * 150; // Assuming 150 per member
                    const progress = target > 0 ? (clearedDues / target) * 100 : 0;
                    return (
                      <>
                        <ProgressBar progress={progress} label="Collection Progress" />
                        <p className="text-xs text-slate-500 text-right">
                          Target: {formatCurrency(target)} / Collected: {formatCurrency(clearedDues)}
                        </p>
                      </>
                    );
                  })()}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const currentYear = new Date().getFullYear();
                        const remindersSent = await FinanceService.sendDuesReminders(currentYear, 30);
                        showToast(`${remindersSent} reminder notifications sent`, 'success');
                      } catch (err) {
                        showToast('Failed to send reminders', 'error');
                      }
                    }}
                  >
                    Send Reminders
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setIsDuesRenewalModalOpen(true)}>
                    Configure Renewal
                  </Button>
                </div>
              </Card>
            </div>

            {/* Sidebar: Accounts */}
            <div className="space-y-6">
              <Card title="Bank Accounts">
                <div className="space-y-4">
                  {accounts.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">No bank accounts configured</p>
                  ) : (
                    accounts.map(acc => (
                      <div
                        key={acc.id}
                        className="p-4 rounded-lg border border-slate-100 bg-slate-50 hover:border-jci-blue transition-all duration-200 cursor-pointer group shadow-sm hover:shadow-md"
                        onClick={() => {
                          setDetailAccount(acc);
                          setDetailYear(new Date().getFullYear());
                          setIsAccountDetailOpen(true);
                        }}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <p className="text-xs text-slate-500 uppercase font-medium">
                            {acc.bankName ? `${acc.bankName} · ` : ''}{acc.name}
                          </p>
                          {hasPermission('canEditFinance') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAccount(acc);
                                setIsReconciliationModalOpen(true);
                              }}
                              className="text-xs group-hover:bg-white transition-colors"
                            >
                              <RefreshCw size={12} className="mr-1" />
                              Reconcile
                            </Button>
                          )}
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-1">{formatCurrency(acc.balance, acc.currency)}</h3>
                        <p className="text-xs text-slate-400 mb-2">Initial: {formatCurrency(acc.initialBalance || 0, acc.currency)}</p>
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center text-green-600">
                            <CheckCircle size={12} className="mr-1" />
                            <span>Reconciled: {formatDate(acc.lastReconciled)}</span>
                          </div>
                          {acc.accountNumber && (
                            <span className="text-slate-500">****{acc.accountNumber.slice(-4)}</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  <Button
                    variant="outline"
                    className="w-full text-sm"
                    onClick={() => setIsAddAccountModalOpen(true)}
                  >
                    Add Account
                  </Button>
                </div>
              </Card>

              <Card title="Budget Health">
                <div className="relative pt-1">
                  <div className="flex mb-2 items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-200">
                        Operating Budget
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold inline-block text-blue-600">
                        60% Used
                      </span>
                    </div>
                  </div>
                  <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-200">
                    <div style={{ width: "60%" }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-jci-blue"></div>
                  </div>
                </div>
                <p className="text-sm text-slate-500">Projected surplus of $2,300 by year end based on current spending.</p>
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
          members={members}
        />
      )}

      {moduleTab === 'Administrative' && hasPermission('canViewFinance') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                <div className="lg:col-span-1 space-y-6">
                  <Card title={`Administrative Summary ${activeYear === 0 ? '(All Time)' : `(${activeYear})`}`}>
                    <div className="mb-4">
                      <Select
                        label="Filter by Year"
                        value={adminAccountYearFilter.toString()}
                        onChange={(e) => setAdminAccountYearFilter(parseInt(e.target.value, 10))}
                        options={[
                          { label: 'All Years', value: '0' },
                          ...adminAccountYearOptions.map(year => ({
                            label: year.toString(),
                            value: year.toString()
                          }))
                        ]}
                      />
                    </div>
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
                  <Card
                    title="Admin Accounts"
                    action={hasPermission('canEditFinance') && (
                      <Button size="sm" onClick={() => setIsAddAdministrativeProjectOpen(true)}>
                        <Plus size={14} className="mr-1" /> Add Account
                      </Button>
                    )}
                  >
                    <div className="divide-y divide-slate-100">
                      {adminByProjectId.length === 0 ? (
                        <p className="py-4 text-sm text-slate-500">No admin accounts found.</p>
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
                              className={`py-3 px-2 flex justify-between items-center cursor-pointer rounded-lg transition-colors ${isActive ? 'bg-jci-blue/10 ring-1 ring-jci-blue/30' : 'hover:bg-slate-50'}`}
                            >
                              <span className={`font-medium ${isActive ? 'text-jci-blue' : 'text-slate-900'}`}>{projectId === UNASSIGNED_PROJECT_ID ? 'Unassigned' : projectId}</span>
                              <div className="text-right text-sm">
                                <span className="text-green-600">+{formatCurrency(income)}</span>
                                <span className="text-slate-400 mx-1">/</span>
                                <span className="text-red-600">-{formatCurrency(expenses)}</span>
                                <div className={`font-medium ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(net)}</div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </Card>
                </div>
                <div className="lg:col-span-2">
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
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                              <thead className="bg-slate-50 text-slate-500">
                                <tr>
                                  <th className="py-3 px-4 font-semibold">Date</th>
                                  <th className="py-3 px-4 font-semibold">Description</th>
                                  <th className="py-3 px-4 font-semibold">Account</th>
                                  <th className="py-3 px-4 font-semibold">Ref No.</th>
                                  <th className="py-3 px-4 font-semibold">Type</th>
                                  <th className="py-3 px-4 font-semibold">Status</th>
                                  <th className="py-3 px-4 font-semibold text-right">Amount</th>
                                  <th className="py-3 px-4 font-semibold text-center">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredAdminTx
                                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                  .map(tx => (
                                    <tr key={tx.id} className="hover:bg-slate-50">
                                      <td className="py-3 px-4 text-slate-500">{formatDate(tx.date)}</td>
                                      <td className="py-3 px-4 font-medium text-slate-900">{tx.description}</td>
                                      <td className="py-3 px-4 text-slate-600">{tx.projectId ? (projects.find(p => p.id === tx.projectId)?.name ?? tx.projectId) : '—'}</td>
                                      <td className="py-3 px-4 text-slate-600">{tx.referenceNumber ?? '—'}</td>
                                      <td className="py-3 px-4">
                                        <Badge variant={tx.type === 'Income' ? 'success' : 'neutral'}>{tx.type}</Badge>
                                      </td>
                                      <td className="py-3 px-4">
                                        {(() => {
                                          const hasProjectId = tx.projectId && tx.projectId.trim() !== '';
                                          const hasPurpose = tx.purpose && tx.purpose.trim() !== '';
                                          if (tx.isSplit) {
                                            return <Badge variant="info">Split</Badge>;
                                          } else if (hasProjectId && hasPurpose) {
                                            return <Badge variant="success">Categorized</Badge>;
                                          } else {
                                            return <Badge variant="warning">Uncategorized</Badge>;
                                          }
                                        })()}
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
                        </LoadingState>
                      );
                    })()}
                  </Card>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {moduleTab === 'Reconciliation' && hasPermission('canViewFinance') && (
        <Card title="Reconcile by Reference Number">
          <FirstUseBanner flowId="reconciliation" dismissLabel="Got it" variant="teal" onHelpClick={helpModal?.openHelp}>
            Enter a reference number (e.g. PR-default-lo-20250216-001) to search both bank transactions and payment requests. Once verified, click "Mark Reconciled" to record the action.
          </FirstUseBanner>
          <p className="text-sm text-slate-500 mb-4 mt-4">Enter a reference number (e.g. PR-default-lo-20250216-001) to find matching transactions and payment requests, then mark as received.</p>
          <div className="flex flex-wrap gap-2 mb-4">
            <Input
              placeholder="Reference Number"
              value={refNumberQuery}
              onChange={(e) => setRefNumberQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleReconciliationQuery()}
              className="max-w-xs"
              aria-label="Search transactions and payment requests by reference number"
            />
            <Button onClick={handleReconciliationQuery} disabled={reconciliationLoading}>{reconciliationLoading ? 'Searching…' : 'Search'}</Button>
          </div>
          {reconciliationLoading ? (
            <LoadingState loading>{null}</LoadingState>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-slate-800 mb-2">Transactions ({reconciliationTx.length})</h4>
                <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                  {reconciliationTx.length === 0 ? (
                    <li className="py-4 px-4 text-slate-500 text-sm">No matching transactions found.</li>
                  ) : (
                    reconciliationTx.map((tx) => (
                      <li key={tx.id} className="py-3 px-4 flex flex-wrap items-center justify-between gap-2 bg-white">
                        <div>
                          <span className="font-medium">{formatDate(tx.date)}</span>
                          <span className="text-slate-600 ml-2">{tx.description}</span>
                          <span className="text-slate-500 ml-2">{formatCurrency(tx.amount)}</span>
                        </div>
                        <div className="flex items-center gap-2">
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
                <h4 className="font-medium text-slate-800 mb-2">Payment Requests ({reconciliationPRs.length})</h4>
                <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                  {reconciliationPRs.length === 0 ? (
                    <li className="py-4 px-4 text-slate-500 text-sm">No matching payment requests found.</li>
                  ) : (
                    reconciliationPRs.map((pr) => (
                      <li key={pr.id} className="py-3 px-4 bg-white">
                        <span className="font-medium">{pr.referenceNumber}</span>
                        <span className="text-slate-600 ml-2">{pr.purpose}</span>
                        <span className="text-slate-500 ml-2">{formatCurrency(pr.amount)}</span>
                        <Badge variant={pr.status === 'approved' ? 'success' : 'warning'} className="ml-2">{pr.status === 'approved' ? 'Approved' : pr.status === 'rejected' ? 'Rejected' : 'Pending'}</Badge>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          )}
        </Card>
      )}

      {moduleTab === 'Cross-Account & Errors' && (hasPermission('canViewFinance') || isDeveloper) && (
        <div className="space-y-6">
          <Card title="Multi-Account Posting Rules">
            <p className="text-sm text-slate-500 mb-4">The treasurer can view or configure multi-account posting rules here (by bank account, activity, type, etc.).</p>
            <ul className="list-disc list-inside text-slate-700 space-y-1 text-sm">
              <li>Default transactions are posted to the selected bank account; splits can specify a category (Membership / Activity / Administrative / Merchandise).</li>
              <li>Activity-related income can be linked to an activity and posted to the corresponding project account.</li>
              <li>Posting rules are maintained by administrators in Settings; this view is read-only.</li>
            </ul>
          </Card>
          <Card title="Misposted Entry Transfer Process & Log">
            <p className="text-sm text-slate-500 mb-4">When a transaction is posted to the wrong account, follow this process to register and verify the internal transfer.</p>
            <ol className="list-decimal list-inside text-slate-700 space-y-2 text-sm">
              <li>Confirm the misposted entry: verify the description, amount, date, and correct account.</li>
              <li>Add a note in the transaction record (e.g. "Pending Transfer") or use the split/adjustment feature.</li>
              <li>Execute the internal transfer: post the same amount to the target account (note: "Transferred from XX account") and record a reversal or negative amount in the original account.</li>
              <li>Update reconciliation status: mark both entries as reconciled and note the cross-account adjustment in the remarks.</li>
              <li>Log: the treasurer can view "Pending Transfer" or "Transferred" entries here (data connection in a future iteration).</li>
            </ol>
            <div className="mt-4 p-3 bg-slate-50 rounded-lg text-slate-600 text-sm">This is currently a process guide and placeholder. The misposted transfer log and automation rules will be connected to data in a future iteration.</div>
          </Card>
        </div>
      )}

      {moduleTab === 'Project Account' && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <Card title="Project Statistics">
              <div className="mb-4">
                <Select
                  label="Filter by Year"
                  value={projectAccountYearFilter.toString()}
                  onChange={(e) => setProjectAccountYearFilter(parseInt(e.target.value, 10))}
                  options={[
                    { label: 'All Years', value: '0' },
                    ...projectAccountYearOptions.map(year => ({
                      label: year.toString(),
                      value: year.toString()
                    }))
                  ]}
                />
              </div>
              <p className="text-sm text-slate-500 mb-2">
                Total Projects: <span className="font-medium text-slate-900">{filteredProjectAccounts.length}</span>
              </p>
              <p className="text-sm text-slate-500 mb-2">
                Total Balance: <span className="font-medium text-slate-900">{formatCurrency(filteredProjectAccounts.reduce((sum, acc) => sum + acc.currentBalance, 0))}</span>
              </p>
              <p className="text-sm text-slate-500 mb-2">
                Avg. Balance: <span className="font-medium text-slate-900">{formatCurrency(filteredProjectAccounts.length > 0 ? filteredProjectAccounts.reduce((sum, acc) => sum + acc.currentBalance, 0) / filteredProjectAccounts.length : 0)}</span>
              </p>
              <p className="text-sm text-slate-500 mb-2">
                Positive Balance: <span className="font-medium text-green-600">{filteredProjectAccounts.filter(acc => acc.currentBalance >= 0).length}</span>
              </p>
              <p className="text-sm text-slate-500 mb-2">
                Negative Balance: <span className="font-medium text-red-600">{filteredProjectAccounts.filter(acc => acc.currentBalance < 0).length}</span>
              </p>
              <p className="text-sm text-slate-500 mb-2">
                Unassigned Transactions: <span className="font-medium text-slate-900">{uncategorizedProjectTxCount}</span>
              </p>
            </Card>
            <Card title="Project Accounts">
              <LoadingState loading={loadingProjectAccounts} error={null} empty={filteredProjectAccounts.length === 0 && uncategorizedProjectTxCount === 0} emptyMessage="No project accounts found. Create a project in the 'Projects' section and set up its financial account.">
                <div className="divide-y divide-slate-100">
                  {[
                    ...(uncategorizedProjectTxCount > 0 ? [{
                      id: 'uncategorized',
                      projectId: UNASSIGNED_PROJECT_ID,
                      projectName: 'Unassigned',
                      currentBalance: 0, // Placeholder, actual balance not tracked here
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
                        className={`py-3 px-2 cursor-pointer rounded-lg transition-colors ${isActive ? 'bg-jci-blue/10 ring-1 ring-jci-blue/30' : 'hover:bg-slate-50'}`}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <Briefcase size={18} className={`text-slate-600 ${isActive ? 'text-jci-blue' : ''}`} />
                            <span className={`font-medium ${isActive ? 'text-jci-blue' : 'text-slate-900'}`}>{acc.projectName}</span>
                            {/* Green check logic: Only show if NOT unassigned and matches perfectly */}
                            {acc.projectId !== UNASSIGNED_PROJECT_ID && isMatch && (
                              <CheckCircle size={16} className="text-green-600 ml-1" />
                            )}
                          </div>
                          {acc.projectId === UNASSIGNED_PROJECT_ID && (
                            <div className="font-medium text-slate-500 text-sm">{uncategorizedProjectTxCount} entries</div>
                          )}
                        </div>

                        {acc.projectId !== UNASSIGNED_PROJECT_ID && (
                          <div className="bg-white/50 rounded-md p-2 text-xs">
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
          </div>
          <div className="lg:col-span-2">
            <Card
              title={selectedProjectFilter === UNASSIGNED_PROJECT_ID ? 'Project Transactions · Unassigned' : (selectedProjectFilter ? `Project Transactions · ${projectAccounts.find(p => p.projectId === selectedProjectFilter)?.projectName || selectedProjectFilter}` : 'Project Transactions')}
              action={selectedProjectFilter && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedProjectFilter(null)}>Clear Filter</Button>
              )}
            >
              {(() => {
                const filteredProjectTx = projectTransactions;
                return (
                  <LoadingState loading={loading} error={error} empty={filteredProjectTx.length === 0} emptyMessage={selectedProjectFilter ? `No transactions for this project.` : "No project transactions found. Use 'New Transaction' above to add one."}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            <th className="py-3 px-4 font-semibold">Date</th>
                            <th className="py-3 px-4 font-semibold">Description</th>
                            <th className="py-3 px-4 font-semibold">Project</th>
                            <th className="py-3 px-4 font-semibold">Ref No.</th>
                            <th className="py-3 px-4 font-semibold">Type</th>
                            <th className="py-3 px-4 font-semibold">Status</th>
                            <th className="py-3 px-4 font-semibold text-right">Amount</th>
                            <th className="py-3 px-4 font-semibold text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredProjectTx
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .map(tx => (
                              <tr key={tx.id} className="hover:bg-slate-50">
                                <td className="py-3 px-4 text-slate-500">{formatDate(tx.date)}</td>
                                <td className="py-3 px-4 font-medium text-slate-900">{tx.description}</td>
                                <td className="py-3 px-4 text-slate-600">{tx.projectId ? (projects.find(p => p.id === tx.projectId)?.name || tx.projectId) : '—'}</td>
                                <td className="py-3 px-4 text-slate-600">{tx.referenceNumber ?? '—'}</td>
                                <td className="py-3 px-4">
                                  <Badge variant={tx.type === 'Income' ? 'success' : 'neutral'}>{tx.type}</Badge>
                                </td>
                                <td className="py-3 px-4">
                                  {(() => {
                                    const hasProjectId = tx.projectId && tx.projectId.trim() !== '';
                                    const hasPurpose = tx.purpose && tx.purpose.trim() !== '';
                                    if (tx.isSplit) {
                                      return <Badge variant="info">Split</Badge>;
                                    } else if (hasProjectId && hasPurpose) {
                                      return <Badge variant="success">Categorized</Badge>;
                                    } else {
                                      return <Badge variant="warning">Uncategorized</Badge>;
                                    }
                                  })()}
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
                  </LoadingState>
                );
              })()}
            </Card>
          </div>
        </div>
      )}

      {moduleTab === 'Transactions' && (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="w-full md:w-48">
                <Select
                  value={bankAccountFilter}
                  onChange={(e) => setBankAccountFilter(e.target.value)}
                  options={[
                    { label: 'All Accounts', value: 'All' },
                    ...accounts.map(acc => ({ label: acc.name, value: acc.id }))
                  ]}
                />
              </div>
              <div className="w-full md:w-48">
                <Select
                  value={txCategoryFilter}
                  onChange={(e) => setTxCategoryFilter(e.target.value)}
                  options={[
                    { label: 'All Categories', value: 'All' },
                    { label: 'Projects & Activities', value: 'Projects & Activities' },
                    { label: 'Membership', value: 'Membership' },
                    { label: 'Administrative', value: 'Administrative' },
                    { label: 'Uncategorized', value: 'Uncategorized' }
                  ]}
                />
              </div>
            </div>

            <LoadingState loading={loading} error={error} empty={transactions.length === 0} emptyMessage="No transactions found">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="py-3 px-2 w-8">
                        <input
                          type="checkbox"
                          checked={(() => {
                            const allVisibleTxIds = displayTransactions.map(t => t.id);
                            const allVisibleSplitIds = displayTransactions.flatMap(t =>
                              t.isSplit && transactionSplits[t.id] ? transactionSplits[t.id].map(s => s.id) : []
                            );
                            return allVisibleTxIds.length > 0 && allVisibleTxIds.every(id => selectedTxIds.has(id)) &&
                              (allVisibleSplitIds.length === 0 || allVisibleSplitIds.every(id => selectedSplitIds.has(id)));
                          })()}
                          onChange={handleSelectAllTransactions}
                          className="accent-blue-600 cursor-pointer"
                        />
                      </th>
                      <th className="py-3 px-4 font-semibold">Date</th>
                      <th className="py-3 px-4 font-semibold">Description</th>
                      <th className="py-3 px-4 font-semibold">Ref No.</th>
                      <th className="py-3 px-4 font-semibold">Category</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Amount</th>
                      <th className="py-3 px-4 font-semibold text-right">Running Balance</th>
                      <th className="py-3 px-4 font-semibold text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayTransactions.map(tx => (
                      <React.Fragment key={tx.id}>
                        {/* Parent Transaction Row */}
                        <tr className={`hover:bg-slate-50 transition-colors ${selectedTxIds.has(tx.id) ? 'bg-blue-50/60' : ''}`}>
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
                          <td className="py-4 px-4 text-slate-500">{formatDate(tx.date)}</td>
                          <td className="py-4 px-4">
                            <div className="font-medium text-slate-900">{tx.description}</div>
                            <div className="text-xs text-slate-400">{tx.type}</div>
                            {tx.isSplit && (
                              <div className="text-xs text-blue-600 mt-1">⤷ Split into {transactionSplits[tx.id]?.length || 0} parts</div>
                            )}
                          </td>
                          <td className="py-4 px-4 text-slate-600">{tx.referenceNumber ?? '—'}</td>
                          <td className="py-4 px-4">
                            <Badge variant={tx.isSplit ? "info" : "neutral"}>{tx.isSplit ? "Split" : (tx.category || "—")}</Badge>
                          </td>
                          <td className="py-4 px-4">
                            {(() => {
                              const hasProjectId = tx.projectId && tx.projectId.trim() !== '';
                              const hasPurpose = tx.purpose && tx.purpose.trim() !== '';
                              if (tx.isSplit) {
                                return <Badge variant="info">Split</Badge>;
                              } else if (hasProjectId && hasPurpose) {
                                return <Badge variant="success">Categorized</Badge>;
                              } else {
                                return <Badge variant="warning">Uncategorized</Badge>;
                              }
                            })()}
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
                            <td className="py-2 px-2 w-8">
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
                            <td className="py-2 px-4 pl-12">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-slate-400">↳</span>
                                <span className="text-slate-600">{split.description}</span>
                              </div>
                            </td>
                            <td className="py-2 px-4"></td>
                            <td className="py-2 px-4">
                              <Badge variant="info" className="text-xs">{split.category}</Badge>
                            </td>
                            <td className="py-2 px-4">
                              {(() => {
                                const hasProjectId = split.projectId && split.projectId.trim() !== '';
                                const hasPurpose = split.purpose && split.purpose.trim() !== '';
                                if (hasProjectId && hasPurpose) {
                                  return <Badge variant="success" className="text-xs">Categorized</Badge>;
                                } else {
                                  return <Badge variant="warning" className="text-xs">Uncategorized</Badge>;
                                }
                              })()}
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
                  </tbody>
                </table>
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
          </Card>
        </div>
      )
      }

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setAddDefaultCategory(null); setRecordFormCategory('Projects & Activities'); setRecordFormMemberId(''); setRecordFormYear(new Date().getFullYear()); setRecordFormProjectId(''); }} title="Record Transaction" drawerOnMobile>
        <form onSubmit={handleAddTransaction} className="space-y-6">
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

          <div className="pt-4">
            <Button className="w-full" type="submit">Save Transaction</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Transaction Modal */}
      {editingTransaction && (
        <Modal isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); setEditingTransaction(null); setEditingMembershipFilterYear(null); setEditingMembershipMemberId(''); setEditingMembershipYear(new Date().getFullYear()); setEditingAdministrativeYear(new Date().getFullYear()); setEditingAdministrativePurposeBase(''); }} title="Edit Transaction" drawerOnMobile>
          <form onSubmit={handleUpdateTransaction} className="space-y-6">
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

            <div className="pt-4">
              <Button className="w-full h-11 text-base shadow-sm" type="submit">Update Transaction</Button>
            </div>
          </form>
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

      {/* Bank Account Reconciliation Modal */}
      <BankReconciliationModal
        isOpen={isReconciliationModalOpen}
        onClose={() => {
          setIsReconciliationModalOpen(false);
          setSelectedAccount(null);
        }}
        accounts={accounts}
        onReconcile={async () => {
          await loadData();
          setIsReconciliationModalOpen(false);
          setSelectedAccount(null);
        }}
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
            name: p.name || p.id,
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
                onChange={(e) => setDetailYear(Number(e.target.value))}
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-6 bg-slate-900/95 backdrop-blur-sm px-6 py-3 rounded-full shadow-2xl border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-1 bg-blue-500 rounded-md">
                <Layers size={18} className="text-white" />
              </div>
              <div className="flex flex-col pr-4 border-r border-slate-700">
                <span className="text-sm font-bold text-white leading-none">
                  {batchOperationProgress
                    ? `Processing ${batchOperationProgress.current}/${batchOperationProgress.total}...`
                    : `${selectedTxIds.size + selectedSplitIds.size} selected`
                  }
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  {batchOperationProgress
                    ? 'Please wait while we update your records'
                    : `${selectedTxIds.size} main • ${selectedSplitIds.size} splits`
                  }
                </span>
              </div>
            </div>

            {batchOperationProgress ? (
              <div className="w-48 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                <div
                  className="h-full bg-blue-500 transition-all duration-300 ease-out"
                  style={{ width: `${(batchOperationProgress.current / batchOperationProgress.total) * 100}%` }}
                />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {(() => {
                  const allVisibleTxIds = displayTransactions.map(t => t.id);
                  const allVisibleSplitIds = displayTransactions.flatMap(t =>
                    t.isSplit && transactionSplits[t.id] ? transactionSplits[t.id].map(s => s.id) : []
                  );
                  const isAllSelected = allVisibleTxIds.length > 0 && allVisibleTxIds.every(id => selectedTxIds.has(id)) &&
                    (allVisibleSplitIds.length === 0 || allVisibleSplitIds.every(id => selectedSplitIds.has(id)));

                  return !isAllSelected && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAllTransactions}
                      className="text-slate-300 hover:text-white hover:bg-slate-800 rounded-full h-9 px-4 flex items-center gap-1.5"
                    >
                      <CheckCircle size={14} />
                      Select All
                    </Button>
                  );
                })()}

                {(selectedTxIds.size > 0 || selectedSplitIds.size > 0) && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setSelectedTxIds(new Set()); setSelectedSplitIds(new Set()); }}
                      className="text-slate-300 hover:text-white hover:bg-slate-800 rounded-full h-9 px-4"
                    >
                      Clear
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBatchApprove}
                      className="border-green-500/50 text-green-500 hover:bg-green-500 hover:text-white rounded-full h-9 px-5 font-semibold transition-all duration-200 flex items-center gap-1.5"
                    >
                      <CheckCircle size={14} />
                      Batch Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBatchDelete}
                      className="border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white rounded-full h-9 px-5 font-semibold transition-all duration-200 flex items-center gap-1.5"
                    >
                      <Trash2 size={14} />
                      Batch Delete
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setIsBatchCategoryModalOpen(true)}
                      className="bg-blue-600 hover:bg-blue-500 text-white rounded-full h-9 px-5 font-semibold shadow-lg shadow-blue-500/20"
                    >
                      Batch Set Category
                    </Button>
                  </>
                )}
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

      {/* Add Administrative Project ID Modal (行政费户口) */}
      <Modal isOpen={isAddAdministrativeProjectOpen} onClose={() => setIsAddAdministrativeProjectOpen(false)} title="Add Admin Account" drawerOnMobile>
        <form onSubmit={(e) => {
          e.preventDefault();
          const name = (new FormData(e.currentTarget).get('projectId') as string)?.trim();
          if (name) {
            addAdministrativeProjectId(name);
            setAdministrativeProjectIds(getAdministrativeProjectIds());
            showToast('Admin account added successfully', 'success');
            setIsAddAdministrativeProjectOpen(false);
          }
        }} className="space-y-4">
          <Input name="projectId" label="Account Name" placeholder="e.g. National Due, Maintenance" required />
          <div className="pt-4">
            <Button className="w-full" type="submit">Add</Button>
          </div>
        </form>
      </Modal>
    </div >
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
    <Modal isOpen={isOpen} onClose={onClose} title="Financial Reports" size="xl" drawerOnMobile>
      <div className="space-y-6">
        {/* Report Filters */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-slate-700 mb-1">Year</label>
            <Select
              value={reportYear.toString()}
              onChange={(e) => onYearChange(parseInt(e.target.value))}
              options={years.map(y => ({ label: y.toString(), value: y.toString() }))}
            />
          </div>
          <div className="flex-1 min-w-[200px]">
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Fiscal Year Start (Optional)</label>
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
            <p className="text-xs text-slate-500 mt-1">
              {fiscalYearStart === 0
                ? 'Using Calendar Year (Jan-Dec)'
                : `Fiscal Year: ${monthNames[fiscalYearStart]} - ${monthNames[fiscalYearStart - 1] || monthNames[11]}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download size={16} className="mr-2" />
              Export Report (CSV)
            </Button>
            <Button variant="outline" onClick={handleExportTransactions}>
              <Download size={16} className="mr-2" />
              Export Transactions (CSV)
            </Button>
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


interface BankReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: BankAccount[];
  onReconcile: () => Promise<void>;
}
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
    <Modal isOpen={isOpen} onClose={onClose} title="Add Bank Account" drawerOnMobile>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input name="bankName" label="Bank" placeholder="e.g. Maybank, CIMB" required />
          <Input name="name" label="Account Name" placeholder="e.g. Main Operating Account" required />
        </div>

        <div className="grid grid-cols-2 gap-4">
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
            onChange={(e) => {
              e.target.value = e.target.value.replace(/[^0-9]/g, '');
            }}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
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

        <div className="pt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Adding...' : 'Add Account'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

const BankReconciliationModal: React.FC<BankReconciliationModalProps> = ({
  isOpen,
  onClose,
  accounts,
  onReconcile,
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [statementBalance, setStatementBalance] = useState<string>('');
  const [reconciliationDate, setReconciliationDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('');
  const [isReconciling, setIsReconciling] = useState(false);
  const { showToast } = useToast();
  const { member } = useAuth();

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  const handleReconcile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId || !statementBalance || !member) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    setIsReconciling(true);
    try {
      await FinanceService.reconcileBankAccount(
        selectedAccountId,
        parseFloat(statementBalance),
        reconciliationDate,
        member.id,
        notes || undefined
      );
      showToast('Bank account reconciled successfully', 'success');
      await onReconcile();
      // Reset form
      setSelectedAccountId('');
      setStatementBalance('');
      setReconciliationDate(new Date().toISOString().split('T')[0]);
      setNotes('');
    } catch (err) {
      showToast('Failed to reconcile bank account', 'error');
    } finally {
      setIsReconciling(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reconcile Bank Account" size="lg" drawerOnMobile>
      <form onSubmit={handleReconcile} className="space-y-4">
        <Select
          label="Select Bank Account"
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
          options={accounts.map(acc => ({ label: acc.name, value: acc.id }))}
          required
        />

        {selectedAccount && (
          <div className="p-4 bg-slate-50 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Current System Balance:</span>
              <span className="font-semibold text-slate-900">{formatCurrency(selectedAccount.balance, selectedAccount.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Last Reconciled:</span>
              <span className="text-sm text-slate-700">{formatDate(selectedAccount.lastReconciled)}</span>
            </div>
          </div>
        )}

        <Input
          label="Statement Balance"
          type="number"
          step="0.01"
          value={statementBalance}
          onChange={(e) => setStatementBalance(e.target.value)}
          placeholder="0.00"
          required
        />

        <Input
          label="Reconciliation Date"
          type="date"
          value={reconciliationDate}
          onChange={(e) => setReconciliationDate(e.target.value)}
          required
        />

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes (Optional)</label>
          <textarea
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-jci-blue"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes about this reconciliation..."
          />
        </div>

        <div className="pt-4 flex gap-3">
          <Button type="submit" className="flex-1" disabled={isReconciling}>
            {isReconciling ? 'Reconciling...' : 'Reconcile Account'}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
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
    <Modal isOpen={isOpen} onClose={onClose} title="Initiate Annual Dues Renewal" size="lg" drawerOnMobile>
      <form onSubmit={handleRenew} className="space-y-4">
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
