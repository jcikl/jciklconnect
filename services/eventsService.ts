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
  runTransaction,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  arrayUnion,
  arrayRemove,
  increment,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS, DEFAULT_LO_ID } from '../config/constants';
import { Event, ProjectCommitteeMember } from '../types';
import { EventRegistrationService } from './eventRegistrationService';
import { isDevMode, withDevMode } from '../utils/devMode';
import { errorLoggingService } from './errorLoggingService';
import { apiCache } from './cacheService';
import { MOCK_EVENTS } from './mockData';

const CACHE_KEY_ALL_EVENTS = 'events:all';
const EVENTS_TTL = 3 * 60 * 1000; // 3 minutes

export class EventsService {
  private static mockEvents: Event[] = [...MOCK_EVENTS];

  static invalidateEventsCache(): void {
    apiCache.delete(CACHE_KEY_ALL_EVENTS);
    apiCache.deleteByPrefix('events:id:');
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
      committee: data.committee as ProjectCommitteeMember[] | undefined ?? undefined,
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
          const cached = apiCache.get<Event | null>(`events:id:${eventId}`);
          if (cached !== null) return cached;

          const docRef = doc(db, COLLECTIONS.PROJECTS, eventId);
          const docSnap = await getDoc(docRef);

          let eventData: Event | null = null;
          if (docSnap.exists()) {
            const d = docSnap.data();
            const hasDate = d?.eventStartDate != null || d?.date != null;
            const isBannedStatus = ['Planning', 'Draft', 'Submitted', 'Under Review', 'Rejected', 'Cancelled'].includes(d?.status);
            if (hasDate && !isBannedStatus) {
              eventData = this.projectDocToEvent({ id: docSnap.id, data: () => d });
            }
          }
          apiCache.set(`events:id:${eventId}`, eventData, 180);
          return eventData;
        } catch (error) {
          console.error('Error fetching event:', error);
          throw error;
        }
      }
    );
  }

  // Create new event
  static async createEvent(eventData: Omit<Event, 'id'>, currentUserId?: string): Promise<string> {
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
          if (eventData.endDate && new Date(eventData.endDate) < new Date(eventData.date)) {
            throw new Error('Event end date must be on or after start date');
          }
          if (eventData.maxAttendees != null && (!Number.isInteger(eventData.maxAttendees) || eventData.maxAttendees < 1)) {
            throw new Error('maxAttendees must be a positive integer');
          }

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
            ...(currentUserId && { createdBy: currentUserId }),
          };
          if (eventData.maxAttendees != null) payload.maxAttendees = eventData.maxAttendees;
          if (eventData.endDate != null) payload.endDate = eventData.endDate;
          if (eventData.time != null) payload.time = eventData.time;
          if (eventData.organizerId != null && eventData.organizerId !== '') payload.organizerId = eventData.organizerId;
          if (eventData.predictedDemand != null) payload.predictedDemand = eventData.predictedDemand; // predictedDemand is stored but not used for business decisions — reserved for future AI insights feature.
          if (eventData.committee != null) payload.committee = eventData.committee; // P1-B: persist committee field
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
  static async updateEvent(eventId: string, updates: Partial<Event>, currentUserId?: string): Promise<void> {
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
          const updateData: Record<string, unknown> = {
            updatedAt: Timestamp.now(),
            ...(currentUserId && { updatedBy: currentUserId }),
          };
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
          const eventRef = doc(db, COLLECTIONS.PROJECTS, eventId);
          const regSnap = await getDocs(
            query(collection(db, COLLECTIONS.EVENT_REGISTRATIONS), where('eventId', '==', eventId))
          );

          // FIX E4: clean up linked finance transactions (Pending/Cleared) before
          // deleting registration docs, to avoid orphaned transaction records.
          if (!regSnap.empty) {
            const { FinanceService } = await import('./financeService');
            const txIds = regSnap.docs
              .map(d => d.data().financeTransactionId as string | undefined)
              .filter((id): id is string => Boolean(id));
            if (txIds.length > 0) {
              await Promise.allSettled(
                txIds.map(async txId => {
                  try {
                    const tx = await FinanceService.getTransactionById(txId);
                    if (tx && (tx.status === 'Pending' || tx.status === 'Cleared')) {
                      await FinanceService.deleteTransaction(txId);
                    }
                  } catch (err) {
                    console.warn('[EventsService.deleteEvent] Could not clean up tx', txId, err);
                  }
                })
              );
            }
          }

          // P0 FIX: include the event doc deletion in the same writeBatch as the
          // registration cleanup so both succeed or fail together.
          const BATCH_SIZE = 490;
          const regDocs = regSnap.docs;
          if (regDocs.length === 0) {
            // No registrations — single batch containing only the event doc.
            const batch = writeBatch(db);
            batch.delete(eventRef);
            await batch.commit();
          } else {
            for (let i = 0; i < regDocs.length; i += BATCH_SIZE) {
              const batch = writeBatch(db);
              regDocs.slice(i, i + BATCH_SIZE).forEach(d => batch.delete(d.ref));
              // Include the event doc delete in the first batch chunk.
              if (i === 0) batch.delete(eventRef);
              await batch.commit();
            }
          }

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
          // RC-009: Use a deterministic registration doc ID ({eventId}_{memberId})
          // and wrap the duplicate-check + write in a runTransaction so two
          // concurrent registrations from the same member (e.g. two browser tabs)
          // cannot both read "not registered" and both commit a new document.
          const deterministicRegId = `${eventId}_${memberId}`;
          const regRef = doc(db, COLLECTIONS.EVENT_REGISTRATIONS, deterministicRegId);

          await runTransaction(db, async (txn) => {
            const [existingSnap, eventSnap] = await Promise.all([
              txn.get(regRef),
              txn.get(eventRef),
            ]);

            if (!eventSnap.exists()) throw new Error('Event not found');
            const eventData = eventSnap.data() as import('../types').Event;

            if (existingSnap.exists() && existingSnap.data().status !== 'cancelled') {
              throw new Error('You have already registered for this event');
            }

            if (eventData.maxAttendees && (eventData.attendees ?? 0) >= eventData.maxAttendees) {
              throw new Error('Event is full');
            }

            if (existingSnap.exists() && existingSnap.data().status === 'cancelled') {
              // Reactivation path — update existing doc AND increment attendees counter
              txn.update(regRef, {
                status: 'registered',
                updatedAt: Timestamp.now(),
                ...(extraFields?.registeredBy ? { registeredBy: extraFields.registeredBy } : {}),
                ...(extraFields?.registeredByName ? { registeredByName: extraFields.registeredByName } : {}),
              });
              // P1 FIX: reactivation must also increment the event attendees count
              txn.update(eventRef, {
                attendees: increment(1),
                registeredMembers: arrayUnion(memberId),
              });
            } else {
              // New registration — set deterministic doc
              const payload: Record<string, unknown> = {
                eventId,
                memberId,
                status: 'registered',
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                loId: DEFAULT_LO_ID,
              };
              if (extraFields?.dietary) payload.dietary = extraFields.dietary;
              if (extraFields?.isVegetarian != null) payload.isVegetarian = extraFields.isVegetarian;
              if (extraFields?.emergencyContactName) payload.emergencyContactName = extraFields.emergencyContactName;
              if (extraFields?.emergencyContactPhone) payload.emergencyContactPhone = extraFields.emergencyContactPhone;
              if (extraFields?.tshirtSize) payload.tshirtSize = extraFields.tshirtSize;
              if (extraFields?.memberName) payload.memberName = extraFields.memberName;
              if (extraFields?.registeredBy) payload.registeredBy = extraFields.registeredBy;
              if (extraFields?.registeredByName) payload.registeredByName = extraFields.registeredByName;
              txn.set(regRef, payload);
              // New registration path — increment event attendees counter
              txn.update(eventRef, {
                attendees: increment(1),
                registeredMembers: arrayUnion(memberId),
              });
            }
          });

          this.invalidateEventsCache(); // P1-C: invalidate after attendee count changes
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

          // P1 FIX: commit the registration status change FIRST (atomically with the event
          // counter decrement), then delete the finance transaction. If finance deletion
          // fails, it only means a stale Pending income record survives — much safer than
          // the previous order where finance was deleted before the batch commit, leaving
          // the member still showing as 'registered' if the batch then failed.
          const reg = await EventRegistrationService.getByEventAndMember(eventId, memberId);
          const financeTransactionId: string | undefined = reg?.financeTransactionId ?? undefined;

          if (reg) {
            const regRef = doc(db, COLLECTIONS.EVENT_REGISTRATIONS, reg.id);
            const batch = writeBatch(db);
            batch.update(regRef, {
              status: 'cancelled',
              cancelledAt: Timestamp.now(),
              cancelledBy,
              cancelledByName,
              cancelledByRole,
              financeTransactionId: null,
              updatedAt: Timestamp.now(),
            });
            batch.update(eventRef, {
              attendees: increment(-1),
              registeredMembers: arrayRemove(memberId),
            });
            await batch.commit();
          }

          // After status is committed, clean up the linked finance transaction (best effort).
          if (financeTransactionId) {
            try {
              const { FinanceService } = await import('./financeService');
              const tx = await FinanceService.getTransactionById(financeTransactionId);
              if (tx && (tx.status === 'Pending' || tx.status === 'Cleared')) {
                await FinanceService.deleteTransaction(financeTransactionId);
              }
            } catch (txErr) {
              console.warn('[EventsService.cancelRegistration] Could not delete tx', financeTransactionId, txErr);
              // Non-fatal: registration is already cancelled; finance team can void manually.
            }
          }
          this.invalidateEventsCache();
        } catch (error) {
          console.error('Error canceling registration:', error);
          throw error;
        }
      }
    );
  }

  // P1-A: Mark an event as Completed (no existing method existed)
  static async completeEvent(eventId: string): Promise<void> {
    return withDevMode(
      () => {
        const idx = this.mockEvents.findIndex(e => e.id === eventId);
        if (idx !== -1) this.mockEvents[idx] = { ...this.mockEvents[idx], status: 'Completed' };
      },
      async () => {
        try {
          const eventRef = doc(db, COLLECTIONS.PROJECTS, eventId);
          const batch = writeBatch(db);
          batch.update(eventRef, {
            status: 'Completed',
            completedAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });
          await batch.commit();
          this.invalidateEventsCache();
        } catch (error) {
          console.error('Error completing event:', error);
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
            // P1 fix: include the event status update in the first batch so the event
            // document is marked 'Cancelled' atomically with its first batch of
            // registration cancellations, avoiding a standalone updateDoc that could
            // fail independently leaving registrations cancelled but the event still Active.
            if (i === 0) {
              batch.update(doc(db, COLLECTIONS.PROJECTS, eventId), {
                status: 'Cancelled',
                updatedAt: now,
              });
            }
            await batch.commit();
          }

          // After batch succeeds, clean up linked finance txs (best effort — Reconciled txs are skipped)
          await Promise.allSettled(
            active
              .filter(reg => reg.financeTransactionId)
              .map(async reg => {
                try {
                  const { FinanceService } = await import('./financeService');
                  const tx = await FinanceService.getTransactionById(reg.financeTransactionId!);
                  if (tx && (tx.status === 'Pending' || tx.status === 'Cleared')) {
                    await FinanceService.deleteTransaction(reg.financeTransactionId!);
                  }
                } catch (err) {
                  console.warn('[EventsService.cancelEvent] Could not clean up tx for', reg.id, err);
                }
              })
          );

          const checkedIn = active.filter(reg => reg.status === 'checked_in');
          if (checkedIn.length > 0) {
            const { PointsService } = await import('./pointsService');
            // Fix 2: one query for all event-related point records, then match by memberId in memory
            // instead of N per-member queries inside the loop.
            const allPointsSnap = await getDocs(
              query(
                collection(db, COLLECTIONS.POINTS),
                where('relatedEntityId', '==', eventId)
              )
            );
            const pointsByMember = new Map<string, number>();
            allPointsSnap.docs.forEach(d => {
              const data = d.data();
              const mid = data.memberId as string;
              if (mid) {
                pointsByMember.set(mid, (pointsByMember.get(mid) ?? 0) + (data.amount ?? data.points ?? 0));
              }
            });
            await Promise.allSettled(
              checkedIn.map(async reg => {
                try {
                  const total = pointsByMember.get(reg.memberId) ?? 0;
                  if (total > 0) {
                    await PointsService.awardPoints(
                      reg.memberId,
                      -total,
                      'EVENT_ATTENDANCE',
                      'Reversed: event cancelled',
                      eventId,
                      'event'
                    );
                  }
                } catch (err) {
                  console.warn('[EventsService.cancelEvent] Could not reverse points for', reg.memberId, err);
                }
              })
            );
          }
        }

        // Event status is now set inside the first batch chunk above (when active.length > 0).
        // When there are no active registrations, we still need to mark the event Cancelled.
        if (active.length === 0) {
          await updateDoc(doc(db, COLLECTIONS.PROJECTS, eventId), {
            status: 'Cancelled',
            updatedAt: Timestamp.now(),
          });
        }
        this.invalidateEventsCache();

        // Best-effort notifications to all members whose registrations were cancelled
        if (active.length > 0) {
          try {
            const { CommunicationService } = await import('./communicationService');
            await Promise.allSettled(
              active.map(reg =>
                CommunicationService.createNotification({
                  memberId: reg.memberId,
                  title: 'Event Cancelled',
                  message: `The event "${event.title || eventId}" has been cancelled. Any fees paid will be refunded.`,
                  type: 'warning',
                })
              )
            );
          } catch (notifErr) {
            console.warn('[EventsService.cancelEvent] Notifications failed (cancellation already committed):', notifErr);
          }
        }
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
            if (reg.status === 'cancelled') {
              throw new Error('Cannot mark attendance for a cancelled registration');
            }
            const at = (checkInTime ?? new Date()).toISOString();
            const now = Timestamp.now();
            // E3 fix: merge registration status update and attendanceList update into a single
            // writeBatch so both succeed or both fail together — no half-checked-in state.
            const regRef = doc(db, COLLECTIONS.EVENT_REGISTRATIONS, reg.id);
            const batch = writeBatch(db);
            batch.update(regRef, { status: 'checked_in', checkedInAt: at, updatedAt: now });
            // P1-D: attendanceList is written to the event doc inside COLLECTIONS.PROJECTS (correct —
            // events are stored as project documents). The authoritative per-member attendance record
            // lives in eventRegistrations; attendanceList here is a denormalised lookup array on the event.
            batch.update(eventRef, { attendanceList: arrayUnion(memberId), updatedAt: now });
            await batch.commit();
          } else {
            // No registration doc — still sync the attendanceList as a best-effort
            await updateDoc(eventRef, { attendanceList: arrayUnion(memberId), updatedAt: Timestamp.now() });
          }

          // E-3: PointsService.awardEventAttendancePoints removed — the Cloud Function
          // onEventRegistrationUpdate (functions/gamificationLogic.ts) fires on checked_in status
          // and writes both points and incentiveSubmissions server-side. Calling PointsService here
          // in addition caused duplicate points records.

          // 按当年签到记录重算出席对比（签到次数 vs 已过月份）
          const { MembersService } = await import('./membersService');
          MembersService.recalculateAttendance(memberId).catch(err => errorLoggingService.logError(err, { action: 'recalculate-attendance', additionalData: { memberId } }));
        } catch (error) {
          console.error('Error marking attendance:', error);
          throw error;
        }
      }
    );
  }

  // Undo attendance (un-check-in) — FIX E3
  static async undoAttendance(
    eventId: string,
    memberId: string
  ): Promise<void> {
    return withDevMode(
      () => {},
      async () => {
        try {
          const eventRef = doc(db, COLLECTIONS.PROJECTS, eventId);

          const reg = await EventRegistrationService.getByEventAndMember(eventId, memberId);
          if (reg) {
            if (reg.status !== 'checked_in') {
              throw new Error('Member is not currently checked in');
            }
            // E9/atomic fix: merge registration status revert and attendanceList removal
            // into one writeBatch so both writes succeed or fail together.
            const regRef = doc(db, COLLECTIONS.EVENT_REGISTRATIONS, reg.id);
            const now = Timestamp.now();
            const batch = writeBatch(db);
            batch.update(regRef, { status: 'registered', checkedInAt: null, updatedAt: now });
            batch.update(eventRef, { attendanceList: arrayRemove(memberId), updatedAt: now });
            await batch.commit();
          } else {
            await updateDoc(eventRef, { attendanceList: arrayRemove(memberId), updatedAt: Timestamp.now() });
          }

          // E7 fix: attempt to reverse attendance points that were awarded at check-in.
          // The Cloud Function awards points on checked_in; we query and negate them here.
          try {
            const { PointsService } = await import('./pointsService');
            const pointSnap = await getDocs(
              query(
                collection(db, COLLECTIONS.POINTS),
                where('memberId', '==', memberId),
                where('relatedEntityId', '==', eventId)
              )
            );
            const total = pointSnap.docs.reduce(
              (sum, d) => sum + (d.data().amount ?? d.data().points ?? 0),
              0
            );
            if (total > 0) {
              await PointsService.awardPoints(
                memberId,
                -total,
                'EVENT_ATTENDANCE',
                'Reversed: attendance undone',
                eventId,
                'event'
              );
            }
          } catch (pointsErr) {
            console.warn(
              '[EventsService.undoAttendance] Could not reverse attendance points for memberId:',
              memberId, 'eventId:', eventId, pointsErr
            );
          }

          const { MembersService } = await import('./membersService');
          MembersService.recalculateAttendance(memberId).catch(err => errorLoggingService.logError(err, { action: 'recalculate-attendance', additionalData: { memberId } }));
        } catch (error) {
          console.error('Error undoing attendance:', error);
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

  /**
   * Register a guest for an event.
   * Uses runTransaction to atomically prevent duplicate registrations — reads first to
   * check for an existing active registration with the same email, then writes only if
   * none exists. Without this, two simultaneous submissions from the same email could
   * both pass the check and both write, creating duplicate records.
   */
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
    if (isDevMode()) return;
    try {
      // Use runTransaction to make the duplicate-check + write atomic.
      // Note: Firestore transactions cannot run arbitrary queries, so we perform
      // the duplicate checks as getDocs outside the transaction first, then
      // write inside it. This is safe for the common case; extreme concurrent
      // submissions are additionally protected by the Firestore rules' hasOnly guard.
      // P0 FIX: use deterministic doc IDs + runTransaction to make dedup check atomic.
      // The main record uses eventId_email as its ID. A lightweight phone-index doc lets
      // us check phone uniqueness inside the same transaction without a collection query.
      const emailKey = guestData.email.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const phoneKey = guestData.phone.replace(/[^0-9]/g, '');
      const mainDocRef = doc(db, COLLECTIONS.GUEST_REGISTRATIONS, `${eventId}_${emailKey}`);
      const phoneIndexRef = doc(db, COLLECTIONS.GUEST_REGISTRATIONS, `${eventId}_phone_${phoneKey}`);

      await runTransaction(db, async (txn) => {
        const [mainSnap, phoneSnap] = await Promise.all([
          txn.get(mainDocRef),
          txn.get(phoneIndexRef),
        ]);
        if (mainSnap.exists() && mainSnap.data()['status'] !== 'Cancelled') {
          throw new Error('This email has already been registered for this event.');
        }
        if (phoneSnap.exists() && phoneSnap.data()['status'] !== 'Cancelled') {
          throw new Error('This phone number has already been registered for this event.');
        }

        const guestRegistration: Record<string, unknown> = {
          eventId,
          name: guestData.name,
          email: guestData.email,
          phone: guestData.phone,
          registeredAt: Timestamp.now(),
          status: 'Pending' as const,
        };
        if (guestData.organization != null) guestRegistration['organization'] = guestData.organization;
        if (guestData.notes != null) guestRegistration['notes'] = guestData.notes;

        txn.set(mainDocRef, guestRegistration);
        txn.set(phoneIndexRef, { eventId, email: guestData.email, phone: guestData.phone, status: 'Pending', _indexFor: 'phone' });
      });
      apiCache.delete(`guestRegistrations:event:${eventId}`);
    } catch (error) {
      errorLoggingService.logError(error as Error, {
        component: 'EventsService',
        action: 'registerGuestForEvent',
        additionalData: { eventId },
      });
      throw error;
    }
  }

  /**
   * Fetch all guest registrations for an event.
   * Exposes a service-layer method so components don't query Firestore directly.
   */
  static async getGuestRegistrations(eventId: string): Promise<Record<string, unknown>[]> {
    if (isDevMode()) return [];
    const cacheKey = `guestRegistrations:event:${eventId}`;
    return apiCache.getOrSet(
      cacheKey,
      async () => {
        try {
          const col = collection(db, COLLECTIONS.GUEST_REGISTRATIONS);
          const snap = await getDocs(
            query(col, where('eventId', '==', eventId), orderBy('registeredAt', 'desc'))
          );
          return snap.docs.map(d => ({ id: d.id, ...d.data() } as Record<string, unknown>));
        } catch (error) {
          errorLoggingService.logError(error as Error, {
            component: 'EventsService',
            action: 'getGuestRegistrations',
            additionalData: { eventId },
          });
          throw error;
        }
      },
      3 * 60 * 1000
    );
  }
}
