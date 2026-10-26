// Pure helpers for "Change password" / "Change email" on the member's own profile (hooks/useAuth does the Firebase calls).

export const MIN_PASSWORD_LENGTH = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns an error message, or null when the three password entries are acceptable. */
export function validatePasswordChange(current: string, next: string, confirm: string): string | null {
  if (!current) return 'Enter your current password.';
  if (next.length < MIN_PASSWORD_LENGTH) return `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (next !== confirm) return 'The new passwords do not match.';
  if (next === current) return 'The new password must be different from the current one.';
  return null;
}

/** Returns an error message, or null when `next` is an acceptable new login email. */
export function validateEmailChange(next: string, currentEmail: string, password: string): string | null {
  const email = next.trim();
  if (!EMAIL_RE.test(email)) return 'Enter a valid email address.';
  if (email.toLowerCase() === (currentEmail ?? '').trim().toLowerCase()) return 'This is already your email.';
  if (!password) return 'Enter your current password to confirm.';
  return null;
}

/** User-facing message for a Firebase Auth error code raised while reauthenticating / changing credentials. */
export function accountSecurityErrorMessage(code: string | undefined): string {
  switch (code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'Your current password is incorrect.';
    case 'auth/weak-password':
      return 'That password is too weak. Use a longer one with letters and numbers.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes and try again.';
    case 'auth/requires-recent-login':
      return 'For your security, please sign out, sign in again and retry.';
    case 'auth/email-already-in-use':
      return 'That email is already used by another account.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
