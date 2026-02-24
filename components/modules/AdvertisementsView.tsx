import React, { useState, useMemo } from 'react';
import { Megaphone, Plus, Edit, Trash2, Eye, MousePointerClick, TrendingUp, Calendar, Image as ImageIcon, Link as LinkIcon, BarChart3, Download, Filter } from 'lucide-react';
import { Button, Card, Badge, Modal, useToast, Tabs, StatCardsContainer } from '../ui/Common';
import { Input, Select, Textarea } from '../ui/Form';
import { LoadingState } from '../ui/Loading';
import { useAdvertisements } from '../../hooks/useAdvertisements';
import { usePermissions } from '../../hooks/usePermissions';
import { Advertisement } from '../../services/advertisementService';
import { formatDate, toDate } from '../../utils/dateUtils';
import { formatNumber } from '../../utils/formatUtils';
import { Timestamp } from 'firebase/firestore';

// AdImage component extracted outside to avoid React Hooks rule violation
interface AdImageProps {
  imageUrl?: string;
  title: string;
}

const AdImage: React.FC<AdImageProps> = ({ imageUrl, title }) => {
  const [imageError, setImageError] = React.useState(false);

  if (!imageUrl || imageError) {
    return <ImageIcon className="text-slate-400" size={32} />;
  }

  return (
    <img
      src={imageUrl}
      alt={title}
      className="w-full h-full object-cover"
      onError={() => setImageError(true)}
    />
  );
};

export const AdvertisementsView: React.FC<{ searchQuery?: string }> = ({ searchQuery }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAd, setSelectedAd] = useState<Advertisement | null>(null);
  const [activeTab, setActiveTab] = useState<'ads' | 'packages' | 'analytics'>('ads');
  const [analyticsFilter, setAnalyticsFilter] = useState<'all' | 'active' | 'scheduled' | 'completed'>('all');
  const [selectedAdForAnalytics, setSelectedAdForAnalytics] = useState<Advertisement | null>(null);
  const { advertisements, packages, loading, error, createAdvertisement, updateAdvertisement, deleteAdvertisement } = useAdvertisements();
  const { isBoard, isAdmin } = usePermissions();
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const adData: Omit<Advertisement, 'id' | 'createdAt' | 'updatedAt' | 'impressions' | 'clicks'> = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      type: formData.get('type') as any,
      placement: formData.get('placement') as any,
      targetAudience: formData.get('targetAudience') as any || 'All Members',
      imageUrl: formData.get('imageUrl') as string,
      linkUrl: formData.get('linkUrl') as string || undefined,
      startDate: formData.get('startDate') as string,
      endDate: formData.get('endDate') as string || undefined,
      status: (formData.get('status') as any) || 'Active',
      priority: parseInt(formData.get('priority') as string) || 0,
      budget: formData.get('budget') ? parseFloat(formData.get('budget') as string) : undefined,
    };

    try {
      if (selectedAd) {
        await updateAdvertisement(selectedAd.id!, adData);
      } else {
        await createAdvertisement(adData);
      }
      setIsModalOpen(false);
      setSelectedAd(null);
      e.currentTarget.reset();
    } catch (err) {
      // Error handled by hook
    }
  };

  const calculateCTR = (ad: Advertisement) => {
    if (ad.impressions === 0) return 0;
    return (ad.clicks / ad.impressions) * 100;
  };

  const calculateROI = (ad: Advertisement) => {
    if (!ad.budget) {
      return {
        costPerClick: 0,
        costPerImpression: 0,
        totalSpent: 0,
        estimatedValue: 0,
      };
    }
    const costPerClick = ad.budget / (ad.clicks || 1);
    const costPerImpression = ad.budget / (ad.impressions || 1);
    return {
      costPerClick,
      costPerImpression,
      totalSpent: ad.budget,
      estimatedValue: ad.clicks * 10, // Assuming each click has an estimated value
    };
  };

  const filteredAdsForAnalytics = useMemo(() => {
    if (analyticsFilter === 'all') return advertisements;
    return advertisements.filter(ad => {
      if (analyticsFilter === 'active') return ad.status === 'Active';
      if (analyticsFilter === 'scheduled') return ad.status === 'Scheduled';
      if (analyticsFilter === 'completed') return ad.status === 'Expired';
      return true;
    });
  }, [advertisements, analyticsFilter]);

  const analyticsSummary = useMemo(() => {
    const totalImpressions = filteredAdsForAnalytics.reduce((sum, ad) => sum + ad.impressions, 0);
    const totalClicks = filteredAdsForAnalytics.reduce((sum, ad) => sum + ad.clicks, 0);
    const totalBudget = filteredAdsForAnalytics.reduce((sum, ad) => sum + (ad.budget || 0), 0);
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    return {
      totalImpressions,
      totalClicks,
      totalBudget,
      avgCTR,
      activeAds: filteredAdsForAnalytics.filter(ad => ad.status === 'Active').length,
    };
  }, [filteredAdsForAnalytics]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Advertisements & Promotions</h2>
          <p className="text-slate-500">Manage promotional content and advertising campaigns.</p>
        </div>
        {(isBoard || isAdmin) && (
          <Button onClick={() => {
            setSelectedAd(null);
            setIsModalOpen(true);
          }}>
            <Plus size={16} className="mr-2" />
            Create Advertisement
          </Button>
        )}
      </div>

      <Card noPadding>
        <div className="px-4 md:px-6 pt-4">
          <Tabs
            tabs={['Advertisements', 'Promotion Packages', 'Analytics']}
            activeTab={
              activeTab === 'ads' ? 'Advertisements' :
                activeTab === 'packages' ? 'Promotion Packages' :
                  'Analytics'
            }
            onTabChange={(tab) => {
              if (tab === 'Advertisements') setActiveTab('ads');
              else if (tab === 'Promotion Packages') setActiveTab('packages');
              else setActiveTab('analytics');
            }}
          />
        </div>
        <div className="p-4">
          {activeTab === 'ads' ? (
            <LoadingState loading={loading} error={error} empty={advertisements.length === 0} emptyMessage="No advertisements found">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {advertisements.filter(ad => {
                  const term = (searchQuery || '').toLowerCase();
                  if (!term) return true;
                  return (
                    (ad.title ?? '').toLowerCase().includes(term) ||
                    (ad.description ?? '').toLowerCase().includes(term)
                  );
                }).map(ad => (
                  <Card key={ad.id} className="hover:shadow-md transition-shadow">
                    <div className="aspect-video bg-slate-100 rounded-lg mb-4 flex items-center justify-center overflow-hidden relative">
                      <AdImage imageUrl={ad.imageUrl} title={ad.title} />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-bold text-slate-900 mb-1">{ad.title}</h3>
                          <p className="text-sm text-slate-600 line-clamp-2">{ad.description}</p>
                        </div>
                        <Badge variant={ad.status === 'Active' ? 'success' : ad.status === 'Scheduled' ? 'info' : 'neutral'}>
                          {ad.status}
                        </Badge>
                      </div>

                      <div className="space-y-2 text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                          <Megaphone size={12} />
                          <span className="capitalize">{ad.type}</span>
                          <span>•</span>
                          <span className="capitalize">{ad.placement}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar size={12} />
                          <span>{formatDate(toDate(ad.startDate).toISOString())}</span>
                          {ad.endDate && (
                            <>
                              <span>-</span>
                              <span>{formatDate(toDate(ad.endDate).toISOString())}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-3 border-t">
                        <div>
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Eye size={12} />
                            <span>Impressions</span>
                          </div>
                          <p className="font-semibold text-slate-900">{formatNumber(ad.impressions)}</p>
                        </div>
                        <div>
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <MousePointerClick size={12} />
                            <span>Clicks</span>
                          </div>
                          <p className="font-semibold text-slate-900">{formatNumber(ad.clicks)}</p>
                        </div>
                      </div>

                      <div className="pt-2 border-t">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-500">CTR</span>
                          <span className="font-semibold text-slate-900">{calculateCTR(ad).toFixed(2)}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5">
                          <div
                            className="bg-jci-blue h-1.5 rounded-full"
                            style={{ width: `${Math.min(calculateCTR(ad) * 10, 100)}%` }}
                          />
                        </div>
                      </div>

                      {(isBoard || isAdmin) && (
                        <div className="flex gap-2 pt-3 border-t">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedAd(ad);
                              setIsModalOpen(true);
                            }}
                          >
                            <Edit size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              if (window.confirm('Are you sure you want to delete this advertisement?')) {
                                await deleteAdvertisement(ad.id!);
                              }
                            }}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </LoadingState>
          ) : activeTab === 'packages' ? (
            <LoadingState loading={loading} error={error} empty={packages.length === 0} emptyMessage="No promotion packages available">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {packages.filter(pkg => {
                  const term = (searchQuery || '').toLowerCase();
                  if (!term) return true;
                  return (
                    (pkg.name ?? '').toLowerCase().includes(term) ||
                    (pkg.description ?? '').toLowerCase().includes(term)
                  );
                }).map(pkg => (
                  <Card key={pkg.id} className="hover:shadow-md transition-shadow">
                    <h3 className="font-bold text-lg text-slate-900 mb-2">{pkg.name}</h3>
                    <p className="text-sm text-slate-600 mb-4">{pkg.description}</p>
                    <div className="mb-4">
                      <span className="text-3xl font-bold text-slate-900">RM {pkg.price}</span>
                      <span className="text-sm text-slate-500"> / {pkg.duration} days</span>
                    </div>
                    <div className="space-y-2 mb-4">
                      {pkg.features.map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-slate-600">
                          <div className="w-1.5 h-1.5 bg-jci-blue rounded-full" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                    <Button className="w-full">Select Package</Button>
                  </Card>
                ))}
              </div>
            </LoadingState>
          ) : (
            <AdvertisementAnalyticsTab
              advertisements={filteredAdsForAnalytics}
              summary={analyticsSummary}
              filter={analyticsFilter}
              onFilterChange={setAnalyticsFilter}
              onSelectAd={setSelectedAdForAnalytics}
              calculateCTR={calculateCTR}
              calculateROI={calculateROI}
            />
          )}
        </div>
      </Card>

      {/* Create/Edit Advertisement Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedAd(null);
        }}
        title={selectedAd ? 'Edit Advertisement' : 'Create Advertisement'}
        size="lg"
        drawerOnMobile
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            name="title"
            label="Title"
            placeholder="e.g. Tech Solutions Inc."
            defaultValue={selectedAd?.title}
            required
          />

          <Textarea
            name="description"
            label="Description"
            placeholder="Advertisement description..."
            defaultValue={selectedAd?.description}
            rows={3}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              name="type"
              label="Type"
              defaultValue={selectedAd?.type}
              options={[
                { label: 'Banner', value: 'Banner' },
                { label: 'Newsletter', value: 'Newsletter' },
                { label: 'Event Sponsorship', value: 'Event Sponsorship' },
                { label: 'Social Media', value: 'Social Media' },
                { label: 'Website', value: 'Website' },
              ]}
              required
            />
            <Select
              name="placement"
              label="Placement"
              defaultValue={selectedAd?.placement}
              options={[
                { label: 'Homepage', value: 'Homepage' },
                { label: 'Events Page', value: 'Events Page' },
                { label: 'Newsletter Header', value: 'Newsletter Header' },
                { label: 'Newsletter Footer', value: 'Newsletter Footer' },
                { label: 'Sidebar', value: 'Sidebar' },
                { label: 'Popup', value: 'Popup' },
              ]}
              required
            />
          </div>

          <Select
            name="targetAudience"
            label="Target Audience"
            defaultValue={selectedAd?.targetAudience || 'All Members'}
            options={[
              { label: 'All Members', value: 'All Members' },
              { label: 'Specific Tier', value: 'Specific Tier' },
              { label: 'Specific Role', value: 'Specific Role' },
              { label: 'Custom', value: 'Custom' },
            ]}
          />

          <Input
            name="imageUrl"
            label="Image URL"
            placeholder="https://example.com/image.jpg"
            defaultValue={selectedAd?.imageUrl}
            required
          />

          <Input
            name="linkUrl"
            label="Link URL (Optional)"
            placeholder="https://example.com"
            defaultValue={selectedAd?.linkUrl}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              name="startDate"
              label="Start Date"
              type="date"
              defaultValue={selectedAd?.startDate ? toDate(selectedAd.startDate).toISOString().split('T')[0] : undefined}
              required
            />
            <Input
              name="endDate"
              label="End Date (Optional)"
              type="date"
              defaultValue={selectedAd?.endDate ? toDate(selectedAd.endDate).toISOString().split('T')[0] : undefined}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              name="priority"
              label="Priority (0-10)"
              type="number"
              min="0"
              max="10"
              defaultValue={selectedAd?.priority?.toString() || '5'}
              required
            />
            <Input
              name="budget"
              label="Budget (RM, Optional)"
              type="number"
              min="0"
              step="0.01"
              defaultValue={selectedAd?.budget?.toString()}
            />
          </div>

          <Select
            name="status"
            label="Status"
            defaultValue={selectedAd?.status || 'Active'}
            options={[
              { label: 'Active', value: 'Active' },
              { label: 'Scheduled', value: 'Scheduled' },
              { label: 'Paused', value: 'Paused' },
              { label: 'Expired', value: 'Expired' },
            ]}
          />

          <div className="flex gap-3 pt-4">
            <Button className="flex-1" type="submit">
              {selectedAd ? 'Update Advertisement' : 'Create Advertisement'}
            </Button>
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setSelectedAd(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      {/* Advertisement Analytics Detail Modal */}
      {selectedAdForAnalytics && (
        <AdvertisementAnalyticsModal
          isOpen={!!selectedAdForAnalytics}
          onClose={() => setSelectedAdForAnalytics(null)}
          advertisement={selectedAdForAnalytics}
          calculateCTR={calculateCTR}
          calculateROI={calculateROI}
          drawerOnMobile
        />
      )}
    </div>
  );
};

// Advertisement Analytics Tab Component
interface AdvertisementAnalyticsTabProps {
  advertisements: Advertisement[];
  summary: {
    totalImpressions: number;
    totalClicks: number;
    totalBudget: number;
    avgCTR: number;
    activeAds: number;
  };
  filter: 'all' | 'active' | 'scheduled' | 'completed';
  onFilterChange: (filter: 'all' | 'active' | 'scheduled' | 'completed') => void;
  onSelectAd: (ad: Advertisement | null) => void;
  calculateCTR: (ad: Advertisement) => number;
  calculateROI: (ad: Advertisement) => {
    costPerClick: number;
    costPerImpression: number;
    totalSpent: number;
    estimatedValue: number;
  };
}

const AdvertisementAnalyticsTab: React.FC<AdvertisementAnalyticsTabProps> = ({
  advertisements,
  summary,
  filter,
  onFilterChange,
  onSelectAd,
  calculateCTR,
  calculateROI,
}) => {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <StatCardsContainer>
        <Card className="bg-blue-50 border-blue-100">
          <div className="flex items-center gap-3">
            <Eye className="text-blue-600" size={24} />
            <div>
              <p className="text-sm text-blue-600 font-medium">Total Impressions</p>
              <h3 className="text-2xl font-bold text-slate-900">{formatNumber(summary.totalImpressions)}</h3>
            </div>
          </div>
        </Card>
        <Card className="bg-green-50 border-green-100">
          <div className="flex items-center gap-3">
            <MousePointerClick className="text-green-600" size={24} />
            <div>
              <p className="text-sm text-green-600 font-medium">Total Clicks</p>
              <h3 className="text-2xl font-bold text-slate-900">{formatNumber(summary.totalClicks)}</h3>
            </div>
          </div>
        </Card>
        <Card className="bg-purple-50 border-purple-100">
          <div className="flex items-center gap-3">
            <TrendingUp className="text-purple-600" size={24} />
            <div>
              <p className="text-sm text-purple-600 font-medium">Avg CTR</p>
              <h3 className="text-2xl font-bold text-slate-900">{summary.avgCTR.toFixed(2)}%</h3>
            </div>
          </div>
        </Card>
        <Card className="bg-amber-50 border-amber-100">
          <div className="flex items-center gap-3">
            <BarChart3 className="text-amber-600" size={24} />
            <div>
              <p className="text-sm text-amber-600 font-medium">Active Ads</p>
              <h3 className="text-2xl font-bold text-slate-900">{summary.activeAds}</h3>
            </div>
          </div>
        </Card>
      </StatCardsContainer>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter size={16} className="text-slate-500" />
        <span className="text-sm text-slate-600">Filter:</span>
        <select
          value={filter}
          onChange={(e) => onFilterChange(e.target.value as any)}
          className="px-3 py-1 border rounded-md text-sm"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="scheduled">Scheduled</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Ad Performance Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="py-3 px-4">Advertisement</th>
                <th className="py-3 px-4">Impressions</th>
                <th className="py-3 px-4">Clicks</th>
                <th className="py-3 px-4">CTR</th>
                <th className="py-3 px-4">Budget</th>
                <th className="py-3 px-4">CPC</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {advertisements.map(ad => {
                const roi = calculateROI(ad);
                return (
                  <tr key={ad.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-slate-900">{ad.title}</p>
                        <p className="text-xs text-slate-500">{ad.type} • {ad.placement}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{formatNumber(ad.impressions)}</td>
                    <td className="py-3 px-4 text-slate-600">{formatNumber(ad.clicks)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{calculateCTR(ad).toFixed(2)}%</span>
                        <div className="w-16 bg-slate-200 rounded-full h-1.5">
                          <div
                            className="bg-jci-blue h-1.5 rounded-full"
                            style={{ width: `${Math.min(calculateCTR(ad) * 10, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {ad.budget ? `RM ${formatNumber(ad.budget)}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {roi.costPerClick ? `RM ${roi.costPerClick.toFixed(2)}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onSelectAd(ad)}
                      >
                        <BarChart3 size={14} className="mr-1" />
                        View Details
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

// Advertisement Analytics Detail Modal Component
interface AdvertisementAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  advertisement: Advertisement;
  calculateCTR: (ad: Advertisement) => number;
  calculateROI: (ad: Advertisement) => {
    costPerClick: number;
    costPerImpression: number;
    totalSpent: number;
    estimatedValue: number;
  };
  drawerOnMobile?: boolean;
}

const AdvertisementAnalyticsModal: React.FC<AdvertisementAnalyticsModalProps> = ({
  isOpen,
  onClose,
  advertisement,
  calculateCTR,
  calculateROI,
  drawerOnMobile,
}) => {
  const ctr = calculateCTR(advertisement);
  const roi = calculateROI(advertisement);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Analytics - ${advertisement.title}`} size="lg" drawerOnMobile={drawerOnMobile}>
      <div className="space-y-6">
        {/* Performance Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-blue-50 border-blue-100">
            <div className="flex items-center gap-3">
              <Eye className="text-blue-600" size={24} />
              <div>
                <p className="text-sm text-blue-600 font-medium">Impressions</p>
                <h3 className="text-2xl font-bold text-slate-900">{formatNumber(advertisement.impressions)}</h3>
              </div>
            </div>
          </Card>
          <Card className="bg-green-50 border-green-100">
            <div className="flex items-center gap-3">
              <MousePointerClick className="text-green-600" size={24} />
              <div>
                <p className="text-sm text-green-600 font-medium">Clicks</p>
                <h3 className="text-2xl font-bold text-slate-900">{formatNumber(advertisement.clicks)}</h3>
              </div>
            </div>
          </Card>
          <Card className="bg-purple-50 border-purple-100">
            <div className="flex items-center gap-3">
              <TrendingUp className="text-purple-600" size={24} />
              <div>
                <p className="text-sm text-purple-600 font-medium">CTR</p>
                <h3 className="text-2xl font-bold text-slate-900">{ctr.toFixed(2)}%</h3>
              </div>
            </div>
          </Card>
          <Card className="bg-amber-50 border-amber-100">
            <div className="flex items-center gap-3">
              <BarChart3 className="text-amber-600" size={24} />
              <div>
                <p className="text-sm text-amber-600 font-medium">Budget</p>
                <h3 className="text-2xl font-bold text-slate-900">
                  {advertisement.budget ? `RM ${formatNumber(advertisement.budget)}` : 'N/A'}
                </h3>
              </div>
            </div>
          </Card>
        </div>

        {/* ROI Metrics */}
        {advertisement.budget && (
          <Card>
            <h4 className="font-semibold text-slate-900 mb-4">ROI Metrics</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-600 mb-1">Cost Per Click (CPC)</p>
                <p className="text-lg font-semibold text-slate-900">RM {roi.costPerClick.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">Cost Per Impression (CPM)</p>
                <p className="text-lg font-semibold text-slate-900">RM {roi.costPerImpression.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">Total Spent</p>
                <p className="text-lg font-semibold text-slate-900">RM {formatNumber(roi.totalSpent)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">Estimated Value</p>
                <p className="text-lg font-semibold text-green-600">RM {formatNumber(roi.estimatedValue)}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Ad Details */}
        <Card>
          <h4 className="font-semibold text-slate-900 mb-4">Advertisement Details</h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Type:</span>
              <span className="text-sm font-medium text-slate-900">{advertisement.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Placement:</span>
              <span className="text-sm font-medium text-slate-900">{advertisement.placement}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Status:</span>
              <Badge variant={advertisement.status === 'Active' ? 'success' : 'neutral'}>
                {advertisement.status}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Start Date:</span>
              <span className="text-sm font-medium text-slate-900">
                {formatDate(toDate(advertisement.startDate).toISOString())}
              </span>
            </div>
            {advertisement.endDate && (
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">End Date:</span>
                <span className="text-sm font-medium text-slate-900">
                  {formatDate(toDate(advertisement.endDate).toISOString())}
                </span>
              </div>
            )}
          </div>
        </Card>
      </div>
    </Modal>
  );
};

