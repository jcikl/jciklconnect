import React from 'react';
import { BatchImportModal } from '../../shared/batchImport/BatchImportModal';
import { bankTransactionImportConfig } from './config/bankTransactionImportConfig';
import { FinanceService } from '../../../services/financeService';
import { Project, BankAccount, Transaction } from '../../../types';
import { Select } from '../../ui/Form';
import { ProjectsService } from '../../../services/projectsService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

/**
 * Bank Transaction Import Modal
 * Lightweight wrapper around the generic BatchImportModal
 */

export const BankTransactionImportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onImported,
}) => {
  const [bankAccounts, setBankAccounts] = React.useState<BankAccount[]>([]);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = React.useState<string>('');
  const [existingTransactions, setExistingTransactions] = React.useState<Transaction[]>([]);

  React.useEffect(() => {
    if (isOpen) {
      // Reset account selection each time modal opens (情景 2)
      setSelectedBankAccountId('');
      Promise.all([
        FinanceService.getAllBankAccounts(),
        ProjectsService.getAllProjects()
      ]).then(([accounts, projects]) => {
        setBankAccounts(accounts);
        setProjects(projects);
      });
    }
  }, [isOpen]);

  // Load existing transactions for selected bank account (情景 A — duplicate detection)
  React.useEffect(() => {
    if (!selectedBankAccountId) { setExistingTransactions([]); return; }
    FinanceService.getAllTransactions()
      .then(all => setExistingTransactions(all.filter(t => t.bankAccountId === selectedBankAccountId && !t.isSplitChild)))
      .catch(() => setExistingTransactions([]));
  }, [selectedBankAccountId]);

  return (
    <BatchImportModal
      isOpen={isOpen}
      onClose={onClose}
      config={bankTransactionImportConfig}
      onImported={onImported}
      context={{
        bankAccountId: selectedBankAccountId,
        projects: projects,
        existingTransactions: existingTransactions,
      }}
    >
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-2">
        <Select
          label="Target Bank Account"
          value={selectedBankAccountId}
          onChange={(e) => setSelectedBankAccountId(e.target.value)}
          options={[
            { value: '', label: '— Select a bank account —' },
            ...bankAccounts.map(acc => ({
              value: acc.id,
              label: `${acc.name} (${acc.accountNumber || 'No Acc#'}) - [${acc.balance}]`
            }))
          ]}
          className="w-full"
        />
      </div>
    </BatchImportModal>
  );
};

export default BankTransactionImportModal;
