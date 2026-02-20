// Event Registration Service - 报名/缴费/签到统一名单（Story 8.1）
import {
  collection,
  doc,
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
import { isDevMode } from '../utils/devMode';

const MOCK_REGISTRATIONS: EventRegistration[] = [];

export const EventRegistrationService = {
  async listByEvent(eventId: string, loId?: string): Promise<EventRegistration[]> {
    if (isDevMode()) {
      return MOCK_REGISTRATIONS.filter((r) => r.eventId === eventId);
    }
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
      } as EventRegistration;
    });
  },

  async getByEventAndMember(eventId: string, memberId: string): Promise<EventRegistration | null> {
    if (isDevMode()) {
      return MOCK_REGISTRATIONS.find((r) => r.eventId === eventId && r.memberId === memberId) ?? null;
    }
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
  },

  async listByMember(memberId: string, loId?: string): Promise<EventRegistration[]> {
    if (isDevMode()) {
      return MOCK_REGISTRATIONS.filter((r) => r.memberId === memberId);
    }
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
  },

  async create(eventId: string, memberId: string, loId?: string): Promise<string> {
    const lid = loId ?? DEFAULT_LO_ID;
    if (isDevMode()) {
      const id = `mock-er-${Date.now()}`;
      MOCK_REGISTRATIONS.push({
        id,
        eventId,
        memberId,
        status: 'registered',
        createdAt: new Date().toISOString(),
        loId: lid,
      });
      return id;
    }
    const ref = await addDoc(collection(db, COLLECTIONS.EVENT_REGISTRATIONS), {
      eventId,
      memberId,
      status: 'registered',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      loId: lid,
    });
    return ref.id;
  },

  async updateStatus(
    registrationId: string,
    status: EventRegistrationStatus,
    options?: { paidAt?: string; checkedInAt?: string }
  ): Promise<void> {
    if (isDevMode()) {
      const r = MOCK_REGISTRATIONS.find((x) => x.id === registrationId);
      if (r) {
        r.status = status;
        if (options?.paidAt) r.paidAt = options.paidAt;
        if (options?.checkedInAt) r.checkedInAt = options.checkedInAt;
        r.updatedAt = new Date().toISOString();
      }
      return;
    }
    const ref = doc(db, COLLECTIONS.EVENT_REGISTRATIONS, registrationId);
    const updateData: Record<string, unknown> = { status, updatedAt: Timestamp.now() };
    if (options?.paidAt != null) updateData.paidAt = options.paidAt;
    if (options?.checkedInAt != null) updateData.checkedInAt = options.checkedInAt;
    await updateDoc(ref, updateData);
  },
};
