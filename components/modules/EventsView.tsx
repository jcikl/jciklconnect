import React, { useMemo, useState } from 'react';
import { useToast } from '../ui/Common';
import { useEvents } from '../../hooks/useEvents';
import { useAuth } from '../../hooks/useAuth';
import { EventCalendarView } from './EventCalendarView';
import { useMembers } from '../../hooks/useMembers';
import { DEFAULT_LO_ID } from '../../config/constants';
import { EventsListPanel } from './Events/EventsListPanel';
import { EventsHeader, type EventsViewMode } from './Events/EventsHeader';
import { EventDetailModal } from './Events/EventDetailModal';
import { useEventsListState } from './Events/useEventsListState';
import { isEventVisibleToExternal, isKlRelevantEvent } from '../../utils/loHosting.mjs';
import { usePermissions } from '../../hooks/usePermissions';

// Same listed statuses as EventsService.getAllEvents (the 'kl' scope returns every non-cancelled status).
const LISTED_EVENT_STATUSES = ['Active', 'Upcoming', 'Approved'];

export type { RegistrationFormData } from './Events/EventRegistrationFormModal';

export const EventsView: React.FC<{ searchQuery?: string; initialSelectedEventId?: string | null; onClearSelection?: () => void }> = ({ searchQuery, initialSelectedEventId, onClearSelection }) => {
  const [viewMode, setViewMode] = useState<EventsViewMode>('list');
  // Only the events this page can show (KL host / co-host, national / area / JCI) — loading every
  // event (~3,200, 5 MB) took several seconds.
  // External-chapter members only see events KL hosts or co-hosts ('kl' scope + listed-status filter).
  const { isExternal } = usePermissions();
  const { events: loadedEvents, loading, error, loadEvents, registerForEvent, markAttendance, updateEvent, cancelRegistration } = useEvents({ scope: isExternal ? 'kl' : 'klRelevant' });
  const events = useMemo(
    () => (isExternal
      ? loadedEvents.filter(e => isEventVisibleToExternal(e as any) && LISTED_EVENT_STATUSES.includes(String(e.status)))
      : loadedEvents),
    [isExternal, loadedEvents]
  );
  const { member } = useAuth();
  const { showToast } = useToast();
  const loId = (member as { loId?: string })?.loId ?? DEFAULT_LO_ID;
  // useMembers only loads for KL roles (its own `enabled` gate), so externals never trigger the denied read.
  const { members: memberOptions } = useMembers(loId);

  const {
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
  } = useEventsListState({
    events,
    searchQuery,
    initialSelectedEventId,
    onClearSelection,
  });

  return (
    <div className="space-y-6">
      <EventsHeader viewMode={viewMode} onViewModeChange={setViewMode} />

      {viewMode === 'calendar' ? (
        <EventCalendarView
          events={events.filter(e => isKlRelevantEvent(e as any))}
          onEventClick={setSelectedEvent}
          onEventUpdate={updateEvent}
        />
      ) : (
        <EventsListPanel
          activeTab={activeTab}
          completedLimit={completedLimit}
          upcomingLimit={upcomingLimit}
          events={filteredEvents}
          loading={loading}
          error={error}
          member={member}
          onTabChange={setActiveTab}
          onRetry={loadEvents}
          onSelectEvent={handleSelectEvent}
          onLoadMoreCompleted={handleLoadMoreCompleted}
          onLoadMoreUpcoming={handleLoadMoreUpcoming}
          registerForEvent={registerForEvent}
          markAttendance={markAttendance}
        />
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={handleCloseEvent}
          onRegister={async (formData) => {
            if (member) {
              try {
                await registerForEvent(selectedEvent.id, member.id, formData);
                setSelectedEvent(null);
                showToast('Registration successful', 'success');
              } catch (err) {
                showToast('Registration failed — please try again', 'error');
              }
            }
          }}
          onCheckIn={async () => {
            if (member) {
              try {
                await markAttendance(selectedEvent.id, member.id);
                setSelectedEvent(null);
              } catch (err) {
                showToast('Failed to check in', 'error');
              }
            }
          }}
          onCancelRegistration={async (memberId, cancelledBy, cancelledByName, cancelledByRole) => {
            await cancelRegistration(selectedEvent.id, memberId, cancelledBy, cancelledByName, cancelledByRole);
          }}
          member={member}
          members={memberOptions}
        />
      )}
    </div>
  );
};

export { EventDetailModal } from './Events/EventDetailModal';
