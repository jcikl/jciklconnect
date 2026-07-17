// Email Service - Email Integration Service
import { Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { withDevMode } from '../utils/devMode';
import { addDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { errorLoggingService } from './errorLoggingService';
import { getAuth } from 'firebase/auth';

export interface EmailConfig {
  provider: 'sendgrid' | 'mailgun' | 'smtp' | 'ses' | 'resend';
  // apiKey is intentionally omitted — API keys must never be present in the browser.
  // All email sending is proxied through /.netlify/functions/send-email using
  // server-side env vars (no VITE_ prefix). See SEC: API key exposure prevention.
  fromEmail: string;
  fromName: string;
  smtpHost?: string;
  smtpPort?: number;
  // SMTP credentials must never be in client code — use server-side env vars only
  smtpSecure?: boolean;
  region?: string; // For AWS SES
}

export interface EmailMessage {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  templateId?: string; // For template-based emails
  templateData?: Record<string, any>; // Template variables
  tags?: string[]; // For email categorization
  metadata?: Record<string, any>;
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer; // Base64 encoded or Buffer
  contentType?: string;
  contentId?: string; // For inline attachments
}

export interface EmailLog {
  id?: string;
  messageId?: string; // Provider's message ID
  to: string | string[];
  subject: string;
  status: 'pending' | 'sent' | 'delivered' | 'bounced' | 'failed' | 'opened' | 'clicked';
  provider: string;
  sentAt?: string;
  deliveredAt?: string;
  openedAt?: string;
  clickedAt?: string;
  error?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export class EmailService {
  private static config: EmailConfig | null = null;

  // Initialize email service with configuration
  static async initialize(config: EmailConfig): Promise<void> {
    this.config = config;

    // Validate configuration
    if (!config.fromEmail || !config.fromName) {
      throw new Error('Email configuration requires fromEmail and fromName');
    }
    // Note: API key validation is no longer required here — keys live in server-side
    // env vars accessed only by the /.netlify/functions/send-email function.
  }

  // Send email
  static async sendEmail(message: EmailMessage): Promise<string> {
    return withDevMode(
      async () => {
        console.log('[DEV MODE] Would send email:', {
          to: message.to,
          subject: message.subject,
          provider: this.config?.provider || 'none',
        });

        // Log email in dev mode
        await this.logEmail({
          to: message.to,
          subject: message.subject,
          status: 'sent',
          provider: this.config?.provider || 'dev',
          metadata: { devMode: true },
        });

        return `dev-email-${Date.now()}`;
      },
      async () => {
        if (!this.config) {
          throw new Error('Email service not initialized. Call EmailService.initialize() first.');
        }

        try {
          let messageId: string;

          switch (this.config.provider) {
            case 'sendgrid':
              messageId = await this.sendViaSendGrid(message);
              break;
            case 'mailgun':
              messageId = await this.sendViaMailgun(message);
              break;
            case 'smtp':
              messageId = await this.sendViaSMTP(message);
              break;
            case 'ses':
              messageId = await this.sendViaSES(message);
              break;
            case 'resend':
              messageId = await this.sendViaResend(message);
              break;
            default:
              throw new Error(`Unsupported email provider: ${this.config.provider}`);
          }

          // Log successful email
          await this.logEmail({
            messageId,
            to: message.to,
            subject: message.subject,
            status: 'sent',
            provider: this.config.provider,
            sentAt: new Date().toISOString(),
            metadata: message.metadata,
          });

          return messageId;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          // Log failed email
          await this.logEmail({
            to: message.to,
            subject: message.subject,
            status: 'failed',
            provider: this.config.provider,
            error: errorMessage,
            metadata: message.metadata,
          });

          throw error;
        }
      }
    );
  }

  /**
   * SEC: API key exposure prevention.
   * All three providers are proxied through the server-side Netlify function
   * /.netlify/functions/send-email, which reads SENDGRID_API_KEY / RESEND_API_KEY /
   * MAILGUN_API_KEY + MAILGUN_DOMAIN from server env vars (no VITE_ prefix).
   * The browser never sees the API keys.
   */
  private static async sendViaProxy(
    message: EmailMessage,
    provider: 'sendgrid' | 'resend' | 'mailgun'
  ): Promise<string> {
    const token = await getAuth().currentUser?.getIdToken();
    if (!token) {
      throw new Error('User is not authenticated — cannot send email');
    }

    const response = await fetch('/.netlify/functions/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: message.to,
        subject: message.subject,
        html: message.html || message.text || '',
        provider,
        from: this.config ? `${this.config.fromName} <${this.config.fromEmail}>` : undefined,
      }),
    });

    const data = await response.json() as { success: boolean; messageId?: string; error?: string };
    if (!data.success) {
      throw new Error(`Email proxy error (${provider}): ${data.error || 'Unknown error'}`);
    }
    return data.messageId || `${provider}-${Date.now()}`;
  }

  // Send email via SendGrid (proxied through Netlify function)
  private static async sendViaSendGrid(message: EmailMessage): Promise<string> {
    return this.sendViaProxy(message, 'sendgrid');
  }

  // Send email via Mailgun (proxied through Netlify function)
  private static async sendViaMailgun(message: EmailMessage): Promise<string> {
    return this.sendViaProxy(message, 'mailgun');
  }

  // Send email via SMTP
  private static async sendViaSMTP(_message: EmailMessage): Promise<string> {
    throw new Error('SMTP sending requires a backend service. Please use a provider with API support or implement a backend endpoint.');
  }

  // Send email via AWS SES
  private static async sendViaSES(_message: EmailMessage): Promise<string> {
    throw new Error('AWS SES sending requires backend implementation. Please use a provider with direct API support or implement a backend endpoint.');
  }

  // Send email via Resend (proxied through Netlify function)
  private static async sendViaResend(message: EmailMessage): Promise<string> {
    return this.sendViaProxy(message, 'resend');
  }

  // Log email to database
  private static async logEmail(log: Omit<EmailLog, 'id' | 'createdAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.EMAIL_LOGS || 'emailLogs'), {
        ...log,
        createdAt: Timestamp.now(),
      });
      return docRef.id;
    } catch (error) {
      // Don't throw - email logging failure shouldn't break email sending
      // Log silently via errorLoggingService so failures are traceable without crashing
      try { errorLoggingService.logError(error as Error, { component: 'EmailService', action: 'logEmail' }); } catch { /* ignore */ }
      return '';
    }
  }

  // Get email logs
  static async getEmailLogs(
    filters?: {
      to?: string;
      status?: EmailLog['status'];
      provider?: string;
      limit?: number;
    }
  ): Promise<EmailLog[]> {
    return withDevMode(
      () => [],
      async () => {
        try {
          let q = query(collection(db, COLLECTIONS.EMAIL_LOGS || 'emailLogs'), orderBy('createdAt', 'desc'));

          if (filters?.to) {
            q = query(q, where('to', '==', filters.to));
          }
          if (filters?.status) {
            q = query(q, where('status', '==', filters.status));
          }
          if (filters?.provider) {
            q = query(q, where('provider', '==', filters.provider));
          }
          if (filters?.limit) {
            q = query(q, limit(filters.limit));
          }

          const snapshot = await getDocs(q);
          return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            sentAt: doc.data().sentAt,
            deliveredAt: doc.data().deliveredAt,
            openedAt: doc.data().openedAt,
            clickedAt: doc.data().clickedAt,
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
          } as EmailLog));
        } catch (error) {
          console.error('Error fetching email logs:', error);
          throw error;
        }
      }
    );
  }

  // Send bulk emails
  static async sendBulkEmails(
    messages: EmailMessage[],
    options?: {
      batchSize?: number;
      delayBetweenBatches?: number;
    }
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const batchSize = options?.batchSize || 10;
    const delay = options?.delayBetweenBatches || 1000;
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      
      const results = await Promise.allSettled(
        batch.map(message => this.sendEmail(message))
      );

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          success++;
        } else {
          failed++;
          errors.push(`Failed to send to ${batch[index].to}: ${result.reason}`);
        }
      });

      // Delay between batches to avoid rate limiting
      if (i + batchSize < messages.length) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return { success, failed, errors };
  }

  // Send email with template
  static async sendTemplatedEmail(
    to: string | string[],
    templateId: string,
    templateData: Record<string, any>,
    options?: {
      subject?: string;
      cc?: string | string[];
      bcc?: string | string[];
    }
  ): Promise<string> {
    const message: EmailMessage = {
      to,
      subject: options?.subject || 'Notification',
      templateId,
      templateData,
      cc: options?.cc,
      bcc: options?.bcc,
    };

    // For template-based emails, we'd need provider-specific implementation
    // This is a placeholder - actual implementation depends on the provider
    return await this.sendEmail(message);
  }
}

