import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Plus,
  Edit3,
  Download,
  Calendar,
  PieChart,
  BarChart3,
  Receipt,
  Target,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import type {
  ProjectFinancialAccount,
  ProjectFinancialSummary,
  ProjectTransaction,
  BudgetCategory,
  ProjectFinancialAlert,
  Project
} from '../../../types';
import {
  projectFinancialService,
  CreateProjectAccountData,
  RecordTransactionData
} from '../../../services/projectFinancialService';
import * as Forms from '../../ui/Form';

interface ProjectFinancialAccountProps {
  project: Project;
  onClose: () => void;
}

const EXPENSE_CATEGORIES = [
  { id: 'materials', name: 'Materials & Supplies', color: '#3B82F6' },
  { id: 'labor', name: 'Labor & Contractors', color: '#10B981' },
  { id: 'equipment', name: 'Equipment & Tools', color: '#F59E0B' },
  { id: 'travel', name: 'Travel & Transportation', color: '#EF4444' },
  { id: 'marketing', name: 'Marketing & Promotion', color: '#8B5CF6' },
  { id: 'overhead', name: 'Overhead & Admin', color: '#6B7280' },
  { id: 'other', name: 'Other Expenses', color: '#EC4899' },
];

export const ProjectFinancialAccountView: React.FC<ProjectFinancialAccountProps> = ({
  project,
  onClose,
}) => {
  const [account, setAccount] = useState<ProjectFinancialAccount | null>(null);
  const [summary, setSummary] = useState<ProjectFinancialSummary | null>(null);
  const [transactions, setTransactions] = useState<ProjectTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'budget' | 'reports'>('overview');
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [showAddTransaction, setShowAddTransaction] = useState(false);

  // Form states
  const [newAccountData, setNewAccountData] = useState<Partial<CreateProjectAccountData>>({
    budget: project.budget || 0,
    startingBalance: 0,
    budgetCategories: EXPENSE_CATEGORIES.map(cat => ({
      name: cat.name,
      allocatedAmount: 0,
      color: cat.color,
      description: `Budget category for ${cat.name.toLowerCase()}`,
    })),
  });

  const [newTransactionData, setNewTransactionData] = useState<Partial<RecordTransactionData>>({
    type: 'expense',
    amount: 0,
    description: '',
    date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadProjectFinancialData();
  }, [project.id]);

  const loadProjectFinancialData = async () => {
    setLoading(true);
    try {
      const projectAccount = await projectFinancialService.getProjectFinancialAccount(project.id);
      
      if (projectAccount) {
        setAccount(projectAccount);
        const projectSummary = await projectFinancialService.getProjectFinancialSummary(project.id);
        setSummary(projectSummary);
        
        const projectTransactions = await projectFinancialService.getProjectTransactions(projectAccount.id, 50);
        setTransactions(projectTransactions);
        setShowCreateAccount(false);
      } else {
        setShowCreateAccount(true);
      }
    } catch (error) {
      console.error('Error loading project financial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    try {
      const accountData: CreateProjectAccountData = {
        projectId: project.id,
        projectName: project.name ?? project.title ?? 'Project',
        budget: newAccountData.budget || 0,
        startingBalance: newAccountData.startingBalance || 0,
        budgetCategories: newAccountData.budgetCategories || [],
      };

      await projectFinancialService.createProjectFinancialAccount(accountData, 'current-user');
      await loadProjectFinancialData();
    } catch (error) {
      console.error('Error creating project financial account:', error);
    }
  };

  const handleAddTransaction = async () => {
    if (!account) return;

    try {
      const transactionData: RecordTransactionData = {
        projectId: project.id,
        type: newTransactionData.type || 'expense',
        amount: newTransactionData.amount || 0,
        categoryId: newTransactionData.categoryId,
        description: newTransactionData.description || '',
        date: newTransactionData.date || new Date().toISOString().split('T')[0],
        tags: newTransactionData.tags,
      };

      await projectFinancialService.recordProjectTransaction(account.id, transactionData, 'current-user');
      await loadProjectFinancialData();
      setShowAddTransaction(false);
      setNewTransactionData({
        type: 'expense',
        amount: 0,
        description: '',
        date: new Date().toISOString().split('T')[0],
      });
    } catch (error) {
      console.error('Error adding transaction:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: 'MYR',
    }).format(amount);
  };

  const getAlertIcon = (severity: ProjectFinancialAlert['severity']) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'high':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'medium':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      default:
        return <CheckCircle className="w-5 h-5 text-blue-600" />;
    }
  };

  const getUtilizationColor = (percentage: number) => {
    if (percentage >= 100) return 'text-red-600 bg-red-50';
    if (percentage >= 80) return 'text-orange-600 bg-orange-50';
    if (percentage >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (showCreateAccount) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Create Financial Account for {project.name ?? project.title ?? 'Project'}
          </h2>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Forms.Input
                label="Project Budget"
                type="number"
                value={newAccountData.budget}
                onChange={(e) => setNewAccountData(prev => ({ 
                  ...prev, 
                  budget: parseFloat(e.target.value) || 0 
                }))}
                placeholder="0.00"
                required
              />
              <Forms.Input
                label="Starting Balance"
                type="number"
                value={newAccountData.startingBalance}
                onChange={(e) => setNewAccountData(prev => ({ 
                  ...prev, 
                  startingBalance: parseFloat(e.target.value) || 0 
                }))}
                placeholder="0.00"
              />
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Budget Categories</h3>
              <div className="space-y-3">
                {newAccountData.budgetCategories?.map((category, index) => (
                  <div key={index} className="flex items-center gap-4 p-3 border border-gray-200 rounded">
                    <div 
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: category.color }}
                    ></div>
                    <div className="flex-1">
                      <span className="font-medium">{category.name}</span>
                    </div>
                    <div className="w-32">
                      <Forms.Input
                        type="number"
                        value={category.allocatedAmount}
                        onChange={(e) => {
                          const updatedCategories = [...(newAccountData.budgetCategories || [])];
                          updatedCategories[index].allocatedAmount = parseFloat(e.target.value) || 0;
                          setNewAccountData(prev => ({ 
                            ...prev, 
                            budgetCategories: updatedCategories 
                          }));
                        }}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAccount}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Account
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!account || !summary) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-gray-500">No financial account found for this project.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{project.name ?? project.title ?? 'Project'}</h1>
          <p className="text-gray-600 mt-1">Project Financial Management</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddTransaction(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <Plus size={16} />
            Add Transaction
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Alerts */}
      {summary.alerts.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <h3 className="font-medium text-yellow-800">Financial Alerts</h3>
          </div>
          <div className="space-y-2">
            {summary.alerts.map((alert) => (
              <div key={alert.id} className="flex items-center gap-2 text-sm">
                {getAlertIcon(alert.severity)}
                <span className="text-gray-700">{alert.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Target className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Budget</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(summary.totalAllocated)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Spent</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(summary.totalSpent)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Remaining</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(summary.remainingFunds)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Budget Used</p>
              <p className={`text-2xl font-bold ${getUtilizationColor(summary.budgetUtilization)}`}>
                {summary.budgetUtilization.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Budget Progress Bar */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Budget Utilization</h3>
        <div className="relative">
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className={`h-4 rounded-full transition-all duration-300 ${
                summary.budgetUtilization >= 100 
                  ? 'bg-red-500' 
                  : summary.budgetUtilization >= 80 
                  ? 'bg-orange-500' 
                  : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(summary.budgetUtilization, 100)}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-sm text-gray-600 mt-2">
            <span>{formatCurrency(0)}</span>
            <span>{formatCurrency(summary.totalAllocated)}</span>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Category Breakdown</h3>
        <div className="space-y-4">
          {summary.categoryBreakdown.map((category) => (
            <div key={category.categoryId} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">{category.categoryName}</h4>
                <span className={`px-2 py-1 rounded text-sm ${getUtilizationColor(category.utilizationPercentage)}`}>
                  {category.utilizationPercentage.toFixed(1)}%
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Allocated</p>
                  <p className="font-medium">{formatCurrency(category.allocated)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Spent</p>
                  <p className="font-medium">{formatCurrency(category.spent)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Remaining</p>
                  <p className="font-medium">{formatCurrency(category.remaining)}</p>
                </div>
              </div>
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      category.utilizationPercentage >= 100 
                        ? 'bg-red-500' 
                        : category.utilizationPercentage >= 80 
                        ? 'bg-orange-500' 
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(category.utilizationPercentage, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Recent Transactions</h3>
          <button className="text-blue-600 hover:text-blue-800 text-sm">
            View All
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2">Date</th>
                <th className="text-left py-2">Description</th>
                <th className="text-left py-2">Category</th>
                <th className="text-left py-2">Type</th>
                <th className="text-right py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.slice(0, 10).map((transaction) => (
                <tr key={transaction.id} className="border-b border-gray-100">
                  <td className="py-2">
                    {new Date(transaction.date).toLocaleDateString()}
                  </td>
                  <td className="py-2">{transaction.description}</td>
                  <td className="py-2">
                    {transaction.categoryId 
                      ? account.budgetCategories.find(cat => cat.id === transaction.categoryId)?.name || 'Unknown'
                      : '-'
                    }
                  </td>
                  <td className="py-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      transaction.type === 'income' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {transaction.type}
                    </span>
                  </td>
                  <td className={`py-2 text-right font-medium ${
                    transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Transaction Modal */}
      {showAddTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Add Transaction</h3>
            
            <div className="space-y-4">
              <Forms.Select
                label="Type"
                value={newTransactionData.type}
                onChange={(e) => setNewTransactionData(prev => ({ 
                  ...prev, 
                  type: e.target.value as 'income' | 'expense' 
                }))}
                options={[
                  { value: 'expense', label: 'Expense' },
                  { value: 'income', label: 'Income' }
                ]}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </Forms.Select>

              <Forms.Input
                label="Amount"
                type="number"
                value={newTransactionData.amount}
                onChange={(e) => setNewTransactionData(prev => ({ 
                  ...prev, 
                  amount: parseFloat(e.target.value) || 0 
                }))}
                placeholder="0.00"
                required
              />

              <Forms.Input
                label="Description"
                value={newTransactionData.description}
                onChange={(e) => setNewTransactionData(prev => ({ 
                  ...prev, 
                  description: e.target.value 
                }))}
                placeholder="Transaction description"
                required
              />

              <Forms.Select
                label="Category"
                value={newTransactionData.categoryId || ''}
                onChange={(e) => setNewTransactionData(prev => ({ 
                  ...prev, 
                  categoryId: e.target.value || undefined 
                }))}
                options={[
                  { value: '', label: 'No Category' },
                  ...account.budgetCategories.map(category => ({
                    value: category.id,
                    label: category.name
                  }))
                ]}
              >
                <option value="">No Category</option>
                {account.budgetCategories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Forms.Select>

              <Forms.Input
                label="Date"
                type="date"
                value={newTransactionData.date}
                onChange={(e) => setNewTransactionData(prev => ({ 
                  ...prev, 
                  date: e.target.value 
                }))}
                required
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddTransaction(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTransaction}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add Transaction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};