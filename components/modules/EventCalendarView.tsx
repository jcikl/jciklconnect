import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Share2, Calendar as CalendarIcon } from 'lucide-react';
import { Modal, Button, useToast } from '../ui/Common';
import { Event } from '../../types';
import { formatTime } from '../../utils/dateUtils';
import { EventsService } from '../../services/eventsService';
import { EventRow } from './Events/EventRow';

interface EventCalendarViewProps {
  events: Event[];
  onEventClick?: (event: Event) => void;
  onDateClick?: (date: Date) => void;
  onEventUpdate?: (eventId: string, updates: Partial<Event>) => Promise<void>;
  readonly?: boolean;
  upcomingOnly?: boolean;
}

const MONTH_ABBR = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const DAY_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
// Monday-first column labels; index 6 = Sunday (red)
const WEEK_DAY_LABELS = ['M','T','W','T','F','S','S'];

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + 1) / 7);
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

// Event type → chip colour (bg + text) and bar colour
const EVENT_COLORS: Record<string, { chip: string; bar: string }> = {
  Community:   { chip: 'bg-teal-500 text-white',    bar: 'bg-teal-500' },
  Training:    { chip: 'bg-blue-500 text-white',     bar: 'bg-blue-500' },
  Social:      { chip: 'bg-amber-500 text-white',    bar: 'bg-amber-500' },
  Sports:      { chip: 'bg-orange-500 text-white',   bar: 'bg-orange-500' },
  Fundraising: { chip: 'bg-purple-500 text-white',   bar: 'bg-purple-500' },
  Meeting:     { chip: 'bg-indigo-500 text-white',   bar: 'bg-indigo-500' },
};
const DEFAULT_COLOR = { chip: 'bg-jci-blue text-white', bar: 'bg-jci-blue' };
const getColors = (type: string) => EVENT_COLORS[type] ?? DEFAULT_COLOR;

// Build a Monday-first week grid for the given month
function buildCalendarWeeks(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);

  // Days to go back to reach the Monday of the first week
  const startOffset = (firstDay.getDay() + 6) % 7; // Mon=0 … Sun=6
  // Days to go forward to reach the Sunday of the last week
  const endOffset   = (7 - ((lastDay.getDay() + 6) % 7) - 1 + 7) % 7;

  const start = new Date(year, month, 1 - startOffset);
  const end   = new Date(year, month, lastDay.getDate() + endOffset);

  const weeks: Date[][] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export const EventCalendarView: React.FC<EventCalendarViewProps> = ({
  events,
  onEventClick,
  onDateClick,
  onEventUpdate,
  readonly = false,
  upcomingOnly = false,
}) => {
  const today = useMemo(() => new Date(), []);

  const [currentDate, setCurrentDate] = useState(() =>
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(today);
  const [showICalModal, setShowICalModal] = useState(false);
  const [draggedEvent, setDraggedEvent] = useState<Event | null>(null);
  const { showToast } = useToast();

  const calendarWeeks = useMemo(
    () => buildCalendarWeeks(currentDate.getFullYear(), currentDate.getMonth()),
    [currentDate]
  );

  const navigateMonth = (dir: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + (dir === 'next' ? 1 : -1));
      return d;
    });
  };

  const getEventsForDate = (date: Date) =>
    events.filter(e => isSameDay(new Date(e.date), date));

  // ── Drag-and-drop ──────────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, event: Event) => {
    if (readonly) { e.preventDefault(); return; }
    setDraggedEvent(event);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetDate: Date) => {
    if (readonly || !draggedEvent) return;
    e.preventDefault();
    try {
      const orig = new Date(draggedEvent.date);
      const newDate = new Date(orig);
      newDate.setFullYear(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      if (onEventUpdate) {
        await onEventUpdate(draggedEvent.id, { date: newDate.toISOString() });
      } else {
        await EventsService.updateEvent(draggedEvent.id, { date: newDate.toISOString() });
      }
      showToast(`"${draggedEvent.title}" moved`, 'success');
    } catch {
      showToast('Failed to move event', 'error');
    }
    setDraggedEvent(null);
  };

  const generateICalUrl = () =>
    `${window.location.origin}/api/calendar/subscribe?token=${btoa(JSON.stringify({ events: events.map(e => e.id) }))}`;

  // ── upcomingOnly card grid (used in GuestEventsPage) ─────────────────────
  if (upcomingOnly) {
    const upcoming = [...events]
      .filter(e => { const t = new Date(); t.setHours(0,0,0,0); return new Date(e.date) >= t; })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (upcoming.length === 0) {
      return (
        <div className="text-center py-12 text-slate-400">
          <CalendarIcon className="mx-auto mb-2" size={32} strokeWidth={1.5} />
          <p className="text-sm">No upcoming events</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {upcoming.map(event => (
          <EventRow
            key={event.id}
            event={event}
            horizontal
            onClick={() => onEventClick?.(event)}
            onRegister={() => onEventClick?.(event)}
          />
        ))}
      </div>
    );
  }

  // ── Selected date events ───────────────────────────────────────────────────
  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  // ── Main calendar (Samsung-style) ─────────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center px-2 py-3 gap-0.5">
        <button
          onClick={() => navigateMonth('prev')}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="flex-1 text-center select-none">
          <span className="text-xl font-black tracking-widest text-slate-900">
            {MONTH_ABBR[currentDate.getMonth()]}
          </span>
          <span className="ml-2 text-sm font-medium text-slate-400">
            {currentDate.getFullYear()}
          </span>
        </div>

        <button
          onClick={() => navigateMonth('next')}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
        >
          <ChevronRight size={18} />
        </button>

        {/* Today chip – shows today's date number inside a bordered box */}
        <button
          onClick={() => {
            setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
            setSelectedDate(today);
          }}
          className="ml-1 w-7 h-7 border-2 border-slate-300 rounded-md flex items-center justify-center text-xs font-black text-slate-600 hover:border-jci-blue hover:text-jci-blue transition-colors"
          title="Go to today"
        >
          {today.getDate()}
        </button>

        {/* Share / iCal */}
        <button
          onClick={() => setShowICalModal(true)}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600 ml-0.5"
          title="Subscribe to calendar"
        >
          <Share2 size={14} />
        </button>
      </div>

      {/* ── Weekday column headers ── */}
      {/* grid: [week-num col] [7 day cols] */}
      <div className="grid grid-cols-[24px_repeat(7,1fr)] px-2 pb-1 border-b border-slate-100">
        <div /> {/* week number placeholder */}
        {WEEK_DAY_LABELS.map((label, i) => (
          <div
            key={i}
            className={`text-center text-[11px] font-bold py-0.5 ${i === 6 ? 'text-red-400' : 'text-slate-400'}`}
          >
            {label}
          </div>
        ))}
      </div>

      {/* ── Calendar grid ── */}
      <div className="px-2 pt-1 pb-2">
        {calendarWeeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-[24px_repeat(7,1fr)] mb-0.5">

            {/* ISO week number */}
            <div className="flex items-start justify-center pt-2.5">
              <span className="text-[9px] text-slate-300 font-bold select-none leading-none">
                {getISOWeek(week[0])}
              </span>
            </div>

            {/* 7 day cells */}
            {week.map((date, di) => {
              const dayEvents   = getEventsForDate(date);
              const isToday_    = isSameDay(date, today);
              const isSelected  = !!selectedDate && isSameDay(date, selectedDate);
              const inMonth     = date.getMonth() === currentDate.getMonth();
              const isSunday    = di === 6;

              return (
                <div
                  key={di}
                  className="flex flex-col items-center pt-1 pb-0.5 cursor-pointer group"
                  onClick={() => {
                    setSelectedDate(date);
                    onDateClick?.(date);
                  }}
                  onDrop={(e) => handleDrop(e, date)}
                  onDragOver={(e) => { if (!readonly) e.preventDefault(); }}
                >
                  {/* Date number circle */}
                  <div className={[
                    'w-7 h-7 flex items-center justify-center rounded-full text-[13px] font-bold transition-colors leading-none mb-0.5',
                    isToday_
                      ? 'bg-jci-blue text-white'
                      : isSelected
                        ? 'bg-slate-200 text-slate-900'
                        : isSunday
                          ? inMonth
                            ? 'text-red-400 group-hover:bg-red-50'
                            : 'text-red-200'
                          : inMonth
                            ? 'text-slate-800 group-hover:bg-slate-100'
                            : 'text-slate-300',
                  ].join(' ')}>
                    {date.getDate()}
                  </div>

                  {/* Event chips — max 2 visible, then "+N" */}
                  <div className="w-full px-0.5 space-y-0.5">
                    {dayEvents.slice(0, 2).map(event => {
                      const c = getColors(event.type);
                      return (
                        <div
                          key={event.id}
                          draggable={!readonly}
                          onDragStart={(e) => handleDragStart(e, event)}
                          onClick={(e) => { e.stopPropagation(); onEventClick?.(event); }}
                          className={[
                            'w-full text-[8px] font-semibold truncate px-1 py-[1px] rounded-sm leading-tight cursor-pointer',
                            c.chip,
                            !inMonth ? 'opacity-40' : '',
                          ].join(' ')}
                          title={event.title}
                        >
                          {event.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 2 && (
                      <span className="text-[8px] text-slate-400 pl-0.5 leading-none">
                        +{dayEvents.length - 2}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Selected date panel ── */}
      {selectedDate && (
        <div className="border-t border-slate-100">

          {/* Day header */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50/70">
            <span className="text-base font-black text-slate-900">
              {selectedDate.getDate()}
            </span>
            <span className="text-sm font-semibold text-slate-400">
              {DAY_FULL[selectedDate.getDay()]}
            </span>
            {isSameDay(selectedDate, today) && (
              <span className="ml-auto text-[10px] font-bold bg-jci-blue/10 text-jci-blue px-2 py-0.5 rounded-full">
                Today
              </span>
            )}
          </div>

          {/* Event list for selected date */}
          <div className="max-h-60 overflow-y-auto">
            {selectedDateEvents.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-5">No events on this day</p>
            ) : (
              selectedDateEvents.map(event => {
                const d = new Date(event.date);
                const c = getColors(event.type);
                return (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors"
                    onClick={() => onEventClick?.(event)}
                  >
                    {/* Coloured left bar */}
                    <div className={`w-1 h-10 rounded-full shrink-0 ${c.bar}`} />
                    {/* Date badge */}
                    <div className={`w-10 h-10 rounded-xl shrink-0 flex flex-col items-center justify-center ${c.chip}`}>
                      <span className="text-[8px] font-bold leading-none uppercase">
                        {MONTH_ABBR[d.getMonth()]}
                      </span>
                      <span className="text-sm font-black leading-tight">{d.getDate()}</span>
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{event.title}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {formatTime(d)}{event.location ? ` · ${event.location}` : ''}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Add on [date] button */}
          {!readonly && (
            <div className="px-4 py-3">
              <button
                className="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-sm font-bold text-slate-600 flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98]"
                onClick={() => onDateClick?.(selectedDate)}
              >
                Add on {selectedDate.toLocaleDateString('en', { day: 'numeric', month: 'short' })}
                <span className="text-base leading-none font-black ml-0.5">+</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── iCal subscription modal ── */}
      <Modal isOpen={showICalModal} onClose={() => setShowICalModal(false)} title="Subscribe to Calendar">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Subscribe to JCI Kuala Lumpur events in your calendar app.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Subscription URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={generateICalUrl()}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 text-slate-600"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(generateICalUrl());
                  showToast('URL copied', 'success');
                }}
              >
                Copy
              </Button>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 space-y-1">
            <p className="font-semibold mb-1">How to subscribe:</p>
            <p>• <strong>Google Calendar:</strong> Settings → Add calendar → From URL</p>
            <p>• <strong>Outlook:</strong> Add calendar → Subscribe from web</p>
            <p>• <strong>Apple Calendar:</strong> File → New Calendar Subscription</p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
