// Date Utility Functions
import { Timestamp } from 'firebase/firestore';

// Helper function to convert Date | Timestamp | string to Date
export const toDate = (date: string | Date | Timestamp | undefined | null): Date => {
  if (!date) return new Date();
  if (date instanceof Date) return date;
  if (typeof date === 'string') return new Date(date);
  // Timestamp type
  if (date && typeof date === 'object' && 'toDate' in date) {
    return (date as Timestamp).toDate();
  }
  return new Date();
};

export const formatDate = (date: string | Date | undefined | null): string => {
  if (!date) return 'N/A';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Invalid Date';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Kuala_Lumpur',
  });
};

/**
 * Format a date string or Date object to "DD MMM YYYY" format (e.g., 01 Jan 1990)
 * @param date Value to format
 * @returns Formatted date string or original value if invalid
 */
export const formatDateToDDMMMYYYY = (date: any): string => {
  if (!date) return '—';

  // Handle Firestore Timestamp objects ({ seconds, nanoseconds } or with .toDate())
  let d: Date;
  if (date instanceof Timestamp) {
    d = date.toDate();
  } else if (typeof date === 'object' && 'seconds' in date) {
    d = typeof date.toDate === 'function' ? date.toDate() : new Date(date.seconds * 1000);
  } else {
    d = new Date(date);
  }

  // Check if date is valid
  if (isNaN(d.getTime())) {
    return String(date);
  }

  // Use MYT timezone like all other date functions in this file
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kuala_Lumpur',
  }).formatToParts(d);
  const day = parts.find(p => p.type === 'day')?.value ?? '01';
  const month = parts.find(p => p.type === 'month')?.value ?? 'Jan';
  const year = parts.find(p => p.type === 'year')?.value ?? '2024';

  return `${day} ${month} ${year}`;
};

export const formatDateTime = (date: string | Date | null | undefined): string => {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kuala_Lumpur',
  });
};

export const formatTime = (date: string | Date | null | undefined): string => {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kuala_Lumpur',
  });
};

export const getRelativeTime = (date: string | Date | null | undefined): string => {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  
  return formatDate(d);
};

export const formatRelativeTime = getRelativeTime;

export const isToday = (date: string | Date): boolean => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = nowMYT();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
};

export const isPast = (date: string | Date): boolean => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.getTime() < nowMYT().getTime();
};

export const isFuture = (date: string | Date): boolean => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.getTime() > nowMYT().getTime();
};

export const getCalendarYear = (date?: Date): number => {
  return (date || nowMYT()).getFullYear();
};

// ─── Malaysia Time (MYT = UTC+8) helpers ────────────────────────────────────

/** Return the current wall-clock time in Malaysia (UTC+8). */
export const nowMYT = (): Date =>
  new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));

/** Return the current year in Malaysia time (safe even at Dec 31 16:00–23:59 UTC). */
export const getMYTYear = (): number => nowMYT().getFullYear();

/**
 * Parse a date-only string (YYYY-MM-DD) as midnight MYT (UTC+8).
 * JS's native `new Date('2024-12-31')` treats it as midnight UTC, which is
 * 08:00 MYT — causing events to appear "upcoming" until 8 AM on their day.
 */
export const parseMYTDate = (dateStr: string): Date =>
  new Date(dateStr + 'T00:00:00+08:00');

/**
 * Return today's date string in Malaysia time as "YYYY-MM-DD".
 * Use this when you only need to compare MM-DD slices for birthday checks.
 */
export const getMYTTodayStr = (): string => {
  const myt = nowMYT();
  const y = myt.getFullYear();
  const m = String(myt.getMonth() + 1).padStart(2, '0');
  const d = String(myt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getStartOfYear = (year?: number): Date => {
  const y = year || getMYTYear();
  // 1 Jan 00:00 MYT (UTC+8) expressed as a fixed-offset ISO string — avoids
  // local-time ambiguity on machines outside Malaysia.
  return new Date(`${y}-01-01T00:00:00+08:00`);
};

export const getEndOfYear = (year?: number): Date => {
  const y = year || getMYTYear();
  // 31 Dec 23:59:59.999 MYT (UTC+8)
  return new Date(`${y}-12-31T23:59:59.999+08:00`);
};

