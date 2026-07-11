import { useFirestoreCollection } from './useFirestoreCollection';
import { BusinessDirectoryService } from '../services/businessDirectoryService';
import { BusinessProfile } from '../types';
import { useToast } from '../components/ui/Common';
import { useAuth } from './useAuth';

export const useBusinessDirectory = () => {
  const { member, user } = useAuth();
  const { showToast } = useToast();

  const { data: businesses, loading, error, reload: loadBusinesses } = useFirestoreCollection<BusinessProfile>({
    loader: () => BusinessDirectoryService.getAllBusinesses(!user),
    deps: [!!user],
  });

  const searchBusinesses = async (searchTerm: string) => {
    try {
      const results = await BusinessDirectoryService.searchBusinesses(searchTerm);
      return results;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search businesses';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const getMyBusinesses = async (): Promise<BusinessProfile[]> => {
    try {
      if (!member) return [];
      const business = await BusinessDirectoryService.getBusinessById(member.id);
      return business ? [business] : [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load your businesses';
      showToast(errorMessage, 'error');
      return [];
    }
  };

  return {
    businesses,
    loading,
    error,
    loadBusinesses,
    searchBusinesses,
    getMyBusinesses,
  };
};
