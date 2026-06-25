import React, { useState, useMemo, useEffect } from 'react';
import { Building2, Globe, Search, Send, MapPin, Users, Network, Gift } from 'lucide-react';
import { Card, Button, Badge, Modal, useToast, Tabs } from '../ui/Common';
import { LoadingState } from '../ui/Loading';
import { useBusinessDirectory } from '../../hooks/useBusinessDirectory';
import { useMembers } from '../../hooks/useMembers';
import { BusinessProfile } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { Input, Textarea, Select } from '../ui/Form';


// Map each industry to a unique premium gradient and background image for the banner (referencing premium dashboard header patterns)
const INDUSTRY_BANNER_MAP: Record<string, { from: string; to: string }> = {
  'Advertising, Marketing & Media': { from: 'from-pink-500', to: 'to-purple-600' },
  'Agriculture & Animals': { from: 'from-green-500', to: 'to-emerald-600' },
  'Architecture, Engineering & Construction': { from: 'from-indigo-500', to: 'to-blue-600' },
  'Art, Entertainment & Design': { from: 'from-rose-500', to: 'to-orange-500' },
  'Automotive & Accessories': { from: 'from-slate-600', to: 'to-gray-800' },
  'Food & Beverages': { from: 'from-yellow-500', to: 'to-amber-600' },
  'Telecom, AI, Computers & IT': { from: 'from-cyan-500', to: 'to-teal-600' },
  'Consulting & Professional Services': { from: 'from-purple-500', to: 'to-fuchsia-600' },
  'Education & Training': { from: 'from-blue-500', to: 'to-sky-600' },
  'Event & Hospitality': { from: 'from-pink-500', to: 'to-rose-500' },
  'Crypto, Blockchain, Finance & Insurance': { from: 'from-indigo-600', to: 'to-violet-700' },
  'Health & Wellness': { from: 'from-red-500', to: 'to-pink-600' },
  'Legal, HR, Accounting & Tax': { from: 'from-emerald-500', to: 'to-green-600' },
  'Manufacturing & Supply Chain': { from: 'from-orange-500', to: 'to-amber-600' },
  'Wholesale, Retail & E-Commerce': { from: 'from-teal-500', to: 'to-cyan-600' },
  'Personal, Beauty & Sports': { from: 'from-fuchsia-500', to: 'to-pink-500' },
  'Real Estate & Property Services': { from: 'from-slate-500', to: 'to-gray-600' },
  'Transport & Logistics': { from: 'from-amber-500', to: 'to-yellow-600' },
  'Travel & Tourism': { from: 'from-sky-500', to: 'to-blue-600' },
  'Other': { from: 'from-jci-navy', to: 'to-jci-blue' },
};

export const BusinessDirectoryView: React.FC<{ searchQuery?: string; initialSelectedBusinessId?: string | null; onClearSelection?: () => void }> = ({ searchQuery, initialSelectedBusinessId, onClearSelection }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBiz, setSelectedBiz] = useState<BusinessProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'directory' | 'international'>('directory');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('All');
  const [selectedInterestedIndustry, setSelectedInterestedIndustry] = useState<string>('All');
  const [isInquiryModalOpen, setInquiryModalOpen] = useState(false);
  const [inquiryForm, setInquiryForm] = useState({
    name: '',
    company: '',
    phone: '',
    requirements: ''
  });
  const [inquiryErrors, setInquiryErrors] = useState<Record<string, string>>({});
  const [filterInternational, setFilterInternational] = useState(false);

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
    if (filterInternational) {
      filtered = filtered.filter(biz => {
        const val = String(biz.acceptsInternationalBusiness || '').toLowerCase();
        return val === 'yes' || val === 'true' || val === 'willing to explore';
      });
    }
    const term = (searchQuery || searchTerm).toLowerCase();
    if (!term) return filtered;

    return filtered.filter(biz =>
      (biz.companyName ?? '').toLowerCase().includes(term) ||
      (biz.industry ?? '').toLowerCase().includes(term) ||
      (biz.description ?? '').toLowerCase().includes(term) ||
      (biz.businessCategory ?? '').toLowerCase().includes(term)
    );
  }, [businesses, searchTerm, searchQuery, selectedIndustry, selectedInterestedIndustry, filterInternational]);

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
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2">
          <div className="flex items-center justify-between w-full lg:w-auto gap-4">
            <div className="flex-shrink-0">
              <Tabs
                tabs={['Business Directory', 'International Network']}
                activeTab={activeTab === 'directory' ? 'Business Directory' : 'International Network'}
                onTabChange={(tab) => setActiveTab(tab === 'Business Directory' ? 'directory' : 'international')}
                className="border-none"
              />
            </div>

            {/* Mobile International Biz Toggle */}
            <button
              onClick={() => setFilterInternational(!filterInternational)}
              className={`lg:hidden flex items-center h-9 rounded-lg border transition-all duration-200 whitespace-nowrap flex-shrink-0 ${filterInternational
                ? 'bg-sky-500 text-white border-sky-600 shadow-md shadow-sky-500/20'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-sky-50 hover:text-sky-600 hover:border-sky-200 shadow-sm'
                }`}
              title="Filter by International Business readiness"
            >
              <Globe size={14} className={filterInternational ? 'animate-pulse' : ''} />
            </button>
          </div>

          {/* Global Category Filters */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto lg:px-0">
            {/* Own Industry */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex-shrink-0 text-slate-400 hidden lg:block" title="Business Industry">
                <Building2 size={16} />
              </div>
              <div className="w-full sm:w-60 lg:w-52">
                <Select
                  value={selectedIndustry}
                  onChange={(e) => setSelectedIndustry(e.target.value)}
                  options={uniqueIndustries.map(ind => {
                    const count = ind === 'All'
                      ? businesses.length
                      : businesses.filter(b => b.industry === ind).length;
                    return {
                      value: ind,
                      label: `${count.toString().padStart(2, '0')} | ${ind === 'All' ? 'Industry: All' : ind}`
                    };
                  })}
                  className="bg-white border-slate-200 shadow-sm font-mono-numbers h-9 py-0 text-xs"
                />
              </div>
            </div>

            {/* Interested Industry */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex-shrink-0 text-slate-400 hidden lg:block" title="Looking for Industry">
                <Search size={16} />
              </div>
              <div className="w-full sm:w-60 lg:w-52">
                <Select
                  value={selectedInterestedIndustry}
                  onChange={(e) => setSelectedInterestedIndustry(e.target.value)}
                  options={uniqueInterestedIndustries.map(ind => {
                    const count = ind === 'All'
                      ? businesses.length
                      : businesses.filter(b => b.interestedIndustries && b.interestedIndustries.includes(ind)).length;
                    return {
                      value: ind,
                      label: `${count.toString().padStart(2, '0')} | ${ind === 'All' ? 'Interested: All' : ind}`
                    };
                  })}
                  className="bg-white border-slate-200 shadow-sm font-mono-numbers h-9 py-0 text-xs"
                />
              </div>
            </div>

            <button
              onClick={() => setFilterInternational(!filterInternational)}
              className={`hidden lg:flex items-center gap-2 px-3 h-9 rounded-lg border transition-all duration-200 whitespace-nowrap flex-shrink-0 ${filterInternational
                ? 'bg-sky-500 text-white border-sky-600 shadow-md shadow-sky-500/20'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-sky-50 hover:text-sky-600 hover:border-sky-200 shadow-sm'
                }`}
              title="Filter by International Business readiness"
            >
              <Globe size={14} className={filterInternational ? 'animate-pulse' : ''} />
              <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">International Biz</span>
              {filterInternational && (
                <span className="w-2 h-2 rounded-full bg-white animate-pulse ml-0.5 hidden sm:block" />
              )}
            </button>
          </div>
        </div>

        <div className="bg-transparent">
          {activeTab === 'directory' ? (
            <div className="space-y-3">
              <LoadingState loading={loading} error={error} empty={filteredBusinesses.length === 0} emptyMessage="No businesses found matching this category">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredBusinesses.map(biz => {
                    return (
                      <Card key={biz.id} noPadding className="overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full bg-white border border-slate-100">
                        {/* Industry‑specific banner (Premium Gradient + Decorative Pattern) */}
                        <div className={`h-24 bg-gradient-to-br ${INDUSTRY_BANNER_MAP[biz.industry ?? 'Other']?.from ?? 'from-slate-100'} ${INDUSTRY_BANNER_MAP[biz.industry ?? 'Other']?.to ?? 'to-slate-200'} relative`}>

                          <div className="absolute -bottom-6 left-2 w-16 h-16 bg-white rounded-lg border border-slate-200 p-1 z-10 shadow-sm">
                            <img
                              src={biz.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(biz.companyName)}&background=0097D7&color=fff`}
                              alt="Logo"
                              className="w-full h-full z-10 object-cover rounded"
                            />
                          </div>
                          <div className="absolute text-right top-2 right-2 flex flex-col items-end gap-1">
                            <Badge variant="neutral">{biz.industry}</Badge>

                            {/* Business Category Tag */}
                            {biz.businessCategory && (
                              <Badge variant="info" className="text-[10px]">
                                {biz.businessCategory}
                              </Badge>
                            )}

                            {/* International Business Status - fallback to owner profile */}
                            {(() => {
                              const status = biz.acceptsInternationalBusiness;
                              if (status === 'Yes' || status === true) {
                                return <Badge variant="success" className="text-[10px]">Accepts International BIZ</Badge>;
                              }
                              if (status === 'Willing to Explore') {
                                return <Badge variant="warning" className="text-[10px]">Exploring International BIZ</Badge>;
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                        <div className="pt-8 px-2 flex-1 flex flex-col">
                          <h3 className="text-lg font-bold text-slate-900">{biz.ownerName}</h3>
                          <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                            {biz.companyName}
                          </p>
                          {biz.description ? (
                            <p className="text-[11px] text-slate-600 line-clamp-3 mb-4 leading-relaxed">
                              {biz.description}
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-400 italic mb-4 leading-relaxed">
                              No company description provided yet.
                            </p>
                          )}

                          <div className="flex gap-2 mt-auto mb-4">
                            {biz.website && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => window.open(biz.website.startsWith('http') ? biz.website : `https://${biz.website}`, '_blank')}
                              >
                                <Globe size={14} className="mr-2" /> Website
                              </Button>
                            )}
                            <Button
                              variant="secondary"
                              size="sm"
                              className="flex-1"
                              onClick={() => {
                                setSelectedBiz(biz);
                                handleContact();
                              }}
                            >
                              Contact
                            </Button>
                          </div>

                          {biz.offer && (
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-4">
                              <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">JCI Member Deal</span>
                              <p className="text-sm font-medium text-blue-900">{biz.offer}</p>
                            </div>
                          )}


                        </div>
                      </Card>
                    );
                  })}
                </div>
              </LoadingState>
            </div>
          ) : (
            <InternationalNetworkTab
              businesses={filteredBusinesses}
              members={members}
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
    </div>
  );
};

// International Network Tab Component
interface InternationalNetworkTabProps {
  businesses: BusinessProfile[];
  members: any[];
  onContact: (biz: BusinessProfile) => void;
}

const InternationalNetworkTab: React.FC<InternationalNetworkTabProps> = ({ businesses, members, onContact }) => {
  const businessesWithConnections = businesses.filter(business => {
    const acceptStatus = business.acceptsInternationalBusiness;
    const hasConnections = business.internationalConnections && business.internationalConnections.length > 0;
    return hasConnections || acceptStatus === 'Yes' || acceptStatus === 'Willing to Explore' || acceptStatus === true;
  });

  return (
    <div className="space-y-3">
      {businessesWithConnections.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-100 shadow-sm rounded-xl">
          <Network size={48} className="mx-auto mb-4 text-slate-300" />
          <h4 className="text-lg font-bold text-slate-900 mb-2">No International Connections Found</h4>
          <p className="text-slate-500 mb-4 text-sm max-w-sm mx-auto">Either no businesses have joined the international network yet, or none match your selected category filter.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {businessesWithConnections.map(business => {
            const status = business.acceptsInternationalBusiness;
            return (
              <Card key={business.id} noPadding className="overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full">
                {/* Industry‑specific banner */}
                <div className={`h-24 bg-gradient-to-br ${INDUSTRY_BANNER_MAP[business.industry ?? 'Other']?.from ?? 'from-slate-100'} ${INDUSTRY_BANNER_MAP[business.industry ?? 'Other']?.to ?? 'to-slate-200'} relative`}>
                  <div className="absolute -bottom-6 left-2 w-16 h-16 bg-white rounded-lg border border-slate-200 p-1 z-10 shadow-sm">
                    <img
                      src={business.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(business.companyName)}&background=0097D7&color=fff`}
                      alt="Logo"
                      className="w-full h-full z-10 object-cover rounded"
                    />
                  </div>
                  <div className="absolute text-right top-2 right-2 flex flex-col items-end gap-1">
                    <Badge variant="neutral">{business.industry}</Badge>

                    {business.businessCategory && (
                      <Badge variant="info" className="text-[10px]">
                        {business.businessCategory}
                      </Badge>
                    )}

                    {status === 'Yes' || status === true ? (
                      <Badge variant="success" className="text-[10px]">Accepts International BIZ</Badge>
                    ) : status === 'Willing to Explore' ? (
                      <Badge variant="warning" className="text-[10px]">Exploring International BIZ</Badge>
                    ) : null}
                  </div>
                </div>

                {/* Card Body */}
                <div className="pt-8 px-2 pb-6 flex-1 flex flex-col">
                  <h3 className="text-lg font-bold text-slate-900">{business.ownerName}</h3>
                  <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                    {business.companyName}
                  </p>
                  {business.description ? (
                    <p className="text-[11px] text-slate-600 line-clamp-3 mb-4 leading-relaxed">
                      {business.description}
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic mb-4 leading-relaxed">
                      No company description provided yet.
                    </p>
                  )}
                  <div className="flex gap-2 mb-4">
                    {business.website && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => window.open(business.website.startsWith('http') ? business.website : `https://${business.website}`, '_blank')}
                      >
                        <Globe size={14} className="mr-2" /> Website
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      onClick={() => onContact(business)}
                    >
                      Contact
                    </Button>
                  </div>

                  {/* International Connections Area */}
                  <div className="flex-1 space-y-3">
                    {business.internationalConnections && business.internationalConnections.length > 0 ? (
                      business.internationalConnections.map((connection, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <MapPin size={16} className="text-slate-400" />
                              <span className="font-semibold text-slate-900 text-sm max-w-[150px] truncate" title={connection.jciChapter}>{connection.jciChapter}</span>
                            </div>
                            <Badge variant="neutral" className="text-[10px]">{connection.country}</Badge>
                          </div>
                          <div className="mb-2">
                            <Badge variant="info" className="text-[10px]">{connection.connectionType}</Badge>
                          </div>
                          {connection.contactPerson && (
                            <p className="text-xs text-slate-600 mb-1">
                              <Users size={14} className="inline mr-1" />
                              Contact: {connection.contactPerson}
                            </p>
                          )}
                          {connection.notes && (
                            <p className="text-[10px] text-slate-500 mt-2">{connection.notes}</p>
                          )}
                        </div>
                      ))
                    ) : (
                      <div
                        className="h-full flex items-center justify-center p-4 bg-blue-50/50 rounded-xl border border-blue-100 min-h-[120px] cursor-pointer hover:bg-blue-100/50 transition-colors group/biz"
                        onClick={() => onContact(business)}
                      >
                        <div className="text-center">
                          <p className="text-xs text-blue-700 font-bold leading-tight mb-3">Looking for international opportunities</p>
                          {business.internationalPartnershipTypes && business.internationalPartnershipTypes.length > 0 && (
                            <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                              {business.internationalPartnershipTypes.slice(0, 3).map(type => (
                                <span key={type} className="px-2 py-1 bg-white text-blue-600 border border-blue-200 rounded-lg text-[9px] font-bold shadow-sm">
                                  {type}
                                </span>
                              ))}
                              {business.internationalPartnershipTypes.length > 3 && (
                                <span className="px-2 py-1 bg-blue-600 text-white rounded-lg text-[9px] font-black shadow-sm group-hover/biz:bg-blue-700 transition-colors">
                                  +{business.internationalPartnershipTypes.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  );
};
