/**
 * migrateCoHostingToArray.mjs
 *
 * Converts projects.coHosting from one comma-separated string ("JCI A, JCI B") to a string[]
 * (["JCI A", "JCI B"]) so it can be queried with `array-contains`. Only coHosting is written.
 *
 * Usage:
 *   node scripts/migrateCoHostingToArray.mjs                      # dry run: counts + samples
 *   node scripts/migrateCoHostingToArray.mjs --apply              # backup JSON, then batch-write
 *   node scripts/migrateCoHostingToArray.mjs --rollback <file>    # restore values from a backup
 *
 * Re-running --apply is safe: docs already holding the normalised array are skipped.
 * Credentials: FIREBASE_ADMIN_* from the project .env (same as the Netlify functions).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseCoHosting, KL_LO_NAME } from '../utils/loHosting.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const line of readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^(FIREBASE_ADMIN_[A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const { db } = await import(pathToFileURL(path.join(root, 'netlify/lib/firebaseAdmin.mjs')).href);
const { FieldValue } = await import('firebase-admin/firestore');

const BATCH_SIZE = 400;
const args = process.argv.slice(2);

async function writeInBatches(items, toUpdate) {
  let written = 0;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const it of items.slice(i, i + BATCH_SIZE)) batch.update(db.collection('projects').doc(it.id), toUpdate(it));
    await batch.commit();
    written += Math.min(BATCH_SIZE, items.length - i);
    console.log(`written ${written}/${items.length}`);
  }
}

if (args[0] === '--rollback') {
  const file = args[1];
  if (!file) { console.error('Usage: --rollback <backup.json>'); process.exit(1); }
  const items = JSON.parse(readFileSync(file, 'utf8'));
  console.log(`restoring coHosting on ${items.length} docs from ${file}`);
  await writeInBatches(items, it => ({ coHosting: it.coHosting === null ? FieldValue.delete() : it.coHosting }));
  console.log('rollback done');
  process.exit(0);
}

const APPLY = args.includes('--apply');
const snap = await db.collection('projects').get();
const sameList = (a, b) => Array.isArray(a) && a.length === b.length && a.every((v, i) => v === b[i]);

const changes = [];
const kinds = { string: 0, array: 0, none: 0, other: 0 };
let emptyAfter = 0, klCo = 0;
for (const d of snap.docs) {
  const raw = d.data().coHosting;
  const kind = raw == null ? 'none' : Array.isArray(raw) ? 'array' : typeof raw === 'string' ? 'string' : 'other';
  kinds[kind]++;
  if (raw == null) continue;
  const list = parseCoHosting(raw);
  if (list.includes(KL_LO_NAME)) klCo++;
  if (sameList(raw, list)) continue;
  if (list.length === 0) emptyAfter++;
  changes.push({ id: d.id, title: String(d.data().title ?? d.data().name ?? ''), coHosting: raw, after: list });
}

console.log(`projects: ${snap.size}`);
console.log(`coHosting stored as — string: ${kinds.string}, array: ${kinds.array}, missing: ${kinds.none}, other: ${kinds.other}`);
console.log(`to convert: ${changes.length}`);
console.log(`co-hosted by ${KL_LO_NAME}: ${klCo}`);
if (emptyAfter) console.log(`blank strings (will become []): ${emptyAfter}`);
console.log('samples:');
for (const c of [...changes].sort((a, b) => b.after.length - a.after.length).slice(0, 2).concat(changes.filter(c => c.after.length === 1).slice(0, 1))) {
  console.log(`  ${c.id} | ${c.title.slice(0, 35)}\n    before: ${JSON.stringify(c.coHosting)}\n    after:  ${JSON.stringify(c.after)}`);
}

if (!APPLY) {
  console.log('\nDry run — nothing written. Re-run with --apply to write.');
  process.exit(0);
}

const backupFile = path.join(root, `coHosting-backup-${Date.now()}.json`);
writeFileSync(backupFile, JSON.stringify(changes.map(({ id, coHosting }) => ({ id, coHosting })), null, 1));
console.log(`\nbackup of previous values: ${backupFile}`);
await writeInBatches(changes, c => ({ coHosting: c.after }));
console.log('done');
process.exit(0);
