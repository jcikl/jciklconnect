// In-app JCI Malaysia sync (Member Directory, developer accounts only). Logic: netlify/lib/jciMalaysiaSync.mjs.
//   action 'preview': the plan (counts, changes with before/after, conflicts with candidates A/B, otherChapter, notFound).
//   action 'pick':    { memberId, sourceId } -> jciMalaysiaOverrides/{memberId} (validated against the source).
//   action 'apply':   recomputes the plan here (a client-sent plan is never used), backs up the old values to
//                     jciMalaysiaSyncRuns/{runId}, writes members in batches of <= 400, one auditLog entry (counts).
// The caller must have members/{uid}.isDeveloper === true in Firestore (never trusted from the client): else 403.
// The source project's service account key is read from systemSecrets/jciMalaysiaSource (rules: no client access)
// and the named source app is cached across warm invocations. Responses never contain emails or phones.
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { db, auth, hasAdminCredentials } from '../lib/firebaseAdmin.mjs';
import { SOURCE_DATABASE_ID, SECRET_COLLECTION, SECRET_DOC_ID, isSyncDeveloper, runAction } from '../lib/jciMalaysiaSync.mjs';

const ALLOWED_ORIGINS = ['https://app.jcikl.cc', 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];
const ACTIONS = ['preview', 'pick', 'apply'];
const SOURCE_APP_NAME = 'jciMalaysiaSource';

let sourceDbPromise = null;

/** Source Firestore from the key stored in systemSecrets; cached for warm invocations, retried after a failure. */
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
  const json = (body, status = 200) => Response.json(body, { status, headers: cors });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors });
  if (!hasAdminCredentials) return json({ error: 'Missing Firebase Admin credentials' }, 500);

  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
  let callerUid, caller;
  try {
    const decoded = await auth.verifyIdToken(authHeader.slice(7));
    callerUid = decoded.uid;
    caller = (await db.collection('members').doc(callerUid).get()).data() ?? null;
  } catch {
    return json({ error: 'Unauthorized' }, 401);
  }
  if (!isSyncDeveloper(caller)) return json({ error: 'Forbidden' }, 403);

  const body = await req.json().catch(() => ({}));
  const action = body.action;
  if (!ACTIONS.includes(action)) return json({ error: `action must be one of ${ACTIONS.join(', ')}` }, 400);

  try {
    const sourceDb = await getSourceDb();
    const res = await runAction({ action, body, sourceDb, db, callerUid, now: Timestamp.now() });
    const elapsedMs = Date.now() - started;
    console.log(`[jci-malaysia-sync] ${action} ${res.status} in ${elapsedMs} ms`);
    return json(res.status === 200 ? { ...res.body, elapsedMs } : res.body, res.status);
  } catch (err) {
    console.error(`[jci-malaysia-sync] ${action} failed after ${Date.now() - started} ms:`, err.code || err.message);
    if (err.notConfigured) return json({ error: 'JCI Malaysia source is not configured' }, 503);
    return json({ error: 'Internal server error' }, 500);
  }
};
