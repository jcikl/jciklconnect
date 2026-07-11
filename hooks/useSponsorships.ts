// Sponsorships Data Hook
import { useFirestoreCollection } from './useFirestoreCollection';
import { SponsorshipsService } from '../services/sponsorshipService';
import { SponsorshipRecord } from '../types';
import { useToast } from '../components/ui/Common';

export const useSponsorships = () => {
  const { showToast } = useToast();

  const { data: sponsorships, loading, error, reload } =
    useFirestoreCollection<SponsorshipRecord>({ loader: () => SponsorshipsService.getAllSponsorships() });

  const createSponsorship = async (data: Omit<SponsorshipRecord, 'id'>) => {
    try {
      const id = await SponsorshipsService.createSponsorship(data);
      await reload();
      showToast('Sponsorship record created successfully', 'success');
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create sponsorship';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const updateSponsorship = async (id: string, updates: Partial<SponsorshipRecord>, previousMemberId?: string) => {
    try {
      await SponsorshipsService.updateSponsorship(id, updates, previousMemberId);
      await reload();
      showToast('Sponsorship record updated successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update sponsorship';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const deleteSponsorship = async (id: string, memberId: string) => {
    try {
      await SponsorshipsService.deleteSponsorship(id, memberId);
      await reload();
      showToast('Sponsorship record deleted successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete sponsorship';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  return {
    sponsorships,
    loading,
    error,
    reload,
    createSponsorship,
    updateSponsorship,
    deleteSponsorship,
  };
};
