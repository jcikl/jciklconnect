// One-time (and idempotent) cleanup: remove publicBusinessListings docs for members
// who do not have privacy.shareCardInternationally === true.
// Called by an ADMIN/SUPER_ADMIN. Returns a dry-run summary on GET, executes on POST.
import { db, auth, hasAdminCredentials } from '../lib/firebaseAdmin.mjs';

const ALLOWED_ORIGINS = ['https://app.jcikl.cc', 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];
const LISTINGS_COLLECTION = 'publicBusinessListings';
const MEMBERS_COLLECTION = 'members';

async function verifyAdmin(req) {
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return null;
  try {
    const decoded = await auth.verifyIdToken(authHeader.slice(7));
    const snap = await db.collection(MEMBERS_COLLECTION).doc(decoded.uid).get();
    const role = snap.data()?.role;
    return ['ADMIN', 'SUPER_ADMIN'].includes(role) ? decoded.uid : null;
  } catch {
    return null;
  }
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
    // 1. Fetch all listing docs (up to 500; chunk if needed)
    const listingsSnap = await db.collection(LISTINGS_COLLECTION).get();
    if (listingsSnap.empty) {
      return Response.json({ deleted: 0, kept: 0, dryRun }, { status: 200, headers: cors });
    }

    const memberIds = listingsSnap.docs.map(d => d.id);

    // 2. Batch-fetch the corresponding member docs (Firestore Admin getAll supports up to 500)
    const memberRefs = memberIds.map(id => db.collection(MEMBERS_COLLECTION).doc(id));
    const memberSnaps = await db.getAll(...memberRefs);

    // 3. Identify docs to delete
    const toDelete = [];
    for (let i = 0; i < listingsSnap.docs.length; i++) {
      const memberData = memberSnaps[i].data() ?? {};
      const shareCard = memberData.privacy?.shareCardInternationally;
      if (shareCard !== true) {
        toDelete.push(listingsSnap.docs[i].ref);
      }
    }

    if (dryRun) {
      return Response.json({
        dryRun: true,
        total: listingsSnap.size,
        wouldDelete: toDelete.length,
        wouldKeep: listingsSnap.size - toDelete.length,
      }, { status: 200, headers: cors });
    }

    // 4. Delete in batches of 500
    let deleted = 0;
    for (let i = 0; i < toDelete.length; i += 500) {
      const batch = db.batch();
      toDelete.slice(i, i + 500).forEach(ref => batch.delete(ref));
      await batch.commit();
      deleted += Math.min(500, toDelete.length - i);
    }

    console.log(`[cleanup-business-listings] by=${callerUid} deleted=${deleted} kept=${listingsSnap.size - deleted}`);
    return Response.json({
      dryRun: false,
      deleted,
      kept: listingsSnap.size - deleted,
    }, { status: 200, headers: cors });

  } catch (err) {
    console.error('[cleanup-business-listings] error:', err.message);
    return Response.json({ error: err.message }, { status: 500, headers: cors });
  }
};
