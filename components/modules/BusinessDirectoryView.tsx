import React, { useState, useMemo } from 'react';
import { Building2, Globe, Search, Send, MapPin, Users, Network } from 'lucide-react';
import { Card, Button, Badge, Modal, useToast, Tabs } from '../ui/Common';
import { LoadingState } from '../ui/Loading';
import { useBusinessDirectory } from '../../hooks/useBusinessDirectory';
import { useMembers } from '../../hooks/useMembers';
import { BusinessProfile } from '../../types';


export const BusinessDirectoryView: React.FC<{ searchQuery?: string }> = ({ searchQuery }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBiz, setSelectedBiz] = useState<BusinessProfile | null>(null);
  const [isDetailModalOpen, setDetailModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'directory' | 'international'>('directory');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('All');

  const { businesses, loading, error } = useBusinessDirectory();
  const { members } = useMembers(); // Used to find owner name
  const { showToast } = useToast();

  // Map each industry to a unique premium gradient and background image for the banner (referencing premium dashboard header patterns)
  const INDUSTRY_BANNER_MAP: Record<string, { from: string; to: string; image: string }> = {
    'Advertising, Marketing & Media': { from: 'from-pink-500', to: 'to-purple-600', image: 'https://images.unsplash.com/photo-1557838923-2985c318be48?auto=format&fit=crop&q=80' },
    'Agriculture & Animals': { from: 'from-green-500', to: 'to-emerald-600', image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80' },
    'Architecture, Engineering & Construction': { from: 'from-indigo-500', to: 'to-blue-600', image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80' },
    'Art, Entertainment & Design': { from: 'from-rose-500', to: 'to-orange-500', image: 'https://images.unsplash.com/photo-1513364775202-741ef09e5981?auto=format&fit=crop&q=80' },
    'Automotive & Accessories': { from: 'from-slate-600', to: 'to-gray-800', image: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&q=80' },
    'Food & Beverages': { from: 'from-yellow-500', to: 'to-amber-600', image: 'https://images.unsplash.com/photo-1495195129352-aec329a2d7ea?auto=format&fit=crop&q=80' },
    'Telecom, AI, Computers & IT': { from: 'from-cyan-500', to: 'to-teal-600', image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80' },
    'Consulting & Professional Services': { from: 'from-purple-500', to: 'to-fuchsia-600', image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80' },
    'Education & Training': { from: 'from-blue-500', to: 'to-sky-600', image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80' },
    'Event & Hospitality': { from: 'from-pink-500', to: 'to-rose-500', image: 'https://images.unsplash.com/photo-1505236858219-8359eb29e329?auto=format&fit=crop&q=80' },
    'Crypto, Blockchain, Finance & Insurance': { from: 'from-indigo-600', to: 'to-violet-700', image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80' },
    'Health & Wellness': { from: 'from-red-500', to: 'to-pink-600', image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&q=80' },
    'Legal, HR, Accounting & Tax': { from: 'from-emerald-500', to: 'to-green-600', image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&q=80' },
    'Manufacturing & Supply Chain': { from: 'from-orange-500', to: 'to-amber-600', image: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80' },
    'Wholesale, Retail & E-Commerce': { from: 'from-teal-500', to: 'to-cyan-600', image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80' },
    'Personal, Beauty & Sports': { from: 'from-fuchsia-500', to: 'to-pink-500', image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80' },
    'Real Estate & Property Services': { from: 'from-slate-500', to: 'to-gray-600', image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80' },
    'Transport & Logistics': { from: 'from-amber-500', to: 'to-yellow-600', image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80' },
    'Travel & Tourism': { from: 'from-sky-500', to: 'to-blue-600', image: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&q=80' },
    'Other': { from: 'from-jci-navy', to: 'to-jci-blue', image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80' },
  };

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
    setDetailModalOpen(false);
    setSelectedBiz(null);
    showToast('Inquiry sent to owner', 'success');
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
        <div className="p-4">
          {activeTab === 'directory' ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-3 px-1">Categories</h3>
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 px-1 -mx-1">
                  {uniqueIndustries.map(ind => {
                    const isActive = selectedIndustry === ind;
                    return (
                      <button
                        key={ind}
                        onClick={() => setSelectedIndustry(ind)}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-full whitespace-nowrap transition-colors flex-shrink-0 ${isActive
                          ? 'bg-jci-blue text-white font-medium shadow-md shadow-jci-blue/20'
                          : 'bg-blue-50 text-jci-blue hover:bg-blue-100 font-medium'
                          }`}
                      >
                        <span className="text-sm">{ind}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <LoadingState loading={loading} error={error} empty={filteredBusinesses.length === 0} emptyMessage="No businesses found">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredBusinesses.map(biz => {
                    const owner = members.find(m => m.id === biz.memberId);
                    return (
                      <Card key={biz.id} noPadding className="overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full">
                        {/* Industry‑specific banner (Premium Gradient + Decorative Pattern) */}
                        <div className={`h-24 bg-gradient-to-br ${INDUSTRY_BANNER_MAP[biz.industry ?? 'Other']?.from ?? 'from-slate-100'} ${INDUSTRY_BANNER_MAP[biz.industry ?? 'Other']?.to ?? 'to-slate-200'} relative`}>
                          {/* Decorative Background Pattern */}
                          <div
                            className="absolute inset-0 bg-cover bg-center opacity-20 mix-blend-overlay"
                            style={{ backgroundImage: `url('${INDUSTRY_BANNER_MAP[biz.industry ?? 'Other']?.image || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80'}')` }}
                          ></div>

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
                                setDetailModalOpen(true);
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
            <InternationalNetworkTab businesses={filteredBusinesses} />
          )}
        </div>
      </Card>

      {/* Contact Modal */}
      {selectedBiz && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => { setDetailModalOpen(false); setSelectedBiz(null); }}
          title={`Contact ${selectedBiz.companyName}`}
          drawerOnMobile
        >
          <div className="space-y-4">
            <div className="flex items-center gap-4 mb-4">
              <img
                src={selectedBiz.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedBiz.companyName)}&background=0097D7&color=fff`}
                alt={selectedBiz.companyName}
                className="w-16 h-16 rounded-lg"
              />
              <div>
                <h3 className="font-bold text-slate-900">{selectedBiz.companyName}</h3>
                <p className="text-sm text-slate-500">{selectedBiz.industry}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600">{selectedBiz.description}</p>
            {selectedBiz.offer && (
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">JCI Member Deal</span>
                <p className="text-sm font-medium text-blue-900 mt-1">{selectedBiz.offer}</p>
              </div>
            )}
            <div className="flex gap-2 pt-4">
              {selectedBiz.website && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => window.open(selectedBiz.website!.startsWith('http') ? selectedBiz.website : `https://${selectedBiz.website}`, '_blank')}
                >
                  <Globe size={16} className="mr-2" /> Visit Website
                </Button>
              )}
              <Button className="flex-1" onClick={handleContact}>
                <Send size={16} className="mr-2" /> Send Inquiry
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// International Network Tab Component
interface InternationalNetworkTabProps {
  businesses: BusinessProfile[];
}

const InternationalNetworkTab: React.FC<InternationalNetworkTabProps> = ({ businesses }) => {
  const businessesWithConnections = businesses.filter(b =>
    b.internationalConnections && b.internationalConnections.length > 0
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Global JCI Network Connections</h3>
          <p className="text-sm text-slate-500">Connect your business with JCI chapters worldwide</p>
        </div>
      </div>

      {businessesWithConnections.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg">
          <Network size={48} className="mx-auto mb-4 text-slate-300" />
          <h4 className="text-lg font-bold text-slate-900 mb-2">No International Connections Yet</h4>
          <p className="text-slate-600 mb-4">Business connections will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {businessesWithConnections.map(business => (
            <Card key={business.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {business.logo && (
                    <img src={business.logo} alt={business.companyName} className="w-12 h-12 rounded-lg" />
                  )}
                  <div>
                    <h4 className="font-bold text-slate-900">{business.companyName}</h4>
                    <p className="text-sm text-slate-500">{business.industry}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {business.internationalConnections?.map((connection, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <MapPin size={16} className="text-slate-400" />
                        <span className="font-semibold text-slate-900">{connection.jciChapter}</span>
                        <Badge variant="neutral">{connection.country}</Badge>
                      </div>
                      <Badge variant="info">{connection.connectionType}</Badge>
                    </div>
                    {connection.contactPerson && (
                      <p className="text-sm text-slate-600 mb-1">
                        <Users size={14} className="inline mr-1" />
                        Contact: {connection.contactPerson}
                      </p>
                    )}
                    {connection.notes && (
                      <p className="text-xs text-slate-500 mt-2">{connection.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
