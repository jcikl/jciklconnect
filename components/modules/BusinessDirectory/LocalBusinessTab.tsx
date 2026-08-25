import React from 'react';
import { Bookmark, CheckSquare, Gift, Globe, Lock, Search, Send, SlidersHorizontal } from 'lucide-react';
import type { BusinessProfile, Member } from '../../../types';
import { Button } from '../../ui/Common';
import { LoadingState } from '../../ui/Loading';
import { getInitialsSvg } from './businessDirectoryUtils';

interface LocalBusinessTabProps {
  businesses: BusinessProfile[];
  filteredBusinesses: BusinessProfile[];
  members: Member[];
  loading: boolean;
  error?: string | null;
  isGuest: boolean;
  searchTerm: string;
  activeFiltersCount: number;
  selectedIndustries: Set<string>;
  selectedIntlBiz: string;
  showDealsOnly: boolean;
  uniqueIndustries: string[];
  bookmarkedIds: Set<string>;
  onSearchTermChange: React.Dispatch<React.SetStateAction<string>>;
  onFilterDrawerOpen: () => void;
  onBusinessOpen: (business: BusinessProfile) => void;
  onGuestCta?: () => void;
  onBookmarkToggle: (event: React.MouseEvent, businessId: string) => void;
  onSelectedIndustriesChange: React.Dispatch<React.SetStateAction<Set<string>>>;
  onSelectedInterestedIndustryChange: React.Dispatch<React.SetStateAction<string>>;
  onSelectedIntlBizChange: React.Dispatch<React.SetStateAction<string>>;
  onSelectedCategoriesChange: React.Dispatch<React.SetStateAction<Set<string>>>;
  onSelectedIdealReferralChange: React.Dispatch<React.SetStateAction<string>>;
  onShowDealsOnlyChange: React.Dispatch<React.SetStateAction<boolean>>;
  getBizScore: (business: BusinessProfile) => number;
}

export const LocalBusinessTab: React.FC<LocalBusinessTabProps> = ({
  businesses,
  filteredBusinesses,
  members,
  loading,
  error,
  isGuest,
  searchTerm,
  activeFiltersCount,
  selectedIndustries,
  selectedIntlBiz,
  showDealsOnly,
  uniqueIndustries,
  bookmarkedIds,
  onSearchTermChange,
  onFilterDrawerOpen,
  onBusinessOpen,
  onGuestCta,
  onBookmarkToggle,
  onSelectedIndustriesChange,
  onSelectedInterestedIndustryChange,
  onSelectedIntlBizChange,
  onSelectedCategoriesChange,
  onSelectedIdealReferralChange,
  onShowDealsOnlyChange,
  getBizScore,
}) => {
  const resetFilters = () => {
    onSelectedIndustriesChange(new Set());
    onSelectedIntlBizChange('All');
    onSelectedCategoriesChange(new Set());
    onSelectedInterestedIndustryChange('All');
    onSelectedIdealReferralChange('All');
    onShowDealsOnlyChange(false);
  };

  const toggleIndustry = (industry: string) => {
    onSelectedIndustriesChange(prev => {
      const next = new Set(prev);
      if (next.has(industry)) next.delete(industry);
      else next.add(industry);
      return next;
    });
  };

  const getBusinessOwner = (business: BusinessProfile) => {
    const ownerMember = members.find(m => m.id === business.memberId);
    return {
      avatarUrl: ownerMember?.general?.avatarUrl || getInitialsSvg(business.ownerName || ''),
      chineseName: ownerMember?.general?.chineseName,
      position: ownerMember?.business?.position || 'Representative',
    };
  };

  return (
    <>
      <div className="md:hidden space-y-2">
        <div className="flex gap-3 items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search local businesses..."
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="pl-9 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20"
            />
          </div>
          <Button
            variant={activeFiltersCount > 0 ? "secondary" : "outline"}
            size="sm"
            className="flex items-center gap-2 !min-h-0 py-2 px-4 rounded-lg font-medium text-xs shadow-sm bg-white border-slate-200 shrink-0"
            onClick={onFilterDrawerOpen}
          >
            <SlidersHorizontal size={14} className={activeFiltersCount > 0 ? 'text-sky-600' : 'text-slate-500'} />
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <span className="flex items-center justify-center bg-jci-blue text-white text-[10px] font-bold rounded-full w-5 h-5 ml-1">
                {activeFiltersCount}
              </span>
            )}
          </Button>
        </div>
        <LoadingState loading={loading} error={error} empty={filteredBusinesses.length === 0} emptyMessage="No businesses found matching this category">
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white overflow-hidden">
            {filteredBusinesses.map((biz, idx) => {
              const prevMobileScore = idx > 0 ? getBizScore(filteredBusinesses[idx - 1]) : -1;
              const thisMobileScore = getBizScore(biz);
              const showMobileDivider = !isGuest && idx > 0 && thisMobileScore > prevMobileScore;
              const mobileDividerLabel = thisMobileScore === 1 ? 'Suggested for You' : 'All Businesses';
              const mobileDividerStyle = thisMobileScore === 1 ? 'text-sky-500' : 'text-slate-400';
              const { avatarUrl, chineseName, position } = getBusinessOwner(biz);
              const intlStatus = biz.acceptsInternationalBusiness;
              return (
                <React.Fragment key={biz.id}>
                  {showMobileDivider && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-t border-slate-100">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${mobileDividerStyle}`}>{mobileDividerLabel}</span>
                    </div>
                  )}
                  <div
                    role="button"
                    tabIndex={0}
                    className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
                    onClick={() => onBusinessOpen(biz)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onBusinessOpen(biz); } }}
                  >
                    <img src={avatarUrl} alt={biz.ownerName} className="w-11 h-11 rounded-full object-cover border border-slate-200 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-slate-900 truncate">{biz.ownerName}</span>
                        {chineseName && <span className="text-xs text-slate-400 font-medium truncate hidden sm:inline">({chineseName})</span>}
                        {!isGuest && getBizScore(biz) === 1 && <span className="ml-auto text-[10px] font-bold bg-violet-50 text-violet-600 border border-violet-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shrink-0">✦ Ideal</span>}
                      </div>
                      <p className="text-xs text-slate-500 truncate">{position} · {biz.companyName}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {biz.industry && <span className="text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-100 px-1.5 py-0.5 rounded-full">{biz.industry}</span>}
                        {biz.offer && <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Gift size={9} /> Deal</span>}
                        {(intlStatus === 'Yes' || intlStatus === true) && <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Globe size={9} /> Intl</span>}
                      </div>
                    </div>
                    {isGuest
                      ? <Lock size={13} className="text-slate-300 flex-shrink-0" />
                      : (
                        <button
                          type="button"
                          className="flex-shrink-0 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                          onClick={(e) => onBookmarkToggle(e, biz.id)}
                          aria-label={bookmarkedIds.has(biz.id) ? 'Remove bookmark' : 'Bookmark'}
                        >
                          <Bookmark
                            size={16}
                            className={bookmarkedIds.has(biz.id) ? 'text-jci-blue fill-jci-blue' : 'text-slate-300'}
                          />
                        </button>
                      )
                    }
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </LoadingState>
      </div>

      <div className="hidden md:flex gap-6 pt-2 items-start">
        <aside className="w-52 shrink-0 space-y-3 sticky top-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-3xl font-black text-slate-900">{filteredBusinesses.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {filteredBusinesses.length === businesses.length ? 'local businesses' : `of ${businesses.length} businesses`}
            </p>
            {activeFiltersCount > 0 && (
              <button
                onClick={resetFilters}
                className="mt-2 text-[10px] font-bold text-jci-blue hover:underline"
              >
                Clear {activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''}
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Quick Filters</p>
            <button
              onClick={() => onSelectedIntlBizChange(selectedIntlBiz === 'Yes' ? 'All' : 'Yes')}
              className={`w-full text-left text-xs px-3 py-2 rounded-lg border flex items-center gap-2 font-semibold transition-colors ${selectedIntlBiz === 'Yes' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
            >
              <Globe size={12} /> International
            </button>
            <button
              onClick={() => onShowDealsOnlyChange(v => !v)}
              className={`w-full text-left text-xs px-3 py-2 rounded-lg border flex items-center gap-2 font-semibold transition-colors ${showDealsOnly ? 'bg-amber-50 text-amber-700 border-amber-200' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
            >
              <Gift size={12} /> Has Member Deal
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Industry</p>
              {selectedIndustries.size > 0 && (
                <button onClick={() => onSelectedIndustriesChange(new Set())} className="text-[10px] font-bold text-jci-blue hover:underline">Clear</button>
              )}
            </div>
            <div className="space-y-0.5 max-h-72 overflow-y-auto">
              {uniqueIndustries.filter(i => i !== 'All').map(ind => {
                const active = selectedIndustries.has(ind);
                return (
                  <button key={ind}
                    onClick={() => toggleIndustry(ind)}
                    className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${active ? 'bg-jci-blue text-white font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>
                    {active && <CheckSquare size={11} className="shrink-0" />}
                    {ind}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex gap-3 items-center bg-white p-3 rounded-xl border border-slate-200">
            <Search size={15} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search by name, company, industry…"
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="flex-1 text-sm bg-transparent outline-none text-slate-800 placeholder-slate-400"
            />
            {searchTerm && (
              <button onClick={() => onSearchTermChange('')} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
            )}
          </div>

          <LoadingState loading={loading} error={error} empty={filteredBusinesses.length === 0} emptyMessage="No businesses found matching this filter">
            {!isGuest && filteredBusinesses.length > 0 && (() => {
              const firstScore = getBizScore(filteredBusinesses[0]);
              if (firstScore === 0) return <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Bookmark size={10} className="fill-slate-400 text-slate-400" /> Bookmarked</p>;
              if (firstScore === 1) return <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">✦ Suggested for You</p>;
              return null;
            })()}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBusinesses.map((biz, idx) => {
                const prevScore = idx > 0 ? getBizScore(filteredBusinesses[idx - 1]) : -1;
                const thisScore = getBizScore(biz);
                const showDivider = !isGuest && idx > 0 && thisScore > prevScore;
                const dividerLabel = thisScore === 1 ? 'Suggested for You' : 'All Businesses';
                const dividerStyle = thisScore === 1 ? 'text-sky-500' : 'text-slate-400';
                const { avatarUrl, chineseName, position } = getBusinessOwner(biz);
                const intlStatus = biz.acceptsInternationalBusiness;
                return (
                  <React.Fragment key={biz.id}>
                    {showDivider && (
                      <div className="col-span-full flex items-center gap-3 pt-2">
                        <div className="flex-1 h-px bg-slate-200" />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${dividerStyle}`}>{dividerLabel}</span>
                        <div className="flex-1 h-px bg-slate-200" />
                      </div>
                    )}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col group cursor-pointer"
                      onClick={() => onBusinessOpen(biz)}>
                      <div className="p-4 flex gap-3 items-start border-b border-slate-50">
                        <img src={avatarUrl} alt={biz.ownerName} className="w-12 h-12 rounded-xl object-cover border border-slate-100 flex-shrink-0 shadow-sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-sm text-slate-900 truncate leading-tight">{biz.ownerName}</p>
                            {!isGuest && getBizScore(biz) === 1 && <span className="ml-auto text-[10px] font-bold bg-violet-50 text-violet-600 border border-violet-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shrink-0">✦ Ideal</span>}
                          </div>
                          {chineseName && <p className="text-[11px] text-slate-400 truncate">{chineseName}</p>}
                          <p className="text-xs text-slate-500 truncate mt-0.5">{position}</p>
                          <p className="text-xs font-semibold text-slate-700 truncate">{biz.companyName}</p>
                        </div>
                        {!isGuest && (
                          <button
                            type="button"
                            className="flex-shrink-0 p-1 rounded-lg hover:bg-slate-100 transition-colors -mt-0.5 -mr-0.5"
                            onClick={(e) => onBookmarkToggle(e, biz.id)}
                            aria-label={bookmarkedIds.has(biz.id) ? 'Remove bookmark' : 'Bookmark'}
                          >
                            <Bookmark
                              size={15}
                              className={bookmarkedIds.has(biz.id) ? 'text-jci-blue fill-jci-blue' : 'text-slate-300 group-hover:text-slate-400'}
                            />
                          </button>
                        )}
                      </div>
                      <div className="p-4 flex-1 flex flex-col gap-3">
                        <div className="flex flex-wrap gap-1.5">
                          {biz.industry && <span className="text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-100 px-2 py-0.5 rounded-full">{biz.industry}</span>}
                          {(intlStatus === 'Yes' || intlStatus === true) && <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-0.5"><Globe size={9} /> Intl</span>}
                          {biz.offer && <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full flex items-center gap-0.5"><Gift size={9} /> Deal</span>}
                        </div>
                        {biz.description ? (
                          <p className="text-xs text-slate-500 line-clamp-2 flex-1 leading-relaxed">{biz.description}</p>
                        ) : (
                          <p className="text-xs text-slate-300 italic flex-1">No description yet.</p>
                        )}
                        {biz.offer && (
                          <div className="bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
                            <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider mb-0.5 flex items-center gap-1"><Gift size={9} /> Member Deal</p>
                            <p className="text-[11px] text-amber-800 line-clamp-2 leading-snug">{biz.offer}</p>
                          </div>
                        )}
                      </div>
                      <div className="px-4 pb-4">
                        {isGuest ? (
                          <button
                            className="w-full bg-slate-100 text-slate-400 text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 relative overflow-hidden group/lock"
                            onClick={(e) => { e.stopPropagation(); onGuestCta?.(); }}
                          >
                            <span className="absolute inset-0 bg-jci-blue/0 group-hover/lock:bg-jci-blue/5 transition-colors" />
                            <Lock size={10} className="text-slate-400 group-hover/lock:text-jci-blue transition-colors" />
                            <span className="group-hover/lock:text-jci-blue transition-colors">Join to Contact</span>
                          </button>
                        ) : (
                          <button
                            className="w-full bg-jci-blue text-white text-xs font-bold py-2 rounded-lg hover:bg-jci-blue/90 transition-colors flex items-center justify-center gap-1.5"
                            onClick={(e) => { e.stopPropagation(); onBusinessOpen(biz); }}
                          >
                            <Send size={11} /> Contact
                          </button>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </LoadingState>
        </div>
      </div>
    </>
  );
};
