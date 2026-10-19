// Hosting / co-hosting LO helpers for events (projects collection).
// projects.coHosting is a string[] of LO names. Before the 2026-10 migration it was one
// comma-separated string (Roadmap import), and an older cached client may still write that,
// so every reader goes through parseCoHosting, which accepts both forms.
// Plain JS (JSDoc types) so scripts/migrateCoHostingToArray.mjs can share it with the app.

/** Exact LO name of JCI Kuala Lumpur. "JCI Kuala Lumpur West" / "Mandarin" are other LOs. */
export const KL_LO_NAME = 'JCI Kuala Lumpur';

/**
 * Co-hosting LO names as a trimmed, de-duplicated list.
 * @param {unknown} raw string[] or legacy comma-separated string
 * @returns {string[]}
 */
export function parseCoHosting(raw) {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];
  return [...new Set(list.filter(v => typeof v === 'string').map(v => v.trim()).filter(Boolean))];
}

/** @param {unknown} raw @returns {string} "A, B, C" for display / text inputs */
export function formatCoHosting(raw) {
  return parseCoHosting(raw).join(', ');
}

/**
 * Whether `loName` hosts / co-hosts the event (case-insensitive exact name match).
 * @param {{ hostingLo?: unknown, coHosting?: unknown } | null | undefined} item
 * @param {string} loName
 * @returns {{ isHosting: boolean, isCoHosting: boolean }}
 */
export function loRoleIn(item, loName) {
  const target = String(loName ?? '').trim().toLowerCase();
  if (!target) return { isHosting: false, isCoHosting: false };
  const host = typeof item?.hostingLo === 'string' ? item.hostingLo.trim().toLowerCase() : '';
  return {
    isHosting: host === target,
    isCoHosting: parseCoHosting(item?.coHosting).some(n => n.toLowerCase() === target),
  };
}

/** @param {{ hostingLo?: unknown, coHosting?: unknown } | null | undefined} item @param {string} loName */
export function involvesLo(item, loName) {
  const { isHosting, isCoHosting } = loRoleIn(item, loName);
  return isHosting || isCoHosting;
}

/** `level` values of events every JCI KL member sees (stored exactly like this). */
export const KL_SHARED_LEVELS = ['National', 'Area', 'JCI'];

/**
 * Events JCI KL members see: KL hosts or co-hosts, or the event is national / area / JCI level.
 * @param {{ hostingLo?: unknown, coHosting?: unknown, level?: unknown } | null | undefined} item
 */
export function isKlRelevantEvent(item) {
  const level = typeof item?.level === 'string' ? item.level.trim().toLowerCase() : '';
  return involvesLo(item, KL_LO_NAME)
    || level === 'national' || level === 'jci' || level === 'area' || level.startsWith('area');
}

/**
 * Events an external-chapter member (AFFILIATE / CHAPTER_ADMIN) sees: only what JCI KL hosts or co-hosts.
 * National / area / JCI level events hosted by other LOs are not shown to externals.
 * @param {{ hostingLo?: unknown, coHosting?: unknown } | null | undefined} item
 */
export function isEventVisibleToExternal(item) {
  return involvesLo(item, KL_LO_NAME);
}
