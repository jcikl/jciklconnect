// Authentication Storage Utilities
// Handles localStorage persistence for authentication state

const AUTH_STORAGE_KEY = 'jci_auth_state';
const DEV_MODE_KEY = 'jci_dev_mode';

export interface StoredAuthState {
  isDevMode: boolean;
  user: {
    uid: string;
    email: string;
    displayName: string;
  };
  member: {
    id: string;
    name: string;
    email: string;
    role: string;
    tier: string;
    points: number;
    joinDate: string;
    avatar: string;
    skills: string[];
    churnRisk: string;
    attendanceRate: number;
    duesStatus: string;
    badges: any[];
  };
}

/**
 * Save authentication state to localStorage
 */
export const saveAuthState = (state: StoredAuthState): void => {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem(DEV_MODE_KEY, state.isDevMode ? 'true' : 'false');
  } catch (error) {
    console.error('Error saving auth state to localStorage:', error);
  }
};

/**
 * Load authentication state from localStorage
 */
export const loadAuthState = (): StoredAuthState | null => {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;
    
    return JSON.parse(stored) as StoredAuthState;
  } catch (error) {
    console.error('Error loading auth state from localStorage:', error);
    return null;
  }
};

/**
 * Clear authentication state from localStorage
 */
export const clearAuthState = (): void => {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(DEV_MODE_KEY);
  } catch (error) {
    console.error('Error clearing auth state from localStorage:', error);
  }
};

/**
 * Check if dev mode is enabled in localStorage
 */
export const isDevModeStored = (): boolean => {
  try {
    return localStorage.getItem(DEV_MODE_KEY) === 'true';
  } catch (error) {
    return false;
  }
};

