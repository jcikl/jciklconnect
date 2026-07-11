import { Transaction, BankAccount, ProjectFinancialAccount, TransactionSplit } from '../types';
import type { Project } from '../types';

export const getLinkedBankTxInfo = (
  projectTxId: string,
  transactions: Transaction[],
  accounts: BankAccount[],
  transactionSplits: Record<string, TransactionSplit[]>
) => {
  // 1. Search in main transactions
  const directTx = transactions.find(bt =>
    (bt.projectTransactionIds && bt.projectTransactionIds.includes(projectTxId)) ||
    bt.projectTransactionId === projectTxId
  );
  if (directTx) {
    const bankAccountName = accounts.find(a => a.id === directTx.bankAccountId)?.name || 'Bank';
    return {
      date: directTx.date,
      description: directTx.description,
      amount: directTx.amount,
      type: directTx.type,
      bankAccountName,
      isSplit: false
    };
  }

  // 2. Search in splits
  let matchedSplit: TransactionSplit | undefined;
  let parentTxId: string | undefined;
  for (const [pId, splits] of Object.entries(transactionSplits)) {
    const found = splits.find(s =>
      (s.projectTransactionIds && s.projectTransactionIds.includes(projectTxId)) ||
      s.projectTransactionId === projectTxId
    );
    if (found) {
      matchedSplit = found;
      parentTxId = pId;
      break;
    }
  }

  if (matchedSplit && parentTxId) {
    const parentTx = transactions.find(t => t.id === parentTxId);
    const bankAccountName = accounts.find(a => a.id === parentTx?.bankAccountId)?.name || 'Bank';
    return {
      date: parentTx?.date || '',
      description: matchedSplit.description || parentTx?.description || '',
      amount: matchedSplit.amount,
      type: parentTx?.type || 'Expense',
      bankAccountName,
      isSplit: true
    };
  }

  return null;
};


export const isTransactionInCategory = (
  tx: Transaction,
  category: string,
  transactionSplits: Record<string, TransactionSplit[]>
): boolean => {
  if (tx.category === category) return true;
  if (tx.isSplit && transactionSplits[tx.id]) {
    return transactionSplits[tx.id].some(split => split.category === category);
  }
  return false;
};

export const getTransactionAccountLabel = (
  item: Partial<Transaction | TransactionSplit>,
  parent: Partial<Transaction> | undefined,
  accounts: BankAccount[],
  projectAccounts: ProjectFinancialAccount[],
  projects: Project[],
  members: Array<{ id: string; name: string }>,
  UNASSIGNED_PROJECT_ID: string
) => {
  const category = item.category || parent?.category || '';
  const projectId = item.projectId || parent?.projectId || '';
  const memberId = item.memberId || parent?.memberId || '';
  const bankAccountId = ('bankAccountId' in item ? item.bankAccountId : undefined) || parent?.bankAccountId || '';
  const bankAccountName = accounts.find(a => a.id === bankAccountId)?.name;

  if (category === 'Projects & Activities') {
    if (projectId === UNASSIGNED_PROJECT_ID) return 'Unassigned';

    return projectAccounts.find(a => a.projectId === projectId || a.id === projectId)?.projectName
      || projects.find(p => p.id === projectId)?.name
      || projects.find(p => p.id === projectId)?.title
      || projectId
      || bankAccountName
      || '—';
  }

  if (category === 'Administrative') {
    return projectId || bankAccountName || '—';
  }

  if (category === 'Membership') {
    return members.find(m => m.id === memberId)?.name || bankAccountName || '—';
  }

  return bankAccountName || projectId || memberId || '—';
};
