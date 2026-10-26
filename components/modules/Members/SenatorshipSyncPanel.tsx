/**
 * "Senatorship" tab of the unified JCI Malaysia sync modal — developer accounts only (the server checks again).
 * Back-fills jciCareer.senatorship.senatorNumber onto members from the JCI Malaysia snapshot. Board-validated
 * numbers are preserved. Preview (counts + per-member old → new) → Apply behind a confirm → result.
 * Rendered as a self-contained panel; the preview loads lazily the first time the tab becomes active.
 */
import React, { useEffect, useState } from 'react';
import { Button, useToast } from '../../ui/Common';
import { LoadingState } from '../../ui/Loading';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { useSenatorshipSync } from '../../../hooks/useSenatorshipSync';
import type { SenatorshipCounts } from '../../../services/senatorshipSyncService';

const card = 'rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800';
const muted = 'text-xs text-slate-500 dark:text-slate-400';

const Stat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className={`${card} px-3 py-2 min-w-0`}>
    <p className={`${muted} truncate`}>{label}</p>
    <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{value}</p>
  </div>
);

const Counts: React.FC<{ counts: SenatorshipCounts }> = ({ counts }) => (
  <>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Stat label="Members" value={counts.members} />
      <Stat label="Matched" value={counts.matched} />
      <Stat label="Would write" value={counts.wouldWrite} />
      <Stat label="Already same" value={counts.alreadySame} />
    </div>
    <p className={muted}>
      Preserved (board-validated) {counts.skippedBoardValidated} · no incoming value {counts.skippedNoValue} · conflicts {counts.conflicts} · unmatched {counts.unmatched}
    </p>
  </>
);

export const SenatorshipSyncPanel: React.FC<{ active: boolean }> = ({ active }) => {
  const { preview, result, loading, busy, error, loadPreview, apply } = useSenatorshipSync();
  const { showToast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);

  // Lazy: only read the (heavy) JCI Malaysia snapshot the first time this tab is opened.
  useEffect(() => {
    if (active && !loadedOnce) { setLoadedOnce(true); loadPreview(); }
  }, [active, loadedOnce, loadPreview]);

  const toWrite = preview?.counts.wouldWrite ?? 0;

  const runApply = async () => {
    setConfirming(false);
    try {
      const res = await apply();
      showToast(`Senatorship numbers: ${res.written} member(s) updated`, 'success');
    } catch {
      showToast('Senatorship sync failed', 'error');
    }
  };

  return (
    <div className="space-y-3">
      {result ? (
        <div className={`${card} p-4 space-y-2`}>
          <p className="text-base font-semibold">{result.written} member(s) updated</p>
          <p className={muted}>
            {result.runId ? <>Prior numbers saved as backup run <span className="font-mono break-all">{result.runId}</span>.</> : 'Nothing needed changing.'}
          </p>
          <Counts counts={result.counts} />
        </div>
      ) : (
        <LoadingState loading={loading && !preview} error={preview ? null : error} onRetry={loadPreview} loadingMessage="Reading JCI Malaysia senatorship data…">
          {preview && (
            <>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <p className={muted}>
                Preview only — nothing is written until you apply. Board-validated senator numbers are never overwritten; blanks are never written.
              </p>
              <Counts counts={preview.counts} />
              {preview.items && preview.items.length > 0 && (
                <div className="space-y-1">
                  <p className={muted}>Proposed changes ({preview.items.length}) — verify before applying:</p>
                  <div className={`${card} divide-y divide-slate-200 dark:divide-slate-700 max-h-64 overflow-y-auto`}>
                    {preview.items.map((it, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <span className="truncate text-slate-800 dark:text-slate-100">{it.name}</span>
                        <span className="font-mono text-xs whitespace-nowrap">
                          {it.before && <span className="text-slate-400 line-through mr-1.5">{it.before}</span>}
                          <span className="font-semibold text-slate-900 dark:text-slate-100">{it.incoming}</span>
                        </span>
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
          )}
        </LoadingState>
      )}

      <ConfirmDialog
        open={confirming}
        variant="warning"
        title={`Apply ${toWrite} change${toWrite === 1 ? '' : 's'}?`}
        message="The server recomputes the matches from the JCI Malaysia snapshot, saves a backup of the prior senator numbers, then writes jciCareer.senatorship.senatorNumber on the matching members. Board-validated numbers are preserved."
        confirmLabel="Apply"
        onConfirm={runApply}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
};
