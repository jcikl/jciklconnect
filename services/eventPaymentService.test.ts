import { describe, it, expect, vi, beforeEach } from 'vitest';

const createTransaction = vi.fn(async (_t: Record<string, unknown>) => 'tx1');
const deleteTransaction = vi.fn(async () => {});
const getAllBankAccounts = vi.fn(async () => [{ id: 'usdAcc', currency: 'USD' }, { id: 'myrAcc', currency: 'MYR' }]);
const updateStatus = vi.fn(async () => {});
let projectData: Record<string, unknown> | null = null;

vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', async (orig) => ({
  ...(await orig<typeof import('firebase/firestore')>()),
  doc: vi.fn(() => ({})),
  getDoc: vi.fn(async () => ({ exists: () => !!projectData, data: () => projectData })),
}));
vi.mock('./financeService', () => ({ FinanceService: { createTransaction, deleteTransaction, getAllBankAccounts } }));
vi.mock('./eventRegistrationService', () => ({ EventRegistrationService: { updateStatus } }));
vi.mock('./errorLoggingService', () => ({ errorLoggingService: { logError: vi.fn() } }));

const { EventPaymentService } = await import('./eventPaymentService');

const event = { id: 'e1', title: 'Gala', price: undefined as number | undefined, priceMin: 80 };
const reg = (extra = {}) => ({ id: 'e1_m1', eventId: 'e1', memberId: 'm1', status: 'registered', createdAt: '', ...extra }) as any;

describe('EventPaymentService.markRegistrationPaid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectData = {};
  });

  it('creates a transaction WITH bankAccountId (first MYR account), amount = price ?? priceMin', async () => {
    const r = await EventPaymentService.markRegistrationPaid(reg(), event, { paymentMethod: 'cash', actorName: 'Fin' });
    const tx = createTransaction.mock.calls[0][0];
    expect(tx.bankAccountId).toBe('myrAcc');
    expect(tx.amount).toBe(80);
    expect(tx.originalCurrency).toBeUndefined();
    expect(updateStatus).toHaveBeenCalledWith('e1_m1', 'paid', expect.objectContaining({ financeTransactionId: 'tx1' }));
    expect(r.financeTransactionId).toBe('tx1');
  });

  it('uses the project financialAccountId when it is a real bank account', async () => {
    projectData = { financialAccountId: 'usdAcc' };
    await EventPaymentService.markRegistrationPaid(reg(), { ...event, price: 100 }, { paymentMethod: 'bank_transfer', actorName: 'Fin' });
    expect(createTransaction.mock.calls[0][0].bankAccountId).toBe('usdAcc');
    expect(createTransaction.mock.calls[0][0].amount).toBe(100);
  });

  it('USD registration: MYR amount received, original USD kept as reference', async () => {
    await EventPaymentService.markRegistrationPaid(reg({ currency: 'USD' }), event, { paymentMethod: 'bank_transfer', actorName: 'Fin', amount: 370 });
    const tx = createTransaction.mock.calls[0][0];
    expect(tx.amount).toBe(370);
    expect(tx.originalAmount).toBe(80);
    expect(tx.originalCurrency).toBe('USD');
    expect(tx.currency).toBeUndefined();
  });

  it('price 0 but priceMin > 0 (tiered): records priceMin, not 0', async () => {
    await EventPaymentService.markRegistrationPaid(reg(), { id: 'e1', title: 'Tiered', price: 0, priceMin: 80 }, { paymentMethod: 'cash', actorName: 'Fin' });
    expect(createTransaction.mock.calls[0][0].amount).toBe(80);
  });

  it('records the amount finance confirmed (MYR), also for non-USD registrations', async () => {
    await EventPaymentService.markRegistrationPaid(reg(), event, { paymentMethod: 'cash', actorName: 'Fin', amount: 120 });
    const tx = createTransaction.mock.calls[0][0];
    expect(tx.amount).toBe(120);
    expect(tx.originalAmount).toBeUndefined();
  });

  it('confirmed amount 0 skips the transaction', async () => {
    await EventPaymentService.markRegistrationPaid(reg(), event, { paymentMethod: 'cash', actorName: 'Fin', amount: 0 });
    expect(createTransaction).not.toHaveBeenCalled();
    expect(updateStatus).toHaveBeenCalled();
  });

  it('free event: no transaction, still marks paid', async () => {
    await EventPaymentService.markRegistrationPaid(reg(), { id: 'e1', title: 'Free' }, { paymentMethod: 'cash', actorName: 'Fin' });
    expect(createTransaction).not.toHaveBeenCalled();
    expect(updateStatus).toHaveBeenCalled();
  });

  it('removes the transaction when the registration update fails', async () => {
    updateStatus.mockRejectedValueOnce(new Error('denied'));
    await expect(EventPaymentService.markRegistrationPaid(reg(), event, { paymentMethod: 'cash', actorName: 'Fin' })).rejects.toThrow('denied');
    expect(deleteTransaction).toHaveBeenCalledWith('tx1');
  });

  it('throws a clear error when no bank account exists', async () => {
    getAllBankAccounts.mockResolvedValueOnce([]);
    await expect(EventPaymentService.markRegistrationPaid(reg(), event, { paymentMethod: 'cash', actorName: 'Fin' })).rejects.toThrow(/bank account/i);
    expect(updateStatus).not.toHaveBeenCalled();
  });
});
