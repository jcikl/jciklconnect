import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  Mail, Phone, Calendar, Users, UserCheck, FileText, CheckCircle, AlertCircle
} from 'lucide-react';
import { Button, Badge, Modal, useToast } from '../../ui/Common';
import type { Member, ProbationTask, Transaction } from '../../../types';
import { UserRole, MembershipDues } from '../../../types';
import { useMembers } from '../../../hooks/useMembers';
import { useAuth } from '../../../hooks/useAuth';
import { usePermissions } from '../../../hooks/usePermissions';
import { formatDateToDDMMMYYYY } from '../../../utils/dateUtils';
import { FinanceService } from '../../../services/financeService';
import { MembershipConfigService } from '../../../services/membershipConfigService';
import { GuestApprovalModal } from './GuestApprovalModal';

const norm = (s?: string | null) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const findMatchingTransaction = (guest: Member, txs: Transaction[]): Transaction | null => {
  const names = [norm(guest.name), norm(guest.fullName)].filter(n => n.length >= 3);
  for (const tx of txs) {
    const desc = norm(tx.description);
    const ref = norm(tx.referenceNumber ?? '');
    for (const name of names) {
      if (desc.includes(name) || ref.includes(name)) return tx;
    }
  }
  return null;
};

const hasPaidFee = (guest: Member) =>
  !!(guest.jciCareer?.hasPaidInitiationFee ?? guest.hasPaidInitiationFee);

const makeDefaultTasks = (): ProbationTask[] => [
  { id: `task-${Date.now()}-1`, title: 'Attend Orientation Session', description: 'Attend the new member orientation session', status: 'Pending', assignedAt: new Date().toISOString(), category: 'Training' },
  { id: `task-${Date.now()}-2`, title: 'Complete Member Profile', description: 'Complete your member profile with all required information', status: 'Pending', assignedAt: new Date().toISOString(), category: 'Documentation' },
  { id: `task-${Date.now()}-3`, title: 'Attend First Event', description: 'Attend at least one JCI event', status: 'Pending', assignedAt: new Date().toISOString(), category: 'Event' },
];

// Guest Management View Component
export const GuestManagementView: React.FC<{ searchQuery?: string; onSelect: (id: string) => void }> = ({ searchQuery, onSelect }) => {
  const { members, updateMember } = useMembers();
  const { member: currentMember } = useAuth();
  const { isBoard, isAdmin } = usePermissions();
  const { showToast } = useToast();
  const [guests, setGuests] = useState<Member[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<Member | null>(null);

  const getInitiationYear = (dateStr?: string | null) => {
    if (!dateStr) return new Date().getFullYear();
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth();
    return month >= 9 ? year + 1 : year;
  };

  // Batch approval states
  const [selectedGuestIds, setSelectedGuestIds] = useState<Set<string>>(new Set());
  const [showBatchApprovalModal, setShowBatchApprovalModal] = useState(false);

  const GUEST_APPROVER_TITLES = ['President', 'Secretary', 'Honorary Treasurer'];
  const canApprove = isAdmin || (
    isBoard &&
    !!currentMember?.currentBoardPosition &&
    GUEST_APPROVER_TITLES.some(t => (currentMember.currentBoardPosition ?? '').includes(t))
  );

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

    const guestList = members.filter(m => (m.role === UserRole.GUEST || m.membershipType === 'Guest') && filterFn(m));
    setGuests(guestList);
  }, [members, searchQuery]);

  const handleGuestApproved = async (
    guestId: string,
    memberUpdates: Partial<Member>,
    linkedTxId?: string,
    linkedTxUpdates?: Partial<Transaction>
  ) => {
    await updateMember(guestId, memberUpdates);
    if (linkedTxId && linkedTxUpdates) {
      await FinanceService.updateTransaction(linkedTxId, linkedTxUpdates);
    }
    setSelectedGuest(null);
  };

  const handleBatchApproveGuests = async () => {
    if (!canApprove) {
      showToast('Only President, Secretary or Honorary Treasurer may approve guests', 'error');
      return;
    }

    try {
      // Fetch unlinked membership transactions once for batch auto-matching
      let batchUnlinkedTxs: Transaction[] = [];
      try {
        const all = await FinanceService.getAllTransactions();
        batchUnlinkedTxs = all.filter(t =>
          t.type === 'Income' &&
          t.category === 'Membership' &&
          !t.memberId &&
          !t.isSplitChild
        );
      } catch {
        // Non-fatal: proceed without tx matching
      }

      const usedTxIds = new Set<string>();
      let approvedCount = 0;
      let skippedCount = 0;

      // Sequential loop avoids race condition on usedTxIds (M-B)
      const batchConfigRules = await MembershipConfigService.getRules();
      for (const id of Array.from(selectedGuestIds)) {
        const guest = guests.find(g => g.id === id);
        if (!guest) continue;

        // Each guest gets their own initiation year based on their join date
        const guestYear = getInitiationYear(guest.joinDate);
        const yearStr = String(guestYear);

        // Find match from remaining unlinked txs (exclude already used in this batch)
        const available = batchUnlinkedTxs.filter(t => !usedTxIds.has(t.id));
        const tx = findMatchingTransaction(guest, available);

        // Skip guests with no matched payment — they need individual review
        if (!tx) {
          skippedCount++;
          continue;
        }
        usedTxIds.add(tx.id);

        const dues = (hasPaidFee(guest) ? 0 : 50) + (batchConfigRules.Probation?.duesAmount ?? MembershipDues.Probation);
        const paidAmount = tx.amount;
        const membershipStatus = paidAmount >= dues ? 'paid' : 'partial';

        const memberUpdates: Partial<Member> = {
          role: UserRole.MEMBER,
          membershipType: 'Probation' as any,
          probationTasks: makeDefaultTasks(),
          probationApprovedBy: currentMember?.id,
          probationApprovedAt: new Date().toISOString(),
          membership: {
            ...(guest.membership || {}),
            [yearStr]: {
              year: guestYear,
              dues,
              amount: paidAmount,
              status: membershipStatus,
              transactionId: [tx.id]
            }
          }
        };

        await updateMember(id, memberUpdates);

        try {
          await FinanceService.updateTransaction(tx.id, {
            memberId: id,
            projectId: `${guestYear} membership`,
            category: 'Membership',
            purpose: paidAmount >= dues ? `${guestYear} New Membership` : `${guestYear} Membership`,
            status: paidAmount >= dues ? 'Cleared' : tx.status,
          });
        } catch (txErr) {
          // Roll back the member role change so data stays consistent (E10)
          await updateMember(id, { role: UserRole.GUEST, membershipType: 'Guest' as any });
          console.error(`Batch approve: tx update failed for guest ${id}, rolled back`, txErr);
          skippedCount++;
          usedTxIds.delete(tx.id);
          continue;
        }

        approvedCount++;
      }

      const msg = skippedCount > 0
        ? `Approved ${approvedCount} guest(s). ${skippedCount} skipped — no payment record found (approve individually).`
        : `Successfully approved ${approvedCount} guest(s)`;
      showToast(msg, skippedCount > 0 ? 'warning' : 'success');
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
                    onClick={() => setShowBatchApprovalModal(true)}
                    className="flex items-center gap-2"
                  >
                    <UserCheck size={14} />
                    Batch Approve
                  </Button>
                )}
              </div>
            )}
            {guests.map(guest => {
              const paid = hasPaidFee(guest);
              return (
                <div key={guest.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    {canApprove && guest.role === UserRole.GUEST && (
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
                        <div className="flex items-center gap-1.5 shrink-0">
                          {paid ? (
                            <Badge variant="success" icon={<CheckCircle size={10} />} className="text-[10px] py-0.5">Fee Paid</Badge>
                          ) : (
                            <Badge variant="warning" icon={<AlertCircle size={10} />} className="text-[10px] py-0.5">Fee Pending</Badge>
                          )}
                          <Badge variant="neutral" className="bg-slate-100 text-slate-600 border-none px-2 py-0 text-[10px] uppercase font-bold tracking-wider">Guest</Badge>
                        </div>
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
                    {canApprove && guest.role === UserRole.GUEST && (
                      <Button
                        size="sm"
                        onClick={() => setSelectedGuest(guest)}
                        className="flex-1 sm:flex-none h-9 px-4 rounded-lg font-bold bg-jci-blue hover:bg-jci-navy text-white shadow-sm shadow-jci-blue/20 transition-colors"
                      >
                        <UserCheck size={14} className="mr-2" />
                        Approve
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <Users className="mx-auto text-slate-300 mb-3" size={32} />
            <p className="text-slate-500 font-medium">No guests pending approval</p>
          </div>
        )}
      </div>

      {selectedGuest && (
        <GuestApprovalModal
          guest={selectedGuest}
          approverId={currentMember?.id ?? ''}
          onClose={() => setSelectedGuest(null)}
          onApproved={handleGuestApproved}
        />
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
              Each guest will be matched to an unlinked membership payment by name. Only guests with a matched payment record will be approved.
            </p>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <AlertCircle size={14} className="text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700">
                Guests with no matching payment will be <strong>skipped</strong> and must be approved individually. Each guest's initiation year is computed from their join date.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowBatchApprovalModal(false)}>Cancel</Button>
              <Button onClick={handleBatchApproveGuests}>
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
