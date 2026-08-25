import React from 'react';
import { Calendar, List } from 'lucide-react';
import { Button, PageHeader } from '../../ui/Common';

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
      <div className="flex gap-2">
        <Button
          variant={viewMode === 'list' ? 'primary' : 'outline'}
          onClick={() => onViewModeChange('list')}
        >
          <List size={16} className="sm:mr-2" /><span className="hidden sm:inline">List View</span>
        </Button>
        <Button
          variant={viewMode === 'calendar' ? 'primary' : 'outline'}
          onClick={() => onViewModeChange('calendar')}
        >
          <Calendar size={16} className="sm:mr-2" /><span className="hidden sm:inline">Calendar View</span>
        </Button>
      </div>
    }
  />
);
