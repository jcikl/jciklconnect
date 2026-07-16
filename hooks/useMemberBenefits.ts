// Member Benefits Data Hook
// Wraps MemberBenefitsService with React state (loading / error / data).
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/Common';
import {
  MemberBenefitsService,
  MemberBenefit,
  BenefitUsage,
} from '@/services/memberBenefitsService';

export const useMemberBenefits = (memberId?: string) => {
  const [benefits, setBenefits] = useState<MemberBenefit[]>([]);
  const [usageHistory, setUsageHistory] = useState<BenefitUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const loadBenefits = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await MemberBenefitsService.getMemberBenefits();
      setBenefits(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load benefits';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadUsageHistory = useCallback(async () => {
    if (!memberId) return;
    try {
      const data = await MemberBenefitsService.getBenefitUsage(memberId);
      setUsageHistory(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load usage history';
      showToast(msg, 'error');
    }
  }, [memberId, showToast]);

  useEffect(() => {
    loadBenefits();
  }, [loadBenefits]);

  useEffect(() => {
    loadUsageHistory();
  }, [loadUsageHistory]);

  const claimBenefit = async (benefitId: string, details?: string) => {
    if (!memberId) throw new Error('memberId is required to claim a benefit');
    try {
      await MemberBenefitsService.claimBenefit(memberId, benefitId, details);
      await loadUsageHistory();
      showToast('Benefit claimed successfully', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to claim benefit';
      showToast(msg, 'error');
      throw err;
    }
  };

  const getBenefitUsageHistory = async (benefitId?: string, filterMemberId?: string) => {
    try {
      return await MemberBenefitsService.getBenefitUsageHistory(benefitId, filterMemberId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to get usage history';
      showToast(msg, 'error');
      throw err;
    }
  };

  return {
    benefits,
    usageHistory,
    loading,
    error,
    loadBenefits,
    loadUsageHistory,
    claimBenefit,
    getBenefitUsageHistory,
  };
};
