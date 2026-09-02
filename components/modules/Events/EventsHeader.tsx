import React from 'react';
import { Calendar, List } from 'lucide-react';
import { PageHeader } from '../../ui/Common';
import { ViewToggle } from '../../ui/ViewToggle';

export type EventsViewMode = 'list' | 'calendar';

interface EventsHeaderProps {
  viewMode: EventsViewMode;
  onViewModeChange: (mode: EventsViewMode) => void;
}

export const EventsHeader: React.FC<EventsHeaderProps> = ({
  viewMode,
  onViewModeChange,
}) => (
  <PageHeader
    title="Event List"
    description="Plan, track, and analyze LO activities."
    action={
      <ViewToggle
        options={[
          { id: 'list', icon: <List size={14} />, label: 'List View' },
          { id: 'calendar', icon: <Calendar size={14} />, label: 'Calendar View' },
        ]}
        value={viewMode}
        onChange={v => onViewModeChange(v as EventsViewMode)}
      />
    }
  />
);
