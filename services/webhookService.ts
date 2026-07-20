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
  increment,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { withDevMode, isDevMode } from '../utils/devMode';
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
          return snapshot.docs.map(doc => {
            const data = doc.data();
            // Strip secret before returning to the browser — same as getWebhookById.
            // The secret is used for HMAC signing and must stay server-side only.
            const { secret: _secret, ...safeData } = data;
            return {
              id: doc.id,
              ...safeData,
              createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
              updatedAt: (data.updatedAt as Timestamp)?.toDate() || new Date(),
              lastTriggered: data.lastTriggered ? (data.lastTriggered as Timestamp)?.toDate() : undefined,
            } as Webhook;
          });
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
          // P0 Fix: Strip the secret before returning to the browser — the secret is used
          // for HMAC signing and must never be exposed to client-side code.
          // NOTE: Webhook triggering with HMAC signing should move to a Netlify Function
          // once webhook delivery becomes a priority feature.
          const { secret: _secret, ...safeData } = data;
          return {
            id: docSnap.id,
            ...safeData,
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
          // SEC-TODO: move webhook secret to server-side env management (Netlify Function).
          // Plaintext is acceptable for now since only BOARD+ can read this collection via Firestore rules.
          const webhookToStore: typeof webhook = { ...webhook };

          const docRef = await addDoc(collection(db, COLLECTIONS.WEBHOOKS || 'webhooks'), {
            ...webhookToStore,
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
  // P1 fix: only pass the fields that Firestore rules allow via hasOnly([]); strip
  // runtime-managed counters (successCount, failureCount) and immutable timestamps
  // (createdAt) that callers must never overwrite directly.
  static async updateWebhook(webhookId: string, updates: Partial<Webhook>): Promise<void> {
    return withDevMode(
      () => { console.log('[Dev Mode] Would update webhook:', webhookId, updates); },
      async () => {
        try {
          const {
            // Strip fields that are managed by the service or are immutable
            id: _id,
            createdAt: _createdAt,
            successCount: _successCount,
            failureCount: _failureCount,
            lastTriggered: _lastTriggered,
            ...allowedUpdates
          } = updates as Partial<Webhook> & { id?: string };

          const docRef = doc(db, COLLECTIONS.WEBHOOKS || 'webhooks', webhookId);
          await updateDoc(docRef, {
            ...allowedUpdates,
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
  // P1: cascade-delete webhook_logs before removing the parent webhook document.
  static async deleteWebhook(webhookId: string): Promise<void> {
    return withDevMode(
      () => { console.log('[Dev Mode] Would delete webhook:', webhookId); },
      async () => {
        try {
          // Delete all webhook_logs for this webhook first, in pages of 400
          while (true) {
            const logsSnap = await getDocs(
              query(
                collection(db, COLLECTIONS.WEBHOOK_LOGS || 'webhook_logs'),
                where('webhookId', '==', webhookId),
                limit(400)
              )
            );
            if (logsSnap.empty) break;
            const logBatch = writeBatch(db);
            logsSnap.docs.forEach(d => logBatch.delete(d.ref));
            await logBatch.commit();
            if (logsSnap.size < 400) break;
          }

          const docRef = doc(db, COLLECTIONS.WEBHOOKS || 'webhooks', webhookId);
          await deleteDoc(docRef);
        } catch (error) {
          errorLoggingService.logError(error as Error, { component: 'WebhookService', action: 'deleteWebhook' });
          throw error;
        }
      }
    );
  }

  // Trigger webhook — NOTE: browser-side HTTP is blocked by CORS on most receivers.
  // Move to netlify/functions/trigger-webhook.js when webhook delivery is prioritized.
  static async triggerWebhook(webhookId: string, event: string, data: any): Promise<boolean> {
    if (isDevMode()) { console.log('[WebhookService] dev mode — skipping real HTTP request'); return true; }
    // Warn in production that browser-side outbound HTTP is blocked by CORS on most endpoints.
    errorLoggingService.logError(
      new Error('[WebhookService] triggerWebhook called from browser — CORS will block most real webhook endpoints. Move this to a Netlify Function.'),
      { component: 'WebhookService', action: 'triggerWebhook', additionalData: { webhookId, event } }
    );
    const webhook = await this.getWebhookById(webhookId);
    if (!webhook || !webhook.active) {
      return false;
    }

    const startTime = Date.now();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...webhook.headers,
    };

    // Build the body string upfront so the HMAC can be computed over it.
    const bodyString = webhook.method !== 'GET'
      ? JSON.stringify({
          event,
          data,
          timestamp: new Date().toISOString(),
          ...webhook.payload,
        })
      : undefined;

    // P0 Fix: HMAC signing removed from client-side — the secret is no longer returned
    // by getWebhookById so webhook.secret is always undefined here.
    // NOTE: triggerWebhook should move to a Netlify Function for server-side secret + HMAC signing.
    // WARNING: Previously this code fetched the secret to the browser and performed HMAC signing
    // client-side; that exposed the secret in network responses. Fixed by stripping secret in
    // getWebhookById. The signature header is omitted until server-side signing is implemented.
    void bodyString; // suppress unused-variable warning until server-side signing is wired up

    // P1: retry with retryPolicy.
    const maxRetries = webhook.retryPolicy?.maxRetries ?? 0;
    const retryDelay = webhook.retryPolicy?.retryDelay ?? 1000;

    let lastError: Error | null = null;
    let response: Response | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, retryDelay));
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        response = await fetch(webhook.url, {
          method: webhook.method,
          headers,
          body: bodyString,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (response.ok) break; // success — stop retrying
        // Non-2xx: capture but keep retrying if retries remain
        lastError = new Error(`HTTP ${response.status} ${response.statusText}`);
      } catch (err) {
        clearTimeout(timeout);
        const rawMsg = err instanceof Error ? err.message : String(err);
        if (rawMsg === 'Failed to fetch' || rawMsg.includes('NetworkError')) {
          lastError = new Error(
            'Failed to fetch: the webhook endpoint may be blocking browser requests due to CORS. ' +
            'Move triggerWebhook to a Netlify Function to send requests server-side.'
          );
        } else {
          lastError = err instanceof Error ? err : new Error(rawMsg);
        }
        response = null;
      }
    }

    const duration = Date.now() - startTime;

    if (response && response.ok) {
      try {
        await this.logWebhookExecution({
          webhookId,
          event,
          status: 'success',
          responseCode: response.status,
          responseBody: (await response.text().catch(() => '')).slice(0, 2000),
          triggeredAt: new Date(),
          duration,
        });
      } catch { /* non-fatal */ }

      // P1: use increment() to avoid read-then-write race on counters.
      try {
        await updateDoc(doc(db, COLLECTIONS.WEBHOOKS || 'webhooks', webhookId), {
          lastTriggered: Timestamp.now(),
          successCount: increment(1),
        });
      } catch { /* non-fatal */ }

      return true;
    } else {
      const errorMessage = lastError?.message ?? (response ? `HTTP ${response.status}` : 'Unknown error');

      try {
        await this.logWebhookExecution({
          webhookId,
          event,
          status: 'failed',
          responseCode: response?.status,
          error: errorMessage,
          triggeredAt: new Date(),
          duration,
        });
      } catch { /* non-fatal */ }

      try {
        await updateDoc(doc(db, COLLECTIONS.WEBHOOKS || 'webhooks', webhookId), {
          lastTriggered: Timestamp.now(),
          failureCount: increment(1),
        });
      } catch { /* non-fatal */ }

      return false;
    }
  }

  // Log webhook execution
  // P0 fix: BOARD users can invoke triggerWebhook but Firestore rules only allow
  // isAdmin() to create webhook_logs. Catch PERMISSION_DENIED silently so a rules
  // mismatch never surfaces as an error to the caller — the log is best-effort.
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
          // Silently swallow PERMISSION_DENIED — webhook log writes are best-effort.
          // Non-permission errors are still reported so they don't go unnoticed.
          const msg = error instanceof Error ? error.message : String(error);
          if (!msg.includes('permission') && !msg.includes('PERMISSION_DENIED')) {
            errorLoggingService.logError(error as Error, { component: 'WebhookService', action: 'logWebhookExecution' });
          }
          return '';
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
          responseCode: data.responseCode,
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

