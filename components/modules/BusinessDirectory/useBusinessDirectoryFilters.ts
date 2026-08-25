import { useMemo } from 'react';
import type { BusinessProfile } from '../../../types';

interface UseBusinessDirectoryFiltersParams {
  businesses: BusinessProfile[];
  searchTerm: string;
  searchQuery?: string;
  selectedIndustries: Set<string>;
  selectedInterestedIndustry: string;
  selectedIntlBiz: string;
  selectedCategories: Set<string>;
  selectedIdealReferral: string;
  showDealsOnly: boolean;
  bookmarkedIds: Set<string>;
  idealReferralIndustry?: string;
  currentUserId?: string;
}

export const useBusinessDirectoryFilters = ({
  businesses,
  searchTerm,
  searchQuery,
  selectedIndustries,
  selectedInterestedIndustry,
  selectedIntlBiz,
  selectedCategories,
  selectedIdealReferral,
  showDealsOnly,
  bookmarkedIds,
  idealReferralIndustry,
  currentUserId,
}: UseBusinessDirectoryFiltersParams) => {
  const idealReferralsSet = useMemo(() => {
    const raw = idealReferralIndustry ?? '';
    return new Set(
      raw.split(',').map(value => value.trim().toLowerCase()).filter(Boolean)
    );
  }, [currentUserId, idealReferralIndustry]);

  const getBizScore = (biz: { id: string; industry?: string }): 0 | 1 | 2 => {
    if (bookmarkedIds.has(biz.id)) return 0;
    if (idealReferralsSet.size > 0 && biz.industry && idealReferralsSet.has(biz.industry.toLowerCase())) return 1;
    return 2;
  };

  const uniqueIndustries = useMemo(() => {
    const industries = new Set(businesses.map(business => business.industry).filter(Boolean));
    return ['All', ...Array.from(industries).sort()];
  }, [businesses]);

  const uniqueInterestedIndustries = useMemo(() => {
    const industries = new Set<string>();
    businesses.forEach(business => {
      const interestedIndustries = business.interestedIndustries;
      if (interestedIndustries) {
        interestedIndustries.forEach(industry => industries.add(industry));
      }
    });
    return ['All', ...Array.from(industries).sort()];
  }, [businesses]);

  const uniqueIdealReferrals = useMemo(() => {
    const referrals = new Set<string>();
    businesses.forEach(business => {
      const idealReferralTypes = business.idealReferralTypes;
      if (idealReferralTypes) {
        idealReferralTypes.forEach(referral => referrals.add(referral));
      }
    });
    return ['All', ...Array.from(referrals).sort()];
  }, [businesses]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    count += selectedIndustries.size;
    if (selectedInterestedIndustry !== 'All') count++;
    if (selectedIntlBiz !== 'All') count++;
    count += selectedCategories.size;
    if (selectedIdealReferral !== 'All') count++;
    if (showDealsOnly) count++;
    return count;
  }, [selectedIndustries, selectedInterestedIndustry, selectedIntlBiz, selectedCategories, selectedIdealReferral, showDealsOnly]);

  const filteredBusinesses = useMemo(() => {
    let filtered = businesses;
    if (selectedIndustries.size > 0) {
      filtered = filtered.filter(business => selectedIndustries.has(business.industry));
    }
    if (selectedInterestedIndustry !== 'All') {
      filtered = filtered.filter(business => {
        const interestedIndustries = business.interestedIndustries;
        return interestedIndustries && interestedIndustries.includes(selectedInterestedIndustry);
      });
    }
    if (selectedIntlBiz !== 'All') {
      filtered = filtered.filter(business => {
        const val = business.acceptsInternationalBusiness;
        if (selectedIntlBiz === 'Yes') {
          return val === 'Yes' || val === true;
        }
        if (selectedIntlBiz === 'Willing to Explore') {
          return val === 'Willing to Explore';
        }
        if (selectedIntlBiz === 'No') {
          return val === 'No' || val === false || val === undefined || val === null;
        }
        return true;
      });
    }
    if (selectedCategories.size > 0) {
      filtered = filtered.filter(business => {
        const bizCats = (business.businessCategory || '').split(',').map(category => category.trim());
        return [...selectedCategories].some(selectedCategory => bizCats.includes(selectedCategory));
      });
    }
    if (selectedIdealReferral !== 'All') {
      filtered = filtered.filter(business => {
        const idealReferralTypes = business.idealReferralTypes;
        return idealReferralTypes && idealReferralTypes.includes(selectedIdealReferral);
      });
    }
    if (showDealsOnly) {
      filtered = filtered.filter(business => !!business.offer);
    }

    const term = (searchQuery || searchTerm).toLowerCase();
    const result = term
      ? filtered.filter(business =>
        (business.companyName ?? '').toLowerCase().includes(term) ||
        (business.ownerName ?? '').toLowerCase().includes(term) ||
        (business.industry ?? '').toLowerCase().includes(term) ||
        (business.description ?? '').toLowerCase().includes(term) ||
        (business.businessCategory ?? '').toLowerCase().includes(term)
      )
      : filtered;

    return result.sort((a, b) => {
      const scoreDiff = getBizScore(a) - getBizScore(b);
      if (scoreDiff !== 0) return scoreDiff;
      return (a.ownerName ?? '').localeCompare(b.ownerName ?? '');
    });
  }, [
    businesses,
    searchTerm,
    searchQuery,
    selectedIndustries,
    selectedInterestedIndustry,
    selectedIntlBiz,
    selectedCategories,
    selectedIdealReferral,
    showDealsOnly,
    bookmarkedIds,
    idealReferralsSet,
  ]);

  return {
    uniqueIndustries,
    uniqueInterestedIndustries,
    uniqueIdealReferrals,
    activeFiltersCount,
    filteredBusinesses,
    getBizScore,
  };
};
