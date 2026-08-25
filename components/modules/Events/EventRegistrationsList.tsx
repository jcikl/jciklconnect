import React from 'react';
import { CheckCircle, ChevronDown, DollarSign, Leaf, Plus, RefreshCw, Trash2, Users } from 'lucide-react';
import type { Event, EventRegistration, Member } from '../../../types';
import { Button, Badge } from '../../ui/Common';
import { EventsService } from '../../../services/eventsService';
import { EventAddParticipantForm, type EventAddParticipantFormData } from './EventAddParticipantForm';
import type { EventParticipantSubTab } from './EventParticipantsSubTabs';

interface EventRegistrationsListProps {
  event: Event;
  member: Member | null;
  members: Member[];
  participations: EventRegistration[];
  participantSubTab: EventParticipantSubTab;
  isCommitteeMember: boolean;
  showAddParticipant: boolean;
  addMemberId: string;
  addForm: EventAddParticipantFormData;
  addingParticipant: boolean;
  updatingRegId: string | null;
  expandedRows: Set<string>;
  canCancelRegistration: boolean;
  onShowAddParticipant: () => void;
  onSetAddMemberId: (memberId: string) => void;
  onSetAddForm: React.Dispatch<React.SetStateAction<EventAddParticipantFormData>>;
  onSetShowAddParticipant: (show: boolean) => void;
  onAddParticipant: () => void;
  onSetExpandedRows: React.Dispatch<React.SetStateAction<Set<string>>>;
  onSetParticipations: React.Dispatch<React.SetStateAction<EventRegistration[]>>;
  onMarkPaid: (registration: EventRegistration) => void;
  onUndoPaid: (registration: EventRegistration) => void;
  onMarkCheckedIn: (registration: EventRegistration) => void;
  onUndoCheckedIn: (registration: EventRegistration) => void;
  onCancelRegistration: (registration: EventRegistration) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  isBoardMember: (member: Member) => boolean;
  isDirector: (member: Member) => boolean;
  nameInitials: (name: string) => string;
  initialsColor: (id: string) => string;
  memberAvatar: (member: Member) => string | undefined;
}

export const EventRegistrationsList: React.FC<EventRegistrationsListProps> = ({
  event,
  member,
  members,
  participations,
  participantSubTab,
  isCommitteeMember,
  showAddParticipant,
  addMemberId,
  addForm,
  addingParticipant,
  updatingRegId,
  expandedRows,
  canCancelRegistration,
  onShowAddParticipant,
  onSetAddMemberId,
  onSetAddForm,
  onSetShowAddParticipant,
  onAddParticipant,
  onSetExpandedRows,
  onSetParticipations,
  onMarkPaid,
  onUndoPaid,
  onMarkCheckedIn,
  onUndoCheckedIn,
  onCancelRegistration,
  showToast,
  isBoardMember,
  isDirector,
  nameInitials,
  initialsColor,
  memberAvatar,
}) => {
  const boardIds = new Set(members.filter(candidate => isBoardMember(candidate) || isDirector(candidate)).map(candidate => candidate.id));
  const filtered = participations.filter(registration => {
    if (participantSubTab === 'all') return true;
    const targetMember = members.find(candidate => candidate.id === registration.memberId);
    if (participantSubTab === 'member') return targetMember && !boardIds.has(targetMember.id) && (targetMember.role === 'MEMBER' || targetMember.role === 'member');
    if (participantSubTab === 'guest') return !targetMember || targetMember.role === 'GUEST' || targetMember.role === 'guest';
    return true;
  });
  const roleOrder = (registration: EventRegistration) => {
    const targetMember = members.find(candidate => candidate.id === registration.memberId);
    if (!targetMember) return 4;
    if (isBoardMember(targetMember) && !isDirector(targetMember)) return 1;
    if (isDirector(targetMember)) return 2;
    return 3;
  };
  const sorted = [...filtered].sort((a, b) => {
    const cancelledDiff = (a.status === 'cancelled' ? 1 : 0) - (b.status === 'cancelled' ? 1 : 0);
    if (cancelledDiff !== 0) return cancelledDiff;
    const roleDiff = roleOrder(a) - roleOrder(b);
    if (roleDiff !== 0) return roleDiff;
    const nameA = members.find(candidate => candidate.id === a.memberId)?.general?.name ?? a.memberName ?? '';
    const nameB = members.find(candidate => candidate.id === b.memberId)?.general?.name ?? b.memberName ?? '';
    return nameA.localeCompare(nameB);
  });

  return (
    <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
      {isCommitteeMember && !showAddParticipant && (
        <button
          type="button"
          onClick={onShowAddParticipant}
          className="w-full flex items-center gap-3 px-3 py-3 text-slate-400 hover:bg-slate-50/50 hover:text-jci-blue transition-colors group"
        >
          <div className="w-8 h-8 rounded-lg border-2 border-dashed border-current flex items-center justify-center shrink-0">
            <Plus size={14} />
          </div>
          <span className="text-sm font-semibold">Add Participant</span>
        </button>
      )}
      {showAddParticipant && (
        <EventAddParticipantForm
          members={members.filter(candidate => !isBoardMember(candidate) && !isDirector(candidate))}
          participationsMemberIds={new Set(participations.filter(registration => registration.status !== 'cancelled').map(registration => registration.memberId))}
          value={addMemberId}
          form={addForm}
          adding={addingParticipant}
          onMemberChange={(memberId, selectedMember) => {
            onSetAddMemberId(memberId);
            if (selectedMember) onSetAddForm({
              dietary: (selectedMember.general?.dietaryPreference as 'normal' | 'vegetarian' | 'halal') ?? 'normal',
              tshirtSize: selectedMember.others?.tshirtSize ?? '',
            });
          }}
          onFormChange={onSetAddForm}
          onConfirm={onAddParticipant}
          onCancel={() => {
            onSetShowAddParticipant(false);
            onSetAddMemberId('');
            onSetAddForm({ dietary: 'normal', tshirtSize: '' });
          }}
        />
      )}
      {filtered.length === 0 && !showAddParticipant && (
        <div className="text-center py-10 text-slate-400">
          <Users size={36} className="mx-auto mb-2 opacity-20" />
          <p className="text-sm">No registrations yet.</p>
        </div>
      )}
      {sorted.map(registration => {
        const targetMember = members.find(candidate => candidate.id === registration.memberId);
        const roleLabel = (() => {
          if (!targetMember) return 'Public';
          if (isDirector(targetMember)) return 'Comm. Dir.';
          if (isBoardMember(targetMember)) return 'Board';
          const role = (targetMember.role ?? '').toUpperCase();
          if (role === 'ADMIN' || role === 'SUPER_ADMIN') return 'Admin';
          if (role === 'BOARD') return 'Board';
          if (role === 'MEMBER') return 'Member';
          return 'Guest';
        })();
        const isCancelled = registration.status === 'cancelled';
        const cancelLabel = isCancelled
          ? registration.cancelledByRole === 'self'
            ? 'Cancelled by self'
            : `Cancelled by ${registration.cancelledByRole ?? 'admin'}: ${registration.cancelledByName ?? ''}`
          : null;
        const isRowExpanded = expandedRows.has(registration.id);
        const hasDetails = registration.dietary != null || registration.isVegetarian != null || registration.emergencyContactName || registration.emergencyContactPhone || registration.tshirtSize;

        return (
          <div key={registration.id} className={`transition-colors ${isCancelled ? 'bg-red-50/40 opacity-70' : 'bg-white'}`}>
            <div className="px-3 py-2.5">
              <div className="flex items-start gap-2.5">
                <button
                  type="button"
                  onClick={() => hasDetails && onSetExpandedRows(prev => {
                    const next = new Set(prev);
                    next.has(registration.id) ? next.delete(registration.id) : next.add(registration.id);
                    return next;
                  })}
                  className={`relative w-7 h-7 rounded-full shrink-0 mt-0.5 overflow-hidden ${hasDetails ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  {targetMember && memberAvatar(targetMember) ? (
                    <img src={memberAvatar(targetMember)} alt={targetMember.general?.name ?? ''} className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center text-[10px] font-bold ${initialsColor(targetMember?.id ?? registration.memberId ?? '')}`}>
                      {nameInitials(targetMember?.general?.name ?? registration.memberName ?? '?')}
                    </div>
                  )}
                  {hasDetails && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <ChevronDown size={13} className={`text-white transition-transform ${isRowExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                      roleLabel === 'Board' ? 'bg-jci-blue/10 text-jci-blue' :
                      roleLabel === 'Admin' ? 'bg-purple-100 text-purple-700' :
                      roleLabel === 'Member' ? 'bg-slate-100 text-slate-500' :
                      roleLabel === 'Public' ? 'bg-orange-100 text-orange-700' :
                      'bg-slate-100 text-slate-400'
                    }`}>{roleLabel}</span>
                    <p className={`text-sm font-semibold truncate ${isCancelled ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{targetMember?.general?.name ?? registration.memberName ?? 'Unknown'}</p>
                    {(registration.dietary === 'vegetarian' || (!registration.dietary && registration.isVegetarian)) && <Leaf size={11} className="shrink-0 text-emerald-500" />}
                    {registration.dietary === 'halal' && <span className="shrink-0 text-[10px]" title="Halal">☪️</span>}
                    {registration.tshirtSize && <span className="shrink-0 text-[10px] font-medium text-slate-400">{registration.tshirtSize}</span>}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                      {isCancelled ? (
                        <Badge variant="error" className="text-[10px] shrink-0 h-5 !py-0">{cancelLabel}</Badge>
                      ) : (
                        <Badge variant={registration.status === 'checked_in' ? 'success' : registration.status === 'paid' ? 'warning' : 'neutral'} className="text-[10px] shrink-0 h-5 !py-0">
                          {registration.status === 'registered' ? 'Pending Payment' : registration.status === 'paid' ? 'Pending Check-In' : 'Checked In'}
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {isCancelled && isCommitteeMember && (
                        <Button size="sm" variant="outline" className="h-5 px-1" title="Re-register" disabled={updatingRegId !== null} onClick={async () => {
                          try {
                            await EventsService.registerForEvent(event.id, registration.memberId, { memberName: targetMember?.general?.name ?? registration.memberName, registeredBy: member?.id, registeredByName: member?.general?.name ?? member?.id });
                            onSetParticipations(prev => prev.map(item => item.id === registration.id ? { ...item, status: 'registered' as const, cancelledAt: null, cancelledBy: null, cancelledByName: null, cancelledByRole: null, registeredBy: member?.id, registeredByName: member?.general?.name ?? member?.id } : item));
                            showToast(`${targetMember?.general?.name ?? registration.memberName ?? 'Member'} re-registered`, 'success');
                          } catch (err) {
                            showToast(err instanceof Error ? err.message : 'Failed', 'error');
                          }
                        }}><RefreshCw size={12} /></Button>
                      )}
                      {!isCancelled && (
                        <Button size="sm" variant={registration.paidAt ? 'outline' : 'secondary'} className="h-5 px-1" title={registration.paidAt ? 'Undo Payment' : 'Mark Paid'} disabled={updatingRegId !== null} onClick={() => registration.paidAt ? onUndoPaid(registration) : onMarkPaid(registration)}><DollarSign size={12} /></Button>
                      )}
                      {!isCancelled && (
                        <Button size="sm" variant={registration.status === 'checked_in' ? 'outline' : 'secondary'} className="h-5 px-1" title={registration.status === 'checked_in' ? 'Undo Check-In' : 'Check In'} disabled={updatingRegId !== null} onClick={() => registration.status === 'checked_in' ? onUndoCheckedIn(registration) : onMarkCheckedIn(registration)}><CheckCircle size={12} /></Button>
                      )}
                      {!isCancelled && canCancelRegistration && (
                        <Button size="sm" variant="secondary" className="h-5 px-1 text-red-500 border-red-200 hover:bg-red-50" title="Cancel registration" disabled={updatingRegId !== null} onClick={() => onCancelRegistration(registration)}><Trash2 size={12} /></Button>
                      )}
                    </div>
                  </div>
                  {!isCancelled && (
                    <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-400 flex-wrap">
                      <span>Reg: {registration.registeredByName ?? 'Self'}</span>
                      {registration.paidByName && <><span className="opacity-40">|</span><span>Verified: {registration.paidByName}</span></>}
                      {registration.checkedInByName && <><span className="opacity-40">|</span><span>Check-in by: {registration.checkedInByName}</span></>}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {isRowExpanded && hasDetails && (
              <div className="px-3 pb-2.5 pl-[52px] grid grid-cols-2 gap-x-4 gap-y-1.5">
                {(registration.dietary != null || registration.isVegetarian != null) && (
                  <div className="col-span-2 flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Dietary</span>
                    {registration.dietary === 'vegetarian' || (!registration.dietary && registration.isVegetarian) ? (
                      <Badge variant="success" className="text-[10px]">🌿 Vegetarian</Badge>
                    ) : registration.dietary === 'halal' ? (
                      <Badge variant="success" className="text-[10px]">☪️ Halal</Badge>
                    ) : (
                      <Badge variant="neutral" className="text-[10px]">Normal</Badge>
                    )}
                  </div>
                )}
                {registration.tshirtSize && (
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">T-Shirt Size</p>
                    <p className="text-xs font-medium text-slate-700">{registration.tshirtSize}</p>
                  </div>
                )}
                {(registration.emergencyContactName || registration.emergencyContactPhone) && (
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Emergency Contact</p>
                    {registration.emergencyContactName && <p className="text-xs font-medium text-slate-700 truncate">{registration.emergencyContactName}</p>}
                    {registration.emergencyContactPhone && <p className="text-xs text-slate-500">{registration.emergencyContactPhone}</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
