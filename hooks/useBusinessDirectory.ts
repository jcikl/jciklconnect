import { useFirestoreCollection } from './useFirestoreCollection';
import { BusinessDirectoryService } from '../services/businessDirectoryService';
import { BusinessProfile } from '../types';
import { useToast } from '../components/ui/Common';
import { useAuth } from './useAuth';

/** @param options.enabled false skips the list load (e.g. external members: it reads the KL members list). */
export const useBusinessDirectory = (options?: { enabled?: boolean }) => {
  const enabled = options?.enabled ?? true;
  const { member, user } = useAuth();
  const { showToast } = useToast();

  const { data: businesses, loading, error, reload: loadBusinesses } = useFirestoreCollection<BusinessProfile>({
    loader: () => BusinessDirectoryService.getAllBusinesses(!user),
    enabled,
    deps: [!!user, enabled],
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
