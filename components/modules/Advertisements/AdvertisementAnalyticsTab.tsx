import React from 'react';
import { Image as ImageIcon } from 'lucide-react';
import type { Advertisement } from '../../../services/advertisementService';
import { formatNumber } from '../../../utils/formatUtils';

interface AdvertisementAnalyticsTabProps {
  advertisements: Advertisement[];
  summary: {
    totalImpressions: number;
    totalClicks: number;
    totalBudget: number;
    avgCTR: number;
    activeAds: number;
  };
  filter: 'all' | 'active' | 'scheduled' | 'completed';
  onFilterChange: (filter: 'all' | 'active' | 'scheduled' | 'completed') => void;
  calculateCTR: (ad: Advertisement) => number;
  calculateROI: (ad: Advertisement) => {
    costPerClick: number;
    costPerImpression: number;
    totalSpent: number;
    estimatedValue: number;
  };
}

export const AdvertisementAnalyticsTab: React.FC<AdvertisementAnalyticsTabProps> = ({
  advertisements,
  summary,
  filter,
  onFilterChange,
  calculateCTR,
  calculateROI,
}) => {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const maxImpressions = Math.max(...advertisements.map(ad => ad.impressions), 1);
  const maxCTR = Math.max(...advertisements.map(ad => calculateCTR(ad)), 1);

  const FILTER_PILLS: { label: string; value: typeof filter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Completed', value: 'completed' },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Impressions</p>
          <p className="text-2xl font-black text-slate-900 tabular-nums">{formatNumber(summary.totalImpressions)}</p>
          <div className="w-full bg-slate-100 rounded-full h-1 mt-2">
            <div className="bg-jci-blue h-1 rounded-full" style={{ width: `${Math.min(summary.totalImpressions / 1000 * 100, 100)}%` }} />
          </div>
          <p className="text-[10px] text-slate-400">across {advertisements.length} partner{advertisements.length !== 1 ? 's' : ''}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Clicks</p>
          <p className="text-2xl font-black text-slate-900 tabular-nums">{formatNumber(summary.totalClicks)}</p>
          <div className="w-full bg-slate-100 rounded-full h-1 mt-2">
            <div className="bg-emerald-500 h-1 rounded-full" style={{ width: `${summary.totalImpressions > 0 ? Math.min((summary.totalClicks / summary.totalImpressions) * 100 * 20, 100) : 0}%` }} />
          </div>
          <p className="text-[10px] text-slate-400">{summary.totalImpressions > 0 ? ((summary.totalClicks / summary.totalImpressions) * 100).toFixed(1) : '0.0'}% of impressions</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Avg CTR</p>
          <p className={`text-2xl font-black tabular-nums ${summary.avgCTR >= 2 ? 'text-emerald-600' : summary.avgCTR >= 1 ? 'text-amber-500' : 'text-slate-900'}`}>
            {summary.avgCTR.toFixed(2)}%
          </p>
          <div className="w-full bg-slate-100 rounded-full h-1 mt-2">
            <div className={`h-1 rounded-full ${summary.avgCTR >= 2 ? 'bg-emerald-500' : summary.avgCTR >= 1 ? 'bg-amber-400' : 'bg-slate-400'}`}
              style={{ width: `${Math.min(summary.avgCTR / 5 * 100, 100)}%` }} />
          </div>
          <p className="text-[10px] text-slate-400">benchmark ~2%</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Active</p>
          <p className="text-2xl font-black text-slate-900 tabular-nums">{summary.activeAds}</p>
          <div className="flex gap-0.5 mt-2">
            {advertisements.map(ad => (
              <div key={ad.id} className={`h-1 flex-1 rounded-full ${ad.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-200'}`} />
            ))}
          </div>
          <p className="text-[10px] text-slate-400">of {advertisements.length} total</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {FILTER_PILLS.map(pill => (
          <button
            key={pill.value}
            onClick={() => onFilterChange(pill.value)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${filter === pill.value ? 'bg-jci-blue text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        {advertisements.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-10">No data</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="py-3 px-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Partner</th>
                <th className="py-3 px-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400 hidden sm:table-cell">Impressions</th>
                <th className="py-3 px-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400 hidden sm:table-cell">Clicks</th>
                <th className="py-3 px-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">CTR</th>
                <th className="py-3 px-2 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {advertisements.map(ad => {
                const ctr = calculateCTR(ad);
                const roi = calculateROI(ad);
                const isExpanded = expandedId === ad.id;
                return (
                  <React.Fragment key={ad.id}>
                    <tr
                      className="hover:bg-slate-50/60 cursor-pointer transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : (ad.id ?? null))}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                            {ad.logoUrl
                              ? <img src={ad.logoUrl} alt="" className="w-full h-full object-contain p-0.5" onError={(event) => { (event.target as HTMLImageElement).style.display = 'none'; }} />
                              : <ImageIcon size={13} className="text-slate-300" />
                            }
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 leading-tight">{ad.title}</p>
                            <span className={`text-[10px] font-bold ${ad.status === 'Active' ? 'text-emerald-600' : 'text-slate-400'}`}>{ad.status}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right hidden sm:table-cell">
                        <p className="font-semibold text-slate-700 tabular-nums text-xs">{formatNumber(ad.impressions)}</p>
                        <div className="w-20 bg-slate-100 rounded-full h-1 mt-1 ml-auto">
                          <div className="bg-jci-blue/40 h-1 rounded-full" style={{ width: `${(ad.impressions / maxImpressions) * 100}%` }} />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right hidden sm:table-cell">
                        <p className="font-semibold text-slate-700 tabular-nums text-xs">{formatNumber(ad.clicks)}</p>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold tabular-nums ${ctr >= 2 ? 'text-emerald-600' : ctr >= 1 ? 'text-amber-500' : 'text-slate-500'}`}>
                            {ctr.toFixed(1)}%
                          </span>
                          <div className="flex-1 max-w-[80px] bg-slate-100 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${ctr >= 2 ? 'bg-emerald-500' : ctr >= 1 ? 'bg-amber-400' : 'bg-slate-400'}`}
                              style={{ width: `${maxCTR > 0 ? (ctr / maxCTR) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-slate-50/70">
                        <td colSpan={5} className="px-4 py-4">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-white rounded-lg border border-slate-100 p-3">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Impressions</p>
                              <p className="text-lg font-black text-slate-900 tabular-nums">{formatNumber(ad.impressions)}</p>
                            </div>
                            <div className="bg-white rounded-lg border border-slate-100 p-3">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Clicks</p>
                              <p className="text-lg font-black text-slate-900 tabular-nums">{formatNumber(ad.clicks)}</p>
                            </div>
                            {ad.budget ? (
                              <>
                                <div className="bg-white rounded-lg border border-slate-100 p-3">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Budget</p>
                                  <p className="text-lg font-black text-slate-900 tabular-nums">RM {formatNumber(ad.budget)}</p>
                                </div>
                                <div className="bg-white rounded-lg border border-slate-100 p-3">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Cost/Click</p>
                                  <p className="text-lg font-black text-slate-900 tabular-nums">RM {roi.costPerClick.toFixed(2)}</p>
                                </div>
                              </>
                            ) : (
                              <div className="bg-white rounded-lg border border-slate-100 p-3 col-span-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">T&C</p>
                                <p className="text-xs text-slate-600 leading-relaxed">{ad.termsAndConditions || '—'}</p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
