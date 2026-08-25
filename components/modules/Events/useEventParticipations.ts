import { useCallback, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import type { Event, EventRegistration } from '../../../types';
import { COLLECTIONS } from '../../../config/constants';
import { db } from '../../../config/firebase';
import { EventRegistrationService } from '../../../services/eventRegistrationService';
import { errorLoggingService } from '../../../services/errorLoggingService';

type ShowToast = (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;

export const useEventParticipations = (event: Event, showToast: ShowToast) => {
  const [participations, setParticipations] = useState<EventRegistration[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  const loadParticipations = useCallback(async () => {
    setLoadingParticipants(true);
    try {
      const [list, guestSnap] = await Promise.all([
        EventRegistrationService.listByEvent(event.id),
        getDocs(query(collection(db, COLLECTIONS.GUEST_REGISTRATIONS), where('eventId', '==', event.id))),
      ]);

      const guestEntries: EventRegistration[] = guestSnap.docs
        .filter(doc => !doc.data()['_indexFor'])
        .map(doc => {
          const data = doc.data();
          return {
            id: `guest-${doc.id}`,
            eventId: event.id,
            memberId: `guest-${doc.id}`,
            status: (data.status === 'Cancelled' ? 'cancelled' : 'registered') as EventRegistration['status'],
            createdAt: data.registeredAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
            memberName: data.general?.name ?? null,
          } as EventRegistration;
        });

      const docMemberIds = new Set([...list, ...guestEntries].map(registration => registration.memberId));
      const syntheticEntries: EventRegistration[] = (event.registeredMembers ?? [])
        .filter(memberId => !docMemberIds.has(memberId))
        .map(memberId => ({
          id: `synthetic-${memberId}`,
          eventId: event.id,
          memberId,
          status: 'registered' as const,
          createdAt: event.date ?? new Date().toISOString(),
        }));

      setParticipations([...list, ...guestEntries, ...syntheticEntries]);
    } catch (err) {
      setParticipations([]);
      showToast('加载参与者失败，请刷新重试', 'error');
      errorLoggingService.logError(err instanceof Error ? err : new Error(String(err)), { action: 'loadParticipations' });
    } finally {
      setLoadingParticipants(false);
    }
  }, [event.date, event.id, event.registeredMembers, showToast]);

  return {
    participations,
    setParticipations,
    loadingParticipants,
    loadParticipations,
  };
};
