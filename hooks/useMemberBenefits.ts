// Member Benefits Data Hook
import { useState, useEffect, useCallback } from 'react';
import { MemberBenefitsService, MemberBenefit, BenefitUsage } from '../services/memberBenefitsService';
import { useToast } from '../components/ui/Common';

export const useMemberBenefits = () => {
  const [benefits, setBenefits] = useState<MemberBenefit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const loadBenefits = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await MemberBenefitsService.getAllBenefits();
      setBenefits(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load benefits';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadBenefits();
  }, [loadBenefits]);

  const createBenefit = async (benefitData: Omit<MemberBenefit, 'id' | 'createdAt' | 'updatedAt' | 'currentUsage'>) => {
    try {
      const id = await MemberBenefitsService.createBenefit(benefitData);
      await loadBenefits();
      showToast('Benefit created successfully', 'success');
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create benefit';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const updateBenefit = async (benefitId: string, updates: Partial<MemberBenefit>) => {
    try {
      await MemberBenefitsService.updateBenefit(benefitId, updates);
      await loadBenefits();
      showToast('Benefit updated successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update benefit';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const deleteBenefit = async (benefitId: string) => {
    try {
      await MemberBenefitsService.deleteBenefit(benefitId);
      await loadBenefits();
      showToast('Benefit deleted successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete benefit';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const getEligibleBenefits = async (memberId: string, memberTier: string, memberPoints: number, memberRole: string, joinDate: string) => {
    try {
      return await MemberBenefitsService.getEligibleBenefits(memberId, memberTier, memberPoints, memberRole, joinDate);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get eligible benefits';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const recordUsage = async (memberId: string, benefitId: string, details?: string) => {
    try {
      await MemberBenefitsService.recordBenefitUsage(memberId, benefitId, details);
      showToast('Benefit usage recorded', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to record usage';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const getUsageHistory = async (benefitId?: string, memberId?: string) => {
    try {
      return await MemberBenefitsService.getBenefitUsageHistory(benefitId, memberId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get usage history';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  return {
    benefits,
    loading,
    error,
    loadBenefits,
    createBenefit,
    updateBenefit,
    deleteBenefit,
    getEligibleBenefits,
    recordUsage,
    getUsageHistory,
  };
};

