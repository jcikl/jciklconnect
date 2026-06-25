import React, { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle, DollarSign, Calendar } from 'lucide-react';
import { BankAccount, ReconciliationRecord, TransactionType } from '../../../types';
import { FinanceService } from '../../../services/financeService';
import { Modal, Button } from '../../ui/Common';

interface BankReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: BankAccount;
  onReconciliationComplete: () => void;
}

export const BankReconciliationModal: React.FC<BankReconciliationModalProps> = ({
  isOpen,
  onClose,
  account,
  onReconciliationComplete,
}) => {
  const [statementBalance, setStatementBalance] = useState<string>('');
  const [reconciliationDate, setReconciliationDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState<string>('');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<TransactionType | 'all'>('all');
  const [systemBalance, setSystemBalance] = useState<number | null>(null);
  const [balanceByType, setBalanceByType] = useState<Record<TransactionType, number> | null>(null);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen && account) {
      calculateSystemBalance();
    }
  }, [isOpen, account, reconciliationDate, transactionTypeFilter]);

  const calculateSystemBalance = async () => {
    setCalculating(true);
    setError(null);
    try {
      const result = await FinanceService.calculateSystemBalance(
        account.id,
        reconciliationDate,
        transactionTypeFilter === 'all' ? undefined : transactionTypeFilter
      );
      setSystemBalance(result.totalBalance);
      setBalanceByType(result.byType);
    } catch (err) {
      setError('Failed to calculate system balance');
      console.error(err);
    } finally {
      setCalculating(false);
    }
  };

  const handleReconcile = async () => {
    if (!statementBalance) {
      setError('Please enter statement balance');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const currentUser = 'current-user-id'; // TODO: Get from auth context
      await FinanceService.reconcileBankAccount(
        account.id,
        parseFloat(statementBalance),
        reconciliationDate,
        currentUser,
        notes || undefined,
        transactionTypeFilter === 'all' ? undefined : transactionTypeFilter
      );
      setSuccess(true);
      setTimeout(() => {
        onReconciliationComplete();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to reconcile account');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const difference = systemBalance !== null && statementBalance
    ? parseFloat(statementBalance) - systemBalance
    : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Bank Reconciliation"
      size="lg"
      bottomSheet
      drawerOnMobile
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={loading}
            className="flex-1 sm:flex-none"
          >
            Cancel
          </Button>
          <Button
            onClick={handleReconcile}
            disabled={loading || calculating || !statementBalance}
            className="flex-1 sm:flex-none"
          >
            {loading ? 'Reconciling...' : 'Reconcile Account'}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Account Info */}
        <div>
          <p className="text-sm text-gray-600">{account.name}</p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-green-800">Reconciliation completed successfully!</span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-800">{error}</span>
          </div>
        )}

        {/* Reconciliation Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="w-4 h-4 inline mr-2" />
            Reconciliation Date
          </label>
          <input
            type="date"
            value={reconciliationDate}
            onChange={(e) => setReconciliationDate(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Transaction Type Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Transaction Type Filter
          </label>
          <select
            value={transactionTypeFilter}
            onChange={(e) => setTransactionTypeFilter(e.target.value as TransactionType | 'all')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Types</option>
            <option value="project">Project</option>
            <option value="operations">Operations</option>
            <option value="dues">Dues</option>
            <option value="merchandise">Merchandise</option>
          </select>
        </div>

        {/* System Balance Display */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">System Balance</span>
            {calculating ? (
              <span className="text-sm text-gray-500">Calculating...</span>
            ) : (
              <span className="text-lg font-bold text-gray-900">
                {account.currency} {systemBalance?.toFixed(2) || '0.00'}
              </span>
            )}
          </div>

          {/* Balance by Type */}
          {balanceByType && transactionTypeFilter === 'all' && (
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-200">
              <div className="text-xs">
                <span className="text-gray-600">Project:</span>
                <span className="ml-2 font-medium">{account.currency} {balanceByType.project.toFixed(2)}</span>
              </div>
              <div className="text-xs">
                <span className="text-gray-600">Operations:</span>
                <span className="ml-2 font-medium">{account.currency} {balanceByType.operations.toFixed(2)}</span>
              </div>
              <div className="text-xs">
                <span className="text-gray-600">Dues:</span>
                <span className="ml-2 font-medium">{account.currency} {balanceByType.dues.toFixed(2)}</span>
              </div>
              <div className="text-xs">
                <span className="text-gray-600">Merchandise:</span>
                <span className="ml-2 font-medium">{account.currency} {balanceByType.merchandise.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Statement Balance Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <DollarSign className="w-4 h-4 inline mr-2" />
            Statement Balance
          </label>
          <input
            type="number"
            step="0.01"
            value={statementBalance}
            onChange={(e) => setStatementBalance(e.target.value)}
            placeholder="Enter bank statement balance"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Difference Display */}
        {difference !== null && (
          <div
            className={`rounded-lg p-4 ${Math.abs(difference) < 0.01
              ? 'bg-green-50 border border-green-200'
              : 'bg-yellow-50 border border-yellow-200'
              }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Difference</span>
              <span
                className={`text-lg font-bold ${Math.abs(difference) < 0.01 ? 'text-green-600' : 'text-yellow-600'
                  }`}
              >
                {account.currency} {Math.abs(difference).toFixed(2)}
              </span>
            </div>
            {Math.abs(difference) < 0.01 ? (
              <p className="text-xs text-green-600 mt-1">Balances match!</p>
            ) : (
              <p className="text-xs text-yellow-600 mt-1">
                {difference > 0 ? 'Statement is higher' : 'System is higher'}
              </p>
            )}
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Add any notes about this reconciliation..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>
      </div>
    </Modal>
  );
};
