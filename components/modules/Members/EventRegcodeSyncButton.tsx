/**
 * "Sync event QR codes" on the Member Directory header — developer accounts only (the server checks again).
 * Back-fills jciMalaysiaRegcode onto every eventRegistration from the JCI Malaysia event_participants snapshot.
 * Preview (counts only, no PII) → Apply behind a confirm → result.
 */
import React, { useEffect, useState } from 'react';
import { QrCode } from 'lucide-react';
import { Button, Modal, useToast } from '../../ui/Common';
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

export const EventRegcodeSyncButton: React.FC = () => {
  const { canSync, preview, result, loading, busy, error, loadPreview, apply, reset } = useEventRegcodeSync();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (open) loadPreview();
  }, [open, loadPreview]);

  if (!canSync) return null;

  const close = () => { setOpen(false); setConfirming(false); reset(); };
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

  const footer = result ? (
    <div className="flex justify-end w-full"><Button onClick={close}>Done</Button></div>
  ) : (
    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 w-full">
      <Button variant="outline" onClick={close}>Close</Button>
      <Button variant="outline" onClick={loadPreview} disabled={loading || busy}>Refresh</Button>
      <Button onClick={() => setConfirming(true)} disabled={loading || busy || !toWrite}>
        {busy ? 'Working…' : `Apply ${toWrite} change${toWrite === 1 ? '' : 's'}`}
      </Button>
    </div>
  );

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <QrCode size={14} className="mr-1.5" /> Sync event QR codes
      </Button>

      <Modal isOpen={open} onClose={close} title="Sync event QR codes" size="2xl" drawerOnMobile footer={footer}>
        {/* Own surface: the Modal shell is light-only, so the content carries both themes itself. */}
        <div className="space-y-3 rounded-lg p-2 sm:p-3 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
          {result ? (
            <div className={`${card} p-4 space-y-2`}>
              <p className="text-base font-semibold">{result.written} registration(s) updated</p>
              <p className={muted}>
                {result.runId ? <>Backup run <span className="font-mono break-all">{result.runId}</span>.</> : 'Nothing needed changing.'}
              </p>
              <Counts counts={result.counts} />
            </div>
          ) : (
            <LoadingState loading={loading && !preview} error={preview ? null : error} onRetry={loadPreview} loadingMessage="Reading JCI Malaysia check-in data…">
              {preview && (
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
        message="The server recomputes the matches from the JCI Malaysia snapshot, saves a backup run, then writes jciMalaysiaRegcode onto the matching registrations."
        confirmLabel="Apply"
        onConfirm={runApply}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
};
