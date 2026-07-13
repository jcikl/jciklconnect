/**
 * ToyyibPay Webhook Callback (情景 CC)
 * Handles POST callbacks from ToyyibPay after payment.
 * Implements idempotency to prevent duplicate processing.
 *
 * ToyyibPay sends: status_id, billcode, order_id, msg, transaction_id
 * status_id=1 → success, anything else → failed
 *
 * Mapped URL: /api/webhooks/toyyibpay  (via netlify.toml redirect)
 */

const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

function getDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
  return getFirestore();
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let data = {};
  const ct = event.headers['content-type'] || '';
  try {
    if (ct.includes('application/json')) {
      data = JSON.parse(event.body || '{}');
    } else {
      // form-encoded (ToyyibPay default)
      const params = new URLSearchParams(event.body || '');
      for (const [k, v] of params.entries()) data[k] = v;
    }
  } catch {
    return { statusCode: 400, body: 'Bad Request' };
  }

  const transactionId = data.transaction_id;
  const billCode = data.billcode;
  const orderId = data.order_id;
  const statusId = data.status_id;
  const isSuccess = statusId === '1';

  if (!transactionId || !billCode) {
    return { statusCode: 400, body: 'Missing required fields' };
  }

  const db = getDb();

  // ── Idempotency check (情景 CC) ──────────────────────────────────────────────
  // Use a Firestore document keyed by transactionId to deduplicate
  const idempotencyRef = db.collection('toyyibpay_webhooks').doc(transactionId);
  const idempotencySnap = await idempotencyRef.get();

  if (idempotencySnap.exists) {
    // Already processed — return 200 without re-processing
    console.log(`[toyyibpay-callback] Duplicate webhook for txn ${transactionId}, skipping`);
    return { statusCode: 200, body: 'OK (duplicate)' };
  }

  // ── Write idempotency record first (before processing) ───────────────────────
  await idempotencyRef.set({
    transactionId,
    billCode,
    orderId,
    statusId,
    isSuccess,
    receivedAt: Timestamp.now(),
    processed: false,
  });

  try {
    if (isSuccess) {
      // Find PaymentRequest or other entity linked to this billCode
      const prQuery = await db.collection('paymentRequests')
        .where('toyyibBillCode', '==', billCode)
        .limit(1)
        .get();

      if (!prQuery.empty) {
        const prDoc = prQuery.docs[0];
        const pr = { id: prDoc.id, ...prDoc.data() };

        // Only update if not already paid
        if (pr.status !== 'paid') {
          await prDoc.ref.update({
            status: 'paid',
            paidAt: new Date().toISOString(),
            toyyibTransactionId: transactionId,
            updatedAt: Timestamp.now(),
          });
        }
      }

      // Also handle membership payment (dues renewal via ToyyibPay)
      const memberQuery = await db.collection('members')
        .where('pendingToyyibBillCode', '==', billCode)
        .limit(1)
        .get();

      if (!memberQuery.empty) {
        const memberDoc = memberQuery.docs[0];
        await memberDoc.ref.update({
          pendingToyyibBillCode: null,
          toyyibTransactionId: transactionId,
          updatedAt: Timestamp.now(),
        });
      }
    }

    // Mark idempotency record as processed
    await idempotencyRef.update({ processed: true, processedAt: Timestamp.now() });

    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('[toyyibpay-callback] Error processing webhook:', err);
    // Mark as failed so it can be retried / investigated
    await idempotencyRef.update({ processed: false, error: String(err), failedAt: Timestamp.now() });
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};
