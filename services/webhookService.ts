// Webhook Configuration Service
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { withDevMode } from '../utils/devMode';
import { errorLoggingService } from './errorLoggingService';

export interface Webhook {
  id?: string;
  name: string;
  description?: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  payload?: Record<string, any>;
  events: string[]; // Event types that trigger this webhook
  active: boolean;
  secret?: string; // For webhook signature verification
  retryPolicy?: {
    maxRetries: number;
    retryDelay: number; // in milliseconds
  };
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  lastTriggered?: Date | Timestamp;
  successCount: number;
  failureCount: number;
}

export interface WebhookLog {
  id?: string;
  webhookId: string;
  event: string;
  status: 'success' | 'failed' | 'pending';
  responseCode?: number;
  responseBody?: string;
  error?: string;
  triggeredAt: Date | Timestamp;
  duration?: number; // in milliseconds
}

export class WebhookService {
  // Get all webhooks
  static async getAllWebhooks(): Promise<Webhook[]> {
    return withDevMode(
      () => this.getMockWebhooks(),
      async () => {
        try {
          const q = query(
            collection(db, COLLECTIONS.WEBHOOKS || 'webhooks'),
            orderBy('createdAt', 'desc')
          );

          const snapshot = await getDocs(q);
          return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
            updatedAt: (doc.data().updatedAt as Timestamp)?.toDate() || new Date(),
            lastTriggered: doc.data().lastTriggered ? (doc.data().lastTriggered as Timestamp)?.toDate() : undefined,
          } as Webhook));
        } catch (error) {
          errorLoggingService.logError(error as Error, { component: 'WebhookService', action: 'getAllWebhooks' });
          throw error;
        }
      }
    );
  }

  // Get webhook by ID
  static async getWebhookById(webhookId: string): Promise<Webhook | null> {
    return withDevMode(
      () => {
        const webhooks = this.getMockWebhooks();
        return webhooks.find(w => w.id === webhookId) || null;
      },
      async () => {
        try {
          const docRef = doc(db, COLLECTIONS.WEBHOOKS || 'webhooks', webhookId);
          const docSnap = await getDoc(docRef);

          if (!docSnap.exists()) {
            return null;
          }

          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
            updatedAt: (data.updatedAt as Timestamp)?.toDate() || new Date(),
            lastTriggered: data.lastTriggered ? (data.lastTriggered as Timestamp)?.toDate() : undefined,
          } as Webhook;
        } catch (error) {
          errorLoggingService.logError(error as Error, { component: 'WebhookService', action: 'getWebhookById' });
          throw error;
        }
      }
    );
  }

  // Create webhook
  static async createWebhook(webhook: Omit<Webhook, 'id' | 'createdAt' | 'updatedAt' | 'successCount' | 'failureCount'>): Promise<string> {
    return withDevMode(
      () => {
        console.log('[Dev Mode] Would create webhook:', webhook);
        return `webhook-${Date.now()}`;
      },
      async () => {
        try {
          const docRef = await addDoc(collection(db, COLLECTIONS.WEBHOOKS || 'webhooks'), {
            ...webhook,
            successCount: 0,
            failureCount: 0,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });

          return docRef.id;
        } catch (error) {
          errorLoggingService.logError(error as Error, { component: 'WebhookService', action: 'createWebhook' });
          throw error;
        }
      }
    );
  }

  // Update webhook
  static async updateWebhook(webhookId: string, updates: Partial<Webhook>): Promise<void> {
    return withDevMode(
      () => { console.log('[Dev Mode] Would update webhook:', webhookId, updates); },
      async () => {
        try {
          const docRef = doc(db, COLLECTIONS.WEBHOOKS || 'webhooks', webhookId);
          await updateDoc(docRef, {
            ...updates,
            updatedAt: Timestamp.now(),
          });
        } catch (error) {
          errorLoggingService.logError(error as Error, { component: 'WebhookService', action: 'updateWebhook' });
          throw error;
        }
      }
    );
  }

  // Delete webhook
  static async deleteWebhook(webhookId: string): Promise<void> {
    return withDevMode(
      () => { console.log('[Dev Mode] Would delete webhook:', webhookId); },
      async () => {
        try {
          const docRef = doc(db, COLLECTIONS.WEBHOOKS || 'webhooks', webhookId);
          await deleteDoc(docRef);
        } catch (error) {
          errorLoggingService.logError(error as Error, { component: 'WebhookService', action: 'deleteWebhook' });
          throw error;
        }
      }
    );
  }

  // Trigger webhook
  static async triggerWebhook(webhookId: string, event: string, data: any): Promise<boolean> {
    const webhook = await this.getWebhookById(webhookId);
    if (!webhook || !webhook.active) {
      return false;
    }

    try {
      const startTime = Date.now();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...webhook.headers,
      };

      // Add webhook signature if secret is configured
      if (webhook.secret) {
        // In production, generate HMAC signature
        headers['X-Webhook-Signature'] = 'signature-placeholder';
      }

      const response = await fetch(webhook.url, {
        method: webhook.method,
        headers,
        body: webhook.method !== 'GET' ? JSON.stringify({
          event,
          data,
          timestamp: new Date().toISOString(),
          ...webhook.payload,
        }) : undefined,
      });

      const duration = Date.now() - startTime;
      const success = response.ok;

      // Log webhook execution
      await this.logWebhookExecution({
        webhookId,
        event,
        status: success ? 'success' : 'failed',
        responseCode: response.status,
        responseBody: await response.text().catch(() => ''),
        triggeredAt: new Date(),
        duration,
      });

      // Update webhook stats
      await this.updateWebhook(webhookId, {
        lastTriggered: new Date(),
        successCount: webhook.successCount + (success ? 1 : 0),
        failureCount: webhook.failureCount + (success ? 0 : 1),
      });

      return success;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Log failed execution
      await this.logWebhookExecution({
        webhookId,
        event,
        status: 'failed',
        error: errorMessage,
        triggeredAt: new Date(),
      });

      // Update failure count
      await this.updateWebhook(webhookId, {
        lastTriggered: new Date(),
        failureCount: webhook.failureCount + 1,
      });

      return false;
    }
  }

  // Log webhook execution
  static async logWebhookExecution(log: Omit<WebhookLog, 'id' | 'triggeredAt'> & { triggeredAt?: Date }): Promise<string> {
    return withDevMode(
      () => {
        console.log('[Dev Mode] Would log webhook execution:', log);
        return `log-${Date.now()}`;
      },
      async () => {
        try {
          const docRef = await addDoc(collection(db, COLLECTIONS.WEBHOOK_LOGS || 'webhook_logs'), {
            ...log,
            triggeredAt: log.triggeredAt ? Timestamp.fromDate(log.triggeredAt) : Timestamp.now(),
          });

          return docRef.id;
        } catch (error) {
          errorLoggingService.logError(error as Error, { component: 'WebhookService', action: 'logWebhookExecution' });
          throw error;
        }
      }
    );
  }

  // Get webhook logs
  static async getWebhookLogs(webhookId?: string, limitCount: number = 50): Promise<WebhookLog[]> {
    return withDevMode(
      () => this.getMockWebhookLogs(webhookId),
      async () => { try {
      let q;
      if (webhookId) {
        q = query(
          collection(db, COLLECTIONS.WEBHOOK_LOGS || 'webhook_logs'),
          where('webhookId', '==', webhookId),
          orderBy('triggeredAt', 'desc'),
          limit(limitCount)
        );
      } else {
        q = query(
          collection(db, COLLECTIONS.WEBHOOK_LOGS || 'webhook_logs'),
          orderBy('triggeredAt', 'desc'),
          limit(limitCount)
        );
      }

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data() as any; // Type assertion for Firestore data
        return {
          id: doc.id,
          webhookId: data.webhookId || '',
          event: data.event || '',
          status: data.status || 'pending',
          triggeredAt: (data.triggeredAt as Timestamp)?.toDate() || new Date(),
          responseCode: data.responseStatus,
          responseBody: data.responseBody,
          error: data.error,
          duration: data.duration || 0,
        } as WebhookLog;
      });
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'WebhookService', action: 'getWebhookLogs' });
      throw error;
    }
  });
  }

  // Test webhook
  static async testWebhook(webhookId: string): Promise<{ success: boolean; message: string; responseCode?: number }> {
    try {
      const success = await this.triggerWebhook(webhookId, 'test', { test: true });
      return {
        success,
        message: success ? 'Webhook triggered successfully' : 'Webhook trigger failed',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: `Error: ${errorMessage}`,
      };
    }
  }

  /**
   * Cleanup utility: batch-delete systemLogs documents older than 90 days.
   * Call this manually from an ADMIN / SUPER_ADMIN context — not automatically triggered.
   * TTL policy: systemLogs and webhook_logs have no automatic expiry in Firestore rules,
   * so old records must be purged via this method or a scheduled Cloud Function.
   */
  static async createSystemLogCleanupJob(dryRun = false): Promise<{ deleted: number }> {
    return withDevMode(
      () => {
        console.log('[Dev Mode] createSystemLogCleanupJob — would scan systemLogs older than 90 days');
        return { deleted: 0 };
      },
      async () => {
        try {
          const cutoff = Timestamp.fromDate(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));
          const q = query(
            collection(db, COLLECTIONS.SYSTEM_LOGS),
            where('flushedAt', '<', cutoff),
            limit(400) // Stay within writeBatch 500-op limit
          );
          const snapshot = await getDocs(q);
          if (snapshot.empty) return { deleted: 0 };
          if (dryRun) return { deleted: snapshot.size };

          const batch = writeBatch(db);
          snapshot.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
          return { deleted: snapshot.size };
        } catch (error) {
          errorLoggingService.logError(error as Error, { component: 'WebhookService', action: 'createSystemLogCleanupJob' });
          throw error;
        }
      }
    );
  }

  /**
   * Cleanup utility: batch-delete webhook_logs documents older than the given days (default 90).
   * Call this manually from an ADMIN / SUPER_ADMIN context.
   */
  static async purgeOldWebhookLogs(olderThanDays = 90, dryRun = false): Promise<{ deleted: number }> {
    return withDevMode(
      () => {
        console.log(`[Dev Mode] purgeOldWebhookLogs — would scan webhook_logs older than ${olderThanDays} days`);
        return { deleted: 0 };
      },
      async () => {
        try {
          const cutoff = Timestamp.fromDate(new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000));
          const q = query(
            collection(db, COLLECTIONS.WEBHOOK_LOGS || 'webhook_logs'),
            where('triggeredAt', '<', cutoff),
            limit(400)
          );
          const snapshot = await getDocs(q);
          if (snapshot.empty) return { deleted: 0 };
          if (dryRun) return { deleted: snapshot.size };

          const batch = writeBatch(db);
          snapshot.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
          return { deleted: snapshot.size };
        } catch (error) {
          errorLoggingService.logError(error as Error, { component: 'WebhookService', action: 'purgeOldWebhookLogs' });
          throw error;
        }
      }
    );
  }

  // Mock data for dev mode
  private static getMockWebhooks(): Webhook[] {
    return [
      {
        id: 'webhook-1',
        name: 'Member Registration Webhook',
        description: 'Triggered when a new member registers',
        url: 'https://example.com/webhooks/member-registered',
        method: 'POST',
        events: ['member.registered', 'member.updated'],
        active: true,
        successCount: 45,
        failureCount: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastTriggered: new Date(),
      },
    ];
  }

  private static getMockWebhookLogs(webhookId?: string): WebhookLog[] {
    return [
      {
        id: 'log-1',
        webhookId: webhookId || 'webhook-1',
        event: 'member.registered',
        status: 'success',
        responseCode: 200,
        triggeredAt: new Date(),
        duration: 150,
      },
    ];
  }
}

