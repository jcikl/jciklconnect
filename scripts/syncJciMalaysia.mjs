/**
 * On-demand: copy the JCI Malaysia membership no. and JCI Malaysia join date from the SheetScraper Pro
 * database (Firestore project gen-lang-client-0772255734, collection member_directory) into our KL
 * members as jciCareer.jciMalaysiaMembershipNo / jciCareer.jciMalaysiaJoinDate.
 *
 * Match (owner decision 2026-10-26): stored membership no. → email → phone. Rows of the same person in
 * several chapters: the JCI Kuala Lumpur row wins, then the latest join date. Only JCI Kuala Lumpur rows are
 * written (a person found only in another chapter is skipped and listed). Email and phone pointing to
 * different membership numbers = conflict, skipped and listed; the owner's picks for those live in
 * scripts/data/jciMalaysiaOverrides.json (our member id -> source record id) and win. "N/A" is not a membership no.
 *
 *   node scripts/syncJciMalaysia.mjs                 # dry run (default): counts, per-member changes, lists
 *   node scripts/syncJciMalaysia.mjs --apply         # writes; saves the old values to secrets/backups/ first
 *
 * Options: --source-key <path> (default secrets/source-firebase.json, the source project's service
 * account key — keep it out of git). Our credentials: FIREBASE_ADMIN_* from .env. Read-only on the source.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { buildSourceIndex, matchMember, planUpdate } from '../utils/jciMalaysiaMatch.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'package.json'));
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const SOURCE_DATABASE_ID = 'ai-studio-cba40058-0493-450b-8680-948d1cb07c7d';
const BATCH_SIZE = 400;
const APPLY = process.argv.includes('--apply');
const argAfter = flag => { const i = process.argv.indexOf(flag); return i > 0 ? process.argv[i + 1] : undefined; };
const sourceKeyPath = path.resolve(argAfter('--source-key') ?? path.join(root, 'secrets', 'source-firebase.json'));

if (!existsSync(sourceKeyPath)) { console.error(`Source key not found: ${sourceKeyPath}`); process.exit(1); }
const env = {};
const envFile = path.join(root, '.env');
if (existsSync(envFile)) for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^(FIREBASE_ADMIN_[A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
}
if (!env.FIREBASE_ADMIN_PRIVATE_KEY) { console.error('No FIREBASE_ADMIN_* credentials in .env'); process.exit(1); }

const source = getFirestore(initializeApp({ credential: cert(JSON.parse(readFileSync(sourceKeyPath, 'utf8'))) }, 'source'), SOURCE_DATABASE_ID);
const db = getFirestore(initializeApp({ credential: cert({
  projectId: env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
}) }, 'target'));

console.log(`target: PROJECT ${env.FIREBASE_ADMIN_PROJECT_ID} | source: member_directory (read-only)`);
console.log(APPLY ? 'mode: APPLY (writes)' : 'mode: DRY RUN (no writes)');

const rows = (await source.collection('member_directory').get()).docs.map(d => d.data());
const index = buildSourceIndex(rows);
// Owner's manual picks for people whose email and phone matched different records (our member id -> source record id).
const overridesFile = path.join(root, 'scripts', 'data', 'jciMalaysiaOverrides.json');
const overrides = existsSync(overridesFile) ? JSON.parse(readFileSync(overridesFile, 'utf8')) : {};
const members = (await db.collection('members').get()).docs
  .map(d => ({ ...d.data(), id: d.id }))
  .filter(m => (m.loId ?? 'jcikl') === 'jcikl');

const name = m => m.general?.name ?? m.name ?? m.id;
const counts = { members: members.length, byManual: 0, byMembershipNo: 0, byEmail: 0, byPhone: 0, conflict: 0, otherChapter: 0, none: 0, toWrite: 0, unchanged: 0 };
const writes = [], conflicts = [], unmatched = [], otherChapter = [];
for (const m of members) {
  const res = matchMember(m, index, overrides);
  if (res.status === 'conflict') { counts.conflict++; conflicts.push(name(m)); continue; }
  if (res.status === 'none') { counts.none++; unmatched.push(name(m)); continue; }
  if (res.status === 'otherChapter') { counts.otherChapter++; otherChapter.push(`${name(m)} (${res.row.chapter}, by ${res.by})`); continue; }
  counts[{ manual: 'byManual', membershipNo: 'byMembershipNo', email: 'byEmail', phone: 'byPhone' }[res.by]]++;
  const updates = planUpdate(m, res.row);
  if (!Object.keys(updates).length) { counts.unchanged++; continue; }
  counts.toWrite++;
  writes.push({ m, updates, by: res.by, chapter: res.row.chapter });
}

console.log(`source rows: ${rows.length}`);
console.log(JSON.stringify(counts));
for (const w of writes) {
  const before = { no: w.m.jciCareer?.jciMalaysiaMembershipNo ?? '', join: w.m.jciCareer?.jciMalaysiaJoinDate ?? '' };
  const after = { no: w.updates['jciCareer.jciMalaysiaMembershipNo'] ?? before.no, join: w.updates['jciCareer.jciMalaysiaJoinDate'] ?? before.join };
  console.log(`  ${name(w.m)}: no ${before.no || '∅'} -> ${after.no || '∅'} | join ${before.join || '∅'} -> ${after.join || '∅'} | by ${w.by}`);
}
console.log(`\nconflicts (email and phone point to different people) — check manually: ${conflicts.length}`);
conflicts.forEach(n => console.log(`  ${n}`));
console.log(`only found in another chapter — skipped, check manually: ${otherChapter.length}`);
otherChapter.forEach(n => console.log(`  ${n}`));
console.log(`not found in JCI Malaysia data: ${unmatched.length}`);
unmatched.forEach(n => console.log(`  ${n}`));

if (!APPLY) { console.log('\nDry run — nothing written. Re-run with --apply to write.'); process.exit(0); }

const backupDir = path.join(root, 'secrets', 'backups');
mkdirSync(backupDir, { recursive: true });
const backupFile = path.join(backupDir, `jci-malaysia-sync-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
writeFileSync(backupFile, JSON.stringify(writes.map(w => ({
  memberId: w.m.id,
  before: { jciMalaysiaMembershipNo: w.m.jciCareer?.jciMalaysiaMembershipNo ?? null, jciMalaysiaJoinDate: w.m.jciCareer?.jciMalaysiaJoinDate ?? null },
})), null, 2));
console.log(`backup of old values: ${backupFile}`);

let done = 0;
for (let i = 0; i < writes.length; i += BATCH_SIZE) {
  const batch = db.batch();
  for (const w of writes.slice(i, i + BATCH_SIZE)) batch.update(db.collection('members').doc(w.m.id), w.updates);
  await batch.commit();
  done += Math.min(BATCH_SIZE, writes.length - i);
  console.log(`written ${done}/${writes.length}`);
}
console.log('done');
process.exit(0);
