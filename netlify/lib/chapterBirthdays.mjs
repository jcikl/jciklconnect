// Pure logic for netlify/functions/chapter-birthdays.mjs (own-chapter birthdays for external users, decision 8).
// Returns only { id, displayName, avatarUrl, mmdd } — never the birth year, email or any other field.
import { KL_LO_ID } from '../../utils/memberCard.mjs';

const EXTERNAL_ROLES = ['AFFILIATE', 'CHAPTER_ADMIN'];

/** Active external member of a non-KL chapter (mirrors isActiveExternal() in firestore.rules). */
export function isActiveExternal(m) {
  return !!m && EXTERNAL_ROLES.includes(m.role) && m.affiliation?.status === 'active' &&
    typeof m.loId === 'string' && m.loId !== '' && m.loId !== KL_LO_ID;
}

/** 'MMDD' from general.dob ('YYYY-MM-DD…') or the birthdayMMDD index field; null when unknown or invalid. */
export function birthdayMmdd(m) {
  const dob = m?.general?.dob;
  let mmdd = null;
  if (typeof dob === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dob)) mmdd = dob.slice(5, 7) + dob.slice(8, 10);
  else if (typeof m?.birthdayMMDD === 'string' && /^\d{4}$/.test(m.birthdayMMDD)) mmdd = m.birthdayMMDD;
  if (!mmdd) return null;
  const month = Number(mmdd.slice(0, 2));
  const day = Number(mmdd.slice(2));
  return month >= 1 && month <= 12 && day >= 1 && day <= 31 ? mmdd : null;
}

/** Month 1–12 from the request body, or null. */
export function parseMonth(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : null;
}

/**
 * Birthdays in `month` among `docs` ({ id, data }) of the caller's chapter: active externals of that chapter
 * only, skipping privacy.hideBirthday, sorted by day. Output never contains the year.
 */
export function buildChapterBirthdays(docs, loId, month) {
  const mm = String(month).padStart(2, '0');
  const out = [];
  for (const { id, data } of docs) {
    if (!isActiveExternal(data) || data.loId !== loId) continue;
    if (data.privacy?.hideBirthday === true) continue;
    const mmdd = birthdayMmdd(data);
    if (!mmdd || mmdd.slice(0, 2) !== mm) continue;
    const displayName = typeof data.general?.name === 'string' && data.general.name.trim() ? data.general.name.trim() : '';
    if (!displayName) continue;
    const avatarUrl = typeof data.general?.avatarUrl === 'string' && data.general.avatarUrl ? data.general.avatarUrl : null;
    out.push({ id, displayName, avatarUrl, mmdd });
  }
  return out.sort((a, b) => a.mmdd.localeCompare(b.mmdd) || a.displayName.localeCompare(b.displayName));
}
