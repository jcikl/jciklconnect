import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, RefreshCw, CheckCircle } from 'lucide-react';
import { Modal, Button, useToast } from '../../ui/Common';
import { Select } from '../../ui/Form';
import { Combobox } from '../../ui/Combobox';

type CategoryType = 'Projects & Activities' | 'Membership' | 'Administrative' | '';

interface ReclassGroup {
  loId: string | null;
  category: string;
  projectId: string | null;
  unmatchedProjectTitle: string | null;
  count: number;
}

interface RuleRow extends ReclassGroup {
  newCategory: CategoryType;
  newProjectId: string | null;
  dirty: boolean;
}

const CATEGORY_OPTIONS = [
  { label: 'Projects & Activities', value: 'Projects & Activities' },
  { label: 'Membership', value: 'Membership' },
  { label: 'Administrative', value: 'Administrative' },
  { label: '(no category)', value: '' },
];

interface BatchReclassifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Array<{ id: string; name: string; hostingLo?: string }>;
  loadReclassificationGroups: () => Promise<ReclassGroup[]>;
  handleBatchReclassify: (rules: {
    matchLoId: string | null;
    matchCategory: string;
    matchProjectId: string | null;
    matchUnmatchedProjectTitle?: string | null;
    newCategory: string;
    newProjectId: string | null;
  }[]) => Promise<{ updated: number }>;
  handleBackfillLoId: () => Promise<{ updated: number }>;
}

export const BatchReclassifyModal: React.FC<BatchReclassifyModalProps> = ({
  isOpen,
  onClose,
  projects,
  loadReclassificationGroups,
  handleBatchReclassify,
  handleBackfillLoId,
}) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [rows, setRows] = useState<RuleRow[]>([]);
  const [missingLoIdCount, setMissingLoIdCount] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showMatched, setShowMatched] = useState(false);

  const projectOptions = projects.map(p => p.hostingLo ? `${p.name} [${p.hostingLo}]` : p.name);
  const projectByOption = new Map(projects.map(p => [p.hostingLo ? `${p.name} [${p.hostingLo}]` : p.name, p.id]));
  const projectById = new Map(projects.map(p => [p.id, p.hostingLo ? `${p.name} [${p.hostingLo}]` : p.name]));

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const groups = await loadReclassificationGroups();
      const missing = groups.filter(g => !g.loId).reduce((s, g) => s + g.count, 0);
      setMissingLoIdCount(missing);
      setRows(groups.map(g => ({
        ...g,
        newCategory: g.category as CategoryType,
        newProjectId: g.projectId,
        dirty: false,
      })));
    } catch {
      showToast('Failed to load transaction groups', 'error');
    } finally {
      setLoading(false);
    }
  }, [loadReclassificationGroups, showToast]);

  useEffect(() => {
    if (isOpen) loadGroups();
  }, [isOpen, loadGroups]);

  const dirtyRows = rows.filter(r => r.dirty);
  const totalAffected = dirtyRows.reduce((s, r) => s + r.count, 0);
  const matchedCount = rows.filter(r => r.projectId !== null).length;
  const displayRows = showMatched
    ? rows.map((r, i) => ({ row: r, originalIndex: i }))
    : rows.map((r, i) => ({ row: r, originalIndex: i })).filter(({ row }) => row.projectId === null);

  const handleCategoryChange = (index: number, value: string) => {
    setRows(prev => prev.map((r, i) => i === index
      ? { ...r, newCategory: value as CategoryType, dirty: true }
      : r
    ));
  };

  const handleProjectChange = (index: number, name: string) => {
    const id = projectByOption.get(name) ?? null;
    setRows(prev => prev.map((r, i) => i === index
      ? { ...r, newProjectId: id, dirty: true }
      : r
    ));
  };

  const handleApply = async () => {
    setSaving(true);
    setConfirmOpen(false);
    try {
      const rules = dirtyRows.map(r => ({
        matchLoId: r.loId,
        matchCategory: r.category,
        matchProjectId: r.projectId,
        matchUnmatchedProjectTitle: r.unmatchedProjectTitle,
        newCategory: r.newCategory,
        newProjectId: r.newProjectId,
      }));
      const { updated } = await handleBatchReclassify(rules);
      showToast(`Updated ${updated} transaction${updated !== 1 ? 's' : ''}`, 'success');
      onClose();
    } catch {
      showToast('Batch reclassification failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleBackfill = async () => {
    setBackfilling(true);
    try {
      const { updated } = await handleBackfillLoId();
      showToast(`Fixed LO ID on ${updated} transaction${updated !== 1 ? 's' : ''}`, 'success');
      await loadGroups();
    } catch {
      showToast('Backfill failed', 'error');
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Batch Reclassify Transactions" size="xl">
      <div className="space-y-4">

        {/* Missing loId banner */}
        {missingLoIdCount !== null && missingLoIdCount > 0 && (
          <div className="flex items-center justify-between gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertTriangle size={15} className="shrink-0" />
              <span>
                <strong>{missingLoIdCount}</strong> transaction{missingLoIdCount !== 1 ? 's are' : ' is'} missing LO identifier
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBackfill}
              disabled={backfilling}
              className="shrink-0 text-amber-700 border-amber-300 hover:bg-amber-100"
            >
              {backfilling ? <RefreshCw size={13} className="animate-spin mr-1" /> : <CheckCircle size={13} className="mr-1" />}
              Fix All
            </Button>
          </div>
        )}

        {/* Rows */}
        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-400 text-sm">
            <RefreshCw size={16} className="animate-spin mr-2" /> Loading groups…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">No transaction groups found.</p>
        ) : (
          <>
            {/* Toggle matched */}
            {matchedCount > 0 && (
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowMatched(v => !v)}
                  className="text-xs text-slate-500 hover:text-jci-blue transition-colors"
                >
                  {showMatched ? `隐藏已匹配项（${matchedCount}）` : `显示已匹配项（${matchedCount}）`}
                </button>
              </div>
            )}

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto overflow-y-auto max-h-[50vh] border border-slate-100 rounded-xl">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="py-2.5 px-3 text-left font-semibold text-slate-600 uppercase tracking-wide">LO</th>
                    <th className="py-2.5 px-3 text-left font-semibold text-slate-600 uppercase tracking-wide">Current Category</th>
                    <th className="py-2.5 px-3 text-left font-semibold text-slate-600 uppercase tracking-wide">Current Project</th>
                    <th className="py-2.5 px-3 text-right font-semibold text-slate-600 uppercase tracking-wide">Txs</th>
                    <th className="py-2.5 px-3 text-left font-semibold text-slate-600 uppercase tracking-wide">New Category</th>
                    <th className="py-2.5 px-3 text-left font-semibold text-slate-600 uppercase tracking-wide">New Project</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {displayRows.map(({ row, originalIndex }) => (
                    <tr key={originalIndex} className={row.dirty ? 'bg-blue-50/50' : 'hover:bg-slate-50/50'}>
                      <td className="py-2 px-3 font-mono text-slate-500">{row.loId || <span className="text-amber-500">—</span>}</td>
                      <td className="py-2 px-3 text-slate-600">{row.category || <span className="italic text-slate-400">none</span>}</td>
                      <td className="py-2 px-3 text-slate-500 max-w-[160px]">
                        {row.projectId
                          ? <span className="truncate block">{projectById.get(row.projectId) ?? row.projectId}</span>
                          : row.unmatchedProjectTitle
                            ? <span className="flex flex-col gap-0.5"><span className="truncate text-amber-700 font-medium">{row.unmatchedProjectTitle}</span><span className="text-[10px] text-amber-500">未匹配</span></span>
                            : <span className="italic text-slate-400">—</span>}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-slate-700">{row.count}</td>
                      <td className="py-2 px-3 min-w-[170px]">
                        <Select name={`cat-${originalIndex}`} value={row.newCategory} onChange={e => handleCategoryChange(originalIndex, e.target.value)} options={CATEGORY_OPTIONS} label="" />
                      </td>
                      <td className="py-2 px-3 min-w-[180px]">
                        <Combobox options={projectOptions} value={row.newProjectId ? (projectById.get(row.newProjectId) ?? '') : ''} onChange={val => handleProjectChange(originalIndex, val)} placeholder="— no project —" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2 overflow-y-auto max-h-[55vh]">
              {displayRows.map(({ row, originalIndex }) => (
                <div key={originalIndex} className={`rounded-xl border p-3 space-y-2.5 text-sm ${row.dirty ? 'border-blue-200 bg-blue-50/40' : 'border-slate-100 bg-white'}`}>
                  {/* Header row: LO + category + count */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {row.loId || <span className="text-amber-500">—</span>}
                    </span>
                    <span className="text-xs text-slate-500">{row.category || <span className="italic text-slate-400">none</span>}</span>
                    <span className="ml-auto font-mono font-bold text-slate-700 text-xs">{row.count} txs</span>
                  </div>
                  {/* Current project */}
                  <div className="text-xs text-slate-500">
                    {row.projectId
                      ? <span className="truncate block">{projectById.get(row.projectId) ?? row.projectId}</span>
                      : row.unmatchedProjectTitle
                        ? <span className="text-amber-700 font-medium">{row.unmatchedProjectTitle} <span className="text-amber-400 font-normal">未匹配</span></span>
                        : <span className="italic text-slate-400">— no project —</span>}
                  </div>
                  {/* New selectors */}
                  <div className="space-y-1.5">
                    <Select name={`cat-m-${originalIndex}`} value={row.newCategory} onChange={e => handleCategoryChange(originalIndex, e.target.value)} options={CATEGORY_OPTIONS} label="" />
                    <Combobox options={projectOptions} value={row.newProjectId ? (projectById.get(row.newProjectId) ?? '') : ''} onChange={val => handleProjectChange(originalIndex, val)} placeholder="— no project —" />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="flex flex-col gap-2 pt-2 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-slate-500">
            {dirtyRows.length > 0
              ? `${dirtyRows.length} group${dirtyRows.length !== 1 ? 's' : ''} modified — ${totalAffected} transaction${totalAffected !== 1 ? 's' : ''} will be updated`
              : 'Edit rows above to stage changes'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving} className="flex-1 md:flex-none">Cancel</Button>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={dirtyRows.length === 0 || saving}
              className="flex-1 md:flex-none"
            >
              {saving ? <><RefreshCw size={13} className="animate-spin mr-1.5" />Applying…</> : 'Apply Changes'}
            </Button>
          </div>
        </div>
      </div>

      {/* Confirm dialog */}
      <Modal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm Batch Update" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            This will update <strong>{totalAffected}</strong> transaction{totalAffected !== 1 ? 's' : ''} across{' '}
            <strong>{dirtyRows.length}</strong> group{dirtyRows.length !== 1 ? 's' : ''}. This cannot be undone.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Back</Button>
            <Button onClick={handleApply} disabled={saving}>Confirm</Button>
          </div>
        </div>
      </Modal>
    </Modal>
  );
};
