import React, { useState } from 'react';
import { Button, Modal, useToast } from '../../ui/Common';
import { Input, Select } from '../../ui/Form';
import { FinanceService } from '../../../services/financeService';

// Add Bank Account Modal
export interface AddBankAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded: () => Promise<void>;
}

export const AddBankAccountModal: React.FC<AddBankAccountModalProps> = ({ isOpen, onClose, onAdded }) => {
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      setLoading(true);
      await FinanceService.createBankAccount({
        bankName: formData.get('bankName') as string,
        name: formData.get('name') as string,
        accountType: formData.get('type') as 'Current' | 'Savings' | 'Investment' | 'Fixed Deposit' | 'Cash' | 'Other',
        accountNumber: formData.get('accountNumber') as string,
        balance: 0, // This will be dynamically calculated now
        initialBalance: parseFloat(formData.get('initialBalance') as string) || 0,
        currency: formData.get('currency') as string,
        lastReconciled: new Date().toISOString(),
      });

      showToast('Bank account added successfully', 'success');
      await onAdded();
      onClose();
    } catch (error) {
      showToast('Failed to add bank account', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Bank Account"
      size="lg"
      bottomSheet
      drawerOnMobile
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="ghost" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" form="add-bank-account-form" disabled={loading} className="flex-1 sm:flex-none">
            {loading ? 'Adding...' : 'Add Account'}
          </Button>
        </div>
      }
    >
      <form id="add-bank-account-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input name="bankName" label="Bank" placeholder="e.g. Maybank, CIMB" required />
          <Input name="name" label="Account Name" placeholder="e.g. Main Operating Account" required />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            name="type"
            label="Account Type"
            defaultValue="Current"
            options={[
              { label: 'Current', value: 'Current' },
              { label: 'Savings', value: 'Savings' },
              { label: 'Investment', value: 'Investment' },
              { label: 'Fixed Deposit', value: 'Fixed Deposit' },
              { label: 'Cash', value: 'Cash' },
              { label: 'Other', value: 'Other' },
            ]}
            required
          />
          <Input
            name="accountNumber"
            label="Account Number"
            placeholder="e.g. 1234567890"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            onChange={(e: any) => {
              e.target.value = e.target.value.replace(/[^0-9]/g, '');
            }}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input name="initialBalance" label="Initial Balance (Starting Balance)" type="number" step="0.01" min={0} placeholder="0.00" required />
          <Select
            name="currency"
            label="Currency"
            defaultValue="MYR"
            options={[
              { label: 'MYR', value: 'MYR' },
              { label: 'USD', value: 'USD' },
              { label: 'SGD', value: 'SGD' },
            ]}
            required
          />
        </div>
      </form>
    </Modal>
  );
};
