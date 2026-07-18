import { useRef } from 'react';
import { useFirestoreCollection } from './useFirestoreCollection';
import { HobbyClubsService } from '../services/hobbyClubsService';
import { HobbyClub } from '../types';
import { useToast } from '../components/ui/Common';
import { useAuth } from './useAuth';

export const useHobbyClubs = () => {
  const { member } = useAuth();
  const { showToast } = useToast();
  const isSubmittingRef = useRef(false);

  const { data: clubs, loading, error, reload: loadClubs } = useFirestoreCollection<HobbyClub>({
    loader: () => HobbyClubsService.getAllClubs(),
  });

  const createClub = async (clubData: Omit<HobbyClub, 'id' | 'membersCount'>) => {
    try {
      if (!member) throw new Error('You must be logged in to create a club');
      const id = await HobbyClubsService.createClub({ ...clubData, lead: member.name });
      await loadClubs();
      showToast('Club created successfully', 'success');
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create club';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const updateClub = async (clubId: string, updates: Partial<HobbyClub>) => {
    try {
      await HobbyClubsService.updateClub(clubId, updates);
      await loadClubs();
      showToast('Club updated successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update club';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const deleteClub = async (clubId: string) => {
    try {
      await HobbyClubsService.deleteClub(clubId);
      await loadClubs();
      showToast('Club deleted successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete club';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const joinClub = async (clubId: string) => {
    if (!member) { showToast('Please login to join clubs', 'error'); return; }
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      await HobbyClubsService.joinClub(clubId, member.id);
      await loadClubs();
      showToast('Joined club successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to join club';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const leaveClub = async (clubId: string) => {
    if (!member) { showToast('Please login to leave clubs', 'error'); return; }
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      await HobbyClubsService.leaveClub(clubId, member.id);
      await loadClubs();
      showToast('Left club successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to leave club';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const scheduleActivity = async (clubId: string, activityDate: string, description: string) => {
    try {
      await HobbyClubsService.addActivity(clubId, activityDate, description);
      await loadClubs();
      showToast('Activity scheduled successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to schedule activity';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const updateActivity = async (clubId: string, activityId: string, updates: { date?: string; description?: string }) => {
    try {
      await HobbyClubsService.updateActivity(clubId, activityId, updates);
      await loadClubs();
      showToast('Activity updated successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update activity';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const deleteActivity = async (clubId: string, activityId: string) => {
    try {
      await HobbyClubsService.deleteActivity(clubId, activityId);
      await loadClubs();
      showToast('Activity deleted successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete activity';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const getClubMembers = async (clubId: string): Promise<string[]> => {
    try {
      return await HobbyClubsService.getClubMembers(clubId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load club members';
      showToast(errorMessage, 'error');
      throw err;
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
    joinClub,
    leaveClub,
    scheduleActivity,
    updateActivity,
    deleteActivity,
    getClubMembers,
  };
};
