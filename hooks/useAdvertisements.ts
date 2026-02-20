// Advertisements Data Hook
import { useState, useEffect, useCallback } from 'react';
import { AdvertisementService, Advertisement, PromotionPackage } from '../services/advertisementService';
import { useToast } from '../components/ui/Common';

export const useAdvertisements = () => {
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
  const [packages, setPackages] = useState<PromotionPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [ads, pkgs] = await Promise.all([
        AdvertisementService.getAllAdvertisements(),
        AdvertisementService.getPromotionPackages(),
      ]);
      setAdvertisements(ads);
      setPackages(pkgs);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load advertisements';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const createAdvertisement = async (adData: Omit<Advertisement, 'id' | 'createdAt' | 'updatedAt' | 'impressions' | 'clicks'>) => {
    try {
      const id = await AdvertisementService.createAdvertisement(adData);
      await loadData();
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
      await loadData();
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
      await loadData();
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
  };
};

