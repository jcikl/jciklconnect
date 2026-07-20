// Event Registration Service - 报名/缴费/签到统一名单（Story 8.1）
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  writeBatch,
  runTransaction,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  arrayRemove,
  arrayUnion,
  increment,
  deleteField,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS, DEFAULT_LO_ID } from '../config/constants';
import type { EventRegistration, EventRegistrationStatus } from '../types';
import { withDevMode } from '../utils/devMode';
import { errorLoggingService } from './errorLoggingService';

const MOCK_REGISTRATIONS: EventRegistration[] = [];

export const EventRegistrationService = {
  /**
   * List registrations for an event.
   * P0 fix: Firestore `allow list` requires BOARD+ for full event lists. Non-board callers
   * (e.g. members checking their own registration) must pass `viewerMemberId` so the query is
   * scoped to `memberId == viewerMemberId` — matching the member-scoped rules path.
   */
  async listByEvent(eventId: string, loId?: string, viewerMemberId?: string): Promise<EventRegistration[]> {
    return withDevMode(
      () => {
        const filtered = MOCK_REGISTRATIONS.filter((r) => r.eventId === eventId);
        return viewerMemberId ? filtered.filter((r) => r.memberId === viewerMemberId) : filtered;
      },
      async () => {
        // E2 fix: filter by loId so multi-LO deployments don't leak cross-LO registrations.
        // P0 fix: when viewerMemberId is provided (non-board caller), scope query to that member only.
        const constraints = viewerMemberId
          ? [where('eventId', '==', eventId), where('memberId', '==', viewerMemberId), orderBy('createdAt', 'desc')]
          : loId
            ? [where('eventId', '==', eventId), where('loId', '==', loId), orderBy('createdAt', 'desc')]
            : [where('eventId', '==', eventId), orderBy('createdAt', 'desc')];
        const q = query(collection(db, COLLECTIONS.EVENT_REGISTRATIONS), ...constraints);
        const snapshot = await getDocs(q);
        return snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            eventId: data.eventId,
            memberId: data.memberId,
            status: (data.status || 'registered') as EventRegistrationStatus,
            paidAt: data.paidAt?.toDate?.()?.toISOString?.() ?? data.paidAt ?? null,
            checkedInAt: data.checkedInAt?.toDate?.()?.toISOString?.() ?? data.checkedInAt ?? null,
            createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? data.createdAt ?? new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? data.updatedAt ?? null,
            loId: data.loId ?? null,
            cancelledAt: data.cancelledAt?.toDate?.()?.toISOString?.() ?? data.cancelledAt ?? null,
            cancelledBy: data.cancelledBy ?? null,
            cancelledByName: data.cancelledByName ?? null,
            cancelledByRole: data.cancelledByRole ?? null,
            dietary: (data.dietary ?? null) as EventRegistration['dietary'],
            isVegetarian: data.isVegetarian ?? null,
            emergencyContactName: data.emergencyContactName ?? null,
            emergencyContactPhone: data.emergencyContactPhone ?? null,
            tshirtSize: data.tshirtSize ?? null,
            memberName: data.memberName ?? data.name ?? null,
            registeredBy: data.registeredBy ?? null,
            registeredByName: data.registeredByName ?? null,
            paidByName: data.paidByName ?? null,
            checkedInByName: data.checkedInByName ?? null,
          } as EventRegistration;
        });
      }
    );
  },

  async getByEventAndMember(eventId: string, memberId: string): Promise<EventRegistration | null> {
    return withDevMode(
      () => MOCK_REGISTRATIONS.find((r) => r.eventId === eventId && r.memberId === memberId) ?? null,
      async () => {
        const ballotId = `${eventId}_${memberId}`;
        const d = await getDoc(doc(db, COLLECTIONS.EVENT_REGISTRATIONS, ballotId));
        if (!d.exists()) return null;
        const data = d.data();
        return {
          id: d.id,
          eventId: data.eventId,
          memberId: data.memberId,
          status: (data.status || 'registered') as EventRegistrationStatus,
          paidAt: data.paidAt?.toDate?.()?.toISOString?.() ?? data.paidAt ?? null,
          checkedInAt: data.checkedInAt?.toDate?.()?.toISOString?.() ?? data.checkedInAt ?? null,
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? data.createdAt ?? new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? data.updatedAt ?? null,
          loId: data.loId ?? null,
        } as EventRegistration;
      }
    );
  },

  async listByMember(memberId: string, loId?: string): Promise<EventRegistration[]> {
    return withDevMode(
      () => MOCK_REGISTRATIONS.filter((r) => r.memberId === memberId),
      async () => {
        // E2 fix: filter by loId so multi-LO deployments don't leak cross-LO registrations
        const constraints = loId
          ? [where('memberId', '==', memberId), where('loId', '==', loId), orderBy('createdAt', 'desc')]
          : [where('memberId', '==', memberId), orderBy('createdAt', 'desc')];
        const q = query(collection(db, COLLECTIONS.EVENT_REGISTRATIONS), ...constraints);
        const snapshot = await getDocs(q);
        return snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            eventId: data.eventId,
            memberId: data.memberId,
            status: (data.status || 'registered') as EventRegistrationStatus,
            paidAt: data.paidAt?.toDate?.()?.toISOString?.() ?? data.paidAt ?? null,
            checkedInAt: data.checkedInAt?.toDate?.()?.toISOString?.() ?? data.checkedInAt ?? null,
            createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? data.createdAt ?? new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? data.updatedAt ?? null,
            loId: data.loId ?? null,
          } as EventRegistration;
        });
      }
    );
  },

  async create(
    eventId: string,
    memberId: string,
    loId?: string,
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
  ): Promise<string> {
    const lid = loId ?? DEFAULT_LO_ID;
    return withDevMode(
      () => {
        const id = `mock-er-${Date.now()}`;
        MOCK_REGISTRATIONS.push({
          id,
          eventId,
          memberId,
          status: 'registered',
          createdAt: new Date().toISOString(),
          loId: lid,
          ...extraFields,
        });
        return id;
      },
      async () => {
        // P0 FIX: use deterministic doc ID and runTransaction so dedup check + write are atomic.
        const deterministicId = `${eventId}_${memberId}`;
        const regRef = doc(db, COLLECTIONS.EVENT_REGISTRATIONS, deterministicId);
        // P1 fix: also update event attendees counter inside the same transaction so the
        // counter stays in sync with the registration document at all times.
        const eventRef = doc(db, COLLECTIONS.PROJECTS, eventId);

        await runTransaction(db, async (txn) => {
          const snap = await txn.get(regRef);
          if (snap.exists() && snap.data().status !== 'cancelled') {
            throw new Error('会员已注册此活动');
          }

          const payload: Record<string, unknown> = {
            eventId,
            memberId,
            status: 'registered',
            createdAt: snap.exists() ? snap.data().createdAt : Timestamp.now(),
            updatedAt: Timestamp.now(),
            loId: lid,
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
          // Increment event attendees counter atomically with the registration write
          txn.update(eventRef, {
            attendees: increment(1),
            registeredMembers: arrayUnion(memberId),
          });
        });

        return deterministicId;
      }
    );
  },

  async updateStatus(
    registrationId: string,
    status: EventRegistrationStatus,
    options?: {
      paidAt?: string | null;
      checkedInAt?: string | null;
      registeredBy?: string | null;
      registeredByName?: string | null;
      paidByName?: string | null;
      checkedInByName?: string | null;
      paymentMethod?: 'toyyib' | 'bank_transfer' | 'cash';
      financeTransactionId?: string | null;
      matchedBankTxId?: string | null;
    }
  ): Promise<void> {
    return withDevMode(
      () => {
        const r = MOCK_REGISTRATIONS.find((x) => x.id === registrationId);
        if (r) {
          r.status = status;
          if (options?.paidAt !== undefined) r.paidAt = options.paidAt;
          if (options?.checkedInAt !== undefined) r.checkedInAt = options.checkedInAt;
          if (options?.registeredBy !== undefined) r.registeredBy = options.registeredBy;
          if (options?.registeredByName !== undefined) r.registeredByName = options.registeredByName;
          r.updatedAt = new Date().toISOString();
        }
      },
      async () => {
        const ref = doc(db, COLLECTIONS.EVENT_REGISTRATIONS, registrationId);
        const updateData: Record<string, unknown> = { status, updatedAt: Timestamp.now() };
        // E6 fix: when reactivating a cancelled registration, remove stale cancellation fields
        // so the document doesn't contradict itself (status=registered but cancelledAt still set).
        if (status === 'registered') {
          updateData.cancelledAt = deleteField();
          updateData.cancelledBy = deleteField();
          updateData.cancelledByName = deleteField();
          updateData.cancelledByRole = deleteField();
        }
        if (options?.paidAt !== undefined) updateData.paidAt = options.paidAt ?? null;
        if (options?.checkedInAt !== undefined) updateData.checkedInAt = options.checkedInAt ?? null;
        if (options?.registeredBy !== undefined) updateData.registeredBy = options.registeredBy;
        if (options?.registeredByName !== undefined) updateData.registeredByName = options.registeredByName;
        if (options?.paidByName !== undefined) updateData.paidByName = options.paidByName ?? null;
        if (options?.checkedInByName !== undefined) updateData.checkedInByName = options.checkedInByName ?? null;
        if (options?.paymentMethod !== undefined) updateData.paymentMethod = options.paymentMethod;
        if (options?.financeTransactionId !== undefined) updateData.financeTransactionId = options.financeTransactionId ?? null;
        if (options?.matchedBankTxId !== undefined) updateData.matchedBankTxId = options.matchedBankTxId;
        await updateDoc(ref, updateData);
      }
    );
  },

  /**
   * E5 fix: hard-delete a registration with cascade cleanup.
   * Atomically deletes the registration doc and removes memberId from events.attendanceList.
   * Returns pointsReversalNeeded=true if the registration was checked_in — caller should
   * separately reverse attendance points (complex enough to leave to the caller).
   */
  async hardDeleteRegistration(
    registrationId: string
  ): Promise<{ pointsReversalNeeded: boolean; memberId: string | null; eventId: string | null }> {
    return withDevMode(
      () => {
        const idx = MOCK_REGISTRATIONS.findIndex((r) => r.id === registrationId);
        if (idx !== -1) MOCK_REGISTRATIONS.splice(idx, 1);
        return { pointsReversalNeeded: false as boolean, memberId: null, eventId: null };
      },
      async () => {
        const regRef = doc(db, COLLECTIONS.EVENT_REGISTRATIONS, registrationId);
        const snap = await getDoc(regRef);
        if (!snap.exists()) return { pointsReversalNeeded: false, memberId: null, eventId: null };

        const data = snap.data();
        const memberId: string | null = data.memberId ?? null;
        const eventId: string | null = data.eventId ?? null;
        const wasCheckedIn = data.status === 'checked_in';
        // Cancelled registrations already had their counter decremented on cancel;
        // only non-cancelled registrations still hold a slot in the attendees count.
        const wasCancelled = data.status === 'cancelled';

        const batch = writeBatch(db);
        batch.delete(regRef);
        if (eventId && memberId) {
          const eventRef = doc(db, COLLECTIONS.PROJECTS, eventId);
          const eventUpdate: Record<string, unknown> = { attendanceList: arrayRemove(memberId) };
          // P1 fix: also decrement attendees and remove from registeredMembers
          // so the event counter stays accurate after a hard delete.
          if (!wasCancelled) {
            eventUpdate.attendees = increment(-1);
            eventUpdate.registeredMembers = arrayRemove(memberId);
          }
          batch.update(eventRef, eventUpdate);
        }
        await batch.commit();

        if (wasCheckedIn) {
          console.warn(
            '[EventRegistrationService.hardDeleteRegistration] Registration was checked_in — ' +
            'manual points reversal may be needed. memberId:', memberId, 'eventId:', eventId
          );
        }
        return { pointsReversalNeeded: wasCheckedIn, memberId, eventId };
      }
    );
  },

  async cancel(
    registrationId: string,
    cancelledBy: string,
    cancelledByName: string,
    cancelledByRole: 'self' | 'admin' | 'board' | 'committee'
  ): Promise<void> {
    return withDevMode(
      () => {
        const r = MOCK_REGISTRATIONS.find((x) => x.id === registrationId);
        if (r) {
          r.status = 'cancelled';
          r.cancelledAt = new Date().toISOString();
          r.cancelledBy = cancelledBy;
          r.cancelledByName = cancelledByName;
          r.cancelledByRole = cancelledByRole;
          r.updatedAt = new Date().toISOString();
        }
      },
      async () => {
        const ref = doc(db, COLLECTIONS.EVENT_REGISTRATIONS, registrationId);
        let financeTransactionId: string | undefined;

        // P1 FIX: wrap in runTransaction so concurrent cancels both read the fresh status
        // before decrementing — preventing double-decrement of the event attendees counter.
        await runTransaction(db, async (txn) => {
          const snap = await txn.get(ref);
          if (!snap.exists() || snap.data().status === 'cancelled') {
            return; // already cancelled or never existed — idempotent
          }
          financeTransactionId = snap.data().financeTransactionId ?? undefined;
          const regEventId: string | undefined = snap.data().eventId;
          const regMemberId: string | undefined = snap.data().memberId;

          txn.update(ref, {
            status: 'cancelled',
            cancelledAt: Timestamp.now(),
            cancelledBy,
            cancelledByName,
            cancelledByRole,
            financeTransactionId: null,
            updatedAt: Timestamp.now(),
          });
          if (regEventId && regMemberId) {
            const eventRef = doc(db, COLLECTIONS.PROJECTS, regEventId);
            txn.update(eventRef, {
              attendees: increment(-1),
              registeredMembers: arrayRemove(regMemberId),
            });
          }
        });

        if (financeTransactionId) {
          try {
            const { FinanceService } = await import('./financeService');
            const tx = await FinanceService.getTransactionById(financeTransactionId);
            if (tx) {
              if (tx.status === 'Pending' || tx.status === 'Cleared') {
                await FinanceService.deleteTransaction(financeTransactionId);
              }
              // Reconciled/Partially Reconciled — leave for finance to void manually.
            }
          } catch (err) {
            // P1 fix: log and re-throw so the caller knows the finance cleanup failed.
            // The registration cancellation itself already committed, but the linked transaction
            // could not be removed — finance team must void it manually.
            errorLoggingService.logError(err as Error, {
              component: 'EventRegistrationService',
              action: 'cancel-financeCleanup',
              additionalData: { registrationId, financeTransactionId },
            });
            throw err;
          }
        }
      }
    );
  },
};
