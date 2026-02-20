// Activity Plans Data Hook
import { useState, useEffect, useCallback } from 'react';
import { ActivityPlansService, ActivityPlan } from '../services/activityPlansService';
import { useToast } from '../components/ui/Common';

export const useActivityPlans = () => {
  const [plans, setPlans] = useState<ActivityPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const loadPlans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ActivityPlansService.getAllActivityPlans();
      setPlans(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load activity plans';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const createPlan = async (planData: Omit<ActivityPlan, 'id' | 'createdAt' | 'updatedAt' | 'version'>) => {
    try {
      const id = await ActivityPlansService.createActivityPlan(planData);
      await loadPlans();
      showToast('Activity plan created successfully', 'success');
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create activity plan';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const updatePlan = async (planId: string, updates: Partial<ActivityPlan>) => {
    try {
      await ActivityPlansService.updateActivityPlan(planId, updates);
      await loadPlans();
      showToast('Activity plan updated successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update activity plan';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const submitPlan = async (planId: string, submittedBy: string) => {
    try {
      await ActivityPlansService.submitActivityPlan(planId, submittedBy);
      await loadPlans();
      showToast('Activity plan submitted for review', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit activity plan';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const reviewPlan = async (
    planId: string,
    decision: 'Approved' | 'Rejected',
    reviewedBy: string,
    comments?: string
  ) => {
    try {
      await ActivityPlansService.reviewActivityPlan(planId, decision, reviewedBy, comments);
      await loadPlans();
      showToast(`Activity plan ${decision.toLowerCase()}`, 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to review activity plan';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const createNewVersion = async (planId: string, updates: Partial<ActivityPlan>, submittedBy: string) => {
    try {
      const id = await ActivityPlansService.createNewVersion(planId, updates, submittedBy);
      await loadPlans();
      showToast('New version created successfully', 'success');
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create new version';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const deletePlan = async (planId: string) => {
    try {
      await ActivityPlansService.deleteActivityPlan(planId);
      await loadPlans();
      showToast('Activity plan deleted successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete activity plan';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  return {
    plans,
    loading,
    error,
    loadPlans,
    createPlan,
    updatePlan,
    submitPlan,
    reviewPlan,
    createNewVersion,
    deletePlan,
  };
};

