// useAutomation Hook - Manage automation workflows and rules
import { useCallback } from 'react';
import { AutomationService, Workflow } from '../services/automationService';
import { AutomationRule } from '../types';
import { useToast } from '../components/ui/Common';
import { useFirestoreCollection } from './useFirestoreCollection';

export const useAutomation = () => {
  const { showToast } = useToast();

  const { data: workflows, loading: loading1, error: error1, reload: loadWorkflows } = useFirestoreCollection<Workflow>({
    loader: () => AutomationService.getAllWorkflows(),
  });

  const { data: rules, loading: loading2, error: error2, reload: loadRules } = useFirestoreCollection<AutomationRule>({
    loader: () => AutomationService.getAllRules(),
  });

  const loading = loading1 || loading2;
  const error = error1 || error2;

  // Create workflow
  const createWorkflow = useCallback(async (workflowData: Omit<Workflow, 'id' | 'executions' | 'createdAt' | 'updatedAt'>) => {
    try {
      await AutomationService.createWorkflow(workflowData);
      showToast('Workflow created successfully', 'success');
      await loadWorkflows();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create workflow';
      showToast(errorMessage, 'error');
      throw err;
    }
  }, [loadWorkflows, showToast]);

  // Update workflow
  const updateWorkflow = useCallback(async (workflowId: string, updates: Partial<Workflow>) => {
    try {
      await AutomationService.updateWorkflow(workflowId, updates);
      showToast('Workflow updated successfully', 'success');
      await loadWorkflows();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update workflow';
      showToast(errorMessage, 'error');
      throw err;
    }
  }, [loadWorkflows, showToast]);

  // Delete workflow
  const deleteWorkflow = useCallback(async (workflowId: string) => {
    try {
      await AutomationService.deleteWorkflow(workflowId);
      showToast('Workflow deleted successfully', 'success');
      await loadWorkflows();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete workflow';
      showToast(errorMessage, 'error');
      throw err;
    }
  }, [loadWorkflows, showToast]);

  // Create rule
  const createRule = useCallback(async (ruleData: Omit<AutomationRule, 'id' | 'executions'>) => {
    try {
      await AutomationService.createRule(ruleData);
      showToast('Rule created successfully', 'success');
      await loadRules();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create rule';
      showToast(errorMessage, 'error');
      throw err;
    }
  }, [loadRules, showToast]);

  // Update rule
  const updateRule = useCallback(async (ruleId: string, updates: Partial<AutomationRule>) => {
    try {
      await AutomationService.updateRule(ruleId, updates);
      showToast('Rule updated successfully', 'success');
      await loadRules();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update rule';
      showToast(errorMessage, 'error');
      throw err;
    }
  }, [loadRules, showToast]);

  // Execute workflow
  const executeWorkflow = useCallback(async (
    workflowId: string,
    context: Record<string, any> = {},
    triggeredBy: 'manual' | 'event' | 'schedule' | 'webhook' | 'condition' = 'manual'
  ) => {
    try {
      const execution = await AutomationService.executeWorkflow(workflowId, context, triggeredBy);
      showToast(
        `Workflow executed ${execution.status === 'success' ? 'successfully' : 'with errors'}`,
        execution.status === 'success' ? 'success' : 'warning'
      );
      await loadWorkflows();
      return execution;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to execute workflow';
      showToast(errorMessage, 'error');
      throw err;
    }
  }, [loadWorkflows, showToast]);

  return {
    workflows,
    rules,
    loading,
    error,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    createRule,
    updateRule,
    executeWorkflow,
    refreshWorkflows: loadWorkflows,
    refreshRules: loadRules,
  };
};
