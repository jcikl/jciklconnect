// One-time cleanup: remove legacy business.idealReferrals field from member docs.
// GET  → dry-run (count docs that still have the field)
// POST → delete the field from those docs using FieldValue.delete()
import { db, auth, hasAdminCredentials } from '../lib/firebaseAdmin.mjs';
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

  try {
    const membersSnap = await db.collection(MEMBERS_COL).get();
    const toClean = [];

    for (const doc of membersSnap.docs) {
      const business = doc.data().business ?? {};
      if ('idealReferrals' in business) toClean.push(doc.ref);
    }

    if (req.method === 'GET') {
      return Response.json({ dryRun: true, totalMembers: membersSnap.size, toClean: toClean.length }, { status: 200, headers: cors });
    }

    let cleaned = 0;
    for (let i = 0; i < toClean.length; i += 500) {
      const batch = db.batch();
      toClean.slice(i, i + 500).forEach(ref => batch.update(ref, { 'business.idealReferrals': FieldValue.delete() }));
      await batch.commit();
      cleaned += Math.min(500, toClean.length - i);
    }

    console.log(`[cleanup-ideal-referrals] by=${callerUid} cleaned=${cleaned}`);
    return Response.json({ dryRun: false, cleaned }, { status: 200, headers: cors });

  } catch (err) {
    console.error('[cleanup-ideal-referrals] error:', err.message);
    return Response.json({ error: err.message }, { status: 500, headers: cors });
  }
};
