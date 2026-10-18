// Parsing and matching for ToyyibPay payment callbacks (server-to-server POST).
// The callback body uses refno / status / billcode / order_id / amount; the payer's return URL
// uses transaction_id / status_id instead. Both shapes are accepted.

/**
 * Read the callback body into a plain object. ToyyibPay posts multipart/form-data (observed
 * 2026-10-19); URL-encoded and JSON bodies are accepted too.
 */
export async function readCallbackBody(req) {
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('application/json')) return await req.json().catch(() => ({}));
  if (ct.includes('multipart/form-data')) {
    const data = {};
    for (const [k, v] of (await req.formData()).entries()) if (typeof v === 'string') data[k] = v;
    return data;
  }
  const data = {};
  for (const [k, v] of new URLSearchParams((await req.text()) || '').entries()) data[k] = v;
  return data;
}

export function parseCallbackPayload(data = {}) {
  const pick = (...keys) => {
    for (const k of keys) {
      const v = data[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
    }
    return null;
  };
  return {
    refNo: pick('refno', 'transaction_id'),
    billCode: pick('billcode', 'billCode'),
    orderId: pick('order_id', 'billExternalReferenceNo'),
    status: pick('status', 'status_id'),
  };
}

/**
 * Pick the getBillTransactions record for this payment: match the payment reference
 * (billpaymentInvoiceNo, e.g. TP2610192099972165) first, then our external reference (order_id).
 * Returns { record, exact } or null when ToyyibPay has no record for the bill.
 */
export function pickTransactionRecord(records, { refNo, orderId } = {}) {
  if (!Array.isArray(records) || records.length === 0) return null;
  const byRef = refNo ? records.find(r => String(r.billpaymentInvoiceNo ?? '') === refNo) : null;
  if (byRef) return { record: byRef, exact: true };
  const byOrder = orderId ? records.find(r => String(r.billExternalReferenceNo ?? '') === orderId) : null;
  if (byOrder) return { record: byOrder, exact: true };
  return { record: records[0], exact: false };
}
