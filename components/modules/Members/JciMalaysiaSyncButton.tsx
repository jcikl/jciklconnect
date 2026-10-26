/**
 * "Sync JCI Malaysia" on the Member Directory header — developer accounts only (the server checks again).
 * Preview (counts, changes, conflicts with A/B picks, other chapter, not found) → Apply behind a confirm → result.
 */
import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button, Badge, Modal, useToast } from '../../ui/Common';
import { LoadingState } from '../../ui/Loading';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { useJciMalaysiaSync } from '../../../hooks/useJciMalaysiaSync';
import type { JciMalaysiaCandidate, JciMalaysiaConflict, JciMalaysiaFields } from '../../../services/jciMalaysiaSyncService';

const BY_LABEL: Record<string, string> = {
  manual: 'manual pick', userId: 'user id', membershipNo: 'membership no.', email: 'email', phone: 'phone',
};
const FIELD_LABEL: Record<keyof JciMalaysiaFields, string> = { membershipNo: 'No.', joinDate: 'Joined', userId: 'User id' };
const show = (v: string | null | undefined) => v || '∅';

const card = 'rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800';
const muted = 'text-xs text-slate-500 dark:text-slate-400';

const Stat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className={`${card} px-3 py-2 min-w-0`}>
    <p className={`${muted} truncate`}>{label}</p>
    <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{value}</p>
  </div>
);

const Section: React.FC<{ title: string; count: number; defaultOpen?: boolean; children: React.ReactNode }> = ({ title, count, defaultOpen, children }) => (
  <details className={`${card} group`} open={defaultOpen}>
    <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center justify-between gap-2">
      <span>{title}</span>
      <Badge variant={count ? 'info' : 'neutral'}>{count}</Badge>
    </summary>
    <div className="border-t border-slate-100 dark:border-slate-700 px-3 py-2 space-y-2">
      {count ? children : <p className={muted}>None</p>}
    </div>
  </details>
);

const CandidateOption: React.FC<{
  label: 'A' | 'B'; hint: string; candidate: JciMalaysiaCandidate | null; name: string; checked: boolean; onSelect: () => void;
}> = ({ label, hint, candidate, name, checked, onSelect }) => {
  if (!candidate) return null;
  return (
    <label className={`flex items-start gap-2 rounded-md border px-2 py-2 cursor-pointer min-w-0 ${checked ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30' : 'border-slate-200 dark:border-slate-700'}`}>
      <input type="radio" name={name} className="mt-1" checked={checked} onChange={onSelect} />
      <span className="min-w-0 text-sm text-slate-800 dark:text-slate-100">
        <span className="font-semibold">{label}</span> <span className={muted}>({hint})</span>
        <span className="block break-words">{candidate.fullname || '—'}</span>
        <span className={`block ${muted} break-words`}>
          {candidate.chapter || '—'} · {candidate.membershipNo || 'no membership no.'} · joined {candidate.joinDate || '—'}
        </span>
      </span>
    </label>
  );
};

const ConflictRow: React.FC<{ conflict: JciMalaysiaConflict; busy: boolean; onSave: (sourceId: string) => void }> = ({ conflict, busy, onSave }) => {
  const [choice, setChoice] = useState<string>('');
  const { A, B } = conflict.candidates;
  return (
    <div className="space-y-2 py-1">
      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 break-words">{conflict.name}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <CandidateOption label="A" hint="by email" candidate={A} name={`pick-${conflict.memberId}`} checked={!!A && choice === A.sourceId} onSelect={() => A && setChoice(A.sourceId)} />
        <CandidateOption label="B" hint="by phone" candidate={B} name={`pick-${conflict.memberId}`} checked={!!B && choice === B.sourceId} onSelect={() => B && setChoice(B.sourceId)} />
      </div>
      <Button size="sm" variant="outline" disabled={!choice || busy} onClick={() => onSave(choice)}>Save pick</Button>
    </div>
  );
};

export const JciMalaysiaSyncButton: React.FC = () => {
  const { canSync, preview, result, loading, busy, error, loadPreview, pick, apply, reset } = useJciMalaysiaSync();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (open) loadPreview();
  }, [open, loadPreview]);

  if (!canSync) return null;

  const close = () => { setOpen(false); setConfirming(false); reset(); };
  const toWrite = preview?.writes.length ?? 0;

  const savePick = async (memberId: string, sourceId: string) => {
    try {
      await pick(memberId, sourceId);
      showToast('Pick saved', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save the pick', 'error');
    }
  };

  const runApply = async () => {
    setConfirming(false);
    try {
      const res = await apply();
      showToast(`JCI Malaysia sync: ${res.written} member(s) updated`, 'success');
    } catch {
      showToast('JCI Malaysia sync failed', 'error');
    }
  };

  const footer = result ? (
    <div className="flex justify-end w-full"><Button onClick={close}>Done</Button></div>
  ) : (
    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 w-full">
      <Button variant="outline" onClick={close}>Close</Button>
      <Button variant="outline" onClick={loadPreview} disabled={loading || busy}>
        <RefreshCw size={14} className="mr-1.5" /> Refresh
      </Button>
      <Button onClick={() => setConfirming(true)} disabled={loading || busy || !toWrite}>
        {busy ? 'Working…' : `Apply ${toWrite} change${toWrite === 1 ? '' : 's'}`}
      </Button>
    </div>
  );

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <RefreshCw size={14} className="mr-1.5" /> Sync JCI Malaysia
      </Button>

      <Modal isOpen={open} onClose={close} title="Sync JCI Malaysia" size="3xl" drawerOnMobile footer={footer}>
        {/* Own surface: the Modal shell is light-only, so the content carries both themes itself. */}
        <div className="space-y-3 rounded-lg p-2 sm:p-3 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
          {result ? (
            <div className={`${card} p-4 space-y-2`}>
              <p className="text-base font-semibold">{result.written} member(s) updated</p>
              <p className={muted}>
                {result.runId ? <>Old values saved as backup run <span className="font-mono break-all">{result.runId}</span>.</> : 'Nothing needed changing.'}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat label="KL members" value={result.counts.members} />
                <Stat label="Conflicts" value={result.counts.conflict} />
                <Stat label="Other chapter" value={result.counts.otherChapter} />
                <Stat label="Not found" value={result.counts.none} />
              </div>
            </div>
          ) : (
            <LoadingState loading={loading && !preview} error={preview ? null : error} onRetry={loadPreview} loadingMessage="Reading JCI Malaysia data…">
              {preview && (
                <>
                  {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                  <p className={muted}>
                    Preview only — nothing is written until you apply. {preview.sourceRows} JCI Malaysia records read.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Stat label="KL members" value={preview.counts.members} />
                    <Stat label="To update" value={preview.counts.toWrite} />
                    <Stat label="Unchanged" value={preview.counts.unchanged} />
                    <Stat label="Conflicts" value={preview.counts.conflict} />
                  </div>
                  <p className={muted}>
                    Matched by manual pick {preview.counts.byManual} · user id {preview.counts.byUserId} · membership no. {preview.counts.byMembershipNo} · email {preview.counts.byEmail} · phone {preview.counts.byPhone}
                  </p>

                  <Section title="Changes" count={preview.writes.length}>
                    {preview.writes.map(w => (
                      <div key={w.memberId} className="py-1 border-b last:border-b-0 border-slate-100 dark:border-slate-700">
                        <p className="text-sm font-medium break-words">
                          {w.name} <span className={muted}>· by {BY_LABEL[w.by] ?? w.by}</span>
                        </p>
                        <ul className={`${muted} space-y-0.5`}>
                          {(Object.keys(FIELD_LABEL) as (keyof JciMalaysiaFields)[])
                            .filter(k => (w.before[k] ?? '') !== (w.after[k] ?? ''))
                            .map(k => (
                              <li key={k} className="break-words">
                                {FIELD_LABEL[k]}: <span className="font-mono">{show(w.before[k])}</span> → <span className="font-mono text-slate-800 dark:text-slate-100">{show(w.after[k])}</span>
                              </li>
                            ))}
                        </ul>
                      </div>
                    ))}
                  </Section>

                  <Section title="Conflicts — email and phone point to different records" count={preview.conflicts.length} defaultOpen={preview.conflicts.length > 0}>
                    {preview.conflicts.map(c => (
                      <ConflictRow key={c.memberId} conflict={c} busy={busy || loading} onSave={sourceId => savePick(c.memberId, sourceId)} />
                    ))}
                  </Section>

                  <Section title="Only in another chapter (skipped)" count={preview.otherChapter.length}>
                    {preview.otherChapter.map(o => (
                      <p key={o.memberId} className="text-sm break-words">{o.name} <span className={muted}>· {o.chapter}</span></p>
                    ))}
                  </Section>

                  <Section title="Not found in JCI Malaysia data" count={preview.notFound.length}>
                    {preview.notFound.map(n => <p key={n.memberId} className="text-sm break-words">{n.name}</p>)}
                  </Section>
                </>
              )}
            </LoadingState>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirming}
        variant="warning"
        title={`Apply ${toWrite} change${toWrite === 1 ? '' : 's'}?`}
        message="The server recomputes the changes, saves the old values as a backup run, then updates the members' JCI Malaysia fields."
        confirmLabel="Apply"
        onConfirm={runApply}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
};
