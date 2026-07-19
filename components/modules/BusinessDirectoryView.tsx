import React, { useState, useMemo, useEffect } from 'react';
import { Building2, Globe, Search, Send, MapPin, Users, Network, Gift, SlidersHorizontal, CheckSquare, Square, Lock, Bookmark } from 'lucide-react';

const BUSINESS_CATEGORIES = [
  'Service Provider',
  'Retailer / E-Commerce',
  'Manufacturer / Producer',
  'Distributor / Exporter / Importer',
];
import { Card, Button, Badge, Modal, useToast, Tabs } from '../ui/Common';
import { MembersOnlyOverlay } from '../ui/MembersOnlyOverlay';
import { LoadingState } from '../ui/Loading';
import { useBusinessDirectory } from '../../hooks/useBusinessDirectory';
import { useMembers } from '../../hooks/useMembers';
import { BusinessProfile } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { Input, Textarea, Select } from '../ui/Form';
import { submitInquiry } from '../../services/inquiryService';

// Generate an inline SVG data URI with initials — avoids external ui-avatars.com requests blocked by CSP.
// Uses encodeURIComponent instead of btoa so Unicode names (Chinese, Malay, etc.) don't crash.
const getInitialsSvg = (name: string, size = 44): string => {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#0097D7" rx="${size / 2}"/><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="white" font-family="sans-serif" font-size="${Math.round(size * 0.4)}px">${initials}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

// DEV MOCK: These Unsplash URLs will fail under CSP in production. Replace with Firebase Storage URLs or locally-bundled placeholders.
const MOCK_SISTER_CHAPTER_MEMBERS = [
  {
    id: "scm1",
    name: "Kenji Tanaka",
    chineseName: "ç”°ä¸­ å¥äºŒ",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=120",
    jciChapter: "JCI Nagoya",
    country: "Japan",
    companyName: "Tanaka Technologies Inc.",
    industry: "Technology",
    businessCategory: "Software Development",
    position: "CEO",
    email: "kenji.tanaka@jci-nagoya.org",
    phone: "+81 90-1234-5678",
    description: "Leading provider of industrial IoT solutions, automated production line software, and custom AI integrations for Japanese manufacturers.",
    collaborationNeeds: ["Distributors in Malaysia", "Smart factory partners"],
    specialOffer: "15% off initial system design and integration fees for JCI KL members."
  },
  {
    id: "scm2",
    name: "Maria Santos",
    chineseName: "Maria Santos",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=120",
    jciChapter: "JCI Mandaue",
    country: "Philippines",
    companyName: "Santos Agri-Export Corp",
    industry: "Agriculture",
    businessCategory: "Food Processing & Export",
    position: "Managing Director",
    email: "maria.santos@jci-mandaue.org",
    phone: "+63 917-555-4321",
    description: "Premium tropical fruit processing and export. Specializing in organic dried mangoes, coconut flour, and freeze-dried exotic fruits.",
    collaborationNeeds: ["Southeast Asian importers", "Supermarket distributors"],
    specialOffer: "Free branding customization and sample kits for JCI member orders over $5,000."
  },
  {
    id: "scm3",
    name: "Christopher Chen",
    chineseName: "é™ˆå¿—è±ª",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=120",
    jciChapter: "JCI Orchid",
    country: "Singapore",
    companyName: "Orchid Wealth Advisory",
    industry: "Finance",
    businessCategory: "Wealth Management",
    position: "Senior Partner",
    email: "chris.chen@jci-orchid.org",
    phone: "+65 9876 5432",
    description: "Bespoke wealth management, offshore family office setup, and corporate cross-border tax planning strategies for regional businesses.",
    collaborationNeeds: ["Malaysian law firms", "SME founders expanding to SG"],
    specialOffer: "Complimentary 45-minute family office structuring consultation and tax health check."
  },
  {
    id: "scm4",
    name: "Irene Hsu",
    chineseName: "å¾å¥•é›¯",
    avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=120",
    jciChapter: "JCI E-Metro",
    country: "Taiwan",
    companyName: "Green Horizon E-Commerce",
    industry: "E-Commerce",
    businessCategory: "Eco-Friendly Consumer Goods",
    position: "Founder",
    email: "irene.hsu@jci-emetro.org",
    phone: "+886 912 345 678",
    description: "E-commerce store and wholesale distributor of bio-degradable lifestyle goods, organic skincare, and zero-waste household items.",
    collaborationNeeds: ["Zero-waste retail distributors", "Malaysian packaging manufacturers"],
    specialOffer: "10% storewide discount and free shipping for bulk eco-packaging orders."
  },
  {
    id: "scm5",
    name: "David Lim",
    chineseName: "æž—è€€ç¥–",
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=120",
    jciChapter: "JCI City",
    country: "Singapore",
    companyName: "Apex Creative Agency",
    industry: "Creative & Design",
    businessCategory: "Branding & UI/UX Design",
    position: "Creative Director",
    email: "david.lim@jci-city.org",
    phone: "+65 8123 4567",
    description: "Award-winning creative studio delivering high-end corporate re-branding, custom web interfaces, and digital advertising campaigns.",
    collaborationNeeds: ["IT development companies", "PR agencies in Malaysia"],
    specialOffer: "20% discount on first branding package or design project for JCI LOs and their members."
  }
];

export const BusinessDirectoryView: React.FC<{ searchQuery?: string; initialSelectedBusinessId?: string | null; onClearSelection?: () => void; isGuest?: boolean; onGuestCta?: () => void }> = ({ searchQuery, initialSelectedBusinessId, onClearSelection, isGuest = false, onGuestCta }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBiz, setSelectedBiz] = useState<BusinessProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'local' | 'international'>('local');
  const [selectedIndustries, setSelectedIndustries] = useState<Set<string>>(new Set());
  const [selectedInterestedIndustry, setSelectedInterestedIndustry] = useState<string>('All');
  const [selectedIntlBiz, setSelectedIntlBiz] = useState<string>('All');
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedIdealReferral, setSelectedIdealReferral] = useState<string>('All');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [showDealsOnly, setShowDealsOnly] = useState(false);

  // Sister Chapter Filters States
  const [selectedSisterChapter, setSelectedSisterChapter] = useState<string>('All');
  const [selectedSisterCountry, setSelectedSisterCountry] = useState<string>('All');
  const [selectedSisterIndustry, setSelectedSisterIndustry] = useState<string>('All');

  // Extract unique filter options for sister chapters
  const sisterChapters = useMemo(() => ['All', ...Array.from(new Set(MOCK_SISTER_CHAPTER_MEMBERS.map(m => m.jciChapter)))], []);
  const sisterCountries = useMemo(() => ['All', ...Array.from(new Set(MOCK_SISTER_CHAPTER_MEMBERS.map(m => m.country)))], []);
  const sisterIndustries = useMemo(() => ['All', ...Array.from(new Set(MOCK_SISTER_CHAPTER_MEMBERS.map(m => m.industry)))], []);

  const sisterFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedSisterChapter !== 'All') count++;
    if (selectedSisterCountry !== 'All') count++;
    if (selectedSisterIndustry !== 'All') count++;
    return count;
  }, [selectedSisterChapter, selectedSisterCountry, selectedSisterIndustry]);

  const [detailBiz, setDetailBiz] = useState<BusinessProfile | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isInquiryModalOpen, setInquiryModalOpen] = useState(false);
  const [inquiryForm, setInquiryForm] = useState({
    name: '',
    jobTitle: '',
    company: '',
    phone: '',
    requirements: ''
  });
  const [inquiryErrors, setInquiryErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { businesses, loading, error } = useBusinessDirectory();
  const { members } = useMembers();
  const { showToast } = useToast();
  const { member: currentUser, updateMemberProfile } = useAuth();

  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  const idealReferralsSet = useMemo(() => {
    const raw = currentUser?.idealReferralIndustry ?? '';
    return new Set(
      raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    );
  }, [currentUser?.id, currentUser?.idealReferralIndustry]);

  const getBizScore = (biz: { id: string; industry?: string }): 0 | 1 | 2 => {
    if (bookmarkedIds.has(biz.id)) return 0;
    if (idealReferralsSet.size > 0 && biz.industry && idealReferralsSet.has(biz.industry.toLowerCase())) return 1;
    return 2;
  };

  useEffect(() => {
    if (currentUser?.bookmarkedBusinessIds) {
      setBookmarkedIds(new Set(currentUser.bookmarkedBusinessIds));
    }
  }, [currentUser?.id]);

  const toggleBookmark = async (e: React.MouseEvent, bizId: string) => {
    e.stopPropagation();
    if (!currentUser) return;
    const next = new Set(bookmarkedIds);
    if (next.has(bizId)) next.delete(bizId); else next.add(bizId);
    setBookmarkedIds(next);
    try {
      await updateMemberProfile({ bookmarkedBusinessIds: Array.from(next) });
    } catch {
      setBookmarkedIds(bookmarkedIds);
      showToast('Failed to update bookmark', 'error');
    }
  };

  useEffect(() => {
    if (initialSelectedBusinessId && businesses.length > 0) {
      const bizToSelect = businesses.find(b => b.id === initialSelectedBusinessId);
      if (bizToSelect) {
        setSelectedBiz(bizToSelect);
        setInquiryForm({
          name: currentUser?.name || '',
          jobTitle: currentUser?.business?.position || '',
          company: currentUser?.companyName || '',
          phone: currentUser?.phone || '',
          requirements: ''
        });
        setInquiryErrors({});
        setInquiryModalOpen(true);
        if (onClearSelection) onClearSelection();
      }
    }
  }, [initialSelectedBusinessId, businesses, currentUser, onClearSelection]);

  const uniqueIndustries = useMemo(() => {
    const industries = new Set(businesses.map(b => b.industry).filter(Boolean));
    return ['All', ...Array.from(industries).sort()];
  }, [businesses]);

  const uniqueInterestedIndustries = useMemo(() => {
    const industries = new Set<string>();
    businesses.forEach(b => {
      const interestedIndustries = b.interestedIndustries;
      if (interestedIndustries) {
        interestedIndustries.forEach(ind => industries.add(ind));
      }
    });
    return ['All', ...Array.from(industries).sort()];
  }, [businesses]);

  const uniqueIdealReferrals = useMemo(() => {
    const referrals = new Set<string>();
    businesses.forEach(b => {
      const idealReferralTypes = b.idealReferralTypes;
      if (idealReferralTypes) {
        idealReferralTypes.forEach(ref => referrals.add(ref));
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
      filtered = filtered.filter(biz => selectedIndustries.has(biz.industry));
    }
    if (selectedInterestedIndustry !== 'All') {
      filtered = filtered.filter(biz => {
        const interestedIndustries = biz.interestedIndustries;
        return interestedIndustries && interestedIndustries.includes(selectedInterestedIndustry);
      });
    }
    if (selectedIntlBiz !== 'All') {
      filtered = filtered.filter(biz => {
        const val = biz.acceptsInternationalBusiness;
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
      filtered = filtered.filter(biz => {
        const bizCats = (biz.businessCategory || '').split(',').map(c => c.trim());
        return [...selectedCategories].some(sc => bizCats.includes(sc));
      });
    }
    if (selectedIdealReferral !== 'All') {
      filtered = filtered.filter(biz => {
        const idealReferralTypes = biz.idealReferralTypes;
        return idealReferralTypes && idealReferralTypes.includes(selectedIdealReferral);
      });
    }

    if (showDealsOnly) {
      filtered = filtered.filter(biz => !!biz.offer);
    }

    const term = (searchQuery || searchTerm).toLowerCase();
    const result = term
      ? filtered.filter(biz =>
        (biz.companyName ?? '').toLowerCase().includes(term) ||
        (biz.ownerName ?? '').toLowerCase().includes(term) ||
        (biz.industry ?? '').toLowerCase().includes(term) ||
        (biz.description ?? '').toLowerCase().includes(term) ||
        (biz.businessCategory ?? '').toLowerCase().includes(term)
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

  const handleContact = () => {
    // Auto-fill form from current user info
    setInquiryForm({
      name: currentUser?.name || '',
      jobTitle: currentUser?.business?.position || '',
      company: currentUser?.companyName || '',
      phone: currentUser?.phone || '',
      requirements: ''
    });
    setInquiryErrors({});
    setInquiryModalOpen(true);
  };

  const handleSendInquiry = async () => {
    const errors: Record<string, string> = {};
    if (!inquiryForm.name.trim()) errors.name = 'Name is required';
    if (!inquiryForm.phone.trim()) errors.phone = 'Phone number is required';
    if (!inquiryForm.requirements.trim()) errors.requirements = 'Requirements are required';

    if (Object.keys(errors).length > 0) {
      setInquiryErrors(errors);
      return;
    }

    if (!selectedBiz || !currentUser) return;
    setIsSubmitting(true);

    try {
      // Find recipient member to get phone + WhatsApp group status
      const recipient = members.find(m => m.id === selectedBiz.memberId);
      const recipientPhone =
        recipient?.contact?.phone || recipient?.phone || '';
      const recipientInGroup =
        recipient?.whatsappGroup ?? recipient?.whatsappJoined ?? recipient?.contact?.whatsappJoined ?? false;
      const senderInGroup =
        currentUser.whatsappGroup ?? currentUser.whatsappJoined ?? currentUser.contact?.whatsappJoined ?? false;

      const { channel, waUrl } = await submitInquiry({
        senderId: currentUser.id,
        senderName: inquiryForm.name,
        senderPhone: inquiryForm.phone,
        senderJobTitle: inquiryForm.jobTitle || undefined,
        senderCompany: inquiryForm.company || undefined,
        senderInGroup,
        recipientId: selectedBiz.memberId,
        recipientName: selectedBiz.ownerName,
        recipientPhone,
        recipientInGroup,
        businessId: selectedBiz.id,
        businessName: selectedBiz.companyName,
        requirements: inquiryForm.requirements,
      });

      setInquiryModalOpen(false);
      setSelectedBiz(null);

      if (channel === 'whatsapp_direct' && waUrl) {
        window.open(waUrl, '_blank', 'noopener,noreferrer');
        showToast('Opening WhatsApp — your message is pre-filled!', 'success');
      } else if (channel === 'whapi_bot') {
        showToast('Inquiry sent! The member and admin will be notified via WhatsApp.', 'success');
      } else {
        showToast('Inquiry recorded. Admin has been notified via WhatsApp.', 'success');
      }
    } catch (err) {
      console.error('Inquiry submission error:', err);
      showToast('Failed to send inquiry. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Logged-in GUEST role: mask the directory like the Benefits page (public guest landing page uses isGuest prop instead)
  const isGuestRole = !isGuest && (currentUser?.role || '') === 'GUEST';

  return (
    <div className={`space-y-2 relative${isGuestRole ? ' pt-px' : ''}`}>
      {isGuestRole && (
        <MembersOnlyOverlay
          description="The member business directory is exclusive to JCI Kuala Lumpur members. Join us to connect with local businesses and the global JCI network."
          member={currentUser}
        />
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Member Business Directory</h2>
          <p className="text-slate-500">Support local member businesses and global JCI network connections.</p>
        </div>
      </div>

      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex-shrink-0">
            <Tabs
              tabs={[{id: 'local', label: 'Local Businesses'}, {id: 'international', label: 'International Network'}]}
              activeTab={activeTab}
              onTabChange={(tab) => setActiveTab(tab as typeof activeTab)}
              mobileFallback="pill"
              className="border-none"
            />
          </div>

          <div className="flex items-center gap-3 justify-end" />
        </div>

        <div className="bg-transparent">
          {activeTab === 'local' ? (
            <>
              {/* â”€â”€ Mobile: compact list rows â”€â”€ */}
              <div className="md:hidden space-y-2">
                <div className="flex gap-3 items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search local businesses..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20"
                    />
                  </div>
                  <Button
                    variant={activeFiltersCount > 0 ? "secondary" : "outline"}
                    size="sm"
                    className="flex items-center gap-2 !min-h-0 py-2 px-4 rounded-lg font-medium text-xs shadow-sm bg-white border-slate-200 shrink-0"
                    onClick={() => setIsFilterDrawerOpen(true)}
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
                      const ownerMember = members.find(m => m.id === biz.memberId);
                      const avatarUrl = ownerMember?.avatarUrl || ownerMember?.general?.avatarUrl || ownerMember?.avatar || getInitialsSvg(biz.ownerName || '');
                      const chineseName = ownerMember?.general?.chineseName;
                      const position = ownerMember?.business?.position || 'Representative';
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
                            onClick={() => { setDetailBiz(biz); setIsDetailOpen(true); }}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailBiz(biz); setIsDetailOpen(true); } }}>
                            <img src={avatarUrl} alt={biz.ownerName} className="w-11 h-11 rounded-full object-cover border border-slate-200 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-bold text-slate-900 truncate">{biz.ownerName}</span>
                                {chineseName && <span className="text-xs text-slate-400 font-medium truncate hidden sm:inline">({chineseName})</span>}
                                {!isGuest && getBizScore(biz) === 1 && <span className="ml-auto text-[10px] font-bold bg-violet-50 text-violet-600 border border-violet-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shrink-0">âœ¦ Ideal</span>}
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
                                  onClick={(e) => toggleBookmark(e, biz.id)}
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

              {/* â”€â”€ Desktop: sidebar + card grid â”€â”€ */}
              <div className="hidden md:flex gap-6 pt-2 items-start">
                {/* Left sidebar */}
                <aside className="w-52 shrink-0 space-y-3 sticky top-4">
                  {/* Stats card */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <p className="text-3xl font-black text-slate-900">{filteredBusinesses.length}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {filteredBusinesses.length === businesses.length ? 'local businesses' : `of ${businesses.length} businesses`}
                    </p>
                    {activeFiltersCount > 0 && (
                      <button
                        onClick={() => { setSelectedIndustries(new Set()); setSelectedIntlBiz('All'); setSelectedCategories(new Set()); setSelectedInterestedIndustry('All'); setSelectedIdealReferral('All'); setShowDealsOnly(false); }}
                        className="mt-2 text-[10px] font-bold text-jci-blue hover:underline"
                      >
                        Clear {activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''}
                      </button>
                    )}
                  </div>

                  {/* Quick filters */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Quick Filters</p>
                    <button
                      onClick={() => setSelectedIntlBiz(selectedIntlBiz === 'Yes' ? 'All' : 'Yes')}
                      className={`w-full text-left text-xs px-3 py-2 rounded-lg border flex items-center gap-2 font-semibold transition-colors ${selectedIntlBiz === 'Yes' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
                    >
                      <Globe size={12} /> International
                    </button>
                    <button
                      onClick={() => setShowDealsOnly(v => !v)}
                      className={`w-full text-left text-xs px-3 py-2 rounded-lg border flex items-center gap-2 font-semibold transition-colors ${showDealsOnly ? 'bg-amber-50 text-amber-700 border-amber-200' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
                    >
                      <Gift size={12} /> Has Member Deal
                    </button>
                  </div>

                  {/* Industry filter */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Industry</p>
                      {selectedIndustries.size > 0 && (
                        <button onClick={() => setSelectedIndustries(new Set())} className="text-[10px] font-bold text-jci-blue hover:underline">Clear</button>
                      )}
                    </div>
                    <div className="space-y-0.5 max-h-72 overflow-y-auto">
                      {uniqueIndustries.filter(i => i !== 'All').map(ind => {
                        const active = selectedIndustries.has(ind);
                        return (
                          <button key={ind}
                            onClick={() => setSelectedIndustries(prev => { const n = new Set(prev); if (n.has(ind)) n.delete(ind); else n.add(ind); return n; })}
                            className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${active ? 'bg-jci-blue text-white font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>
                            {active && <CheckSquare size={11} className="shrink-0" />}
                            {ind}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </aside>

                {/* Main content */}
                <div className="flex-1 min-w-0 space-y-4">
                  {/* Search bar */}
                  <div className="flex gap-3 items-center bg-white p-3 rounded-xl border border-slate-200">
                    <Search size={15} className="text-slate-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Search by name, company, industry…"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="flex-1 text-sm bg-transparent outline-none text-slate-800 placeholder-slate-400"
                    />
                    {searchTerm && (
                      <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
                    )}
                  </div>

                  {/* Card grid */}
                  <LoadingState loading={loading} error={error} empty={filteredBusinesses.length === 0} emptyMessage="No businesses found matching this filter">
                    {!isGuest && filteredBusinesses.length > 0 && (() => {
                      const firstScore = getBizScore(filteredBusinesses[0]);
                      if (firstScore === 0) return <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Bookmark size={10} className="fill-slate-400 text-slate-400" /> Bookmarked</p>;
                      if (firstScore === 1) return <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">âœ¦ Suggested for You</p>;
                      return null;
                    })()}
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredBusinesses.map((biz, idx) => {
                        const prevScore = idx > 0 ? getBizScore(filteredBusinesses[idx - 1]) : -1;
                        const thisScore = getBizScore(biz);
                        const showDivider = !isGuest && idx > 0 && thisScore > prevScore;
                        const dividerLabel = thisScore === 1 ? 'Suggested for You' : 'All Businesses';
                        const dividerStyle = thisScore === 1 ? 'text-sky-500' : 'text-slate-400';
                        const ownerMember = members.find(m => m.id === biz.memberId);
                        const avatarUrl = ownerMember?.avatarUrl || ownerMember?.general?.avatarUrl || ownerMember?.avatar || getInitialsSvg(biz.ownerName || '');
                        const chineseName = ownerMember?.general?.chineseName;
                        const position = ownerMember?.business?.position || 'Representative';
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
                              onClick={() => { setDetailBiz(biz); setIsDetailOpen(true); }}>
                              {/* Card header */}
                              <div className="p-4 flex gap-3 items-start border-b border-slate-50">
                                <img src={avatarUrl} alt={biz.ownerName} className="w-12 h-12 rounded-xl object-cover border border-slate-100 flex-shrink-0 shadow-sm" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <p className="font-bold text-sm text-slate-900 truncate leading-tight">{biz.ownerName}</p>
                                    {!isGuest && getBizScore(biz) === 1 && <span className="ml-auto text-[10px] font-bold bg-violet-50 text-violet-600 border border-violet-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shrink-0">âœ¦ Ideal</span>}
                                  </div>
                                  {chineseName && <p className="text-[11px] text-slate-400 truncate">{chineseName}</p>}
                                  <p className="text-xs text-slate-500 truncate mt-0.5">{position}</p>
                                  <p className="text-xs font-semibold text-slate-700 truncate">{biz.companyName}</p>
                                </div>
                                {!isGuest && (
                                  <button
                                    type="button"
                                    className="flex-shrink-0 p-1 rounded-lg hover:bg-slate-100 transition-colors -mt-0.5 -mr-0.5"
                                    onClick={(e) => toggleBookmark(e, biz.id)}
                                    aria-label={bookmarkedIds.has(biz.id) ? 'Remove bookmark' : 'Bookmark'}
                                  >
                                    <Bookmark
                                      size={15}
                                      className={bookmarkedIds.has(biz.id) ? 'text-jci-blue fill-jci-blue' : 'text-slate-300 group-hover:text-slate-400'}
                                    />
                                  </button>
                                )}
                              </div>
                              {/* Card body */}
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
                              {/* Card footer */}
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
                                    onClick={(e) => { e.stopPropagation(); setDetailBiz(biz); setIsDetailOpen(true); }}
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
          ) : (
            <InternationalNetworkTab
              onContact={(biz) => {
                setSelectedBiz(biz);
                setInquiryForm({
                  name: currentUser?.name || '',
                  jobTitle: currentUser?.business?.position || '',
                  company: currentUser?.companyName || '',
                  phone: currentUser?.phone || '',
                  requirements: ''
                });
                setInquiryErrors({});
                setInquiryModalOpen(true);
              }}
            />
          )}
        </div>
      </div>



      {/* Business Detail Drawer */}
      {detailBiz && (
        <Modal
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          title={detailBiz.companyName}
          drawerOnMobile
          size="lg"
          footer={
            <div className="flex gap-3 w-full">
              {detailBiz.website && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => window.open(detailBiz.website.startsWith('http') ? detailBiz.website : `https://${detailBiz.website}`, '_blank')}
                >
                  <Globe size={14} className="mr-2" /> Website
                </Button>
              )}
              <Button
                variant="primary"
                className="flex-1 bg-jci-blue text-white"
                onClick={() => {
                  setIsDetailOpen(false);
                  setSelectedBiz(detailBiz);
                  setInquiryForm({ name: currentUser?.name || '', jobTitle: currentUser?.business?.position || '', company: currentUser?.companyName || '', phone: currentUser?.phone || '', requirements: '' });
                  setInquiryErrors({});
                  setInquiryModalOpen(true);
                }}
              >
                <Send size={14} className="mr-2" /> Contact
              </Button>
            </div>
          }
        >
          {(() => {
            const biz = detailBiz;
            const ownerMember = members.find(m => m.id === biz.memberId);
            const avatarUrl = ownerMember?.avatarUrl || ownerMember?.general?.avatarUrl || ownerMember?.avatar || getInitialsSvg(biz.ownerName || '');
            const chineseName = ownerMember?.general?.chineseName;
            const position = ownerMember?.business?.position || 'Representative';
            const intlStatus = biz.acceptsInternationalBusiness;
            return (
              <div className="space-y-5">
                {/* Header */}
                <div className="flex items-center gap-4">
                  <img src={avatarUrl} alt={biz.ownerName} className="w-16 h-16 rounded-full object-cover border border-slate-200 flex-shrink-0 shadow-sm" />
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-slate-900">{biz.ownerName}{chineseName && <span className="text-sm text-slate-400 font-normal ml-1">({chineseName})</span>}</h3>
                    <p className="text-sm text-slate-500">{position} · {biz.companyName}</p>
                    <p className="text-xs text-jci-blue font-bold mt-0.5">JCI Kuala Lumpur</p>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  {biz.industry && <Badge variant="info" className="text-xs">{biz.industry}</Badge>}
                  {(intlStatus === 'Yes') && <Badge variant="success" className="text-xs">Accepts International Business</Badge>}
                  {intlStatus === 'Willing to Explore' && <Badge variant="warning" className="text-xs">Exploring International Business</Badge>}
                  {(!intlStatus || intlStatus === 'No') && <Badge variant="neutral" className="text-xs">Local Business Only</Badge>}
                </div>

                {/* Description */}
                {biz.description ? (
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">About</p>
                    <p className="text-sm text-slate-600 leading-relaxed">{biz.description}</p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">No company description provided yet.</p>
                )}

                {/* Ideal Referral */}
                {(() => {
                  const idealReferralTypes = biz.idealReferralTypes;
                  return idealReferralTypes && idealReferralTypes.length > 0 ? (
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Ideal Referral</p>
                      <div className="flex flex-wrap gap-1.5">
                        {idealReferralTypes.map(ref => (
                          <span key={ref} className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold border border-blue-100">{ref}</span>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* Member Deal */}
                {biz.offer && (
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                    <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                      <Gift size={11} /> JCI Member Deal
                    </p>
                    <p className="text-sm font-semibold text-amber-900 leading-snug">{biz.offer}</p>
                  </div>
                )}
              </div>
            );
          })()}
        </Modal>
      )}

      {/* Inquiry Form Modal / Business Profile */}
      <Modal
        isOpen={isInquiryModalOpen}
        onClose={() => setInquiryModalOpen(false)}
        title={selectedBiz ? selectedBiz.companyName : 'Inquiry'}
        drawerOnMobile
        size="2xl"
      >
        <div className={selectedBiz ? "grid md:grid-cols-2 gap-6" : "space-y-4"}>
          {/* Left Column: Business Info */}
          {selectedBiz && (
            <div className="space-y-4 border-b md:border-b-0 md:border-r border-slate-100 pb-6 md:pb-0 md:pr-6">
              <div className="flex items-start gap-4 mb-4 mt-2">
                <img
                  src={selectedBiz.logo || getInitialsSvg(selectedBiz.companyName || '')}
                  alt={selectedBiz.companyName}
                  className="w-16 h-16 rounded-lg object-cover border border-slate-200 shadow-sm"
                />
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">{selectedBiz.ownerName}</h3>
                  <p className="text-sm text-slate-500 font-medium truncate">{selectedBiz.companyName}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <Badge variant="neutral" className="text-[10px] px-1.5 py-0">{selectedBiz.industry}</Badge>
                    {selectedBiz.website && (
                      <a
                        href={selectedBiz.website.startsWith('http') ? selectedBiz.website : `https://${selectedBiz.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-jci-blue hover:text-sky-600 hover:underline flex items-center gap-1 font-black uppercase tracking-widest transition-colors"
                      >
                        <Globe size={10} /> Visit Site
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4 text-sm mt-2">
                <div>
                  <span className="font-bold text-slate-700 block mb-1 uppercase text-[10px] tracking-widest">About</span>
                  <p className="text-slate-600 leading-relaxed min-h-[60px]">{selectedBiz.description || 'No description provided.'}</p>
                </div>

                {/* Categories */}
                <div className="pt-3 border-t border-slate-50">
                  <span className="font-bold text-slate-700 block mb-2 uppercase text-[10px] tracking-widest">Categories</span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedBiz.businessCategory ? (
                      selectedBiz.businessCategory.split(', ').map((cat, idx) => (
                        <Badge key={idx} variant="info" className="bg-blue-50/50 text-blue-600 border border-blue-100">{cat}</Badge>
                      ))
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">No specific categories listed</span>
                    )}
                  </div>
                </div>

                {/* Seeking Partnerships */}
                <div className="pt-3 border-t border-slate-50">
                  <span className="font-bold text-slate-700 block mb-2 uppercase text-[10px] tracking-widest">Seeking Partnerships</span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedBiz.internationalPartnershipTypes && selectedBiz.internationalPartnershipTypes.length > 0 ? (
                      selectedBiz.internationalPartnershipTypes.map((type, idx) => (
                        <Badge key={idx} variant="neutral" className="bg-sky-50/50 text-sky-600 border border-sky-100 font-bold">{type}</Badge>
                      ))
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Open to all partnership opportunities</span>
                    )}
                  </div>
                </div>

                {/* Interested Industries */}
                <div className="pt-3 border-t border-slate-50">
                  <span className="font-bold text-slate-700 block mb-2 uppercase text-[10px] tracking-widest">Interested Industries</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(() => {
                      const owner = members.find(m => m.id === selectedBiz.memberId);
                      const industries = owner?.business?.interestedIndustries ?? owner?.interestedIndustries;
                      return (Array.isArray(industries) && industries.length > 0) ? (
                        industries.map((ind: string, idx: number) => (
                          <Badge key={idx} variant="neutral" className="bg-purple-50/50 text-purple-600 border border-purple-100 font-bold">{ind}</Badge>
                        ))
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Exploring various industries and connections</span>
                      );
                    })()}
                  </div>
                </div>

                {selectedBiz.offer && (
                  <div className="mt-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100/50 rounded-xl p-4 shadow-inner">
                    <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                      JCI Member Deal
                    </span>
                    <p className="text-slate-700 font-medium leading-relaxed">{selectedBiz.offer}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Right Column: Inquiry Form */}
          <div className="flex flex-col h-full">
            <div className="flex-1 space-y-4">
              {selectedBiz ? (
                <div className="mb-4 mt-2">
                  <h4 className="font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                    <Send size={18} className="text-jci-blue" /> Submit Inquiry
                  </h4>
                  <p className="text-xs text-slate-500 mt-3 font-medium">
                    Please fill in your details and requirements. The business owner will contact you shortly.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-500 mb-4">
                  Please fill in your details and requirements. The business owner will contact you shortly.
                </p>
              )}

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <label className="w-20 sm:w-28 pt-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest shrink-0">Name <span className="text-red-500">*</span></label>
                  <div className="flex-1">
                    <Input
                      placeholder="Your full name"
                      value={inquiryForm.name}
                      error={inquiryErrors.name}
                      onChange={(e) => setInquiryForm({ ...inquiryForm, name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <label className="w-20 sm:w-28 pt-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest shrink-0">Job Title</label>
                  <div className="flex-1">
                    <Input
                      placeholder="E.g. Managing Director (optional)"
                      value={inquiryForm.jobTitle}
                      onChange={(e) => setInquiryForm({ ...inquiryForm, jobTitle: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <label className="w-20 sm:w-28 pt-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest shrink-0">Company</label>
                  <div className="flex-1">
                    <Input
                      placeholder="Your company name (optional)"
                      value={inquiryForm.company}
                      onChange={(e) => setInquiryForm({ ...inquiryForm, company: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <label className="w-20 sm:w-28 pt-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest shrink-0">Phone <span className="text-red-500">*</span></label>
                  <div className="flex-1">
                    <Input
                      placeholder="E.g. +60123456789"
                      value={inquiryForm.phone}
                      error={inquiryErrors.phone}
                      onChange={(e) => setInquiryForm({ ...inquiryForm, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Requirements <span className="text-red-500">*</span></label>
                  <Textarea
                    placeholder="What products or services are you looking for?"
                    value={inquiryForm.requirements}
                    error={inquiryErrors.requirements}
                    onChange={(e) => setInquiryForm({ ...inquiryForm, requirements: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white pt-4 pb-2 border-t border-slate-100 mt-6 z-10 flex gap-3">
              <Button
                variant="outline"
                className="flex-1 font-bold"
                onClick={() => setInquiryModalOpen(false)}
              >
                Cancel
              </Button>
              <Button className="flex-1 font-bold shadow-lg shadow-jci-blue/20" onClick={handleSendInquiry} disabled={isSubmitting}>
                <Send size={16} className="mr-2" /> {isSubmitting ? 'Sending…' : 'Send Inquiry'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Filter Drawer Overlay */}
      {isFilterDrawerOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] transition-opacity duration-300"
          onClick={() => setIsFilterDrawerOpen(false)}
        />
      )}

      {/* Filter Drawer Content */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-[60] flex flex-col transform transition-transform duration-300 ${isFilterDrawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}>
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">
              {activeTab === 'local' ? 'Filter Local Businesses' : 'Filter Sister Chapters'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeTab === 'local' ? 'Narrow down member business listings' : 'Narrow down sister chapter members'}
            </p>
          </div>
          <button
            onClick={() => setIsFilterDrawerOpen(false)}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 hover:bg-slate-50 rounded-full"
          >
            <span className="text-xl font-bold">×</span>
          </button>
        </div>

        {/* Drawer Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'local' ? (
            <div className="p-5 space-y-6">

              {/* Quick Toggles */}
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Quick Filters</p>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setSelectedIntlBiz(v => v === 'Yes' ? 'All' : 'Yes')}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${selectedIntlBiz === 'Yes' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-600 border-slate-200'}`}
                  >
                    <Globe size={13} /> International
                  </button>
                  <button
                    onClick={() => setSelectedIntlBiz(v => v === 'Willing to Explore' ? 'All' : 'Willing to Explore')}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${selectedIntlBiz === 'Willing to Explore' ? 'bg-sky-500 text-white border-sky-500' : 'bg-white text-slate-600 border-slate-200'}`}
                  >
                    <Globe size={13} /> Exploring
                  </button>
                  <button
                    onClick={() => setShowDealsOnly(v => !v)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${showDealsOnly ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-200'}`}
                  >
                    <Gift size={13} /> Has Deal
                  </button>
                </div>
              </div>

              {/* Industry — multi-select pills */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Industry</p>
                  {selectedIndustries.size > 0 && (
                    <button onClick={() => setSelectedIndustries(new Set())} className="text-[10px] font-bold text-jci-blue hover:underline">Clear</button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {uniqueIndustries.filter(i => i !== 'All').map(ind => {
                    const count = businesses.filter(b => b.industry === ind).length;
                    const active = selectedIndustries.has(ind);
                    return (
                      <button key={ind} onClick={() => setSelectedIndustries(prev => { const n = new Set(prev); if (n.has(ind)) n.delete(ind); else n.add(ind); return n; })}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${active ? 'bg-jci-blue text-white border-jci-blue' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                        {ind}
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Business Category — multi-select pills */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Business Category</p>
                  {selectedCategories.size > 0 && (
                    <button onClick={() => setSelectedCategories(new Set())} className="text-[10px] font-bold text-jci-blue hover:underline">Clear</button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {BUSINESS_CATEGORIES.map(cat => {
                    const count = businesses.filter(b =>
                      (b.businessCategory || '').split(',').map(c => c.trim()).includes(cat)
                    ).length;
                    const active = selectedCategories.has(cat);
                    return (
                      <button key={cat} onClick={() => setSelectedCategories(prev => { const n = new Set(prev); if (n.has(cat)) n.delete(cat); else n.add(cat); return n; })}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${active ? 'bg-jci-blue text-white border-jci-blue' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                        {cat}
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ideal Referral Industry — radio list */}
              {uniqueInterestedIndustries.length > 1 && (
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Ideal Referral Industry</p>
                  <div className="space-y-1">
                    {uniqueInterestedIndustries.map(ind => {
                      const count = ind === 'All' ? businesses.length : businesses.filter(b => (b.interestedIndustries)?.includes(ind)).length;
                      const active = selectedInterestedIndustry === ind;
                      return (
                        <button key={ind} onClick={() => setSelectedInterestedIndustry(ind)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm border transition-colors ${active ? 'bg-sky-500 text-white border-sky-500 font-bold' : 'bg-white text-slate-700 border-slate-100 hover:border-slate-200 hover:bg-slate-50'}`}>
                          <span>{ind === 'All' ? 'All Industries' : ind}</span>
                          <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Ideal Referral Type — radio list */}
              {uniqueIdealReferrals.length > 1 && (
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Ideal Referral Type</p>
                  <div className="space-y-1">
                    {uniqueIdealReferrals.map(ref => {
                      const count = ref === 'All' ? businesses.length : businesses.filter(b => (b.idealReferralTypes)?.includes(ref)).length;
                      const active = selectedIdealReferral === ref;
                      return (
                        <button key={ref} onClick={() => setSelectedIdealReferral(ref)}
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
            <div className="p-5 space-y-6">
              {/* Country — pill buttons */}
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Country</p>
                <div className="flex gap-2 flex-wrap">
                  {sisterCountries.map(c => {
                    const count = c === 'All' ? MOCK_SISTER_CHAPTER_MEMBERS.length : MOCK_SISTER_CHAPTER_MEMBERS.filter(m => m.country === c).length;
                    const active = selectedSisterCountry === c;
                    return (
                      <button key={c} onClick={() => setSelectedSisterCountry(c)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${active ? 'bg-jci-blue text-white border-jci-blue' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                        {c === 'All' ? 'All' : c}
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Chapter — radio list */}
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">JCI Chapter</p>
                <div className="space-y-1">
                  {sisterChapters.map(ch => {
                    const count = ch === 'All' ? MOCK_SISTER_CHAPTER_MEMBERS.length : MOCK_SISTER_CHAPTER_MEMBERS.filter(m => m.jciChapter === ch).length;
                    const active = selectedSisterChapter === ch;
                    return (
                      <button key={ch} onClick={() => setSelectedSisterChapter(ch)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm border transition-colors ${active ? 'bg-jci-blue text-white border-jci-blue font-bold' : 'bg-white text-slate-700 border-slate-100 hover:border-slate-200 hover:bg-slate-50'}`}>
                        <span>{ch === 'All' ? 'All Chapters' : ch}</span>
                        <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Industry — radio list */}
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Industry</p>
                <div className="space-y-1">
                  {sisterIndustries.map(ind => {
                    const count = ind === 'All' ? MOCK_SISTER_CHAPTER_MEMBERS.length : MOCK_SISTER_CHAPTER_MEMBERS.filter(m => m.industry === ind).length;
                    const active = selectedSisterIndustry === ind;
                    return (
                      <button key={ind} onClick={() => setSelectedSisterIndustry(ind)}
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
        </div>

        {/* Drawer Footer */}
        <div className="shrink-0 bg-white border-t border-slate-100">
          <div className="px-5 pt-4 pb-10">
            <button
              onClick={() => setIsFilterDrawerOpen(false)}
              className="w-full bg-jci-blue text-white font-black py-4 rounded-2xl text-sm shadow-lg shadow-jci-blue/25 active:scale-[0.98] transition-transform"
            >
              Show {filteredBusinesses.length} {filteredBusinesses.length === 1 ? 'Business' : 'Businesses'}
            </button>
            {activeFiltersCount > 0 && (
              <button
                onClick={() => {
                  setSelectedIndustries(new Set());
                  setSelectedInterestedIndustry('All');
                  setSelectedIntlBiz('All');
                  setSelectedCategories(new Set());
                  setSelectedIdealReferral('All');
                  setShowDealsOnly(false);
                }}
                className="w-full mt-3 text-slate-400 text-xs font-semibold hover:text-slate-600 transition-colors py-1"
              >
                Reset all {activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


// International Network Tab Component
interface InternationalNetworkTabProps {
  onContact: (biz: BusinessProfile) => void;
}

const InternationalNetworkTab: React.FC<InternationalNetworkTabProps> = ({ onContact }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('All');
  const [selectedCountry, setSelectedCountry] = useState('All');
  const [selectedIndustry, setSelectedIndustry] = useState('All');
  const [showDealsOnly, setShowDealsOnly] = useState(false);
  const [detailMember, setDetailMember] = useState<typeof MOCK_SISTER_CHAPTER_MEMBERS[0] | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  const allChapters = useMemo(() => ['All', ...Array.from(new Set(MOCK_SISTER_CHAPTER_MEMBERS.map(m => m.jciChapter)))], []);
  const allCountries = useMemo(() => ['All', ...Array.from(new Set(MOCK_SISTER_CHAPTER_MEMBERS.map(m => m.country)))], []);
  const allIndustries = useMemo(() => ['All', ...Array.from(new Set(MOCK_SISTER_CHAPTER_MEMBERS.map(m => m.industry)))], []);

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
    return MOCK_SISTER_CHAPTER_MEMBERS.filter(member => {
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
        (!showDealsOnly || !!member.specialOffer);
    });
  }, [searchTerm, selectedChapter, selectedCountry, selectedIndustry, showDealsOnly]);

  const getMappedBiz = (member: typeof MOCK_SISTER_CHAPTER_MEMBERS[0]): BusinessProfile => ({
    id: member.id, memberId: member.id,
    ownerName: member.chineseName ? `${member.name} (${member.chineseName})` : member.name,
    companyName: member.companyName,
    industry: `${member.jciChapter} (${member.country})`,
    description: member.description, website: member.email,
    offer: member.specialOffer || '', logo: member.avatarUrl,
    internationalPartnershipTypes: member.collaborationNeeds,
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
                    {member.specialOffer && <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Gift size={9} /> Deal</span>}
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
              {filteredMembers.length === MOCK_SISTER_CHAPTER_MEMBERS.length ? 'international partners' : `of ${MOCK_SISTER_CHAPTER_MEMBERS.length} partners`}
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
                    <img src={member.avatarUrl} alt={member.name} className="w-12 h-12 rounded-xl object-cover border border-slate-100 flex-shrink-0 shadow-sm" />
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
                      {member.specialOffer && <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full flex items-center gap-0.5"><Gift size={9} /> Deal</span>}
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 flex-1 leading-relaxed">{member.description}</p>
                    {member.collaborationNeeds.length > 0 && (
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Seeking</p>
                        <div className="flex flex-wrap gap-1">
                          {member.collaborationNeeds.map(need => (
                            <span key={need} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-bold border border-blue-100">{need}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {member.specialOffer && (
                      <div className="bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
                        <p className="text-[9px] font-black text-amber-700 uppercase tracking-wider mb-0.5 flex items-center gap-1"><Gift size={9} /> Sister Deal</p>
                        <p className="text-[11px] text-amber-800 line-clamp-2 leading-snug">{member.specialOffer}</p>
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
                  const count = MOCK_SISTER_CHAPTER_MEMBERS.filter(m => m.country === c).length;
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
                  const count = MOCK_SISTER_CHAPTER_MEMBERS.filter(m => m.jciChapter === c).length;
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
                  const count = MOCK_SISTER_CHAPTER_MEMBERS.filter(m => m.industry === i).length;
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
              {detailMember.specialOffer && <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100 px-2 py-1 rounded-full flex items-center gap-0.5"><Gift size={9} /> Deal</span>}
            </div>
            {detailMember.description && <p className="text-sm text-slate-600 leading-relaxed">{detailMember.description}</p>}
            {detailMember.collaborationNeeds.length > 0 && (
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Collaboration Needs</span>
                <div className="flex flex-wrap gap-1">
                  {detailMember.collaborationNeeds.map(need => (
                    <span key={need} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold border border-blue-100">{need}</span>
                  ))}
                </div>
              </div>
            )}
            {detailMember.specialOffer && (
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
                <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider flex items-center gap-1 mb-1"><Gift size={11} /> Sister Chapter Deal</span>
                <p className="text-sm font-semibold text-amber-900 leading-snug">{detailMember.specialOffer}</p>
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
                  offer: detailMember.specialOffer || '', logo: detailMember.avatarUrl,
                  internationalPartnershipTypes: detailMember.collaborationNeeds,
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
