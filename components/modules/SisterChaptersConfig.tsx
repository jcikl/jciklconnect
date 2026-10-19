import React, { useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Globe, ChevronDown, UserPlus, User, ShieldCheck } from 'lucide-react';
import { Button, Modal, useToast, ConfirmDialog, CONFIRM_CLOSED } from '../ui/Common';
import type { ConfirmState } from '../ui/Common';
import { Input } from '../ui/Form';
import { useSisterChapters } from '../../hooks/useSisterChapters';
import { useExternalAccounts } from '../../hooks/useExternalAccounts';
import { SisterChaptersService } from '../../services/sisterChaptersService';
import { MembersService } from '../../services/membersService';
import type { ExternalCreateResponse } from '../../services/externalAccountsService';
import type { SisterChapter, SisterChapterType } from '../../types/sisterChapter';
import { SISTER_CHAPTER_TYPE_LABELS } from '../../types/sisterChapter';
import type { Member } from '../../types';

const TYPE_OPTIONS: { value: SisterChapterType; label: string; desc: string }[] = [
  { value: 'sister_lo', label: 'Sister Chapter',                               desc: 'Peer local organization in another country' },
  { value: 'apicc',     label: 'Asia Pacific International City Council',      desc: 'APICC member city council' },
  { value: 'global',    label: 'Global JCI Chapter',                           desc: 'Any other JCI local organization' },
];

/** One-line summary of an external-accounts create call (the response carries no emails). */
function describeCreateResult(res: ExternalCreateResponse): { text: string; ok: boolean } {
  const r = res.results[0];
  if (!r) return { text: 'Nothing was created', ok: false };
  if (r.status === 'created') {
    return r.emailSent === false
      ? { text: 'Account created, but the password setup email failed. Use "Resend invite" later.', ok: true }
      : { text: 'Account created. A password setup email was sent.', ok: true };
  }
  return { text: r.reason ? `Not created: ${r.reason}` : 'Not created', ok: false };
}

const EMPTY: Omit<SisterChapter, 'createdAt' | 'updatedAt'> = {
  id: '', name: '', country: '', type: ['sister_lo'], flagEmoji: '', logoUrl: '',
  partnerSince: '', website: '', isActive: true,
};

const MEMBER_EMPTY = { name: '', email: '', dob: '' };
type AccountMode = 'chapterAdmin' | 'invite';

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-jci-blue' : 'bg-slate-200'}`}
  >
    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
  </button>
);

export const SisterChaptersConfig: React.FC = () => {
  const { chapters, loading, reload } = useSisterChapters();
  const { showToast } = useToast();

  // Chapter CRUD state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>(CONFIRM_CLOSED);

  // Member management state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [chapterMembers, setChapterMembers] = useState<Record<string, Member[]>>({});
  const [memberLoading, setMemberLoading] = useState<Record<string, boolean>>({});
  const [memberModalChapterId, setMemberModalChapterId] = useState<string | null>(null);
  const [accountMode, setAccountMode] = useState<AccountMode>('invite');
  const [memberForm, setMemberForm] = useState(MEMBER_EMPTY);
  const { busy: savingMember, createChapterAdmins, inviteMembers } = useExternalAccounts();

  // ── Chapter CRUD ──────────────────────────────────────────────
  const openNew = () => { setForm(EMPTY); setEditingId(null); setModalOpen(true); };
  const openEdit = (ch: SisterChapter) => {
    setForm({ id: ch.id, name: ch.name, country: ch.country, type: ch.type ?? ['sister_lo'], flagEmoji: ch.flagEmoji ?? '', logoUrl: ch.logoUrl ?? '', partnerSince: ch.partnerSince ?? '', website: ch.website ?? '', isActive: ch.isActive });
    setEditingId(ch.id);
    setModalOpen(true);
  };

  const patch = (key: keyof typeof form, value: string | boolean | SisterChapterType[]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const toggleType = (t: SisterChapterType) => {
    const current = form.type as SisterChapterType[];
    const next = current.includes(t)
      ? current.filter(x => x !== t)
      : [...current, t];
    if (next.length === 0) return; // at least one type required
    patch('type', next);
  };

  const handleSave = async () => {
    if (!form.id.trim() || !form.name.trim() || !form.country.trim()) {
      showToast('ID, Name and Country are required', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const { id, ...rest } = form;
        await SisterChaptersService.update(editingId, rest);
      } else {
        await SisterChaptersService.create(form);
      }
      showToast(editingId ? 'Chapter updated' : 'Chapter added', 'success');
      setModalOpen(false);
      reload();
    } catch {
      showToast('Failed to save chapter', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteChapter = (ch: SisterChapter) => {
    setConfirmState({
      open: true,
      title: 'Remove Sister Chapter',
      message: `Remove ${ch.name}? This does not delete their members.`,
      confirmLabel: 'Remove',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await SisterChaptersService.delete(ch.id);
          showToast('Chapter removed', 'success');
          reload();
        } catch {
          showToast('Failed to remove chapter', 'error');
        }
        setConfirmState(CONFIRM_CLOSED);
      },
    });
  };

  const handleToggleActive = async (ch: SisterChapter) => {
    try {
      await SisterChaptersService.update(ch.id, { isActive: !ch.isActive });
      reload();
    } catch {
      showToast('Failed to update chapter', 'error');
    }
  };

  // ── Member management ─────────────────────────────────────────
  const loadMembers = useCallback(async (chapterId: string) => {
    setMemberLoading(prev => ({ ...prev, [chapterId]: true }));
    try {
      const members = await MembersService.getAllMembers(chapterId);
      setChapterMembers(prev => ({ ...prev, [chapterId]: members }));
    } catch {
      showToast('Failed to load members', 'error');
    } finally {
      setMemberLoading(prev => ({ ...prev, [chapterId]: false }));
    }
  }, [showToast]);

  const toggleExpand = (ch: SisterChapter) => {
    if (expandedId === ch.id) { setExpandedId(null); return; }
    setExpandedId(ch.id);
    if (!chapterMembers[ch.id]) loadMembers(ch.id);
  };

  const openAddAccount = (chapterId: string, mode: AccountMode) => {
    setMemberForm(MEMBER_EMPTY);
    setAccountMode(mode);
    setMemberModalChapterId(chapterId);
  };

  const patchMember = (key: keyof typeof memberForm, value: string) =>
    setMemberForm(prev => ({ ...prev, [key]: value }));

  // Accounts are created server-side (netlify/functions/external-accounts): Auth user + member doc
  // (AFFILIATE / CHAPTER_ADMIN, active) + email slot + card, then the password setup email.
  const handleAddAccount = async () => {
    if (!memberModalChapterId) return;
    if (!memberForm.name.trim() || !memberForm.email.trim()) {
      showToast('Name and email are required', 'error');
      return;
    }
    const chapterId = memberModalChapterId;
    const invitee = {
      name: memberForm.name.trim(),
      email: memberForm.email.trim(),
      ...(memberForm.dob ? { dob: memberForm.dob } : {}),
    };
    try {
      const res = accountMode === 'chapterAdmin'
        ? await createChapterAdmins(chapterId, [invitee])
        : await inviteMembers([invitee], chapterId);
      const { text, ok } = describeCreateResult(res);
      showToast(text, ok ? 'success' : 'error');
      if (!ok) return;
      setMemberModalChapterId(null);
      await loadMembers(chapterId);
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to create account', 'error');
    }
  };

  const handleDeleteMember = (member: Member, chapterId: string) => {
    const displayName = member.general?.name ?? member.id;
    setConfirmState({
      open: true,
      title: 'Remove Member',
      message: `Remove ${displayName} from this chapter?`,
      confirmLabel: 'Remove',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await MembersService.deleteMember(member.id);
          setChapterMembers(prev => ({
            ...prev,
            [chapterId]: (prev[chapterId] ?? []).filter(m => m.id !== member.id),
          }));
          showToast('Member removed', 'success');
        } catch {
          showToast('Failed to remove member', 'error');
        }
        setConfirmState(CONFIRM_CLOSED);
      },
    });
  };

  if (loading) return <p className="text-sm text-slate-500 py-8 text-center">Loading…</p>;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Global Relations</h3>
        <p className="text-xs text-slate-500 mt-0.5">Sister chapters and APICC city councils. Members from these organizations appear in the International Network tab.</p>
      </div>

      <div className="space-y-2">
        {/* Add chapter row */}
        <button
          onClick={openNew}
          className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-slate-300 hover:border-jci-blue hover:bg-blue-50/50 text-slate-400 hover:text-jci-blue transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
            <Plus size={18} />
          </div>
          <span className="text-sm font-medium">Add Chapter / Council</span>
        </button>

        {/* Chapter cards grouped by type */}
        {TYPE_OPTIONS.map(({ value: typeKey, label: typeLabel }) => {
          const group = chapters.filter(ch => (ch.type ?? ['sister_lo']).includes(typeKey));
          if (group.length === 0) return null;
          return (
            <div key={typeKey} className="space-y-2">
              <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider px-1 pt-1">{typeLabel}</p>
              {group.map(ch => {
          const isExpanded = expandedId === ch.id;
          const members = chapterMembers[ch.id] ?? [];
          const isLoadingMembers = memberLoading[ch.id];

          return (
            <div key={ch.id} className={`rounded-xl border overflow-hidden ${ch.isActive ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
              {/* Chapter row */}
              <div className="flex items-center gap-3 p-3">
                {ch.logoUrl ? (
                  <img src={ch.logoUrl} alt={ch.name} className="w-10 h-10 rounded-lg object-contain border border-slate-100 bg-white p-1 shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-xl shrink-0">
                    {ch.flagEmoji || '🌐'}
                  </div>
                )}
                <button
                  onClick={() => toggleExpand(ch)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="text-sm font-semibold text-slate-900 truncate">{ch.name}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {ch.country}
                    {isExpanded && !isLoadingMembers && (
                      <span className="ml-1">· {members.length} member{members.length !== 1 ? 's' : ''}</span>
                    )}
                  </p>
                  {ch.partnerSince && <p className="text-[10px] text-slate-400">Partner since {ch.partnerSince}</p>}
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleExpand(ch)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={isExpanded ? 'Collapse' : 'Expand members'}
                  >
                    <ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  <Toggle checked={ch.isActive} onChange={() => handleToggleActive(ch)} />
                  <button onClick={() => openEdit(ch)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDeleteChapter(ch)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Member panel */}
              {isExpanded && (
                <div className="border-t border-slate-100 bg-slate-50/60 px-3 pb-3 pt-2 space-y-1.5">
                  {isLoadingMembers ? (
                    <p className="text-xs text-slate-400 py-2 text-center">Loading members…</p>
                  ) : members.length === 0 ? (
                    <p className="text-xs text-slate-400 py-2 text-center">No members yet</p>
                  ) : (
                    members.map(m => (
                      <div key={m.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-slate-100">
                        {m.general?.avatarUrl ? (
                          <img src={m.general.avatarUrl} alt={m.general.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-jci-blue/10 flex items-center justify-center shrink-0">
                            <User size={13} className="text-jci-blue" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">{m.general?.name ?? '—'}</p>
                          {(m.companyName || m.business?.position) && (
                            <p className="text-[10px] text-slate-400 truncate">{[m.business?.position, m.companyName ?? m.business?.companyName].filter(Boolean).join(' · ')}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteMember(m, ch.id)}
                          className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors shrink-0"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))
                  )}

                  {/* Account rows (KL admin): chapter admin / invite member */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <button
                      onClick={() => openAddAccount(ch.id, 'chapterAdmin')}
                      disabled={!ch.isActive}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 hover:border-jci-blue hover:bg-blue-50/50 dark:hover:bg-slate-800 text-slate-400 hover:text-jci-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ShieldCheck size={13} />
                      <span className="text-xs font-medium">Add chapter admin</span>
                    </button>
                    <button
                      onClick={() => openAddAccount(ch.id, 'invite')}
                      disabled={!ch.isActive}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 hover:border-jci-blue hover:bg-blue-50/50 dark:hover:bg-slate-800 text-slate-400 hover:text-jci-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <UserPlus size={13} />
                      <span className="text-xs font-medium">Invite member</span>
                    </button>
                  </div>
                  {!ch.isActive && (
                    <p className="text-[10px] text-slate-400 text-center">Activate the chapter to add accounts.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
            </div>
          );
        })}
      </div>

      {/* ── Edit/Add Chapter Modal ── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Chapter / Council' : 'Add Chapter / Council'}
        size="lg"
        footer={
          <div className="flex gap-3 justify-end w-full">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Type <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-2">
              {TYPE_OPTIONS.map(opt => {
                const selected = (form.type as SisterChapterType[]).includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleType(opt.value)}
                    className={`rounded-lg border-2 px-3 py-2 text-left transition-colors ${selected ? 'border-jci-blue bg-jci-blue/5' : 'border-slate-200 hover:border-slate-300'}`}
                  >
                    <p className={`text-xs font-semibold ${selected ? 'text-jci-blue' : 'text-slate-700'}`}>{opt.label}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Chapter ID <span className="text-red-500">*</span></label>
              <Input
                value={form.id}
                onChange={e => patch('id', e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                placeholder="e.g. jci-sg"
                disabled={!!editingId}
              />
              <p className="text-[10px] text-slate-400 mt-1">Used as loId for members. Cannot change after creation.</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Flag Emoji</label>
              <Input value={form.flagEmoji} onChange={e => patch('flagEmoji', e.target.value)} placeholder="🇸🇬" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Chapter Name <span className="text-red-500">*</span></label>
            <Input value={form.name} onChange={e => patch('name', e.target.value)} placeholder="e.g. JCI Singapore" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Country <span className="text-red-500">*</span></label>
              <Input value={form.country} onChange={e => patch('country', e.target.value)} placeholder="e.g. Singapore" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Partner Since</label>
              <Input value={form.partnerSince} onChange={e => patch('partnerSince', e.target.value)} placeholder="e.g. 2024-01" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Website</label>
            <Input icon={<Globe size={13} />} value={form.website} onChange={e => patch('website', e.target.value)} placeholder="https://jci-sg.org" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Logo URL</label>
            <Input value={form.logoUrl} onChange={e => patch('logoUrl', e.target.value)} placeholder="https://..." />
          </div>
          <div className="flex items-center gap-3">
            <Toggle checked={form.isActive} onChange={v => patch('isActive', v)} />
            <span className="text-sm text-slate-700">Active — visible in International Network</span>
          </div>
        </div>
      </Modal>

      {/* ── Add chapter admin / Invite member Modal ── */}
      <Modal
        isOpen={!!memberModalChapterId}
        onClose={() => setMemberModalChapterId(null)}
        title={accountMode === 'chapterAdmin' ? 'Add chapter admin' : 'Invite member'}
        size="sm"
        footer={
          <div className="flex gap-3 justify-end w-full">
            <Button variant="outline" onClick={() => setMemberModalChapterId(null)}>Cancel</Button>
            <Button variant="primary" onClick={handleAddAccount} disabled={savingMember}>
              {savingMember ? 'Creating…' : accountMode === 'chapterAdmin' ? 'Add chapter admin' : 'Send invite'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">Full Name <span className="text-red-500">*</span></label>
            <Input value={memberForm.name} onChange={e => patchMember('name', e.target.value)} placeholder="e.g. Tan Wei Ming" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">Email <span className="text-red-500">*</span></label>
            <Input type="email" value={memberForm.email} onChange={e => patchMember('email', e.target.value)} placeholder="member@example.com" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">Date of birth (optional)</label>
            <Input type="date" value={memberForm.dob} onChange={e => patchMember('dob', e.target.value)} />
          </div>
          <p className="text-[10px] text-slate-400">
            {accountMode === 'chapterAdmin'
              ? 'Creates an active chapter admin login for this chapter. They can then invite and approve their own members.'
              : 'Creates an active member login for this chapter.'}
            {' '}A "set your password" email is sent to this address.
          </p>
        </div>
      </Modal>

      <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} variant={confirmState.variant} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(CONFIRM_CLOSED)} />
    </div>
  );
};
