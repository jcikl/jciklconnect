import React, { useCallback, useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { FinanceService } from '../../../services/financeService';
import type { FinanceAlert } from '../../../types';
import { useToast } from '../../ui/Common';

interface FinanceAlertsPanelProps {
  userId: string;
}

export const FinanceAlertsPanel: React.FC<FinanceAlertsPanelProps> = ({ userId }) => {
  const { showToast } = useToast();
  const [alerts, setAlerts] = useState<FinanceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAlerts(await FinanceService.getFinanceAlerts(true));
    } catch {
      showToast('Failed to load finance alerts', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
    const interval = setInterval(() => { load(); }, 60000);
    return () => clearInterval(interval);
  }, [load]);

  if (!loading && alerts.length === 0) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldAlert size={16} className="text-red-500 shrink-0" />
        <span className="text-sm font-semibold text-red-700">
          Finance Alerts — {loading ? '…' : alerts.length} unresolved
        </span>
      </div>
      {!loading && alerts.map(alert => (
        <div key={alert.id} className="bg-white border border-red-100 rounded-lg px-3 py-2.5 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-700 leading-snug">{alert.message}</p>
            <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-400 font-mono">
              {alert.type && <span className="bg-slate-100 px-1.5 py-0.5 rounded">{alert.type}</span>}
              {alert.transactionId && <span>tx: {alert.transactionId.slice(0, 8)}…</span>}
              {alert.billCode && <span>bill: {alert.billCode}</span>}
              <span>{alert.createdAt ? new Date(alert.createdAt).toLocaleDateString('en-MY') : ''}</span>
            </div>
          </div>
          <button
            disabled={resolvingId === alert.id}
            onClick={async () => {
              setResolvingId(alert.id);
              try {
                await FinanceService.resolveFinanceAlert(alert.id, userId);
              } catch {
                showToast('Failed to resolve alert', 'error');
              }
              setResolvingId(null);
              load();
            }}
            className="shrink-0 text-[11px] font-semibold text-green-600 hover:text-green-800 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg px-2 py-1 transition-colors disabled:opacity-50"
          >
            {resolvingId === alert.id ? '…' : 'Resolve'}
          </button>
        </div>
      ))}
    </div>
  );
};
