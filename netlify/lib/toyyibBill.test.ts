import { describe, it, expect } from 'vitest';
import { buildCreateBillParams } from './toyyibBill.mjs';

const base = {
  billName: 'TEST Sandbox 20261019', billDescription: 'TEST Sandbox 20261019', billAmount: '100',
  billTo: 'JCI KL Test', billEmail: 'noreply@jcikl.cc', billPhone: '0123456789', categoryCode: '6x9mw99z',
  billPriceSetting: '0', billPayorInfo: '0', billPaymentChannel: '2', billExternalReferenceNo: 'JCI-1760000000000',
  billMultiPayment: '1', billReturnUrl: 'https://evil.example', billCallbackUrl: 'https://evil.example/cb',
};

describe('buildCreateBillParams', () => {
  it('sends the fields ToyyibPay requires, with server-fixed price setting and payer info', () => {
    const r = buildCreateBillParams(base);
    expect(r.ok).toBe(true);
    expect(r.ok && r.params).toEqual({
      billName: 'TEST Sandbox 20261019', billDescription: 'TEST Sandbox 20261019', billAmount: '100',
      billTo: 'JCI KL Test', billEmail: 'noreply@jcikl.cc', billPhone: '0123456789', categoryCode: '6x9mw99z',
      billPriceSetting: '1', billPayorInfo: '1', billPaymentChannel: '2', billExternalReferenceNo: 'JCI-1760000000000',
    });
  });

  it('never lets the caller make the amount editable or set the callback / return URLs', () => {
    const r = buildCreateBillParams(base);
    expect(r.ok && r.params.billPriceSetting).toBe('1');
    expect(r.ok && 'billCallbackUrl' in r.params).toBe(false);
    expect(r.ok && 'billReturnUrl' in r.params).toBe(false);
  });

  it('clips the name to 30 and the description to 100 characters (ToyyibPay limits)', () => {
    const r = buildCreateBillParams({ ...base, billName: 'x'.repeat(40), billDescription: 'y'.repeat(150) });
    expect(r.ok && r.params.billName).toHaveLength(30);
    expect(r.ok && r.params.billDescription).toHaveLength(100);
  });

  it('falls back to FPX for an unknown payment channel', () => {
    const r = buildCreateBillParams({ ...base, billPaymentChannel: '9' });
    expect(r.ok && r.params.billPaymentChannel).toBe('0');
  });

  it('rejects a missing or non-positive amount, missing name and bad email', () => {
    expect(buildCreateBillParams({ ...base, billAmount: '0' }).ok).toBe(false);
    expect(buildCreateBillParams({ ...base, billName: '  ' }).ok).toBe(false);
    expect(buildCreateBillParams({ ...base, billEmail: 'nope' }).ok).toBe(false);
  });
});
