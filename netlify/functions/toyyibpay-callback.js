/**
 * ToyyibPay Webhook Callback (情景 CC)
 * Handles POST callbacks from ToyyibPay after payment.
 * Implements idempotency to prevent duplicate processing, and verifies every
 * callback against ToyyibPay's own getBillTransactions API before trusting it —
 * the raw POST body is untrusted input and must never drive a "paid" write on its own.
 *
 * ToyyibPay sends: status_id, billcode, order_id, msg, transaction_id
 * status_id=1 → success, anything else → failed
 *
 * Mapped URL: /api/webhooks/toyyibpay  (via netlify.toml redirect)
 */

const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

const TOYYIB_SECRET_KEY = process.env.TOYYIBPAY_SECRET_KEY;
if (!TOYYIB_SECRET_KEY) throw new Error('TOYYIBPAY_SECRET_KEY env var not set');
const TOYYIB_IS_SANDBOX = process.env.TOYYIBPAY_SANDBOX !== 'false';
const TOYYIB_BASE_URL = TOYYIB_IS_SANDBOX
  ? 'https://dev.toyyibpay.com/index.php/api'
  : 'https://toyyibpay.com/index.php/api';

function getDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        // TODO SEC-010: Preferred var names are FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL /
        // FIREBASE_ADMIN_PRIVATE_KEY (no VITE_ prefix). Fallbacks keep backward compat.
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n'),
      }),
    });
  }
  return getFirestore();
}

/**
 * Server-to-server verification: ask ToyyibPay directly what the real status
 * of this bill is, instead of trusting the webhook POST body. Returns the
 * verified transaction record (or null if ToyyibPay reports nothing for this bill).
 */
async function verifyBillWithToyyib(billCode, transactionId) {
  const params = new URLSearchParams({ userSecretKey: TOYYIB_SECRET_KEY, billCode });
  const response = await fetch(`${TOYYIB_BASE_URL}/getBillTransactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!response.ok) throw new Error(`ToyyibPay verify HTTP ${response.status}`);
  const records = await response.json();
  if (!Array.isArray(records) || records.length === 0) return null;
  // Prefer the record matching this transaction_id; otherwise fall back to the most recent.
  const exactMatch = records.find(
    r => r.billExternalReferenceNo === transactionId || r.id === transactionId
  );
  if (!exactMatch) {
    console.warn(
      `[toyyibpay-callback] No exact transaction_id match for ${transactionId} in ${records.length} record(s) — using first record`
    );
  }
  return exactMatch || records[0];
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

  if (!transactionId || !billCode) {
    return { statusCode: 400, body: 'Missing required fields' };
  }

  const db = getDb();

  // ── Idempotency check (情景 CC) ──────────────────────────────────────────────
  // Keyed by transactionId. Only skip when a PRIOR attempt fully succeeded
  // (processed===true) — a record left at processed:false means the last
  // attempt errored out and must be retried, not silently swallowed.
  // Wrapped in a Firestore transaction so concurrent webhooks cannot both
  // read processed:false and both proceed — only one wins the write.
  const idempotencyRef = db.collection('toyyibpay_webhooks').doc(transactionId);
  const alreadyProcessed = await db.runTransaction(async (t) => {
    const doc = await t.get(idempotencyRef);
    if (doc.exists && doc.data().processed === true) return true;
    t.set(idempotencyRef, {
      transactionId,
      billCode,
      orderId,
      receivedAt: Timestamp.now(),
      processed: false,
    }, { merge: true });
    return false;
  });
  if (alreadyProcessed) {
    console.log(`[toyyibpay-callback] Already processed txn ${transactionId}, skipping`);
    return { statusCode: 200, body: 'Already processed' };
  }

  // ── Verify against ToyyibPay's own record before trusting anything ──────────
  let verified;
  try {
    verified = await verifyBillWithToyyib(billCode, transactionId);
  } catch (err) {
    console.error('[toyyibpay-callback] Verification call failed:', err);
    await idempotencyRef.set({ processed: false, error: `verify failed: ${err}`, failedAt: Timestamp.now() }, { merge: true });
    return { statusCode: 502, body: 'Verification failed' };
  }
  if (!verified) {
    console.warn(`[toyyibpay-callback] ToyyibPay has no transaction record for billCode=${billCode}; ignoring unverifiable callback`);
    await idempotencyRef.set({ processed: false, error: 'no matching ToyyibPay record', failedAt: Timestamp.now() }, { merge: true });
    return { statusCode: 400, body: 'Unverifiable callback' };
  }

  // billpaymentStatus: 1=paid, 2=pending, 3=failed, 4=settling — from ToyyibPay's own API, not the POST body.
  const billpaymentStatus = String(verified.billpaymentStatus ?? '');
  const isSuccess = billpaymentStatus === '1';
  const resolvedStatus =
    billpaymentStatus === '1' ? 'paid' :
    billpaymentStatus === '3' ? 'failed' :
    billpaymentStatus === '4' ? 'settling' :
    'pending';
  // TODO (P1-D): Bills stuck in 'pending' (billpaymentStatus='2') for >24h should be auto-voided.
  // Implement via Cloud Scheduler that queries toyyibBills where billpaymentStatus=='2'
  // and updatedAt < 24h ago, then calls the ToyyibPay getBillTransactions API to re-verify;
  // if still unresolved, mark the bill as void and release any held inventory/seats.
  const billExternalReferenceNo = verified.billExternalReferenceNo || data.billExternalReferenceNo || null;
  const billPaymentDate = verified.billpaymentDate || data.billPaymentDate || new Date().toISOString();
  const paidAmount = verified.billpaymentAmount != null ? Number(verified.billpaymentAmount) : null;

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
        billpaymentStatus,
        billPaymentDate,
        updatedAt: Timestamp.now(),
      };
      if (billExternalReferenceNo) billUpdate.billExternalReferenceNo = billExternalReferenceNo;

      // ── Batch: toyyibBills update + member billExternalReferenceNo sync ────
      // These two writes always happen together when a bill is found; batching
      // ensures they are atomic — no window where toyyibBills is updated but
      // the member record still shows the old reference.
      // TODO: Refactor downstream membership/event writes into single batch —
      //       currently conditional on payment type, making full batching complex.
      const headerBatch = db.batch();
      headerBatch.update(billsQuery.docs[0].ref, billUpdate);

      if (billMemberId && billYear && billExternalReferenceNo) {
        headerBatch.update(db.collection('members').doc(billMemberId), {
          [`membership.${billYear}.billExternalReferenceNo`]: billExternalReferenceNo,
          [`membership.${billYear}.toyyibPaymentStatus`]: billpaymentStatus,
          updatedAt: Timestamp.now(),
        });
      }
      await headerBatch.commit();
    } else if (billMemberId && billYear && billExternalReferenceNo) {
      // No toyyibBills doc found — still sync member field if we have the info
      await db.collection('members').doc(billMemberId).update({
        [`membership.${billYear}.billExternalReferenceNo`]: billExternalReferenceNo,
        [`membership.${billYear}.toyyibPaymentStatus`]: billpaymentStatus,
        updatedAt: Timestamp.now(),
      });
    }

    // ── Membership dues paid via ToyyibPay: clear/create the Income transaction ──
    // Without this, a member who pays dues online has their membership record
    // updated but the corresponding transactions doc stays Pending forever.
    if (isSuccess && billMemberId && billYear) {
      const duesAmount = paidAmount ?? (billData?.billAmount != null ? Number(billData.billAmount) / 100 : 0);
      const pendingDuesQuery = await db.collection('transactions')
        .where('memberId', '==', billMemberId)
        .where('category', '==', 'Membership')
        .where('type', '==', 'Income')
        .where('status', '==', 'Pending')
        .limit(10)
        .get();

      // Filter matching docs then pick the most recently created one if multiple exist (avoids unordered-query ambiguity)
      const yearMatchingDocs = pendingDuesQuery.docs.filter((d) => {
        const rawDate = d.data().date;
        const txDate = rawDate?.toDate ? rawDate.toDate().toISOString() : String(rawDate || '');
        return txDate.startsWith(billYear);
      });
      const yearMatchTx = yearMatchingDocs.sort((a, b) => {
        const dateA = a.data().date?.toDate ? a.data().date.toDate().getTime() : 0;
        const dateB = b.data().date?.toDate ? b.data().date.toDate().getTime() : 0;
        return dateB - dateA;
      })[0];

      if (yearMatchTx) {
        await yearMatchTx.ref.update({
          status: 'Cleared',
          paymentMethod: 'toyyib',
          toyyibBillCode: billCode,
          referenceNumber: billExternalReferenceNo || transactionId,
          updatedAt: Timestamp.now(),
        });
        // Sync membership status — server-side equivalent of syncMemberMembership
        const memberSnap = await db.collection('members').doc(billMemberId).get().catch(() => null);
        const memberData = memberSnap?.exists ? memberSnap.data() : null;
        const txDescription = yearMatchTx.data().description || yearMatchTx.data().purpose || '';
        const memberUpdate = {
          [`membership.${billYear}.status`]: 'paid',
          [`membership.${billYear}.amount`]: duesAmount,
          [`membership.${billYear}.dues`]: duesAmount,
          [`membership.${billYear}.transactionId`]: [yearMatchTx.id],
          [`membership.${billYear}.paymentDate`]: billPaymentDate || new Date().toISOString(),
          [`membership.${billYear}.purpose`]: txDescription,
          updatedAt: Timestamp.now(),
        };
        // Guest entry fee: mark hasPaidInitiationFee so GuestManagementView can show "Fee Paid".
        // Promotion to Probation still requires explicit board approval via GuestManagementView.
        if (memberData?.membershipType === 'Guest') {
          memberUpdate['hasPaidInitiationFee'] = true;
          memberUpdate['jciCareer.hasPaidInitiationFee'] = true;
        }
        await db.collection('members').doc(billMemberId).update(memberUpdate)
          .catch(err => console.warn('[toyyibpay-callback] Could not sync membership status:', err));
      } else {
        // ── P0-A: Idempotency check at transaction level (defense-in-depth) ────
        // The outer toyyibpay_webhooks check guards the full request, but if two
        // simultaneous retries race past that check, this prevents a second
        // Membership transaction from being created for the same bill.
        const membershipIdempotencyKey = `membership_${billCode}`;
        const existingMembershipTxSnap = await db.collection('transactions')
          .where('idempotencyKey', '==', membershipIdempotencyKey)
          .limit(1)
          .get();
        if (!existingMembershipTxSnap.empty) {
          console.log('[toyyibpay-callback] Duplicate webhook: membership tx already exists for billCode:', billCode);
          await idempotencyRef.set({ processed: true, processedAt: Timestamp.now() }, { merge: true });
          return { statusCode: 200, body: 'Already processed' };
        }

        const txDescription = `Membership dues ${billYear} — ${billData?.billName || billCode}`;
        const elsePaymentDate = billPaymentDate || new Date().toISOString();
        const newTxRef = db.collection('transactions').doc();
        const memberRef = db.collection('members').doc(billMemberId);
        const membershipBatch = db.batch();
        membershipBatch.set(newTxRef, {
          type: 'Income',
          category: 'Membership',
          status: 'Cleared',
          paymentMethod: 'toyyib',
          memberId: billMemberId,
          year: Number(billYear),
          projectId: `${billYear} membership`,
          toyyibBillCode: billCode,
          amount: duesAmount,
          description: txDescription,
          date: billPaymentDate ? billPaymentDate.split('T')[0] : new Date().toISOString().split('T')[0],
          referenceNumber: billExternalReferenceNo || transactionId,
          idempotencyKey: membershipIdempotencyKey,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          source: 'manual',
        });
        membershipBatch.update(memberRef, {
          [`membership.${billYear}.status`]: 'paid',
          [`membership.${billYear}.amount`]: duesAmount,
          [`membership.${billYear}.dues`]: duesAmount,
          [`membership.${billYear}.transactionId`]: [newTxRef.id],
          [`membership.${billYear}.paymentDate`]: elsePaymentDate,
          [`membership.${billYear}.purpose`]: txDescription,
          updatedAt: Timestamp.now(),
        });
        // Sync membership status atomically with the new transaction — both succeed or both fail.
        await membershipBatch.commit();
      }
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
        toyyibPaymentStatus: billpaymentStatus,
        updatedAt: Timestamp.now(),
      };
      if (billExternalReferenceNo) evtUpdate.billExternalReferenceNo = billExternalReferenceNo;

      if (isSuccess) {
        evtUpdate.status = 'paid';
        evtUpdate.paymentMethod = 'toyyib';
        evtUpdate.paidAt = billPaymentDate;

        // ── Create income transaction (Pending) for this event payment ──────
        // Prefer the amount ToyyibPay actually confirmed; fall back to event ticket price.
        let ticketPrice = paidAmount ?? 0;
        const eventId = evtRegData.eventId || billProjectId;
        if (!ticketPrice && eventId) {
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
          status: 'Cleared',
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

        // ── P0-A: Idempotency check at transaction level (defense-in-depth) ────
        const eventIdempotencyKey = `event_${billCode}`;
        const existingEventTxSnap = await db.collection('transactions')
          .where('idempotencyKey', '==', eventIdempotencyKey)
          .limit(1)
          .get();
        let txRef;
        if (!existingEventTxSnap.empty) {
          console.log('[toyyibpay-callback] Duplicate webhook: event tx already exists for billCode:', billCode);
          txRef = existingEventTxSnap.docs[0].ref;
        } else {
          txData.idempotencyKey = eventIdempotencyKey;
          txRef = await db.collection('transactions').add(txData);
        }

        // Link transaction ID back to eventRegistration
        evtUpdate.financeTransactionId = txRef.id;
      }

      await evtRegDoc.ref.update(evtUpdate);
    }

    // ── Rollback branch: payment failed or reversed (status 3) ─────────────
    // ToyyibPay may send a second callback with billpaymentStatus=3 when a
    // previously successful payment is reversed/refunded. Revert any records
    // this webhook wrote on the success path.
    if (!isSuccess && billpaymentStatus === '3') {
      // P1-C: Mark the bill as refunded so finance views can surface it.
      // refundTransactionId is set below once we know the reverted tx id.
      if (!billsQuery.empty) {
        await billsQuery.docs[0].ref.update({
          refundedAt: Timestamp.now(),
          billpaymentStatus: '3',
          updatedAt: Timestamp.now(),
        });
      }
      // Revert membership dues income tx if it was already Cleared by a prior success callback
      if (billMemberId && billYear) {
        const clearedDuesQuery = await db.collection('transactions')
          .where('toyyibBillCode', '==', billCode)
          .where('status', '==', 'Cleared')
          .where('category', '==', 'Membership')
          .limit(1)
          .get();
        if (!clearedDuesQuery.empty) {
          const duesTxDoc = clearedDuesQuery.docs[0];
          const duesTxStatus = duesTxDoc.data().status;
          if (duesTxStatus === 'Reconciled' || duesTxStatus === 'Partially Reconciled') {
            // Reconciled dues tx — do NOT silently overwrite; raise alert for manual void (mirrors event payment rollback path)
            await db.collection('finance_alerts').add({
              type: 'toyyibpay_refund_reconciled_dues_tx',
              transactionId: duesTxDoc.id,
              billCode,
              memberId: billMemberId,
              year: billYear,
              message: `ToyyibPay refund received for a Reconciled dues income tx (member ${billMemberId}, year ${billYear}) — manual void required.`,
              createdAt: Timestamp.now(),
              resolved: false,
            });
          } else {
            await duesTxDoc.ref.update({
              status: 'Pending',
              updatedAt: Timestamp.now(),
            });
            // P1-C: Write refundTransactionId back to the bill so finance views can link the reversal.
            if (!billsQuery.empty) {
              await billsQuery.docs[0].ref.update({
                refundTransactionId: duesTxDoc.id,
              });
            }
            // Sync membership status back to pending after refund — reset all payment fields
            await db.collection('members').doc(billMemberId).update({
              [`membership.${billYear}.status`]: 'pending',
              [`membership.${billYear}.amount`]: 0,
              [`membership.${billYear}.transactionId`]: [],
              [`membership.${billYear}.paymentDate`]: null,
              [`membership.${billYear}.purpose`]: null,
              updatedAt: Timestamp.now(),
            }).catch(err => console.warn('[toyyibpay-callback] Could not revert membership status:', err));
          }
        }
      }

      // Revert event registration and its linked income tx
      const evtRegRollbackQuery = await db.collection('eventRegistrations')
        .where('toyyibBillCode', '==', billCode)
        .limit(1)
        .get();
      if (!evtRegRollbackQuery.empty) {
        const evtRegDoc = evtRegRollbackQuery.docs[0];
        const evtRegData = evtRegDoc.data();
        if (evtRegData.financeTransactionId) {
          const txRef = db.collection('transactions').doc(evtRegData.financeTransactionId);
          const txSnap = await txRef.get();
          if (txSnap.exists) {
            const txStatus = txSnap.data().status;
            if (txStatus === 'Pending') {
              await txRef.delete();
            } else if (txStatus === 'Cleared') {
              await txRef.update({ status: 'Pending', updatedAt: Timestamp.now() });
              // P1-C: Write refundTransactionId back to the bill.
              if (!billsQuery.empty) {
                await billsQuery.docs[0].ref.update({
                  refundTransactionId: evtRegData.financeTransactionId,
                });
              }
            } else {
              // Reconciled / Partially Reconciled — do NOT overwrite; bank reconciliation must not be
              // silently broken by a webhook. Write a finance_alerts record for manual review instead.
              await db.collection('finance_alerts').add({
                type: 'toyyibpay_refund_reconciled_tx',
                transactionId: evtRegData.financeTransactionId,
                billCode,
                eventRegistrationId: evtRegDoc.id,
                message: `ToyyibPay refund received for a Reconciled income tx — manual void required.`,
                createdAt: Timestamp.now(),
                resolved: false,
              });
            }
          }
        }
        await evtRegDoc.ref.update({
          status: 'registered',
          paidAt: null,
          paymentMethod: null,
          financeTransactionId: null,
          toyyibPaymentStatus: billpaymentStatus,
          updatedAt: Timestamp.now(),
        });
      }
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

    // Mark idempotency record as processed only after every write above succeeded.
    await idempotencyRef.set({ processed: true, processedAt: Timestamp.now() }, { merge: true });

    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('[toyyibpay-callback] Error processing webhook:', err);
    // Leave processed:false so the next retry from ToyyibPay reprocesses this transaction.
    await idempotencyRef.set({ processed: false, error: String(err), failedAt: Timestamp.now() }, { merge: true });
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};
