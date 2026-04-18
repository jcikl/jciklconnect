import React, { useState, useMemo, useEffect } from 'react';
import { Building2, Globe, Search, Send, MapPin, Users, Network, Gift } from 'lucide-react';
import { Card, Button, Badge, Modal, useToast, Tabs } from '../ui/Common';
import { LoadingState } from '../ui/Loading';
import { useBusinessDirectory } from '../../hooks/useBusinessDirectory';
import { useMembers } from '../../hooks/useMembers';
import { BusinessProfile } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { Input, Textarea } from '../ui/Form';


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

  const filteredBusinesses = useMemo(() => {
    let filtered = businesses;
    if (selectedIndustry !== 'All') {
      filtered = filtered.filter(biz => biz.industry === selectedIndustry);
    }
    const term = (searchQuery || searchTerm).toLowerCase();
    if (!term) return filtered;

    return filtered.filter(biz =>
      (biz.companyName ?? '').toLowerCase().includes(term) ||
      (biz.industry ?? '').toLowerCase().includes(term) ||
      (biz.description ?? '').toLowerCase().includes(term) ||
      (biz.businessCategory ?? '').toLowerCase().includes(term)
    );
  }, [businesses, searchTerm, searchQuery, selectedIndustry]);

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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Member Business Directory</h2>
          <p className="text-slate-500">Support local member businesses and global JCI network connections.</p>
        </div>
      </div>

      {/* Education/Instruction Card */}
      <Card noPadding>
        <div className="px-4 md:px-6 pt-4 pb-2">
          <Tabs
            tabs={['Business Directory', 'International Network']}
            activeTab={activeTab === 'directory' ? 'Business Directory' : 'International Network'}
            onTabChange={(tab) => setActiveTab(tab === 'Business Directory' ? 'directory' : 'international')}
          />
        </div>

        {/* Global Category Filter for both Tabs */}
        <div className="px-4 md:px-6 py-3 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 px-1 -mx-1">
            {uniqueIndustries.map(ind => {
              const isActive = selectedIndustry === ind;
              return (
                <button
                  key={ind}
                  onClick={() => setSelectedIndustry(ind)}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-full whitespace-nowrap transition-all duration-200 flex-shrink-0 ${isActive
                    ? 'bg-jci-blue text-white font-medium shadow-md shadow-jci-blue/20'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-jci-blue hover:border-blue-200 font-medium shadow-sm'
                    }`}
                >
                  <span className="text-sm">{ind}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 md:p-6 bg-slate-50/30">
          {activeTab === 'directory' ? (
            <div className="space-y-6">
              <LoadingState loading={loading} error={error} empty={filteredBusinesses.length === 0} emptyMessage="No businesses found matching this category">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredBusinesses.map(biz => {
                    const owner = members.find(m => m.id === biz.memberId);
                    return (
                      <Card key={biz.id} noPadding className="overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full">
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

                            {/* Business Category Tag - fallback to owner profile */}
                            {(biz.businessCategory || (owner?.businessCategory && owner.businessCategory.length > 0)) && (
                              <Badge variant="info" className="text-[10px]">
                                {biz.businessCategory || owner?.businessCategory?.join(', ')}
                              </Badge>
                            )}

                            {/* International Business Status - fallback to owner profile */}
                            {(() => {
                              const status = biz.acceptsInternationalBusiness || owner?.acceptInternationalBusiness;
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
                        <div className="pt-8 px-2 pb-6 flex-1 flex flex-col">
                          <h3 className="text-lg font-bold text-slate-900">{owner?.name || 'Unknown'}</h3>
                          <p className="text-xs text-slate-500 mb-3 flex items-center gap-1">
                            {biz.companyName}
                          </p>
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
                          <p className="text-sm text-slate-600 mb-4 flex-1 line-clamp-3">{biz.description}</p>

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
      </Card>



      {/* Inquiry Form Modal / Business Profile */}
      <Modal
        isOpen={isInquiryModalOpen}
        onClose={() => setInquiryModalOpen(false)}
        title={selectedBiz ? selectedBiz.companyName : 'Inquiry'}
        drawerOnMobile
        size="2xl"
      >
        <div className={selectedBiz ? "grid md:grid-cols-2 gap-6 pt-2" : "space-y-4 pt-2"}>
          {/* Left Column: Business Info */}
          {selectedBiz && (
            <div className="space-y-4 border-b md:border-b-0 md:border-r border-slate-100 pb-6 md:pb-0 md:pr-6">
              <div className="flex items-start gap-4 mb-4 mt-2">
                <img
                  src={selectedBiz.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedBiz.companyName)}&background=0097D7&color=fff`}
                  alt={selectedBiz.companyName}
                  className="w-16 h-16 rounded-lg object-cover border border-slate-200 shadow-sm"
                />
                <div>
                  <h3 className="text-xl font-bold text-slate-900 leading-tight">{selectedBiz.companyName}</h3>
                  <Badge variant="neutral" className="mt-2">{selectedBiz.industry}</Badge>
                </div>
              </div>

              <div className="space-y-4 text-sm mt-2">
                <div>
                  <span className="font-bold text-slate-700 block mb-1 uppercase text-[10px] tracking-widest">About</span>
                  <p className="text-slate-600 leading-relaxed min-h-[60px]">{selectedBiz.description || 'No description provided.'}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-50">
                  <div>
                    <span className="font-bold text-slate-700 block uppercase text-[10px] tracking-widest mb-1">Owner</span>
                    <span className="text-slate-600 font-medium">{members.find(m => m.id === selectedBiz.memberId)?.name || 'Unknown'}</span>
                  </div>
                  {selectedBiz.website && (
                    <div>
                      <span className="font-bold text-slate-700 block uppercase text-[10px] tracking-widest mb-1">Website</span>
                      <a href={selectedBiz.website.startsWith('http') ? selectedBiz.website : `https://${selectedBiz.website}`} target="_blank" rel="noopener noreferrer" className="text-jci-blue hover:text-sky-600 hover:underline break-all font-medium transition-colors">
                        Visit Site
                      </a>
                    </div>
                  )}
                </div>

                {(() => {
                  const ownerCats = members.find(m => m.id === selectedBiz.memberId)?.businessCategory;
                  const bizCatsStr = selectedBiz.businessCategory;
                  const showCats = bizCatsStr ? [bizCatsStr] : ownerCats;

                  return (showCats && showCats.length > 0) ? (
                    <div className="pt-3 border-t border-slate-50">
                      <span className="font-bold text-slate-700 block mb-2 uppercase text-[10px] tracking-widest">Categories</span>
                      <div className="flex flex-wrap gap-1.5">
                        {showCats.map((cat, idx) => (
                          <Badge key={idx} variant="info" className="bg-blue-50/50 text-blue-600 border border-blue-100">{cat}</Badge>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}

                {selectedBiz.offer && (
                  <div className="mt-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100/50 rounded-xl p-4 shadow-inner">
                    <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                      <Gift size={14} className="text-blue-500" /> JCI Member Deal
                    </span>
                    <p className="text-slate-700 font-medium leading-relaxed">{selectedBiz.offer}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Right Column: Inquiry Form */}
          <div className="space-y-4">
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

            <Input
              label="Name"
              placeholder="Your full name"
              required
              value={inquiryForm.name}
              error={inquiryErrors.name}
              onChange={(e) => setInquiryForm({ ...inquiryForm, name: e.target.value })}
            />

            <Input
              label="Company"
              placeholder="Your company name (optional)"
              value={inquiryForm.company}
              onChange={(e) => setInquiryForm({ ...inquiryForm, company: e.target.value })}
            />

            <Input
              label="Phone Number"
              placeholder="E.g. +60123456789"
              required
              value={inquiryForm.phone}
              error={inquiryErrors.phone}
              onChange={(e) => setInquiryForm({ ...inquiryForm, phone: e.target.value })}
            />

            <Textarea
              label="Requirements"
              placeholder="What products or services are you looking for?"
              required
              value={inquiryForm.requirements}
              error={inquiryErrors.requirements}
              onChange={(e) => setInquiryForm({ ...inquiryForm, requirements: e.target.value })}
            />

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setInquiryModalOpen(false)}
              >
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSendInquiry}>
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
    const owner = members.find(m => m.id === business.memberId);
    const acceptStatus = business.acceptsInternationalBusiness || owner?.acceptInternationalBusiness;
    const hasConnections = business.internationalConnections && business.internationalConnections.length > 0;
    return hasConnections || acceptStatus === 'Yes' || acceptStatus === 'Willing to Explore' || acceptStatus === true;
  });

  return (
    <div className="space-y-6">
      {businessesWithConnections.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-100 shadow-sm rounded-xl">
          <Network size={48} className="mx-auto mb-4 text-slate-300" />
          <h4 className="text-lg font-bold text-slate-900 mb-2">No International Connections Found</h4>
          <p className="text-slate-500 mb-4 text-sm max-w-sm mx-auto">Either no businesses have joined the international network yet, or none match your selected category filter.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {businessesWithConnections.map(business => {
            const owner = members.find(m => m.id === business.memberId);
            const status = business.acceptsInternationalBusiness || owner?.acceptInternationalBusiness;
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

                    {(business.businessCategory || (owner?.businessCategory && owner.businessCategory.length > 0)) && (
                      <Badge variant="info" className="text-[10px]">
                        {business.businessCategory || owner?.businessCategory?.join(', ')}
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
                  <h3 className="text-lg font-bold text-slate-900">{owner?.name || 'Unknown'}</h3>
                  <p className="text-xs text-slate-500 mb-3 flex items-center gap-1">
                    {business.companyName}
                  </p>
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
                      <div className="h-full flex items-center justify-center p-3 bg-amber-50/50 rounded-lg border border-amber-100 min-h-[100px]">
                        <div className="text-center">
                          <Globe size={24} className="text-amber-500 mx-auto mb-2" />
                          <p className="text-xs text-amber-700 font-medium leading-tight">Looking for international opportunities</p>
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
