/**
 * Project Financial Service
 * Feature: platform-enhancements
 * 
 * Provides project-specific financial account management capabilities.
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5
 */

import {
  ProjectFinancialAccount,
  ProjectTransaction,
  ProjectFinancialSummary,
  BudgetCategory,
  AlertThreshold,
  ProjectFinancialAlert,
  CategorySpending,
  MonthlySpending,
  Project
} from '../types';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { FinanceService } from './financeService';
import { isDevMode, withDevMode } from '../utils/devMode';
import { errorLoggingService } from './errorLoggingService';
import { MOCK_PROJECT_FINANCIAL_ACCOUNTS, MOCK_PROJECT_TRANSACTIONS } from './mockData';

export interface CreateProjectAccountData {
  projectId: string;
  projectName: string;
  budget: number;
  startingBalance?: number;
  budgetCategories: Omit<BudgetCategory, 'id' | 'spentAmount'>[];
  alertThresholds?: Omit<AlertThreshold, 'id'>[];
}

export interface RecordTransactionData {
  projectId: string;
  type: 'income' | 'expense';
  amount: number;
  categoryId?: string;
  description: string;
  date: string;
  receiptUrl?: string;
  tags?: string[];
}

class ProjectFinancialService {
  private accounts: Map<string, ProjectFinancialAccount> = new Map();
  private transactions: Map<string, ProjectTransaction[]> = new Map();

  constructor() {
    if (isDevMode()) {
      MOCK_PROJECT_FINANCIAL_ACCOUNTS.forEach(account => {
        this.accounts.set(account.id, account);
      });

      MOCK_PROJECT_TRANSACTIONS.forEach(transaction => {
        const accountTransactions = this.transactions.get(transaction.financialAccountId) || [];
        accountTransactions.push(transaction);
        this.transactions.set(transaction.financialAccountId, accountTransactions);
      });
    }
  }

  /**
   * Initialize a project financial account
   * Validates: Requirements 6.1
   */
  async createProjectFinancialAccount(
    data: CreateProjectAccountData,
    createdBy: string
  ): Promise<ProjectFinancialAccount> {
    if (!isDevMode()) throw new Error('[ProjectFinancialService] This method is not implemented for production. Data will not persist. Please use Firestore directly or contact the development team.');
    const accountId = `proj_acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    // Create budget categories with IDs
    const budgetCategories: BudgetCategory[] = data.budgetCategories.map(category => ({
      ...category,
      id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      spentAmount: 0,
    }));

    // Create default alert thresholds if not provided
    const defaultThresholds: AlertThreshold[] = [
      {
        id: `alert_${Date.now()}_1`,
        type: 'budget_warning',
        threshold: 80,
        enabled: true,
        notificationMethod: 'both',
      },
      {
        id: `alert_${Date.now()}_2`,
        type: 'budget_exceeded',
        threshold: 100,
        enabled: true,
        notificationMethod: 'both',
      },
    ];

    const alertThresholds = data.alertThresholds?.map(threshold => ({
      ...threshold,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    })) || defaultThresholds;

    const account: ProjectFinancialAccount = {
      id: accountId,
      projectId: data.projectId,
      projectName: data.projectName,
      budget: data.budget,
      startingBalance: data.startingBalance || 0,
      currentBalance: data.startingBalance || 0,
      totalIncome: 0,
      totalExpenses: 0,
      budgetCategories,
      alertThresholds,
      createdAt: now,
      updatedAt: now,
      createdBy,
    };

    this.accounts.set(accountId, account);
    this.transactions.set(accountId, []);

    return account;
  }

  /**
   * Record project income or expense
   * Validates: Requirements 6.2
   */
  async recordProjectTransaction(
    financialAccountId: string,
    data: RecordTransactionData,
    createdBy: string
  ): Promise<ProjectTransaction> {
    if (!isDevMode()) throw new Error('[ProjectFinancialService] This method is not implemented for production. Data will not persist. Please use Firestore directly or contact the development team.');
    const account = this.accounts.get(financialAccountId);
    if (!account) {
      throw new Error('Project financial account not found');
    }

    const transactionId = `proj_trans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const transaction: ProjectTransaction = {
      id: transactionId,
      projectId: data.projectId,
      financialAccountId,
      type: data.type,
      amount: data.amount,
      categoryId: data.categoryId,
      description: data.description,
      date: data.date,
      createdBy,
      createdAt: now,
      receiptUrl: data.receiptUrl,
      tags: data.tags,
    };

    // Update account balance
    if (data.type === 'income') {
      account.currentBalance += data.amount;
      account.totalIncome += data.amount;
    } else {
      account.currentBalance -= data.amount;
      account.totalExpenses += data.amount;
    }

    // Update category spending if specified
    if (data.categoryId && data.type === 'expense') {
      const category = account.budgetCategories.find(cat => cat.id === data.categoryId);
      if (category) {
        category.spentAmount += data.amount;
      }
    }

    account.updatedAt = now;

    // Store transaction
    const accountTransactions = this.transactions.get(financialAccountId) || [];
    accountTransactions.push(transaction);
    this.transactions.set(financialAccountId, accountTransactions);

    // Update account
    this.accounts.set(financialAccountId, account);

    // Check for alerts
    await this.checkAndTriggerAlerts(account);

    return transaction;
  }

  /**
   * Get all project financial details in a single query to optimize loading
   */
  async getFullProjectFinancialDetails(project: Project): Promise<{
    account: ProjectFinancialAccount;
    summary: ProjectFinancialSummary;
    transactions: ProjectTransaction[];
  } | null> {
    return withDevMode(
      async () => {
        const account = Array.from(this.accounts.values()).find(acc => acc.projectId === project.id) || null;
        if (!account) return null;
        const transactions = this.transactions.get(account.id) || [];
        const summary = await this.getProjectFinancialSummary(project.id);
        return summary ? { account, summary, transactions } : null;
      },
      async () => {
    try {
      if (['Draft', 'Submitted', 'Under Review', 'Rejected'].includes(project.status ?? '')) {
        return null;
      }
      
      const bankTransactions = await FinanceService.getBankTransactionsByProject(project.id);
      
      const totalIncome = bankTransactions
        .filter(t => t.type === 'Income')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      const totalExpenses = bankTransactions
        .filter(t => t.type === 'Expense')
        .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

      const budget = project.budget || project.proposedBudget || 0;

      const account: ProjectFinancialAccount = {
        id: `proj_acc_${project.id}`,
        projectId: project.id,
        projectName: project.name || project.title || 'Unnamed Project',
        budget: budget,
        startingBalance: budget,
        currentBalance: budget + totalIncome - totalExpenses,
        totalIncome,
        totalExpenses,
        budgetCategories: [],
        alertThresholds: [],
        createdAt: project.createdAt || new Date().toISOString(),
        updatedAt: project.updatedAt || new Date().toISOString(),
        createdBy: project.submittedBy || 'system',
      };

      const projectTransactions: ProjectTransaction[] = bankTransactions
        .map(t => ({
          id: t.id,
          projectId: t.projectId!,
          financialAccountId: account.id,
          type: t.type === 'Income' ? 'income' : 'expense',
          amount: Math.abs(t.amount || 0),
          categoryId: undefined,
          description: t.description,
          purpose: t.purpose,
          date: t.date,
          createdBy: 'system',
          createdAt: t.date,
          receiptUrl: undefined,
          tags: undefined,
        } as ProjectTransaction))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const budgetUtilization = account.budget > 0 ? (account.totalExpenses / account.budget) * 100 : 0;
      const remainingFunds = account.budget - account.totalExpenses;
      const monthlySpending = this.calculateMonthlySpending(projectTransactions);
      const alerts = await this.getActiveAlerts(account);

      const summary: ProjectFinancialSummary = {
        projectId: project.id,
        budgetUtilization,
        remainingFunds,
        totalAllocated: account.budget,
        totalSpent: account.totalExpenses,
        categoryBreakdown: [],
        monthlySpending,
        alerts,
      };

      return { account, summary, transactions: projectTransactions };
    } catch (error) {
      errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'ProjectFinancialService.getFullProjectFinancialDetails', projectId: project.id });
      return null;
    }
});
  }

  /**
   * Get project financial summary
   * Validates: Requirements 6.3
   */
  async getProjectFinancialSummary(projectId: string): Promise<ProjectFinancialSummary | null> {
    let account: ProjectFinancialAccount | null = null;
    let transactions: ProjectTransaction[] = [];

    if (isDevMode()) {
      account = Array.from(this.accounts.values()).find(acc => acc.projectId === projectId) || null;
      if (account) {
        transactions = this.transactions.get(account.id) || [];
      }
    } else {
      account = await this.getProjectFinancialAccount(projectId);
      if (account) {
        const prodTransactions = await FinanceService.getBankTransactionsByProject(projectId);
        transactions = prodTransactions
          .map(t => ({
            id: t.id,
            projectId: t.projectId!,
            financialAccountId: account!.id,
            type: t.type === 'Income' ? 'income' : 'expense',
            amount: t.amount,
            categoryId: undefined,
            description: t.description,
            purpose: t.purpose,
            date: t.date,
            createdBy: 'system',
            createdAt: t.date,
            receiptUrl: undefined,
            tags: undefined,
          } as ProjectTransaction));
      }
    }

    if (!account) {
      return null;
    }

    // Calculate budget utilization
    const budgetUtilization = account.budget > 0 ? (account.totalExpenses / account.budget) * 100 : 0;
    const remainingFunds = account.budget - account.totalExpenses;

    // Calculate category breakdown
    const categoryBreakdown: CategorySpending[] = account.budgetCategories.map(category => ({
      categoryId: category.id,
      categoryName: category.name,
      allocated: category.allocatedAmount,
      spent: category.spentAmount,
      remaining: category.allocatedAmount - category.spentAmount,
      utilizationPercentage: category.allocatedAmount > 0
        ? (category.spentAmount / category.allocatedAmount) * 100
        : 0,
    }));

    // Calculate monthly spending
    const monthlySpending = this.calculateMonthlySpending(transactions);

    // Get active alerts
    const alerts = await this.getActiveAlerts(account);

    return {
      projectId,
      budgetUtilization,
      remainingFunds,
      totalAllocated: account.budget,
      totalSpent: account.totalExpenses,
      categoryBreakdown,
      monthlySpending,
      alerts,
    };
  }

  /**
   * Get project financial account by project ID
   */
  async getProjectFinancialAccount(projectId: string): Promise<ProjectFinancialAccount | null> {
    return withDevMode(
      () => Array.from(this.accounts.values()).find(acc => acc.projectId === projectId) || null,
      async () => {
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
      const projectSnap = await getDoc(projectRef);
      if (!projectSnap.exists()) return null;

      const projectData = projectSnap.data();
      if (['Draft', 'Submitted', 'Under Review', 'Rejected'].includes(projectData.status ?? '')) {
        return null;
      }
      
      const project = { id: projectSnap.id, ...projectData } as Project;
      const projectTransactions = await FinanceService.getBankTransactionsByProject(projectId);
      
      const totalIncome = projectTransactions
        .filter(t => t.type === 'Income')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      const totalExpenses = projectTransactions
        .filter(t => t.type === 'Expense')
        .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

      const budget = project.budget || project.proposedBudget || 0;

      return {
        id: `proj_acc_${project.id}`,
        projectId: project.id,
        projectName: project.name || project.title || 'Unnamed Project',
        budget: budget,
        startingBalance: budget,
        currentBalance: budget + totalIncome - totalExpenses,
        totalIncome,
        totalExpenses,
        budgetCategories: [],
        alertThresholds: [],
        createdAt: project.createdAt || new Date().toISOString(),
        updatedAt: project.updatedAt || new Date().toISOString(),
        createdBy: project.submittedBy || 'system',
      };
    } catch (error) {
      errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'ProjectFinancialService.getProjectFinancialAccount', projectId });
      return null;
    }
});
  }

  /**
   * Get project transactions
   */
  async getProjectTransactions(
    financialAccountId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<ProjectTransaction[]> {
    return withDevMode(
      () => {
        const transactions = this.transactions.get(financialAccountId) || [];
        return transactions
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(offset, offset + limit);
      },
      async () => {
    // In production, we assume financialAccountId might be proj_acc_{projectId}
    let projectId = financialAccountId;
    if (financialAccountId.startsWith('proj_acc_')) {
      projectId = financialAccountId.replace('proj_acc_', '');
    }

    try {
      const projectTransactions = await FinanceService.getBankTransactionsByProject(projectId);
      return projectTransactions
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(offset, offset + limit)
        .map(t => ({
          id: t.id,
          projectId: t.projectId!,
          financialAccountId: financialAccountId,
          type: t.type === 'Income' ? 'income' : 'expense',
          amount: t.amount,
          categoryId: undefined,
          description: t.description,
          purpose: t.purpose,
          date: t.date,
          createdBy: 'system',
          createdAt: t.date,
          receiptUrl: undefined,
          tags: undefined,
        } as ProjectTransaction));
    } catch (error) {
      errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'ProjectFinancialService.getProjectTransactions', financialAccountId });
      return [];
    }
});
  }
  /**
   * Update budget category
   */
  async updateBudgetCategory(
    financialAccountId: string,
    categoryId: string,
    updates: Partial<Pick<BudgetCategory, 'name' | 'allocatedAmount' | 'description' | 'color'>>
  ): Promise<BudgetCategory> {
    if (!isDevMode()) throw new Error('[ProjectFinancialService] This method is not implemented for production. Data will not persist. Please use Firestore directly or contact the development team.');
    const account = this.accounts.get(financialAccountId);
    if (!account) {
      throw new Error('Project financial account not found');
    }

    const categoryIndex = account.budgetCategories.findIndex(cat => cat.id === categoryId);
    if (categoryIndex === -1) {
      throw new Error('Budget category not found');
    }

    account.budgetCategories[categoryIndex] = {
      ...account.budgetCategories[categoryIndex],
      ...updates,
    };

    account.updatedAt = new Date().toISOString();
    this.accounts.set(financialAccountId, account);

    return account.budgetCategories[categoryIndex];
  }

  /**
   * Add budget category
   */
  async addBudgetCategory(
    financialAccountId: string,
    categoryData: Omit<BudgetCategory, 'id' | 'spentAmount'>
  ): Promise<BudgetCategory> {
    if (!isDevMode()) throw new Error('[ProjectFinancialService] This method is not implemented for production. Data will not persist. Please use Firestore directly or contact the development team.');
    const account = this.accounts.get(financialAccountId);
    if (!account) {
      throw new Error('Project financial account not found');
    }

    const newCategory: BudgetCategory = {
      ...categoryData,
      id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      spentAmount: 0,
    };

    account.budgetCategories.push(newCategory);
    account.updatedAt = new Date().toISOString();
    this.accounts.set(financialAccountId, account);

    return newCategory;
  }

  /**
   * Check and trigger alerts based on thresholds
   * Validates: Requirements 6.4
   */
  private async checkAndTriggerAlerts(account: ProjectFinancialAccount): Promise<void> {
    const alerts: ProjectFinancialAlert[] = [];

    // Check budget alerts
    const budgetUtilization = account.budget > 0 ? (account.totalExpenses / account.budget) * 100 : 0;

    for (const threshold of account.alertThresholds) {
      if (!threshold.enabled) continue;

      let shouldAlert = false;
      let message = '';
      let severity: ProjectFinancialAlert['severity'] = 'low';

      switch (threshold.type) {
        case 'budget_warning':
          if (budgetUtilization >= threshold.threshold && budgetUtilization < 100) {
            shouldAlert = true;
            message = `Project "${account.projectName}" has used ${budgetUtilization.toFixed(1)}% of its budget`;
            severity = budgetUtilization >= 90 ? 'high' : 'medium';
          }
          break;

        case 'budget_exceeded':
          if (budgetUtilization >= threshold.threshold) {
            shouldAlert = true;
            message = `Project "${account.projectName}" has exceeded its budget by ${(budgetUtilization - 100).toFixed(1)}%`;
            severity = 'critical';
          }
          break;

        case 'category_warning':
          // Check each category
          for (const category of account.budgetCategories) {
            const categoryUtilization = category.allocatedAmount > 0
              ? (category.spentAmount / category.allocatedAmount) * 100
              : 0;

            if (categoryUtilization >= threshold.threshold) {
              shouldAlert = true;
              message = `Budget category "${category.name}" has used ${categoryUtilization.toFixed(1)}% of its allocation`;
              severity = categoryUtilization >= 100 ? 'critical' : 'medium';

              alerts.push({
                id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                type: threshold.type,
                severity,
                message,
                threshold: threshold.threshold,
                currentValue: categoryUtilization,
                categoryId: category.id,
                createdAt: new Date().toISOString(),
              });
            }
          }
          break;
      }

      if (shouldAlert && threshold.type !== 'category_warning') {
        alerts.push({
          id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          type: threshold.type,
          severity,
          message,
          threshold: threshold.threshold,
          currentValue: budgetUtilization,
          createdAt: new Date().toISOString(),
        });
      }
    }

    // In a real implementation, these alerts would be stored and notifications sent
    if (alerts.length > 0) {
      console.log('Project financial alerts triggered:', alerts);
    }
  }

  /**
   * Get active alerts for a project
   */
  private async getActiveAlerts(account: ProjectFinancialAccount): Promise<ProjectFinancialAlert[]> {
    // In a real implementation, this would fetch from a database
    // For now, we'll generate current alerts based on current state
    const alerts: ProjectFinancialAlert[] = [];

    const budgetUtilization = account.budget > 0 ? (account.totalExpenses / account.budget) * 100 : 0;

    // Check for budget warnings
    if (budgetUtilization >= 80 && budgetUtilization < 100) {
      alerts.push({
        id: `alert_budget_warning_${account.id}`,
        type: 'budget_warning',
        severity: budgetUtilization >= 90 ? 'high' : 'medium',
        message: `Project "${account.projectName}" has used ${budgetUtilization.toFixed(1)}% of its budget`,
        threshold: 80,
        currentValue: budgetUtilization,
        createdAt: new Date().toISOString(),
      });
    }

    // Check for budget exceeded
    if (budgetUtilization >= 100) {
      alerts.push({
        id: `alert_budget_exceeded_${account.id}`,
        type: 'budget_exceeded',
        severity: 'critical',
        message: `Project "${account.projectName}" has exceeded its budget by ${(budgetUtilization - 100).toFixed(1)}%`,
        threshold: 100,
        currentValue: budgetUtilization,
        createdAt: new Date().toISOString(),
      });
    }

    return alerts;
  }

  /**
   * Calculate monthly spending breakdown
   */
  private calculateMonthlySpending(transactions: ProjectTransaction[]): MonthlySpending[] {
    const monthlyData = new Map<string, { income: number; expenses: number }>();

    transactions.forEach(transaction => {
      const month = transaction.date.substring(0, 7); // YYYY-MM
      const existing = monthlyData.get(month) || { income: 0, expenses: 0 };

      if (transaction.type === 'income') {
        existing.income += transaction.amount;
      } else {
        existing.expenses += transaction.amount;
      }

      monthlyData.set(month, existing);
    });

    return Array.from(monthlyData.entries())
      .map(([month, data]) => ({
        month,
        income: data.income,
        expenses: data.expenses,
        netFlow: data.income - data.expenses,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  /**
   * Generate project financial report data
   * Validates: Requirements 6.5
   */
  async generateProjectFinancialReport(projectId: string): Promise<{
    account: ProjectFinancialAccount;
    summary: ProjectFinancialSummary;
    transactions: ProjectTransaction[];
    varianceAnalysis: {
      budgetVariance: number;
      categoryVariances: Array<{
        categoryName: string;
        budgetedAmount: number;
        actualAmount: number;
        variance: number;
        variancePercentage: number;
      }>;
    };
  } | null> {
    const account = await this.getProjectFinancialAccount(projectId);
    if (!account) {
      return null;
    }

    const summary = await this.getProjectFinancialSummary(projectId);
    if (!summary) {
      return null;
    }

    const transactions = await this.getProjectTransactions(account.id, 1000);

    // Calculate variance analysis
    const budgetVariance = account.budget - account.totalExpenses;
    const categoryVariances = account.budgetCategories.map(category => ({
      categoryName: category.name,
      budgetedAmount: category.allocatedAmount,
      actualAmount: category.spentAmount,
      variance: category.allocatedAmount - category.spentAmount,
      variancePercentage: category.allocatedAmount > 0
        ? ((category.allocatedAmount - category.spentAmount) / category.allocatedAmount) * 100
        : 0,
    }));

    return {
      account,
      summary,
      transactions,
      varianceAnalysis: {
        budgetVariance,
        categoryVariances,
      },
    };
  }

  /**
   * Get all project financial accounts (for admin/reporting purposes)
   */
  async getAllProjectAccounts(year?: number): Promise<ProjectFinancialAccount[]> {
    return withDevMode(
      () => {
        if (year) {
          return Array.from(this.accounts.values()).filter(acc => {
            const pDate = acc.createdAt || new Date().toISOString();
            return new Date(pDate).getFullYear() === year;
          });
        }
        return Array.from(this.accounts.values());
      },
      async () => {
    try {
      // TODO: Add year filter or limit(200) to scope this query.
      // Fetch projects that are not in draft/submitted status
      const projectsSnapshot = await getDocs(
        query(collection(db, COLLECTIONS.PROJECTS), orderBy('createdAt', 'desc'))
      );

      let projects = projectsSnapshot.docs
        .filter(doc => !['Draft', 'Submitted', 'Under Review', 'Rejected'].includes(doc.data().status ?? ''))
        .map(doc => ({ id: doc.id, ...doc.data() } as Project));

      if (year) {
        projects = projects.filter(project => {
          const pDate = project.eventStartDate || project.startDate || project.date || project.proposedDate || project.createdAt || project.updatedAt || new Date().toISOString();
          return new Date(pDate).getFullYear() === year;
        });
      }

      // Batch-fetch all transactions and transaction splits for all projects in chunks of 10
      const projectIds = projects.map(p => p.id);
      const txChunks = chunkArray(projectIds, 10);
      const [txSnapshots, splitSnapshots] = await Promise.all([
        Promise.all(txChunks.map(chunk =>
          getDocs(query(collection(db, COLLECTIONS.TRANSACTIONS), where('projectId', 'in', chunk)))
        )),
        Promise.all(txChunks.map(chunk =>
          getDocs(query(collection(db, COLLECTIONS.TRANSACTION_SPLITS), where('projectId', 'in', chunk)))
        )),
      ]);
      const txByProject = new Map<string, { type?: string; amount?: number }[]>();
      txSnapshots.forEach(snap =>
        snap.docs.forEach(d => {
          const data = d.data();
          const pid: string = data.projectId;
          if (!txByProject.has(pid)) txByProject.set(pid, []);
          txByProject.get(pid)!.push(data);
        })
      );
      // Include split-level income/expense amounts (P1-fix: splits may be the actual categorised amounts)
      splitSnapshots.forEach(snap =>
        snap.docs.forEach(d => {
          const data = d.data();
          const pid: string = data.projectId;
          if (!pid) return;
          if (!txByProject.has(pid)) txByProject.set(pid, []);
          txByProject.get(pid)!.push(data);
        })
      );

      const accounts: ProjectFinancialAccount[] = await Promise.all(
        projects.map(async (project) => {
          const projectTransactions = txByProject.get(project.id) ?? [];

          const totalIncome = projectTransactions
            .filter(t => t.type === 'Income')
            .reduce((sum, t) => sum + (t.amount || 0), 0);

          const totalExpenses = projectTransactions
            .filter(t => t.type === 'Expense')
            .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

          const budget = project.budget || project.proposedBudget || 0;

          return {
            id: `proj_acc_${project.id}`,
            projectId: project.id,
            projectName: project.name || project.title || 'Unnamed Project',
            budget: budget,
            startingBalance: budget,
            currentBalance: budget + totalIncome - totalExpenses,
            totalIncome,
            totalExpenses,
            budgetCategories: [],
            alertThresholds: [],
            createdAt: project.createdAt || new Date().toISOString(),
            updatedAt: project.updatedAt || new Date().toISOString(),
            createdBy: project.submittedBy || 'system',
          };
        })
      );

      return accounts;
    } catch (error) {
      errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'ProjectFinancialService.getAllProjectAccounts', year });
      return [];
    }
});
  }

  /**
   * Get all project tracker transactions (from projectTrx collection)
   * Used for comparisons with Bank transactions
   */
  async getAllProjectTrackerTransactions(): Promise<ProjectTransaction[]> {
    return withDevMode(
      () => {
        // Return mock transactions that are simulating project tracker data
        // For now, we can reuse MOCK_PROJECT_TRANSACTIONS or return a subset
        return MOCK_PROJECT_TRANSACTIONS;
      },
      async () => {
    try {
      // Fix 21: cap at 500 to prevent unbounded reads.
      const snapshot = await getDocs(
        query(collection(db, COLLECTIONS.PROJECT_TRANSACTIONS), orderBy('date', 'desc'), limit(500))
      );

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate?.()?.toISOString() || doc.data().date,
      } as ProjectTransaction));
    } catch (error) {
      errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'ProjectFinancialService.getAllProjectTrackerTransactions' });
      return [];
    }
});
  }

  /**
   * Sync an approved PR expense into the project financial account.
   * In dev mode: updates the in-memory account balance so the budget dashboard reflects the approval.
   * In production: no-op — the account is computed dynamically from the transactions Firestore
   * collection, so the expense transaction written by the batch already flows through automatically.
   */
  async addTransaction(
    projectId: string,
    data: { type: 'expense' | 'income'; amount: number; description: string; transactionId?: string; date: Date }
  ): Promise<void> {
    if (!isDevMode()) return; // production derives totals from Firestore — nothing extra needed

    const account = Array.from(this.accounts.values()).find(acc => acc.projectId === projectId);
    if (!account) return; // no account initialised for this project in this session

    const now = data.date.toISOString();
    const transaction: ProjectTransaction = {
      id: data.transactionId ?? `proj_trans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      projectId,
      financialAccountId: account.id,
      type: data.type,
      amount: data.amount,
      description: data.description,
      date: now.split('T')[0],
      createdBy: 'system',
      createdAt: now,
    };

    if (data.type === 'expense') {
      account.currentBalance -= data.amount;
      account.totalExpenses += data.amount;
    } else {
      account.currentBalance += data.amount;
      account.totalIncome += data.amount;
    }
    account.updatedAt = now;
    this.accounts.set(account.id, account);

    const accountTransactions = this.transactions.get(account.id) || [];
    accountTransactions.push(transaction);
    this.transactions.set(account.id, accountTransactions);
  }

  /**
   * Delete project financial account
   */
  async deleteProjectFinancialAccount(financialAccountId: string): Promise<boolean> {
    if (!isDevMode()) throw new Error('[ProjectFinancialService] This method is not implemented for production. Data will not persist. Please use Firestore directly or contact the development team.');
    const deleted = this.accounts.delete(financialAccountId);
    this.transactions.delete(financialAccountId);
    return deleted;
  }
}

export const projectFinancialService = new ProjectFinancialService();