import { useMemo } from 'react';
import type { Member, UserRole, MembershipType } from '../types';

interface UseMemberSearchOptions {
  members: Member[];
  searchTerm: string;
  searchQuery?: string;
  roleFilters: UserRole[];
  membershipTypeFilters: MembershipType[];
  getMemberDisplayMembershipType: (member: Member) => MembershipType;
}

/**
 * Client-side filter over a pre-loaded members list.
 * Combines free-text search across name/email/phone/fullName/address
 * with column-level role and membershipType filters.
 */
export const useMemberSearch = ({
  members,
  searchTerm,
  searchQuery,
  roleFilters,
  membershipTypeFilters,
  getMemberDisplayMembershipType,
}: UseMemberSearchOptions): Member[] => {
  return useMemo(() => {
    const term = (searchQuery || searchTerm).toLowerCase();
    let list = members;

    if (term) {
      list = list.filter(m =>
        (m.name ?? '').toLowerCase().includes(term) ||
        (m.email ?? '').toLowerCase().includes(term) ||
        (m.phone ?? '').toLowerCase().includes(term) ||
        (m.fullName ?? '').toLowerCase().includes(term) ||
        (m.address ?? '').toLowerCase().includes(term)
      );
    }

    if (roleFilters.length > 0) {
      list = list.filter(m => roleFilters.includes(m.role as UserRole));
    }

    if (membershipTypeFilters.length > 0) {
      list = list.filter(m =>
        membershipTypeFilters.includes(getMemberDisplayMembershipType(m))
      );
    }

    return list;
  }, [members, searchTerm, searchQuery, roleFilters, membershipTypeFilters, getMemberDisplayMembershipType]);
};
