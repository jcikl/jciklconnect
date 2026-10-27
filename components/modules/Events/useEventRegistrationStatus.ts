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
  // The eventRegistrations doc is authoritative; event.registeredMembers is a denormalised cache that can drift
  // (e.g. a registration created by the JCI Malaysia back-fill writes the doc but not the array). Treat an existing,
  // non-cancelled registration as registered so the button matches what the member actually has.
  const hasActiveRegistration = !!myRegistration && myRegistration.status !== 'cancelled';
  const isRegistered = localRegistered !== null ? localRegistered : (isRegisteredFromEvent || hasActiveRegistration);
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
