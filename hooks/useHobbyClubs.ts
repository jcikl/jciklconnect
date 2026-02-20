// Hobby Clubs Data Hook
import { useState, useEffect } from 'react';
import { HobbyClubsService } from '../services/hobbyClubsService';
import { HobbyClub } from '../types';
import { useToast } from '../components/ui/Common';
import { useAuth } from './useAuth';

export const useHobbyClubs = () => {
  const [clubs, setClubs] = useState<HobbyClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { member } = useAuth();
  const { showToast } = useToast();

  const loadClubs = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await HobbyClubsService.getAllClubs();
      setClubs(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load hobby clubs';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClubs();
  }, []);

  const createClub = async (clubData: Omit<HobbyClub, 'id' | 'membersCount'>) => {
    try {
      if (!member) {
        throw new Error('You must be logged in to create a club');
      }
      
      const clubWithLead = {
        ...clubData,
        lead: member.name,
      };
      
      const id = await HobbyClubsService.createClub(clubWithLead);
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
    if (!member) {
      showToast('Please login to join clubs', 'error');
      return;
    }
    
    try {
      await HobbyClubsService.joinClub(clubId, member.id);
      await loadClubs();
      showToast('Joined club successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to join club';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const leaveClub = async (clubId: string) => {
    if (!member) {
      showToast('Please login to leave clubs', 'error');
      return;
    }
    
    try {
      await HobbyClubsService.leaveClub(clubId, member.id);
      await loadClubs();
      showToast('Left club successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to leave club';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const scheduleActivity = async (clubId: string, activityDate: string, description: string) => {
    try {
      await HobbyClubsService.scheduleActivity(clubId, activityDate, description);
      await loadClubs();
      showToast('Activity scheduled successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to schedule activity';
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
    getClubMembers,
  };
};

