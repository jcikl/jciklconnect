import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Event } from '../../../types';

export type EventsListTab = 'Upcoming' | 'Completed';

interface UseEventsListStateOptions {
  events: Event[];
  searchQuery?: string;
  initialSelectedEventId?: string | null;
  onClearSelection?: () => void;
}

export const useEventsListState = ({
  events,
  searchQuery,
  initialSelectedEventId,
  onClearSelection,
}: UseEventsListStateOptions) => {
  const [activeTab, setActiveTab] = useState<EventsListTab>('Upcoming');
  const [completedLimit, setCompletedLimit] = useState(30);
  const [upcomingLimit, setUpcomingLimit] = useState(20);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const handleSelectEvent = useCallback((event: Event) => setSelectedEvent(event), []);
  const handleCloseEvent = useCallback(() => setSelectedEvent(null), []);
  const handleLoadMoreCompleted = useCallback(() => setCompletedLimit(prev => prev + 30), []);
  const handleLoadMoreUpcoming = useCallback(() => setUpcomingLimit(prev => prev + 20), []);

  useEffect(() => {
    if (initialSelectedEventId && events.length > 0) {
      const eventToSelect = events.find(event => event.id === initialSelectedEventId);
      if (eventToSelect) {
        setSelectedEvent(eventToSelect);
        onClearSelection?.();
      }
    }
  }, [initialSelectedEventId, events, onClearSelection]);

  useEffect(() => {
    setCompletedLimit(30);
    setUpcomingLimit(20);
  }, [activeTab, searchQuery]);

  const filteredEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const term = (searchQuery || '').toLowerCase();

    return events.filter(event => {
      if (term && !(event.title ?? '').toLowerCase().includes(term)) {
        return false;
      }

      const eventDate = event.date ? new Date(event.date) : null;
      if (!eventDate) return false;

      return activeTab === 'Upcoming'
        ? eventDate >= today
        : eventDate < today;
    });
  }, [events, activeTab, searchQuery]);

  return {
    activeTab,
    setActiveTab,
    completedLimit,
    upcomingLimit,
    selectedEvent,
    setSelectedEvent,
    filteredEvents,
    handleSelectEvent,
    handleCloseEvent,
    handleLoadMoreCompleted,
    handleLoadMoreUpcoming,
  };
};
