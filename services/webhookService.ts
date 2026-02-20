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
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { isDevMode } from '../utils/devMode';

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
    if (isDevMode()) {
      return this.getMockWebhooks();
    }

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
      console.error('Error fetching webhooks:', error);
      throw error;
    }
  }

  // Get webhook by ID
  static async getWebhookById(webhookId: string): Promise<Webhook | null> {
    if (isDevMode()) {
      const webhooks = this.getMockWebhooks();
      return webhooks.find(w => w.id === webhookId) || null;
    }

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
      console.error('Error fetching webhook:', error);
      throw error;
    }
  }

  // Create webhook
  static async createWebhook(webhook: Omit<Webhook, 'id' | 'createdAt' | 'updatedAt' | 'successCount' | 'failureCount'>): Promise<string> {
    if (isDevMode()) {
      console.log('[Dev Mode] Would create webhook:', webhook);
      return `webhook-${Date.now()}`;
    }

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
      console.error('Error creating webhook:', error);
      throw error;
    }
  }

  // Update webhook
  static async updateWebhook(webhookId: string, updates: Partial<Webhook>): Promise<void> {
    if (isDevMode()) {
      console.log('[Dev Mode] Would update webhook:', webhookId, updates);
      return;
    }

    try {
      const docRef = doc(db, COLLECTIONS.WEBHOOKS || 'webhooks', webhookId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error updating webhook:', error);
      throw error;
    }
  }

  // Delete webhook
  static async deleteWebhook(webhookId: string): Promise<void> {
    if (isDevMode()) {
      console.log('[Dev Mode] Would delete webhook:', webhookId);
      return;
    }

    try {
      const docRef = doc(db, COLLECTIONS.WEBHOOKS || 'webhooks', webhookId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting webhook:', error);
      throw error;
    }
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
    if (isDevMode()) {
      console.log('[Dev Mode] Would log webhook execution:', log);
      return `log-${Date.now()}`;
    }

    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.WEBHOOK_LOGS || 'webhook_logs'), {
        ...log,
        triggeredAt: log.triggeredAt ? Timestamp.fromDate(log.triggeredAt) : Timestamp.now(),
      });

      return docRef.id;
    } catch (error) {
      console.error('Error logging webhook execution:', error);
      throw error;
    }
  }

  // Get webhook logs
  static async getWebhookLogs(webhookId?: string, limitCount: number = 50): Promise<WebhookLog[]> {
    if (isDevMode()) {
      return this.getMockWebhookLogs(webhookId);
    }

    try {
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
      console.error('Error fetching webhook logs:', error);
      throw error;
    }
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

