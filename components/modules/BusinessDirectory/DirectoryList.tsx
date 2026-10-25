import React, { useState } from 'react';
import { Bookmark, Gift, Globe, LayoutList, Lock, Search, Send, SlidersHorizontal, Star } from 'lucide-react';
import { Button } from '../../ui/Common';
import { LoadingState } from '../../ui/Loading';
import { ShareCardNotice } from './ShareCardNotice';
import type { DirectoryItem } from './directoryFacets';

/** 0 = bookmarked, 1 = ideal match, 2 = everything else (list order and mobile tabs). */
export type DirectoryScore = 0 | 1 | 2;

interface DirectoryListProps {
  /** Filtered and sorted items (local businesses and sister-chapter member cards). */
  items: DirectoryItem[];
  /** Size of the unfiltered list (sidebar stats). */
  totalCount: number;
  loading: boolean;
  error?: string | null;
  isGuest: boolean;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  activeFiltersCount: number;
  onResetFilters: () => void;
  onFilterDrawerOpen: () => void;
  /** Desktop sidebar filter panel (the same panel the mobile drawer shows). */
  filterPanel: React.ReactNode;
  /** Reciprocity: the viewer cannot see sister cards yet; show a small banner offering to share. */
  showShareNotice: boolean;
  onShare: () => void;
  sharing: boolean;
  bookmarkedIds: Set<string>;
  getScore: (item: DirectoryItem) => DirectoryScore;
  onItemOpen: (item: DirectoryItem) => void;
  onGuestCta?: () => void;
  onBookmarkToggle: (event: React.MouseEvent, businessId: string) => void;
}

const chip = 'text-[10px] font-semibold border rounded-full';

/** Tags shared by the mobile row and the desktop card. */
const ItemTags: React.FC<{ item: DirectoryItem; size: 'row' | 'card' }> = ({ item, size }) => {
  const pad = size === 'row' ? 'px-1.5 py-0.5' : 'px-2 py-0.5';
  return (
    <>
      {item.source === 'sister' && <span className={`${chip} ${pad} bg-emerald-50 text-emerald-700 border-emerald-100`}>{item.chapter}{item.country ? ` · ${item.country}` : ''}</span>}
      {item.industry && <span className={`${chip} ${pad} bg-sky-50 text-sky-700 border-sky-100`}>{item.industry}</span>}
      {item.source === 'local' && item.acceptsInternationalBusiness && <span className={`${chip} ${pad} bg-emerald-50 text-emerald-700 border-emerald-100 flex items-center gap-0.5`}><Globe size={9} /> Intl</span>}
      {item.hasDeal && <span className={`${chip} ${pad} bg-amber-50 text-amber-700 border-amber-100 flex items-center gap-0.5`}><Gift size={9} /> Deal</span>}
    </>
  );
};

export const DirectoryList: React.FC<DirectoryListProps> = ({
  items,
  totalCount,
  loading,
  error,
  isGuest,
  searchTerm,
  onSearchTermChange,
  activeFiltersCount,
  onResetFilters,
  onFilterDrawerOpen,
  filterPanel,
  showShareNotice,
  onShare,
  sharing,
  bookmarkedIds,
  getScore,
  onItemOpen,
  onGuestCta,
  onBookmarkToggle,
}) => {
  const [quickFilter, setQuickFilter] = useState<'all' | 'bookmarked' | 'ideal'>('all');

  const mobileItems = isGuest ? items : quickFilter === 'bookmarked'
    ? items.filter(i => getScore(i) === 0)
    : quickFilter === 'ideal'
      ? items.filter(i => getScore(i) === 1)
      : items.filter(i => getScore(i) === 2);

  const bookmarkButton = (item: DirectoryItem, size: number, extraCls: string) => item.source === 'local' && (
    <button
      type="button"
      className={`flex-shrink-0 rounded-lg transition-colors hover:bg-slate-100 ${extraCls}`}
      onClick={(e) => onBookmarkToggle(e, item.id)}
      aria-label={bookmarkedIds.has(item.id) ? 'Remove bookmark' : 'Bookmark'}
    >
      <Bookmark size={size} className={bookmarkedIds.has(item.id) ? 'text-jci-blue fill-jci-blue' : 'text-slate-300 group-hover:text-slate-400'} />
    </button>
  );

  const shareBanner = showShareNotice && <ShareCardNotice compact onShare={onShare} sharing={sharing} />;

  return (
    <>
      <div className="md:hidden space-y-2">
        <div className="flex gap-3 items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <div className="relative flex-1 min-w-0">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, company, chapter..."
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
        {shareBanner}
        {/* Vertical icon sidebar + content panel */}
        {(() => {
          const TAB_CONFIG = [
            { id: 'all' as const, label: 'All', Icon: LayoutList },
            { id: 'bookmarked' as const, label: 'Bookmarked', Icon: Bookmark },
            { id: 'ideal' as const, label: 'Ideal', Icon: Star },
          ];
          const counts = {
            all: items.filter(i => getScore(i) === 2).length,
            bookmarked: items.filter(i => getScore(i) === 0).length,
            ideal: items.filter(i => getScore(i) === 1).length,
          };
          const activeLabel = TAB_CONFIG.find(t => t.id === quickFilter)?.label ?? 'All';
          return (
            <div className="flex rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              {!isGuest && (
                <div className="flex flex-col border-r border-slate-200 bg-slate-50 w-12 shrink-0">
                  {TAB_CONFIG.map((tab, i) => {
                    const isActive = quickFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        title={tab.label}
                        onClick={() => setQuickFilter(tab.id)}
                        className={`relative flex items-center justify-center py-5 w-full transition-all ${i > 0 ? 'border-t border-slate-200' : ''} ${isActive ? 'bg-white text-jci-blue' : 'text-slate-400 hover:text-slate-600 hover:bg-white/60'}`}
                      >
                        {isActive && (
                          <>
                            <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-jci-blue" />
                            <span className="absolute right-0 top-0 bottom-0 w-px bg-white" />
                          </>
                        )}
                        <tab.Icon size={15} className="shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex-1 min-w-0">
                {!isGuest && (
                  <div className="px-4 py-2.5 border-b border-slate-100 bg-white flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-700">{activeLabel}</span>
                    <span className="text-xs font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{counts[quickFilter]}</span>
                  </div>
                )}
                <LoadingState loading={loading} error={error} empty={mobileItems.length === 0} emptyMessage="No results found matching this category">
                  <div className="divide-y divide-slate-100 bg-white">
                    {mobileItems.map((item, idx) => {
                      const prevScore = idx > 0 ? getScore(mobileItems[idx - 1]) : -1;
                      const thisScore = getScore(item);
                      const showDivider = !isGuest && idx > 0 && thisScore > prevScore;
                      return (
                        <React.Fragment key={item.key}>
                          {showDivider && (
                            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-t border-slate-100">
                              <span className={`text-[10px] font-black uppercase tracking-widest ${thisScore === 1 ? 'text-sky-500' : 'text-slate-400'}`}>{thisScore === 1 ? 'Suggested for You' : 'All Results'}</span>
                            </div>
                          )}
                          <div
                            role="button"
                            tabIndex={0}
                            className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
                            onClick={() => onItemOpen(item)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onItemOpen(item); } }}
                          >
                            <img src={item.avatarUrl} alt={item.name} className="w-11 h-11 rounded-full object-cover border border-slate-200 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-bold text-slate-900 truncate">{item.name}</span>
                                {item.chineseName && <span className="text-xs text-slate-400 font-medium truncate hidden sm:inline">({item.chineseName})</span>}
                                {!isGuest && thisScore === 1 && <span className="ml-auto text-[10px] font-bold bg-violet-50 text-violet-600 border border-violet-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shrink-0">✦ Ideal</span>}
                              </div>
                              <p className="text-xs text-slate-500 truncate">{[item.position, item.company].filter(Boolean).join(' · ')}</p>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <ItemTags item={item} size="row" />
                              </div>
                            </div>
                            {isGuest
                              ? <Lock size={13} className="text-slate-300 flex-shrink-0" />
                              : item.source === 'local'
                                ? bookmarkButton(item, 16, 'p-1.5')
                                : <svg className="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>}
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </LoadingState>
              </div>
            </div>
          );
        })()}
      </div>

      <div className="hidden md:flex gap-6 pt-2 items-start">
        <aside className="w-60 shrink-0 space-y-3 sticky top-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 dark:bg-slate-800 dark:border-slate-700">
            <p className="text-3xl font-black text-slate-900 dark:text-white">{items.length}</p>
            <p className="text-xs text-slate-500 mt-0.5 dark:text-slate-400">
              {items.length === totalCount ? 'in the directory' : `of ${totalCount} in the directory`}
            </p>
            {activeFiltersCount > 0 && (
              <button onClick={onResetFilters} className="mt-2 text-[10px] font-bold text-jci-blue hover:underline">
                Clear {activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''}
              </button>
            )}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 dark:bg-slate-800 dark:border-slate-700">
            {filterPanel}
          </div>
        </aside>

        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex gap-3 items-center bg-white p-3 rounded-xl border border-slate-200">
            <Search size={15} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search by name, company, chapter, industry, category…"
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="flex-1 text-sm bg-transparent outline-none text-slate-800 placeholder-slate-400"
            />
            {searchTerm && (
              <button onClick={() => onSearchTermChange('')} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
            )}
          </div>

          {shareBanner}

          <LoadingState loading={loading} error={error} empty={items.length === 0} emptyMessage="No results found matching this filter">
            {!isGuest && items.length > 0 && (() => {
              const firstScore = getScore(items[0]);
              if (firstScore === 0) return <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Bookmark size={10} className="fill-slate-400 text-slate-400" /> Bookmarked</p>;
              if (firstScore === 1) return <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">✦ Suggested for You</p>;
              return null;
            })()}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item, idx) => {
                const prevScore = idx > 0 ? getScore(items[idx - 1]) : -1;
                const thisScore = getScore(item);
                const showDivider = !isGuest && idx > 0 && thisScore > prevScore;
                return (
                  <React.Fragment key={item.key}>
                    {showDivider && (
                      <div className="col-span-full flex items-center gap-3 pt-2">
                        <div className="flex-1 h-px bg-slate-200" />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${thisScore === 1 ? 'text-sky-500' : 'text-slate-400'}`}>{thisScore === 1 ? 'Suggested for You' : 'All Results'}</span>
                        <div className="flex-1 h-px bg-slate-200" />
                      </div>
                    )}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col group cursor-pointer"
                      onClick={() => onItemOpen(item)}>
                      <div className="p-4 flex gap-3 items-start border-b border-slate-50">
                        <img src={item.avatarUrl} alt={item.name} className="w-12 h-12 rounded-xl object-cover border border-slate-100 flex-shrink-0 shadow-sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-sm text-slate-900 truncate leading-tight">{item.name}</p>
                            {!isGuest && thisScore === 1 && <span className="ml-auto text-[10px] font-bold bg-violet-50 text-violet-600 border border-violet-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shrink-0">✦ Ideal</span>}
                          </div>
                          {item.chineseName && <p className="text-[11px] text-slate-400 truncate">{item.chineseName}</p>}
                          <p className="text-xs text-slate-500 truncate mt-0.5">{item.position}</p>
                          <p className="text-xs font-semibold text-slate-700 truncate">{item.company}</p>
                        </div>
                        {!isGuest && bookmarkButton(item, 15, 'p-1 -mt-0.5 -mr-0.5')}
                      </div>
                      <div className="p-4 flex-1 flex flex-col gap-3">
                        <div className="flex flex-wrap gap-1.5">
                          <ItemTags item={item} size="card" />
                        </div>
                        {item.description ? (
                          <p className="text-xs text-slate-500 line-clamp-2 flex-1 leading-relaxed">{item.description}</p>
                        ) : (
                          <p className="text-xs text-slate-300 italic flex-1">No description yet.</p>
                        )}
                        {item.hasDeal && (
                          <div className="bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
                            <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider mb-0.5 flex items-center gap-1"><Gift size={9} /> {item.source === 'local' ? 'Member Deal' : 'Sister Deal'}</p>
                            <p className="text-[11px] text-amber-800 line-clamp-2 leading-snug">{item.dealSummary}</p>
                          </div>
                        )}
                      </div>
                      {item.source === 'local' && (
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
                              onClick={(e) => { e.stopPropagation(); onItemOpen(item); }}
                            >
                              <Send size={11} /> Contact
                            </button>
                          )}
                        </div>
                      )}
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
