import React, { useMemo, useState } from 'react';
import { Gift, Globe, Network, Search, Send, SlidersHorizontal } from 'lucide-react';
import { Button } from '../../ui/Common';
import { Input } from '../../ui/Form';
import type { BusinessProfile } from '../../../types';
import { useSisterChapterMembers } from '../../../hooks/useSisterChapterMembers';
import { ShareCardNotice } from './ShareCardNotice';
import { BusinessDirectoryFilterDrawer } from './BusinessDirectoryFilterDrawer';
import { DirectoryFilterPanel } from './DirectoryFilterPanel';
import { SisterMemberDetailModal } from './SisterMemberDetailModal';
import { useDirectoryFilters } from './useDirectoryFilters';
import { cardToDirectoryItem, type DirectoryItem } from './directoryFacets';
import { getInitialsSvg } from './businessDirectoryUtils';

interface InternationalNetworkTabProps {
  /** Omit to hide Contact (externals have no inquiry flow). */
  onContact?: (biz: BusinessProfile) => void;
}

/** Card-only directory for externals (and anyone rendering it): same filter panel as the KL directory. */
export const InternationalNetworkTab: React.FC<InternationalNetworkTabProps> = ({ onContact }) => {
  const { members: rawMembers, canView, optIn, optingIn } = useSisterChapterMembers();
  const items = useMemo(() => rawMembers.map(card => cardToDirectoryItem(card, name => getInitialsSvg(name))), [rawMembers]);

  const [searchTerm, setSearchTerm] = useState('');
  const [detailItem, setDetailItem] = useState<DirectoryItem | null>(null);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const directory = useDirectoryFilters(items, searchTerm);
  const filteredMembers = directory.filtered;
  const activeFiltersCount = directory.activeCount;

  // Reciprocity: no card list until the viewer shares their own card (all hooks are above this line).
  if (!canView) return <ShareCardNotice onShare={optIn} sharing={optingIn} />;

  const getMappedBiz = (member: DirectoryItem): BusinessProfile => ({
    id: member.id, memberId: member.id,
    ownerName: member.name,
    companyName: member.company,
    industry: `${member.chapter} (${member.country})`,
    description: member.description, website: member.website,
    offer: member.dealSummary, logo: member.avatarUrl,
    idealReferralTypes: [],
    businessCategory: member.categories.join(', '), acceptsInternationalBusiness: 'Yes'
  });
  const contact = onContact ? (item: DirectoryItem) => onContact(getMappedBiz(item)) : undefined;

  return (
    <div className="space-y-2">
      {/* Mobile layout */}
      <div className="md:hidden space-y-2">
        <div className="flex gap-3 items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <div className="flex-1 min-w-0">
            <Input icon={<Search size={14} />} placeholder="Search name, company, chapter..."
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <Button variant={activeFiltersCount > 0 ? "secondary" : "outline"} size="sm"
            className="flex items-center gap-2 h-9 px-4 rounded-lg font-medium text-xs shadow-sm bg-white border-slate-200 shrink-0"
            onClick={() => setIsMobileFilterOpen(true)}>
            <SlidersHorizontal size={14} className={activeFiltersCount > 0 ? 'text-sky-600' : 'text-slate-500'} />
            <span>Filters</span>
            {activeFiltersCount > 0 && <span className="flex items-center justify-center bg-jci-blue text-white text-[10px] font-bold rounded-full w-5 h-5 ml-1">{activeFiltersCount}</span>}
          </Button>
        </div>
        {filteredMembers.length === 0 ? (
          <div className="text-center py-16 bg-white border border-slate-100 shadow-sm rounded-xl">
            <Network size={48} className="mx-auto mb-4 text-slate-300" />
            <h4 className="text-lg font-bold text-slate-900 mb-2">No Members Found</h4>
            <p className="text-slate-500 text-sm">Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white overflow-hidden">
            {filteredMembers.map(member => (
              <button key={member.key} type="button"
                className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                onClick={() => setDetailItem(member)}>
                <img src={member.avatarUrl} alt={member.name} className="w-11 h-11 rounded-full object-cover border border-slate-200 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-900 truncate">{member.name}</span>
                  <p className="text-xs text-slate-500 truncate">{[member.position, member.company].filter(Boolean).join(' · ')}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {member.categories.length > 0 && <span className="text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-100 px-1.5 py-0.5 rounded-full">{member.categories.join(', ')}</span>}
                    {member.hasDeal && <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Gift size={9} /> Deal</span>}
                    {member.country && <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded-full">{member.country}</span>}
                  </div>
                </div>
                <svg className="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Desktop: sidebar + card grid */}
      <div className="hidden md:flex gap-6 pt-2 items-start">
        <aside className="w-60 shrink-0 space-y-3 sticky top-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 dark:bg-slate-800 dark:border-slate-700">
            <p className="text-3xl font-black text-slate-900 dark:text-white">{filteredMembers.length}</p>
            <p className="text-xs text-slate-500 mt-0.5 dark:text-slate-400">
              {filteredMembers.length === items.length ? 'international partners' : `of ${items.length} partners`}
            </p>
            {activeFiltersCount > 0 && (
              <button onClick={directory.reset} className="mt-2 text-[10px] font-bold text-jci-blue hover:underline">
                Clear {activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''}
              </button>
            )}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 dark:bg-slate-800 dark:border-slate-700">
            <DirectoryFilterPanel
              variant="sidebar"
              filters={directory.filters}
              facets={directory.facets}
              toggleValue={directory.toggleValue}
              toggleFlag={directory.toggleFlag}
              clearSection={directory.clearSection}
            />
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex gap-3 items-center">
            <div className="flex-1">
              <Input icon={<Search size={14} />} placeholder="Search by name, company, chapter, industry, category…"
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            {searchTerm && <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600 text-lg leading-none shrink-0">×</button>}
          </div>

          {filteredMembers.length === 0 ? (
            <div className="text-center py-20 bg-white border border-slate-100 rounded-xl">
              <Network size={48} className="mx-auto mb-4 text-slate-300" />
              <h4 className="text-lg font-bold text-slate-900 mb-2">No Members Found</h4>
              <p className="text-slate-500 text-sm">Try adjusting your filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMembers.map(member => (
                <div key={member.key} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col group cursor-pointer"
                  onClick={() => setDetailItem(member)}>
                  {/* Header */}
                  <div className="p-4 flex gap-3 items-start border-b border-slate-50">
                    <img src={member.avatarUrl} alt={member.name} className="w-12 h-12 rounded-xl object-cover border border-slate-100 flex-shrink-0 shadow-sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-bold text-sm text-slate-900 truncate leading-tight">{member.name}</p>
                        {member.country && <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded shrink-0">{member.country}</span>}
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{member.position}</p>
                      <p className="text-xs font-semibold text-slate-700 truncate">{member.company}</p>
                      <p className="text-[10px] text-jci-blue font-bold truncate mt-0.5">{member.chapter}</p>
                    </div>
                  </div>
                  {/* Body */}
                  <div className="p-4 flex-1 flex flex-col gap-3">
                    <div className="flex flex-wrap gap-1.5">
                      {member.categories.length > 0 && <span className="text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-100 px-2 py-0.5 rounded-full">{member.categories.join(', ')}</span>}
                      {member.hasDeal && <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full flex items-center gap-0.5"><Gift size={9} /> Deal</span>}
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 flex-1 leading-relaxed">{member.description}</p>
                    {member.hasDeal && (
                      <div className="bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
                        <p className="text-[9px] font-black text-amber-700 uppercase tracking-wider mb-0.5 flex items-center gap-1"><Gift size={9} /> Sister Deal</p>
                        <p className="text-[11px] text-amber-800 line-clamp-2 leading-snug">{member.dealSummary}</p>
                      </div>
                    )}
                  </div>
                  {/* Footer */}
                  <div className="px-4 pb-4 flex gap-2">
                    <button disabled={!member.website} onClick={(e) => { e.stopPropagation(); window.open(member.website, '_blank', 'noopener'); }}
                      className="disabled:opacity-40 flex-1 border border-slate-200 text-slate-600 text-xs font-bold py-2 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5">
                      <Globe size={11} /> Website
                    </button>
                    {contact && <button onClick={(e) => { e.stopPropagation(); contact(member); }}
                      className="flex-1 bg-jci-blue text-white text-xs font-bold py-2 rounded-lg hover:bg-jci-blue/90 transition-colors flex items-center justify-center gap-1.5">
                      <Send size={11} /> Contact
                    </button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <BusinessDirectoryFilterDrawer
        isOpen={isMobileFilterOpen}
        onClose={() => setIsMobileFilterOpen(false)}
        state={directory}
        description="Narrow down member cards"
      />

      <SisterMemberDetailModal item={detailItem} onClose={() => setDetailItem(null)} onContact={contact} />
    </div>
  );
};
