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

