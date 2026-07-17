import React from 'react';
import { Calendar, MapPin, Users, Clock, BrainCircuit } from 'lucide-react';
import { Badge, Button } from '../../ui/Common';
import { Event } from '../../../types';
import type { Member } from '../../../types';

const fmt12 = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

const DatePill: React.FC<{ event: Event; size?: 'sm' | 'md' }> = ({ event, size = 'md' }) => {
  const date = new Date(event.date);
  const end = event.endDate ? new Date(event.endDate) : null;
  const diffMonth = end && end.getMonth() !== date.getMonth();
  const isRange = end && end.getDate() !== date.getDate();
  const px = size === 'sm' ? 'px-2 py-1' : 'px-2.5 py-1.5';
  const numSize = size === 'sm' ? 'text-sm' : 'text-lg';
  return (
    <div className={`bg-white/95 backdrop-blur-sm rounded-xl ${px} shadow-sm text-center`}>
      {isRange ? (
        <p className="text-sm font-black text-slate-900 leading-tight whitespace-nowrap">
          {date.getDate()}–{end.getDate()} {diffMonth ? `${date.toLocaleString('default', { month: 'short' })}–${end.toLocaleString('default', { month: 'short' })}` : date.toLocaleString('default', { month: 'short' })}
        </p>
      ) : (
        <>
          <p className="text-[9px] font-black text-jci-blue uppercase tracking-widest leading-none">
            {date.toLocaleString('default', { month: 'short' })}
          </p>
          <p className={`${numSize} font-black text-slate-900 leading-tight`}>{date.getDate()}</p>
        </>
      )}
    </div>
  );
};

const TimeRange: React.FC<{ event: Event }> = ({ event }) => {
  const date = new Date(event.date);
  const startTime = event.time ? fmt12(event.time) : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (!event.endTime) return <>{startTime}</>;
  const endTime = fmt12(event.endTime);
  return <>{endTime !== startTime ? `${startTime} – ${endTime}` : startTime}</>;
};

const EventRowBase: React.FC<{
  event: Event;
  member?: Member | null;
  onRegister?: () => void;
  onCheckIn?: () => void;
  onClick?: () => void;
  showLocation?: boolean;
  horizontal?: boolean;
  registerForEvent?: (eventId: string, memberId: string) => void;
  markAttendance?: (eventId: string, memberId: string) => void;
}> = ({ event, member, onRegister, onCheckIn, onClick, showLocation = true, horizontal = false, registerForEvent, markAttendance }) => {
  const handleRegister = registerForEvent && member
    ? (e: React.MouseEvent) => { e.stopPropagation(); registerForEvent(event.id, member.id); }
    : onRegister
      ? (e: React.MouseEvent) => { e.stopPropagation(); onRegister(); }
      : undefined;
  const handleCheckIn = markAttendance && member
    ? () => markAttendance(event.id, member.id)
    : onCheckIn;
  const date = new Date(event.date);
  const isUpcoming = date >= new Date(new Date().setHours(0, 0, 0, 0));
  const isRegistered = member && event.registeredMembers?.includes(member.id);

  if (horizontal) {
    return (
      <div
        className="flex flex-row rounded-2xl border border-slate-100 overflow-hidden bg-white shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer active:scale-[0.99]"
        onClick={onClick}
      >
        {/* Left: Poster */}
        <div className="relative w-28 flex-shrink-0 bg-gradient-to-br from-blue-50 to-slate-100 overflow-hidden">
          {event.imageUrl ? (
            <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
              <Calendar size={28} strokeWidth={1.5} />
            </div>
          )}
          <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
            <Badge variant="neutral" className="text-[9px] px-1.5 py-0.5 bg-white/90 backdrop-blur-sm shadow-sm border-0 text-slate-700">{event.type}</Badge>
            {event.predictedDemand === 'High' && (
              <Badge variant="jci" className="text-[9px] px-1.5 py-0.5 bg-jci-blue/90 backdrop-blur-sm shadow-sm border-0 text-white"><BrainCircuit size={8} className="mr-0.5 inline" />Hot</Badge>
            )}
          </div>
          <div className="absolute bottom-2 left-0 right-0 flex justify-center">
            <DatePill event={event} size="sm" />
          </div>
        </div>

        {/* Right: Info */}
        <div className="flex flex-col flex-1 p-3 gap-1.5 min-w-0">
          <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">{event.title}</h3>
          <div className="flex flex-col gap-0.5 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <Clock size={10} className="text-slate-400 flex-shrink-0" />
              <span className="truncate"><TimeRange event={event} /></span>
            </div>
            {showLocation && (
              <div className="flex items-center gap-1.5 min-w-0">
                <MapPin size={10} className="text-slate-400 flex-shrink-0" />
                <span className="truncate">{event.location || 'TBA'}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Users size={10} className="text-slate-400 flex-shrink-0" />
              <span>{event.attendees}{event.maxAttendees ? `/${event.maxAttendees}` : ''} registered</span>
            </div>
          </div>
          {isUpcoming && handleRegister && (
            <Button
              size="sm"
              variant={isRegistered ? "success" : "primary"}
              disabled={!!isRegistered}
              className="mt-auto w-full text-xs"
              onClick={handleRegister}
            >
              {isRegistered ? 'Registered' : 'Register'}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col rounded-2xl border border-slate-100 overflow-hidden bg-white shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer active:scale-[0.99]"
      onClick={onClick}
    >
      {/* Top: Poster */}
      <div className="relative w-full h-44 bg-gradient-to-br from-blue-50 to-slate-100 flex-shrink-0 overflow-hidden">
        {event.imageUrl ? (
          <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
            <Calendar size={40} strokeWidth={1.5} />
            <span className="text-xs font-semibold mt-2 text-slate-400">No Poster</span>
          </div>
        )}
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <Badge variant="neutral" className="text-[10px] px-2 py-0.5 bg-white/90 backdrop-blur-sm shadow-sm border-0 text-slate-700">{event.type}</Badge>
          {event.predictedDemand === 'High' && (
            <Badge variant="jci" className="text-[10px] px-2 py-0.5 bg-jci-blue/90 backdrop-blur-sm shadow-sm border-0 text-white"><BrainCircuit size={9} className="mr-1 inline" />Hot</Badge>
          )}
        </div>
        <div className="absolute bottom-3 right-3">
          <DatePill event={event} />
        </div>
      </div>

      {/* Bottom: Info */}
      <div className="flex flex-col flex-1 p-4 gap-2">
        <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">{event.title}</h3>
        <div className="flex flex-col gap-1 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Clock size={11} className="text-slate-400 flex-shrink-0" />
            <span><TimeRange event={event} /></span>
          </div>
          {showLocation && (
            <div className="flex items-center gap-1.5 min-w-0">
              <MapPin size={11} className="text-slate-400 flex-shrink-0" />
              <span className="truncate">{event.location || 'TBA'}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Users size={11} className="text-slate-400 flex-shrink-0" />
            <span>{event.attendees}{event.maxAttendees ? `/${event.maxAttendees}` : ''} registered</span>
          </div>
        </div>
        {isUpcoming && handleRegister && (
          <Button
            size="sm"
            variant={isRegistered ? "success" : "primary"}
            disabled={!!isRegistered}
            className="mt-auto w-full"
            onClick={handleRegister}
          >
            {isRegistered ? 'Registered' : 'Register'}
          </Button>
        )}
      </div>
    </div>
  );
};

export const EventRow = React.memo(EventRowBase);
