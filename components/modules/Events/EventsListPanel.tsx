import React, { useState, useMemo } from 'react';
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

type HostingTab = 'all' | 'jcikl' | 'central' | 'other-area' | 'national';

const HOSTING_TABS: { key: HostingTab; label: string }[] = [
  { key: 'all',        label: 'All'        },
  { key: 'jcikl',      label: 'JCI KL'     },
  { key: 'central',    label: 'Central'    },
  { key: 'other-area', label: 'Other Area' },
  { key: 'national',   label: 'National'   },
];

const KL = 'jci kuala lumpur';
const OTHER_AREA_VALUES = new Set(['area south', 'area sabah', 'area sarawak', 'area north']);

function matchesHostingTab(e: Event, tab: HostingTab): boolean {
  if (tab === 'all') return true;

  const lo    = ((e as any).hostingLo ?? '').trim().toLowerCase();
  const coRaw = (e as any).coHosting;
  const area  = ((e as any).area  ?? '').trim().toLowerCase();
  const level = ((e as any).level ?? '').trim().toLowerCase();

  const isKL = lo === KL || (
    Array.isArray(coRaw)
      ? coRaw.some((c: string) => typeof c === 'string' && c.trim().toLowerCase() === KL)
      : typeof coRaw === 'string' && coRaw.trim().toLowerCase() === KL
  );

  switch (tab) {
    case 'jcikl':      return isKL;
    case 'central':    return area === 'area central';
    case 'other-area': return OTHER_AREA_VALUES.has(area);
    case 'national':   return level === 'national';
  }
}

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
  const [hostingTab, setHostingTab] = useState<HostingTab>('all');

  const filteredEvents = useMemo(
    () => events
      .filter(e => matchesHostingTab(e, hostingTab))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [events, hostingTab]
  );

  const visibleEvents = activeTab === 'Completed'
    ? filteredEvents.slice(0, completedLimit)
    : filteredEvents.slice(0, upcomingLimit);

  const hasMoreCompleted = activeTab === 'Completed' && filteredEvents.length > completedLimit;
  const hasMoreUpcoming  = activeTab === 'Upcoming'  && filteredEvents.length > upcomingLimit;

  const filterBar = (
    <div className="flex gap-1.5 flex-wrap px-4 pt-3 pb-1 md:px-6 md:pt-4 md:pb-0">
      {HOSTING_TABS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => setHostingTab(key)}
          className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide transition-all ${
            hostingTab === key
              ? 'bg-jci-blue text-white shadow-sm'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

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
        {filterBar}
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
        {filterBar}
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
