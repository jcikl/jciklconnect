// Jan 1 dues reminders: in-app notification to every member with unpaid dues for the new year,
// plus the systemSettings/pendingWhatsAppCampaign flag that DuesRenewalDashboard shows as a banner.
// Migrated from functions/src/membership.ts sendAnnualDuesReminders (Cloud Functions are not deployed).
import { FieldValue } from 'firebase-admin/firestore';
import { db, hasAdminCredentials } from '../lib/firebaseAdmin.mjs';
import { isActiveRecipient, getDuesRecord } from '../lib/members.mjs';

const UNPAID_STATUSES = ['pending', 'partial', 'overdue'];
const EXEMPT_TYPES = ['Guest', 'Honorary', 'Senator'];
const BATCH_LIMIT = 490;

export default async (req, context) => {
  if (!hasAdminCredentials) {
    return Response.json({ error: 'Missing Firebase Admin credentials' }, { status: 500 });
  }
  const cronSecret = process.env.CRON_SECRET;
  const receivedSecret = req.headers.get('x-cron-secret') ?? new URL(req.url).searchParams.get('secret');
  if (context?.scheduled !== true && (!cronSecret || receivedSecret !== cronSecret)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const nowMYT = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));
    const year = nowMYT.getFullYear();
    console.log(`[annual-dues-reminders] Sending dues reminders for ${year}`);

    const membersSnap = await db.collection('members').get();
    const targets = [];
    for (const doc of membersSnap.docs) {
      const m = doc.data();
      if (!isActiveRecipient(m)) continue;
      const rec = getDuesRecord(m, year);
      if (!rec || !UNPAID_STATUSES.includes(rec.status ?? '')) continue;
      const mType = m.jciCareer?.membershipType ?? m.membershipType;
      if (EXEMPT_TYPES.includes(mType)) continue;
      targets.push({ memberId: doc.id, mType, outstanding: Math.max(0, (rec.dues ?? 0) - (rec.amount ?? 0)) });
    }

    // Idempotent per year: one notification id per member and year, skipped if it already exists,
    // so a manual re-run or a retried schedule never duplicates reminders.
    const refs = targets.map(t => db.collection('notifications').doc(`dues_reminder_${year}_${t.memberId}`));
    const existing = refs.length ? await db.getAll(...refs) : [];
    let batch = db.batch();
    let batchCount = 0;
    let created = 0;
    for (let i = 0; i < targets.length; i++) {
      if (existing[i].exists) continue;
      const { memberId, mType, outstanding } = targets[i];
      batch.set(refs[i], {
        memberId,
        type: 'dues_reminder',
        title: `${year} 年度会费提醒`,
        message: `温馨提醒：您 ${year} 年度的 ${mType ?? ''} 会费 RM${outstanding} 尚未缴清。请尽快完成缴费以维持您的会籍权益。`,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
      created++;
      if (++batchCount >= BATCH_LIMIT) { await batch.commit(); batch = db.batch(); batchCount = 0; }
    }
    if (batchCount > 0) await batch.commit();

    // Only (re)write the campaign flag on the first run of the year so a re-run does not
    // un-dismiss a banner the admin has already handled.
    const campaignRef = db.collection('systemSettings').doc('pendingWhatsAppCampaign');
    const campaign = await campaignRef.get();
    if (targets.length > 0 && campaign.data()?.year !== year) {
      await campaignRef.set({
        year,
        memberIds: targets.map(t => t.memberId),
        triggeredAt: FieldValue.serverTimestamp(),
        dismissed: false,
      });
    }

    const msg = `Done: ${targets.length} members with unpaid ${year} dues, ${created} new reminders.`;
    console.log(`[annual-dues-reminders] ${msg}`);
    return Response.json(msg);
  } catch (err) {
    console.error('[annual-dues-reminders] error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
};

// Jan 1, 10:00 Malaysia time (UTC+8 = 02:00 UTC)
export const config = { schedule: '0 2 1 1 *' };
