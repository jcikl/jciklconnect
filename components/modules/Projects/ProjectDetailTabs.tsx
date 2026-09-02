import React, { useState, lazy, Suspense } from 'react';
import { Card, useToast, ConfirmDialog, CONFIRM_CLOSED } from '../../ui/Common';
import { ClipboardList, Users, GraduationCap, LayoutDashboard, GanttChartSquare, Wallet, FileBarChart, Sparkles } from 'lucide-react';
import { LoadingSpinner as Spinner } from '../../ui/Loading';
import type { ConfirmState } from '../../ui/Common';
import { Project } from '../../../types';
import { ProjectReportService, ProjectReport } from '../../../services/projectReportService';
// BUNDLE-005: lazy-load gantt-task-react (~200KB) so it is not parsed for users who never open the Gantt tab
const ProjectGanttChart = lazy(() =>
  import('../ProjectManagement/ProjectGanttChart').then(m => ({ default: m.ProjectGanttChart }))
);
import { ProjectKanban } from './ProjectKanban';
import { ProjectFinancialAccountView as ProjectFinancialAccount } from '../ProjectManagement/ProjectFinancialAccount';
import { ProjectActivityPlanTab } from './ProjectActivityPlanTab';
import { ProjectCommitteeTab } from './ProjectCommitteeTab';
import { AsyncErrorBoundary } from '../../ui/AsyncErrorBoundary';
import { ProjectTrainerTab } from './ProjectTrainerTab';
import { ProjectReportsTab } from './ProjectReportsTab';
import { ProjectAIPredictions } from './ProjectAIPredictions';
import { ProjectReportModal } from './ProjectReportModal';

export interface ProjectDetailTabsProps {
  project: Project;
  onUpdateProject: (projectId: string, updates: Partial<Project>) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  onNavigate?: (view: string) => void;
}

export const ProjectDetailTabs: React.FC<ProjectDetailTabsProps> = ({ project, onUpdateProject, onDeleteProject, onNavigate }) => {
  const { projectId, projectName } = { projectId: project.id, projectName: project.name ?? project.title ?? 'Project' };
  const [activeTab, setActiveTab] = useState<'activity-plan' | 'committee' | 'trainers' | 'kanban' | 'gantt' | 'finance' | 'reports' | 'ai'>('activity-plan');
  const [projectReport, setProjectReport] = useState<ProjectReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  // Modal states removed for inline editing
  const [confirmState, setConfirmState] = useState<ConfirmState>(CONFIRM_CLOSED);
  const { showToast } = useToast();

  const handleGenerateReport = async () => {
    setLoadingReport(true);
    try {
      const report = await ProjectReportService.generateReport(projectId);
      setProjectReport(report);
      setIsReportModalOpen(true);
    } catch (err) {
      showToast('Failed to generate report', 'error');
    } finally {
      setLoadingReport(false);
    }
  };

  const handleDeleteProject = () => {
    setConfirmState({
      open: true,
      title: 'Delete Project',
      message: 'Are you sure you want to delete this project and its activity plan? This action cannot be undone.',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmState(CONFIRM_CLOSED);
        try {
          await onDeleteProject(projectId);
        } catch (err) {
          showToast('Failed to delete project', 'error');
        }
      },
    });
  };

  const TAB_ITEMS: { key: typeof activeTab; label: string; icon: React.ElementType }[] = [
    { key: 'activity-plan', label: 'Activity Plan',    icon: ClipboardList },
    { key: 'committee',     label: 'Event Committee',  icon: Users },
    { key: 'trainers',      label: 'Trainers',         icon: GraduationCap },
    { key: 'kanban',        label: 'Kanban Board',     icon: LayoutDashboard },
    { key: 'gantt',         label: 'Gantt Chart',      icon: GanttChartSquare },
    { key: 'finance',       label: 'Financial Account',icon: Wallet },
    { key: 'reports',       label: 'Reports',          icon: FileBarChart },
    { key: 'ai',            label: 'AI Insights',      icon: Sparkles },
  ];

  return (
    <>
      <Card noPadding>
        <div className="flex">
          {/* Left vertical tab bar */}
          <div className="w-12 flex flex-col border-r border-slate-100 shrink-0 py-2">
            {TAB_ITEMS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                title={label}
                className={`relative flex items-center justify-center h-10 w-full transition-colors ${
                  activeTab === key
                    ? 'text-jci-blue'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                }`}
              >
                {activeTab === key && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-jci-blue rounded-r" />
                )}
                <Icon size={16} />
              </button>
            ))}
          </div>

          {/* Right content panel */}
          <div className="flex-1 min-w-0 p-4">
            {activeTab === 'committee' && (
              <AsyncErrorBoundary>
                <ProjectCommitteeTab
                  project={project}
                  onSave={(updates) => onUpdateProject(projectId, updates)}
                />
              </AsyncErrorBoundary>
            )}
            {activeTab === 'trainers' && (
              <ProjectTrainerTab
                project={project}
                onSave={(updates) => onUpdateProject(projectId, updates)}
              />
            )}
            {activeTab === 'kanban' && (
              <ProjectKanban projectId={projectId} projectName={projectName} project={project} />
            )}
            {activeTab === 'gantt' && (
              <Suspense fallback={<div className="flex justify-center p-8"><Spinner /></div>}>
                <ProjectGanttChart
                  project={project}
                  onUpdateProject={onUpdateProject}
                  onClose={() => setActiveTab('kanban')}
                />
              </Suspense>
            )}
            {activeTab === 'finance' && (
              <ProjectFinancialAccount
                project={project}
                onUpdateProject={onUpdateProject}
              />
            )}
            {activeTab === 'reports' && (
              <ProjectReportsTab
                projectId={projectId}
                projectName={projectName}
                onGenerateReport={handleGenerateReport}
                loading={loadingReport}
              />
            )}
            {activeTab === 'ai' && (
              <ProjectAIPredictions projectId={projectId} />
            )}
            {activeTab === 'activity-plan' && (
              <AsyncErrorBoundary>
                <ProjectActivityPlanTab
                  project={project}
                  onSave={(updates) => onUpdateProject(projectId, updates)}
                  onDelete={handleDeleteProject}
                />
              </AsyncErrorBoundary>
            )}
          </div>
        </div>
      </Card>

      {isReportModalOpen && projectReport && (
        <ProjectReportModal
          report={projectReport}
          onClose={() => setIsReportModalOpen(false)}
        />
      )}

      {/* ProjectTransactionModal removed in favor of inline editing */}
      <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} variant={confirmState.variant} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(CONFIRM_CLOSED)} />
    </>
  );
};
