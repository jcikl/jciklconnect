import React from 'react';
import { RefreshCw } from 'lucide-react';
import type { Event, EventRegistration, Member } from '../../../types';
import { EventRegistrationsList } from './EventRegistrationsList';
import { EventRoleParticipantsList } from './EventRoleParticipantsList';
import { EventParticipantsSubTabs, type EventParticipantSubTab } from './EventParticipantsSubTabs';
import type { EventAddParticipantFormData } from './EventAddParticipantForm';

interface EventParticipantsTabProps {
  event: Event;
  member: Member | null;
  members: Member[];
  participations: EventRegistration[];
  loadingParticipants: boolean;
  participantSubTab: EventParticipantSubTab;
  isCommitteeMember: boolean;
  showAddParticipant: boolean;
  addMemberId: string;
  addForm: EventAddParticipantFormData;
  addingParticipant: boolean;
  updatingRegId: string | null;
  expandedRows: Set<string>;
  canCancelRegistration: boolean;
  onTabChange: (tab: EventParticipantSubTab) => void;
  onShowQr: () => void;
  onShowAddParticipant: () => void;
  onSetAddMemberId: (memberId: string) => void;
  onSetAddForm: React.Dispatch<React.SetStateAction<EventAddParticipantFormData>>;
  onSetShowAddParticipant: (show: boolean) => void;
  onAddParticipant: () => void;
  onSetUpdatingRegId: (registrationId: string | null) => void;
  onSetExpandedRows: React.Dispatch<React.SetStateAction<Set<string>>>;
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

export const EventParticipantsTab: React.FC<EventParticipantsTabProps> = ({
  event,
  member,
  members,
  participations,
  loadingParticipants,
  participantSubTab,
  isCommitteeMember,
  showAddParticipant,
  addMemberId,
  addForm,
  addingParticipant,
  updatingRegId,
  expandedRows,
  canCancelRegistration,
  onTabChange,
  onShowQr,
  onShowAddParticipant,
  onSetAddMemberId,
  onSetAddForm,
  onSetShowAddParticipant,
  onAddParticipant,
  onSetUpdatingRegId,
  onSetExpandedRows,
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
}) => (
  <div className="animate-fade-in">
    <EventParticipantsSubTabs
      members={members}
      participations={participations}
      activeTab={participantSubTab}
      onTabChange={onTabChange}
      onShowQr={onShowQr}
      isBoardMember={isBoardMember}
      isDirector={isDirector}
    />
    {loadingParticipants ? (
      <div className="flex items-center justify-center py-10">
        <RefreshCw className="animate-spin text-jci-blue" size={22} />
      </div>
    ) : (participantSubTab === 'board' || participantSubTab === 'director') ? (
      <EventRoleParticipantsList
        event={event}
        member={member}
        role={participantSubTab}
        members={members}
        participations={participations}
        updatingRegId={updatingRegId}
        canCancelRegistration={canCancelRegistration}
        onSetUpdatingRegId={onSetUpdatingRegId}
        onSetParticipations={onSetParticipations}
        onMarkPaid={onMarkPaid}
        onUndoPaid={onUndoPaid}
        onMarkCheckedIn={onMarkCheckedIn}
        onUndoCheckedIn={onUndoCheckedIn}
        onCancelRegistration={onCancelRegistration}
        showToast={showToast}
        getBoardPos={getBoardPos}
        shortPos={shortPos}
        isBoardMember={isBoardMember}
        isDirector={isDirector}
        nameInitials={nameInitials}
        initialsColor={initialsColor}
        memberAvatar={memberAvatar}
      />
    ) : (
      <EventRegistrationsList
        event={event}
        member={member}
        members={members}
        participations={participations}
        participantSubTab={participantSubTab}
        isCommitteeMember={isCommitteeMember}
        showAddParticipant={showAddParticipant}
        addMemberId={addMemberId}
        addForm={addForm}
        addingParticipant={addingParticipant}
        updatingRegId={updatingRegId}
        expandedRows={expandedRows}
        canCancelRegistration={canCancelRegistration}
        onShowAddParticipant={onShowAddParticipant}
        onSetAddMemberId={onSetAddMemberId}
        onSetAddForm={onSetAddForm}
        onSetShowAddParticipant={onSetShowAddParticipant}
        onAddParticipant={onAddParticipant}
        onSetExpandedRows={onSetExpandedRows}
        onSetParticipations={onSetParticipations}
        onMarkPaid={onMarkPaid}
        onUndoPaid={onUndoPaid}
        onMarkCheckedIn={onMarkCheckedIn}
        onUndoCheckedIn={onUndoCheckedIn}
        onCancelRegistration={onCancelRegistration}
        showToast={showToast}
        isBoardMember={isBoardMember}
        isDirector={isDirector}
        nameInitials={nameInitials}
        initialsColor={initialsColor}
        memberAvatar={memberAvatar}
      />
    )}
  </div>
);
