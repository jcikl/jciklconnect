// useAutomation Hook - Manage automation workflows and rules
import { useState, useEffect, useCallback } from 'react';
import { AutomationService, Workflow } from '../services/automationService';
import { AutomationRule } from '../types';
import { useToast } from '../components/ui/Common';

export const useAutomation = () => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  // Load workflows
  const loadWorkflows = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await AutomationService.getAllWorkflows();
      setWorkflows(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load workflows';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Load rules
  const loadRules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await AutomationService.getAllRules();
      setRules(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load rules';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Load all data
  useEffect(() => {
    loadWorkflows();
    loadRules();
  }, [loadWorkflows, loadRules]);

  // Create workflow
  const createWorkflow = useCallback(async (workflowData: Omit<Workflow, 'id' | 'executions' | 'createdAt' | 'updatedAt'>) => {
    try {
      setError(null);
      await AutomationService.createWorkflow(workflowData);
      showToast('Workflow created successfully', 'success');
      await loadWorkflows();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create workflow';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      throw err;
    }
  }, [loadWorkflows, showToast]);

  // Update workflow
  const updateWorkflow = useCallback(async (workflowId: string, updates: Partial<Workflow>) => {
    try {
      setError(null);
      await AutomationService.updateWorkflow(workflowId, updates);
      showToast('Workflow updated successfully', 'success');
      await loadWorkflows();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update workflow';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      throw err;
    }
  }, [loadWorkflows, showToast]);

  // Delete workflow
  const deleteWorkflow = useCallback(async (workflowId: string) => {
    try {
      setError(null);
      await AutomationService.deleteWorkflow(workflowId);
      showToast('Workflow deleted successfully', 'success');
      await loadWorkflows();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete workflow';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      throw err;
    }
  }, [loadWorkflows, showToast]);

  // Create rule
  const createRule = useCallback(async (ruleData: Omit<AutomationRule, 'id' | 'executions'>) => {
    try {
      setError(null);
      await AutomationService.createRule(ruleData);
      showToast('Rule created successfully', 'success');
      await loadRules();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create rule';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      throw err;
    }
  }, [loadRules, showToast]);

  // Update rule
  const updateRule = useCallback(async (ruleId: string, updates: Partial<AutomationRule>) => {
    try {
      setError(null);
      await AutomationService.updateRule(ruleId, updates);
      showToast('Rule updated successfully', 'success');
      await loadRules();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update rule';
      setError(errorMessage);
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
      setError(null);
      const execution = await AutomationService.executeWorkflow(workflowId, context, triggeredBy);
      showToast(
        `Workflow executed ${execution.status === 'success' ? 'successfully' : 'with errors'}`,
        execution.status === 'success' ? 'success' : 'warning'
      );
      await loadWorkflows();
      return execution;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to execute workflow';
      setError(errorMessage);
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

