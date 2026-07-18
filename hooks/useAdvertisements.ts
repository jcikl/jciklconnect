// Advertisements Data Hook
import { useRef } from 'react';
import { useFirestoreCollection } from './useFirestoreCollection';
import { AdvertisementService, Advertisement, PromotionPackage } from '../services/advertisementService';
import { useToast } from '../components/ui/Common';
import { errorLoggingService } from '../services/errorLoggingService';

export const useAdvertisements = () => {
  const { showToast } = useToast();
  const isSubmittingRef = useRef(false);

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
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      const id = await AdvertisementService.createAdvertisement(adData);
      await reloadAds();
      showToast('Advertisement created successfully', 'success');
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create advertisement';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const updateAdvertisement = async (adId: string, updates: Partial<Advertisement>) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      await AdvertisementService.updateAdvertisement(adId, updates);
      await reloadAds();
      showToast('Advertisement updated successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update advertisement';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const deleteAdvertisement = async (adId: string) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      await AdvertisementService.deleteAdvertisement(adId);
      await reloadAds();
      showToast('Advertisement deleted successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete advertisement';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const recordImpression = async (adId: string) => {
    try {
      await AdvertisementService.recordImpression(adId);
    } catch (err) {
      errorLoggingService.logError(err, { action: 'recordImpression', additionalData: { adId } });
      // Analytics call — swallow error so it never disrupts the user experience
    }
  };

  const recordClick = async (adId: string) => {
    try {
      await AdvertisementService.recordClick(adId);
    } catch (err) {
      errorLoggingService.logError(err, { action: 'recordClick', additionalData: { adId } });
      // Analytics call — swallow error so it never disrupts the user experience
    }
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
