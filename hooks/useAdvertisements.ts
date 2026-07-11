// Advertisements Data Hook
import { useFirestoreCollection } from './useFirestoreCollection';
import { AdvertisementService, Advertisement, PromotionPackage } from '../services/advertisementService';
import { useToast } from '../components/ui/Common';

export const useAdvertisements = () => {
  const { showToast } = useToast();

  const { data: advertisements, loading: adsLoading, error: adsError, reload: reloadAds } =
    useFirestoreCollection<Advertisement>({ loader: () => AdvertisementService.getAllAdvertisements() });

  const { data: packages, loading: pkgsLoading, error: pkgsError, reload: reloadPackages } =
    useFirestoreCollection<PromotionPackage>({ loader: () => AdvertisementService.getPromotionPackages() });

  const loading = adsLoading || pkgsLoading;
  const error = adsError || pkgsError;

  const loadData = async () => {
    await Promise.all([reloadAds(), reloadPackages()]);
  };

  const createAdvertisement = async (adData: Omit<Advertisement, 'id' | 'createdAt' | 'updatedAt' | 'impressions' | 'clicks'>) => {
    try {
      const id = await AdvertisementService.createAdvertisement(adData);
      await reloadAds();
      showToast('Advertisement created successfully', 'success');
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create advertisement';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const updateAdvertisement = async (adId: string, updates: Partial<Advertisement>) => {
    try {
      await AdvertisementService.updateAdvertisement(adId, updates);
      await reloadAds();
      showToast('Advertisement updated successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update advertisement';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const deleteAdvertisement = async (adId: string) => {
    try {
      await AdvertisementService.deleteAdvertisement(adId);
      await reloadAds();
      showToast('Advertisement deleted successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete advertisement';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const recordImpression = async (adId: string) => {
    await AdvertisementService.recordImpression(adId);
  };

  const recordClick = async (adId: string) => {
    await AdvertisementService.recordClick(adId);
  };

  const getBenefitUsageHistory = async (benefitId?: string, memberId?: string) => {
    return await AdvertisementService.getBenefitUsageHistory(benefitId, memberId);
  };

  return {
    advertisements,
    packages,
    loading,
    error,
    loadData,
    createAdvertisement,
    updateAdvertisement,
    deleteAdvertisement,
    recordImpression,
    recordClick,
    getBenefitUsageHistory,
  };
};
