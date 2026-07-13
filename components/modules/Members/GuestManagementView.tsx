import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  Mail, Phone, Calendar, Users, UserCheck, FileText, CreditCard, CheckCircle, AlertCircle
} from 'lucide-react';
import { Button, Badge, Modal, useToast } from '../../ui/Common';
import type { Member, ProbationTask, Transaction } from '../../../types';
import { UserRole, MembershipDues } from '../../../types';
import { useMembers } from '../../../hooks/useMembers';
import { useAuth } from '../../../hooks/useAuth';
import { usePermissions } from '../../../hooks/usePermissions';
import { formatDateToDDMMMYYYY } from '../../../utils/dateUtils';
import { FinanceService } from '../../../services/financeService';

// Normalize string for fuzzy name matching (same logic as DuesRenewalDashboard)
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

// Guest Management View Component
export const GuestManagementView: React.FC<{ searchQuery?: string; onSelect: (id: string) => void }> = ({ searchQuery, onSelect }) => {
  const { members, updateMember } = useMembers();
  const { member: currentMember } = useAuth();
  const { isBoard, isAdmin } = usePermissions();
  const { showToast } = useToast();
  const [guests, setGuests] = useState<Member[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<Member | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  // Payment matching state
  const [matchedTx, setMatchedTx] = useState<Transaction | null>(null);
  const [txLoading, setTxLoading] = useState(false);
  const [unlinkedMembershipTxs, setUnlinkedMembershipTxs] = useState<Transaction[]>([]);
  const [showTxPicker, setShowTxPicker] = useState(false);

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

    const guestList = members.filter(m => (m.role === UserRole.GUEST || m.membershipType === 'Guest') && filterFn(m));
    setGuests(guestList);
  }, [members, searchQuery]);

  useEffect(() => {
    if (selectedGuest) {
      setApprovalYear(getInitiationYear(selectedGuest.joinDate));
    }
  }, [selectedGuest]);

  // Search for matching payment transaction when approval modal opens
  useEffect(() => {
    if (!showApprovalModal || !selectedGuest) return;
    setTxLoading(true);
    setMatchedTx(null);
    setShowTxPicker(false);
    FinanceService.getAllTransactions()
      .then(all => {
        const unlinked = all.filter(t =>
          t.type === 'Income' &&
          t.category === 'Membership' &&
          !t.memberId &&
          !t.isSplitChild
        );
        setUnlinkedMembershipTxs(unlinked);
        setMatchedTx(findMatchingTransaction(selectedGuest, unlinked));
      })
      .catch(() => {
        setUnlinkedMembershipTxs([]);
      })
      .finally(() => setTxLoading(false));
  }, [showApprovalModal, selectedGuest]);

  const closeApprovalModal = () => {
    setShowApprovalModal(false);
    setSelectedGuest(null);
    setMatchedTx(null);
    setUnlinkedMembershipTxs([]);
    setShowTxPicker(false);
  };

  const handleApproveGuest = async (guestId: string) => {
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
      const dues = ((selectedGuest?.jciCareer?.hasPaidInitiationFee ?? selectedGuest?.hasPaidInitiationFee) ? 0 : 50) + MembershipDues.Probation;
      const paidAmount = matchedTx?.amount ?? 0;
      const membershipStatus = paidAmount >= dues ? 'paid' : paidAmount > 0 ? 'partial' : 'pending';

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
            dues,
            amount: paidAmount,
            status: membershipStatus,
            transactionId: matchedTx ? [matchedTx.id] : []
          }
        }
      });

      // Link the matched transaction to this member
      if (matchedTx) {
        const purpose = paidAmount >= dues
          ? `${approvalYear} New Membership`
          : `${approvalYear} Membership`;
        await FinanceService.updateTransaction(matchedTx.id, {
          memberId: guestId,
          projectId: `${approvalYear} membership`,
          category: 'Membership',
          purpose,
        });
      }

      showToast('Guest approved and moved to probation member', 'success');
      closeApprovalModal();
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

      const yearStr = String(approvalYear);
      const usedTxIds = new Set<string>();

      await Promise.all(Array.from(selectedGuestIds).map(async id => {
        const guest = guests.find(g => g.id === id);
        const dues = ((guest?.jciCareer?.hasPaidInitiationFee ?? guest?.hasPaidInitiationFee) ? 0 : 50) + MembershipDues.Probation;

        // Find match from remaining unlinked txs (exclude already used in this batch)
        const available = batchUnlinkedTxs.filter(t => !usedTxIds.has(t.id));
        const tx = guest ? findMatchingTransaction(guest, available) : null;
        if (tx) usedTxIds.add(tx.id);

        const paidAmount = tx?.amount ?? 0;
        const membershipStatus = paidAmount >= dues ? 'paid' : paidAmount > 0 ? 'partial' : 'pending';

        await updateMember(id, {
          role: UserRole.MEMBER,
          membershipType: 'Probation' as any,
          probationTasks: defaultTasks,
          probationApprovedBy: currentMember?.id,
          probationApprovedAt: new Date().toISOString(),
          membership: {
            ...(guest?.membership || {}),
            [yearStr]: {
              year: approvalYear,
              dues,
              amount: paidAmount,
              status: membershipStatus,
              transactionId: tx ? [tx.id] : []
            }
          }
        } as Partial<Member>);

        if (tx) {
          const purpose = paidAmount >= dues ? `${approvalYear} New Membership` : `${approvalYear} Membership`;
          await FinanceService.updateTransaction(tx.id, {
            memberId: id,
            projectId: `${approvalYear} membership`,
            category: 'Membership',
            purpose,
          });
        }
      }));

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
                  {canApprove && guest.role === UserRole.GUEST && (
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
          onClose={closeApprovalModal}
          title={`Approve Guest: ${selectedGuest.name}`}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Approving this guest will move them to probation member status. They will need to complete probation tasks before becoming an official member.
            </p>

            {/* Payment Matching */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <h4 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                <CreditCard size={14} />
                Payment Record
              </h4>
              {txLoading ? (
                <p className="text-xs text-slate-500 animate-pulse">Searching for matching payment...</p>
              ) : matchedTx ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle size={13} />
                    <span className="text-xs font-bold">Matched Payment Found</span>
                  </div>
                  <div className="text-xs text-slate-600 space-y-0.5 pl-5">
                    <div className="font-medium">{formatDateToDDMMMYYYY(matchedTx.date)} · RM {matchedTx.amount.toFixed(2)}</div>
                    <div className="truncate text-slate-500">{matchedTx.description}</div>
                    {matchedTx.referenceNumber && (
                      <div className="text-slate-400">Ref: {matchedTx.referenceNumber}</div>
                    )}
                  </div>
                  <button
                    onClick={() => setShowTxPicker(v => !v)}
                    className="text-xs text-jci-blue underline pl-5"
                  >
                    {showTxPicker ? 'Hide' : 'Change'}
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertCircle size={13} />
                    <span className="text-xs font-medium">No matching payment found</span>
                  </div>
                  <p className="text-xs text-slate-500 pl-5">Membership dues will be set as pending.</p>
                  {unlinkedMembershipTxs.length > 0 && (
                    <button
                      onClick={() => setShowTxPicker(v => !v)}
                      className="text-xs text-jci-blue underline pl-5"
                    >
                      {showTxPicker ? 'Hide' : 'Select manually'}
                    </button>
                  )}
                </div>
              )}

              {/* Transaction picker */}
              {showTxPicker && (
                <div className="border border-slate-200 rounded-lg overflow-hidden mt-2">
                  <div className="max-h-44 overflow-y-auto divide-y divide-slate-100">
                    <button
                      onClick={() => { setMatchedTx(null); setShowTxPicker(false); }}
                      className="w-full px-3 py-2 text-left text-xs text-slate-400 italic hover:bg-slate-50"
                    >
                      No payment — set as pending
                    </button>
                    {unlinkedMembershipTxs.map(tx => (
                      <button
                        key={tx.id}
                        onClick={() => { setMatchedTx(tx); setShowTxPicker(false); }}
                        className={`w-full px-3 py-2 text-left text-xs hover:bg-blue-50 transition-colors ${matchedTx?.id === tx.id ? 'bg-blue-50 text-jci-blue' : 'text-slate-700'}`}
                      >
                        <div className="font-medium">{formatDateToDDMMMYYYY(tx.date)} · RM {tx.amount.toFixed(2)}</div>
                        <div className="text-slate-500 truncate">{tx.description}</div>
                        {tx.referenceNumber && <div className="text-slate-400">Ref: {tx.referenceNumber}</div>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
            {!matchedTx && !txLoading && (
              <p className="text-xs text-red-600 font-medium flex items-center gap-1.5">
                <AlertCircle size={13} />
                A matched payment record is required before approving.
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={closeApprovalModal}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleApproveGuest(selectedGuest.id)}
                disabled={!matchedTx || txLoading}
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
              Approving these guests will move them to probation member status. Payment records will be auto-matched by name from unlinked membership transactions.
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-2">
              <CreditCard size={14} className="text-slate-400 mt-0.5 shrink-0" />
              <p className="text-xs text-slate-600">
                Payment records will be matched automatically by name. Unmatched guests will be set as pending payment.
              </p>
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
