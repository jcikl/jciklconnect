// Event Budget Management Service
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
import { isDevMode } from '../utils/devMode';
import { FinanceService } from './financeService';
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
    if (isDevMode()) {
      return {
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
            status: 'Spent',
          },
          {
            id: 'bi2',
            category: 'Catering',
            description: 'Food and beverages',
            estimatedAmount: 1500,
            actualAmount: 1200,
            status: 'Spent',
          },
          {
            id: 'bi3',
            category: 'Marketing',
            description: 'Promotional materials',
            estimatedAmount: 500,
            status: 'Planned',
          },
        ],
        status: 'Active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    try {
      const budgetQuery = query(
        collection(db, COLLECTIONS.EVENTS || 'eventBudgets'),
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

  // Create or update event budget
  static async saveEventBudget(budgetData: Omit<EventBudget, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    if (isDevMode()) {
      const newId = `mock-budget-${Date.now()}`;
      console.log(`[DEV MODE] Simulating creation of event budget with ID: ${newId}`);
      return newId;
    }

    try {
      const existingBudget = await this.getEventBudget(budgetData.eventId);
      
      if (existingBudget && existingBudget.id) {
        // Update existing budget
        await updateDoc(doc(db, COLLECTIONS.EVENTS || 'eventBudgets', existingBudget.id), {
          ...budgetData,
          updatedAt: Timestamp.now(),
        });
        return existingBudget.id;
      } else {
        // Create new budget
        const newBudget: any = {
          ...budgetData,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };
        if (budgetData.approvedAt) {
          newBudget.approvedAt = Timestamp.fromDate(budgetData.approvedAt as Date);
        }
        
        const docRef = await addDoc(collection(db, COLLECTIONS.EVENTS || 'eventBudgets'), newBudget);
        return docRef.id;
      }
    } catch (error) {
      console.error('Error saving event budget:', error);
      throw error;
    }
  }

  // Add budget item
  static async addBudgetItem(eventId: string, item: Omit<BudgetItem, 'id'>): Promise<void> {
    const budget = await this.getEventBudget(eventId);
    if (!budget) {
      throw new Error('Event budget not found');
    }

    const newItem: BudgetItem = {
      ...item,
      id: `bi-${Date.now()}`,
    };

    const updatedItems = [...(budget.budgetItems || []), newItem];
    
    await this.saveEventBudget({
      ...budget,
      budgetItems: updatedItems,
    });
  }

  // Update budget item
  static async updateBudgetItem(eventId: string, itemId: string, updates: Partial<BudgetItem>): Promise<void> {
    const budget = await this.getEventBudget(eventId);
    if (!budget) {
      throw new Error('Event budget not found');
    }

    const updatedItems = budget.budgetItems.map(item =>
      item.id === itemId ? { ...item, ...updates } : item
    );

    await this.saveEventBudget({
      ...budget,
      budgetItems: updatedItems,
    });
  }

  // Delete budget item
  static async deleteBudgetItem(eventId: string, itemId: string): Promise<void> {
    const budget = await this.getEventBudget(eventId);
    if (!budget) {
      throw new Error('Event budget not found');
    }

    const updatedItems = budget.budgetItems.filter(item => item.id !== itemId);

    await this.saveEventBudget({
      ...budget,
      budgetItems: updatedItems,
    });
  }

  // Reconcile event budget with financial transactions
  static async reconcileEventBudget(eventId: string): Promise<{
    totalSpent: number;
    totalIncome: number;
    transactions: Transaction[];
  }> {
    try {
      // Get all transactions related to this event
      const allTransactions = await FinanceService.getAllTransactions();
      const eventTransactions = allTransactions.filter(
        t => (t.description && t.description.toLowerCase().includes(eventId.toLowerCase()))
      );

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
  static async approveBudget(eventId: string, approvedBy: string): Promise<void> {
    const budget = await this.getEventBudget(eventId);
    if (!budget) {
      throw new Error('Event budget not found');
    }

    await this.saveEventBudget({
      ...budget,
      status: 'Approved',
      approvedBy,
      approvedAt: new Date(),
    });
  }
}

