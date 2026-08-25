import type { Event } from '../../../types';

const formatTime12 = (time: string) => {
  const [hour, minute] = time.split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
};

export const useEventDerivedDetails = (event: Event, localEvent: Event) => {
  const date = event.date ? new Date(event.date) : null;
  const endDate = event.endDate ? new Date(event.endDate) : null;
  const isMultiDay = date && endDate && endDate.toDateString() !== date.toDateString();
  const formatDay = (value: Date) => value.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const formatWeekday = (value: Date) => value.toLocaleDateString('en-US', { weekday: 'short' });
  const eventTime = event.time || (date && (date.getHours() !== 0 || date.getMinutes() !== 0) ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null);
  const eventTimeRange = eventTime
    ? (event.endTime && formatTime12(event.endTime) !== formatTime12(eventTime)
      ? `${formatTime12(eventTime)} – ${formatTime12(event.endTime)}`
      : formatTime12(eventTime))
    : null;
  const formatDayShort = (value: Date) => value.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  const priceMin = event.priceMin ?? event.price;
  const priceMax = event.priceMax;
  const attendancePercent = localEvent.maxAttendees
    ? Math.round(((localEvent.attendees || 0) / localEvent.maxAttendees) * 100)
    : 0;
  const isFull = !!(localEvent.maxAttendees && (localEvent.attendees ?? 0) >= localEvent.maxAttendees);

  return {
    date,
    endDate,
    isMultiDay,
    formatDay,
    formatWeekday,
    eventTimeRange,
    formatDayShort,
    priceMin,
    priceMax,
    attendancePercent,
    isFull,
  };
};
