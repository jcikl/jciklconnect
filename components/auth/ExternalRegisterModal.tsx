// External self-registration (Phase 1 WP-3): members of another JCI chapter apply for an account.
// Creates an AFFILIATE doc with affiliation.status 'pending_chapter'; the chapter admin approves, then JCI KL.
import React, { useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Modal, Button, useToast } from '../ui/Common';
import { Input, Select, Checkbox } from '../ui/Form';
import { useAuth } from '../../hooks/useAuth';
import { useSisterChapters } from '../../hooks/useSisterChapters';

interface ExternalRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin?: () => void;
}

const EMPTY = {
  loId: '', name: '', fullName: '', email: '', phone: '', gender: '', dob: '',
  password: '', confirmPassword: '', agree: false,
};

export const ExternalRegisterModal: React.FC<ExternalRegisterModalProps> = ({ isOpen, onClose, onSwitchToLogin }) => {
  const { signUpExternal } = useAuth();
  const { chapters, loading: chaptersLoading } = useSisterChapters();
  const { showToast } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const activeChapters = useMemo(() => chapters.filter(c => c.isActive), [chapters]);
  const chapter = activeChapters.find(c => c.id === form.loId);
  const patch = (key: keyof typeof EMPTY, value: string | boolean) => setForm(prev => ({ ...prev, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!chapter) return setError('Please choose your chapter');
    if (!form.name.trim() || !form.email.trim()) return setError('Name and email are required');
    if (form.password.length < 6) return setError('Password must be at least 6 characters');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match');
    if (!form.agree) return setError('Please agree to the Code of Ethics and Privacy Policy');
    setSaving(true);
    try {
      await signUpExternal(form.password, {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        loId: chapter.id,
        chapter: { country: chapter.country, type: chapter.type },
        fullName: form.fullName,
        gender: form.gender || undefined,
        dob: form.dob || undefined,
        phone: form.phone,
      });
      showToast(`Request sent. ${chapter.name} will review it, then JCI KL.`, 'success');
      setForm(EMPTY);
      onClose();
    } catch (err: any) {
      const code = err?.code || '';
      const message = code === 'auth/email-already-in-use'
        ? 'This email already has an account. Please sign in instead.'
        : code === 'auth/weak-password'
        ? 'Password must be at least 6 characters'
        : code === 'auth/network-request-failed'
        ? 'Network error. Please check your connection and try again.'
        : err?.message || 'Registration failed. Please try again.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Join from another JCI chapter"
      size="md"
      footer={
        <div className="flex gap-3 justify-end w-full">
          <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="external-register-form" disabled={saving} isLoading={saving}>Send request</Button>
        </div>
      }
    >
      <form id="external-register-form" onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          For members of JCI chapters partnered with JCI Kuala Lumpur. Your chapter administrator approves your request first, then JCI KL.
        </p>
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}
        <Select
          label="Your chapter *"
          value={form.loId}
          onChange={e => patch('loId', e.target.value)}
          options={[
            { label: chaptersLoading ? 'Loading chapters…' : 'Choose your chapter', value: '' },
            ...activeChapters.map(c => ({ label: `${c.flagEmoji ? `${c.flagEmoji} ` : ''}${c.name} (${c.country})`, value: c.id })),
          ]}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Name (as you are called) *" value={form.name} onChange={e => patch('name', e.target.value)} />
          <Input label="Full name" value={form.fullName} onChange={e => patch('fullName', e.target.value)} />
          <Input label="Email *" type="email" value={form.email} onChange={e => patch('email', e.target.value)} autoComplete="email" />
          <Input label="Phone" type="tel" value={form.phone} onChange={e => patch('phone', e.target.value)} />
          <Select
            label="Gender"
            value={form.gender}
            onChange={e => patch('gender', e.target.value)}
            options={[{ label: 'Prefer not to say', value: '' }, { label: 'Male', value: 'Male' }, { label: 'Female', value: 'Female' }]}
          />
          <Input label="Date of birth (optional)" type="date" value={form.dob} onChange={e => patch('dob', e.target.value)} />
          <Input label="Password *" type="password" value={form.password} onChange={e => patch('password', e.target.value)} autoComplete="new-password" />
          <Input label="Confirm password *" type="password" value={form.confirmPassword} onChange={e => patch('confirmPassword', e.target.value)} autoComplete="new-password" />
        </div>
        <Checkbox
          label="I agree to the JCI Code of Ethics and the Privacy Policy"
          checked={form.agree}
          onChange={e => patch('agree', e.target.checked)}
        />
        {onSwitchToLogin && (
          <p className="text-center text-sm text-slate-600 dark:text-slate-300">
            Already have an account?{' '}
            <button type="button" onClick={() => { onClose(); onSwitchToLogin(); }} className="text-jci-blue hover:underline font-medium">Sign in</button>
          </p>
        )}
      </form>
    </Modal>
  );
};
