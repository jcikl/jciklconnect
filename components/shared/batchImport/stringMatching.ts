/**
 * String Matching Utilities for Auto Column Header Detection
 * Implements Levenshtein distance algorithm for fuzzy matching
 */

import { FieldDefinition, ColumnMapping, AutoMatchResult } from './batchImportTypes';

/**
 * Calculate Levenshtein distance between two strings
 * Returns a number representing the minimum edits needed to transform one string into another
 */
const levenshteinDistance = (str1: string, str2: string): number => {
  const track = Array(str2.length + 1)
    .fill(null)
    .map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i += 1) {
    track[0][i] = i;
  }
  for (let j = 0; j <= str2.length; j += 1) {
    track[j][0] = j;
  }

  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator
      );
    }
  }

  return track[str2.length][str1.length];
};

/**
 * Calculate similarity score between two strings (0-1)
 * Based on Levenshtein distance
 */
export const calculateSimilarity = (str1: string, str2: string): number => {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) {
    return 1;
  }

  const editDistance = levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
  return (longer.length - editDistance) / longer.length;
};

/**
 * Normalize header name for matching
 * - Convert to lowercase
 * - Remove special characters and spaces
 * - Remove common prefixes/suffixes
 */
export const normalizeHeaderName = (header: string): string => {
  return header
    .toLowerCase()
    .trim()
    // Remove special characters, keep only alphanumeric and spaces
    .replace(/[^\w\s]/g, '')
    // Remove common prefixes
    .replace(/^(the|a|an)\s+/, '')
    // Remove common suffixes
    .replace(/\s+(number|no|num|date|time|info|information)$/, '')
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Find the best matching field for a CSV header
 */
const findBestMatch = (
  csvHeader: string,
  fields: FieldDefinition[],
  threshold: number
): { fieldKey: string; similarity: number; alias: string } | null => {
  const normalizedCsvHeader = normalizeHeaderName(csvHeader);
  let bestMatch = null;
  let bestSimilarity = 0;

  for (const field of fields) {
    // Check exact match first (case-insensitive)
    const fieldLower = field.label.toLowerCase();
    const keyLower = field.key.toLowerCase();

    if (normalizedCsvHeader === fieldLower || normalizedCsvHeader === keyLower) {
      return {
        fieldKey: field.key,
        similarity: 1,
        alias: field.label,
      };
    }

    // Check aliases
    if (field.aliases) {
      for (const alias of field.aliases) {
        const normalizedAlias = normalizeHeaderName(alias);
        const similarity = calculateSimilarity(normalizedCsvHeader, normalizedAlias);

        if (similarity > bestSimilarity && similarity >= threshold) {
          bestSimilarity = similarity;
          bestMatch = {
            fieldKey: field.key,
            similarity,
            alias,
          };
        }
      }
    }

    // Check field label and key
    const labelSimilarity = calculateSimilarity(normalizedCsvHeader, normalizeHeaderName(field.label));
    const keySimilarity = calculateSimilarity(normalizedCsvHeader, normalizeHeaderName(field.key));

    const maxSimilarity = Math.max(labelSimilarity, keySimilarity);
    if (maxSimilarity > bestSimilarity && maxSimilarity >= threshold) {
      bestSimilarity = maxSimilarity;
      bestMatch = {
        fieldKey: field.key,
        similarity: maxSimilarity,
        alias: field.label,
      };
    }
  }

  return bestMatch;
};

/**
 * Auto-match CSV headers to field definitions
 * Returns column mapping and match details
 */
export const autoMapColumns = (
  csvHeaders: string[],
  fields: FieldDefinition[],
  threshold: number = 0.85
): AutoMatchResult => {
  const columnMapping: ColumnMapping = {};
  const matches: AutoMatchResult['matches'] = {};
  const unmatchedRequired: string[] = [];
  const usedFieldKeys = new Set<string>();

  // Try to match each CSV header
  for (let csvIndex = 0; csvIndex < csvHeaders.length; csvIndex += 1) {
    const csvHeader = csvHeaders[csvIndex];
    const match = findBestMatch(csvHeader, fields, threshold);

    if (match && !usedFieldKeys.has(match.fieldKey)) {
      columnMapping[match.fieldKey] = csvIndex;
      usedFieldKeys.add(match.fieldKey);
      matches[match.fieldKey] = {
        csvHeaderIndex: csvIndex,
        csvHeaderName: csvHeader,
        matchedAlias: match.alias,
        similarity: match.similarity,
        isAutoMatched: true,
      };
    }
  }

  // Check for unmatched required fields
  for (const field of fields) {
    if (field.required && !usedFieldKeys.has(field.key)) {
      unmatchedRequired.push(field.key);
      // Add entry for unmatched field
      matches[field.key] = {
        csvHeaderIndex: -1,
        csvHeaderName: '',
        matchedAlias: '',
        similarity: 0,
        isAutoMatched: false,
      };
    }
  }

  return {
    columnMapping,
    matches,
    allRequired: unmatchedRequired.length === 0,
    unmatchedRequired,
  };
};

/**
 * Validate and update column mapping
 * Ensures no duplicate field assignments
 */
export const validateColumnMapping = (
  columnMapping: ColumnMapping,
  csvHeaderCount: number
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const usedColumns = new Set<number>();

  for (const [fieldKey, csvIndex] of Object.entries(columnMapping)) {
    // Check if column index is in valid range
    if (csvIndex < 0 || csvIndex >= csvHeaderCount) {
      errors.push(`Field "${fieldKey}" points to invalid column index ${csvIndex}`);
    }

    // Check for duplicate assignments
    if (usedColumns.has(csvIndex)) {
      errors.push(`Column ${csvIndex} is assigned to multiple fields`);
    }
    usedColumns.add(csvIndex);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};
