// Email Service - Email Integration Service
import { Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { isDevMode } from '../utils/devMode';
import { addDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

export interface EmailConfig {
  provider: 'sendgrid' | 'mailgun' | 'smtp' | 'ses' | 'resend';
  apiKey?: string;
  apiSecret?: string;
  fromEmail: string;
  fromName: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
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

    // Provider-specific validation
    switch (config.provider) {
      case 'sendgrid':
        if (!config.apiKey) {
          throw new Error('SendGrid requires apiKey');
        }
        break;
      case 'mailgun':
        if (!config.apiKey || !config.apiSecret) {
          throw new Error('Mailgun requires apiKey and apiSecret');
        }
        break;
      case 'smtp':
        if (!config.smtpHost || !config.smtpPort || !config.smtpUser || !config.smtpPassword) {
          throw new Error('SMTP requires smtpHost, smtpPort, smtpUser, and smtpPassword');
        }
        break;
      case 'ses':
        if (!config.apiKey || !config.apiSecret || !config.region) {
          throw new Error('AWS SES requires apiKey, apiSecret, and region');
        }
        break;
      case 'resend':
        if (!config.apiKey) {
          throw new Error('Resend requires apiKey');
        }
        break;
    }
  }

  // Send email
  static async sendEmail(message: EmailMessage): Promise<string> {
    if (isDevMode()) {
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
    }

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

  // Send email via SendGrid
  private static async sendViaSendGrid(message: EmailMessage): Promise<string> {
    if (!this.config?.apiKey) {
      throw new Error('SendGrid API key not configured');
    }

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{
          to: Array.isArray(message.to) 
            ? message.to.map(email => ({ email }))
            : [{ email: message.to }],
          ...(message.cc && {
            cc: Array.isArray(message.cc)
              ? message.cc.map(email => ({ email }))
              : [{ email: message.cc }],
          }),
          ...(message.bcc && {
            bcc: Array.isArray(message.bcc)
              ? message.bcc.map(email => ({ email }))
              : [{ email: message.bcc }],
          }),
        }],
        from: {
          email: this.config.fromEmail,
          name: this.config.fromName,
        },
        subject: message.subject,
        content: [
          ...(message.html ? [{ type: 'text/html', value: message.html }] : []),
          ...(message.text ? [{ type: 'text/plain', value: message.text }] : []),
        ],
        ...(message.replyTo && { reply_to: { email: message.replyTo } }),
        ...(message.tags && { categories: message.tags }),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SendGrid error: ${error}`);
    }

    const messageId = response.headers.get('x-message-id') || `sg-${Date.now()}`;
    return messageId;
  }

  // Send email via Mailgun
  private static async sendViaMailgun(message: EmailMessage): Promise<string> {
    if (!this.config?.apiKey || !this.config?.apiSecret) {
      throw new Error('Mailgun API credentials not configured');
    }

    const formData = new FormData();
    formData.append('from', `${this.config.fromName} <${this.config.fromEmail}>`);
    
    if (Array.isArray(message.to)) {
      message.to.forEach(email => formData.append('to', email));
    } else {
      formData.append('to', message.to);
    }
    
    if (message.cc) {
      if (Array.isArray(message.cc)) {
        message.cc.forEach(email => formData.append('cc', email));
      } else {
        formData.append('cc', message.cc);
      }
    }
    
    if (message.bcc) {
      if (Array.isArray(message.bcc)) {
        message.bcc.forEach(email => formData.append('bcc', email));
      } else {
        formData.append('bcc', message.bcc);
      }
    }
    
    formData.append('subject', message.subject);
    if (message.html) formData.append('html', message.html);
    if (message.text) formData.append('text', message.text);
    if (message.replyTo) formData.append('h:Reply-To', message.replyTo);

    const domain = this.config.apiSecret; // Mailgun domain is typically in apiSecret
    const response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`api:${this.config.apiKey}`)}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Mailgun error: ${error}`);
    }

    const data = await response.json();
    return data.id || `mg-${Date.now()}`;
  }

  // Send email via SMTP
  private static async sendViaSMTP(message: EmailMessage): Promise<string> {
    // Note: SMTP sending typically requires a backend service
    // This is a placeholder that would need to be implemented on the server side
    // For client-side, we'd need to use a service like EmailJS or call a backend API
    
    throw new Error('SMTP sending requires a backend service. Please use a provider with API support or implement a backend endpoint.');
  }

  // Send email via AWS SES
  private static async sendViaSES(message: EmailMessage): Promise<string> {
    if (!this.config?.apiKey || !this.config?.apiSecret || !this.config?.region) {
      throw new Error('AWS SES credentials not configured');
    }

    // AWS SES requires AWS SDK and backend implementation
    // This is a placeholder - in production, this should call a backend API
    throw new Error('AWS SES sending requires backend implementation. Please use a provider with direct API support or implement a backend endpoint.');
  }

  // Send email via Resend
  private static async sendViaResend(message: EmailMessage): Promise<string> {
    if (!this.config?.apiKey) {
      throw new Error('Resend API key not configured');
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${this.config.fromName} <${this.config.fromEmail}>`,
        to: Array.isArray(message.to) ? message.to : [message.to],
        ...(message.cc && {
          cc: Array.isArray(message.cc) ? message.cc : [message.cc],
        }),
        ...(message.bcc && {
          bcc: Array.isArray(message.bcc) ? message.bcc : [message.bcc],
        }),
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo && { reply_to: message.replyTo }),
        ...(message.tags && { tags: message.tags }),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Resend error: ${error}`);
    }

    const data = await response.json();
    return data.id || `resend-${Date.now()}`;
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
      console.error('Error logging email:', error);
      // Don't throw - email logging failure shouldn't break email sending
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
    if (isDevMode()) {
      return [];
    }

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

