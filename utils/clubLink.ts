import type { HobbyClub } from '../types';

/**
 * The club's group chat link (WhatsApp / LINE / Discord / Telegram …) that "Join" opens,
 * or null when none is set or it is not an http(s) URL (blocks javascript: and similar).
 */
export const getClubGroupLink = (club: Pick<HobbyClub, 'whatsappUrl'>): string | null => {
  const raw = club.whatsappUrl?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
};
