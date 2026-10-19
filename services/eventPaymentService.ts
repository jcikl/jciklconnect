// Event payment (mark-paid) — creates the finance income record, then flips the registration to 'paid'.
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS, DEFAULT_LO_ID } from '../config/constants';
import type { Event, EventRegistration } from '../types';
import { FinanceService } from './financeService';
import { EventRegistrationService } from './eventRegistrationService';
import { errorLoggingService } from './errorLoggingService';

export class EventPaymentService {
  /**
   * Bank account an event's income goes into: the project's `financialAccountId` when it is a real
   * bank account of this LO, else the LO's first MYR account, else its first account.
   */
  static async resolveBankAccountId(eventId: string): Promise<string> {
    const accounts = await FinanceService.getAllBankAccounts(false, DEFAULT_LO_ID);
    let preferred: string | undefined;
    try {
      const snap = await getDoc(doc(db, COLLECTIONS.PROJECTS, eventId));
      const v = snap.exists() ? (snap.data() as { financialAccountId?: unknown }).financialAccountId : undefined;
      if (typeof v === 'string' && v) preferred = v;
    } catch { /* fall back to the default account */ }
    const chosen =
      accounts.find(a => a.id === preferred) ??
      accounts.find(a => (a.currency ?? 'MYR') === 'MYR') ??
      accounts[0];
    if (!chosen) throw new Error('No bank account is configured for finance records. Add one in Finance first.');
    return chosen.id;
  }

  /**
   * Mark a registration paid. The transaction records MYR; for a USD (external) registration the price the
   * payer saw is kept as originalAmount / originalCurrency. `options.amount` is the MYR finance confirmed
   * (defaults to the listed price, `price || priceMin`); an amount of 0 skips the transaction. If the registration update fails, the
   * transaction is removed again so no orphan income record is left.
   */
  static async markRegistrationPaid(
    reg: EventRegistration,
    event: Pick<Event, 'id' | 'title' | 'price' | 'priceMin'>,
    options: { paymentMethod: 'bank_transfer' | 'cash'; actorName: string; amount?: number }
  ): Promise<{ paidAt: string; financeTransactionId?: string }> {
    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const price = event.price || event.priceMin || 0;
    const isUsd = reg.currency === 'USD';
    const amount = options.amount ?? price;

    let financeTransactionId: string | undefined;
    try {
      if (amount > 0) {
        const bankAccountId = await this.resolveBankAccountId(event.id);
        financeTransactionId = await FinanceService.createTransaction({
          loId: DEFAULT_LO_ID,
          type: 'Income',
          category: 'Projects & Activities',
          status: 'Pending',
          paymentMethod: options.paymentMethod,
          bankAccountId,
          projectId: event.id,
          memberId: reg.memberId,
          eventRegistrationId: reg.id,
          amount,
          ...(isUsd ? { originalAmount: price || amount, originalCurrency: 'USD' as const } : {}),
          description: `Event ticket — ${event.title ?? reg.eventId}`,
          date: today,
          source: 'manual',
        } as Parameters<typeof FinanceService.createTransaction>[0]);
      }
      try {
        await EventRegistrationService.updateStatus(reg.id, 'paid', {
          paidAt: now,
          paidByName: options.actorName,
          paymentMethod: options.paymentMethod,
          ...(financeTransactionId ? { financeTransactionId } : {}),
        });
      } catch (statusErr) {
        if (financeTransactionId) await FinanceService.deleteTransaction(financeTransactionId).catch(() => {});
        throw statusErr;
      }
    } catch (error) {
      errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), {
        component: 'EventPaymentService', action: 'markRegistrationPaid', additionalData: { registrationId: reg.id },
      });
      throw error;
    }
    return { paidAt: now, financeTransactionId };
  }
}
