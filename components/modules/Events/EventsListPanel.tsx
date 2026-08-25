import React from 'react';
import { Card, Button, Tabs } from '../../ui/Common';
import { LoadingState } from '../../ui/Loading';
import type { Event, Member } from '../../../types';
import { EventRow } from './EventRow';
import type { EventsListTab } from './useEventsListState';

interface EventsListPanelProps {
  activeTab: EventsListTab;
  completedLimit: number;
  upcomingLimit: number;
  events: Event[];
  loading: boolean;
  error: string | null;
  member: Member | null;
  onTabChange: (tab: EventsListTab) => void;
  onRetry: () => void;
  onSelectEvent: (event: Event) => void;
  onLoadMoreCompleted: () => void;
  onLoadMoreUpcoming: () => void;
  registerForEvent: (eventId: string, memberId: string) => void;
  markAttendance: (eventId: string, memberId: string) => void;
}

const EVENT_TABS: EventsListTab[] = ['Upcoming', 'Completed'];
const EMPTY_MESSAGE = 'No events found in this category.';

export const EventsListPanel: React.FC<EventsListPanelProps> = ({
  activeTab,
  completedLimit,
  upcomingLimit,
  events,
  loading,
  error,
  member,
  onTabChange,
  onRetry,
  onSelectEvent,
  onLoadMoreCompleted,
  onLoadMoreUpcoming,
  registerForEvent,
  markAttendance,
}) => {
  const visibleEvents = activeTab === 'Completed'
    ? events.slice(0, completedLimit)
    : events.slice(0, upcomingLimit);

  const hasMoreCompleted = activeTab === 'Completed' && events.length > completedLimit;
  const hasMoreUpcoming = activeTab === 'Upcoming' && events.length > upcomingLimit;

  const eventGrid = (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {visibleEvents.map(event => (
        <EventRow
          key={event.id}
          event={event}
          member={member}
          registerForEvent={registerForEvent}
          markAttendance={markAttendance}
          onClick={() => onSelectEvent(event)}
        />
      ))}
    </div>
  );

  const loadMoreCompletedButton = hasMoreCompleted && (
    <Button variant="outline" size="sm" onClick={onLoadMoreCompleted}>
      Load more ({events.length - completedLimit} remaining)
    </Button>
  );

  const loadMoreUpcomingButton = hasMoreUpcoming && (
    <Button variant="outline" size="sm" onClick={onLoadMoreUpcoming}>
      Load more ({events.length - upcomingLimit} remaining)
    </Button>
  );

  return (
    <div className="space-y-4">
      <div className="md:hidden p-1.5 bg-white rounded-xl border border-slate-200 shadow-sm">
        <Tabs
          fullWidth
          tabs={EVENT_TABS}
          activeTab={activeTab}
          onTabChange={(tab) => onTabChange(tab as EventsListTab)}
        />
      </div>

      <Card noPadding className="hidden md:block overflow-hidden">
        <div className="px-6 pt-4">
          <Tabs
            tabs={EVENT_TABS}
            activeTab={activeTab}
            onTabChange={(tab) => onTabChange(tab as EventsListTab)}
          />
        </div>
        <LoadingState
          loading={loading}
          error={error}
          empty={events.length === 0}
          emptyMessage={EMPTY_MESSAGE}
          onRetry={onRetry}
        >
          <div className="p-6">
            {eventGrid}
          </div>
          {hasMoreCompleted && (
            <div className="hidden md:flex justify-center pb-4">
              {loadMoreCompletedButton}
            </div>
          )}
          {hasMoreUpcoming && (
            <div className="hidden md:flex justify-center pb-4">
              {loadMoreUpcomingButton}
            </div>
          )}
        </LoadingState>
      </Card>

      <div className="md:hidden">
        <LoadingState
          loading={loading}
          error={error}
          empty={events.length === 0}
          emptyMessage={EMPTY_MESSAGE}
          onRetry={onRetry}
        >
          {eventGrid}
          {hasMoreCompleted && (
            <div className="md:hidden flex justify-center pt-2">
              {loadMoreCompletedButton}
            </div>
          )}
          {hasMoreUpcoming && (
            <div className="md:hidden flex justify-center pt-2">
              {loadMoreUpcomingButton}
            </div>
          )}
        </LoadingState>
      </div>
    </div>
  );
};
