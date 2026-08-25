import React from 'react';
import { Calendar, Info, Users } from 'lucide-react';
import type { Event } from '../../../types';

interface EventDetailsTabProps {
  event: Event;
  localEvent: Event;
  date: Date | null;
  endDate: Date | null;
  isMultiDay: boolean | Date | null;
  eventTimeRange: string | null;
  attendancePercent: number;
  descExpanded: boolean;
  onDescExpandedChange: React.Dispatch<React.SetStateAction<boolean>>;
  formatDay: (date: Date) => string;
  formatDayShort: (date: Date) => string;
  formatWeekday: (date: Date) => string;
}

export const EventDetailsTab: React.FC<EventDetailsTabProps> = ({
  event,
  localEvent,
  date,
  endDate,
  isMultiDay,
  eventTimeRange,
  attendancePercent,
  descExpanded,
  onDescExpandedChange,
  formatDay,
  formatDayShort,
  formatWeekday,
}) => (
  <div className="space-y-3 animate-fade-in">
    <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 overflow-hidden">
      <div className="flex items-center gap-3 px-3.5 py-3 bg-white">
        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
          <Calendar size={14} className="text-jci-blue" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date & Time</p>
          {isMultiDay && date ? (
            <>
              <p className="text-sm font-semibold text-slate-800">
                {formatDayShort(date)} – {formatDay(endDate!)} ({formatWeekday(date)} – {formatWeekday(endDate!)})
              </p>
              {eventTimeRange && <p className="text-xs text-slate-500">{eventTimeRange}</p>}
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-slate-800">{date ? formatDay(date) : '日期未设置'}</p>
              {date && eventTimeRange && <p className="text-xs text-slate-500">{formatWeekday(date)} · {eventTimeRange}</p>}
            </>
          )}
        </div>
      </div>
      {localEvent.maxAttendees && (
        <div className="flex items-center gap-3 px-3.5 py-3 bg-white">
          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
            <Users size={14} className="text-jci-blue" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Spots</p>
            <p className="text-sm font-semibold text-slate-800">{localEvent.attendees || 0} / {localEvent.maxAttendees} registered</p>
            <div className="mt-1 w-full h-1 bg-slate-100 rounded-full overflow-hidden">
              <div style={{ width: `${Math.min(100, attendancePercent)}%` }} className="h-full bg-jci-blue rounded-full" />
            </div>
          </div>
        </div>
      )}
    </div>

    <div className="rounded-2xl bg-slate-50 border border-slate-100 px-3.5 py-3">
      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Info size={11} />About
      </h3>
      <div className={`text-slate-600 text-sm leading-relaxed whitespace-pre-wrap ${!descExpanded ? 'line-clamp-4' : ''}`}>
        {event.description || "No description provided for this event. Join us to find out more!"}
      </div>
      {event.description && event.description.length > 200 && (
        <button onClick={() => onDescExpandedChange(value => !value)} className="mt-1.5 text-xs font-semibold text-jci-blue hover:underline">
          {descExpanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  </div>
);
