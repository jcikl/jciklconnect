/**
 * Shared Validation Functions for Batch Import
 * Used by both Finance and Members modules
 */

/**
 * Validate non-empty string
 */
export const notEmpty = (value: any): string | null => {
  if (value === 0) return null; // 0 is a valid value
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return 'Value cannot be empty';
  }
  return null;
};

/**
 * Validate email format
 */
export const isValidEmail = (email: string): string | null => {
  if (!email) return null; // Optional field
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return `Invalid email format: "${email}"`;
  }
  return null;
};

/**
 * Validate date format (YYYY-MM-DD)
 */
export const isValidDate = (dateStr: string): string | null => {
  if (!dateStr) return null; // Optional field
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return `Invalid date format: "${dateStr}" (use YYYY-MM-DD)`;
  const date = new Date(dateStr);
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return `Invalid date: "${dateStr}"`;
  }
  return null;
};

/**
 * Validate numeric amount (can be decimal)
 */
export const isValidAmount = (value: any): string | null => {
  if (!value) return null; // Optional field
  const num = parseFloat(value);
  if (isNaN(num) || num < 0) {
    return `Invalid amount: "${value}" (must be a positive number)`;
  }
  return null;
};

/**
 * Validate tier (MemberTier enum)
 */
export const isValidTier = (tier: string): string | null => {
  if (!tier) return null; // Optional field
  const validTiers = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
  if (!validTiers.includes(tier)) {
    return `Invalid tier: "${tier}" (must be: ${validTiers.join(', ')})`;
  }
  return null;
};

/**
 * Validate gender
 */
export const isValidGender = (gender: string): string | null => {
  if (!gender) return null; // Optional field
  const validGenders = ['MALE', 'FEMALE', 'Male', 'Female', 'male', 'female', 'M', 'F', 'm', 'f'];
  if (!validGenders.includes(gender)) {
    return `Invalid gender: "${gender}" (must be: ${validGenders.join(', ')})`;
  }
  return null;
};

/**
 * Validate phone number (basic format check)
 */
export const isValidPhone = (phone: string): string | null => {
  if (!phone) return null; // Optional field
  const phoneRegex = /^[0-9+\-\s()]+$/;
  if (!phoneRegex.test(phone)) {
    return `Invalid phone format: "${phone}"`;
  }
  return null;
};

/**
 * Create a custom validator for specific values
 */
export const createEnumValidator = (fieldName: string, validValues: string[]) => {
  return (value: any): string | null => {
    if (!value) return null; // Optional field
    if (!validValues.includes(value)) {
      return `Invalid ${fieldName}: "${value}" (must be: ${validValues.join(', ')})`;
    }
    return null;
  };
};

/**
 * Create a custom length validator
 */
export const createLengthValidator = (minLength: number, maxLength?: number) => {
  return (value: any): string | null => {
    if (!value) return null;
    const str = String(value);
    if (str.length < minLength) {
      return `Must be at least ${minLength} characters`;
    }
    if (maxLength && str.length > maxLength) {
      return `Must not exceed ${maxLength} characters`;
    }
    return null;
  };
};

/**
 * Batch validate a row against multiple validators
 */
export const validateField = (
  value: any,
  validators?: ((value: any, context?: any) => string | null)[],
  context?: any
): string[] => {
  if (!validators || validators.length === 0) {
    return [];
  }

  const errors: string[] = [];
  for (const validator of validators) {
    const error = validator(value, context);
    if (error) {
      errors.push(error);
    }
  }
  return errors;
};
