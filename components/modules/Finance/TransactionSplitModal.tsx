import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { X, Plus, Trash2, Lightbulb, Edit, Check } from 'lucide-react';
import { Transaction, TransactionSplit } from '../../../types';
import { db } from '../../../config/firebase';
import { writeBatch, doc } from 'firebase/firestore';
import { FinanceService, invalidateFinanceCache } from '../../../services/financeService';
import { projectFinancialService } from '../../../services/projectFinancialService';
import { MembershipConfigService, DEFAULT_MEMBERSHIP_RULES } from '../../../services/membershipConfigService';
import { buildCategoryFields, buildCategoryCleanupUpdates } from '../../../utils/transactionCategoryUtils';
import { MembershipType, MembershipRuleConfig } from '../../../types';
import * as Forms from '../../ui/Form';
import { Combobox } from '../../ui/Combobox';
import { Modal, Button, useToast } from '../../ui/Common';
import { errorLoggingService } from '../../../services/errorLoggingService';

interface TransactionSplitModalProps {
  transaction: Transaction;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  adminProjectIds?: string[];
  memberOptions?: { id: string; name: string; membershipType?: string }[];
  projectOptions?: { id: string; name: string; year?: number }[];
  administrativePurposes?: string[];
  projectYears?: number[];
  projectPurposes?: string[];
}

type CategoryType = 'Projects & Activities' | 'Membership' | 'Administrative' | '';

interface SplitItem {
  id?: string; // Existing split ID if updating
  category: CategoryType;
  year?: number;
  projectId: string;
  memberId: string;
  purpose: string;
  paymentRequestId: string;
  amount: number;
  description: string;
}

export function TransactionSplitModal({
  transaction,
  isOpen,
  onClose,
  onSuccess,
  adminProjectIds = [],
  memberOptions = [],
  projectOptions = [],
  administrativePurposes = [],
  projectYears = [],
  projectPurposes = [],
}: TransactionSplitModalProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const currentYear = new Date().getFullYear();
  const [splits, setSplits] = useState<SplitItem[]>([
    { category: 'Projects & Activities', year: currentYear, projectId: '', memberId: '', purpose: '', paymentRequestId: '', amount: 0, description: '', id: undefined },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedSplits, setLoadedSplits] = useState<TransactionSplit[]>([]);
  const [purposesByProject, setPurposesByProject] = useState<Record<string, string[]>>({});
  const [adminAccounts, setAdminAccounts] = useState<string[]>([]);
  const [adminPurposes, setAdminPurposes] = useState<string[]>([]);
  const [splitYearFilters, setSplitYearFilters] = useState<Record<number, string>>({});
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<SplitItem | null>(null);
  const [membershipRules, setMembershipRules] = useState<Record<MembershipType, MembershipRuleConfig> | null>(null);

  useEffect(() => {
    const fetchRules = async () => {
      const rules = await MembershipConfigService.getRules();
      setMembershipRules(rules);
    };
    fetchRules();
  }, []);

  useEffect(() => {
    if (editForm && editForm.category === 'Membership') {
      const catFields = buildCategoryFields({
        category: 'Membership',
        amount: editForm.amount || 0,
        year: editForm.year,
        memberId: editForm.memberId,
        rules: membershipRules || DEFAULT_MEMBERSHIP_RULES,
      });
      if (catFields.purpose && editForm.purpose !== catFields.purpose) {
        setEditForm(prev => prev ? { ...prev, purpose: catFields.purpose!, projectId: catFields.projectId! } : null);
      }
    }
  }, [editForm?.category, editForm?.amount, editForm?.year, membershipRules]);

  const getSplitYearFilter = (index: number) => {
    return splitYearFilters[index] ?? '';
  };

  const setSplitYearFilter = (index: number, year: string) => {
    setSplitYearFilters(prev => ({ ...prev, [index]: year }));
  };

  const filteredProjectOptionsBySplit = useMemo(() => {
    const result: Record<number, { id: string; name: string; year?: number }[]> = {};
    splits.forEach((split, index) => {
      if (split.category === 'Projects & Activities') {
        const yearFilter = getSplitYearFilter(index);
        if (yearFilter && yearFilter !== 'All') {
          const yearNum = parseInt(yearFilter, 10);
          result[index] = projectOptions.filter(p => p.year === yearNum);
        } else {
          result[index] = projectOptions;
        }
      }
    });
    return result;
  }, [splits, projectOptions, splitYearFilters]);

  const groupedProjectOptionsBySplit = useMemo(() => {
    const result: Record<number, { label: string; options: string[] }[]> = {};
    splits.forEach((split, index) => {
      if (split.category === 'Projects & Activities') {
        const projects = filteredProjectOptionsBySplit[index] || [];
        const grouped: Record<number, string[]> = {};

        projects.forEach(p => {
          const year = p.year || 0;
          if (!grouped[year]) grouped[year] = [];
          grouped[year].push(p.name);
        });

        const sortedYears = Object.keys(grouped)
          .map(y => parseInt(y, 10))
          .sort((a, b) => b - a)
          .filter(y => y > 0);

        result[index] = sortedYears.map(year => ({
          label: String(year),
          options: grouped[year].sort()
        }));
      }
    });
    return result;
  }, [splits, filteredProjectOptionsBySplit]);

  const existingSplits = useMemo(() => {
    if (loadedSplits && loadedSplits.length > 0) {
      return loadedSplits;
    }
    if (transaction.splits && transaction.splits.length > 0) {
      return transaction.splits;
    }
    return [];
  }, [loadedSplits, transaction.splits]);

  useEffect(() => {
    const loadSplits = async () => {
      if (transaction.isSplit) {
        try {
          const splits = await FinanceService.getTransactionSplits(transaction.id);
          setLoadedSplits(splits);
          if (splits.length > 0) {
            setSplits(splits.map(split => ({
              id: split.id,
              category: (split.category as CategoryType) || 'Projects & Activities',
              year: split.year,
              projectId: split.projectId || '',
              memberId: split.memberId || '',
              purpose: split.purpose || '',
              paymentRequestId: split.paymentRequestId || '',
              amount: split.amount,
              description: split.description
            })));
            return;
          }
        } catch (e) {
          console.error('Failed to load splits', e);
          showToast('Failed to load split records', 'error');
        }
      }
      setLoadedSplits([]);
      setSplits([{ category: 'Projects & Activities', year: currentYear, projectId: '', memberId: '', purpose: '', paymentRequestId: '', amount: 0, description: '', id: undefined }]);
    };
    loadSplits();
  }, [transaction.id, transaction.isSplit]);

  // Load purposes when projectId changes
  useEffect(() => {
    const loadPurposesForProjects = async () => {
      const projectIds = splits.map(s => s.projectId).filter(Boolean);
      const newPurposes: Record<string, string[]> = {};

      for (const projectId of projectIds) {
        if (!purposesByProject[projectId]) {
          try {
            const purposes = new Set<string>();

            // Get projectTrx transactions for this project (using purpose field)
            try {
              const ptTrx = await projectFinancialService.getAllProjectTrackerTransactions();
              ptTrx.forEach(t => {
                if (t.projectId === projectId && t.purpose) purposes.add(t.purpose);
              });
            } catch (e) { console.error('Failed to load PT purposes', e); }

            // Get all transactions for this project
            const allTx = await FinanceService.getAllTransactions();
            allTx.forEach(t => {
              if (t.projectId === projectId && t.purpose) purposes.add(t.purpose);
            });

            // Get split transactions for this project
            const splitTx = allTx.filter(t => t.isSplit && t.splitIds);
            for (const t of splitTx) {
              try {
                const splits = await FinanceService.getTransactionSplits(t.id);
                splits.forEach(s => {
                  if (s.projectId === projectId && s.purpose) purposes.add(s.purpose);
                });
              } catch (e) { }
            }

            newPurposes[projectId] = Array.from(purposes).sort();
          } catch (e) {
            console.error('Failed to load purposes for project', projectId, e);
            newPurposes[projectId] = [];
          }
        } else {
          newPurposes[projectId] = purposesByProject[projectId];
        }
      }

      if (Object.keys(newPurposes).length > 0) {
        setPurposesByProject(prev => ({ ...prev, ...newPurposes }));
      }
    };

    loadPurposesForProjects();
  }, [splits.map(s => s.projectId).join(',')]);

  // Load admin accounts and purposes from transactions
  useEffect(() => {
    const loadAdminData = async () => {
      if (!isOpen) return;

      try {
        const accounts = new Set<string>(adminProjectIds);
        const purposes = new Set<string>(administrativePurposes);

        const allTx = await FinanceService.getAllTransactions();
        allTx.forEach(t => {
          if (t.category === 'Administrative') {
            if (t.projectId) accounts.add(t.projectId);
            if (t.purpose) purposes.add(t.purpose);
          }
        });

        setAdminAccounts(Array.from(accounts).sort());
        setAdminPurposes(Array.from(purposes).sort());
      } catch (e) {
        console.error('Failed to load admin data', e);
      }
    };

    loadAdminData();
  }, [isOpen]);

  const categoryOptions = [
    { value: 'Projects & Activities', label: 'Projects & Activities' },
    { value: 'Membership', label: 'Membership' },
    { value: 'Administrative', label: 'Administrative' },
    { value: '', label: 'Uncategorized (Remainder)' },
  ];

  const totalSplitAmount = splits.reduce((sum, split) => sum + split.amount, 0);
  const remainingAmount = transaction.amount - totalSplitAmount;
  const uncategorizedSplits = splits.filter(s => s.category === '');
  const hasMultipleUncategorized = uncategorizedSplits.length > 1;
  const isValid = Math.abs(remainingAmount) < 0.01
    && splits.every(s => s.amount > 0 && s.description.trim())
    && !hasMultipleUncategorized;

  const handleAddSplit = () => {
    const newSplit: SplitItem = {
      category: 'Projects & Activities' as CategoryType,
      year: currentYear,
      projectId: '',
      memberId: '',
      purpose: '',
      paymentRequestId: '',
      amount: 0,
      description: '',
      id: undefined
    };
    setSplits([...splits, newSplit]);
  };

  const handleAddRemainderSplit = () => {
    if (remainingAmount <= 0 || uncategorizedSplits.length > 0) return;
    const newSplit: SplitItem = {
      category: '' as CategoryType,
      year: currentYear,
      projectId: '',
      memberId: '',
      purpose: '',
      paymentRequestId: '',
      amount: Math.round(remainingAmount * 100) / 100,
      description: 'Uncategorized remainder',
      id: undefined
    };
    setSplits([...splits, newSplit]);
  };

  const handleRemoveSplit = (index: number) => {
    if (splits.length > 1) {
      setSplits(splits.filter((_, i) => i !== index));
    }
  };

  const handleQuickSplit = () => {
    const year = new Date().getFullYear();
    const membershipFields = buildCategoryFields({
      category: 'Membership',
      amount: 350,
      year,
      rules: membershipRules || DEFAULT_MEMBERSHIP_RULES,
    });
    const quickSplits: SplitItem[] = [
      {
        category: 'Membership',
        year: year,
        projectId: membershipFields.projectId || '',
        memberId: '',
        purpose: membershipFields.purpose || '',
        paymentRequestId: '',
        amount: 350,
        description: `${year} Membership Fee`,
        id: undefined
      },
      {
        category: 'Administrative',
        year: year,
        projectId: 'JCI KL Pink Shirt',
        memberId: '',
        purpose: 'Uniform',
        paymentRequestId: '',
        amount: 75,
        description: 'JCI KL Pink Shirt',
        id: undefined
      },
      {
        category: 'Administrative',
        year: year,
        projectId: 'JCI KL Jacket',
        memberId: '',
        purpose: 'Uniform',
        paymentRequestId: '',
        amount: 75,
        description: 'JCI KL Jacket',
        id: undefined
      }
    ];
    setSplits(quickSplits);
    setEditForm({ ...quickSplits[0] });
    setEditingIndex(0);
  };

  const startInlineEdit = (index: number) => {
    setEditingIndex(index);
    setEditForm({ ...splits[index] });
  };

  const handleInlineSave = () => {
    if (editForm) {
      const newSplits = [...splits];
      newSplits[editingIndex!] = editForm;
      setSplits(newSplits);
      setEditingIndex(null);
      setEditForm(null);
    }
  };

  const handleInlineCancel = () => {
    setEditingIndex(null);
    setEditForm(null);
  };

  const handleSplitChange = (index: number, field: keyof SplitItem, value: any) => {
    const newSplits = [...splits];
    const current = newSplits[index];
    newSplits[index] = { ...current, [field]: value };

    if (field === 'category' && value !== '') {
      const cleanup = buildCategoryCleanupUpdates({
        finalCategory: value as 'Projects & Activities' | 'Membership' | 'Administrative',
        previousCategory: current.category !== '' ? current.category : undefined,
        explicitKeys: new Set(),
      });
      if (cleanup.memberId === null) newSplits[index].memberId = '';
      if (cleanup.projectId === null) newSplits[index].projectId = '';
      if (cleanup.purpose === null) newSplits[index].purpose = '';
    }

    // Auto-derive projectId and purpose for Membership when relevant fields change
    if (newSplits[index].category === 'Membership' &&
        (field === 'category' || field === 'memberId' || field === 'year' || field === 'amount')) {
      const catFields = buildCategoryFields({
        category: 'Membership',
        amount: newSplits[index].amount,
        year: newSplits[index].year,
        memberId: newSplits[index].memberId,
        rules: membershipRules || DEFAULT_MEMBERSHIP_RULES,
      });
      if (catFields.projectId) newSplits[index].projectId = catFields.projectId;
      if (catFields.purpose) newSplits[index].purpose = catFields.purpose;
    }

    setSplits(newSplits);
  };

  const handleSubmit = async () => {
    if (!isValid) {
      setError('Split amounts must sum to transaction amount and all fields must be filled');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await FinanceService.createTransactionSplit(
        transaction.id,
        splits,
        user?.uid ?? ''
      );
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create transaction splits');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSplit = async () => {
    if (!transaction.isSplit || !existingSplits.length) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const splitIds = existingSplits.map((split) => split.id);
      try {
        const batch = writeBatch(db);
        splitIds.forEach(id => batch.delete(doc(db, 'transactionSplits', id)));
        batch.update(doc(db, 'transactions', transaction.id), { isSplit: false, splitIds: [] });
        await batch.commit();
      } catch (err) {
        showToast('Failed to cancel splits — please retry', 'error');
        await errorLoggingService.logError(err instanceof Error ? err : new Error(String(err)), { component: 'TransactionSplitModal', action: 'handleCancelSplit', additionalData: { splitIds } });
        throw err;
      }
      invalidateFinanceCache();
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel transaction splits');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={transaction.isSplit ? "Edit Transaction Split" : "Split Transaction"}
      size="5xl"
      bottomSheet
      drawerOnMobile
      footer={
        <div className="flex flex-col sm:flex-row justify-between items-center w-full gap-3">
          <div className="w-full sm:w-auto order-2 sm:order-1">
            {transaction.isSplit && (
              <Button
                onClick={handleCancelSplit}
                disabled={loading}
                variant="outline"
                className="w-full sm:w-auto text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              >
                {loading ? 'Canceling...' : 'Cancel Split'}
              </Button>
            )}
          </div>
          <div className="flex gap-2 w-full sm:w-auto order-1 sm:order-2">
            <Button variant="ghost" onClick={onClose} disabled={loading} className="flex-1 sm:flex-none">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading || !isValid} className="flex-1 sm:flex-none">
              {loading ? 'Saving...' : (transaction.isSplit ? 'Update Splits' : 'Create Splits')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Transaction Info */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Original Transaction</div>
          <div className="font-semibold">{transaction.description}</div>
          <div className="text-lg font-bold text-blue-600">
            RM {transaction.amount.toFixed(2)}
          </div>
        </div>

        {/* Splits */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Split Allocations</h3>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleQuickSplit}
                variant="ghost"
                className="bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-1 flex items-center gap-2 hover:bg-amber-100 transition-colors"
                title="Quick split for ToyyibPay dues: 350 (Membership) + 75 (Pink Shirt) + 75 (Jacket)"
              >
                <Lightbulb className="w-3.5 h-3.5" />
                ToyyibPay Dues Split
              </Button>
              <Button
                onClick={handleAddSplit}
                variant="outline"
                className="text-sm px-3 py-1 flex items-center gap-2 hover:bg-gray-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Split
              </Button>
              {remainingAmount > 0.01 && uncategorizedSplits.length === 0 && (
                <Button
                  onClick={handleAddRemainderSplit}
                  variant="outline"
                  className="text-sm px-3 py-1 flex items-center gap-2 text-slate-500 hover:bg-slate-50 transition-colors"
                  title="Add an uncategorized split for the remaining amount"
                >
                  <Plus className="w-4 h-4" />
                  Add Remainder
                </Button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-medium whitespace-nowrap">
                  <tr>
                    <th className="py-2 px-3 text-xs font-semibold w-[20px]">#</th>
                    <th className="py-2 px-2 text-xs font-semibold w-[160px]">Category</th>
                    <th className="py-2 px-2 text-xs font-semibold w-[80px]">Year</th>
                    <th className="py-2 px-2 text-xs font-semibold w-[140px]">Member/Project/Admin</th>
                    <th className="py-2 px-2 text-xs font-semibold w-[120px]">Purpose</th>
                    <th className="py-2 px-2 text-xs font-semibold text-right w-[80px]">Amount (RM)</th>
                    <th className="py-2 px-2 text-xs font-semibold w-[120px]">Description</th>
                    <th className="py-2 px-2 text-xs font-semibold w-[40px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {splits.map((split, index) => {
                    const isEditing = editingIndex === index;
                    const data = isEditing && editForm ? editForm : split;

                    return (
                      <tr key={index} className="border-t hover:bg-slate-50">
                        <td className="py-2 px-3 text-xs">{index + 1}</td>

                        {isEditing ? (
                          <>
                            <td className="py-1 px-2">
                              <Forms.Select
                                value={data.category}
                                onChange={(e) => setEditForm({ ...editForm!, category: e.target.value as CategoryType })}
                                options={categoryOptions}
                                className="text-xs h-8"
                              />
                            </td>
                            <td className="py-1 px-2">
                              {data.category === 'Membership' || data.category === 'Administrative' ? (
                                <Forms.Input
                                  type="number"
                                  value={data.year || ''}
                                  onChange={(e) => setEditForm({ ...editForm!, year: e.target.value === '' ? undefined : parseInt(e.target.value, 10) })}
                                  placeholder="Year"
                                  className="text-xs h-8"
                                />
                              ) : data.category === 'Projects & Activities' ? (
                                <Combobox
                                  options={['All', String(currentYear), ...projectYears.map(y => String(y))].filter((v, i, a) => a.indexOf(v) === i)}
                                  value={splitYearFilters[index] || ''}
                                  onChange={(value) => setSplitYearFilter(index, value)}
                                  placeholder="Year"
                                />
                              ) : null}
                            </td>
                            <td className="py-1 px-2">
                              {data.category === 'Membership' && (
                                <Combobox
                                  options={memberOptions.map(m => m.name)}
                                  value={memberOptions.find(m => m.id === data.memberId)?.name || ''}
                                  onChange={(value) => {
                                    const member = memberOptions.find(m => m.name === value);
                                    setEditForm({ ...editForm!, memberId: member?.id || value });
                                  }}
                                  placeholder="Member"
                                />
                              )}
                              {data.category === 'Projects & Activities' && (
                                <Combobox
                                  groupedOptions={groupedProjectOptionsBySplit[index]}
                                  value={filteredProjectOptionsBySplit[index]?.find(p => p.id === data.projectId)?.name || ''}
                                  onChange={(value) => {
                                    const project = filteredProjectOptionsBySplit[index]?.find(p => p.name === value);
                                    setEditForm({ ...editForm!, projectId: project?.id || '' });
                                  }}
                                  placeholder="Project"
                                />
                              )}
                              {data.category === 'Administrative' && (
                                <Combobox
                                  options={adminAccounts}
                                  value={data.projectId}
                                  onChange={(value) => setEditForm({ ...editForm!, projectId: value })}
                                  placeholder="Account"
                                />
                              )}
                            </td>
                            <td className="py-1 px-2">
                              {data.category === 'Administrative' ? (
                                <Combobox
                                  options={adminPurposes}
                                  value={data.purpose}
                                  onChange={(value) => setEditForm({ ...editForm!, purpose: value })}
                                  placeholder="Purpose"
                                />
                              ) : data.category === 'Membership' ? (
                                <Forms.Input
                                  value={data.purpose}
                                  readOnly
                                  disabled
                                  className="text-xs h-8 bg-slate-50"
                                />
                              ) : data.category === 'Projects & Activities' ? (
                                <Combobox
                                  options={purposesByProject[data.projectId] || projectPurposes}
                                  value={data.purpose}
                                  onChange={(value) => setEditForm({ ...editForm!, purpose: value })}
                                  placeholder="Purpose"
                                />
                              ) : (
                                <Forms.Input
                                  value={data.purpose}
                                  onChange={(e) => setEditForm({ ...editForm!, purpose: e.target.value })}
                                  placeholder="Purpose"
                                  className="text-xs h-8"
                                />
                              )}
                            </td>
                            <td className="py-1 px-2">
                              <Forms.Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={data.amount || ''}
                                onChange={(e) => setEditForm({ ...editForm!, amount: parseFloat(e.target.value) || 0 })}
                                className="text-xs h-8 text-right"
                              />
                            </td>
                            <td className="py-1 px-2">
                              <Forms.Input
                                value={data.description}
                                onChange={(e) => setEditForm({ ...editForm!, description: e.target.value })}
                                placeholder="Description"
                                className="text-xs h-8"
                              />
                            </td>
                            <td className="py-1 px-2">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={handleInlineSave}
                                  className="p-1 text-green-600 hover:bg-green-100 rounded"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={handleInlineCancel}
                                  className="p-1 text-red-600 hover:bg-red-100 rounded"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-2 px-2 text-xs">{split.category}</td>
                            <td className="py-2 px-2 text-xs">{split.year || '-'}</td>
                            <td className="py-2 px-2 text-xs">
                              {split.category === 'Membership' && memberOptions.find(m => m.id === split.memberId)?.name}
                              {split.category === 'Projects & Activities' && projectOptions.find(p => p.id === split.projectId)?.name}
                              {split.category === 'Administrative' && split.projectId}
                            </td>
                            <td className="py-2 px-2 text-xs">{split.purpose || '-'}</td>
                            <td className="py-2 px-2 text-right font-mono text-blue-600">{split.amount?.toFixed(2) || '0.00'}</td>
                            <td className="py-2 px-2 text-xs">{split.description || '-'}</td>
                            <td className="py-2 px-2">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => startInlineEdit(index)}
                                  className="p-1 text-slate-400 hover:text-blue-600"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                {splits.length > 1 && (
                                  <button
                                    onClick={() => handleRemoveSplit(index)}
                                    className="p-1 text-slate-400 hover:text-red-600"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-gray-50 p-4 rounded-lg space-y-2">
          <div className="flex justify-between text-sm">
            <span>Total Split Amount:</span>
            <span className="font-semibold">RM {totalSplitAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Remaining:</span>
            <span className={`font-semibold ${Math.abs(remainingAmount) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
              RM {remainingAmount.toFixed(2)}
            </span>
          </div>
          {Math.abs(remainingAmount) >= 0.01 && (
            <div className="text-xs text-red-600">
              Split amounts must equal the transaction amount
            </div>
          )}
          {hasMultipleUncategorized && (
            <div className="text-xs text-amber-600">
              Only one uncategorized remainder split is allowed per transaction.
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
