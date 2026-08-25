import { useEffect, useState } from 'react';
import type { Event } from '../../../types';
import { EventsService } from '../../../services/eventsService';

export const useFreshEvent = (event: Event) => {
  const [localEvent, setLocalEvent] = useState<Event>(event);

  useEffect(() => {
    setLocalEvent(event);
    EventsService.getEventById(event.id)
      .then(fresh => {
        if (fresh) setLocalEvent(fresh);
      })
      .catch(() => {});
  }, [event.id]);

  return localEvent;
};
