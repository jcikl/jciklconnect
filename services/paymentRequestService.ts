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
  runTransaction,
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
import { PaymentRequest, PaymentRequestStatus, Transaction } from '../types';
import { removeUndefined } from '../utils/dataUtils';
import { withDevMode } from '../utils/devMode';
import { MOCK_PAYMENT_REQUESTS } from './mockData';
import { FinanceService, invalidateFinanceCache } from './financeService';
import { projectFinancialService } from './projectFinancialService';
import { errorLoggingService } from './errorLoggingService';

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
  // TODO: replace snapshot.size with atomic counter for production safety
  static async generateReferenceNumber(loId: string): Promise<string> {
    return withDevMode(
      () => {
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const sameDay = devPaymentRequests.filter((p) => p.referenceNumber.startsWith(`${REFERENCE_NUMBER_PREFIX}-${loId}-${today}`));
        const seq = sameDay.length + 1;
        return `${REFERENCE_NUMBER_PREFIX}-${loId}-${today}-${String(seq).padStart(3, '0')}`;
      },
      async () => {
    // Fix 4: use an atomic counter document to avoid race conditions when two PRs
    // are created simultaneously on the same day.
    const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const today = dateStr.replace(/-/g, '');
    const counterRef = doc(db, 'counters', `pr_${loId}_${dateStr}`);
    let seq = 1;
    await runTransaction(db, async (txn) => {
      const counterSnap = await txn.get(counterRef);
      if (counterSnap.exists()) {
        seq = (counterSnap.data().value as number) + 1;
      }
      txn.set(counterRef, { value: seq });
    });
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
    // VAL-02: amount must be a positive finite number
    if (!Number.isFinite(data.amount) || data.amount <= 0) throw new Error('Payment request amount must be a positive number');
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
    invalidateFinanceCache();
    // Notify approvers if submitted immediately (情景 NN)
    if ((data.status ?? 'submitted') === 'submitted') {
      await this._notifyApprovers({ applicantName: payload.applicantName, referenceNumber });
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
        // RC-002: Preliminary read used for budget check only.  The actual
        // status-check + write is wrapped in runTransaction below so two
        // simultaneous Approve clicks cannot both commit (double-approval race).
        const snap0 = await getDoc(ref);
        if (!snap0.exists()) throw new Error('Payment request not found');

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

          // BUD-001: guard against overspending a project budget before writing anything.
          if (projectId) {
            const projectDoc = await projectFinancialService.getProjectFinancialAccount(projectId).catch(() => null);
            if (projectDoc && typeof projectDoc.budget === 'number' && projectDoc.budget > 0) {
              const currentExpenses = typeof projectDoc.totalExpenses === 'number'
                ? projectDoc.totalExpenses
                : 0;
              const prAmount = pr.totalAmount ?? pr.amount ?? 0;
              if (currentExpenses + prAmount > projectDoc.budget) {
                throw new Error(
                  `Approving this payment request (RM ${prAmount.toFixed(2)}) would exceed the project budget. ` +
                  `Budget: RM ${projectDoc.budget.toFixed(2)}, spent so far: RM ${currentExpenses.toFixed(2)}.`
                );
              }
            }
          }

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
          const txRef = doc(collection(db, COLLECTIONS.TRANSACTIONS));
          // RC-002: atomic guard — second approver sees updated status and throws.
          await runTransaction(db, async (txn) => {
            const freshSnap = await txn.get(ref);
            if (!freshSnap.exists()) throw new Error('Payment request not found');
            const currentStatus = (freshSnap.data() as PaymentRequest).status;
            if (currentStatus !== 'submitted') {
              throw new Error(`Cannot ${status} a payment request with status "${currentStatus}" — only submitted requests can be approved or rejected.`);
            }
            txn.set(txRef, transactionPayload);
            txn.update(ref, prUpdatePayload);
          });
          invalidateFinanceCache();

          // BIZ-003: Sync project financial account balance if this PR is tied to a project.
          // Production: projectFinancialService derives totals dynamically from Firestore, so
          // this is a no-op there — the expense transaction written above is already the source.
          // Dev mode: the in-memory account balance must be updated explicitly.
          if (projectId) {
            try {
              await projectFinancialService.addTransaction(projectId, {
                type: 'expense',
                amount: pr.totalAmount ?? pr.amount ?? 0,
                description: description || pr.referenceNumber,
                transactionId: txRef.id,
                date: new Date(),
              });
            } catch (syncError) {
              // Do not roll back the PR approval — log and flag for manual sync.
              errorLoggingService.logError(
                syncError instanceof Error ? syncError : new Error(String(syncError)),
                { component: 'paymentRequestService', action: 'approveRequest.projectSync' }
              );
              // Mark the PR so the UI can surface a retry banner.
              await updateDoc(doc(db, COLLECTIONS.PAYMENT_REQUESTS, id), { projectBudgetSyncFailed: true }).catch(() => {});
            }
          }
        } else {
          // E-5: query linked expense txs first, then batch status update + deletions atomically
          const linkedQ = query(
            collection(db, COLLECTIONS.TRANSACTIONS),
            where('paymentRequestId', '==', id),
            where('type', '==', 'Expense')
          );
          const linkedSnap = await getDocs(linkedQ);
          const batch = writeBatch(db);
          batch.update(ref, prUpdatePayload);
          for (const txDoc of linkedSnap.docs) {
            const tx = txDoc.data() as import('../types').Transaction;
            if (tx.status === 'Reconciled' || tx.status === 'Partially Reconciled') {
              console.warn(`[PaymentRequestService] Skipping delete of reconciled transaction ${txDoc.id} linked to PR ${id} — reconcile must be reversed manually first`);
              continue;
            }
            batch.delete(txDoc.ref);
          }
          await batch.commit();
          invalidateFinanceCache();
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
        // Fix 1: wrap status check + update in runTransaction so concurrent webhook
        // callbacks can't both mark the same PR as paid.
        const prRef = doc(db, COLLECTIONS.PAYMENT_REQUESTS, id);
        await runTransaction(db, async (txn) => {
          const prSnap = await txn.get(prRef);
          if (!prSnap.exists()) throw new Error('Payment request not found');
          if ((prSnap.data() as PaymentRequest).status !== 'approved') {
            throw new Error('只有 approved 状态的付款申请可以标记为已付款');
          }
          txn.update(prRef, {
            status: 'paid',
            paidAt: bankTxDate,
            updatedAt: Timestamp.now(),
          });
        });
        invalidateFinanceCache();
        // Notify applicant (AA)
        const snap = await getDoc(prRef);
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
        // Fix 2: wrap status check + update in runTransaction to prevent reverting
        // a PR that was never paid.
        const prRef2 = doc(db, COLLECTIONS.PAYMENT_REQUESTS, id);
        await runTransaction(db, async (txn) => {
          const prSnap = await txn.get(prRef2);
          if (!prSnap.exists()) throw new Error('Payment request not found');
          if ((prSnap.data() as PaymentRequest).status !== 'paid') {
            throw new Error('只有 paid 状态的付款申请可以撤销为 approved');
          }
          txn.update(prRef2, {
            status: 'approved',
            paidAt: null,
            updatedAt: Timestamp.now(),
          });
        });
        invalidateFinanceCache();
        // E6: notify applicant that the confirmed payment was reversed so they are not left in the dark.
        const snap = await getDoc(doc(db, COLLECTIONS.PAYMENT_REQUESTS, id));
        if (snap.exists()) {
          const pr = { id: snap.id, ...snap.data() } as PaymentRequest;
          if (pr.applicantId) {
            await this._writeNotification(
              pr.applicantId,
              'Payment Reversed',
              `Your payment request ${pr.referenceNumber} payment has been reversed — please contact the treasurer.`
            );
          }
        }
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
        if (idx < 0) throw new Error('Payment request not found');
        // E7: only rejected PRs may be resubmitted.
        if (devPaymentRequests[idx].status !== 'rejected') {
          throw new Error('Only rejected payment requests can be resubmitted');
        }
        const now = new Date().toISOString();
        devPaymentRequests = [...devPaymentRequests];
        const pr = { ...devPaymentRequests[idx], status: 'submitted' as const, rejectionReason: null, reviewedBy: null, reviewedAt: null, updatedAt: now, updatedBy };
        devPaymentRequests[idx] = pr;
        // Notify approvers (NN)
        await this._notifyApprovers(pr);
      },
      async () => {
        // P1-fix: use runTransaction so the status check and the update are atomic.
        const ref = doc(db, COLLECTIONS.PAYMENT_REQUESTS, id);
        await runTransaction(db, async (tx) => {
          const snap0 = await tx.get(ref);
          if (!snap0.exists()) throw new Error('Payment request not found');
          if ((snap0.data() as PaymentRequest).status !== 'rejected') {
            throw new Error('Only rejected payment requests can be resubmitted');
          }
          tx.update(ref, {
            status: 'submitted',
            rejectionReason: null,
            reviewedBy: null,
            reviewedAt: null,
            updatedAt: Timestamp.now(),
            updatedBy,
          });
        });
        invalidateFinanceCache();
        const snap = await getDoc(ref);
        if (snap.exists()) await this._notifyApprovers({ id: snap.id, ...snap.data() } as PaymentRequest);
      }
    );
  }

  // Auto-create a Pending expense transaction when a PR is approved.
  // Idempotent: skips if a transaction already references this PR.
  private static async _createExpenseTransaction(pr: PaymentRequest, approvedBy: string): Promise<void> {
    try {
      // Fix 5: dev-mode idempotency — skip if an expense tx for this PR already exists.
      const existingQ = query(
        collection(db, COLLECTIONS.TRANSACTIONS),
        where('paymentRequestId', '==', pr.id),
        where('type', '==', 'Expense'),
        limit(1)
      );
      const existingSnap = await getDocs(existingQ);
      if (!existingSnap.empty) return;

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
      } as Omit<Transaction, 'id'>);
      // Clear failure flag on success
      await updateDoc(doc(db, COLLECTIONS.PAYMENT_REQUESTS, pr.id), { expenseTxFailed: false });
    } catch (err) {
      // Non-fatal: log but don't block the approval
      console.error('[PaymentRequestService] Failed to auto-create expense transaction for PR', pr.id, err);
      errorLoggingService.logError(err instanceof Error ? err : new Error(String(err)), { component: 'paymentRequestService', action: '_autoCreateExpenseTransactionForPR' });
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

  static async update(id: string, updates: Partial<Pick<PaymentRequest, 'purpose' | 'amount' | 'totalAmount' | 'activityRef' | 'items'>>, updatedBy?: string | null): Promise<void> {
    return withDevMode(
      () => {
        const idx = devPaymentRequests.findIndex((p) => p.id === id);
        if (idx >= 0) {
          const now = new Date().toISOString();
          devPaymentRequests = [...devPaymentRequests];
          // E-8: exclude status — only dedicated methods may change status
          const { status: _status, ...safeUpdates } = updates as any;
          devPaymentRequests[idx] = { ...devPaymentRequests[idx], ...safeUpdates, updatedAt: now, updatedBy: updatedBy ?? null };
        }
      },
      async () => {
        // E-8: strip status so callers cannot bypass the dedicated status-transition methods
        const { status: _status, ...safeUpdates } = updates as any;
        const payload = removeUndefined({
          ...safeUpdates,
          updatedAt: Timestamp.now(),
          updatedBy: updatedBy ?? null,
        });

        // E5: if amount changed and PR is approved, merge PR update + expense tx amount update
        // into a single writeBatch so both sides stay in sync even if the process crashes between them.
        const amountChanged = updates.amount !== undefined || updates.totalAmount !== undefined;
        if (amountChanged) {
          const snap = await getDoc(doc(db, COLLECTIONS.PAYMENT_REQUESTS, id));
          if (snap.exists()) {
            const pr = { id: snap.id, ...snap.data() } as PaymentRequest;
            if (pr.status === 'approved') {
              const linkedQ = query(
                collection(db, COLLECTIONS.TRANSACTIONS),
                where('paymentRequestId', '==', id),
                where('type', '==', 'Expense')
              );
              const linkedSnap = await getDocs(linkedQ);
              if (!linkedSnap.empty) {
                const newAmount = (updates.totalAmount ?? updates.amount) as number;
                const batch = writeBatch(db);
                batch.update(doc(db, COLLECTIONS.PAYMENT_REQUESTS, id), payload);
                for (const txDoc of linkedSnap.docs) {
                  batch.update(txDoc.ref, { amount: newAmount, updatedAt: Timestamp.now() });
                }
                await batch.commit();
                invalidateFinanceCache();
                return;
              }
            }
          }
        }

        // Default path: no linked expense tx to sync, just update the PR.
        await updateDoc(doc(db, COLLECTIONS.PAYMENT_REQUESTS, id), payload);
        invalidateFinanceCache();
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
        // Fix 3: validate status before cancelling — only submitted/approved PRs can be cancelled.
        const prRef = doc(db, COLLECTIONS.PAYMENT_REQUESTS, id);
        await runTransaction(db, async (txn) => {
          const prSnap = await txn.get(prRef);
          if (!prSnap.exists()) throw new Error('Payment request not found');
          const currentStatus = (prSnap.data() as PaymentRequest).status;
          if (currentStatus !== 'submitted' && currentStatus !== 'approved') {
            throw new Error(`Cannot cancel a payment request with status "${currentStatus}" — only submitted or approved requests can be cancelled.`);
          }
          txn.update(prRef, {
            status: 'cancelled',
            updatedAt: Timestamp.now(),
            updatedBy: userId,
          });
        });

        // After status update succeeds, delete linked expense transactions atomically.
        const expenseQ = query(
          collection(db, COLLECTIONS.TRANSACTIONS),
          where('paymentRequestId', '==', id),
          where('type', '==', 'Expense')
        );
        const expenseSnap = await getDocs(expenseQ);

        const batch = writeBatch(db);
        for (const txDoc of expenseSnap.docs) {
          const tx = txDoc.data() as Transaction;
          if (tx.status !== 'Reconciled' && tx.status !== 'Partially Reconciled') {
            batch.delete(txDoc.ref);
          } else {
            console.warn('[PaymentRequestService.cancel] Skipping delete of reconciled expense tx', txDoc.id, '— must be voided manually');
          }
        }
        await batch.commit();
        invalidateFinanceCache();

        // Notify applicant (AA)
        const snap = await getDoc(prRef);
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
      // E-6: collect eligible refs then delete in one writeBatch instead of individual calls
      const batch = writeBatch(db);
      let hasDeletes = false;
      for (const txDoc of snap.docs) {
        const tx = txDoc.data() as import('../types').Transaction;
        if (tx.status === 'Reconciled' || tx.status === 'Partially Reconciled') {
          console.warn(`[PaymentRequestService] Skipping delete of reconciled transaction ${txDoc.id} linked to PR ${prId} — reconcile must be reversed manually first`);
          continue;
        }
        batch.delete(txDoc.ref);
        hasDeletes = true;
      }
      if (hasDeletes) {
        await batch.commit();
        invalidateFinanceCache();
      }
    } catch (err) {
      console.error('[PaymentRequestService] Failed to delete expense transaction for PR', prId, err);
      errorLoggingService.logError(err instanceof Error ? err : new Error(String(err)), { component: 'paymentRequestService', action: '_deleteExpenseTransactionForPR' });
    }
  }

  /** Write in-app notification to a member (情景 AA) */
  private static async _writeNotification(memberId: string, title: string, message: string, type = 'info'): Promise<void> {
    try {
      await import('firebase/firestore').then(async ({ collection: col, addDoc: add, Timestamp: Ts }) => {
        await add(col(db, COLLECTIONS.NOTIFICATIONS), {
          memberId,
          title,
          message,
          type,
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
  private static async _notifyApprovers(pr: Pick<PaymentRequest, 'applicantName' | 'referenceNumber'>): Promise<void> {
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
