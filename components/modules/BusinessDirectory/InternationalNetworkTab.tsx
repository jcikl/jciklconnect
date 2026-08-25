import React, { useMemo, useState } from 'react';
import { Gift, Globe, Network, Search, Send, SlidersHorizontal } from 'lucide-react';
import { Button, Modal } from '../../ui/Common';
import { Input } from '../../ui/Form';
import type { BusinessProfile, SpecialOffer } from '../../../types';
import { getSpecialOfferSummary, hasSpecialOffer } from '../../../types/member';
import { useSisterChapterMembers } from '../../../hooks/useSisterChapterMembers';
import type { SisterChapterMember } from '../../../hooks/useSisterChapterMembers';
// International Network Tab Component
type IntlMemberView = {
  id: string;
  name: string;
  chineseName?: string;
  avatarUrl: string;
  jciChapter: string;
  flagEmoji?: string;
  country: string;
  companyName: string;
  industry: string;
  businessCategory: string;
  position: string;
  email: string;
  description: string;
  specialOffer: SpecialOffer | string | undefined;
};

function toIntlView(m: SisterChapterMember): IntlMemberView {
  return {
    id: m.id,
    name: m.general?.name ?? '',
    chineseName: m.general?.chineseName,
    avatarUrl: m.general?.avatarUrl ?? '',
    jciChapter: m.sisterChapter.name,
    flagEmoji: m.sisterChapter.flagEmoji,
    country: m.sisterChapter.country,
    companyName: m.business?.companyName ?? (m as any).companyName ?? '',
    industry: m.business?.industry ?? (m as any).industry ?? '',
    businessCategory: (m.business?.businessCategory ?? []).join(', '),
    position: m.business?.position ?? '',
    email: m.contact?.email ?? '',
    description: m.business?.companyDescription ?? (m.business as any)?.introduction ?? '',
    specialOffer: m.business?.specialOffer,
  };
}

interface InternationalNetworkTabProps {
  onContact: (biz: BusinessProfile) => void;
}

export const InternationalNetworkTab: React.FC<InternationalNetworkTabProps> = ({ onContact }) => {
  const { members: rawMembers, loading: membersLoading } = useSisterChapterMembers();
  const views = useMemo(() => rawMembers.map(toIntlView), [rawMembers]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('All');
  const [selectedCountry, setSelectedCountry] = useState('All');
  const [selectedIndustry, setSelectedIndustry] = useState('All');
  const [showDealsOnly, setShowDealsOnly] = useState(false);
  const [detailMember, setDetailMember] = useState<IntlMemberView | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  const allChapters = useMemo(() => ['All', ...Array.from(new Set(views.map(m => m.jciChapter)))], [views]);
  const allCountries = useMemo(() => ['All', ...Array.from(new Set(views.map(m => m.country)))], [views]);
  const allIndustries = useMemo(() => ['All', ...Array.from(new Set(views.map(m => m.industry).filter(Boolean)))], [views]);

  const activeFiltersCount = useMemo(() => {
    let n = 0;
    if (selectedChapter !== 'All') n++;
    if (selectedCountry !== 'All') n++;
    if (selectedIndustry !== 'All') n++;
    if (showDealsOnly) n++;
    return n;
  }, [selectedChapter, selectedCountry, selectedIndustry, showDealsOnly]);

  const clearFilters = () => { setSelectedChapter('All'); setSelectedCountry('All'); setSelectedIndustry('All'); setShowDealsOnly(false); };

  const filteredMembers = useMemo(() => {
    return views.filter(member => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = !term ||
        member.name.toLowerCase().includes(term) ||
        (member.chineseName && member.chineseName.toLowerCase().includes(term)) ||
        member.companyName.toLowerCase().includes(term) ||
        member.jciChapter.toLowerCase().includes(term) ||
        member.description.toLowerCase().includes(term) ||
        member.businessCategory.toLowerCase().includes(term);
      return matchesSearch &&
        (selectedChapter === 'All' || member.jciChapter === selectedChapter) &&
        (selectedCountry === 'All' || member.country === selectedCountry) &&
        (selectedIndustry === 'All' || member.industry === selectedIndustry) &&
        (!showDealsOnly || hasSpecialOffer(member.specialOffer));
    });
  }, [views, searchTerm, selectedChapter, selectedCountry, selectedIndustry, showDealsOnly]);

  const getMappedBiz = (member: IntlMemberView): BusinessProfile => ({
    id: member.id, memberId: member.id,
    ownerName: member.chineseName ? `${member.name} (${member.chineseName})` : member.name,
    companyName: member.companyName,
    industry: `${member.jciChapter} (${member.country})`,
    description: member.description, website: member.email,
    offer: getSpecialOfferSummary(member.specialOffer), logo: member.avatarUrl,
    internationalPartnershipTypes: [],
    businessCategory: member.businessCategory, acceptsInternationalBusiness: 'Yes'
  });

  return (
    <div className="space-y-2">
      {/* â”€â”€ Mobile layout â”€â”€ */}
      <div className="md:hidden space-y-2">
        <div className="flex gap-3 items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <div className="flex-1">
            <Input icon={<Search size={14} />} placeholder="Search sister chapter members..."
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
              <button key={member.id} type="button"
                className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                onClick={() => { setDetailMember(member); setIsDetailOpen(true); }}>
                {member.avatarUrl ? (
                  <img src={member.avatarUrl} alt={member.name} className="w-11 h-11 rounded-full object-cover border border-slate-200 flex-shrink-0" />
                ) : (
                  <div className="w-11 h-11 rounded-full border border-slate-200 flex-shrink-0 bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-400">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-900 truncate">{member.name}</span>
                    {member.chineseName && member.chineseName !== member.name && <span className="text-xs text-slate-400 font-medium truncate hidden sm:inline">({member.chineseName})</span>}
                  </div>
                  <p className="text-xs text-slate-500 truncate">{member.position} · {member.companyName}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-100 px-1.5 py-0.5 rounded-full">{member.businessCategory}</span>
                    {hasSpecialOffer(member.specialOffer) && <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Gift size={9} /> Deal</span>}
                    <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded-full">{member.country}</span>
                  </div>
                </div>
                <svg className="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* â”€â”€ Desktop: sidebar + card grid â”€â”€ */}
      <div className="hidden md:flex gap-6 pt-2 items-start">
        {/* Sidebar */}
        <aside className="w-52 shrink-0 space-y-3 sticky top-4">
          {/* Stats */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-3xl font-black text-slate-900">{filteredMembers.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {filteredMembers.length === views.length ? 'international partners' : `of ${views.length} partners`}
            </p>
            {activeFiltersCount > 0 && (
              <button onClick={clearFilters} className="mt-2 text-[10px] font-bold text-jci-blue hover:underline">
                Clear {activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''}
              </button>
            )}
          </div>

          {/* Quick filters */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Quick Filters</p>
            <button onClick={() => setShowDealsOnly(v => !v)}
              className={`w-full text-left text-xs px-3 py-2 rounded-lg border flex items-center gap-2 font-semibold transition-colors ${showDealsOnly ? 'bg-amber-50 text-amber-700 border-amber-200' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>
              <Gift size={12} /> Has Sister Deal
            </button>
          </div>

          {/* Country filter */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Country</p>
            <div className="space-y-0.5">
              {allCountries.map(c => (
                <button key={c} onClick={() => setSelectedCountry(c)}
                  className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg transition-colors ${selectedCountry === c ? 'bg-jci-blue text-white font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Industry filter */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Industry</p>
            <div className="space-y-0.5 max-h-48 overflow-y-auto">
              {allIndustries.map(ind => (
                <button key={ind} onClick={() => setSelectedIndustry(ind)}
                  className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg transition-colors ${selectedIndustry === ind ? 'bg-jci-blue text-white font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>
                  {ind}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex gap-3 items-center">
            <div className="flex-1">
              <Input icon={<Search size={14} />} placeholder="Search by name, company, chapter, industry…"
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
                <div key={member.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col group cursor-pointer"
                  onClick={() => { setDetailMember(member); setIsDetailOpen(true); }}>
                  {/* Header */}
                  <div className="p-4 flex gap-3 items-start border-b border-slate-50">
                    {member.avatarUrl ? (
                    <img src={member.avatarUrl} alt={member.name} className="w-12 h-12 rounded-xl object-cover border border-slate-100 flex-shrink-0 shadow-sm" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-100 flex-shrink-0 shadow-sm flex items-center justify-center text-lg font-bold text-slate-400">{member.flagEmoji || member.name.charAt(0)}</div>
                  )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-bold text-sm text-slate-900 truncate leading-tight">{member.name}</p>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded shrink-0">{member.country}</span>
                      </div>
                      {member.chineseName && member.chineseName !== member.name && <p className="text-[11px] text-slate-400 truncate">{member.chineseName}</p>}
                      <p className="text-xs text-slate-500 truncate mt-0.5">{member.position}</p>
                      <p className="text-xs font-semibold text-slate-700 truncate">{member.companyName}</p>
                      <p className="text-[10px] text-jci-blue font-bold truncate mt-0.5">{member.jciChapter}</p>
                    </div>
                  </div>
                  {/* Body */}
                  <div className="p-4 flex-1 flex flex-col gap-3">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-100 px-2 py-0.5 rounded-full">{member.businessCategory}</span>
                      {hasSpecialOffer(member.specialOffer) && <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full flex items-center gap-0.5"><Gift size={9} /> Deal</span>}
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 flex-1 leading-relaxed">{member.description}</p>
                    {hasSpecialOffer(member.specialOffer) && (
                      <div className="bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
                        <p className="text-[9px] font-black text-amber-700 uppercase tracking-wider mb-0.5 flex items-center gap-1"><Gift size={9} /> Sister Deal</p>
                        <p className="text-[11px] text-amber-800 line-clamp-2 leading-snug">{getSpecialOfferSummary(member.specialOffer)}</p>
                      </div>
                    )}
                  </div>
                  {/* Footer */}
                  <div className="px-4 pb-4 flex gap-2">
                    <button onClick={(e) => { e.stopPropagation(); window.open(`mailto:${member.email}?subject=JCI KL Collaboration Inquiry`, '_blank'); }}
                      className="flex-1 border border-slate-200 text-slate-600 text-xs font-bold py-2 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5">
                      <Globe size={11} /> Email
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onContact(getMappedBiz(member)); }}
                      className="flex-1 bg-jci-blue text-white text-xs font-bold py-2 rounded-lg hover:bg-jci-blue/90 transition-colors flex items-center justify-center gap-1.5">
                      <Send size={11} /> Contact
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]" onClick={() => setIsMobileFilterOpen(false)} />
      )}
      <div className={`fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl z-[60] flex flex-col transform transition-transform duration-300 ${isMobileFilterOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">Filter Sister Chapters</h3>
            <p className="text-xs text-slate-400 mt-0.5">Narrow down sister chapter members</p>
          </div>
          <button onClick={() => setIsMobileFilterOpen(false)} className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-50 rounded-full text-xl font-bold">×</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-6">
            {/* Quick Filters */}
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Quick Filters</p>
              <button onClick={() => setShowDealsOnly(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${showDealsOnly ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-200'}`}>
                <Gift size={13} /> Has Sister Deal
              </button>
            </div>

            {/* Country — pill group */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Country</p>
                {selectedCountry !== 'All' && (
                  <button onClick={() => setSelectedCountry('All')} className="text-[10px] font-bold text-jci-blue hover:underline">Clear</button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {allCountries.filter(c => c !== 'All').map(c => {
                  const count = views.filter(m => m.country === c).length;
                  const active = selectedCountry === c;
                  return (
                    <button key={c} onClick={() => setSelectedCountry(active ? 'All' : c)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${active ? 'bg-jci-blue text-white border-jci-blue' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                      {c}
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Chapter — pill group */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">JCI Chapter</p>
                {selectedChapter !== 'All' && (
                  <button onClick={() => setSelectedChapter('All')} className="text-[10px] font-bold text-jci-blue hover:underline">Clear</button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {allChapters.filter(c => c !== 'All').map(c => {
                  const count = views.filter(m => m.jciChapter === c).length;
                  const active = selectedChapter === c;
                  return (
                    <button key={c} onClick={() => setSelectedChapter(active ? 'All' : c)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${active ? 'bg-jci-blue text-white border-jci-blue' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                      {c}
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Industry — pill group */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Industry</p>
                {selectedIndustry !== 'All' && (
                  <button onClick={() => setSelectedIndustry('All')} className="text-[10px] font-bold text-jci-blue hover:underline">Clear</button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {allIndustries.filter(i => i !== 'All').map(i => {
                  const count = views.filter(m => m.industry === i).length;
                  const active = selectedIndustry === i;
                  return (
                    <button key={i} onClick={() => setSelectedIndustry(active ? 'All' : i)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${active ? 'bg-jci-blue text-white border-jci-blue' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                      {i}
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <div className="shrink-0 bg-white border-t border-slate-100">
          <div className="px-5 pt-4 pb-10">
            <button
              onClick={() => setIsMobileFilterOpen(false)}
              className="w-full bg-jci-blue text-white font-black py-4 rounded-2xl text-sm shadow-lg shadow-jci-blue/25 active:scale-[0.98] transition-transform"
            >
              Show {filteredMembers.length} {filteredMembers.length === 1 ? 'Member' : 'Members'}
            </button>
            {activeFiltersCount > 0 && (
              <button
                onClick={() => { clearFilters(); }}
                className="w-full mt-3 text-slate-400 text-xs font-semibold hover:text-slate-600 transition-colors py-1"
              >
                Reset all {activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* International member detail drawer (mobile) */}
      {detailMember && (
        <Modal
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          title={detailMember.companyName}
          drawerOnMobile
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img src={detailMember.avatarUrl} alt={detailMember.name} className="w-14 h-14 rounded-full object-cover border border-slate-200 flex-shrink-0" />
              <div>
                <div className="font-bold text-slate-900">{detailMember.name}{detailMember.chineseName && detailMember.chineseName !== detailMember.name && <span className="text-sm text-slate-500 font-normal ml-1">({detailMember.chineseName})</span>}</div>
                <div className="text-sm text-slate-500">{detailMember.position} · {detailMember.companyName}</div>
                <div className="text-xs text-jci-blue font-bold mt-0.5">{detailMember.jciChapter} · {detailMember.country}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-100 px-2 py-1 rounded-full">{detailMember.businessCategory}</span>
              {hasSpecialOffer(detailMember.specialOffer) && <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100 px-2 py-1 rounded-full flex items-center gap-0.5"><Gift size={9} /> Deal</span>}
            </div>
            {detailMember.description && <p className="text-sm text-slate-600 leading-relaxed">{detailMember.description}</p>}
            {hasSpecialOffer(detailMember.specialOffer) && (
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
                <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider flex items-center gap-1 mb-1"><Gift size={11} /> Sister Chapter Deal</span>
                <p className="text-sm font-semibold text-amber-900 leading-snug">{getSpecialOfferSummary(detailMember.specialOffer)}</p>
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-4 border-t border-slate-100 mt-4">
            <Button variant="outline" size="sm" className="flex-1"
              onClick={() => window.open(`mailto:${detailMember.email}?subject=JCI KL Collaboration Inquiry`, '_blank')}>
              <Globe size={14} className="mr-2" /> Email
            </Button>
            <Button variant="primary" size="sm" className="flex-1 bg-jci-blue text-white"
              onClick={() => {
                setIsDetailOpen(false);
                const mappedBiz: BusinessProfile = {
                  id: detailMember.id, memberId: detailMember.id,
                  ownerName: detailMember.chineseName ? `${detailMember.name} (${detailMember.chineseName})` : detailMember.name,
                  companyName: detailMember.companyName,
                  industry: `${detailMember.jciChapter} (${detailMember.country})`,
                  description: detailMember.description, website: detailMember.email,
                  offer: getSpecialOfferSummary(detailMember.specialOffer), logo: detailMember.avatarUrl,
                  internationalPartnershipTypes: [],
                  businessCategory: detailMember.businessCategory, acceptsInternationalBusiness: 'Yes'
                };
                onContact(mappedBiz);
              }}>
              <Send size={14} className="mr-2" /> Contact
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
};
