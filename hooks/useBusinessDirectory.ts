// Business Directory Data Hook
import { useState, useEffect } from 'react';
import { BusinessDirectoryService } from '../services/businessDirectoryService';
import { BusinessProfile } from '../types';
import { useToast } from '../components/ui/Common';
import { useAuth } from './useAuth';

export const useBusinessDirectory = () => {
  const [businesses, setBusinesses] = useState<BusinessProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { member } = useAuth();
  const { showToast } = useToast();

  const loadBusinesses = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await BusinessDirectoryService.getAllBusinesses();
      setBusinesses(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load businesses';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBusinesses();
  }, []);

  const searchBusinesses = async (searchTerm: string) => {
    try {
      setLoading(true);
      const results = await BusinessDirectoryService.searchBusinesses(searchTerm);
      setBusinesses(results);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search businesses';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const getMyBusinesses = async () => {
    try {
      if (!member) return [];

      setLoading(true);
      // In aggregation model, business ID is member ID.
      // And a member has at most one business profile derived from their profile.
      const business = await BusinessDirectoryService.getBusinessById(member.id);
      return business ? [business] : [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load your businesses';
      showToast(errorMessage, 'error');
      return [];
    } finally {
      setLoading(false);
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

