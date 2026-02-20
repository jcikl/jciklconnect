// Finance Service - CRUD Operations
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { Transaction, BankAccount, ReconciliationRecord, ReconciliationDiscrepancy, TransactionSplit, TransactionType } from '../types';
import { isDevMode } from '../utils/devMode';
import { MOCK_TRANSACTIONS, MOCK_ACCOUNTS } from './mockData';
import { formatCurrency } from '../utils/formatUtils';
import { removeUndefined } from '../utils/dataUtils';

export class FinanceService {
  // Get all transactions
  static async getAllTransactions(): Promise<Transaction[]> {
    if (isDevMode()) {
      return MOCK_TRANSACTIONS;
    }

    try {
      const snapshot = await getDocs(
        query(collection(db, COLLECTIONS.TRANSACTIONS), orderBy('date', 'desc'))
      );
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate?.()?.toISOString() || doc.data().date,
      } as Transaction));
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }

  // Get project transactions
  static async getProjectTransactions(projectId: string): Promise<Transaction[]> {
    if (isDevMode()) {
      return MOCK_TRANSACTIONS.filter(t => t.projectId === projectId);
    }

    try {
      // First try to fetch from projectTrx collection
      const projectTrxQuery = query(
        collection(db, COLLECTIONS.PROJECT_TRANSACTIONS),
        where('projectId', '==', projectId),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(projectTrxQuery);

      const projectTransactions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate?.()?.toISOString() || doc.data().date,
      } as Transaction));



      return projectTransactions;
    } catch (error) {
      console.error('Error fetching project transactions:', error);
      throw error;
    }
  }

  // Get bank transactions associated with a project (from transactions collection)
  static async getBankTransactionsByProject(projectId: string): Promise<Transaction[]> {
    if (isDevMode()) {
      return MOCK_TRANSACTIONS.filter(t => t.projectId === projectId);
    }

    try {
      const q = query(
        collection(db, COLLECTIONS.TRANSACTIONS),
        where('projectId', '==', projectId),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate?.()?.toISOString() || doc.data().date,
      } as Transaction));
    } catch (error) {
      console.error('Error fetching bank transactions for project:', error);
      throw error;
    }
  }

  // Create transaction
  static async createTransaction(transactionData: Omit<Transaction, 'id'>): Promise<string> {
    if (isDevMode()) {
      console.log('[Dev Mode] Mocking transaction creation');
      return `mock-tx-${Date.now()}`;
    }

    try {
      const newTransaction = {
        ...transactionData,
        date: Timestamp.fromDate(new Date(transactionData.date)),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const cleanTransaction = removeUndefined(newTransaction);
      const docRef = await addDoc(collection(db, COLLECTIONS.TRANSACTIONS), cleanTransaction);

      // Sync with inventory if linked
      await this.syncTransactionWithInventory({ ...transactionData, id: docRef.id });

      return docRef.id;
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw error;
    }
  }

  // Create project transaction
  static async createProjectTransaction(transactionData: Omit<Transaction, 'id'>): Promise<string> {
    if (isDevMode()) {
      console.log('[Dev Mode] Mocking project transaction creation');
      return `mock-prj-tx-${Date.now()}`;
    }

    try {
      const newTransaction = {
        ...transactionData,
        date: Timestamp.fromDate(new Date(transactionData.date)),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const cleanTransaction = removeUndefined(newTransaction);
      const docRef = await addDoc(collection(db, COLLECTIONS.PROJECT_TRANSACTIONS), cleanTransaction);

      // Sync with inventory if linked
      await this.syncTransactionWithInventory({ ...transactionData, id: docRef.id });

      return docRef.id;
    } catch (error) {
      console.error('Error creating project transaction:', error);
      throw error;
    }
  }

  // Update project transaction
  static async updateProjectTransaction(transactionId: string, updates: Partial<Transaction>): Promise<void> {
    if (isDevMode()) {
      console.log('[Dev Mode] Mocking project transaction update');
      return;
    }

    try {
      const transactionRef = doc(db, COLLECTIONS.PROJECT_TRANSACTIONS, transactionId);

      const updateData: any = {
        ...removeUndefined(updates),
        updatedAt: Timestamp.now(),
      };

      if (updates.date) {
        updateData.date = Timestamp.fromDate(new Date(updates.date));
      }

      await updateDoc(transactionRef, updateData);
    } catch (error) {
      console.error('Error updating project transaction:', error);
      throw error;
    }
  }

  // Create transaction split (upsert: update existing or create new)
  static async createTransactionSplit(
    parentTransactionId: string,
    splits: Array<{ id?: string; category: 'Projects & Activities' | 'Membership' | 'Administrative'; year?: number; projectId?: string; memberId?: string; purpose?: string; paymentRequestId?: string; amount: number; description: string }>,
    createdBy: string
  ): Promise<string[]> {
    if (isDevMode()) {
      console.log(`[Dev Mode] Would create/update ${splits.length} splits for transaction ${parentTransactionId}`);
      return splits.map((_, i) => `mock-split-${i}`);
    }

    try {
      // Get parent transaction
      const parentDoc = await getDoc(doc(db, COLLECTIONS.TRANSACTIONS, parentTransactionId));
      if (!parentDoc.exists()) {
        throw new Error('Parent transaction not found');
      }
      const parentTransaction = { id: parentDoc.id, ...parentDoc.data() } as Transaction;

      // Validate split amounts sum to parent amount
      const totalSplitAmount = splits.reduce((sum, split) => sum + split.amount, 0);
      if (Math.abs(totalSplitAmount - parentTransaction.amount) > 0.01) {
        throw new Error(
          `Split amounts (${totalSplitAmount}) must equal parent transaction amount (${parentTransaction.amount})`
        );
      }

      // Get existing splits to track which ones were removed
      const existingSplits = await this.getTransactionSplits(parentTransactionId);
      const existingSplitIds = new Set(existingSplits.map(s => s.id));
      const newSplitIds = splits.filter(s => s.id).map(s => s.id);

      // Delete splits that were removed
      for (const split of existingSplits) {
        if (!newSplitIds.includes(split.id)) {
          await deleteDoc(doc(db, COLLECTIONS.TRANSACTION_SPLITS, split.id));
        }
      }

      // Upsert split records
      const splitIds: string[] = [];

      for (const split of splits) {
        if (split.id && existingSplitIds.has(split.id)) {
          // Update existing split
          const updateData: any = {
            category: split.category,
            type: parentTransaction.type,
            projectId: split.projectId,
            memberId: split.memberId,
            purpose: split.purpose,
            paymentRequestId: split.paymentRequestId,
            amount: split.amount,
            description: split.description,
          };

          // Only include year if it has a value
          if (split.year) {
            updateData.year = split.year;
          }

          await updateDoc(doc(db, COLLECTIONS.TRANSACTION_SPLITS, split.id), updateData);
          splitIds.push(split.id);
        } else {
          // Create new split
          const splitData: any = {
            parentTransactionId,
            category: split.category,
            type: parentTransaction.type,
            projectId: split.projectId,
            memberId: split.memberId,
            purpose: split.purpose,
            paymentRequestId: split.paymentRequestId,
            amount: split.amount,
            description: split.description,
            createdAt: new Date().toISOString(),
            createdBy,
          };

          // Only include year if it has a value
          if (split.year) {
            splitData.year = split.year;
          }

          const splitDoc = await addDoc(collection(db, COLLECTIONS.TRANSACTION_SPLITS), {
            ...splitData,
            createdAt: Timestamp.now(),
          });

          splitIds.push(splitDoc.id);
        }
      }

      // Update parent transaction with split information and reset category
      await updateDoc(doc(db, COLLECTIONS.TRANSACTIONS, parentTransactionId), {
        isSplit: true,
        splitIds: splitIds,
        // Store original category for potential restoration
        originalCategory: parentTransaction.category,
        // Reset main transaction category when a split is created
        // Use an empty string to indicate no primary category in the parent
        category: '' as any,
        projectId: '',
        purpose: '',
        updatedAt: Timestamp.now(),
      });

      return splitIds;
    } catch (error) {
      console.error('Error creating transaction splits:', error);
      throw error;
    }
  }

  // Get transaction splits
  static async getTransactionSplits(transactionId: string): Promise<TransactionSplit[]> {
    if (isDevMode()) {
      return [];
    }

    try {
      const q = query(
        collection(db, COLLECTIONS.TRANSACTION_SPLITS),
        where('parentTransactionId', '==', transactionId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
      } as TransactionSplit));
    } catch (error) {
      console.error('Error fetching transaction splits:', error);
      throw error;
    }
  }

  // Update transaction split
  static async updateTransactionSplit(
    splitId: string,
    updates: Partial<Omit<TransactionSplit, 'id' | 'parentTransactionId' | 'createdAt' | 'createdBy'>>
  ): Promise<void> {
    if (isDevMode()) {
      console.log(`[Dev Mode] Mocking update for split ${splitId}`);
      return;
    }

    try {
      const splitRef = doc(db, COLLECTIONS.TRANSACTION_SPLITS, splitId);
      await updateDoc(splitRef, {
        ...updates,
        updatedAt: Timestamp.now(),
      });

      // If amount changed, validate total still equals parent
      if (updates.amount !== undefined) {
        const splitDoc = await getDoc(splitRef);
        if (splitDoc.exists()) {
          const split = splitDoc.data() as TransactionSplit;
          const allSplits = await this.getTransactionSplits(split.parentTransactionId);
          const totalSplitAmount = allSplits.reduce((sum, s) => sum + s.amount, 0);

          const parentDoc = await getDoc(doc(db, COLLECTIONS.TRANSACTIONS, split.parentTransactionId));
          if (parentDoc.exists()) {
            const parentAmount = parentDoc.data().amount;
            if (Math.abs(totalSplitAmount - parentAmount) > 0.01) {
              throw new Error(
                `Split amounts (${totalSplitAmount}) must equal parent transaction amount (${parentAmount})`
              );
            }
          }
        }
      }
    } catch (error) {
      console.error('Error updating transaction split:', error);
      throw error;
    }
  }

  // Delete transaction split
  static async deleteTransactionSplit(splitId: string): Promise<void> {
    if (isDevMode()) {
      console.log(`[Dev Mode] Mocking deletion for split ${splitId}`);
      return;
    }

    try {
      const splitDoc = await getDoc(doc(db, COLLECTIONS.TRANSACTION_SPLITS, splitId));
      if (!splitDoc.exists()) {
        throw new Error('Split not found');
      }

      const split = splitDoc.data() as TransactionSplit;
      await deleteDoc(doc(db, COLLECTIONS.TRANSACTION_SPLITS, splitId));

      // Update parent transaction splitIds array
      const remainingSplits = await this.getTransactionSplits(split.parentTransactionId);
      const remainingIds = remainingSplits.map(s => s.id);

      // Get parent transaction to restore category
      const parentDoc = await getDoc(doc(db, COLLECTIONS.TRANSACTIONS, split.parentTransactionId));
      const parentTx = parentDoc.exists() ? parentDoc.data() as Transaction : null;
      const originalCategory = (parentTx as any)?.originalCategory || parentTx?.category || '';

      const updateData: any = {
        splitIds: remainingIds,
        isSplit: remainingIds.length > 0,
        // Restore category if no splits remain
        category: remainingIds.length === 0 ? originalCategory : '',
        updatedAt: Timestamp.now(),
      };

      await updateDoc(doc(db, COLLECTIONS.TRANSACTIONS, split.parentTransactionId), updateData);
    } catch (error) {
      console.error('Error deleting transaction split:', error);
      throw error;
    }
  }

  // Get transactions by type (including splits)
  static async getTransactionsByType(filter: TransactionType | 'Projects & Activities' | 'Membership' | 'Administrative'): Promise<Transaction[]> {
    if (isDevMode()) {
      return MOCK_TRANSACTIONS.filter(t => t.transactionType === filter);
    }

    try {
      // Get transactions with matching primary type
      const q = query(
        collection(db, COLLECTIONS.TRANSACTIONS),
        where('category', '==', filter),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(q);
      const transactions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate?.()?.toISOString() || doc.data().date,
      } as Transaction));

      // Also get transactions that have splits of this type
      const allTransactions = await this.getAllTransactions();
      const splitTxIds = allTransactions.filter(t => t.isSplit && t.splitIds && t.splitIds.length > 0).map(t => t.id);

      const transactionsWithSplits: Transaction[] = [];
      for (const txId of splitTxIds) {
        const splits = await this.getTransactionSplits(txId);
        if (splits.some(split => split.category === filter)) {
          const tx = allTransactions.find(t => t.id === txId);
          if (tx) transactionsWithSplits.push(tx);
        }
      }

      // Combine and deduplicate
      const combined = [...transactions, ...transactionsWithSplits];
      const unique = Array.from(new Map(combined.map(t => [t.id, t])).values());

      return unique.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (error) {
      console.error('Error fetching transactions by type:', error);
      throw error;
    }
  }

  // Update transaction
  static async updateTransaction(transactionId: string, updates: Partial<Transaction>): Promise<void> {
    if (isDevMode()) {
      console.log(`[Dev Mode] Mocking update for transaction ${transactionId}`);
      return;
    }

    try {
      const transactionRef = doc(db, COLLECTIONS.TRANSACTIONS, transactionId);

      // Fetch current transaction to check for changes and merge
      const currentDoc = await getDoc(transactionRef);
      if (!currentDoc.exists()) {
        throw new Error('Transaction not found');
      }
      const currentTransaction = currentDoc.data() as Transaction;

      const updateData: any = {
        ...removeUndefined(updates),
        updatedAt: Timestamp.now(),
      };

      if (updates.date) {
        updateData.date = Timestamp.fromDate(new Date(updates.date));
      }

      await updateDoc(transactionRef, updateData);

      // If transaction type is updated, update all its splits too
      if (updates.type) {
        const splits = await this.getTransactionSplits(transactionId);
        for (const split of splits) {
          await updateDoc(doc(db, COLLECTIONS.TRANSACTION_SPLITS, split.id), {
            type: updates.type,
            updatedAt: Timestamp.now(),
          });
        }
      }

      // Sync with Inventory if needed
      // Logic: If inventory fields changed OR if it seems unsynced (check item)
      const fullTransaction = { ...currentTransaction, ...updates, id: transactionId } as Transaction;
      const { InventoryService } = await import('./inventoryService');

      // Case A: User REMOVED inventory linkage (or cleared fields)
      const hadLinkage = currentTransaction.inventoryLinkId && currentTransaction.inventoryQuantity;
      const hasLinkage = fullTransaction.inventoryLinkId && fullTransaction.inventoryQuantity;

      if (hadLinkage && !hasLinkage) {
        // Linkage removed -> Delete corresponding stock movement
        console.log('Inventory linkage removed, deleting stock movement...');
        await InventoryService.deleteStockMovementForRef(transactionId);
      }
      // Case B: User UPDATED or ADDED inventory linkage
      else if (hasLinkage) {
        let shouldSync = false;

        // 1. Check if fields changed
        if (
          updates.inventoryLinkId !== undefined && updates.inventoryLinkId !== currentTransaction.inventoryLinkId ||
          updates.inventoryVariant !== undefined && updates.inventoryVariant !== currentTransaction.inventoryVariant ||
          updates.inventoryQuantity !== undefined && updates.inventoryQuantity !== currentTransaction.inventoryQuantity ||
          updates.type !== undefined && updates.type !== currentTransaction.type
        ) {
          shouldSync = true;
        }

        // 2. If no change detected but user is saving, check if item is actually linked/synced
        // This handles the "Fix" scenario where data is set but inventory wasn't updated
        if (!shouldSync) {
          try {
            // Check if stock movement exists for this transaction
            const hasMovement = await InventoryService.hasStockMovementForRef(transactionId);

            if (!hasMovement) {
              shouldSync = true;
              console.log('Detected missing stock movement for transaction, syncing now...');
            }
          } catch (e) {
            console.warn('Error checking inventory sync status:', e);
          }
        }

        if (shouldSync) {
          // Determine operation
          const isDeletion = false; // We are updating/creating
          const type = fullTransaction.type;

          // User Requirement: 
          // 1. Income (Sale) -> Deduct (-): decrement
          // 2. Expense (Usage/Consumption) -> Deduct (-): decrement
          // previously: Expense (Purchase) -> Add (+): increment

          // So for now, we force 'decrement' for BOTH Income and Expense if they are linked.
          // This assumes Expense linkage means "using up stock" not "buying stock".
          // If we want to support "Restock" via Expense, we'd need a checkbox "Is Restock?" or look at category.
          // But per instruction "expense交易类型应该扣除asset数量", we set it to decrement.

          const operation = 'decrement';

          // Use the NEW updateStockMovementForRef which handles creation or update
          await InventoryService.updateStockMovementForRef(
            transactionId,
            {
              itemId: fullTransaction.inventoryLinkId!,
              variantSize: fullTransaction.inventoryVariant || '',
              quantity: fullTransaction.inventoryQuantity!,
              operation: operation
            }
          );
        }
      }

    } catch (error) {
      console.error('Error updating transaction:', error);
      throw error;
    }
  }

  // Batch update Transaction Category fields for multiple transactions
  static async batchUpdateTransactionCategory(
    transactionIds: string[],
    categoryUpdates: {
      category?: 'Projects & Activities' | 'Membership' | 'Administrative';
      year?: number;
      projectId?: string;
      memberId?: string;
      purpose?: string;
      paymentRequestId?: string;
    }
  ): Promise<{ updated: number; errors: string[] }> {
    if (isDevMode()) {
      console.log(`[Dev Mode] Batch updating category for ${transactionIds.length} transactions`);
      return { updated: transactionIds.length, errors: [] };
    }

    const results = await Promise.all(
      transactionIds.map(async (txId) => {
        try {
          const transactionRef = doc(db, COLLECTIONS.TRANSACTIONS, txId);
          const updateData: any = {
            ...removeUndefined(categoryUpdates),
            updatedAt: Timestamp.now(),
          };
          await updateDoc(transactionRef, updateData);
          return { success: true };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return { success: false, error: `Transaction ${txId}: ${msg}` };
        }
      })
    );

    let updated = 0;
    const errors: string[] = [];
    results.forEach(res => {
      if (res.success) updated++;
      else if (res.error) errors.push(res.error);
    });

    return { updated, errors };
  }

  // Batch update Transaction Category fields for multiple split records
  static async batchUpdateSplitCategory(
    splitIds: string[],
    categoryUpdates: {
      category?: 'Projects & Activities' | 'Membership' | 'Administrative';
      year?: number;
      projectId?: string;
      memberId?: string;
      purpose?: string;
      paymentRequestId?: string;
    }
  ): Promise<{ updated: number; errors: string[] }> {
    if (isDevMode()) {
      console.log(`[Dev Mode] Batch updating category for ${splitIds.length} splits`);
      return { updated: splitIds.length, errors: [] };
    }

    const results = await Promise.all(
      splitIds.map(async (splitId) => {
        try {
          const splitRef = doc(db, COLLECTIONS.TRANSACTION_SPLITS, splitId);
          const updateData: any = {
            ...removeUndefined(categoryUpdates),
            updatedAt: Timestamp.now(),
          };
          await updateDoc(splitRef, updateData);
          return { success: true };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          return { success: false, error: `Split ${splitId}: ${msg}` };
        }
      })
    );

    let updated = 0;
    const errors: string[] = [];
    results.forEach(res => {
      if (res.success) updated++;
      else if (res.error) errors.push(res.error);
    });

    return { updated, errors };
  }

  /**
   * Get transaction by ID from either TRANSACTIONS or PROJECT_TRANSACTIONS
   */
  static async getTransactionById(transactionId: string): Promise<Transaction | null> {
    if (isDevMode()) {
      return MOCK_TRANSACTIONS.find(t => t.id === transactionId) || null;
    }

    try {
      // Try main transactions collection
      const txDoc = await getDoc(doc(db, COLLECTIONS.TRANSACTIONS, transactionId));
      if (txDoc.exists()) {
        return {
          id: txDoc.id,
          ...txDoc.data(),
          date: txDoc.data().date?.toDate?.()?.toISOString() || txDoc.data().date,
        } as Transaction;
      }

      // Try project transactions collection
      const pjDoc = await getDoc(doc(db, COLLECTIONS.PROJECT_TRANSACTIONS, transactionId));
      if (pjDoc.exists()) {
        return {
          id: pjDoc.id,
          ...pjDoc.data(),
          date: pjDoc.data().date?.toDate?.()?.toISOString() || pjDoc.data().date,
        } as Transaction;
      }

      return null;
    } catch (error) {
      console.error('Error fetching transaction by ID:', error);
      throw error;
    }
  }

  // Delete transaction
  static async deleteTransaction(transactionId: string): Promise<void> {
    if (isDevMode()) {
      console.log(`[Dev Mode] Mocking deletion for transaction ${transactionId}`);
      return;
    }

    try {
      // Fetch transaction first to sync inventory if needed
      const transaction = await this.getTransactionById(transactionId);

      if (transaction && transaction.inventoryLinkId && transaction.inventoryQuantity) {
        // Remove stock movement if exists
        const { InventoryService } = await import('./inventoryService');
        await InventoryService.deleteStockMovementForRef(transactionId);
      } else if (transaction) {
        // Only call sync if we didn't use the new method, just in case (e.g. legacy check)
        await this.syncTransactionWithInventory(transaction, true);
      }

      await deleteDoc(doc(db, COLLECTIONS.TRANSACTIONS, transactionId));
    } catch (error) {
      console.error('Error deleting transaction:', error);
      throw error;
    }
  }

  // Delete project transaction
  static async deleteProjectTransaction(transactionId: string): Promise<void> {
    if (isDevMode()) {
      console.log(`[Dev Mode] Mocking deletion for project transaction ${transactionId}`);
      return;
    }

    try {
      // Fetch transaction first to sync inventory if needed
      // Note: project transactions might be in either collection
      let transaction = await this.getTransactionById(transactionId);

      if (transaction && transaction.inventoryLinkId && transaction.inventoryQuantity) {
        // Remove stock movement if exists
        const { InventoryService } = await import('./inventoryService');
        await InventoryService.deleteStockMovementForRef(transactionId);
      }

      // If we found the transaction, we have handled the inventory part above.
      // We proceed to delete the document.

      // Try deleting from projectTrx collection first
      await deleteDoc(doc(db, COLLECTIONS.PROJECT_TRANSACTIONS, transactionId));
    } catch (error) {
      console.error('Error deleting project transaction:', error);

      // If error (e.g. not found), try main collection for backward compatibility
      try {
        await deleteDoc(doc(db, COLLECTIONS.TRANSACTIONS, transactionId));
      } catch (innerError) {
        throw error;
      }
    }
  }

  // Synchronize transaction with inventory
  static async syncTransactionWithInventory(
    transaction: Transaction | Omit<Transaction, 'id'>,
    isDeletion: boolean = false
  ): Promise<void> {
    const { inventoryLinkId, inventoryVariant, inventoryQuantity, type } = transaction;

    if (!inventoryLinkId || !inventoryVariant || !inventoryQuantity) return;

    // User Update (2026-02-20): Both Income and Expense should DEDUCT (decrement) from asset quantity.
    // Income = Sale (Out)
    // Expense = Usage/Resale Cost (Out)
    // Therefore, normal operation is 'decrement' for both.
    // Deletion/Reversion is 'increment' for both.

    let operation: 'increment' | 'decrement';
    if (!isDeletion) {
      operation = 'decrement';
    } else {
      operation = 'increment';
    }

    try {
      // Dynamic import to avoid circular dependency
      const { InventoryService } = await import('./inventoryService');
      await InventoryService.updateVariantQuantity(
        inventoryLinkId,
        inventoryVariant,
        inventoryQuantity,
        operation,
        (transaction as any).id
      );
    } catch (error) {
      console.error('Failed to sync transaction with inventory:', error);
    }
  }

  // Get all bank accounts with dynamic balance
  static async getAllBankAccounts(): Promise<BankAccount[]> {
    if (isDevMode()) {
      return MOCK_ACCOUNTS;
    }

    try {
      const [accountsSnapshot, transactionsSnapshot] = await Promise.all([
        getDocs(collection(db, COLLECTIONS.BANK_ACCOUNTS)),
        getDocs(collection(db, COLLECTIONS.TRANSACTIONS))
      ]);

      const accounts = accountsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        lastReconciled: doc.data().lastReconciled?.toDate?.()?.toISOString() || doc.data().lastReconciled,
      } as BankAccount));

      const transactions = transactionsSnapshot.docs.map(doc => doc.data() as Transaction);

      // Calculate dynamic balance for each account
      return accounts.map(account => {
        const accountTransactions = transactions.filter(t => t.bankAccountId === account.id);
        const transactionSum = accountTransactions.reduce((sum, t) => {
          return sum + (t.type === 'Income' ? t.amount : -Math.abs(t.amount));
        }, 0);

        return {
          ...account,
          balance: (account.initialBalance || 0) + transactionSum
        };
      });
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
      throw error;
    }
  }

  // Create bank account
  static async createBankAccount(accountData: Omit<BankAccount, 'id'>): Promise<string> {
    if (isDevMode()) {
      console.log('[Dev Mode] Mocking bank account creation');
      return `mock-acc-${Date.now()}`;
    }

    try {
      const newAccount = {
        ...accountData,
        lastReconciled: Timestamp.fromDate(new Date(accountData.lastReconciled)),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const cleanAccount = removeUndefined(newAccount);
      const docRef = await addDoc(collection(db, COLLECTIONS.BANK_ACCOUNTS), cleanAccount);
      return docRef.id;
    } catch (error) {
      console.error('Error creating bank account:', error);
      throw error;
    }
  }

  // Update bank account
  static async updateBankAccount(accountId: string, updates: Partial<BankAccount>): Promise<void> {
    if (isDevMode()) {
      console.log(`[Dev Mode] Mocking update for bank account ${accountId}`);
      return;
    }

    try {
      const accountRef = doc(db, COLLECTIONS.BANK_ACCOUNTS, accountId);
      const updateData: any = {
        ...updates,
        updatedAt: Timestamp.now(),
      };

      if (updates.lastReconciled) {
        updateData.lastReconciled = Timestamp.fromDate(new Date(updates.lastReconciled));
      }

      await updateDoc(accountRef, updateData);
    } catch (error) {
      console.error('Error updating bank account:', error);
      throw error;
    }
  }

  // Get transactions by category
  static async getTransactionsByCategory(category: Transaction['category']): Promise<Transaction[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.TRANSACTIONS),
        where('category', '==', category),
        orderBy('date', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate?.()?.toISOString() || doc.data().date,
      } as Transaction));
    } catch (error) {
      console.error('Error fetching transactions by category:', error);
      throw error;
    }
  }

  // Get financial summary
  static async getFinancialSummary(year?: number): Promise<{
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    byCategory: Record<string, { income: number; expenses: number }>;
  }> {
    try {
      const transactions = await this.getAllTransactions();
      const targetYear = year || new Date().getFullYear();

      // Flatten transactions: regular transactions (excluding isSplit) + split children
      const flattenedTransactions: Transaction[] = [];
      const splitTxIds = transactions.filter(t => t.isSplit && t.splitIds && t.splitIds.length > 0).map(t => t.id);

      const splitsMap: Record<string, TransactionSplit[]> = {};
      for (const txId of splitTxIds) {
        splitsMap[txId] = await this.getTransactionSplits(txId);
      }

      transactions.forEach(tx => {
        if (tx.isSplit && tx.splitIds && tx.splitIds.length > 0) {
          const splits = splitsMap[tx.id] || [];
          splits.forEach(split => {
            flattenedTransactions.push({
              ...tx,
              id: split.id,
              category: split.category,
              amount: split.amount,
              description: split.description,
              projectId: split.projectId,
              memberId: split.memberId,
              purpose: split.purpose,
              paymentRequestId: split.paymentRequestId,
              year: split.year,
              isSplit: false,
            });
          });
        } else if (!tx.isSplit) {
          flattenedTransactions.push(tx);
        }
      });

      const filtered = flattenedTransactions.filter(t => {
        const transactionYear = new Date(t.date).getFullYear();
        return transactionYear === targetYear;
      });

      let totalIncome = 0;
      let totalExpenses = 0;
      const byCategory: Record<string, { income: number; expenses: number }> = {};

      filtered.forEach(t => {
        if (t.type === 'Income') {
          totalIncome += t.amount;
          if (!byCategory[t.category]) {
            byCategory[t.category] = { income: 0, expenses: 0 };
          }
          byCategory[t.category].income += t.amount;
        } else {
          totalExpenses += Math.abs(t.amount);
          if (!byCategory[t.category]) {
            byCategory[t.category] = { income: 0, expenses: 0 };
          }
          byCategory[t.category].expenses += Math.abs(t.amount);
        }
      });

      return {
        totalIncome,
        totalExpenses,
        netBalance: totalIncome - totalExpenses,
        byCategory,
      };
    } catch (error) {
      console.error('Error calculating financial summary:', error);
      throw error;
    }
  }

  // Automated dues renewal with membership type support
  // Handles 5 membership types: Probation (RM350), Full (RM300), Honorary (RM50), Senator (RM0), Visiting (RM500)
  static async initiateDuesRenewal(year: number): Promise<{
    totalMembers: number;
    renewalsByType: Record<string, number>;
    notificationsSent: number;
    validationErrors: Array<{ memberId: string; error: string }>;
  }> {
    if (isDevMode()) {
      console.log(`[Dev Mode] Would initiate dues renewal for year ${year}`);
      return {
        totalMembers: 0,
        renewalsByType: {},
        notificationsSent: 0,
        validationErrors: []
      };
    }

    try {
      const { MembersService } = await import('./membersService');
      const { CommunicationService } = await import('./communicationService');
      const { MembershipDues } = await import('../types');

      // Get all members who paid dues in the previous year (renewal members)
      const previousYearTransactions = await this.getTransactionsByCategory('Membership');
      const previousYearPaid = previousYearTransactions.filter(t => {
        const transactionYear = new Date(t.date).getFullYear();
        return transactionYear === year - 1 && t.type === 'Income' && t.status === 'Cleared';
      });

      const memberIds = [...new Set(previousYearPaid.map(t => t.memberId).filter(Boolean))];

      let renewalsByType: Record<string, number> = {
        Probation: 0,
        Full: 0,
        Honorary: 0,
        Senator: 0,
        Visiting: 0,
      };
      let notificationsSent = 0;
      const validationErrors: Array<{ memberId: string; error: string }> = [];

      for (const memberId of memberIds) {
        try {
          const member = await MembersService.getMemberById(memberId);
          if (!member) continue;

          // Check if renewal already exists
          const existingTransactions = await this.getTransactionsByCategory('Membership');
          const alreadyRenewed = existingTransactions.some(t => {
            const transactionYear = new Date(t.date).getFullYear();
            return transactionYear === year && t.memberId === memberId && t.type === 'Income';
          });

          if (alreadyRenewed) continue;

          // Determine membership type (default to 'Full' if not set)
          const membershipType = member.membershipType || 'Full';

          // Validate membership type eligibility
          if (membershipType === 'Honorary') {
            const age = member.dateOfBirth
              ? Math.floor((new Date().getTime() - new Date(member.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
              : 0;
            if (age <= 40) {
              validationErrors.push({
                memberId,
                error: `Honorary member ${member.name} must be over 40 years old (current age: ${age})`,
              });
              continue;
            }
          }

          if (membershipType === 'Visiting') {
            if (member.nationality === 'Malaysia' || !member.nationality) {
              validationErrors.push({
                memberId,
                error: `Visiting member ${member.name} must be a non-Malaysian citizen`,
              });
              continue;
            }
          }

          if (membershipType === 'Senator') {
            // Senators need certification - check if they have it
            if (!member.senatorCertified) {
              validationErrors.push({
                memberId,
                error: `Senator ${member.name} does not have valid senator certification`,
              });
              continue;
            }
          }

          // Get dues amount for membership type
          const duesAmount = MembershipDues[membershipType];

          // Create renewal transaction
          const renewalDate = new Date(year, 0, 1);
          await this.createTransaction({
            type: 'Income',
            category: 'Membership',
            amount: duesAmount,
            description: `${year} Membership Dues - ${membershipType.charAt(0).toUpperCase() + membershipType.slice(1)} Member`,
            memberId: memberId,
            status: 'Pending',
            date: renewalDate.toISOString(),
            transactionType: 'dues',
          });

          renewalsByType[membershipType]++;

          // Send notification (skip for senators with RM0 dues)
          if (duesAmount > 0) {
            await CommunicationService.createNotification({
              memberId: memberId,
              title: `Membership Dues Renewal for ${year}`,
              message: `Your ${membershipType} membership dues of RM${duesAmount} for ${year} are now due. Please complete payment to maintain your active membership status.`,
              type: 'info',
            });
            notificationsSent++;
          }

          // Update member's dues status
          await MembersService.updateMember(memberId, {
            duesStatus: duesAmount > 0 ? 'Pending' : 'Paid',
            duesYear: duesAmount === 0 ? year : member.duesYear, // Senators auto-paid
          });
        } catch (memberError) {
          console.error(`Error processing renewal for member ${memberId}:`, memberError);
          validationErrors.push({
            memberId,
            error: memberError instanceof Error ? memberError.message : 'Unknown error',
          });
        }
      }

      console.log(`Dues renewal initiated for ${year}:`, renewalsByType);

      return {
        totalMembers: memberIds.length,
        renewalsByType,
        notificationsSent,
        validationErrors,
      };
    } catch (error) {
      console.error('Error initiating dues renewal:', error);
      throw error;
    }
  }

  // Send reminder notifications for overdue dues (excludes senators)
  static async sendDuesReminders(year: number, daysOverdue: number = 30): Promise<number> {
    if (isDevMode()) {
      console.log(`[Dev Mode] Would send dues reminders for year ${year}`);
      return 0;
    }

    try {
      const { CommunicationService } = await import('./communicationService');
      const { MembersService } = await import('./membersService');

      // Get all pending dues transactions for the year
      const duesTransactions = await this.getTransactionsByCategory('Membership');
      const pendingDues = duesTransactions.filter(t => {
        const transactionYear = new Date(t.date).getFullYear();
        const daysSinceDue = Math.floor((new Date().getTime() - new Date(t.date).getTime()) / (1000 * 60 * 60 * 24));
        return transactionYear === year &&
          t.type === 'Income' &&
          t.status === 'Pending' &&
          daysSinceDue >= daysOverdue;
      });

      let remindersSent = 0;

      for (const transaction of pendingDues) {
        if (!transaction.memberId) continue;

        try {
          const member = await MembersService.getMemberById(transaction.memberId);
          if (!member) continue;

          // Skip senators (they are exempt from dues)
          if (member.membershipType === 'Senator') continue;

          await CommunicationService.createNotification({
            memberId: transaction.memberId,
            title: `Reminder: Membership Dues Payment Overdue`,
            message: `Your ${member.membershipType || 'membership'} dues of RM${transaction.amount} for ${year} are overdue. Please complete payment to avoid membership suspension.`,
            type: 'warning',
          });

          remindersSent++;
        } catch (error) {
          console.error(`Error sending reminder to member ${transaction.memberId}:`, error);
        }
      }

      return remindersSent;
    } catch (error) {
      console.error('Error sending dues reminders:', error);
      throw error;
    }
  }

  // Get dues renewal status for a specific year
  static async getDuesRenewalStatus(year: number): Promise<{
    totalMembers: number;
    byType: Record<string, { total: number; paid: number; pending: number; overdue: number }>;
    byCategory: { renewal: number; new: number };
  }> {
    if (isDevMode()) {
      return {
        totalMembers: 0,
        byType: {
          Probation: { total: 0, paid: 0, pending: 0, overdue: 0 },
          Full: { total: 0, paid: 0, pending: 0, overdue: 0 },
          Honorary: { total: 0, paid: 0, pending: 0, overdue: 0 },
          Senator: { total: 0, paid: 0, pending: 0, overdue: 0 },
          Visiting: { total: 0, paid: 0, pending: 0, overdue: 0 },
        },
        byCategory: { renewal: 0, new: 0 },
      };
    }

    try {
      const { MembersService } = await import('./membersService');
      const duesTransactions = await this.getTransactionsByCategory('Membership');

      const yearTransactions = duesTransactions.filter(t => {
        const transactionYear = new Date(t.date).getFullYear();
        return transactionYear === year && t.type === 'Income';
      });

      const byType: Record<string, { total: number; paid: number; pending: number; overdue: number }> = {
        Probation: { total: 0, paid: 0, pending: 0, overdue: 0 },
        Full: { total: 0, paid: 0, pending: 0, overdue: 0 },
        Honorary: { total: 0, paid: 0, pending: 0, overdue: 0 },
        Senator: { total: 0, paid: 0, pending: 0, overdue: 0 },
        Visiting: { total: 0, paid: 0, pending: 0, overdue: 0 },
      };

      let renewalCount = 0;
      let newCount = 0;

      for (const transaction of yearTransactions) {
        if (!transaction.memberId) continue;

        const member = await MembersService.getMemberById(transaction.memberId);
        if (!member) continue;

        const membershipType = member.membershipType || 'Full';
        if (!byType[membershipType]) byType[membershipType] = { total: 0, paid: 0, pending: 0, overdue: 0 };
        byType[membershipType].total++;

        // Determine if renewal or new member
        const previousYearTransactions = duesTransactions.filter(t => {
          const txYear = new Date(t.date).getFullYear();
          return txYear === year - 1 && t.memberId === transaction.memberId && t.type === 'Income';
        });

        if (previousYearTransactions.length > 0) {
          renewalCount++;
        } else {
          newCount++;
        }

        // Count by status
        if (transaction.status === 'Cleared' || transaction.status === 'Reconciled') {
          byType[membershipType].paid++;
        } else if (transaction.status === 'Pending') {
          const daysSinceDue = Math.floor((new Date().getTime() - new Date(transaction.date).getTime()) / (1000 * 60 * 60 * 24));
          if (daysSinceDue > 30) {
            byType[membershipType].overdue++;
          } else {
            byType[membershipType].pending++;
          }
        }
      }

      return {
        totalMembers: yearTransactions.length,
        byType,
        byCategory: { renewal: renewalCount, new: newCount },
      };
    } catch (error) {
      console.error('Error getting dues renewal status:', error);
      throw error;
    }
  }

  // Get members sorted by dues year and membership type
  static async getMembersDuesList(filters?: {
    membershipType?: string;
    duesYear?: number;
    paymentStatus?: 'paid' | 'pending' | 'overdue';
    memberCategory?: 'renewal' | 'new';
  }): Promise<Array<{
    memberId: string;
    memberName: string;
    membershipType: string;
    duesYear: number;
    duesAmount: number;
    paymentStatus: 'paid' | 'pending' | 'overdue';
    paymentDate?: string;
    isRenewal: boolean;
  }>> {
    if (isDevMode()) {
      return [];
    }

    try {
      const { MembersService } = await import('./membersService');
      const { MembershipDues } = await import('../types');
      const allMembers = await MembersService.getAllMembers();
      const duesTransactions = await this.getTransactionsByCategory('Membership');

      const membersDuesList: Array<{
        memberId: string;
        memberName: string;
        membershipType: string;
        duesYear: number;
        duesAmount: number;
        paymentStatus: 'paid' | 'pending' | 'overdue';
        paymentDate?: string;
        isRenewal: boolean;
      }> = [];

      for (const member of allMembers) {
        const membershipType = member.membershipType || 'Full';
        const duesYear = member.duesYear || new Date().getFullYear();
        const duesAmount = MembershipDues[membershipType as keyof typeof MembershipDues];

        // Find member's dues transaction for the year
        const memberTransactions = duesTransactions.filter(t =>
          t.memberId === member.id &&
          new Date(t.date).getFullYear() === duesYear &&
          t.type === 'Income'
        );

        if (memberTransactions.length === 0) continue;

        const transaction = memberTransactions[0];

        // Determine payment status
        let paymentStatus: 'paid' | 'pending' | 'overdue' = 'pending';
        if (transaction.status === 'Cleared' || transaction.status === 'Reconciled') {
          paymentStatus = 'paid';
        } else if (transaction.status === 'Pending') {
          const daysSinceDue = Math.floor((new Date().getTime() - new Date(transaction.date).getTime()) / (1000 * 60 * 60 * 24));
          paymentStatus = daysSinceDue > 30 ? 'overdue' : 'pending';
        }

        // Determine if renewal or new member
        const previousYearTransactions = duesTransactions.filter(t => {
          const txYear = new Date(t.date).getFullYear();
          return txYear === duesYear - 1 && t.memberId === member.id && t.type === 'Income';
        });
        const isRenewal = previousYearTransactions.length > 0;

        // Apply filters
        if (filters) {
          if (filters.membershipType && membershipType !== filters.membershipType) continue;
          if (filters.duesYear && duesYear !== filters.duesYear) continue;
          if (filters.paymentStatus && paymentStatus !== filters.paymentStatus) continue;
          if (filters.memberCategory && ((filters.memberCategory === 'renewal') !== isRenewal)) continue;
        }

        membersDuesList.push({
          memberId: member.id,
          memberName: member.name,
          membershipType,
          duesYear,
          duesAmount,
          paymentStatus,
          paymentDate: member.duesPaidDate,
          isRenewal,
        });
      }

      // Sort by dues year (descending), then by membership type, then by name
      return membersDuesList.sort((a, b) => {
        if (a.duesYear !== b.duesYear) return b.duesYear - a.duesYear;
        if (a.membershipType !== b.membershipType) return a.membershipType.localeCompare(b.membershipType);
        return a.memberName.localeCompare(b.memberName);
      });
    } catch (error) {
      console.error('Error getting members dues list:', error);
      throw error;
    }
  }

  // Process dues payment and update member status
  static async processDuesPayment(
    memberId: string,
    duesYear: number,
    paymentAmount: number,
    paymentDate: string
  ): Promise<{ success: boolean; error?: string }> {
    if (isDevMode()) {
      console.log(`[Dev Mode] Would process dues payment for member ${memberId}`);
      return { success: true };
    }

    try {
      const { MembersService } = await import('./membersService');
      const { MembershipDues } = await import('../types');

      const member = await MembersService.getMemberById(memberId);
      if (!member) {
        return { success: false, error: 'Member not found' };
      }

      const membershipType = member.membershipType || 'Full';
      const expectedAmount = MembershipDues[membershipType as keyof typeof MembershipDues];

      // Verify payment amount matches membership type dues
      if (Math.abs(paymentAmount - expectedAmount) > 0.01) {
        return {
          success: false,
          error: `Payment amount (RM${paymentAmount}) does not match ${membershipType} membership dues (RM${expectedAmount})`,
        };
      }

      // Find pending dues transaction
      const duesTransactions = await this.getTransactionsByCategory('Membership');
      const pendingTransaction = duesTransactions.find(t =>
        t.memberId === memberId &&
        new Date(t.date).getFullYear() === duesYear &&
        t.type === 'Income' &&
        t.status === 'Pending'
      );

      if (!pendingTransaction || !pendingTransaction.id) {
        return { success: false, error: 'No pending dues transaction found' };
      }

      // Update transaction status
      await this.updateTransaction(pendingTransaction.id, {
        status: 'Cleared',
        date: paymentDate,
      });

      // Update member status
      await MembersService.updateMember(memberId, {
        duesStatus: 'Paid',
        duesYear,
        duesPaidDate: paymentDate,
      });

      return { success: true };
    } catch (error) {
      console.error('Error processing dues payment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Calculate system balance for reconciliation (includes all transaction types)
  static async calculateSystemBalance(
    accountId: string,
    upToDate: string,
    transactionTypeFilter?: TransactionType | 'Projects & Activities' | 'Membership' | 'Administrative'
  ): Promise<{
    totalBalance: number;
    byType: {
      project: number;
      operations: number;
      dues: number;
      merchandise: number;
    };
  }> {
    if (isDevMode()) {
      return {
        totalBalance: 10000,
        byType: { project: 2500, operations: 3500, dues: 2000, merchandise: 2000 },
      };
    }

    try {
      const allTransactions = await this.getAllTransactions();
      const accountDoc = await getDoc(doc(db, COLLECTIONS.BANK_ACCOUNTS, accountId));
      const accountInitialBalance = accountDoc.exists() ? (accountDoc.data().initialBalance || 0) : 0;
      const cutoffDate = new Date(upToDate);

      // Filter transactions up to the reconciliation date for this account
      const relevantTransactions = allTransactions.filter(t => {
        const txDate = new Date(t.date);
        return t.bankAccountId === accountId && txDate <= cutoffDate;
      });

      const byType = {
        project: 0,
        operations: 0,
        dues: 0,
        merchandise: 0,
      };

      // Calculate balance by transaction type
      const splitTxIds = relevantTransactions.filter(t => t.isSplit && t.splitIds && t.splitIds.length > 0).map(t => t.id);
      const splitsMap: Record<string, TransactionSplit[]> = {};
      for (const txId of splitTxIds) {
        splitsMap[txId] = await this.getTransactionSplits(txId);
      }

      for (const transaction of relevantTransactions) {
        const amount = transaction.type === 'Income' ? transaction.amount : -Math.abs(transaction.amount);

        if (transaction.isSplit && transaction.splitIds && transaction.splitIds.length > 0) {
          const splits = splitsMap[transaction.id] || [];
          for (const split of splits) {
            if (!transactionTypeFilter || split.category === transactionTypeFilter) {
              const cat = split.category === 'Projects & Activities' ? 'project' : split.category === 'Membership' ? 'dues' : split.category === 'Administrative' ? 'operations' : 'operations';
              byType[cat as keyof typeof byType] += (transaction.type === 'Income' ? split.amount : -Math.abs(split.amount));
            }
          }
        } else if (transaction.transactionType) {
          // For non-split transactions with a type
          if (!transactionTypeFilter || transaction.transactionType === transactionTypeFilter) {
            byType[transaction.transactionType] += amount;
          }
        } else {
          // For transactions without a type, categorize as operations
          if (!transactionTypeFilter || transactionTypeFilter === 'operations') {
            byType.operations += amount;
          }
        }
      }

      const totalBalance = (transactionTypeFilter
        ? byType[transactionTypeFilter]
        : Object.values(byType).reduce((sum, val) => sum + val, 0)) + accountInitialBalance;

      return { totalBalance, byType };
    } catch (error) {
      console.error('Error calculating system balance:', error);
      throw error;
    }
  }

  // Detect reconciliation discrepancies
  static async detectDiscrepancies(
    accountId: string,
    statementBalance: number,
    reconciliationDate: string
  ): Promise<ReconciliationDiscrepancy[]> {
    if (isDevMode()) {
      return [];
    }

    try {
      const { totalBalance, byType } = await this.calculateSystemBalance(accountId, reconciliationDate);
      const discrepancies: ReconciliationDiscrepancy[] = [];

      // Check if system balance matches statement balance
      const difference = Math.abs(totalBalance - statementBalance);
      if (difference > 0.01) {
        discrepancies.push({
          id: `disc-${Date.now()}-1`,
          transactionId: '',
          type: 'amount_mismatch',
          expectedAmount: statementBalance,
          actualAmount: totalBalance,
          description: `System balance (${totalBalance.toFixed(2)}) does not match statement balance (${statementBalance.toFixed(2)}). Difference: ${difference.toFixed(2)}`,
          resolved: false,
        });
      }

      // Get unreconciled transactions
      const allTransactions = await this.getAllTransactions();
      const unreconciledTransactions = allTransactions.filter(
        t => t.bankAccountId === accountId &&
          t.status !== 'Reconciled' &&
          new Date(t.date) <= new Date(reconciliationDate)
      );

      // Check for potential duplicate transactions
      const transactionMap = new Map<string, Transaction[]>();
      unreconciledTransactions.forEach(t => {
        const key = `${t.date}-${t.amount}-${t.description}`;
        if (!transactionMap.has(key)) {
          transactionMap.set(key, []);
        }
        transactionMap.get(key)!.push(t);
      });

      transactionMap.forEach((transactions, key) => {
        if (transactions.length > 1) {
          transactions.forEach(t => {
            discrepancies.push({
              id: `disc-${Date.now()}-${t.id}`,
              transactionId: t.id,
              type: 'duplicate',
              expectedAmount: t.amount,
              actualAmount: t.amount,
              description: `Potential duplicate transaction: ${t.description} (${t.amount})`,
              resolved: false,
            });
          });
        }
      });

      return discrepancies;
    } catch (error) {
      console.error('Error detecting discrepancies:', error);
      throw error;
    }
  }

  // Reconcile bank account with enhanced transaction type support
  static async reconcileBankAccount(
    accountId: string,
    statementBalance: number,
    reconciliationDate: string,
    reconciledBy: string,
    notes?: string,
    transactionTypeFilter?: TransactionType | 'Projects & Activities' | 'Membership' | 'Administrative'
  ): Promise<string> {
    if (isDevMode()) {
      console.log(`[Dev Mode] Would reconcile bank account ${accountId}`);
      return 'mock-reconciliation-id';
    }

    try {
      // Calculate system balance with transaction type breakdown
      const { totalBalance, byType } = await this.calculateSystemBalance(
        accountId,
        reconciliationDate,
        transactionTypeFilter
      );

      // Detect discrepancies
      const discrepancies = await this.detectDiscrepancies(
        accountId,
        statementBalance,
        reconciliationDate
      );

      // Get account current balance
      const account = await this.getBankAccountById(accountId);
      if (!account) {
        throw new Error('Bank account not found');
      }

      // Create reconciliation record
      const reconciliationRecord: Omit<ReconciliationRecord, 'id'> = {
        bankAccountId: accountId,
        reconciliationDate,
        statementBalance,
        systemBalance: totalBalance,
        adjustedBalance: statementBalance,
        discrepancies,
        reconciledBy,
        notes,
        status: discrepancies.length > 0 ? 'in_progress' : 'completed',
        transactionTypeSummary: byType,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const docRef = await addDoc(
        collection(db, COLLECTIONS.RECONCILIATIONS),
        {
          ...reconciliationRecord,
          reconciliationDate: Timestamp.fromDate(new Date(reconciliationDate)),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        }
      );

      // Update account balance and last reconciled date
      await this.updateBankAccount(accountId, {
        balance: statementBalance,
        lastReconciled: reconciliationDate,
      });

      // Mark transactions as reconciled (only if no discrepancies)
      if (discrepancies.length === 0) {
        const allTransactions = await this.getAllTransactions();
        const accountTransactions = allTransactions.filter(
          t => t.bankAccountId === accountId &&
            t.status !== 'Reconciled' &&
            new Date(t.date) <= new Date(reconciliationDate)
        );

        for (const transaction of accountTransactions) {
          if (transaction.id) {
            await updateDoc(doc(db, COLLECTIONS.TRANSACTIONS, transaction.id), {
              status: 'Reconciled',
              reconciledAt: Timestamp.now(),
              reconciledBy,
            });

            // Also mark split transactions as reconciled
            if (transaction.isSplit && transaction.splitIds && transaction.splitIds.length > 0) {
              const splits = await this.getTransactionSplits(transaction.id);
              for (const split of splits) {
                await updateDoc(doc(db, COLLECTIONS.TRANSACTION_SPLITS, split.id), {
                  status: 'Reconciled',
                  reconciledAt: Timestamp.now(),
                  reconciledBy,
                });
              }
            }
          }
        }
      }

      return docRef.id;
    } catch (error) {
      console.error('Error reconciling bank account:', error);
      throw error;
    }
  }

  // Get reconciliation history
  static async getReconciliationHistory(accountId: string): Promise<ReconciliationRecord[]> {
    if (isDevMode()) {
      return [];
    }

    try {
      const q = query(
        collection(db, COLLECTIONS.RECONCILIATIONS),
        where('bankAccountId', '==', accountId),
        orderBy('reconciliationDate', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        reconciliationDate: doc.data().reconciliationDate?.toDate?.()?.toISOString() || doc.data().reconciliationDate,
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
      } as ReconciliationRecord));
    } catch (error) {
      console.error('Error fetching reconciliation history:', error);
      throw error;
    }
  }

  // Get bank account by ID with dynamic balance
  static async getBankAccountById(accountId: string): Promise<BankAccount | null> {
    if (isDevMode()) {
      return MOCK_ACCOUNTS.find(a => a.id === accountId) || null;
    }

    try {
      const accountDoc = await getDoc(doc(db, COLLECTIONS.BANK_ACCOUNTS, accountId));
      if (!accountDoc.exists()) {
        return null;
      }

      const accountData = accountDoc.data();
      const account = {
        id: accountDoc.id,
        ...accountData,
        lastReconciled: accountData.lastReconciled?.toDate?.()?.toISOString() || accountData.lastReconciled,
      } as BankAccount;

      // Fetch transactions for this account to calculate balance
      const transactionsQuery = query(
        collection(db, COLLECTIONS.TRANSACTIONS),
        where('bankAccountId', '==', accountId)
      );
      const transactionsSnapshot = await getDocs(transactionsQuery);
      const transactionSum = transactionsSnapshot.docs.reduce((sum, doc) => {
        const t = doc.data();
        return sum + (t.type === 'Income' ? t.amount : -Math.abs(t.amount));
      }, 0);

      return {
        ...account,
        balance: (account.initialBalance || 0) + transactionSum
      };
    } catch (error) {
      console.error('Error fetching bank account:', error);
      throw error;
    }
  }

  // Generate financial reports
  static async generateFinancialReport(
    reportType: 'income' | 'expense' | 'balance' | 'cashflow',
    year: number,
    month?: number,
    fiscalYearStart?: number // Month (0-11) when fiscal year starts, default is 0 (January = Calendar Year)
  ): Promise<{
    reportType: string;
    period: string;
    data: any;
    summary: {
      totalIncome: number;
      totalExpenses: number;
      netBalance: number;
      cashFlow: number;
    };
  }> {
    try {
      const allTransactions = await this.getAllTransactions();
      const fiscalStartMonth = fiscalYearStart !== undefined ? fiscalYearStart : 0; // Default to calendar year

      // Calculate date range based on fiscal year or calendar year
      let startDate: Date;
      let endDate: Date;

      if (month !== undefined) {
        // Single month report
        startDate = new Date(year, month, 1);
        endDate = new Date(year, month + 1, 0, 23, 59, 59);
      } else if (fiscalStartMonth === 0) {
        // Calendar year (January to December)
        startDate = new Date(year, 0, 1);
        endDate = new Date(year, 11, 31, 23, 59, 59);
      } else {
        // Fiscal year (e.g., April to March)
        if (month === undefined) {
          // Full fiscal year
          const fiscalYear = fiscalStartMonth <= new Date(year, 0, 1).getMonth() ? year - 1 : year;
          startDate = new Date(fiscalYear, fiscalStartMonth, 1);
          endDate = new Date(fiscalYear + 1, fiscalStartMonth - 1, 0, 23, 59, 59);
        } else {
          startDate = new Date(year, month, 1);
          endDate = new Date(year, month + 1, 0, 23, 59, 59);
        }
      }

      const filteredTransactions = allTransactions.filter(t => {
        const txDate = new Date(t.date);
        return txDate >= startDate && txDate <= endDate;
      });

      const incomeTransactions = filteredTransactions.filter(t => t.type === 'Income');
      const expenseTransactions = filteredTransactions.filter(t => t.type === 'Expense');

      const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
      const totalExpenses = expenseTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const netBalance = totalIncome - totalExpenses;

      // Calculate cash flow (monthly breakdown)
      const monthlyCashFlow: Record<number, { income: number; expenses: number; net: number }> = {};
      filteredTransactions.forEach(t => {
        const txDate = new Date(t.date);
        const monthKey = txDate.getMonth();
        if (!monthlyCashFlow[monthKey]) {
          monthlyCashFlow[monthKey] = { income: 0, expenses: 0, net: 0 };
        }
        if (t.type === 'Income') {
          monthlyCashFlow[monthKey].income += t.amount;
        } else {
          monthlyCashFlow[monthKey].expenses += Math.abs(t.amount);
        }
        monthlyCashFlow[monthKey].net = monthlyCashFlow[monthKey].income - monthlyCashFlow[monthKey].expenses;
      });

      // Category breakdown
      const categoryBreakdown: Record<string, { income: number; expenses: number; count: number }> = {};
      filteredTransactions.forEach(t => {
        if (!categoryBreakdown[t.category]) {
          categoryBreakdown[t.category] = { income: 0, expenses: 0, count: 0 };
        }
        if (t.type === 'Income') {
          categoryBreakdown[t.category].income += t.amount;
        } else {
          categoryBreakdown[t.category].expenses += Math.abs(t.amount);
        }
        categoryBreakdown[t.category].count += 1;
      });

      const period = month !== undefined
        ? `${new Date(year, month).toLocaleString('default', { month: 'long' })} ${year}`
        : fiscalStartMonth === 0
          ? `Calendar Year ${year}`
          : `Fiscal Year ${startDate.getFullYear()}-${endDate.getFullYear()} (${new Date(year, fiscalStartMonth).toLocaleString('default', { month: 'long' })} - ${new Date(year + 1, fiscalStartMonth - 1).toLocaleString('default', { month: 'long' })})`;

      return {
        reportType,
        period,
        data: {
          transactions: filteredTransactions,
          categoryBreakdown,
          monthlyCashFlow,
        },
        summary: {
          totalIncome,
          totalExpenses,
          netBalance,
          cashFlow: netBalance,
        },
      };
    } catch (error) {
      console.error('Error generating financial report:', error);
      throw error;
    }
  }

  // Export financial report as CSV
  static async exportFinancialReportAsCSV(
    reportType: 'income' | 'expense' | 'balance' | 'cashflow',
    year: number,
    month?: number
  ): Promise<string> {
    try {
      const report = await this.generateFinancialReport(reportType, year, month);
      const lines: string[] = [];

      // Header
      lines.push(`Financial Report: ${report.reportType.toUpperCase()}`);
      lines.push(`Period: ${report.period}`);
      lines.push(`Generated: ${new Date().toLocaleString()}`);
      lines.push('');

      if (reportType === 'income' || reportType === 'expense') {
        lines.push('Category,Income,Expenses,Net');
        Object.entries(report.data.categoryBreakdown).forEach(([category, data]) => {
          const categoryData = data as { income: number; expenses: number };
          lines.push(`${category},${categoryData.income.toFixed(2)},${categoryData.expenses.toFixed(2)},${(categoryData.income - categoryData.expenses).toFixed(2)}`);
        });
        lines.push('');
        lines.push(`Total Income,${report.summary.totalIncome.toFixed(2)},,`);
        lines.push(`Total Expenses,,${report.summary.totalExpenses.toFixed(2)},`);
        lines.push(`Net Balance,,,${report.summary.netBalance.toFixed(2)}`);
      } else if (reportType === 'balance') {
        const accounts = await this.getAllBankAccounts();
        lines.push('Account Name,Balance,Currency');
        accounts.forEach(acc => {
          lines.push(`${acc.name},${acc.balance.toFixed(2)},${acc.currency}`);
        });
        const totalCash = accounts.reduce((sum, acc) => sum + acc.balance, 0);
        lines.push('');
        lines.push(`Total Cash & Bank,${totalCash.toFixed(2)},`);
      } else if (reportType === 'cashflow') {
        lines.push('Month,Income,Expenses,Net Cash Flow');
        Object.entries(report.data.monthlyCashFlow)
          .sort(([a], [b]) => parseInt(a) - parseInt(b))
          .forEach(([month, data]) => {
            const monthName = new Date(year, parseInt(month)).toLocaleString('default', { month: 'short' });
            const monthData = data as { income: number; expenses: number; net: number };
            lines.push(`${monthName},${monthData.income.toFixed(2)},${monthData.expenses.toFixed(2)},${monthData.net.toFixed(2)}`);
          });
        lines.push('');
        lines.push(`Total Cash Inflows,${report.summary.totalIncome.toFixed(2)},,`);
        lines.push(`Total Cash Outflows,,${report.summary.totalExpenses.toFixed(2)},`);
        lines.push(`Net Cash Flow,,,${report.summary.cashFlow.toFixed(2)}`);
      }

      return lines.join('\n');
    } catch (error) {
      console.error('Error exporting financial report:', error);
      throw error;
    }
  }

  // Export detailed transaction list as CSV
  static async exportTransactionsAsCSV(
    year: number,
    month?: number
  ): Promise<string> {
    try {
      const allTransactions = await this.getAllTransactions();
      const startDate = month !== undefined
        ? new Date(year, month, 1)
        : new Date(year, 0, 1);
      const endDate = month !== undefined
        ? new Date(year, month + 1, 0, 23, 59, 59)
        : new Date(year, 11, 31, 23, 59, 59);

      const filteredTransactions = allTransactions.filter(t => {
        const txDate = new Date(t.date);
        return txDate >= startDate && txDate <= endDate;
      });

      const lines: string[] = [];
      lines.push('Date,Description,Type,Category,Amount,Status,Member ID,Project ID');

      filteredTransactions.forEach(t => {
        lines.push([
          new Date(t.date).toLocaleDateString(),
          `"${t.description}"`,
          t.type,
          t.category,
          t.amount.toFixed(2),
          t.status,
          t.memberId || '',
          t.projectId || '',
        ].join(','));
      });

      return lines.join('\n');
    } catch (error) {
      console.error('Error exporting transactions:', error);
      throw error;
    }
  }

  // Generate comprehensive Income Statement (P&L Statement)
  static async generateIncomeStatement(
    year: number,
    fiscalYearStart: number = 0
  ): Promise<{
    period: string;
    revenue: {
      membershipDues: number;
      eventFees: number;
      sponsorships: number;
      otherIncome: number;
      totalRevenue: number;
    };
    expenses: {
      eventExpenses: number;
      projectExpenses: number;
      administrativeExpenses: number;
      otherExpenses: number;
      totalExpenses: number;
    };
    netIncome: number;
    generatedAt: Date;
  }> {
    try {
      const allTransactions = await this.getAllTransactions();
      const startDate = fiscalYearStart === 0
        ? new Date(year, 0, 1)
        : new Date(year - 1, fiscalYearStart, 1);
      const endDate = fiscalYearStart === 0
        ? new Date(year, 11, 31, 23, 59, 59)
        : new Date(year, fiscalYearStart - 1, 0, 23, 59, 59);

      const filteredTransactions = allTransactions.filter(t => {
        const txDate = new Date(t.date);
        return txDate >= startDate && txDate <= endDate;
      });

      const incomeTransactions = filteredTransactions.filter(t => t.type === 'Income');
      const expenseTransactions = filteredTransactions.filter(t => t.type === 'Expense');

      // Revenue breakdown (categories: Projects & Activities, Membership, Administrative)
      const membershipDues = incomeTransactions
        .filter(t => t.category === 'Membership')
        .reduce((sum, t) => sum + t.amount, 0);
      const eventFees = incomeTransactions
        .filter(t => t.category === 'Projects & Activities')
        .reduce((sum, t) => sum + t.amount, 0);
      const sponsorships = 0; // Now part of Projects & Activities
      const otherIncome = incomeTransactions
        .filter(t => t.category !== 'Membership' && t.category !== 'Projects & Activities')
        .reduce((sum, t) => sum + t.amount, 0);
      const totalRevenue = membershipDues + eventFees + sponsorships + otherIncome;

      // Expense breakdown (categories: Projects & Activities, Membership, Administrative)
      const eventExpenses = expenseTransactions
        .filter(t => t.category === 'Projects & Activities')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const projectExpenses = 0; // Now part of Projects & Activities
      const administrativeExpenses = expenseTransactions
        .filter(t => t.category === 'Administrative')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const otherExpenses = expenseTransactions
        .filter(t => !['Projects & Activities', 'Membership', 'Administrative'].includes(t.category))
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const totalExpenses = eventExpenses + projectExpenses + administrativeExpenses + otherExpenses;

      const period = fiscalYearStart === 0
        ? `Calendar Year ${year}`
        : `Fiscal Year ${startDate.getFullYear()}-${endDate.getFullYear()}`;

      return {
        period,
        revenue: {
          membershipDues,
          eventFees,
          sponsorships,
          otherIncome,
          totalRevenue,
        },
        expenses: {
          eventExpenses,
          projectExpenses,
          administrativeExpenses,
          otherExpenses,
          totalExpenses,
        },
        netIncome: totalRevenue - totalExpenses,
        generatedAt: new Date(),
      };
    } catch (error) {
      console.error('Error generating income statement:', error);
      throw error;
    }
  }

  // Generate comprehensive Balance Sheet
  static async generateBalanceSheet(
    year: number,
    asOfDate?: Date
  ): Promise<{
    asOfDate: Date;
    assets: {
      currentAssets: {
        cashAndBank: number;
        accountsReceivable: number;
        prepaidExpenses: number;
        totalCurrentAssets: number;
      };
      fixedAssets: {
        inventory: number;
        equipment: number;
        totalFixedAssets: number;
      };
      totalAssets: number;
    };
    liabilities: {
      currentLiabilities: {
        accountsPayable: number;
        accruedExpenses: number;
        deferredRevenue: number;
        totalCurrentLiabilities: number;
      };
      totalLiabilities: number;
    };
    equity: {
      retainedEarnings: number;
      currentYearNetIncome: number;
      totalEquity: number;
    };
    totalLiabilitiesAndEquity: number;
  }> {
    try {
      const accounts = await this.getAllBankAccounts();
      const allTransactions = await this.getAllTransactions();

      const reportDate = asOfDate || new Date(year, 11, 31, 23, 59, 59);
      const yearStart = new Date(year, 0, 1);

      // Calculate cash and bank balances
      const cashAndBank = accounts.reduce((sum, acc) => sum + acc.balance, 0);

      // Calculate accounts receivable (pending income transactions)
      const accountsReceivable = allTransactions
        .filter(t =>
          t.type === 'Income' &&
          t.status === 'Pending' &&
          new Date(t.date) <= reportDate
        )
        .reduce((sum, t) => sum + t.amount, 0);

      // Calculate prepaid expenses (future-dated expense transactions)
      const prepaidExpenses = allTransactions
        .filter(t =>
          t.type === 'Expense' &&
          new Date(t.date) > reportDate &&
          new Date(t.date) <= new Date(year + 1, 11, 31)
        )
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      // Calculate inventory value (would need InventoryService)
      let inventory = 0;
      try {
        const { InventoryService } = await import('./inventoryService');
        const items = await InventoryService.getItemsWithDepreciation();
        inventory = items.reduce((sum, item) => sum + (item.calculatedValue || 0), 0);
      } catch (err) {
        // Inventory service not available, use 0
      }

      // Calculate accounts payable (pending expense transactions)
      const accountsPayable = allTransactions
        .filter(t =>
          t.type === 'Expense' &&
          t.status === 'Pending' &&
          new Date(t.date) <= reportDate
        )
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      // Calculate deferred revenue (future-dated income transactions)
      const deferredRevenue = allTransactions
        .filter(t =>
          t.type === 'Income' &&
          new Date(t.date) > reportDate &&
          new Date(t.date) <= new Date(year + 1, 11, 31)
        )
        .reduce((sum, t) => sum + t.amount, 0);

      // Calculate current year net income
      const yearTransactions = allTransactions.filter(t => {
        const txDate = new Date(t.date);
        return txDate >= yearStart && txDate <= reportDate;
      });
      const yearIncome = yearTransactions
        .filter(t => t.type === 'Income')
        .reduce((sum, t) => sum + t.amount, 0);
      const yearExpenses = yearTransactions
        .filter(t => t.type === 'Expense')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const currentYearNetIncome = yearIncome - yearExpenses;

      // Calculate retained earnings (simplified - would need historical data)
      const previousYearTransactions = allTransactions.filter(t => {
        const txDate = new Date(t.date);
        return txDate < yearStart;
      });
      const previousYearIncome = previousYearTransactions
        .filter(t => t.type === 'Income')
        .reduce((sum, t) => sum + t.amount, 0);
      const previousYearExpenses = previousYearTransactions
        .filter(t => t.type === 'Expense')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const retainedEarnings = previousYearIncome - previousYearExpenses;

      const currentAssets = {
        cashAndBank,
        accountsReceivable,
        prepaidExpenses,
        totalCurrentAssets: cashAndBank + accountsReceivable + prepaidExpenses,
      };

      const fixedAssets = {
        inventory,
        equipment: 0, // Would need asset tracking
        totalFixedAssets: inventory,
      };

      const totalAssets = currentAssets.totalCurrentAssets + fixedAssets.totalFixedAssets;

      const currentLiabilities = {
        accountsPayable,
        accruedExpenses: 0, // Would need accrual tracking
        deferredRevenue,
        totalCurrentLiabilities: accountsPayable + deferredRevenue,
      };

      const totalLiabilities = currentLiabilities.totalCurrentLiabilities;

      const equity = {
        retainedEarnings,
        currentYearNetIncome,
        totalEquity: retainedEarnings + currentYearNetIncome,
      };

      return {
        asOfDate: reportDate,
        assets: {
          currentAssets,
          fixedAssets,
          totalAssets,
        },
        liabilities: {
          currentLiabilities,
          totalLiabilities,
        },
        equity,
        totalLiabilitiesAndEquity: totalLiabilities + equity.totalEquity,
      };
    } catch (error) {
      console.error('Error generating balance sheet:', error);
      throw error;
    }
  }

  // Generate comprehensive Cash Flow Statement
  static async generateCashFlowStatement(
    year: number,
    fiscalYearStart: number = 0
  ): Promise<{
    period: string;
    operatingActivities: {
      netIncome: number;
      adjustments: {
        depreciation: number;
        accountsReceivableChange: number;
        accountsPayableChange: number;
        otherAdjustments: number;
      };
      netCashFromOperations: number;
    };
    investingActivities: {
      equipmentPurchases: number;
      inventoryPurchases: number;
      netCashFromInvesting: number;
    };
    financingActivities: {
      memberContributions: number;
      loansReceived: number;
      loanRepayments: number;
      netCashFromFinancing: number;
    };
    netChangeInCash: number;
    beginningCash: number;
    endingCash: number;
    generatedAt: Date;
  }> {
    try {
      const accounts = await this.getAllBankAccounts();
      const allTransactions = await this.getAllTransactions();

      const startDate = fiscalYearStart === 0
        ? new Date(year, 0, 1)
        : new Date(year - 1, fiscalYearStart, 1);
      const endDate = fiscalYearStart === 0
        ? new Date(year, 11, 31, 23, 59, 59)
        : new Date(year, fiscalYearStart - 1, 0, 23, 59, 59);

      const yearTransactions = allTransactions.filter(t => {
        const txDate = new Date(t.date);
        return txDate >= startDate && txDate <= endDate;
      });

      // Calculate net income
      const income = yearTransactions
        .filter(t => t.type === 'Income')
        .reduce((sum, t) => sum + t.amount, 0);
      const expenses = yearTransactions
        .filter(t => t.type === 'Expense')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const netIncome = income - expenses;

      // Operating activities adjustments
      // Note: These would need more sophisticated tracking in production
      const depreciation = 0; // Would need asset depreciation tracking
      const accountsReceivableChange = 0; // Would need AR tracking
      const accountsPayableChange = 0; // Would need AP tracking
      const otherAdjustments = 0;

      const netCashFromOperations = netIncome + depreciation +
        accountsReceivableChange + accountsPayableChange + otherAdjustments;

      // Investing activities
      const equipmentPurchases = yearTransactions
        .filter(t => t.type === 'Expense' && t.description?.toLowerCase().includes('equipment'))
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      let inventoryPurchases = 0;
      try {
        const { InventoryService } = await import('./inventoryService');
        const items = await InventoryService.getAllItems();
        // Estimate inventory purchases from transactions
        inventoryPurchases = yearTransactions
          .filter(t => t.type === 'Expense' && t.description?.toLowerCase().includes('inventory'))
          .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      } catch (err) {
        // Inventory service not available
      }

      const netCashFromInvesting = -(equipmentPurchases + inventoryPurchases);

      // Financing activities
      const memberContributions = yearTransactions
        .filter(t => t.type === 'Income' && t.category === 'Membership')
        .reduce((sum, t) => sum + t.amount, 0);
      const loansReceived = yearTransactions
        .filter(t => t.type === 'Income' && t.description?.toLowerCase().includes('loan'))
        .reduce((sum, t) => sum + t.amount, 0);
      const loanRepayments = yearTransactions
        .filter(t => t.type === 'Expense' && t.description?.toLowerCase().includes('loan'))
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      const netCashFromFinancing = memberContributions + loansReceived - loanRepayments;

      // Calculate beginning and ending cash
      const previousYearTransactions = allTransactions.filter(t => {
        const txDate = new Date(t.date);
        return txDate < startDate;
      });
      const previousYearIncome = previousYearTransactions
        .filter(t => t.type === 'Income')
        .reduce((sum, t) => sum + t.amount, 0);
      const previousYearExpenses = previousYearTransactions
        .filter(t => t.type === 'Expense')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const beginningCash = previousYearIncome - previousYearExpenses;

      const endingCash = accounts.reduce((sum, acc) => sum + acc.balance, 0);
      const netChangeInCash = endingCash - beginningCash;

      const period = fiscalYearStart === 0
        ? `Calendar Year ${year}`
        : `Fiscal Year ${startDate.getFullYear()}-${endDate.getFullYear()}`;

      return {
        period,
        operatingActivities: {
          netIncome,
          adjustments: {
            depreciation,
            accountsReceivableChange,
            accountsPayableChange,
            otherAdjustments,
          },
          netCashFromOperations,
        },
        investingActivities: {
          equipmentPurchases,
          inventoryPurchases,
          netCashFromInvesting,
        },
        financingActivities: {
          memberContributions,
          loansReceived,
          loanRepayments,
          netCashFromFinancing,
        },
        netChangeInCash,
        beginningCash,
        endingCash,
        generatedAt: new Date(),
      };
    } catch (error) {
      console.error('Error generating cash flow statement:', error);
      throw error;
    }
  }

  // Generate Income Details Statement (detailed breakdown of income sources)
  static async generateIncomeDetailsStatement(
    year: number,
    fiscalYearStart: number = 0
  ): Promise<{
    period: string;
    details: Array<{
      date: string;
      description: string;
      category: string;
      amount: number;
      memberId?: string;
      projectId?: string;
      eventId?: string;
    }>;
    summary: {
      byCategory: Record<string, number>;
      byMonth: Record<number, number>;
      total: number;
    };
    generatedAt: Date;
  }> {
    try {
      const allTransactions = await this.getAllTransactions();
      const startDate = fiscalYearStart === 0
        ? new Date(year, 0, 1)
        : new Date(year - 1, fiscalYearStart, 1);
      const endDate = fiscalYearStart === 0
        ? new Date(year, 11, 31, 23, 59, 59)
        : new Date(year, fiscalYearStart - 1, 0, 23, 59, 59);

      const incomeTransactions = allTransactions.filter(t => {
        const txDate = new Date(t.date);
        return txDate >= startDate && txDate <= endDate && t.type === 'Income';
      });

      const byCategory: Record<string, number> = {};
      const byMonth: Record<number, number> = {};

      incomeTransactions.forEach(t => {
        // Category breakdown
        byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;

        // Monthly breakdown
        const month = new Date(t.date).getMonth();
        byMonth[month] = (byMonth[month] || 0) + t.amount;
      });

      const period = fiscalYearStart === 0
        ? `Calendar Year ${year}`
        : `Fiscal Year ${startDate.getFullYear()}-${endDate.getFullYear()}`;

      return {
        period,
        details: incomeTransactions.map(t => ({
          date: t.date,
          description: t.description,
          category: t.category,
          amount: t.amount,
          memberId: t.memberId,
          projectId: t.projectId,
          eventId: undefined, // Would need eventId in Transaction type
        })),
        summary: {
          byCategory,
          byMonth,
          total: incomeTransactions.reduce((sum, t) => sum + t.amount, 0),
        },
        generatedAt: new Date(),
      };
    } catch (error) {
      console.error('Error generating income details statement:', error);
      throw error;
    }
  }
}
