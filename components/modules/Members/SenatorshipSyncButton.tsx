/**
 * "Sync senatorship numbers" on the Member Directory header — developer accounts only (the server checks again).
 * Back-fills jciCareer.senatorship.senatorNumber onto members from the JCI Malaysia snapshot. Board-validated
 * numbers are preserved. Preview (counts only, no PII) → Apply behind a confirm → result.
 */
import React, { useEffect, useState } from 'react';
import { Award } from 'lucide-react';
import { Button, Modal, useToast } from '../../ui/Common';
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

export const SenatorshipSyncButton: React.FC = () => {
  const { canSync, preview, result, loading, busy, error, loadPreview, apply, reset } = useSenatorshipSync();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (open) loadPreview();
  }, [open, loadPreview]);

  if (!canSync) return null;

  const close = () => { setOpen(false); setConfirming(false); reset(); };
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
        <Award size={14} className="mr-1.5" /> Sync senatorship numbers
      </Button>

      <Modal isOpen={open} onClose={close} title="Sync senatorship numbers" size="2xl" drawerOnMobile footer={footer}>
        {/* Own surface: the Modal shell is light-only, so the content carries both themes itself. */}
        <div className="space-y-3 rounded-lg p-2 sm:p-3 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
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
        message="The server recomputes the matches from the JCI Malaysia snapshot, saves a backup of the prior senator numbers, then writes jciCareer.senatorship.senatorNumber on the matching members. Board-validated numbers are preserved."
        confirmLabel="Apply"
        onConfirm={runApply}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
};
