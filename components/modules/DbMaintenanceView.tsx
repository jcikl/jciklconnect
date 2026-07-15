import React, { useState } from 'react';
import { collection, query, where, getDocs, writeBatch, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Database, Play, Eye, CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Common';

// ── Config ────────────────────────────────────────────────────────────────────
const OLD_LO_ID = 'default-lo';
const NEW_LO_ID = 'jcikl';
const BATCH_SIZE = 400;

// flat: query where('loId','==',OLD) then batch update { loId: NEW }
// nested: scan all docs, filter those with boardHistory[].loId == OLD, rewrite array
type ColKind = 'flat' | 'nested';

const MIGRATE_COLLECTIONS: { name: string; label: string; kind: ColKind; nestedField?: string }[] = [
  { name: 'members',              label: 'Members',               kind: 'flat' },
  { name: 'paymentRequests',      label: 'Payment Requests',      kind: 'flat' },
  { name: 'eventRegistrations',   label: 'Event Registrations',   kind: 'flat' },
  { name: 'incentiveSubmissions', label: 'Incentive Submissions',  kind: 'flat' },
  { name: 'loStarProgress',       label: 'LO Star Progress',       kind: 'flat' },
  { name: 'nonMemberLeads',       label: 'Non-Member Leads',       kind: 'flat' },
  { name: 'events',               label: 'Events',                 kind: 'flat' },
  { name: 'points',               label: 'Points',                 kind: 'flat' },
  { name: 'transactions',         label: 'Transactions',           kind: 'flat' },
  { name: 'bankAccounts',         label: 'Bank Accounts',          kind: 'flat' },
  { name: 'publications',         label: 'Publications',           kind: 'flat' },
  // nested: members.boardHistory[].loId — separate pass over all member docs
  { name: 'members__boardHistory', label: 'Members › boardHistory[].loId', kind: 'nested', nestedField: 'boardHistory' },
];

// ── Types ─────────────────────────────────────────────────────────────────────
type ColStatus = 'idle' | 'scanning' | 'migrating' | 'done' | 'error';

interface ColResult {
  status: ColStatus;
  count: number;
  updated: number;
  error?: string;
}

type Results = Record<string, ColResult>;

// ── Helpers ───────────────────────────────────────────────────────────────────
async function scanFlat(colName: string): Promise<number> {
  const snap = await getDocs(query(collection(db, colName), where('loId', '==', OLD_LO_ID)));
  return snap.size;
}

async function migrateFlat(
  colName: string,
  onProgress: (updated: number) => void,
): Promise<number> {
  const snap = await getDocs(query(collection(db, colName), where('loId', '==', OLD_LO_ID)));
  const docs = snap.docs;
  let updated = 0;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    docs.slice(i, i + BATCH_SIZE).forEach(d => batch.update(d.ref, { loId: NEW_LO_ID }));
    await batch.commit();
    updated += Math.min(BATCH_SIZE, docs.length - i);
    onProgress(updated);
  }
  return updated;
}

async function scanNested(colName: string, arrayField: string): Promise<number> {
  // boardHistory is only on members; scan the members collection
  const snap = await getDocs(collection(db, colName));
  return snap.docs.filter(d => {
    const arr: any[] = d.data()[arrayField] ?? [];
    return arr.some(item => item?.loId === OLD_LO_ID);
  }).length;
}

async function migrateNested(
  colName: string,
  arrayField: string,
  onProgress: (updated: number) => void,
): Promise<number> {
  const snap = await getDocs(collection(db, colName));
  const dirty = snap.docs.filter(d => {
    const arr: any[] = d.data()[arrayField] ?? [];
    return arr.some(item => item?.loId === OLD_LO_ID);
  });

  let updated = 0;
  for (let i = 0; i < dirty.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    dirty.slice(i, i + BATCH_SIZE).forEach(d => {
      const arr: any[] = d.data()[arrayField] ?? [];
      const patched = arr.map(item =>
        item?.loId === OLD_LO_ID ? { ...item, loId: NEW_LO_ID } : item
      );
      batch.update(d.ref, { [arrayField]: patched });
    });
    await batch.commit();
    updated += Math.min(BATCH_SIZE, dirty.length - i);
    onProgress(updated);
  }
  return updated;
}

// ── Component ─────────────────────────────────────────────────────────────────
export const DbMaintenanceView: React.FC = () => {
  const [results, setResults]     = useState<Results>({});
  const [running, setRunning]     = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [phase, setPhase]         = useState<'idle' | 'scanned' | 'done'>('idle');

  const patch = (col: string, update: Partial<ColResult>) =>
    setResults(prev => ({
      ...prev,
      [col]: { status: 'idle', count: 0, updated: 0, ...prev[col], ...update },
    }));

  // ── Scan ────────────────────────────────────────────────────────────────────
  const handleScan = async () => {
    setRunning(true);
    setConfirmed(false);
    setPhase('idle');
    setResults({});

    for (const col of MIGRATE_COLLECTIONS) {
      patch(col.name, { status: 'scanning' });
      try {
        const count = col.kind === 'nested'
          ? await scanNested(col.nestedField === 'boardHistory' ? 'members' : col.name, col.nestedField!)
          : await scanFlat(col.name);
        patch(col.name, { status: 'done', count });
      } catch (e: any) {
        patch(col.name, { status: 'error', error: e?.message ?? 'unknown' });
      }
    }

    setPhase('scanned');
    setRunning(false);
  };

  // ── Live migration ──────────────────────────────────────────────────────────
  const handleMigrate = async () => {
    if (!confirmed) return;
    setRunning(true);
    setPhase('idle');

    for (const col of MIGRATE_COLLECTIONS) {
      patch(col.name, { status: 'migrating', updated: 0 });
      try {
        let updated = 0;
        if (col.kind === 'nested') {
          updated = await migrateNested(
            col.nestedField === 'boardHistory' ? 'members' : col.name,
            col.nestedField!,
            u => patch(col.name, { updated: u }),
          );
        } else {
          updated = await migrateFlat(col.name, u => patch(col.name, { updated: u }));
        }
        const prevCount = results[col.name]?.count ?? updated;
        patch(col.name, { status: 'done', count: prevCount, updated });
      } catch (e: any) {
        patch(col.name, { status: 'error', error: e?.message ?? 'unknown' });
      }
    }

    setPhase('done');
    setRunning(false);
    setConfirmed(false);
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const totalFound   = Object.values(results).reduce((s, r) => s + r.count, 0);
  const totalUpdated = Object.values(results).reduce((s, r) => s + r.updated, 0);
  const hasErrors    = Object.values(results).some(r => r.status === 'error');
  const allDone      = phase === 'done';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
          <Database size={18} />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-800">Database Maintenance</h3>
          <p className="text-sm text-slate-500 mt-0.5">One-time migration tasks for production data.</p>
        </div>
      </div>

      {/* Migration card */}
      <div className="rounded-2xl border border-slate-200 overflow-hidden">
        {/* Card header */}
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800">Migrate <code className="font-mono text-xs bg-slate-200 px-1.5 py-0.5 rounded">loId</code> field</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Update all documents where <code className="font-mono text-[11px] bg-slate-100 px-1 rounded">loId == &quot;{OLD_LO_ID}&quot;</code>
              {' '}→{' '}
              <code className="font-mono text-[11px] bg-slate-100 px-1 rounded">&quot;{NEW_LO_ID}&quot;</code>
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleScan}
              disabled={running}
            >
              <span className="flex items-center gap-1.5">
                {running && phase === 'idle' ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                Scan
              </span>
            </Button>
          </div>
        </div>

        {/* Collection list */}
        <div className="divide-y divide-slate-50">
          {MIGRATE_COLLECTIONS.map(col => {
            const r = results[col.name];
            return (
              <div key={col.name} className="px-5 py-3 flex items-center gap-3">
                {/* Status icon */}
                <div className="w-5 shrink-0">
                  {!r                                 && <div className="w-2 h-2 rounded-full bg-slate-200 mx-auto" />}
                  {r?.status === 'scanning'           && <Loader2 size={14} className="animate-spin text-blue-400" />}
                  {r?.status === 'migrating'          && <Loader2 size={14} className="animate-spin text-amber-500" />}
                  {r?.status === 'done' && r.count === 0 && <CheckCircle2 size={14} className="text-slate-300" />}
                  {r?.status === 'done' && r.count > 0 && phase !== 'done' && <AlertTriangle size={14} className="text-amber-500" />}
                  {r?.status === 'done' && r.count > 0 && phase === 'done' && <CheckCircle2 size={14} className="text-emerald-500" />}
                  {r?.status === 'error'              && <XCircle size={14} className="text-rose-500" />}
                </div>

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-slate-700 font-medium">{col.label}</span>
                  <span className="ml-2 text-xs text-slate-400 font-mono">
                    {col.kind === 'nested' ? `members[].${col.nestedField}` : col.name}
                  </span>
                  {col.kind === 'nested' && (
                    <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded">nested</span>
                  )}
                  {r?.error && <p className="text-xs text-rose-500 mt-0.5 truncate">{r.error}</p>}
                </div>

                {/* Count badge */}
                {r && (
                  <div className="shrink-0 text-right">
                    {r.status === 'scanning' && (
                      <span className="text-xs text-slate-400">scanning…</span>
                    )}
                    {r.status === 'migrating' && (
                      <span className="text-xs text-amber-600 font-bold">
                        {r.updated}/{r.count} updated
                      </span>
                    )}
                    {r.status === 'done' && phase !== 'done' && (
                      <span className={`text-xs font-bold ${r.count > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                        {r.count > 0 ? `${r.count} to migrate` : 'clean'}
                      </span>
                    )}
                    {r.status === 'done' && phase === 'done' && (
                      <span className="text-xs font-bold text-emerald-600">
                        {r.updated > 0 ? `${r.updated} updated` : 'clean'}
                      </span>
                    )}
                    {r.status === 'error' && (
                      <span className="text-xs text-rose-500 font-bold">error</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer — confirm + run */}
        {phase === 'scanned' && totalFound > 0 && (
          <div className="px-5 py-4 border-t border-amber-100 bg-amber-50/60 space-y-3">
            <p className="text-sm text-amber-800 font-medium">
              <AlertTriangle size={14} className="inline mr-1.5 -mt-0.5" />
              Found <strong>{totalFound}</strong> document{totalFound !== 1 ? 's' : ''} to update across all collections.
              This cannot be undone.
            </p>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-slate-300 accent-amber-600"
                checked={confirmed}
                onChange={e => setConfirmed(e.target.checked)}
              />
              <span className="text-sm text-amber-900">
                I confirm: update <code className="font-mono text-xs">&quot;{OLD_LO_ID}&quot;</code> → <code className="font-mono text-xs">&quot;{NEW_LO_ID}&quot;</code> in all {totalFound} documents
              </span>
            </label>
            <Button
              variant="primary"
              size="sm"
              onClick={handleMigrate}
              disabled={!confirmed || running}
            >
              <span className="flex items-center gap-1.5">
                {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                Run Migration
              </span>
            </Button>
          </div>
        )}

        {phase === 'scanned' && totalFound === 0 && !hasErrors && (
          <div className="px-5 py-4 border-t border-emerald-100 bg-emerald-50/60">
            <p className="text-sm text-emerald-700 font-medium">
              <CheckCircle2 size={14} className="inline mr-1.5 -mt-0.5" />
              All collections are clean — no <code className="font-mono text-xs">&quot;{OLD_LO_ID}&quot;</code> documents found.
            </p>
          </div>
        )}

        {allDone && (
          <div className="px-5 py-4 border-t border-emerald-100 bg-emerald-50/60">
            <p className="text-sm text-emerald-700 font-medium">
              <CheckCircle2 size={14} className="inline mr-1.5 -mt-0.5" />
              Migration complete — <strong>{totalUpdated}</strong> document{totalUpdated !== 1 ? 's' : ''} updated.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
