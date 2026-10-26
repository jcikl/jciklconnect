import { describe, it, expect } from 'vitest';
import { validatePasswordChange, validateEmailChange, accountSecurityErrorMessage, MIN_PASSWORD_LENGTH } from '../../utils/accountSecurity';

describe('validatePasswordChange', () => {
  it('requires the current password', () => {
    expect(validatePasswordChange('', 'abcdefgh1', 'abcdefgh1')).toMatch(/current password/i);
  });
  it('requires a minimum length', () => {
    expect(validatePasswordChange('old', 'a'.repeat(MIN_PASSWORD_LENGTH - 1), 'a'.repeat(MIN_PASSWORD_LENGTH - 1))).toMatch(/at least/);
  });
  it('requires the two new entries to match', () => {
    expect(validatePasswordChange('old', 'abcdefgh1', 'abcdefgh2')).toMatch(/do not match/);
  });
  it('rejects reusing the current password', () => {
    expect(validatePasswordChange('abcdefgh1', 'abcdefgh1', 'abcdefgh1')).toMatch(/different/);
  });
  it('accepts a valid change', () => {
    expect(validatePasswordChange('old-pass', 'abcdefgh1', 'abcdefgh1')).toBeNull();
  });
});

describe('validateEmailChange', () => {
  it('rejects an invalid address, the same address (any case) and a missing password', () => {
    expect(validateEmailChange('nope', 'a@b.co', 'pw')).toMatch(/valid email/);
    expect(validateEmailChange(' A@B.co ', 'a@b.co', 'pw')).toMatch(/already your email/);
    expect(validateEmailChange('new@b.co', 'a@b.co', '')).toMatch(/password/);
  });
  it('accepts a new address with a password', () => {
    expect(validateEmailChange('new@b.co', 'a@b.co', 'pw')).toBeNull();
  });
});

describe('accountSecurityErrorMessage', () => {
  it('maps the Firebase codes the owner asked for', () => {
    expect(accountSecurityErrorMessage('auth/wrong-password')).toMatch(/incorrect/);
    expect(accountSecurityErrorMessage('auth/invalid-credential')).toMatch(/incorrect/);
    expect(accountSecurityErrorMessage('auth/weak-password')).toMatch(/too weak/);
    expect(accountSecurityErrorMessage('auth/too-many-requests')).toMatch(/Too many/);
    expect(accountSecurityErrorMessage('auth/requires-recent-login')).toMatch(/sign in again/);
    expect(accountSecurityErrorMessage(undefined)).toMatch(/went wrong/);
  });
});
