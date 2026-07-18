// Sponsorships Data Hook
import { useRef } from 'react';
import { useFirestoreCollection } from './useFirestoreCollection';
import { SponsorshipsService } from '../services/sponsorshipService';
import { SponsorshipRecord } from '../types';
import { useToast } from '../components/ui/Common';

export const useSponsorships = () => {
  const { showToast } = useToast();
  const isSubmittingRef = useRef(false);

  const { data: sponsorships, loading, error, reload } =
    useFirestoreCollection<SponsorshipRecord>({ loader: () => SponsorshipsService.getAllSponsorships() });

  const createSponsorship = async (data: Omit<SponsorshipRecord, 'id'>) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      const id = await SponsorshipsService.createSponsorship(data);
      await reload();
      showToast('Sponsorship record created successfully', 'success');
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create sponsorship';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const updateSponsorship = async (id: string, updates: Partial<SponsorshipRecord>, previousMemberId?: string) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      await SponsorshipsService.updateSponsorship(id, updates, previousMemberId);
      await reload();
      showToast('Sponsorship record updated successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update sponsorship';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const deleteSponsorship = async (id: string, memberId: string) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      await SponsorshipsService.deleteSponsorship(id, memberId);
      await reload();
      showToast('Sponsorship record deleted successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete sponsorship';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isSubmittingRef.current = false;
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
