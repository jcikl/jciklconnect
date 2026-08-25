import React from 'react';
import { Facebook, Megaphone, Share2 } from 'lucide-react';
import type { SocialPostPlatform, SocialPostStatus } from '../../../types/socialPost';

export const STATUS_COLORS: Record<SocialPostStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  pending_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  scheduled: 'bg-purple-100 text-purple-700',
  published: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export const PLATFORM_ICONS: Record<SocialPostPlatform, React.ReactNode> = {
  facebook: <Facebook size={13} />,
  instagram: <Megaphone size={13} />,
  linkedin: <Share2 size={13} />,
  xiaohongshu: <span className="text-[10px] font-black">红</span>,
};

export function formatSocialDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatSocialDateTime(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' });
}
