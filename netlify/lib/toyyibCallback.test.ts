import { describe, it, expect } from 'vitest';
import { readCallbackBody, parseCallbackPayload, pickTransactionRecord } from './toyyibCallback.mjs';
import { secretKeyFor, apiBaseFor, envDefaultIsSandbox, readToyyibIsSandbox } from './toyyibMode.mjs';

describe('readCallbackBody', () => {
  const url = 'https://example.test/cb';
  it('reads a multipart/form-data body (what ToyyibPay actually sends)', async () => {
    const fd = new FormData();
    fd.append('refno', 'TP1'); fd.append('status', '1'); fd.append('billcode', 'g6e28dl6'); fd.append('order_id', 'JCI-1');
    const data = await readCallbackBody(new Request(url, { method: 'POST', body: fd }));
    expect(parseCallbackPayload(data)).toEqual({ refNo: 'TP1', billCode: 'g6e28dl6', orderId: 'JCI-1', status: '1' });
  });
  it('reads URL-encoded and JSON bodies', async () => {
    const form = new Request(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'refno=TP2&billcode=abc' });
    expect(await readCallbackBody(form)).toEqual({ refno: 'TP2', billcode: 'abc' });
    const json = new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"refno":"TP3","billcode":"xyz"}' });
    expect(await readCallbackBody(json)).toEqual({ refno: 'TP3', billcode: 'xyz' });
  });
});

describe('parseCallbackPayload', () => {
  it('reads the ToyyibPay callback body (refno / status / billcode / order_id)', () => {
    expect(parseCallbackPayload({ refno: 'TP2610192099972165', status: '1', billcode: 'lm6obyw3', order_id: 'JCI-1792341980203', amount: '1.00' }))
      .toEqual({ refNo: 'TP2610192099972165', billCode: 'lm6obyw3', orderId: 'JCI-1792341980203', status: '1' });
  });
  it('still accepts the return-URL shape (transaction_id / status_id)', () => {
    expect(parseCallbackPayload({ transaction_id: 'TP1', status_id: '3', billcode: 'abc', order_id: 'JCI-1' }))
      .toEqual({ refNo: 'TP1', billCode: 'abc', orderId: 'JCI-1', status: '3' });
  });
  it('returns nulls for missing or blank fields', () => {
    expect(parseCallbackPayload({ refno: '  ', billcode: '' })).toEqual({ refNo: null, billCode: null, orderId: null, status: null });
  });
});

describe('pickTransactionRecord', () => {
  const records = [
    { billpaymentInvoiceNo: 'TP-OTHER', billExternalReferenceNo: 'JCI-OTHER', billpaymentStatus: '3' },
    { billpaymentInvoiceNo: 'TP2610192099972165', billExternalReferenceNo: 'JCI-1792341980203', billpaymentStatus: '1' },
  ];
  it('matches the payment reference first', () => {
    expect(pickTransactionRecord(records, { refNo: 'TP2610192099972165' })).toEqual({ record: records[1], exact: true });
  });
  it('falls back to the external reference (order_id)', () => {
    expect(pickTransactionRecord(records, { refNo: 'TP-UNKNOWN', orderId: 'JCI-1792341980203' })).toEqual({ record: records[1], exact: true });
  });
  it('uses the first record when nothing matches, flagged as not exact', () => {
    expect(pickTransactionRecord(records, { refNo: 'x' })).toEqual({ record: records[0], exact: false });
  });
  it('returns null when ToyyibPay has no records', () => {
    expect(pickTransactionRecord([], { refNo: 'x' })).toBeNull();
  });
});

describe('toyyib mode helpers', () => {
  const env = { TOYYIBPAY_SECRET_KEY: 'sandbox-key', TOYYIBPAY_SECRET_KEY_PROD: 'prod-key' };
  it('picks the key and API base for each mode', () => {
    expect(secretKeyFor(true, env)).toBe('sandbox-key');
    expect(secretKeyFor(false, env)).toBe('prod-key');
    expect(apiBaseFor(true)).toBe('https://dev.toyyibpay.com/index.php/api');
    expect(apiBaseFor(false)).toBe('https://toyyibpay.com/index.php/api');
  });
  it('defaults to sandbox unless TOYYIBPAY_SANDBOX is "false"', () => {
    expect(envDefaultIsSandbox({})).toBe(true);
    expect(envDefaultIsSandbox({ TOYYIBPAY_SANDBOX: 'false' })).toBe(false);
  });
  it('reads the site-wide mode from systemConfig/toyyibpay, else the env default', async () => {
    const fs = (data: unknown) => ({ doc: () => ({ get: async () => ({ exists: data !== undefined, data: () => data }) }) });
    expect(await readToyyibIsSandbox(fs({ isSandbox: false }), { env: {} })).toBe(false);
    expect(await readToyyibIsSandbox(fs(undefined), { env: { TOYYIBPAY_SANDBOX: 'false' } })).toBe(false);
    expect(await readToyyibIsSandbox(fs(undefined), { env: {} })).toBe(true);
  });
});
