import React from 'react';
import { Gift, Globe } from 'lucide-react';
import type { BusinessProfile } from '../../../types';
import { FilterDrawer } from '../../ui/Common';
import type { BusinessDirectoryTab } from './BusinessDirectoryHeader';
import { BUSINESS_CATEGORIES } from './businessDirectoryUtils';

interface SisterFilterMember {
  country: string;
  jciChapter: string;
  industry: string;
}

interface BusinessDirectoryFilterDrawerProps {
  isOpen: boolean;
  activeTab: BusinessDirectoryTab;
  businesses: BusinessProfile[];
  filteredBusinessCount: number;
  activeFiltersCount: number;
  selectedIndustries: Set<string>;
  selectedInterestedIndustry: string;
  selectedIntlBiz: string;
  selectedCategories: Set<string>;
  selectedIdealReferral: string;
  showDealsOnly: boolean;
  uniqueIndustries: string[];
  uniqueInterestedIndustries: string[];
  uniqueIdealReferrals: string[];
  sisterMembers: SisterFilterMember[];
  sisterChapters: string[];
  sisterCountries: string[];
  sisterIndustries: string[];
  selectedSisterChapter: string;
  selectedSisterCountry: string;
  selectedSisterIndustry: string;
  onClose: () => void;
  onSelectedIndustriesChange: React.Dispatch<React.SetStateAction<Set<string>>>;
  onSelectedInterestedIndustryChange: React.Dispatch<React.SetStateAction<string>>;
  onSelectedIntlBizChange: React.Dispatch<React.SetStateAction<string>>;
  onSelectedCategoriesChange: React.Dispatch<React.SetStateAction<Set<string>>>;
  onSelectedIdealReferralChange: React.Dispatch<React.SetStateAction<string>>;
  onShowDealsOnlyChange: React.Dispatch<React.SetStateAction<boolean>>;
  onSelectedSisterChapterChange: React.Dispatch<React.SetStateAction<string>>;
  onSelectedSisterCountryChange: React.Dispatch<React.SetStateAction<string>>;
  onSelectedSisterIndustryChange: React.Dispatch<React.SetStateAction<string>>;
}

export const BusinessDirectoryFilterDrawer: React.FC<BusinessDirectoryFilterDrawerProps> = ({
  isOpen,
  activeTab,
  businesses,
  filteredBusinessCount,
  activeFiltersCount,
  selectedIndustries,
  selectedInterestedIndustry,
  selectedIntlBiz,
  selectedCategories,
  selectedIdealReferral,
  showDealsOnly,
  uniqueIndustries,
  uniqueInterestedIndustries,
  uniqueIdealReferrals,
  sisterMembers,
  sisterChapters,
  sisterCountries,
  sisterIndustries,
  selectedSisterChapter,
  selectedSisterCountry,
  selectedSisterIndustry,
  onClose,
  onSelectedIndustriesChange,
  onSelectedInterestedIndustryChange,
  onSelectedIntlBizChange,
  onSelectedCategoriesChange,
  onSelectedIdealReferralChange,
  onShowDealsOnlyChange,
  onSelectedSisterChapterChange,
  onSelectedSisterCountryChange,
  onSelectedSisterIndustryChange,
}) => {
  const resetLocalFilters = () => {
    onSelectedIndustriesChange(new Set());
    onSelectedInterestedIndustryChange('All');
    onSelectedIntlBizChange('All');
    onSelectedCategoriesChange(new Set());
    onSelectedIdealReferralChange('All');
    onShowDealsOnlyChange(false);
  };

  return (
    <FilterDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={activeTab === 'local' ? 'Filter Local Businesses' : 'Filter Sister Chapters'}
      description={activeTab === 'local' ? 'Narrow down member business listings' : 'Narrow down sister chapter members'}
      applyLabel={`Show ${filteredBusinessCount} ${filteredBusinessCount === 1 ? 'Business' : 'Businesses'}`}
      showReset={activeFiltersCount > 0}
      resetLabel={`Reset all ${activeFiltersCount} filter${activeFiltersCount > 1 ? 's' : ''}`}
      onReset={resetLocalFilters}
    >
      {activeTab === 'local' ? (
        <div className="space-y-6">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Quick Filters</p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => onSelectedIntlBizChange(v => v === 'Yes' ? 'All' : 'Yes')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${selectedIntlBiz === 'Yes' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-600 border-slate-200'}`}
              >
                <Globe size={13} /> International
              </button>
              <button
                onClick={() => onSelectedIntlBizChange(v => v === 'Willing to Explore' ? 'All' : 'Willing to Explore')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${selectedIntlBiz === 'Willing to Explore' ? 'bg-sky-500 text-white border-sky-500' : 'bg-white text-slate-600 border-slate-200'}`}
              >
                <Globe size={13} /> Exploring
              </button>
              <button
                onClick={() => onShowDealsOnlyChange(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${showDealsOnly ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-200'}`}
              >
                <Gift size={13} /> Has Deal
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Industry</p>
              {selectedIndustries.size > 0 && (
                <button onClick={() => onSelectedIndustriesChange(new Set())} className="text-[10px] font-bold text-jci-blue hover:underline">Clear</button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {uniqueIndustries.filter(i => i !== 'All').map(ind => {
                const count = businesses.filter(b => b.industry === ind).length;
                const active = selectedIndustries.has(ind);
                return (
                  <button key={ind} onClick={() => onSelectedIndustriesChange(prev => { const n = new Set(prev); if (n.has(ind)) n.delete(ind); else n.add(ind); return n; })}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${active ? 'bg-jci-blue text-white border-jci-blue' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                    {ind}
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Business Category</p>
              {selectedCategories.size > 0 && (
                <button onClick={() => onSelectedCategoriesChange(new Set())} className="text-[10px] font-bold text-jci-blue hover:underline">Clear</button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {BUSINESS_CATEGORIES.map(cat => {
                const count = businesses.filter(b =>
                  (b.businessCategory || '').split(',').map(c => c.trim()).includes(cat)
                ).length;
                const active = selectedCategories.has(cat);
                return (
                  <button key={cat} onClick={() => onSelectedCategoriesChange(prev => { const n = new Set(prev); if (n.has(cat)) n.delete(cat); else n.add(cat); return n; })}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${active ? 'bg-jci-blue text-white border-jci-blue' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                    {cat}
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {uniqueInterestedIndustries.length > 1 && (
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Ideal Referral Industry</p>
              <div className="space-y-1">
                {uniqueInterestedIndustries.map(ind => {
                  const count = ind === 'All' ? businesses.length : businesses.filter(b => (b.interestedIndustries)?.includes(ind)).length;
                  const active = selectedInterestedIndustry === ind;
                  return (
                    <button key={ind} onClick={() => onSelectedInterestedIndustryChange(ind)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm border transition-colors ${active ? 'bg-sky-500 text-white border-sky-500 font-bold' : 'bg-white text-slate-700 border-slate-100 hover:border-slate-200 hover:bg-slate-50'}`}>
                      <span>{ind === 'All' ? 'All Industries' : ind}</span>
                      <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {uniqueIdealReferrals.length > 1 && (
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Ideal Referral Type</p>
              <div className="space-y-1">
                {uniqueIdealReferrals.map(ref => {
                  const count = ref === 'All' ? businesses.length : businesses.filter(b => (b.idealReferralTypes)?.includes(ref)).length;
                  const active = selectedIdealReferral === ref;
                  return (
                    <button key={ref} onClick={() => onSelectedIdealReferralChange(ref)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm border transition-colors ${active ? 'bg-rose-500 text-white border-rose-500 font-bold' : 'bg-white text-slate-700 border-slate-100 hover:border-slate-200 hover:bg-slate-50'}`}>
                      <span>{ref === 'All' ? 'All Types' : ref}</span>
                      <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Country</p>
            <div className="flex gap-2 flex-wrap">
              {sisterCountries.map(c => {
                const count = c === 'All' ? sisterMembers.length : sisterMembers.filter(m => m.country === c).length;
                const active = selectedSisterCountry === c;
                return (
                  <button key={c} onClick={() => onSelectedSisterCountryChange(c)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${active ? 'bg-jci-blue text-white border-jci-blue' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                    {c === 'All' ? 'All' : c}
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">JCI Chapter</p>
            <div className="space-y-1">
              {sisterChapters.map(ch => {
                const count = ch === 'All' ? sisterMembers.length : sisterMembers.filter(m => m.jciChapter === ch).length;
                const active = selectedSisterChapter === ch;
                return (
                  <button key={ch} onClick={() => onSelectedSisterChapterChange(ch)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm border transition-colors ${active ? 'bg-jci-blue text-white border-jci-blue font-bold' : 'bg-white text-slate-700 border-slate-100 hover:border-slate-200 hover:bg-slate-50'}`}>
                    <span>{ch === 'All' ? 'All Chapters' : ch}</span>
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Industry</p>
            <div className="space-y-1">
              {sisterIndustries.map(ind => {
                const count = ind === 'All' ? sisterMembers.length : sisterMembers.filter(m => m.industry === ind).length;
                const active = selectedSisterIndustry === ind;
                return (
                  <button key={ind} onClick={() => onSelectedSisterIndustryChange(ind)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm border transition-colors ${active ? 'bg-jci-blue text-white border-jci-blue font-bold' : 'bg-white text-slate-700 border-slate-100 hover:border-slate-200 hover:bg-slate-50'}`}>
                    <span>{ind === 'All' ? 'All Industries' : ind}</span>
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </FilterDrawer>
  );
};
