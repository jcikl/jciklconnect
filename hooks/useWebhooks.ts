// Webhook Management Hook
import { useState, useCallback } from 'react';
import { WebhookService, Webhook, WebhookLog } from '../services/webhookService';
import { useToast } from '../components/ui/Common';
import { isDevMode } from '../utils/devMode';
import { useFirestoreCollection } from './useFirestoreCollection';

export const useWebhooks = () => {
  const { showToast } = useToast();

  const { data: webhooks, loading, error, reload: loadWebhooks } = useFirestoreCollection<Webhook>({
    loader: () => WebhookService.getAllWebhooks(),
    enabled: !isDevMode(),
  });

  // Webhook logs are loaded on-demand with an optional filter arg — keep as manual state
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);

  const loadWebhookLogs = useCallback(async (webhookId?: string) => {
    try {
      const data = await WebhookService.getWebhookLogs(webhookId);
      setWebhookLogs(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load webhook logs';
      showToast(errorMessage, 'error');
    }
  }, [showToast]);

  const createWebhook = useCallback(async (webhook: Omit<Webhook, 'id' | 'createdAt' | 'updatedAt' | 'successCount' | 'failureCount'>) => {
    try {
      await WebhookService.createWebhook(webhook);
      showToast('Webhook created successfully', 'success');
      await loadWebhooks();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create webhook';
      showToast(errorMessage, 'error');
      throw err;
    }
  }, [loadWebhooks, showToast]);

  const updateWebhook = useCallback(async (webhookId: string, updates: Partial<Webhook>) => {
    try {
      await WebhookService.updateWebhook(webhookId, updates);
      showToast('Webhook updated successfully', 'success');
      await loadWebhooks();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update webhook';
      showToast(errorMessage, 'error');
      throw err;
    }
  }, [loadWebhooks, showToast]);

  const deleteWebhook = useCallback(async (webhookId: string) => {
    try {
      await WebhookService.deleteWebhook(webhookId);
      showToast('Webhook deleted successfully', 'success');
      await loadWebhooks();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete webhook';
      showToast(errorMessage, 'error');
      throw err;
    }
  }, [loadWebhooks, showToast]);

  const testWebhook = useCallback(async (webhookId: string) => {
    try {
      const result = await WebhookService.testWebhook(webhookId);
      if (result.success) {
        showToast(result.message, 'success');
      } else {
        showToast(result.message, 'error');
      }
      await loadWebhooks();
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to test webhook';
      showToast(errorMessage, 'error');
      throw err;
    }
  }, [loadWebhooks, showToast]);

  return {
    webhooks,
    webhookLogs,
    loading,
    error,
    loadWebhooks,
    loadWebhookLogs,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    testWebhook,
  };
};
