import React from 'react';
import { Edit, RefreshCw, Trash2 } from 'lucide-react';
import type { Project, Transaction } from '../../../types';
import { formatDate } from '../../../utils/dateUtils';
import { formatCurrency } from '../../../utils/formatUtils';
import { Badge, Button, Modal } from '../../ui/Common';
import { Input, Select } from '../../ui/Form';

interface LinkedBankTxInfo {
  isSplit: boolean;
  date: string;
  description: string;
  bankAccountName: string;
  amount: number;
}

interface FinanceProjectTrackerTransactionsModalProps {
  isOpen: boolean;
  project: Project;
  projectTransactions: Transaction[];
  loading: boolean;
  addForm: Partial<Transaction>;
  editForm: Partial<Transaction>;
  editingId: string | null;
  onClose: () => void;
  onPaste: (text: string) => void;
  onAddFormChange: (form: Partial<Transaction>) => void;
  onEditFormChange: (form: Partial<Transaction>) => void;
  onAddTransaction: () => void;
  onUpdateTransaction: (transactionId: string) => void;
  onEditTransaction: (transaction: Transaction) => void;
  onCancelEdit: () => void;
  onDeleteTransaction: (transactionId: string) => void;
  getLinkedBankTxInfo: (transactionId: string) => LinkedBankTxInfo | null;
}

export const FinanceProjectTrackerTransactionsModal: React.FC<FinanceProjectTrackerTransactionsModalProps> = ({
  isOpen,
  project,
  projectTransactions,
  loading,
  addForm,
  editForm,
  editingId,
  onClose,
  onPaste,
  onAddFormChange,
  onEditFormChange,
  onAddTransaction,
  onUpdateTransaction,
  onEditTransaction,
  onCancelEdit,
  onDeleteTransaction,
  getLinkedBankTxInfo,
}) => {
  const totalIncome = projectTransactions.filter(transaction => transaction.type === 'Income').reduce((sum, transaction) => sum + (transaction.amount || 0), 0);
  const totalExpense = projectTransactions.filter(transaction => transaction.type === 'Expense').reduce((sum, transaction) => sum + (transaction.amount || 0), 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Configure Project Tracker Transactions - ${project.name || project.title}`}
      size="4xl"
      bottomSheet={false}
      drawerOnMobile={false}
      footer={
        <div className="flex justify-end w-full">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
        <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Project Budget</span>
            <p className="text-sm font-bold text-slate-800">
              {formatCurrency(project.budget || project.proposedBudget || 0)}
            </p>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">PT Total Income</span>
            <p className="text-sm font-bold text-green-600">
              {formatCurrency(totalIncome)}
            </p>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">PT Total Expense</span>
            <p className="text-sm font-bold text-red-600">
              {formatCurrency(totalExpense)}
            </p>
          </div>
        </div>

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
            onPaste={(event) => {
              const pastedText = event.clipboardData.getData('Text');
              if (pastedText) {
                event.preventDefault();
                onPaste(pastedText);
              }
            }}
            onChange={(event) => {
              if (event.target.value) {
                onPaste(event.target.value);
                event.target.value = '';
              }
            }}
          />
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Add Single Transaction</h4>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Date</label>
              <Input
                type="date"
                value={addForm.date || ''}
                onChange={(event) => onAddFormChange({ ...addForm, date: event.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-500 mb-1">Description</label>
              <Input
                type="text"
                placeholder="Transaction description"
                value={addForm.description || ''}
                onChange={(event) => onAddFormChange({ ...addForm, description: event.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Amount</label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={addForm.amount || ''}
                onChange={(event) => onAddFormChange({ ...addForm, amount: parseFloat(event.target.value) || undefined })}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Type</label>
              <Select
                value={addForm.type || 'Expense'}
                onChange={(event) => onAddFormChange({ ...addForm, type: event.target.value as 'Income' | 'Expense' })}
                options={[
                  { label: 'Expense', value: 'Expense' },
                  { label: 'Income', value: 'Income' },
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
                value={addForm.referenceNumber || ''}
                onChange={(event) => onAddFormChange({ ...addForm, referenceNumber: event.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Purpose / Section</label>
              <Input
                type="text"
                placeholder="e.g. F&B, Logistics"
                value={addForm.purpose || ''}
                onChange={(event) => onAddFormChange({ ...addForm, purpose: event.target.value })}
              />
            </div>
            <div className="md:col-span-2 flex gap-2">
              <Button
                type="button"
                onClick={onAddTransaction}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2"
              >
                Add
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onAddFormChange({})}
                className="py-2"
              >
                Clear
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Transaction List ({projectTransactions.length} items)
            </h4>
          </div>
          {loading ? (
            <div className="p-8 flex justify-center">
              <RefreshCw className="animate-spin text-jci-blue" size={24} />
            </div>
          ) : projectTransactions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              No project tracker transactions found. Copy and paste or use the form above to add some.
            </div>
          ) : (
            <div className="overflow-x-auto font-sans">
              <table
                className="w-full text-left text-xs"
                onPaste={(event) => {
                  const pastedText = event.clipboardData.getData('Text');
                  if (pastedText && pastedText.includes('\t')) {
                    event.preventDefault();
                    onPaste(pastedText);
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
                  {projectTransactions.map((transaction) => {
                    const isEditing = editingId === transaction.id;
                    return (
                      <tr key={transaction.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-mono">
                          {isEditing ? (
                            <Input
                              type="date"
                              className="py-1 px-2 text-xs"
                              value={editForm.date || ''}
                              onChange={(event) => onEditFormChange({ ...editForm, date: event.target.value })}
                            />
                          ) : (
                            formatDate(transaction.date)
                          )}
                        </td>
                        <td className="p-3">
                          {isEditing ? (
                            <Select
                              className="py-1 px-2 text-xs"
                              value={editForm.type || 'Expense'}
                              onChange={(event) => onEditFormChange({ ...editForm, type: event.target.value as 'Income' | 'Expense' })}
                              options={[
                                { label: 'Expense', value: 'Expense' },
                                { label: 'Income', value: 'Income' },
                              ]}
                            />
                          ) : (
                            <Badge variant={transaction.type === 'Income' ? 'success' : 'error'}>
                              {transaction.type}
                            </Badge>
                          )}
                        </td>
                        <td className="p-3 font-medium">
                          {isEditing ? (
                            <Input
                              type="text"
                              className="py-1 px-2 text-xs"
                              value={editForm.description || ''}
                              onChange={(event) => onEditFormChange({ ...editForm, description: event.target.value })}
                            />
                          ) : (
                            transaction.description
                          )}
                        </td>
                        <td className="p-3 text-slate-500">
                          {isEditing ? (
                            <Input
                              type="text"
                              className="py-1 px-2 text-xs"
                              value={editForm.referenceNumber || ''}
                              onChange={(event) => onEditFormChange({ ...editForm, referenceNumber: event.target.value })}
                            />
                          ) : (
                            transaction.referenceNumber || '\u2014'
                          )}
                        </td>
                        <td className="p-3 text-slate-500">
                          {isEditing ? (
                            <Input
                              type="text"
                              className="py-1 px-2 text-xs"
                              value={editForm.purpose || ''}
                              onChange={(event) => onEditFormChange({ ...editForm, purpose: event.target.value })}
                            />
                          ) : (
                            transaction.purpose || '\u2014'
                          )}
                        </td>
                        <td className="p-3">
                          {(() => {
                            const bankInfo = getLinkedBankTxInfo(transaction.id);
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
                              min="0.01"
                              className="py-1 px-2 text-xs text-right"
                              value={editForm.amount || ''}
                              onChange={(event) => onEditFormChange({ ...editForm, amount: parseFloat(event.target.value) || undefined })}
                            />
                          ) : (
                            <span className={transaction.type === 'Income' ? 'text-green-600' : 'text-slate-700'}>
                              {formatCurrency(transaction.amount)}
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
                                  onClick={() => onUpdateTransaction(transaction.id)}
                                  className="py-1 px-2 text-[10px]"
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={onCancelEdit}
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
                                  onClick={() => onEditTransaction(transaction)}
                                >
                                  <Edit size={14} className="text-slate-500" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="p-1"
                                  onClick={() => onDeleteTransaction(transaction.id)}
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
  );
};
