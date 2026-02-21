// Events Data Hook
import { useState, useEffect } from 'react';
import { EventsService } from '../services/eventsService';
import { Event } from '../types';
import { useToast } from '../components/ui/Common';
import { useAuth } from './useAuth';
import { isDevMode } from '../utils/devMode';

export const useEvents = (options?: { publicMode?: boolean }) => {
  const publicMode = options?.publicMode ?? false;
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();
  const { member, loading: authLoading, isDevMode: isDevModeFromAuth } = useAuth();

  const loadEvents = async () => {
    const inDevMode = isDevMode() || isDevModeFromAuth;
    if (!publicMode && !member && !inDevMode) {
      setEvents([]);
      setLoading(false);
      setError(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await EventsService.getAllEvents();
      setEvents(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load events';
      if (publicMode) {
        // In public mode, silently fail — Firestore rules may block unauthenticated reads
        console.warn('[Public Events] Could not fetch events:', errorMessage);
        setEvents([]);
        setError(null);
      } else {
        setError(errorMessage);
        showToast(errorMessage, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!publicMode && authLoading) return;
    const inDevMode = isDevMode() || isDevModeFromAuth;
    if (!publicMode && !member && !inDevMode) {
      setEvents([]);
      setLoading(false);
      setError(null);
      return;
    }
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member, authLoading, isDevModeFromAuth, publicMode]);

  const createEvent = async (eventData: Omit<Event, 'id'>) => {
    try {
      const id = await EventsService.createEvent(eventData);
      await loadEvents();
      showToast('Event created successfully', 'success');
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create event';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const updateEvent = async (eventId: string, updates: Partial<Event>) => {
    try {
      await EventsService.updateEvent(eventId, updates);
      await loadEvents();
      showToast('Event updated successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update event';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const deleteEvent = async (eventId: string) => {
    try {
      await EventsService.deleteEvent(eventId);
      await loadEvents();
      showToast('Event deleted successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete event';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const registerForEvent = async (eventId: string, memberId: string) => {
    try {
      await EventsService.registerForEvent(eventId, memberId);
      await loadEvents();
      showToast('Successfully registered for event', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to register for event';
      showToast(errorMessage, 'error');
      // Don't re-throw: caller often doesn't await, which causes unhandled rejection
    }
  };

  const markAttendance = async (eventId: string, memberId: string) => {
    try {
      await EventsService.markAttendance(eventId, memberId);
      await loadEvents();
      showToast('Attendance marked successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to mark attendance';
      showToast(errorMessage, 'error');
      // Don't re-throw: caller often doesn't await, which causes unhandled rejection
    }
  };

  return {
    events,
    loading,
    error,
    loadEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    registerForEvent,
    markAttendance,
  };
};

