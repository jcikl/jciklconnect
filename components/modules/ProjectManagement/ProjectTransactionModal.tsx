import React, { useState, useEffect } from 'react';
import { Modal, Button, useToast } from '../../ui/Common';
import { Input, Select, Textarea } from '../../ui/Form';
import { FinanceService } from '../../../services/financeService';
import { BankAccount, Transaction } from '../../../types';

interface ProjectTransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    projectName: string;
    onTransactionAdded: () => void;
    editingTransaction?: Transaction | null;
    defaultType?: 'Income' | 'Expense';
    defaultPurpose?: string;
}

export const ProjectTransactionModal: React.FC<ProjectTransactionModalProps> = ({
    isOpen,
    onClose,
    projectId,
    projectName,
    onTransactionAdded,
    editingTransaction,
    defaultType,
    defaultPurpose,
}) => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

    useEffect(() => {
        if (isOpen) {
            loadBankAccounts();
        }
    }, [isOpen]);

    const loadBankAccounts = async () => {
        try {
            const accounts = await FinanceService.getAllBankAccounts();
            setBankAccounts(accounts);
        } catch (err) {
            console.error('Failed to load bank accounts', err);
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);

        try {
            if (editingTransaction) {
                await FinanceService.updateProjectTransaction(editingTransaction.id, {
                    date: formData.get('date') as string,
                    description: formData.get('description') as string,
                    purpose: (formData.get('purpose') as string)?.trim() || undefined,
                    amount: parseFloat(formData.get('amount') as string),
                    type: formData.get('type') as 'Income' | 'Expense',
                    bankAccountId: formData.get('bankAccountId') as string || undefined,
                    referenceNumber: (formData.get('referenceNumber') as string)?.trim() || undefined,
                });
                showToast('Transaction updated successfully', 'success');
            } else {
                await FinanceService.createProjectTransaction({
                    date: formData.get('date') as string,
                    description: formData.get('description') as string,
                    purpose: (formData.get('purpose') as string)?.trim() || undefined,
                    amount: parseFloat(formData.get('amount') as string),
                    type: formData.get('type') as 'Income' | 'Expense',
                    category: 'Projects & Activities',
                    status: 'Pending',
                    projectId: projectId,
                    bankAccountId: formData.get('bankAccountId') as string || undefined,
                    referenceNumber: (formData.get('referenceNumber') as string)?.trim() || undefined,
                });
                showToast('Transaction recorded successfully', 'success');
            }
            onTransactionAdded();
            onClose();
        } catch (err) {
            console.error(err);
            showToast('Failed to record transaction', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={editingTransaction ? `Edit Transaction: ${projectName}` : `Add Transaction: ${projectName}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <Select
                        name="type"
                        label="Type"
                        options={[
                            { label: 'Expense', value: 'Expense' },
                            { label: 'Income', value: 'Income' },
                        ]}
                        defaultValue={editingTransaction?.type || defaultType || 'Expense'}
                        required
                    />
                    <Input
                        name="amount"
                        label="Amount"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        defaultValue={editingTransaction?.amount}
                        required
                    />
                </div>

                <Input
                    name="date"
                    label="Date"
                    type="date"
                    defaultValue={editingTransaction?.date ? new Date(editingTransaction.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                    required
                />

                <Input
                    name="description"
                    label="Description / Remark"
                    placeholder="e.g. Venue deposit, Sponsorship payment"
                    defaultValue={editingTransaction?.description}
                    required
                />

                <Input
                    name="purpose"
                    label="Purpose (Use Case)"
                    placeholder="e.g. For project kickoff meeting, For marketing materials"
                    defaultValue={editingTransaction?.purpose || defaultPurpose}
                />

                <div className="grid grid-cols-2 gap-4">
                    <Select
                        name="bankAccountId"
                        label="Paid Via / To (Bank Account)"
                        options={[
                            { label: 'None / Cash / Pending', value: '' },
                            ...bankAccounts.map(acc => ({ label: `${acc.name} (${acc.currency})`, value: acc.id }))
                        ]}
                        defaultValue={editingTransaction?.bankAccountId || ''}
                    />
                    <Input
                        name="referenceNumber"
                        label="Ref No. (Optional)"
                        placeholder="e.g. Inv-001, Cheque #123"
                        defaultValue={editingTransaction?.referenceNumber}
                    />
                </div>

                <div className="pt-4 flex justify-end gap-2">
                    <Button variant="ghost" type="button" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                        {loading ? 'Saving...' : editingTransaction ? 'Update Transaction' : 'Add Transaction'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
