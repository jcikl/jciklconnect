import React from 'react';
import { Card, Tabs } from '../../ui/Common';
import { AsyncErrorBoundary } from '../../ui/AsyncErrorBoundary';
import { Project } from '../../../types';
import type { ProjectFinancialAccount as ProjectFinancialAccountType, ProjectTransaction } from '../../../types';
import { EventTemplate } from '../../../services/templatesService';
import { ProjectGrid } from './ProjectGrid';
import { ProjectsTemplatesTab } from './ProjectsTemplatesTab';

type ProjectsTab = 'projects' | 'past-projects' | 'templates';

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
  onSelectAll: () => void;
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
  onTemplateSearchTermChange,
  onTemplateFilterTypeChange,
  onCreateTemplate,
  onPreviewTemplate,
  onUseTemplate,
  onEditTemplate,
  onDeleteTemplate,
}) => {
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

  const projectGrid = (
    <AsyncErrorBoundary>
      <ProjectGrid
        projects={projects}
        loading={loading}
        error={error}
        onSelect={onSelectProject}
        onNewProposal={onNewProposal}
        onImport={onImport}
        isAdminOrBoard={isAdminOrBoard}
        selectedIds={selectedProjectIds}
        onToggleSelection={onToggleSelection}
        onSelectAll={onSelectAll}
        projectAccounts={projectAccounts}
        projectTrackerTransactions={projectTrackerTransactions}
      />
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

      <div className="md:hidden">
        {showProjects ? projectGrid : templatesTab(true)}
      </div>

      <Card noPadding className="hidden md:block">
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
            <div className="flex items-center gap-2 pb-2">
              <span className="text-xs font-semibold text-slate-500">Year:</span>
              {yearFilter()}
            </div>
          )}
        </div>
        <div className="p-6">
          {showProjects ? projectGrid : templatesTab()}
        </div>
      </Card>
    </div>
  );
};
