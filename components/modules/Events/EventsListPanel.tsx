import React, { useMemo } from 'react';
import { Card, Button } from '../../ui/Common';
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

const KL = 'jci kuala lumpur';

function isJCIKLRelevant(e: Event): boolean {
  const lo    = ((e as any).hostingLo ?? '').trim().toLowerCase();
  const coRaw = (e as any).coHosting;
  const level = ((e as any).level ?? '').trim().toLowerCase();
  const isKL = lo === KL || (
    Array.isArray(coRaw)
      ? coRaw.some((c: string) => typeof c === 'string' && c.trim().toLowerCase() === KL)
      : typeof coRaw === 'string' && coRaw.trim().toLowerCase() === KL
  );
  return isKL || level === 'national' || level === 'jci' || level === 'area' || level.startsWith('area');
}

const EMPTY_MESSAGE = 'No events found.';

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
  const filteredEvents = useMemo(
    () => events
      .filter(isJCIKLRelevant)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [events]
  );

  const visibleEvents = activeTab === 'Completed'
    ? filteredEvents.slice(0, completedLimit)
    : filteredEvents.slice(0, upcomingLimit);

  const hasMoreCompleted = activeTab === 'Completed' && filteredEvents.length > completedLimit;
  const hasMoreUpcoming  = activeTab === 'Upcoming'  && filteredEvents.length > upcomingLimit;

  const eventGrid = (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
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

  const loadMoreUpcomingButton = hasMoreUpcoming && (
    <Button variant="outline" size="sm" onClick={onLoadMoreUpcoming}>
      Load more ({filteredEvents.length - upcomingLimit} remaining)
    </Button>
  );

  const loadMoreCompletedButton = hasMoreCompleted && (
    <Button variant="outline" size="sm" onClick={onLoadMoreCompleted}>
      Load more ({filteredEvents.length - completedLimit} remaining)
    </Button>
  );

  return (
    <div className="space-y-4">
      {/* Desktop */}
      <Card noPadding className="hidden md:block overflow-hidden">
        <LoadingState
          loading={loading}
          error={error}
          empty={filteredEvents.length === 0}
          emptyMessage={EMPTY_MESSAGE}
          onRetry={onRetry}
        >
          <div className="p-6">
            {eventGrid}
          </div>
          {hasMoreUpcoming && (
            <div className="flex justify-center pb-4">
              {loadMoreUpcomingButton}
            </div>
          )}
        </LoadingState>
      </Card>

      {/* Mobile */}
      <div className="md:hidden">
        <LoadingState
          loading={loading}
          error={error}
          empty={filteredEvents.length === 0}
          emptyMessage={EMPTY_MESSAGE}
          onRetry={onRetry}
        >
          {eventGrid}
          {hasMoreCompleted && (
            <div className="flex justify-center pt-2">
              {loadMoreCompletedButton}
            </div>
          )}
          {hasMoreUpcoming && (
            <div className="flex justify-center pt-2">
              {loadMoreUpcomingButton}
            </div>
          )}
        </LoadingState>
      </div>
    </div>
  );
};
