import React, { useState, useMemo, useEffect } from 'react';
import { Building2, Globe, Search, Send, MapPin, Users, Network, Gift, SlidersHorizontal } from 'lucide-react';
import { Card, Button, Badge, Modal, useToast, Tabs } from '../ui/Common';
import { LoadingState } from '../ui/Loading';
import { useBusinessDirectory } from '../../hooks/useBusinessDirectory';
import { useMembers } from '../../hooks/useMembers';
import { BusinessProfile } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { Input, Textarea, Select } from '../ui/Form';

// Mock Sister Chapter Members
const MOCK_SISTER_CHAPTER_MEMBERS = [
  {
    id: "scm1",
    name: "Kenji Tanaka",
    chineseName: "田中 健二",
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
    chineseName: "陈志豪",
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
    chineseName: "徐奕雯",
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
    chineseName: "林耀祖",
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

export const BusinessDirectoryView: React.FC<{ searchQuery?: string; initialSelectedBusinessId?: string | null; onClearSelection?: () => void }> = ({ searchQuery, initialSelectedBusinessId, onClearSelection }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBiz, setSelectedBiz] = useState<BusinessProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'directory' | 'international'>('directory');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('All');
  const [selectedInterestedIndustry, setSelectedInterestedIndustry] = useState<string>('All');
  const [selectedIntlBiz, setSelectedIntlBiz] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedIdealReferral, setSelectedIdealReferral] = useState<string>('All');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

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

  const [isInquiryModalOpen, setInquiryModalOpen] = useState(false);
  const [inquiryForm, setInquiryForm] = useState({
    name: '',
    company: '',
    phone: '',
    requirements: ''
  });
  const [inquiryErrors, setInquiryErrors] = useState<Record<string, string>>({});

  const { businesses, loading, error } = useBusinessDirectory();
  const { members } = useMembers(); // Used to find owner name
  const { showToast } = useToast();
  const { member: currentUser } = useAuth();

  useEffect(() => {
    if (initialSelectedBusinessId && businesses.length > 0) {
      const bizToSelect = businesses.find(b => b.id === initialSelectedBusinessId);
      if (bizToSelect) {
        setSelectedBiz(bizToSelect);
        setInquiryForm({
          name: currentUser?.name || '',
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
      if (b.interestedIndustries) {
        b.interestedIndustries.forEach(ind => industries.add(ind));
      }
    });
    return ['All', ...Array.from(industries).sort()];
  }, [businesses]);

  const uniqueCategories = useMemo(() => {
    const categories = new Set(businesses.map(b => b.businessCategory).filter(Boolean));
    return ['All', ...Array.from(categories).sort()];
  }, [businesses]);

  const uniqueIdealReferrals = useMemo(() => {
    const referrals = new Set<string>();
    businesses.forEach(b => {
      if (b.idealReferralTypes) {
        b.idealReferralTypes.forEach(ref => referrals.add(ref));
      }
    });
    return ['All', ...Array.from(referrals).sort()];
  }, [businesses]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedIndustry !== 'All') count++;
    if (selectedInterestedIndustry !== 'All') count++;
    if (selectedIntlBiz !== 'All') count++;
    if (selectedCategory !== 'All') count++;
    if (selectedIdealReferral !== 'All') count++;
    return count;
  }, [selectedIndustry, selectedInterestedIndustry, selectedIntlBiz, selectedCategory, selectedIdealReferral]);

  const filteredBusinesses = useMemo(() => {
    let filtered = businesses;
    if (selectedIndustry !== 'All') {
      filtered = filtered.filter(biz => biz.industry === selectedIndustry);
    }
    if (selectedInterestedIndustry !== 'All') {
      filtered = filtered.filter(biz =>
        biz.interestedIndustries && biz.interestedIndustries.includes(selectedInterestedIndustry)
      );
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
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(biz => biz.businessCategory === selectedCategory);
    }
    if (selectedIdealReferral !== 'All') {
      filtered = filtered.filter(biz =>
        biz.idealReferralTypes && biz.idealReferralTypes.includes(selectedIdealReferral)
      );
    }

    const term = (searchQuery || searchTerm).toLowerCase();
    if (!term) return filtered;

    return filtered.filter(biz =>
      (biz.companyName ?? '').toLowerCase().includes(term) ||
      (biz.industry ?? '').toLowerCase().includes(term) ||
      (biz.description ?? '').toLowerCase().includes(term) ||
      (biz.businessCategory ?? '').toLowerCase().includes(term)
    );
  }, [
    businesses,
    searchTerm,
    searchQuery,
    selectedIndustry,
    selectedInterestedIndustry,
    selectedIntlBiz,
    selectedCategory,
    selectedIdealReferral
  ]);

  const handleContact = () => {
    // Auto-fill form from current user info
    setInquiryForm({
      name: currentUser?.name || '',
      company: currentUser?.companyName || '',
      phone: currentUser?.phone || '',
      requirements: ''
    });
    setInquiryErrors({});
    setInquiryModalOpen(true);
  };

  const handleSendInquiry = () => {
    // Validate
    const errors: Record<string, string> = {};
    if (!inquiryForm.name.trim()) errors.name = 'Name is required';
    if (!inquiryForm.phone.trim()) errors.phone = 'Phone number is required';
    if (!inquiryForm.requirements.trim()) errors.requirements = 'Requirements are required';

    if (Object.keys(errors).length > 0) {
      setInquiryErrors(errors);
      return;
    }

    // Submission logic (placeholder)
    console.log('Inquiry submitted:', {
      businessId: selectedBiz?.id,
      businessName: selectedBiz?.companyName,
      ...inquiryForm
    });

    setInquiryModalOpen(false);
    setSelectedBiz(null);
    showToast('Your inquiry has been sent successfully', 'success');
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Member Business Directory</h2>
          <p className="text-slate-500">Support local member businesses and global JCI network connections.</p>
        </div>
      </div>

      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 mb-4">
          <div className="flex-shrink-0">
            <Tabs
              tabs={['Business Directory', 'International Network']}
              activeTab={activeTab === 'directory' ? 'Business Directory' : 'International Network'}
              onTabChange={(tab) => setActiveTab(tab === 'Business Directory' ? 'directory' : 'international')}
              className="border-none"
            />
          </div>

          <div className="flex items-center gap-3 justify-end" />
        </div>

        <div className="bg-transparent">
          {activeTab === 'directory' ? (
            <div className="space-y-3">
              {/* Search & Filter Row */}
              <div className="flex gap-3 items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm mb-2">
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
                  className="flex items-center gap-2 h-9 px-4 rounded-lg font-medium text-xs shadow-sm bg-white border-slate-200 shrink-0"
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
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredBusinesses.map(biz => {
                    return (
                      <Card key={biz.id} noPadding className="hover:shadow-md transition-shadow flex flex-col h-full bg-white border border-slate-100 p-4">
                        {(() => {
                          const ownerMember = members.find(m => m.id === biz.memberId);
                          const avatarUrl = ownerMember?.avatarUrl || ownerMember?.general?.avatarUrl || ownerMember?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(biz.ownerName)}&background=0097D7&color=fff`;
                          const chineseName = ownerMember?.general?.chineseName || ownerMember?.chineseName;
                          const position = ownerMember?.business?.title || 'Representative';

                          return (
                            <div className="flex gap-3 items-center border-b border-slate-50 pb-3">
                              <img
                                src={avatarUrl}
                                alt={biz.ownerName}
                                className="w-12 h-12 rounded-full object-cover border border-slate-200 flex-shrink-0 shadow-sm"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 justify-between">
                                  <h3 className="text-sm font-bold text-slate-900 truncate">
                                    {biz.ownerName} {chineseName && <span className="text-xs text-slate-500 font-medium">({chineseName})</span>}
                                  </h3>
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                                    Malaysia
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 truncate mt-0.5">{position} at {biz.companyName}</p>
                                <p className="text-[10px] text-jci-blue font-bold truncate mt-0.5">JCI Kuala Lumpur</p>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Card Body */}
                        <div className="flex-1 flex flex-col">
                          {/* Industry Tag */}
                          <div className="mb-2">
                            {biz.industry ? (
                              <Badge variant="info" className="text-[10px] px-2 py-0.5">
                                {biz.industry}
                              </Badge>
                            ) : (
                              <Badge variant="neutral" className="text-[10px] px-2 py-0.5 border border-slate-200 border-dashed bg-slate-50 text-slate-400">
                                No Industry Specified
                              </Badge>
                            )}
                          </div>

                          {/* International Biz Tag */}
                          <div className="mb-3">
                            {(() => {
                              const status = biz.acceptsInternationalBusiness;
                              if (status === 'Yes' || status === true) {
                                return <Badge variant="success" className="text-[10px] px-2 py-0.5">Accepts International Business</Badge>;
                              }
                              if (status === 'Willing to Explore') {
                                return <Badge variant="warning" className="text-[10px] px-2 py-0.5">Exploring International Business</Badge>;
                              }
                              return (
                                <Badge variant="neutral" className="text-[10px] px-2 py-0.5 border border-slate-200 border-dashed bg-slate-50 text-slate-400">
                                  Local Business Only
                                </Badge>
                              );
                            })()}
                          </div>

                          {biz.description ? (
                            <p className="text-[11px] text-slate-600 line-clamp-3 mb-4 leading-relaxed">
                              {biz.description}
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-400 italic mb-4 leading-relaxed">
                              No company description provided yet.
                            </p>
                          )}

                          {/* Ideal Referral / Interested Industries */}
                          {biz.idealReferralTypes && biz.idealReferralTypes.length > 0 && (
                            <div className="mb-4">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Ideal Referral</span>
                              <div className="flex flex-wrap gap-1">
                                {biz.idealReferralTypes.map(ref => (
                                  <span key={ref} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-bold border border-blue-100">
                                    {ref}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Special Offer / Member Deal */}
                          {biz.offer && (
                            <div className="bg-amber-50/60 p-3 rounded-lg border border-amber-100 mb-4 mt-auto">
                              <span className="text-[9px] font-black text-amber-700 uppercase tracking-wider flex items-center gap-1 mb-1">
                                <Gift size={11} /> JCI Member Deal
                              </span>
                              <p className="text-[11px] font-semibold text-amber-900 leading-snug">{biz.offer}</p>
                            </div>
                          )}

                          <div className="flex gap-2 mt-auto pt-2">
                            {biz.website && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 text-slate-600 border-slate-200 hover:bg-slate-50"
                                onClick={() => window.open(biz.website.startsWith('http') ? biz.website : `https://${biz.website}`, '_blank')}
                              >
                                <Globe size={14} className="mr-2" /> Website
                              </Button>
                            )}
                            <Button
                              variant="primary"
                              size="sm"
                              className="flex-1 bg-jci-blue text-white hover:bg-jci-blue/90"
                              onClick={() => {
                                setSelectedBiz(biz);
                                handleContact();
                              }}
                            >
                              Contact
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </LoadingState>
            </div>
          ) : (
            <InternationalNetworkTab
              selectedChapter={selectedSisterChapter}
              selectedCountry={selectedSisterCountry}
              selectedIndustry={selectedSisterIndustry}
              sisterFiltersCount={sisterFiltersCount}
              onOpenFilters={() => setIsFilterDrawerOpen(true)}
              onContact={(biz) => {
                setSelectedBiz(biz);
                setInquiryForm({
                  name: currentUser?.name || '',
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
                  src={selectedBiz.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedBiz.companyName)}&background=0097D7&color=fff`}
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
                      const industries = owner?.interestedIndustries;
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
              <Button className="flex-1 font-bold shadow-lg shadow-jci-blue/20" onClick={handleSendInquiry}>
                <Send size={16} className="mr-2" /> Send Inquiry
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Filter Drawer Overlay */}
      {isFilterDrawerOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 transition-opacity duration-300"
          onClick={() => setIsFilterDrawerOpen(false)}
        />
      )}

      {/* Filter Drawer Content */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ${isFilterDrawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}>
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">
              {activeTab === 'directory' ? 'Filter Directory' : 'Filter Sister Chapters'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeTab === 'directory' ? 'Narrow down member business listings' : 'Narrow down sister chapter members'}
            </p>
          </div>
          <button
            onClick={() => setIsFilterDrawerOpen(false)}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 hover:bg-slate-50 rounded-full"
          >
            <span className="text-xl font-bold">&times;</span>
          </button>
        </div>

        {/* Drawer Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {activeTab === 'directory' ? (
            <>
              {/* Industry Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 size={13} className="text-slate-400" />
                  Industry
                </label>
                <Select
                  value={selectedIndustry}
                  onChange={(e) => setSelectedIndustry(e.target.value)}
                  options={uniqueIndustries.map(ind => {
                    const count = ind === 'All'
                      ? businesses.length
                      : businesses.filter(b => b.industry === ind).length;
                    return {
                      value: ind,
                      label: `${ind === 'All' ? 'All Industries' : ind} (${count})`
                    };
                  })}
                  className="bg-white border-slate-200 shadow-sm text-xs"
                />
              </div>

              {/* Intl. Business Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Globe size={13} className="text-slate-400" />
                  Intl. Business
                </label>
                <Select
                  value={selectedIntlBiz}
                  onChange={(e) => setSelectedIntlBiz(e.target.value)}
                  options={[
                    { value: 'All', label: `All Statuses (${businesses.length})` },
                    {
                      value: 'Yes',
                      label: `Accepts International Business (${businesses.filter(b => b.acceptsInternationalBusiness === 'Yes' || b.acceptsInternationalBusiness === true).length})`
                    },
                    {
                      value: 'Willing to Explore',
                      label: `Exploring International Business (${businesses.filter(b => b.acceptsInternationalBusiness === 'Willing to Explore').length})`
                    },
                    {
                      value: 'No',
                      label: `Local Business Only (${businesses.filter(b => b.acceptsInternationalBusiness === 'No' || b.acceptsInternationalBusiness === false || !b.acceptsInternationalBusiness).length})`
                    }
                  ]}
                  className="bg-white border-slate-200 shadow-sm text-xs"
                />
              </div>

              {/* Business Categories Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Network size={13} className="text-slate-400" />
                  Business Categories
                </label>
                <Select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  options={uniqueCategories.map(cat => {
                    const count = cat === 'All'
                      ? businesses.length
                      : businesses.filter(b => b.businessCategory === cat).length;
                    return {
                      value: cat,
                      label: `${cat === 'All' ? 'All Categories' : cat} (${count})`
                    };
                  })}
                  className="bg-white border-slate-200 shadow-sm text-xs"
                />
              </div>

              {/* Ideal Referral Industry Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Search size={13} className="text-slate-400" />
                  Ideal Referral Industry
                </label>
                <Select
                  value={selectedInterestedIndustry}
                  onChange={(e) => setSelectedInterestedIndustry(e.target.value)}
                  options={uniqueInterestedIndustries.map(ind => {
                    const count = ind === 'All'
                      ? businesses.length
                      : businesses.filter(b => b.interestedIndustries && b.interestedIndustries.includes(ind)).length;
                    return {
                      value: ind,
                      label: `${ind === 'All' ? 'All Interested Industries' : ind} (${count})`
                    };
                  })}
                  className="bg-white border-slate-200 shadow-sm text-xs"
                />
              </div>

              {/* Ideal Referral Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Gift size={13} className="text-slate-400" />
                  Ideal Referral
                </label>
                <Select
                  value={selectedIdealReferral}
                  onChange={(e) => setSelectedIdealReferral(e.target.value)}
                  options={uniqueIdealReferrals.map(ref => {
                    const count = ref === 'All'
                      ? businesses.length
                      : businesses.filter(b => b.idealReferralTypes && b.idealReferralTypes.includes(ref)).length;
                    return {
                      value: ref,
                      label: `${ref === 'All' ? 'All Referrals' : ref} (${count})`
                    };
                  })}
                  className="bg-white border-slate-200 shadow-sm text-xs"
                />
              </div>
            </>
          ) : (
            <>
              {/* JCI Chapter Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 size={13} className="text-slate-400" />
                  JCI Chapter
                </label>
                <Select
                  value={selectedSisterChapter}
                  onChange={(e) => setSelectedSisterChapter(e.target.value)}
                  options={sisterChapters.map(ch => {
                    const count = ch === 'All'
                      ? MOCK_SISTER_CHAPTER_MEMBERS.length
                      : MOCK_SISTER_CHAPTER_MEMBERS.filter(m => m.jciChapter === ch).length;
                    return {
                      value: ch,
                      label: `${ch === 'All' ? 'All Chapters' : ch} (${count})`
                    };
                  })}
                  className="bg-white border-slate-200 shadow-sm text-xs"
                />
              </div>

              {/* Country Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Globe size={13} className="text-slate-400" />
                  Country
                </label>
                <Select
                  value={selectedSisterCountry}
                  onChange={(e) => setSelectedSisterCountry(e.target.value)}
                  options={sisterCountries.map(c => {
                    const count = c === 'All'
                      ? MOCK_SISTER_CHAPTER_MEMBERS.length
                      : MOCK_SISTER_CHAPTER_MEMBERS.filter(m => m.country === c).length;
                    return {
                      value: c,
                      label: `${c === 'All' ? 'All Countries' : c} (${count})`
                    };
                  })}
                  className="bg-white border-slate-200 shadow-sm text-xs"
                />
              </div>

              {/* Industry Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 size={13} className="text-slate-400" />
                  Industry
                </label>
                <Select
                  value={selectedSisterIndustry}
                  onChange={(e) => setSelectedSisterIndustry(e.target.value)}
                  options={sisterIndustries.map(ind => {
                    const count = ind === 'All'
                      ? MOCK_SISTER_CHAPTER_MEMBERS.length
                      : MOCK_SISTER_CHAPTER_MEMBERS.filter(m => m.industry === ind).length;
                    return {
                      value: ind,
                      label: `${ind === 'All' ? 'All Industries' : ind} (${count})`
                    };
                  })}
                  className="bg-white border-slate-200 shadow-sm text-xs"
                />
              </div>
            </>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-slate-600 border-slate-200 hover:bg-slate-100 bg-white"
            onClick={() => {
              if (activeTab === 'directory') {
                setSelectedIndustry('All');
                setSelectedInterestedIndustry('All');
                setSelectedIntlBiz('All');
                setSelectedCategory('All');
                setSelectedIdealReferral('All');
              } else {
                setSelectedSisterChapter('All');
                setSelectedSisterCountry('All');
                setSelectedSisterIndustry('All');
              }
            }}
          >
            Reset All
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="flex-1 bg-jci-blue text-white hover:bg-jci-blue/90"
            onClick={() => setIsFilterDrawerOpen(false)}
          >
            Apply Filters
          </Button>
        </div>
      </div>
    </div>
  );
};


// International Network Tab Component
interface InternationalNetworkTabProps {
  selectedChapter: string;
  selectedCountry: string;
  selectedIndustry: string;
  sisterFiltersCount: number;
  onOpenFilters: () => void;
  onContact: (biz: BusinessProfile) => void;
}

const InternationalNetworkTab: React.FC<InternationalNetworkTabProps> = ({
  selectedChapter,
  selectedCountry,
  selectedIndustry,
  sisterFiltersCount,
  onOpenFilters,
  onContact
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter members list
  const filteredMembers = useMemo(() => {
    return MOCK_SISTER_CHAPTER_MEMBERS.filter(member => {
      const matchesSearch =
        member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (member.chineseName && member.chineseName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        member.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.jciChapter.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.businessCategory.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesChapter = selectedChapter === 'All' || member.jciChapter === selectedChapter;
      const matchesCountry = selectedCountry === 'All' || member.country === selectedCountry;
      const matchesIndustry = selectedIndustry === 'All' || member.industry === selectedIndustry;

      return matchesSearch && matchesChapter && matchesCountry && matchesIndustry;
    });
  }, [searchTerm, selectedChapter, selectedCountry, selectedIndustry]);

  return (
    <div className="space-y-3">
      {/* Search & Filter Row */}
      <div className="flex gap-3 items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm mb-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search sister chapter members..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20"
          />
        </div>
        <Button
          variant={sisterFiltersCount > 0 ? "secondary" : "outline"}
          size="sm"
          className="flex items-center gap-2 h-9 px-4 rounded-lg font-medium text-xs shadow-sm bg-white border-slate-200 shrink-0"
          onClick={onOpenFilters}
        >
          <SlidersHorizontal size={14} className={sisterFiltersCount > 0 ? 'text-sky-600' : 'text-slate-500'} />
          <span>Filters</span>
          {sisterFiltersCount > 0 && (
            <span className="flex items-center justify-center bg-jci-blue text-white text-[10px] font-bold rounded-full w-5 h-5 ml-1">
              {sisterFiltersCount}
            </span>
          )}
        </Button>
      </div>

      {/* Grid List */}
      {filteredMembers.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-100 shadow-sm rounded-xl">
          <Network size={48} className="mx-auto mb-4 text-slate-300" />
          <h4 className="text-lg font-bold text-slate-900 mb-2">No Sister Chapter Members Found</h4>
          <p className="text-slate-500 mb-4 text-sm max-w-sm mx-auto">No members match your search criteria. Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredMembers.map(member => {
            const mappedBiz: BusinessProfile = {
              id: member.id,
              memberId: member.id,
              ownerName: member.chineseName ? `${member.name} (${member.chineseName})` : member.name,
              companyName: member.companyName,
              industry: `${member.jciChapter} (${member.country})`,
              description: member.description,
              website: member.email,
              offer: member.specialOffer || '',
              logo: member.avatarUrl,
              internationalPartnershipTypes: member.collaborationNeeds,
              businessCategory: member.businessCategory,
              acceptsInternationalBusiness: 'Yes'
            };

            return (
              <Card key={member.id} noPadding className="hover:shadow-md transition-shadow flex flex-col h-full bg-white border border-slate-100 p-4">
                <div className="flex gap-3 items-center border-b border-slate-50 pb-3">
                  <img
                    src={member.avatarUrl}
                    alt={member.name}
                    className="w-12 h-12 rounded-full object-cover border border-slate-200 flex-shrink-0 shadow-sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 justify-between">
                      <h3 className="text-sm font-bold text-slate-900 truncate">
                        {member.name} {member.chineseName && <span className="text-xs text-slate-500 font-medium">({member.chineseName})</span>}
                      </h3>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                        {member.country}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{member.position} at {member.companyName}</p>
                    <p className="text-[10px] text-jci-blue font-bold truncate mt-0.5">{member.jciChapter}</p>
                  </div>
                </div>

                {/* Card Body */}
                <div className="flex-1 flex flex-col">
                  {/* Industry / Category Tag */}
                  <div className="mb-2">
                    <Badge variant="info" className="text-[10px] px-2 py-0.5">
                      {member.businessCategory}
                    </Badge>
                  </div>

                  <p className="text-[11px] text-slate-600 line-clamp-3 mb-4 leading-relaxed">
                    {member.description}
                  </p>

                  {/* Collaboration Needs */}
                  {member.collaborationNeeds.length > 0 && (
                    <div className="mb-4">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Collaboration Needs</span>
                      <div className="flex flex-wrap gap-1">
                        {member.collaborationNeeds.map(need => (
                          <span key={need} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-bold border border-blue-100">
                            {need}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Special Offer */}
                  {member.specialOffer && (
                    <div className="bg-amber-50/60 p-3 rounded-lg border border-amber-100 mb-4 mt-auto">
                      <span className="text-[9px] font-black text-amber-700 uppercase tracking-wider flex items-center gap-1 mb-1">
                        <Gift size={11} /> Sister Chapter Deal
                      </span>
                      <p className="text-[11px] font-semibold text-amber-900 leading-snug">{member.specialOffer}</p>
                    </div>
                  )}

                  <div className="flex gap-2 mt-auto pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-slate-600 border-slate-200 hover:bg-slate-50"
                      onClick={() => window.open(`mailto:${member.email}?subject=JCI KL Collaboration Inquiry`, '_blank')}
                    >
                      <Globe size={14} className="mr-2" /> Email
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      className="flex-1 bg-jci-blue text-white hover:bg-jci-blue/90"
                      onClick={() => onContact(mappedBiz)}
                    >
                      Contact
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
