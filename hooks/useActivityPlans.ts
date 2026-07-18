import { useRef } from 'react';
import { useFirestoreCollection } from './useFirestoreCollection';
import { ActivityPlansService, ActivityPlan } from '../services/activityPlansService';
import { useToast } from '../components/ui/Common';

export const useActivityPlans = () => {
  const { showToast } = useToast();
  const isSubmittingRef = useRef(false);

  const { data: plans, loading, error, reload: loadPlans } = useFirestoreCollection<ActivityPlan>({
    loader: () => ActivityPlansService.getAllActivityPlans(),
  });

  const createPlan = async (planData: Omit<ActivityPlan, 'id' | 'createdAt' | 'updatedAt' | 'version'>) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      const id = await ActivityPlansService.createActivityPlan(planData);
      await loadPlans();
      showToast('Activity plan created successfully', 'success');
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create activity plan';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isSubmittingRef.current = false;
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
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      await ActivityPlansService.submitActivityPlan(planId, submittedBy);
      await loadPlans();
      showToast('Activity plan submitted for review', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit activity plan';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const reviewPlan = async (
    planId: string,
    decision: 'Approved' | 'Rejected',
    reviewedBy: string,
    comments?: string
  ) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      await ActivityPlansService.reviewActivityPlan(planId, decision, reviewedBy, comments);
      await loadPlans();
      showToast(`Activity plan ${decision.toLowerCase()}`, 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to review activity plan';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const createNewVersion = async (planId: string, updates: Partial<ActivityPlan>, submittedBy: string) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      const id = await ActivityPlansService.createNewVersion(planId, updates, submittedBy);
      await loadPlans();
      showToast('New version created successfully', 'success');
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create new version';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const deletePlan = async (planId: string) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      await ActivityPlansService.deleteActivityPlan(planId);
      await loadPlans();
      showToast('Activity plan deleted successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete activity plan';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isSubmittingRef.current = false;
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
