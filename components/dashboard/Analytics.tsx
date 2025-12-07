import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Card } from '../ui/Common';

const MEMBER_GROWTH_DATA = [
  { name: 'Jan', members: 120 },
  { name: 'Feb', members: 125 },
  { name: 'Mar', members: 128 },
  { name: 'Apr', members: 132 },
  { name: 'May', members: 135 },
  { name: 'Jun', members: 142 },
];

const POINTS_DATA = [
  { name: 'Projects', points: 4000 },
  { name: 'Events', points: 3000 },
  { name: 'Training', points: 2000 },
  { name: 'Referrals', points: 1500 },
  { name: 'Admin', points: 500 },
];

const COLORS = ['#0097D7', '#6EC4E8', '#1C3F94', '#00B5B5', '#94A3B8'];

export const MemberGrowthChart: React.FC = () => {
  return (
    <Card title="Membership Growth (Trend)" className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={MEMBER_GROWTH_DATA} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorMembers" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0097D7" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#0097D7" stopOpacity={0}/>
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
    </Card>
  );
};

export const PointsDistributionChart: React.FC = () => {
  return (
    <Card title="Engagement Points Source" className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={POINTS_DATA} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
          <XAxis type="number" hide />
          <YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}/>
          <Bar dataKey="points" radius={[0, 4, 4, 0]} barSize={20}>
            {POINTS_DATA.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
};
