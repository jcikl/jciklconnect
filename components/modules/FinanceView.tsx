import React, { useState, useEffect, useMemo, useCallback, useTransition, lazy, Suspense } from 'react';
import { DollarSign, PieChart, ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle, FileText, Plus, X, Download, TrendingUp, TrendingDown, BarChart3, CheckCircle, AlertTriangle, Edit, Trash2, Briefcase, Upload, Layers, Settings, Search, Link2, SlidersHorizontal, ChevronDown, ShieldAlert } from 'lucide-react';
import { Card, Button, Badge, StatCard, StatCardsContainer, Modal, useToast, Tabs, Drawer } from '../ui/Common';
import { Input, Select } from '../ui/Form';
import { Combobox } from '../ui/Combobox';
import { LoadingState } from '../ui/Loading';
import { FinanceService } from '../../services/financeService';
import { PaymentRequestService } from '../../services/paymentRequestService';
import { formatCurrency } from '../../utils/formatUtils';
import { formatDate } from '../../utils/dateUtils';
import { Transaction, BankAccount, ProjectFinancialAccount, TransactionSplit, InventoryItem, FinanceAlert } from '../../types';
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
const PaymentRequestsView = lazy(() => import('./PaymentRequestsView').then(m => ({ default: m.PaymentRequestsView })));
import { FirstUseBanner } from '../ui/FirstUseBanner';
import { projectFinancialService } from '../../services/projectFinancialService';
import { ProjectsService } from '../../services/projectsService';
import { useHelpModal } from '../../contexts/HelpModalContext';
import { MembersService } from '../../services/membersService';
import { MembershipConfigService } from '../../services/membershipConfigService';
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
import { AdministrativeTab } from './Finance/AdministrativeTab';
import { ProjectAccountTab } from './Finance/ProjectAccountTab';
import { TransactionsTab } from './Finance/TransactionsTab';
import { AsyncErrorBoundary } from '../ui/AsyncErrorBoundary';


const FinanceAlertsPanel: React.FC<{ userId: string }> = ({ userId }) => {
  const [alerts, setAlerts] = useState<FinanceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setAlerts(await FinanceService.getFinanceAlerts(true)); } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!loading && alerts.length === 0) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldAlert size={16} className="text-red-500 shrink-0" />
        <span className="text-sm font-semibold text-red-700">
          Finance Alerts — {loading ? '…' : alerts.length} unresolved
        </span>
      </div>
      {!loading && alerts.map(alert => (
        <div key={alert.id} className="bg-white border border-red-100 rounded-lg px-3 py-2.5 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-700 leading-snug">{alert.message}</p>
            <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-400 font-mono">
              {alert.type && <span className="bg-slate-100 px-1.5 py-0.5 rounded">{alert.type}</span>}
              {alert.transactionId && <span>tx: {alert.transactionId.slice(0, 8)}…</span>}
              {alert.billCode && <span>bill: {alert.billCode}</span>}
              <span>{alert.createdAt ? new Date(alert.createdAt).toLocaleDateString('en-MY') : ''}</span>
            </div>
          </div>
          <button
            disabled={resolvingId === alert.id}
            onClick={async () => {
              setResolvingId(alert.id);
              await FinanceService.resolveFinanceAlert(alert.id, userId).catch(() => {});
              setResolvingId(null);
              load();
            }}
            className="shrink-0 text-[11px] font-semibold text-green-600 hover:text-green-800 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg px-2 py-1 transition-colors disabled:opacity-50"
          >
            {resolvingId === alert.id ? '…' : 'Resolve'}
          </button>
        </div>
      ))}
    </div>
  );
};

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
    handleRunEventAutoMatch,
    handleReconciliationQuery,
    handleMarkReconciled,
    handleVoidTransaction,
    handleUnmatchTransaction,
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
          <p className="text-slate-500 text-sm">Bookkeeping · dues collection · budgeting</p>
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
          tabs={['Dashboard', 'Transactions', 'Project Account', 'Membership', 'Administrative', 'Payment Requests', 'Reconciliation']}
          activeTab={moduleTab}
          onTabChange={setModuleTab}
        />
      </div>

      {moduleTab === 'Dashboard' && (
        <div className="space-y-6">
          {/* Finance Alerts — rendered only when there are unresolved alerts */}
          {hasPermission('canViewFinance') && user && <FinanceAlertsPanel userId={user.uid} />}
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
        <Suspense fallback={<div className="py-12 text-center text-slate-400 text-sm">Loading...</div>}>
        <DuesRenewalDashboard
          year={detailYear}
          membershipTransactions={membershipTransactions}
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
          onInitiateRenewal={() => setIsDuesRenewalModalOpen(true)}
        />
        </Suspense>
      )}

      {moduleTab === 'Administrative' && hasPermission('canViewFinance') && (
        <AsyncErrorBoundary>
          <AdministrativeTab
            transactions={administrativeTransactions}
            isTransactionInCategory={isTransactionInCategory}
            adminAccountYearFilter={adminAccountYearFilter}
            dynamicAdministrativeProjectIds={dynamicAdministrativeProjectIds}
            adminProjectIdFilter={adminProjectIdFilter}
            setAdminProjectIdFilter={setAdminProjectIdFilter}
            loading={loading}
            error={error}
            getTransactionAccountLabel={getTransactionAccountLabel}
            hasPermission={hasPermission}
            handleEditTransaction={handleEditTransaction}
            handleDeleteTransaction={handleDeleteTransaction}
            setIsAddAdministrativeProjectOpen={setIsAddAdministrativeProjectOpen}
            projects={projects}
          />
        </AsyncErrorBoundary>
      )}

      {moduleTab === 'Payment Requests' && (
        <AsyncErrorBoundary>
          <Suspense fallback={<LoadingState loading>{null}</LoadingState>}>
            <PaymentRequestsView searchQuery={searchQuery} />
          </Suspense>
        </AsyncErrorBoundary>
      )}

      {moduleTab === 'Reconciliation' && hasPermission('canViewFinance') && (
        <div className="space-y-4">
          {/* â”€â”€ Section 0: Event income auto-match â”€â”€ */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-800">Event income auto-match</h3>
              <p className="text-[11px] text-slate-400">Match Pending event ticket income transactions against imported bank transactions</p>
            </div>
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => handleRunEventAutoMatch()}>
              Run auto-match
            </Button>
          </div>
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
                            <p className="text-sm font-semibold text-slate-800 leading-snug truncate">{pr.purpose || pr.items?.[0]?.purpose || '—'}</p>
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
                            <option value="">— select bank transaction —</option>
                            {hasSuggestion && (
                              <optgroup label={`Suggested (same amount, Â±14 days)`}>
                                {suggestions.map(t => (
                                  <option key={t.id} value={t.id}>
                                    ✓ {formatDate(t.date)} · {t.description} · {formatCurrency(t.amount)}
                                  </option>
                                ))}
                              </optgroup>
                            )}
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
                            {prLinkingId === pr.id ? 'Linking…' : 'Confirm Match'}
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
                  <span className="ml-1.5 hidden sm:inline">{reconciliationLoading ? 'Searching…' : 'Search'}</span>
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
                                    {reconcilingId === tx.id ? 'Processing…' : 'Mark Reconciled'}
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
                              <p className="text-sm font-semibold text-slate-900 leading-snug truncate mb-1.5">{pr.purpose || '—'}</p>
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
        <AsyncErrorBoundary>
          <ProjectAccountTab
            loadingProjectAccounts={loadingProjectAccounts}
            filteredProjectAccounts={filteredProjectAccounts}
            uncategorizedProjectTxCount={uncategorizedProjectTxCount}
            selectedProjectFilter={selectedProjectFilter}
            setSelectedProjectFilter={setSelectedProjectFilter}
            projectTrackerSummary={projectTrackerSummary}
            selectedProjectTransactions={selectedProjectTransactions}
            loadingSelectedProjectTransactions={loadingSelectedProjectTransactions}
            projectTransactions={projectTransactions}
            projectAccounts={projectAccounts}
            selectedProjectInfo={selectedProjectInfo}
            loading={loading}
            error={error}
            getTransactionAccountLabel={getTransactionAccountLabel}
            hasPermission={hasPermission}
            handleEditTransaction={handleEditTransaction}
            handleDeleteTransaction={handleDeleteTransaction}
            loadProjectTrxList={loadProjectTrxList}
            setIsProjectTrxModalOpen={setIsProjectTrxModalOpen}
            projects={projects}
          />
        </AsyncErrorBoundary>
      )}
      {moduleTab === 'Transactions' && (
        <AsyncErrorBoundary>
          <TransactionsTab
            txSearchTerm={txSearchTerm}
            setTxSearchTerm={setTxSearchTerm}
            txCategoryFilter={txCategoryFilter}
            setTxCategoryFilter={setTxCategoryFilter}
            bankAccountFilter={bankAccountFilter}
            setBankAccountFilter={setBankAccountFilter}
            txTypeFilter={txTypeFilter}
            setTxTypeFilter={setTxTypeFilter}
            txStatusFilter={txStatusFilter}
            setTxStatusFilter={setTxStatusFilter}
            reportYear={reportYear}
            setReportYear={setReportYear}
            accounts={accounts}
            loading={loading}
            error={error}
            transactions={transactions}
            visibleTransactions={visibleTransactions}
            groupedTransactions={groupedTransactions}
            transactionSplits={transactionSplits}
            selectedTxIds={selectedTxIds}
            setSelectedTxIds={setSelectedTxIds}
            selectedSplitIds={selectedSplitIds}
            setSelectedSplitIds={setSelectedSplitIds}
            handleSelectAllTransactions={handleSelectAllTransactions}
            handleEditTransaction={handleEditTransaction}
            handleDeleteTransaction={handleDeleteTransaction}
            handleUnmatchTransaction={handleUnmatchTransaction}
            handleVoidTransaction={handleVoidTransaction}
            setSelectedTransaction={setSelectedTransaction}
            setIsSplitModalOpen={setIsSplitModalOpen}
            members={members}
            loadMembers={loadMembers}
            projects={projects}
            loadProjects={loadProjects}
            setProjectPurposes={setProjectPurposes}
            getTransactionAccountLabel={getTransactionAccountLabel}
            hasMoreTransactions={hasMoreTransactions}
            setTransactionLimit={setTransactionLimit}
          />
        </AsyncErrorBoundary>
      )}

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
              <Button
                className="flex-1 shadow-sm"
                type="submit"
                form="edit-transaction-form"
                disabled={editingTransaction.status === 'Reconciled' || editingTransaction.status === 'Partially Reconciled'}
              >
                Update Transaction
              </Button>
            </div>
          }
        >
          {(editingTransaction.status === 'Reconciled' || editingTransaction.status === 'Partially Reconciled') && (
            <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm flex items-center gap-2">
              <span className="font-semibold">🔒 Locked:</span>
              This transaction is <strong>{editingTransaction.status}</strong> and cannot be edited. Delink it from all project transactions to unlock.
            </div>
          )}
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
      <AsyncErrorBoundary>
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
      </AsyncErrorBoundary>



      {/* Dues Renewal Modal */}
      <DuesRenewalModal
        isOpen={isDuesRenewalModalOpen}
        onClose={() => setIsDuesRenewalModalOpen(false)}
        year={renewalYear}
        onYearChange={setRenewalYear}
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
