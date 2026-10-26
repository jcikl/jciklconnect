/**
 * "Membership" tab of the unified JCI Malaysia sync modal — developer accounts only (the server checks again).
 * Syncs selectable JCI Malaysia fields onto members. The three match keys (user id / membership no. / join date)
 * are always written on a match; everything else is opt-in via checkboxes. Core profile fields (name / gender /
 * dob / email / phone) only FILL A BLANK — they never overwrite a value we already hold. The preview reads a heavy
 * snapshot, so it runs ONLY when the user clicks "Load preview". Preview (counts, per-field changes, conflicts with
 * A/B picks, other chapter, not found) → pick which fields → Apply behind a confirm.
 */
import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button, Badge, useToast } from '../../ui/Common';
import { LoadingState } from '../../ui/Loading';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { useJciMalaysiaSync } from '../../../hooks/useJciMalaysiaSync';
import type { JciMalaysiaCandidate, JciMalaysiaConflict, JciMalaysiaSyncPreview } from '../../../services/jciMalaysiaSyncService';

const BY_LABEL: Record<string, string> = {
  manual: 'manual pick', userId: 'user id', membershipNo: 'membership no.', email: 'email', phone: 'phone',
};
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

/** One selectable-field checkbox with how many members it would change. `always` fields are locked on. */
const FieldToggle: React.FC<{ label: string; count: number; checked: boolean; always?: boolean; onToggle?: () => void }> = ({ label, count, checked, always, onToggle }) => (
  <label className={`flex items-center gap-2 rounded-md border px-2 py-1.5 min-w-0 ${always ? 'opacity-70 cursor-default' : 'cursor-pointer'} ${checked ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30' : 'border-slate-200 dark:border-slate-700'}`}>
    <input type="checkbox" checked={checked} disabled={always} onChange={onToggle} />
    <span className="min-w-0 flex-1 text-sm text-slate-800 dark:text-slate-100 truncate">{label}{always && <span className={`ml-1 ${muted}`}>(always)</span>}</span>
    <Badge variant={count ? 'info' : 'neutral'}>{count}</Badge>
  </label>
);

export const MembershipSyncPanel: React.FC = () => {
  const { preview, result, loading, busy, error, loadPreview, pick, apply } = useJciMalaysiaSync();
  const { showToast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const initedFor = useRef<JciMalaysiaSyncPreview | null>(null);

  // When a fresh preview arrives, default-check the low-risk JCIM-only fields; leave core profile fields unchecked.
  useEffect(() => {
    if (preview && initedFor.current !== preview) {
      initedFor.current = preview;
      setSelected(new Set(preview.fieldCatalog.filter(f => !f.always && !f.core).map(f => f.key)));
    }
  }, [preview]);

  const alwaysKeys = preview ? preview.fieldCatalog.filter(f => f.always).map(f => f.key) : [];
  const active = new Set<string>([...alwaysKeys, ...selected]);
  const countFor = (key: string) => (preview ? preview.writes.filter(w => w.fields.some(f => f.key === key)).length : 0);
  const activeWrites = preview ? preview.writes.filter(w => w.fields.some(f => active.has(f.key))) : [];
  const toWrite = activeWrites.length;

  const selectableJcim = preview ? preview.fieldCatalog.filter(f => !f.always && !f.core) : [];
  const selectableCore = preview ? preview.fieldCatalog.filter(f => !f.always && f.core) : [];
  const toggle = (key: string) => setSelected(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });

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
      const res = await apply([...selected]);
      showToast(`JCI Malaysia sync: ${res.written} member(s) updated`, 'success');
    } catch {
      showToast('JCI Malaysia sync failed', 'error');
    }
  };

  return (
    <div className="space-y-3">
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
      ) : preview ? (
        <>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <p className={muted}>
            Preview only — nothing is written until you apply. {preview.sourceRows} JCI Malaysia records read.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="KL members" value={preview.counts.members} />
            <Stat label="To update" value={toWrite} />
            <Stat label="Conflicts" value={preview.counts.conflict} />
            <Stat label="Not found" value={preview.counts.none} />
          </div>
          <p className={muted}>
            Matched by manual pick {preview.counts.byManual} · user id {preview.counts.byUserId} · membership no. {preview.counts.byMembershipNo} · email {preview.counts.byEmail} · phone {preview.counts.byPhone}
          </p>

          <div className={`${card} p-3 space-y-2`}>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Fields to load</p>
            <p className={muted}>The three match keys are always written. Tick the extra fields you want. The count is how many members each would change.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {preview.fieldCatalog.filter(f => f.always).map(f => (
                <FieldToggle key={f.key} label={f.label} count={countFor(f.key)} checked always />
              ))}
            </div>
            {selectableJcim.length > 0 && (
              <>
                <p className={`${muted} pt-1`}>JCI Malaysia info (new fields — never touch our own data)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {selectableJcim.map(f => (
                    <FieldToggle key={f.key} label={f.label} count={countFor(f.key)} checked={selected.has(f.key)} onToggle={() => toggle(f.key)} />
                  ))}
                </div>
              </>
            )}
            {selectableCore.length > 0 && (
              <>
                <p className={`${muted} pt-1`}>Core profile (fills a blank only — never overwrites a value we already have)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {selectableCore.map(f => (
                    <FieldToggle key={f.key} label={f.label} count={countFor(f.key)} checked={selected.has(f.key)} onToggle={() => toggle(f.key)} />
                  ))}
                </div>
              </>
            )}
          </div>

          <Section title="Changes (selected fields)" count={toWrite} defaultOpen={toWrite > 0 && toWrite <= 30}>
            {activeWrites.map(w => (
              <div key={w.memberId} className="py-1 border-b last:border-b-0 border-slate-100 dark:border-slate-700">
                <p className="text-sm font-medium break-words">
                  {w.name} <span className={muted}>· by {BY_LABEL[w.by] ?? w.by}</span>
                </p>
                <ul className={`${muted} space-y-0.5`}>
                  {w.fields.filter(f => active.has(f.key)).map(f => (
                    <li key={f.key} className="break-words">
                      {f.label}: <span className="font-mono">{show(f.before)}</span> → <span className="font-mono text-slate-800 dark:text-slate-100">{show(f.after)}</span>
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

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <Button variant="outline" onClick={loadPreview} disabled={loading || busy}>
              <RefreshCw size={14} className="mr-1.5" /> Refresh
            </Button>
            <Button onClick={() => setConfirming(true)} disabled={loading || busy || !toWrite}>
              {busy ? 'Working…' : `Apply ${toWrite} change${toWrite === 1 ? '' : 's'}`}
            </Button>
          </div>
        </>
      ) : (
        <LoadingState loading={loading} error={error} onRetry={loadPreview} loadingMessage="Reading JCI Malaysia data…">
          <div className={`${card} p-4 flex flex-col items-start gap-3`}>
            <p className={muted}>Reading the JCI Malaysia snapshot can take several seconds. It runs only when you load it.</p>
            <Button onClick={loadPreview}>Load preview</Button>
          </div>
        </LoadingState>
      )}

      <ConfirmDialog
        open={confirming}
        variant="warning"
        title={`Apply ${toWrite} change${toWrite === 1 ? '' : 's'}?`}
        message="The server recomputes the changes for the selected fields, saves the old values as a backup run, then updates the members. Core profile fields only fill a blank; they never overwrite a value you already have."
        confirmLabel="Apply"
        onConfirm={runApply}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
};
