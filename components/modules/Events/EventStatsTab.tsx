import React from 'react';
import { Copy } from 'lucide-react';
import type { Member } from '../../../types';
import type { EventRegistration } from '../../../types';

export interface EventStatsTabProps {
  participations: EventRegistration[];
  members: Member[];
  showToast: (message: string, variant: 'success' | 'error' | 'info' | 'warning') => void;
}

const EventStatsTabBase: React.FC<EventStatsTabProps> = ({ participations, members, showToast }) => {
  const allRegs = participations;
  const activeRegs = allRegs.filter(r => r.status !== 'cancelled');
  const totalRegistered = allRegs.filter(r => r.status === 'registered').length;
  const totalPaid = allRegs.filter(r => r.status === 'paid').length;
  const totalCheckedIn = allRegs.filter(r => r.status === 'checked_in').length;
  const totalCancelled = allRegs.filter(r => r.status === 'cancelled').length;
  const totalActive = activeRegs.length;

  const dietaryCounts = { normal: 0, vegetarian: 0, halal: 0, unspecified: 0 };
  activeRegs.forEach(r => {
    const mem = members.find(m => m.id === r.memberId);
    const dietary = r.dietary ?? ((mem?.general?.dietaryPreference ?? mem?.dietaryPreference) as 'normal' | 'vegetarian' | 'halal' | null | undefined) ?? null;
    if (dietary === 'vegetarian') dietaryCounts.vegetarian++;
    else if (dietary === 'halal') dietaryCounts.halal++;
    else if (dietary === 'normal') dietaryCounts.normal++;
    else dietaryCounts.unspecified++;
  });

  const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
  const sizeCounts = activeRegs.reduce<Record<string, number>>((acc, r) => {
    const mem = members.find(m => m.id === r.memberId);
    const size = r.tshirtSize ?? mem?.tshirtSize ?? null;
    if (size) acc[size] = (acc[size] ?? 0) + 1;
    return acc;
  }, {});
  const sizes = Object.entries(sizeCounts).sort(([a], [b]) => {
    const ai = sizeOrder.indexOf(a), bi = sizeOrder.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  const sizeUnspecified = totalActive - sizes.reduce((s, [, c]) => s + c, 0);

  const pct = (n: number, total: number) => total === 0 ? 0 : Math.round((n / total) * 100);

  return (
    <div className="animate-fade-in space-y-4">
      {/* Summary tiles */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Registered', value: totalActive, color: 'text-slate-800' },
          { label: 'Pending Pay', value: totalRegistered, color: 'text-amber-600' },
          { label: 'Paid', value: totalPaid, color: 'text-blue-600' },
          { label: 'Checked In', value: totalCheckedIn, color: 'text-emerald-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-slate-100 bg-white p-2.5 text-center">
            <p className={`text-xl font-black ${color} leading-none`}>{value}</p>
            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mt-1 leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* Registration status bar */}
      {totalActive > 0 && (
        <div className="rounded-xl border border-slate-100 bg-white p-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Registration Status</p>
            <button
              onClick={() => {
                const text = `Registration Status (${totalActive} active):\nChecked In: ${totalCheckedIn} (${pct(totalCheckedIn, totalActive)}%)\nPaid: ${totalPaid} (${pct(totalPaid, totalActive)}%)\nPending Payment: ${totalRegistered} (${pct(totalRegistered, totalActive)}%)${totalCancelled > 0 ? `\nCancelled: ${totalCancelled}` : ''}`;
                navigator.clipboard.writeText(text);
                showToast('Registration status copied', 'success');
              }}
              className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded"
              title="Copy registration status"
            >
              <Copy size={12} />
            </button>
          </div>
          <div className="flex h-3 rounded-full overflow-hidden gap-px">
            {totalCheckedIn > 0 && <div className="bg-emerald-500 transition-all" style={{ width: `${pct(totalCheckedIn, totalActive)}%` }} title={`Checked In: ${totalCheckedIn}`} />}
            {totalPaid > 0 && <div className="bg-jci-blue transition-all" style={{ width: `${pct(totalPaid, totalActive)}%` }} title={`Paid: ${totalPaid}`} />}
            {totalRegistered > 0 && <div className="bg-amber-400 transition-all" style={{ width: `${pct(totalRegistered, totalActive)}%` }} title={`Pending: ${totalRegistered}`} />}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
            {[
              { label: 'Checked In', count: totalCheckedIn, cls: 'bg-emerald-500' },
              { label: 'Paid', count: totalPaid, cls: 'bg-jci-blue' },
              { label: 'Pending', count: totalRegistered, cls: 'bg-amber-400' },
              ...(totalCancelled > 0 ? [{ label: 'Cancelled', count: totalCancelled, cls: 'bg-slate-300' }] : []),
            ].map(({ label, count, cls }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${cls}`} />
                <span className="text-[11px] text-slate-500">{label} <span className="font-bold text-slate-700">{count}</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dietary + T-Shirt: 2-col on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Dietary */}
        <div className="rounded-xl border border-slate-100 overflow-hidden">
          <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dietary</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400">{totalActive} total</span>
              <button
                onClick={() => {
                  const text = `Dietary breakdown (${totalActive} total):\nNormal: ${dietaryCounts.normal} (${pct(dietaryCounts.normal, totalActive)}%)\nVegetarian: ${dietaryCounts.vegetarian} (${pct(dietaryCounts.vegetarian, totalActive)}%)\nHalal: ${dietaryCounts.halal} (${pct(dietaryCounts.halal, totalActive)}%)${dietaryCounts.unspecified > 0 ? `\nNot specified: ${dietaryCounts.unspecified}` : ''}`;
                  navigator.clipboard.writeText(text);
                  showToast('Dietary stats copied', 'success');
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded"
                title="Copy dietary stats"
              >
                <Copy size={12} />
              </button>
            </div>
          </div>
          <div className="px-3.5 py-3 bg-white space-y-3">
            <div className="flex h-4 rounded-full overflow-hidden gap-px">
              {dietaryCounts.normal > 0 && <div className="bg-slate-400 transition-all" style={{ width: `${pct(dietaryCounts.normal, totalActive)}%` }} />}
              {dietaryCounts.vegetarian > 0 && <div className="bg-emerald-500 transition-all" style={{ width: `${pct(dietaryCounts.vegetarian, totalActive)}%` }} />}
              {dietaryCounts.halal > 0 && <div className="bg-teal-500 transition-all" style={{ width: `${pct(dietaryCounts.halal, totalActive)}%` }} />}
              {dietaryCounts.unspecified > 0 && <div className="bg-slate-200 transition-all" style={{ width: `${pct(dietaryCounts.unspecified, totalActive)}%` }} />}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {[
                { label: 'Normal', count: dietaryCounts.normal, cls: 'bg-slate-400', text: 'text-slate-700' },
                { label: '🌿 Vegetarian', count: dietaryCounts.vegetarian, cls: 'bg-emerald-500', text: 'text-emerald-700' },
                { label: '☪️ Halal', count: dietaryCounts.halal, cls: 'bg-teal-500', text: 'text-teal-700' },
                ...(dietaryCounts.unspecified > 0 ? [{ label: 'N/A', count: dietaryCounts.unspecified, cls: 'bg-slate-200', text: 'text-slate-400' }] : []),
              ].map(({ label, count, cls, text }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${cls} shrink-0`} />
                  <span className="text-[11px] text-slate-500">{label} <span className={`font-bold tabular-nums ${text}`}>{count}</span> <span className="text-slate-400">({pct(count, totalActive)}%)</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* T-Shirt Sizes */}
        <div className="rounded-xl border border-slate-100 overflow-hidden">
          <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">T-Shirt Sizes</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400">{sizes.reduce((s, [, c]) => s + c, 0)} specified</span>
              <button
                onClick={() => {
                  const lines = sizes.map(([size, count]) => `${size}: ${count} (${pct(count, totalActive)}%)`);
                  if (sizeUnspecified > 0) lines.push(`Not specified: ${sizeUnspecified}`);
                  const text = `T-Shirt Sizes (${totalActive} total):\n${lines.join('\n')}`;
                  navigator.clipboard.writeText(text);
                  showToast('T-shirt sizes copied', 'success');
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded"
                title="Copy t-shirt size stats"
              >
                <Copy size={12} />
              </button>
            </div>
          </div>
          {sizes.length === 0 ? (
            <div className="px-3.5 py-6 text-center text-sm text-slate-400">No size data collected</div>
          ) : (() => {
            const sizeColors = ['#38bdf8','#0ea5e9','#0284c7','#0369a1','#075985','#0c4a6e','#082f49'];
            return (
              <div className="px-3.5 py-3 bg-white space-y-3">
                <div className="flex h-4 rounded-full overflow-hidden gap-px">
                  {sizes.map(([size, count], i) => (
                    <div key={size} className="transition-all" style={{ width: `${pct(count, totalActive)}%`, backgroundColor: sizeColors[i % sizeColors.length] }} />
                  ))}
                  {sizeUnspecified > 0 && <div className="bg-slate-200 transition-all" style={{ width: `${pct(sizeUnspecified, totalActive)}%` }} />}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {sizes.map(([size, count], i) => (
                    <div key={size} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sizeColors[i % sizeColors.length] }} />
                      <span className="text-[11px] text-slate-500">{size} <span className="font-bold tabular-nums text-slate-700">{count}</span> <span className="text-slate-400">({pct(count, totalActive)}%)</span></span>
                    </div>
                  ))}
                  {sizeUnspecified > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-slate-200 shrink-0" />
                      <span className="text-[11px] text-slate-400">N/A <span className="font-bold tabular-nums">{sizeUnspecified}</span></span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

export const EventStatsTab = React.memo(EventStatsTabBase);
