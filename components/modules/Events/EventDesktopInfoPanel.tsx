import React from 'react';
import { Calendar, MapPin, Tag, Users } from 'lucide-react';
import type { Event } from '../../../types';

interface EventDesktopInfoPanelProps {
  event: Event;
  localEvent: Event;
  registerButton: React.ReactNode;
  priceMin: number | undefined;
  priceMax: number | undefined;
  date: Date | null;
  endDate: Date | null;
  isMultiDay: boolean | Date | null;
  eventTimeRange: string | null;
  attendancePercent: number;
  formatDay: (date: Date) => string;
  formatDayShort: (date: Date) => string;
  formatWeekday: (date: Date) => string;
}

export const EventDesktopInfoPanel: React.FC<EventDesktopInfoPanelProps> = ({
  event,
  localEvent,
  registerButton,
  priceMin,
  priceMax,
  date,
  endDate,
  isMultiDay,
  eventTimeRange,
  attendancePercent,
  formatDay,
  formatDayShort,
  formatWeekday,
}) => (
  <div className="hidden md:flex flex-col gap-4 px-6 pt-6 pb-8">
    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest block leading-none">From</span>
      <div className="flex items-baseline">
        {priceMin != null ? (
          <span className="text-2xl font-black text-slate-900">
            RM {priceMin}{priceMax != null && priceMax !== priceMin ? ` – ${priceMax}` : ''}
          </span>
        ) : (
          <span className="text-2xl font-black text-green-600">FREE</span>
        )}
      </div>
      <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">/ person</span>
      {registerButton}
    </div>

    <div className="divide-y divide-slate-100">
      <div className="flex items-start gap-3 py-3">
        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
          <Calendar size={15} className="text-jci-blue" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Date & Time</p>
          {isMultiDay && date ? (
            <>
              <p className="text-sm font-semibold text-slate-800">{formatDayShort(date)} – {formatDay(endDate!)} ({formatWeekday(date)} – {formatWeekday(endDate!)})</p>
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
      <div className="flex items-start gap-3 py-3">
        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
          <MapPin size={15} className="text-jci-blue" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Location</p>
          <p className="text-sm font-semibold text-slate-800">{event.location || 'TBA (To Be Announced)'}</p>
        </div>
      </div>
      {localEvent.maxAttendees && (
        <div className="flex items-start gap-3 py-3">
          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
            <Users size={15} className="text-jci-blue" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Attendance</p>
            <p className="text-sm font-semibold text-slate-800">{localEvent.attendees || 0} / {localEvent.maxAttendees} spots</p>
            <div className="mt-1.5 w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div style={{ width: `${Math.min(100, attendancePercent)}%` }} className="h-full bg-jci-blue rounded-full" />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">{attendancePercent}% filled</p>
          </div>
        </div>
      )}
      <div className="flex items-start gap-3 py-3">
        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
          <Tag size={15} className="text-jci-blue" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Category</p>
          <p className="text-sm font-semibold text-slate-800">{event.type || 'General Event'}</p>
        </div>
      </div>
    </div>
  </div>
);
