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
  // ToyyibPay sends status_id in callback; billpaymentStatus in getBillTransactions response
  // status_id: 1=success, others=fail  |  billpaymentStatus: 1=paid, 2=pending, 3=failed, 4=settling
  const statusId = data.status_id;
  const billpaymentStatus = data.billpaymentStatus;
  const billExternalReferenceNo = data.billExternalReferenceNo || null;
  const isSuccess = statusId === '1';

  // Map billpaymentStatus to our internal status
  const resolvedStatus =
    billpaymentStatus === '1' ? 'paid' :
    billpaymentStatus === '3' ? 'failed' :
    billpaymentStatus === '4' ? 'settling' :
    isSuccess ? 'paid' : 'pending';

  const billPaymentDate = data.billPaymentDate || new Date().toISOString();

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
    // ── Always update toyyibBills collection ─────────────────────────────────
    const billsQuery = await db.collection('toyyibBills')
      .where('billCode', '==', billCode)
      .limit(1)
      .get();

    let billMemberId = null;
    let billYear = null;
    let billProjectId = null;
    let billData = null;

    if (!billsQuery.empty) {
      billData = billsQuery.docs[0].data();
      billMemberId = billData.memberId || null;
      billProjectId = billData.projectId || null;
      // Extract year from billName e.g. "2026 Renewal Membership"
      const yearMatch = (billData.billName || '').match(/^(\d{4})\s/);
      if (yearMatch) billYear = yearMatch[1];

      const billUpdate = {
        billpaymentStatus: billpaymentStatus || (isSuccess ? '1' : '3'),
        billPaymentDate,
        updatedAt: Timestamp.now(),
      };
      if (billExternalReferenceNo) billUpdate.billExternalReferenceNo = billExternalReferenceNo;
      await billsQuery.docs[0].ref.update(billUpdate);
    }

    // ── Write billExternalReferenceNo back to member's membership record ─────
    if (billMemberId && billYear && billExternalReferenceNo) {
      await db.collection('members').doc(billMemberId).update({
        [`membership.${billYear}.billExternalReferenceNo`]: billExternalReferenceNo,
        [`membership.${billYear}.toyyibPaymentStatus`]: billpaymentStatus || (isSuccess ? '1' : '3'),
        updatedAt: Timestamp.now(),
      });
    }

    // ── Update eventRegistrations linked to this billCode ────────────────────
    const evtRegQuery = await db.collection('eventRegistrations')
      .where('toyyibBillCode', '==', billCode)
      .limit(1)
      .get();

    if (!evtRegQuery.empty) {
      const evtRegDoc = evtRegQuery.docs[0];
      const evtRegData = evtRegDoc.data();

      const evtUpdate = {
        toyyibPaymentStatus: billpaymentStatus || (isSuccess ? '1' : '3'),
        updatedAt: Timestamp.now(),
      };
      if (billExternalReferenceNo) evtUpdate.billExternalReferenceNo = billExternalReferenceNo;

      if (isSuccess) {
        evtUpdate.status = 'paid';
        evtUpdate.paymentMethod = 'toyyib';
        evtUpdate.paidAt = billPaymentDate;

        // ── Create income transaction (Pending) for this event payment ──────
        // Resolve ticket price: query event doc for ticketPrice
        let ticketPrice = 0;
        const eventId = evtRegData.eventId || billProjectId;
        if (eventId) {
          try {
            const eventSnap = await db.collection('events').doc(eventId).get();
            if (eventSnap.exists) {
              ticketPrice = eventSnap.data().price || eventSnap.data().ticketPrice || 0;
            }
          } catch (e) {
            console.warn('[toyyibpay-callback] Could not fetch event price:', e);
          }
        }

        const txData = {
          type: 'Income',
          category: 'Projects & Activities',
          status: 'Pending',
          paymentMethod: 'toyyib',
          projectId: billProjectId || eventId || null,
          memberId: billMemberId || evtRegData.memberId || null,
          eventRegistrationId: evtRegDoc.id,
          toyyibBillCode: billCode,
          amount: ticketPrice,
          description: `Event ticket — ${billData?.billName || billCode}`,
          date: billPaymentDate ? billPaymentDate.split('T')[0] : new Date().toISOString().split('T')[0],
          referenceNumber: billExternalReferenceNo || transactionId || null,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          source: 'manual',
        };

        const txRef = await db.collection('transactions').add(txData);

        // Link transaction ID back to eventRegistration
        evtUpdate.financeTransactionId = txRef.id;
      }

      await evtRegDoc.ref.update(evtUpdate);
    }

    if (isSuccess || resolvedStatus === 'settling') {
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
