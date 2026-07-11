import React, { useState, useEffect, useMemo, useCallback, useTransition, lazy, Suspense } from 'react';
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
// Heavy sub-components: lazy-loaded so they don't block initial parse
const TransactionSplitModal = lazy(() => import('./Finance/TransactionSplitModal').then(m => ({ default: m.TransactionSplitModal })));
const DuesRenewalDashboard = lazy(() => import('./Finance/DuesRenewalDashboard').then(m => ({ default: m.DuesRenewalDashboard })));
const TransactionForm = lazy(() => import('./Finance/TransactionForm'));
const BankTransactionImportModal = lazy(() => import('./Finance/BankTransactionImportModal'));
const BankMatchingModal = lazy(() => import('./Finance/BankMatchingModal').then(m => ({ default: m.BankMatchingModal })));
const BatchCategoryModal = lazy(() => import('./Finance/BatchCategoryModal').then(m => ({ default: m.BatchCategoryModal })));
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
import {
  getLinkedBankTxInfo as getLinkedBankTxInfoUtil,
  isTransactionInCategory as isTransactionInCategoryUtil,
  getTransactionAccountLabel as getTransactionAccountLabelUtil,
} from '../../utils/financeUtils';
import { FinancialReportsModal } from './Finance/FinancialReportsModal';
import { AddBankAccountModal } from './Finance/AddBankAccountModal';
import { DuesRenewalModal } from './Finance/DuesRenewalModal';
import { useFinanceData, UNASSIGNED_PROJECT_ID } from '../../hooks/useFinanceData';


export const FinanceView: React.FC<{ searchQuery?: string }> = ({ searchQuery }) => {
  const helpModal = useHelpModal();

  const {
    // auth / permissions (also used in JSX)
    showToast, hasPermission, isDeveloper, user,

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
  } = useFinanceData(searchQuery);
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Financial Management</h2>
          <p className="text-slate-500 text-sm">Bookkeeping Â· dues collection Â· budgeting</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-20 shrink-0">
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
          <Button variant="outline" size="sm" onClick={() => setIsReportsModalOpen(true)} title="Reports" className="shrink-0 h-[38px] px-2.5 sm:px-3">
            <FileText size={14} className="sm:mr-1.5" /><span className="hidden sm:inline">Reports</span>
          </Button>
          {hasPermission('canEditFinance') && (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsImportModalOpen(true)} title="Batch Import" className="shrink-0 h-[38px] px-2.5 sm:px-3">
                <Upload size={14} className="sm:mr-1.5" /><span className="hidden sm:inline">Batch Import</span>
              </Button>
            </>
          )}
          <Button className="shrink-0 h-[38px]" onClick={() => { setAddDefaultCategory(null); setRecordFormCategory('Projects & Activities'); setIsModalOpen(true); }}>
            <DollarSign size={16} className="mr-1.5" />Transaction
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
                    <span className="text-[10px] text-green-300 font-mono tabular-nums">â†‘ {formatCurrency(summary.totalIncome)}</span>
                    <span className="text-[10px] text-red-300 font-mono tabular-nums">â†“ {formatCurrency(summary.totalExpenses)}</span>
                  </div>
                )}
              </div>
              {/* Net Balance */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Net Balance</p>
                <p className={`text-xl font-bold mt-1 leading-tight tabular-nums ${summary && summary.netBalance >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                  {summary ? formatCurrency(summary.netBalance) : 'â€”'}
                </p>
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                    <span className="text-[10px] text-slate-400 font-mono tabular-nums truncate">{summary ? formatCurrency(summary.totalIncome) : 'â€”'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                    <span className="text-[10px] text-slate-400 font-mono tabular-nums truncate">{summary ? formatCurrency(summary.totalExpenses) : 'â€”'}</span>
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
            {/* Main Content: Transactions â€” order-2 on mobile so Bank Accounts appears first */}
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
                              {acc.bankName ? `${acc.bankName} Â· ` : ''}{acc.name}
                            </p>
                            {acc.accountNumber && (
                              <span className="text-[10px] text-slate-400 font-mono shrink-0">Â·Â·Â·{acc.accountNumber.slice(-4)}</span>
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
                                {acc.bankName ? `${acc.bankName} Â· ` : ''}{acc.name}
                              </p>
                              <p className="text-base font-bold text-slate-900 mt-0.5 tabular-nums">{formatCurrency(acc.balance, acc.currency)}</p>
                            </div>
                            {acc.accountNumber && (
                              <span className="text-[11px] text-slate-400 font-mono shrink-0 mt-1">Â·Â·Â·{acc.accountNumber.slice(-4)}</span>
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
        <Suspense fallback={<div className="py-12 text-center text-slate-400 text-sm">Loading...</div>}>
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
        </Suspense>
      )}

      {moduleTab === 'Administrative' && hasPermission('canViewFinance') && (
        <div className="space-y-4">
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
            if (activeYear !== 0) {
              adminByProjectId = adminByProjectId.filter(acc => acc.income !== 0 || acc.expenses !== 0);
            }

            const adminTransactionsWithFilter = activeYear === 0
              ? adminTransactions
              : adminTransactions.filter(t => new Date(t.date).getFullYear() === activeYear);
            const filteredAdminTx = adminProjectIdFilter
              ? adminProjectIdFilter === UNASSIGNED_PROJECT_ID
                ? adminTransactionsWithFilter.filter(t => !(t.projectId || '').trim())
                : adminTransactionsWithFilter.filter(t => (t.projectId || '').trim() === adminProjectIdFilter)
              : adminTransactionsWithFilter;

            return (
              <>
                {/* â”€â”€ Admin Account Cards â€” horizontal scroll both mobile + desktop â”€â”€ */}
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-bold text-slate-700">Admin Accounts</h3>
                  {hasPermission('canEditFinance') && (
                    <Button size="sm" variant="outline" onClick={() => setIsAddAdministrativeProjectOpen(true)}>
                      <Plus size={13} className="mr-1" />Add Account
                    </Button>
                  )}
                </div>
                {adminByProjectId.length === 0 ? (
                  <p className="py-4 text-sm text-slate-400 text-center">No admin accounts found.</p>
                ) : (
                  <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
                    {adminByProjectId.map(({ projectId, income, expenses, net }) => {
                      const isActive = adminProjectIdFilter === projectId;
                      const isUnassigned = projectId === UNASSIGNED_PROJECT_ID;
                      return (
                        <div
                          key={projectId}
                          role="button"
                          tabIndex={0}
                          onClick={() => setAdminProjectIdFilter(isActive ? null : projectId)}
                          onKeyDown={(e) => e.key === 'Enter' && setAdminProjectIdFilter(isActive ? null : projectId)}
                          className={`shrink-0 w-64 relative cursor-pointer rounded-xl border overflow-hidden shadow-sm transition-all ${isActive
                            ? 'border-jci-blue ring-1 ring-jci-blue/20 shadow-md shadow-jci-blue/5'
                            : 'border-slate-200 hover:border-slate-300 hover:shadow'
                            }`}
                        >
                          <div className={`absolute left-0 top-0 bottom-0 w-1 ${isActive ? 'bg-jci-blue' : isUnassigned ? 'bg-amber-400' : 'bg-slate-300'}`} />
                          <div className={`pl-4 pr-3 pt-3 pb-3 ${isActive ? 'bg-jci-blue/5' : 'bg-white'}`}>
                            <div className="flex items-center gap-1.5 min-w-0 mb-2.5">
                              <Briefcase size={13} className={`shrink-0 ${isActive ? 'text-jci-blue' : 'text-slate-400'}`} />
                              <span className={`text-sm font-semibold truncate ${isActive ? 'text-jci-blue' : 'text-slate-800'}`}>
                                {isUnassigned ? 'Unassigned' : projectId}
                              </span>
                            </div>
                            <div className="bg-slate-50 rounded-lg border border-slate-100 overflow-hidden">
                              <div className="divide-y divide-slate-100">
                                <div className="grid grid-cols-2 gap-1 px-2 py-1">
                                  <div className="text-[11px] text-slate-500">Income</div>
                                  <div className="text-right text-[11px] font-mono text-green-600">{formatCurrency(income)}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-1 px-2 py-1">
                                  <div className="text-[11px] text-slate-500">Expense</div>
                                  <div className="text-right text-[11px] font-mono text-red-500">{formatCurrency(expenses)}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-1 px-2 py-1.5 bg-slate-100/60">
                                  <div className="text-[11px] font-semibold text-slate-700">Net</div>
                                  <div className={`text-right text-[11px] font-mono font-semibold ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(net)}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* â”€â”€ Summary strip + Transactions â”€â”€ */}
                <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                  {/* Left: Summary */}
                  <div className="md:col-span-2">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="px-4 pt-3 pb-2 border-b border-slate-100">
                        <h3 className="text-sm font-bold text-slate-800">Summary</h3>
                        <p className="text-[11px] text-slate-400">{activeYear === 0 ? 'All time' : activeYear}</p>
                      </div>
                      <div className="px-4 py-3 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-500">Income</span>
                          <span className="text-sm font-mono font-semibold text-green-600">+{formatCurrency(adminIncome)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-500">Expense</span>
                          <span className="text-sm font-mono font-semibold text-red-500">-{formatCurrency(adminExpenses)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                          <span className="text-xs font-semibold text-slate-700">Net</span>
                          <span className={`text-sm font-mono font-bold ${adminNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(adminNet)}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 pt-1">
                          {adminFiltered.filter(t => t.type === 'Income').length} income Â· {adminFiltered.filter(t => t.type === 'Expense').length} expense
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Right: Transactions */}
                  <div className="md:col-span-5">
                    {/* Title row */}
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-slate-800">
                        {adminProjectIdFilter === UNASSIGNED_PROJECT_ID
                          ? 'Transactions Â· Unassigned'
                          : adminProjectIdFilter
                            ? `Transactions Â· ${adminProjectIdFilter}`
                            : 'Admin Transactions'}
                      </h3>
                      {adminProjectIdFilter && (
                        <button onClick={() => setAdminProjectIdFilter(null)} className="text-xs text-blue-500 hover:text-blue-700 font-medium">Clear</button>
                      )}
                    </div>
                    <LoadingState loading={loading} error={error} empty={filteredAdminTx.length === 0} emptyMessage={adminProjectIdFilter ? 'No transactions for this account.' : "No admin transactions found. Use 'New Transaction' above to add one."}>
                      {/* Desktop table */}
                      <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-100">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                            <tr>
                              <th className="py-2.5 px-3 font-semibold text-xs whitespace-nowrap">Date</th>
                              <th className="py-2.5 px-3 font-semibold text-xs whitespace-nowrap">Type</th>
                              <th className="py-2.5 px-3 font-semibold text-xs">Description</th>
                              <th className="py-2.5 px-3 font-semibold text-xs whitespace-nowrap">Account</th>
                              <th className="py-2.5 px-3 font-semibold text-xs text-right whitespace-nowrap">Amount</th>
                              {hasPermission('canEditFinance') && <th className="py-2.5 px-3 font-semibold text-xs text-center">Actions</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredAdminTx
                              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                              .map(tx => {
                                const hasProjectId = tx.projectId && tx.projectId.trim() !== '';
                                const hasPurpose = tx.purpose && tx.purpose.trim() !== '';
                                const accountLabel = getTransactionAccountLabel(tx);
                                return (
                                  <tr key={tx.id} className={`border-l-2 ${tx.type === 'Income' ? 'border-l-green-400' : 'border-l-red-400'} hover:bg-slate-50/60 transition-colors`}>
                                    <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(tx.date)}</td>
                                    <td className="py-2.5 px-3 whitespace-nowrap">
                                      <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${tx.type === 'Income' ? 'bg-green-50 text-green-700 ring-1 ring-green-200' : 'bg-red-50 text-red-600 ring-1 ring-red-200'}`}>
                                        {tx.type === 'Income' ? 'â†‘ Income' : 'â†“ Expense'}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 max-w-0">
                                      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                        {tx.isSplit
                                          ? <Badge variant="info" className="text-[10px] shrink-0">Split</Badge>
                                          : hasProjectId && hasPurpose
                                            ? <Badge variant="success" className="text-[10px] shrink-0">Categorized</Badge>
                                            : <Badge variant="warning" className="text-[10px] shrink-0">Uncategorized</Badge>
                                        }
                                        <span className="font-medium text-slate-900 truncate text-xs">{tx.description}</span>
                                        {tx.referenceNumber && <span className="text-[10px] text-slate-400 font-mono shrink-0">({tx.referenceNumber})</span>}
                                        {tx.status && tx.status !== 'Cleared' && (
                                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${tx.status === 'Reconciled' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-700'}`}>{tx.status}</span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap max-w-[140px] truncate">
                                      {accountLabel}
                                    </td>
                                    <td className={`py-2.5 px-3 text-right font-mono font-bold text-xs whitespace-nowrap ${tx.type === 'Income' ? 'text-green-600' : 'text-red-500'}`}>
                                      {tx.type === 'Income' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                                    </td>
                                    {hasPermission('canEditFinance') && (
                                      <td className="py-2.5 px-3 text-center">
                                        <div className="flex justify-center gap-0.5">
                                          <button onClick={() => handleEditTransaction(tx)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Edit size={13} /></button>
                                          <button onClick={() => handleDeleteTransaction(tx.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
                                        </div>
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                      {/* Mobile cards */}
                      <div className="md:hidden space-y-2 pt-1">
                        {filteredAdminTx
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .map(tx => {
                            const hasProjectId = tx.projectId && tx.projectId.trim() !== '';
                            const hasPurpose = tx.purpose && tx.purpose.trim() !== '';
                            return (
                              <div key={tx.id} className="relative bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                                <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${tx.type === 'Income' ? 'bg-green-400' : 'bg-red-400'}`} />
                                <div className="pl-4 pr-3 pt-2.5 pb-2.5">
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className="text-[11px] text-slate-400 font-medium">{formatDate(tx.date)}</span>
                                    <span className={`font-mono font-bold text-sm shrink-0 ${tx.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                                      {tx.type === 'Income' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                                    </span>
                                  </div>
                                  <p className="text-sm font-semibold text-slate-900 leading-snug truncate mb-1.5">{tx.description}</p>
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                                      {tx.isSplit
                                        ? <Badge variant="info" className="text-[10px] shrink-0">Split</Badge>
                                        : hasProjectId && hasPurpose
                                          ? <Badge variant="success" className="text-[10px] shrink-0">Categorized</Badge>
                                          : <Badge variant="warning" className="text-[10px] shrink-0">Uncategorized</Badge>
                                      }
                                      <span className="text-[10px] text-slate-400 truncate">
                                        {tx.projectId ? (projects.find(p => p.id === tx.projectId)?.name ?? tx.projectId) : 'â€”'}
                                      </span>
                                    </div>
                                    {hasPermission('canEditFinance') && (
                                      <div className="flex items-center gap-0.5 shrink-0">
                                        <button onClick={() => handleEditTransaction(tx)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Edit size={13} /></button>
                                        <button onClick={() => handleDeleteTransaction(tx.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </LoadingState>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {moduleTab === 'Reconciliation' && hasPermission('canViewFinance') && (
        <div className="space-y-4">
          {/* â”€â”€ Section 1: PR â†’ Bank Transaction â”€â”€ */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                  <Link2 size={14} className="text-amber-600" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-800">Payment Request Reconciliation</h3>
                  <p className="text-[11px] text-slate-400 hidden sm:block">Match approved PRs to bank import transactions</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!prReconcileLoading && prPendingReconciliation.length > 0 && (
                  <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">{prPendingReconciliation.length} pending</span>
                )}
                <button onClick={loadPrPendingReconciliation} disabled={prReconcileLoading} className="p-1.5 rounded-lg text-slate-400 hover:text-jci-blue hover:bg-blue-50 transition-colors">
                  <RefreshCw size={14} className={prReconcileLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
            {/* Body */}
            <div className="p-4">
              {prReconcileLoading ? (
                <LoadingState loading>{null}</LoadingState>
              ) : prPendingReconciliation.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <div className="w-10 h-10 rounded-full bg-green-50 border border-green-200 flex items-center justify-center">
                    <CheckCircle size={18} className="text-green-500" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">All caught up!</p>
                  <p className="text-xs text-slate-400">All approved Payment Requests have been reconciled.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {prPendingReconciliation.map(pr => {
                    const suggestions = prBankSuggestions[pr.id] || [];
                    const selectedId = prSelectedBankTx[pr.id] ?? '';
                    const bankExpenses = transactions.filter(t => t.source === 'bank_import' && t.type === 'Expense' && t.status !== 'Reconciled');
                    const hasSuggestion = suggestions.length > 0;
                    return (
                      <div key={pr.id} className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        {/* PR info row */}
                        <div className="relative flex items-start gap-3 px-4 py-3 bg-white">
                          <div className={`absolute left-0 top-0 bottom-0 w-1 ${hasSuggestion ? 'bg-green-400' : 'bg-amber-400'}`} />
                          <div className="flex-1 min-w-0 pl-1">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                                <Badge variant="warning" className="text-[10px] shrink-0">PR</Badge>
                                <span className="text-[11px] text-slate-400 font-mono truncate">{pr.referenceNumber}</span>
                              </div>
                              <span className="text-sm font-bold text-rose-600 shrink-0">{formatCurrency(pr.totalAmount || pr.amount)}</span>
                            </div>
                            <p className="text-sm font-semibold text-slate-800 leading-snug truncate">{pr.purpose || pr.items?.[0]?.purpose || 'â€”'}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[11px] text-slate-400">{formatDate(pr.date)}</span>
                              {hasSuggestion && (
                                <span className="text-[10px] font-semibold text-green-600 bg-green-50 border border-green-200 rounded px-1.5 py-0.5 shrink-0">{suggestions.length} suggestion{suggestions.length > 1 ? 's' : ''}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        {/* Match area */}
                        <div className="border-t border-slate-100 px-4 pb-3 pt-2.5 bg-slate-50/60 space-y-2.5">
                          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Select bank transaction</p>
                          <select
                            value={selectedId}
                            onChange={e => setPrSelectedBankTx(prev => ({ ...prev, [pr.id]: e.target.value }))}
                            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-jci-blue/30 focus:border-jci-blue"
                          >
                            <option value="">â€” select bank transaction â€”</option>
                            {hasSuggestion && (
                              <optgroup label={`Suggested (same amount, Â±14 days)`}>
                                {suggestions.map(t => (
                                  <option key={t.id} value={t.id}>
                                    âœ“ {formatDate(t.date)} Â· {t.description} Â· {formatCurrency(t.amount)}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {bankExpenses.filter(t => !suggestions.find(s => s.id === t.id)).length > 0 && (
                              <optgroup label="Other bank expenses">
                                {bankExpenses.filter(t => !suggestions.find(s => s.id === t.id)).map(t => (
                                  <option key={t.id} value={t.id}>
                                    {formatDate(t.date)} Â· {t.description} Â· {formatCurrency(t.amount)}
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
                            {prLinkingId === pr.id ? 'Linkingâ€¦' : 'Confirm Match'}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* â”€â”€ Section 2: Reconcile by Reference Number â”€â”€ */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2.5 px-4 pt-4 pb-3 border-b border-slate-100">
              <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                <Search size={14} className="text-blue-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Reconcile by Reference Number</h3>
                <p className="text-[11px] text-slate-400 hidden sm:block">Search transactions and PRs by reference number</p>
              </div>
            </div>
            {/* Search bar */}
            <div className="px-4 pt-3 pb-3 border-b border-slate-100 bg-slate-50/40">
              <FirstUseBanner flowId="reconciliation" dismissLabel="Got it" variant="teal" onHelpClick={helpModal?.openHelp}>
                Enter a reference number (e.g. PR-default-lo-20250216-001) to search both bank transactions and payment requests. Once verified, click "Mark Reconciled" to record the action.
              </FirstUseBanner>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="e.g. PR-default-lo-20250216-001"
                  value={refNumberQuery}
                  onChange={(e) => setRefNumberQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleReconciliationQuery()}
                  className="flex-1"
                  aria-label="Search transactions and payment requests by reference number"
                />
                <Button onClick={handleReconciliationQuery} disabled={reconciliationLoading} className="shrink-0">
                  {reconciliationLoading ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
                  <span className="ml-1.5 hidden sm:inline">{reconciliationLoading ? 'Searchingâ€¦' : 'Search'}</span>
                </Button>
              </div>
            </div>
            {/* Results */}
            <div className="p-4">
              {reconciliationLoading ? (
                <LoadingState loading>{null}</LoadingState>
              ) : reconciliationTx.length === 0 && reconciliationPRs.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Enter a reference number above to search.</p>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Transactions column */}
                  <div>
                    <div className="flex items-center gap-2 mb-2.5">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Transactions</h4>
                      {reconciliationTx.length > 0 && <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 rounded-full px-1.5 py-0.5">{reconciliationTx.length}</span>}
                    </div>
                    <div className="space-y-2">
                      {reconciliationTx.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 py-5 text-center text-xs text-slate-400">No matching transactions</div>
                      ) : (
                        reconciliationTx.map((tx) => (
                          <div key={tx.id} className="relative rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${tx.type === 'Income' ? 'bg-green-400' : 'bg-red-400'}`} />
                            <div className="pl-4 pr-3 pt-2.5 pb-2.5">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="text-[11px] text-slate-400">{formatDate(tx.date)}</span>
                                <span className={`font-mono font-bold text-sm shrink-0 ${tx.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                                  {tx.type === 'Income' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                                </span>
                              </div>
                              <p className="text-sm font-semibold text-slate-900 leading-snug truncate mb-1.5">{tx.description}</p>
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  {tx.status === 'Reconciled'
                                    ? <Badge variant="success" className="text-[10px]">Reconciled</Badge>
                                    : <Badge variant="warning" className="text-[10px]">{tx.status || 'Pending'}</Badge>
                                  }
                                  {tx.referenceNumber && <span className="text-[10px] text-slate-400 font-mono truncate">{tx.referenceNumber}</span>}
                                </div>
                                {tx.status !== 'Reconciled' && (
                                  <Button size="sm" onClick={() => handleMarkReconciled(tx.id)} disabled={reconcilingId !== null} className="shrink-0 text-[11px] px-2 py-1">
                                    {reconcilingId === tx.id ? 'Processingâ€¦' : 'Mark Reconciled'}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  {/* Payment Requests column */}
                  <div>
                    <div className="flex items-center gap-2 mb-2.5">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Payment Requests</h4>
                      {reconciliationPRs.length > 0 && <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 rounded-full px-1.5 py-0.5">{reconciliationPRs.length}</span>}
                    </div>
                    <div className="space-y-2">
                      {reconciliationPRs.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 py-5 text-center text-xs text-slate-400">No matching payment requests</div>
                      ) : (
                        reconciliationPRs.map((pr) => (
                          <div key={pr.id} className="relative rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${pr.status === 'approved' ? 'bg-green-400' : pr.status === 'rejected' ? 'bg-red-400' : 'bg-amber-400'}`} />
                            <div className="pl-4 pr-3 pt-2.5 pb-2.5">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="text-[11px] text-slate-400 font-mono truncate">{pr.referenceNumber}</span>
                                <span className="font-mono font-bold text-sm shrink-0 text-slate-700">{formatCurrency(pr.totalAmount || pr.amount)}</span>
                              </div>
                              <p className="text-sm font-semibold text-slate-900 leading-snug truncate mb-1.5">{pr.purpose || 'â€”'}</p>
                              <div className="flex items-center gap-1.5">
                                <Badge variant={pr.status === 'approved' ? 'success' : pr.status === 'rejected' ? 'error' : 'warning'} className="text-[10px]">
                                  {pr.status === 'approved' ? 'Approved' : pr.status === 'rejected' ? 'Rejected' : 'Pending'}
                                </Badge>
                                <span className="text-[11px] text-slate-400">{formatDate(pr.date)}</span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}



      {moduleTab === 'Project Account' && (
        <div className="space-y-4">
          {/* Project Account Cards */}
          <LoadingState loading={loadingProjectAccounts} error={null} empty={filteredProjectAccounts.length === 0 && uncategorizedProjectTxCount === 0} emptyMessage="No project accounts found. Create a project in the 'Projects' section and set up its financial account.">
            {/* Mobile: horizontal scroll */}
            <div className="md:hidden flex gap-2.5 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
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
                const bankIncome = acc.totalIncome || 0;
                const bankExpenses = acc.totalExpenses || 0;
                const bankNet = bankIncome - bankExpenses;
                const ptData = projectTrackerSummary[acc.projectId] || { income: 0, expenses: 0 };
                const ptIncome = ptData.income;
                const ptExpenses = ptData.expenses;
                const ptNet = ptIncome - ptExpenses;
                const isMatch = ptIncome === bankIncome && ptExpenses === bankExpenses && ptNet === bankNet;

                return (
                  <div
                    key={acc.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedProjectFilter(isActive ? null : acc.projectId)}
                    onKeyDown={(e) => e.key === 'Enter' && setSelectedProjectFilter(isActive ? null : acc.projectId)}
                    className={`shrink-0 w-64 relative cursor-pointer rounded-xl border overflow-hidden shadow-sm transition-all ${isActive
                      ? 'border-jci-blue ring-1 ring-jci-blue/20 shadow-md shadow-jci-blue/5'
                      : 'border-slate-200 hover:border-slate-300 hover:shadow'
                      }`}
                  >
                    {/* Left color bar */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${isActive ? 'bg-jci-blue' : acc.projectId === UNASSIGNED_PROJECT_ID ? 'bg-amber-400' : 'bg-slate-300'}`} />
                    <div className={`pl-4 pr-3 pt-3 pb-3 ${isActive ? 'bg-jci-blue/5' : 'bg-white'}`}>
                      {/* Header */}
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Briefcase size={13} className={`shrink-0 ${isActive ? 'text-jci-blue' : 'text-slate-400'}`} />
                          <span className={`text-sm font-semibold truncate ${isActive ? 'text-jci-blue' : 'text-slate-800'}`}>{acc.projectName}</span>
                        </div>
                        {acc.projectId !== UNASSIGNED_PROJECT_ID && isMatch && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-green-600 bg-green-50 border border-green-200 rounded px-1.5 py-0.5 shrink-0 ml-2">
                            <CheckCircle size={10} />Matched
                          </span>
                        )}
                        {acc.projectId !== UNASSIGNED_PROJECT_ID && !isMatch && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 shrink-0 ml-2">
                            <AlertCircle size={10} />Diff
                          </span>
                        )}
                      </div>

                      {acc.projectId === UNASSIGNED_PROJECT_ID ? (
                        <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                          <span className="text-xs text-amber-700 font-medium">Pending Categorization</span>
                          <span className="text-lg font-bold text-amber-700">{uncategorizedProjectTxCount}</span>
                        </div>
                      ) : (
                        <div className="bg-slate-50 rounded-lg border border-slate-100 overflow-hidden">
                          <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] px-1.5">
                            <div className="pt-1 pb-0.5 whitespace-nowrap text-[10px] invisible">Expense</div>
                            <div className="pt-1 pb-0.5 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-wide">PT</div>
                            <div className="pt-1 pb-0.5 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Bank</div>
                            <div className="py-0.5 border-t border-slate-100 text-[10px] text-slate-500 whitespace-nowrap">Income</div>
                            <div className="py-0.5 border-t border-slate-100 text-right text-[10px] font-mono text-slate-700 min-w-0 overflow-hidden">{formatCurrency(ptIncome)}</div>
                            <div className="py-0.5 border-t border-slate-100 text-right text-[10px] font-mono text-green-600 min-w-0 overflow-hidden">{formatCurrency(bankIncome)}</div>
                            <div className="py-0.5 border-t border-slate-100 text-[10px] text-slate-500 whitespace-nowrap">Expense</div>
                            <div className="py-0.5 border-t border-slate-100 text-right text-[10px] font-mono text-slate-700 min-w-0 overflow-hidden">{formatCurrency(ptExpenses)}</div>
                            <div className="py-0.5 border-t border-slate-100 text-right text-[10px] font-mono text-red-500 min-w-0 overflow-hidden">{formatCurrency(bankExpenses)}</div>
                            <div className="py-1 border-t border-slate-200 bg-slate-100/60 text-[10px] font-semibold text-slate-700 whitespace-nowrap">Net</div>
                            <div className={`py-1 border-t border-slate-200 bg-slate-100/60 text-right text-[10px] font-mono font-semibold min-w-0 overflow-hidden ${ptNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(ptNet)}</div>
                            <div className={`py-1 border-t border-slate-200 bg-slate-100/60 text-right text-[10px] font-mono font-semibold min-w-0 overflow-hidden ${bankNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(bankNet)}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Desktop: horizontal scroll */}
            <div className="hidden md:flex gap-3 overflow-x-auto pb-2 no-scrollbar -mx-1 px-1">
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
                const bankIncome = acc.totalIncome || 0;
                const bankExpenses = acc.totalExpenses || 0;
                const bankNet = bankIncome - bankExpenses;
                const ptData = projectTrackerSummary[acc.projectId] || { income: 0, expenses: 0 };
                const ptIncome = ptData.income;
                const ptExpenses = ptData.expenses;
                const ptNet = ptIncome - ptExpenses;
                const isMatch = ptIncome === bankIncome && ptExpenses === bankExpenses && ptNet === bankNet;

                return (
                  <div
                    key={acc.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedProjectFilter(isActive ? null : acc.projectId)}
                    onKeyDown={(e) => e.key === 'Enter' && setSelectedProjectFilter(isActive ? null : acc.projectId)}
                    className={`shrink-0 w-64 relative cursor-pointer rounded-xl border overflow-hidden shadow-sm transition-all ${isActive
                      ? 'border-jci-blue ring-1 ring-jci-blue/20 shadow-md shadow-jci-blue/5'
                      : 'border-slate-200 hover:border-slate-300 hover:shadow'
                      }`}
                  >
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${isActive ? 'bg-jci-blue' : acc.projectId === UNASSIGNED_PROJECT_ID ? 'bg-amber-400' : 'bg-slate-300'}`} />
                    <div className={`pl-4 pr-3 pt-3 pb-3 ${isActive ? 'bg-jci-blue/5' : 'bg-white'}`}>
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Briefcase size={13} className={`shrink-0 ${isActive ? 'text-jci-blue' : 'text-slate-400'}`} />
                          <span className={`text-sm font-semibold truncate ${isActive ? 'text-jci-blue' : 'text-slate-800'}`}>{acc.projectName}</span>
                        </div>
                        {acc.projectId !== UNASSIGNED_PROJECT_ID && isMatch && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-green-600 bg-green-50 border border-green-200 rounded px-1.5 py-0.5 shrink-0 ml-2">
                            <CheckCircle size={10} />Matched
                          </span>
                        )}
                        {acc.projectId !== UNASSIGNED_PROJECT_ID && !isMatch && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 shrink-0 ml-2">
                            <AlertCircle size={10} />Diff
                          </span>
                        )}
                      </div>
                      {acc.projectId === UNASSIGNED_PROJECT_ID ? (
                        <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                          <span className="text-xs text-amber-700 font-medium">Pending Categorization</span>
                          <span className="text-lg font-bold text-amber-700">{uncategorizedProjectTxCount}</span>
                        </div>
                      ) : (
                        <div className="bg-slate-50 rounded-lg border border-slate-100 overflow-hidden">
                          <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] px-1.5">
                            <div className="pt-1 pb-0.5 whitespace-nowrap text-[10px] invisible">Expense</div>
                            <div className="pt-1 pb-0.5 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-wide">PT</div>
                            <div className="pt-1 pb-0.5 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Bank</div>
                            <div className="py-0.5 border-t border-slate-100 text-[10px] text-slate-500 whitespace-nowrap">Income</div>
                            <div className="py-0.5 border-t border-slate-100 text-right text-[10px] font-mono text-slate-700 min-w-0 overflow-hidden">{formatCurrency(ptIncome)}</div>
                            <div className="py-0.5 border-t border-slate-100 text-right text-[10px] font-mono text-green-600 min-w-0 overflow-hidden">{formatCurrency(bankIncome)}</div>
                            <div className="py-0.5 border-t border-slate-100 text-[10px] text-slate-500 whitespace-nowrap">Expense</div>
                            <div className="py-0.5 border-t border-slate-100 text-right text-[10px] font-mono text-slate-700 min-w-0 overflow-hidden">{formatCurrency(ptExpenses)}</div>
                            <div className="py-0.5 border-t border-slate-100 text-right text-[10px] font-mono text-red-500 min-w-0 overflow-hidden">{formatCurrency(bankExpenses)}</div>
                            <div className="py-1 border-t border-slate-200 bg-slate-100/60 text-[10px] font-semibold text-slate-700 whitespace-nowrap">Net</div>
                            <div className={`py-1 border-t border-slate-200 bg-slate-100/60 text-right text-[10px] font-mono font-semibold min-w-0 overflow-hidden ${ptNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(ptNet)}</div>
                            <div className={`py-1 border-t border-slate-200 bg-slate-100/60 text-right text-[10px] font-mono font-semibold min-w-0 overflow-hidden ${bankNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(bankNet)}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </LoadingState>

          {/* Stats strip + Transactions */}
          {(() => {
            const filteredProjectTx = (selectedProjectFilter && selectedProjectFilter !== UNASSIGNED_PROJECT_ID)
              ? selectedProjectTransactions
              : projectTransactions;
            const txIncome = filteredProjectTx.filter(t => t.type === 'Income').reduce((s, t) => s + t.amount, 0);
            const txExpense = filteredProjectTx.filter(t => t.type === 'Expense').reduce((s, t) => s + t.amount, 0);
            const txTitle = selectedProjectFilter === UNASSIGNED_PROJECT_ID
              ? 'Unassigned Transactions'
              : selectedProjectFilter
                ? `${projectAccounts.find(p => p.projectId === selectedProjectFilter)?.projectName || selectedProjectFilter}`
                : 'All Project Transactions';

            return (
              <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                {/* Left: Project Statistics */}
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
                          <span className="font-semibold text-green-600">{filteredProjectAccounts.filter(acc => acc.currentBalance >= 0).length}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500">Negative Balance</span>
                          <span className="font-semibold text-red-600">{filteredProjectAccounts.filter(acc => acc.currentBalance < 0).length}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500">Unassigned Txs</span>
                          <span className="font-semibold text-amber-600">{uncategorizedProjectTxCount}</span>
                        </div>
                      </div>
                      {selectedProjectInfo && (
                        <div className="border-t border-slate-100 pt-3">
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
                              className="w-full mt-2"
                              size="sm"
                              onClick={() => { loadProjectTrxList(selectedProjectFilter); setIsProjectTrxModalOpen(true); }}
                            >
                              <Settings size={14} className="mr-1.5" />Configure PT
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>

                {/* Right: Transactions */}
                <div className="md:col-span-5">
                  {/* Title row */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="text-sm font-semibold text-slate-800 truncate">{txTitle}</h3>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {selectedProjectFilter && (
                        <button onClick={() => setSelectedProjectFilter(null)} className="text-xs text-blue-500 hover:text-blue-700 font-medium">Clear</button>
                      )}
                    </div>
                  </div>

                  {/* Summary strip */}
                  {filteredProjectTx.length > 0 && (
                    <div className="flex items-center gap-2 px-1 pb-3 overflow-x-auto no-scrollbar">
                      <span className="text-xs text-slate-500 font-medium whitespace-nowrap shrink-0">{filteredProjectTx.length} txns</span>
                      <span className="w-px h-3.5 bg-slate-200 shrink-0" />
                      <span className="text-xs font-mono font-semibold text-green-600 whitespace-nowrap shrink-0">+{formatCurrency(txIncome)}</span>
                      <span className="text-xs font-mono font-semibold text-red-500 whitespace-nowrap shrink-0">âˆ’{formatCurrency(txExpense)}</span>
                      <span className="w-px h-3.5 bg-slate-200 shrink-0" />
                      <span className="text-xs font-mono font-semibold whitespace-nowrap shrink-0">
                        Net: <span className={txIncome - txExpense >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(txIncome - txExpense)}</span>
                      </span>
                      {selectedProjectInfo && (
                        <>
                          <span className="w-px h-3.5 bg-slate-200 shrink-0" />
                          <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">Budget: <span className="font-semibold text-slate-700">{formatCurrency(selectedProjectInfo.budget || selectedProjectInfo.proposedBudget || 0)}</span></span>
                        </>
                      )}
                    </div>
                  )}

                  <LoadingState loading={loading || loadingSelectedProjectTransactions} error={error} empty={filteredProjectTx.length === 0} emptyMessage={selectedProjectFilter ? 'No transactions for this project.' : "No project transactions found. Use 'New Transaction' above to add one."}>
                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-100">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                          <tr>
                            <th className="py-2.5 px-3 font-semibold text-xs whitespace-nowrap">Date</th>
                            <th className="py-2.5 px-3 font-semibold text-xs whitespace-nowrap">Type</th>
                            <th className="py-2.5 px-3 font-semibold text-xs">Description</th>
                            <th className="py-2.5 px-3 font-semibold text-xs whitespace-nowrap">Project</th>
                            <th className="py-2.5 px-3 font-semibold text-xs text-right whitespace-nowrap">Amount</th>
                            {hasPermission('canEditFinance') && <th className="py-2.5 px-3 font-semibold text-xs text-center">Actions</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredProjectTx
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .map(tx => {
                              const hasProjectId = tx.projectId && tx.projectId.trim() !== '';
                              const hasPurpose = tx.purpose && tx.purpose.trim() !== '';
                              const projectLabel = getTransactionAccountLabel(tx);
                              return (
                                <tr key={tx.id} className={`border-l-2 ${tx.type === 'Income' ? 'border-l-green-400' : 'border-l-red-400'} hover:bg-slate-50/60 transition-colors`}>
                                  <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(tx.date)}</td>
                                  <td className="py-2.5 px-3 whitespace-nowrap">
                                    <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${tx.type === 'Income' ? 'bg-green-50 text-green-700 ring-1 ring-green-200' : 'bg-red-50 text-red-600 ring-1 ring-red-200'}`}>
                                      {tx.type === 'Income' ? 'â†‘ Income' : 'â†“ Expense'}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 max-w-0">
                                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                      {tx.isSplit
                                        ? <Badge variant="info" className="text-[10px] shrink-0">Split</Badge>
                                        : hasProjectId && hasPurpose
                                          ? <Badge variant="success" className="text-[10px] shrink-0">Categorized</Badge>
                                          : <Badge variant="warning" className="text-[10px] shrink-0">Uncategorized</Badge>
                                      }
                                      <span className="font-medium text-slate-900 truncate text-xs">{tx.description}</span>
                                      {tx.referenceNumber && <span className="text-[10px] text-slate-400 font-mono shrink-0">({tx.referenceNumber})</span>}
                                      {tx.status && tx.status !== 'Cleared' && (
                                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${tx.status === 'Reconciled' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-700'}`}>{tx.status}</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap max-w-[140px] truncate">
                                    {projectLabel}
                                  </td>
                                  <td className={`py-2.5 px-3 text-right font-mono font-bold text-xs whitespace-nowrap ${tx.type === 'Income' ? 'text-green-600' : 'text-red-500'}`}>
                                    {tx.type === 'Income' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                                  </td>
                                  {hasPermission('canEditFinance') && (
                                    <td className="py-2.5 px-3 text-center">
                                      <div className="flex justify-center gap-0.5">
                                        <button onClick={() => handleEditTransaction(tx)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Edit size={13} /></button>
                                        <button onClick={() => handleDeleteTransaction(tx.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden space-y-2 pt-1">
                      {filteredProjectTx
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map(tx => {
                          const hasProjectId = tx.projectId && tx.projectId.trim() !== '';
                          const hasPurpose = tx.purpose && tx.purpose.trim() !== '';
                          return (
                            <div key={tx.id} className="relative bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                              <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${tx.type === 'Income' ? 'bg-green-400' : 'bg-red-400'}`} />
                              <div className="pl-4 pr-3 pt-2.5 pb-2.5">
                                {/* Row 1: date | amount */}
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="text-[11px] text-slate-400 font-medium">{formatDate(tx.date)}</span>
                                  <span className={`font-mono font-bold text-sm shrink-0 ${tx.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                                    {tx.type === 'Income' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                                  </span>
                                </div>
                                {/* Row 2: description */}
                                <p className="text-sm font-semibold text-slate-900 leading-snug truncate mb-1.5">{tx.description}</p>
                                {/* Row 3: meta | actions */}
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                                    {tx.isSplit
                                      ? <Badge variant="info" className="text-[10px] shrink-0">Split</Badge>
                                      : hasProjectId && hasPurpose
                                        ? <Badge variant="success" className="text-[10px] shrink-0">Categorized</Badge>
                                        : <Badge variant="warning" className="text-[10px] shrink-0">Uncategorized</Badge>
                                    }
                                    <span className="text-[10px] text-slate-400 truncate">
                                      {tx.projectId ? (projects.find(p => p.id === tx.projectId)?.name || tx.projectId) : 'â€”'}
                                    </span>
                                  </div>
                                  {hasPermission('canEditFinance') && (
                                    <div className="flex items-center gap-0.5 shrink-0">
                                      <button onClick={() => handleEditTransaction(tx)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Edit size={13} /></button>
                                      <button onClick={() => handleDeleteTransaction(tx.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </LoadingState>
                </div>
              </div>
            );
          })()}
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
                  {/* Search */}
                  <Input
                    type="text"
                    placeholder="Search date, description, ref noâ€¦"
                    value={txSearchTerm}
                    onChange={(e) => setTxSearchTerm(e.target.value)}
                    icon={<Search size={16} />}
                    className="w-full"
                  />

                  {/* Filter panel: always visible */}
                  {/* Mobile: 2 stacked rows (dropdowns full-width, chips full-width). Desktop: single row */}
                  <div className="flex flex-col md:flex-row md:items-center gap-2">
                    {/* Dropdowns â€” pill style */}
                    <div className="flex gap-1.5">
                      {/* Account â€” flex-1 on mobile so both pills share the row equally */}
                      <div className="relative flex-1 md:flex-none md:shrink-0">
                        <select
                          value={bankAccountFilter}
                          onChange={(e) => setBankAccountFilter(e.target.value)}
                          className={`appearance-none cursor-pointer w-full pl-3 pr-6 py-1.5 rounded-full text-xs font-semibold outline-none border transition-colors ${bankAccountFilter !== 'All'
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
                      <div className="relative flex-1 md:flex-none md:shrink-0">
                        <select
                          value={txCategoryFilter}
                          onChange={(e) => setTxCategoryFilter(e.target.value)}
                          className={`appearance-none cursor-pointer w-full pl-3 pr-6 py-1.5 rounded-full text-xs font-semibold outline-none border transition-colors ${txCategoryFilter !== 'All'
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
                    {/* Chips â€” Type + Status */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                        {(['All', 'Income', 'Expense'] as const).map(t => (
                          <button key={t} onClick={() => setTxTypeFilter(t)}
                            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${txTypeFilter === t
                              ? t === 'Income' ? 'bg-green-500 text-white' : t === 'Expense' ? 'bg-red-500 text-white' : 'bg-white text-slate-700 shadow-sm'
                              : 'text-slate-500 hover:text-slate-700'
                              }`}>
                            {t === 'Income' ? 'â†‘ Inc' : t === 'Expense' ? 'â†“ Exp' : 'All'}
                          </button>
                        ))}
                      </div>
                      <div className="w-px h-4 bg-slate-200 shrink-0" />
                      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                        {(['All', 'Pending', 'Cleared'] as const).map(s => (
                          <button key={s} onClick={() => setTxStatusFilter(s)}
                            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${txStatusFilter === s
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
                  <span className="text-xs font-mono font-semibold text-red-500 whitespace-nowrap shrink-0">âˆ’{formatCurrency(expenseTotal)}</span>
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
                                  title={`${tx.isSplit ? 'Split' : (tx.category || 'â€”')} | ${getTransactionAccountLabel(tx)} | ${tx.purpose || 'â€”'}`}
                                >
                                  {tx.status === 'Pending' && <span className="shrink-0 inline-flex items-center px-1.5 py-0 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">Pending</span>}
                                  <span className="font-medium text-slate-600">
                                    {tx.isSplit ? 'Split' : (tx.category || 'â€”')}
                                  </span>
                                  <span className="text-slate-300">|</span>
                                  <span>{getTransactionAccountLabel(tx)}</span>
                                  <span className="text-slate-300">|</span>
                                  <span>{tx.purpose || 'â€”'}</span>
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
                                    <span className="text-slate-400 shrink-0">â†³</span>
                                    <span className="text-slate-600 truncate min-w-0">{split.description}</span>
                                  </div>
                                  <div
                                    className="mt-0.5 overflow-hidden text-xs text-slate-500 whitespace-nowrap text-ellipsis"
                                    title={`${split.category || 'â€”'} | ${getTransactionAccountLabel(split, tx)} | ${split.purpose || 'â€”'}`}
                                  >
                                    <span className="font-medium text-slate-600">{split.category || 'â€”'}</span>
                                    <span className="mx-1 text-slate-300">|</span>
                                    <span>{getTransactionAccountLabel(split, tx)}</span>
                                    <span className="mx-1 text-slate-300">|</span>
                                    <span>{split.purpose || 'â€”'}</span>
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
                              <Badge variant={tx.isSplit ? "info" : "neutral"} className="text-[10px] shrink-0">{tx.isSplit ? "Split" : (tx.category || "â€”")}</Badge>
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
                                    <span className="text-blue-400 shrink-0">â†³</span>
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
          <Suspense fallback={<div className="py-8 text-center text-slate-400 text-sm">Loading...</div>}>
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
          </Suspense>
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
            <Suspense fallback={<div className="py-8 text-center text-slate-400 text-sm">Loading...</div>}>
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
            </Suspense>
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
                                tx.referenceNumber || 'â€”'
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
                                tx.purpose || 'â€”'
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
      <Suspense fallback={null}>
        <BankTransactionImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImported={async () => {
            await loadData();
          }}
        />
      </Suspense>

      {/* Transaction Split Modal */}
      {
        selectedTransaction && (
          <Suspense fallback={null}>
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
          </Suspense>
        )
      }

      {/* Batch Category Modal */}
      <Suspense fallback={null}>
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
      </Suspense>

      {/* Bank Account Detail Drawer */}
      <Drawer
        isOpen={isAccountDetailOpen}
        onClose={() => setIsAccountDetailOpen(false)}
        title={detailAccount ? (detailAccount.bankName ? `${detailAccount.bankName} Â· ${detailAccount.name}` : detailAccount.name) : 'Account Details'}
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
                        {data.income > 0 ? `+${formatCurrency(data.income)}` : 'â€”'}
                      </td>
                      <td className="py-3 px-4 text-red-600 font-medium text-right font-mono">
                        {data.expenses > 0 ? `-${formatCurrency(data.expenses)}` : 'â€”'}
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
                    : `${selectedTxIds.size} main â€¢ ${selectedSplitIds.size} splits`
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
        <Suspense fallback={null}>
          <BankMatchingModal
            isOpen={!!matchingAccount}
            onClose={() => setMatchingAccount(null)}
            account={matchingAccount}
            currentUserId={user?.uid ?? ''}
            onComplete={() => { setMatchingAccount(null); loadData(); }}
          />
        </Suspense>
      )}

      {/* Add Administrative Project ID Modal (è¡Œæ”¿è´¹æˆ·å£) */}
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
