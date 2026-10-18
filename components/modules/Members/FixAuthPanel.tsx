import React, { useMemo, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Button, Badge, useToast } from '../../ui/Common';
import { Checkbox } from '../../ui/Form';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { useMemberAuth } from '../../../hooks/useMemberAuth';
import type { MemberAuthStatus } from '../../../services/memberAuthService';

interface Props {
  /** Used only to show names next to member ids in the report. */
  members: Array<{ id: string; name?: string; general?: { name?: string } }>;
}

const STATUS_META: Record<MemberAuthStatus, { label: string; variant: 'success' | 'warning' | 'error' | 'info' | 'neutral' }> = {
  ready: { label: 'Ready', variant: 'neutral' },
  create: { label: 'Will create', variant: 'info' },
  replace_orphan: { label: 'Will replace orphan', variant: 'info' },
  created: { label: 'Created', variant: 'success' },
  replaced: { label: 'Orphan replaced', variant: 'success' },
  skipped: { label: 'Skipped', variant: 'warning' },
  conflict: { label: 'Needs review', variant: 'warning' },
  error: { label: 'Error', variant: 'error' },
};
const STATUS_ORDER: MemberAuthStatus[] = ['error', 'conflict', 'skipped', 'create', 'replace_orphan', 'created', 'replaced', 'ready'];

/**
 * SUPER_ADMIN only: back-fill Firebase Auth login accounts (uid = member id) for members
 * imported before accounts were created at import time. Dry run first, then run.
 */
export const FixAuthPanel: React.FC<Props> = ({ members }) => {
  const { showToast } = useToast();
  const { runFix, running, processed, result, error } = useMemberAuth();
  const [replaceOrphans, setReplaceOrphans] = useState(false);
  const [sendSetupEmail, setSendSetupEmail] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hasDryRun, setHasDryRun] = useState(false);

  const nameOf = useMemo(() => {
    const map = new Map(members.map(m => [m.id, m.general?.name || m.name || '']));
    return (id: string) => map.get(id) || id;
  }, [members]);

  const rows = useMemo(() => (result?.results ?? [])
    .filter(r => r.status !== 'ready')
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)), [result]);

  const execute = async (dryRun: boolean) => {
    try {
      const res = await runFix({ dryRun, replaceOrphans, sendSetupEmail });
      if (dryRun) setHasDryRun(true);
      showToast(dryRun ? 'Dry run finished — nothing was changed' : `Fix Auth finished: ${res.summary.created ?? 0} created, ${res.summary.replaced ?? 0} replaced`, 'success');
    } catch {
      showToast('Fix Auth failed — see the message in the panel', 'error');
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-slate-200 p-4 space-y-3 bg-white">
      <div className="flex items-start gap-2">
        <KeyRound size={18} className="text-jci-blue mt-0.5 shrink-0" />
        <div className="min-w-0">
          <h4 className="font-semibold text-slate-900">Fix Auth</h4>
          <p className="text-xs text-slate-500">
            Creates missing login accounts for imported members, using each member's email and phone. Run a dry run first to see what will happen.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Checkbox
          checked={replaceOrphans}
          onChange={e => setReplaceOrphans(e.target.checked)}
          disabled={running}
          label="Replace orphan accounts (old invite accounts that were never used to sign in)"
        />
        <Checkbox
          checked={sendSetupEmail}
          onChange={e => setSendSetupEmail(e.target.checked)}
          disabled={running}
          label="Also send a set-password email to each new account"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => execute(true)} isLoading={running} disabled={running}>
          Dry run
        </Button>
        <Button variant="primary" size="sm" onClick={() => setConfirmOpen(true)} disabled={running || !hasDryRun}>
          Run Fix Auth
        </Button>
        {running && <span className="text-xs text-slate-500 self-center">Processed {processed} members…</span>}
      </div>
      {!hasDryRun && <p className="text-xs text-slate-500">Run a dry run first to enable “Run Fix Auth”.</p>}

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      {result && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-slate-500 self-center">{result.dryRun ? 'Dry run:' : 'Result:'}</span>
            {STATUS_ORDER.filter(s => result.summary[s]).map(s => (
              <Badge key={s} variant={STATUS_META[s].variant}>{STATUS_META[s].label}: {result.summary[s]}</Badge>
            ))}
          </div>
          {rows.length === 0 ? (
            <p className="text-sm text-slate-500">Every member already has a login account.</p>
          ) : (
            <div className="max-h-72 overflow-auto rounded border border-slate-100">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium">Member</th>
                    <th className="text-left p-2 font-medium">Status</th>
                    <th className="text-left p-2 font-medium">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.memberId} className="border-t border-slate-100 align-top">
                      <td className="p-2 break-words">{nameOf(r.memberId)}</td>
                      <td className="p-2"><Badge variant={STATUS_META[r.status].variant}>{STATUS_META[r.status].label}</Badge></td>
                      <td className="p-2 text-slate-600 break-words">
                        {[r.reason, r.phoneNote, r.emailSent === false ? `email not sent: ${r.emailError}` : null].filter(Boolean).join(' · ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Run Fix Auth"
        message={`This creates login accounts for every member without one${replaceOrphans ? ', and replaces unused orphan accounts' : ''}${sendSetupEmail ? ', and emails each new account a set-password link' : ''}. Members flagged “Needs review” are not changed.`}
        confirmLabel="Run"
        variant="warning"
        onConfirm={() => { setConfirmOpen(false); execute(false); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
};

export default FixAuthPanel;
