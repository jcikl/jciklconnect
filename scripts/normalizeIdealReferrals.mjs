/**
 * One-off (owner decision 2026-10-26: fix the format, then the data, then the cards): rewrites every
 * member's ideal-referral fields into the canonical format of utils/idealReferrals.mjs.
 *
 *   node scripts/normalizeIdealReferrals.mjs            # dry run (default): prints every change, writes nothing
 *   node scripts/normalizeIdealReferrals.mjs --apply    # writes the changes
 *
 * Canonical format:
 *   business.idealReferrals       string[]  referral TYPES, one value per element
 *   business.idealReferralTypes   string[]  (legacy types field; only cleaned, if present)
 *   idealReferralIndustry         string    referral INDUSTRIES joined with '||'
 *
 * Rule for industries vs types (per value, after normalising):
 *   - a value in a types field that is an INDUSTRY option and NOT a referral-type option
 *     moves to idealReferralIndustry (added after the industries already there, no duplicates);
 *   - a value in idealReferralIndustry that is a referral-type option and NOT an industry
 *     moves to business.idealReferrals;
 *   - everything else stays where it is: referral-type options, free text, and 'Other' (in both lists).
 *
 * Also rewrites publicBusinessListings/{id}.idealReferralTypes (logged-out directory) when that
 * listing exists and its value changes. memberCards are NOT written: run scripts/backfillMemberCards.mjs after.
 *
 * Credentials: FIREBASE_ADMIN_* from the project .env. With FIRESTORE_EMULATOR_HOST set it uses the emulator.
 * Safe to re-run: members already in the canonical format are skipped.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildMemberCard } from '../utils/memberCard.mjs';
import {
  normalizeIdealReferrals,
  isIndustryOption,
  isReferralTypeOption,
  IDEAL_REFERRAL_INDUSTRY_SEPARATOR,
} from '../utils/idealReferrals.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^(FIREBASE_ADMIN_[A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}
const { db } = await import(pathToFileURL(path.join(root, 'netlify/lib/firebaseAdmin.mjs')).href);
if (!db) { console.error('No Firebase Admin credentials (.env FIREBASE_ADMIN_* or FIRESTORE_EMULATOR_HOST).'); process.exit(1); }

const MEMBERS_PER_BATCH = 200; // up to 2 writes per member (member + listing) → 400 ops
const APPLY = process.argv.includes('--apply');

console.log(`target: ${process.env.FIRESTORE_EMULATOR_HOST ? `EMULATOR ${process.env.FIRESTORE_EMULATOR_HOST}` : `PROJECT ${process.env.FIREBASE_ADMIN_PROJECT_ID}`}`);
console.log(APPLY ? 'mode: APPLY (writes)' : 'mode: DRY RUN (no writes)');

const isIndustryOnly = v => isIndustryOption(v) && !isReferralTypeOption(v);
const isTypeOnly = v => isReferralTypeOption(v) && !isIndustryOption(v);
const merge = (a, b) => normalizeIdealReferrals([...a, ...b]);
const show = v => (v === undefined ? '(none)' : JSON.stringify(v));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The canonical ideal-referral fields for one member.
 * @param {any} m member doc data
 * @returns {{ updates: Record<string, unknown>, after: any, moved: { toIndustry: string[], toTypes: string[] } }}
 */
function plan(m) {
  const b = m.business ?? {};
  const types = normalizeIdealReferrals(b.idealReferrals);
  const legacyTypes = normalizeIdealReferrals(b.idealReferralTypes);
  const industries = normalizeIdealReferrals(m.idealReferralIndustry);

  const toIndustry = [...types, ...legacyTypes].filter(isIndustryOnly);
  const toTypes = industries.filter(isTypeOnly);

  const typesAfter = merge(types.filter(v => !isIndustryOnly(v)), toTypes);
  const legacyAfter = legacyTypes.filter(v => !isIndustryOnly(v));
  const industryAfter = merge(industries.filter(v => !isTypeOnly(v)), toIndustry).join(IDEAL_REFERRAL_INDUSTRY_SEPARATOR);

  /** @type {Record<string, unknown>} */
  const updates = {};
  if ((b.idealReferrals !== undefined || typesAfter.length > 0) && !same(b.idealReferrals, typesAfter)) {
    updates['business.idealReferrals'] = typesAfter;
  }
  if (b.idealReferralTypes !== undefined && !same(b.idealReferralTypes, legacyAfter)) {
    updates['business.idealReferralTypes'] = legacyAfter;
  }
  if ((m.idealReferralIndustry !== undefined || industryAfter !== '') && m.idealReferralIndustry !== industryAfter) {
    updates.idealReferralIndustry = industryAfter;
  }
  // The member as stored after the write (fields not written keep their stored value).
  const after = {
    ...m,
    ...('idealReferralIndustry' in updates ? { idealReferralIndustry: industryAfter } : {}),
    business: {
      ...b,
      ...('business.idealReferrals' in updates ? { idealReferrals: typesAfter } : {}),
      ...('business.idealReferralTypes' in updates ? { idealReferralTypes: legacyAfter } : {}),
    },
  };
  return { updates, after, moved: { toIndustry, toTypes } };
}

const snap = await db.collection('members').get();
const targets = [];
let movedMembers = 0;
for (const d of snap.docs) {
  const m = d.data();
  const { updates, after, moved } = plan(m);
  if (Object.keys(updates).length === 0) continue;

  const name = m.general?.name ?? m.name ?? d.id;
  const before = {
    'business.idealReferrals': m.business?.idealReferrals,
    'business.idealReferralTypes': m.business?.idealReferralTypes,
    idealReferralIndustry: m.idealReferralIndustry,
  };
  for (const [field, value] of Object.entries(updates)) console.log(`${name}: ${field}: ${show(before[field])} -> ${show(value)}`);
  if (moved.toIndustry.length > 0) console.log(`${name}:   moved to idealReferralIndustry (industries, not referral types): ${show(moved.toIndustry)}`);
  if (moved.toTypes.length > 0) console.log(`${name}:   moved to business.idealReferrals (referral types, not industries): ${show(moved.toTypes)}`);
  if (moved.toIndustry.length > 0 || moved.toTypes.length > 0) movedMembers++;

  // Logged-out directory copy: same value as the member card / local directory (buildMemberCard parity).
  const listingRef = db.collection('publicBusinessListings').doc(d.id);
  const listing = await listingRef.get();
  let listingTypes;
  if (listing.exists) {
    const nextTypes = buildMemberCard(after).idealReferrals ?? [];
    if (!same(listing.data().idealReferralTypes, nextTypes)) {
      listingTypes = nextTypes;
      console.log(`${name}: publicBusinessListings.idealReferralTypes: ${show(listing.data().idealReferralTypes)} -> ${show(nextTypes)}`);
    }
  }
  targets.push({ id: d.id, updates, listingTypes });
}

console.log(`\nmember docs: ${snap.size}; to rewrite: ${targets.length}; with values moved between types and industries: ${movedMembers}`);

if (!APPLY) {
  console.log('Dry run — nothing written. Re-run with --apply to write these changes, then run the card backfill.');
  process.exit(0);
}

let written = 0;
for (let i = 0; i < targets.length; i += MEMBERS_PER_BATCH) {
  const batch = db.batch();
  for (const t of targets.slice(i, i + MEMBERS_PER_BATCH)) {
    batch.update(db.collection('members').doc(t.id), t.updates);
    if (t.listingTypes) batch.update(db.collection('publicBusinessListings').doc(t.id), { idealReferralTypes: t.listingTypes });
  }
  await batch.commit();
  written += Math.min(MEMBERS_PER_BATCH, targets.length - i);
  console.log(`rewritten ${written}/${targets.length}`);
}
console.log('done. Next: node scripts/backfillMemberCards.mjs (memberCards.idealReferrals).');
process.exit(0);
