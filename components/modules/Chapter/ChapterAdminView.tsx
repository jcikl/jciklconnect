import React, { useMemo, useState } from 'react';
import { Check, X, PauseCircle, PlayCircle, Mail, User, UserPlus } from 'lucide-react';
import { Badge, Button, Card, ConfirmDialog, CONFIRM_CLOSED, EmptyState, Tabs, useToast } from '../../ui/Common';
import type { ConfirmState } from '../../ui/Common';
import { Input } from '../../ui/Form';
import { useAuth } from '../../../hooks/useAuth';
import { useChapterMembers } from '../../../hooks/useChapterMembers';
import { useSisterChapters } from '../../../hooks/useSisterChapters';
import type { Member } from '../../../types';
import type { AffiliationStatus } from '../../../types/member';

type TabId = 'pending' | 'members' | 'invite';

const STATUS_LABEL: Record<AffiliationStatus, string> = {
  pending_chapter: 'Waiting for you',
  pending_kl: 'Waiting for JCI KL',
  active: 'Active',
  suspended: 'Suspended',
  expired: 'Expired',
  rejected: 'Rejected',
};

const STATUS_VARIANT: Record<AffiliationStatus, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  pending_chapter: 'warning',
  pending_kl: 'info',
  active: 'success',
  suspended: 'error',
  expired: 'neutral',
  rejected: 'neutral',
};

const EMPTY_INVITE = { name: '', email: '', dob: '' };

const MemberRow: React.FC<{ m: Member; children?: React.ReactNode }> = ({ m, children }) => {
  const status = m.affiliation?.status;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {m.general?.avatarUrl ? (
          <img src={m.general.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-jci-blue/10 flex items-center justify-center shrink-0">
            <User size={14} className="text-jci-blue" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{m.general?.name ?? '—'}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{m.contact?.email ?? ''}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
        {m.role === 'CHAPTER_ADMIN' && <Badge variant="jci">Chapter admin</Badge>}
        {status && <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>}
        {children}
      </div>
    </div>
  );
};

/**
 * MY_CHAPTER (active CHAPTER_ADMIN only, utils/externalAccess.ts): approve / reject requests from their own
 * chapter, suspend / reactivate members, resend invites, and invite new members (active immediately).
 * Every change goes through the external-accounts function, which checks the transition table.
 */
export const ChapterAdminView: React.FC = () => {
  const { member } = useAuth();
  const loId = member?.loId ?? null;
  const { chapters } = useSisterChapters();
  const chapter = chapters.find(c => c.id === loId);
  const { members, loading, error, setStatus, busyId, resendInvite, inviteMembers, inviting } = useChapterMembers(loId);
  const { showToast } = useToast();
  const [tab, setTab] = useState<TabId>('pending');
  const [confirm, setConfirm] = useState<ConfirmState>(CONFIRM_CLOSED);
  const [invite, setInvite] = useState(EMPTY_INVITE);

  const pending = useMemo(() => members.filter(m => m.affiliation?.status === 'pending_chapter' || m.affiliation?.status === 'pending_kl'), [members]);
  const others = useMemo(() => members.filter(m => !pending.includes(m)), [members, pending]);

  const change = async (m: Member, status: AffiliationStatus, done: string) => {
    try {
      await setStatus(m.id, status);
      showToast(done, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update status', 'error');
    }
  };

  const confirmChange = (m: Member, status: AffiliationStatus, title: string, message: string, done: string) =>
    setConfirm({
      open: true, title, message, confirmLabel: title, variant: 'danger',
      onConfirm: async () => { setConfirm(CONFIRM_CLOSED); await change(m, status, done); },
    });

  const resend = async (m: Member) => {
    try {
      const sent = await resendInvite(m.id);
      showToast(sent ? 'Password setup email sent' : 'The email could not be sent. Please try again later.', sent ? 'success' : 'error');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not resend the invite', 'error');
    }
  };

  const submitInvite = async () => {
    if (!invite.name.trim() || !invite.email.trim()) { showToast('Name and email are required', 'error'); return; }
    try {
      const res = await inviteMembers([{ name: invite.name.trim(), email: invite.email.trim(), ...(invite.dob ? { dob: invite.dob } : {}) }]);
      const r = res.results[0];
      if (r?.status === 'created') {
        showToast(r.emailSent === false ? 'Member added, but the email failed. Use "Resend invite".' : 'Member added. A password setup email was sent.', 'success');
        setInvite(EMPTY_INVITE);
        setTab('members');
      } else {
        showToast(r?.reason ? `Not added: ${r.reason}` : 'Not added', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not invite member', 'error');
    }
  };

  const isSelf = (m: Member) => m.id === member?.id;
  const actionable = (m: Member) => m.role === 'AFFILIATE' && !isSelf(m);

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">My Chapter</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{chapter?.name ?? loId ?? ''}{chapter?.country ? ` · ${chapter.country}` : ''}</p>
      </div>

      <Tabs
        tabs={[
          { id: 'pending', label: `Pending (${pending.length})`, shortLabel: 'Pending' },
          { id: 'members', label: `Members (${others.length})`, shortLabel: 'Members' },
          { id: 'invite', label: 'Invite', icon: <UserPlus size={14} /> },
        ]}
        activeTab={tab}
        onTabChange={t => setTab(t as TabId)}
      />

      {tab !== 'invite' && loading && <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">Loading…</p>}
      {tab !== 'invite' && !loading && error && <EmptyState title="Could not load your chapter" description={error} />}

      {tab === 'pending' && !loading && !error && (
        pending.length === 0 ? <EmptyState title="No pending requests" description="New self-registrations from your chapter appear here." /> : (
          <div className="space-y-2">
            {pending.map(m => (
              <MemberRow key={m.id} m={m}>
                {actionable(m) && m.affiliation?.status === 'pending_chapter' && (
                  <Button size="sm" variant="success" disabled={busyId === m.id} onClick={() => change(m, 'pending_kl', 'Approved — JCI KL will review next')}>
                    <Check size={14} className="mr-1" />Approve
                  </Button>
                )}
                {actionable(m) && (
                  <Button size="sm" variant="outline" disabled={busyId === m.id}
                    onClick={() => confirmChange(m, 'rejected', 'Reject', `Reject the request from ${m.general?.name ?? 'this person'}?`, 'Request rejected')}>
                    <X size={14} className="mr-1" />Reject
                  </Button>
                )}
              </MemberRow>
            ))}
          </div>
        )
      )}

      {tab === 'members' && !loading && !error && (
        others.length === 0 ? <EmptyState title="No members yet" description="Invite members from the Invite tab." /> : (
          <div className="space-y-2">
            {others.map(m => (
              <MemberRow key={m.id} m={m}>
                {actionable(m) && m.affiliation?.status === 'active' && (
                  <>
                    <Button size="sm" variant="ghost" disabled={busyId === m.id} onClick={() => resend(m)}>
                      <Mail size={14} className="mr-1" />Resend invite
                    </Button>
                    <Button size="sm" variant="outline" disabled={busyId === m.id}
                      onClick={() => confirmChange(m, 'suspended', 'Suspend', `Suspend ${m.general?.name ?? 'this member'}? They lose access until reactivated.`, 'Member suspended')}>
                      <PauseCircle size={14} className="mr-1" />Suspend
                    </Button>
                  </>
                )}
                {actionable(m) && m.affiliation?.status === 'suspended' && m.affiliation?.suspendedByRole === 'CHAPTER_ADMIN' && (
                  <Button size="sm" variant="success" disabled={busyId === m.id} onClick={() => change(m, 'active', 'Member reactivated')}>
                    <PlayCircle size={14} className="mr-1" />Reactivate
                  </Button>
                )}
              </MemberRow>
            ))}
          </div>
        )
      )}

      {tab === 'invite' && (
        <Card title="Invite a member" description="The member gets an active login right away and a 'set your password' email.">
          <div className="space-y-4">
            <Input label="Full name *" value={invite.name} onChange={e => setInvite(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Tan Wei Ming" />
            <Input label="Email *" type="email" value={invite.email} onChange={e => setInvite(p => ({ ...p, email: e.target.value }))} placeholder="member@example.com" />
            <Input label="Date of birth (optional)" type="date" value={invite.dob} onChange={e => setInvite(p => ({ ...p, dob: e.target.value }))} />
            <p className="text-xs text-slate-500 dark:text-slate-400">Up to 100 members per chapter.</p>
            <div className="flex justify-end">
              <Button onClick={submitInvite} disabled={inviting} isLoading={inviting}>Send invite</Button>
            </div>
          </div>
        </Card>
      )}

      <ConfirmDialog open={confirm.open} title={confirm.title} message={confirm.message} confirmLabel={confirm.confirmLabel} variant={confirm.variant} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(CONFIRM_CLOSED)} />
    </div>
  );
};
