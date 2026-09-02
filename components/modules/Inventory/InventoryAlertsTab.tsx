import React, { useState } from 'react';
import { AlertCircle, Bell, CheckCircle } from 'lucide-react';
import { Badge, Button, useToast } from '../../ui/Common';
import { LoadingState } from '../../ui/Loading';
import type { InventoryAlert, InventoryItem } from '../../../types';
import { formatDate } from '../../../utils/dateUtils';

interface InventoryAlertsTabProps {
  alerts: InventoryAlert[];
  items: InventoryItem[];
  loading: boolean;
  onAcknowledge: (alertId: string, acknowledgedBy: string) => Promise<void>;
  onCheckAlerts: () => Promise<void>;
  member: any;
  canOperateFinance: boolean;
}

export const InventoryAlertsTab: React.FC<InventoryAlertsTabProps> = ({
  alerts,
  items,
  loading,
  onAcknowledge,
  onCheckAlerts,
  member,
  canOperateFinance,
}) => {
  const { showToast } = useToast();
  const [checkingAlerts, setCheckingAlerts] = useState(false);

  const handleAcknowledge = async (alertId: string) => {
    if (!member) {
      showToast('Please login to acknowledge alerts', 'error');
      return;
    }
    try {
      await onAcknowledge(alertId, member.id);
      showToast('Alert acknowledged', 'success');
    } catch (err) {
      showToast('Failed to acknowledge alert', 'error');
    }
  };

  const handleCheckAlerts = async () => {
    setCheckingAlerts(true);
    try {
      await onCheckAlerts();
      showToast('Alerts checked and updated', 'success');
    } catch (err) {
      showToast('Failed to check alerts', 'error');
    } finally {
      setCheckingAlerts(false);
    }
  };

  const severityBar = (s: InventoryAlert['severity']) => {
    switch (s) {
      case 'Critical': return 'bg-red-500';
      case 'High': return 'bg-orange-400';
      case 'Medium': return 'bg-amber-400';
      case 'Low': return 'bg-blue-400';
      default: return 'bg-slate-300';
    }
  };
  const severityBadge = (s: InventoryAlert['severity']): 'error' | 'warning' | 'info' | 'neutral' =>
    s === 'Critical' ? 'error' : s === 'High' ? 'warning' : s === 'Low' ? 'info' : 'neutral';

  const activeAlerts = alerts.filter(a => !a.acknowledged);
  const criticalCount = activeAlerts.filter(a => a.severity === 'Critical').length;
  const highCount = activeAlerts.filter(a => a.severity === 'High').length;
  const ackCount = alerts.filter(a => a.acknowledged).length;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base md:text-lg font-bold text-slate-900">Inventory Alerts</h3>
          <p className="text-xs text-slate-500 mt-0.5">Stock levels, maintenance, and system warnings</p>
        </div>
        {canOperateFinance && (
          <Button variant="outline" size="sm" onClick={handleCheckAlerts} disabled={checkingAlerts}>
            <Bell size={14} className={`mr-1.5 ${checkingAlerts ? 'animate-pulse' : ''}`} />
            {checkingAlerts ? 'Checking...' : 'Check Alerts'}
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-slate-100 bg-white shadow-sm px-4 py-3 space-y-1">
        {[
          { label: 'Active Alerts', value: activeAlerts.length, icon: <AlertCircle className={`w-4 h-4 ${activeAlerts.length > 0 ? 'text-red-500' : 'text-slate-400'}`} />, c: activeAlerts.length > 0 ? 'text-red-600' : 'text-slate-600' },
          { label: 'Critical',      value: criticalCount,       icon: <AlertCircle className={`w-4 h-4 ${criticalCount > 0 ? 'text-red-500' : 'text-slate-400'}`} />,         c: criticalCount > 0 ? 'text-red-600' : 'text-slate-600' },
          { label: 'High',          value: highCount,           icon: <AlertCircle className={`w-4 h-4 ${highCount > 0 ? 'text-orange-500' : 'text-slate-400'}`} />,          c: highCount > 0 ? 'text-orange-600' : 'text-slate-600' },
          { label: 'Acknowledged',  value: ackCount,            icon: <CheckCircle className="w-4 h-4 text-emerald-500" />,                                                   c: 'text-emerald-700' },
        ].map(({ label, value, icon, c }) => (
          <div key={label} className="flex items-center gap-2">
            {icon}
            <span className="text-xs text-slate-500 flex-1">{label}</span>
            <span className={`text-sm font-bold tabular-nums ${c}`}>{value}</span>
          </div>
        ))}
      </div>

      <LoadingState loading={loading} error={null} empty={alerts.length === 0} emptyMessage="No alerts detected. Run 'Check Alerts' to scan for low stock or overdue maintenance.">
        <div className="space-y-2">
          {alerts.map(alert => {
            const alertKey = alert.id ?? `alert-${alert.itemId}-${alert.createdAt}`;
            const item = items.find(i => i.id === alert.itemId);
            const bar = severityBar(alert.severity);
            return (
              <div key={alertKey} className={`relative bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden ${alert.acknowledged ? 'opacity-60' : ''}`}>
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${bar}`} />
                <div className="pl-4 pr-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-semibold text-slate-900">{alert.type}</span>
                        <Badge variant={severityBadge(alert.severity)} className="text-[10px]">{alert.severity}</Badge>
                        {alert.acknowledged && <Badge variant="success" className="text-[10px]">Acknowledged</Badge>}
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{alert.message}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {item && (
                          <span className="text-[11px] text-slate-400 font-medium">{item.name}</span>
                        )}
                        <span className="text-[11px] text-slate-400">{formatDate(new Date(alert.createdAt))}</span>
                        {alert.acknowledgedAt && (
                          <span className="text-[11px] text-green-500">✓ {formatDate(new Date(alert.acknowledgedAt))}</span>
                        )}
                      </div>
                    </div>
                    {canOperateFinance && !alert.acknowledged && member && alert.id && (
                      <button
                        onClick={() => handleAcknowledge(alert.id)}
                        className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 border border-slate-200 hover:border-green-300 hover:text-green-600 hover:bg-green-50 transition-colors"
                      >
                        <CheckCircle size={13} />
                        <span className="hidden md:inline">Acknowledge</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </LoadingState>
    </div>
  );
};
