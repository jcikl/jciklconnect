import React, { lazy, Suspense } from 'react';
import type { BankAccount, InventoryItem, Member, Project, Transaction } from '../../../types';
import { Button, Modal } from '../../ui/Common';

const TransactionForm = lazy(() => import('./TransactionForm'));

interface FinanceTransactionFormModalsProps {
  canOperateFinance: boolean;
  isCreateOpen: boolean;
  isEditOpen: boolean;
  isAddingTransaction: boolean;
  isUpdatingTransaction: boolean;
  accounts: BankAccount[];
  projects: Project[];
  members: Member[];
  inventoryItems: InventoryItem[];
  administrativeProjectIds: string[];
  adminPurposes: string[];
  projectYears: number[];
  groupedProjectsForModal: Record<string, Project[]>;
  filteredProjectsForModal: Project[];
  editingProjectPurposesByProject: Record<string, string[]>;
  recordFormCategory: string;
  recordFormMemberId: string;
  recordFormYear: number;
  recordFormProjectId: string;
  editingModalYear: number;
  editingTransaction: Transaction | null;
  editingMembershipYear: number;
  editingAdministrativeYear: number;
  editingAdministrativePurposeBase: string;
  onCloseCreate: () => void;
  onCloseEdit: () => void;
  onCreateSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onEditSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  setRecordFormCategory: (value: string) => void;
  setRecordFormMemberId: (value: string) => void;
  setRecordFormYear: (value: number) => void;
  setRecordFormProjectId: (value: string) => void;
  setEditingModalYear: (value: number) => void;
  setEditingTransaction: (transaction: Transaction | null) => void;
  setEditingMembershipYear: (value: number) => void;
  setEditingAdministrativeYear: (value: number) => void;
  setEditingAdministrativePurposeBase: (value: string) => void;
}

const formProjectOptions = (projects: Project[]) => projects.map(project => ({ id: project.id, name: project.name || project.id }));

export const FinanceTransactionFormModals: React.FC<FinanceTransactionFormModalsProps> = ({
  canOperateFinance,
  isCreateOpen,
  isEditOpen,
  isAddingTransaction,
  isUpdatingTransaction,
  accounts,
  projects,
  members,
  inventoryItems,
  administrativeProjectIds,
  adminPurposes,
  projectYears,
  groupedProjectsForModal,
  filteredProjectsForModal,
  editingProjectPurposesByProject,
  recordFormCategory,
  recordFormMemberId,
  recordFormYear,
  recordFormProjectId,
  editingModalYear,
  editingTransaction,
  editingMembershipYear,
  editingAdministrativeYear,
  editingAdministrativePurposeBase,
  onCloseCreate,
  onCloseEdit,
  onCreateSubmit,
  onEditSubmit,
  setRecordFormCategory,
  setRecordFormMemberId,
  setRecordFormYear,
  setRecordFormProjectId,
  setEditingModalYear,
  setEditingTransaction,
  setEditingMembershipYear,
  setEditingAdministrativeYear,
  setEditingAdministrativePurposeBase,
}) => (
  <>
    <Modal
      isOpen={canOperateFinance && isCreateOpen}
      onClose={onCloseCreate}
      title="Record Transaction"
      size="2xl"
      bottomSheet
      drawerOnMobile
      footer={
        <div className="flex gap-2 w-full">
          <Button variant="ghost" onClick={onCloseCreate}>Cancel</Button>
          <Button className="flex-1" type="submit" form="record-transaction-form" disabled={isAddingTransaction}>Save Transaction</Button>
        </div>
      }
    >
      <form id="record-transaction-form" onSubmit={onCreateSubmit} className="space-y-6">
        <Suspense fallback={<div className="py-8 text-center text-slate-400 text-sm">Loading...</div>}>
          <TransactionForm
            mode="create"
            accounts={accounts}
            projects={formProjectOptions(projects)}
            members={members}
            administrativeProjectIds={administrativeProjectIds}
            adminPurposes={adminPurposes}
            projectYears={projectYears}
            groupedProjectsForModal={groupedProjectsForModal}
            filteredProjectsForModal={formProjectOptions(filteredProjectsForModal)}
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

    {editingTransaction && (
      <Modal
        isOpen={canOperateFinance && isEditOpen}
        onClose={onCloseEdit}
        title="Edit Transaction"
        size="2xl"
        bottomSheet
        drawerOnMobile
        footer={
          <div className="flex gap-2 w-full">
            <Button variant="ghost" onClick={onCloseEdit}>Cancel</Button>
            <Button
              className="flex-1 shadow-sm"
              type="submit"
              form="edit-transaction-form"
              disabled={editingTransaction.status === 'Reconciled' || editingTransaction.status === 'Partially Reconciled' || isUpdatingTransaction}
            >
              Update Transaction
            </Button>
          </div>
        }
      >
        {(editingTransaction.status === 'Reconciled' || editingTransaction.status === 'Partially Reconciled') && (
          <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm flex items-center gap-2">
            <span className="font-semibold">{'\uD83D\uDD12 Locked:'}</span>
            This transaction is <strong>{editingTransaction.status}</strong> and cannot be edited. Delink it from all project transactions to unlock.
          </div>
        )}
        <form id="edit-transaction-form" onSubmit={onEditSubmit} className="space-y-6">
          <Suspense fallback={<div className="py-8 text-center text-slate-400 text-sm">Loading...</div>}>
            <TransactionForm
              mode="edit"
              accounts={accounts}
              projects={formProjectOptions(projects)}
              members={members}
              administrativeProjectIds={administrativeProjectIds}
              adminPurposes={adminPurposes}
              projectYears={projectYears}
              groupedProjectsForModal={groupedProjectsForModal}
              filteredProjectsForModal={formProjectOptions(filteredProjectsForModal)}
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
  </>
);
