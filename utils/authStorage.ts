// SEC-A-002: Store only minimal bootstrap fields — never the full Member object.
// The full Member record is loaded from Firestore on app start (already cached by cacheService).
// Storing it here would expose PII (email, phone, IC, membership history) to any JS on the origin.
const AUTH_STORAGE_KEY = 'jci_auth_state';
const DEV_MODE_KEY = 'jci_dev_mode';

export interface StoredAuthState {
  isDevMode: boolean;
  user: {
    uid: string;
    email: string;
    displayName: string;
  };
  /** @deprecated Full member object is no longer persisted here. Pass null or omit. */
  member?: null;
}

/**
 * Save authentication state to localStorage
 */
export const saveAuthState = (state: StoredAuthState): void => {
  try {
    // Only persist the minimal bootstrap subset — never include the full Member object.
    const minimal: StoredAuthState = {
      isDevMode: state.isDevMode,
      user: { uid: state.user.uid, email: state.user.email, displayName: state.user.displayName },
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(minimal));
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

