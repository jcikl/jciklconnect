import { describe, it, expect } from 'vitest';
import { getLinkedBankTxInfo } from './financeUtils';
import type { Transaction, BankAccount, TransactionSplit } from '../types';

const makeTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'tx1',
  date: '2025-01-15',
  description: 'Test transaction',
  amount: 100,
  type: 'Income',
  category: 'Other',
  bankAccountId: 'ba1',
  createdAt: '',
  updatedAt: '',
  ...overrides,
} as unknown as Transaction);

const makeAccount = (id = 'ba1', name = 'Main Account'): BankAccount => ({
  id,
  name,
} as unknown as BankAccount);

describe('getLinkedBankTxInfo', () => {
  it('returns null when no matching transaction exists', () => {
    const result = getLinkedBankTxInfo('proj-tx-999', [], [], {});
    expect(result).toBeNull();
  });

  it('finds a direct match via projectTransactionId', () => {
    const tx = makeTransaction({ projectTransactionId: 'proj-tx-1' });
    const result = getLinkedBankTxInfo('proj-tx-1', [tx], [makeAccount()], {});
    expect(result).not.toBeNull();
    expect(result?.amount).toBe(100);
    expect(result?.isSplit).toBe(false);
    expect(result?.bankAccountName).toBe('Main Account');
  });

  it('finds a match via projectTransactionIds array', () => {
    const tx = makeTransaction({ projectTransactionIds: ['proj-tx-2', 'proj-tx-3'] });
    const result = getLinkedBankTxInfo('proj-tx-2', [tx], [makeAccount()], {});
    expect(result).not.toBeNull();
    expect(result?.description).toBe('Test transaction');
  });

  it('falls back to "Bank" when account is not found', () => {
    const tx = makeTransaction({ projectTransactionId: 'proj-tx-1', bankAccountId: 'unknown' });
    const result = getLinkedBankTxInfo('proj-tx-1', [tx], [], {});
    expect(result?.bankAccountName).toBe('Bank');
  });

  it('finds a split match via projectTransactionId', () => {
    const parentTx = makeTransaction({ id: 'parent1' });
    const split: TransactionSplit = {
      id: 'split1',
      projectTransactionId: 'proj-split-1',
      amount: 50,
      description: 'Split payment',
    } as unknown as TransactionSplit;
    const splits: Record<string, TransactionSplit[]> = { parent1: [split] };
    const result = getLinkedBankTxInfo('proj-split-1', [parentTx], [makeAccount()], splits);
    expect(result).not.toBeNull();
    expect(result?.isSplit).toBe(true);
    expect(result?.amount).toBe(50);
    expect(result?.description).toBe('Split payment');
  });

  it('finds a split match via projectTransactionIds array', () => {
    const parentTx = makeTransaction({ id: 'parent2' });
    const split: TransactionSplit = {
      id: 'split2',
      projectTransactionIds: ['proj-split-arr'],
      amount: 75,
    } as unknown as TransactionSplit;
    const splits: Record<string, TransactionSplit[]> = { parent2: [split] };
    const result = getLinkedBankTxInfo('proj-split-arr', [parentTx], [makeAccount()], splits);
    expect(result).not.toBeNull();
    expect(result?.isSplit).toBe(true);
    expect(result?.amount).toBe(75);
  });

  it('reports correct type from parent transaction for split', () => {
    const parentTx = makeTransaction({ id: 'parent3', type: 'Expense' });
    const split: TransactionSplit = {
      id: 'split3',
      projectTransactionId: 'proj-split-exp',
      amount: 30,
    } as unknown as TransactionSplit;
    const splits: Record<string, TransactionSplit[]> = { parent3: [split] };
    const result = getLinkedBankTxInfo('proj-split-exp', [parentTx], [makeAccount()], splits);
    expect(result?.type).toBe('Expense');
  });
});
