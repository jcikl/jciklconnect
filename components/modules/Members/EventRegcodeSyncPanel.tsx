/**
 * "Event QR" tab of the unified JCI Malaysia sync modal — developer accounts only (the server checks again).
 * Two independent sections, each Load preview -> Apply, each reading the heavy JCI Malaysia event_participants
 * snapshot ONLY when the user clicks "Load preview" (never automatically on open or tab switch):
 *   1. Attach regcodes — copy jciMalaysiaRegcode onto EXISTING registrations.
 *   2. Back-fill missing registrations — CREATE registrations for KL members in a linked JCI Malaysia event who
 *      have no local registration yet (status always 'registered'; apply runs as a background function).
 */
import React, { useState } from 'react';
import { Button, useToast } from '../../ui/Common';
import { LoadingState } from '../../ui/Loading';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { useEventRegcodeSync } from '../../../hooks/useEventRegcodeSync';
import { useEventRegBackfill } from '../../../hooks/useEventRegBackfill';
import type { EventRegcodeCounts } from '../../../services/eventRegcodeService';
import type { BackfillCounts, BackfillResolution } from '../../../services/eventRegBackfillService';

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

// ---------------------------------------------------------------------------
// Section 1: attach regcodes onto existing registrations.
// ---------------------------------------------------------------------------
const RegcodeSection: React.FC = () => {
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
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Attach regcodes to existing registrations</p>
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

// ---------------------------------------------------------------------------
// Section 2: back-fill missing registrations (CREATE).
// ---------------------------------------------------------------------------
const BackfillCountsView: React.FC<{ counts: BackfillCounts }> = ({ counts }) => (
  <>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Stat label="Linked events" value={counts.linkedEvents} />
      <Stat label="Persons matched" value={counts.personsMatched} />
      <Stat label="Would create" value={counts.wouldCreate.total} />
      <Stat label="Already registered" value={counts.alreadyRegistered} />
    </div>
    <p className={muted}>
      Would create — approved {counts.wouldCreate.approved} · pending {counts.wouldCreate.pending} · committee {counts.wouldCreate.committee} · trainers {counts.wouldCreate.trainers} · conflicts {counts.conflicts}
    </p>
  </>
);

const BackfillSection: React.FC = () => {
  const { preview, resolutions, started, loading, busy, error, loadPreview, apply, setResolution } = useEventRegBackfill();
  const { showToast } = useToast();
  const [confirming, setConfirming] = useState(false);

  const toCreate = preview?.counts.wouldCreate.total ?? 0;

  const runApply = async () => {
    setConfirming(false);
    try {
      await apply();
      showToast(`Back-fill started in the background (~${toCreate} record${toCreate === 1 ? '' : 's'})`, 'success');
    } catch {
      showToast('Back-fill failed to start', 'error');
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Back-fill missing registrations</p>
      {started ? (
        <div className={`${card} p-4 space-y-2`}>
          <p className="text-base font-semibold">Back-fill started in the background (~{toCreate} record{toCreate === 1 ? '' : 's'}).</p>
          <p className={muted}>Re-run the preview in a minute to confirm — “Would create” drops toward 0 as it completes.</p>
          <Button variant="outline" onClick={loadPreview} disabled={loading}>Refresh preview</Button>
        </div>
      ) : preview ? (
        <>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <p className={muted}>
            Preview only — nothing is written until you apply. Creates registrations (status “registered”, no payment) for KL members who appear in a linked JCI Malaysia event but have none yet.
          </p>
          <BackfillCountsView counts={preview.counts} />
          {preview.conflicts.length > 0 && (
            <div className="space-y-1">
              <p className={muted}>Conflicts ({preview.conflicts.length}) — email and phone point to different members. Default: skip.</p>
              <div className={`${card} divide-y divide-slate-200 dark:divide-slate-700 max-h-56 overflow-y-auto`}>
                {preview.conflicts.map((c) => {
                  const key = c.key;
                  const choice: BackfillResolution = resolutions[key] ?? 'skip';
                  return (
                    <div key={key} className="px-3 py-2 text-sm space-y-1">
                      <span className="block font-mono text-xs text-slate-500 dark:text-slate-400">{c.label}</span>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {([['skip', 'Skip'], ['A', c.memberA.name], ['B', c.memberB.name]] as [BackfillResolution, string][]).map(([v, lbl]) => (
                          <label key={v} className="inline-flex items-center gap-1.5">
                            <input
                              type="radio"
                              name={key}
                              checked={choice === v}
                              onChange={() => setResolution(key, v)}
                            />
                            <span className="text-slate-800 dark:text-slate-100">{lbl}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {preview.detail.length > 0 && (
            <div className="space-y-1">
              <p className={muted}>Would create ({preview.detail.length}{toCreate > preview.detail.length ? ` of ${toCreate}` : ''}) — verify before applying:</p>
              <div className={`${card} divide-y divide-slate-200 dark:divide-slate-700 max-h-64 overflow-y-auto`}>
                {preview.detail.map((it, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate text-slate-800 dark:text-slate-100">{it.memberName ?? '—'}</span>
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{it.event}</span>
                    </span>
                    <span className="flex items-center gap-2 whitespace-nowrap text-xs">
                      <span className="rounded px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">{it.role}</span>
                      {it.hasRegcode && <span className="font-mono text-slate-500 dark:text-slate-400">QR</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <Button variant="outline" onClick={loadPreview} disabled={loading || busy}>Refresh</Button>
            <Button onClick={() => setConfirming(true)} disabled={loading || busy || !toCreate}>
              {busy ? 'Starting…' : `Create ${toCreate} registration${toCreate === 1 ? '' : 's'}`}
            </Button>
          </div>
        </>
      ) : (
        <LoadingState loading={loading} error={error} onRetry={loadPreview} loadingMessage="Reading JCI Malaysia participant data…">
          <div className={`${card} p-4 flex flex-col items-start gap-3`}>
            <p className={muted}>Reads every linked JCI Malaysia event and lists the registrations it would create. Runs only when you load it.</p>
            <Button onClick={loadPreview}>Load preview</Button>
          </div>
        </LoadingState>
      )}

      <ConfirmDialog
        open={confirming}
        variant="warning"
        title={`Create ${toCreate} registration${toCreate === 1 ? '' : 's'}?`}
        message="This runs in the background (it can take a minute). The server recomputes the plan from the JCI Malaysia snapshot, saves a backup run for rollback, then creates the registrations (status “registered”, no payment). Re-run the preview afterwards to confirm."
        confirmLabel="Start back-fill"
        onConfirm={runApply}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
};

export const EventRegcodeSyncPanel: React.FC = () => (
  <div className="space-y-5">
    <RegcodeSection />
    <div className="border-t border-slate-200 dark:border-slate-700" />
    <BackfillSection />
  </div>
);
