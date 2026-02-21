import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, MapPin, Users, Clock, Download, Link as LinkIcon, Share2 } from 'lucide-react';
import { Card, Button, Badge, Modal, useToast } from '../ui/Common';
import { Event } from '../../types';
import { formatDate, formatTime } from '../../utils/dateUtils';
import { EventsService } from '../../services/eventsService';
import { ICalService } from '../../services/icalService';

interface EventCalendarViewProps {
  events: Event[];
  onEventClick?: (event: Event) => void;
  onDateClick?: (date: Date) => void;
  onEventUpdate?: (eventId: string, updates: Partial<Event>) => Promise<void>;
  readonly?: boolean;
}

type ViewMode = 'month' | 'week' | 'day';

export const EventCalendarView: React.FC<EventCalendarViewProps> = ({
  events,
  onEventClick,
  onDateClick,
  onEventUpdate,
  readonly = false
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [showICalModal, setShowICalModal] = useState(false);
  const [draggedEvent, setDraggedEvent] = useState<Event | null>(null);
  const { showToast } = useToast();

  const startOfMonth = useMemo(() => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const day = date.getDay();
    const start = new Date(date);
    start.setDate(start.getDate() - day);
    return start;
  }, [currentDate]);

  const endOfMonth = useMemo(() => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const day = date.getDay();
    const end = new Date(date);
    end.setDate(end.getDate() + (6 - day));
    return end;
  }, [currentDate]);

  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    const current = new Date(startOfMonth);
    while (current <= endOfMonth) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return days;
  }, [startOfMonth, endOfMonth]);

  const getEventsForDate = (date: Date): Event[] => {
    return events.filter(event => {
      const eventDate = new Date(event.date);
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isCurrentMonth = (date: Date): boolean => {
    return date.getMonth() === currentDate.getMonth();
  };

  // Export events to iCal format using ICalService
  const exportToICal = (eventsToExport: Event[]) => {
    try {
      // Convert Event objects to CalendarEvent objects
      const calendarEvents = ICalService.convertEventsToCalendarEvents(eventsToExport);

      // Generate filename with current date
      const filename = `jci-kl-events-${new Date().toISOString().split('T')[0]}.ics`;

      // Download the iCal file
      ICalService.downloadICalFile(calendarEvents, filename, 'JCI Kuala Lumpur Events');

      showToast(`Exported ${eventsToExport.length} events to iCal format`, 'success');
    } catch (error) {
      console.error('Error exporting to iCal:', error);
      showToast('Failed to export events to iCal format', 'error');
    }
  };

  // Generate iCal subscription URL
  const generateICalSubscriptionUrl = (): string => {
    // In production, this would be a server endpoint that generates dynamic iCal feeds
    const baseUrl = window.location.origin;
    return `${baseUrl}/api/calendar/subscribe?token=${btoa(JSON.stringify({ events: events.map(e => e.id) }))}`;
  };

  // Handle event drag start
  const handleEventDragStart = (e: React.DragEvent, event: Event) => {
    if (readonly) {
      e.preventDefault();
      return;
    }
    setDraggedEvent(event);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', event.id);
  };

  // Handle date drop
  const handleDateDrop = async (e: React.DragEvent, targetDate: Date) => {
    if (readonly) return;
    e.preventDefault();
    if (!draggedEvent) return;

    try {
      // Calculate date difference
      const originalDate = new Date(draggedEvent.date);
      const dateDiff = targetDate.getTime() - originalDate.getTime();
      const newDate = new Date(originalDate.getTime() + dateDiff);

      // Update event date via API
      if (onEventUpdate) {
        await onEventUpdate(draggedEvent.id, {
          date: newDate.toISOString(),
        });
      } else {
        await EventsService.updateEvent(draggedEvent.id, {
          date: newDate.toISOString(),
        });
      }

      showToast(`Event "${draggedEvent.title}" moved to ${formatDate(newDate)}`, 'success');
      setDraggedEvent(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update event date';
      showToast(errorMessage, 'error');
      setDraggedEvent(null);
    }
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent) => {
    if (readonly) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigateMonth('prev')}>
            <ChevronLeft size={20} />
          </Button>
          <div className="text-center">
            <h3 className="text-xl font-bold text-slate-900">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h3>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigateMonth('next')}>
            <ChevronRight size={20} />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'month' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setViewMode('month')}
          >
            Month
          </Button>
          <Button
            variant={viewMode === 'week' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setViewMode('week')}
          >
            Week
          </Button>
          <Button
            variant={viewMode === 'day' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setViewMode('day')}
          >
            Day
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToICal(events)}
          >
            <Download size={16} className="mr-2" />
            Export iCal
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowICalModal(true)}
          >
            <LinkIcon size={16} className="mr-2" />
            Subscribe
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Column: Upcoming Events List */}
        <div className="w-full lg:w-1/3">
          <Card title="Upcoming Events">
            <div className="space-y-4">
              {events
                .filter(e => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const eventDate = new Date(e.date);
                  return eventDate >= today;
                })
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .slice(0, 10)
                .map(event => (
                  <div
                    key={event.id}
                    className="flex items-start gap-4 p-4 rounded-lg border border-slate-200 hover:border-jci-blue hover:shadow-md transition-all cursor-pointer bg-white"
                    onClick={() => onEventClick?.(event)}
                  >
                    <div className="flex-shrink-0 w-16 h-16 bg-blue-50 text-jci-blue rounded-xl flex flex-col items-center justify-center border border-blue-100">
                      <span className="text-xs font-bold uppercase tracking-wider">
                        {new Date(event.date).toLocaleString('default', { month: 'short' })}
                      </span>
                      <span className="text-2xl font-bold leading-none">
                        {new Date(event.date).getDate()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-slate-900">{event.title}</h4>
                        <Badge variant="neutral">{event.type}</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mb-3">
                        <div className="flex items-center gap-1">
                          <Clock size={14} />
                          <span>{formatTime(new Date(event.date))}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin size={14} />
                          <span className="truncate">{event.location}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users size={14} />
                          <span>{event.attendees} / {event.maxAttendees || '∞'} registered</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick?.(event);
                        }}
                      >
                        Register Now
                      </Button>
                    </div>
                  </div>
                ))}
              {events.filter(e => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const eventDate = new Date(e.date);
                return eventDate >= today;
              }).length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    <CalendarIcon className="mx-auto mb-2 text-slate-400" size={32} />
                    <p>No upcoming events</p>
                  </div>
                )}
            </div>
          </Card>
        </div>

        {/* Right Column: Calendar Grid */}
        <div className="w-full lg:w-2/3 space-y-6">
          {/* Calendar Grid */}
          {viewMode === 'month' && (
            <Card noPadding>
              <div className="p-4">
                {/* Week day headers */}
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {weekDays.map(day => (
                    <div key={day} className="text-center text-sm font-semibold text-slate-600 py-2">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar days */}
                <div className="grid grid-cols-7 gap-2">
                  {calendarDays.map((date, index) => {
                    const dayEvents = getEventsForDate(date);
                    const today = isToday(date);
                    const currentMonth = isCurrentMonth(date);

                    return (
                      <div
                        key={index}
                        className={`
                      min-h-[100px] border rounded-lg p-2 cursor-pointer transition-all
                      ${today ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200' : 'border-slate-200 hover:border-jci-blue hover:bg-slate-50'}
                      ${!currentMonth ? 'opacity-40' : ''}
                      ${draggedEvent ? 'border-dashed border-2 border-jci-blue' : ''}
                    `}
                        onClick={() => onDateClick?.(date)}
                        onDrop={(e) => handleDateDrop(e, date)}
                        onDragOver={handleDragOver}
                      >
                        <div className={`
                      text-sm font-semibold mb-1
                      ${today ? 'text-blue-600' : currentMonth ? 'text-slate-900' : 'text-slate-400'}
                    `}>
                          {date.getDate().toString()}
                        </div>
                        <div className="space-y-1">
                          {dayEvents.slice(0, 2).map(event => (
                            <div
                              key={event.id}
                              draggable={!readonly}
                              onDragStart={(e) => handleEventDragStart(e, event)}
                              className={`text-xs p-1 rounded bg-jci-blue/10 text-jci-blue hover:bg-jci-blue/20 truncate ${readonly ? 'cursor-pointer' : 'cursor-move'}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onEventClick?.(event);
                              }}
                              title={`${formatTime(new Date(event.date))} ${event.title}${!readonly ? ' - Drag to move' : ''}`}
                            >
                              {formatTime(new Date(event.date))} {event.title}
                            </div>
                          ))}
                          {dayEvents.length > 2 && (
                            <div className="text-xs text-slate-500 font-medium">
                              +{dayEvents.length - 2} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          )}

          {/* Week View */}
          {viewMode === 'week' && (
            <Card noPadding>
              <div className="p-4">
                <div className="grid grid-cols-7 gap-2">
                  {(() => {
                    const weekStart = new Date(currentDate);
                    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                    const weekDates: Date[] = [];
                    for (let i = 0; i < 7; i++) {
                      const day = new Date(weekStart);
                      day.setDate(day.getDate() + i);
                      weekDates.push(day);
                    }
                    return weekDates.map((date, index) => {
                      const dayEvents = getEventsForDate(date);
                      const today = isToday(date);
                      return (
                        <div
                          key={index}
                          className="border rounded-lg p-3"
                          onDrop={(e) => handleDateDrop(e, date)}
                          onDragOver={handleDragOver}
                        >
                          <div className={`text-center mb-3 ${today ? 'text-blue-600 font-bold' : 'text-slate-700'}`}>
                            <div className="text-xs text-slate-500">{weekDays[date.getDay()]}</div>
                            <div className="text-lg font-semibold">{date.getDate().toString()}</div>
                          </div>
                          <div className="space-y-2">
                            {dayEvents.map(event => (
                              <div
                                key={event.id}
                                draggable={!readonly}
                                onDragStart={(e) => handleEventDragStart(e, event)}
                                className={`text-xs p-2 rounded bg-jci-blue/10 text-jci-blue hover:bg-jci-blue/20 ${readonly ? 'cursor-pointer' : 'cursor-move'}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEventClick?.(event);
                                }}
                                title={`${formatTime(new Date(event.date))} ${event.title}${!readonly ? ' - Drag to move' : ''}`}
                              >
                                <div className="font-semibold truncate">{event.title}</div>
                                <div className="text-slate-600">{formatTime(new Date(event.date))}</div>
                              </div>
                            ))}
                            {dayEvents.length === 0 && (
                              <div className="text-xs text-slate-400 text-center py-4">No events</div>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </Card>
          )}

          {/* Day View */}
          {viewMode === 'day' && (
            <Card noPadding>
              <div className="p-4">
                <div className="text-center mb-4">
                  <h3 className="text-xl font-bold text-slate-900">
                    {formatDate(currentDate)}
                  </h3>
                </div>
                <div className="space-y-3">
                  {(() => {
                    const dayEvents = getEventsForDate(currentDate);
                    const hours = Array.from({ length: 24 }, (_, i) => i);
                    return hours.map(hour => {
                      const hourEvents = dayEvents.filter(e => {
                        const eventDate = new Date(e.date);
                        return eventDate.getHours() === hour;
                      });
                      const hourDate = new Date(currentDate);
                      hourDate.setHours(hour, 0, 0, 0);
                      return (
                        <div
                          key={hour}
                          className="flex gap-4 border-b border-slate-100 pb-2"
                          onDrop={(e) => handleDateDrop(e, hourDate)}
                          onDragOver={handleDragOver}
                        >
                          <div className="w-16 text-sm text-slate-500 font-medium">
                            {hour.toString().padStart(2, '0')}:00
                          </div>
                          <div className="flex-1">
                            {hourEvents.map(event => (
                              <div
                                key={event.id}
                                draggable={!readonly}
                                onDragStart={(e) => handleEventDragStart(e, event)}
                                className={`p-3 rounded-lg bg-jci-blue/10 border border-jci-blue/20 hover:bg-jci-blue/20 mb-2 ${readonly ? 'cursor-pointer' : 'cursor-move'}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEventClick?.(event);
                                }}
                                title={`${event.title}${!readonly ? ' - Drag to move to different time' : ''}`}
                              >
                                <div className="font-semibold text-slate-900">{event.title}</div>
                                <div className="text-sm text-slate-600 mt-1">
                                  {formatTime(new Date(event.date))} • {event.location}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </Card>
          )}

        </div>
      </div>

      {/* iCal Subscription Modal */}
      <Modal
        isOpen={showICalModal}
        onClose={() => setShowICalModal(false)}
        title="Subscribe to Calendar"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Subscribe to JCI Kuala Lumpur events calendar in your favorite calendar application.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Subscription URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={generateICalSubscriptionUrl()}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(generateICalSubscriptionUrl());
                    showToast('Subscription URL copied to clipboard', 'success');
                  }}
                >
                  <Share2 size={16} />
                </Button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">How to subscribe:</h4>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li><strong>Google Calendar:</strong> Settings → Add calendar → From URL</li>
                <li><strong>Outlook:</strong> Add calendar → Subscribe from web</li>
                <li><strong>Apple Calendar:</strong> File → New Calendar Subscription</li>
                <li><strong>Other:</strong> Use the URL above in your calendar app</li>
              </ul>
            </div>

            <div className="pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  exportToICal(events);
                  setShowICalModal(false);
                }}
                className="w-full"
              >
                <Download size={16} className="mr-2" />
                Or Download iCal File Instead
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

