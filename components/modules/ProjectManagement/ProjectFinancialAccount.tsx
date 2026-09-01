import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import {
  DollarSign, TrendingDown, AlertTriangle, Plus, Target, CheckCircle, XCircle, Clock,
  BarChart3, ArrowUpRight, ArrowDownRight, Edit3, Search, Link2, Link2Off, X, Check,
} from 'lucide-react';
import type {
  ProjectFinancialAccount,
  ProjectFinancialSummary,
  ProjectFinancialAlert,
  Project,
  Transaction,
  BudgetCategory,
} from '../../../types';
import {
  projectFinancialService,
  CreateProjectAccountData,
  RecordTransactionData,
} from '../../../services/projectFinancialService';
import { FinanceService } from '../../../services/financeService';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { COLLECTIONS } from '../../../config/constants';
import * as Forms from '../../ui/Form';
import { Button, Modal, Badge, Drawer, useToast } from '../../ui/Common';

type MainTab = 'overview' | 'budgeting' | 'project-entries' | 'bank-statement';

interface ProjectFinancialAccountProps {
  project: Project;
  onUpdateProject?: (projectId: string, updates: Partial<Project>) => Promise<void>;
  onClose?: () => void;
}

const EXPENSE_CATEGORIES = [
  { id: 'materials', name: 'Materials & Supplies',    color: '#3B82F6' },
  { id: 'labor',     name: 'Labor & Contractors',     color: '#10B981' },
  { id: 'equipment', name: 'Equipment & Tools',       color: '#F59E0B' },
  { id: 'travel',    name: 'Travel & Transportation', color: '#EF4444' },
  { id: 'marketing', name: 'Marketing & Promotion',   color: '#8B5CF6' },
  { id: 'overhead',  name: 'Overhead & Admin',        color: '#6B7280' },
  { id: 'other',     name: 'Other Expenses',          color: '#EC4899' },
];

export const ProjectFinancialAccountView: React.FC<ProjectFinancialAccountProps> = ({
  project,
  onUpdateProject,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  // ── Navigation ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<MainTab>('overview');

  // ── Data ─────────────────────────────────────────────────────────────────────
  const [account, setAccount] = useState<ProjectFinancialAccount | null>(null);
  const [summary, setSummary] = useState<ProjectFinancialSummary | null>(null);
  const [bankTxList, setBankTxList] = useState<Transaction[]>([]);
  const [projectTrxList, setProjectTrxList] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateAccount, setShowCreateAccount] = useState(false);

  // ── Create account ────────────────────────────────────────────────────────────
  const [isCreating, setIsCreating] = useState(false);
  const [newAccountData, setNewAccountData] = useState<Partial<CreateProjectAccountData>>({
    budget: project.budget || 0,
    startingBalance: 0,
    budgetCategories: EXPENSE_CATEGORIES.map(cat => ({
      name: cat.name, allocatedAmount: 0, color: cat.color,
      description: `Budget category for ${cat.name.toLowerCase()}`,
    })),
  });

  // ── Add transaction (project entry) ───────────────────────────────────────────
  const [showAddTx, setShowAddTx] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newTxData, setNewTxData] = useState<Partial<RecordTransactionData>>({
    type: 'expense', amount: 0, description: '', date: new Date().toISOString().split('T')[0],
  });

  // ── Budget editing ────────────────────────────────────────────────────────────
  const [showBudgetDrawer, setShowBudgetDrawer] = useState(false);
  const [isSavingBudget, setIsSavingBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState(project.budget || 0);

  // ── Budget category inline edit (Budgeting tab) ───────────────────────────────
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catDraft, setCatDraft] = useState({ name: '', description: '', allocatedAmount: 0 });
  const [isSavingCat, setIsSavingCat] = useState(false);

  // ── Project entry inline edit ─────────────────────────────────────────────────
  const [editingPrjId, setEditingPrjId] = useState<string | null>(null);
  const [prjDraft, setPrjDraft] = useState({ description: '', purpose: '', amount: '' });
  const [isSavingPrj, setIsSavingPrj] = useState(false);

  // ── Bank purpose inline edit ──────────────────────────────────────────────────
  const [editingBankPurposeId, setEditingBankPurposeId] = useState<string | null>(null);
  const [purposeDraft, setPurposeDraft] = useState('');
  const [isSavingPurpose, setIsSavingPurpose] = useState(false);

  // ── Matching (project entry ↔ bank tx) ───────────────────────────────────────
  const [matchingPrjTxId, setMatchingPrjTxId] = useState<string | null>(null);
  const [matchSearch, setMatchSearch] = useState('');
  const [isSavingMatch, setIsSavingMatch] = useState(false);

  // ── Filters ───────────────────────────────────────────────────────────────────
  const [prjSearch, setPrjSearch] = useState('');
  const [prjTypeFilter, setPrjTypeFilter] = useState<'all' | 'Income' | 'Expense'>('all');
  const [bankSearch, setBankSearch] = useState('');
  const [bankTypeFilter, setBankTypeFilter] = useState<'all' | 'Income' | 'Expense'>('all');

  useEffect(() => { loadData(); }, [project.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [details, projectTxs, bankTxs] = await Promise.all([
        projectFinancialService.getFullProjectFinancialDetails(project),
        FinanceService.getProjectTransactions(project.id).catch(() => [] as Transaction[]),
        FinanceService.getBankTransactionsByProject(project.id).catch(() => [] as Transaction[]),
      ]);
      if (details) {
        setAccount(details.account);
        setSummary(details.summary);
        setShowCreateAccount(false);
      } else {
        setShowCreateAccount(true);
      }
      setProjectTrxList(projectTxs);
      setBankTxList(bankTxs);
    } catch {
      showToast('Failed to load financial data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Formatters ────────────────────────────────────────────────────────────────
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(n);

  const fmtDate = (d: string) =>
    d ? new Date(d).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: '2-digit' }) : '—';

  const utilizationColor = (pct: number) =>
    pct >= 100 ? 'text-red-600' : pct >= 80 ? 'text-orange-500' : pct >= 60 ? 'text-yellow-600' : 'text-emerald-600';

  const progressBg = (pct: number) =>
    pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-orange-500' : 'bg-emerald-500';

  const getAlertIcon = (severity: ProjectFinancialAlert['severity']) => {
    if (severity === 'critical') return <XCircle size={14} className="text-red-500 shrink-0" />;
    if (severity === 'high') return <AlertTriangle size={14} className="text-orange-500 shrink-0" />;
    if (severity === 'medium') return <Clock size={14} className="text-yellow-500 shrink-0" />;
    return <CheckCircle size={14} className="text-blue-500 shrink-0" />;
  };

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const calcStats = (items: Transaction[]) => {
    const income  = items.filter(t => t.type === 'Income').reduce((s, t) => s + Math.abs(t.amount || 0), 0);
    const expense = items.filter(t => t.type === 'Expense').reduce((s, t) => s + Math.abs(t.amount || 0), 0);
    return { income, expense, net: income - expense };
  };

  const filteredPrjTx = useMemo(() =>
    projectTrxList.filter(tx => {
      const mt = prjTypeFilter === 'all' || tx.type === prjTypeFilter;
      const ms = !prjSearch || (tx.description || '').toLowerCase().includes(prjSearch.toLowerCase())
                            || (tx.purpose   || '').toLowerCase().includes(prjSearch.toLowerCase());
      return mt && ms;
    }),
  [projectTrxList, prjTypeFilter, prjSearch]);

  const filteredBankTx = useMemo(() =>
    bankTxList.filter(tx => {
      const mt = bankTypeFilter === 'all' || tx.type === bankTypeFilter;
      const ms = !bankSearch || (tx.description || '').toLowerCase().includes(bankSearch.toLowerCase());
      return mt && ms;
    }),
  [bankTxList, bankTypeFilter, bankSearch]);

  // Group bank transactions by purpose (named groups first alphabetically, empty purpose last)
  const groupedBankByPurpose = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    filteredBankTx.forEach(tx => {
      const key = tx.purpose?.trim() || '';
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    });
    return Object.entries(groups).sort(([a], [b]) => {
      if (!a && b) return 1;
      if (a && !b) return -1;
      return a.localeCompare(b);
    });
  }, [filteredBankTx]);

  // Group project entries by purpose (named groups first alphabetically, empty purpose last)
  const groupedByPurpose = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    filteredPrjTx.forEach(tx => {
      const key = tx.purpose?.trim() || '';
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    });
    return Object.entries(groups).sort(([a], [b]) => {
      if (!a && b) return 1;
      if (a && !b) return -1;
      return a.localeCompare(b);
    });
  }, [filteredPrjTx]);

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleCreateAccount = async () => {
    setIsCreating(true);
    try {
      await projectFinancialService.createProjectFinancialAccount({
        projectId: project.id,
        projectName: project.name ?? project.title ?? 'Project',
        budget: newAccountData.budget || 0,
        startingBalance: newAccountData.startingBalance || 0,
        budgetCategories: newAccountData.budgetCategories || [],
      }, user?.uid ?? '');
      await loadData();
    } catch {
      showToast('Failed to create account', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddTx = async () => {
    if (!account) return;
    setIsSubmitting(true);
    try {
      await projectFinancialService.recordProjectTransaction(account.id, {
        projectId: project.id,
        type: newTxData.type || 'expense',
        amount: newTxData.amount || 0,
        categoryId: newTxData.categoryId,
        description: newTxData.description || '',
        date: newTxData.date || new Date().toISOString().split('T')[0],
      }, user?.uid ?? '');
      await loadData();
      setShowAddTx(false);
      setNewTxData({ type: 'expense', amount: 0, description: '', date: new Date().toISOString().split('T')[0] });
      showToast('Entry added', 'success');
    } catch {
      showToast('Failed to add entry', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveBudget = async () => {
    if (!onUpdateProject) return;
    setIsSavingBudget(true);
    try {
      await onUpdateProject(project.id, { budget: budgetDraft });
      setShowBudgetDrawer(false);
      await loadData();
      showToast('Budget updated', 'success');
    } catch {
      showToast('Failed to update budget', 'error');
    } finally {
      setIsSavingBudget(false);
    }
  };

  const handleSaveCat = async () => {
    if (!account || !editingCatId) return;
    setIsSavingCat(true);
    try {
      await projectFinancialService.updateBudgetCategory(account.id, editingCatId, {
        name: catDraft.name, description: catDraft.description, allocatedAmount: catDraft.allocatedAmount,
      });
      setAccount(prev => prev ? {
        ...prev,
        budgetCategories: prev.budgetCategories.map(c =>
          c.id === editingCatId ? { ...c, ...catDraft } : c
        ),
      } : prev);
      setEditingCatId(null);
      showToast('Category updated', 'success');
    } catch {
      showToast('Category editing is only available in dev mode', 'error');
    } finally {
      setIsSavingCat(false);
    }
  };

  const handleSavePrj = async () => {
    if (!editingPrjId) return;
    setIsSavingPrj(true);
    try {
      const amount = Math.abs(parseFloat(prjDraft.amount) || 0);
      await FinanceService.updateProjectTransaction(editingPrjId, {
        description: prjDraft.description, purpose: prjDraft.purpose, amount,
      });
      setProjectTrxList(prev => prev.map(t =>
        t.id === editingPrjId ? { ...t, description: prjDraft.description, purpose: prjDraft.purpose, amount } : t
      ));
      setEditingPrjId(null);
      showToast('Entry updated', 'success');
    } catch {
      showToast('Failed to update entry', 'error');
    } finally {
      setIsSavingPrj(false);
    }
  };

  const handleMatchBank = async (bankTxId: string) => {
    if (!matchingPrjTxId) return;
    setIsSavingMatch(true);
    try {
      const entry = projectTrxList.find(t => t.id === matchingPrjTxId);
      // Set the link via direct write
      await updateDoc(doc(db, COLLECTIONS.TRANSACTIONS, bankTxId), { projectTransactionId: matchingPrjTxId });
      // Sync purpose from entry separately via service
      if (entry?.purpose) {
        try {
          await FinanceService.updateTransaction(bankTxId, { purpose: entry.purpose });
        } catch {
          // Purpose sync failed silently — match still succeeds
        }
      }
      setBankTxList(prev => prev.map(t =>
        t.id === bankTxId ? { ...t, projectTransactionId: matchingPrjTxId, ...(entry?.purpose ? { purpose: entry.purpose } : {}) } : t
      ));
      setMatchingPrjTxId(null);
      setMatchSearch('');
      showToast('Matched to bank statement', 'success');
    } catch {
      showToast('Failed to match', 'error');
    } finally {
      setIsSavingMatch(false);
    }
  };

  const handleUnmatchBank = async (bankTxId: string) => {
    try {
      const bankTx = bankTxList.find(t => t.id === bankTxId);
      const originalPurpose = bankTx?.originalPurpose ?? null;
      // Clear the link via direct write (bypasses reconciliation check)
      await updateDoc(doc(db, COLLECTIONS.TRANSACTIONS, bankTxId), { projectTransactionId: null });
      // Revert purpose separately via service (may be no-op if purpose unchanged)
      try {
        await FinanceService.updateTransaction(bankTxId, { purpose: originalPurpose });
      } catch {
        // Purpose revert failed silently — unlink still succeeds
      }
      setBankTxList(prev => prev.map(t =>
        t.id === bankTxId ? { ...t, projectTransactionId: null, purpose: originalPurpose } : t
      ));
      showToast('Unmatched', 'success');
    } catch {
      showToast('Failed to unmatch', 'error');
    }
  };

  const handleSaveBankPurpose = async () => {
    if (!editingBankPurposeId) return;
    setIsSavingPurpose(true);
    try {
      await FinanceService.updateTransaction(editingBankPurposeId, { purpose: purposeDraft });
      setBankTxList(prev => prev.map(t => t.id === editingBankPurposeId ? { ...t, purpose: purposeDraft } : t));
      setEditingBankPurposeId(null);
      showToast('Purpose updated', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Failed to update purpose', 'error');
    } finally {
      setIsSavingPurpose(false);
    }
  };

  const handleSetPurposeFromEntry = async (bankTx: Transaction) => {
    const entry = projectTrxList.find(t => t.id === bankTx.projectTransactionId);
    if (!entry?.purpose) return;
    try {
      await FinanceService.updateTransaction(bankTx.id, { purpose: entry.purpose });
      setBankTxList(prev => prev.map(t => t.id === bankTx.id ? { ...t, purpose: entry.purpose } : t));
      showToast('Purpose set from project entry', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Failed to set purpose', 'error');
    }
  };

  const handleRevertBankPurpose = async (bankTx: Transaction) => {
    const original = bankTx.originalPurpose || null;
    try {
      await FinanceService.updateTransaction(bankTx.id, { purpose: original });
      setBankTxList(prev => prev.map(t => t.id === bankTx.id ? { ...t, purpose: original } : t));
      showToast('Purpose reverted', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Failed to revert', 'error');
    }
  };

  // ── UI helpers ────────────────────────────────────────────────────────────────
  const SummaryStats = ({ items }: { items: Transaction[] }) => {
    const { income, expense, net } = calcStats(items);
    return (
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Income',  val: income,  c: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Expense', val: expense, c: 'text-red-600',     bg: 'bg-red-50' },
          { label: net >= 0 ? 'Surplus' : 'Deficit', val: Math.abs(net),
            c: net >= 0 ? 'text-jci-blue' : 'text-orange-600',
            bg: net >= 0 ? 'bg-blue-50' : 'bg-orange-50' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl ${s.bg} px-3 py-2.5`}>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">{s.label}</p>
            <p className={`text-sm font-bold tabular-nums ${s.c}`}>{fmt(s.val)}</p>
          </div>
        ))}
      </div>
    );
  };

  const TypeFilter = ({
    value, onChange,
  }: { value: 'all' | 'Income' | 'Expense'; onChange: (v: 'all' | 'Income' | 'Expense') => void }) => (
    <div className="flex items-center gap-1">
      {(['all', 'Income', 'Expense'] as const).map(f => (
        <button key={f} onClick={() => onChange(f)}
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
            value === f
              ? f === 'Income'  ? 'bg-emerald-500 text-white border-emerald-500'
              : f === 'Expense' ? 'bg-red-500 text-white border-red-500'
              : 'bg-jci-blue text-white border-jci-blue'
              : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
          }`}>
          {f === 'all' ? 'All' : f}
        </button>
      ))}
    </div>
  );

  const TxIcon = ({ type }: { type: string }) => (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
      type === 'Income' ? 'bg-emerald-50' : 'bg-red-50'
    }`}>
      {type === 'Income'
        ? <ArrowUpRight size={13} className="text-emerald-500" />
        : <ArrowDownRight size={13} className="text-red-500" />}
    </div>
  );

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="flex gap-2 mb-2">{[1,2,3,4].map(i => <div key={i} className="h-7 bg-slate-100 rounded-full w-24" />)}</div>
        <div className="grid grid-cols-3 gap-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl" />)}</div>
        <div className="h-32 bg-slate-100 rounded-xl" />
        <div className="h-48 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  // ── Create Account ────────────────────────────────────────────────────────────
  if (showCreateAccount) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Financial Account</h3>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white shadow-sm px-4 py-4 space-y-4">
          <p className="text-sm text-slate-500">No financial account yet. Set a budget to get started.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Forms.Input label="Project Budget (RM)" type="number" value={newAccountData.budget}
              onChange={e => setNewAccountData(p => ({ ...p, budget: parseFloat(e.target.value) || 0 }))} placeholder="0.00" />
            <Forms.Input label="Starting Balance (RM)" type="number" value={newAccountData.startingBalance}
              onChange={e => setNewAccountData(p => ({ ...p, startingBalance: parseFloat(e.target.value) || 0 }))} placeholder="0.00" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Budget Categories</p>
            <div className="space-y-2">
              {newAccountData.budgetCategories?.map((cat, idx) => (
                <div key={idx} className="flex items-center gap-3 px-3 py-2 border border-slate-100 rounded-lg bg-slate-50">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-sm text-slate-700 flex-1">{cat.name}</span>
                  <div className="w-28">
                    <Forms.Input type="number" value={cat.allocatedAmount}
                      onChange={e => {
                        const updated = [...(newAccountData.budgetCategories || [])];
                        updated[idx].allocatedAmount = parseFloat(e.target.value) || 0;
                        setNewAccountData(p => ({ ...p, budgetCategories: updated }));
                      }} placeholder="0.00" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={handleCreateAccount} disabled={isCreating}>
              {isCreating ? 'Creating…' : 'Create Account'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!account || !summary) {
    return <div className="py-12 text-center text-slate-400 text-sm">No financial account found.</div>;
  }

  // ── Main render ───────────────────────────────────────────────────────────────
  const TAB_PILLS: { key: MainTab; label: string }[] = [
    { key: 'overview',        label: 'Overview' },
    { key: 'budgeting',       label: 'Budgeting' },
    { key: 'project-entries', label: 'Project Entries' },
    { key: 'bank-statement',  label: 'Bank Statement' },
  ];

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-900">Financial Account</h3>
          <div className="flex items-center gap-2">
            {onUpdateProject && (
              <Button size="sm" variant="outline"
                onClick={() => { setBudgetDraft(project.budget || summary.totalAllocated); setShowBudgetDrawer(true); }}>
                <Edit3 size={12} className="mr-1" />Budget
              </Button>
            )}
            <Button size="sm" onClick={() => setShowAddTx(true)}>
              <Plus size={13} className="mr-1" />Add
            </Button>
          </div>
        </div>

        {/* Tab pills */}
        <div className="flex gap-1.5 flex-wrap">
          {TAB_PILLS.map(({ key, label }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                activeTab === key
                  ? 'bg-jci-blue text-white border-jci-blue'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ───────────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Alerts */}
            {summary.alerts.length > 0 && (
              <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 space-y-1.5">
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Alerts</p>
                {summary.alerts.map(alert => (
                  <div key={alert.id} className="flex items-center gap-2 text-xs text-slate-700">
                    {getAlertIcon(alert.severity)}{alert.message}
                  </div>
                ))}
              </div>
            )}

            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {[
                { label: 'Budget',    value: fmt(summary.totalAllocated), icon: <Target size={14} className="text-jci-blue" /> },
                { label: 'Spent',     value: fmt(summary.totalSpent),     icon: <TrendingDown size={14} className="text-red-500" /> },
                { label: 'Remaining', value: fmt(summary.remainingFunds), icon: <DollarSign size={14} className="text-emerald-500" /> },
                { label: 'Used',      value: `${summary.budgetUtilization.toFixed(1)}%`, icon: <BarChart3 size={14} className="text-purple-500" /> },
              ].map(k => (
                <div key={k.label} className="rounded-xl border border-slate-100 bg-white shadow-sm px-3.5 py-3">
                  <div className="flex items-center gap-1.5 mb-1">{k.icon}
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{k.label}</span>
                  </div>
                  <p className="text-base font-bold text-slate-800 tabular-nums leading-tight">{k.value}</p>
                </div>
              ))}
            </div>

            {/* Budget utilization */}
            <div className="rounded-xl border border-slate-100 bg-white shadow-sm px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-900">Budget Utilization</p>
                <span className={`text-xs font-black tabular-nums ${utilizationColor(summary.budgetUtilization)}`}>
                  {summary.budgetUtilization.toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-2 rounded-full transition-all ${progressBg(summary.budgetUtilization)}`}
                  style={{ width: `${Math.min(summary.budgetUtilization, 100)}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                <span>RM 0</span><span>{fmt(summary.totalAllocated)}</span>
              </div>
            </div>

            {/* Category breakdown */}
            <div className="rounded-xl border border-slate-100 bg-white shadow-sm px-4 py-3 space-y-3">
              <p className="text-xs font-semibold text-slate-900">Category Breakdown</p>
              {summary.categoryBreakdown.length === 0 ? (
                <p className="text-xs text-slate-400 py-2 text-center">No budget categories set up yet.</p>
              ) : (
                <div className="space-y-3">
                  {summary.categoryBreakdown.map(cat => (
                    <div key={cat.categoryId}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-slate-700">{cat.categoryName}</span>
                        <span className={`text-[10px] font-black tabular-nums ${utilizationColor(cat.utilizationPercentage)}`}>
                          {cat.utilizationPercentage.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1.5">
                        <div className={`h-1.5 rounded-full ${progressBg(cat.utilizationPercentage)}`}
                          style={{ width: `${Math.min(cat.utilizationPercentage, 100)}%` }} />
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-500">
                        <span>Alloc: <span className="font-semibold text-slate-700">{fmt(cat.allocated)}</span></span>
                        <span>Spent: <span className="font-semibold text-slate-700">{fmt(cat.spent)}</span></span>
                        <span>Left: <span className="font-semibold text-slate-700">{fmt(cat.remaining)}</span></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent bank transactions */}
            {bankTxList.length > 0 && (
              <div className="rounded-xl border border-slate-100 bg-white shadow-sm px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-900">Recent Bank Transactions</p>
                  <button onClick={() => setActiveTab('bank-statement')}
                    className="text-[10px] font-bold text-jci-blue hover:underline">
                    View all →
                  </button>
                </div>
                <div className="space-y-1">
                  {bankTxList.slice(0, 5).map(tx => (
                    <div key={tx.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                      <TxIcon type={tx.type} />
                      <div className="flex-1 min-w-0 flex items-baseline gap-2">
                        <p className="text-xs text-slate-400 shrink-0">{fmtDate(tx.date)}</p>
                        <p className="text-xs font-semibold text-slate-700 truncate">{tx.description}</p>
                      </div>
                      <span className={`text-xs font-bold tabular-nums shrink-0 ${
                        tx.type === 'Income' ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {tx.type === 'Income' ? '+' : '-'}{fmt(Math.abs(tx.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── BUDGETING ──────────────────────────────────────────────────────── */}
        {activeTab === 'budgeting' && (() => {
          const totalAllocated = account.budgetCategories.reduce((s, c) => s + (c.allocatedAmount || 0), 0);
          const budgetAmt = project.budget || summary.totalAllocated;
          const unallocated = budgetAmt - totalAllocated;
          return (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Budget',    val: budgetAmt,        c: 'text-jci-blue',    bg: 'bg-blue-50' },
                  { label: 'Allocated', val: totalAllocated,   c: 'text-red-600',     bg: 'bg-red-50' },
                  { label: unallocated >= 0 ? 'Unallocated' : 'Over Budget',
                    val: Math.abs(unallocated),
                    c: unallocated >= 0 ? 'text-emerald-600' : 'text-orange-600',
                    bg: unallocated >= 0 ? 'bg-emerald-50' : 'bg-orange-50' },
                ].map(s => (
                  <div key={s.label} className={`rounded-xl ${s.bg} px-3 py-2.5`}>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">{s.label}</p>
                    <p className={`text-sm font-bold tabular-nums ${s.c}`}>{fmt(s.val)}</p>
                  </div>
                ))}
              </div>

              {/* Categories */}
              <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-900">Budget Categories</p>
                  {onUpdateProject && (
                    <Button size="sm" variant="outline"
                      onClick={() => { setBudgetDraft(budgetAmt); setShowBudgetDrawer(true); }}>
                      <Edit3 size={12} className="mr-1" />Total Budget
                    </Button>
                  )}
                </div>
                {account.budgetCategories.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">No budget categories.</p>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {account.budgetCategories.map((cat: BudgetCategory) => {
                      const isEditing = editingCatId === cat.id;
                      const spent = cat.spentAmount || 0;
                      const pct = cat.allocatedAmount > 0 ? (spent / cat.allocatedAmount) * 100 : 0;
                      return (
                        <div key={cat.id} className="px-4 py-3">
                          {isEditing ? (
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <Forms.Input label="Name" value={catDraft.name}
                                  onChange={e => setCatDraft(p => ({ ...p, name: e.target.value }))} />
                                <Forms.Input label="Amount (RM)" type="number" value={catDraft.allocatedAmount}
                                  onChange={e => setCatDraft(p => ({ ...p, allocatedAmount: parseFloat(e.target.value) || 0 }))} />
                              </div>
                              <Forms.Input label="Description" value={catDraft.description}
                                onChange={e => setCatDraft(p => ({ ...p, description: e.target.value }))}
                                placeholder="What this category covers" />
                              <div className="flex gap-2 justify-end">
                                <Button size="sm" variant="ghost" onClick={() => setEditingCatId(null)}>Cancel</Button>
                                <Button size="sm" onClick={handleSaveCat} disabled={isSavingCat}>
                                  {isSavingCat ? 'Saving…' : 'Save'}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-3">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-1"
                                style={{ backgroundColor: cat.color || '#6B7280' }} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-semibold text-slate-700">{cat.name}</p>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-xs font-bold tabular-nums ${utilizationColor(pct)}`}>
                                      {fmt(cat.allocatedAmount)}
                                    </span>
                                    <button
                                      onClick={() => { setEditingCatId(cat.id); setCatDraft({ name: cat.name, description: cat.description || '', allocatedAmount: cat.allocatedAmount }); }}
                                      className="text-slate-300 hover:text-slate-500 transition-colors">
                                      <Edit3 size={12} />
                                    </button>
                                  </div>
                                </div>
                                {cat.description && <p className="text-[10px] text-slate-400 mt-0.5">{cat.description}</p>}
                                <div className="mt-1.5 w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                  <div className={`h-1 rounded-full ${progressBg(pct)}`}
                                    style={{ width: `${Math.min(pct, 100)}%` }} />
                                </div>
                                <div className="flex justify-between mt-0.5 text-[10px] text-slate-400">
                                  <span>Spent: {fmt(spent)}</span>
                                  <span>Left: {fmt(cat.allocatedAmount - spent)}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── PROJECT ENTRIES ────────────────────────────────────────────────── */}
        {activeTab === 'project-entries' && (
          <div className="space-y-4">
            <SummaryStats items={projectTrxList} />

            {/* Controls */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={prjSearch} onChange={e => setPrjSearch(e.target.value)}
                  placeholder="Search entries…"
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-jci-blue/30 focus:border-jci-blue placeholder-slate-400" />
              </div>
              <TypeFilter value={prjTypeFilter} onChange={setPrjTypeFilter} />
            </div>

            {groupedByPurpose.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No project entries found.</p>
            ) : (
              <div className="space-y-3">
                {groupedByPurpose.map(([purpose, txs]) => {
                  const { income, expense, net } = calcStats(txs);
                  return (
                    <div key={purpose || '__none'} className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                      {/* Group header */}
                      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-3">
                        <p className="text-xs font-bold text-slate-700 truncate flex-1">
                          {purpose || <span className="text-slate-400 italic font-medium">No Purpose</span>}
                        </p>
                        <div className="flex items-center gap-2.5 text-[10px] font-bold tabular-nums shrink-0">
                          {income > 0 && <span className="text-emerald-600">+{fmt(income)}</span>}
                          {expense > 0 && <span className="text-red-600">−{fmt(expense)}</span>}
                          <span className={`border-l border-slate-200 pl-2.5 ${net >= 0 ? 'text-jci-blue' : 'text-orange-600'}`}>
                            {net >= 0 ? '+' : '−'}{fmt(Math.abs(net))}
                          </span>
                        </div>
                      </div>

                      {/* Transactions in group */}
                      <div className="divide-y divide-slate-50">
                        {txs.map(tx => {
                          const isEditing = editingPrjId === tx.id;
                          const matchedBank = bankTxList.find(b => b.projectTransactionId === tx.id);
                          return (
                            <div key={tx.id} className="px-4 py-3">
                              {isEditing ? (
                                <div className="space-y-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    <Forms.Input label="Description" value={prjDraft.description}
                                      onChange={e => setPrjDraft(p => ({ ...p, description: e.target.value }))} />
                                    <Forms.Input label="Amount (RM)" type="number" value={prjDraft.amount}
                                      onChange={e => setPrjDraft(p => ({ ...p, amount: e.target.value }))} />
                                  </div>
                                  <Forms.Input label="Purpose" value={prjDraft.purpose}
                                    onChange={e => setPrjDraft(p => ({ ...p, purpose: e.target.value }))}
                                    placeholder="Purpose of this transaction" />
                                  <div className="flex gap-2 justify-end">
                                    <Button size="sm" variant="ghost" onClick={() => setEditingPrjId(null)}>Cancel</Button>
                                    <Button size="sm" onClick={handleSavePrj} disabled={isSavingPrj}>
                                      {isSavingPrj ? 'Saving…' : 'Save'}
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start gap-3">
                                  <TxIcon type={tx.type} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0 flex items-baseline gap-2">
                                        <p className="text-xs text-slate-400 shrink-0">{fmtDate(tx.date)}</p>
                                        <p className="text-xs font-semibold text-slate-700 truncate">{tx.description || '—'}</p>
                                      </div>
                                      <span className={`text-xs font-bold tabular-nums shrink-0 ${
                                        tx.type === 'Income' ? 'text-emerald-600' : 'text-red-600'
                                      }`}>
                                        {tx.type === 'Income' ? '+' : '−'}{fmt(Math.abs(tx.amount))}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1.5">
                                      {matchedBank ? (
                                        <>
                                          <Link2 size={11} className="text-jci-blue shrink-0" />
                                          <span className="text-[10px] text-jci-blue flex-1 truncate">{matchedBank.description}</span>
                                          <button onClick={() => handleUnmatchBank(matchedBank.id)}
                                            className="text-slate-300 hover:text-red-500 transition-colors shrink-0" title="Remove match">
                                            <Link2Off size={11} />
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          onClick={() => { setMatchingPrjTxId(tx.id); setMatchSearch(''); }}
                                          className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-jci-blue transition-colors">
                                          <Link2 size={11} /> Match bank statement
                                        </button>
                                      )}
                                      <button
                                        onClick={() => { setEditingPrjId(tx.id); setPrjDraft({ description: tx.description || '', purpose: tx.purpose || '', amount: String(Math.abs(tx.amount || 0)) }); }}
                                        className="text-slate-300 hover:text-slate-500 transition-colors ml-auto">
                                        <Edit3 size={12} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── BANK STATEMENT ─────────────────────────────────────────────────── */}
        {activeTab === 'bank-statement' && (
          <div className="space-y-4">
            <SummaryStats items={bankTxList} />

            {/* Controls */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={bankSearch} onChange={e => setBankSearch(e.target.value)}
                  placeholder="Search bank statements…"
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-jci-blue/30 focus:border-jci-blue placeholder-slate-400" />
              </div>
              <TypeFilter value={bankTypeFilter} onChange={setBankTypeFilter} />
            </div>

            {groupedBankByPurpose.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No bank statements found.</p>
            ) : (
              <div className="space-y-3">
                {groupedBankByPurpose.map(([purpose, txs]) => {
                  const { income, expense, net } = calcStats(txs);
                  return (
                    <div key={purpose || '__none'} className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                      {/* Group header */}
                      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-3">
                        <p className="text-xs font-bold text-slate-700 truncate flex-1">
                          {purpose || <span className="text-slate-400 italic font-medium">No Purpose</span>}
                        </p>
                        <div className="flex items-center gap-2.5 text-[10px] font-bold tabular-nums shrink-0">
                          {income > 0 && <span className="text-emerald-600">+{fmt(income)}</span>}
                          {expense > 0 && <span className="text-red-600">−{fmt(expense)}</span>}
                          <span className={`border-l border-slate-200 pl-2.5 ${net >= 0 ? 'text-jci-blue' : 'text-orange-600'}`}>
                            {net >= 0 ? '+' : '−'}{fmt(Math.abs(net))}
                          </span>
                        </div>
                      </div>

                      {/* Transactions in group */}
                      <div className="divide-y divide-slate-50">
                        {txs.map(tx => {
                          const matchedEntry = tx.projectTransactionId
                            ? projectTrxList.find(p => p.id === tx.projectTransactionId)
                            : null;
                          const isEditingPurpose = editingBankPurposeId === tx.id;
                          return (
                            <div key={tx.id} className="px-4 py-3">
                              <div className="flex items-start gap-3">
                                <TxIcon type={tx.type} />
                                <div className="flex-1 min-w-0">
                                  {/* Row 1: date + description | amount */}
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex items-baseline gap-2">
                                      <p className="text-xs text-slate-400 shrink-0">{fmtDate(tx.date)}</p>
                                      <p className="text-xs font-semibold text-slate-700 truncate">{tx.description}</p>
                                    </div>
                                    <span className={`text-xs font-bold tabular-nums shrink-0 ${
                                      tx.type === 'Income' ? 'text-emerald-600' : 'text-red-600'
                                    }`}>
                                      {tx.type === 'Income' ? '+' : '−'}{fmt(Math.abs(tx.amount))}
                                    </span>
                                  </div>

                                  {/* Row 2: purpose edit form OR match status + edit button */}
                                  {isEditingPurpose ? (
                                    <div className="flex items-center gap-2 mt-1.5">
                                      <input value={purposeDraft} onChange={e => setPurposeDraft(e.target.value)}
                                        placeholder="Enter purpose…"
                                        className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded bg-slate-50 focus:outline-none focus:ring-1 focus:ring-jci-blue/30" />
                                      <button onClick={handleSaveBankPurpose} disabled={isSavingPurpose}
                                        className="text-emerald-500 hover:text-emerald-600 transition-colors">
                                        <Check size={14} />
                                      </button>
                                      <button onClick={() => setEditingBankPurposeId(null)}
                                        className="text-slate-300 hover:text-slate-500 transition-colors">
                                        <X size={14} />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 mt-1.5">
                                      {matchedEntry ? (
                                        <>
                                          <Link2 size={11} className="text-jci-blue shrink-0" />
                                          <span className="text-[10px] text-jci-blue flex-1 truncate">{matchedEntry.description}</span>
                                          {matchedEntry.purpose && matchedEntry.purpose !== tx.purpose && (
                                            <button onClick={() => handleSetPurposeFromEntry(tx)}
                                              className="text-[10px] font-semibold text-jci-blue hover:underline shrink-0">
                                              Set purpose
                                            </button>
                                          )}
                                          {tx.purpose && tx.purpose !== tx.originalPurpose && (
                                            <button onClick={() => handleRevertBankPurpose(tx)}
                                              className="text-[10px] font-semibold text-orange-500 hover:underline shrink-0">
                                              Revert
                                            </button>
                                          )}
                                          <button onClick={() => handleUnmatchBank(tx.id)}
                                            className="text-slate-300 hover:text-red-500 transition-colors shrink-0" title="Remove match">
                                            <Link2Off size={11} />
                                          </button>
                                        </>
                                      ) : (
                                        <span className="text-[10px] text-slate-300 flex-1">Unmatched</span>
                                      )}
                                      <button
                                        onClick={() => { setEditingBankPurposeId(tx.id); setPurposeDraft(tx.purpose || ''); }}
                                        className="text-slate-300 hover:text-slate-500 transition-colors ml-auto" title="Edit purpose">
                                        <Edit3 size={12} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Budget Drawer ─────────────────────────────────────────────────────── */}
      <Drawer isOpen={showBudgetDrawer} onClose={() => setShowBudgetDrawer(false)}
        title="Edit Budget" position="right" size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowBudgetDrawer(false)}>Cancel</Button>
            <Button onClick={handleSaveBudget} disabled={isSavingBudget}>
              {isSavingBudget ? 'Saving…' : 'Save Budget'}
            </Button>
          </div>
        }>
        <div className="space-y-4">
          <Forms.Input label="Project Budget (RM)" type="number" value={budgetDraft}
            onChange={e => setBudgetDraft(parseFloat(e.target.value) || 0)} placeholder="0.00" />
          <p className="text-xs text-slate-400">
            Current spent: <span className="font-semibold text-slate-600">{fmt(summary.totalSpent)}</span>
          </p>
        </div>
      </Drawer>

      {/* ── Add Entry Modal ───────────────────────────────────────────────────── */}
      <Modal isOpen={showAddTx} onClose={() => setShowAddTx(false)} title="Add Project Entry" size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowAddTx(false)}>Cancel</Button>
            <Button onClick={handleAddTx} disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Add Entry'}
            </Button>
          </div>
        }>
        <div className="space-y-3">
          <Forms.Select label="Type" value={newTxData.type}
            onChange={e => setNewTxData(p => ({ ...p, type: e.target.value as 'income' | 'expense' }))}
            options={[{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }]} />
          <Forms.Input label="Amount (RM)" type="number" value={newTxData.amount}
            onChange={e => setNewTxData(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} placeholder="0.00" />
          <Forms.Input label="Description" value={newTxData.description}
            onChange={e => setNewTxData(p => ({ ...p, description: e.target.value }))} placeholder="What is this for?" />
          <Forms.Select label="Category" value={newTxData.categoryId || ''}
            onChange={e => setNewTxData(p => ({ ...p, categoryId: e.target.value || undefined }))}
            options={[
              { value: '', label: 'No Category' },
              ...account.budgetCategories.map(c => ({ value: c.id, label: c.name })),
            ]} />
          <Forms.Input label="Date" type="date" value={newTxData.date}
            onChange={e => setNewTxData(p => ({ ...p, date: e.target.value }))} />
        </div>
      </Modal>

      {/* ── Match Bank Statement Modal ────────────────────────────────────────── */}
      {matchingPrjTxId && (() => {
        const entry = projectTrxList.find(t => t.id === matchingPrjTxId);
        const candidates = bankTxList.filter(t =>
          (!t.projectTransactionId || t.projectTransactionId === matchingPrjTxId) &&
          (!matchSearch || (t.description || '').toLowerCase().includes(matchSearch.toLowerCase()))
        );
        return (
          <Modal isOpen onClose={() => { setMatchingPrjTxId(null); setMatchSearch(''); }}
            title="Match Bank Statement" size="md">
            {entry && (
              <div className="mb-4 p-3 rounded-lg bg-slate-50 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Project Entry</p>
                <p className="text-xs font-semibold text-slate-700">{entry.description}</p>
                <p className="text-xs text-slate-500">{fmt(Math.abs(entry.amount))} · {fmtDate(entry.date)}</p>
              </div>
            )}
            <div className="relative mb-3">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={matchSearch} onChange={e => setMatchSearch(e.target.value)}
                placeholder="Search bank transactions…"
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-jci-blue/30 focus:border-jci-blue" />
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-50 rounded-xl border border-slate-100">
              {candidates.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No unmatched bank transactions found.</p>
              ) : candidates.map(t => (
                <button key={t.id} onClick={() => handleMatchBank(t.id)} disabled={isSavingMatch}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left">
                  <TxIcon type={t.type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">{t.description}</p>
                    <p className="text-[10px] text-slate-400">{fmtDate(t.date)}</p>
                  </div>
                  <span className={`text-xs font-bold tabular-nums shrink-0 ${
                    t.type === 'Income' ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {t.type === 'Income' ? '+' : '-'}{fmt(Math.abs(t.amount))}
                  </span>
                  {t.projectTransactionId === matchingPrjTxId && (
                    <Badge variant="info">Linked</Badge>
                  )}
                </button>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <Button variant="ghost" onClick={() => { setMatchingPrjTxId(null); setMatchSearch(''); }}>Cancel</Button>
            </div>
          </Modal>
        );
      })()}
    </>
  );
};
