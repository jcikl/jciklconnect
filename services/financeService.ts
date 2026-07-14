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
  startAfter,
  Timestamp,
  getDoc as getFirestoreDoc,
  documentId,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { Transaction, BankAccount, ReconciliationRecord, ReconciliationDiscrepancy, TransactionSplit, TransactionType, MembershipDues, MembershipRecord, MembershipStatus, MembershipType, FinanceAlert } from '../types';
import { withDevMode } from '../utils/devMode';
import { MOCK_TRANSACTIONS, MOCK_ACCOUNTS, MOCK_MEMBERS } from './mockData';
import { formatCurrency } from '../utils/formatUtils';
import { removeUndefined } from '../utils/dataUtils';
import {
  MembershipConfigService,
  resolveMembershipPurpose,
  computeMembershipTypeFromMember,
  roleForMembershipType,
} from './membershipConfigService';
import {
  buildMembershipProjectId,
  buildCategoryCleanupUpdates,
} from '../utils/transactionCategoryUtils';
import { apiCache } from './cacheService';

const FINANCE_CACHE_PREFIX = 'finance:';
const TX_CACHE_TTL = 3 * 60 * 1000; // 3 minutes

/** Invalidate all finance caches (call after any write to transactions/bankAccounts). */
function invalidateFinanceCache(): void {
  apiCache.deleteByPrefix(FINANCE_CACHE_PREFIX);
}



// Local mock data store with localStorage sync in Dev Mode
let devModeSplits: TransactionSplit[] = [];
let localMockTransactions: Transaction[] = [];

if (typeof window !== 'undefined') {
  try {
    const cachedSplits = localStorage.getItem('devModeSplits');
    if (cachedSplits) {
      devModeSplits = JSON.parse(cachedSplits);
    }
    const cachedMocks = localStorage.getItem('mockTransactions');
    if (cachedMocks) {
      localMockTransactions = JSON.parse(cachedMocks);
    } else {
      localMockTransactions = [...MOCK_TRANSACTIONS];
    }
  } catch (e) {
    console.error('Failed to load mock data from localStorage', e);
    localMockTransactions = [...MOCK_TRANSACTIONS];
  }
} else {
  localMockTransactions = [...MOCK_TRANSACTIONS];
}

const saveDevModeSplits = () => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('devModeSplits', JSON.stringify(devModeSplits));
    } catch (e) {
      console.error('Failed to save devModeSplits to localStorage', e);
    }
  }
};

const saveMockTransactions = () => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('mockTransactions', JSON.stringify(localMockTransactions));
    } catch (e) {
      console.error('Failed to save mockTransactions to localStorage', e);
    }
  }
};

export class FinanceService {
  // Get all transactions
  static async getAllTransactions(year?: number): Promise<Transaction[]> {
    return withDevMode(
      () => {
        if (year) {
          return localMockTransactions.filter(t => new Date(t.date).getFullYear() === year);
        }
        return localMockTransactions;
      },
      () => apiCache.getOrSet(
        `${FINANCE_CACHE_PREFIX}transactions:${year ?? 'all'}`,
        async () => {
          try {
            let q;
            if (year) {
              const { Timestamp } = await import('firebase/firestore');
              const start = Timestamp.fromDate(new Date(year, 0, 1, 0, 0, 0, 0));
              const end = Timestamp.fromDate(new Date(year, 11, 31, 23, 59, 59, 999));
              q = query(
                collection(db, COLLECTIONS.TRANSACTIONS),
                where('date', '>=', start),
                where('date', '<=', end),
                orderBy('date', 'desc')
              );
            } else {
              q = query(
                collection(db, COLLECTIONS.TRANSACTIONS),
                orderBy('date', 'desc')
              );
            }

            const snapshot = await getDocs(q);
            let transactions = snapshot.docs.map(doc => {
              const data = doc.data() as any;
              return {
                id: doc.id,
                ...data,
                date: data.date?.toDate?.()?.toISOString() || data.date,
              } as Transaction;
            });

            if (year) {
              transactions = transactions.filter(t => new Date(t.date).getFullYear() === year);
            }

            return transactions;
          } catch (error) {
            console.error('Error fetching transactions:', error);
            throw error;
          }
        },
        TX_CACHE_TTL
      )
    );
  }

  // Get cumulative net flow of bank accounts before a specific year
  static async getHistoricalNetFlowBeforeYear(year: number): Promise<Record<string, number>> {
    return withDevMode(
      () => {
        const netFlows: Record<string, number> = {};
        localMockTransactions.forEach(t => {
          const tYear = new Date(t.date).getFullYear();
          if (tYear < year) {
            const change = t.type === 'Income' ? t.amount : -t.amount;
            netFlows[t.bankAccountId] = (netFlows[t.bankAccountId] || 0) + change;
          }
        });
        return netFlows;
      },
      async () => {
        try {
          const { Timestamp } = await import('firebase/firestore');
          const boundaryDate = new Date(year, 0, 1, 0, 0, 0, 0);
          const boundaryTimestamp = Timestamp.fromDate(boundaryDate);

          const q = query(
            collection(db, COLLECTIONS.TRANSACTIONS),
            where('date', '<', boundaryTimestamp)
          );

          const snapshot = await getDocs(q);
          const netFlows: Record<string, number> = {};

          snapshot.docs.forEach(doc => {
            const data = doc.data() as any;
            const type = data.type;
            const amount = data.amount || 0;
            const bankAccountId = data.bankAccountId;
            if (!bankAccountId) return;

            const change = type === 'Income' ? amount : -amount;
            netFlows[bankAccountId] = (netFlows[bankAccountId] || 0) + change;
          });

          return netFlows;
        } catch (error) {
          console.error('Error calculating historical net flows:', error);
          return {};
        }
      }
    );
  }

  // Get all transaction years for a specific bank account
  static async getTransactionYearsForAccount(bankAccountId: string): Promise<number[]> {
    return withDevMode(
      () => {
        const years = new Set(localMockTransactions
          .filter(t => t.bankAccountId === bankAccountId)
          .map(t => new Date(t.date).getFullYear())
        );
        years.add(new Date().getFullYear());
        return Array.from(years).sort((a, b) => b - a);
      },
      async () => {
        try {
          const q = query(
            collection(db, COLLECTIONS.TRANSACTIONS),
            where('bankAccountId', '==', bankAccountId)
          );
          const snapshot = await getDocs(q);
          const years = new Set<number>();
          snapshot.docs.forEach(doc => {
            const data = doc.data() as any;
            if (data.date) {
              const dateVal = data.date.toDate?.() || new Date(data.date);
              const y = new Date(dateVal).getFullYear();
              if (!isNaN(y)) {
                years.add(y);
              }
            }
          });
          years.add(new Date().getFullYear());
          return Array.from(years).sort((a, b) => b - a);
        } catch (error) {
          console.error('Error fetching transaction years for account:', error);
          return [new Date().getFullYear()];
        }
      }
    );
  }

  // Get all unique transaction years across all accounts
  static async getAllTransactionYears(): Promise<number[]> {
    return withDevMode(
      () => {
        const years = new Set(localMockTransactions.map(t => new Date(t.date).getFullYear()));
        years.add(new Date().getFullYear());
        return Array.from(years).sort((a, b) => b - a);
      },
      async () => {
        try {
          const q = query(collection(db, COLLECTIONS.TRANSACTIONS));
          const snapshot = await getDocs(q);
          const years = new Set<number>();
          snapshot.docs.forEach(doc => {
            const data = doc.data() as any;
            if (data.date) {
              const dateVal = data.date.toDate?.() || new Date(data.date);
              const y = new Date(dateVal).getFullYear();
              if (!isNaN(y)) {
                years.add(y);
              }
            }
          });
          years.add(new Date().getFullYear());
          return Array.from(years).sort((a, b) => b - a);
        } catch (error) {
          console.error('Error fetching all transaction years:', error);
          return [new Date().getFullYear()];
        }
      }
    );
  }

  // Get project transactions
  static async getProjectTransactions(projectId: string): Promise<Transaction[]> {
    return withDevMode(
      () => localMockTransactions.filter(t => t.projectId === projectId),
      async () => {
        try {
          // First try with orderBy (requires composite index)
          const projectTrxQuery = query(
            collection(db, COLLECTIONS.PROJECT_TRANSACTIONS),
            where('projectId', '==', projectId),
            orderBy('date', 'desc')
          );
          const snapshot = await getDocs(projectTrxQuery);
          return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            date: doc.data().date?.toDate?.()?.toISOString() || doc.data().date,
          } as Transaction));
        } catch (indexError: any) {
          if (indexError?.code === 'failed-precondition') {
            // Index still building — fall back to unordered query, sort client-side
            try {
              const fallbackQuery = query(
                collection(db, COLLECTIONS.PROJECT_TRANSACTIONS),
                where('projectId', '==', projectId)
              );
              const snapshot = await getDocs(fallbackQuery);
              return snapshot.docs
                .map(doc => ({
                  id: doc.id,
                  ...doc.data(),
                  date: doc.data().date?.toDate?.()?.toISOString() || doc.data().date,
                } as Transaction))
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            } catch (fallbackError) {
              console.error('Error fetching project transactions (fallback):', fallbackError);
              throw fallbackError;
            }
          }
          console.error('Error fetching project transactions:', indexError);
          throw indexError;
        }
      }
    );
  }

  // Get bank transactions associated with a project (from transactions collection)
  static async getBankTransactionsByProject(projectId: string): Promise<Transaction[]> {
    return withDevMode(
      () => {
        const direct = localMockTransactions.filter(t => t.projectId === projectId && !t.isSplit);
        const splitVirtuals = devModeSplits
          .filter(s => s.projectId === projectId)
          .map(s => {
            const parent = localMockTransactions.find(t => t.id === s.parentTransactionId);
            return {
              id: s.id,
              date: parent?.date || new Date().toISOString(),
              description: parent?.description || '',
              purpose: s.purpose || null,
              amount: s.amount,
              type: s.type || parent?.type || 'Expense',
              category: s.category || parent?.category || 'Projects & Activities',
              status: parent?.status || 'Pending',
              projectId: s.projectId,
              memberId: s.memberId,
              bankAccountId: parent?.bankAccountId,
              reconciledAt: parent?.reconciledAt,
              reconciledBy: parent?.reconciledBy,
              referenceNumber: parent?.referenceNumber,
              paymentRequestId: s.paymentRequestId,
              projectTransactionId: (s as any).projectTransactionId || null,
              projectTransactionIds: (s as any).projectTransactionIds || [],
              isSplitChild: true,
              parentTransactionId: s.parentTransactionId,
            } as any;
          });
        return [...direct, ...splitVirtuals].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      },
      async () => {
    try {
      // 1. Get transactions directly assigned to the project (e.g. non-split)
      const q = query(
        collection(db, COLLECTIONS.TRANSACTIONS),
        where('projectId', '==', projectId)
      );
      const snapshot = await getDocs(q);
      const directTransactions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate?.()?.toISOString() || doc.data().date,
      } as Transaction));

      // 2. Get splits assigned to the project
      const splitsQuery = query(
        collection(db, COLLECTIONS.TRANSACTION_SPLITS),
        where('projectId', '==', projectId)
      );
      const splitsSnapshot = await getDocs(splitsQuery);
      const virtualTransactionsFromSplits: Transaction[] = [];
      const parentIds = Array.from(new Set(splitsSnapshot.docs.map(doc => doc.data().parentTransactionId).filter(Boolean)));

      if (parentIds.length > 0) {
        const parentTransactionsMap = new Map<string, any>();
        
        // Chunk parentIds into sizes of 10 to avoid Firestore IN query limit
        for (let i = 0; i < parentIds.length; i += 10) {
          const chunk = parentIds.slice(i, i + 10);
          const parentsQuery = query(
            collection(db, COLLECTIONS.TRANSACTIONS),
            where(documentId(), 'in', chunk)
          );
          const parentsSnapshot = await getDocs(parentsQuery);
          parentsSnapshot.docs.forEach(pDoc => {
            parentTransactionsMap.set(pDoc.id, {
              id: pDoc.id,
              ...pDoc.data(),
              date: pDoc.data().date?.toDate?.()?.toISOString() || pDoc.data().date,
            });
          });
        }

        splitsSnapshot.docs.forEach(doc => {
          const splitData = doc.data();
          const parent = parentTransactionsMap.get(splitData.parentTransactionId);
          if (parent) {
            virtualTransactionsFromSplits.push({
              id: doc.id,
              date: parent.date,
              // description always from parent bank tx (情景 14)
              description: parent.description || '',
              // purpose from the linked project transaction (情景 15); fallback to split purpose
              purpose: splitData.purpose || null,
              amount: splitData.amount,
              type: splitData.type || parent.type,
              category: splitData.category || parent.category,
              status: parent.status,
              projectId: splitData.projectId,
              memberId: splitData.memberId || parent.memberId || '',
              bankAccountId: parent.bankAccountId,
              reconciledAt: parent.reconciledAt,
              reconciledBy: parent.reconciledBy,
              referenceNumber: parent.referenceNumber,
              paymentRequestId: splitData.paymentRequestId || parent.paymentRequestId,
              projectTransactionId: (splitData as any).projectTransactionId || null,
              projectTransactionIds: (splitData as any).projectTransactionIds || [],
              isSplitChild: true,
              parentTransactionId: splitData.parentTransactionId,
            } as any);
          }
        });
      }

        const combined = [...directTransactions, ...virtualTransactionsFromSplits];
        return combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      } catch (error) {
        console.error('Error fetching bank transactions for project:', error);
        throw error;
      }
      }
    );
  }

  // Create transaction
  static async createTransaction(transactionData: Omit<Transaction, 'id'>): Promise<string> {
    return withDevMode(
      () => {
        console.log('[Dev Mode] Mocking transaction creation');
        const id = `mock-tx-${Date.now()}`;
        const newTx: Transaction = {
          id,
          ...transactionData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        localMockTransactions.push(newTx);
        saveMockTransactions();
        return id;
      },
      async () => {
        try {
          let purpose = transactionData.purpose;
          if (transactionData.category === 'Membership') {
            const year = transactionData.projectId ? parseInt(transactionData.projectId, 10) : new Date(transactionData.date).getFullYear();
            const rules = await MembershipConfigService.getRules();
            purpose = resolveMembershipPurpose(transactionData.amount, isNaN(year) ? new Date().getFullYear() : year, rules);
          }

          const newTransaction = {
            ...transactionData,
            purpose,
            date: Timestamp.fromDate(new Date(transactionData.date)),
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };

          const cleanTransaction = removeUndefined(newTransaction);
          const docRef = await addDoc(collection(db, COLLECTIONS.TRANSACTIONS), cleanTransaction);

          // Sync with inventory if linked
          await this.syncTransactionWithInventory({ ...transactionData, id: docRef.id });

          // Sync with Member Membership if category is Membership
          if (transactionData.category === 'Membership' && transactionData.memberId) {
            await this.syncMemberMembership(transactionData.memberId as string, transactionData.projectId);
          }

          invalidateFinanceCache();
          return docRef.id;
        } catch (error) {
          console.error('Error creating transaction:', error);
          throw error;
        }
      }
    );
  }

  // Create project transaction
  static async createProjectTransaction(transactionData: Omit<Transaction, 'id'>): Promise<string> {
    return withDevMode(
      () => {
        console.log('[Dev Mode] Mocking project transaction creation');
        const newId = `mock-prj-tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const newTx: Transaction = {
          id: newId,
          ...transactionData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        localMockTransactions.push(newTx);
        saveMockTransactions();
        return newId;
      },
      async () => {
        try {
          const newTransaction: any = {
            ...transactionData,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };

          if (transactionData.date) {
            newTransaction.date = Timestamp.fromDate(new Date(transactionData.date));
          } else {
            newTransaction.date = '';
          }

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
    );
  }

  // Update project transaction
  static async updateProjectTransaction(transactionId: string, updates: Partial<Transaction>): Promise<void> {
    return withDevMode(
      () => {
        console.log('[Dev Mode] Mocking project transaction update');
        const idx = localMockTransactions.findIndex(t => t.id === transactionId);
        if (idx !== -1) {
          localMockTransactions[idx] = {
            ...localMockTransactions[idx],
            ...updates,
            updatedAt: new Date().toISOString(),
          } as Transaction;
          saveMockTransactions();
        }
      },
      async () => {
        try {
          const transactionRef = doc(db, COLLECTIONS.PROJECT_TRANSACTIONS, transactionId);

          const updateData: any = {
            ...removeUndefined(updates),
            updatedAt: Timestamp.now(),
          };

          if (updates.date !== undefined) {
            updateData.date = updates.date ? Timestamp.fromDate(new Date(updates.date)) : '';
          }

          await updateDoc(transactionRef, updateData);
        } catch (error) {
          console.error('Error updating project transaction:', error);
          throw error;
        }
      }
    );
  }

  // Create transaction split (upsert: update existing or create new)
  static async createTransactionSplit(
    parentTransactionId: string,
    splits: Array<{ id?: string; category: 'Projects & Activities' | 'Membership' | 'Administrative' | ''; year?: number; projectId?: string; memberId?: string; purpose?: string; paymentRequestId?: string; amount: number; description: string }>,
    createdBy: string
  ): Promise<string[]> {
    return withDevMode(
      async () => {
        console.log(`[Dev Mode] Creating/updating ${splits.length} splits for transaction ${parentTransactionId}`);
        // Resolve split child to real parent (情景 P/DD)
        const maybeSplit = devModeSplits.find(s => s.id === parentTransactionId);
        if (maybeSplit) parentTransactionId = maybeSplit.parentTransactionId;
        // Find parent transaction
        const parentTransaction = localMockTransactions.find(t => t.id === parentTransactionId);
        if (!parentTransaction) {
          throw new Error('Parent transaction not found');
        }

        // Validate split amounts sum to parent amount
        const totalSplitAmount = splits.reduce((sum, split) => sum + split.amount, 0);
        if (Math.abs(totalSplitAmount - parentTransaction.amount) > 0.01) {
          throw new Error(
            `Split amounts (${totalSplitAmount}) must equal parent transaction amount (${parentTransaction.amount})`
          );
        }

        // Delete existing splits for this transaction that were removed
        const newSplitIds = splits.filter(s => s.id).map(s => s.id);
        devModeSplits = devModeSplits.filter(s => s.parentTransactionId !== parentTransactionId || newSplitIds.includes(s.id));

        const splitIds: string[] = [];
        splits.forEach((split, index) => {
          if (split.id && devModeSplits.some(s => s.id === split.id)) {
            // Update
            const idx = devModeSplits.findIndex(s => s.id === split.id);
            devModeSplits[idx] = {
              ...devModeSplits[idx],
              category: split.category,
              projectId: split.projectId,
              memberId: split.memberId,
              purpose: split.purpose,
              paymentRequestId: split.paymentRequestId,
              amount: split.amount,
              description: split.description,
              year: split.year,
            };
            splitIds.push(split.id);
          } else {
            // Create
            const newId = split.id || `mock-split-${parentTransactionId}-${index}-${Date.now()}`;
            const newSplit: TransactionSplit = {
              id: newId,
              parentTransactionId,
              category: split.category,
              type: parentTransaction.type,
              projectId: split.projectId || '',
              memberId: split.memberId || '',
              purpose: split.purpose || '',
              paymentRequestId: split.paymentRequestId || '',
              amount: split.amount,
              description: split.description,
              createdAt: new Date().toISOString(),
              createdBy,
              year: split.year,
            };
            devModeSplits.push(newSplit);
            splitIds.push(newId);
          }
        });

        // Update parent transaction
        const parentIdx = localMockTransactions.findIndex(t => t.id === parentTransactionId);
        if (parentIdx !== -1) {
          localMockTransactions[parentIdx] = {
            ...localMockTransactions[parentIdx],
            isSplit: true,
            splitIds,
            originalCategory: localMockTransactions[parentIdx].category,
            category: '' as any,
            projectId: '',
            purpose: '',
            projectTransactionIds: [],
            projectTransactionId: null,
            updatedAt: new Date().toISOString(),
          };
        }

        saveDevModeSplits();
        saveMockTransactions();

        return splitIds;
      },
      async () => {
    try {
      // If parentTransactionId is actually a split child ID, resolve to the real parent (情景 P/DD)
      let resolvedParentId = parentTransactionId;
      const maybeSplitDoc = await getDoc(doc(db, COLLECTIONS.TRANSACTION_SPLITS, parentTransactionId));
      if (maybeSplitDoc.exists()) {
        resolvedParentId = (maybeSplitDoc.data() as TransactionSplit).parentTransactionId;
      }
      parentTransactionId = resolvedParentId;

      // Get parent transaction
      const parentDoc = await getDoc(doc(db, COLLECTIONS.TRANSACTIONS, parentTransactionId));
      if (!parentDoc.exists()) {
        throw new Error(`Parent transaction not found: ${parentTransactionId}`);
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
      const membershipSyncTargets = new Map<string, string>();
      const addMembershipSyncTarget = (split?: Partial<TransactionSplit> | Partial<typeof splits[number]>) => {
        if (split?.category !== 'Membership' || !split.memberId) return;
        const year = split.year || this.getMembershipYearFromProjectId((split as any).projectId);
        if (!year) return;
        membershipSyncTargets.set(`${split.memberId}:${year}`, `${year} membership`);
      };
      existingSplits.forEach(addMembershipSyncTarget);
      splits.forEach(addMembershipSyncTarget);

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

          const splitDoc = await addDoc(collection(db, COLLECTIONS.TRANSACTION_SPLITS), removeUndefined({
            ...splitData,
            createdAt: Timestamp.now(),
          }));

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
        projectTransactionIds: [],
        projectTransactionId: null,
        updatedAt: Timestamp.now(),
      });

      for (const [key, projectId] of membershipSyncTargets.entries()) {
        const [memberId] = key.split(':');
        await this.syncMemberMembership(memberId, projectId);
      }

      return splitIds;
    } catch (error) {
      console.error('Error creating transaction splits:', error);
      throw error;
    }
      }
    );
  }

  // Get transaction splits
  static async getTransactionSplits(transactionId: string): Promise<TransactionSplit[]> {
    return withDevMode(
      () => devModeSplits.filter(s => s.parentTransactionId === transactionId),
      async () => {
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
    );
  }

  // Get ALL transaction splits in bulk
  static async getAllTransactionSplits(year?: number): Promise<TransactionSplit[]> {
    return withDevMode(
      () => {
        if (year) {
          return devModeSplits.filter(s => s.year === year);
        }
        return devModeSplits;
      },
      async () => {
        try {
          let q;
          if (year) {
            q = query(
              collection(db, COLLECTIONS.TRANSACTION_SPLITS),
              where('year', '==', year)
            );
          } else {
            q = collection(db, COLLECTIONS.TRANSACTION_SPLITS);
          }
          const snapshot = await getDocs(q);
          return snapshot.docs.map(doc => {
            const data = doc.data() as any;
            return {
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
            } as TransactionSplit;
          });
        } catch (error) {
          console.error('Error fetching all transaction splits:', error);
          throw error;
        }
      }
    );
  }

  // Update transaction split
  static async updateTransactionSplit(
    splitId: string,
    updates: Partial<Omit<TransactionSplit, 'id' | 'parentTransactionId' | 'createdAt' | 'createdBy'>>
  ): Promise<void> {
    return withDevMode(
      () => {
        console.log(`[Dev Mode] Mocking update for split ${splitId}`);
        const idx = devModeSplits.findIndex(s => s.id === splitId);
        if (idx !== -1) {
          devModeSplits[idx] = {
            ...devModeSplits[idx],
            ...updates,
          } as TransactionSplit;
          saveDevModeSplits();
        }
      },
      async () => {
        try {
          const splitRef = doc(db, COLLECTIONS.TRANSACTION_SPLITS, splitId);

          // Fetch current split before applying updates (needed for inventory diff)
          const currentDoc = await getDoc(splitRef);
          if (!currentDoc.exists()) throw new Error('Split not found');
          const currentSplit = currentDoc.data() as TransactionSplit;

          await updateDoc(splitRef, {
            ...removeUndefined(updates),
            updatedAt: Timestamp.now(),
          });

          // If amount changed, validate total still equals parent
          if (updates.amount !== undefined) {
            const updatedDoc = await getDoc(splitRef);
            if (updatedDoc.exists()) {
              const split = updatedDoc.data() as TransactionSplit;
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

          // Sync inventory stock movement for this split
          const fullSplit = { ...currentSplit, ...updates } as TransactionSplit;
          const { InventoryService } = await import('./inventoryService');

          const hadLinkage = currentSplit.inventoryLinkId && currentSplit.inventoryQuantity;
          const hasLinkage = fullSplit.inventoryLinkId && fullSplit.inventoryQuantity;

          if (hadLinkage && !hasLinkage) {
            // Case A: inventory linkage removed — delete stock movement
            await InventoryService.deleteStockMovementForRef(splitId);
          } else if (hasLinkage) {
            // Case B: inventory linkage added or changed
            const fieldsChanged =
              (updates.inventoryLinkId !== undefined && updates.inventoryLinkId !== currentSplit.inventoryLinkId) ||
              (updates.inventoryVariant !== undefined && updates.inventoryVariant !== currentSplit.inventoryVariant) ||
              (updates.inventoryQuantity !== undefined && updates.inventoryQuantity !== currentSplit.inventoryQuantity) ||
              (updates.type !== undefined && updates.type !== currentSplit.type);

            let shouldSync = fieldsChanged;
            if (!shouldSync) {
              try {
                const hasMovement = await InventoryService.hasStockMovementForRef(splitId);
                if (!hasMovement) shouldSync = true;
              } catch (e) {
                console.warn('Error checking inventory sync status for split:', e);
              }
            }

            if (shouldSync) {
              await InventoryService.updateStockMovementForRef(splitId, {
                itemId: fullSplit.inventoryLinkId!,
                variantSize: fullSplit.inventoryVariant || '',
                quantity: fullSplit.inventoryQuantity!,
                operation: 'decrement',
              });
            }
          }
        } catch (error) {
          console.error('Error updating transaction split:', error);
          throw error;
        }
      }
    );
  }

  // Delete transaction split
  static async deleteTransactionSplit(splitId: string): Promise<void> {
    return withDevMode(
      () => {
        console.log(`[Dev Mode] Mocking deletion for split ${splitId}`);
        const splitIdx = devModeSplits.findIndex(s => s.id === splitId);
        if (splitIdx === -1) return;
        const split = devModeSplits[splitIdx];
        devModeSplits.splice(splitIdx, 1);

        // Update parent transaction splitIds array
        const remainingSplits = devModeSplits.filter(s => s.parentTransactionId === split.parentTransactionId);
        const remainingIds = remainingSplits.map(s => s.id);

        const parentIdx = localMockTransactions.findIndex(t => t.id === split.parentTransactionId);
        if (parentIdx !== -1) {
          const parentTx = localMockTransactions[parentIdx];
          const originalCategory = (parentTx as any).originalCategory || parentTx.category || '';
          localMockTransactions[parentIdx] = {
            ...parentTx,
            splitIds: remainingIds,
            isSplit: remainingIds.length > 0,
            category: remainingIds.length === 0 ? originalCategory : '',
            updatedAt: new Date().toISOString(),
            ...(remainingIds.length === 0 ? {
              projectTransactionIds: [],
              projectTransactionId: null,
              status: 'Cleared',
              purpose: '',
            } : {}),
          };
        }
        saveDevModeSplits();
        saveMockTransactions();
      },
      async () => {
        try {
          const splitDoc = await getDoc(doc(db, COLLECTIONS.TRANSACTION_SPLITS, splitId));
          if (!splitDoc.exists()) {
            throw new Error('Split not found');
          }

          const split = splitDoc.data() as TransactionSplit;

          // Cleanup inventory stock movement before deleting
          if (split.inventoryLinkId && split.inventoryQuantity) {
            const { InventoryService } = await import('./inventoryService');
            await InventoryService.deleteStockMovementForRef(splitId);
          }

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

          if (remainingIds.length === 0) {
            updateData.projectTransactionIds = [];
            updateData.projectTransactionId = null;
            updateData.status = 'Cleared';
            updateData.purpose = '';
          }

          await updateDoc(doc(db, COLLECTIONS.TRANSACTIONS, split.parentTransactionId), updateData);

          // Sync member membership if deleted split was Membership category
          if (split.category === 'Membership' && split.memberId && split.year) {
            await this.syncMemberMembership(split.memberId, `${split.year} membership`);
          }
        } catch (error) {
          console.error('Error deleting transaction split:', error);
          throw error;
        }
      }
    );
  }

  // Get transactions by type (including splits)
  static async getTransactionsByType(filter: TransactionType | 'Projects & Activities' | 'Membership' | 'Administrative'): Promise<Transaction[]> {
    return withDevMode(
      () => localMockTransactions.filter(t => t.transactionType === filter),
      async () => {
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
          const [allTransactions, allSplits] = await Promise.all([
            this.getAllTransactions(),
            this.getAllTransactionSplits()
          ]);

          const parentIdsWithMatchingSplits = new Set(
            allSplits.filter(split => split.category === filter).map(s => s.parentTransactionId)
          );

          const transactionsWithSplits = allTransactions.filter(t => parentIdsWithMatchingSplits.has(t.id));

          // Combine and deduplicate
          const combined = [...transactions, ...transactionsWithSplits];
          const unique = Array.from(new Map(combined.map(t => [t.id, t])).values());

          return unique.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        } catch (error) {
          console.error('Error fetching transactions by type:', error);
          throw error;
        }
      }
    );
  }

  // Update transaction
  static async updateTransaction(transactionId: string, updates: Partial<Transaction>): Promise<void> {
    return withDevMode(
      () => {
        console.log(`[Dev Mode] Mocking update for transaction ${transactionId}`);
        const idx = localMockTransactions.findIndex(t => t.id === transactionId);
        if (idx !== -1) {
          localMockTransactions[idx] = {
            ...localMockTransactions[idx],
            ...updates,
            updatedAt: new Date().toISOString(),
          } as Transaction;
          saveMockTransactions();
        }
      },
      async () => {
    try {
      const transactionRef = doc(db, COLLECTIONS.TRANSACTIONS, transactionId);

      // Fetch current transaction to check for changes and merge
      const currentDoc = await getDoc(transactionRef);
      if (!currentDoc.exists()) {
        throw new Error('Transaction not found');
      }
      const currentTransaction = currentDoc.data() as Transaction;

      if (currentTransaction.status === 'Reconciled' || currentTransaction.status === 'Partially Reconciled') {
        throw new Error(`Cannot edit a ${currentTransaction.status} transaction. Unmatch it first before making changes.`);
      }

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

      // Sync with Member Membership if category is Membership or was Membership
      if (updates.category === 'Membership' || currentTransaction.category === 'Membership') {
        const hasMemberIdUpdate = Object.prototype.hasOwnProperty.call(updates, 'memberId');
        const nextMemberIdRaw = hasMemberIdUpdate ? updates.memberId : currentTransaction.memberId;
        const memberId = typeof nextMemberIdRaw === 'string' ? nextMemberIdRaw.trim() : nextMemberIdRaw;
        const projectId = updates.projectId || currentTransaction.projectId;

        if (memberId) {
          const mergedForSync: Transaction = {
            ...currentTransaction,
            ...updates,
            id: transactionId,
            memberId,
            category: (updates.category || currentTransaction.category) as Transaction['category'],
            projectId,
            date: updates.date
              ? this.normalizeTransactionDate(updates.date)
              : this.normalizeTransactionDate(currentTransaction.date),
          };
          await this.syncMemberMembership(memberId as string, projectId, {
            includeTransactions: [mergedForSync],
          });
        }

        // If memberId changed/cleared, or year changed, sync the old member too
        if (
          currentTransaction.memberId &&
          (
            !memberId ||
            memberId !== currentTransaction.memberId ||
            projectId !== currentTransaction.projectId
          )
        ) {
          await this.syncMemberMembership(currentTransaction.memberId as string, currentTransaction.projectId);
        }
      }

      invalidateFinanceCache();
    } catch (error) {
      console.error('Error updating transaction:', error);
      throw error;
    }
      }
    );
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
    return withDevMode(
      async () => {
      console.log(`[Dev Mode] Batch updating category for ${transactionIds.length} transactions`);
      let updatedCount = 0;
      for (const txId of transactionIds) {
        const idx = localMockTransactions.findIndex(t => t.id === txId);
        if (idx !== -1) {
          const currentTransaction = localMockTransactions[idx];
          const finalCategory = categoryUpdates.category ?? currentTransaction?.category;
          const explicitKeys = new Set(Object.keys(categoryUpdates).filter(k => (categoryUpdates as any)[k] !== undefined));

          const updateData: any = {
            ...removeUndefined(categoryUpdates),
            ...buildCategoryCleanupUpdates({ finalCategory, previousCategory: currentTransaction?.category, explicitKeys }),
            updatedAt: new Date().toISOString(),
          };

          if (finalCategory === 'Membership') {
            const yearVal = categoryUpdates.year || currentTransaction?.year ||
              (currentTransaction?.date ? new Date(currentTransaction.date).getFullYear() : new Date().getFullYear());
            if (!categoryUpdates.projectId) {
              updateData.projectId = buildMembershipProjectId(yearVal);
            }
            const memberIdVal = categoryUpdates.memberId !== undefined ? categoryUpdates.memberId : currentTransaction?.memberId;
            if (memberIdVal && !('purpose' in categoryUpdates)) {
              const rules = await MembershipConfigService.getRules();
              updateData.purpose = resolveMembershipPurpose(currentTransaction?.amount || 0, yearVal, rules);
            }
          }

          localMockTransactions[idx] = { ...currentTransaction, ...updateData } as Transaction;
          updatedCount++;
        }
      }
      saveMockTransactions();
      return { updated: updatedCount, errors: [] };
    },
    async () => {
    const results = await Promise.all(
      transactionIds.map(async (txId) => {
        try {
          const transactionRef = doc(db, COLLECTIONS.TRANSACTIONS, txId);
          const currentDoc = await getDoc(transactionRef);
          const currentTransaction = currentDoc.exists()
            ? ({ id: currentDoc.id, ...currentDoc.data() } as Transaction)
            : null;

          const finalCategory = categoryUpdates.category ?? currentTransaction?.category;
          const explicitKeys = new Set(Object.keys(categoryUpdates).filter(k => (categoryUpdates as any)[k] !== undefined));

          const updateData: any = {
            ...removeUndefined(categoryUpdates),
            ...buildCategoryCleanupUpdates({ finalCategory, previousCategory: currentTransaction?.category, explicitKeys }),
            updatedAt: Timestamp.now(),
          };

          if (finalCategory === 'Membership') {
            const yearVal = categoryUpdates.year || currentTransaction?.year ||
              (currentTransaction?.date ? new Date((currentTransaction.date as any)?.toDate?.() ?? currentTransaction.date).getFullYear() : new Date().getFullYear());
            if (!categoryUpdates.projectId) {
              updateData.projectId = buildMembershipProjectId(yearVal);
            }
            const memberIdVal = categoryUpdates.memberId !== undefined ? categoryUpdates.memberId : currentTransaction?.memberId;
            if (memberIdVal && !('purpose' in categoryUpdates)) {
              const rules = await MembershipConfigService.getRules();
              updateData.purpose = resolveMembershipPurpose(currentTransaction?.amount || 0, yearVal, rules);
            }
          }

          await updateDoc(transactionRef, updateData);

          const nextTransaction = {
            ...(currentTransaction || {}),
            ...categoryUpdates,
            ...(updateData.projectId ? { projectId: updateData.projectId } : {}),
          } as Transaction;

          if (nextTransaction.category === 'Membership' && nextTransaction.memberId) {
            const projectId = nextTransaction.projectId || this.getMembershipProjectIdFromYear(categoryUpdates.year);
            await this.syncMemberMembership(nextTransaction.memberId, projectId);
          }

          // Sync old member when category changes AWAY from Membership (情景 V)
          if (
            currentTransaction?.category === 'Membership' &&
            currentTransaction.memberId &&
            finalCategory !== 'Membership'
          ) {
            await this.syncMemberMembership(currentTransaction.memberId, currentTransaction.projectId);
          } else if (
            currentTransaction?.category === 'Membership' &&
            currentTransaction.memberId &&
            (currentTransaction.memberId !== nextTransaction.memberId || currentTransaction.projectId !== nextTransaction.projectId)
          ) {
            await this.syncMemberMembership(currentTransaction.memberId, currentTransaction.projectId);
          }

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
    );
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
    return withDevMode(
      async () => {
      console.log(`[Dev Mode] Batch updating category for ${splitIds.length} splits`);
      let updatedCount = 0;
      for (const splitId of splitIds) {
        const idx = devModeSplits.findIndex(s => s.id === splitId);
        if (idx !== -1) {
          const currentSplit = devModeSplits[idx];
          const finalCategory = categoryUpdates.category ?? currentSplit?.category;
          const explicitKeys = new Set(Object.keys(categoryUpdates).filter(k => (categoryUpdates as any)[k] !== undefined));

          const catForCleanup = (finalCategory as string) === '' ? undefined : finalCategory as import('../utils/transactionCategoryUtils').TransactionCategory;
          const updateData: any = {
            ...removeUndefined(categoryUpdates),
            ...(catForCleanup
              ? buildCategoryCleanupUpdates({ finalCategory: catForCleanup, previousCategory: currentSplit?.category || undefined, explicitKeys })
              : {}),
            updatedAt: new Date().toISOString(),
          };

          if (finalCategory === 'Membership' && !categoryUpdates.projectId) {
            const yearVal = categoryUpdates.year || currentSplit?.year || new Date().getFullYear();
            updateData.projectId = buildMembershipProjectId(yearVal);
          }

          devModeSplits[idx] = { ...currentSplit, ...updateData } as TransactionSplit;
          updatedCount++;
        }
      }
      saveDevModeSplits();
      return { updated: updatedCount, errors: [] };
    },
    async () => {
    const results = await Promise.all(
      splitIds.map(async (splitId) => {
        try {
          const splitRef = doc(db, COLLECTIONS.TRANSACTION_SPLITS, splitId);
          const currentDoc = await getDoc(splitRef);
          const currentSplit = currentDoc.exists()
            ? ({ id: currentDoc.id, ...currentDoc.data() } as TransactionSplit)
            : null;

          const finalCategory = categoryUpdates.category ?? currentSplit?.category;
          const explicitKeys = new Set(Object.keys(categoryUpdates).filter(k => (categoryUpdates as any)[k] !== undefined));

          const catForCleanup2 = (finalCategory as string) === '' ? undefined : finalCategory as import('../utils/transactionCategoryUtils').TransactionCategory;
          const updateData: any = {
            ...removeUndefined(categoryUpdates),
            ...(catForCleanup2
              ? buildCategoryCleanupUpdates({ finalCategory: catForCleanup2, previousCategory: currentSplit?.category || undefined, explicitKeys })
              : {}),
            updatedAt: Timestamp.now(),
          };

          if (finalCategory === 'Membership' && !categoryUpdates.projectId) {
            const yearVal = categoryUpdates.year || currentSplit?.year || new Date().getFullYear();
            updateData.projectId = buildMembershipProjectId(yearVal);
          }

          await updateDoc(splitRef, updateData);

          const nextSplit = { ...(currentSplit || {}), ...categoryUpdates } as TransactionSplit;
          if (nextSplit.category === 'Membership' && nextSplit.memberId) {
            const projectId = this.getMembershipProjectIdFromYear(nextSplit.year || categoryUpdates.year);
            await this.syncMemberMembership(nextSplit.memberId, projectId);
          }

          if (
            currentSplit?.category === 'Membership' &&
            currentSplit.memberId &&
            (currentSplit.memberId !== nextSplit.memberId || currentSplit.year !== nextSplit.year)
          ) {
            await this.syncMemberMembership(
              currentSplit.memberId,
              this.getMembershipProjectIdFromYear(currentSplit.year)
            );
          }

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
    );
  }

  /**
   * Get transaction by ID from either TRANSACTIONS or PROJECT_TRANSACTIONS
   */
  static async getTransactionById(transactionId: string): Promise<Transaction | null> {
    return withDevMode(
      () => localMockTransactions.find(t => t.id === transactionId) || null,
      async () => {
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
    );
  }

  // Delete transaction
  static async deleteTransaction(transactionId: string): Promise<void> {
    return withDevMode(
      () => {
        console.log(`[Dev Mode] Mocking deletion for transaction ${transactionId}`);
      },
      async () => {
        try {
          // Fetch transaction first to sync inventory if needed
          const transaction = await this.getTransactionById(transactionId);

          if (transaction?.status === 'Reconciled' || transaction?.status === 'Partially Reconciled') {
            throw new Error(`Cannot delete a ${transaction.status} transaction. Unmatch it first before deleting.`);
          }

          if (transaction && transaction.inventoryLinkId && transaction.inventoryQuantity) {
            // Remove stock movement if exists
            const { InventoryService } = await import('./inventoryService');
            await InventoryService.deleteStockMovementForRef(transactionId);
          } else if (transaction) {
            // Only call sync if we didn't use the new method, just in case (e.g. legacy check)
            await this.syncTransactionWithInventory(transaction, true);
          }

          // If this is a matched income tx, remove the match from the linked bank tx first
          if (transaction?.matchedBankTxIds?.length) {
            const { EventPaymentMatchingService } = await import('./eventPaymentMatchingService');
            for (const bankTxId of transaction.matchedBankTxIds) {
              await EventPaymentMatchingService.removeMatch(transactionId, bankTxId).catch((err) =>
                console.warn('[deleteTransaction] Could not clean up bank tx link:', err)
              );
            }
          }

          await deleteDoc(doc(db, COLLECTIONS.TRANSACTIONS, transactionId));
          invalidateFinanceCache();

          // Sync with Member Membership if category is Membership
          if (transaction && transaction.category === 'Membership' && transaction.memberId) {
            await this.syncMemberMembership(transaction.memberId as string, transaction.projectId);
          }

          // Revert PR from 'paid' → 'approved' when the linked bank tx is deleted (情景 E)
          if (transaction?.paymentRequestId) {
            const { PaymentRequestService } = await import('./paymentRequestService');
            await PaymentRequestService.revertPaid(transaction.paymentRequestId);
          }
        } catch (error) {
          console.error('Error deleting transaction:', error);
          throw error;
        }
      }
    );
  }

  // Delete project transaction
  static async deleteProjectTransaction(transactionId: string): Promise<void> {
    return withDevMode(
      async () => {
        console.log(`[Dev Mode] Mocking deletion for project transaction ${transactionId}`);

        // Clean up bank transactions in mock mode
        localMockTransactions.forEach((btx, idx) => {
          const btxLinkedIds = (btx as any).projectTransactionIds || [];
          if (btxLinkedIds.includes(transactionId)) {
            const newLinkedIds = btxLinkedIds.filter((id: string) => id !== transactionId);
            localMockTransactions[idx] = {
              ...btx,
              projectTransactionIds: newLinkedIds,
              projectTransactionId: newLinkedIds[0] || null,
              status: newLinkedIds.length > 0 ? 'Reconciled' : 'Cleared',
              ...(newLinkedIds.length === 0 ? { purpose: '' } : {}),
            } as Transaction;
          }
        });

        // Clean up splits in mock mode
        const splitsToClean = devModeSplits.filter(s => {
          const splitLinkedIds = (s as any).projectTransactionIds || [];
          return splitLinkedIds.includes(transactionId);
        });

        for (const split of splitsToClean) {
          const splitLinkedIds = (split as any).projectTransactionIds || [];
          const newLinkedIds = splitLinkedIds.filter((id: string) => id !== transactionId);
          if (split.autoGenerated && newLinkedIds.length === 0) {
            await this.deleteTransactionSplit(split.id);
          } else {
            const sIdx = devModeSplits.findIndex(s => s.id === split.id);
            if (sIdx !== -1) {
              devModeSplits[sIdx] = {
                ...devModeSplits[sIdx],
                projectTransactionIds: newLinkedIds,
                projectTransactionId: newLinkedIds[0] || null,
                ...(newLinkedIds.length === 0 ? { purpose: '' } : {}),
              } as any;
            }
          }
        }

        // Delete the project transaction itself
        localMockTransactions = localMockTransactions.filter(t => t.id !== transactionId);
        saveMockTransactions();
      },
      async () => {
    try {
      // Fetch transaction first to sync inventory if needed
      // Note: project transactions might be in either collection
      let transaction = await this.getTransactionById(transactionId);

      if (transaction && transaction.inventoryLinkId && transaction.inventoryQuantity) {
        // Remove stock movement if exists
        const { InventoryService } = await import('./inventoryService');
        await InventoryService.deleteStockMovementForRef(transactionId);
      }

      // 1. Clean up bank transactions linked directly
      const bankTxsQuery = query(
        collection(db, COLLECTIONS.TRANSACTIONS),
        where('projectTransactionIds', 'array-contains', transactionId)
      );
      const bankTxsSnapshot = await getDocs(bankTxsQuery);
      for (const docSnap of bankTxsSnapshot.docs) {
        const btx = docSnap.data() as Transaction;
        const btxLinkedIds = btx.projectTransactionIds || [];
        const newLinkedIds = btxLinkedIds.filter((id: string) => id !== transactionId);
        const willClear = newLinkedIds.length === 0;
        await updateDoc(doc(db, COLLECTIONS.TRANSACTIONS, docSnap.id), {
          projectTransactionIds: newLinkedIds,
          projectTransactionId: newLinkedIds[0] || null,
          status: willClear ? 'Cleared' : 'Reconciled',
          ...(willClear ? { purpose: '' } : {}),
        });
        // Revert PR from 'paid' → 'approved' when the matching bank tx is delinked (情景 E)
        if (willClear && btx.paymentRequestId) {
          const { PaymentRequestService } = await import('./paymentRequestService');
          await PaymentRequestService.revertPaid(btx.paymentRequestId);
        }
      }

      // 2. Clean up transaction splits linked to this project transaction
      const splitsQuery = query(
        collection(db, COLLECTIONS.TRANSACTION_SPLITS),
        where('projectTransactionIds', 'array-contains', transactionId)
      );
      const splitsSnapshot = await getDocs(splitsQuery);
      for (const docSnap of splitsSnapshot.docs) {
        const split = docSnap.data() as TransactionSplit;
        const splitLinkedIds = (split as any).projectTransactionIds || [];
        const newLinkedIds = splitLinkedIds.filter((id: string) => id !== transactionId);
        
        if (split.autoGenerated && newLinkedIds.length === 0) {
          await this.deleteTransactionSplit(docSnap.id);
        } else {
          await updateDoc(doc(db, COLLECTIONS.TRANSACTION_SPLITS, docSnap.id), {
            projectTransactionIds: newLinkedIds,
            projectTransactionId: newLinkedIds[0] || null,
            ...(newLinkedIds.length === 0 ? { purpose: '' } : {}),
            updatedAt: Timestamp.now(),
          });
        }

        // Revert parent bank tx status when split is delinked (情景 W / HH / OO)
        if (newLinkedIds.length === 0 && !split.autoGenerated) {
          const parentBankTxDoc = await getDoc(doc(db, COLLECTIONS.TRANSACTIONS, split.parentTransactionId));
          if (parentBankTxDoc.exists()) {
            const allParentSplits = await this.getTransactionSplits(split.parentTransactionId);
            const anyLinked = allParentSplits.some(s => s.id !== docSnap.id && (s.projectTransactionIds?.length ?? 0) > 0);
            await updateDoc(doc(db, COLLECTIONS.TRANSACTIONS, split.parentTransactionId), {
              status: anyLinked ? 'Partially Reconciled' : 'Cleared',
              updatedAt: Timestamp.now(),
            });
          }
        }
      }

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
    );
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
      console.error('Error syncing transaction with inventory:', error);
    }
  }

  /**
   * Synchronize member membership summary based on transactions
   * @param includeTransactions Merged immediately after updateDoc to avoid query lag missing fresh links
   */
  static async syncMemberMembership(
    memberId: string,
    projectId?: string,
    options?: { includeTransactions?: Transaction[] }
  ): Promise<void> {
    return withDevMode(
      () => {},
      async () => {
    try {
      // 1. Parse year from projectId (e.g., "2026 membership")
      const yearMatch = projectId?.match(/^(\d+)/);
      if (!yearMatch) return;
      const year = yearMatch[1];
      const yearNum = parseInt(year, 10);
      const canonicalProjectId = this.getMembershipProjectIdFromYear(yearNum) || projectId;

      // 2. Fetch membership transactions for member (filter by year in memory — resilient to projectId variants)
      // Single-field query avoids requiring a composite (memberId + category) index in Firestore
      const q = query(
        collection(db, COLLECTIONS.TRANSACTIONS),
        where('memberId', '==', memberId)
      );
      const snapshot = await getDocs(q);
      const queriedTransactions = snapshot.docs
        .map(d => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            date: this.normalizeTransactionDate(data.date),
          } as Transaction;
        })
        .filter(tx => tx.category === 'Membership' && this.transactionBelongsToMembershipYear(tx, yearNum));

      const transactions = this.mergeMembershipTransactionsForYear(
        queriedTransactions,
        options?.includeTransactions,
        memberId,
        yearNum
      );

      // Include split records too. Split membership payments carry year/memberId on the split,
      // while date/type/bank details live on the parent transaction.
      const splitQuery = query(
        collection(db, COLLECTIONS.TRANSACTION_SPLITS),
        where('memberId', '==', memberId),
        where('category', '==', 'Membership'),
        where('year', '==', yearNum)
      );
      const splitSnapshot = await getDocs(splitQuery);
      const splitTransactions: Transaction[] = [];
      for (const splitDoc of splitSnapshot.docs) {
        const split = { id: splitDoc.id, ...splitDoc.data() } as TransactionSplit;
        const parentDoc = await getDoc(doc(db, COLLECTIONS.TRANSACTIONS, split.parentTransactionId));
        const parent = parentDoc.exists() ? parentDoc.data() : {};
        splitTransactions.push({
          id: split.id,
          date: this.normalizeTransactionDate((parent as any).date),
          description: split.description,
          purpose: split.purpose,
          amount: split.amount,
          type: (parent as any).type || 'Income',
          category: 'Membership',
          status: (parent as any).status || 'Pending',
          projectId: canonicalProjectId,
          memberId,
          parentTransactionId: split.parentTransactionId,
        } as Transaction);
      }

      const allMembershipTransactions = [...transactions, ...splitTransactions];

      // 3. Calculate total amount — only money that has actually cleared/reconciled counts.
      // A Pending transaction (e.g. just created by initiateDuesRenewal, not yet paid) must
      // NOT count toward "paid", or the member shows as paid before any money moves.
      const clearedMembershipTransactions = allMembershipTransactions.filter(
        (tx) => tx.status === 'Cleared' || tx.status === 'Reconciled' || tx.status === 'Partially Reconciled'
      );
      const totalAmount = clearedMembershipTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
      const latestTx = [...allMembershipTransactions].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0];
      const transactionIds = allMembershipTransactions.map(t => t.id).filter(Boolean) as string[];
      const membershipPurpose = latestTx
        ? (latestTx.purpose || latestTx.description || undefined)
        : undefined;
      const paymentDate = latestTx ? latestTx.date : undefined;

      // 4. Fetch the member to get current membershipType and existing membership data
      const memberRef = doc(db, COLLECTIONS.MEMBERS, memberId);
      const memberDoc = await getFirestoreDoc(memberRef);
      if (!memberDoc.exists()) return;
      const member = memberDoc.data() as any;
      const currentMembership = member.membership || {};
      const yearStr = year;

      const type = member.membershipType || 'Probation';
      const configRules = await MembershipConfigService.getRules();
      const duesAmount = currentMembership[yearStr]?.dues ?? configRules[type]?.duesAmount ?? MembershipDues[type as keyof typeof MembershipDues] ?? 0;

      // No linked membership transactions for this member/year:
      // rollback linkage-derived fields and reset to pending summary.
      // Exception: Inactive members retain their historical dues record (情景 L).
      if (allMembershipTransactions.length === 0 && member.role === 'INACTIVE') {
        return;
      }
      if (allMembershipTransactions.length === 0) {
        currentMembership[yearStr] = {
          year: yearNum,
          dues: duesAmount,
          amount: 0,
          status: 'pending',
          transactionId: [],
        };

        const zeroTxUpdates: any = {
          membership: currentMembership,
          updatedAt: Timestamp.now(),
        };

        // Revert to Guest only when: promoted via approval flow AND entry fee not yet confirmed paid.
        // If hasPaidInitiationFee=true the RM350 was already collected — deleting a renewal tx
        // must never strip their Probation status.
        const hasPaidFee = member.jciCareer?.hasPaidInitiationFee ?? member.hasPaidInitiationFee ?? false;
        if (member.membershipType === 'Probation'
            && member.role === 'MEMBER'
            && member.probationApprovedAt
            && !hasPaidFee) {
          zeroTxUpdates.role = 'GUEST';
          zeroTxUpdates.membershipType = 'Guest';
          zeroTxUpdates.probationApprovedBy = null;
          zeroTxUpdates.probationApprovedAt = null;
          zeroTxUpdates.probationTasks = null;
        }

        await updateDoc(memberRef, zeroTxUpdates);
        return;
      }

      // 5. Determine status based on amount - dues
      let status: MembershipStatus = 'pending';
      const balance = totalAmount - duesAmount;

      if (totalAmount === 0) {
        status = 'pending';
      } else if (balance === 0) {
        status = 'paid';
      } else if (balance > 0) {
        status = 'over paid';
      } else {
        status = 'partial';
      }

      // 6. Update member.membership[year]
      currentMembership[yearStr] = {
        year: yearNum,
        dues: duesAmount,
        amount: totalAmount,
        status: status,
        transactionId: transactionIds,
        purpose: membershipPurpose,
        paymentDate: paymentDate ?? null,
      };

      const updates: any = {
        membership: currentMembership,
        updatedAt: Timestamp.now()
      };

      // 7. Mark entry fee paid when Guest's payment clears — promotion to Probation
      //    requires explicit board approval (President / Secretary / Honorary Treasurer)
      //    via GuestManagementView. Do NOT auto-promote here.
      if (status === 'paid' || status === 'over paid') {
        if (!(member.jciCareer?.hasPaidInitiationFee ?? member.hasPaidInitiationFee)) {
          updates['jciCareer.hasPaidInitiationFee'] = true;
          updates.hasPaidInitiationFee = true;
        }
      }

      await updateDoc(memberRef, updates);

      console.log(`Synced membership for member ${memberId} year ${year}. Status: ${status}, Amount: ${totalAmount}`);
    } catch (error) {
      console.error('Error syncing member membership:', error);
    }
      }
    );
  }

  private static normalizeTransactionDate(date: unknown): string {
    if (!date) return new Date().toISOString();
    if (typeof date === 'string') return date;
    if (typeof date === 'object' && date !== null && 'toDate' in date && typeof (date as { toDate: () => Date }).toDate === 'function') {
      return (date as { toDate: () => Date }).toDate().toISOString();
    }
    return new Date(date as string | number).toISOString();
  }

  private static transactionBelongsToMembershipYear(tx: Transaction, yearNum: number): boolean {
    const fromProject = this.getMembershipYearFromProjectId(tx.projectId);
    if (fromProject !== undefined) return fromProject === yearNum;
    return new Date(this.normalizeTransactionDate(tx.date)).getFullYear() === yearNum;
  }

  private static mergeMembershipTransactionsForYear(
    queried: Transaction[],
    included: Transaction[] | undefined,
    memberId: string,
    yearNum: number
  ): Transaction[] {
    const byId = new Map<string, Transaction>();
    const add = (tx: Transaction) => {
      if (!tx.id) return;
      if (tx.memberId !== memberId) return;
      if (tx.category !== 'Membership') return;
      if (!this.transactionBelongsToMembershipYear(tx, yearNum)) return;
      byId.set(tx.id, {
        ...tx,
        date: this.normalizeTransactionDate(tx.date),
      });
    };
    queried.forEach(add);
    (included ?? []).forEach(add);
    return Array.from(byId.values());
  }

  private static getMembershipYearFromProjectId(projectId?: string): number | undefined {
    const year = projectId?.match(/^(\d+)/)?.[1];
    return year ? parseInt(year, 10) : undefined;
  }

  private static getMembershipProjectIdFromYear(year?: number): string | undefined {
    return year ? `${year} membership` : undefined;
  }

  // Get all bank accounts with dynamic balance
  static async getAllBankAccounts(includeBalance: boolean = true): Promise<BankAccount[]> {
    return withDevMode(
      () => MOCK_ACCOUNTS,
      () => apiCache.getOrSet(
        `${FINANCE_CACHE_PREFIX}bankAccounts:${includeBalance ? 'withBalance' : 'noBalance'}`,
        async () => {
          try {
            if (!includeBalance) {
              const accountsSnapshot = await getDocs(collection(db, COLLECTIONS.BANK_ACCOUNTS));
              return accountsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                lastReconciled: doc.data().lastReconciled?.toDate?.()?.toISOString() || doc.data().lastReconciled,
              } as BankAccount));
            }

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

            return accounts.map(account => {
              const accountTransactions = transactions.filter(t => t.bankAccountId === account.id && !t.isSplitChild);
              const transactionSum = accountTransactions.reduce((sum, t) => {
                return sum + (t.type === 'Income' ? t.amount : -Math.abs(t.amount));
              }, 0);
              return { ...account, balance: (account.initialBalance || 0) + transactionSum };
            });
          } catch (error) {
            console.error('Error fetching bank accounts:', error);
            throw error;
          }
        },
        TX_CACHE_TTL
      )
    );
  }

  // Create bank account
  static async createBankAccount(accountData: Omit<BankAccount, 'id'>): Promise<string> {
    return withDevMode(
      () => {
        console.log('[Dev Mode] Mocking bank account creation');
        return `mock-acc-${Date.now()}`;
      },
      async () => {
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
    );
  }

  // Update bank account
  static async updateBankAccount(accountId: string, updates: Partial<BankAccount>): Promise<void> {
    return withDevMode(
      () => {
        console.log(`[Dev Mode] Mocking update for bank account ${accountId}`);
      },
      async () => {
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
    );
  }

  // Delete bank account — guarded: refuses if linked transactions exist (情景 BB)
  static async deleteBankAccount(accountId: string): Promise<void> {
    return withDevMode(
      () => { console.log(`[Dev Mode] Mocking delete for bank account ${accountId}`); },
      async () => {
        const txQuery = query(
          collection(db, COLLECTIONS.TRANSACTIONS),
          where('bankAccountId', '==', accountId),
          limit(1)
        );
        const txSnap = await getDocs(txQuery);
        if (!txSnap.empty) {
          throw new Error('Cannot delete a bank account that has linked transactions. Reassign or delete the transactions first.');
        }
        await deleteDoc(doc(db, COLLECTIONS.BANK_ACCOUNTS, accountId));
      }
    );
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
      const transactions = await this.getAllTransactions(year);
      const targetYear = year || new Date().getFullYear();

      // Flatten transactions: regular transactions (excluding isSplit) + split children
      const flattenedTransactions: Transaction[] = [];
      const allSplits = await this.getAllTransactionSplits(year);
      const splitsMap: Record<string, TransactionSplit[]> = {};
      allSplits.forEach(s => {
        if (!splitsMap[s.parentTransactionId]) splitsMap[s.parentTransactionId] = [];
        splitsMap[s.parentTransactionId].push(s);
      });

      transactions.forEach(tx => {
        if (tx.isSplit && tx.splitIds && tx.splitIds.length > 0) {
          const splits = splitsMap[tx.id] || [];
          splits.forEach(split => {
            if (!split.category) return; // skip uncategorized remainder splits in reports
            flattenedTransactions.push({
              ...tx,
              id: split.id,
              category: split.category as Transaction['category'],
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
  // Handles membership types: Probation (RM300), Official (RM300), Honorary (RM0), Senator (RM0), Visiting (RM500), Associate (RM50)
  // All non-Guest first-year members also pay a one-time RM50 registration fee.
  static async initiateDuesRenewal(year: number): Promise<{
    totalMembers: number;
    renewalsByType: Record<string, number>;
    notificationsSent: number;
    validationErrors: Array<{ memberId: string; error: string }>;
  }> {
    return withDevMode(
      () => {
        console.log(`[Dev Mode] Would initiate dues renewal for year ${year}`);
        return {
          totalMembers: 0,
          renewalsByType: {},
          notificationsSent: 0,
          validationErrors: []
        };
      },
      async () => {
    try {
      const { MembersService } = await import('./membersService');
      const { CommunicationService } = await import('./communicationService');
      const { MembershipDues } = await import('../types');
      const rules = await MembershipConfigService.getRules();

      // Fetch all Membership transactions once — reused for both renewal-detection and duplicate-check
      const allMembershipTransactions = await this.getTransactionsByCategory('Membership');
      const previousYearPaid = allMembershipTransactions.filter(t => {
        const transactionYear = new Date(t.date).getFullYear();
        return transactionYear === year - 1 && t.type === 'Income' && t.status === 'Cleared';
      });

      const memberIds = [...new Set(previousYearPaid.map(t => t.memberId).filter(Boolean))];

      let renewalsByType: Record<string, number> = {
        Probation: 0,
        Official: 0,
        Honorary: 0,
        Senator: 0,
        Visiting: 0,
        Associate: 0,
      };
      let notificationsSent = 0;
      const validationErrors: Array<{ memberId: string; error: string }> = [];

      for (const memberId of memberIds) {
        try {
          const member = await MembersService.getMemberById(memberId);
          if (!member) continue;

          // Skip inactive members — they retain historical records but do not renew
          if ((member.role as string) === 'INACTIVE') continue;

          // Check if renewal already exists — reuse the already-fetched list (M-A: no O(N) inner query)
          const alreadyRenewed = allMembershipTransactions.some(t => {
            const transactionYear = new Date(t.date).getFullYear();
            return transactionYear === year && t.memberId === memberId && t.type === 'Income';
          });

          if (alreadyRenewed) continue;

          // Determine membership type (default to 'Official' if not set)
          const membershipType = member.membershipType || 'Official';

          // Guest pays a one-time entry fee (RM350) when joining — they have no annual renewal dues.
          // After paying, they are promoted to Probation and renew as Probation going forward.
          if (membershipType === 'Guest') continue;

          // Validate membership type eligibility — check nested field first, fall back to flat
          if (membershipType === 'Visiting') {
            const nationality = member.general?.nationality ?? member.nationality;
            if (nationality === 'Malaysia' || !nationality) {
              validationErrors.push({
                memberId,
                error: `Visiting member ${member.name} must be a non-Malaysian citizen`,
              });
              continue;
            }
          }

          if (membershipType === 'Senator') {
            const isSenatorCertified = member.jciCareer?.senatorship?.certified ?? member.senatorCertified ?? false;
            if (!isSenatorCertified) {
              validationErrors.push({
                memberId,
                error: `Senator ${member.name} does not have valid senator certification`,
              });
              continue;
            }
          }

          // Get dues amount for membership type from config (canonical source)
          const baseDuesAmount = rules[membershipType]?.duesAmount ?? MembershipDues[membershipType as keyof typeof MembershipDues] ?? 0;

          // Skip types with RM0 dues (Honorary, Senator) — no transaction needed
          if (baseDuesAmount === 0) continue;

          // Add RM50 registration fee if member has never paid it before (first-time non-Guest members)
          const hasPaidFee = member.jciCareer?.hasPaidInitiationFee ?? member.hasPaidInitiationFee ?? false;
          const registrationFee = hasPaidFee ? 0 : 50;
          const duesAmount = baseDuesAmount + registrationFee;

          // Create renewal transaction
          const renewalDate = new Date(year, 0, 1);
          const purpose = resolveMembershipPurpose(duesAmount, year, rules, membershipType);
          await this.createTransaction({
            type: 'Income',
            category: 'Membership',
            amount: duesAmount,
            description: `${year} Membership Dues - ${membershipType.charAt(0).toUpperCase() + membershipType.slice(1)} Member`,
            purpose,
            memberId: memberId,
            status: 'Pending',
            date: renewalDate.toISOString(),
            transactionType: 'dues',
            projectId: `${year} membership`,
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

          // Member membership record will be automatically synced by createTransaction
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
    );
  }

  // Send reminder notifications for overdue dues (excludes senators)
  static async sendDuesReminders(year: number, daysOverdue: number = 30): Promise<number> {
    return withDevMode(
      () => {
        console.log(`[Dev Mode] Would send dues reminders for year ${year}`);
        return 0;
      },
      async () => {
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

          // Skip types exempt from annual dues (zero-dues or one-time entry fee only)
          if (member.membershipType === 'Senator' || member.membershipType === 'Honorary' || member.membershipType === 'Guest') continue;

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
    );
  }

  // Get dues renewal status for a specific year
  static async getDuesRenewalStatus(year: number): Promise<{
    totalMembers: number;
    byType: Record<string, { total: number; paid: number; pending: number; overdue: number }>;
    byCategory: { renewal: number; new: number };
  }> {
    return withDevMode(
      () => ({
        totalMembers: 0,
        byType: {
          Probation: { total: 0, paid: 0, pending: 0, overdue: 0 },
          Official: { total: 0, paid: 0, pending: 0, overdue: 0 },
          Honorary: { total: 0, paid: 0, pending: 0, overdue: 0 },
          Senator: { total: 0, paid: 0, pending: 0, overdue: 0 },
          Visiting: { total: 0, paid: 0, pending: 0, overdue: 0 },
          Associate: { total: 0, paid: 0, pending: 0, overdue: 0 },
        },
        byCategory: { renewal: 0, new: 0 },
      }),
      async () => {
    try {
      const { MembersService } = await import('./membersService');
      const duesTransactions = await this.getTransactionsByCategory('Membership');

      const yearTransactions = duesTransactions.filter(t => {
        const transactionYear = new Date(t.date).getFullYear();
        return transactionYear === year && t.type === 'Income';
      });

      const byType: Record<string, { total: number; paid: number; pending: number; overdue: number }> = {
        Probation: { total: 0, paid: 0, pending: 0, overdue: 0 },
        Official: { total: 0, paid: 0, pending: 0, overdue: 0 },
        Honorary: { total: 0, paid: 0, pending: 0, overdue: 0 },
        Senator: { total: 0, paid: 0, pending: 0, overdue: 0 },
        Visiting: { total: 0, paid: 0, pending: 0, overdue: 0 },
        Associate: { total: 0, paid: 0, pending: 0, overdue: 0 },
      };

      // Batch-fetch all relevant members once instead of N+1 reads
      const uniqueMemberIds = [...new Set(yearTransactions.map(t => t.memberId).filter(Boolean) as string[])];
      const memberDocs = await Promise.all(uniqueMemberIds.map(id => MembersService.getMemberById(id)));
      const memberMap = new Map(uniqueMemberIds.map((id, i) => [id, memberDocs[i]]));

      let renewalCount = 0;
      let newCount = 0;

      for (const transaction of yearTransactions) {
        if (!transaction.memberId) continue;

        const member = memberMap.get(transaction.memberId);
        if (!member) continue;

        const membershipType = member.membershipType || 'Official';
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
    );
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
    return withDevMode(
      () => [] as any[],
      async () => {
    try {
      const { MembersService } = await import('./membersService');
      const { MembershipDues } = await import('../types');
      const [allMembers, configRules, duesTransactions] = await Promise.all([
        MembersService.getAllMembers(),
        MembershipConfigService.getRules(),
        this.getTransactionsByCategory('Membership'),
      ]);

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
        const membershipType = member.membershipType || 'Official';
        // Guest pays a one-time entry fee only — no annual renewal dues to list.
        if (membershipType === 'Guest') continue;
        const duesYear = filters?.duesYear ?? new Date().getFullYear();
        const baseDues = configRules[membershipType as keyof typeof configRules]?.duesAmount ?? MembershipDues[membershipType as keyof typeof MembershipDues] ?? 0;
        const hasPaidFee = member.jciCareer?.hasPaidInitiationFee ?? member.hasPaidInitiationFee ?? false;
        const joinYear = member.joinDate ? new Date(member.joinDate).getFullYear() : null;
        const isFirstYear = joinYear === duesYear;
        const duesAmount = baseDues + (isFirstYear && !hasPaidFee ? 50 : 0);

        // Find member's dues transaction for the year
        const memberTransactions = duesTransactions.filter(t =>
          t.memberId === member.id &&
          new Date(t.date).getFullYear() === duesYear &&
          t.type === 'Income'
        );

        if (memberTransactions.length === 0) continue;

        // Aggregate all transactions for this member+year — a member may have multiple
        // (e.g. partial + top-up, or duplicate initiateDuesRenewal runs)
        const clearedTotal = memberTransactions
          .filter(t => t.status === 'Cleared' || t.status === 'Reconciled')
          .reduce((s, t) => s + (t.amount ?? 0), 0);
        const oldestPending = memberTransactions
          .filter(t => t.status === 'Pending')
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

        let paymentStatus: 'paid' | 'pending' | 'overdue' = 'pending';
        if (clearedTotal >= duesAmount) {
          paymentStatus = 'paid';
        } else if (oldestPending) {
          const daysSinceDue = Math.floor((new Date().getTime() - new Date(oldestPending.date).getTime()) / (1000 * 60 * 60 * 24));
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
          paymentDate: undefined, // Will be updated when fully migrated
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
    );
  }

  // Process dues payment and update member status
  static async processDuesPayment(
    memberId: string,
    duesYear: number,
    paymentAmount: number,
    paymentDate: string
  ): Promise<{ success: boolean; error?: string }> {
    return withDevMode<{ success: boolean; error?: string }>(
      () => {
        console.log(`[Dev Mode] Would process dues payment for member ${memberId}`);
        return { success: true };
      },
      async () => {
    try {
      const { MembersService } = await import('./membersService');
      const { MembershipDues } = await import('../types');

      const member = await MembersService.getMemberById(memberId);
      if (!member) {
        return { success: false, error: 'Member not found' };
      }

      const membershipType = member.membershipType || 'Official';
      // Same source of truth as initiateDuesRenewal — a configured rule always wins over
      // the static fallback, otherwise a dues-amount change in config breaks every payment.
      const rules = await MembershipConfigService.getRules();
      const baseDues = rules[membershipType]?.duesAmount ?? MembershipDues[membershipType as keyof typeof MembershipDues] ?? 0;
      const hasPaidFeeFlag = member.jciCareer?.hasPaidInitiationFee ?? member.hasPaidInitiationFee ?? false;
      const surcharge = (!hasPaidFeeFlag && membershipType !== 'Guest') ? 50 : 0;
      const expectedAmount = baseDues + surcharge;

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

      // Member membership record will be automatically synced by updateTransaction

      return { success: true };
    } catch (error) {
      console.error('Error processing dues payment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
      }
    );
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
    return withDevMode(
      () => ({
        totalBalance: 10000,
        byType: { project: 2500, operations: 3500, dues: 2000, merchandise: 2000 },
      }),
      async () => {
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
    );
  }

  // Detect reconciliation discrepancies
  static async detectDiscrepancies(
    accountId: string,
    statementBalance: number,
    reconciliationDate: string
  ): Promise<ReconciliationDiscrepancy[]> {
    return withDevMode(
      () => [] as ReconciliationDiscrepancy[],
      async () => {
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
    );
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
    return withDevMode(
      () => {
        console.log(`[Dev Mode] Would reconcile bank account ${accountId}`);
        return 'mock-reconciliation-id';
      },
      async () => {
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

      // Mark transactions as reconciled (only if no discrepancies).
      // Only `Cleared` transactions qualify — a Pending transaction hasn't actually
      // cleared the bank yet, so folding it into a balanced reconciliation would
      // "launder" unconfirmed money as if it had been verified against the statement.
      if (discrepancies.length === 0) {
        const allTransactions = await this.getAllTransactions();
        const accountTransactions = allTransactions.filter(
          t => t.bankAccountId === accountId &&
            t.status === 'Cleared' &&
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
    );
  }

  // Get reconciliation history
  static async getReconciliationHistory(accountId: string): Promise<ReconciliationRecord[]> {
    return withDevMode(
      () => [] as ReconciliationRecord[],
      async () => {
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
    );
  }

  // Get unmatched transactions for reconciliation matching UI
  // Returns bank_import and manual transactions separately for the given account
  static async getUnmatchedForReconciliation(accountId: string): Promise<{
    bankImports: Transaction[];
    manualEntries: Transaction[];
  }> {
    const all = await this.getAllTransactions();
    const unreconciled = all.filter(
      t => t.bankAccountId === accountId && t.status !== 'Reconciled' && !t.isSplitChild
    );
    return {
      bankImports: unreconciled.filter(t => t.source === 'bank_import'),
      manualEntries: unreconciled.filter(t => t.source !== 'bank_import'),
    };
  }

  // Link a bank import transaction to a manually-entered transaction
  // Sets matchStatus:'full' on the bank import and records the manual tx id on it
  static async matchTransactions(
    bankTxId: string,
    manualTxId: string,
    reconciledBy: string
  ): Promise<void> {
    return withDevMode(
      () => {
        localMockTransactions = localMockTransactions.map(t => {
          if (t.id === bankTxId || t.id === manualTxId) {
            return { ...t, matchStatus: 'full' as const, matchedBankTxIds: [t.id === bankTxId ? manualTxId : bankTxId], status: 'Reconciled' as const, reconciledBy, reconciledAt: new Date().toISOString(), prevStatus: t.status };
          }
          return t;
        });
        saveMockTransactions();
      },
      async () => {
        const now = Timestamp.now();
        // Record the status each side had before matching, so unmatchTransactions can
        // restore it exactly instead of guessing 'Cleared' for everything (a Pending
        // event-income transaction must not come back from unmatch as if it were confirmed).
        const [bankSnap, manualSnap] = await Promise.all([
          getDoc(doc(db, COLLECTIONS.TRANSACTIONS, bankTxId)),
          getDoc(doc(db, COLLECTIONS.TRANSACTIONS, manualTxId)),
        ]);
        const bankPrevStatus = bankSnap.exists() ? (bankSnap.data() as Transaction).status : 'Cleared';
        const manualPrevStatus = manualSnap.exists() ? (manualSnap.data() as Transaction).status : 'Cleared';

        await updateDoc(doc(db, COLLECTIONS.TRANSACTIONS, bankTxId), {
          matchStatus: 'full',
          matchedBankTxIds: [manualTxId],
          status: 'Reconciled',
          prevStatus: bankPrevStatus,
          reconciledBy,
          reconciledAt: now,
        });
        await updateDoc(doc(db, COLLECTIONS.TRANSACTIONS, manualTxId), {
          matchStatus: 'full',
          matchedBankTxIds: [bankTxId],
          status: 'Reconciled',
          prevStatus: manualPrevStatus,
          reconciledBy,
          reconciledAt: now,
        });
      }
    );
  }

  // Unmatch a previously matched pair — restores each side to the status it had before
  // matching (tracked via prevStatus), instead of blindly setting both to 'Cleared'.
  static async unmatchTransactions(txId1: string, txId2: string): Promise<void> {
    return withDevMode(
      () => {
        localMockTransactions = localMockTransactions.map(t => {
          if (t.id === txId1 || t.id === txId2) {
            return { ...t, matchStatus: undefined, matchedBankTxIds: undefined, status: (t.prevStatus ?? 'Cleared') as Transaction['status'], prevStatus: undefined, reconciledBy: undefined, reconciledAt: undefined };
          }
          return t;
        });
        saveMockTransactions();
      },
      async () => {
        const snaps = await Promise.all([txId1, txId2].map(id => getDoc(doc(db, COLLECTIONS.TRANSACTIONS, id))));
        for (const snap of snaps) {
          if (!snap.exists()) continue;
          const prevStatus = (snap.data() as Transaction).prevStatus ?? 'Cleared';
          await updateDoc(snap.ref, {
            matchStatus: null,
            matchedBankTxIds: null,
            status: prevStatus,
            prevStatus: null,
            reconciledBy: null,
            reconciledAt: null,
          });
        }
        // Revert any PR that was marked paid via this match pair (情景 E — unmatch path)
        for (const snap of snaps) {
          if (!snap.exists()) continue;
          const prId = (snap.data() as Transaction).paymentRequestId;
          if (prId) {
            const { PaymentRequestService } = await import('./paymentRequestService');
            await PaymentRequestService.revertPaid(prId).catch(err =>
              console.warn('[unmatchTransactions] revertPaid failed for PR', prId, err)
            );
            break; // only one tx in a pair links to a PR
          }
        }
      }
    );
  }

  // Get bank account by ID with dynamic balance
  static async getBankAccountById(accountId: string): Promise<BankAccount | null> {
    return withDevMode(
      () => MOCK_ACCOUNTS.find(a => a.id === accountId) || null,
      async () => {
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
    );
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

  /**
   * Cursor-based paginated transaction fetch (ordered by date desc).
   * Pass `lastDoc` from the previous page's result to advance the cursor.
   * Falls back to a mock slice in dev mode.
   */
  static async getTransactionsPaginated(
    pageSize: number = 100,
    lastDoc?: DocumentSnapshot
  ): Promise<{ transactions: Transaction[]; lastDoc: DocumentSnapshot | null; hasMore: boolean }> {
    return withDevMode(
      (): { transactions: Transaction[]; lastDoc: DocumentSnapshot | null; hasMore: boolean } => {
        const slice = localMockTransactions.slice(0, pageSize);
        return { transactions: slice, lastDoc: null, hasMore: false };
      },
      async () => {
        let q = query(
          collection(db, COLLECTIONS.TRANSACTIONS),
          orderBy('date', 'desc'),
          limit(pageSize)
        );
        if (lastDoc) {
          q = query(
            collection(db, COLLECTIONS.TRANSACTIONS),
            orderBy('date', 'desc'),
            startAfter(lastDoc),
            limit(pageSize)
          );
        }
        const snapshot = await getDocs(q);
        const transactions = snapshot.docs.map(d => {
          const data = d.data() as any;
          return {
            id: d.id,
            ...data,
            date: data.date?.toDate?.()?.toISOString() || data.date,
          } as Transaction;
        });
        return {
          transactions,
          lastDoc: snapshot.docs[snapshot.docs.length - 1] ?? null,
          hasMore: snapshot.docs.length === pageSize,
        };
      }
    );
  }

  // ── Finance Alerts ────────────────────────────────────────────────────────

  static async getFinanceAlerts(onlyUnresolved = true): Promise<FinanceAlert[]> {
    return withDevMode(
      () => [],
      async () => {
        const q = onlyUnresolved
          ? query(collection(db, COLLECTIONS.FINANCE_ALERTS), where('resolved', '==', false))
          : collection(db, COLLECTIONS.FINANCE_ALERTS);
        const snap = await getDocs(q);
        return snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            type: data.type ?? '',
            message: data.message ?? '',
            transactionId: data.transactionId,
            billCode: data.billCode,
            eventRegistrationId: data.eventRegistrationId,
            paymentRequestId: data.paymentRequestId,
            resolved: data.resolved ?? false,
            resolvedAt: data.resolvedAt?.toDate?.()?.toISOString() ?? data.resolvedAt,
            resolvedBy: data.resolvedBy,
            createdAt: data.createdAt?.toDate?.()?.toISOString() ?? data.createdAt ?? new Date().toISOString(),
          } as FinanceAlert;
        });
      }
    );
  }

  static async resolveFinanceAlert(alertId: string, resolvedBy: string): Promise<void> {
    return withDevMode(
      () => {},
      () => updateDoc(doc(db, COLLECTIONS.FINANCE_ALERTS, alertId), {
        resolved: true,
        resolvedAt: Timestamp.now(),
        resolvedBy,
        updatedAt: Timestamp.now(),
      })
    );
  }

  // ── Void Transaction ──────────────────────────────────────────────────────

  static async voidTransaction(transactionId: string, reason: string, voidedBy: string): Promise<void> {
    return withDevMode(
      () => {},
      async () => {
        const ref = doc(db, COLLECTIONS.TRANSACTIONS, transactionId);
        const snap = await getDoc(ref);
        if (!snap.exists()) throw new Error('Transaction not found');
        const tx = snap.data() as Transaction;
        if (tx.status === 'Voided') throw new Error('Transaction is already voided');
        await updateDoc(ref, {
          status: 'Voided',
          voidedAt: Timestamp.now(),
          voidedBy,
          voidReason: reason,
          prevStatus: tx.status,
          updatedAt: Timestamp.now(),
        });
      }
    );
  }
}
