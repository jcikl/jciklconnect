import React from 'react';
import { QrCode } from 'lucide-react';
import type { EventRegistration, Member } from '../../../types';

export type EventParticipantSubTab = 'all' | 'board' | 'director' | 'member' | 'guest';

interface EventParticipantsSubTabsProps {
  members: Member[];
  participations: EventRegistration[];
  activeTab: EventParticipantSubTab;
  onTabChange: (tab: EventParticipantSubTab) => void;
  onShowQr: () => void;
  isBoardMember: (member: Member) => boolean;
  isDirector: (member: Member) => boolean;
}

export const EventParticipantsSubTabs: React.FC<EventParticipantsSubTabsProps> = ({
  members,
  participations,
  activeTab,
  onTabChange,
  onShowQr,
  isBoardMember,
  isDirector,
}) => {
  const boardMembers = members.filter(member => isBoardMember(member));
  const directorMembers = members.filter(member => isDirector(member) && !isBoardMember(member));
  const boardIds = new Set([...boardMembers, ...directorMembers].map(member => member.id));
  const activeRegs = participations.filter(registration => registration.status !== 'cancelled');
  const boardRegs = activeRegs.filter(registration => boardMembers.some(member => member.id === registration.memberId));
  const directorRegs = activeRegs.filter(registration => directorMembers.some(member => member.id === registration.memberId));
  const memberRegs = activeRegs.filter(registration => {
    const member = members.find(candidate => candidate.id === registration.memberId);
    return member && !boardIds.has(member.id) && (member.role === 'MEMBER' || member.role === 'member');
  });
  const guestRegs = activeRegs.filter(registration => {
    const member = members.find(candidate => candidate.id === registration.memberId);
    return !member || member.role === 'GUEST' || member.role === 'guest';
  });
  const subTabs: { key: EventParticipantSubTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: activeRegs.length },
    { key: 'board', label: 'Board', count: boardRegs.length },
    { key: 'director', label: 'Comm. Dir.', count: directorRegs.length },
    { key: 'member', label: 'Member', count: memberRegs.length },
    { key: 'guest', label: 'Guest', count: guestRegs.length },
  ];

  return (
    <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1 scrollbar-none">
      <button
        onClick={onShowQr}
        className="flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors bg-slate-100 text-slate-500 hover:bg-slate-200 ml-auto"
        title="Show QR Check-In"
      >
        <QrCode size={12} /> QR
      </button>
      {subTabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${activeTab === tab.key ? 'bg-jci-blue text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
        >
          {tab.label}
          <span className={`text-[10px] font-bold ${activeTab === tab.key ? 'opacity-80' : 'opacity-60'}`}>({tab.count})</span>
        </button>
      ))}
    </div>
  );
};
