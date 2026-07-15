// Events Service - CRUD Operations
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  limit,
  Timestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS, DEFAULT_LO_ID } from '../config/constants';
import { Event } from '../types';
import { EventRegistrationService } from './eventRegistrationService';
import { withDevMode } from '../utils/devMode';
import { apiCache } from './cacheService';
import { MOCK_EVENTS } from './mockData';

const CACHE_KEY_ALL_EVENTS = 'events:all';
const EVENTS_TTL = 3 * 60 * 1000; // 3 minutes

export class EventsService {
  private static mockEvents: Event[] = [...MOCK_EVENTS];

  static invalidateEventsCache(): void {
    apiCache.delete(CACHE_KEY_ALL_EVENTS);
  }

  private static projectDocToEvent(d: { id: string; data: () => Record<string, unknown> }): Event {
    const data = d.data() ?? {};
    // Use eventStartDate as primary date, fallback to date for backward compatibility
    const dateVal = data.eventStartDate ?? data.date;
    const dateStr = (dateVal && typeof dateVal === 'object' && 'toDate' in dateVal)
      ? (dateVal as Timestamp).toDate().toISOString()
      : (typeof dateVal === 'string' ? dateVal : '');
    const endDateVal = data.eventEndDate ?? data.endDate;
    const endDateStr = (endDateVal && typeof endDateVal === 'object' && 'toDate' in endDateVal)
      ? (endDateVal as Timestamp).toDate().toISOString()
      : (typeof endDateVal === 'string' ? endDateVal : undefined);
    // Use eventStartTime as primary time, fallback to time for backward compatibility
    const timeVal = data.eventStartTime ?? data.time;
    const endTimeVal = data.eventEndTime ?? undefined;
    return {
      id: d.id,
      title: data.title ?? data.name ?? '',
      description: data.description ?? undefined,
      date: dateStr,
      endDate: endDateStr,
      time: timeVal ?? undefined,
      endTime: endTimeVal,
      type: (data.eventType ?? data.type) ?? 'Meeting',
      attendees: data.attendees ?? 0,
      maxAttendees: data.maxAttendees ?? undefined,
      status: data.status ?? 'Upcoming',
      predictedDemand: data.predictedDemand ?? undefined,
      location: data.location ?? '',
      price: data.price ?? undefined,
      priceMin: data.priceMin ?? undefined,
      priceMax: data.priceMax ?? undefined,
      imageUrl: (data.imageUrl ?? data.logoUrl) as string | undefined,
      organizerId: data.organizerId ?? undefined,
      registeredMembers: data.registeredMembers as string[] ?? [],
      committee: data.committee as any[] ?? undefined,
    } as Event;
  }

  /** Approved projects with eventStartDate (for Event List: Upcoming + Completed) */
  static async getAllEvents(): Promise<Event[]> {
    return withDevMode(
      () => [...this.mockEvents],
      () => apiCache.getOrSet(CACHE_KEY_ALL_EVENTS, async () => {
        try {
          const snapshot = await getDocs(
            query(
              collection(db, COLLECTIONS.PROJECTS),
              where('status', '==', 'Active')
            )
          );

          const events = snapshot.docs
            .filter(d => {
              const data = d.data();
              return data.eventStartDate != null || data.date != null;
            })
            .map(d => this.projectDocToEvent({ id: d.id, data: () => d.data() }));

          return events.sort((a, b) => {
            const da = a.date ? new Date(a.date).getTime() : 0;
            const db = b.date ? new Date(b.date).getTime() : 0;
            return db - da;
          });
        } catch (error) {
          console.error('Error fetching events:', error);
          throw error;
        }
      }, EVENTS_TTL, 'eventsService.getAllEvents')
    );
  }

  // Get event by ID (from projects collection)
  static async getEventById(eventId: string): Promise<Event | null> {
    return withDevMode(
      () => this.mockEvents.find(e => e.id === eventId) || null,
      async () => {
        try {
          const docRef = doc(db, COLLECTIONS.PROJECTS, eventId);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const d = docSnap.data();
            const hasDate = d?.eventStartDate != null || d?.date != null;
            const isBannedStatus = ['Planning', 'Draft', 'Submitted', 'Under Review', 'Rejected', 'Cancelled'].includes(d?.status);
            if (hasDate && !isBannedStatus) {
              return this.projectDocToEvent({ id: docSnap.id, data: () => d });
            }
          }
          return null;
        } catch (error) {
          console.error('Error fetching event:', error);
          throw error;
        }
      }
    );
  }

  // Create new event
  static async createEvent(eventData: Omit<Event, 'id'>): Promise<string> {
    return withDevMode(
      () => {
        const newId = `mock-event-${Date.now()}`;
        const newEvent: Event = {
          id: newId,
          ...eventData,
          attendees: 0,
          status: 'Upcoming',
        };
        this.mockEvents.unshift(newEvent);
        return newId;
      },
      async () => {
        try {
          const payload: Record<string, unknown> = {
            title: eventData.title,
            description: eventData.description ?? null,
            eventType: eventData.type,
            date: Timestamp.fromDate(new Date(eventData.date)),
            location: eventData.location,
            attendees: 0,
            status: 'Upcoming' as const,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };
          if (eventData.maxAttendees != null) payload.maxAttendees = eventData.maxAttendees;
          if (eventData.endDate != null) payload.endDate = eventData.endDate;
          if (eventData.time != null) payload.time = eventData.time;
          if (eventData.organizerId != null && eventData.organizerId !== '') payload.organizerId = eventData.organizerId;
          if (eventData.predictedDemand != null) payload.predictedDemand = eventData.predictedDemand;
          payload.type = eventData.type;

          const docRef = await addDoc(collection(db, COLLECTIONS.PROJECTS), payload);
          this.invalidateEventsCache();
          return docRef.id;
        } catch (error) {
          console.error('Error creating event:', error);
          throw error;
        }
      }
    );
  }

  // Update event
  static async updateEvent(eventId: string, updates: Partial<Event>): Promise<void> {
    return withDevMode(
      () => {
        const index = this.mockEvents.findIndex(e => e.id === eventId);
        if (index !== -1) {
          this.mockEvents[index] = { ...this.mockEvents[index], ...updates };
        }
      },
      async () => {
        try {
          const eventRef = doc(db, COLLECTIONS.PROJECTS, eventId);
          const updateData: Record<string, unknown> = { updatedAt: Timestamp.now() };
          for (const [k, v] of Object.entries(updates)) {
            if (v !== undefined) {
              if (k === 'type') updateData.eventType = v;
              else if (k === 'date') updateData.date = Timestamp.fromDate(new Date(v as string));
              else updateData[k] = v;
            }
          }

          await updateDoc(eventRef, updateData);
          this.invalidateEventsCache();
        } catch (error) {
          console.error('Error updating event:', error);
          throw error;
        }
      }
    );
  }

  // Delete event
  static async deleteEvent(eventId: string): Promise<void> {
    return withDevMode(
      () => { this.mockEvents = this.mockEvents.filter(e => e.id !== eventId); },
      async () => {
        try {
          await deleteDoc(doc(db, COLLECTIONS.PROJECTS, eventId));
          this.invalidateEventsCache();
        } catch (error) {
          console.error('Error deleting event:', error);
          throw error;
        }
      }
    );
  }

  // Register member for event
  static async registerForEvent(
    eventId: string,
    memberId: string,
    extraFields?: {
      dietary?: 'normal' | 'vegetarian' | 'halal' | null;
      isVegetarian?: boolean | null;
      emergencyContactName?: string | null;
      emergencyContactPhone?: string | null;
      tshirtSize?: string | null;
      memberName?: string | null;
      registeredBy?: string | null;
      registeredByName?: string | null;
    }
  ): Promise<void> {
    return withDevMode(
      () => {},
      async () => {
        try {
          const eventRef = doc(db, COLLECTIONS.PROJECTS, eventId);
          const event = await this.getEventById(eventId);

          if (!event) throw new Error('Event not found');

          const existing = await EventRegistrationService.getByEventAndMember(eventId, memberId);
          if (existing && existing.status !== 'cancelled') throw new Error('You have already registered for this event');

          if (event.maxAttendees && event.attendees >= event.maxAttendees) {
            throw new Error('Event is full');
          }

          // E-5: write registration doc first, then update event counter.
          // If events update fails, the reg exists but the counter is low — a minor desync.
          // The previous order (events update first) was worse: incremented counter with no registration doc.
          if (existing && existing.status === 'cancelled') {
            await EventRegistrationService.updateStatus(existing.id, 'registered', {
              registeredBy: extraFields?.registeredBy,
              registeredByName: extraFields?.registeredByName,
            });
          } else {
            await EventRegistrationService.create(eventId, memberId, DEFAULT_LO_ID, extraFields);
          }
          await updateDoc(eventRef, {
            attendees: event.attendees + 1,
            registeredMembers: arrayUnion(memberId),
          });
        } catch (error) {
          console.error('Error registering for event:', error);
          throw error;
        }
      }
    );
  }

  // Cancel event registration
  static async cancelRegistration(
    eventId: string,
    memberId: string,
    cancelledBy: string,
    cancelledByName: string,
    cancelledByRole: 'self' | 'admin' | 'board' | 'committee'
  ): Promise<void> {
    return withDevMode(
      () => {},
      async () => {
        try {
          const eventRef = doc(db, COLLECTIONS.PROJECTS, eventId);
          const event = await this.getEventById(eventId);
          if (!event) throw new Error('Event not found');

          // N-1: cancel reg doc first, then decrement event counter — consistent with registerForEvent.
          // If updateDoc fails after cancel, counter is high by 1 (minor) vs the previous order where
          // counter was already decremented but the reg doc remained active (worse: appears to have free slot).
          const reg = await EventRegistrationService.getByEventAndMember(eventId, memberId);
          if (reg) {
            await EventRegistrationService.cancel(reg.id, cancelledBy, cancelledByName, cancelledByRole);
          }
          await updateDoc(eventRef, {
            attendees: Math.max(0, event.attendees - 1),
            registeredMembers: arrayRemove(memberId),
          });
        } catch (error) {
          console.error('Error canceling registration:', error);
          throw error;
        }
      }
    );
  }

  // Cancel entire event — batch-cancels all active registrations and their income transactions
  static async cancelEvent(
    eventId: string,
    cancelledBy: string,
    cancelledByName: string
  ): Promise<void> {
    return withDevMode(
      () => {
        const idx = this.mockEvents.findIndex(e => e.id === eventId);
        if (idx !== -1) this.mockEvents[idx] = { ...this.mockEvents[idx], status: 'Cancelled' };
      },
      async () => {
        const event = await this.getEventById(eventId);
        if (!event) throw new Error('Event not found');
        if (event.status === 'Cancelled') return;

        const registrations = await EventRegistrationService.listByEvent(eventId);
        const active = registrations.filter(r => r.status !== 'cancelled');

        if (active.length > 0) {
          const cancelledAt = new Date().toISOString();
          const now = Timestamp.now();
          // E-2: batch all reg status updates (max 490 per Firestore batch)
          const BATCH_SIZE = 490;
          for (let i = 0; i < active.length; i += BATCH_SIZE) {
            const chunk = active.slice(i, i + BATCH_SIZE);
            const batch = writeBatch(db);
            for (const reg of chunk) {
              batch.update(doc(db, COLLECTIONS.EVENT_REGISTRATIONS, reg.id), {
                status: 'cancelled',
                cancelledAt,
                cancelledBy,
                cancelledByName,
                cancelledByRole: 'admin',
                financeTransactionId: null,
                updatedAt: now,
              });
            }
            await batch.commit();
          }

          // After batch succeeds, clean up linked finance txs (best effort — Reconciled txs are skipped)
          for (const reg of active) {
            if (reg.financeTransactionId) {
              try {
                const { FinanceService } = await import('./financeService');
                const tx = await FinanceService.getTransactionById(reg.financeTransactionId);
                if (tx && (tx.status === 'Pending' || tx.status === 'Cleared')) {
                  await FinanceService.deleteTransaction(reg.financeTransactionId);
                }
              } catch (err) {
                console.warn('[EventsService.cancelEvent] Could not clean up tx for', reg.id, err);
              }
            }
          }
        }

        await updateDoc(doc(db, COLLECTIONS.PROJECTS, eventId), {
          status: 'Cancelled',
          updatedAt: Timestamp.now(),
        });
        this.invalidateEventsCache();
      }
    );
  }

  // Mark attendance (check-in)
  static async markAttendance(
    eventId: string,
    memberId: string,
    checkInTime?: Date
  ): Promise<void> {
    return withDevMode(
      () => {},
      async () => {
        try {
          const eventRef = doc(db, COLLECTIONS.PROJECTS, eventId);
          const event = await this.getEventById(eventId);

          if (!event) throw new Error('Event not found');

          // N-2: update EventRegistration status first, then write attendanceList.
          // If arrayUnion fails after updateStatus, attendanceList is low by 1 (minor display desync)
          // vs the previous order where attendanceList had the member but status stayed 'registered'.
          const reg = await EventRegistrationService.getByEventAndMember(eventId, memberId);
          if (reg) {
            const at = (checkInTime ?? new Date()).toISOString();
            await EventRegistrationService.updateStatus(reg.id, 'checked_in', { checkedInAt: at });
          }
          // 报名/缴费/签到一致：同步签到记录到 events.attendanceList（Story 8.1）
          await updateDoc(eventRef, {
            attendanceList: arrayUnion({
              memberId,
              checkInTime: checkInTime ? Timestamp.fromDate(checkInTime) : Timestamp.now(),
            }),
          });

          // E-3: PointsService.awardEventAttendancePoints removed — the Cloud Function
          // onEventRegistrationUpdate (functions/gamificationLogic.ts) fires on checked_in status
          // and writes both points and incentiveSubmissions server-side. Calling PointsService here
          // in addition caused duplicate points records.

          // 按当年签到记录重算出席对比（签到次数 vs 已过月份）
          const { MembersService } = await import('./membersService');
          MembersService.recalculateAttendance(memberId).catch(console.error);
        } catch (error) {
          console.error('Error marking attendance:', error);
          throw error;
        }
      }
    );
  }

  // Get upcoming events (approved, date >= now)
  static async getUpcomingEvents(limitCount: number = 10): Promise<Event[]> {
    try {
      const allEvents = await this.getAllEvents();
      const now = new Date().getTime();
      return allEvents
        .filter(e => e.date && new Date(e.date).getTime() >= now)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, limitCount);
    } catch (error) {
      console.error('Error fetching upcoming events:', error);
      throw error;
    }
  }

  // Get events by type
  static async getEventsByType(type: Event['type']): Promise<Event[]> {
    try {
      const allEvents = await this.getAllEvents();
      return allEvents.filter(e => e.type === type);
    } catch (error) {
      console.error('Error fetching events by type:', error);
      throw error;
    }
  }

  // Register guest for event (public registration)
  static async registerGuestForEvent(
    eventId: string,
    guestData: {
      name: string;
      email: string;
      phone: string;
      organization?: string;
      notes?: string;
    }
  ): Promise<void> {
    return withDevMode(
      () => {},
      async () => {
        try {
          const col = collection(db, COLLECTIONS.GUEST_REGISTRATIONS);
          const [emailSnap, phoneSnap] = await Promise.all([
            getDocs(query(col, where('eventId', '==', eventId), where('email', '==', guestData.email))),
            getDocs(query(col, where('eventId', '==', eventId), where('phone', '==', guestData.phone))),
          ]);
          const isDuplicate = (snap: { docs: { data(): Record<string, unknown> }[] }) =>
            snap.docs.some(d => d.data().status !== 'Cancelled');
          if (isDuplicate(emailSnap)) throw new Error('This email has already been registered for this event.');
          if (isDuplicate(phoneSnap)) throw new Error('This phone number has already been registered for this event.');

          const guestRegistration: Record<string, unknown> = {
            eventId,
            name: guestData.name,
            email: guestData.email,
            phone: guestData.phone,
            registeredAt: Timestamp.now(),
            status: 'Pending' as const,
          };
          if (guestData.organization != null) guestRegistration.organization = guestData.organization;
          if (guestData.notes != null) guestRegistration.notes = guestData.notes;

          await addDoc(col, guestRegistration);
        } catch (error) {
          console.error('Error registering guest for event:', error);
          throw error;
        }
      }
    );
  }
}
