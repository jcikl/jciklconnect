/**
 * "Event QR" tab of the unified JCI Malaysia sync modal — developer accounts only (the server checks again).
 * Back-fills jciMalaysiaRegcode onto every eventRegistration from the JCI Malaysia event_participants snapshot.
 * The preview reads a heavy snapshot, so it runs ONLY when the user clicks "Load preview" (never automatically on
 * open or tab switch). Preview (counts + per-registration member · event — code) → Apply behind a confirm.
 */
import React, { useState } from 'react';
import { Button, useToast } from '../../ui/Common';
import { LoadingState } from '../../ui/Loading';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { useEventRegcodeSync } from '../../../hooks/useEventRegcodeSync';
import type { EventRegcodeCounts } from '../../../services/eventRegcodeService';

const card = 'rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800';
const muted = 'text-xs text-slate-500 dark:text-slate-400';

const Stat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className={`${card} px-3 py-2 min-w-0`}>
    <p className={`${muted} truncate`}>{label}</p>
    <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{value}</p>
  </div>
);

const Counts: React.FC<{ counts: EventRegcodeCounts }> = ({ counts }) => (
  <>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Stat label="Registrations" value={counts.registrations} />
      <Stat label="Linkable (roadmapId)" value={counts.linkable} />
      <Stat label="Would get code" value={counts.wouldGetRegcode} />
      <Stat label="To write" value={counts.toWrite} />
    </div>
    <p className={muted}>
      Conflicts {counts.conflicts} · already set {counts.alreadySet} · no event in snapshot {counts.eventNotInSnapshot} · member not in list {counts.memberNotInList} · no roadmapId {counts.noRoadmapId}
    </p>
  </>
);

export const EventRegcodeSyncPanel: React.FC = () => {
  const { preview, result, loading, busy, error, loadPreview, apply } = useEventRegcodeSync();
  const { showToast } = useToast();
  const [confirming, setConfirming] = useState(false);

  const toWrite = preview?.counts.toWrite ?? 0;

  const runApply = async () => {
    setConfirming(false);
    try {
      const res = await apply();
      showToast(`Event QR codes: ${res.written} registration(s) updated`, 'success');
    } catch {
      showToast('Event QR code sync failed', 'error');
    }
  };

  return (
    <div className="space-y-3">
      {result ? (
        <div className={`${card} p-4 space-y-2`}>
          <p className="text-base font-semibold">{result.written} registration(s) updated</p>
          <p className={muted}>
            {result.runId ? <>Backup run <span className="font-mono break-all">{result.runId}</span>.</> : 'Nothing needed changing.'}
          </p>
          <Counts counts={result.counts} />
        </div>
      ) : preview ? (
        <>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <p className={muted}>
            Preview only — nothing is written until you apply. Each matched member's regcode is copied onto their own registration; the QR is regenerated from it in the app.
          </p>
          <Counts counts={preview.counts} />
          {preview.items && preview.items.length > 0 && (
            <div className="space-y-1">
              <p className={muted}>Proposed changes ({preview.items.length}) — verify before applying:</p>
              <div className={`${card} divide-y divide-slate-200 dark:divide-slate-700 max-h-64 overflow-y-auto`}>
                {preview.items.map((it, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate text-slate-800 dark:text-slate-100">{it.member}</span>
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{it.event}</span>
                    </span>
                    <span className="font-mono font-semibold whitespace-nowrap text-slate-900 dark:text-slate-100">{it.regcode}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <Button variant="outline" onClick={loadPreview} disabled={loading || busy}>Refresh</Button>
            <Button onClick={() => setConfirming(true)} disabled={loading || busy || !toWrite}>
              {busy ? 'Working…' : `Apply ${toWrite} change${toWrite === 1 ? '' : 's'}`}
            </Button>
          </div>
        </>
      ) : (
        <LoadingState loading={loading} error={error} onRetry={loadPreview} loadingMessage="Reading JCI Malaysia check-in data…">
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
        message="The server recomputes the matches from the JCI Malaysia snapshot, saves a backup run, then writes jciMalaysiaRegcode onto the matching registrations."
        confirmLabel="Apply"
        onConfirm={runApply}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
};
