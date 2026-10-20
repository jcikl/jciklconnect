import { useRef } from 'react';
import { useFirestoreCollection } from './useFirestoreCollection';
import { HobbyClubsService } from '../services/hobbyClubsService';
import { HobbyClub } from '../types';
import { useToast } from '../components/ui/Common';
import { useAuth } from './useAuth';
import { isExternalRole } from '../utils/externalAccess';

export const useHobbyClubs = () => {
  const { member } = useAuth();
  const { showToast } = useToast();
  const isSubmittingRef = useRef(false);

  // Externals (other chapters) may only list clubs open to them (firestore.rules hobbyClubs read).
  const isExternal = isExternalRole(member?.role);
  const { data: clubs, loading, error, reload: loadClubs } = useFirestoreCollection<HobbyClub>({
    loader: () => (isExternal ? HobbyClubsService.getClubsForExternal() : HobbyClubsService.getAllClubs()),
    deps: [isExternal],
  });

  const createClub = async (clubData: Omit<HobbyClub, 'id' | 'membersCount'>) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      if (!member) throw new Error('You must be logged in to create a club');
      const id = await HobbyClubsService.createClub({ ...clubData, lead: member.general?.name ?? member.general?.name });
      await loadClubs();
      showToast('Club created successfully', 'success');
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create club';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const updateClub = async (clubId: string, updates: Partial<HobbyClub>) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      await HobbyClubsService.updateClub(clubId, updates);
      await loadClubs();
      showToast('Club updated successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update club';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const deleteClub = async (clubId: string) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      await HobbyClubsService.deleteClub(clubId);
      await loadClubs();
      showToast('Club deleted successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete club';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const scheduleActivity = async (clubId: string, activityDate: string, description: string) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      await HobbyClubsService.addActivity(clubId, activityDate, description);
      await loadClubs();
      showToast('Activity scheduled successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to schedule activity';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const updateActivity = async (clubId: string, activityId: string, updates: { date?: string; description?: string }) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      await HobbyClubsService.updateActivity(clubId, activityId, updates);
      await loadClubs();
      showToast('Activity updated successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update activity';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const deleteActivity = async (clubId: string, activityId: string) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      await HobbyClubsService.deleteActivity(clubId, activityId);
      await loadClubs();
      showToast('Activity deleted successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete activity';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isSubmittingRef.current = false;
    }
  };

  return {
    clubs,
    loading,
    error,
    loadClubs,
    createClub,
    updateClub,
    deleteClub,
    scheduleActivity,
    updateActivity,
    deleteActivity,
  };
};
