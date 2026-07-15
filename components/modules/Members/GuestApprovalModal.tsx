import React, { useState, useEffect } from 'react';
import { CreditCard, CheckCircle, AlertCircle, UserCheck } from 'lucide-react';
import { Modal, Button, useToast } from '../../ui/Common';
import type { Member, Transaction } from '../../../types';
import { UserRole, MembershipDues } from '../../../types';
import { FinanceService } from '../../../services/financeService';
import { MembershipConfigService } from '../../../services/membershipConfigService';
import { formatDateToDDMMMYYYY } from '../../../utils/dateUtils';

// ── helpers (same logic as GuestManagementView) ──────────────────────────────
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

const makeDefaultTasks = () => [
  { id: `task-${Date.now()}-1`, title: 'Attend Orientation Session', description: 'Attend the new member orientation session', status: 'Pending' as const, assignedAt: new Date().toISOString(), category: 'Training' as const },
  { id: `task-${Date.now()}-2`, title: 'Complete Member Profile', description: 'Complete your member profile with all required information', status: 'Pending' as const, assignedAt: new Date().toISOString(), category: 'Documentation' as const },
  { id: `task-${Date.now()}-3`, title: 'Attend First Event', description: 'Attend at least one JCI event', status: 'Pending' as const, assignedAt: new Date().toISOString(), category: 'Event' as const },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface GuestApprovalModalProps {
  guest: Member;
  approverId: string;
  onClose: () => void;
  onApproved: (guestId: string, updates: Partial<Member>, linkedTxId?: string, linkedTxUpdates?: Partial<Transaction>) => Promise<void>;
}

export const GuestApprovalModal: React.FC<GuestApprovalModalProps> = ({
  guest,
  approverId,
  onClose,
  onApproved,
}) => {
  const { showToast } = useToast();

  const getInitiationYear = (dateStr?: string | null) => {
    if (!dateStr) return new Date().getFullYear();
    const d = new Date(dateStr);
    return d.getMonth() >= 9 ? d.getFullYear() + 1 : d.getFullYear();
  };

  const [approvalYear, setApprovalYear] = useState(() => getInitiationYear(guest.joinDate));
  const [matchedTx, setMatchedTx] = useState<Transaction | null>(null);
  const [txLoading, setTxLoading] = useState(false);
  const [unlinkedTxs, setUnlinkedTxs] = useState<Transaction[]>([]);
  const [showTxPicker, setShowTxPicker] = useState(false);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
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
        setUnlinkedTxs(unlinked);
        setMatchedTx(findMatchingTransaction(guest, unlinked));
      })
      .catch(() => setUnlinkedTxs([]))
      .finally(() => setTxLoading(false));
  }, [guest.id]);

  const handleApprove = async () => {
    if (!matchedTx || txLoading) return;
    setApproving(true);
    try {
      const yearStr = String(approvalYear);
      const configRules = await MembershipConfigService.getRules();
      const dues = (hasPaidFee(guest) ? 0 : 50) + (configRules.Probation?.duesAmount ?? MembershipDues.Probation);
      const paidAmount = matchedTx.amount;
      const membershipStatus = paidAmount >= dues ? 'paid' : paidAmount > 0 ? 'partial' : 'pending';

      const memberUpdates: Partial<Member> = {
        role: UserRole.MEMBER,
        membershipType: 'Probation' as any,
        probationTasks: makeDefaultTasks() as any,
        probationApprovedBy: approverId,
        probationApprovedAt: new Date().toISOString(),
        membership: {
          ...(guest.membership || {}),
          [yearStr]: {
            year: approvalYear,
            dues,
            amount: paidAmount,
            status: membershipStatus,
            transactionId: [matchedTx.id],
          },
        },
      };

      const txUpdates: Partial<Transaction> = {
        memberId: guest.id,
        projectId: `${approvalYear} membership`,
        category: 'Membership',
        purpose: paidAmount >= dues ? `${approvalYear} New Membership` : `${approvalYear} Membership`,
        status: paidAmount >= dues ? 'Cleared' : matchedTx.status,
      };

      await onApproved(guest.id, memberUpdates, matchedTx.id, txUpdates);
      showToast('Guest approved and moved to probation member', 'success');
      onClose();
    } catch {
      showToast('Failed to approve guest', 'error');
    } finally {
      setApproving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Approve Guest: ${guest.name}`}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Approving this guest will move them to probation member status. They will need to complete probation tasks before becoming an official member.
        </p>

        {/* Payment Matching */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
          <h4 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
            <CreditCard size={14} />
            Payment Record
            {hasPaidFee(guest) && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 ml-1">
                Entry fee previously confirmed
              </span>
            )}
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
                {matchedTx.referenceNumber && <div className="text-slate-400">Ref: {matchedTx.referenceNumber}</div>}
              </div>
              <button onClick={() => setShowTxPicker(v => !v)} className="text-xs text-jci-blue underline pl-5">
                {showTxPicker ? 'Hide' : 'Change'}
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle size={13} />
                <span className="text-xs font-medium">No matching payment found</span>
              </div>
              <p className="text-xs text-slate-500 pl-5">Please locate the payment record before approving.</p>
              {unlinkedTxs.length > 0 && (
                <button onClick={() => setShowTxPicker(v => !v)} className="text-xs text-jci-blue underline pl-5">
                  {showTxPicker ? 'Hide' : 'Select manually'}
                </button>
              )}
            </div>
          )}

          {showTxPicker && (
            <div className="border border-slate-200 rounded-lg overflow-hidden mt-2">
              <div className="max-h-44 overflow-y-auto divide-y divide-slate-100">
                <button
                  onClick={() => { setMatchedTx(null); setShowTxPicker(false); }}
                  className="w-full px-3 py-2 text-left text-xs text-slate-400 italic hover:bg-slate-50"
                >
                  No payment — set as pending
                </button>
                {unlinkedTxs.map(tx => (
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

        {/* Initiation Year */}
        <div className="space-y-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <label className="block text-sm font-bold text-amber-700 mb-1">Set Initiation Year:</label>
          <select
            value={approvalYear}
            onChange={e => setApprovalYear(parseInt(e.target.value))}
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
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleApprove} disabled={!matchedTx || txLoading || approving}>
            <UserCheck size={16} className="mr-2" />
            {approving ? 'Approving...' : 'Approve as Probation Member'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
