import React from 'react';
import { Zap, CheckCircle, Copy } from 'lucide-react';
import { Badge } from '../../ui/Common';
import { Checkbox } from '../../ui/Form';
import { LoadingState } from '../../ui/Loading';
import { formatCurrency } from '../../../utils/formatUtils';
import { Project } from '../../../types';
import type { ProjectFinancialAccount as ProjectFinancialAccountType, ProjectTransaction } from '../../../types';

interface ProjectGridProps {
  projects: Project[];
  loading: boolean;
  error: string | null;
  onSelect: (id: string) => void;
  onNewProposal: () => void;
  onImport: () => void;
  isAdminOrBoard?: boolean;
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
  onSelectAll?: () => void;
  projectAccounts?: ProjectFinancialAccountType[];
  projectTrackerTransactions?: ProjectTransaction[];
}

const ProjectGridBase: React.FC<ProjectGridProps> = ({
  projects,
  loading,
  error,
  onSelect,
  onNewProposal,
  onImport,
  isAdminOrBoard = false,
  selectedIds,
  onToggleSelection,
  onSelectAll,
  projectAccounts = [],
  projectTrackerTransactions = []
}) => {
  const getStatusLabel = (status: Project['status']) => {
    switch (status) {
      case 'Planning':
      case 'Draft': return 'Draft / Unpublished';
      case 'Under Review': return 'Under Review';
      case 'Approved': return 'Approved';
      case 'Active': return 'Published';
      default: return status ?? '-';
    }
  };

  const getStatusVariant = (status: Project['status']) => {
    switch (status) {
      case 'Active': return 'success';
      case 'Approved': return 'info';
      case 'Under Review': return 'warning';
      case 'Planning':
      case 'Draft': return 'neutral';
      default: return 'info';
    }
  };

  const getReconciliation = (project: Project) => {
    const acc = projectAccounts.find(a => a.projectId === project.id);
    const bankIncome = acc?.totalIncome || 0;
    const bankExpenses = acc?.totalExpenses || 0;
    const bankNet = bankIncome - bankExpenses;
    const ptData = projectTrackerTransactions.filter(tx => tx.projectId === project.id);
    const ptIncome = ptData.filter(tx => tx.type === 'income').reduce((s, tx) => s + (tx.amount || 0), 0);
    const ptExpenses = ptData.filter(tx => tx.type === 'expense').reduce((s, tx) => s + (tx.amount || 0), 0);
    const ptNet = ptIncome - ptExpenses;
    const isMatch = ptIncome === bankIncome && ptExpenses === bankExpenses;
    const diff = ptNet - bankNet;
    return { isMatch, diff, ptNet, bankNet };
  };

  return (
    <LoadingState loading={loading} error={error} empty={false}>

      {/*  Desktop table  */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className="w-8 px-4 py-3">
                <Checkbox checked={selectedIds?.size === projects.length && projects.length > 0} onChange={onSelectAll} />
              </th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-3 py-3 w-[35%]">Project</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-3 py-3">Status</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-3 py-3">Team</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-3 py-3 w-[18%]">Budget</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-3 py-3">Reconciliation</th>
              <th className="px-3 py-3 w-28"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {/* New Project row */}
            <tr className="hover:bg-slate-50/50 transition-colors cursor-pointer group" onClick={onNewProposal}>
              <td className="px-4 py-3"></td>
              <td className="px-3 py-3" colSpan={5}>
                <div className="flex items-center gap-2 text-slate-400 group-hover:text-jci-blue transition-colors">
                  <div className="w-9 h-9 rounded-lg border-2 border-dashed border-current flex items-center justify-center shrink-0">
                    <Zap size={16} />
                  </div>
                  <span className="text-sm font-semibold">New Project</span>
                  <span className="text-xs">" or submit an activity plan</span>
                </div>
              </td>
              <td className="px-3 py-3">
                {isAdminOrBoard && (
                  <button onClick={(e) => { e.stopPropagation(); onImport(); }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-jci-blue transition-colors">
                    <Copy size={12} /> Import
                  </button>
                )}
              </td>
            </tr>

            {projects.map(project => {
              const { isMatch, diff, ptNet, bankNet } = getReconciliation(project);
              const budget = project.budget ?? 0;
              const spent = project.spent ?? 0;
              const budgetPct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
              return (
                <tr key={project.id}
                  className={`hover:bg-slate-50/50 transition-colors cursor-pointer group ${selectedIds?.has(project.id) ? 'bg-blue-50/40' : ''}`}
                  onClick={() => onToggleSelection?.(project.id)}>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selectedIds?.has(project.id)} onChange={() => onToggleSelection?.(project.id)} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-400 to-indigo-600 overflow-hidden shrink-0">
                        {project.logoUrl
                          ? <img src={project.logoUrl} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><Zap size={16} className="text-white opacity-70" /></div>}
                      </div>
                      <p className="font-semibold text-slate-900 line-clamp-2 group-hover:text-jci-blue transition-colors leading-tight">
                        {project.name ?? project.title ?? 'Unnamed'}
                      </p>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant={getStatusVariant(project.status)}>{getStatusLabel(project.status)}</Badge>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-sm font-semibold text-slate-700">{project.teamSize ?? 0}</span>
                    <span className="text-xs text-slate-400 ml-1">pax</span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-slate-700">{formatCurrency(spent)}</span>
                        <span className="text-slate-400">/ {formatCurrency(budget)}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${budgetPct >= 90 ? 'bg-red-500' : budgetPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${budgetPct}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    {isMatch ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        <CheckCircle size={11} /> Reconciled
                      </span>
                    ) : (ptNet === 0 && bankNet === 0) ? (
                      <span className="text-xs text-slate-300">"</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        ⚠ {formatCurrency(Math.abs(diff))} diff
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="text-xs font-semibold text-jci-blue hover:text-sky-600 border border-jci-blue/30 hover:border-jci-blue/60 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                      onClick={() => onSelect(project.id)}>
                      Open Board
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/*  Mobile cards  */}
      <div className="md:hidden space-y-3">
        {/* New Project CTA */}
        <div onClick={onNewProposal}
          className="border-2 border-dashed border-slate-200 rounded-xl p-4 flex items-center gap-3 text-slate-400 hover:border-jci-blue hover:text-jci-blue hover:bg-sky-50 transition-colors cursor-pointer">
          <div className="w-9 h-9 rounded-lg border-2 border-dashed border-current flex items-center justify-center shrink-0">
            <Zap size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold">New Project</p>
            <p className="text-xs">or submit an activity plan</p>
          </div>
        </div>

        {projects.map(project => {
          const { isMatch, diff, ptNet, bankNet } = getReconciliation(project);
          const budget = project.budget ?? 0;
          const spent = project.spent ?? 0;
          const budgetPct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
          return (
            <div key={project.id}
              className={`bg-white border rounded-2xl overflow-hidden transition-all ${selectedIds?.has(project.id) ? 'border-jci-blue bg-blue-50/30' : 'border-slate-100'}`}
              onClick={() => onToggleSelection?.(project.id)}>
              {/* Top row: thumbnail + title + status */}
              <div className="flex items-center gap-3 p-3 pb-0">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-400 to-indigo-600 overflow-hidden shrink-0">
                  {project.logoUrl
                    ? <img src={project.logoUrl} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><Zap size={14} className="text-white opacity-70" /></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm leading-tight line-clamp-1">{project.name ?? project.title ?? 'Unnamed'}</p>
                  <div className="mt-0.5"><Badge variant={getStatusVariant(project.status)}>{getStatusLabel(project.status)}</Badge></div>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={selectedIds?.has(project.id)} onChange={() => onToggleSelection?.(project.id)} />
                </div>
              </div>

              {/* Stats row */}
              <div className="px-3 py-2 flex items-center gap-4 text-xs">
                <span className="text-slate-500">{project.teamSize ?? 0} pax</span>
                <div className="flex-1">
                  <div className="flex justify-between mb-0.5">
                    <span className="font-mono text-slate-600">{formatCurrency(spent)}</span>
                    <span className="text-slate-400">/ {formatCurrency(budget)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${budgetPct >= 90 ? 'bg-red-500' : budgetPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${budgetPct}%` }} />
                  </div>
                </div>
                {isMatch ? (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full shrink-0">
                    <CheckCircle size={9} /> Reconciled
                  </span>
                ) : (ptNet === 0 && bankNet === 0) ? null : (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full shrink-0">
                    ⚠ {formatCurrency(Math.abs(diff))}
                  </span>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-slate-50 px-3 py-2" onClick={(e) => e.stopPropagation()}>
                <button className="w-full text-xs font-semibold text-jci-blue border border-jci-blue/30 rounded-lg py-1.5 hover:bg-sky-50 transition-colors"
                  onClick={() => onSelect(project.id)}>
                  Open Board
                </button>
              </div>
            </div>
          );
        })}
      </div>

    </LoadingState>
  );
};

export const ProjectGrid = React.memo(ProjectGridBase);
