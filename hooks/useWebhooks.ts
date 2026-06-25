// Webhook Management Hook
import { useState, useEffect, useCallback } from 'react';
import { WebhookService, Webhook, WebhookLog } from '../services/webhookService';
import { useToast } from '../components/ui/Common';
import { isDevMode } from '../utils/devMode';

export const useWebhooks = () => {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const loadWebhooks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await WebhookService.getAllWebhooks();
      setWebhooks(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load webhooks';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

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
      setError(null);
      await WebhookService.createWebhook(webhook);
      showToast('Webhook created successfully', 'success');
      await loadWebhooks();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create webhook';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      throw err;
    }
  }, [loadWebhooks, showToast]);

  const updateWebhook = useCallback(async (webhookId: string, updates: Partial<Webhook>) => {
    try {
      setError(null);
      await WebhookService.updateWebhook(webhookId, updates);
      showToast('Webhook updated successfully', 'success');
      await loadWebhooks();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update webhook';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      throw err;
    }
  }, [loadWebhooks, showToast]);

  const deleteWebhook = useCallback(async (webhookId: string) => {
    try {
      setError(null);
      await WebhookService.deleteWebhook(webhookId);
      showToast('Webhook deleted successfully', 'success');
      await loadWebhooks();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete webhook';
      setError(errorMessage);
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

  useEffect(() => {
    if (!isDevMode()) {
      loadWebhooks();
    } else {
      setLoading(false);
    }
  }, [loadWebhooks]);

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

