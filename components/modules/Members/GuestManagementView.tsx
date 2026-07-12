import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  Mail, Phone, Calendar, Users, UserCheck, FileText
} from 'lucide-react';
import { Button, Badge, Modal, useToast } from '../../ui/Common';
import type { Member, ProbationTask } from '../../../types';
import { UserRole, MembershipDues } from '../../../types';
import { useMembers } from '../../../hooks/useMembers';
import { useAuth } from '../../../hooks/useAuth';
import { usePermissions } from '../../../hooks/usePermissions';
import { formatDateToDDMMMYYYY } from '../../../utils/dateUtils';

// Guest Management View Component
export const GuestManagementView: React.FC<{ searchQuery?: string; onSelect: (id: string) => void }> = ({ searchQuery, onSelect }) => {
  const { members, updateMember } = useMembers();
  const { member: currentMember } = useAuth();
  const { isBoard, isAdmin } = usePermissions();
  const { showToast } = useToast();
  const [guests, setGuests] = useState<Member[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<Member | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  const getInitiationYear = (dateStr?: string | null) => {
    if (!dateStr) return new Date().getFullYear();
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed: 9 is October
    return month >= 9 ? year + 1 : year;
  };

  const [approvalYear, setApprovalYear] = useState(getInitiationYear(new Date().toISOString()));

  // Batch approval states
  const [selectedGuestIds, setSelectedGuestIds] = useState<Set<string>>(new Set());
  const [showBatchApprovalModal, setShowBatchApprovalModal] = useState(false);

  const canApprove = isBoard || isAdmin;

  useEffect(() => {
    const term = (searchQuery || '').toLowerCase();
    const filterFn = (m: Member) => {
      if (!term) return true;
      return (
        (m.name ?? '').toLowerCase().includes(term) ||
        (m.email ?? '').toLowerCase().includes(term) ||
        (m.phone ?? '').toLowerCase().includes(term) ||
        (m.fullName ?? '').toLowerCase().includes(term) ||
        (m.address ?? '').toLowerCase().includes(term)
      );
    };

    const guestList = members.filter(m => m.role === UserRole.GUEST && filterFn(m));
    setGuests(guestList);
  }, [members, searchQuery]);

  useEffect(() => {
    if (selectedGuest) {
      setApprovalYear(getInitiationYear(selectedGuest.joinDate));
    }
  }, [selectedGuest]);

  const handleApproveGuest = async (guestId: string) => {
    if (!canApprove) {
      showToast('Only board members can approve guests', 'error');
      return;
    }

    try {
      // Default probation tasks
      const defaultTasks: ProbationTask[] = [
        {
          id: `task-${Date.now()}-1`,
          title: 'Attend Orientation Session',
          description: 'Attend the new member orientation session',
          status: 'Pending',
          assignedAt: new Date().toISOString(),
          category: 'Training',
        },
        {
          id: `task-${Date.now()}-2`,
          title: 'Complete Member Profile',
          description: 'Complete your member profile with all required information',
          status: 'Pending',
          assignedAt: new Date().toISOString(),
          category: 'Documentation',
        },
        {
          id: `task-${Date.now()}-3`,
          title: 'Attend First Event',
          description: 'Attend at least one JCI event',
          status: 'Pending',
          assignedAt: new Date().toISOString(),
          category: 'Event',
        },
      ];

      const yearStr = String(approvalYear);

      await updateMember(guestId, {
        role: UserRole.MEMBER,
        membershipType: 'Probation' as any,
        probationTasks: defaultTasks,
        probationApprovedBy: currentMember?.id,
        probationApprovedAt: new Date().toISOString(),
        membership: {
          ...(selectedGuest?.membership || {}),
          [yearStr]: {
            year: approvalYear,
            dues: ((selectedGuest?.jciCareer?.hasPaidInitiationFee ?? selectedGuest?.hasPaidInitiationFee) ? 0 : 50) + MembershipDues.Probation, // 300 + 50 = 350
            amount: 0,
            status: 'pending',
            transactionId: []
          }
        }
      });

      showToast('Guest approved and moved to probation member', 'success');
      setShowApprovalModal(false);
      setSelectedGuest(null);
    } catch (err) {
      showToast('Failed to approve guest', 'error');
    }
  };

  const handleBatchApproveGuests = async () => {
    if (!canApprove) {
      showToast('Only board members can approve guests', 'error');
      return;
    }

    try {
      const defaultTasks: ProbationTask[] = [
        {
          id: `task-${Date.now()}-1`,
          title: 'Attend Orientation Session',
          description: 'Attend the new member orientation session',
          status: 'Pending',
          assignedAt: new Date().toISOString(),
          category: 'Training',
        },
        {
          id: `task-${Date.now()}-2`,
          title: 'Complete Member Profile',
          description: 'Complete your member profile with all required information',
          status: 'Pending',
          assignedAt: new Date().toISOString(),
          category: 'Documentation',
        },
        {
          id: `task-${Date.now()}-3`,
          title: 'Attend First Event',
          description: 'Attend at least one JCI event',
          status: 'Pending',
          assignedAt: new Date().toISOString(),
          category: 'Event',
        },
      ];

      const yearStr = String(approvalYear);
      const updates = Array.from(selectedGuestIds).map(id => {
        const guest = guests.find(g => g.id === id);
        return {
          id,
          role: UserRole.MEMBER,
          membershipType: 'Probation' as any,
          probationTasks: defaultTasks,
          probationApprovedBy: currentMember?.id,
          probationApprovedAt: new Date().toISOString(),
          membership: {
            ...(guest?.membership || {}),
            [yearStr]: {
              year: approvalYear,
              dues: ((guest?.jciCareer?.hasPaidInitiationFee ?? guest?.hasPaidInitiationFee) ? 0 : 50) + MembershipDues.Probation, // 300 + 50 = 350
              amount: 0,
              status: 'pending',
              transactionId: []
            }
          }
        } as Partial<Member>;
      });

      await Promise.all(updates.map(update => updateMember(update.id, update)));

      showToast(`Successfully approved ${selectedGuestIds.size} guests`, 'success');
      setShowBatchApprovalModal(false);
      setSelectedGuestIds(new Set());
    } catch (err) {
      showToast('Failed to approve guests', 'error');
    }
  };

  const toggleGuestSelection = (id: string) => {
    setSelectedGuestIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllGuests = () => {
    if (selectedGuestIds.size === guests.length && guests.length > 0) {
      setSelectedGuestIds(new Set());
    } else {
      setSelectedGuestIds(new Set(guests.map(g => g.id)));
    }
  };

  return (
    <div className="space-y-6">
      {/* Guests Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Guests Pending Approval</h3>
          <span className="bg-slate-100 text-slate-600 text-xs font-black px-2.5 py-1 rounded-full">{guests.length}</span>
        </div>
        {guests.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {canApprove && (
              <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl lg:col-span-2">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 text-jci-blue focus:ring-jci-blue"
                    checked={selectedGuestIds.size === guests.length && guests.length > 0}
                    onChange={toggleAllGuests}
                  />
                  <span className="text-sm font-medium text-slate-700">
                    Select All ({selectedGuestIds.size} selected)
                  </span>
                </div>
                {selectedGuestIds.size > 0 && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      let defaultYear = getInitiationYear(new Date().toISOString());
                      if (selectedGuestIds.size > 0) {
                        const firstId = Array.from(selectedGuestIds)[0];
                        const firstGuest = guests.find(g => g.id === firstId);
                        defaultYear = getInitiationYear(firstGuest?.joinDate);
                      }
                      setApprovalYear(defaultYear);
                      setShowBatchApprovalModal(true);
                    }}
                    className="flex items-center gap-2"
                  >
                    <UserCheck size={14} />
                    Batch Approve
                  </Button>
                )}
              </div>
            )}
            {guests.map(guest => (
              <div key={guest.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all gap-4">
                <div className="flex items-center gap-4 flex-1">
                  {canApprove && (
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 text-jci-blue focus:ring-jci-blue"
                      checked={selectedGuestIds.has(guest.id)}
                      onChange={() => toggleGuestSelection(guest.id)}
                    />
                  )}
                  <div className="relative">
                    <img src={guest.avatar || undefined} className="w-12 h-12 rounded-full border border-slate-100" alt={guest.name} />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-slate-500 border-2 border-white rounded-full"></div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="font-bold text-slate-900 break-words">{guest.name}</div>
                      <Badge variant="neutral" className="bg-slate-100 text-slate-600 border-none px-2 py-0 text-[10px] uppercase font-bold tracking-wider shrink-0">Guest</Badge>
                    </div>
                    <div className="flex flex-col gap-0.5 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Mail size={12} className="shrink-0" /> {guest.email}</span>
                      {guest.phone && <span className="flex items-center gap-1"><Phone size={12} className="shrink-0" /> {guest.phone}</span>}
                      <span className="flex items-center gap-1"><Calendar size={12} className="shrink-0" /> Joined: {formatDateToDDMMMYYYY(guest.joinDate)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSelect(guest.id)}
                    className="flex-1 sm:flex-none h-9 px-4 rounded-lg font-medium text-slate-600 hover:text-jci-blue hover:border-jci-blue hover:bg-jci-blue/5 transition-colors"
                  >
                    <FileText size={14} className="mr-2" />
                    Review
                  </Button>
                  {canApprove && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedGuest(guest);
                        setApprovalYear(getInitiationYear(guest.joinDate));
                        setShowApprovalModal(true);
                      }}
                      className="flex-1 sm:flex-none h-9 px-4 rounded-lg font-bold bg-jci-blue hover:bg-jci-navy text-white shadow-sm shadow-jci-blue/20 transition-colors"
                    >
                      <UserCheck size={14} className="mr-2" />
                      Approve
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <Users className="mx-auto text-slate-300 mb-3" size={32} />
            <p className="text-slate-500 font-medium">No guests pending approval</p>
          </div>
        )}
      </div>

      {/* Approval Modal */}
      {showApprovalModal && selectedGuest && (
        <Modal
          isOpen={showApprovalModal}
          onClose={() => {
            setShowApprovalModal(false);
            setSelectedGuest(null);
          }}
          title={`Approve Guest: ${selectedGuest.name}`}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Approving this guest will move them to probation member status. They will need to complete probation tasks before becoming an official member.
            </p>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">Default Probation Tasks:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Attend Orientation Session</li>
                <li>• Complete Member Profile</li>
                <li>• Attend First Event</li>
              </ul>
            </div>

            <div className="space-y-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <label className="block text-sm font-bold text-amber-700 mb-1">Set Initiation Year:</label>
              <select
                value={approvalYear}
                onChange={(e) => setApprovalYear(parseInt(e.target.value))}
                className="w-full rounded-lg border-2 border-amber-200 bg-white px-3 py-2 text-sm font-bold text-amber-900 focus:border-amber-500"
              >
                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + 2 - i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <p className="text-[10px] text-amber-600 italic">This will set the year for the initial membership record.</p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowApprovalModal(false);
                  setSelectedGuest(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleApproveGuest(selectedGuest.id)}
              >
                <UserCheck size={16} className="mr-2" />
                Approve as Probation Member
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Batch Approval Modal */}
      {showBatchApprovalModal && (
        <Modal
          isOpen={showBatchApprovalModal}
          onClose={() => setShowBatchApprovalModal(false)}
          title={`Approve ${selectedGuestIds.size} Guests`}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Approving these guests will move them to probation member status. They will need to complete probation tasks before becoming official members.
            </p>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">Default Probation Tasks:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Attend Orientation Session</li>
                <li>• Complete Member Profile</li>
                <li>• Attend First Event</li>
              </ul>
            </div>

            <div className="space-y-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <label className="block text-sm font-bold text-amber-700 mb-1">Set Initiation Year for All:</label>
              <select
                value={approvalYear}
                onChange={(e) => setApprovalYear(parseInt(e.target.value))}
                className="w-full rounded-lg border-2 border-amber-200 bg-white px-3 py-2 text-sm font-bold text-amber-900 focus:border-amber-500"
              >
                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + 2 - i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <p className="text-[10px] text-amber-600 italic">This will set the year for their initial membership records.</p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowBatchApprovalModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBatchApproveGuests}
              >
                <UserCheck size={16} className="mr-2" />
                Batch Approve
              </Button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};
