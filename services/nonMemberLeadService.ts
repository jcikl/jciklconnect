// Non-Member Lead Service - 非会员留资，供组织跟进与推广（Story 9.1）
import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS, DEFAULT_LO_ID } from '../config/constants';
import type { NonMemberLead } from '../types';
import { isDevMode } from '../utils/devMode';

const MOCK_LEADS: NonMemberLead[] = [];

export const NonMemberLeadService = {
  async create(data: {
    name: string;
    email: string;
    phone?: string | null;
    interests?: string[] | null;
    source?: string | null;
    eventId?: string | null;
    loId?: string | null;
    notes?: string | null;
  }): Promise<string> {
    const loId = data.loId ?? DEFAULT_LO_ID;
    if (isDevMode()) {
      const id = `mock-lead-${Date.now()}`;
      MOCK_LEADS.push({
        id,
        name: data.name,
        email: data.email,
        phone: data.phone ?? null,
        interests: data.interests ?? null,
        source: data.source ?? null,
        eventId: data.eventId ?? null,
        loId,
        createdAt: new Date().toISOString(),
        notes: data.notes ?? null,
      });
      return id;
    }
    const ref = await addDoc(collection(db, COLLECTIONS.NON_MEMBER_LEADS), {
      name: data.name,
      email: data.email,
      phone: data.phone ?? null,
      interests: data.interests ?? null,
      source: data.source ?? null,
      eventId: data.eventId ?? null,
      loId,
      createdAt: Timestamp.now(),
      notes: data.notes ?? null,
    });
    return ref.id;
  },

  async listByLo(loId: string, pageSize: number = 100): Promise<NonMemberLead[]> {
    if (isDevMode()) {
      return MOCK_LEADS.filter((l) => l.loId === loId).slice(0, pageSize);
    }
    const q = query(
      collection(db, COLLECTIONS.NON_MEMBER_LEADS),
      where('loId', '==', loId),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name,
        email: data.email,
        phone: data.phone ?? null,
        interests: data.interests ?? null,
        source: data.source ?? null,
        eventId: data.eventId ?? null,
        loId: data.loId,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? data.createdAt ?? new Date().toISOString(),
        notes: data.notes ?? null,
      } as NonMemberLead;
    });
  },
};
