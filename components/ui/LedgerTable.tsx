import React from 'react';
import { Card, Button } from './Common';

export interface LedgerRecord {
  id: string;
  memberId: string;
  memberName: string;
  eventTitle: string;
  radarKey: string;
  points: number;
  year?: string | number;
  eventDate?: string;
  hostingLO?: string;
  chapterLO?: string;
  createdAt: string;
}

interface LedgerTableProps {
  logs: LedgerRecord[];
  selectedLogs?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
  onDelete?: (record: LedgerRecord) => void;
  onBatchDelete?: () => void;
  deleting?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  showSelection?: boolean;
  showActions?: boolean;
}

export const LedgerTable: React.FC<LedgerTableProps> = ({
  logs,
  selectedLogs = new Set(),
  onToggleSelect,
  onToggleSelectAll,
  onDelete,
  onBatchDelete,
  deleting = false,
  hasMore = false,
  onLoadMore,
  loadingMore = false,
  showSelection = true,
  showActions = true,
}) => {
  return (
    <Card className="overflow-hidden p-0">
      {showSelection && selectedLogs.size > 0 && onBatchDelete && (
        <div className="bg-blue-50 p-3 flex justify-between items-center border-b border-blue-100">
          <span className="text-sm text-blue-800 font-bold px-2">
            {selectedLogs.size} records selected
          </span>
          <Button
            onClick={onBatchDelete}
            disabled={deleting}
            className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white py-1.5 px-4 text-xs font-bold shadow-md rounded-lg transition-all"
          >
            {deleting ? 'Processing...' : 'Batch Revert Selected'}
          </Button>
        </div>
      )}
      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="w-full text-xs text-left whitespace-nowrap">
          <thead className="bg-slate-50 sticky top-0 shadow-sm z-10">
            <tr>
              {showSelection && onToggleSelectAll && (
                <th className="py-2 px-3 border-b w-10">
                  <input
                    type="checkbox"
                    checked={logs.length > 0 && selectedLogs.size === logs.length}
                    onChange={onToggleSelectAll}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-jci-blue focus:ring-jci-blue cursor-pointer"
                  />
                </th>
              )}
              <th className="py-2 px-3 font-bold text-slate-600 border-b">Member Name</th>
              <th className="py-2 px-3 font-bold text-slate-600 border-b">Event Title</th>
              <th className="py-2 px-3 font-bold text-slate-600 border-b">Hosting LO</th>
              <th className="py-2 px-3 font-bold text-slate-600 border-b">Chapter / LO</th>
              <th className="py-2 px-3 font-bold text-slate-600 border-b">Radar Key</th>
              <th className="py-2 px-3 font-bold text-slate-600 border-b">Points</th>
              <th className="py-2 px-3 font-bold text-slate-600 border-b">Year</th>
              <th className="py-2 px-3 font-bold text-slate-600 border-b">Event Date</th>
              <th className="py-2 px-3 font-bold text-slate-600 border-b">Imported At</th>
              {showActions && onDelete && (
                <th className="py-2 px-3 font-bold text-slate-600 border-b text-right">Action</th>
              )}
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td
                  colSpan={showSelection ? 11 : 10}
                  className="py-8 text-center text-slate-500"
                >
                  No contribution records found.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr
                  key={log.id}
                  className={`border-b border-slate-100 transition-colors ${
                    showSelection && selectedLogs.has(log.id)
                      ? 'bg-blue-50/50'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  {showSelection && onToggleSelect && (
                    <td className="py-1.5 px-3 w-10">
                      <input
                        type="checkbox"
                        checked={selectedLogs.has(log.id)}
                        onChange={() => onToggleSelect(log.id)}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-jci-blue focus:ring-jci-blue cursor-pointer"
                      />
                    </td>
                  )}
                  <td className="py-1.5 px-3 font-bold text-slate-800">
                    {log.memberName || 'Unknown'}
                  </td>
                  <td
                    className="py-1.5 px-3 text-slate-600 max-w-[200px] truncate"
                    title={log.eventTitle}
                  >
                    {log.eventTitle}
                  </td>
                  <td className="py-1.5 px-3 text-slate-500 text-[10px]">
                    {log.hostingLO || '-'}
                  </td>
                  <td className="py-1.5 px-3 text-slate-500 text-[10px]">
                    {log.chapterLO || '-'}
                  </td>
                  <td className="py-1.5 px-3">
                    <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold">
                      {log.radarKey}
                    </span>
                  </td>
                  <td className="py-1.5 px-3 font-mono font-bold text-amber-600">
                    +{log.points}
                  </td>
                  <td className="py-1.5 px-3 font-bold text-slate-700">
                    {log.year || 'All'}
                  </td>
                  <td className="py-1.5 px-3 text-[10px] text-slate-500">
                    {log.eventDate || '-'}
                  </td>
                  <td className="py-1.5 px-3 text-[10px] text-slate-400">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  {showActions && onDelete && (
                    <td className="py-1.5 px-3 text-right">
                      <button
                        onClick={() => onDelete(log)}
                        className="text-slate-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
                      >
                        Revert
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
        {hasMore && logs.length > 0 && onLoadMore && (
          <div className="p-4 flex justify-center bg-slate-50 border-t border-slate-100">
            <Button
              onClick={onLoadMore}
              disabled={loadingMore}
              className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 px-6 py-2 text-sm font-bold rounded-lg transition-all"
            >
              {loadingMore ? 'Loading...' : 'Load More Records'}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};
