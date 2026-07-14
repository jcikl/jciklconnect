import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { COLLECTIONS } from '../../config/constants';
import { Activity, RefreshCw, Database, Wifi, Trash2, PenLine, Copy, Check } from 'lucide-react';

type OpType = 'ALL' | 'READ' | 'WRITE' | 'DELETE' | 'LISTENER';

interface LogEntry {
  operation: string;
  source: string;
  caller: string;
  count: number;
  firstAt: Timestamp;
  lastAt: Timestamp;
}

interface LogDoc {
  id: string;
  flushedAt: Timestamp;
  totalOps: number;
  windowMs: number;
  entries: LogEntry[];
}

const OP_COLORS: Record<string, string> = {
  READ:     'bg-blue-100 text-blue-700',
  WRITE:    'bg-emerald-100 text-emerald-700',
  DELETE:   'bg-red-100 text-red-700',
  LISTENER: 'bg-purple-100 text-purple-700',
};

const OP_ICONS: Record<string, React.ReactNode> = {
  READ:     <Database size={11} />,
  WRITE:    <PenLine size={11} />,
  DELETE:   <Trash2 size={11} />,
  LISTENER: <Wifi size={11} />,
};

function fmtTime(ts: Timestamp | undefined): string {
  if (!ts) return '—';
  const d = ts.toDate();
  return d.toLocaleString('zh-MY', { hour12: false, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function copyDocAsText(doc: LogDoc): string {
  const lines = [`[${fmtTime(doc.flushedAt)}] totalOps=${doc.totalOps}`];
  doc.entries?.forEach(e => {
    lines.push(`  ${e.operation.padEnd(8)} x${e.count}  ${e.caller}  →  ${e.source}`);
  });
  return lines.join('\n');
}

export const SystemLogsView: React.FC = () => {
  const [logs, setLogs] = useState<LogDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<OpType>('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function handleCopy(doc: LogDoc, e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(copyDocAsText(doc)).then(() => {
      setCopied(doc.id);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  async function fetchLogs() {
    setLoading(true);
    setError(null);
    try {
      const q = query(
        collection(db, COLLECTIONS.SYSTEM_LOGS),
        orderBy('flushedAt', 'desc'),
        limit(100)
      );
      const snap = await getDocs(q);
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as LogDoc)));
    } catch (e: any) {
      setError(e.message ?? 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchLogs(); }, []);

  const filtered = logs.filter(doc => {
    if (filter === 'ALL') return true;
    return doc.entries?.some(e => e.operation === filter);
  });

  const totalReads = logs.reduce((sum, d) => sum + (d.entries?.filter(e => e.operation === 'READ').reduce((s, e) => s + e.count, 0) ?? 0), 0);
  const totalWrites = logs.reduce((sum, d) => sum + (d.entries?.filter(e => e.operation === 'WRITE').reduce((s, e) => s + e.count, 0) ?? 0), 0);
  const totalListeners = logs.reduce((sum, d) => sum + (d.entries?.filter(e => e.operation === 'LISTENER').reduce((s, e) => s + e.count, 0) ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Reads', value: totalReads, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Writes', value: totalWrites, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Listeners', value: totalListeners, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl px-3 py-2.5 text-center`}>
            <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-slate-500 font-medium">{s.label}</div>
            <div className="text-[10px] text-slate-400">last 100 flushes</div>
          </div>
        ))}
      </div>

      {/* Filter + Refresh */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {(['ALL', 'READ', 'WRITE', 'DELETE', 'LISTENER'] as OpType[]).map(op => (
            <button
              key={op}
              onClick={() => setFilter(op)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                filter === op ? 'bg-jci-blue text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {op}
            </button>
          ))}
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-jci-blue transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          刷新
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {/* Log list */}
      {loading && !logs.length ? (
        <div className="text-center py-12 text-slate-400 text-sm">加载中…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          暂无记录。确认系统在生产模式下运行，使用一下功能后再刷新。
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(doc => {
            const isOpen = expanded === doc.id;
            const visibleEntries = filter === 'ALL' ? doc.entries : doc.entries?.filter(e => e.operation === filter);
            return (
              <div key={doc.id} className="border border-slate-100 rounded-xl overflow-hidden">
                {/* Row header */}
                <button
                  onClick={() => setExpanded(isOpen ? null : doc.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Activity size={14} className="text-slate-400 shrink-0" />
                    <span className="text-xs font-mono text-slate-600 truncate">{fmtTime(doc.flushedAt)}</span>
                    <span className="text-xs text-slate-400 shrink-0">{doc.totalOps} ops</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {['READ','WRITE','DELETE','LISTENER'].map(op => {
                      const cnt = doc.entries?.filter(e => e.operation === op).reduce((s, e) => s + e.count, 0) ?? 0;
                      if (!cnt) return null;
                      return (
                        <span key={op} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${OP_COLORS[op]}`}>
                          {OP_ICONS[op]}{cnt}
                        </span>
                      );
                    })}
                    <button
                      onClick={(e) => handleCopy(doc, e)}
                      className="ml-1 p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                      title="复制日志"
                    >
                      {copied === doc.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    </button>
                  </div>
                </button>

                {/* Expanded entries */}
                {isOpen && (
                  <div className="border-t border-slate-100 divide-y divide-slate-50">
                    {visibleEntries?.map((entry, i) => (
                      <div key={i} className="px-4 py-2.5 flex items-start gap-3">
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 mt-0.5 ${OP_COLORS[entry.operation] ?? 'bg-slate-100 text-slate-600'}`}>
                          {OP_ICONS[entry.operation]}{entry.operation}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-slate-700 truncate">{entry.caller}</div>
                          <div className="text-[11px] text-slate-400 truncate">{entry.source}</div>
                        </div>
                        <span className="shrink-0 text-xs font-black text-slate-500">×{entry.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
