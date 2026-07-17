// Member Benefits Data Hook
// Wraps MemberBenefitsService with React state (loading / error / data).
import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [usageLoading, setUsageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();
  const isClaimingRef = useRef(false);

  // Prevents state updates after the component has unmounted.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadBenefits = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await MemberBenefitsService.getMemberBenefits();
      if (mountedRef.current) setBenefits(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load benefits';
      if (mountedRef.current) { setError(msg); showToast(msg, 'error'); }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [showToast]);

  const loadUsageHistory = useCallback(async () => {
    if (!memberId) return;
    if (mountedRef.current) setUsageLoading(true);
    try {
      const data = await MemberBenefitsService.getBenefitUsage(memberId);
      if (mountedRef.current) setUsageHistory(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load usage history';
      if (mountedRef.current) showToast(msg, 'error');
    } finally {
      if (mountedRef.current) setUsageLoading(false);
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
    if (isClaimingRef.current) return;
    isClaimingRef.current = true;
    try {
      await MemberBenefitsService.claimBenefit(memberId, benefitId, details);
      await loadUsageHistory();
      showToast('Benefit claimed successfully', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to claim benefit';
      showToast(msg, 'error');
      throw err;
    } finally {
      isClaimingRef.current = false;
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
    usageLoading,
    error,
    loadBenefits,
    loadUsageHistory,
    claimBenefit,
    getBenefitUsageHistory,
  };
};
