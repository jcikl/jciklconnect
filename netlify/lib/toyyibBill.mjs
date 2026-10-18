// Builds the createBill parameters sent to ToyyibPay from a client request.
// Only known fields pass through; settings that decide how the bill behaves are fixed here
// on the server so a caller cannot, for example, let the payer change the amount.

// ToyyibPay limits (createBill): billName max 30 characters, billDescription max 100.
export const BILL_NAME_MAX = 30;
export const BILL_DESCRIPTION_MAX = 100;

const PASS_THROUGH = ['billAmount', 'billTo', 'billEmail', 'billPhone', 'categoryCode', 'billSplitPayment', 'billSplitPaymentArgs'];
const PAYMENT_CHANNELS = ['0', '1', '2']; // 0 = FPX, 1 = card, 2 = both

const clip = (v, max) => String(v ?? '').trim().slice(0, max);

/**
 * @returns {{ ok: true, params: Record<string,string> } | { ok: false, error: string }}
 */
export function buildCreateBillParams(input) {
  const rawAmount = Number(input?.billAmount);
  if (!input?.billAmount || !Number.isFinite(rawAmount) || rawAmount <= 0) {
    return { ok: false, error: 'Invalid input: billAmount must be a positive number' };
  }
  const billName = clip(input.billName, BILL_NAME_MAX);
  if (!billName) return { ok: false, error: 'Invalid input: billName is required' };
  const billDescription = clip(input.billDescription || input.billName, BILL_DESCRIPTION_MAX);
  if (input.billEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.billEmail)) {
    return { ok: false, error: 'Invalid input: billEmail has an invalid format' };
  }

  const params = { billName, billDescription };
  for (const key of PASS_THROUGH) {
    if (input[key] !== undefined && input[key] !== null && input[key] !== '') params[key] = String(input[key]);
  }
  // Fixed by the server: fixed-price bill (1) and payer details required (1).
  params.billPriceSetting = '1';
  params.billPayorInfo = '1';
  params.billPaymentChannel = PAYMENT_CHANNELS.includes(String(input.billPaymentChannel)) ? String(input.billPaymentChannel) : '0';
  // Links the payment back to our records (registration / dues) in the callback.
  if (input.billExternalReferenceNo) params.billExternalReferenceNo = clip(input.billExternalReferenceNo, 100);
  return { ok: true, params };
}
