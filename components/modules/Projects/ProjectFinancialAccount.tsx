import React, { useState, useEffect, useMemo } from 'react';
import { DollarSign, Edit, RefreshCw, Check, X, Plus, Layout, Trash2, Clock, Search, BrainCircuit } from 'lucide-react';
import { Button, Card, Badge, Tabs, useToast } from '../../ui/Common';
import { Input, Select, Checkbox } from '../../ui/Form';
import { Combobox } from '../../ui/Combobox';
import { MultiSelectDropdown } from '../../ui/MultiSelectDropdown';
import { LoadingState } from '../../ui/Loading';
import { useMembers } from '../../../hooks/useMembers';
import { formatCurrency } from '../../../utils/formatUtils';
import { formatDate, toDate } from '../../../utils/dateUtils';
import { Project, BankAccount, Transaction, TransactionSplit, PaymentRequest } from '../../../types';
import { ProjectAccount } from '../../../services/projectAccountsService';
import { FinanceService } from '../../../services/financeService';
import { ReconciliationService } from '../../../services/reconciliationService';
import { SubmitPaymentRequestModal } from '../PaymentRequests/SubmitPaymentRequestModal';
import { PaymentRequestService } from '../../../services/paymentRequestService';

// Project Financial Account Component
interface ProjectFinancialAccountProps {
  projectId: string;
  project: Project;
  account: ProjectAccount | null;
  loading: boolean;
  onReconcile: () => Promise<{
    discrepancies: Array<{
      type: 'Missing Transaction' | 'Amount Mismatch' | 'Duplicate';
      description: string;
      projectAmount?: number;
      mainAccountAmount?: number;
      difference?: number;
    }>;
    reconciled: boolean;
  }>;
  onUpdateBudget: (newBudget: number) => Promise<void>;
  onRefresh: () => void;
  onNavigate?: (view: string) => void;
}

export const ProjectFinancialAccount: React.FC<ProjectFinancialAccountProps> = ({
  projectId,
  project,
  account,
  loading,
  onReconcile,
  onUpdateBudget,
  onRefresh,
  onNavigate
}) => {
  const { showToast } = useToast();

  const [isClaimDrawerOpen, setIsClaimDrawerOpen] = useState(false);

  const handleClaimReimbursement = () => setIsClaimDrawerOpen(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bankTransactions, setBankTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [loadingBankTransactions, setLoadingBankTransactions] = useState(false);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [newBudget, setNewBudget] = useState(0);
  const [activeFinancialTab, setActiveFinancialTab] = useState('budget');
  const [activeTrxType, setActiveTrxType] = useState<'Income' | 'Expense'>('Income');
  const [activeBankTrxType, setActiveBankTrxType] = useState<'Income' | 'Expense'>('Income');
  const [incomePurposeValue, setIncomePurposeValue] = useState('');
  const [expensePurposeValue, setExpensePurposeValue] = useState('');
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankTxSearchQuery, setBankTxSearchQuery] = useState('');
  const [selectedBankTxIds, setSelectedBankTxIds] = useState<string[]>([]);
  const [selectedProjectTxIds, setSelectedProjectTxIds] = useState<string[]>([]);
  const [batchProjectPurposeValue, setBatchProjectPurposeValue] = useState('');
  const [batchProjectTxIds, setBatchProjectTxIds] = useState<string[]>([]);
  const isMixedBankTxSelected = useMemo(() => {
    if (selectedBankTxIds.length === 0) return false;
    const selectedTxTypes = selectedBankTxIds.map(id => {
      const tx = bankTransactions.find(bt => bt.id === id);
      return tx?.type;
    }).filter(Boolean);
    return new Set(selectedTxTypes).size > 1;
  }, [selectedBankTxIds, bankTransactions]);
  const [bankTxSplits, setBankTxSplits] = useState<Record<string, TransactionSplit[]>>({});
  const [expandedSplitParents, setExpandedSplitParents] = useState<Set<string>>(new Set());
  const [tempSelectedProjectTxIds, setTempSelectedProjectTxIds] = useState<Record<string, string[]>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [projectPRs, setProjectPRs] = useState<PaymentRequest[]>([]);
  const [loadingPRs, setLoadingPRs] = useState(false);
  const [isAddingIncome, setIsAddingIncome] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Transaction>>({});
  const [addForm, setAddForm] = useState<Partial<Transaction>>({});
  const { members } = useMembers();

  const uniquePurposes = useMemo(() => {
    return Array.from(new Set(transactions.map(t => t.purpose).filter(Boolean))) as string[];
  }, [transactions]);

  useEffect(() => {
    if (account) {
      setNewBudget(account.budget);
      loadTransactions();
      loadBankAccounts();
    }
  }, [account]);

  useEffect(() => {
    if (activeFinancialTab === 'paymentRequests' && projectPRs.length === 0 && !loadingPRs) {
      setLoadingPRs(true);
      PaymentRequestService.list({ activityRef: projectId })
        .then(result => setProjectPRs(result.items))
        .catch(err => console.error('Failed to load project PRs', err))
        .finally(() => setLoadingPRs(false));
    }
  }, [activeFinancialTab, projectId]);

  const loadBankAccounts = async () => {
    try {
      const accounts = await FinanceService.getAllBankAccounts();
      setBankAccounts(accounts);
    } catch (err) {
      console.error('Failed to load bank accounts', err);
    }
  };

  const loadTransactions = async () => {
    if (!account) return;
    setLoadingTransactions(true);
    setLoadingBankTransactions(true);
    try {
      // Fetch internal project transactions (projectTrx collection)
      const projectTx = await FinanceService.getProjectTransactions(account.projectId);
      setTransactions(projectTx);

      // Fetch official bank transactions (transactions collection tagged with projectId)
      const bankTx = await FinanceService.getBankTransactionsByProject(account.projectId);
      setBankTransactions(bankTx);
      // Load splits for any split-parent bank txs (情景 PP)
      const splitParents = bankTx.filter(t => (t as any).isSplit && !((t as any).isSplitChild));
      if (splitParents.length > 0) {
        const splitsEntries = await Promise.all(
          splitParents.map(async t => [t.id, await FinanceService.getTransactionSplits(t.id)] as [string, TransactionSplit[]])
        );
        setBankTxSplits(Object.fromEntries(splitsEntries));
      }
    } catch (err) {
      console.error('Failed to load transactions', err);
    } finally {
      setLoadingTransactions(false);
      setLoadingBankTransactions(false);
    }
  };

  const refreshTransactionsBackground = async () => {
    if (!account) return;
    try {
      const [projectTx, bankTx] = await Promise.all([
        FinanceService.getProjectTransactions(account.projectId),
        FinanceService.getBankTransactionsByProject(account.projectId)
      ]);
      setTransactions(projectTx);
      setBankTransactions(bankTx);
    } catch (err) {
      console.error('Failed to load transactions in background', err);
    }
  };


  const handleTablePaste = async (e: React.ClipboardEvent, type: 'Income' | 'Expense', currentPurpose: string) => {
    const pastedText = e.clipboardData.getData('Text');
    if (!pastedText || !pastedText.includes('\t')) {
      return;
    }

    e.preventDefault();

    const rows = pastedText.split(/\r?\n/).filter(r => r.trim());
    let parsedCount = 0;
    let dynamicPurpose = currentPurpose;

    const parsePastedDate = (dateStr: string): string => {
      if (!dateStr) return '';
      const clean = dateStr.trim();

      // Pattern 1: DD/MM/YYYY or DD-MM-YYYY
      const dmyMatch = clean.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
      if (dmyMatch) {
        const day = dmyMatch[1].padStart(2, '0');
        const month = dmyMatch[2].padStart(2, '0');
        const year = dmyMatch[3];
        return `${year}-${month}-${day}`;
      }

      // Pattern 2: YYYY/MM/DD or YYYY-MM-DD
      const ymdMatch = clean.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})$/);
      if (ymdMatch) {
        const year = ymdMatch[1];
        const month = ymdMatch[2].padStart(2, '0');
        const day = ymdMatch[3].padStart(2, '0');
        return `${year}-${month}-${day}`;
      }

      // Fallback: standard parser
      try {
        const d = new Date(clean);
        if (!isNaN(d.getTime())) {
          return d.toISOString().split('T')[0];
        }
      } catch { }

      return '';
    };

    setLoadingTransactions(true);
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

        let txType = type;
        if (incomeAmount > 0) txType = 'Income';
        else if (expenseAmount > 0) txType = 'Expense';

        // Check 5th column for date. If empty, dateStr will be '' representing unpaid payment request.
        const rawDate = cols.length > 4 ? cols[4]?.trim() : '';
        const dateStr = parsePastedDate(rawDate);

        if (account?.projectId) {
          await FinanceService.createProjectTransaction({
            projectId: account.projectId,
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
      }

      if (parsedCount > 0) {
        showToast(`Successfully pasted and added ${parsedCount} transactions`, 'success');
        loadTransactions();
      } else {
        showToast('Could not parse any valid transactions from clipboard', 'warning');
      }
    } catch (err) {
      console.error('Error pasting transactions:', err);
      showToast('Error parsing or adding transactions', 'error');
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleInlineSave = async (id: string, isNew = false) => {
    const data = isNew ? addForm : editForm;
    if (!data.amount || !data.description || !data.date) {
      showToast('Please fill in all required fields (Amount, Description, Date)', 'warning');
      return;
    }

    try {
      if (isNew) {
        await FinanceService.createProjectTransaction({
          ...(data as any),
          projectId: account?.projectId,
          category: 'Projects & Activities',
          status: 'Pending',
        });
        showToast('Transaction added successfully', 'success');
        setIsAddingIncome(false);
        setIsAddingExpense(false);
        setAddForm({});
      } else {
        await FinanceService.updateProjectTransaction(id, data);
        showToast('Transaction updated successfully', 'success');
        setEditingId(null);
        setEditForm({});
      }
      loadTransactions();
    } catch (err) {
      showToast('Failed to save transaction', 'error');
    }
  };

  const handleInlineCancel = (isNew = false) => {
    if (isNew) {
      setIsAddingIncome(false);
      setIsAddingExpense(false);
      setAddForm({});
    } else {
      setEditingId(null);
      setEditForm({});
    }
  };

  const startInlineEdit = (tx: Transaction) => {
    setEditingId(tx.id);
    setEditForm(tx);
  };

  const startInlineAdd = (type: 'Income' | 'Expense', purpose?: string) => {
    const isIncome = type === 'Income';
    if (isIncome) setIsAddingIncome(true);
    else setIsAddingExpense(true);

    setAddForm({
      type,
      purpose,
      date: new Date().toISOString().split('T')[0],
    });
  };

  const handleSaveBudget = async () => {
    try {
      await onUpdateBudget(newBudget);
      setIsEditingBudget(false);
      showToast('Budget updated successfully', 'success');
    } catch (err) {
      showToast('Failed to update budget', 'error');
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    try {
      // Unlink this transaction from any bank transactions
      const relatedBankTxs = bankTransactions.filter(btx => {
        const btxLinkedIds = (btx as any).projectTransactionIds || ((btx as any).projectTransactionId ? [(btx as any).projectTransactionId] : []);
        return btxLinkedIds.includes(transactionId);
      });

      if (relatedBankTxs.length > 0) {
        await Promise.all(relatedBankTxs.map(btx => {
          const btxLinkedIds = (btx as any).projectTransactionIds || ((btx as any).projectTransactionId ? [(btx as any).projectTransactionId] : []);
          const newLinkedIds = btxLinkedIds.filter((id: string) => id !== transactionId);
          const updates: any = {
            projectTransactionIds: newLinkedIds,
            projectTransactionId: newLinkedIds[0] || null,
            status: newLinkedIds.length > 0 ? 'Reconciled' : 'Cleared'
          };
          if (newLinkedIds.length === 0) {
            updates.purpose = '';
          }
          if ((btx as any).isSplitChild) {
            return FinanceService.updateTransactionSplit(btx.id, updates);
          } else {
            return FinanceService.updateTransaction(btx.id, updates);
          }
        }));
      }

      await FinanceService.deleteProjectTransaction(transactionId);
      showToast('Transaction deleted successfully', 'success');
      loadTransactions();
      onRefresh(); // Refresh parent account data
    } catch (err) {
      console.error(err);
      showToast('Failed to delete transaction', 'error');
    }
  };

  const handleBatchDeleteProjectTransactions = async () => {
    if (selectedProjectTxIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedProjectTxIds.length} selected transactions?`)) return;

    try {
      setLoadingTransactions(true);

      // Unlink any bank transactions tied to these project transactions
      const relatedBankTxs = bankTransactions.filter(btx => {
        const btxLinkedIds = (btx as any).projectTransactionIds || ((btx as any).projectTransactionId ? [(btx as any).projectTransactionId] : []);
        return btxLinkedIds.some(id => selectedProjectTxIds.includes(id));
      });

      if (relatedBankTxs.length > 0) {
        await Promise.all(relatedBankTxs.map(btx => {
          const btxLinkedIds = (btx as any).projectTransactionIds || ((btx as any).projectTransactionId ? [(btx as any).projectTransactionId] : []);
          const newLinkedIds = btxLinkedIds.filter((id: string) => !selectedProjectTxIds.includes(id));
          const updates: any = {
            projectTransactionIds: newLinkedIds,
            projectTransactionId: newLinkedIds[0] || null,
            status: newLinkedIds.length > 0 ? 'Reconciled' : 'Cleared'
          };
          if (newLinkedIds.length === 0) {
            updates.purpose = '';
          }
          if ((btx as any).isSplitChild) {
            return FinanceService.updateTransactionSplit(btx.id, updates);
          } else {
            return FinanceService.updateTransaction(btx.id, updates);
          }
        }));
      }

      await Promise.all(selectedProjectTxIds.map(id => FinanceService.deleteProjectTransaction(id)));

      showToast(`Successfully deleted ${selectedProjectTxIds.length} transactions`, 'success');
      setSelectedProjectTxIds([]);
      loadTransactions();
      onRefresh(); // Refresh parent account data
    } catch (err) {
      console.error('Failed to batch delete transactions', err);
      showToast('Failed to delete transactions', 'error');
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleBatchSetProjectTxPurpose = async () => {
    if (selectedProjectTxIds.length === 0 || !batchProjectPurposeValue.trim()) return;
    try {
      setLoadingTransactions(true);
      let successCount = 0;
      let failCount = 0;

      for (const id of selectedProjectTxIds) {
        try {
          await FinanceService.updateProjectTransaction(id, {
            purpose: batchProjectPurposeValue.trim()
          });
          successCount++;
        } catch (err) {
          console.error(`Failed to update purpose for project transaction ${id}`, err);
          failCount++;
        }
      }

      if (successCount > 0) {
        showToast(
          `Successfully set purpose for ${successCount} transaction${successCount > 1 ? 's' : ''}${failCount > 0 ? `, failed ${failCount}` : ''}`,
          'success'
        );
      } else if (failCount > 0) {
        showToast(`Failed to update purpose for selected transactions`, 'error');
      }

      setSelectedProjectTxIds([]);
      setBatchProjectPurposeValue('');
      loadTransactions();
      onRefresh(); // Refresh parent account data
    } catch (err) {
      console.error('Batch set project transaction purpose failed', err);
      showToast('Failed to batch set purpose', 'error');
    } finally {
      setLoadingTransactions(false);
    }
  };


  const handleAutoMatch = async () => {
    try {
      const matches = ReconciliationService.analyzeMatches(bankTransactions, transactions || [], members);

      if (matches.length === 0) {
        showToast('No matching transactions found', 'info');
        return;
      }

      const summary = await ReconciliationService.executeAutoMatch(
        matches,
        bankTransactions,
        transactions || [],
        account?.projectId || '',
        'current-user'
      );

      const parts: string[] = [];
      if (summary.matched > 0) parts.push(`${summary.matched} matched`);
      if (summary.splitCreated > 0) parts.push(`${summary.splitCreated} auto-split`);
      if (summary.remainderSplits > 0) parts.push(`${summary.remainderSplits} with unallocated balance`);
      if (summary.errors.length > 0) parts.push(`${summary.errors.length} errors`);

      showToast(parts.length > 0 ? `Auto-match: ${parts.join(', ')}` : 'Auto-match completed', summary.errors.length > 0 ? 'warning' : 'success');

      await refreshTransactionsBackground();
    } catch (err) {
      console.error('Auto match failed', err);
      showToast('Failed to auto-match transactions', 'error');
    }
  };

  const handleLinkBankTransaction = async (bankTxId: string, projectTxIds: string[]) => {
    try {
      if (projectTxIds.length === 0) {
        // Unlink
        await ReconciliationService.unlinkMatch(
          bankTxId, undefined, bankTransactions, transactions || [], account?.projectId || ''
        );
        showToast('Link removed', 'success');
      } else {
        const result = await ReconciliationService.manualMatch(
          bankTxId, projectTxIds, bankTransactions, transactions || [], account?.projectId || '', 'current-user'
        );
        const msg = result.splitCreated
          ? `Linked and auto-split${result.remainder > 0 ? ` (${formatCurrency(result.remainder, account?.currency || 'MYR')} unallocated)` : ''}`
          : 'Bank transaction linked to project transaction';
        showToast(msg, 'success');
      }
      setTempSelectedProjectTxIds(prev => {
        const copy = { ...prev };
        delete copy[bankTxId];
        return copy;
      });
      await refreshTransactionsBackground();
    } catch (err) {
      console.error('Failed to link bank transaction', err);
      showToast('Failed to update bank transaction link', 'error');
    }
  };

  const handleBatchLinkBankTransactions = async () => {
    if (selectedBankTxIds.length === 0 || batchProjectTxIds.length === 0) return;
    try {
      let successCount = 0;
      let failCount = 0;

      // Process sequentially to avoid concurrent write/read conflicts in ReconciliationService
      for (const id of selectedBankTxIds) {
        try {
          await ReconciliationService.manualMatch(
            id,
            batchProjectTxIds,
            bankTransactions,
            transactions || [],
            account?.projectId || '',
            'current-user'
          );
          successCount++;
        } catch (err) {
          console.error(`Failed to link bank transaction ${id}`, err);
          failCount++;
        }
      }

      if (successCount > 0) {
        showToast(
          `Successfully linked ${successCount} transaction${successCount > 1 ? 's' : ''}${failCount > 0 ? `, failed ${failCount}` : ''}`,
          'success'
        );
      } else if (failCount > 0) {
        showToast(`Failed to link selected transactions`, 'error');
      }

      setSelectedBankTxIds([]);
      setBatchProjectTxIds([]);
      await refreshTransactionsBackground();
    } catch (err) {
      console.error('Batch link failed', err);
      showToast('Failed to batch link transactions', 'error');
    }
  };

  const handleBatchUnlinkBankTransactions = async () => {
    if (selectedBankTxIds.length === 0) return;
    if (!confirm(`Are you sure you want to remove matches for ${selectedBankTxIds.length} selected bank transactions?`)) return;
    try {
      await Promise.all(selectedBankTxIds.map(id =>
        ReconciliationService.unlinkMatch(
          id, undefined, bankTransactions, transactions || [], account?.projectId || ''
        )
      ));
      showToast(`Successfully removed matches for ${selectedBankTxIds.length} transactions`, 'success');
      setSelectedBankTxIds([]);
      await refreshTransactionsBackground();
    } catch (err) {
      console.error('Batch unlink failed', err);
      showToast('Failed to batch remove matches', 'error');
    }
  };



  if (loading) {
    return <LoadingState loading={true} error={null} empty={false}><div>Loading...</div></LoadingState>;
  }

  if (!account) {
    return (
      <div className="text-center py-12">
        <DollarSign className="mx-auto text-slate-400 mb-4" size={48} />
        <p className="text-slate-500 mb-4">No financial account found for this project</p>
        <p className="text-sm text-slate-400 mb-6">Financial account will be created automatically when project transactions are recorded</p>
        <Button onClick={() => startInlineAdd('Income')}>
          <Plus size={16} className="mr-2" /> Add First Transaction
        </Button>
      </div>
    );
  }

  // Calculate financials from transactions to ensure data consistency with projectTrx collection
  const totalExpenses = transactions
    .filter(t => t.type === 'Expense')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const totalIncome = transactions
    .filter(t => t.type === 'Income')
    .reduce((sum, t) => sum + t.amount, 0);

  const budgetUtilization = account.budget > 0 ? (totalExpenses / account.budget) * 100 : 0;
  const remainingBudget = account.budget - totalExpenses;

  return (
    <>
      <div className="space-y-6">
        <Tabs
          tabs={[
            { id: 'budget', label: 'Budget' },
            { id: 'projectTrx', label: 'Transactions' },
            { id: 'bankTrx', label: 'Bank Trx' },
            { id: 'paymentRequests', label: 'Claims' },
          ]}
          activeTab={activeFinancialTab}
          onTabChange={setActiveFinancialTab}
        />

        {activeFinancialTab === 'budget' && (
          <div className="space-y-4 animate-in fade-in duration-500">
            {/* KPI strip — rows on mobile, 4-col grid on desktop */}
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden divide-y divide-slate-100 shadow-sm md:bg-transparent md:border-none md:rounded-none md:overflow-visible md:shadow-none md:divide-y-0 md:grid md:grid-cols-4 md:gap-2">
              {/* Budget */}
              <div className="flex justify-between items-center px-4 py-2.5 md:block md:rounded-xl md:border md:border-slate-200 md:bg-white md:px-3 md:py-2.5 md:shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500 md:text-[10px] md:font-semibold md:text-slate-400 md:uppercase md:tracking-wider md:block md:mb-1">Budget</span>
                  <button onClick={() => setIsEditingBudget(true)} className="text-slate-300 hover:text-jci-blue transition-colors md:hidden"><Edit size={12} /></button>
                </div>
                <div className="md:hidden">
                  {isEditingBudget ? (
                    <div className="flex gap-1 items-center">
                      <Input type="number" value={newBudget.toString()} onChange={(e) => setNewBudget(parseFloat(e.target.value) || 0)} className="h-7 text-xs w-28" />
                      <Button size="sm" onClick={handleSaveBudget}><Check size={12} /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setIsEditingBudget(false)}><X size={12} /></Button>
                    </div>
                  ) : (
                    <span className="text-sm font-bold font-mono text-slate-900 tabular-nums">{formatCurrency(account.budget, account.currency)}</span>
                  )}
                </div>
                <div className="hidden md:block">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Budget</span>
                    <button onClick={() => setIsEditingBudget(true)} className="text-slate-300 hover:text-jci-blue transition-colors"><Edit size={12} /></button>
                  </div>
                  {isEditingBudget ? (
                    <div className="flex gap-1 items-center">
                      <Input type="number" value={newBudget.toString()} onChange={(e) => setNewBudget(parseFloat(e.target.value) || 0)} className="h-7 text-xs" />
                      <Button size="sm" onClick={handleSaveBudget}><Check size={12} /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setIsEditingBudget(false)}><X size={12} /></Button>
                    </div>
                  ) : (
                    <div className="text-base font-bold text-slate-900 tabular-nums">{formatCurrency(account.budget, account.currency)}</div>
                  )}
                </div>
              </div>
              {/* Income */}
              <div className="flex justify-between items-center px-4 py-2.5 md:block md:rounded-xl md:border md:border-green-100 md:bg-green-50 md:px-3 md:py-2.5 md:shadow-sm">
                <span className="text-sm text-slate-500 md:text-[10px] md:font-semibold md:text-green-600 md:uppercase md:tracking-wider md:block md:mb-1">Income</span>
                <span className="text-sm font-bold font-mono text-green-700 tabular-nums md:text-base">{formatCurrency(totalIncome, account.currency)}</span>
              </div>
              {/* Expenses */}
              <div className="flex justify-between items-center px-4 py-2.5 md:block md:rounded-xl md:border md:border-red-100 md:bg-red-50 md:px-3 md:py-2.5 md:shadow-sm">
                <span className="text-sm text-slate-500 md:text-[10px] md:font-semibold md:text-red-500 md:uppercase md:tracking-wider md:block md:mb-1">Expenses</span>
                <span className="text-sm font-bold font-mono text-red-600 tabular-nums md:text-base">{formatCurrency(totalExpenses, account.currency)}</span>
              </div>
              {/* Balance */}
              <div className={`flex justify-between items-center px-4 py-2.5 md:block md:rounded-xl md:border md:px-3 md:py-2.5 md:shadow-sm ${remainingBudget >= 0 ? 'md:border-emerald-100 md:bg-emerald-50' : 'md:border-red-100 md:bg-red-50'}`}>
                <span className={`text-sm text-slate-500 md:text-[10px] md:font-semibold md:uppercase md:tracking-wider md:block md:mb-1 ${remainingBudget >= 0 ? 'md:text-emerald-600' : 'md:text-red-500'}`}>Balance</span>
                <span className={`text-sm font-bold font-mono tabular-nums md:text-base ${remainingBudget >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatCurrency(remainingBudget, account.currency)}</span>
              </div>
            </div>

            {/* Main card " single unified card, 2-col on desktop */}
            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">

                {/* Left: utilization hero */}
                <div className="px-4 py-5 space-y-4">
                  {/* Big % + label */}
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Budget Utilization</p>
                      <p className={`text-4xl font-black tabular-nums leading-none ${budgetUtilization > 100 ? 'text-red-600' : budgetUtilization > 80 ? 'text-amber-500' : 'text-emerald-600'}`}>
                        {budgetUtilization.toFixed(1)}<span className="text-xl font-bold">%</span>
                      </p>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${budgetUtilization > 100 ? 'bg-red-100 text-red-600' : budgetUtilization > 80 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                      {budgetUtilization > 100 ? 'Over Budget' : budgetUtilization > 80 ? 'High Usage' : 'On Track'}
                    </span>
                  </div>

                  {/* Progress bar " thicker */}
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${budgetUtilization > 100 ? 'bg-red-500' : budgetUtilization > 80 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(budgetUtilization, 100)}%` }}
                    />
                  </div>

                  {/* Breakdown list */}
                  <div className="space-y-2 pt-1">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Total Budget</span>
                      <span className="font-semibold tabular-nums">{formatCurrency(account.budget, account.currency)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Expenses</span>
                      <span className="font-semibold text-red-600 tabular-nums">{formatCurrency(totalExpenses, account.currency)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-100">
                      <span className="font-semibold text-slate-800">Remaining</span>
                      <span className={`font-bold tabular-nums ${remainingBudget >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(remainingBudget, account.currency)}</span>
                    </div>
                  </div>
                </div>

                {/* Right: income vs expense + actions */}
                <div className="px-4 py-5 space-y-4">
                  {/* Income vs Expenses visual bar */}
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Income vs Expenses</p>
                    {(() => {
                      const total = totalIncome + totalExpenses || 1;
                      const incomePct = Math.round((totalIncome / total) * 100);
                      const expensePct = 100 - incomePct;
                      return (
                        <div className="space-y-2">
                          <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
                            <div className="bg-emerald-400 rounded-l-full transition-all" style={{ width: `${incomePct}%` }} />
                            <div className="bg-red-400 rounded-r-full transition-all" style={{ width: `${expensePct}%` }} />
                          </div>
                          <div className="flex justify-between text-xs text-slate-500">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />Income {incomePct}%</span>
                            <span className="flex items-center gap-1">Expenses {expensePct}%<span className="w-2 h-2 rounded-full bg-red-400 inline-block" /></span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Net position */}
                  <div className="rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-3">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Net Position</p>
                    <p className={`text-xl font-black tabular-nums ${totalIncome - totalExpenses >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {totalIncome - totalExpenses >= 0 ? '+' : ''}{formatCurrency(totalIncome - totalExpenses, account.currency)}
                    </p>
                  </div>

                  {account.lastReconciled && (
                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock size={11} />Last reconciled: {formatDate(toDate(account.lastReconciled))}
                    </p>
                  )}

                </div>
              </div>
            </div>
          </div>
        )}

        {activeFinancialTab === 'projectTrx' && (
          <div className="space-y-4 animate-in slide-in-from-right-2 duration-300">

            {/* Summary strip — rows on mobile, 3-col on desktop */}
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden divide-y divide-slate-100 shadow-sm md:bg-transparent md:border-none md:rounded-none md:overflow-visible md:shadow-none md:divide-y-0 md:grid md:grid-cols-3 md:gap-2">
              <div className="flex justify-between items-center px-4 py-2.5 md:block md:bg-green-50 md:border md:border-green-100 md:rounded-xl md:px-3 md:py-2.5">
                <span className="text-sm text-slate-500 md:text-[10px] md:font-semibold md:text-green-600 md:uppercase md:tracking-wider md:block md:mb-0.5">Income</span>
                <span className="text-sm font-bold font-mono text-green-700 tabular-nums md:text-base">{formatCurrency(totalIncome, account.currency)}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-2.5 md:block md:bg-red-50 md:border md:border-red-100 md:rounded-xl md:px-3 md:py-2.5">
                <span className="text-sm text-slate-500 md:text-[10px] md:font-semibold md:text-red-500 md:uppercase md:tracking-wider md:block md:mb-0.5">Expenses</span>
                <span className="text-sm font-bold font-mono text-red-600 tabular-nums md:text-base">{formatCurrency(totalExpenses, account.currency)}</span>
              </div>
              <div className={`flex justify-between items-center px-4 py-2.5 md:block md:border md:rounded-xl md:px-3 md:py-2.5 ${(totalIncome - totalExpenses) >= 0 ? 'md:bg-slate-50 md:border-slate-200' : 'md:bg-rose-50 md:border-rose-100'}`}>
                <span className="text-sm text-slate-500 md:text-[10px] md:font-semibold md:text-slate-500 md:uppercase md:tracking-wider md:block md:mb-0.5">Net</span>
                <span className={`text-sm font-bold font-mono tabular-nums md:text-base ${(totalIncome - totalExpenses) >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>{formatCurrency(totalIncome - totalExpenses, account.currency)}</span>
              </div>
            </div>

            {/* Type toggle + Add button */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex bg-slate-100 p-1 rounded-lg gap-1 shrink-0">
                <button type="button"
                  onClick={() => { setActiveTrxType('Income'); setSelectedProjectTxIds([]); }}
                  className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-all ${activeTrxType === 'Income' ? 'bg-white text-green-700 shadow-sm border border-green-200' : 'text-slate-500 hover:text-slate-800'}`}>
                  Income <span className="ml-1 text-xs font-mono opacity-70">{transactions.filter(t => t.type === 'Income').length}</span>
                </button>
                <button type="button"
                  onClick={() => { setActiveTrxType('Expense'); setSelectedProjectTxIds([]); }}
                  className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-all ${activeTrxType === 'Expense' ? 'bg-white text-red-600 shadow-sm border border-red-200' : 'text-slate-500 hover:text-slate-800'}`}>
                  Expenses <span className="ml-1 text-xs font-mono opacity-70">{transactions.filter(t => t.type === 'Expense').length}</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Combobox
                  className="w-36 hidden sm:block"
                  placeholder="Purpose..."
                  options={uniquePurposes}
                  value={activeTrxType === 'Income' ? incomePurposeValue : expensePurposeValue}
                  onChange={activeTrxType === 'Income' ? setIncomePurposeValue : setExpensePurposeValue}
                />
                <Button size="sm" variant="ghost" className="text-jci-blue hover:bg-jci-blue/10"
                  onClick={() => activeTrxType === 'Income' ? startInlineAdd('Income', incomePurposeValue) : startInlineAdd('Expense', expensePurposeValue)}>
                  <Plus size={15} className="mr-1" /> Add
                </Button>
              </div>
            </div>

            {loadingTransactions && (
              <div className="flex justify-center py-8">
                <RefreshCw className="animate-spin text-jci-blue" size={28} />
              </div>
            )}

            {/* Desktop table */}
            {!loadingTransactions && (
              <Card className="hidden md:block overflow-hidden border-none shadow-sm" noPadding>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm"
                    onPaste={(e) => handleTablePaste(e, activeTrxType, activeTrxType === 'Income' ? incomePurposeValue : expensePurposeValue)}>
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="py-2.5 px-3 w-[36px]">
                          <Checkbox
                            checked={transactions.filter(t => t.type === activeTrxType).length > 0 && transactions.filter(t => t.type === activeTrxType).every(t => selectedProjectTxIds.includes(t.id))}
                            onChange={(e) => {
                              const ids = transactions.filter(t => t.type === activeTrxType).map(t => t.id);
                              if (e.target.checked) setSelectedProjectTxIds([...new Set([...selectedProjectTxIds, ...ids])]);
                              else setSelectedProjectTxIds(selectedProjectTxIds.filter(id => !ids.includes(id)));
                            }}
                          />
                        </th>
                        <th className="py-2.5 px-2 text-xs font-semibold w-[32%]">Item / Category</th>
                        <th className="py-2.5 px-2 text-xs font-semibold w-[18%]">Ref No.</th>
                        <th className="py-2.5 px-2 text-xs font-semibold w-[18%]">Account</th>
                        <th className="py-2.5 px-2 text-xs font-semibold text-right w-[12%]">Amount</th>
                        <th className="py-2.5 px-2 text-xs font-semibold w-[10%]">Date</th>
                        <th className="py-2.5 px-2 text-xs font-semibold w-[12%]">Reconciled</th>
                        <th className="py-2.5 px-2 w-[44px]"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {/* Inline add row */}
                      {((activeTrxType === 'Income' && isAddingIncome) || (activeTrxType === 'Expense' && isAddingExpense)) && (
                        <tr className={activeTrxType === 'Income' ? 'bg-green-50/40' : 'bg-red-50/30'}>
                          <td className="py-2 px-3 w-[36px]"></td>
                          <td className="py-2 px-2">
                            <Input className="h-8 text-xs" value={addForm.description || ''} onChange={(e) => setAddForm({ ...addForm, description: e.target.value })} placeholder="Description" />
                          </td>
                          <td className="py-2 px-2">
                            <Input className="h-8 text-xs" value={addForm.referenceNumber || ''} onChange={(e) => setAddForm({ ...addForm, referenceNumber: e.target.value })} placeholder="Ref No." />
                          </td>
                          <td className="py-2 px-2">
                            <Select className="h-8 text-xs" value={addForm.bankAccountId || ''} onChange={(e) => setAddForm({ ...addForm, bankAccountId: e.target.value })}
                              options={[{ label: 'None', value: '' }, ...bankAccounts.map(acc => ({ label: acc.name, value: acc.id }))]} />
                          </td>
                          <td className="py-2 px-2">
                            <Input className={`h-8 text-xs font-mono text-right ${activeTrxType === 'Expense' ? 'text-red-600' : ''}`} type="number" step="0.01" value={addForm.amount || ''} onChange={(e) => setAddForm({ ...addForm, amount: parseFloat(e.target.value) })} placeholder="0.00" />
                          </td>
                          <td className="py-2 px-2">
                            <Input className="h-8 text-xs" type="date" value={addForm.date || ''} onChange={(e) => setAddForm({ ...addForm, date: e.target.value })} />
                          </td>
                          <td className="py-2 px-2"><Badge variant="warning">Pending</Badge></td>
                          <td className="py-2 px-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => handleInlineSave('', true)} className="p-1 text-green-600 hover:bg-green-100 rounded"><Check size={15} /></button>
                              <button onClick={() => handleInlineCancel(true)} className="p-1 text-red-500 hover:bg-red-100 rounded"><X size={15} /></button>
                            </div>
                          </td>
                        </tr>
                      )}
                      {/* Grouped rows */}
                      {(() => {
                        const grouped = transactions
                          .filter(t => t.type === activeTrxType)
                          .reduce((g, t) => { const k = t.purpose || 'Uncategorized'; (g[k] = g[k] || []).push(t); return g; }, {} as Record<string, Transaction[]>);
                        const entries = Object.entries(grouped);
                        const isAdding = activeTrxType === 'Income' ? isAddingIncome : isAddingExpense;
                        if (entries.length === 0 && !isAdding) return (
                          <tr><td colSpan={8} className="py-10 text-center text-slate-400">
                            <Layout size={28} className="mx-auto mb-2 opacity-20" />
                            <p className="text-sm">No {activeTrxType.toLowerCase()} entries yet</p>
                            <p className="text-xs mt-0.5 opacity-70">Paste cells from Excel or click Add</p>
                          </td></tr>
                        );
                        const accentColor = activeTrxType === 'Income' ? 'text-green-600' : 'text-red-600';
                        const groupBg = activeTrxType === 'Income' ? 'bg-green-50/60' : 'bg-red-50/40';
                        return entries.map(([purpose, grpTxs]) => (
                          <React.Fragment key={purpose}>
                            <tr>
                              <td colSpan={4} className={`py-1.5 px-3 text-xs font-bold text-slate-600 ${groupBg}`}>{purpose} <span className="font-normal opacity-60">({grpTxs.length})</span></td>
                              <td className={`py-1.5 px-2 text-right text-xs font-bold font-mono ${accentColor} ${groupBg}`}>
                                {formatCurrency(grpTxs.reduce((s, t) => s + Math.abs(t.amount), 0), account.currency)}
                              </td>
                              <td colSpan={3} className={groupBg}></td>
                            </tr>
                            {grpTxs.map(tx => {
                              const linkedAmount = bankTransactions.reduce((sum, btx) => {
                                const ids = (btx as any).projectTransactionIds || ((btx as any).projectTransactionId ? [(btx as any).projectTransactionId] : []);
                                return ids.includes(tx.id) ? sum + Math.abs(btx.amount) : sum;
                              }, 0);
                              const badgeVariant: any = linkedAmount <= 0 ? 'neutral' : Math.abs(linkedAmount - Math.abs(tx.amount)) < 0.01 ? 'success' : linkedAmount > Math.abs(tx.amount) + 0.01 ? 'error' : 'warning';
                              return (
                                <tr key={tx.id} className="hover:bg-slate-50/70 group transition-colors">
                                  {editingId === tx.id ? (
                                    <>
                                      <td className="py-2 px-3"></td>
                                      <td className="py-2 px-2">
                                        <div className="flex flex-col gap-1">
                                          <Combobox className="w-full" placeholder="Purpose" options={uniquePurposes} value={editForm.purpose || ''} onChange={(val) => setEditForm({ ...editForm, purpose: val })} />
                                          <Input className="h-8 text-xs" value={editForm.description || ''} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="Description" />
                                        </div>
                                      </td>
                                      <td className="py-2 px-2"><Input className="h-8 text-xs" value={editForm.referenceNumber || ''} onChange={(e) => setEditForm({ ...editForm, referenceNumber: e.target.value })} /></td>
                                      <td className="py-2 px-2">
                                        <Select className="h-8 text-xs" value={editForm.bankAccountId || ''} onChange={(e) => setEditForm({ ...editForm, bankAccountId: e.target.value })}
                                          options={[{ label: 'None', value: '' }, ...bankAccounts.map(acc => ({ label: acc.name, value: acc.id }))]} />
                                      </td>
                                      <td className="py-2 px-2"><Input className={`h-8 text-xs text-right font-mono ${activeTrxType === 'Expense' ? 'text-red-600' : ''}`} type="number" step="0.01" value={editForm.amount || ''} onChange={(e) => setEditForm({ ...editForm, amount: parseFloat(e.target.value) })} /></td>
                                      <td className="py-2 px-2"><Input className="h-8 text-xs" type="date" value={editForm.date ? editForm.date.split('T')[0] : ''} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} /></td>
                                      <td className="py-2 px-2 text-center text-slate-300">—</td>
                                      <td className="py-2 px-2 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                          <button onClick={() => handleInlineSave(tx.id)} className="p-1 text-green-600 hover:bg-green-100 rounded"><Check size={15} /></button>
                                          <button onClick={() => handleInlineCancel()} className="p-1 text-red-500 hover:bg-red-100 rounded"><X size={15} /></button>
                                        </div>
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      <td className="py-1.5 px-3">
                                        <Checkbox checked={selectedProjectTxIds.includes(tx.id)} onChange={(e) => {
                                          if (e.target.checked) setSelectedProjectTxIds([...selectedProjectTxIds, tx.id]);
                                          else setSelectedProjectTxIds(selectedProjectTxIds.filter(id => id !== tx.id));
                                        }} />
                                      </td>
                                      <td className="py-1.5 px-2 text-slate-800 text-sm">{tx.description || '—'}</td>
                                      <td className="py-1.5 px-2 text-slate-400 text-xs font-mono">{tx.referenceNumber || '—'}</td>
                                      <td className="py-1.5 px-2 text-slate-500 text-xs truncate max-w-[140px]">{bankAccounts.find(a => a.id === tx.bankAccountId)?.name || '—'}</td>
                                      <td className={`py-1.5 px-2 text-right font-mono font-semibold text-sm ${accentColor}`}>{formatCurrency(Math.abs(tx.amount), account.currency)}</td>
                                      <td className="py-1.5 px-2 text-slate-400 text-xs whitespace-nowrap">{new Date(tx.date).toLocaleDateString()}</td>
                                      <td className="py-1.5 px-2">
                                        <Badge variant={badgeVariant}>{formatCurrency(linkedAmount, account.currency)} / {formatCurrency(Math.abs(tx.amount), account.currency)}</Badge>
                                      </td>
                                      <td className="py-1.5 px-2 text-right">
                                        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button onClick={() => startInlineEdit(tx)} className="text-slate-400 hover:text-jci-blue p-1 rounded transition-colors"><Edit size={13} /></button>
                                          <button onClick={() => handleDeleteTransaction(tx.id)} className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors"><Trash2 size={13} /></button>
                                        </div>
                                      </td>
                                    </>
                                  )}
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Mobile card list */}
            {!loadingTransactions && (
              <div className="md:hidden space-y-1">
                {/* Mobile purpose combobox */}
                <div className="flex items-center gap-2 mb-3">
                  <Combobox
                    className="flex-1"
                    placeholder="Set purpose for new entry..."
                    options={uniquePurposes}
                    value={activeTrxType === 'Income' ? incomePurposeValue : expensePurposeValue}
                    onChange={activeTrxType === 'Income' ? setIncomePurposeValue : setExpensePurposeValue}
                  />
                </div>
                {transactions.filter(t => t.type === activeTrxType).length === 0 ? (
                  <div className="py-10 text-center text-slate-400">
                    <Layout size={28} className="mx-auto mb-2 opacity-20" />
                    <p className="text-sm">No {activeTrxType.toLowerCase()} entries yet</p>
                    <p className="text-xs mt-0.5 opacity-70">Tap Add to create one</p>
                  </div>
                ) : (
                  transactions.filter(t => t.type === activeTrxType).map(tx => {
                    const linkedAmount = bankTransactions.reduce((sum, btx) => {
                      const ids = (btx as any).projectTransactionIds || ((btx as any).projectTransactionId ? [(btx as any).projectTransactionId] : []);
                      return ids.includes(tx.id) ? sum + Math.abs(btx.amount) : sum;
                    }, 0);
                    const badgeVariant: any = linkedAmount <= 0 ? 'neutral' : Math.abs(linkedAmount - Math.abs(tx.amount)) < 0.01 ? 'success' : linkedAmount > Math.abs(tx.amount) + 0.01 ? 'error' : 'warning';
                    const isIncome = activeTrxType === 'Income';
                    const isSelected = selectedProjectTxIds.includes(tx.id);
                    return (
                      <div key={tx.id}
                        className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${isSelected ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100'}`}
                        onClick={() => {
                          if (isSelected) setSelectedProjectTxIds(selectedProjectTxIds.filter(id => id !== tx.id));
                          else setSelectedProjectTxIds([...selectedProjectTxIds, tx.id]);
                        }}>
                        <Checkbox checked={isSelected} onChange={() => {}} className="mt-0.5 shrink-0 pointer-events-none" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-800 truncate">{tx.description || '—'}</p>
                            <span className={`text-sm font-bold font-mono shrink-0 ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                              {isIncome ? '+' : '-'}{formatCurrency(Math.abs(tx.amount), account.currency)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {tx.purpose && <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{tx.purpose}</span>}
                            <span className="text-[11px] text-slate-400">{new Date(tx.date).toLocaleDateString()}</span>
                            {tx.referenceNumber && <span className="text-[11px] font-mono text-slate-400">{tx.referenceNumber}</span>}
                            <Badge variant={badgeVariant}>{formatCurrency(linkedAmount, account.currency)}/{formatCurrency(Math.abs(tx.amount), account.currency)}</Badge>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <button onClick={(e) => { e.stopPropagation(); startInlineEdit(tx); }} className="p-1.5 text-slate-400 hover:text-jci-blue hover:bg-slate-100 rounded-lg transition-colors"><Edit size={14} /></button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteTransaction(tx.id); }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Batch toolbar — sticky bottom */}
            {selectedProjectTxIds.length > 0 && (
              <div className="sticky bottom-2 z-20 mx-1">
                <div className="bg-slate-900 text-white rounded-2xl px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl">
                  <span className="text-sm font-semibold shrink-0">{selectedProjectTxIds.length} selected</span>
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <div className="flex items-center gap-1.5 bg-slate-800 rounded-xl px-2 py-1 flex-1 sm:flex-none">
                      <Combobox
                        placeholder="Set purpose..."
                        options={uniquePurposes}
                        value={batchProjectPurposeValue}
                        onChange={setBatchProjectPurposeValue}
                        className="w-44 border-none bg-transparent text-white placeholder-slate-400 text-sm"
                      />
                      <Button onClick={handleBatchSetProjectTxPurpose} disabled={!batchProjectPurposeValue.trim() || loadingTransactions} size="sm" className="shrink-0 bg-jci-blue hover:bg-jci-blue/90 border-none text-white">
                        Apply
                      </Button>
                    </div>
                    <Button variant="danger" size="sm" onClick={handleBatchDeleteProjectTransactions} disabled={loadingTransactions} className="shrink-0">
                      <Trash2 size={14} className="mr-1.5" /> Delete
                    </Button>
                    <button onClick={() => setSelectedProjectTxIds([])} className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors shrink-0">
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeFinancialTab === 'bankTrx' && (
          <div className="space-y-4 animate-in slide-in-from-right-2 duration-300">
            {(() => {
              const filteredBankTx = bankTransactions.filter(tx => {
                if (!bankTxSearchQuery) return true;
                const q = bankTxSearchQuery.toLowerCase().trim();
                const isNumericStr = q !== '' && !isNaN(Number(q));
                return (isNumericStr && tx.amount === Number(q)) ||
                  tx.description?.toLowerCase().includes(q) ||
                  tx.referenceNumber?.toLowerCase().includes(q);
              });
              const bankIncomes = filteredBankTx.filter(tx => tx.type === 'Income');
              const bankExpenses = filteredBankTx.filter(tx => tx.type === 'Expense');
              const bankIncomeTotal = bankIncomes.reduce((sum, tx) => sum + tx.amount, 0);
              const bankExpensesTotal = bankExpenses.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
              const activeList = activeBankTrxType === 'Income' ? bankIncomes : bankExpenses;
              const isIncome = activeBankTrxType === 'Income';
              const accentColor = isIncome ? 'text-green-600' : 'text-red-600';
              const groupBg = isIncome ? 'bg-green-50/60' : 'bg-red-50/40';

              const getAvailableProjectTxOptions = (currentBankTx: any) => {
                const currentLinkedIds = currentBankTx.projectTransactionIds || (currentBankTx.projectTransactionId ? [currentBankTx.projectTransactionId] : []);
                const opts = (transactions || []).filter(t => {
                  if (t.type !== currentBankTx.type) return false;
                  if (currentLinkedIds.includes(t.id)) return true;
                  const totalLinked = bankTransactions.reduce((sum, btx) => {
                    const ids = (btx as any).projectTransactionIds || ((btx as any).projectTransactionId ? [(btx as any).projectTransactionId] : []);
                    return ids.includes(t.id) ? sum + Math.abs(btx.amount) : sum;
                  }, 0);
                  return totalLinked < Math.abs(t.amount) - 0.01;
                }).map(t => ({
                  label: `${t.description || t.purpose || 'Txn'}${t.referenceNumber ? ` (${t.referenceNumber})` : ''} · ${formatCurrency(t.amount, account.currency)}`,
                  value: t.id
                }));
                opts.sort((a, b) => {
                  const aS = currentLinkedIds.includes(a.value), bS = currentLinkedIds.includes(b.value);
                  return aS === bS ? a.label.localeCompare(b.label) : aS ? -1 : 1;
                });
                return opts;
              };

              const batchLinkOptions = (() => {
                const selectedTxTypes = selectedBankTxIds.map(id => bankTransactions.find(bt => bt.id === id)?.type).filter(Boolean);
                const targetType = selectedTxTypes[0];
                const opts = (transactions || []).filter(t => {
                  if (targetType && t.type !== targetType) return false;
                  const totalLinked = bankTransactions.reduce((sum, btx) => {
                    const ids = (btx as any).projectTransactionIds || ((btx as any).projectTransactionId ? [(btx as any).projectTransactionId] : []);
                    return ids.includes(t.id) ? sum + Math.abs(btx.amount) : sum;
                  }, 0);
                  return totalLinked < Math.abs(t.amount) - 0.01 || batchProjectTxIds.includes(t.id);
                }).map(t => ({
                  label: `${t.description || t.purpose || 'Txn'}${t.referenceNumber ? ` (${t.referenceNumber})` : ''} · ${formatCurrency(t.amount, account.currency)}`,
                  value: t.id
                }));
                opts.sort((a, b) => {
                  const aS = batchProjectTxIds.includes(a.value), bS = batchProjectTxIds.includes(b.value);
                  return aS === bS ? a.label.localeCompare(b.label) : aS ? -1 : 1;
                });
                return opts;
              })();

              const grouped = activeList.reduce((g, tx) => {
                const linkedIds = (tx as any).projectTransactionIds || ((tx as any).projectTransactionId ? [(tx as any).projectTransactionId] : []);
                const matchedTx = transactions.find(t => linkedIds.includes(t.id));
                const purpose = tx.purpose || matchedTx?.purpose || 'Unmatched / Uncategorized';
                (g[purpose] = g[purpose] || []).push(tx);
                return g;
              }, {} as Record<string, Transaction[]>);

              return (
                <>
                  {/* Summary strip — rows on mobile, 3-col on desktop */}
                  <div className="bg-white rounded-xl border border-slate-100 overflow-hidden divide-y divide-slate-100 shadow-sm md:bg-transparent md:border-none md:rounded-none md:overflow-visible md:shadow-none md:divide-y-0 md:grid md:grid-cols-3 md:gap-2">
                    <div className="flex justify-between items-center px-4 py-2.5 md:block md:bg-green-50 md:border md:border-green-100 md:rounded-xl md:px-3 md:py-2.5">
                      <span className="text-sm text-slate-500 md:text-[10px] md:font-semibold md:text-green-600 md:uppercase md:tracking-wider md:block md:mb-0.5">Bank Income</span>
                      <span className="text-sm font-bold font-mono text-green-700 tabular-nums md:text-base">{formatCurrency(bankIncomeTotal, account.currency)}</span>
                    </div>
                    <div className="flex justify-between items-center px-4 py-2.5 md:block md:bg-red-50 md:border md:border-red-100 md:rounded-xl md:px-3 md:py-2.5">
                      <span className="text-sm text-slate-500 md:text-[10px] md:font-semibold md:text-red-500 md:uppercase md:tracking-wider md:block md:mb-0.5">Bank Expenses</span>
                      <span className="text-sm font-bold font-mono text-red-600 tabular-nums md:text-base">{formatCurrency(bankExpensesTotal, account.currency)}</span>
                    </div>
                    <div className={`flex justify-between items-center px-4 py-2.5 md:block md:border md:rounded-xl md:px-3 md:py-2.5 ${(bankIncomeTotal - bankExpensesTotal) >= 0 ? 'md:bg-slate-50 md:border-slate-200' : 'md:bg-rose-50 md:border-rose-100'}`}>
                      <span className="text-sm text-slate-500 md:text-[10px] md:font-semibold md:text-slate-500 md:uppercase md:tracking-wider md:block md:mb-0.5">Net</span>
                      <span className={`text-sm font-bold font-mono tabular-nums md:text-base ${(bankIncomeTotal - bankExpensesTotal) >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>{formatCurrency(bankIncomeTotal - bankExpensesTotal, account.currency)}</span>
                    </div>
                  </div>

                  {/* Toggle row */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex bg-slate-100 p-1 rounded-lg gap-1 shrink-0">
                      <button type="button"
                        onClick={() => { setActiveBankTrxType('Income'); setSelectedBankTxIds([]); }}
                        className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-all ${activeBankTrxType === 'Income' ? 'bg-white text-green-700 shadow-sm border border-green-200' : 'text-slate-500 hover:text-slate-800'}`}>
                        Income <span className="ml-1 text-xs font-mono opacity-70">{bankIncomes.length}</span>
                      </button>
                      <button type="button"
                        onClick={() => { setActiveBankTrxType('Expense'); setSelectedBankTxIds([]); }}
                        className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-all ${activeBankTrxType === 'Expense' ? 'bg-white text-red-600 shadow-sm border border-red-200' : 'text-slate-500 hover:text-slate-800'}`}>
                        Expenses <span className="ml-1 text-xs font-mono opacity-70">{bankExpenses.length}</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <div className="relative max-w-xs w-full">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <Input placeholder="Search..." value={bankTxSearchQuery} onChange={(e) => setBankTxSearchQuery(e.target.value)} className="pl-8 h-9 text-sm" />
                      </div>
                      <Button onClick={handleAutoMatch} variant="outline" size="sm" className="shrink-0 text-jci-blue border-jci-blue hover:bg-jci-blue hover:text-white">
                        <BrainCircuit size={14} className="mr-1.5" /> Auto Match
                      </Button>
                    </div>
                  </div>

                  {loadingBankTransactions ? (
                    <div className="flex justify-center py-8">
                      <RefreshCw className="animate-spin text-jci-blue" size={28} />
                    </div>
                  ) : bankTransactions.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                      <Layout size={28} className="mx-auto mb-2 opacity-20" />
                      <p className="text-sm">No bank transactions linked to this project</p>
                    </div>
                  ) : (
                    <>
                      {/* Desktop table */}
                      <Card className="hidden md:block overflow-hidden border-none shadow-sm" noPadding>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500">
                              <tr>
                                <th className="py-2.5 px-3 w-[36px]">
                                  <Checkbox
                                    checked={activeList.length > 0 && activeList.every(tx => selectedBankTxIds.includes(tx.id))}
                                    onChange={(e) => {
                                      const ids = activeList.map(tx => tx.id);
                                      if (e.target.checked) setSelectedBankTxIds([...new Set([...selectedBankTxIds, ...ids])]);
                                      else setSelectedBankTxIds(selectedBankTxIds.filter(id => !ids.includes(id)));
                                    }}
                                  />
                                </th>
                                <th className="py-2.5 px-2 text-xs font-semibold w-[10%]">Date</th>
                                <th className="py-2.5 px-2 text-xs font-semibold w-[22%]">Description</th>
                                <th className="py-2.5 px-2 text-xs font-semibold w-[10%]">Ref</th>
                                <th className="py-2.5 px-2 text-xs font-semibold w-[30%]">Link to Project Trx</th>
                                <th className="py-2.5 px-2 text-xs font-semibold text-right w-[12%]">Amount</th>
                                <th className="py-2.5 px-2 text-xs font-semibold w-[10%]">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {activeList.length === 0 ? (
                                <tr><td colSpan={7} className="py-10 text-center text-slate-400">
                                  <p className="text-sm">No {activeBankTrxType.toLowerCase()} bank transactions</p>
                                </td></tr>
                              ) : Object.entries(grouped).map(([purpose, grpTxs]) => (
                                <React.Fragment key={purpose}>
                                  <tr>
                                    <td colSpan={4} className={`py-1.5 px-3 text-xs font-bold text-slate-600 ${groupBg}`}>{purpose} <span className="font-normal opacity-60">({grpTxs.length})</span></td>
                                    <td className={groupBg}></td>
                                    <td className={`py-1.5 px-2 text-right text-xs font-bold font-mono ${accentColor} ${groupBg}`}>
                                      {formatCurrency(grpTxs.reduce((s, t) => s + Math.abs(t.amount), 0), account.currency)}
                                    </td>
                                    <td className={groupBg}></td>
                                  </tr>
                                  {grpTxs.map(tx => {
                                    const linkedIds = (tx as any).projectTransactionIds || ((tx as any).projectTransactionId ? [(tx as any).projectTransactionId] : []);
                                    const tempSelected = tempSelectedProjectTxIds[tx.id];
                                    const hasChanged = tempSelected !== undefined && JSON.stringify(tempSelected.slice().sort()) !== JSON.stringify(linkedIds.slice().sort());
                                    const selectedValue = tempSelected !== undefined ? tempSelected : linkedIds;
                                    const txSplits = bankTxSplits[tx.id] || [];
                                    const hasSplits = (tx as any).isSplit && txSplits.length > 0;
                                    const isExpanded = expandedSplitParents.has(tx.id);
                                    return (
                                      <React.Fragment key={tx.id}>
                                      <tr className="hover:bg-slate-50/70 group transition-colors">
                                        <td className="py-1.5 px-3">
                                          <Checkbox checked={selectedBankTxIds.includes(tx.id)} onChange={(e) => {
                                            if (e.target.checked) setSelectedBankTxIds([...selectedBankTxIds, tx.id]);
                                            else setSelectedBankTxIds(selectedBankTxIds.filter(id => id !== tx.id));
                                          }} />
                                        </td>
                                        <td className="py-1.5 px-2 text-slate-400 text-xs font-mono whitespace-nowrap">{new Date(tx.date).toLocaleDateString()}</td>
                                        <td className="py-1.5 px-2 text-slate-800 text-sm">
                                          <div className="flex items-center gap-1.5">
                                            {hasSplits && (
                                              <button type="button" onClick={() => setExpandedSplitParents(prev => { const s = new Set(prev); s.has(tx.id) ? s.delete(tx.id) : s.add(tx.id); return s; })}
                                                className="text-jci-blue hover:bg-blue-50 rounded p-0.5 shrink-0" title="Show splits">
                                                <Layout size={12} />
                                              </button>
                                            )}
                                            <span>{tx.description}</span>
                                            {hasSplits && <span className="text-[10px] text-slate-400 font-mono shrink-0">{txSplits.length} splits</span>}
                                          </div>
                                        </td>
                                        <td className="py-1.5 px-2 text-slate-400 text-xs font-mono">{tx.referenceNumber || '—'}</td>
                                        <td className="py-1.5 px-2">
                                          {!hasSplits ? (
                                            <div className="space-y-1">
                                              <div className="flex items-center gap-1.5">
                                                <div className="flex-1 min-w-0">
                                                  <MultiSelectDropdown
                                                    selected={selectedValue}
                                                    onChange={(ids) => setTempSelectedProjectTxIds(prev => ({ ...prev, [tx.id]: ids }))}
                                                    options={getAvailableProjectTxOptions(tx)}
                                                    placeholder="Link..."
                                                  />
                                                </div>
                                                {hasChanged && (
                                                  <div className="flex gap-1 shrink-0">
                                                    <button onClick={() => handleLinkBankTransaction(tx.id, selectedValue)} className="p-1 text-green-600 border border-green-200 hover:bg-green-50 rounded shadow-sm"><Check size={14} /></button>
                                                    <button onClick={() => setTempSelectedProjectTxIds(prev => { const c = { ...prev }; delete c[tx.id]; return c; })} className="p-1 text-red-500 border border-red-200 hover:bg-red-50 rounded shadow-sm"><X size={14} /></button>
                                                  </div>
                                                )}
                                              </div>
                                              {/* Per-project-tx amount breakdown (情景 EE) */}
                                              {linkedIds.length > 1 && txSplits.length > 0 && (
                                                <div className="space-y-0.5 pl-1">
                                                  {linkedIds.map(lid => {
                                                    const splitForLink = txSplits.find(s => s.projectTransactionId === lid || s.projectTransactionIds?.includes(lid));
                                                    const projTx = transactions.find(t => t.id === lid);
                                                    if (!splitForLink) return null;
                                                    return (
                                                      <div key={lid} className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                                        <span className="truncate max-w-[100px]">{projTx?.description || projTx?.purpose || lid.substring(0, 8)}</span>
                                                        <span className="font-mono text-slate-600 shrink-0">{formatCurrency(splitForLink.amount, account.currency)}</span>
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              )}
                                            </div>
                                          ) : (
                                            <span className="text-[11px] text-slate-400 italic">Link per split ↓</span>
                                          )}
                                        </td>
                                        <td className={`py-1.5 px-2 text-right font-mono font-semibold text-sm ${accentColor}`}>
                                          {isIncome ? '+' : '-'}{formatCurrency(Math.abs(tx.amount), account.currency)}
                                        </td>
                                        <td className="py-1.5 px-2">
                                          <Badge variant={linkedIds.length > 0 ? 'success' : 'warning'}>
                                            {linkedIds.length > 0 ? 'Reconciled' : 'Unreconciled'}
                                          </Badge>
                                        </td>
                                      </tr>
                                      {/* Split sub-rows (情景 PP) */}
                                      {hasSplits && isExpanded && txSplits.map(split => {
                                        const splitLinkedIds = split.projectTransactionIds || (split.projectTransactionId ? [split.projectTransactionId] : []);
                                        const splitTempSelected = tempSelectedProjectTxIds[split.id];
                                        const splitHasChanged = splitTempSelected !== undefined && JSON.stringify(splitTempSelected.slice().sort()) !== JSON.stringify(splitLinkedIds.slice().sort());
                                        const splitSelectedValue = splitTempSelected !== undefined ? splitTempSelected : splitLinkedIds;
                                        const splitAsFakeTx = { ...tx, id: split.id, amount: split.amount, projectTransactionIds: splitLinkedIds };
                                        return (
                                          <tr key={split.id} className="bg-slate-50/60 border-l-2 border-l-jci-blue/20">
                                            <td className="py-1 px-3" />
                                            <td className="py-1 px-2 text-slate-300 text-xs font-mono pl-6">└</td>
                                            <td className="py-1 px-2 text-slate-600 text-xs pl-2">
                                              <span>{split.description || split.category || 'Split'}</span>
                                              {split.category && <span className="ml-1.5 text-[10px] text-slate-400 bg-slate-100 rounded px-1">{split.category}</span>}
                                            </td>
                                            <td className="py-1 px-2 text-slate-300 text-xs">—</td>
                                            <td className="py-1 px-2">
                                              <div className="flex items-center gap-1.5">
                                                <div className="flex-1 min-w-0">
                                                  <MultiSelectDropdown
                                                    selected={splitSelectedValue}
                                                    onChange={(ids) => setTempSelectedProjectTxIds(prev => ({ ...prev, [split.id]: ids }))}
                                                    options={getAvailableProjectTxOptions(splitAsFakeTx)}
                                                    placeholder="Link split..."
                                                  />
                                                </div>
                                                {splitHasChanged && (
                                                  <div className="flex gap-1 shrink-0">
                                                    <button onClick={() => handleLinkBankTransaction(split.id, splitSelectedValue)} className="p-1 text-green-600 border border-green-200 hover:bg-green-50 rounded shadow-sm"><Check size={14} /></button>
                                                    <button onClick={() => setTempSelectedProjectTxIds(prev => { const c = { ...prev }; delete c[split.id]; return c; })} className="p-1 text-red-500 border border-red-200 hover:bg-red-50 rounded shadow-sm"><X size={14} /></button>
                                                  </div>
                                                )}
                                              </div>
                                            </td>
                                            <td className={`py-1 px-2 text-right font-mono text-xs ${accentColor}`}>
                                              {isIncome ? '+' : '-'}{formatCurrency(Math.abs(split.amount), account.currency)}
                                            </td>
                                            <td className="py-1 px-2">
                                              <Badge variant={splitLinkedIds.length > 0 ? 'success' : 'warning'} className="text-[10px]">
                                                {splitLinkedIds.length > 0 ? 'Linked' : 'Unlinked'}
                                              </Badge>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                      </React.Fragment>
                                    );
                                  })}
                                </React.Fragment>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Card>

                      {/* Mobile card list */}
                      <div className="md:hidden space-y-1.5">
                        {activeList.length === 0 ? (
                          <div className="py-10 text-center text-slate-400">
                            <p className="text-sm">No {activeBankTrxType.toLowerCase()} bank transactions</p>
                          </div>
                        ) : activeList.map(tx => {
                          const linkedIds = (tx as any).projectTransactionIds || ((tx as any).projectTransactionId ? [(tx as any).projectTransactionId] : []);
                          const tempSelected = tempSelectedProjectTxIds[tx.id];
                          const hasChanged = tempSelected !== undefined && JSON.stringify(tempSelected.slice().sort()) !== JSON.stringify(linkedIds.slice().sort());
                          const selectedValue = tempSelected !== undefined ? tempSelected : linkedIds;
                          const isSelected = selectedBankTxIds.includes(tx.id);
                          return (
                            <div key={tx.id}
                              className={`rounded-xl border p-3 transition-all ${isSelected ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100'}`}
                              onClick={() => {
                                if (isSelected) setSelectedBankTxIds(selectedBankTxIds.filter(id => id !== tx.id));
                                else setSelectedBankTxIds([...selectedBankTxIds, tx.id]);
                              }}>
                              <div className="flex items-start gap-3">
                                <Checkbox checked={isSelected} onChange={() => {}} className="mt-0.5 shrink-0 pointer-events-none" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-semibold text-slate-800 truncate">{tx.description}</p>
                                    <span className={`text-sm font-bold font-mono shrink-0 ${accentColor}`}>
                                      {isIncome ? '+' : '-'}{formatCurrency(Math.abs(tx.amount), account.currency)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    <span className="text-[11px] text-slate-400">{new Date(tx.date).toLocaleDateString()}</span>
                                    {tx.referenceNumber && <span className="text-[11px] font-mono text-slate-400">{tx.referenceNumber}</span>}
                                    <Badge variant={linkedIds.length > 0 ? 'success' : 'warning'}>
                                      {linkedIds.length > 0 ? 'Reconciled' : 'Unreconciled'}
                                    </Badge>
                                  </div>
                                  {/* Link row */}
                                  <div className="mt-2 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                    <div className="flex-1 min-w-0">
                                      <MultiSelectDropdown
                                        selected={selectedValue}
                                        onChange={(ids) => setTempSelectedProjectTxIds(prev => ({ ...prev, [tx.id]: ids }))}
                                        options={getAvailableProjectTxOptions(tx)}
                                        placeholder="Link to project trx..."
                                      />
                                    </div>
                                    {hasChanged && (
                                      <div className="flex gap-1 shrink-0">
                                        <button onClick={() => handleLinkBankTransaction(tx.id, selectedValue)} className="p-1.5 text-green-600 border border-green-200 hover:bg-green-50 rounded-lg shadow-sm"><Check size={14} /></button>
                                        <button onClick={() => setTempSelectedProjectTxIds(prev => { const c = { ...prev }; delete c[tx.id]; return c; })} className="p-1.5 text-red-500 border border-red-200 hover:bg-red-50 rounded-lg shadow-sm"><X size={14} /></button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Batch toolbar — sticky bottom */}
                      {selectedBankTxIds.length > 0 && (
                        <div className="sticky bottom-2 z-20 mx-1">
                          <div className="bg-slate-900 text-white rounded-2xl px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl">
                            <span className="text-sm font-semibold shrink-0">{selectedBankTxIds.length} selected</span>
                            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                              {isMixedBankTxSelected ? (
                                <span className="text-xs text-rose-300 bg-rose-900/40 px-2.5 py-1.5 rounded-lg border border-rose-700/50 font-medium">
                                  Cannot link mixed Income & Expense
                                </span>
                              ) : (
                                <div className="flex items-center gap-1.5 bg-slate-800 rounded-xl px-2 py-1 flex-1 sm:flex-none">
                                  <MultiSelectDropdown
                                    selected={batchProjectTxIds}
                                    onChange={setBatchProjectTxIds}
                                    options={batchLinkOptions}
                                    placeholder="Link to project trx..."
                                    className="w-52 border-none bg-transparent text-white text-sm"
                                  />
                                  <Button onClick={handleBatchLinkBankTransactions} disabled={batchProjectTxIds.length === 0} size="sm" className="shrink-0 bg-jci-blue hover:bg-jci-blue/90 border-none text-white">
                                    Apply
                                  </Button>
                                </div>
                              )}
                              {bankTransactions.some(t => selectedBankTxIds.includes(t.id) && ((t as any).projectTransactionIds?.length > 0 || (t as any).projectTransactionId)) && (
                                <Button onClick={handleBatchUnlinkBankTransactions} variant="outline" size="sm" className="shrink-0 text-rose-300 border-rose-700/50 hover:bg-rose-900/40">
                                  Unlink
                                </Button>
                              )}
                              <button onClick={() => setSelectedBankTxIds([])} className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors shrink-0">
                                <X size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              );
            })()}
          </div>
        )}
        {activeFinancialTab === 'paymentRequests' && (
          <div className="space-y-3 animate-in fade-in duration-500">
            <p className="text-xs text-slate-500">{projectPRs.length} claim{projectPRs.length !== 1 ? 's' : ''} linked to this project</p>
            {loadingPRs ? (
              <div className="text-center py-8 text-slate-400 text-sm">Loading...</div>
            ) : (
              <div className="space-y-3">
                {/* New Claim row */}
                <div
                  className="flex items-center gap-2 px-4 py-3 cursor-pointer text-slate-400 hover:text-jci-blue hover:bg-blue-50/50 transition-colors rounded-xl border border-dashed border-slate-200 hover:border-jci-blue"
                  onClick={handleClaimReimbursement}
                >
                  <div className="w-6 h-6 rounded border-2 border-dashed border-current flex items-center justify-center shrink-0">
                    <Plus size={12} />
                  </div>
                  <span className="text-sm font-semibold">New Claim</span>
                </div>
                {/* Grouped by applicant */}
                {(() => {
                  const statusColors: Record<string, string> = {
                    submitted: 'bg-amber-50 text-amber-700 border-amber-200',
                    approved: 'bg-green-50 text-green-700 border-green-200',
                    paid: 'bg-blue-50 text-blue-700 border-blue-200',
                    rejected: 'bg-red-50 text-red-700 border-red-200',
                    cancelled: 'bg-slate-50 text-slate-500 border-slate-200',
                    draft: 'bg-slate-50 text-slate-500 border-slate-200',
                  };
                  const statusLabel: Record<string, string> = { submitted: 'Pending', approved: 'Approved', paid: 'Paid', rejected: 'Rejected', cancelled: 'Cancelled', draft: 'Draft' };
                  const grouped = projectPRs.reduce<Record<string, { name: string; prs: typeof projectPRs }>>((acc, pr) => {
                    const key = pr.applicantId || 'unknown';
                    if (!acc[key]) acc[key] = { name: pr.applicantName || pr.applicantId || 'Unknown', prs: [] };
                    acc[key].prs.push(pr);
                    return acc;
                  }, {});
                  return Object.entries(grouped).map(([key, { name, prs: applicantPRs }]) => {
                    const total = applicantPRs.reduce((sum, pr) => sum + (pr.totalAmount || pr.amount || 0), 0);
                    return (
                      <div key={key} className="rounded-xl border border-slate-100 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-100">
                          <span className="text-xs font-semibold text-slate-600">{name}</span>
                          <span className="text-xs font-mono font-bold text-slate-700">{formatCurrency(total)}</span>
                        </div>
                        <div className="divide-y divide-slate-50">
                          {applicantPRs.map(pr => (
                            <div key={pr.id} className="flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50/60 transition-colors">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-slate-800 truncate">{pr.purpose || pr.items?.[0]?.purpose || '—'}</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">{pr.referenceNumber} · {new Date(pr.createdAt).toLocaleDateString()}</p>
                              </div>
                              <div className="flex items-center gap-3 ml-4 shrink-0">
                                <span className="text-sm font-bold font-mono text-slate-800">{formatCurrency(pr.totalAmount || pr.amount)}</span>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusColors[pr.status] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                  {statusLabel[pr.status] || pr.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Claim Reimbursement — reuse full Submit Payment Request modal */}
      <SubmitPaymentRequestModal
        isOpen={isClaimDrawerOpen}
        onClose={() => setIsClaimDrawerOpen(false)}
        preselectedProjectId={projectId}
        preselectedCategory="projects_activities"
        onSuccess={() => showToast('Reimbursement claim submitted', 'success')}
      />
    </>
  );
};
