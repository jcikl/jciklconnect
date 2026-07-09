import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { Inquiry } from '../types';

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
  senderCompany: string | undefined,
  requirements: string
): string {
  const intro = senderCompany
    ? `I am ${senderName} from ${senderCompany}, a JCI Kuala Lumpur member.`
    : `I am ${senderName}, a JCI Kuala Lumpur member.`;
  return (
    `Hi! \u{1F44B}\n\n` +
    `${intro}\n\n` +
    `I found your business profile on JCI KL Connect and would love to connect.\n\n` +
    `\u{1F4CB} My inquiry:\n${requirements}\n\n` +
    `Looking forward to hearing from you! \u{1F91D}`
  );
}

function buildRecipientBotMessage(
  recipientName: string,
  senderName: string,
  senderPhone: string,
  senderCompany: string | undefined,
  requirements: string
): string {
  const companyLine = senderCompany ? `\u{1F3E2} Company: ${senderCompany}\n` : '';
  return (
    `Hi ${recipientName}! \u{1F44B}\n\n` +
    `A JCI KL member has reached out to you via *JCI KL Connect*:\n\n` +
    `\u{1F464} Name: ${senderName}\n` +
    `${companyLine}` +
    `\u{1F4DE} Contact: ${senderPhone}\n\n` +
    `\u{1F4AC} Inquiry:\n${requirements}\n\n` +
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
  const companyLine = senderCompany ? `\u{1F3E2} ${senderCompany}\n` : '';
  return (
    `\u{1F4CB} *New Business Inquiry — JCI KL Connect*\n\n` +
    `*From (Sender):*\n` +
    `\u{1F464} ${senderName}\n` +
    `${companyLine}` +
    `\u{1F4DE} ${senderPhone}\n\n` +
    `*To (Recipient):*\n` +
    `\u{1F464} ${recipientName} — ${businessName}\n\n` +
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
  const {
    senderId, senderName, senderPhone, senderCompany, senderInGroup,
    recipientId, recipientName, recipientPhone, recipientInGroup,
    businessId, businessName, requirements,
  } = params;

  const bothInGroup = senderInGroup && recipientInGroup;
  const hasPhone = !!recipientPhone;

  let channel: Inquiry['channel'];
  let waUrl: string | undefined;

  if (bothInGroup && hasPhone) {
    // Case A: both in group — direct WhatsApp redirect
    channel = 'whatsapp_direct';
    const msg = buildDirectMessage(senderName, senderCompany, requirements);
    waUrl = `https://api.whatsapp.com/send?phone=${waPhone(recipientPhone)}&text=${encodeURIComponent(msg)}`;
  } else {
    // Case B: at least one party not in group, OR recipient has no phone
    // → send via Whapi to admin + recipient
    channel = hasPhone ? 'whapi_bot' : 'no_phone';

    const token = localStorage.getItem('whapi_config_key');
    if (!token) throw new Error('Whapi token not configured');

    const adminPhone = localStorage.getItem('whapi_admin_phone');
    const note = !hasPhone
      ? 'Recipient has no phone number on file.'
      : !senderInGroup
      ? 'Sender is not in the WhatsApp group.'
      : 'Recipient is not in the WhatsApp group.';

    const sends: Promise<void>[] = [];

    // Notify admin
    if (adminPhone) {
      const adminMsg = buildAdminBotMessage(
        senderName, senderPhone, senderCompany,
        recipientName, businessName, requirements, note
      );
      sends.push(sendWhapiMessage(adminPhone, adminMsg, token));
    }

    // Notify recipient (if they have a phone)
    if (hasPhone) {
      const recipientMsg = buildRecipientBotMessage(
        recipientName, senderName, senderPhone, senderCompany, requirements
      );
      sends.push(sendWhapiMessage(recipientPhone, recipientMsg, token));
    }

    await Promise.all(sends);
  }

  // Write to Firestore regardless of channel
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

  return { channel, waUrl };
}
