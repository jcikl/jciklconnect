// Payment Request Service (Story 2.1)
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
  startAfter,
  DocumentSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS, DEFAULT_LO_ID, REFERENCE_NUMBER_PREFIX } from '../config/constants';
import { PaymentRequest, PaymentRequestStatus } from '../types';
import { removeUndefined } from '../utils/dataUtils';
import { isDevMode } from '../utils/devMode';
import { MOCK_PAYMENT_REQUESTS } from './mockData';

/** In-memory store for dev mode so create/updateStatus persist during session. */
let devPaymentRequests: PaymentRequest[] = [...MOCK_PAYMENT_REQUESTS];

function filterPaymentRequests(
  items: PaymentRequest[],
  params: { loId?: string | null; activityRef?: string | null; applicantId?: string | null; status?: PaymentRequestStatus | null; referenceNumber?: string | null }
): PaymentRequest[] {
  let out = items;
  if (params.loId != null && params.loId !== '') out = out.filter((p) => p.loId === params.loId);
  if (params.activityRef != null && params.activityRef !== '') out = out.filter((p) => (p.activityRef ?? '') === params.activityRef);
  if (params.applicantId != null && params.applicantId !== '') out = out.filter((p) => p.applicantId === params.applicantId);
  if (params.status != null && (params.status as string) !== '') out = out.filter((p) => p.status === params.status);
  if (params.referenceNumber != null && params.referenceNumber !== '') out = out.filter((p) => (p.referenceNumber ?? '') === params.referenceNumber);
  return out.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export class PaymentRequestService {
  /** Generate unique reference number: PR-{loId}-{YYYYMMDD}-{seq} */
  static async generateReferenceNumber(loId: string): Promise<string> {
    if (isDevMode()) {
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const sameDay = devPaymentRequests.filter((p) => p.referenceNumber.startsWith(`${REFERENCE_NUMBER_PREFIX}-${loId}-${today}`));
      const seq = sameDay.length + 1;
      return `${REFERENCE_NUMBER_PREFIX}-${loId}-${today}-${String(seq).padStart(3, '0')}`;
    }
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const q = query(
      collection(db, COLLECTIONS.PAYMENT_REQUESTS),
      where('loId', '==', loId),
      where('createdAt', '>=', Timestamp.fromDate(startOfDay)),
      orderBy('createdAt', 'desc'),
      limit(500)
    );
    const snapshot = await getDocs(q);
    const seq = snapshot.size + 1;
    const seqStr = String(seq).padStart(3, '0');
    return `${REFERENCE_NUMBER_PREFIX}-${loId}-${today}-${seqStr}`;
  }

  static async create(
    data: Omit<PaymentRequest, 'id' | 'createdAt' | 'updatedAt' | 'referenceNumber'> & { referenceNumber?: string },
    createdBy?: string | null
  ): Promise<{ id: string; referenceNumber: string }> {
    const loId = data.loId ?? DEFAULT_LO_ID;
    const referenceNumber = data.referenceNumber ?? (await this.generateReferenceNumber(loId));
    if (isDevMode()) {
      const id = `pr-dev-${Date.now()}`;
      const now = new Date().toISOString();
      const newPr: PaymentRequest = {
        id,
        applicantId: data.applicantId,
        amount: data.amount,
        purpose: data.purpose ?? '',
        activityRef: data.activityRef ?? null,
        referenceNumber,
        status: data.status ?? 'submitted',
        loId,
        createdAt: now,
        updatedAt: now,
        updatedBy: createdBy ?? null,
        reviewedBy: null,
        reviewedAt: null,
        applicantName: data.applicantName ?? null,
      };
      devPaymentRequests = [newPr, ...devPaymentRequests];
      return { id, referenceNumber };
    }
    const now = Timestamp.now();
    const payload = removeUndefined({
      applicantId: data.applicantId,
      amount: data.amount,
      purpose: data.purpose ?? null,
      activityRef: data.activityRef ?? null,
      referenceNumber,
      status: data.status ?? 'submitted',
      loId,
      createdAt: now,
      updatedAt: now,
      updatedBy: createdBy ?? null,
      reviewedBy: null,
      reviewedAt: null,
      applicantName: data.applicantName ?? null,
    });
    const ref = await addDoc(collection(db, COLLECTIONS.PAYMENT_REQUESTS), payload);
    return { id: ref.id, referenceNumber };
  }

  static async getById(id: string): Promise<PaymentRequest | null> {
    if (isDevMode()) {
      return devPaymentRequests.find((p) => p.id === id) ?? null;
    }
    const snap = await getDoc(doc(db, COLLECTIONS.PAYMENT_REQUESTS, id));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      id: snap.id,
      ...d,
      createdAt: (d.createdAt as Timestamp)?.toDate?.()?.toISOString?.() ?? d.createdAt,
      updatedAt: (d.updatedAt as Timestamp)?.toDate?.()?.toISOString?.() ?? d.updatedAt,
      reviewedAt: d.reviewedAt != null ? (d.reviewedAt as Timestamp)?.toDate?.()?.toISOString?.() ?? d.reviewedAt : null,
    } as PaymentRequest;
  }

  /** List with optional filters; pagination via lastDoc. */
  static async list(params: {
    loId?: string | null;
    activityRef?: string | null;
    applicantId?: string | null;
    status?: PaymentRequestStatus | null;
    referenceNumber?: string | null;
    pageSize?: number;
    lastDoc?: DocumentSnapshot | null;
  }): Promise<{ items: PaymentRequest[]; lastDoc: DocumentSnapshot | null }> {
    const { loId, activityRef, applicantId, status, referenceNumber, pageSize = 50, lastDoc } = params;
    if (isDevMode()) {
      const filtered = filterPaymentRequests(devPaymentRequests, { loId, activityRef, applicantId, status, referenceNumber });
      const items = filtered.slice(0, pageSize);
      return { items, lastDoc: null };
    }
    const constraints = [];
    if (loId != null && loId !== '') constraints.push(where('loId', '==', loId));
    if (activityRef != null && activityRef !== '') constraints.push(where('activityRef', '==', activityRef));
    if (applicantId != null && applicantId !== '') constraints.push(where('applicantId', '==', applicantId));
    if (status != null && (status as string) !== '') constraints.push(where('status', '==', status));
    if (referenceNumber != null && referenceNumber !== '') constraints.push(where('referenceNumber', '==', referenceNumber));
    const q = query(
      collection(db, COLLECTIONS.PAYMENT_REQUESTS),
      ...constraints,
      orderBy('createdAt', 'desc'),
      limit(pageSize),
      ...(lastDoc ? [startAfter(lastDoc)] : [])
    );
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: (data.createdAt as Timestamp)?.toDate?.()?.toISOString?.() ?? data.createdAt,
        updatedAt: (data.updatedAt as Timestamp)?.toDate?.()?.toISOString?.() ?? data.updatedAt,
        reviewedAt: data.reviewedAt != null ? (data.reviewedAt as Timestamp)?.toDate?.()?.toISOString?.() ?? data.reviewedAt : null,
      } as PaymentRequest;
    });
    const nextLast = snapshot.docs.length === pageSize ? snapshot.docs[snapshot.docs.length - 1] : null;
    return { items, lastDoc: nextLast ?? null };
  }

  static async updateStatus(
    id: string,
    status: 'approved' | 'rejected',
    reviewedBy: string
  ): Promise<void> {
    if (isDevMode()) {
      const now = new Date().toISOString();
      const idx = devPaymentRequests.findIndex((p) => p.id === id);
      if (idx >= 0) {
        devPaymentRequests = [...devPaymentRequests];
        devPaymentRequests[idx] = { ...devPaymentRequests[idx], status, reviewedBy, reviewedAt: now, updatedAt: now };
      }
      return;
    }
    const now = Timestamp.now();
    await updateDoc(doc(db, COLLECTIONS.PAYMENT_REQUESTS, id), {
      status,
      reviewedBy: reviewedBy ?? null,
      reviewedAt: now,
      updatedAt: now,
    });
  }

  static async update(id: string, updates: Partial<Pick<PaymentRequest, 'purpose' | 'amount' | 'activityRef' | 'status'>>, updatedBy?: string | null): Promise<void> {
    if (isDevMode()) {
      const idx = devPaymentRequests.findIndex((p) => p.id === id);
      if (idx >= 0) {
        const now = new Date().toISOString();
        devPaymentRequests = [...devPaymentRequests];
        devPaymentRequests[idx] = { ...devPaymentRequests[idx], ...updates, updatedAt: now, updatedBy: updatedBy ?? null };
      }
      return;
    }
    const payload = removeUndefined({
      ...updates,
      updatedAt: Timestamp.now(),
      updatedBy: updatedBy ?? null,
    });
    await updateDoc(doc(db, COLLECTIONS.PAYMENT_REQUESTS, id), payload);
  }

  static async cancel(id: string, userId: string): Promise<void> {
    if (isDevMode()) {
      const now = new Date().toISOString();
      const idx = devPaymentRequests.findIndex((p) => p.id === id);
      if (idx >= 0) {
        devPaymentRequests = [...devPaymentRequests];
        devPaymentRequests[idx] = { ...devPaymentRequests[idx], status: 'cancelled', updatedAt: now, updatedBy: userId };
      }
      return;
    }
    const now = Timestamp.now();
    await updateDoc(doc(db, COLLECTIONS.PAYMENT_REQUESTS, id), {
      status: 'cancelled',
      updatedAt: now,
      updatedBy: userId,
    });
  }
}
