import React, { useState, useEffect } from 'react';
import {
  Users,
  Crown,
  Calendar,
  ArrowRight,
  Plus,
  Edit3,
  Archive,
  CheckCircle,
  AlertTriangle,
  Clock,
  History,
  UserCheck,
  UserX,
  Settings,
  Save,
  X
} from 'lucide-react';
import type {
  BoardMember,
  BoardTransition,
  Member,
} from '../../../types';
import { UserRole } from '../../../types';
import { BoardManagementService } from '../../../services/boardManagementService';
import { MembersService } from '../../../services/membersService';
import { useToast } from '../../ui/Common';
import * as Forms from '../../ui/Form';

interface BoardTransitionToolsProps {
  onClose?: () => void;
}

export const BoardTransitionTools: React.FC<BoardTransitionToolsProps> = ({
  onClose,
}) => {
  const [currentBoardMembers, setCurrentBoardMembers] = useState<BoardMember[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [transitionHistory, setTransitionHistory] = useState<BoardTransition[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'current' | 'transition' | 'history'>('current');
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [showRoleAssignmentModal, setShowRoleAssignmentModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [transitionYear, setTransitionYear] = useState<string>(new Date().getFullYear().toString());
  const [incomingBoard, setIncomingBoard] = useState<Partial<BoardMember>[]>([]);
  const { showToast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [boardMembers, members, history] = await Promise.all([
        BoardManagementService.getCurrentBoardMembers(),
        MembersService.getAllMembers(),
        BoardManagementService.getBoardTransitionHistory(),
      ]);

      setCurrentBoardMembers(boardMembers);
      setAllMembers(members);
      setTransitionHistory(history);
    } catch (error) {
      console.error('Error loading board data:', error);
      showToast('Failed to load board data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStartTransition = () => {
    setIncomingBoard([]);
    setShowTransitionModal(true);
  };

  const handleAddIncomingMember = () => {
    setIncomingBoard([
      ...incomingBoard,
      {
        memberId: '',
        position: '',
        term: transitionYear,
        permissions: [],
      },
    ]);
  };

  const handleUpdateIncomingMember = (index: number, updates: Partial<BoardMember>) => {
    const updated = [...incomingBoard];
    updated[index] = { ...updated[index], ...updates };

    // Auto-assign permissions based on position
    if (updates.position) {
      updated[index].permissions = BoardManagementService.getRolePermissions(updates.position);
    }

    setIncomingBoard(updated);
  };

  const handleRemoveIncomingMember = (index: number) => {
    setIncomingBoard(incomingBoard.filter((_, i) => i !== index));
  };

  const handleExecuteTransition = async () => {
    try {
      // Validate incoming board
      const validIncomingBoard = incomingBoard.filter(member =>
        member.memberId && member.position
      );

      if (validIncomingBoard.length === 0) {
        showToast('Please add at least one incoming board member', 'error');
        return;
      }

      // Create transition record
      const transition = await BoardManagementService.createBoardTransition(
        transitionYear,
        currentBoardMembers,
        validIncomingBoard,
        'current-user' // In real app, get from auth context
      );

      // Execute the transition
      await BoardManagementService.executeBoardTransition(transition.id);

      showToast('Board transition completed successfully', 'success');
      setShowTransitionModal(false);
      await loadData();
    } catch (error) {
      console.error('Error executing board transition:', error);
      showToast('Failed to execute board transition', 'error');
    }
  };

  const getMemberName = (memberId: string): string => {
    const member = allMembers.find(m => m.id === memberId);
    return member?.name || 'Unknown Member';
  };

  const getPositionColor = (position: string): string => {
    const colorMap: Record<string, string> = {
      'President': 'bg-purple-100 text-purple-800',
      'Vice President': 'bg-blue-100 text-blue-800',
      'Secretary': 'bg-green-100 text-green-800',
      'Treasurer': 'bg-yellow-100 text-yellow-800',
      'Director': 'bg-orange-100 text-orange-800',
      'Committee Chair': 'bg-pink-100 text-pink-800',
    };
    return colorMap[position] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString();
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

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Board Transition Tools</h1>
          <p className="text-gray-600 mt-1">Manage annual board member transitions</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleStartTransition}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <ArrowRight size={16} />
            Start Transition
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Current Board</p>
              <p className="text-2xl font-bold text-gray-900">
                {currentBoardMembers.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Calendar className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Current Year</p>
              <p className="text-2xl font-bold text-gray-900">
                {new Date().getFullYear()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <History className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Past Transitions</p>
              <p className="text-2xl font-bold text-gray-900">
                {transitionHistory.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'current', label: 'Current Board', icon: Users },
              { id: 'transition', label: 'Transition', icon: ArrowRight },
              { id: 'history', label: 'History', icon: History },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`py-4 px-2 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Current Board Tab */}
          {activeTab === 'current' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  Current Board Members
                </h3>
                <span className="text-sm text-gray-500">
                  {currentBoardMembers.length} members
                </span>
              </div>

              {currentBoardMembers.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No board members found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {currentBoardMembers.map((member) => (
                    <div key={member.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Crown className="w-5 h-5 text-yellow-600" />
                          <span className="font-medium text-gray-900">
                            {getMemberName(member.memberId)}
                          </span>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getPositionColor(member.position)}`}>
                          {member.position}
                        </span>
                      </div>

                      <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex justify-between">
                          <span>Term:</span>
                          <span>{member.term}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Start Date:</span>
                          <span>{formatDate(member.startDate)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Status:</span>
                          <span className={`flex items-center gap-1 ${member.isActive ? 'text-green-600' : 'text-red-600'
                            }`}>
                            {member.isActive ? (
                              <>
                                <CheckCircle size={12} />
                                Active
                              </>
                            ) : (
                              <>
                                <X size={12} />
                                Inactive
                              </>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="text-xs text-gray-500">
                          Permissions: {Array.isArray(member.permissions) ? member.permissions.join(', ') : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Transition Tab */}
          {activeTab === 'transition' && (
            <div className="space-y-6">
              <div className="text-center py-8">
                <ArrowRight className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Board Transition Management
                </h3>
                <p className="text-gray-600 mb-6">
                  Manage the annual transition of board members and roles
                </p>
                <button
                  onClick={handleStartTransition}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
                >
                  <Plus size={16} />
                  Start New Transition
                </button>
              </div>
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  Transition History
                </h3>
                <span className="text-sm text-gray-500">
                  {transitionHistory.length} transitions
                </span>
              </div>

              {transitionHistory.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No transition history found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {transitionHistory.map((transition) => (
                    <div key={transition.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-blue-600" />
                          <span className="font-medium text-gray-900">
                            {transition.year} Transition
                          </span>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${transition.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : transition.status === 'in_progress'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                          {transition.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600 mb-2">Outgoing Board:</p>
                          <div className="space-y-1">
                            {transition.outgoingBoard.map((member) => (
                              <div key={member.id} className="flex justify-between">
                                <span>{getMemberName(member.memberId)}</span>
                                <span className="text-gray-500">{member.position}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-gray-600 mb-2">Incoming Board:</p>
                          <div className="space-y-1">
                            {transition.incomingBoard.map((member) => (
                              <div key={member.id} className="flex justify-between">
                                <span>{getMemberName(member.memberId)}</span>
                                <span className="text-gray-500">{member.position}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500">
                        Completed on {formatDate(transition.transitionDate)} by {transition.completedBy}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Transition Modal */}
      {showTransitionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900">
                Board Transition for {transitionYear}
              </h3>
              <button
                onClick={() => setShowTransitionModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              {/* Transition Year */}
              <div>
                <Forms.Input
                  label="Transition Year"
                  type="number"
                  value={transitionYear}
                  onChange={(e) => setTransitionYear(e.target.value)}
                  min={new Date().getFullYear()}
                  max={new Date().getFullYear() + 5}
                />
              </div>

              {/* Current Board Summary */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">
                  Outgoing Board ({currentBoardMembers.length} members)
                </h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    {currentBoardMembers.map((member) => (
                      <div key={member.id} className="flex justify-between">
                        <span>{getMemberName(member.memberId)}</span>
                        <span className="text-gray-500">{member.position}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Incoming Board */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">
                    Incoming Board ({incomingBoard.length} members)
                  </h4>
                  <button
                    onClick={handleAddIncomingMember}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors flex items-center gap-1"
                  >
                    <Plus size={14} />
                    Add Member
                  </button>
                </div>

                <div className="space-y-3">
                  {incomingBoard.map((member, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Forms.Select
                          label="Member"
                          value={member.memberId || ''}
                          onChange={(e) => handleUpdateIncomingMember(index, { memberId: e.target.value })}
                          options={[
                            { value: '', label: 'Select Member' },
                            ...allMembers
                              .filter(m => m.role !== UserRole.BOARD) // Exclude current board members
                              .map(m => ({ value: m.id, label: m.name }))
                          ]}
                        >
                          <option value="">Select Member</option>
                          {allMembers
                            .filter(m => m.role !== UserRole.BOARD)
                            .map(m => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </Forms.Select>

                        <Forms.Select
                          label="Position"
                          value={member.position || ''}
                          onChange={(e) => handleUpdateIncomingMember(index, { position: e.target.value })}
                          options={[
                            { value: '', label: 'Select Position' },
                            { value: 'President', label: 'President' },
                            { value: 'Vice President', label: 'Vice President' },
                            { value: 'Secretary', label: 'Secretary' },
                            { value: 'Treasurer', label: 'Treasurer' },
                            { value: 'Director', label: 'Director' },
                            { value: 'Committee Chair', label: 'Committee Chair' },
                          ]}
                        >
                          <option value="">Select Position</option>
                          <option value="President">President</option>
                          <option value="Vice President">Vice President</option>
                          <option value="Secretary">Secretary</option>
                          <option value="Treasurer">Treasurer</option>
                          <option value="Director">Director</option>
                          <option value="Committee Chair">Committee Chair</option>
                        </Forms.Select>

                        <div className="flex items-end">
                          <button
                            onClick={() => handleRemoveIncomingMember(index)}
                            className="px-3 py-2 text-red-600 hover:text-red-800 transition-colors"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>

                      {member.permissions && member.permissions.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="text-xs text-gray-500">
                            Auto-assigned permissions: {Array.isArray(member.permissions) ? member.permissions.join(', ') : ''}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {incomingBoard.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No incoming board members added yet
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={() => setShowTransitionModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteTransition}
                disabled={incomingBoard.filter(m => m.memberId && m.position).length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Save size={16} />
                Execute Transition
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};