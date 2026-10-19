import { DEFAULT_LO_ID } from '../config/constants';

/** True for KL-chapter members. Legacy docs without a loId count as KL. */
export const isKlMember = (m: { loId?: string | null } | null | undefined): boolean =>
  !!m && (!m.loId || m.loId === DEFAULT_LO_ID);

/** Client-side safety net: drop external-chapter members from KL-only aggregates. */
export const filterKlMembers = <T extends { loId?: string | null }>(list: T[]): T[] =>
  list.filter(isKlMember);
