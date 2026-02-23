import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Card } from '../ui/Common';
import { Member } from '../../types';
import { PointTransaction } from '../../services/pointsService';

const COLORS = ['#0097D7', '#6EC4E8', '#1C3F94', '#00B5B5', '#94A3B8'];

interface MemberGrowthChartProps {
  members?: Member[];
}

export const MemberGrowthChart: React.FC<MemberGrowthChartProps> = ({ members = [] }) => {
  const growthData = useMemo(() => {
    const now = new Date();
    const months: { name: string; members: number }[] = [];

    // Generate last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });

      // Count members joined up to this month (cumulative)
      const membersUpToMonth = members.filter(m => {
        const joinDate = new Date(m.joinDate);
        return joinDate <= new Date(date.getFullYear(), date.getMonth() + 1, 0);
      }).length;

      months.push({
        name: monthName,
        members: membersUpToMonth,
      });
    }

    return months;
  }, [members]);

  return (
    <Card title="Membership Growth (Trend)" noPadding className="h-80 flex flex-col">
      <div className="flex-1 p-6 min-h-0" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0}>
          <AreaChart data={growthData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorMembers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0097D7" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#0097D7" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="name" axisLine={false} tickLine={false} />
            <YAxis axisLine={false} tickLine={false} />
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" />
            <Tooltip
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Area type="monotone" dataKey="members" stroke="#0097D7" fillOpacity={1} fill="url(#colorMembers)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

interface PointsDistributionChartProps {
  pointHistory?: PointTransaction[];
}

export const PointsDistributionChart: React.FC<PointsDistributionChartProps> = ({ pointHistory = [] }) => {
  const pointsData = useMemo(() => {
    const categoryTotals: Record<string, number> = {};

    pointHistory.forEach(transaction => {
      const category = transaction.category || 'Other';
      categoryTotals[category] = (categoryTotals[category] || 0) + transaction.amount;
    });

    // Convert to array and sort by points
    const data = Object.entries(categoryTotals)
      .map(([name, points]) => ({ name, points }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 5); // Top 5 categories

    // If no data, return default categories with 0 points
    if (data.length === 0) {
      return [
        { name: 'Projects', points: 0 },
        { name: 'Events', points: 0 },
        { name: 'Training', points: 0 },
        { name: 'Referrals', points: 0 },
        { name: 'Admin', points: 0 },
      ];
    }

    return data;
  }, [pointHistory]);

  return (
    <Card title="Engagement Points Source" noPadding className="h-80 flex flex-col">
      <div className="flex-1 px-6 pt-4 pb-6">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={pointsData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
            <XAxis type="number" hide />
            <YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
            <Bar dataKey="points" radius={[0, 4, 4, 0]} barSize={20}>
              {pointsData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};
