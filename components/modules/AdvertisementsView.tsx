import React, { useState, useMemo } from 'react';
import { Plus, Edit, Trash2, Eye, MousePointerClick, Image as ImageIcon } from 'lucide-react';
import { Button, Card, Badge, useToast, Tabs, PageHeader, ConfirmDialog, CONFIRM_CLOSED } from '../ui/Common';
import type { ConfirmState } from '../ui/Common';
import { LoadingState } from '../ui/Loading';
import { useAdvertisements } from '../../hooks/useAdvertisements';
import { usePermissions } from '../../hooks/usePermissions';
import { Advertisement } from '../../services/advertisementService';
import { formatNumber } from '../../utils/formatUtils';
import { uploadToCloudinary } from '../../services/cloudinaryService';
import imageCompression from 'browser-image-compression';
import { AdvertisementAnalyticsModal } from './Advertisements/AdvertisementAnalyticsModal';
import { AdvertisementAnalyticsTab } from './Advertisements/AdvertisementAnalyticsTab';
import { AdvertisementFormModal } from './Advertisements/AdvertisementFormModal';
import { GuestPageAnalyticsSection } from './Advertisements/GuestPageAnalyticsSection';

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
  const [confirmState, setConfirmState] = useState<ConfirmState>(CONFIRM_CLOSED);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAd, setSelectedAd] = useState<Advertisement | null>(null);
  const [activeTab, setActiveTab] = useState<'ads' | 'packages' | 'analytics' | 'guest'>('ads');
  const [analyticsFilter, setAnalyticsFilter] = useState<'all' | 'active' | 'scheduled' | 'completed'>('all');
  const [selectedAdForAnalytics, setSelectedAdForAnalytics] = useState<Advertisement | null>(null);
  const { advertisements, packages, loading, error, createAdvertisement, updateAdvertisement, deleteAdvertisement } = useAdvertisements();
  const { isBoard, isAdmin } = usePermissions();
  const { showToast } = useToast();
  const [formImage, setFormImage] = useState<File | null>(null);
  const [formLogo, setFormLogo] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [statusActive, setStatusActive] = useState(true);

  React.useEffect(() => {
    if (selectedAd) {
      setFormImage(null);
      setFormLogo(null);
      setShowAdvanced(false);
      setStatusActive(selectedAd.status === 'Active');
    } else {
      setFormImage(null);
      setFormLogo(null);
      setShowAdvanced(false);
      setStatusActive(true);
    }
  }, [selectedAd, isModalOpen]);

  const filteredAds = useMemo(() => {
    const term = (searchQuery || '').toLowerCase();
    if (!term) return advertisements;
    return advertisements.filter(ad =>
      (ad.title ?? '').toLowerCase().includes(term) ||
      (ad.description ?? '').toLowerCase().includes(term) ||
      (ad.type ?? '').toLowerCase().includes(term) ||
      (Array.isArray(ad.placement) ? ad.placement.join(' ') : (ad.placement ?? '')).toLowerCase().includes(term) ||
      (ad.status ?? '').toLowerCase().includes(term) ||
      (ad.targetAudience ?? '').toLowerCase().includes(term)
    );
  }, [advertisements, searchQuery]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    setIsUploading(true);
    try {
      let imageUrl = selectedAd?.imageUrl || '';
      let logoUrl = selectedAd?.logoUrl || '';

      const compressAndUpload = async (file: File, folder: string) => {
        let fileToUpload = file;
        try {
          const compressedFile = await imageCompression(file, { maxSizeMB: 0.2, maxWidthOrHeight: 1920, useWebWorker: true });
          fileToUpload = new File([compressedFile], file.name, { type: compressedFile.type, lastModified: Date.now() });
        } catch {
          // use original
        }
        return uploadToCloudinary(fileToUpload, folder, (p) => setUploadProgress(p));
      };

      if (formImage) {
        imageUrl = await compressAndUpload(formImage, 'advertisements');
      }
      if (formLogo) {
        logoUrl = await compressAndUpload(formLogo, 'advertisements/logos');
      }

      if (!imageUrl) {
        showToast('Please upload an Ad Image.', 'error');
        setIsUploading(false);
        return;
      }

      const adData: Omit<Advertisement, 'id' | 'createdAt' | 'updatedAt' | 'impressions' | 'clicks'> = {
        title: formData.get('title') as string,
        description: formData.get('description') as string,
        type: 'Banner',
        placement: ['Homepage'],
        targetAudience: formData.get('targetAudience') as any || 'All Members',
        imageUrl: imageUrl,
        logoUrl: logoUrl || undefined,
        linkUrl: formData.get('linkUrl') as string || undefined,
        startDate: selectedAd?.startDate || new Date().toISOString().split('T')[0],
        endDate: (formData.get('endDate') as string) || undefined,
        status: (formData.get('status') as any) || 'Active',
        priority: parseInt(formData.get('priority') as string) || 0,
        budget: formData.get('budget') ? parseFloat(formData.get('budget') as string) : undefined,
        termsAndConditions: formData.get('termsAndConditions') as string || undefined,
      };

      if (selectedAd) {
        await updateAdvertisement(selectedAd.id!, adData);
      } else {
        await createAdvertisement(adData);
      }
      setIsModalOpen(false);
      setSelectedAd(null);
      setFormImage(null);
      setFormLogo(null);
      e.currentTarget.reset();
    } catch (err) {
      // Error handled by hook
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
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
      <PageHeader title="Partnership & Promotions" description="Manage promotional content and partnership campaigns." />

      <Card noPadding>
        <div className="px-4 md:px-6 pt-4">
          <Tabs
            tabs={[{id: 'ads', label: 'Partnerships'}, {id: 'packages', label: 'Promotion Packages'}, {id: 'analytics', label: 'Analytics'}, {id: 'guest', label: 'Guest Analytics'}]}
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab as typeof activeTab)}
          />
        </div>
        <div className="p-4">
          {activeTab === 'ads' ? (
            <LoadingState loading={loading} error={error} empty={filteredAds.length === 0} emptyMessage="No partnerships found">
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Partner</th>
                        <th className="py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Benefit</th>
                        <th className="py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Impressions</th>
                        <th className="py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Clicks</th>
                        <th className="py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">CTR</th>
                        <th className="py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                        {(isBoard || isAdmin) && <th className="py-3 px-3" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {/* Create partnership row */}
                      {(isBoard || isAdmin) && (
                        <tr
                          className="cursor-pointer hover:bg-blue-50/40 transition-colors group"
                          onClick={() => { setSelectedAd(null); setIsModalOpen(true); }}
                        >
                          <td colSpan={7} className="py-3 px-3">
                            <div className="flex items-center gap-3 text-slate-400 group-hover:text-jci-blue transition-colors">
                              <div className="w-10 h-10 rounded-lg border-2 border-dashed border-slate-200 group-hover:border-jci-blue/40 flex items-center justify-center shrink-0 transition-colors">
                                <Plus size={16} />
                              </div>
                              <span className="font-semibold text-sm">Create Partnership</span>
                            </div>
                          </td>
                        </tr>
                      )}
                      {filteredAds.map(ad => (
                        <tr key={ad.id} className="hover:bg-slate-50/60 transition-colors">
                          {/* Partner identity */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                                {ad.logoUrl
                                  ? <img src={ad.logoUrl} alt="" className="w-full h-full object-contain p-1" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                  : ad.imageUrl
                                    ? <img src={ad.imageUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                    : <ImageIcon size={16} className="text-slate-300" />
                                }
                              </div>
                              <span className="font-semibold text-slate-900 whitespace-nowrap">{ad.title}</span>
                            </div>
                          </td>
                          {/* Benefit */}
                          <td className="py-3 px-3 max-w-xs">
                            <p className="text-slate-500 text-xs line-clamp-2 leading-relaxed">{ad.description}</p>
                          </td>
                          {/* Stats */}
                          <td className="py-3 px-3 text-right font-semibold text-slate-700 tabular-nums">{formatNumber(ad.impressions)}</td>
                          <td className="py-3 px-3 text-right font-semibold text-slate-700 tabular-nums">{formatNumber(ad.clicks)}</td>
                          <td className="py-3 px-3 text-right">
                            <span className="text-xs font-semibold text-slate-700 tabular-nums">{calculateCTR(ad).toFixed(1)}%</span>
                            <div className="w-16 bg-slate-100 rounded-full h-1 mt-1 ml-auto">
                              <div className="bg-jci-blue h-1 rounded-full" style={{ width: `${Math.min(calculateCTR(ad) * 10, 100)}%` }} />
                            </div>
                          </td>
                          {/* Status */}
                          <td className="py-3 px-3">
                            <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full ${ad.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${ad.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                              {ad.status}
                            </span>
                          </td>
                          {/* Actions */}
                          {(isBoard || isAdmin) && (
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1 justify-end">
                                <button
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-jci-blue hover:bg-blue-50 transition-colors"
                                  onClick={() => { setSelectedAd(ad); setIsModalOpen(true); }}
                                >
                                  <Edit size={14} />
                                </button>
                                <button
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                  onClick={() => setConfirmState({ open: true, title: 'Delete Partnership', message: 'Delete this partnership?', variant: 'danger', onConfirm: async () => { setConfirmState(CONFIRM_CLOSED); await deleteAdvertisement(ad.id!); } })}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile list */}
                <div className="md:hidden divide-y divide-slate-100">
                  {/* Create partnership row (mobile) */}
                  {(isBoard || isAdmin) && (
                    <button
                      className="w-full flex items-center gap-3 py-3 px-1 text-slate-400 hover:text-jci-blue transition-colors"
                      onClick={() => { setSelectedAd(null); setIsModalOpen(true); }}
                    >
                      <div className="w-11 h-11 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center shrink-0">
                        <Plus size={16} />
                      </div>
                      <span className="font-semibold text-sm">Create Partnership</span>
                    </button>
                  )}
                  {filteredAds.map(ad => (
                    <div key={ad.id} className="flex items-center gap-3 py-3 px-1">
                      {/* Thumbnail */}
                      <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                        {ad.logoUrl
                          ? <img src={ad.logoUrl} alt="" className="w-full h-full object-contain p-1" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          : ad.imageUrl
                            ? <img src={ad.imageUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            : <ImageIcon size={16} className="text-slate-300" />
                        }
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-900 text-sm truncate">{ad.title}</p>
                          <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${ad.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                            <span className={`w-1 h-1 rounded-full ${ad.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                            {ad.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-400">
                          <span className="flex items-center gap-1"><Eye size={10} />{formatNumber(ad.impressions)}</span>
                          <span className="flex items-center gap-1"><MousePointerClick size={10} />{formatNumber(ad.clicks)}</span>
                          <span>{calculateCTR(ad).toFixed(1)}% CTR</span>
                        </div>
                      </div>
                      {/* Actions */}
                      {(isBoard || isAdmin) && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button className="p-2 rounded-lg text-slate-400 hover:text-jci-blue hover:bg-blue-50 transition-colors"
                            onClick={() => { setSelectedAd(ad); setIsModalOpen(true); }}>
                            <Edit size={15} />
                          </button>
                          <button className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            onClick={() => setConfirmState({ open: true, title: 'Delete Partnership', message: 'Delete this partnership?', variant: 'danger', onConfirm: async () => { setConfirmState(CONFIRM_CLOSED); await deleteAdvertisement(ad.id!); } })}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
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
                    <Button className="w-full" onClick={() => showToast('Please contact admin to purchase this package', 'info')}>Select Package</Button>
                  </Card>
                ))}
              </div>
            </LoadingState>
          ) : activeTab === 'guest' ? (
            <GuestPageAnalyticsSection />
          ) : (
            <AdvertisementAnalyticsTab
              advertisements={filteredAdsForAnalytics}
              summary={analyticsSummary}
              filter={analyticsFilter}
              onFilterChange={setAnalyticsFilter}
              calculateCTR={calculateCTR}
              calculateROI={calculateROI}
            />
          )}
        </div>
      </Card>

      <AdvertisementFormModal
        isOpen={isModalOpen}
        selectedAd={selectedAd}
        formImage={formImage}
        formLogo={formLogo}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        showAdvanced={showAdvanced}
        statusActive={statusActive}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedAd(null);
        }}
        onSubmit={handleSubmit}
        onFormImageChange={setFormImage}
        onFormLogoChange={setFormLogo}
        onShowAdvancedChange={setShowAdvanced}
        onStatusActiveChange={setStatusActive}
      />
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
      <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} variant={confirmState.variant} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(CONFIRM_CLOSED)} />
    </div>
  );
};
