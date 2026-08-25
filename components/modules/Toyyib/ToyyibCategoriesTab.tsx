import React from 'react';
import { Briefcase, CreditCard, Link2, RefreshCw, Users } from 'lucide-react';
import { Badge, Button, Card } from '../../ui/Common';
import { Input } from '../../ui/Form';
import type { ToyyibCategory } from '../../../services/toyyibService';
import { linkedLabel } from './toyyibUi';

type CreateCategoryType = 'membership' | 'project';

interface ToyyibCategoriesTabProps {
  categories: ToyyibCategory[];
  projects: { id: string; title: string }[];
  isRefreshing: boolean;
  isCreateModalOpen: boolean;
  createType: CreateCategoryType;
  createYear: string;
  createMembershipType: string;
  createProjectId: string;
  isCreatingCat: boolean;
  onRefresh: () => void;
  onOpenImport: () => void;
  onCreateTypeChange: (type: CreateCategoryType) => void;
  onCreateYearChange: (year: string) => void;
  onCreateMembershipTypeChange: (type: string) => void;
  onCreateProjectIdChange: (projectId: string) => void;
  onResetCreate: () => void;
  onCreateCategory: () => void;
  onOpenLink: (category: ToyyibCategory) => void;
  onShowDetails: (category: ToyyibCategory) => void;
  onDelete: (categoryCode: string) => void;
}

const MEMBERSHIP_TYPES = ['Guest', 'Probation', 'Official', 'Honorary', 'Senator', 'Visiting', 'Associate'] as const;
const CREATE_TYPES = ['membership', 'project'] as const;

export const ToyyibCategoriesTab: React.FC<ToyyibCategoriesTabProps> = ({
  categories,
  projects,
  isRefreshing,
  isCreateModalOpen,
  createType,
  createYear,
  createMembershipType,
  createProjectId,
  isCreatingCat,
  onRefresh,
  onOpenImport,
  onCreateTypeChange,
  onCreateYearChange,
  onCreateMembershipTypeChange,
  onCreateProjectIdChange,
  onResetCreate,
  onCreateCategory,
  onOpenLink,
  onShowDetails,
  onDelete,
}) => {
  const createNamePreview = createType === 'membership'
    ? `${createYear} Membership`
    : projects.find(p => p.id === createProjectId)?.title;
  const hasCreatePreview = (createType === 'membership' && createYear && createMembershipType) || (createType === 'project' && createProjectId);

  const createTypeButton = (type: CreateCategoryType, iconSize: number) => (
    <button
      key={type}
      onClick={() => onCreateTypeChange(type)}
      className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${createType === type ? 'border-jci-blue bg-jci-blue/10 text-jci-blue' : 'border-slate-200 bg-white text-slate-500'}`}
    >
      {type === 'membership' ? <><Users size={iconSize} /> Membership</> : <><Briefcase size={iconSize} /> Project</>}
    </button>
  );

  const createFields = (compact = false) => createType === 'membership' ? (
    <>
      <Input value={createYear} onChange={e => onCreateYearChange(e.target.value)} placeholder={compact ? 'Year' : 'Year e.g. 2026'} className={compact ? 'w-24 h-8 text-xs' : undefined} />
      <select
        className={`rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-jci-blue/30 ${compact ? 'py-1.5 h-8' : 'py-2'}`}
        value={createMembershipType}
        onChange={e => onCreateMembershipTypeChange(e.target.value)}
      >
        <option value="">— Type —</option>
        {MEMBERSHIP_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
      </select>
    </>
  ) : (
    <select
      className={`rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-jci-blue/30 ${compact ? 'py-1.5 h-8 min-w-[200px]' : 'w-full py-2'}`}
      value={createProjectId}
      onChange={e => onCreateProjectIdChange(e.target.value)}
    >
      <option value="">— Select project —</option>
      {projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}
    </select>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-bold text-slate-800 text-sm md:text-base">Bill Categories</h3>
          <p className="text-xs text-slate-400">{categories.length} categories linked</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 border border-slate-200 rounded-lg" onClick={onRefresh} isLoading={isRefreshing} title="Refresh">
            <RefreshCw size={14} className="text-slate-500" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 px-3 border border-slate-200 rounded-lg text-xs font-medium" onClick={onOpenImport}>
            Import
          </Button>
        </div>
      </div>

      <div className="md:hidden space-y-2">
        <div className="bg-jci-blue/5 border border-jci-blue/20 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {CREATE_TYPES.map(type => createTypeButton(type, 12))}
          </div>
          {createType === 'membership' && <div className="grid grid-cols-2 gap-2">{createFields()}</div>}
          {createType === 'project' && createFields()}
          {hasCreatePreview && (
            <p className="text-[11px] text-slate-500">
              Name: <span className="font-semibold text-slate-800">{createNamePreview}</span>
            </p>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="flex-1 h-8 text-xs" onClick={onResetCreate}>Reset</Button>
            <Button size="sm" variant="primary" className="flex-1 h-8 text-xs" isLoading={isCreatingCat} onClick={onCreateCategory}>Create & Link</Button>
          </div>
        </div>
        {isRefreshing ? (
          [1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)
        ) : categories.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <CreditCard size={32} className="mx-auto text-slate-300" />
            <p className="text-sm text-slate-400">No categories found</p>
            <p className="text-xs text-slate-300">Import a code or create a new category</p>
          </div>
        ) : categories.map((cat, i) => {
          const tag = linkedLabel(cat);
          return (
            <div key={cat.categoryCode || i} className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 text-sm">{cat.categoryName || '—'}</span>
                    <Badge variant={cat.categoryStatus === '1' ? 'success' : 'neutral'} className="text-[10px] flex-shrink-0">
                      {cat.categoryStatus === '1' ? 'ACTIVE' : 'INACTIVE'}
                    </Badge>
                  </div>
                  {tag ? (
                    <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${tag.color}`}>
                      {tag.icon}{tag.text}
                    </span>
                  ) : null}
                  <p className="text-[11px] font-mono text-slate-400 mt-1.5">{cat.categoryCode}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  {cat.billCount ? (
                    <>
                      <p className="font-bold text-slate-800 text-sm">{cat.billCount} bills</p>
                      <p className="text-xs text-jci-blue font-medium">RM {(cat.totalAmount || 0).toFixed(2)}</p>
                    </>
                  ) : <p className="text-xs text-slate-300">No bills</p>}
                </div>
              </div>
              <div className="flex gap-1 mt-3 pt-3 border-t border-slate-50">
                <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs text-slate-500" onClick={() => onOpenLink(cat)}>
                  <Link2 size={11} className="mr-1" />Link
                </Button>
                <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs text-jci-blue" onClick={() => onShowDetails(cat)}>
                  Details
                </Button>
                <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs text-red-500 hover:bg-red-50" onClick={() => onDelete(cat.categoryCode)}>
                  Remove
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden md:block">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100">
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Linked To</th>
                  <th className="px-5 py-3 font-medium">Code</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Bills / Total</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                <tr className="bg-jci-blue/5 border-b border-jci-blue/20">
                  <td colSpan={6} className="px-5 py-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex gap-1.5 flex-shrink-0">
                        {CREATE_TYPES.map(type => createTypeButton(type, 12))}
                      </div>
                      {createType === 'membership' && createFields(true)}
                      {createType === 'project' && createFields(true)}
                      {hasCreatePreview && (
                        <span className="text-xs text-slate-500">
                          → <span className="font-semibold text-slate-800">{createNamePreview}</span>
                        </span>
                      )}
                      <div className="flex gap-2 ml-auto flex-shrink-0">
                        <Button size="sm" variant="ghost" className="h-8 px-3 text-xs" onClick={onResetCreate}>
                          Reset
                        </Button>
                        <Button size="sm" variant="primary" className="h-8 px-3 text-xs" isLoading={isCreatingCat} onClick={onCreateCategory}>
                          Create & Link
                        </Button>
                      </div>
                    </div>
                  </td>
                </tr>
                {isRefreshing ? (
                  [1, 2, 3].map(i => (
                    <tr key={i}>
                      {[1, 2, 3, 4, 5, 6].map(j => <td key={j} className="px-5 py-4"><div className="h-3 bg-slate-100 rounded animate-pulse" /></td>)}
                    </tr>
                  ))
                ) : categories.length === 0 && !isCreateModalOpen ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center">
                      <CreditCard size={28} className="mx-auto text-slate-200 mb-2" />
                      <p className="text-slate-400 text-sm">No categories — import a code or create new</p>
                    </td>
                  </tr>
                ) : categories.map((cat, i) => {
                  const tag = linkedLabel(cat);
                  return (
                    <tr key={cat.categoryCode || i} className="group hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">{cat.categoryName || '—'}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{cat.categoryDescription}</p>
                      </td>
                      <td className="px-5 py-4">
                        {tag ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${tag.color}`}>
                            {tag.icon}{tag.text}
                          </span>
                        ) : (
                          <button onClick={() => onOpenLink(cat)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-jci-blue">
                            <Link2 size={11} /> Assign
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-400">{cat.categoryCode}</td>
                      <td className="px-5 py-4">
                        <Badge variant={cat.categoryStatus === '1' ? 'success' : 'neutral'} className="text-[10px]">
                          {cat.categoryStatus === '1' ? 'ACTIVE' : 'INACTIVE'}
                        </Badge>
                      </td>
                      <td className="px-5 py-4">
                        {cat.billCount ? (
                          <div>
                            <span className="font-semibold text-slate-800">{cat.billCount}</span>
                            <p className="text-xs text-slate-400">RM {(cat.totalAmount || 0).toFixed(2)}</p>
                          </div>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-4 text-right space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-slate-500 text-xs" onClick={() => onOpenLink(cat)}>
                          Link
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-jci-blue text-xs" onClick={() => onShowDetails(cat)}>
                          Details
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-red-400 hover:bg-red-50 text-xs" onClick={() => onDelete(cat.categoryCode)}>
                          Remove
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};
