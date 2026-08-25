import React from 'react';
import { Tabs } from '../../ui/Common';

export type EventDetailActiveTab = 'details' | 'participants' | 'stats' | 'feedback';

interface EventDetailTabsNavProps {
  tabs: { id: string; label: string }[];
  activeTab: EventDetailActiveTab;
  onTabChange: (tab: EventDetailActiveTab) => void;
}

const tabIdByActiveTab: Record<EventDetailActiveTab, string> = {
  details: 'Event Details',
  participants: 'Participants',
  stats: 'Stats',
  feedback: 'Feedback',
};

const activeTabByTabId: Record<string, EventDetailActiveTab> = {
  'Event Details': 'details',
  Participants: 'participants',
  Stats: 'stats',
  Feedback: 'feedback',
};

export const EventDetailTabsNav: React.FC<EventDetailTabsNavProps> = ({
  tabs,
  activeTab,
  onTabChange,
}) => {
  if (tabs.length <= 1) return null;

  return (
    <Tabs
      tabs={tabs}
      activeTab={tabIdByActiveTab[activeTab]}
      onTabChange={(tab) => onTabChange(activeTabByTabId[tab] ?? 'feedback')}
      className="mb-4"
    />
  );
};
