import React, { useState, useEffect } from 'react';
import { Card, Tabs, useToast, ConfirmDialog, ConfirmState, CONFIRM_CLOSED } from '../../ui/Common';
import { Project } from '../../../types';
import { ProjectAccountsService, ProjectAccount } from '../../../services/projectAccountsService';
import { ProjectReportService, ProjectReport } from '../../../services/projectReportService';
import { ProjectGanttChart } from '../ProjectManagement/ProjectGanttChart';
import { ProjectKanban } from './ProjectKanban';
import { ProjectFinancialAccount } from './ProjectFinancialAccount';
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
  const [projectAccount, setProjectAccount] = useState<ProjectAccount | null>(null);
  const [projectReport, setProjectReport] = useState<ProjectReport | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  // Modal states removed for inline editing
  const [confirmState, setConfirmState] = useState<ConfirmState>(CONFIRM_CLOSED);
  const { showToast } = useToast();

  useEffect(() => {
    if (activeTab === 'finance') {
      loadProjectAccount();
    }
  }, [activeTab, projectId]);

  const loadProjectAccount = async () => {
    setLoadingAccount(true);
    try {
      const account = await ProjectAccountsService.getProjectAccountByProjectId(projectId);
      setProjectAccount(account);
    } catch (err) {
      showToast('Failed to load project account', 'error');
    } finally {
      setLoadingAccount(false);
    }
  };

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

  const handleReconcileAccount = async () => {
    try {
      const result = await ProjectAccountsService.reconcileProjectAccount(projectId);
      if (result.reconciled) {
        showToast('Project account reconciled successfully - No discrepancies found', 'success');
      } else {
        showToast(
          `Project account reconciled - ${result.discrepancies.length} discrepancy(ies) found. Please review.`,
          'info'
        );
      }
      await loadProjectAccount();
      return result;
    } catch (err) {
      showToast('Failed to reconcile account', 'error');
      throw err;
    }
  };

  const TAB_ITEMS: { key: typeof activeTab; label: string; shortLabel: string }[] = [
    { key: 'activity-plan', label: 'Activity Plan', shortLabel: 'Plan' },
    { key: 'committee', label: 'Event Committee', shortLabel: 'Committee' },
    { key: 'trainers', label: 'Trainers', shortLabel: 'Trainers' },
    { key: 'kanban', label: 'Kanban Board', shortLabel: 'Kanban' },
    { key: 'gantt', label: 'Gantt Chart', shortLabel: 'Gantt' },
    { key: 'finance', label: 'Financial Account', shortLabel: 'Finance' },
    { key: 'reports', label: 'Reports', shortLabel: 'Reports' },
    { key: 'ai', label: 'AI Insights', shortLabel: 'AI' },
  ];

  return (
    <>
      <Card noPadding>
        {/* Tabs — mobile: select dropdown, desktop: underline tabs with short labels */}
        <div className="px-6 pt-4 border-b border-slate-100">
          <Tabs
            tabs={TAB_ITEMS.map(t => ({ id: t.key, label: t.label, shortLabel: t.shortLabel }))}
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab as typeof activeTab)}
            mobileFallback="select"
            className="border-b-0"
          />
        </div>
        <div className="p-4">
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
            <ProjectGanttChart
              project={project}
              onUpdateProject={onUpdateProject}
              onClose={() => setActiveTab('kanban')}
            />
          )}
          {activeTab === 'finance' && (
            <ProjectFinancialAccount
              projectId={projectId}
              project={project}
              account={projectAccount}
              loading={loadingAccount}
              onReconcile={handleReconcileAccount}
              onUpdateBudget={async (newBudget) => {
                await onUpdateProject(projectId, { budget: newBudget });
                await loadProjectAccount(); // Refresh account to reflect new budget
              }}
              onRefresh={loadProjectAccount}
              onNavigate={onNavigate}
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
