import React, { useState, useMemo, useCallback } from 'react';
import { Calendar, dateFnsLocalizer, Views, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  MapPin, 
  Users, 
  Clock, 
  Download,
  AlertTriangle,
  Edit,
  Trash2
} from 'lucide-react';
import { Card, Button, Badge, Modal, useToast } from '../ui/Common';
import { CalendarEvent, Event } from '../../types';
import { formatDate, formatTime } from '../../utils/dateUtils';
import { EventsService } from '../../services/eventsService';
import { ICalService } from '../../services/icalService';
import 'react-big-calendar/lib/css/react-big-calendar.css';

// Configure date-fns localizer for react-big-calendar
const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

function getEventColor(type: string): string {
  const colors: Record<string, string> = {
    'Meeting': '#3B82F6',
    'Training': '#10B981',
    'Social': '#F59E0B',
    'Conference': '#8B5CF6',
    'Workshop': '#EF4444',
    'Networking': '#06B6D4',
    'Project': '#3B82F6',
    'Default': '#6B7280',
  };
  return colors[type] || colors.Default;
}

interface EventCalendarProps {
  events: Event[];
  onEventClick?: (event: Event) => void;
  onDateClick?: (date: Date) => void;
  onEventUpdate?: (eventId: string, updates: Partial<Event>) => Promise<void>;
  onEventDelete?: (eventId: string) => Promise<void>;
  onSlotSelect?: (slotInfo: { start: Date; end: Date; slots: Date[] }) => void;
}

interface EventDetailsModalProps {
  event: CalendarEvent | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (event: CalendarEvent) => void;
  onDelete?: (eventId: string) => void;
}

const EventDetailsModal: React.FC<EventDetailsModalProps> = ({
  event,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}) => {
  if (!event) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={event.title}>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
          <div>
            <p className="font-medium text-gray-900">
              {event.allDay ? 'All Day' : `${formatTime(event.startDate)} - ${formatTime(event.endDate)}`}
            </p>
            <p className="text-sm text-gray-500">
              {formatDate(event.startDate)}
              {!event.allDay && event.startDate.toDateString() !== event.endDate.toDateString() && 
                ` - ${formatDate(event.endDate)}`
              }
            </p>
          </div>
        </div>

        {event.location && (
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-gray-900">{event.location}</p>
            </div>
          </div>
        )}

        {event.description && (
          <div className="flex items-start gap-3">
            <CalendarIcon className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-gray-900">{event.description}</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Badge variant="neutral">{event.type}</Badge>
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(event)}
              className="flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Edit
            </Button>
          )}
          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(event.id)}
              className="flex items-center gap-2 text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export const EventCalendar: React.FC<EventCalendarProps> = ({
  events,
  onEventClick,
  onDateClick,
  onEventUpdate,
  onEventDelete,
  onSlotSelect,
}) => {
  const [view, setView] = useState<View>(Views.MONTH);
  const [date, setDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [conflictingEvents, setConflictingEvents] = useState<CalendarEvent[]>([]);
  const { showToast } = useToast();

  // Convert Event objects to CalendarEvent objects for react-big-calendar
  const calendarEvents = useMemo((): CalendarEvent[] => {
    return events.map(event => ({
      id: event.id,
      title: event.title,
      startDate: new Date(event.date),
      endDate: new Date(event.endDate || event.date),
      allDay: !event.time, // If no time specified, treat as all-day
      location: event.location || '',
      description: event.description || '',
      type: event.type || 'Event',
      eventId: event.id,
      color: getEventColor(event.type || 'Event'),
      resource: event, // Store original event data
    }));
  }, [events]);

  // Custom event style getter
  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    return {
      style: {
        backgroundColor: event.color || '#3B82F6',
        borderRadius: '4px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block',
      },
    };
  }, []);

  // Handle event selection
  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsEventModalOpen(true);
    onEventClick?.(event.resource);
  }, [onEventClick]);

  // Handle slot selection (clicking on empty calendar slots)
  const handleSelectSlot = useCallback((slotInfo: { start: Date; end: Date; slots: Date[] }) => {
    onSlotSelect?.(slotInfo);
    onDateClick?.(slotInfo.start);
  }, [onSlotSelect, onDateClick]);

  // Handle event drag and drop
  const handleEventDrop = useCallback(async ({ event, start, end }: { 
    event: CalendarEvent; 
    start: Date; 
    end: Date; 
  }) => {
    try {
      // Check for conflicts
      const conflicts = checkEventConflicts(event.id, start, end, calendarEvents);
      if (conflicts.length > 0) {
        setConflictingEvents(conflicts);
        showToast(
          `Warning: This event conflicts with ${conflicts.length} other event(s)`,
          'warning'
        );
      }

      // Update the event
      if (onEventUpdate) {
        await onEventUpdate(event.eventId!, {
          date: start.toISOString(),
          endDate: end.toISOString(),
        });
        showToast('Event updated successfully', 'success');
      }
    } catch (error) {
      console.error('Error updating event:', error);
      showToast('Failed to update event', 'error');
    }
  }, [calendarEvents, onEventUpdate, showToast]);

  // Handle event resize
  const handleEventResize = useCallback(async ({ event, start, end }: { 
    event: CalendarEvent; 
    start: Date; 
    end: Date; 
  }) => {
    try {
      // Check for conflicts
      const conflicts = checkEventConflicts(event.id, start, end, calendarEvents);
      if (conflicts.length > 0) {
        setConflictingEvents(conflicts);
        showToast(
          `Warning: This event conflicts with ${conflicts.length} other event(s)`,
          'warning'
        );
      }

      // Update the event
      if (onEventUpdate) {
        await onEventUpdate(event.eventId!, {
          date: start.toISOString(),
          endDate: end.toISOString(),
        });
        showToast('Event updated successfully', 'success');
      }
    } catch (error) {
      console.error('Error updating event:', error);
      showToast('Failed to update event', 'error');
    }
  }, [calendarEvents, onEventUpdate, showToast]);

  // Check for event conflicts
  const checkEventConflicts = (
    eventId: string,
    start: Date,
    end: Date,
    events: CalendarEvent[]
  ): CalendarEvent[] => {
    return events.filter(event => {
      if (event.id === eventId) return false; // Don't check against itself
      
      const eventStart = event.startDate;
      const eventEnd = event.endDate;
      
      // Check for overlap
      return (start < eventEnd && end > eventStart);
    });
  };

  // Handle navigation
  const handleNavigate = useCallback((newDate: Date) => {
    setDate(newDate);
  }, []);

  // Handle view change
  const handleViewChange = useCallback((newView: View) => {
    setView(newView);
  }, []);

  // Custom toolbar component
  const CustomToolbar = ({ label, onNavigate, onView }: any) => (
    <div className="flex items-center justify-between mb-4 p-4 bg-white border border-gray-200 rounded-lg">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate('PREV')}
          className="p-2"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate('TODAY')}
        >
          Today
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate('NEXT')}
          className="p-2"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <h2 className="text-lg font-semibold text-gray-900">{label}</h2>

      <div className="flex items-center gap-2">
        <Button
          variant={view === Views.MONTH ? 'primary' : 'outline'}
          size="sm"
          onClick={() => onView(Views.MONTH)}
        >
          Month
        </Button>
        <Button
          variant={view === Views.WEEK ? 'primary' : 'outline'}
          size="sm"
          onClick={() => onView(Views.WEEK)}
        >
          Week
        </Button>
        <Button
          variant={view === Views.DAY ? 'primary' : 'outline'}
          size="sm"
          onClick={() => onView(Views.DAY)}
        >
          Day
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportICal}
          className="flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export iCal
        </Button>
      </div>
    </div>
  );

  // Handle event edit
  const handleEventEdit = useCallback((event: CalendarEvent) => {
    setIsEventModalOpen(false);
    // This would typically open an edit modal
    onEventClick?.(event.resource);
  }, [onEventClick]);

  // Handle iCal export
  const handleExportICal = useCallback(() => {
    try {
      // Generate filename with current date
      const filename = `jci-events-${new Date().toISOString().split('T')[0]}.ics`;
      
      // Download the iCal file
      ICalService.downloadICalFile(calendarEvents, filename, 'JCI Events');
      
      showToast(`Exported ${calendarEvents.length} events to iCal format`, 'success');
    } catch (error) {
      console.error('Error exporting to iCal:', error);
      showToast('Failed to export events to iCal format', 'error');
    }
  }, [calendarEvents, showToast]);

  return (
    <div className="space-y-4">
      {/* Conflict Warning */}
      {conflictingEvents.length > 0 && (
        <Card className="p-4 border-yellow-200 bg-yellow-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-800">Event Conflicts Detected</h3>
              <p className="text-sm text-yellow-700 mt-1">
                The following events have overlapping times:
              </p>
              <ul className="mt-2 space-y-1">
                {conflictingEvents.map(event => (
                  <li key={event.id} className="text-sm text-yellow-700">
                    • {event.title} ({formatTime(event.startDate)} - {formatTime(event.endDate)})
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Calendar */}
      <Card className="p-0 overflow-hidden">
        <Calendar
          localizer={localizer}
          events={calendarEvents}
          startAccessor="startDate"
          endAccessor="endDate"
          style={{ height: 600 }}
          view={view}
          date={date}
          onNavigate={handleNavigate}
          onView={handleViewChange}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          onEventDrop={handleEventDrop}
          onEventResize={handleEventResize}
          eventPropGetter={eventStyleGetter}
          selectable
          resizable
          popup
          components={{
            toolbar: CustomToolbar,
          }}
          formats={{
            timeGutterFormat: 'HH:mm',
            eventTimeRangeFormat: ({ start, end }) => 
              `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`,
            agendaTimeRangeFormat: ({ start, end }) => 
              `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`,
          }}
          messages={{
            allDay: 'All Day',
            previous: 'Previous',
            next: 'Next',
            today: 'Today',
            month: 'Month',
            week: 'Week',
            day: 'Day',
            agenda: 'Agenda',
            date: 'Date',
            time: 'Time',
            event: 'Event',
            noEventsInRange: 'No events in this range',
            showMore: (total) => `+${total} more`,
          }}
        />
      </Card>

      {/* Event Details Modal */}
      <EventDetailsModal
        event={selectedEvent}
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        onEdit={handleEventEdit}
        onDelete={onEventDelete}
      />
    </div>
  );
};

export default EventCalendar;