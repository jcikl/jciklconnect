import * as React from 'react';
import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button, Card, useToast } from '../../ui/Common';
import { Input } from '../../ui/Form';
import type { Member } from '../../../types';
import { isExternalRole } from '../../../utils/externalAccess';

/**
 * Privacy & Security tab of the member's own profile (KL and external members): share my card internationally,
 * hide my birthday, and (externals only) the one-time date of birth. Saved through useAuth().updateMemberProfile
 * (firestore.rules self-update allows privacy, and general.dob + birthdayMMDD once while dob is empty for externals;
 * the memberCards doc is synced there).
 */
export const PrivacySettings: React.FC<{ member: Member; onSave: (updates: Partial<Member>) => Promise<void> }> = ({ member, onSave }) => {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [privacy, setPrivacy] = useState({
    shareCardInternationally: member.privacy?.shareCardInternationally ?? false,
    hideBirthday: member.privacy?.hideBirthday ?? false,
  });
  const canSetDobOnce = isExternalRole(member.role) && !member.general?.dob;
  const [dobOnce, setDobOnce] = useState('');

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Partial<Member> = { privacy: { ...member.privacy, ...privacy } };
      if (canSetDobOnce && /^\d{4}-\d{2}-\d{2}$/.test(dobOnce)) {
        // Whole general map (merged write); birthdayMMDD is the birthday index field.
        (updates as Record<string, unknown>).general = { ...member.general, dob: dobOnce };
        (updates as Record<string, unknown>).birthdayMMDD = dobOnce.slice(5, 7) + dobOnce.slice(8, 10);
      }
      await onSave(updates);
      setDobOnce('');
      showToast('Profile updated', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const switches: { key: keyof typeof privacy; label: string; desc: string }[] = [
    { key: 'shareCardInternationally', label: 'Share my card internationally', desc: 'Let JCI members of other chapters see your name, company and business card.' },
    { key: 'hideBirthday', label: 'Hide my birthday', desc: 'Leave me out of the birthday list. Only the day and month are ever shown, never the year.' },
  ];

  return (
    <Card className="p-4">
      <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><ShieldCheck size={16} /> Privacy &amp; Security</h3>
      <div className="space-y-3">
        {switches.map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700">{label}</p>
              <p className="text-xs text-slate-400">{desc}</p>
            </div>
            <button
              type="button"
              onClick={() => setPrivacy(p => ({ ...p, [key]: !p[key] }))}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${privacy[key] ? 'bg-jci-blue' : 'bg-slate-200'}`}
              aria-checked={privacy[key]}
              aria-label={label}
              role="switch"
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${privacy[key] ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        ))}
        {canSetDobOnce && (
          <div>
            <label className="block text-sm text-slate-600 mb-1">Date of birth</label>
            <Input type="date" value={dobOnce} onChange={(e) => setDobOnce(e.target.value)} />
            <p className="text-xs text-slate-400 mt-1">Can be set once. Only the day and month appear in your chapter's birthday list.</p>
          </div>
        )}
      </div>
      <div className="mt-4 flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
      </div>
    </Card>
  );
};
