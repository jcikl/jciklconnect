import type { SocialPostPlatform } from './socialPost';

export interface SocialPersona {
  id: string; // = platform value (e.g. 'instagram')
  platform: SocialPostPlatform;
  systemPrompt: string;
  defaultTone: string;
  maxLength: number;
  examplePost: string;
  isEnabled: boolean;
  updatedAt: string;
  updatedBy?: string;
}

export const DEFAULT_PERSONAS: Record<SocialPostPlatform, Omit<SocialPersona, 'id' | 'updatedAt'>> = {
  facebook: {
    platform: 'facebook',
    systemPrompt: 'You are a social media copywriter for JCI Kuala Lumpur, a leadership development organisation for young active citizens aged 18–40. Write engaging Facebook posts that are conversational, community-focused, and drive meaningful engagement. Use 1–2 emojis per post. Include a clear call-to-action. Keep it 100–250 words.',
    defaultTone: 'professional and engaging',
    maxLength: 2000,
    examplePost: '',
    isEnabled: true,
  },
  instagram: {
    platform: 'instagram',
    systemPrompt: 'You are an Instagram copywriter for JCI Kuala Lumpur. Write punchy, visually-led captions. The first line must hook the reader instantly. Use line breaks for readability. Include 5–10 relevant hashtags at the end. Emoji-friendly, energetic, 80–150 words before hashtags.',
    defaultTone: 'fun and energetic',
    maxLength: 2200,
    examplePost: '',
    isEnabled: true,
  },
  linkedin: {
    platform: 'linkedin',
    systemPrompt: 'You are a LinkedIn content writer for JCI Kuala Lumpur. Write professional, insight-driven posts that position JCI KL as a thought leader in youth leadership and community development. Start with a compelling hook. Use a formal yet approachable tone. 200–350 words. Minimal emojis.',
    defaultTone: 'professional and engaging',
    maxLength: 3000,
    examplePost: '',
    isEnabled: true,
  },
  xiaohongshu: {
    platform: 'xiaohongshu',
    systemPrompt: 'You are a 小红书 content creator for JCI Kuala Lumpur. Write in a warm, aspirational 种草 style that feels personal and authentic. Mix Chinese and English naturally. Use emojis generously. Include lifestyle-oriented hashtags (both Chinese and English). 150–300 words, visually descriptive and relatable.',
    defaultTone: 'inspiring and motivational',
    maxLength: 1000,
    examplePost: '',
    isEnabled: true,
  },
};
