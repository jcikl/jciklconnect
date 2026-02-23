import React, { useState, useEffect } from 'react';
import {
  Users,
  DollarSign,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter,
  Send,
  RefreshCw,
  Download,
  Plus
} from 'lucide-react';
import { DuesRenewalService } from '../../../services/duesRenewalService';
import {
  DuesRenewalSummary,
  DuesRenewalTransaction,
  MembershipType,
  MembershipDues
} from '../../../types';
import type { Transaction } from '../../../types';

interface DuesRenewalDashboardProps {
  year?: number;
  /** 会费流水（category=Membership 的交易） */
  membershipTransactions?: Transaction[];
  onEditMembershipTransaction?: (tx: Transaction, filterYear: number) => void;
  onDeleteMembershipTransaction?: (txId: string) => void;
  hasEditPermission?: boolean;
  formatCurrency?: (amount: number) => string;
  formatDate?: (date: string) => string;
  /** 会员列表，用于显示 memberId 对应的姓名 */
  members?: Array<{ id: string; name: string }>;
}

export const DuesRenewalDashboard: React.FC<DuesRenewalDashboardProps> = ({
  year = new Date().getFullYear(),
  membershipTransactions = [],
  onEditMembershipTransaction,
  onDeleteMembershipTransaction,
  hasEditPermission = false,
  formatCurrency: fmtCurrency = (n) => n.toLocaleString('en-MY', { style: 'currency', currency: 'MYR' }),
  formatDate: fmtDate = (d) => new Date(d).toLocaleDateString(),
  members = [],
}) => {
  const [summary, setSummary] = useState<DuesRenewalSummary | null>(null);
  const [renewals, setRenewals] = useState<DuesRenewalTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const availableYears = React.useMemo(() => {
    const endYear = new Date().getFullYear();
    return Array.from({ length: endYear - 2000 + 1 }, (_, i) => endYear - i);
  }, []);

  const [selectedYear, setSelectedYear] = useState(year);
  const [filterType, setFilterType] = useState<MembershipType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all');
  const [creatingRenewals, setCreatingRenewals] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, [selectedYear]);

  useEffect(() => {
    if (!availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0] ?? new Date().getFullYear());
    }
  }, [availableYears]);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, renewalsData] = await Promise.all([
        DuesRenewalService.generateRenewalSummary(selectedYear),
        DuesRenewalService.getRenewalTransactionsByYear(selectedYear),
      ]);
      setSummary(summaryData);
      setRenewals(renewalsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRenewals = async () => {
    setCreatingRenewals(true);
    try {
      const result = await DuesRenewalService.createRenewalTransactions(selectedYear);
      alert(`Created ${result.created} renewal transactions. Skipped ${result.skipped}. Errors: ${result.errors.length}`);
      await loadDashboardData();
    } catch (err: any) {
      alert(`Error creating renewals: ${err.message}`);
    } finally {
      setCreatingRenewals(false);
    }
  };

  const handleSendReminders = async () => {
    setSendingReminders(true);
    try {
      const remindersSent = await DuesRenewalService.sendDuesReminders(selectedYear);
      alert(`Sent ${remindersSent} reminder notifications`);
    } catch (err: any) {
      alert(`Error sending reminders: ${err.message}`);
    } finally {
      setSendingReminders(false);
    }
  };

  const filteredRenewals = renewals.filter(renewal => {
    if (filterType !== 'all' && renewal.membershipType !== filterType) return false;
    if (filterStatus !== 'all' && renewal.status !== filterStatus) return false;
    return true;
  });

  const membershipTypeColors: Record<MembershipType, string> = {
    Probation: 'bg-blue-100 text-blue-800',
    Full: 'bg-green-100 text-green-800',
    Honorary: 'bg-purple-100 text-purple-800',
    Senator: 'bg-yellow-100 text-yellow-800',
    Visiting: 'bg-orange-100 text-orange-800',
  };

  const statusColors = {
    paid: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    overdue: 'bg-red-100 text-red-800',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
        <span className="ml-3 text-gray-600">Loading dues renewal dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-red-600" />
        <span className="text-red-800">{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dues Renewal Dashboard</h1>
          <p className="text-gray-600 mt-1">Manage annual membership dues collection</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {availableYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={loadDashboardData}
            disabled={loading}
            className="px-4 py-2 text-blue-600 hover:text-blue-700 font-medium transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-4">
              <Users className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total Members</p>
                <p className="text-3xl font-bold text-gray-900">{summary.totalMembers}</p>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              <span className="text-green-600 font-medium">{summary.renewalMembers}</span> renewals,
              <span className="text-blue-600 font-medium ml-1">{summary.newMembers}</span> new
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-4">
              <DollarSign className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Collection Rate</p>
                <p className="text-3xl font-bold text-gray-900">{summary.overallStats.collectionRate}%</p>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              RM{summary.overallStats.paidAmount.toLocaleString()} / RM{summary.overallStats.totalAmount.toLocaleString()}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Paid</p>
                <p className="text-3xl font-bold text-green-600">
                  {Object.values(summary.byMembershipType).reduce((sum, type) => sum + type.paid, 0)}
                </p>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              RM{summary.overallStats.paidAmount.toLocaleString()}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-8 h-8 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-3xl font-bold text-yellow-600">
                  {Object.values(summary.byMembershipType).reduce((sum, type) => sum + type.pending, 0)}
                </p>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              RM{summary.overallStats.pendingAmount.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Membership Type Breakdown */}
      {summary && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Breakdown by Membership Type</h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {Object.entries(summary.byMembershipType).map(([type, stats]) => (
                <div key={type} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${membershipTypeColors[type as MembershipType]}`}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </span>
                    <span className="text-sm text-gray-600">RM{MembershipDues[type as MembershipType]}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total:</span>
                      <span className="font-medium">{stats.total}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600">Paid:</span>
                      <span className="font-medium text-green-600">{stats.paid}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-yellow-600">Pending:</span>
                      <span className="font-medium text-yellow-600">{stats.pending}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-red-600">Overdue:</span>
                      <span className="font-medium text-red-600">{stats.overdue}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleCreateRenewals}
            disabled={creatingRenewals}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
          >
            <Plus className={`w-4 h-4 ${creatingRenewals ? 'animate-spin' : ''}`} />
            {creatingRenewals ? 'Creating...' : 'Create Renewals'}
          </button>

          <button
            onClick={handleSendReminders}
            disabled={sendingReminders}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
          >
            <Send className={`w-4 h-4 ${sendingReminders ? 'animate-spin' : ''}`} />
            {sendingReminders ? 'Sending...' : 'Send Reminders'}
          </button>

          <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* Renewal Transactions + 会费流水 grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {/* Renewals List */}
          <div className="bg-white rounded-lg shadow h-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Renewal Transactions</h2>
                <div className="flex items-center gap-3">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as MembershipType | 'all')}
                    className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Types</option>
                    <option value="Probation">Probation</option>
                    <option value="Full">Full</option>
                    <option value="Honorary">Honorary</option>
                    <option value="Senator">Senator</option>
                    <option value="Visiting">Visiting</option>
                  </select>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as 'all' | 'paid' | 'pending' | 'overdue')}
                    className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Status</option>
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reminders</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRenewals.map((renewal) => (
                    <tr key={renewal.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{renewal.memberId}</div>
                        <div className="text-sm text-gray-500">
                          {renewal.isRenewal ? 'Renewal' : 'New Member'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${membershipTypeColors[renewal.membershipType]}`}>
                          {renewal.membershipType.charAt(0).toUpperCase() + renewal.membershipType.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        RM{renewal.amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[renewal.status]}`}>
                          {renewal.status.charAt(0).toUpperCase() + renewal.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(renewal.dueDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {renewal.remindersSent || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredRenewals.length === 0 && (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No renewal transactions found for the selected filters.</p>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* 会费流水 Card */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">会费流水</h2>
            <p className="text-sm text-gray-500 mt-1">按年份筛选：{selectedYear}</p>
          </div>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            {(() => {
              const filteredByYear = membershipTransactions.filter((tx) => {
                const yearFromProjectId = tx.projectId?.match(/^(\d+)\s+membership$/)?.[1];
                const txYear = yearFromProjectId ? parseInt(yearFromProjectId, 10) : new Date(tx.date).getFullYear();
                return txYear === selectedYear;
              });
              return filteredByYear.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 text-sm">暂无会费流水（{selectedYear} 年）</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">日期</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">描述</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">项目</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">会员</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">金额</th>
                      {hasEditPermission && <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">操作</th>}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredByYear
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((tx) => (
                        <tr key={tx.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-600">{fmtDate(tx.date)}</td>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900 truncate max-w-[120px]" title={tx.description}>{tx.description}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{tx.projectId || '—'}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{tx.memberId ? (members.find(m => m.id === tx.memberId)?.name ?? tx.memberId) : '—'}</td>
                          <td className="px-4 py-2 text-sm text-right font-medium text-gray-900">{tx.type === 'Income' ? '+' : '-'}{fmtCurrency(Math.abs(tx.amount))}</td>
                          {hasEditPermission && (
                            <td className="px-4 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => onEditMembershipTransaction?.(tx, selectedYear)}
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                              >
                                编辑
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                  </tbody>
                </table>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};