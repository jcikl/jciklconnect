// Events Data Hook
import { EventsService } from '../services/eventsService';
import { MembersService } from '../services/membersService';
import { Event } from '../types';
import { useToast } from '../components/ui/Common';
import { useAuth } from './useAuth';
import { isDevMode } from '../utils/devMode';
import { useFirestoreCollection } from './useFirestoreCollection';

export const useEvents = (options?: { publicMode?: boolean }) => {
  const publicMode = options?.publicMode ?? false;
  const { showToast } = useToast();
  const { member, loading: authLoading, isDevMode: isDevModeFromAuth } = useAuth();

  const inDevMode = isDevMode() || isDevModeFromAuth;
  // In public mode always fetch; otherwise require auth to resolve + member present (or devMode)
  const enabled = publicMode ? true : (!authLoading && (!!member || inDevMode));

  const { data: events, loading: loading1, error, reload: loadEvents } = useFirestoreCollection<Event>({
    loader: () =>
      EventsService.getAllEvents().catch(err => {
        if (publicMode) {
          // In public mode, silently fail — Firestore rules may block unauthenticated reads
          console.warn('[Public Events] Could not fetch events:', err instanceof Error ? err.message : err);
          return [];
        }
        throw err;
      }),
    enabled,
    deps: [enabled, publicMode],
  });

  // Keep auth spinner going while auth is still resolving (non-public mode)
  const loading = (!publicMode && authLoading) || loading1;

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

  const registerForEvent = async (
    eventId: string,
    memberId: string,
    extraFields?: {
      dietary?: 'normal' | 'vegetarian' | 'halal' | null;
      emergencyContactName?: string | null;
      emergencyContactPhone?: string | null;
      tshirtSize?: string | null;
    }
  ) => {
    try {
      await EventsService.registerForEvent(eventId, memberId, extraFields);
      if (extraFields && memberId) {
        const profileUpdate: Record<string, unknown> = {};
        if (extraFields.dietary) {
          profileUpdate.dietaryPreference = extraFields.dietary;
          profileUpdate['general.dietaryPreference'] = extraFields.dietary;
        }
        if (extraFields.emergencyContactName != null) profileUpdate.emergencyContactName = extraFields.emergencyContactName;
        if (extraFields.emergencyContactPhone != null) profileUpdate.emergencyContactPhone = extraFields.emergencyContactPhone;
        if (extraFields.tshirtSize != null) profileUpdate.tshirtSize = extraFields.tshirtSize;
        if (Object.keys(profileUpdate).length > 0) {
          MembersService.updateMember(memberId, profileUpdate as Parameters<typeof MembersService.updateMember>[1]).catch(() => {});
        }
      }
      await loadEvents();
      showToast('Successfully registered for event', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to register for event';
      showToast(errorMessage, 'error');
      throw err;
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

  const cancelRegistration = async (
    eventId: string,
    memberId: string,
    cancelledBy: string,
    cancelledByName: string,
    cancelledByRole: 'self' | 'admin' | 'board' | 'committee'
  ) => {
    try {
      await EventsService.cancelRegistration(eventId, memberId, cancelledBy, cancelledByName, cancelledByRole);
      await loadEvents();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Cancellation failed';
      showToast(errorMessage, 'error');
      throw err;
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
    cancelRegistration,
  };
};
