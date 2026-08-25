import { useEffect, useState } from 'react';
import { FinanceService } from '../../../services/financeService';
import type { Transaction } from '../../../types';
import type { InventoryTabId } from './inventoryViewConfig';

export const useInventoryTransactions = (activeTab: InventoryTabId) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setTransactions(await FinanceService.getAllTransactions());
      } catch (err) {
        console.error('Failed to load transactions for history', err);
      }
    };

    fetchTransactions();
  }, [activeTab]);

  return transactions;
};
