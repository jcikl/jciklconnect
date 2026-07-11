import React from 'react';
import { Briefcase, CheckCircle, AlertCircle, Edit, Trash2, Settings } from 'lucide-react';
import { Button, Badge, Card } from '../../ui/Common';
import { LoadingState } from '../../ui/Loading';
import { formatCurrency } from '../../../utils/formatUtils';
import { formatDate } from '../../../utils/dateUtils';
import { UNASSIGNED_PROJECT_ID } from '../../../hooks/useFinanceData';
import type { Transaction, ProjectFinancialAccount, Project } from '../../../types';

interface ProjectAccountTabProps {
  loadingProjectAccounts: boolean;
  filteredProjectAccounts: ProjectFinancialAccount[];
  uncategorizedProjectTxCount: number;
  selectedProjectFilter: string | null;
  setSelectedProjectFilter: (id: string | null) => void;
  projectTrackerSummary: Record<string, { income: number; expenses: number }>;
  selectedProjectTransactions: Transaction[];
  loadingSelectedProjectTransactions: boolean;
  projectTransactions: Transaction[];
  projectAccounts: ProjectFinancialAccount[];
  selectedProjectInfo: Project | null;
  loading: boolean;
  error: string | null;
  getTransactionAccountLabel: (tx: Transaction) => string;
  hasPermission: (perm: string) => boolean;
  handleEditTransaction: (tx: Transaction) => void;
  handleDeleteTransaction: (id: string) => void;
  loadProjectTrxList: (projectId: string | null) => void;
  setIsProjectTrxModalOpen: (open: boolean) => void;
  projects: Project[];
}

const ProjectAccountTabBase: React.FC<ProjectAccountTabProps> = ({
  loadingProjectAccounts,
  filteredProjectAccounts,
  uncategorizedProjectTxCount,
  selectedProjectFilter,
  setSelectedProjectFilter,
  projectTrackerSummary,
  selectedProjectTransactions,
  loadingSelectedProjectTransactions,
  projectTransactions,
  projectAccounts,
  selectedProjectInfo,
  loading,
  error,
  getTransactionAccountLabel,
  hasPermission,
  handleEditTransaction,
  handleDeleteTransaction,
  loadProjectTrxList,
  setIsProjectTrxModalOpen,
  projects,
}) => {
  const cardList = [
    ...(uncategorizedProjectTxCount > 0 ? [{
      id: 'uncategorized',
      projectId: UNASSIGNED_PROJECT_ID,
      projectName: 'Unassigned',
      currentBalance: 0,
      totalIncome: 0,
      totalExpenses: 0,
    }] : []),
    ...filteredProjectAccounts,
  ];

  const filteredProjectTx = (selectedProjectFilter && selectedProjectFilter !== UNASSIGNED_PROJECT_ID)
    ? selectedProjectTransactions
    : projectTransactions;
  const txIncome = filteredProjectTx.filter(t => t.type === 'Income').reduce((s, t) => s + t.amount, 0);
  const txExpense = filteredProjectTx.filter(t => t.type === 'Expense').reduce((s, t) => s + t.amount, 0);
  const txTitle = selectedProjectFilter === UNASSIGNED_PROJECT_ID
    ? 'Unassigned Transactions'
    : selectedProjectFilter
      ? `${projectAccounts.find(p => p.projectId === selectedProjectFilter)?.projectName || selectedProjectFilter}`
      : 'All Project Transactions';

  const renderCard = (acc: typeof cardList[number]) => {
    const isActive = selectedProjectFilter === acc.projectId;
    const bankIncome = acc.totalIncome || 0;
    const bankExpenses = acc.totalExpenses || 0;
    const bankNet = bankIncome - bankExpenses;
    const ptData = projectTrackerSummary[acc.projectId] || { income: 0, expenses: 0 };
    const ptIncome = ptData.income;
    const ptExpenses = ptData.expenses;
    const ptNet = ptIncome - ptExpenses;
    const isMatch = ptIncome === bankIncome && ptExpenses === bankExpenses && ptNet === bankNet;

    return (
      <div
        key={acc.id}
        role="button"
        tabIndex={0}
        onClick={() => setSelectedProjectFilter(isActive ? null : acc.projectId)}
        onKeyDown={(e) => e.key === 'Enter' && setSelectedProjectFilter(isActive ? null : acc.projectId)}
        className={`shrink-0 w-64 relative cursor-pointer rounded-xl border overflow-hidden shadow-sm transition-all ${isActive
          ? 'border-jci-blue ring-1 ring-jci-blue/20 shadow-md shadow-jci-blue/5'
          : 'border-slate-200 hover:border-slate-300 hover:shadow'
          }`}
      >
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${isActive ? 'bg-jci-blue' : acc.projectId === UNASSIGNED_PROJECT_ID ? 'bg-amber-400' : 'bg-slate-300'}`} />
        <div className={`pl-4 pr-3 pt-3 pb-3 ${isActive ? 'bg-jci-blue/5' : 'bg-white'}`}>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <Briefcase size={13} className={`shrink-0 ${isActive ? 'text-jci-blue' : 'text-slate-400'}`} />
              <span className={`text-sm font-semibold truncate ${isActive ? 'text-jci-blue' : 'text-slate-800'}`}>{acc.projectName}</span>
            </div>
            {acc.projectId !== UNASSIGNED_PROJECT_ID && isMatch && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-green-600 bg-green-50 border border-green-200 rounded px-1.5 py-0.5 shrink-0 ml-2">
                <CheckCircle size={10} />Matched
              </span>
            )}
            {acc.projectId !== UNASSIGNED_PROJECT_ID && !isMatch && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 shrink-0 ml-2">
                <AlertCircle size={10} />Diff
              </span>
            )}
          </div>
          {acc.projectId === UNASSIGNED_PROJECT_ID ? (
            <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <span className="text-xs text-amber-700 font-medium">Pending Categorization</span>
              <span className="text-lg font-bold text-amber-700">{uncategorizedProjectTxCount}</span>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-lg border border-slate-100 overflow-hidden">
              <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] px-1.5">
                <div className="pt-1 pb-0.5 whitespace-nowrap text-[10px] invisible">Expense</div>
                <div className="pt-1 pb-0.5 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-wide">PT</div>
                <div className="pt-1 pb-0.5 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Bank</div>
                <div className="py-0.5 border-t border-slate-100 text-[10px] text-slate-500 whitespace-nowrap">Income</div>
                <div className="py-0.5 border-t border-slate-100 text-right text-[10px] font-mono text-slate-700 min-w-0 overflow-hidden">{formatCurrency(ptIncome)}</div>
                <div className="py-0.5 border-t border-slate-100 text-right text-[10px] font-mono text-green-600 min-w-0 overflow-hidden">{formatCurrency(bankIncome)}</div>
                <div className="py-0.5 border-t border-slate-100 text-[10px] text-slate-500 whitespace-nowrap">Expense</div>
                <div className="py-0.5 border-t border-slate-100 text-right text-[10px] font-mono text-slate-700 min-w-0 overflow-hidden">{formatCurrency(ptExpenses)}</div>
                <div className="py-0.5 border-t border-slate-100 text-right text-[10px] font-mono text-red-500 min-w-0 overflow-hidden">{formatCurrency(bankExpenses)}</div>
                <div className="py-1 border-t border-slate-200 bg-slate-100/60 text-[10px] font-semibold text-slate-700 whitespace-nowrap">Net</div>
                <div className={`py-1 border-t border-slate-200 bg-slate-100/60 text-right text-[10px] font-mono font-semibold min-w-0 overflow-hidden ${ptNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(ptNet)}</div>
                <div className={`py-1 border-t border-slate-200 bg-slate-100/60 text-right text-[10px] font-mono font-semibold min-w-0 overflow-hidden ${bankNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(bankNet)}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Project Account Cards */}
      <LoadingState loading={loadingProjectAccounts} error={null} empty={filteredProjectAccounts.length === 0 && uncategorizedProjectTxCount === 0} emptyMessage="No project accounts found. Create a project in the 'Projects' section and set up its financial account.">
        {/* Mobile: horizontal scroll */}
        <div className="md:hidden flex gap-2.5 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
          {cardList.map(renderCard)}
        </div>
        {/* Desktop: horizontal scroll */}
        <div className="hidden md:flex gap-3 overflow-x-auto pb-2 no-scrollbar -mx-1 px-1">
          {cardList.map(renderCard)}
        </div>
      </LoadingState>

      {/* Stats strip + Transactions */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {/* Left: Project Statistics */}
        <div className="md:col-span-2">
          <Card title="Project Statistics">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Projects</span>
                  <p className="text-sm font-bold text-slate-800">{filteredProjectAccounts.length}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Balance</span>
                  <p className="text-sm font-bold text-slate-800 truncate" title={formatCurrency(filteredProjectAccounts.reduce((sum, acc) => sum + acc.currentBalance, 0))}>
                    {formatCurrency(filteredProjectAccounts.reduce((sum, acc) => sum + acc.currentBalance, 0))}
                  </p>
                </div>
              </div>
              <div className="border-t border-slate-100 pt-3 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Avg. Balance</span>
                  <span className="font-semibold text-slate-800">
                    {formatCurrency(filteredProjectAccounts.length > 0 ? filteredProjectAccounts.reduce((sum, acc) => sum + acc.currentBalance, 0) / filteredProjectAccounts.length : 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Positive Balance</span>
                  <span className="font-semibold text-green-600">{filteredProjectAccounts.filter(acc => acc.currentBalance >= 0).length}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Negative Balance</span>
                  <span className="font-semibold text-red-600">{filteredProjectAccounts.filter(acc => acc.currentBalance < 0).length}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Unassigned Txs</span>
                  <span className="font-semibold text-amber-600">{uncategorizedProjectTxCount}</span>
                </div>
              </div>
              {selectedProjectInfo && (
                <div className="border-t border-slate-100 pt-3">
                  <h4 className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-2">Selected Project</h4>
                  <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-100">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 font-medium">Project Name:</span>
                      <span className="font-semibold text-slate-800 truncate max-w-[120px]" title={selectedProjectInfo.name || selectedProjectInfo.title}>
                        {selectedProjectInfo.name || selectedProjectInfo.title}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 font-medium">LO Budget:</span>
                      <span className="font-semibold text-slate-800">
                        {formatCurrency(selectedProjectInfo.budget || selectedProjectInfo.proposedBudget || 0)}
                      </span>
                    </div>
                    <Button
                      className="w-full mt-2"
                      size="sm"
                      onClick={() => { loadProjectTrxList(selectedProjectFilter); setIsProjectTrxModalOpen(true); }}
                    >
                      <Settings size={14} className="mr-1.5" />Configure PT
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right: Transactions */}
        <div className="md:col-span-5">
          {/* Title row */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-sm font-semibold text-slate-800 truncate">{txTitle}</h3>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {selectedProjectFilter && (
                <button onClick={() => setSelectedProjectFilter(null)} className="text-xs text-blue-500 hover:text-blue-700 font-medium">Clear</button>
              )}
            </div>
          </div>

          {/* Summary strip */}
          {filteredProjectTx.length > 0 && (
            <div className="flex items-center gap-2 px-1 pb-3 overflow-x-auto no-scrollbar">
              <span className="text-xs text-slate-500 font-medium whitespace-nowrap shrink-0">{filteredProjectTx.length} txns</span>
              <span className="w-px h-3.5 bg-slate-200 shrink-0" />
              <span className="text-xs font-mono font-semibold text-green-600 whitespace-nowrap shrink-0">+{formatCurrency(txIncome)}</span>
              <span className="text-xs font-mono font-semibold text-red-500 whitespace-nowrap shrink-0">−{formatCurrency(txExpense)}</span>
              <span className="w-px h-3.5 bg-slate-200 shrink-0" />
              <span className="text-xs font-mono font-semibold whitespace-nowrap shrink-0">
                Net: <span className={txIncome - txExpense >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(txIncome - txExpense)}</span>
              </span>
              {selectedProjectInfo && (
                <>
                  <span className="w-px h-3.5 bg-slate-200 shrink-0" />
                  <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">Budget: <span className="font-semibold text-slate-700">{formatCurrency(selectedProjectInfo.budget || selectedProjectInfo.proposedBudget || 0)}</span></span>
                </>
              )}
            </div>
          )}

          <LoadingState loading={loading || loadingSelectedProjectTransactions} error={error} empty={filteredProjectTx.length === 0} emptyMessage={selectedProjectFilter ? 'No transactions for this project.' : "No project transactions found. Use 'New Transaction' above to add one."}>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold text-xs whitespace-nowrap">Date</th>
                    <th className="py-2.5 px-3 font-semibold text-xs whitespace-nowrap">Type</th>
                    <th className="py-2.5 px-3 font-semibold text-xs">Description</th>
                    <th className="py-2.5 px-3 font-semibold text-xs whitespace-nowrap">Project</th>
                    <th className="py-2.5 px-3 font-semibold text-xs text-right whitespace-nowrap">Amount</th>
                    {hasPermission('canEditFinance') && <th className="py-2.5 px-3 font-semibold text-xs text-center">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProjectTx
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map(tx => {
                      const hasProjectId = tx.projectId && tx.projectId.trim() !== '';
                      const hasPurpose = tx.purpose && tx.purpose.trim() !== '';
                      const projectLabel = getTransactionAccountLabel(tx);
                      return (
                        <tr key={tx.id} className={`border-l-2 ${tx.type === 'Income' ? 'border-l-green-400' : 'border-l-red-400'} hover:bg-slate-50/60 transition-colors`}>
                          <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(tx.date)}</td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${tx.type === 'Income' ? 'bg-green-50 text-green-700 ring-1 ring-green-200' : 'bg-red-50 text-red-600 ring-1 ring-red-200'}`}>
                              {tx.type === 'Income' ? '↑ Income' : '↓ Expense'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 max-w-0">
                            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                              {tx.isSplit
                                ? <Badge variant="info" className="text-[10px] shrink-0">Split</Badge>
                                : hasProjectId && hasPurpose
                                  ? <Badge variant="success" className="text-[10px] shrink-0">Categorized</Badge>
                                  : <Badge variant="warning" className="text-[10px] shrink-0">Uncategorized</Badge>
                              }
                              <span className="font-medium text-slate-900 truncate text-xs">{tx.description}</span>
                              {tx.referenceNumber && <span className="text-[10px] text-slate-400 font-mono shrink-0">({tx.referenceNumber})</span>}
                              {tx.status && tx.status !== 'Cleared' && (
                                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${tx.status === 'Reconciled' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-700'}`}>{tx.status}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap max-w-[140px] truncate">
                            {projectLabel}
                          </td>
                          <td className={`py-2.5 px-3 text-right font-mono font-bold text-xs whitespace-nowrap ${tx.type === 'Income' ? 'text-green-600' : 'text-red-500'}`}>
                            {tx.type === 'Income' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                          </td>
                          {hasPermission('canEditFinance') && (
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex justify-center gap-0.5">
                                <button onClick={() => handleEditTransaction(tx)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Edit size={13} /></button>
                                <button onClick={() => handleDeleteTransaction(tx.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2 pt-1">
              {filteredProjectTx
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map(tx => {
                  const hasProjectId = tx.projectId && tx.projectId.trim() !== '';
                  const hasPurpose = tx.purpose && tx.purpose.trim() !== '';
                  return (
                    <div key={tx.id} className="relative bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${tx.type === 'Income' ? 'bg-green-400' : 'bg-red-400'}`} />
                      <div className="pl-4 pr-3 pt-2.5 pb-2.5">
                        {/* Row 1: date | amount */}
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[11px] text-slate-400 font-medium">{formatDate(tx.date)}</span>
                          <span className={`font-mono font-bold text-sm shrink-0 ${tx.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                            {tx.type === 'Income' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                          </span>
                        </div>
                        {/* Row 2: description */}
                        <p className="text-sm font-semibold text-slate-900 leading-snug truncate mb-1.5">{tx.description}</p>
                        {/* Row 3: meta | actions */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                            {tx.isSplit
                              ? <Badge variant="info" className="text-[10px] shrink-0">Split</Badge>
                              : hasProjectId && hasPurpose
                                ? <Badge variant="success" className="text-[10px] shrink-0">Categorized</Badge>
                                : <Badge variant="warning" className="text-[10px] shrink-0">Uncategorized</Badge>
                            }
                            <span className="text-[10px] text-slate-400 truncate">
                              {tx.projectId ? (projects.find(p => p.id === tx.projectId)?.name || tx.projectId) : '—'}
                            </span>
                          </div>
                          {hasPermission('canEditFinance') && (
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button onClick={() => handleEditTransaction(tx)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Edit size={13} /></button>
                              <button onClick={() => handleDeleteTransaction(tx.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </LoadingState>
        </div>
      </div>
    </div>
  );
};

export const ProjectAccountTab = React.memo(ProjectAccountTabBase);
