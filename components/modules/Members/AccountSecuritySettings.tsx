import * as React from 'react';
import { useState } from 'react';
import { KeyRound, Mail } from 'lucide-react';
import { Button, Card, useToast } from '../../ui/Common';
import { Input } from '../../ui/Form';
import { useAuth } from '../../../hooks/useAuth';
import { MIN_PASSWORD_LENGTH } from '../../../utils/accountSecurity';

/**
 * Change password / change email on the member's own profile (Privacy & Security tab). The Firebase calls live in
 * useAuth (changePassword, requestEmailChange); the login email only changes after the user clicks the link sent to
 * the new address, and contact.email follows on their next sign-in / page load (netlify/functions/self-email).
 */
export const AccountSecuritySettings: React.FC<{ email: string }> = ({ email }) => {
  const { changePassword, requestEmailChange } = useAuth();
  const { showToast } = useToast();

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');

  const [em, setEm] = useState({ next: '', password: '' });
  const [emSaving, setEmSaving] = useState(false);
  const [emError, setEmError] = useState('');
  const [sentTo, setSentTo] = useState('');

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSaving(true);
    try {
      await changePassword(pw.current, pw.next, pw.confirm);
      setPw({ current: '', next: '', confirm: '' });
      showToast('Password updated', 'success');
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setPwSaving(false);
    }
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmError('');
    setEmSaving(true);
    try {
      await requestEmailChange(em.next, em.password);
      setSentTo(em.next.trim());
      setEm({ next: '', password: '' });
      showToast('Verification email sent', 'success');
    } catch (err) {
      setEmError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setEmSaving(false);
    }
  };

  return (
    <Card className="p-4">
      <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><KeyRound size={16} /> Sign-in details</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <form onSubmit={submitPassword} className="space-y-3" aria-label="Change password">
          <p className="text-sm font-medium text-slate-700">Change password</p>
          <Input type="password" label="Current password" autoComplete="current-password" value={pw.current}
            onChange={(e) => setPw(p => ({ ...p, current: e.target.value }))} />
          <Input type="password" label="New password" autoComplete="new-password" value={pw.next}
            helperText={`At least ${MIN_PASSWORD_LENGTH} characters.`}
            onChange={(e) => setPw(p => ({ ...p, next: e.target.value }))} />
          <Input type="password" label="Confirm new password" autoComplete="new-password" value={pw.confirm}
            onChange={(e) => setPw(p => ({ ...p, confirm: e.target.value }))} />
          {pwError && <p role="alert" className="text-xs text-red-600">{pwError}</p>}
          <div className="flex justify-end">
            <Button size="sm" type="submit" disabled={pwSaving}>{pwSaving ? 'Saving...' : 'Update password'}</Button>
          </div>
        </form>

        <form onSubmit={submitEmail} className="space-y-3" aria-label="Change email">
          <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><Mail size={14} /> Change email</p>
          <p className="text-xs text-slate-400 break-words">Current: {email || 'not set'}</p>
          <Input type="email" label="New email" autoComplete="email" value={em.next}
            onChange={(e) => setEm(p => ({ ...p, next: e.target.value }))} />
          <Input type="password" label="Current password" autoComplete="current-password" value={em.password}
            onChange={(e) => setEm(p => ({ ...p, password: e.target.value }))} />
          {emError && <p role="alert" className="text-xs text-red-600">{emError}</p>}
          {sentTo && (
            <p role="status" className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-2">
              We sent a verification link to {sentTo}. Your sign-in email changes once you click it; use your current email until then.
            </p>
          )}
          <div className="flex justify-end">
            <Button size="sm" type="submit" disabled={emSaving}>{emSaving ? 'Sending...' : 'Send verification email'}</Button>
          </div>
        </form>
      </div>
    </Card>
  );
};
