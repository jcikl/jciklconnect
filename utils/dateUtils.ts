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
  });
};

/**
 * Format a date string or Date object to "DD MMM YYYY" format (e.g., 01 Jan 1990)
 * @param date Value to format
 * @returns Formatted date string or original value if invalid
 */
export const formatDateToDDMMMYYYY = (date: any): string => {
  if (!date) return '—';
  
  const d = new Date(date);
  
  // Check if date is valid
  if (isNaN(d.getTime())) {
    return String(date);
  }
  
  const day = d.getDate().toString().padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  
  return `${day} ${month} ${year}`;
};

export const formatDateTime = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatTime = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getRelativeTime = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
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
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
};

export const isPast = (date: string | Date): boolean => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.getTime() < new Date().getTime();
};

export const isFuture = (date: string | Date): boolean => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.getTime() > new Date().getTime();
};

export const getCalendarYear = (date?: Date): number => {
  return (date || new Date()).getFullYear();
};

export const getStartOfYear = (year?: number): Date => {
  const y = year || new Date().getFullYear();
  return new Date(y, 0, 1);
};

export const getEndOfYear = (year?: number): Date => {
  const y = year || new Date().getFullYear();
  return new Date(y, 11, 31, 23, 59, 59, 999);
};

