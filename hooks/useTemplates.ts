// Templates Data Hook
import { useState, useEffect, useCallback } from 'react';
import { TemplatesService, EventTemplate, ActivityPlanTemplate, EventBudgetTemplate } from '../services/templatesService';
import { useToast } from '../components/ui/Common';
import { useAuth } from './useAuth';

export const useTemplates = () => {
  const [eventTemplates, setEventTemplates] = useState<EventTemplate[]>([]);
  const [activityPlanTemplates, setActivityPlanTemplates] = useState<ActivityPlanTemplate[]>([]);
  const [eventBudgetTemplates, setEventBudgetTemplates] = useState<EventBudgetTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { member } = useAuth();
  const { showToast } = useToast();

  const loadAllTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [events, activityPlans, budgets] = await Promise.all([
        TemplatesService.getAllEventTemplates(),
        TemplatesService.getAllActivityPlanTemplates(),
        TemplatesService.getAllEventBudgetTemplates(),
      ]);
      setEventTemplates(events);
      setActivityPlanTemplates(activityPlans);
      setEventBudgetTemplates(budgets);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load templates';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadAllTemplates();
  }, [loadAllTemplates]);

  // Event Templates
  const createEventTemplate = async (templateData: Omit<EventTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const id = await TemplatesService.createEventTemplate({
        ...templateData,
        createdBy: member?.name,
      });
      await loadAllTemplates();
      showToast('Event template created successfully', 'success');
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create event template';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const updateEventTemplate = async (templateId: string, updates: Partial<EventTemplate>) => {
    try {
      await TemplatesService.updateEventTemplate(templateId, updates);
      await loadAllTemplates();
      showToast('Event template updated successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update event template';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const deleteEventTemplate = async (templateId: string) => {
    try {
      await TemplatesService.deleteEventTemplate(templateId);
      await loadAllTemplates();
      showToast('Event template deleted successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete event template';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  // Activity Plan Templates
  const createActivityPlanTemplate = async (templateData: Omit<ActivityPlanTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const id = await TemplatesService.createActivityPlanTemplate({
        ...templateData,
        createdBy: member?.name,
      });
      await loadAllTemplates();
      showToast('Activity plan template created successfully', 'success');
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create activity plan template';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const updateActivityPlanTemplate = async (templateId: string, updates: Partial<ActivityPlanTemplate>) => {
    try {
      await TemplatesService.updateActivityPlanTemplate(templateId, updates);
      await loadAllTemplates();
      showToast('Activity plan template updated successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update activity plan template';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const deleteActivityPlanTemplate = async (templateId: string) => {
    try {
      await TemplatesService.deleteActivityPlanTemplate(templateId);
      await loadAllTemplates();
      showToast('Activity plan template deleted successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete activity plan template';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  // Event Budget Templates
  const createEventBudgetTemplate = async (templateData: Omit<EventBudgetTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const id = await TemplatesService.createEventBudgetTemplate({
        ...templateData,
        createdBy: member?.name,
      });
      await loadAllTemplates();
      showToast('Event budget template created successfully', 'success');
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create event budget template';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const updateEventBudgetTemplate = async (templateId: string, updates: Partial<EventBudgetTemplate>) => {
    try {
      await TemplatesService.updateEventBudgetTemplate(templateId, updates);
      await loadAllTemplates();
      showToast('Event budget template updated successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update event budget template';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const deleteEventBudgetTemplate = async (templateId: string) => {
    try {
      await TemplatesService.deleteEventBudgetTemplate(templateId);
      await loadAllTemplates();
      showToast('Event budget template deleted successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete event budget template';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  return {
    eventTemplates,
    activityPlanTemplates,
    eventBudgetTemplates,
    loading,
    error,
    createEventTemplate,
    updateEventTemplate,
    deleteEventTemplate,
    createActivityPlanTemplate,
    updateActivityPlanTemplate,
    deleteActivityPlanTemplate,
    createEventBudgetTemplate,
    updateEventBudgetTemplate,
    deleteEventBudgetTemplate,
    reloadTemplates: loadAllTemplates,
  };
};
