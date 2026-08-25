import React from 'react';
import { AlertCircle, CheckCircle, LogOut, Package } from 'lucide-react';
import { StatCard, StatCardsContainer } from '../../ui/Common';

export interface InventoryStats {
  total: number;
  available: number;
  checkedOut: number;
  needsAction: number;
}

interface InventoryStatsStripProps {
  stats: InventoryStats;
}

export const InventoryStatsStrip: React.FC<InventoryStatsStripProps> = ({ stats }) => (
  <StatCardsContainer>
    <StatCard title="Total Assets" value={stats.total} icon={<Package size={18} />} iconColor="blue" />
    <StatCard title="Available" value={stats.available} icon={<CheckCircle size={18} />} iconColor="green" />
    <StatCard title="Checked Out" value={stats.checkedOut} icon={<LogOut size={18} />} iconColor="amber" />
    <StatCard title="Action Needed" value={stats.needsAction} icon={<AlertCircle size={18} />} iconColor="red" />
  </StatCardsContainer>
);
