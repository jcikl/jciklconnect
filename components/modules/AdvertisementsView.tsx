import React, { useState, useMemo } from 'react';
import { Megaphone, Plus, Edit, Trash2, Eye, MousePointerClick, TrendingUp, Calendar, Image as ImageIcon, Link as LinkIcon, BarChart3, Download, Filter, Upload } from 'lucide-react';
import { Button, Card, Badge, Modal, useToast, Tabs, StatCardsContainer, ProgressBar } from '../ui/Common';
import { Input, Select, Textarea } from '../ui/Form';
import { LoadingState } from '../ui/Loading';
import { useAdvertisements } from '../../hooks/useAdvertisements';
import { usePermissions } from '../../hooks/usePermissions';
import { Advertisement } from '../../services/advertisementService';
import { formatDate, toDate } from '../../utils/dateUtils';
import { formatNumber } from '../../utils/formatUtils';
import { Timestamp } from 'firebase/firestore';
import { uploadToCloudinary } from '../../services/cloudinaryService';
import imageCompression from 'browser-image-compression';

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
  const [selectedPlacements, setSelectedPlacements] = useState<string[]>([]);
  const [formImage, setFormImage] = useState<File | null>(null);
  const [formLogo, setFormLogo] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [statusActive, setStatusActive] = useState(true);

  React.useEffect(() => {
    if (selectedAd) {
      setSelectedPlacements(Array.isArray(selectedAd.placement) ? selectedAd.placement : [selectedAd.placement]);
      setFormImage(null);
      setFormLogo(null);
      setShowAdvanced(false);
      setStatusActive(selectedAd.status === 'Active');
    } else {
      setSelectedPlacements(['Homepage']);
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
        endDate: selectedAd?.endDate,
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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Partnership & Promotions</h2>
          <p className="text-slate-500">Manage promotional content and partnership campaigns.</p>
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
            tabs={['Partnerships', 'Promotion Packages', 'Analytics']}
            activeTab={
              activeTab === 'ads' ? 'Partnerships' :
                activeTab === 'packages' ? 'Promotion Packages' :
                  'Analytics'
            }
            onTabChange={(tab) => {
              if (tab === 'Partnerships') setActiveTab('ads');
              else if (tab === 'Promotion Packages') setActiveTab('packages');
              else setActiveTab('analytics');
            }}
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
                                  onClick={async () => { if (window.confirm('Delete this partnership?')) await deleteAdvertisement(ad.id!); }}
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
                            onClick={async () => { if (window.confirm('Delete this partnership?')) await deleteAdvertisement(ad.id!); }}>
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

      {/* Create/Edit Partnership Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedAd(null);
        }}
        title={selectedAd ? 'Edit Partnership' : 'Create Partnership'}
        size="lg"
        drawerOnMobile
      >
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Section: Basic Info */}
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Basic Info</p>
            <Input
              name="title"
              label="Partner Name"
              placeholder="e.g. Tech Solutions Inc."
              defaultValue={selectedAd?.title}
              required
            />
            <Textarea
              name="description"
              label="Member Benefit"
              placeholder="What's the exclusive offer for JCI members?"
              defaultValue={selectedAd?.description}
              rows={2}
              required
            />
            <Textarea
              name="termsAndConditions"
              label="Terms & Conditions"
              placeholder="Optional — how to redeem, expiry, restrictions..."
              defaultValue={selectedAd?.termsAndConditions}
              rows={2}
            />
          </div>

          {/* Section: Images */}
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Images</p>
            <div className="grid grid-cols-2 gap-4">
              {/* Logo */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-600">Logo <span className="text-slate-400 font-normal">(square)</span></label>
                <div
                  className="relative w-full aspect-square bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center cursor-pointer hover:border-jci-blue hover:bg-blue-50/40 transition-colors group"
                  onClick={() => document.getElementById('ad-logo-upload')?.click()}
                >
                  {(formLogo || selectedAd?.logoUrl) ? (
                    <>
                      <img
                        src={formLogo ? URL.createObjectURL(formLogo) : selectedAd?.logoUrl}
                        alt="Logo"
                        className="w-full h-full object-contain p-3"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Upload size={18} className="text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-slate-400 group-hover:text-jci-blue transition-colors">
                      <Upload size={20} />
                      <span className="text-[10px] font-semibold">Upload Logo</span>
                    </div>
                  )}
                </div>
                <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) setFormLogo(f); }} className="hidden" id="ad-logo-upload" />
              </div>

              {/* Banner */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-600">Ad Banner <span className="text-red-400">*</span> <span className="text-slate-400 font-normal">(landscape)</span></label>
                <div
                  className="relative w-full aspect-square bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center cursor-pointer hover:border-jci-blue hover:bg-blue-50/40 transition-colors group"
                  onClick={() => document.getElementById('ad-image-upload')?.click()}
                >
                  {(formImage || selectedAd?.imageUrl) ? (
                    <>
                      <img
                        src={formImage ? URL.createObjectURL(formImage) : selectedAd?.imageUrl}
                        alt="Banner"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Upload size={18} className="text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-slate-400 group-hover:text-jci-blue transition-colors">
                      <Upload size={20} />
                      <span className="text-[10px] font-semibold">Upload Banner</span>
                    </div>
                  )}
                </div>
                <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) setFormImage(f); }} className="hidden" id="ad-image-upload" />
              </div>
            </div>
            {isUploading && (
              <ProgressBar progress={uploadProgress} label={`Uploading... ${uploadProgress}%`} />
            )}
          </div>

          {/* Section: Settings */}
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Settings</p>
            <div className="flex items-center justify-between py-2">
              <label className="text-sm font-medium text-slate-700">Status</label>
              <button
                type="button"
                role="switch"
                aria-checked={statusActive}
                onClick={() => setStatusActive(v => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${statusActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${statusActive ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <span className={`text-xs font-semibold ${statusActive ? 'text-emerald-600' : 'text-slate-400'}`}>{statusActive ? 'Active' : 'Inactive'}</span>
              <input type="hidden" name="status" value={statusActive ? 'Active' : 'Inactive'} />
            </div>
            <Input
              name="linkUrl"
              label="Partner Website (Optional)"
              placeholder="https://example.com"
              defaultValue={selectedAd?.linkUrl}
            />
          </div>

          {/* Advanced (collapsed) */}
          <div>
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
              onClick={() => setShowAdvanced(v => !v)}
            >
              <svg className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              Advanced
            </button>
            {showAdvanced && (
              <div className="mt-3 grid grid-cols-2 gap-4">
                <Input
                  name="priority"
                  label="Priority (0–10)"
                  type="number"
                  min="0"
                  max="10"
                  defaultValue={selectedAd?.priority?.toString() || '5'}
                />
                <Input
                  name="budget"
                  label="Budget (RM)"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={selectedAd?.budget?.toString()}
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <Button className="flex-1" type="submit" disabled={isUploading}>
              {isUploading ? 'Uploading...' : (selectedAd ? 'Save Changes' : 'Create Partnership')}
            </Button>
            <Button variant="ghost" type="button" onClick={() => { setIsModalOpen(false); setSelectedAd(null); }}>
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
  calculateCTR,
  calculateROI,
}) => {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const maxImpressions = Math.max(...advertisements.map(a => a.impressions), 1);
  const maxCTR = Math.max(...advertisements.map(a => calculateCTR(a)), 1);

  const FILTER_PILLS: { label: string; value: typeof filter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Completed', value: 'completed' },
  ];

  return (
    <div className="space-y-5">

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Impressions */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Impressions</p>
          <p className="text-2xl font-black text-slate-900 tabular-nums">{formatNumber(summary.totalImpressions)}</p>
          <div className="w-full bg-slate-100 rounded-full h-1 mt-2">
            <div className="bg-jci-blue h-1 rounded-full" style={{ width: `${Math.min(summary.totalImpressions / 1000 * 100, 100)}%` }} />
          </div>
          <p className="text-[10px] text-slate-400">across {advertisements.length} partner{advertisements.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Clicks */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Clicks</p>
          <p className="text-2xl font-black text-slate-900 tabular-nums">{formatNumber(summary.totalClicks)}</p>
          <div className="w-full bg-slate-100 rounded-full h-1 mt-2">
            <div className="bg-emerald-500 h-1 rounded-full" style={{ width: `${summary.totalImpressions > 0 ? Math.min((summary.totalClicks / summary.totalImpressions) * 100 * 20, 100) : 0}%` }} />
          </div>
          <p className="text-[10px] text-slate-400">{summary.totalImpressions > 0 ? ((summary.totalClicks / summary.totalImpressions) * 100).toFixed(1) : '0.0'}% of impressions</p>
        </div>

        {/* Avg CTR */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Avg CTR</p>
          <p className={`text-2xl font-black tabular-nums ${summary.avgCTR >= 2 ? 'text-emerald-600' : summary.avgCTR >= 1 ? 'text-amber-500' : 'text-slate-900'}`}>
            {summary.avgCTR.toFixed(2)}%
          </p>
          <div className="w-full bg-slate-100 rounded-full h-1 mt-2">
            <div className={`h-1 rounded-full ${summary.avgCTR >= 2 ? 'bg-emerald-500' : summary.avgCTR >= 1 ? 'bg-amber-400' : 'bg-slate-400'}`}
              style={{ width: `${Math.min(summary.avgCTR / 5 * 100, 100)}%` }} />
          </div>
          <p className="text-[10px] text-slate-400">benchmark ~2%</p>
        </div>

        {/* Active */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Active</p>
          <p className="text-2xl font-black text-slate-900 tabular-nums">{summary.activeAds}</p>
          <div className="flex gap-0.5 mt-2">
            {advertisements.map(a => (
              <div key={a.id} className={`h-1 flex-1 rounded-full ${a.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-200'}`} />
            ))}
          </div>
          <p className="text-[10px] text-slate-400">of {advertisements.length} total</p>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2">
        {FILTER_PILLS.map(p => (
          <button
            key={p.value}
            onClick={() => onFilterChange(p.value)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${filter === p.value ? 'bg-jci-blue text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Performance table */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        {advertisements.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-10">No data</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="py-3 px-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Partner</th>
                <th className="py-3 px-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400 hidden sm:table-cell">Impressions</th>
                <th className="py-3 px-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400 hidden sm:table-cell">Clicks</th>
                <th className="py-3 px-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">CTR</th>
                <th className="py-3 px-2 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {advertisements.map(ad => {
                const ctr = calculateCTR(ad);
                const roi = calculateROI(ad);
                const isExpanded = expandedId === ad.id;
                return (
                  <React.Fragment key={ad.id}>
                    <tr
                      className="hover:bg-slate-50/60 cursor-pointer transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : (ad.id ?? null))}
                    >
                      {/* Partner */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                            {ad.logoUrl
                              ? <img src={ad.logoUrl} alt="" className="w-full h-full object-contain p-0.5" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              : <ImageIcon size={13} className="text-slate-300" />
                            }
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 leading-tight">{ad.title}</p>
                            <span className={`text-[10px] font-bold ${ad.status === 'Active' ? 'text-emerald-600' : 'text-slate-400'}`}>{ad.status}</span>
                          </div>
                        </div>
                      </td>
                      {/* Impressions bar */}
                      <td className="py-3 px-4 text-right hidden sm:table-cell">
                        <p className="font-semibold text-slate-700 tabular-nums text-xs">{formatNumber(ad.impressions)}</p>
                        <div className="w-20 bg-slate-100 rounded-full h-1 mt-1 ml-auto">
                          <div className="bg-jci-blue/40 h-1 rounded-full" style={{ width: `${(ad.impressions / maxImpressions) * 100}%` }} />
                        </div>
                      </td>
                      {/* Clicks */}
                      <td className="py-3 px-4 text-right hidden sm:table-cell">
                        <p className="font-semibold text-slate-700 tabular-nums text-xs">{formatNumber(ad.clicks)}</p>
                      </td>
                      {/* CTR bar */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold tabular-nums ${ctr >= 2 ? 'text-emerald-600' : ctr >= 1 ? 'text-amber-500' : 'text-slate-500'}`}>
                            {ctr.toFixed(1)}%
                          </span>
                          <div className="flex-1 max-w-[80px] bg-slate-100 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${ctr >= 2 ? 'bg-emerald-500' : ctr >= 1 ? 'bg-amber-400' : 'bg-slate-400'}`}
                              style={{ width: `${maxCTR > 0 ? (ctr / maxCTR) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      {/* Expand chevron */}
                      <td className="py-3 px-2">
                        <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </td>
                    </tr>

                    {/* Expanded row */}
                    {isExpanded && (
                      <tr className="bg-slate-50/70">
                        <td colSpan={5} className="px-4 py-4">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-white rounded-lg border border-slate-100 p-3">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Impressions</p>
                              <p className="text-lg font-black text-slate-900 tabular-nums">{formatNumber(ad.impressions)}</p>
                            </div>
                            <div className="bg-white rounded-lg border border-slate-100 p-3">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Clicks</p>
                              <p className="text-lg font-black text-slate-900 tabular-nums">{formatNumber(ad.clicks)}</p>
                            </div>
                            {ad.budget ? (
                              <>
                                <div className="bg-white rounded-lg border border-slate-100 p-3">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Budget</p>
                                  <p className="text-lg font-black text-slate-900 tabular-nums">RM {formatNumber(ad.budget)}</p>
                                </div>
                                <div className="bg-white rounded-lg border border-slate-100 p-3">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Cost/Click</p>
                                  <p className="text-lg font-black text-slate-900 tabular-nums">RM {roi.costPerClick.toFixed(2)}</p>
                                </div>
                              </>
                            ) : (
                              <div className="bg-white rounded-lg border border-slate-100 p-3 col-span-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">T&C</p>
                                <p className="text-xs text-slate-600 leading-relaxed">{ad.termsAndConditions || '—'}</p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
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
            {advertisement.termsAndConditions && (
              <div className="flex flex-col gap-1 border-t border-slate-100 pt-3">
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Terms & Conditions:</span>
                <span className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                  {advertisement.termsAndConditions}
                </span>
              </div>
            )}
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

