// Event Budget Management Service
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  runTransaction,
  arrayUnion,
  arrayRemove,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { withDevMode } from '../utils/devMode';
import { FinanceService } from './financeService';
import { EventsService } from './eventsService';
import { Transaction } from '../types';

export interface EventBudget {
  id?: string;
  eventId: string;
  eventTitle: string;
  allocatedBudget: number;
  spent: number;
  income: number; // Event fees, sponsorships, etc.
  currency: string;
  budgetItems: BudgetItem[];
  status: 'Draft' | 'Approved' | 'Active' | 'Closed';
  approvedBy?: string;
  approvedAt?: Date | Timestamp;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

export interface BudgetItem {
  id: string;
  category: string;
  description: string;
  estimatedAmount: number;
  actualAmount?: number;
  status: 'Planned' | 'Approved' | 'Spent' | 'Cancelled';
  notes?: string;
}

export class EventBudgetService {
  // Get budget for an event
  static async getEventBudget(eventId: string): Promise<EventBudget | null> {
    return withDevMode<EventBudget | null>(
      () => ({
        id: 'eb1',
        eventId,
        eventTitle: 'Sample Event',
        allocatedBudget: 5000,
        spent: 3200,
        income: 1500,
        currency: 'USD',
        budgetItems: [
          {
            id: 'bi1',
            category: 'Venue',
            description: 'Event venue rental',
            estimatedAmount: 2000,
            actualAmount: 2000,
            status: 'Spent' as const,
          },
          {
            id: 'bi2',
            category: 'Catering',
            description: 'Food and beverages',
            estimatedAmount: 1500,
            actualAmount: 1200,
            status: 'Spent' as const,
          },
          {
            id: 'bi3',
            category: 'Marketing',
            description: 'Promotional materials',
            estimatedAmount: 500,
            status: 'Planned' as const,
          },
        ],
        status: 'Active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      async () => {
        try {
          const budgetQuery = query(
            collection(db, COLLECTIONS.EVENT_BUDGETS),
            where('eventId', '==', eventId),
            limit(1)
          );
          const snapshot = await getDocs(budgetQuery);

          if (snapshot.empty) {
            return null;
          }

          const doc = snapshot.docs[0];
          return {
            id: doc.id,
            ...doc.data(),
            approvedAt: doc.data().approvedAt?.toDate(),
            createdAt: doc.data().createdAt?.toDate() || new Date(),
            updatedAt: doc.data().updatedAt?.toDate() || new Date(),
          } as EventBudget;
        } catch (error) {
          console.error('Error fetching event budget:', error);
          throw error;
        }
      }
    );
  }

  // Create or update event budget
  static async saveEventBudget(budgetData: Omit<EventBudget, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    return withDevMode(
      () => {
        const newId = `mock-budget-${Date.now()}`;
        console.log(`[DEV MODE] Simulating creation of event budget with ID: ${newId}`);
        return newId;
      },
      async () => {
        try {
          // Fix 11: use setDoc with deterministic doc ID (eventId) + merge:true so the
          // operation is idempotent and avoids the read-then-create/update race condition.
          const budgetRef = doc(db, COLLECTIONS.EVENT_BUDGETS, budgetData.eventId);
          const payload: any = {
            ...budgetData,
            updatedAt: Timestamp.now(),
          };
          if (budgetData.approvedAt) {
            payload.approvedAt = Timestamp.fromDate(budgetData.approvedAt as Date);
          }
          await setDoc(budgetRef, { ...payload, createdAt: Timestamp.now() }, { merge: true });
          EventsService.invalidateEventsCache();
          return budgetData.eventId;
        } catch (error) {
          console.error('Error saving event budget:', error);
          throw error;
        }
      }
    );
  }

  // Add budget item
  // Fix 12a: use arrayUnion instead of read-then-overwrite to avoid concurrency issues.
  static async addBudgetItem(eventId: string, item: Omit<BudgetItem, 'id'>): Promise<void> {
    const newItem: BudgetItem = {
      ...item,
      id: `bi-${Date.now()}`,
    };
    return withDevMode(
      async () => { console.log('[DEV MODE] addBudgetItem', newItem); },
      async () => {
        const budgetRef = doc(db, COLLECTIONS.EVENT_BUDGETS, eventId);
        await updateDoc(budgetRef, {
          budgetItems: arrayUnion(newItem),
          updatedAt: Timestamp.now(),
        });
        EventsService.invalidateEventsCache();
      }
    );
  }

  // Update budget item
  // Fix 12b: use runTransaction to read-modify-write the budgetItems array atomically.
  static async updateBudgetItem(eventId: string, itemId: string, updates: Partial<BudgetItem>): Promise<void> {
    return withDevMode(
      async () => { console.log('[DEV MODE] updateBudgetItem', itemId, updates); },
      async () => {
        const budgetRef = doc(db, COLLECTIONS.EVENT_BUDGETS, eventId);
        await runTransaction(db, async (txn) => {
          const snap = await txn.get(budgetRef);
          if (!snap.exists()) throw new Error('Event budget not found');
          const data = snap.data() as EventBudget;
          const updatedItems = (data.budgetItems || []).map(item =>
            item.id === itemId ? { ...item, ...updates } : item
          );
          txn.update(budgetRef, { budgetItems: updatedItems, updatedAt: Timestamp.now() });
        });
        EventsService.invalidateEventsCache();
      }
    );
  }

  // Delete budget item
  // Fix 12c: use arrayRemove instead of read-then-overwrite.
  static async deleteBudgetItem(eventId: string, itemId: string): Promise<void> {
    return withDevMode(
      async () => { console.log('[DEV MODE] deleteBudgetItem', itemId); },
      async () => {
        // arrayRemove requires exact object equality; use runTransaction to find and remove by id.
        const budgetRef = doc(db, COLLECTIONS.EVENT_BUDGETS, eventId);
        await runTransaction(db, async (txn) => {
          const snap = await txn.get(budgetRef);
          if (!snap.exists()) throw new Error('Event budget not found');
          const data = snap.data() as EventBudget;
          const itemToRemove = (data.budgetItems || []).find(i => i.id === itemId);
          if (itemToRemove) {
            txn.update(budgetRef, {
              budgetItems: arrayRemove(itemToRemove),
              updatedAt: Timestamp.now(),
            });
          }
        });
        EventsService.invalidateEventsCache();
      }
    );
  }

  // Reconcile event budget with financial transactions
  static async reconcileEventBudget(eventId: string): Promise<{
    totalSpent: number;
    totalIncome: number;
    transactions: Transaction[];
  }> {
    try {
      // Fix 14: removed full getAllTransactions() scan and description-match fallback —
      // they caused an O(N) full-collection read. Use only the targeted project query.
      const eventTransactions = await FinanceService.getBankTransactionsByProject(eventId);

      const totalSpent = eventTransactions
        .filter(t => t.type === 'Expense')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      const totalIncome = eventTransactions
        .filter(t => t.type === 'Income')
        .reduce((sum, t) => sum + t.amount, 0);

      // Update budget with actual amounts
      const budget = await this.getEventBudget(eventId);
      if (budget) {
        await this.saveEventBudget({
          ...budget,
          spent: totalSpent,
          income: totalIncome,
        });
      }

      return {
        totalSpent,
        totalIncome,
        transactions: eventTransactions,
      };
    } catch (error) {
      console.error('Error reconciling event budget:', error);
      throw error;
    }
  }

  // Approve budget
  // Fix 13: wrap in runTransaction with status pre-check so double-approval is impossible.
  static async approveBudget(eventId: string, approvedBy: string): Promise<void> {
    return withDevMode(
      async () => { console.log('[DEV MODE] approveBudget', eventId, approvedBy); },
      async () => {
        const budgetRef = doc(db, COLLECTIONS.EVENT_BUDGETS, eventId);
        await runTransaction(db, async (txn) => {
          const snap = await txn.get(budgetRef);
          if (!snap.exists()) throw new Error('Event budget not found');
          const currentStatus = (snap.data() as EventBudget).status;
          if (currentStatus !== 'Draft' && currentStatus !== 'Active') {
            throw new Error(`Cannot approve a budget with status "${currentStatus}" — only Draft or Active budgets can be approved.`);
          }
          txn.update(budgetRef, {
            status: 'Approved',
            approvedBy,
            approvedAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });
        });
        EventsService.invalidateEventsCache();
      }
    );
  }
}

