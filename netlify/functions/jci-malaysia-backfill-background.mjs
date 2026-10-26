// Developer-only "Back-fill registrations from JCI Malaysia" — APPLY (writes). This is a Netlify BACKGROUND
// function (filename ends in -background): Netlify returns 202 to the client immediately and lets it run up to
// 15 min, because creating ~2,614 registrations plus the full source read exceeds the 10s synchronous limit.
// The read-only PREVIEW lives in jci-malaysia-regcode.mjs (action 'previewBackfill').
//   Same auth + developer gate + source-key loading pattern as jci-malaysia-regcode.mjs. The plan is recomputed
//   server-side (nothing the client sends is used except the conflict-resolution map). One backup run doc is
//   written to jciMalaysiaSyncRuns/{runId} (kind:'eventRegBackfill', created doc ids for rollback, counts) and
//   one auditLog entry (counts only). Rollback (manual): delete the eventRegistrations ids listed in the run doc.
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { db, auth, hasAdminCredentials } from '../lib/firebaseAdmin.mjs';
import { SECRET_COLLECTION, SECRET_DOC_ID, isSyncDeveloper } from '../lib/jciMalaysiaSync.mjs';
import { SOURCE_DATABASE_ID } from '../lib/eventRegcode.mjs';
import { applyBackfill, sanitizeResolutions } from '../lib/eventRegBackfill.mjs';

const ALLOWED_ORIGINS = ['https://app.jcikl.cc', 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];
const SOURCE_APP_NAME = 'jciMalaysiaSource';

let sourceDbPromise = null;

/** Source Firestore from the key stored in systemSecrets; cached across warm invocations, retried after a failure. */
function getSourceDb() {
  if (!sourceDbPromise) {
    sourceDbPromise = (async () => {
      const existing = getApps().find(a => a.name === SOURCE_APP_NAME);
      if (existing) return getFirestore(existing, SOURCE_DATABASE_ID);
      const key = (await db.collection(SECRET_COLLECTION).doc(SECRET_DOC_ID).get()).data();
      if (!key?.project_id || !key?.client_email || !key?.private_key) throw Object.assign(new Error('source key missing'), { notConfigured: true });
      const app = initializeApp({
        credential: cert({ projectId: key.project_id, clientEmail: key.client_email, privateKey: key.private_key }),
      }, SOURCE_APP_NAME);
      return getFirestore(app, SOURCE_DATABASE_ID);
    })().catch(err => { sourceDbPromise = null; throw err; });
  }
  return sourceDbPromise;
}

export default async (req) => {
  const started = Date.now();
  const origin = req.headers.get('origin') ?? '';
  const cors = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors });
  // Background functions always resolve to 202 for the client; the gates below still guard the writes.
  if (!hasAdminCredentials) { console.error('[backfill-bg] missing Firebase Admin credentials'); return new Response(null, { status: 202, headers: cors }); }

  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) { console.warn('[backfill-bg] unauthorized (no token)'); return new Response(null, { status: 202, headers: cors }); }

  let callerUid, caller;
  try {
    const decoded = await auth.verifyIdToken(authHeader.slice(7));
    callerUid = decoded.uid;
    caller = (await db.collection('members').doc(callerUid).get()).data() ?? null;
  } catch {
    console.warn('[backfill-bg] unauthorized (bad token)');
    return new Response(null, { status: 202, headers: cors });
  }
  if (!isSyncDeveloper(caller)) { console.warn(`[backfill-bg] forbidden for ${callerUid}`); return new Response(null, { status: 202, headers: cors }); }

  const body = await req.json().catch(() => ({}));
  const resolutions = sanitizeResolutions(body.resolutions);

  try {
    const sourceDb = await getSourceDb();
    const res = await applyBackfill({ sourceDb, db, by: callerUid, nowTs: Timestamp.now(), resolutions });
    console.log(`[backfill-bg] done run=${res.runId} written=${res.written} in ${Date.now() - started} ms`);
  } catch (err) {
    console.error(`[backfill-bg] failed after ${Date.now() - started} ms:`, err.code || err.message);
  }
  return new Response(null, { status: 202, headers: cors });
};
