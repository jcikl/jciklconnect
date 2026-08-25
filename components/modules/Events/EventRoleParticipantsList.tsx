import React from 'react';
import { CheckCircle, DollarSign, Leaf, Plus, Trash2, Users } from 'lucide-react';
import type { Event, EventRegistration, Member } from '../../../types';
import { Button, Badge } from '../../ui/Common';
import { EventsService } from '../../../services/eventsService';

interface EventRoleParticipantsListProps {
  event: Event;
  member: Member | null;
  role: 'board' | 'director';
  members: Member[];
  participations: EventRegistration[];
  updatingRegId: string | null;
  canCancelRegistration: boolean;
  onSetUpdatingRegId: (registrationId: string | null) => void;
  onSetParticipations: React.Dispatch<React.SetStateAction<EventRegistration[]>>;
  onMarkPaid: (registration: EventRegistration) => void;
  onUndoPaid: (registration: EventRegistration) => void;
  onMarkCheckedIn: (registration: EventRegistration) => void;
  onUndoCheckedIn: (registration: EventRegistration) => void;
  onCancelRegistration: (registration: EventRegistration) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  getBoardPos: (member: Member) => string;
  shortPos: (position: string) => string;
  isBoardMember: (member: Member) => boolean;
  isDirector: (member: Member) => boolean;
  nameInitials: (name: string) => string;
  initialsColor: (id: string) => string;
  memberAvatar: (member: Member) => string | undefined;
}

const boardPositionOrder: Record<string, number> = {
  Pres: 1,
  IPP: 2,
  EVP: 3,
  VPI: 4,
  VPIA: 5,
  VPB: 6,
  VPC: 7,
  VPLOM: 8,
  HT: 9,
  SG: 10,
  GLC: 11,
};

export const EventRoleParticipantsList: React.FC<EventRoleParticipantsListProps> = ({
  event,
  member,
  role,
  members,
  participations,
  updatingRegId,
  canCancelRegistration,
  onSetUpdatingRegId,
  onSetParticipations,
  onMarkPaid,
  onUndoPaid,
  onMarkCheckedIn,
  onUndoCheckedIn,
  onCancelRegistration,
  showToast,
  getBoardPos,
  shortPos,
  isBoardMember,
  isDirector,
  nameInitials,
  initialsColor,
  memberAvatar,
}) => {
  const targetMembers = role === 'board'
    ? members.filter(candidate => isBoardMember(candidate))
    : members.filter(candidate => isDirector(candidate) && !isBoardMember(candidate));

  if (targetMembers.length === 0) {
    return (
      <div className="text-center py-10 text-slate-400">
        <Users size={36} className="mx-auto mb-2 opacity-20" />
        <p className="text-sm">No {role === 'board' ? 'board members' : 'commission directors'} found.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
      {[...targetMembers].sort((a, b) => {
        const aReg = participations.find(registration => registration.memberId === a.id && registration.status !== 'cancelled');
        const bReg = participations.find(registration => registration.memberId === b.id && registration.status !== 'cancelled');
        const regDiff = (aReg ? 0 : 1) - (bReg ? 0 : 1);
        if (regDiff !== 0) return regDiff;
        if (role === 'board') {
          const positionRank = (target: Member) => boardPositionOrder[shortPos(getBoardPos(target))] ?? 99;
          const positionDiff = positionRank(a) - positionRank(b);
          if (positionDiff !== 0) return positionDiff;
        }
        return (a.general?.name ?? '').localeCompare(b.general?.name ?? '');
      }).map(targetMember => {
        const registration = participations.find(item => item.memberId === targetMember.id && item.status !== 'cancelled');
        const registrationStatus = registration?.status;

        return (
          <div key={targetMember.id} className="px-3 py-2.5 bg-white">
            <div className="flex items-start gap-2.5">
              {memberAvatar(targetMember) ? (
                <img
                  src={memberAvatar(targetMember)}
                  alt={targetMember.general?.name ?? ''}
                  className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold ${initialsColor(targetMember.id)}`}>
                  {nameInitials(targetMember.general?.name ?? '')}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  {getBoardPos(targetMember) && (
                    <span className="shrink-0 inline-flex items-center justify-center text-[8px] font-semibold w-10 h-5 rounded-full bg-jci-blue/10 text-jci-blue">{shortPos(getBoardPos(targetMember))}</span>
                  )}
                  <p className="text-sm font-semibold truncate text-slate-900">{targetMember.general?.name}</p>
                  {(registration?.dietary === 'vegetarian' || (!registration?.dietary && registration?.isVegetarian)) && <Leaf size={11} className="shrink-0 text-emerald-500" />}
                  {registration?.dietary === 'halal' && <span className="shrink-0 text-[10px]" title="Halal">☪️</span>}
                  {registration?.tshirtSize && <span className="shrink-0 text-[10px] font-medium text-slate-400">{registration.tshirtSize}</span>}
                </div>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                    {registrationStatus ? (
                      <Badge variant={registrationStatus === 'checked_in' ? 'success' : registrationStatus === 'paid' ? 'warning' : 'neutral'} className="text-[10px] shrink-0 h-5 !py-0">
                        {registrationStatus === 'registered' ? 'Pending Payment' : registrationStatus === 'paid' ? 'Pending Check-In' : 'Checked In'}
                      </Badge>
                    ) : (
                      <Badge variant="error" className="text-[10px] shrink-0 h-5 !py-0">Not Registered</Badge>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {registration && (
                      <Button size="sm" variant={registration.paidAt ? 'outline' : 'secondary'} className="h-5 px-1" title={registration.paidAt ? 'Undo Payment' : 'Mark Paid'} disabled={updatingRegId !== null} onClick={() => registration.paidAt ? onUndoPaid(registration) : onMarkPaid(registration)}><DollarSign size={12} /></Button>
                    )}
                    {registration && (
                      <Button size="sm" variant={registration.status === 'checked_in' ? 'outline' : 'secondary'} className="h-5 px-1" title={registration.status === 'checked_in' ? 'Undo Check-In' : 'Check In'} disabled={updatingRegId !== null} onClick={() => registration.status === 'checked_in' ? onUndoCheckedIn(registration) : onMarkCheckedIn(registration)}><CheckCircle size={12} /></Button>
                    )}
                    {registration && canCancelRegistration && (
                      <Button size="sm" variant="secondary" className="h-5 px-1 text-red-500 border-red-200 hover:bg-red-50" title="Cancel registration" disabled={updatingRegId !== null} onClick={() => onCancelRegistration(registration)}><Trash2 size={12} /></Button>
                    )}
                    {!registration && (
                      <Button size="sm" variant="outline" className="h-5 px-1" title="Register" disabled={updatingRegId !== null} onClick={async () => {
                        onSetUpdatingRegId(targetMember.id);
                        try {
                          await EventsService.registerForEvent(event.id, targetMember.id, { memberName: targetMember.general?.name, registeredBy: member?.id, registeredByName: member?.general?.name ?? member?.id });
                          const newRegistration: EventRegistration = { id: `manual-${Date.now()}`, eventId: event.id, memberId: targetMember.id, status: 'registered', createdAt: new Date().toISOString(), loId: null, memberName: targetMember.general?.name, registeredBy: member?.id, registeredByName: member?.general?.name ?? member?.id };
                          onSetParticipations(prev => [newRegistration, ...prev]);
                          showToast(`${targetMember.general?.name} added`, 'success');
                        } catch (err) {
                          showToast(err instanceof Error ? err.message : 'Failed', 'error');
                        } finally {
                          onSetUpdatingRegId(null);
                        }
                      }}><Plus size={14} /></Button>
                    )}
                  </div>
                </div>
                {registration && (
                  <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-400 flex-wrap">
                    <span>Reg: {registration.registeredByName ?? 'Self'}</span>
                    {registration.paidByName && <><span className="opacity-40">|</span><span>Verified: {registration.paidByName}</span></>}
                    {registration.checkedInByName && <><span className="opacity-40">|</span><span>Check-in by: {registration.checkedInByName}</span></>}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
