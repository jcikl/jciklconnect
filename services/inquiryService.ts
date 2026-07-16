import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { isDevMode } from '@/utils/devMode';
import { errorLoggingService } from '@/services/errorLoggingService';

// Inquiry type is internal to this service — not exposed in types.ts
export interface Inquiry {
  id?: string;
  senderId: string;
  senderName: string;
  senderPhone: string;
  senderCompany?: string;
  recipientId: string;
  recipientName: string;
  recipientPhone: string;
  businessId: string;
  businessName: string;
  requirements: string;
  channel: 'whatsapp_direct' | 'whapi_bot' | 'no_phone';
  status: 'sent' | 'pending' | 'failed';
  createdAt: Timestamp;
}

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** Strip leading + for wa.me URL */
function waPhone(phone: string): string {
  const digits = digitsOnly(phone);
  return digits.startsWith('0') ? digits.slice(1) : digits;
}

function buildDirectMessage(
  senderName: string,
  senderJobTitle: string | undefined,
  senderCompany: string | undefined,
  requirements: string
): string {
  const companyLine = senderJobTitle && senderCompany
    ? `I am also the ${senderJobTitle} of ${senderCompany}, I would like to ask about:\n${requirements}`
    : senderCompany
    ? `I am also from ${senderCompany}, I would like to ask about:\n${requirements}`
    : `I would like to ask about:\n${requirements}`;
  return (
    `Hellooo! 👋This is ${senderName} from JCI Kuala Lumpur.\n` +
    `I found your business profile on JCI KL Connect and would love to connect.\n\n` +
    `${companyLine}\n\n` +
    `Looking forward to hearing from you! 🤝`
  );
}

function buildRecipientBotMessage(
  recipientName: string,
  senderName: string,
  senderPhone: string,
  senderCompany: string | undefined,
  requirements: string
): string {
  const companyLine = senderCompany ? `🏢 Company: ${senderCompany}\n` : '';
  return (
    `Hi ${recipientName}! 👋\n\n` +
    `A JCI KL member has reached out to you via *JCI KL Connect*:\n\n` +
    `👤 Name: ${senderName}\n` +
    `${companyLine}` +
    `📞 Contact: ${senderPhone}\n\n` +
    `💬 Inquiry:\n${requirements}\n\n` +
    `Feel free to contact them directly, or log in to JCI KL Connect to reply.\n\n` +
    `_This message was sent by JCI KL Connect_`
  );
}

function buildAdminBotMessage(
  senderName: string,
  senderPhone: string,
  senderCompany: string | undefined,
  recipientName: string,
  businessName: string,
  requirements: string,
  note: string
): string {
  const companyLine = senderCompany ? `🏢 ${senderCompany}\n` : '';
  return (
    `📋 *New Business Inquiry — JCI KL Connect*\n\n` +
    `*From (Sender):*\n` +
    `👤 ${senderName}\n` +
    `${companyLine}` +
    `📞 ${senderPhone}\n\n` +
    `*To (Recipient):*\n` +
    `👤 ${recipientName} — ${businessName}\n\n` +
    `*Inquiry:*\n${requirements}\n\n` +
    `⚠️ Note: ${note}\n\n` +
    `_Please follow up if needed._`
  );
}

async function sendWhapiMessage(recipientPhone: string, message: string, token: string): Promise<void> {
  const to = `${digitsOnly(recipientPhone)}@s.whatsapp.net`;
  const response = await fetch('https://gate.whapi.cloud/messages/text', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ to, body: message }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Whapi error ${response.status}`);
  }
}

export interface SubmitInquiryParams {
  senderId: string;
  senderName: string;
  senderPhone: string;
  senderJobTitle?: string;
  senderCompany?: string;
  senderInGroup: boolean;
  recipientId: string;
  recipientName: string;
  recipientPhone: string;
  recipientInGroup: boolean;
  businessId: string;
  businessName: string;
  requirements: string;
}

/**
 * Inquiry submission flow:
 * - Both in WA group + recipient has phone → open wa.me URL directly (returned as waUrl)
 * - One/both not in group, OR recipient has no phone → Whapi bot:
 *     1. Send notification to admin
 *     2. Send notification to recipient (if recipient has phone)
 */
export async function submitInquiry(params: SubmitInquiryParams): Promise<{
  channel: Inquiry['channel'];
  waUrl?: string;
}> {
  // Dev mode: skip real Firestore writes and WhatsApp calls
  if (isDevMode()) {
    const channel: Inquiry['channel'] = (params.senderInGroup && params.recipientInGroup && !!params.recipientPhone)
      ? 'whatsapp_direct'
      : params.recipientPhone ? 'whapi_bot' : 'no_phone';
    return { channel, waUrl: channel === 'whatsapp_direct' ? 'https://wa.me/dev-mock' : undefined };
  }

  const {
    senderId, senderName, senderPhone, senderJobTitle, senderCompany, senderInGroup,
    recipientId, recipientName, recipientPhone, recipientInGroup,
    businessId, businessName, requirements,
  } = params;

  const bothInGroup = senderInGroup && recipientInGroup;
  const hasPhone = !!recipientPhone;

  let channel: Inquiry['channel'];
  let waUrl: string | undefined;

  if (bothInGroup && hasPhone) {
    channel = 'whatsapp_direct';
    const msg = buildDirectMessage(senderName, senderJobTitle, senderCompany, requirements);
    waUrl = `https://api.whatsapp.com/send?phone=${waPhone(recipientPhone)}&text=${encodeURIComponent(msg)}`;
  } else {
    channel = hasPhone ? 'whapi_bot' : 'no_phone';
  }

  // Step 1: Write to Firestore first — if this fails we throw before any WhatsApp call
  const record: Omit<Inquiry, 'id'> = {
    senderId,
    senderName,
    senderPhone,
    senderCompany,
    recipientId,
    recipientName,
    recipientPhone,
    businessId,
    businessName,
    requirements,
    channel,
    status: 'sent',
    createdAt: Timestamp.now(),
  };

  await addDoc(collection(db, COLLECTIONS.INQUIRIES), record);

  // Step 2: Send WhatsApp notifications via Whapi (best-effort; failures are logged, not thrown)
  if (channel !== 'whatsapp_direct') {
    // Token comes from environment variables — never from localStorage
    const token = import.meta.env.VITE_WHAPI_TOKEN as string | undefined;
    if (!token) {
      errorLoggingService.logError(
        new Error('VITE_WHAPI_TOKEN is not set — Whapi notifications skipped'),
        { component: 'inquiryService', action: 'submitInquiry' }
      );
    } else {
      const adminPhone = import.meta.env.VITE_WHAPI_ADMIN_PHONE as string | undefined;
      const note = !hasPhone
        ? 'Recipient has no phone number on file.'
        : !senderInGroup
        ? 'Sender is not in the WhatsApp group.'
        : 'Recipient is not in the WhatsApp group.';

      const sends: Promise<void>[] = [];

      if (adminPhone) {
        const adminMsg = buildAdminBotMessage(
          senderName, senderPhone, senderCompany,
          recipientName, businessName, requirements, note
        );
        sends.push(sendWhapiMessage(adminPhone, adminMsg, token));
      }

      if (hasPhone) {
        const recipientMsg = buildRecipientBotMessage(
          recipientName, senderName, senderPhone, senderCompany, requirements
        );
        sends.push(sendWhapiMessage(recipientPhone, recipientMsg, token));
      }

      // Log Whapi failures without throwing — Firestore record already persisted
      await Promise.allSettled(sends).then(results => {
        results.forEach(r => {
          if (r.status === 'rejected') {
            errorLoggingService.logError(r.reason instanceof Error ? r.reason : new Error(String(r.reason)), { component: 'inquiryService', action: 'sendWhapiMessage' });
          }
        });
      });
    }
  }

  return { channel, waUrl };
}
