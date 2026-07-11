// Templates Data Hook
import { TemplatesService, EventTemplate, ActivityPlanTemplate, EventBudgetTemplate } from '../services/templatesService';
import { useToast } from '../components/ui/Common';
import { useAuth } from './useAuth';
import { useFirestoreCollection } from './useFirestoreCollection';

export const useTemplates = () => {
  const { member } = useAuth();
  const { showToast } = useToast();

  const { data: eventTemplates, loading: loading1, error: error1, reload: reloadEventTemplates } = useFirestoreCollection<EventTemplate>({
    loader: () => TemplatesService.getAllEventTemplates(),
  });

  const { data: activityPlanTemplates, loading: loading2, error: error2, reload: reloadActivityPlanTemplates } = useFirestoreCollection<ActivityPlanTemplate>({
    loader: () => TemplatesService.getAllActivityPlanTemplates(),
  });

  const { data: eventBudgetTemplates, loading: loading3, error: error3, reload: reloadEventBudgetTemplates } = useFirestoreCollection<EventBudgetTemplate>({
    loader: () => TemplatesService.getAllEventBudgetTemplates(),
  });

  const loading = loading1 || loading2 || loading3;
  const error = error1 || error2 || error3;

  const loadAllTemplates = async () => {
    await Promise.all([
      reloadEventTemplates(),
      reloadActivityPlanTemplates(),
      reloadEventBudgetTemplates(),
    ]);
  };

  // Event Templates
  const createEventTemplate = async (templateData: Omit<EventTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const id = await TemplatesService.createEventTemplate({
        ...templateData,
        createdBy: member?.name,
      });
      await reloadEventTemplates();
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
      await reloadEventTemplates();
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
      await reloadEventTemplates();
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
      await reloadActivityPlanTemplates();
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
      await reloadActivityPlanTemplates();
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
      await reloadActivityPlanTemplates();
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
      await reloadEventBudgetTemplates();
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
      await reloadEventBudgetTemplates();
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
      await reloadEventBudgetTemplates();
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
