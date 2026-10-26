// "My event QR": attach each member's JCI Malaysia regcode to their own eventRegistration. Logic: netlify/lib/eventRegcode.mjs.
//   action 'previewRegcodes' / 'applyRegcodes': developer-only batch back-fill (counts only; apply writes + backup + audit).
//   action 'attachMyRegcode':  ANY authenticated member, the caller's OWN registration only ({eventId}_{uid}).
// The source key is read from systemSecrets/jciMalaysiaSource (rules: no client access) with the Admin SDK, so the
// key and the source project (gen-lang-client-0772255734 / event_participants) are never exposed to the client.
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { db, auth, hasAdminCredentials } from '../lib/firebaseAdmin.mjs';
import { SECRET_COLLECTION, SECRET_DOC_ID, isSyncDeveloper } from '../lib/jciMalaysiaSync.mjs';
import { SOURCE_DATABASE_ID, previewRegcodes, applyRegcodes, attachMyRegcode } from '../lib/eventRegcode.mjs';

const ALLOWED_ORIGINS = ['https://app.jcikl.cc', 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];
const DEVELOPER_ACTIONS = ['previewRegcodes', 'applyRegcodes'];
const MEMBER_ACTIONS = ['attachMyRegcode'];
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

  const body = await req.json().catch(() => ({}));
  const action = body.action;
  const isDeveloperAction = DEVELOPER_ACTIONS.includes(action);
  const isMemberAction = MEMBER_ACTIONS.includes(action);
  if (!isDeveloperAction && !isMemberAction) {
    return json({ error: `action must be one of ${[...DEVELOPER_ACTIONS, ...MEMBER_ACTIONS].join(', ')}` }, 400);
  }
  if (isDeveloperAction && !isSyncDeveloper(caller)) return json({ error: 'Forbidden' }, 403);

  try {
    const sourceDb = await getSourceDb();
    const now = Timestamp.now();
    let res;
    if (action === 'previewRegcodes') res = await previewRegcodes({ sourceDb, db });
    else if (action === 'applyRegcodes') res = await applyRegcodes({ sourceDb, db, by: callerUid, now });
    else res = await attachMyRegcode({ sourceDb, db, callerUid, eventId: body.eventId, now });
    const elapsedMs = Date.now() - started;
    console.log(`[jci-malaysia-regcode] ${action} ${res.status} in ${elapsedMs} ms`);
    return json(res.status === 200 ? { ...res.body, elapsedMs } : res.body, res.status);
  } catch (err) {
    console.error(`[jci-malaysia-regcode] ${action} failed after ${Date.now() - started} ms:`, err.code || err.message);
    if (err.notConfigured) {
      // Auto-attach must never surface an error to an ordinary member: regcode just stays null.
      if (isMemberAction) return json({ attached: false, reason: 'not-configured' }, 200);
      return json({ error: 'JCI Malaysia source is not configured' }, 503);
    }
    if (isMemberAction) return json({ attached: false, reason: 'error' }, 200);
    return json({ error: 'Internal server error' }, 500);
  }
};
