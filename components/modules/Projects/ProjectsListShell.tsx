import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Card, Tabs, Pagination } from '../../ui/Common';
import { AsyncErrorBoundary } from '../../ui/AsyncErrorBoundary';
import { Project } from '../../../types';
import type { ProjectFinancialAccount as ProjectFinancialAccountType, ProjectTransaction } from '../../../types';
import { EventTemplate } from '../../../services/templatesService';
import { ProjectGrid } from './ProjectGrid';
import { ProjectsTemplatesTab } from './ProjectsTemplatesTab';

const DEFAULT_PAGE_SIZE = 20;

type ProjectsTab = 'projects' | 'past-projects' | 'templates';
type HostingFilter = 'all' | 'hosting' | 'cohosting' | 'other';

const KL = 'jci kuala lumpur';

const HOSTING_TABS: { key: HostingFilter; label: string; short: string }[] = [
  { key: 'all',       label: 'All Events',                    short: 'All'      },
  { key: 'hosting',   label: 'Hosting: JCI Kuala Lumpur',    short: 'Hosting'  },
  { key: 'cohosting', label: 'Co-hosting: JCI Kuala Lumpur', short: 'Co-host'  },
  { key: 'other',     label: 'Other Organizers',              short: 'Other'    },
];

interface ProjectsListShellProps {
  activeTab: ProjectsTab;
  availableYears: number[];
  selectedYear: number;
  projects: Project[];
  loading: boolean;
  error: string | null;
  templates: EventTemplate[];
  templatesLoading: boolean;
  templatesError: string | null;
  templateSearchTerm: string;
  templateFilterType: string;
  canManageTemplates: boolean;
  isAdminOrBoard: boolean;
  selectedProjectIds: Set<string>;
  projectAccounts: ProjectFinancialAccountType[];
  projectTrackerTransactions: ProjectTransaction[];
  onActiveTabChange: (tab: ProjectsTab) => void;
  onYearChange: (year: number) => void;
  onSelectProject: (projectId: string) => void;
  onNewProposal: () => void;
  onImport: () => void;
  onToggleSelection: (projectId: string) => void;
  onSelectAll: (ids: string[]) => void;
  onClearSelection: () => void;
  onTemplateSearchTermChange: (term: string) => void;
  onTemplateFilterTypeChange: (filterType: string) => void;
  onCreateTemplate: () => void;
  onPreviewTemplate: (template: EventTemplate) => void;
  onUseTemplate: (template: EventTemplate) => void;
  onEditTemplate: (template: EventTemplate) => void;
  onDeleteTemplate: (template: EventTemplate) => void;
}

export const ProjectsListShell: React.FC<ProjectsListShellProps> = ({
  activeTab,
  availableYears,
  selectedYear,
  projects,
  loading,
  error,
  templates,
  templatesLoading,
  templatesError,
  templateSearchTerm,
  templateFilterType,
  canManageTemplates,
  isAdminOrBoard,
  selectedProjectIds,
  projectAccounts,
  projectTrackerTransactions,
  onActiveTabChange,
  onYearChange,
  onSelectProject,
  onNewProposal,
  onImport,
  onToggleSelection,
  onSelectAll,
  onClearSelection,
  onTemplateSearchTermChange,
  onTemplateFilterTypeChange,
  onCreateTemplate,
  onPreviewTemplate,
  onUseTemplate,
  onEditTemplate,
  onDeleteTemplate,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [hostingFilter, setHostingFilter] = useState<HostingFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredByHosting = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const bySearch = q
      ? projects.filter(p =>
          (p.name ?? p.title ?? '').toLowerCase().includes(q) ||
          ((p as any).roadmapId ?? '').toString().toLowerCase().includes(q)
        )
      : projects;
    if (hostingFilter === 'all') return bySearch;
    return bySearch.filter(p => {
      const lo = ((p as any).hostingLo ?? '') as string;
      const coRaw = (p as any).coHosting;
      const isHosting = lo.trim().toLowerCase() === KL;
      const isCo = Array.isArray(coRaw)
        ? coRaw.some((c: string) => typeof c === 'string' && c.trim().toLowerCase() === KL)
        : typeof coRaw === 'string' && coRaw.trim().toLowerCase() === KL;
      if (hostingFilter === 'hosting') return isHosting;
      if (hostingFilter === 'cohosting') return isCo;
      return !isHosting && !isCo;
    });
  }, [projects, hostingFilter, searchQuery]);

  // Reset to page 1 whenever the filtered list or tab changes; clear selection on filter/search switch
  useEffect(() => { setCurrentPage(1); }, [filteredByHosting.length, activeTab, hostingFilter, searchQuery]);
  useEffect(() => { onClearSelection(); }, [hostingFilter, searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.max(1, Math.ceil(filteredByHosting.length / itemsPerPage));
  const pagedProjects = filteredByHosting.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const showProjects = activeTab === 'projects' || activeTab === 'past-projects';
  const mobileActiveTab = activeTab === 'projects' ? 'Ongoing' : activeTab === 'past-projects' ? 'Past' : 'Templates';
  const desktopActiveTab = activeTab === 'projects' ? 'Ongoing Events' : activeTab === 'past-projects' ? 'Past Events' : 'Templates';

  const handleMobileTabChange = (tab: string) => {
    if (tab === 'Ongoing') onActiveTabChange('projects');
    else if (tab === 'Past') onActiveTabChange('past-projects');
    else onActiveTabChange('templates');
  };

  const handleDesktopTabChange = (tab: string) => {
    if (tab === 'Ongoing Events') onActiveTabChange('projects');
    else if (tab === 'Past Events') onActiveTabChange('past-projects');
    else onActiveTabChange('templates');
  };

  const yearFilter = (compact = false) => (
    <select
      value={selectedYear}
      onChange={(e) => onYearChange(Number(e.target.value))}
      className={compact
        ? "shrink-0 text-xs font-bold border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-jci-blue focus:border-jci-blue bg-white outline-none transition-all cursor-pointer"
        : "text-xs font-bold border border-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-jci-blue focus:border-jci-blue bg-white shadow-sm outline-none transition-all cursor-pointer"}
    >
      {availableYears.map(year => (
        <option key={year} value={year}>{year}</option>
      ))}
    </select>
  );

  const pagination = filteredByHosting.length > 0 && (
    <Pagination
      currentPage={currentPage}
      totalPages={totalPages}
      totalItems={projects.length}
      itemsPerPage={itemsPerPage}
      onPageChange={setCurrentPage}
      onItemsPerPageChange={(n) => { setItemsPerPage(n); setCurrentPage(1); }}
      showItemsPerPage
      className="pt-3 border-t border-slate-100"
    />
  );

  const projectGrid = (
    <AsyncErrorBoundary>
      <ProjectGrid
        projects={pagedProjects}
        loading={loading}
        error={error}
        onSelect={onSelectProject}
        onNewProposal={onNewProposal}
        onImport={onImport}
        isAdminOrBoard={isAdminOrBoard}
        selectedIds={selectedProjectIds}
        onToggleSelection={onToggleSelection}
        onSelectAll={() => onSelectAll(pagedProjects.map(p => p.id!).filter(Boolean))}
        projectAccounts={projectAccounts}
        projectTrackerTransactions={projectTrackerTransactions}
      />
      {pagination}
    </AsyncErrorBoundary>
  );

  const templatesTab = (compact = false) => (
    <ProjectsTemplatesTab
      templates={templates}
      loading={templatesLoading}
      error={templatesError}
      searchTerm={templateSearchTerm}
      filterType={templateFilterType}
      canManageTemplates={canManageTemplates}
      compact={compact}
      onSearchTermChange={onTemplateSearchTermChange}
      onFilterTypeChange={onTemplateFilterTypeChange}
      onCreateTemplate={onCreateTemplate}
      onPreviewTemplate={onPreviewTemplate}
      onUseTemplate={onUseTemplate}
      onEditTemplate={onEditTemplate}
      onDeleteTemplate={onDeleteTemplate}
    />
  );

  return (
    <div className="space-y-2">
      <div className="md:hidden p-1.5 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-2">
        <Tabs
          fullWidth
          tabs={['Ongoing', 'Past', 'Templates']}
          activeTab={mobileActiveTab}
          onTabChange={handleMobileTabChange}
        />
        {activeTab !== 'templates' && yearFilter(true)}
      </div>
      {showProjects && (
        <div className="md:hidden relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search events…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white shadow-sm outline-none focus:border-jci-blue focus:ring-1 focus:ring-jci-blue/30 transition-all"
          />
        </div>
      )}

      <div className="md:hidden">
        {showProjects ? projectGrid : templatesTab(true)}
      </div>

      <Card noPadding className="hidden md:block">
        <div className="flex">
          {/* Left hosting-filter bookmark sidebar — mirrors Profile's tab bar, text labels */}
          {showProjects && (
            <div className="flex flex-col border-r border-slate-200 bg-slate-50 shrink-0">
              {HOSTING_TABS.map(({ key, label, short }, i) => (
                <button
                  key={key}
                  title={label}
                  onClick={() => setHostingFilter(key)}
                  className={`relative flex items-center justify-center py-5 px-3 w-full transition-all ${i > 0 ? 'border-t border-slate-200' : ''} ${hostingFilter === key ? 'bg-white text-jci-blue' : 'text-slate-400 hover:text-slate-600 hover:bg-white/60'}`}
                >
                  {hostingFilter === key && (
                    <>
                      <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-jci-blue" />
                      <span className="absolute right-0 top-0 bottom-0 w-px bg-white" />
                    </>
                  )}
                  <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em' }}>
                    {short}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="px-6 pt-4 flex flex-row justify-between items-end gap-3 border-b border-slate-100">
              <div className="flex-1 min-w-0">
                <Tabs
                  tabs={['Ongoing Events', 'Past Events', 'Templates']}
                  activeTab={desktopActiveTab}
                  onTabChange={handleDesktopTabChange}
                  className="border-b-0"
                />
              </div>
              {activeTab !== 'templates' && (
                <div className="flex items-center gap-3 pb-2">
                  {showProjects && (
                    <div className="relative">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search…"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:border-jci-blue focus:ring-1 focus:ring-jci-blue/30 transition-all w-44"
                      />
                    </div>
                  )}
                  <span className="text-xs font-semibold text-slate-500">Year:</span>
                  {yearFilter()}
                </div>
              )}
            </div>
            <div className="p-6">
              {showProjects ? projectGrid : templatesTab()}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
