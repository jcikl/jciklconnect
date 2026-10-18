// Creates Firebase Auth accounts for member profiles, using the member doc id as the Auth uid.
//   mode 'create': ADMIN / SUPER_ADMIN, for specific memberIds (called after a batch import).
//   mode 'fix':    SUPER_ADMIN only, back-fills already imported members page by page;
//                  dryRun (default true) only reports what would happen.
// Every non-dry run writes one auditLog entry (member ids and statuses only, no emails).
import { FieldPath, Timestamp } from 'firebase-admin/firestore';
import { db, auth, hasAdminCredentials } from '../lib/firebaseAdmin.mjs';
import { planMemberAuth, applyMemberAuth, sendPasswordSetupEmail, findDuplicateEmails } from '../lib/memberAuth.mjs';

const ALLOWED_ORIGINS = ['https://app.jcikl.cc', 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];
const MAX_CREATE_IDS = 50;
const MAX_FIX_PAGE = 100;
const CONCURRENCY = 5;

async function mapLimited(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); }
  }));
  return out;
}

export default async (req) => {
  const origin = req.headers.get('origin') ?? '';
  const cors = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors });
  if (!hasAdminCredentials) return Response.json({ error: 'Missing Firebase Admin credentials' }, { status: 500, headers: cors });

  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors });
  let callerUid, callerRole;
  try {
    const decoded = await auth.verifyIdToken(authHeader.slice(7));
    callerUid = decoded.uid;
    callerRole = (await db.collection('members').doc(callerUid).get()).data()?.role;
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors });
  }

  const body = await req.json().catch(() => ({}));
  const mode = body.mode;
  if (mode !== 'create' && mode !== 'fix') return Response.json({ error: 'mode must be "create" or "fix"' }, { status: 400, headers: cors });
  const allowed = mode === 'fix' ? ['SUPER_ADMIN'] : ['ADMIN', 'SUPER_ADMIN'];
  if (!allowed.includes(callerRole)) return Response.json({ error: 'Forbidden' }, { status: 403, headers: cors });

  const dryRun = mode === 'fix' ? body.dryRun !== false : body.dryRun === true;
  const replaceOrphans = mode === 'fix' && body.replaceOrphans === true;
  const sendSetupEmail = mode === 'fix' && body.sendSetupEmail === true;

  try {
    // Duplicate-email detection needs every profile; the members collection is small (hundreds).
    const allMembers = await db.collection('members').get();
    const duplicateEmails = findDuplicateEmails(allMembers.docs);

    let targets, nextCursor = null;
    if (mode === 'create') {
      const ids = Array.isArray(body.memberIds) ? [...new Set(body.memberIds.filter(x => typeof x === 'string' && x))] : [];
      if (ids.length === 0 || ids.length > MAX_CREATE_IDS) {
        return Response.json({ error: `memberIds must contain 1–${MAX_CREATE_IDS} ids` }, { status: 400, headers: cors });
      }
      const snaps = await db.getAll(...ids.map(id => db.collection('members').doc(id)));
      targets = snaps.filter(s => s.exists);
    } else {
      const limit = Math.min(Math.max(Number(body.limit) || MAX_FIX_PAGE, 1), MAX_FIX_PAGE);
      let q = db.collection('members').orderBy(FieldPath.documentId()).limit(limit);
      if (typeof body.cursor === 'string' && body.cursor) q = q.startAfter(body.cursor);
      const page = await q.get();
      targets = page.docs;
      nextCursor = page.size === limit ? page.docs[page.size - 1].id : null;
    }

    const results = await mapLimited(targets, CONCURRENCY, async (snap) => {
      const m = snap.data();
      try {
        const plan = await planMemberAuth(snap.id, m, { replaceOrphans, duplicateEmails });
        if (dryRun) return plan;
        const done = await applyMemberAuth(plan, m);
        if (sendSetupEmail && (done.status === 'created' || done.status === 'replaced')) {
          try { await sendPasswordSetupEmail(done.email); done.emailSent = true; }
          catch (e) { done.emailSent = false; done.emailError = e.message; }
        }
        return done;
      } catch (e) {
        console.error(`[member-auth] ${snap.id} failed:`, e.code || e.message);
        return { memberId: snap.id, status: 'error', reason: e.code || 'unexpected error' };
      }
    });

    // Never return emails or phone numbers to the browser; the UI maps ids to names itself.
    const publicResults = results.map(({ memberId, status, reason, phoneNote, emailSent, emailError }) =>
      ({ memberId, status, reason, ...(phoneNote ? { phoneNote } : {}), ...(emailSent !== undefined ? { emailSent } : {}), ...(emailError ? { emailError } : {}) }));
    const summary = publicResults.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});

    if (!dryRun) {
      await db.collection('auditLog').add({
        action: mode === 'fix' ? 'member_auth_fix' : 'member_auth_create',
        performedBy: callerUid,
        targetCollection: 'members',
        targetId: mode === 'fix' ? `page:${body.cursor || 'start'}` : `batch:${publicResults.length}`,
        before: null,
        after: null,
        metadata: { summary, replaceOrphans, sendSetupEmail, results: publicResults.map(({ memberId, status }) => ({ memberId, status })) },
        timestamp: Timestamp.now(),
        _source: 'netlify-function',
      });
    }

    return Response.json({ mode, dryRun, summary, results: publicResults, nextCursor }, { headers: cors });
  } catch (err) {
    console.error('[member-auth] error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500, headers: cors });
  }
};
