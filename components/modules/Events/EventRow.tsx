import React from 'react';
import { Calendar, MapPin, Users, Clock, BrainCircuit } from 'lucide-react';
import { Badge, Button } from '../../ui/Common';
import { Event } from '../../../types';
import type { Member } from '../../../types';

const EventRowBase: React.FC<{
  event: Event;
  member?: Member | null;
  onRegister?: () => void;
  onCheckIn?: () => void;
  onClick?: () => void;
  showLocation?: boolean;
}> = ({ event, member, onRegister, onCheckIn, onClick, showLocation = true }) => {
  const date = new Date(event.date);
  const isUpcoming = date >= new Date(new Date().setHours(0, 0, 0, 0));
  const isRegistered = member && event.registeredMembers?.includes(member.id);

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
        {/* Overlay badges */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <Badge variant="neutral" className="text-[10px] px-2 py-0.5 bg-white/90 backdrop-blur-sm shadow-sm border-0 text-slate-700">{event.type}</Badge>
          {event.predictedDemand === 'High' && (
            <Badge variant="jci" className="text-[10px] px-2 py-0.5 bg-jci-blue/90 backdrop-blur-sm shadow-sm border-0 text-white"><BrainCircuit size={9} className="mr-1 inline" />Hot</Badge>
          )}
        </div>
        {/* Date pill */}
        {(() => {
          const end = event.endDate ? new Date(event.endDate) : null;
          const sameMonth = end && end.getMonth() === date.getMonth() && end.getFullYear() === date.getFullYear();
          const diffMonth = end && !sameMonth;
          const isRange = end && end.getDate() !== date.getDate();
          return (
            <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-sm rounded-xl px-2.5 py-1.5 shadow-sm text-center min-w-[44px]">
              {isRange ? (
                <>
                  <p className="text-[9px] font-black text-jci-blue uppercase tracking-widest leading-none">
                    {date.toLocaleString('default', { month: 'short' })}
                  </p>
                  <p className="text-sm font-black text-slate-900 leading-tight">
                    {date.getDate()} - {diffMonth ? `${end.toLocaleString('default', { month: 'short' })} ` : ''}{end.getDate()}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[9px] font-black text-jci-blue uppercase tracking-widest leading-none">{date.toLocaleString('default', { month: 'short' })}</p>
                  <p className="text-lg font-black text-slate-900 leading-tight">{date.getDate()}</p>
                </>
              )}
            </div>
          );
        })()}
      </div>

      {/* Bottom: Info */}
      <div className="flex flex-col flex-1 p-4 gap-2">
        <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">{event.title}</h3>
        <div className="flex flex-col gap-1 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Clock size={11} className="text-slate-400 flex-shrink-0" />
            <span>
              {(() => {
                const fmt = (t: string) => {
                  const [h, m] = t.split(':').map(Number);
                  const ampm = h >= 12 ? 'PM' : 'AM';
                  const h12 = h % 12 || 12;
                  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
                };
                const startTime = event.time ? fmt(event.time) : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                if (!event.endTime) return startTime;
                const endTime = fmt(event.endTime);
                return endTime !== startTime ? `${startTime} – ${endTime}` : startTime;
              })()}
            </span>
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
        {isUpcoming && onRegister && (
          <Button
            size="sm"
            variant={isRegistered ? "success" : "primary"}
            disabled={!!isRegistered}
            className="mt-auto w-full"
            onClick={(e) => { e.stopPropagation(); onRegister(); }}
          >
            {isRegistered ? 'Registered' : 'Register'}
          </Button>
        )}
      </div>
    </div>
  );
};

export const EventRow = React.memo(EventRowBase);
