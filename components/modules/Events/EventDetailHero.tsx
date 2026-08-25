import React from 'react';
import { ArrowLeft, Share2 } from 'lucide-react';
import type { Event } from '../../../types';
import { Badge } from '../../ui/Common';

interface EventDetailHeroProps {
  event: Event;
  onClose: () => void;
}

export const EventDetailHero: React.FC<EventDetailHeroProps> = ({ event, onClose }) => (
  <div className="relative h-56 md:h-72 w-full overflow-hidden">
    <img
      src={event.imageUrl || undefined}
      onError={(errorEvent) => {
        errorEvent.currentTarget.onerror = null;
        errorEvent.currentTarget.style.display = 'none';
        (errorEvent.currentTarget.parentElement as HTMLElement | null)?.classList.add('!h-0');
      }}
      alt={event.title}
      className="w-full h-full object-cover"
    />
    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
    <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
      <button
        aria-label="Close event detail"
        onClick={onClose}
        className="w-9 h-9 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/40 transition-all"
      >
        <ArrowLeft size={18} />
      </button>
      <button
        aria-label="Share event"
        className="w-9 h-9 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/40 transition-all"
      >
        <Share2 size={18} />
      </button>
    </div>
    <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 md:px-6 md:pb-6">
      <Badge variant="jci" className="bg-white/20 text-white border-white/30 backdrop-blur-sm px-2.5 py-0.5 text-[10px] font-bold mb-1.5">
        {event.type || 'Event'}
      </Badge>
      <h2 className="text-xl md:text-2xl font-black text-white leading-tight drop-shadow-sm">
        {event.title}
      </h2>
    </div>
  </div>
);
