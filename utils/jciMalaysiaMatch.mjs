// Pure matching logic for scripts/syncJciMalaysia.mjs: JCI Malaysia member_directory rows
// (SheetScraper Pro database) → our members, by membership no. → email → phone.

export const KL_SOURCE_CHAPTER = 'JCI Kuala Lumpur';

export const emailKey = v => String(v ?? '').trim().toLowerCase();

/** Malaysian phone numbers: digits only, without the 60 / leading 0 prefix; too short = no key. */
export const phoneKey = v => {
  let s = String(v ?? '').replace(/\D/g, '');
  if (s.startsWith('60')) s = s.slice(2);
  if (s.startsWith('0')) s = s.slice(1);
  return s.length >= 8 ? s : '';
};

/** A real JCI Malaysia membership no.; placeholders such as "N/A", "-" or "" are treated as missing. */
export const membershipNo = v => {
  const s = String(v ?? '').trim();
  return /^(n\/?a|-+|none|null)?$/i.test(s) ? '' : s;
};

export const membershipKey = v => membershipNo(v).toUpperCase();

/** "2026-03-01 11:11:02" → "2026-03-01"; anything that isn't a date → ''. */
export const toIsoDate = v => {
  const m = String(v ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
};

const push = (map, key, row) => { if (!key) return; const list = map.get(key); if (list) list.push(row); else map.set(key, [row]); };

export function buildSourceIndex(rows) {
  const byMembership = new Map(), byEmail = new Map(), byPhone = new Map(), byId = new Map();
  for (const r of rows) {
    if (r.id != null && r.id !== '') byId.set(String(r.id), r);
    push(byMembership, membershipKey(r.membership), r);
    push(byEmail, emailKey(r.email), r);
    push(byPhone, phoneKey(r.contact), r);
  }
  return { byMembership, byEmail, byPhone, byId };
}

/** Among rows of the same person: prefer the JCI Kuala Lumpur row, then the latest join date. */
export function pickRow(rows) {
  if (!rows?.length) return null;
  return [...rows].sort((a, b) => {
    const kl = (b.chapter === KL_SOURCE_CHAPTER) - (a.chapter === KL_SOURCE_CHAPTER);
    if (kl) return kl;
    return toIsoDate(b.joindate).localeCompare(toIsoDate(a.joindate));
  })[0];
}

/**
 * Match one of our members. Returns { status, by?, row? }:
 *  - 'matched'  by 'manual' | 'userId' | 'membershipNo' | 'email' | 'phone'
 *  - 'conflict'     email and phone lead to different JCI Malaysia membership numbers;
 *                   candidates = { email: row, phone: row } (the two records, for a manual pick)
 *  - 'otherChapter' the person's only record is in another chapter (owner decision: skip, list for a manual check)
 *  - 'none'
 */
export function matchMember(member, index, overrides = {}) {
  // Owner's manual pick (scripts/data/jciMalaysiaOverrides.json: our member id -> source record id) wins.
  const manualId = overrides[member.id];
  if (manualId != null) {
    const row = index.byId.get(String(manualId));
    if (row) return { status: 'matched', by: 'manual', row };
  }
  // The JCI Malaysia user id (source record id) never changes, so it is the most reliable key once stored.
  const storedUserId = String(member.jciCareer?.jciMalaysiaUserId ?? '').trim();
  if (storedUserId) {
    const row = index.byId.get(storedUserId);
    if (row) return { status: 'matched', by: 'userId', row };
  }
  const stored = membershipKey(member.jciCareer?.jciMalaysiaMembershipNo);
  if (stored) {
    // Several records can share one membership no.: prefer the one with this member's own email / phone.
    const rows = index.byMembership.get(stored) ?? [];
    const own = rows.filter(r =>
      (emailKey(r.email) && emailKey(r.email) === emailKey(member.contact?.email ?? member.email)) ||
      (phoneKey(r.contact) && phoneKey(r.contact) === phoneKey(member.contact?.phone ?? member.phone)));
    const row = pickRow(own.length ? own : rows);
    if (row) return { status: 'matched', by: 'membershipNo', row };
  }
  const byEmail = pickRow(index.byEmail.get(emailKey(member.contact?.email ?? member.email)));
  const byPhone = pickRow(index.byPhone.get(phoneKey(member.contact?.phone ?? member.phone)));
  if (byEmail && byPhone) {
    const a = membershipKey(byEmail.membership), b = membershipKey(byPhone.membership);
    // Without a real membership no. on both sides, compare the source record ids instead.
    const samePerson = a && b ? a === b : String(byEmail.id ?? '') === String(byPhone.id ?? '');
    if (!samePerson) return { status: 'conflict', candidates: { email: byEmail, phone: byPhone } };
  }
  const hit = byEmail ? { by: 'email', row: byEmail } : byPhone ? { by: 'phone', row: byPhone } : null;
  if (!hit) return { status: 'none' };
  if (hit.row.chapter !== KL_SOURCE_CHAPTER) return { status: 'otherChapter', by: hit.by, row: hit.row };
  return { status: 'matched', ...hit };
}

// ---------------------------------------------------------------------------
// Field catalog: which JCI Malaysia source fields can be written, and where.
//  - always: the three match-key fields, always written when matched (never deselectable).
//  - core:   our own profile fields (name/gender/dob/email/phone); fillIfEmpty so a scraped value
//            NEVER overwrites one we already hold — it only fills a blank.
//  - the rest: JCI-Malaysia-only fields stored under jciCareer.jciMalaysia*, written when the source
//            value is non-empty and differs.
// `get` transforms the raw source value to what we store ('' means "treat as empty / skip").
// ---------------------------------------------------------------------------
export const FIELD_CATALOG = [
  { key: 'userId',       label: 'JCIM user id',   source: 'id',           target: 'jciCareer.jciMalaysiaUserId',       always: true, get: v => (v != null ? String(v).trim() : '') },
  { key: 'membershipNo', label: 'Membership no.', source: 'membership',   target: 'jciCareer.jciMalaysiaMembershipNo', always: true, get: membershipNo },
  { key: 'joinDate',     label: 'Join date',      source: 'joindate',     target: 'jciCareer.jciMalaysiaJoinDate',     always: true, get: toIsoDate },
  { key: 'chapter',      label: 'Chapter',        source: 'chapter',      target: 'jciCareer.jciMalaysiaChapter' },
  { key: 'level',        label: 'Level',          source: 'level',        target: 'jciCareer.jciMalaysiaLevel' },
  { key: 'area',         label: 'Area',           source: 'area',         target: 'jciCareer.jciMalaysiaArea' },
  { key: 'renewYear',    label: 'Renew year',     source: 'renew_year',   target: 'jciCareer.jciMalaysiaRenewYear',    number: true },
  { key: 'renewWindow',  label: 'Renew window',   source: 'renew_window', target: 'jciCareer.jciMalaysiaRenewWindow' },
  { key: 'verify',       label: 'Verified',       source: 'verify',       target: 'jciCareer.jciMalaysiaVerified' },
  { key: 'name',         label: 'Full name',      source: 'fullname',     target: 'general.name',   core: true, fillIfEmpty: true },
  { key: 'gender',       label: 'Gender',         source: 'gender',       target: 'general.gender', core: true, fillIfEmpty: true },
  // sensitive: the preview must never carry the raw value (email / phone / date of birth) — it is masked there
  // and the real value lives only in the server-side update/backup, which the public preview strips.
  { key: 'dob',          label: 'Date of birth',  source: 'dob',          target: 'general.dob',    core: true, fillIfEmpty: true, sensitive: true },
  { key: 'email',        label: 'Email',          source: 'email',        target: 'contact.email',  core: true, fillIfEmpty: true, sensitive: true },
  { key: 'phone',        label: 'Phone',          source: 'contact',      target: 'contact.phone',  core: true, fillIfEmpty: true, sensitive: true },
];

/** Field keys always written on a match (the three match keys). */
export const ALWAYS_KEYS = FIELD_CATALOG.filter(f => f.always).map(f => f.key);
/** Field keys the user may choose to also write (everything except the always-on three). */
export const SELECTABLE_KEYS = FIELD_CATALOG.filter(f => !f.always).map(f => f.key);
const CATALOG_BY_KEY = new Map(FIELD_CATALOG.map(f => [f.key, f]));

const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

/** The source value for one catalog field, normalised; '' when empty/unusable. */
export function sourceFieldValue(f, row) {
  const raw = row[f.source];
  if (f.get) return f.get(raw);
  if (f.number) { const n = Number(raw); return Number.isFinite(n) ? n : ''; }
  return String(raw ?? '').trim();
}

/**
 * The fields to write for `member` from source `row`, limited to the always-on keys plus `selected`.
 * Empty source values never overwrite ours; `fillIfEmpty` (core profile) fields only write when our value is
 * blank; the rest write when the value differs. Returns a dot-path update map.
 */
export function planUpdate(member, row, selected = []) {
  const keys = new Set([...ALWAYS_KEYS, ...selected]);
  const updates = {};
  for (const key of keys) {
    const f = CATALOG_BY_KEY.get(key);
    if (!f) continue;
    const val = sourceFieldValue(f, row);
    if (val === '' || val == null) continue;                // empty source never overwrites
    const current = getPath(member, f.target);
    const curStr = current == null ? '' : String(current);
    if (f.fillIfEmpty) { if (curStr === '') updates[f.target] = val; }
    else if (String(val) !== curStr) updates[f.target] = val;
  }
  return updates;
}
