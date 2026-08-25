import React from 'react';
import { Calendar } from 'lucide-react';
import type { Event } from '../../types';
import { Button, Skeleton } from '../ui/Common';
import { EventRow } from '../modules/Events/EventRow';

interface DashboardEventsPanelProps {
  eventsLoading: boolean;
  eventTab: 'upcoming' | 'past';
  upcomingEvents: Event[];
  events: Event[];
  member: any;
  onNavigate?: (view: string) => void;
  onSelectEvent: (event: Event) => void;
}

export const DashboardEventsPanel: React.FC<DashboardEventsPanelProps> = ({
  eventsLoading,
  eventTab,
  upcomingEvents,
  events,
  member,
  onNavigate,
  onSelectEvent,
}) => {
  const visibleEvents = eventTab === 'upcoming'
    ? upcomingEvents
    : events.filter(event => new Date(event.date) < new Date());

  return (
    <div className="lg:col-span-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">Events</span>
        <div className="flex-1 h-px bg-slate-100" />
        <button
          onClick={() => onNavigate?.('EVENTS')}
          className="text-[10px] font-black text-jci-blue uppercase tracking-widest hover:opacity-70 transition-opacity shrink-0"
        >
          View All
        </button>
      </div>
      {eventsLoading ? (
        <div className="flex overflow-x-auto gap-3 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(index => <Skeleton key={index} className="flex-none w-[60.6%] sm:w-auto h-[200px]" rounded="2xl" />)}
        </div>
      ) : visibleEvents.length === 0 ? (
        <div className="text-center py-8 text-slate-400 font-medium">
          <Calendar size={32} className="mx-auto mb-2 text-slate-300" />
          <p className="text-sm">No {eventTab} events</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleEvents
            .sort((first, second) => eventTab === 'upcoming' ? new Date(first.date).getTime() - new Date(second.date).getTime() : new Date(second.date).getTime() - new Date(first.date).getTime())
            .slice(0, 5)
            .map(event => (
              <EventRow
                key={event.id}
                event={event}
                member={member}
                horizontal
                onRegister={() => onSelectEvent(event)}
                onClick={() => onSelectEvent(event)}
              />
            ))}
        </div>
      )}
      {visibleEvents.length > 8 && onNavigate && (
        <Button variant="ghost" className="w-full mt-3 text-sm text-jci-blue hover:bg-blue-50" onClick={() => onNavigate('EVENTS')}>
          View All {visibleEvents.length} Events
        </Button>
      )}
    </div>
  );
};
