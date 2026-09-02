import React, { useState } from 'react';
import { useHelpModal } from '../../contexts/HelpModalContext';
import { ADMINISTRATIVE_PURPOSES } from '../../config/constants';
import { useFinanceData } from '../../hooks/useFinanceData';
import { FinanceAuxiliaryModals } from './Finance/FinanceAuxiliaryModals';
import { FinanceBottomOverlays } from './Finance/FinanceBottomOverlays';
import { FinanceHeader } from './Finance/FinanceHeader';
import { FinanceProjectTrackerModalContainer } from './Finance/FinanceProjectTrackerModalContainer';
import { FinanceTabPanels } from './Finance/FinanceTabPanels';
import { FinanceTransactionFormModals } from './Finance/FinanceTransactionFormModals';


export const FinanceView: React.FC<{ searchQuery?: string }> = React.memo(({ searchQuery }) => {
  const helpModal = useHelpModal();
  const financeData = useFinanceData(searchQuery);

  const {
    // auth / permissions (also used in JSX)
    showToast, hasPermission, canOperateFinance, user,

    // core data
    transactions,
    accounts,
    loading,
    error,
    summary,
    projects,
    members,
    inventoryItems,
    transactionSplits,
    allTransactionYears,

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
    reportYear, setReportYear,
    reportMonth, setReportMonth,
    fiscalYearStart, setFiscalYearStart,
    selectedProjectFilter, setSelectedProjectFilter,
    moduleTab, setModuleTab,
    txSearchTerm, setTxSearchTerm,
    txCategoryFilter, setTxCategoryFilter,
    bankAccountFilter, setBankAccountFilter,
    txTypeFilter, setTxTypeFilter,
    txStatusFilter, setTxStatusFilter,
    setTransactionLimit,

    // editing state
    selectedTransaction, setSelectedTransaction,
    editingTransaction, setEditingTransaction,
    editingModalYear, setEditingModalYear,
    setEditingMembershipFilterYear,
    setEditingMembershipMemberId,
    editingMembershipYear, setEditingMembershipYear,
    editingAdministrativeYear, setEditingAdministrativeYear,
    editingAdministrativePurposeBase, setEditingAdministrativePurposeBase,
    editingProjectPurposesByProject,

    // project accounts
    projectAccounts,
    projectTrackerSummary,
    loadingProjectAccounts,
    setProjectAccountYearFilter,
    adminAccountYearFilter,
    projectPurposes, setProjectPurposes,

    // account detail
    matchingAccount, setMatchingAccount,
    detailAccount, setDetailAccount,
    detailYear, setDetailYear,

    // reconciliation
    refNumberQuery, setRefNumberQuery,
    reconciliationTx,
    reconciliationPRs,
    reconciliationLoading,
    reconcilingId,
    prPendingReconciliation,
    prReconcileLoading,
    prBankSuggestions,
    prSelectedBankTx, setPrSelectedBankTx,
    prLinkingId,

    // record form
    setAddDefaultCategory,
    recordFormCategory, setRecordFormCategory,
    recordFormMemberId, setRecordFormMemberId,
    recordFormYear, setRecordFormYear,
    recordFormProjectId, setRecordFormProjectId,

    // dues renewal
    renewalYear, setRenewalYear,
    isRenewing, setIsRenewing,

    // admin
    setAdministrativeProjectIds,
    adminProjectIdFilter, setAdminProjectIdFilter,
    dynamicAdministrativeProjectIds,

    // batch
    selectedTxIds, setSelectedTxIds,
    selectedSplitIds, setSelectedSplitIds,
    batchOperationProgress,

    // project trx modal
    projectTrxLoading,
    projectTrxList,
    projectTrxAddForm, setProjectTrxAddForm,
    projectTrxEditingId, setProjectTrxEditingId,
    projectTrxEditForm, setProjectTrxEditForm,

    // selected project transactions
    selectedProjectTransactions,
    loadingSelectedProjectTransactions,

    // computed memos
    selectedProjectInfo,
    availableYears,
    monthlyAccountSummary,
    projectTransactions,
    membershipTransactions,
    administrativeTransactions,
    uncategorizedProjectTxCount,
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
    loadProjects,
    loadMembers,
    loadPrPendingReconciliation,
    loadProjectTrxList,

    // handlers
    handleAddTransaction,
    handleEditTransaction,
    handleDeleteTransaction,
    handleBatchDelete,
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
  } = financeData;

  // P1: submit-guard states
  const [isAddingTransaction, setIsAddingTransaction] = useState(false);
  const [isUpdatingTransaction, setIsUpdatingTransaction] = useState(false);
  // P1: project-trx delete confirm
  const [deleteProjectTxConfirm, setDeleteProjectTxConfirm] = useState<string | null>(null);
  // P1: batch delete confirm
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);

  const wrappedHandleAddTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
    setIsAddingTransaction(true);
    try { await handleAddTransaction(e); }
    finally { setIsAddingTransaction(false); }
  };

  const wrappedHandleUpdateTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
    setIsUpdatingTransaction(true);
    try { await handleUpdateTransaction(e); }
    finally { setIsUpdatingTransaction(false); }
  };

  return (
    <div className="space-y-6">
      <FinanceHeader
        reportYear={reportYear}
        allTransactionYears={allTransactionYears}
        activeTab={moduleTab}
        canOperateFinance={canOperateFinance}
        onReportYearChange={(year) => {
          setReportYear(year);
          setProjectAccountYearFilter(year);
        }}
        onTabChange={setModuleTab}
        onOpenReports={() => setIsReportsModalOpen(true)}
        onOpenImport={() => setIsImportModalOpen(true)}
        onOpenTransaction={() => {
          setAddDefaultCategory(null);
          setRecordFormCategory('Projects & Activities');
          setIsModalOpen(true);
        }}
      />

      <FinanceTabPanels
        financeData={financeData}
        searchQuery={searchQuery}
        onOpenTransaction={() => {
          setAddDefaultCategory(null);
          setRecordFormCategory('Projects & Activities');
          setIsModalOpen(true);
        }}
        onOpenAddAccount={() => setIsAddAccountModalOpen(true)}
        onOpenAccountDetail={(acc) => {
          setDetailAccount(acc);
          setDetailYear(new Date().getFullYear());
          setIsAccountDetailOpen(true);
        }}
        onOpenEditModal={() => setIsEditModalOpen(true)}
        onOpenDuesRenewal={() => setIsDuesRenewalModalOpen(true)}
        onHelpClick={helpModal?.openHelp}
      />

      <FinanceTransactionFormModals
        canOperateFinance={canOperateFinance}
        isCreateOpen={isModalOpen}
        isEditOpen={isEditModalOpen}
        isAddingTransaction={isAddingTransaction}
        isUpdatingTransaction={isUpdatingTransaction}
        accounts={accounts}
        projects={projects}
        members={members}
        inventoryItems={inventoryItems}
        administrativeProjectIds={dynamicAdministrativeProjectIds}
        adminPurposes={[...ADMINISTRATIVE_PURPOSES]}
        projectYears={projectYears}
        groupedProjectsForModal={groupedProjectsForModal}
        filteredProjectsForModal={filteredProjectsForModal}
        editingProjectPurposesByProject={editingProjectPurposesByProject}
        recordFormCategory={recordFormCategory}
        recordFormMemberId={recordFormMemberId}
        recordFormYear={recordFormYear}
        recordFormProjectId={recordFormProjectId}
        editingModalYear={editingModalYear}
        editingTransaction={editingTransaction}
        editingMembershipYear={editingMembershipYear}
        editingAdministrativeYear={editingAdministrativeYear}
        editingAdministrativePurposeBase={editingAdministrativePurposeBase}
        onCloseCreate={() => {
          setIsModalOpen(false);
          setAddDefaultCategory(null);
          setRecordFormCategory('Projects & Activities');
          setRecordFormMemberId('');
          setRecordFormYear(new Date().getFullYear());
          setRecordFormProjectId('');
        }}
        onCloseEdit={() => {
          setIsEditModalOpen(false);
          setEditingTransaction(null);
          setEditingMembershipFilterYear(null);
          setEditingMembershipMemberId('');
          setEditingMembershipYear(new Date().getFullYear());
          setEditingAdministrativeYear(new Date().getFullYear());
          setEditingAdministrativePurposeBase('');
        }}
        onCreateSubmit={wrappedHandleAddTransaction}
        onEditSubmit={wrappedHandleUpdateTransaction}
        setRecordFormCategory={setRecordFormCategory}
        setRecordFormMemberId={setRecordFormMemberId}
        setRecordFormYear={setRecordFormYear}
        setRecordFormProjectId={setRecordFormProjectId}
        setEditingModalYear={setEditingModalYear}
        setEditingTransaction={setEditingTransaction}
        setEditingMembershipYear={setEditingMembershipYear}
        setEditingAdministrativeYear={setEditingAdministrativeYear}
        setEditingAdministrativePurposeBase={setEditingAdministrativePurposeBase}
      />

      <FinanceProjectTrackerModalContainer
        canOperateFinance={canOperateFinance}
        isOpen={isProjectTrxModalOpen}
        selectedProjectFilter={selectedProjectFilter}
        selectedProjectInfo={selectedProjectInfo}
        projectTransactions={projectTrxList}
        loading={projectTrxLoading}
        addForm={projectTrxAddForm}
        editForm={projectTrxEditForm}
        editingId={projectTrxEditingId}
        onClose={() => setIsProjectTrxModalOpen(false)}
        onPaste={handleProjectTrxPaste}
        onAddFormChange={setProjectTrxAddForm}
        onEditFormChange={setProjectTrxEditForm}
        onAddTransaction={handleAddProjectTrx}
        onUpdateTransaction={handleUpdateProjectTrx}
        onEditingIdChange={setProjectTrxEditingId}
        onDeleteTransaction={setDeleteProjectTxConfirm}
        getLinkedBankTxInfo={getLinkedBankTxInfo}
        showToast={showToast}
      />

      <FinanceAuxiliaryModals
        canOperateFinance={canOperateFinance}
        isReportsModalOpen={isReportsModalOpen}
        isDuesRenewalModalOpen={isDuesRenewalModalOpen}
        isImportModalOpen={isImportModalOpen}
        isSplitModalOpen={isSplitModalOpen}
        isBatchCategoryModalOpen={isBatchCategoryModalOpen}
        isAddAccountModalOpen={isAddAccountModalOpen}
        selectedTransaction={selectedTransaction}
        matchingAccount={matchingAccount}
        transactions={transactions}
        accounts={accounts}
        summary={summary}
        reportYear={reportYear}
        reportMonth={reportMonth}
        fiscalYearStart={fiscalYearStart}
        renewalYear={renewalYear}
        isRenewing={isRenewing}
        dynamicAdministrativeProjectIds={dynamicAdministrativeProjectIds}
        members={members}
        projects={projects}
        projectYears={projectYears}
        projectPurposes={projectPurposes}
        selectedTxIds={selectedTxIds}
        selectedSplitIds={selectedSplitIds}
        editingProjectPurposesByProject={editingProjectPurposesByProject}
        currentUserId={user?.uid ?? ''}
        onCloseReports={() => setIsReportsModalOpen(false)}
        onReportYearChange={setReportYear}
        onReportMonthChange={setReportMonth}
        onFiscalYearStartChange={setFiscalYearStart}
        onCloseDuesRenewal={() => setIsDuesRenewalModalOpen(false)}
        onRenewalYearChange={setRenewalYear}
        onRenewingChange={setIsRenewing}
        onCloseImport={() => setIsImportModalOpen(false)}
        onCloseSplit={() => {
          setIsSplitModalOpen(false);
          setSelectedTransaction(null);
        }}
        onCloseBatchCategory={() => setIsBatchCategoryModalOpen(false)}
        onCloseAddAccount={() => setIsAddAccountModalOpen(false)}
        onCloseBankMatching={() => setMatchingAccount(null)}
        onImported={loadData}
        onSplitSuccess={() => {
          showToast('Transaction split created successfully', 'success');
          loadData();
        }}
        onBatchCategorySuccess={() => {
          showToast('Batch category update applied successfully', 'success');
          setSelectedTxIds(new Set());
          setSelectedSplitIds(new Set());
          loadData();
        }}
        onBankMatchingComplete={() => {
          setMatchingAccount(null);
          loadData();
        }}
        showToast={showToast}
        loadData={loadData}
      />

      <FinanceBottomOverlays
        canOperateFinance={canOperateFinance}
        activeTab={moduleTab}
        hasDisplayTransactions={displayTransactions.length > 0}
        selectedTransactionCount={selectedTxIds.size}
        selectedSplitCount={selectedSplitIds.size}
        batchOperationProgress={batchOperationProgress}
        isAccountDetailOpen={isAccountDetailOpen}
        detailAccount={detailAccount}
        detailYear={detailYear}
        availableYears={availableYears}
        monthlyAccountSummary={monthlyAccountSummary}
        isAddAdministrativeProjectOpen={isAddAdministrativeProjectOpen}
        deleteProjectTransactionId={deleteProjectTxConfirm}
        showBatchDeleteConfirm={showBatchDeleteConfirm}
        onCloseAccountDetail={() => setIsAccountDetailOpen(false)}
        onAccountDetailYearChange={(year) => {
          setDetailYear(year);
          setReportYear(year);
          setProjectAccountYearFilter(year);
        }}
        onOpenBatchCategory={() => setIsBatchCategoryModalOpen(true)}
        onOpenBatchDeleteConfirm={() => setShowBatchDeleteConfirm(true)}
        onClearSelection={() => {
          setSelectedTxIds(new Set());
          setSelectedSplitIds(new Set());
        }}
        onDeleteProjectTransaction={handleDeleteProjectTrx}
        onProjectDeleteConfirmChange={setDeleteProjectTxConfirm}
        onBatchDeleteConfirmChange={setShowBatchDeleteConfirm}
        onBatchDelete={handleBatchDelete}
        onCloseAddAdministrativeProject={() => setIsAddAdministrativeProjectOpen(false)}
        onAdministrativeProjectIdsChange={setAdministrativeProjectIds}
        showToast={showToast}
      />
    </div>
  );
});
FinanceView.displayName = 'FinanceView';
