// Payment Request Service (Story 2.1)
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
import { withDevMode } from '../utils/devMode';
import { MOCK_PAYMENT_REQUESTS } from './mockData';
import { FinanceService } from './financeService';

/** Board positions authorised to approve/reject PRs (情景 25) */
const APPROVER_BOARD_TITLES = ['President', 'Secretary', 'Honorary Treasurer'];

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
    return withDevMode(
      () => {
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const sameDay = devPaymentRequests.filter((p) => p.referenceNumber.startsWith(`${REFERENCE_NUMBER_PREFIX}-${loId}-${today}`));
        const seq = sameDay.length + 1;
        return `${REFERENCE_NUMBER_PREFIX}-${loId}-${today}-${String(seq).padStart(3, '0')}`;
      },
      async () => {
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
  });
  }

  static async create(
    data: Omit<PaymentRequest, 'id' | 'createdAt' | 'updatedAt' | 'referenceNumber'> & { referenceNumber?: string },
    createdBy?: string | null
  ): Promise<{ id: string; referenceNumber: string }> {
    const loId = data.loId ?? DEFAULT_LO_ID;
    const referenceNumber = data.referenceNumber ?? (await this.generateReferenceNumber(loId));
    return withDevMode(
      async () => {
        const id = `pr-dev-${Date.now()}`;
        const now = new Date().toISOString();
        const newPr: PaymentRequest = {
          id,
          applicantId: data.applicantId,
          applicantName: data.applicantName ?? null,
          applicantEmail: data.applicantEmail ?? null,
          applicantPosition: data.applicantPosition ?? null,
          date: data.date ?? now.split('T')[0],
          time: data.time ?? now.split('T')[1].split('.')[0],
          category: data.category ?? 'administrative',
          activityId: data.activityId ?? null,
          totalAmount: data.totalAmount ?? data.amount,
          remark: data.remark ?? null,
          items: data.items ?? [],
          claimFromBankAccountId: data.claimFromBankAccountId ?? null,
          bankName: data.bankName ?? null,
          accountHolder: data.accountHolder ?? null,
          accountNumber: data.accountNumber ?? null,
          amount: data.amount,
          purpose: data.purpose ?? '',
          activityRef: data.activityRef ?? data.activityId ?? null,
          attachmentUrls: data.attachmentUrls ?? [],
          referenceNumber,
          status: data.status ?? 'submitted',
          loId,
          createdAt: now,
          updatedAt: now,
          updatedBy: createdBy ?? null,
          reviewedBy: null,
          reviewedAt: null,
        };
        devPaymentRequests = [newPr, ...devPaymentRequests];
        // Notify approvers if submitted immediately (情景 NN)
        if (newPr.status === 'submitted') await this._notifyApprovers(newPr);
        return { id, referenceNumber };
      },
      async () => {
    const now = Timestamp.now();
    const payload = removeUndefined({
      applicantId: data.applicantId,
      applicantName: data.applicantName ?? null,
      applicantEmail: data.applicantEmail ?? null,
      applicantPosition: data.applicantPosition ?? null,
      date: data.date ?? null,
      time: data.time ?? null,
      category: data.category ?? 'administrative',
      activityId: data.activityId ?? null,
      totalAmount: data.totalAmount ?? data.amount,
      remark: data.remark ?? null,
      items: data.items ?? [],
      claimFromBankAccountId: data.claimFromBankAccountId ?? null,
      bankName: data.bankName ?? null,
      accountHolder: data.accountHolder ?? null,
      accountNumber: data.accountNumber ?? null,
      amount: data.amount,
      purpose: data.purpose ?? null,
      activityRef: data.activityRef ?? data.activityId ?? null,
      attachmentUrls: data.attachmentUrls ?? [],
      referenceNumber,
      status: data.status ?? 'submitted',
      loId,
      createdAt: now,
      updatedAt: now,
      updatedBy: createdBy ?? null,
      reviewedBy: null,
      reviewedAt: null,
    });
    const ref = await addDoc(collection(db, COLLECTIONS.PAYMENT_REQUESTS), payload);
    // Notify approvers if submitted immediately (情景 NN)
    if ((data.status ?? 'submitted') === 'submitted') {
      const pr = { id: ref.id, ...payload, referenceNumber } as unknown as PaymentRequest;
      await this._notifyApprovers(pr);
    }
    return { id: ref.id, referenceNumber };
  });
  }

  static async getById(id: string): Promise<PaymentRequest | null> {
    return withDevMode(
      () => devPaymentRequests.find((p) => p.id === id) ?? null,
      async () => {
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
  });
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
    return withDevMode(
      () => {
        const filtered = filterPaymentRequests(devPaymentRequests, { loId, activityRef, applicantId, status, referenceNumber });
        const items = filtered.slice(0, pageSize);
        return { items, lastDoc: null };
      },
      async () => {
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
  });
  }

  /**
   * Approve or reject a PR. Only President / Secretary / Honorary Treasurer may act (情景 25).
   * Pass reviewerBoardTitle from the member profile of the reviewer.
   * For rejection, rejectionReason is required (KK).
   */
  static async updateStatus(
    id: string,
    status: 'approved' | 'rejected',
    reviewedBy: string,
    opts?: { reviewerBoardTitle?: string; rejectionReason?: string }
  ): Promise<void> {
    const { reviewerBoardTitle, rejectionReason } = opts ?? {};

    // Role gate (情景 25) — reviewerBoardTitle must be present AND be an authorised title.
    // An absent title (member profile not set) is not a bypass; it's a hard rejection.
    if (!reviewerBoardTitle || !APPROVER_BOARD_TITLES.some(t => reviewerBoardTitle.includes(t))) {
      throw new Error(`Only ${APPROVER_BOARD_TITLES.join(', ')} may approve or reject payment requests.`);
    }
    if (status === 'rejected' && !rejectionReason?.trim()) {
      throw new Error('A rejection reason is required (情景 KK).');
    }

    return withDevMode(
      async () => {
        const now = new Date().toISOString();
        const idx = devPaymentRequests.findIndex((p) => p.id === id);
        if (idx < 0) throw new Error('Payment request not found');
        const currentStatus = devPaymentRequests[idx].status;
        if (currentStatus !== 'submitted') {
          throw new Error(`Cannot ${status} a payment request with status "${currentStatus}" — only submitted requests can be approved or rejected.`);
        }
        devPaymentRequests = [...devPaymentRequests];
        devPaymentRequests[idx] = {
          ...devPaymentRequests[idx],
          status,
          reviewedBy,
          reviewedAt: now,
          updatedAt: now,
          ...(status === 'rejected' ? { rejectionReason: rejectionReason ?? null } : {}),
        };
        if (status === 'approved') {
          const pr = devPaymentRequests.find((p) => p.id === id);
          if (pr) await this._createExpenseTransaction(pr, reviewedBy);
        }
        if (status === 'rejected') {
          // Defensive: clears any expense tx that may already exist for this PR (情景 KK).
          await this._deleteExpenseTransactionForPR(id);
        }
        // Notify applicant (AA)
        const pr = devPaymentRequests.find((p) => p.id === id);
        if (pr) await this._notifyApplicant(pr, status, rejectionReason);
      },
      async () => {
        const ref = doc(db, COLLECTIONS.PAYMENT_REQUESTS, id);
        const snap0 = await getDoc(ref);
        if (!snap0.exists()) throw new Error('Payment request not found');
        const currentStatus = (snap0.data() as PaymentRequest).status;
        if (currentStatus !== 'submitted') {
          throw new Error(`Cannot ${status} a payment request with status "${currentStatus}" — only submitted requests can be approved or rejected.`);
        }

        const now = Timestamp.now();
        const prUpdatePayload: any = {
          status,
          reviewedBy: reviewedBy ?? null,
          reviewedAt: now,
          updatedAt: now,
        };
        if (status === 'rejected') prUpdatePayload.rejectionReason = rejectionReason ?? null;

        if (status === 'approved') {
          const pr = { id: snap0.id, ...snap0.data() } as PaymentRequest;
          const category = pr.category === 'projects_activities' ? 'Projects & Activities' : 'Administrative';
          const projectId = pr.activityId || pr.activityRef || undefined;
          const year = new Date(pr.date || pr.createdAt).getFullYear();
          const description = pr.items?.length
            ? pr.items.map((i: any) => i.purpose).filter(Boolean).join(', ')
            : (pr.purpose || pr.referenceNumber);
          const txDate = pr.date || pr.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0];
          const transactionPayload = removeUndefined({
            date: Timestamp.fromDate(new Date(txDate)),
            description,
            referenceNumber: pr.referenceNumber,
            amount: pr.totalAmount || pr.amount,
            type: 'Expense',
            category,
            status: 'Pending',
            paymentRequestId: pr.id,
            projectId: projectId || (category === 'Administrative' ? 'Administrative' : undefined),
            bankAccountId: pr.claimFromBankAccountId || undefined,
            purpose: pr.purpose || undefined,
            year,
            source: 'manual',
            createdAt: now,
            updatedAt: now,
          });
          const batch = writeBatch(db);
          const txRef = doc(collection(db, COLLECTIONS.TRANSACTIONS));
          batch.set(txRef, transactionPayload);
          batch.update(ref, prUpdatePayload);
          await batch.commit();
        } else {
          await updateDoc(ref, prUpdatePayload);
          await this._deleteExpenseTransactionForPR(id);
        }

        // Notify applicant (AA)
        const snap2 = await getDoc(ref);
        if (snap2.exists()) {
          const pr = { id: snap2.id, ...snap2.data() } as PaymentRequest;
          await this._notifyApplicant(pr, status, rejectionReason);
        }
      }
    );
  }

  /**
   * Mark PR as paid when a bank transaction is matched to its expense transaction (情景 26).
   * paidAt is the bank transaction date.
   */
  static async markAsPaid(id: string, bankTxDate: string): Promise<void> {
    return withDevMode(
      () => {
        const idx = devPaymentRequests.findIndex((p) => p.id === id);
        if (idx >= 0) {
          const now = new Date().toISOString();
          devPaymentRequests = [...devPaymentRequests];
          devPaymentRequests[idx] = { ...devPaymentRequests[idx], status: 'paid', paidAt: bankTxDate, updatedAt: now };
        }
      },
      async () => {
        await updateDoc(doc(db, COLLECTIONS.PAYMENT_REQUESTS, id), {
          status: 'paid',
          paidAt: bankTxDate,
          updatedAt: Timestamp.now(),
        });
        // Notify applicant (AA)
        const snap = await getDoc(doc(db, COLLECTIONS.PAYMENT_REQUESTS, id));
        if (snap.exists()) {
          const pr = { id: snap.id, ...snap.data() } as PaymentRequest;
          await this._notifyApplicant(pr, 'paid');
        }
      }
    );
  }

  /**
   * Revert PR from 'paid' back to 'approved' when bank tx match is cancelled (情景 E).
   */
  static async revertPaid(id: string): Promise<void> {
    return withDevMode(
      () => {
        const idx = devPaymentRequests.findIndex((p) => p.id === id);
        if (idx >= 0) {
          devPaymentRequests = [...devPaymentRequests];
          devPaymentRequests[idx] = { ...devPaymentRequests[idx], status: 'approved', paidAt: null, updatedAt: new Date().toISOString() };
        }
      },
      async () => {
        await updateDoc(doc(db, COLLECTIONS.PAYMENT_REQUESTS, id), {
          status: 'approved',
          paidAt: null,
          updatedAt: Timestamp.now(),
        });
      }
    );
  }

  /**
   * Resubmit a rejected PR after edits (情景 H).
   * Resets status to 'submitted' and clears rejection data.
   */
  static async resubmit(id: string, updatedBy: string): Promise<void> {
    return withDevMode(
      async () => {
        const idx = devPaymentRequests.findIndex((p) => p.id === id);
        if (idx >= 0) {
          const now = new Date().toISOString();
          devPaymentRequests = [...devPaymentRequests];
          const pr = { ...devPaymentRequests[idx], status: 'submitted' as const, rejectionReason: null, reviewedBy: null, reviewedAt: null, updatedAt: now, updatedBy };
          devPaymentRequests[idx] = pr;
          // Notify approvers (NN)
          await this._notifyApprovers(pr);
        }
      },
      async () => {
        await updateDoc(doc(db, COLLECTIONS.PAYMENT_REQUESTS, id), {
          status: 'submitted',
          rejectionReason: null,
          reviewedBy: null,
          reviewedAt: null,
          updatedAt: Timestamp.now(),
          updatedBy,
        });
        const snap = await getDoc(doc(db, COLLECTIONS.PAYMENT_REQUESTS, id));
        if (snap.exists()) await this._notifyApprovers({ id: snap.id, ...snap.data() } as PaymentRequest);
      }
    );
  }

  // Auto-create a Pending expense transaction when a PR is approved.
  // Idempotent: skips if a transaction already references this PR.
  private static async _createExpenseTransaction(pr: PaymentRequest, approvedBy: string): Promise<void> {
    try {
      const category = pr.category === 'projects_activities' ? 'Projects & Activities' : 'Administrative';
      const projectId = pr.activityId || pr.activityRef || undefined;
      const year = new Date(pr.date || pr.createdAt).getFullYear();
      const description = pr.items?.length
        ? pr.items.map((i) => i.purpose).filter(Boolean).join(', ')
        : (pr.purpose || pr.referenceNumber);

      await FinanceService.createTransaction({
        date: pr.date || pr.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0],
        description,
        referenceNumber: pr.referenceNumber,
        amount: pr.totalAmount || pr.amount,
        type: 'Expense',
        category,
        status: 'Pending',
        paymentRequestId: pr.id,
        projectId: projectId || (category === 'Administrative' ? 'Administrative' : undefined),
        bankAccountId: pr.claimFromBankAccountId || undefined,
        purpose: pr.purpose || undefined,
        year,
        source: 'manual',
      } as any);
      // Clear failure flag on success
      await updateDoc(doc(db, COLLECTIONS.PAYMENT_REQUESTS, pr.id), { expenseTxFailed: false });
    } catch (err) {
      // Non-fatal: log but don't block the approval
      console.error('[PaymentRequestService] Failed to auto-create expense transaction for PR', pr.id, err);
      // Mark failure so UI can surface a retry button (情景 I)
      try {
        await updateDoc(doc(db, COLLECTIONS.PAYMENT_REQUESTS, pr.id), { expenseTxFailed: true });
      } catch { /* ignore */ }
    }
  }

  /** Retry creating expense transaction for an approved PR (情景 I) */
  static async retryCreateExpenseTransaction(prId: string, retriedBy: string): Promise<void> {
    return withDevMode(
      async () => { console.log(`[Dev Mode] Retrying expense tx creation for PR ${prId}`); },
      async () => {
        const snap = await getDoc(doc(db, COLLECTIONS.PAYMENT_REQUESTS, prId));
        if (!snap.exists()) throw new Error('Payment request not found');
        const pr = { id: snap.id, ...snap.data() } as PaymentRequest;
        if (pr.status !== 'approved') throw new Error('PR is not in approved status');

        // Idempotency: skip if a non-reconciled expense tx already exists for this PR.
        // Without this check a double-click creates two expense txs and doubles the outgoing amount.
        const existingQ = query(
          collection(db, COLLECTIONS.TRANSACTIONS),
          where('paymentRequestId', '==', prId),
          where('type', '==', 'Expense'),
          limit(1)
        );
        const existingSnap = await getDocs(existingQ);
        if (!existingSnap.empty) {
          await updateDoc(doc(db, COLLECTIONS.PAYMENT_REQUESTS, prId), { expenseTxFailed: false });
          return;
        }

        await this._createExpenseTransaction(pr, retriedBy);
      }
    );
  }

  static async update(id: string, updates: Partial<Pick<PaymentRequest, 'purpose' | 'amount' | 'totalAmount' | 'activityRef' | 'status' | 'items'>>, updatedBy?: string | null): Promise<void> {
    return withDevMode(
      () => {
        const idx = devPaymentRequests.findIndex((p) => p.id === id);
        if (idx >= 0) {
          const now = new Date().toISOString();
          devPaymentRequests = [...devPaymentRequests];
          devPaymentRequests[idx] = { ...devPaymentRequests[idx], ...updates, updatedAt: now, updatedBy: updatedBy ?? null };
        }
      },
      async () => {
        const payload = removeUndefined({
          ...updates,
          updatedAt: Timestamp.now(),
          updatedBy: updatedBy ?? null,
        });
        await updateDoc(doc(db, COLLECTIONS.PAYMENT_REQUESTS, id), payload);

        // If amount changed and PR is already approved, sync the linked expense transaction (情景 R)
        if ((updates.amount !== undefined || updates.totalAmount !== undefined)) {
          const snap = await getDoc(doc(db, COLLECTIONS.PAYMENT_REQUESTS, id));
          if (snap.exists()) {
            const pr = { id: snap.id, ...snap.data() } as PaymentRequest;
            if (pr.status === 'approved') {
              await this._syncExpenseTransactionAmount(pr);
            }
          }
        }
      }
    );
  }

  static async cancel(id: string, userId: string): Promise<void> {
    return withDevMode(
      async () => {
        const now = new Date().toISOString();
        const idx = devPaymentRequests.findIndex((p) => p.id === id);
        if (idx >= 0) {
          devPaymentRequests = [...devPaymentRequests];
          devPaymentRequests[idx] = { ...devPaymentRequests[idx], status: 'cancelled', updatedAt: now, updatedBy: userId };
        }
        // Delete linked expense transaction in dev mode (情景 G)
        await this._deleteExpenseTransactionForPR(id);
        // Notify applicant (AA)
        const pr = devPaymentRequests.find((p) => p.id === id);
        if (pr) await this._notifyApplicant(pr, 'cancelled');
      },
      async () => {
        // Attempt to delete linked expense transaction (情景 G).
        // Non-finance applicants lack the Firestore delete permission on transactions, so we
        // catch that error, still cancel the PR, and flag expenseTxFailed so finance can clean up.
        let expenseTxCleanupFailed = false;
        try {
          await this._deleteExpenseTransactionForPR(id);
        } catch (err) {
          console.warn('[PaymentRequestService.cancel] Could not delete expense tx (permission denied?)', err);
          expenseTxCleanupFailed = true;
        }

        await updateDoc(doc(db, COLLECTIONS.PAYMENT_REQUESTS, id), {
          status: 'cancelled',
          updatedAt: Timestamp.now(),
          updatedBy: userId,
          ...(expenseTxCleanupFailed ? { expenseTxFailed: true } : {}),
        });
        // Notify applicant (AA)
        const snap = await getDoc(doc(db, COLLECTIONS.PAYMENT_REQUESTS, id));
        if (snap.exists()) await this._notifyApplicant({ id: snap.id, ...snap.data() } as PaymentRequest, 'cancelled');
      }
    );
  }

  /** Hard-delete a PR (dev role only). Also removes any linked expense transaction. */
  static async deletePR(id: string): Promise<void> {
    return withDevMode(
      async () => {
        await this._deleteExpenseTransactionForPR(id);
        devPaymentRequests = devPaymentRequests.filter(p => p.id !== id);
      },
      async () => {
        const linkedQ = query(
          collection(db, COLLECTIONS.TRANSACTIONS),
          where('paymentRequestId', '==', id),
          where('type', '==', 'Expense')
        );
        const linkedSnap = await getDocs(linkedQ);
        const batch = writeBatch(db);
        for (const txDoc of linkedSnap.docs) {
          const tx = txDoc.data() as import('../types').Transaction;
          if (tx.status === 'Reconciled' || tx.status === 'Partially Reconciled') {
            console.warn(`[PaymentRequestService] Skipping delete of reconciled transaction ${txDoc.id} linked to PR ${id} — reconcile must be reversed manually first`);
            continue;
          }
          batch.delete(txDoc.ref);
        }
        batch.delete(doc(db, COLLECTIONS.PAYMENT_REQUESTS, id));
        await batch.commit();
      }
    );
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /**
   * Delete any expense transaction linked to this PR (情景 G, 23).
   * Transactions already Reconciled / Partially Reconciled are left alone —
   * deleting them would silently break a completed bank reconciliation with
   * no audit trail. Those must be voided manually by finance instead.
   */
  private static async _deleteExpenseTransactionForPR(prId: string): Promise<void> {
    try {
      // Targeted query instead of full-table scan so this stays fast as data grows.
      const q = query(
        collection(db, COLLECTIONS.TRANSACTIONS),
        where('paymentRequestId', '==', prId),
        where('type', '==', 'Expense')
      );
      const snap = await getDocs(q);
      const linked = snap.docs.map(d => ({ id: d.id, ...d.data() } as import('../types').Transaction));
      for (const tx of linked) {
        if (tx.status === 'Reconciled' || tx.status === 'Partially Reconciled') {
          console.warn(`[PaymentRequestService] Skipping delete of reconciled transaction ${tx.id} linked to PR ${prId} — reconcile must be reversed manually first`);
          continue;
        }
        await FinanceService.deleteTransaction(tx.id);
      }
    } catch (err) {
      console.error('[PaymentRequestService] Failed to delete expense transaction for PR', prId, err);
    }
  }

  /** Update amount on the expense transaction linked to this PR (情景 R) */
  private static async _syncExpenseTransactionAmount(pr: PaymentRequest): Promise<void> {
    try {
      const q = query(
        collection(db, COLLECTIONS.TRANSACTIONS),
        where('paymentRequestId', '==', pr.id),
        where('type', '==', 'Expense')
      );
      const snap = await getDocs(q);
      const linked = snap.docs.map(d => ({ id: d.id, ...d.data() } as import('../types').Transaction));
      for (const tx of linked) {
        await FinanceService.updateTransaction(tx.id, { amount: pr.totalAmount || pr.amount });
      }
    } catch (err) {
      console.error('[PaymentRequestService] Failed to sync expense transaction amount for PR', pr.id, err);
      // Surface the failure so finance knows the PR amount and the expense tx are now out of sync.
      try {
        await updateDoc(doc(db, COLLECTIONS.PAYMENT_REQUESTS, pr.id), { amountSyncFailed: true });
      } catch { /* ignore */ }
    }
  }

  /** Write in-app notification to a member (情景 AA) */
  private static async _writeNotification(memberId: string, title: string, message: string): Promise<void> {
    try {
      await import('firebase/firestore').then(async ({ collection: col, addDoc: add, Timestamp: Ts }) => {
        await add(col(db, COLLECTIONS.NOTIFICATIONS), {
          memberId,
          title,
          message,
          type: 'info',
          read: false,
          timestamp: Ts.now(),
        });
      });
    } catch (err) {
      console.warn('[PaymentRequestService] Failed to write notification', err);
    }
  }

  /** Notify PR applicant of status change (情景 AA) */
  private static async _notifyApplicant(pr: PaymentRequest, status: string, rejectionReason?: string): Promise<void> {
    if (!pr.applicantId) return;
    const statusLabel: Record<string, string> = {
      approved: 'Approved',
      rejected: 'Rejected',
      cancelled: 'Cancelled',
      paid: 'Paid',
    };
    const label = statusLabel[status] ?? status;
    const message = status === 'rejected' && rejectionReason
      ? `Your payment request ${pr.referenceNumber} has been ${label}. Reason: ${rejectionReason}`
      : `Your payment request ${pr.referenceNumber} has been ${label}.`;
    await this._writeNotification(pr.applicantId, `Payment Request ${label}`, message);
  }

  /** Notify authorised approvers of a new/resubmitted PR (情景 NN) */
  private static async _notifyApprovers(pr: PaymentRequest): Promise<void> {
    try {
      const { MembersService } = await import('./membersService');
      const members = await MembersService.getAllMembers();
      const approvers = members.filter(m =>
        m.currentBoardPosition && APPROVER_BOARD_TITLES.some(t => (m.currentBoardPosition ?? '').includes(t))
      );
      for (const approver of approvers) {
        await this._writeNotification(
          approver.id,
          'New Payment Request',
          `${pr.applicantName ?? 'A member'} submitted payment request ${pr.referenceNumber} for review.`
        );
      }
    } catch (err) {
      console.warn('[PaymentRequestService] Failed to notify approvers', err);
    }
  }
}
