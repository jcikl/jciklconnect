import React, { useState, useEffect } from 'react';
import { X, Users, DollarSign, AlertCircle, CheckCircle, Clock, Filter } from 'lucide-react';
import { FinanceService } from '../../../services/financeService';
import { MembershipType, MembershipDues } from '../../../types';
import { formatCurrency } from '../../../utils/formatUtils';

interface DuesRenewalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface RenewalStatus {
  totalMembers: number;
  byType: Record<string, { total: number; paid: number; pending: number; overdue: number }>;
  byCategory: { renewal: number; new: number };
}

interface MemberDues {
  memberId: string;
  memberName: string;
  membershipType: string;
  duesYear: number;
  duesAmount: number;
  paymentStatus: 'paid' | 'pending' | 'overdue';
  paymentDate?: string;
  isRenewal: boolean;
}

export const DuesRenewalModal: React.FC<DuesRenewalModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [renewalYear, setRenewalYear] = useState(new Date().getFullYear());
  const [renewalStatus, setRenewalStatus] = useState<RenewalStatus | null>(null);
  const [membersList, setMembersList] = useState<MemberDues[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<MemberDues[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Filters
  const [filterType, setFilterType] = useState<MembershipType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all');
  const [filterCategory, setFilterCategory] = useState<'all' | 'renewal' | 'new'>('all');

  useEffect(() => {
    if (isOpen) {
      loadRenewalStatus();
      loadMembersList();
    }
  }, [isOpen, renewalYear]);

  useEffect(() => {
    applyFilters();
  }, [membersList, filterType, filterStatus, filterCategory]);

  const loadRenewalStatus = async () => {
    try {
      const status = await FinanceService.getDuesRenewalStatus(renewalYear);
      setRenewalStatus(status);
    } catch (err) {
      console.error('Error loading renewal status:', err);
    }
  };

  const loadMembersList = async () => {
    try {
      const members = await FinanceService.getMembersDuesList({
        duesYear: renewalYear,
      });
      setMembersList(members);
    } catch (err) {
      console.error('Error loading members list:', err);
    }
  };

  const applyFilters = () => {
    let filtered = [...membersList];

    if (filterType !== 'all') {
      filtered = filtered.filter(m => m.membershipType === filterType);
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(m => m.paymentStatus === filterStatus);
    }

    if (filterCategory !== 'all') {
      filtered = filtered.filter(m => 
        filterCategory === 'renewal' ? m.isRenewal : !m.isRenewal
      );
    }

    setFilteredMembers(filtered);
  };

  const handleInitiateRenewal = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await FinanceService.initiateDuesRenewal(renewalYear);
      
      if (result.validationErrors.length > 0) {
        setError(`Renewal initiated with ${result.validationErrors.length} validation errors. Check console for details.`);
        console.error('Validation errors:', result.validationErrors);
      } else {
        setSuccess(
          `Renewal initiated successfully! ${result.totalMembers} members processed, ${result.notificationsSent} notifications sent.`
        );
      }

      // Reload status
      await loadRenewalStatus();
      await loadMembersList();
      
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate renewal');
    } finally {
      setLoading(false);
    }
  };

  const handleSendReminders = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const remindersSent = await FinanceService.sendDuesReminders(renewalYear, 30);
      setSuccess(`Sent ${remindersSent} reminder notifications to members with overdue dues.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reminders');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const membershipTypes: Array<{ value: MembershipType | 'all'; label: string }> = [
    { value: 'all', label: 'All Types' },
    { value: 'Probation', label: 'Probation (RM350)' },
    { value: 'Full', label: 'Full (RM300)' },
    { value: 'Honorary', label: 'Honorary (RM50)' },
    { value: 'Senator', label: 'Senator (RM0)' },
    { value: 'Visiting', label: 'Visiting (RM500)' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Annual Dues Renewal</h2>
            <p className="text-sm text-gray-600 mt-1">
              Manage membership dues renewal for {renewalYear}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Year Selection and Actions */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700">Renewal Year:</label>
              <select
                value={renewalYear}
                onChange={(e) => setRenewalYear(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {[2024, 2025, 2026, 2027].map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleInitiateRenewal}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                Initiate Renewal
              </button>
              <button
                onClick={handleSendReminders}
                disabled={loading}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4" />
                Send Reminders
              </button>
            </div>
          </div>

          {/* Status Messages */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          {/* Renewal Statistics */}
          {renewalStatus && (
            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600 font-medium">Total Members</p>
                    <p className="text-2xl font-bold text-blue-900">{renewalStatus.totalMembers}</p>
                  </div>
                  <Users className="w-8 h-8 text-blue-600" />
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600 font-medium">Renewal Members</p>
                    <p className="text-2xl font-bold text-green-900">{renewalStatus.byCategory.renewal}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-purple-600 font-medium">New Members</p>
                    <p className="text-2xl font-bold text-purple-900">{renewalStatus.byCategory.new}</p>
                  </div>
                  <Users className="w-8 h-8 text-purple-600" />
                </div>
              </div>
            </div>
          )}

          {/* Membership Type Breakdown */}
          {renewalStatus && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Breakdown by Membership Type</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {Object.entries(renewalStatus.byType).map(([type, stats]) => (
                  <div key={type} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <p className="text-xs font-medium text-gray-600 uppercase mb-2">
                      {type} (RM{MembershipDues[type as MembershipType]})
                    </p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total:</span>
                        <span className="font-semibold">{stats.total}</span>
                      </div>
                      <div className="flex justify-between text-green-600">
                        <span>Paid:</span>
                        <span className="font-semibold">{stats.paid}</span>
                      </div>
                      <div className="flex justify-between text-yellow-600">
                        <span>Pending:</span>
                        <span className="font-semibold">{stats.pending}</span>
                      </div>
                      <div className="flex justify-between text-red-600">
                        <span>Overdue:</span>
                        <span className="font-semibold">{stats.overdue}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="mb-4 flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
            <Filter className="w-5 h-5 text-gray-600" />
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Membership Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as MembershipType | 'all')}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {membershipTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Payment Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Member Category</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Categories</option>
                  <option value="renewal">Renewal</option>
                  <option value="new">New</option>
                </select>
              </div>
            </div>
          </div>

          {/* Members List */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Members List ({filteredMembers.length})
            </h3>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Member</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Category</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Amount</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Payment Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredMembers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          No members found matching the selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredMembers.map((member) => (
                        <tr key={member.memberId} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{member.memberName}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                              {member.membershipType}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              member.isRenewal ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'
                            }`}>
                              {member.isRenewal ? 'Renewal' : 'New'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                            {formatCurrency(member.duesAmount)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {member.paymentStatus === 'paid' && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <CheckCircle className="w-3 h-3" />
                                Paid
                              </span>
                            )}
                            {member.paymentStatus === 'pending' && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                <Clock className="w-3 h-3" />
                                Pending
                              </span>
                            )}
                            {member.paymentStatus === 'overdue' && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                <AlertCircle className="w-3 h-3" />
                                Overdue
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {member.paymentDate ? new Date(member.paymentDate).toLocaleDateString() : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
