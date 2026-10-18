import { describe, it, expect, vi, beforeEach } from 'vitest';

// Real bills must go through the toyyibpay-api proxy; only dev mode may return a MOCK bill.
const devMode = { on: false };
const fetchMock = vi.fn();
const commit = vi.fn(async () => {});

vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('firebase/auth', () => ({ getAuth: () => ({ currentUser: { getIdToken: async () => 'token' } }) }));
vi.mock('firebase/firestore', async (orig) => ({
  ...(await orig<typeof import('firebase/firestore')>()),
  doc: vi.fn(() => ({})),
  collection: vi.fn(() => ({})),
  serverTimestamp: vi.fn(() => 'ts'),
  increment: vi.fn((n) => n),
  writeBatch: vi.fn(() => ({ set: vi.fn(), commit })),
}));
vi.mock('../utils/fetchWithTimeout', () => ({ fetchWithTimeout: (...a: unknown[]) => fetchMock(...a) }));
vi.mock('../utils/devMode', () => ({ isDevMode: () => devMode.on, withDevMode: (m: () => unknown, r: () => unknown) => (devMode.on ? m() : r()) }));
vi.mock('./errorLoggingService', () => ({ errorLoggingService: { logError: vi.fn() } }));

vi.stubGlobal('window', { location: { origin: 'https://jciklconnect.netlify.app' }, addEventListener: () => {} });

const { ToyyibService } = await import('./toyyibService');

const params = {
  billName: 'TEST', billDescription: 'TEST', billAmount: 1, billTo: 'JCI KL Test',
  billEmail: 'noreply@jcikl.cc', billPhone: '0123456789', categoryCode: '6x9mw99z',
};

describe('ToyyibService.createBill', () => {
  beforeEach(() => { vi.clearAllMocks(); devMode.on = false; });

  it('calls the toyyibpay-api proxy and persists the bill outside dev mode', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => [{ BillCode: 'abc123' }] });
    const res = await ToyyibService.createBill(params);
    expect(fetchMock).toHaveBeenCalledWith('/.netlify/functions/toyyibpay-api', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ action: 'createBill', billAmount: '100', categoryCode: '6x9mw99z' });
    expect(res.billCode).toBe('abc123');
    expect(commit).toHaveBeenCalled();
  });

  it('returns a MOCK bill without calling the proxy in dev mode', async () => {
    devMode.on = true;
    const res = await ToyyibService.createBill(params);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.billCode).toMatch(/^MOCK-/);
  });
});
