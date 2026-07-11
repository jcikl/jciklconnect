import * as React from 'react';
import { Users, CheckCircle, UserPlus, Star, X } from 'lucide-react';
import { Card } from '../../ui/Common';
import type { Member } from '../../../types';
import { MemberStatistics } from '../../../services/memberStatsService';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Member Statistics View Component
export const MemberStatisticsView: React.FC<{
  statistics: MemberStatistics | null;
  loading: boolean;
  members: Member[];
}> = ({ statistics, loading, members = [] }) => {
  const [isMobile, setIsMobile] = React.useState(false);
  const [drawerSegment, setDrawerSegment] = React.useState<{ label: string; members: Member[] } | null>(null);

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const calculateAge = (dobString?: string) => {
    if (!dobString) return null;
    const birthDate = new Date(dobString);
    if (isNaN(birthDate.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const ageData = React.useMemo(() => {
    let range18_25 = 0;
    let range26_30 = 0;
    let range31_40 = 0;
    let other = 0;

    members.forEach(m => {
      const dobStr = m.general?.dob || m.dob || m.dateOfBirth;
      if (!dobStr) {
        other++;
        return;
      }
      const age = calculateAge(dobStr);
      if (age === null) {
        other++;
      } else if (age >= 18 && age <= 25) {
        range18_25++;
      } else if (age >= 26 && age <= 30) {
        range26_30++;
      } else if (age >= 31 && age <= 40) {
        range31_40++;
      } else {
        other++;
      }
    });

    const data = [
      { name: '18 - 25', value: range18_25 },
      { name: '26 - 30', value: range26_30 },
      { name: '31 - 40', value: range31_40 }
    ];

    if (other > 0) {
      data.push({ name: 'Other / Unknown', value: other });
    }

    return data.filter(item => item.value > 0);
  }, [members]);

  const genderData = React.useMemo(() => {
    let male = 0;
    let female = 0;
    let unknown = 0;

    members.forEach(m => {
      const g = (m.general?.gender || m.gender || '').toLowerCase().trim();
      if (g === 'male') {
        male++;
      } else if (g === 'female') {
        female++;
      } else {
        unknown++;
      }
    });

    const data = [
      { name: 'Male', value: male },
      { name: 'Female', value: female }
    ];

    if (unknown > 0) {
      data.push({ name: 'Unknown', value: unknown });
    }

    return data.filter(item => item.value > 0);
  }, [members]);

  if (loading) {
    return <div className="text-center py-8 text-slate-400">Loading statistics...</div>;
  }

  if (!statistics) {
    return <div className="text-center py-8 text-slate-400">No statistics available</div>;
  }

  const COLORS = ['#0097D7', '#6EC4E8', '#1C3F94', '#00B5B5', '#A5B4FC', '#F472B6'];

  const DonutChart: React.FC<{
    data: { name: string; value: number }[];
    colorOffset?: number;
    onSegmentClick?: (name: string) => void;
  }> = ({ data, colorOffset = 0, onSegmentClick }) => {
    const total = data.reduce((s, d) => s + d.value, 0);
    return (
      <ResponsiveContainer width="100%" height={isMobile ? 300 : 260}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={isMobile ? 48 : 55}
            outerRadius={isMobile ? 75 : 85}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[(index + colorOffset) % COLORS.length]}
                onClick={onSegmentClick ? () => onSegmentClick(entry.name) : undefined}
                style={onSegmentClick ? { cursor: 'pointer' } : undefined}
              />
            ))}
          </Pie>
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-900" style={{ fontSize: 22, fontWeight: 900 }}>{total}</text>
          <Tooltip formatter={(value: number, name: string) => [`${value} (${total > 0 ? ((value / total) * 100).toFixed(0) : 0}%)`, name]} />
          <Legend verticalAlign="bottom" height={isMobile ? 56 : 48} iconSize={10} wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="space-y-4">
      {/* KPI Cards – 2×2 on mobile, 4-col on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Members', value: statistics.totalMembers, color: 'text-slate-900', bg: 'bg-slate-100', icon: Users },
          { label: 'Active Members', value: statistics.activeMembers, color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle },
          { label: 'New This Month', value: statistics.newMembersThisMonth, color: 'text-jci-blue', bg: 'bg-blue-50', icon: UserPlus },
          { label: 'Avg Points', value: statistics.averagePoints, color: 'text-amber-600', bg: 'bg-amber-50', icon: Star },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <Card key={label}>
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div className="min-w-0">
                <div className={`text-2xl font-black ${color} leading-none`}>{value}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 leading-tight">{label}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Engagement Overview – segmented bar */}
      <Card title="Member Engagement Overview">
        {(() => {
          const high = statistics.engagementMetrics.highlyEngaged;
          const mod = statistics.engagementMetrics.moderatelyEngaged;
          const low = statistics.engagementMetrics.lowEngaged;
          const total = high + mod + low || 1;
          const highPct = Math.round((high / total) * 100);
          const modPct = Math.round((mod / total) * 100);
          const lowPct = 100 - highPct - modPct;
          return (
            <div className="space-y-3">
              <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
                {highPct > 0 && <div className="bg-green-500 transition-all" style={{ width: `${highPct}%` }} />}
                {modPct > 0 && <div className="bg-amber-400 transition-all" style={{ width: `${modPct}%` }} />}
                {lowPct > 0 && <div className="bg-red-400  transition-all" style={{ width: `${lowPct}%` }} />}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Highly Engaged', value: high, pct: highPct, color: 'text-green-600', dot: 'bg-green-500', sub: '>80%' },
                  { label: 'Moderately Engaged', value: mod, pct: modPct, color: 'text-amber-500', dot: 'bg-amber-400', sub: '50–80%' },
                  { label: 'Low Engaged', value: low, pct: lowPct, color: 'text-red-500', dot: 'bg-red-400', sub: '<50%' },
                ].map(({ label, value, pct, color, dot, sub }) => (
                  <div key={label} className="text-center">
                    <div className={`text-2xl font-black ${color}`}>{value}</div>
                    <div className="flex items-center justify-center gap-1 mt-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${dot} shrink-0`} />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{sub}</span>
                    </div>
                    <div className="text-[9px] text-slate-400 mt-0.5">{pct}% · {label.split(' ')[0]}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </Card>

      {/* 2×2 donut chart grid */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card title="Age Demographics">
          <DonutChart
            data={ageData}
            colorOffset={0}
            onSegmentClick={name => {
              const filtered = members.filter(m => {
                const dobStr = m.general?.dob || m.dob || m.dateOfBirth;
                const age = calculateAge(dobStr);
                if (name === 'Other / Unknown') return age === null || age < 18 || age > 40;
                if (name === '18 - 25') return age !== null && age >= 18 && age <= 25;
                if (name === '26 - 30') return age !== null && age >= 26 && age <= 30;
                if (name === '31 - 40') return age !== null && age >= 31 && age <= 40;
                return false;
              });
              setDrawerSegment({ label: `Age ${name}`, members: filtered });
            }}
          />
        </Card>
        <Card title="Gender Demographics">
          <DonutChart
            data={genderData}
            colorOffset={2}
            onSegmentClick={name => {
              const filtered = members.filter(m => {
                const g = (m.general?.gender || m.gender || '').toLowerCase().trim();
                if (name === 'Male') return g === 'male';
                if (name === 'Female') return g === 'female';
                return g !== 'male' && g !== 'female';
              });
              setDrawerSegment({ label: `Gender: ${name}`, members: filtered });
            }}
          />
        </Card>
        <Card title="Membership Type Breakdown">
          {(() => {
            const types = ['Full', 'Probation', 'Guest', 'Senator', 'Honorary'];
            const labels: Record<string, string> = { Full: 'Full Member', Probation: 'Probation', Guest: 'Guest', Senator: 'Senator', Honorary: 'Honorary' };
            const data = types
              .map(key => ({ name: labels[key], value: members.filter(m => m.membershipType === key || m.role?.toUpperCase() === key.toUpperCase()).length }))
              .filter(d => d.value > 0);
            return (
              <DonutChart
                data={data}
                colorOffset={0}
                onSegmentClick={name => {
                  const keyMap: Record<string, string> = { 'Full Member': 'Full', 'Probation': 'Probation', 'Guest': 'Guest', 'Senator': 'Senator', 'Honorary': 'Honorary' };
                  const key = keyMap[name] || name;
                  const filtered = members.filter(m => m.membershipType === key || m.role?.toUpperCase() === key.toUpperCase());
                  setDrawerSegment({ label: `Membership: ${name}`, members: filtered });
                }}
              />
            );
          })()}
        </Card>
        <Card title="Level of Management">
          {(() => {
            const activeMembers = members.filter(m => m.membershipType !== 'Guest');
            const counts: Record<string, number> = {};
            activeMembers.forEach(m => {
              const lvl = (m.business?.levelOfManagement ?? m.levelOfManagement)?.trim() || 'Not Specified';
              counts[lvl] = (counts[lvl] || 0) + 1;
            });
            const knownOrder = ['Top Management', 'Senior Management', 'Middle Management', 'Junior Management', 'Non-Management'];
            const data = [
              ...knownOrder.filter(k => counts[k]).map(k => ({ name: k, value: counts[k] })),
              ...Object.keys(counts).filter(k => !knownOrder.includes(k) && k !== 'Not Specified').sort().map(k => ({ name: k, value: counts[k] })),
              ...(counts['Not Specified'] ? [{ name: 'Not Specified', value: counts['Not Specified'] }] : []),
            ];
            return (
              <DonutChart
                data={data}
                colorOffset={1}
                onSegmentClick={name => {
                  const filtered = members.filter(m => m.membershipType !== 'Guest' && (((m.business?.levelOfManagement ?? m.levelOfManagement)?.trim() || 'Not Specified') === name));
                  setDrawerSegment({ label: `Management: ${name}`, members: filtered });
                }}
              />
            );
          })()}
        </Card>
      </div>

      {/* Segment member drawer */}
      {drawerSegment && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setDrawerSegment(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[70vh]">
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100 shrink-0">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5">Segment</p>
                <h3 className="text-lg font-black text-slate-900">{drawerSegment.label}</h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="bg-jci-blue/10 text-jci-blue text-sm font-black px-3 py-1 rounded-full">{drawerSegment.members.length} 人</span>
                <button onClick={() => setDrawerSegment(null)} className="p-2 rounded-full hover:bg-slate-100 text-slate-400">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-3 space-y-2">
              {drawerSegment.members.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-8">No members in this segment</p>
              ) : (
                drawerSegment.members
                  .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                  .map(m => (
                    <div key={m.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                      {m.avatar ? (
                        <img src={m.avatar} alt={m.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-jci-blue/10 flex items-center justify-center shrink-0 text-jci-blue font-bold text-sm">
                          {(m.name || m.fullName || '?')[0].toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate">{m.name || m.fullName}</p>
                        <p className="text-xs text-slate-400 truncate">{m.email || m.contact?.email || m.phone || m.contact?.phone || ''}</p>
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">{m.membershipType || m.role || ''}</span>
                    </div>
                  ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
