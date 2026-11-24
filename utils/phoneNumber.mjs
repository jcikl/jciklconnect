/** Malaysian-first phone normalisation to E.164; unknown country codes need +. */
export function normalizeMyPhone(raw) {
  if (raw == null) return null;
  let p = String(raw).replace(/[\s\-().]/g, '');
  if (!p) return null;
  if (p.startsWith('00')) p = '+' + p.slice(2);
  else if (p.startsWith('0')) p = '+60' + p.slice(1);
  else if (p.startsWith('60')) p = '+' + p;
  else if (/^1\d{7,9}$/.test(p)) p = '+60' + p;
  else if (!p.startsWith('+')) return null;
  return /^\+[1-9]\d{7,14}$/.test(p) ? p : null;
}
