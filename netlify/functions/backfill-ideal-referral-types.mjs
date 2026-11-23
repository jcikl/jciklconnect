// Idempotent backfill: copy business.idealReferrals → business.idealReferralTypes for
// every member that has the old field but not the new one.
// GET  → dry-run summary (toMigrate, alreadyMigrated, noReferrals)
// POST → execute
import { db, auth, hasAdminCredentials } from '../lib/firebaseAdmin.mjs';
import { normalizeIdealReferrals } from '../../utils/idealReferrals.mjs';
import { FieldValue } from 'firebase-admin/firestore';

const ALLOWED_ORIGINS = ['https://app.jcikl.cc', 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];
const MEMBERS_COL = 'members';

async function verifyAdmin(req) {
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return null;
  try {
    const decoded = await auth.verifyIdToken(authHeader.slice(7));
    const snap = await db.collection(MEMBERS_COL).doc(decoded.uid).get();
    const role = snap.data()?.role;
    return ['ADMIN', 'SUPER_ADMIN'].includes(role) ? decoded.uid : null;
  } catch { return null; }
}

export default async (req) => {
  const origin = req.headers.get('origin') ?? '';
  const cors = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!['GET', 'POST'].includes(req.method)) return new Response('Method Not Allowed', { status: 405, headers: cors });
  if (!hasAdminCredentials) return Response.json({ error: 'Admin credentials not configured' }, { status: 500, headers: cors });

  const callerUid = await verifyAdmin(req);
  if (!callerUid) return Response.json({ error: 'Forbidden' }, { status: 403, headers: cors });

  const dryRun = req.method === 'GET';

  try {
    const membersSnap = await db.collection(MEMBERS_COL).get();

    const toMigrate = [];   // { ref, types }
    let alreadyMigrated = 0;
    let noReferrals = 0;

    for (const memberDoc of membersSnap.docs) {
      const data = memberDoc.data();
      const business = data.business ?? {};

      // Already has new field → skip
      if (Array.isArray(business.idealReferralTypes) && business.idealReferralTypes.length > 0) {
        alreadyMigrated++;
        continue;
      }

      // Try to find a value from old fields
      const types = normalizeIdealReferrals(
        business.idealReferrals ?? data.idealReferral ?? data.idealReferrals
      );

      if (types.length === 0) {
        noReferrals++;
        continue;
      }

      toMigrate.push({ ref: memberDoc.ref, types });
    }

    if (dryRun) {
      return Response.json({
        dryRun: true,
        totalMembers: membersSnap.size,
        toMigrate: toMigrate.length,
        alreadyMigrated,
        noReferrals,
      }, { status: 200, headers: cors });
    }

    // Execute in batches of 500
    let migrated = 0;
    for (let i = 0; i < toMigrate.length; i += 500) {
      const batch = db.batch();
      toMigrate.slice(i, i + 500).forEach(({ ref, types }) => {
        batch.update(ref, { 'business.idealReferralTypes': types });
      });
      await batch.commit();
      migrated += Math.min(500, toMigrate.length - i);
    }

    console.log(`[backfill-ideal-referral-types] by=${callerUid} migrated=${migrated} skipped=${alreadyMigrated} noReferrals=${noReferrals}`);
    return Response.json({
      dryRun: false,
      migrated,
      alreadyMigrated,
      noReferrals,
    }, { status: 200, headers: cors });

  } catch (err) {
    console.error('[backfill-ideal-referral-types] error:', err.message);
    return Response.json({ error: err.message }, { status: 500, headers: cors });
  }
};
