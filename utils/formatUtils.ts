// Formatting Utility Functions
export const formatCurrency = (
  amount: number,
  currency: string = 'MYR',
  locale: string = 'en-MY'
): string => {
  // Handle invalid numbers
  const safeAmount = (amount === null || amount === undefined || isNaN(amount)) ? 0 : amount;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(safeAmount);
};

/**
 * Event price range ("From" label). MYR keeps the existing "RM 50 – 80" look; any other currency
 * (USD for external-chapter members: same number, display only) goes through formatCurrency.
 */
export const formatEventPrice = (min: number, max?: number | null, currency: string = 'MYR'): string => {
  const hasRange = max != null && max !== min;
  if (currency === 'MYR') return `RM ${min}${hasRange ? ` – ${max}` : ''}`;
  const one = (n: number) => formatCurrency(n, currency, 'en-US');
  return hasRange ? `${one(min)} – ${one(max as number)}` : one(min);
};

export const formatNumber = (num: number, decimals: number = 0): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

export const formatPercentage = (value: number, decimals: number = 1): string => {
  return `${value.toFixed(decimals)}%`;
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

export const capitalizeFirst = (text: string): string => {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

export const formatPhoneNumber = (phone: string): string => {
  // Simple phone formatting - can be enhanced
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

