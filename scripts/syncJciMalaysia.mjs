/**
 * On-demand: copy the JCI Malaysia membership no. and JCI Malaysia join date from the SheetScraper Pro
 * database (Firestore project gen-lang-client-0772255734, collection member_directory) into our KL
 * members as jciCareer.jciMalaysiaMembershipNo / jciMalaysiaJoinDate / jciMalaysiaUserId (the source record id).
 *
 * Match (owner decision 2026-10-26): manual picks → stored user id → stored membership no. → email → phone. Rows of the same person in
 * several chapters: the JCI Kuala Lumpur row wins, then the latest join date. Only JCI Kuala Lumpur rows are
 * written (a person found only in another chapter is skipped and listed). Email and phone pointing to
 * different membership numbers = conflict, skipped and listed; the owner's picks for those live in Firestore
 * jciMalaysiaOverrides/{our member id} = { sourceId } (falls back to scripts/data/jciMalaysiaOverrides.json while
 * that collection is empty) and win. "N/A" is not a membership no.
 * Planning and writing are shared with the in-app sync (netlify/lib/jciMalaysiaSync.mjs).
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
import { SOURCE_DATABASE_ID, computePlan, loadOverrides, backupOf, applyPlan } from '../netlify/lib/jciMalaysiaSync.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'package.json'));
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

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

// Owner's manual picks (our member id -> source record id): Firestore first, the JSON file while that is empty.
let overrides = await loadOverrides(db);
if (!Object.keys(overrides).length) {
  const overridesFile = path.join(root, 'scripts', 'data', 'jciMalaysiaOverrides.json');
  overrides = existsSync(overridesFile) ? JSON.parse(readFileSync(overridesFile, 'utf8')) : {};
}
const plan = await computePlan({ sourceDb: source, db, overrides });

console.log(`source rows: ${plan.sourceRows}`);
console.log(JSON.stringify(plan.counts));
for (const w of plan.writes) {
  const { before: b, after: a } = w;
  console.log(`  ${w.name}: no ${b.membershipNo || '∅'} -> ${a.membershipNo || '∅'} | join ${b.joinDate || '∅'} -> ${a.joinDate || '∅'} | user id ${b.userId || '∅'} -> ${a.userId || '∅'} | by ${w.by}`);
}
console.log(`\nconflicts (email and phone point to different people) — check manually: ${plan.conflicts.length}`);
plan.conflicts.forEach(c => console.log(`  ${c.name}`));
console.log(`only found in another chapter — skipped, check manually: ${plan.otherChapter.length}`);
plan.otherChapter.forEach(o => console.log(`  ${o.name} (${o.chapter}, by ${o.by})`));
console.log(`not found in JCI Malaysia data: ${plan.notFound.length}`);
plan.notFound.forEach(n => console.log(`  ${n.name}`));

if (!APPLY) { console.log('\nDry run — nothing written. Re-run with --apply to write.'); process.exit(0); }

const backupDir = path.join(root, 'secrets', 'backups');
mkdirSync(backupDir, { recursive: true });
const backupFile = path.join(backupDir, `jci-malaysia-sync-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
writeFileSync(backupFile, JSON.stringify(backupOf(plan), null, 2));
console.log(`backup of old values: ${backupFile}`);

await applyPlan(db, plan, (done, total) => console.log(`written ${done}/${total}`));
console.log('done');
process.exit(0);
