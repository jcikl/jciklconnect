// Event Registration Service - 报名/缴费/签到统一名单（Story 8.1）
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS, DEFAULT_LO_ID } from '../config/constants';
import type { EventRegistration, EventRegistrationStatus } from '../types';
import { withDevMode } from '../utils/devMode';

const MOCK_REGISTRATIONS: EventRegistration[] = [];

export const EventRegistrationService = {
  async listByEvent(eventId: string, loId?: string): Promise<EventRegistration[]> {
    return withDevMode(
      () => MOCK_REGISTRATIONS.filter((r) => r.eventId === eventId),
      async () => {
        const q = query(
          collection(db, COLLECTIONS.EVENT_REGISTRATIONS),
          where('eventId', '==', eventId),
          orderBy('createdAt', 'desc')
        );
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
        const q = query(
          collection(db, COLLECTIONS.EVENT_REGISTRATIONS),
          where('eventId', '==', eventId),
          where('memberId', '==', memberId),
          limit(1)
        );
        const snapshot = await getDocs(q);
        const d = snapshot.docs[0];
        if (!d) return null;
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
        const q = query(
          collection(db, COLLECTIONS.EVENT_REGISTRATIONS),
          where('memberId', '==', memberId),
          orderBy('createdAt', 'desc')
        );
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
        const payload: Record<string, unknown> = {
          eventId,
          memberId,
          status: 'registered',
          createdAt: Timestamp.now(),
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
        const ref = await addDoc(collection(db, COLLECTIONS.EVENT_REGISTRATIONS), payload);
        return ref.id;
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
        const snap = await getDoc(ref);
        const financeTransactionId: string | undefined = snap.exists() ? snap.data().financeTransactionId : undefined;

        // Clean up the linked income transaction before cancelling
        if (financeTransactionId) {
          try {
            const { FinanceService } = await import('./financeService');
            const tx = await FinanceService.getTransactionById(financeTransactionId);
            if (tx) {
              if (tx.status === 'Pending' || tx.status === 'Cleared') {
                // Delete Pending or Cleared income tx — cancellation voids the revenue claim.
                // A Cleared-then-left-as-Pending orphan would permanently inflate P&A income.
                await FinanceService.deleteTransaction(financeTransactionId);
              }
              // Reconciled/Partially Reconciled — can't safely delete; leave for finance to void manually.
              // Add a note so finance can trace the cancelled registration.
            }
          } catch (err) {
            console.warn('[EventRegistrationService.cancel] Could not clean up income tx:', err);
          }
        }

        await updateDoc(ref, {
          status: 'cancelled',
          cancelledAt: Timestamp.now(),
          cancelledBy,
          cancelledByName,
          cancelledByRole,
          financeTransactionId: null,
          updatedAt: Timestamp.now(),
        });
      }
    );
  },
};
