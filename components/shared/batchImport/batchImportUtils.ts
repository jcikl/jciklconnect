/**
 * Batch Import Utilities for Data Preprocessing
 */

import { FieldDefinition } from './batchImportTypes';

/**
 * Preprocess a single row using field definitions
 * Applies preprocessor functions and handles type conversions
 */
export const preprocessRow = (
  rawRow: Record<string, any>,
  fields: FieldDefinition[],
  columnMapping: Record<string, number>,
  isArrayRow: (string | any)[] | false = false
): Partial<any> => {
  const processed: Partial<any> = {};

  for (const field of fields) {
    const columnIndex = columnMapping[field.key];
    let rawValue: any;

    // Extract value based on row format (array or object)
    if (isArrayRow && Array.isArray(isArrayRow)) {
      rawValue = isArrayRow[columnIndex]?.trim?.() || '';
    } else {
      // For CSV: object format, find the column by header
      // This is handled at parent level - here we assume columnIndex is valid
      rawValue = rawRow[field.key];
    }

    // Apply preprocessor if defined
    if (field.preprocessor && rawValue !== undefined && rawValue !== null && rawValue !== '') {
      try {
        processed[field.key] = field.preprocessor(rawValue);
      } catch (err) {
        // If preprocessor fails, keep raw value
        processed[field.key] = rawValue;
      }
    } else {
      // Use default value or raw value
      processed[field.key] = rawValue || field.defaultValue;
    }
  }

  return processed;
};

/**
 * Generic preprocessor: trim whitespace
 */
export const trimPreprocessor = (value: any): any => {
  if (typeof value === 'string') {
    return value.trim();
  }
  return value;
};

/**
 * Generic preprocessor: trim and convert to lowercase
 */
export const trimLowerPreprocessor = (value: any): any => {
  if (typeof value === 'string') {
    return value.trim().toLowerCase();
  }
  return value;
};

/**
 * Generic preprocessor: trim and convert to uppercase
 */
export const trimUpperPreprocessor = (value: any): any => {
  if (typeof value === 'string') {
    return value.trim().toUpperCase();
  }
  return value;
};

/**
 * Generic preprocessor: convert to number
 */
export const toNumberPreprocessor = (value: any): number => {
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
};

/**
 * Generic preprocessor: remove all whitespace
 */
export const removeWhitespacePreprocessor = (value: any): any => {
  if (typeof value === 'string') {
    return value.replace(/\s/g, '');
  }
  return value;
};

/**
 * Generic preprocessor: split comma-separated values into array
 */
export const splitCommaPreprocessor = (value: any): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value)
    .split(',')
    .map(item => item.trim())
    .filter(item => item.length > 0);
};

/**
 * Generic preprocessor: format phone number (remove special chars except +-)
 */
export const formatPhonePreprocessor = (value: any): string => {
  if (typeof value !== 'string') return '';
  return value.replace(/[^\d+\-]/g, '');
};

/**
 * Create a custom preprocessor that applies multiple functions in sequence
 */
export const createChainedPreprocessor = (...processors: Array<(v: any) => any>) => {
  return (value: any): any => {
    let result = value;
    for (const processor of processors) {
      result = processor(result);
    }
    return result;
  };
};

/**
 * Create a custom preprocessor that provides default value if empty
 */
export const createDefaultPreprocessor = (defaultValue: any) => {
  return (value: any): any => {
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return defaultValue;
    }
    return value;
  };
};

/**
 * Parse various date formats to YYYY-MM-DD standard format
 * Supports: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, DD-MM-YYYY, and named months
 */
export const parseDatePreprocessor = (dateStr: any): string => {
  if (!dateStr) return '';

  const trim = String(dateStr).trim();

  // Already in correct format
  if (/^\d{4}-\d{2}-\d{2}$/.test(trim)) {
    return trim;
  }

  const monthMap: { [key: string]: string } = {
    'jan': '01', 'january': '01', '1月': '01',
    'feb': '02', 'february': '02', '2月': '02',
    'mar': '03', 'march': '03', '3月': '03',
    'apr': '04', 'april': '04', '4月': '04',
    'may': '05', '5月': '05',
    'jun': '06', 'june': '06', '6月': '06',
    'jul': '07', 'july': '07', '7月': '07',
    'aug': '08', 'august': '08', '8月': '08',
    'sep': '09', 'september': '09', '9月': '09',
    'oct': '10', 'october': '10', '10月': '10',
    'nov': '11', 'november': '11', '11月': '11',
    'dec': '12', 'december': '12', '12月': '12',
  };

  // Format: compact YYYYMMDD
  if (/^\d{8}$/.test(trim)) {
    return `${trim.substring(0, 4)}-${trim.substring(4, 6)}-${trim.substring(6, 8)}`;
  }

  // Format: YYYY/MM/DD or YYYY.MM.DD
  if (/^\d{4}[\/\.]\d{2}[\/\.]\d{2}$/.test(trim)) {
    return trim.replace(/[\/\.]/g, '-');
  }

  // Format: MM/DD/YYYY or DD/MM/YYYY or DD.MM.YYYY
  const match1 = trim.match(/^(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{4})$/);
  if (match1) {
    const [, part1, part2, year] = match1;
    const p1 = parseInt(part1, 10);
    const p2 = parseInt(part2, 10);
    if (p1 > 12) {
      return `${year}-${part2.padStart(2, '0')}-${part1.padStart(2, '0')}`;
    } else if (p2 > 12) {
      return `${year}-${part1.padStart(2, '0')}-${part2.padStart(2, '0')}`;
    }
    return `${year}-${part1.padStart(2, '0')}-${part2.padStart(2, '0')}`;
  }

  // Format: MM-DD-YYYY or DD-MM-YYYY
  const match2 = trim.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (match2) {
    const [, part1, part2, year] = match2;
    const p1 = parseInt(part1, 10);
    const p2 = parseInt(part2, 10);
    if (p1 > 12) {
      return `${year}-${part2.padStart(2, '0')}-${part1.padStart(2, '0')}`;
    } else if (p2 > 12) {
      return `${year}-${part1.padStart(2, '0')}-${part2.padStart(2, '0')}`;
    }
    return `${year}-${part1.padStart(2, '0')}-${part2.padStart(2, '0')}`;
  }

  // Format: DD MMM YYYY or DD-MMM-YYYY (e.g., "19 Feb 2026" or "19-Feb-2026")
  const match3 = trim.match(/^(\d{1,2})[\s-]([a-zA-Z]+)[\s-](\d{4})$/);
  if (match3) {
    const [, day, month, year] = match3;
    const monthNum = monthMap[month.toLowerCase()] || '';
    if (monthNum) {
      return `${year}-${monthNum}-${day.padStart(2, '0')}`;
    }
  }

  // Format: MMM DD, YYYY or MMM-DD-YYYY (e.g., "Feb 19, 2026" or "Feb-19-2026")
  const match4 = trim.match(/^([a-zA-Z]+)[\s-](\d{1,2}),?[\s-](\d{4})$/);
  if (match4) {
    const [, month, day, year] = match4;
    const monthNum = monthMap[month.toLowerCase()] || '';
    if (monthNum) {
      return `${year}-${monthNum}-${day.padStart(2, '0')}`;
    }
  }

  // Return as-is if no format matches
  return trim;
};
