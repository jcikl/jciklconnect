import React, { useState } from 'react';
import { Calendar, Info, Users, Building2, Maximize2 } from 'lucide-react';
import type { Event, EventRegistration } from '../../../types';
import { RegcodeQr } from '../../ui/RegcodeQr';
import { Modal } from '../../ui/Common';

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
  /** The viewing member's own registration, for showing their JCI Malaysia check-in QR. */
  myRegistration?: EventRegistration | null;
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
  myRegistration,
}) => {
  const [qrZoom, setQrZoom] = useState(false);
  const regcode = myRegistration?.status !== 'cancelled' ? myRegistration?.jciMalaysiaRegcode : null;

  return (
  <div className="space-y-3 animate-fade-in">
    {/* Details on the left; the member's own check-in QR sits to the right on wider screens (stacks on mobile),
        both stretched to the same height. Tap the QR to enlarge it for scanning. */}
    <div className="flex flex-col sm:flex-row gap-3 items-stretch">
      <div className="flex-1 min-w-0 divide-y divide-slate-100 rounded-2xl border border-slate-100 overflow-hidden">
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
      {(() => {
        const hostingLo = (event as any).hostingLo as string | undefined;
        const coHosting = (event as any).coHosting as string | string[] | undefined;
        const level = (event as any).level as string | undefined;
        const area = (event as any).area as string | undefined;
        const coHostingStr = Array.isArray(coHosting) ? coHosting.join(', ') : coHosting;
        if (!hostingLo && !coHostingStr && !level && !area) return null;
        return (
          <div className="flex items-start gap-3 px-3.5 py-3 bg-white">
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
              <Building2 size={14} className="text-jci-blue" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Organisation</p>
              {hostingLo && <p className="text-sm font-semibold text-slate-800">{hostingLo}</p>}
              {coHostingStr && <p className="text-xs text-slate-500">Co-host: {coHostingStr}</p>}
              {(level || area) && (
                <p className="text-xs text-slate-500">
                  {[level, area].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </div>
        );
      })()}
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
      {regcode && (
        <button
          type="button"
          onClick={() => setQrZoom(true)}
          title="Tap to enlarge"
          className="sm:w-56 shrink-0 flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white px-3.5 py-4 cursor-pointer transition-shadow hover:shadow-md hover:border-blue-200 focus:outline-none focus:ring-2 focus:ring-jci-blue"
        >
          <RegcodeQr regcode={regcode} label="Your JCI Malaysia check-in code" />
          <p className="mt-2 flex items-center justify-center gap-1 text-[11px] text-slate-400">
            <Maximize2 size={11} /> Tap to enlarge · show at the event to check in
          </p>
        </button>
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

    {/* Enlarged check-in QR for scanning at the gate (reuses RegcodeQr — no extra qrcode.react import site). */}
    <Modal isOpen={qrZoom} onClose={() => setQrZoom(false)} title="Check-in code">
      {regcode && (
        <div className="flex flex-col items-center gap-3 py-2">
          <RegcodeQr regcode={regcode} label="Your JCI Malaysia check-in code" size={260} maxWidthClass="max-w-[260px]" />
          <p className="text-xs text-slate-400">Show this at the event to check in.</p>
        </div>
      )}
    </Modal>
  </div>
  );
};
