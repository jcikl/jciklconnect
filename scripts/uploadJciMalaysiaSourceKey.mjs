/**
 * One-off: store the JCI Malaysia source project's service account key in OUR Firestore at
 * systemSecrets/jciMalaysiaSource, for netlify/functions/jci-malaysia-sync.mjs. firestore.rules deny every client
 * read and write of systemSecrets, so only the Admin SDK reaches it. Deploy those rules BEFORE running this.
 *
 *   node scripts/uploadJciMalaysiaSourceKey.mjs                     # upload secrets/source-firebase.json
 *   node scripts/uploadJciMalaysiaSourceKey.mjs --seed-overrides    # also copy scripts/data/jciMalaysiaOverrides.json
 *                                                                   # into jciMalaysiaOverrides/{memberId} (existing picks kept)
 *   node scripts/uploadJciMalaysiaSourceKey.mjs --seed-overrides --no-key   # only the overrides
 *
 * Options: --source-key <path> (default secrets/source-firebase.json). Our credentials: FIREBASE_ADMIN_* from .env;
 * with FIRESTORE_EMULATOR_HOST set it writes to the emulator and needs none.
 * Prints only the key's project_id and client_email — never the key itself.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { SECRET_COLLECTION, SECRET_DOC_ID, OVERRIDES_COLLECTION } from '../netlify/lib/jciMalaysiaSync.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'package.json'));
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

const argAfter = flag => { const i = process.argv.indexOf(flag); return i > 0 ? process.argv[i + 1] : undefined; };
const SEED = process.argv.includes('--seed-overrides');
const UPLOAD_KEY = !process.argv.includes('--no-key');
const sourceKeyPath = path.resolve(argAfter('--source-key') ?? path.join(root, 'secrets', 'source-firebase.json'));

const env = {};
const envFile = path.join(root, '.env');
if (existsSync(envFile)) for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^(FIREBASE_ADMIN_[A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const emulator = !!process.env.FIRESTORE_EMULATOR_HOST;
if (!emulator && !env.FIREBASE_ADMIN_PRIVATE_KEY) { console.error('No FIREBASE_ADMIN_* credentials in .env'); process.exit(1); }

const db = getFirestore(emulator
  ? initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-jcikl' }, 'target')
  : initializeApp({ credential: cert({
    projectId: env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }) }, 'target'));
console.log(`target: ${emulator ? `EMULATOR ${process.env.FIRESTORE_EMULATOR_HOST}` : `PROJECT ${env.FIREBASE_ADMIN_PROJECT_ID}`}`);

if (UPLOAD_KEY) {
  if (!existsSync(sourceKeyPath)) { console.error(`Source key not found: ${sourceKeyPath}`); process.exit(1); }
  const key = JSON.parse(readFileSync(sourceKeyPath, 'utf8'));
  if (key.type !== 'service_account' || !key.project_id || !key.client_email || !key.private_key) {
    console.error('Not a service account key file (needs type, project_id, client_email, private_key)');
    process.exit(1);
  }
  await db.collection(SECRET_COLLECTION).doc(SECRET_DOC_ID).set({ ...key, uploadedAt: Timestamp.now() });
  console.log(`stored ${SECRET_COLLECTION}/${SECRET_DOC_ID}: project_id ${key.project_id}, client_email ${key.client_email}`);
}

if (SEED) {
  const file = path.join(root, 'scripts', 'data', 'jciMalaysiaOverrides.json');
  const picks = JSON.parse(readFileSync(file, 'utf8'));
  const existing = new Set((await db.collection(OVERRIDES_COLLECTION).get()).docs.map(d => d.id));
  const batch = db.batch();
  let added = 0;
  for (const [memberId, sourceId] of Object.entries(picks)) {
    if (existing.has(memberId)) continue; // a pick made in the app wins over the file
    batch.set(db.collection(OVERRIDES_COLLECTION).doc(memberId), {
      sourceId: String(sourceId), pickedBy: 'seed:scripts/data/jciMalaysiaOverrides.json', pickedAt: Timestamp.now(),
    });
    added++;
  }
  if (added) await batch.commit();
  console.log(`overrides: ${added} added, ${Object.keys(picks).length - added} already in ${OVERRIDES_COLLECTION}`);
}
process.exit(0);
