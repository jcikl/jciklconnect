import React, { useEffect, useMemo, useState } from 'react';
import { Clock, Eye, Globe, UserPlus } from 'lucide-react';
import { GuestAnalyticsService, type GuestPageSummary, GUEST_PAGE_LABELS } from '../../../services/guestAnalyticsService';
import { formatNumber } from '../../../utils/formatUtils';

const formatDwell = (seconds: number): string => {
  if (seconds <= 0) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
};

export const GuestPageAnalyticsSection: React.FC = () => {
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const [rows, setRows] = useState<GuestPageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    GuestAnalyticsService.getSummary(range)
      .then(data => { if (!cancelled) setRows(data); })
      .catch(err => { if (!cancelled) setError(err?.message || 'Failed to load guest analytics'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [range]);

  const totals = useMemo(() => rows.reduce(
    (acc, row) => ({
      views: acc.views + row.views,
      signupClicks: acc.signupClicks + row.signupClicks,
      dwellSeconds: acc.dwellSeconds + row.dwellSeconds,
    }),
    { views: 0, signupClicks: 0, dwellSeconds: 0 }
  ), [rows]);
  const maxViews = Math.max(...rows.map(row => row.views), 1);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Globe size={15} className="text-jci-blue" />
          <h3 className="text-sm font-black text-slate-900">Guest Page Analytics</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {([7, 30, 90] as const).map(days => (
            <button
              key={days}
              onClick={() => setRange(days)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${range === days ? 'bg-jci-blue text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              {days}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Eye size={12} />
            <p className="text-[10px] font-black uppercase tracking-widest">Page Views</p>
          </div>
          <p className="text-2xl font-black text-slate-900 tabular-nums">{formatNumber(totals.views)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Clock size={12} />
            <p className="text-[10px] font-black uppercase tracking-widest">Avg Dwell</p>
          </div>
          <p className="text-2xl font-black text-slate-900 tabular-nums">
            {formatDwell(totals.views > 0 ? Math.round(totals.dwellSeconds / totals.views) : 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-400">
            <UserPlus size={12} />
            <p className="text-[10px] font-black uppercase tracking-widest">Sign Up Clicks</p>
          </div>
          <p className="text-2xl font-black text-slate-900 tabular-nums">{formatNumber(totals.signupClicks)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        {loading ? (
          <p className="text-center text-slate-400 text-sm py-10">Loading…</p>
        ) : error ? (
          <p className="text-center text-red-400 text-sm py-10">{error}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="py-3 px-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Page</th>
                <th className="py-3 px-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Views</th>
                <th className="py-3 px-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Avg Dwell</th>
                <th className="py-3 px-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Sign Ups</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map(row => (
                <tr key={row.page} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4">
                    <p className="font-semibold text-slate-900">{GUEST_PAGE_LABELS[row.page]}</p>
                    <div className="w-24 bg-slate-100 rounded-full h-1 mt-1.5">
                      <div className="bg-jci-blue/50 h-1 rounded-full" style={{ width: `${(row.views / maxViews) * 100}%` }} />
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-700 tabular-nums text-xs">{formatNumber(row.views)}</td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-700 tabular-nums text-xs">{formatDwell(row.avgDwellSeconds)}</td>
                  <td className="py-3 px-4 text-right">
                    <span className={`text-xs font-bold tabular-nums ${row.signupClicks > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {formatNumber(row.signupClicks)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
