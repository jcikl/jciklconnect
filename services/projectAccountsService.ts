// Project Financial Accounts Service
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
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { isDevMode } from '../utils/devMode';
import { FinanceService } from './financeService';
import { Project } from '../types';

export interface ProjectAccount {
  id?: string;
  projectId: string;
  projectName: string;
  budget: number;
  allocated: number; // Amount allocated from main LO account
  income: number; // Project-specific income
  expenses: number; // Project-specific expenses
  balance: number; // Current balance (allocated + income - expenses)
  currency: string;
  transactions: string[]; // Transaction IDs linked to this project
  lastReconciled?: Date | Timestamp;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

export class ProjectAccountsService {
  // Get all project accounts
  static async getAllProjectAccounts(): Promise<ProjectAccount[]> {
    if (isDevMode()) {
      return [
        {
          id: 'pa1',
          projectId: 'p1',
          projectName: 'Youth Mentorship 2024',
          budget: 5000,
          allocated: 5000,
          income: 2000,
          expenses: 2100,
          balance: 4900,
          currency: 'USD',
          transactions: ['t1', 't2'],
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-15'),
        },
      ];
    }

    try {
      const snapshot = await getDocs(
        query(collection(db, COLLECTIONS.PROJECTS), orderBy('createdAt', 'desc'))
      );
      const projects = snapshot.docs
        .filter(d => !['Draft', 'Submitted', 'Under Review', 'Rejected'].includes(d.data().status ?? ''))
        .map(d => ({ id: d.id, ...d.data() } as Project));

      const accounts: ProjectAccount[] = [];
      for (const project of projects) {
        const transactions = await FinanceService.getTransactionsByCategory('Projects & Activities');
        const projectTransactions = transactions.filter(t => t.projectId === project.id);
        
        const income = projectTransactions
          .filter(t => t.type === 'Income')
          .reduce((sum, t) => sum + t.amount, 0);
        const expenses = projectTransactions
          .filter(t => t.type === 'Expense')
          .reduce((sum, t) => sum + Math.abs(t.amount), 0);

        accounts.push({
          id: `pa-${project.id}`,
          projectId: project.id,
          projectName: project.name,
          budget: project.budget || 0,
          allocated: project.budget || 0,
          income,
          expenses,
          balance: (project.budget || 0) + income - expenses,
          currency: 'USD',
          transactions: projectTransactions.map(t => t.id),
          createdAt: new Date(), // Project interface doesn't have createdAt/updatedAt
          updatedAt: new Date(),
        });
      }
      return accounts;
    } catch (error) {
      console.error('Error fetching project accounts:', error);
      throw error;
    }
  }

  // Get project account by project ID
  static async getProjectAccountByProjectId(projectId: string): Promise<ProjectAccount | null> {
    try {
      const accounts = await this.getAllProjectAccounts();
      return accounts.find(acc => acc.projectId === projectId) || null;
    } catch (error) {
      console.error('Error fetching project account:', error);
      throw error;
    }
  }

  // Reconcile project account with main LO financial accounts
  static async reconcileProjectAccount(projectId: string): Promise<{
    discrepancies: Array<{
      type: 'Missing Transaction' | 'Amount Mismatch' | 'Duplicate';
      description: string;
      projectAmount?: number;
      mainAccountAmount?: number;
      difference?: number;
    }>;
    reconciled: boolean;
  }> {
    try {
      const account = await this.getProjectAccountByProjectId(projectId);
      if (!account) {
        throw new Error('Project account not found');
      }

      // Get all transactions for this project from main LO accounts
      const projectTransactions = await FinanceService.getTransactionsByCategory('Projects & Activities');
      const projectRelatedTransactions = projectTransactions.filter(t => t.projectId === projectId);

      // Calculate totals from main LO accounts
      const mainAccountIncome = projectRelatedTransactions
        .filter(t => t.type === 'Income')
        .reduce((sum, t) => sum + t.amount, 0);
      const mainAccountExpenses = projectRelatedTransactions
        .filter(t => t.type === 'Expense')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      // Compare with project account totals
      const discrepancies: Array<{
        type: 'Missing Transaction' | 'Amount Mismatch' | 'Duplicate';
        description: string;
        projectAmount?: number;
        mainAccountAmount?: number;
        difference?: number;
      }> = [];

      // Check for income discrepancies
      if (Math.abs(account.income - mainAccountIncome) > 0.01) {
        discrepancies.push({
          type: 'Amount Mismatch',
          description: 'Project income mismatch',
          projectAmount: account.income,
          mainAccountAmount: mainAccountIncome,
          difference: account.income - mainAccountIncome,
        });
      }

      // Check for expense discrepancies
      if (Math.abs(account.expenses - mainAccountExpenses) > 0.01) {
        discrepancies.push({
          type: 'Amount Mismatch',
          description: 'Project expenses mismatch',
          projectAmount: account.expenses,
          mainAccountAmount: mainAccountExpenses,
          difference: account.expenses - mainAccountExpenses,
        });
      }

      // Update reconciliation timestamp
      const now = new Date();
      await updateDoc(doc(db, COLLECTIONS.PROJECTS, projectId), {
        lastReconciled: Timestamp.fromDate(now),
        updatedAt: Timestamp.now(),
      });

      console.log(`Reconciled project account for project ${projectId}: ${discrepancies.length} discrepancies found`);

      return {
        discrepancies,
        reconciled: discrepancies.length === 0,
      };
    } catch (error) {
      console.error('Error reconciling project account:', error);
      throw error;
    }
  }
}

