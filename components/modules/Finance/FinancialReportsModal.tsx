import React, { useState, useMemo } from 'react';
import { Download, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, Button, Modal, useToast, Tabs, ProgressBar } from '../../ui/Common';
import { Select } from '../../ui/Form';
import { FinanceService } from '../../../services/financeService';
import { formatCurrency } from '../../../utils/formatUtils';
import { Transaction, BankAccount } from '../../../types';

export interface FinancialReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  accounts: BankAccount[];
  projects?: Array<{ id: string; name: string }>;
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    byCategory: Record<string, { income: number; expenses: number }>;
  } | null;
  reportYear: number;
  reportMonth: number | null;
  fiscalYearStart?: number; // Month (0-11) when fiscal year starts, default is 0 (January = Calendar Year)
  onYearChange: (year: number) => void;
  onMonthChange: (month: number | null) => void;
  onFiscalYearStartChange?: (month: number) => void;
}

export const FinancialReportsModal: React.FC<FinancialReportsModalProps> = ({
  isOpen,
  onClose,
  transactions,
  accounts,
  projects = [],
  summary,
  reportYear,
  reportMonth,
  fiscalYearStart = 0,
  onYearChange,
  onMonthChange,
  onFiscalYearStartChange,
}) => {
  const projectNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    projects.forEach(p => { map[p.id] = p.name; });
    return map;
  }, [projects]);
  const [activeTab, setActiveTab] = useState<'income' | 'expense' | 'balance' | 'cashflow'>('income');
  const { showToast } = useToast();

  const filteredTransactions = useMemo(() => {
    // Fiscal year window: [fiscalYearStart month of reportYear, same month of reportYear+1)
    const fiscalStart = new Date(reportYear, fiscalYearStart, 1);
    const fiscalEnd   = new Date(reportYear + 1, fiscalYearStart, 1);
    return transactions.filter(t => {
      const txDate = new Date(t.date);
      const inFiscalYear = txDate >= fiscalStart && txDate < fiscalEnd;
      const matchesMonth = reportMonth === null || txDate.getMonth() === reportMonth;
      return inFiscalYear && matchesMonth;
    });
  }, [transactions, reportYear, reportMonth, fiscalYearStart]);

  const incomeTransactions = useMemo(() => {
    return filteredTransactions.filter(t => t.type === 'Income');
  }, [filteredTransactions]);

  const expenseTransactions = useMemo(() => {
    return filteredTransactions.filter(t => t.type === 'Expense');
  }, [filteredTransactions]);

  const categoryBreakdown = useMemo(() => {
    const breakdown: Record<string, { income: number; expenses: number; count: number }> = {};
    filteredTransactions.forEach(t => {
      if (!breakdown[t.category]) {
        breakdown[t.category] = { income: 0, expenses: 0, count: 0 };
      }
      if (t.type === 'Income') {
        breakdown[t.category].income += t.amount;
      } else {
        breakdown[t.category].expenses += Math.abs(t.amount);
      }
      breakdown[t.category].count += 1;
    });
    return breakdown;
  }, [filteredTransactions]);

  // Sub-breakdown per category:
  // "Projects & Activities" → by projectId (mapped to project name)
  // "Membership" / "Administrative" / others → by purpose (fallback: description)
  const subBreakdown = useMemo(() => {
    const result: Record<string, Record<string, { income: number; expenses: number }>> = {};
    filteredTransactions.forEach(t => {
      const cat = t.category || '';
      if (!result[cat]) result[cat] = {};
      let key: string;
      if (cat === 'Projects & Activities' && t.projectId) {
        key = projectNameMap[t.projectId] || t.projectId;
      } else {
        key = (t.purpose?.trim() || t.description?.trim() || 'Other');
      }
      if (!result[cat][key]) result[cat][key] = { income: 0, expenses: 0 };
      if (t.type === 'Income') result[cat][key].income += t.amount;
      else result[cat][key].expenses += Math.abs(t.amount);
    });
    return result;
  }, [filteredTransactions, projectNameMap]);

  const totalCash = accounts.reduce((sum, acc) => sum + acc.balance, 0);
  const netBalance = incomeTransactions.reduce((sum, t) => sum + t.amount, 0)
    - expenseTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // Net-display categories: shown as (income − expenses) under Income; excluded from Expenses.
  // Re-derive displayed totals so breakdown items sum to the headline figures.
  const NET_DISPLAY_CATS = new Set(['Projects & Activities', 'Membership']);
  const displayedIncome = Object.entries(categoryBreakdown).reduce((sum, [cat, data]) => {
    if (NET_DISPLAY_CATS.has(cat)) return sum + Math.max(0, data.income - data.expenses);
    return sum + data.income;
  }, 0);
  const displayedExpenses = Object.entries(categoryBreakdown).reduce((sum, [cat, data]) => {
    if (NET_DISPLAY_CATS.has(cat)) return sum + Math.max(0, data.expenses - data.income);
    return sum + data.expenses;
  }, 0);

  const handleExport = async () => {
    try {
      // Generate report with fiscal year support
      const report = await FinanceService.generateFinancialReport(
        activeTab,
        reportYear,
        reportMonth || undefined,
        fiscalYearStart
      );

      // Export as CSV (using existing export method but with fiscal year context)
      const csv = await FinanceService.exportFinancialReportAsCSV(
        activeTab,
        reportYear,
        reportMonth || undefined
      );
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `financial-report-${activeTab}-${reportYear}${reportMonth !== null ? `-${reportMonth + 1}` : ''}-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      showToast('Financial report exported successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export report';
      showToast(errorMessage, 'error');
    }
  };

  const handleExportTransactions = async () => {
    try {
      const csv = await FinanceService.exportTransactionsAsCSV(
        reportYear,
        reportMonth || undefined
      );
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `transactions-${reportYear}${reportMonth !== null ? `-${reportMonth + 1}` : ''}-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      showToast('Transactions exported successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export transactions';
      showToast(errorMessage, 'error');
    }
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Financial Reports"
      size="xl"
      bottomSheet
      drawerOnMobile
      footer={
        <div className="flex flex-wrap gap-2 w-full justify-between sm:justify-end">
          <Button variant="outline" onClick={handleExport} className="flex-1 sm:flex-none">
            <Download size={16} className="mr-2" />
            Export Report
          </Button>
          <Button variant="outline" onClick={handleExportTransactions} className="flex-1 sm:flex-none">
            <Download size={16} className="mr-2" />
            Export Transactions
          </Button>
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto mt-2 sm:mt-0">
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Report Filters */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-sm font-medium text-slate-700 mb-1">Year</label>
            <Select
              value={reportYear.toString()}
              onChange={(e) => onYearChange(parseInt(e.target.value))}
              options={years.map(y => ({ label: y.toString(), value: y.toString() }))}
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-sm font-medium text-slate-700 mb-1">Month (Optional)</label>
            <Select
              value={reportMonth === null ? 'all' : reportMonth.toString()}
              onChange={(e) => onMonthChange(e.target.value === 'all' ? null : parseInt(e.target.value))}
              options={[
                { label: 'All Months', value: 'all' },
                ...monthNames.map((name, index) => ({ label: name, value: index.toString() }))
              ]}
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-slate-700 mb-1">Fiscal Year Start</label>
            <Select
              value={fiscalYearStart.toString()}
              onChange={(e) => onFiscalYearStartChange?.(parseInt(e.target.value))}
              options={[
                { label: 'Calendar Year (Jan)', value: '0' },
                { label: 'Fiscal Year (Apr)', value: '3' },
                { label: 'Fiscal Year (Jul)', value: '6' },
                { label: 'Fiscal Year (Oct)', value: '9' },
              ]}
            />
            <p className="text-[10px] text-slate-500 mt-1">
              {fiscalYearStart === 0
                ? 'Calendar Year (Jan-Dec)'
                : `${monthNames[fiscalYearStart]} - ${monthNames[fiscalYearStart - 1] || monthNames[11]}`}
            </p>
          </div>
        </div>

        {/* Report Tabs */}
        <Tabs
          tabs={['Income Statement', 'Expense Report', 'Balance Sheet', 'Cash Flow']}
          activeTab={activeTab === 'income' ? 'Income Statement' : activeTab === 'expense' ? 'Expense Report' : activeTab === 'balance' ? 'Balance Sheet' : 'Cash Flow'}
          onTabChange={(tab) => {
            if (tab === 'Income Statement') setActiveTab('income');
            else if (tab === 'Expense Report') setActiveTab('expense');
            else if (tab === 'Balance Sheet') setActiveTab('balance');
            else setActiveTab('cashflow');
          }}
        />

        {/* Report Content */}
        <div className="min-h-[400px]">
          {activeTab === 'income' && (
            <div className="space-y-4">
              <Card>
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-4 border-b">
                    <h3 className="text-lg font-bold text-slate-900">Income Statement</h3>
                    <div className="text-right">
                      <p className="text-sm text-slate-500">Period</p>
                      <p className="font-semibold text-slate-900">
                        {reportMonth !== null
                          ? `${monthNames[reportMonth]} ${reportYear}`
                          : fiscalYearStart === 0
                            ? `Calendar Year ${reportYear}`
                            : `Fiscal Year ${reportYear} (${monthNames[fiscalYearStart]} - ${monthNames[fiscalYearStart - 1] || monthNames[11]})`}
                      </p>
                    </div>
                  </div>

                  {/* Categories shown as net in Income section (can be negative); excluded from Expenses */}
                  {(() => {
                    const NET_CATS = NET_DISPLAY_CATS;
                    const renderNetRow = (cat: string) => {
                      const data = categoryBreakdown[cat];
                      if (!data) return null;
                      const net = data.income - data.expenses;
                      return (
                        <React.Fragment key={cat}>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-600">{cat}</span>
                            <span className={net >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {net < 0 ? '-' : ''}{formatCurrency(Math.abs(net))}
                            </span>
                          </div>
                          {Object.entries(subBreakdown[cat] ?? {})
                            .map(([key, sd]) => ({ key, net: sd.income - sd.expenses }))
                            .sort((a, b) => a.key.localeCompare(b.key))
                            .map(({ key, net: sNet }) => (
                              <div key={key} className="flex justify-between items-center text-xs pl-4 text-slate-400">
                                <span className="truncate max-w-[60%]">{key}</span>
                                <span className={sNet >= 0 ? 'text-green-500' : 'text-red-400'}>
                                  {sNet < 0 ? '-' : ''}{formatCurrency(Math.abs(sNet))}
                                </span>
                              </div>
                            ))}
                        </React.Fragment>
                      );
                    };
                    return (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2">
                      <span className="text-slate-700">Total Income</span>
                      <span className="font-bold text-green-600">{formatCurrency(displayedIncome)}</span>
                    </div>
                    <div className="space-y-2 pl-4 border-l-2 border-slate-200">
                      {/* Net categories first (P&A, Membership) */}
                      {['Projects & Activities', 'Membership'].map(cat => renderNetRow(cat))}
                      {/* Remaining categories: income only */}
                      {Object.entries(categoryBreakdown)
                        .filter(([cat, data]) => !NET_CATS.has(cat) && data.income > 0)
                        .map(([category, data]) => (
                          <React.Fragment key={category || '__uncategorised'}>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-600">{category || 'Uncategorised'}</span>
                              <span className="text-green-600">{formatCurrency(data.income)}</span>
                            </div>
                            {Object.entries(subBreakdown[category] ?? {})
                              .filter(([_, sd]) => sd.income > 0)
                              .sort(([a], [b]) => a.localeCompare(b))
                              .map(([key, sd]) => (
                                <div key={key} className="flex justify-between items-center text-xs pl-4 text-slate-400">
                                  <span className="truncate max-w-[60%]">{key}</span>
                                  <span className="text-green-500">{formatCurrency(sd.income)}</span>
                                </div>
                              ))}
                          </React.Fragment>
                        ))}
                    </div>
                    <div className="flex justify-between items-center py-2 border-t">
                      <span className="text-slate-700">Total Expenses</span>
                      <span className="font-bold text-red-600">-{formatCurrency(displayedExpenses)}</span>
                    </div>
                    <div className="space-y-2 pl-4 border-l-2 border-slate-200">
                      {/* Net categories excluded from expenses section */}
                      {Object.entries(categoryBreakdown)
                        .filter(([cat, data]) => !NET_CATS.has(cat) && data.expenses > 0)
                        .map(([category, data]) => (
                          <React.Fragment key={category || '__uncategorised'}>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-600">{category || 'Uncategorised'}</span>
                              <span className="text-red-600">-{formatCurrency(data.expenses)}</span>
                            </div>
                            {Object.entries(subBreakdown[category] ?? {})
                              .filter(([_, sd]) => sd.expenses > 0)
                              .sort(([a], [b]) => a.localeCompare(b))
                              .map(([key, sd]) => (
                                <div key={key} className="flex justify-between items-center text-xs pl-4 text-slate-400">
                                  <span className="truncate max-w-[60%]">{key}</span>
                                  <span className="text-red-400">-{formatCurrency(sd.expenses)}</span>
                                </div>
                              ))}
                          </React.Fragment>
                        ))}
                    </div>
                    <div className="flex justify-between items-center py-3 border-t-2 border-slate-300 font-bold text-lg">
                      <span className="text-slate-900">Net Balance</span>
                      <span className={netBalance >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(netBalance)}
                      </span>
                    </div>
                  </div>
                    );
                  })()}
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'expense' && (
            <div className="space-y-4">
              <Card>
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-900">Expense Report</h3>
                  <div className="space-y-4">
                    {Object.entries(categoryBreakdown)
                      .filter(([_, data]) => data.expenses > 0)
                      .sort(([_, a], [__, b]) => b.expenses - a.expenses)
                      .map(([category, data]) => {
                        const percentage = (data.expenses / totalExpenses) * 100;
                        return (
                          <div key={category || '__uncategorised'} className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-slate-900">{category || 'Uncategorised'}</span>
                              <div className="text-right">
                                <span className="font-bold text-slate-900">{formatCurrency(data.expenses)}</span>
                                <span className="text-sm text-slate-500 ml-2">({percentage.toFixed(1)}%)</span>
                              </div>
                            </div>
                            <ProgressBar progress={percentage} />
                            <p className="text-xs text-slate-500">{data.count} transaction{data.count !== 1 ? 's' : ''}</p>
                          </div>
                        );
                      })}
                  </div>
                  <div className="pt-4 border-t flex justify-between items-center font-bold">
                    <span>Total Expenses</span>
                    <span className="text-red-600">{formatCurrency(totalExpenses)}</span>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'balance' && (
            <div className="space-y-4">
              <Card>
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-900">Balance Sheet</h3>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-slate-700 mb-2">Assets</h4>
                      <div className="space-y-2 pl-4">
                        {accounts.map(acc => (
                          <div key={acc.id} className="flex justify-between items-center">
                            <span className="text-slate-600">{acc.name}</span>
                            <span className="font-medium text-slate-900">{formatCurrency(acc.balance, acc.currency)}</span>
                          </div>
                        ))}
                        <div className="pt-2 border-t flex justify-between items-center font-semibold">
                          <span>Total Cash & Bank</span>
                          <span>{formatCurrency(totalCash)}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-700 mb-2">Liabilities</h4>
                      <div className="pl-4">
                        <div className="flex justify-between items-center text-slate-600">
                          <span>No outstanding liabilities</span>
                          <span>{formatCurrency(0)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="pt-4 border-t-2 border-slate-300">
                      <div className="flex justify-between items-center font-bold text-lg">
                        <span>Net Assets</span>
                        <span className="text-green-600">{formatCurrency(totalCash)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'cashflow' && (
            <div className="space-y-4">
              <Card>
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-900">Cash Flow Statement</h3>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                        <TrendingUp className="text-green-600" size={16} />
                        Cash Inflows
                      </h4>
                      <div className="space-y-2 pl-4">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600">Operating Income</span>
                          <span className="font-medium text-green-600">{formatCurrency(totalIncome)}</span>
                        </div>
                        <div className="pt-2 border-t flex justify-between items-center font-semibold">
                          <span>Total Cash Inflows</span>
                          <span className="text-green-600">{formatCurrency(totalIncome)}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                        <TrendingDown className="text-red-600" size={16} />
                        Cash Outflows
                      </h4>
                      <div className="space-y-2 pl-4">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600">Operating Expenses</span>
                          <span className="font-medium text-red-600">-{formatCurrency(totalExpenses)}</span>
                        </div>
                        <div className="pt-2 border-t flex justify-between items-center font-semibold">
                          <span>Total Cash Outflows</span>
                          <span className="text-red-600">-{formatCurrency(totalExpenses)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="pt-4 border-t-2 border-slate-300">
                      <div className="flex justify-between items-center font-bold text-lg">
                        <span>Net Cash Flow</span>
                        <span className={netBalance >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {formatCurrency(netBalance)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
