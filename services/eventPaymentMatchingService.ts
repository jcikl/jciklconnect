/**
 * EventPaymentMatchingService
 *
 * Matches event registration income transactions (Pending) to imported bank transactions.
 *
 * Three matching paths:
 *   A — ToyyibPay exact:    income.referenceNumber (billExternalReferenceNo) found in bankTx.description
 *   B — Bank transfer fuzzy: same amount ± tolerance, date within 7 days, same projectId
 *   C — Cash:               N/A (cash is deposited and merged; handled by finance admin splitting the bank tx)
 *
 * N:1 cardinality: multiple income txs can link to one bank tx (N members paid,
 * bank received one merged entry). The bank tx matchedBankAmount tracks how much
 * has been allocated.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import type { Transaction } from '../types';

export interface EventMatchResult {
  incomeTxId: string;
  bankTxId: string;
  path: 'A' | 'B' | 'C';
  confidence: 'high' | 'medium' | 'low';
}

export interface EventMatchSummary {
  matched: EventMatchResult[];
  unmatched: string[];
  errors: string[];
}

const DATE_TOLERANCE_DAYS = 7;
const AMOUNT_TOLERANCE = 0.01;

function parseDateStr(d: string): Date {
  return new Date(d);
}

function daysDiff(a: string, b: string): number {
  return Math.abs(parseDateStr(a).getTime() - parseDateStr(b).getTime()) / 86_400_000;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s\-_]/g, '');
}

function descriptionContains(description: string, ref: string): boolean {
  if (!description || !ref) return false;
  // Exact substring first
  if (description.toLowerCase().includes(ref.toLowerCase())) return true;
  // Normalized (strip spaces/dashes) — handles "FPX12345" vs "FPX 12345" or "FPX-12345"
  const normDesc = normalize(description);
  const normRef = normalize(ref);
  return normRef.length >= 6 && normDesc.includes(normRef);
}

export class EventPaymentMatchingService {
  /**
   * Run auto-matching for all unmatched event income transactions.
   * Call this after a batch bank import, or on-demand from admin UI.
   */
  static async runAutoMatch(bankAccountId?: string): Promise<EventMatchSummary> {
    const summary: EventMatchSummary = { matched: [], unmatched: [], errors: [] };

    // Fetch Pending event income transactions (those with eventRegistrationId set)
    const incomeQuery = query(
      collection(db, COLLECTIONS.TRANSACTIONS),
      where('type', '==', 'Income'),
      where('status', '==', 'Pending'),
    );

    // Fetch bank-imported transactions (unmatched or partially matched)
    const bankQuery = query(
      collection(db, COLLECTIONS.TRANSACTIONS),
      where('source', '==', 'bank_import'),
      ...(bankAccountId ? [where('bankAccountId', '==', bankAccountId)] : []),
    );

    const [incomeSnap, bankSnap] = await Promise.all([getDocs(incomeQuery), getDocs(bankQuery)]);

    const incomeTxs = incomeSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Transaction, 'id'>) }))
      .filter((t) => t.eventRegistrationId); // only event-linked ones

    const bankTxs = bankSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Transaction, 'id'>) }));

    // Track how much of each bank tx has been allocated this run
    const bankAllocated = new Map<string, number>();
    bankTxs.forEach((b) => {
      bankAllocated.set(b.id, b.matchedBankAmount ?? 0);
    });

    for (const income of incomeTxs) {
      if (income.matchStatus === 'full') continue;

      const result = EventPaymentMatchingService._findBestBankTx(income, bankTxs, bankAllocated);
      if (!result) {
        summary.unmatched.push(income.id);
        continue;
      }

      try {
        await EventPaymentMatchingService.applyMatch(income.id, result.bankTxId, result.path);
        summary.matched.push(result);
        const prev = bankAllocated.get(result.bankTxId) ?? 0;
        bankAllocated.set(result.bankTxId, prev + Math.abs(income.amount));
      } catch (e) {
        summary.errors.push(`${income.id}: ${String(e)}`);
      }
    }

    return summary;
  }

  /**
   * Try to match a single income transaction to an available bank tx.
   * Call after a new bank tx is imported to check if it resolves any pending income txs.
   */
  static async matchIncomeTx(incomeTxId: string, bankTxs: Transaction[]): Promise<EventMatchResult | null> {
    const snap = await getDoc(doc(db, COLLECTIONS.TRANSACTIONS, incomeTxId));
    if (!snap.exists()) return null;
    const income = { id: snap.id, ...(snap.data() as Omit<Transaction, 'id'>) };

    const bankAllocated = new Map<string, number>();
    bankTxs.forEach((b) => bankAllocated.set(b.id, b.matchedBankAmount ?? 0));

    const result = EventPaymentMatchingService._findBestBankTx(income, bankTxs, bankAllocated);
    if (!result) return null;

    await EventPaymentMatchingService.applyMatch(income.id, result.bankTxId, result.path);
    return result;
  }

  /** Apply a confirmed match between an income tx and a bank tx. */
  static async applyMatch(incomeTxId: string, bankTxId: string, _path: 'A' | 'B' | 'C' = 'B'): Promise<void> {
    const batch = writeBatch(db);

    const incomeRef = doc(db, COLLECTIONS.TRANSACTIONS, incomeTxId);
    const bankRef = doc(db, COLLECTIONS.TRANSACTIONS, bankTxId);

    // Get current docs to calculate new allocation
    const [bankSnap, incomeSnap] = await Promise.all([
      getDoc(bankRef),
      getDoc(incomeRef),
    ]);
    const bankData = bankSnap.exists() ? (bankSnap.data() as Transaction) : null;
    const incomeData = incomeSnap.exists() ? (incomeSnap.data() as Transaction) : null;

    const newAllocated = (bankData?.matchedBankAmount ?? 0) + Math.abs(incomeData?.amount ?? 0);
    const bankTotal = Math.abs(bankData?.amount ?? 0);
    const bankMatchStatus: Transaction['matchStatus'] =
      newAllocated >= bankTotal - AMOUNT_TOLERANCE ? 'full' : 'partial';

    // Update income tx → Cleared; record prevStatus so removeMatch can restore exactly
    batch.update(incomeRef, {
      matchStatus: 'full',
      matchedBankTxIds: [...(incomeData?.matchedBankTxIds ?? []), bankTxId],
      status: 'Cleared',
      prevStatus: incomeData?.status ?? 'Pending',
      updatedAt: Timestamp.now(),
    });

    // Update bank tx allocation
    const existingProjectTxIds: string[] = (bankData as any)?.projectTransactionIds ?? [];
    batch.update(bankRef, {
      matchedBankAmount: newAllocated,
      matchStatus: bankMatchStatus,
      projectTransactionIds: [...existingProjectTxIds, incomeTxId],
      updatedAt: Timestamp.now(),
    });

    await batch.commit();
  }

  /**
   * Remove a previously applied N:1 match.
   * Restores the income tx to its pre-match status (via prevStatus) and
   * decreases the bank tx's matchedBankAmount by the income amount.
   */
  static async removeMatch(incomeTxId: string, bankTxId: string): Promise<void> {
    const batch = writeBatch(db);

    const incomeRef = doc(db, COLLECTIONS.TRANSACTIONS, incomeTxId);
    const bankRef = doc(db, COLLECTIONS.TRANSACTIONS, bankTxId);

    const [incomeSnap, bankSnap] = await Promise.all([getDoc(incomeRef), getDoc(bankRef)]);
    const incomeData = incomeSnap.exists() ? (incomeSnap.data() as Transaction) : null;
    const bankData = bankSnap.exists() ? (bankSnap.data() as Transaction) : null;

    if (!incomeData || !bankData) throw new Error('Transaction not found');

    // Restore income tx
    const newIncomeBankTxIds = (incomeData.matchedBankTxIds ?? []).filter((id) => id !== bankTxId);
    batch.update(incomeRef, {
      matchStatus: newIncomeBankTxIds.length > 0 ? 'partial' : null,
      matchedBankTxIds: newIncomeBankTxIds.length > 0 ? newIncomeBankTxIds : null,
      status: incomeData.prevStatus ?? 'Pending',
      prevStatus: null,
      updatedAt: Timestamp.now(),
    });

    // Reduce bank tx allocation
    const removedAmount = Math.abs(incomeData.amount ?? 0);
    const newAllocated = Math.max(0, (bankData.matchedBankAmount ?? 0) - removedAmount);
    const bankTotal = Math.abs(bankData.amount ?? 0);
    const newBankMatchStatus: Transaction['matchStatus'] =
      newAllocated <= AMOUNT_TOLERANCE ? 'unmatched' :
      newAllocated >= bankTotal - AMOUNT_TOLERANCE ? 'full' : 'partial';
    const newProjectTxIds = (bankData.projectTransactionIds ?? []).filter((id) => id !== incomeTxId);

    batch.update(bankRef, {
      matchedBankAmount: newAllocated,
      matchStatus: newAllocated <= AMOUNT_TOLERANCE ? null : newBankMatchStatus,
      projectTransactionIds: newProjectTxIds.length > 0 ? newProjectTxIds : null,
      updatedAt: Timestamp.now(),
    });

    await batch.commit();
  }

  private static _findBestBankTx(
    income: Transaction,
    bankTxs: Transaction[],
    bankAllocated: Map<string, number>,
  ): EventMatchResult | null {
    const ref = income.referenceNumber;

    // Path A — ToyyibPay: match via billExternalReferenceNo or toyyibBillCode in bank description.
    // Tries both identifiers and both normalized and raw forms to handle bank formatting variations.
    if (income.paymentMethod === 'toyyib') {
      const candidates = ref ? [ref] : [];
      if (income.toyyibBillCode && income.toyyibBillCode !== ref) candidates.push(income.toyyibBillCode);
      if (candidates.length > 0) {
        const match = bankTxs.find((b) => {
          const remaining = Math.abs(b.amount) - (bankAllocated.get(b.id) ?? 0);
          if (remaining < Math.abs(income.amount) - AMOUNT_TOLERANCE) return false;
          return candidates.some(c => descriptionContains(b.description ?? '', c));
        });
        if (match) {
          return { incomeTxId: income.id, bankTxId: match.id, path: 'A', confidence: 'high' };
        }
      }
    }

    // Path B — Bank transfer / cash fuzzy: same amount, date within 7 days, same projectId (if set)
    if (income.paymentMethod === 'bank_transfer' || income.paymentMethod === 'cash') {
      const candidates = bankTxs
        .filter((b) => {
          const remaining = Math.abs(b.amount) - (bankAllocated.get(b.id) ?? 0);
          const amountOk = remaining >= Math.abs(income.amount) - AMOUNT_TOLERANCE;
          const dateOk = income.date && b.date ? daysDiff(income.date, b.date) <= DATE_TOLERANCE_DAYS : false;
          const projectOk = !income.projectId || !b.projectId || income.projectId === b.projectId;
          return amountOk && dateOk && projectOk;
        })
        .sort((a, b) => {
          // Prefer same projectId, then closest date
          const aProject = a.projectId === income.projectId ? 0 : 1;
          const bProject = b.projectId === income.projectId ? 0 : 1;
          if (aProject !== bProject) return aProject - bProject;
          const aDays = income.date && a.date ? daysDiff(income.date, a.date) : 99;
          const bDays = income.date && b.date ? daysDiff(income.date, b.date) : 99;
          return aDays - bDays;
        });

      if (candidates.length > 0) {
        const confidence = candidates[0].projectId === income.projectId ? 'medium' : 'low';
        return { incomeTxId: income.id, bankTxId: candidates[0].id, path: 'B', confidence };
      }
    }

    return null;
  }
}
