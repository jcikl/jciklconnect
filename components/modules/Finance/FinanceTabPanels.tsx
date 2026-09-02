import React, { lazy, Suspense, useState, useEffect } from 'react';
import type { BankAccount } from '../../../types';
import type { useFinanceData } from '../../../hooks/useFinanceData';
import { usePermissions } from '../../../hooks/usePermissions';
import { LoadingState } from '../../ui/Loading';
import { AsyncErrorBoundary } from '../../ui/AsyncErrorBoundary';
import { AdministrativeTab } from './AdministrativeTab';
import { FinanceDashboardTab } from './FinanceDashboardTab';
import { FinanceMembershipTab } from './FinanceMembershipTab';
import { FinanceReconciliationTab } from './FinanceReconciliationTab';
import { ProjectAccountTab } from './ProjectAccountTab';
import { TransactionsTab } from './TransactionsTab';

const PaymentRequestsView = lazy(() => import('../PaymentRequestsView').then(m => ({ default: m.PaymentRequestsView })));

type FinanceData = ReturnType<typeof useFinanceData>;

interface FinanceTabPanelsProps {
  financeData: FinanceData;
  searchQuery?: string;
  onOpenAddAccount: () => void;
  onOpenAccountDetail: (account: BankAccount) => void;
  onOpenEditModal: () => void;
  onOpenDuesRenewal: () => void;
  onOpenTransaction: () => void;
  onHelpClick?: (topic?: string) => void;
}

export const FinanceTabPanels: React.FC<FinanceTabPanelsProps> = ({
  financeData,
  searchQuery,
  onOpenAddAccount,
  onOpenAccountDetail,
  onOpenEditModal,
  onOpenDuesRenewal,
  onOpenTransaction,
  onHelpClick,
}) => {
  const { isAdmin } = usePermissions();
  const [membershipYear, setMembershipYear] = useState(financeData.detailYear);
  useEffect(() => { setMembershipYear(financeData.detailYear); }, [financeData.detailYear]);

  const {
    accounts,
    administrativeTransactions,
    adminAccountYearFilter,
    adminProjectIdFilter,
    bankAccountFilter,
    canOperateFinance,
    dashboardStats,
    dynamicAdministrativeProjectIds,
    error,
    filteredProjectAccounts,
    getTransactionAccountLabel,
    groupedTransactions,
    handleDeleteTransaction,
    handleEditTransaction,
    handleLinkPrToBankTx,
    handleMarkReconciled,
    handleReconciliationQuery,
    handleRunEventAutoMatch,
    handleSelectAllTransactions,
    handleUnmatchTransaction,
    handleVoidTransaction,
    hasMoreTransactions,
    hasPermission,
    loading,
    loadingProjectAccounts,
    loadingSelectedProjectTransactions,
    loadMembers,
    loadPrPendingReconciliation,
    loadProjectTrxList,
    loadProjects,
    loadData,
    members,
    membershipTransactions,
    moduleTab,
    prBankSuggestions,
    prLinkingId,
    prPendingReconciliation,
    prReconcileLoading,
    prSelectedBankTx,
    projectAccounts,
    projectTrackerSummary,
    projectTransactions,
    projects,
    reconciliationLoading,
    reconciliationPRs,
    reconciliationTx,
    refNumberQuery,
    reportYear,
    selectedProjectFilter,
    selectedProjectInfo,
    selectedProjectTransactions,
    selectedSplitIds,
    selectedTxIds,
    setAdminProjectIdFilter,
    setBankAccountFilter,
    setEditingMembershipFilterYear,
    setEditingMembershipMemberId,
    setEditingMembershipYear,
    setEditingTransaction,
    setIsAddAdministrativeProjectOpen,
    setIsProjectTrxModalOpen,
    setIsSplitModalOpen,
    setModuleTab,
    setPrSelectedBankTx,
    setProjectPurposes,
    setRefNumberQuery,
    setReportYear,
    setSelectedProjectFilter,
    setSelectedSplitIds,
    setSelectedTransaction,
    setSelectedTxIds,
    setTransactionLimit,
    setTxCategoryFilter,
    setTxSearchTerm,
    setTxStatusFilter,
    setTxTypeFilter,
    summary,
    transactionSplits,
    transactions,
    txCategoryFilter,
    txSearchTerm,
    txStatusFilter,
    txTypeFilter,
    uncategorizedProjectTxCount,
    user,
    visibleTransactions,
  } = financeData;

  return (
    <>
      {moduleTab === 'Dashboard' && (
        <FinanceDashboardTab
          loading={loading}
          error={error}
          canOperateFinance={canOperateFinance}
          canViewFinance={hasPermission('canViewFinance')}
          userId={user?.uid}
          accounts={accounts}
          transactions={transactions}
          summary={summary}
          dashboardStats={dashboardStats}
          onViewAllTransactions={() => setModuleTab('Transactions')}
          onAddAccount={onOpenAddAccount}
          onOpenAccount={onOpenAccountDetail}
          onMatchAccount={financeData.setMatchingAccount}
        />
      )}

      {moduleTab === 'Membership' && hasPermission('canViewFinance') && (
        <FinanceMembershipTab
          year={membershipYear}
          membershipTransactions={membershipTransactions}
          members={members}
          canOperateFinance={canOperateFinance}
          isAdminUser={isAdmin}
          onEditTransaction={setEditingTransaction}
          onEditingMembershipFilterYearChange={setEditingMembershipFilterYear}
          onEditingMembershipMemberIdChange={setEditingMembershipMemberId}
          onEditingMembershipYearChange={setEditingMembershipYear}
          onOpenEditModal={onOpenEditModal}
          onMembershipDataChanged={loadData}
          onInitiateRenewal={onOpenDuesRenewal}
          onYearChange={(y) => { setMembershipYear(y); loadData(y); }}
        />
      )}

      {moduleTab === 'Administrative' && hasPermission('canViewFinance') && (
        <AsyncErrorBoundary>
          <AdministrativeTab
            transactions={administrativeTransactions}
            isTransactionInCategory={financeData.isTransactionInCategory}
            adminAccountYearFilter={adminAccountYearFilter}
            dynamicAdministrativeProjectIds={dynamicAdministrativeProjectIds}
            adminProjectIdFilter={adminProjectIdFilter}
            setAdminProjectIdFilter={setAdminProjectIdFilter}
            loading={loading}
            error={error}
            getTransactionAccountLabel={getTransactionAccountLabel}
            hasPermission={(permission) => permission === 'canEditFinance' ? canOperateFinance : hasPermission(permission as Parameters<typeof hasPermission>[0])}
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
        <FinanceReconciliationTab
          canOperateFinance={canOperateFinance}
          refNumberQuery={refNumberQuery}
          reconciliationTx={reconciliationTx}
          reconciliationPRs={reconciliationPRs}
          reconciliationLoading={reconciliationLoading}
          reconcilingId={financeData.reconcilingId}
          prPendingReconciliation={prPendingReconciliation}
          prReconcileLoading={prReconcileLoading}
          prBankSuggestions={prBankSuggestions}
          prSelectedBankTx={prSelectedBankTx}
          prLinkingId={prLinkingId}
          transactions={transactions}
          onRunEventAutoMatch={handleRunEventAutoMatch}
          onRefreshPrReconciliation={loadPrPendingReconciliation}
          onRefNumberQueryChange={setRefNumberQuery}
          onReconciliationQuery={handleReconciliationQuery}
          onSelectPrBankTx={(paymentRequestId, transactionId) => {
            setPrSelectedBankTx(prev => ({ ...prev, [paymentRequestId]: transactionId }));
          }}
          onLinkPrToBankTx={handleLinkPrToBankTx}
          onMarkReconciled={handleMarkReconciled}
          onHelpClick={onHelpClick}
        />
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
            hasPermission={(permission) => permission === 'canEditFinance' ? canOperateFinance : hasPermission(permission as Parameters<typeof hasPermission>[0])}
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
            canOperateFinance={canOperateFinance}
            onOpenTransaction={onOpenTransaction}
          />
        </AsyncErrorBoundary>
      )}
    </>
  );
};
