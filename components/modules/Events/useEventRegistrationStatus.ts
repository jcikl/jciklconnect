import { useEffect, useState } from 'react';
import type { Event, EventRegistration, Member } from '../../../types';
import { EventRegistrationService } from '../../../services/eventRegistrationService';

interface UseEventRegistrationStatusOptions {
  event: Event;
  member: Member | null;
  canCancelRegistration: boolean;
}

export const useEventRegistrationStatus = ({
  event,
  member,
  canCancelRegistration,
}: UseEventRegistrationStatusOptions) => {
  const [myRegistration, setMyRegistration] = useState<EventRegistration | null | undefined>(undefined);
  const [localRegistered, setLocalRegistered] = useState<boolean | null>(null);

  useEffect(() => {
    if (!member) return;
    EventRegistrationService.getByEventAndMember(event.id, member.id)
      .then(setMyRegistration)
      .catch(() => setMyRegistration(null));
  }, [event.id, member?.id]);

  const isRegisteredFromEvent = !!(member && event.registeredMembers?.includes(member.id));
  const isRegistered = localRegistered !== null ? localRegistered : isRegisteredFromEvent;
  const isSelfCancelled = myRegistration?.status === 'cancelled' && !isRegistered;
  const canSelfCancel =
    !!isRegistered &&
    myRegistration?.status !== 'checked_in' &&
    canCancelRegistration &&
    event.status !== 'Completed';

  return {
    myRegistration,
    setMyRegistration,
    localRegistered,
    setLocalRegistered,
    isRegistered,
    isSelfCancelled,
    canSelfCancel,
  };
};
