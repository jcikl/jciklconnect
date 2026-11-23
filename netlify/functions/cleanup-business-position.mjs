// One-time cleanup: migrate business.position → business.departmentAndPosition, then delete business.position.
// Run AFTER deploy so the write path no longer writes business.position.
//
// GET  → dry-run (count docs with business.position, preview what would be copied vs just deleted)
// POST → execute (batch update: copy where departmentAndPosition missing, then delete business.position)
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

    // Classify docs: those with business.position that need processing
    const toCopy = [];   // copy position → departmentAndPosition, then delete position
    const toDelete = []; // departmentAndPosition already set; just delete position

    for (const docSnap of membersSnap.docs) {
      const data = docSnap.data();
      const pos = data.business?.position;
      if (pos == null || pos === '') continue;

      const dap = data.business?.departmentAndPosition;
      if (!dap || dap === '') {
        toCopy.push({ ref: docSnap.ref, value: pos });
      } else {
        toDelete.push({ ref: docSnap.ref });
      }
    }

    const totalDirty = toCopy.length + toDelete.length;

    if (req.method === 'GET') {
      return Response.json({
        dryRun: true,
        totalMembers: membersSnap.size,
        dirtyDocs: totalDirty,
        willCopyAndDelete: toCopy.length,
        willDeleteOnly: toDelete.length,
      }, { status: 200, headers: cors });
    }

    // POST: batch update
    const all = [
      ...toCopy.map(({ ref, value }) => ({ ref, update: { 'business.departmentAndPosition': value, 'business.position': FieldValue.delete() } })),
      ...toDelete.map(({ ref }) => ({ ref, update: { 'business.position': FieldValue.delete() } })),
    ];

    let cleaned = 0;
    for (let i = 0; i < all.length; i += 500) {
      const batch = db.batch();
      for (const { ref, update } of all.slice(i, i + 500)) {
        batch.update(ref, update);
      }
      await batch.commit();
      cleaned += Math.min(500, all.length - i);
    }

    console.log(`[cleanup-business-position] by=${callerUid} copied=${toCopy.length} deleted=${toDelete.length} total=${cleaned}`);
    return Response.json({ dryRun: false, cleaned, copied: toCopy.length, deletedOnly: toDelete.length }, { status: 200, headers: cors });

  } catch (err) {
    console.error('[cleanup-business-position] error:', err.message);
    return Response.json({ error: err.message }, { status: 500, headers: cors });
  }
};
