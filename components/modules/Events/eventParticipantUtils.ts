import type { Member } from '../../../types';

export const getMemberInitials = (name: string) => {
  const parts = (name ?? '').trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (parts[0] ?? '?').slice(0, 2).toUpperCase();
};

export const getInitialsColor = (id: string) => {
  const palette = [
    'bg-blue-100 text-blue-700',
    'bg-violet-100 text-violet-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
  ];
  return palette[(id ?? '').charCodeAt(0) % palette.length];
};

export const getMemberAvatar = (member: Member) => member.general?.avatarUrl ?? undefined;
