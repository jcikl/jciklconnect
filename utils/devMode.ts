// Developer Mode Utility
// This utility helps services detect if the app is running in developer mode
// and return mock data instead of accessing Firestore
import { isDevModeStored } from './authStorage';

let devModeState = false;

export const setDevMode = (enabled: boolean) => {
  devModeState = enabled;
};

export const isDevMode = (): boolean => {
  // Check both in-memory state and localStorage
  return devModeState || isDevModeStored();
};

// Alias for consistency
export const checkDevMode = isDevMode;

/**
 * Service helper: returns mock data in dev mode, calls the real async loader in production.
 * Eliminates the repetitive `if (isDevMode()) return MOCK_X` pattern across all services.
 *
 * Usage:
 *   static async getAllMembers() {
 *     return withDevMode(() => MOCK_MEMBERS, () => fetchFromFirestore());
 *   }
 */
export async function withDevMode<T>(
  mockFn: () => T | Promise<T>,
  realFn: () => Promise<T>
): Promise<T> {
  if (isDevMode()) return Promise.resolve(mockFn());
  return realFn();
}
