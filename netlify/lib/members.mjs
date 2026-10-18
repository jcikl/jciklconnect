// Shared member helpers for Netlify Functions.

// Current member docs have no top-level `status`; eligibility comes from role (GUEST is unvetted,
// INACTIVE is excluded). A legacy `status: 'inactive'` on imported docs still excludes the member.
const RECIPIENT_ROLES = ['MEMBER', 'BOARD', 'ADMIN', 'SUPER_ADMIN'];

export function isActiveRecipient(m) {
  return RECIPIENT_ROLES.includes(m.role) && !m.deletedAt && String(m.status ?? '').toLowerCase() !== 'inactive';
}

// Dues records live in jciCareer.membershipDuesHistory; older docs used a top-level `membership` map.
export function getDuesRecord(m, year) {
  return m.jciCareer?.membershipDuesHistory?.[String(year)] ?? m.membership?.[String(year)] ?? null;
}
