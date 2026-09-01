import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast, PageHeader, ConfirmDialog, CONFIRM_CLOSED } from '../ui/Common';
import type { ConfirmState } from '../ui/Common';
import { useProjects } from '../../hooks/useProjects';
import { useTemplates } from '../../hooks/useTemplates';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { Project } from '../../types';
import { BatchImportModal } from '../shared/batchImport/BatchImportModal';
import { projectImportConfig } from './Projects/config/projectImportConfig';
import { EventTemplate } from '../../services/templatesService';
import type { ProjectFinancialAccount as ProjectFinancialAccountType, ProjectTransaction } from '../../types';
import { useBatchMode } from '../../contexts/BatchModeContext';
import { projectFinancialService } from '../../services/projectFinancialService';
import { PENDING_USE_TEMPLATE_KEY } from '../../utils/roadmapUtils';
import { ProjectDetailTabs } from './Projects/ProjectDetailTabs';
import { TemplatePreviewModal } from './Projects/TemplatePreviewModal';
import { ProjectsBatchActions } from './Projects/ProjectsBatchActions';
import { ProjectsCreateDrawer } from './Projects/ProjectsCreateDrawer';
import { ProjectsTemplateModal } from './Projects/ProjectsTemplateModal';
import { ProjectsDetailHeader } from './Projects/ProjectsDetailHeader';
import { ProjectsListShell } from './Projects/ProjectsListShell';
import { useProjectCreateForm } from './Projects/useProjectCreateForm';

// Roadmap template bridge extracted to utils/roadmapUtils.ts
// All sub-components extracted to Projects/ subdirectory

export const ProjectsView: React.FC<{ onNavigate?: (view: string) => void; searchQuery?: string; initialSelectedProjectId?: string | null; onClearSelection?: () => void }> = ({ onNavigate, searchQuery, initialSelectedProjectId, onClearSelection }) => {
  const [confirmState, setConfirmState] = useState<ConfirmState>(CONFIRM_CLOSED);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialSelectedProjectId ?? null);
  const [activeTab, setActiveTab] = useState<'projects' | 'past-projects' | 'templates'>('projects');
  const [isTemplateModalOpen, setTemplateModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EventTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EventTemplate | null>(null);
  const [templateSearchTerm, setTemplateSearchTerm] = useState('');
  const [templateFilterType, setTemplateFilterType] = useState<string>('all');

  const { projects, loading, error, createProject, updateProject, deleteProject } = useProjects();
  const { eventTemplates, loading: templatesLoading, error: templatesError, createEventTemplate, updateEventTemplate, deleteEventTemplate } = useTemplates();
  const { member } = useAuth();
  const { isBoard, isAdmin, isDeveloper } = usePermissions();
  const isPrivileged = isBoard || isAdmin || isDeveloper;
  const { showToast } = useToast();
  const { drawerProps: createDrawerProps, open: handleNewProposal } = useProjectCreateForm({
    member,
    createProject,
    showToast,
  });
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [isImportModalOpen, setImportModalOpen] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const { setIsBatchMode } = useBatchMode();
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    projects.forEach(p => {
      const dateStr = p.eventStartDate || p.startDate || p.date || p.proposedDate || p.createdAt;
      if (dateStr) {
        try {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) {
            years.add(d.getFullYear());
          }
        } catch { }
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [projects]);

  const [projectAccounts, setProjectAccounts] = useState<ProjectFinancialAccountType[]>([]);
  const [projectTrackerTransactions, setProjectTrackerTransactions] = useState<ProjectTransaction[]>([]);

  const loadFinancials = useCallback(async () => {
    try {
      const [accountsList, ptTrxs] = await Promise.all([
        projectFinancialService.getAllProjectAccounts(),
        projectFinancialService.getAllProjectTrackerTransactions()
      ]);
      setProjectAccounts(accountsList);
      setProjectTrackerTransactions(ptTrxs);
    } catch (err) {
      console.error('Error loading project financials:', err);
    }
  }, []);

  useEffect(() => {
    if (isPrivileged) {
      loadFinancials();
    }
  }, [loadFinancials, projects, isPrivileged]);

  useEffect(() => {
    setIsBatchMode(selectedProjectIds.size > 1);
    return () => setIsBatchMode(false);
  }, [selectedProjectIds.size, setIsBatchMode]);
  const [isBatchStatusModalOpen, setIsBatchStatusModalOpen] = useState(false);
  const [batchOperationProgress, setBatchOperationProgress] = useState<{ current: number; total: number } | null>(null);

  useEffect(() => {
    if (initialSelectedProjectId && projects.length > 0) {
      if (projects.some(p => p.id === initialSelectedProjectId)) {
        setSelectedProjectId(initialSelectedProjectId);
        if (onClearSelection) onClearSelection();
      }
    }
  }, [initialSelectedProjectId, projects, onClearSelection]);

  const displayedProjects = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const term = (searchQuery || '').toLowerCase();

    let filtered = projects;

    if (!isPrivileged && member) {
      filtered = filtered.filter(p => {
        const isCreator = p.organizerId === member.id || p.submittedBy === member.id;
        const isCommittee = p.committee?.some(c => c.memberId === member.id) ?? false;
        return isCreator || isCommittee;
      });
    }

    if (activeTab === 'past-projects') {
      filtered = filtered.filter(p => p.eventStartDate && p.eventStartDate < today);
    } else if (activeTab === 'projects') {
      filtered = filtered.filter(p => !p.eventStartDate || p.eventStartDate >= today);
    } else {
      return [];
    }

    // Filter by year
    filtered = filtered.filter(p => {
      const dateStr = p.eventStartDate || p.startDate || p.date || p.proposedDate || p.createdAt;
      if (dateStr) {
        try {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) {
            return d.getFullYear() === selectedYear;
          }
        } catch { }
      }
      return selectedYear === new Date().getFullYear();
    });

    if (term) {
      filtered = filtered.filter(p =>
        (p.name ?? '').toLowerCase().includes(term) ||
        (p.title ?? '').toLowerCase().includes(term) ||
        (p.description ?? '').toLowerCase().includes(term) ||
        (p.objectives ?? '').toLowerCase().includes(term) ||
        (p.pillar ?? '').toLowerCase().includes(term) ||
        (p.level ?? '').toLowerCase().includes(term) ||
        (p.category ?? '').toLowerCase().includes(term) ||
        (p.type ?? '').toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [projects, activeTab, searchQuery, selectedYear, isPrivileged, member]);

  const handleBatchDelete = () => {
    if (selectedProjectIds.size === 0) return;
    setConfirmState({ open: true, title: 'Delete Events', message: `Are you sure you want to delete ${selectedProjectIds.size} selected events? This action cannot be undone.`, variant: 'danger', onConfirm: async () => { setConfirmState(CONFIRM_CLOSED); await _doBatchDelete(); } });
  };
  const _doBatchDelete = async () => {

    const idsToDelete = Array.from(selectedProjectIds);
    setBatchOperationProgress({ current: 0, total: idsToDelete.length });

    try {
      // Process in parallel with progress updates
      await Promise.all(idsToDelete.map(async (id) => {
        await deleteProject(id);
        setBatchOperationProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null);
      }));

      setSelectedProjectIds(new Set());
      showToast(`Successfully deleted ${idsToDelete.length} events`, 'success');
    } catch (err) {
      showToast('Some events could not be deleted', 'error');
    } finally {
      setBatchOperationProgress(null);
    }
  };

  const handleBatchStatusUpdate = (newStatus: Project['status']) => {
    if (selectedProjectIds.size === 0) return;
    setConfirmState({ open: true, title: 'Update Status', message: `Are you sure you want to set status to ${newStatus} for ${selectedProjectIds.size} selected events?`, variant: 'warning', onConfirm: async () => { setConfirmState(CONFIRM_CLOSED); await _doBatchStatusUpdate(newStatus); } });
  };
  const _doBatchStatusUpdate = async (newStatus: Project['status']) => {
    const idsToUpdate = Array.from(selectedProjectIds);
    setBatchOperationProgress({ current: 0, total: idsToUpdate.length });

    try {
      // Process in parallel with progress updates
      await Promise.all(idsToUpdate.map(async (id) => {
        const proj = projects.find(p => p.id === id);
        if (proj) {
          await updateProject(id, { status: newStatus });
        }
        setBatchOperationProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null);
      }));

      setSelectedProjectIds(new Set());
      setIsBatchStatusModalOpen(false);
      showToast(`Successfully updated status for ${idsToUpdate.length} events`, 'success');
    } catch (err) {
      showToast('Some events could not be updated', 'error');
    } finally {
      setBatchOperationProgress(null);
    }
  };

  const handleSelectAll = useCallback(() => {
    const allIds = displayedProjects.map(p => p.id).filter(id => !!id) as string[];
    setSelectedProjectIds(new Set(allIds));
  }, [displayedProjects]);

  const handleImport = useCallback(() => setImportModalOpen(true), []);

  const handleToggleSelection = useCallback((id: string) => {
    setSelectedProjectIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ctrl+a or cmd+a
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        const activeElement = document.activeElement;
        const isInput = activeElement?.tagName === 'INPUT' ||
          activeElement?.tagName === 'TEXTAREA' ||
          (activeElement as HTMLElement)?.isContentEditable;

        if (!isInput && (activeTab === 'projects' || activeTab === 'past-projects') && !selectedProjectId) {
          e.preventDefault();
          handleSelectAll();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSelectAll, activeTab, selectedProjectId]);

  const handleStatusUpdate = async (newStatus: Project['status']) => {
    if (!selectedProjectId) return;
    setIsStatusUpdating(true);
    try {
      await updateProject(selectedProjectId, { status: newStatus });
      showToast(`Project status updated to ${newStatus}`, 'success');
    } catch (err) {
      showToast('Failed to update project status', 'error');
    } finally {
      setIsStatusUpdating(false);
    }
  };

  const handleClaimReimbursement = () => {
    if (selectedProject) {
      sessionStorage.setItem('pr_preselected_project_id', selectedProject.id || '');
      sessionStorage.setItem('pr_preselected_category', 'projects_activities');
      sessionStorage.setItem('pr_auto_open_submit', 'true');
      onNavigate?.('PAYMENT_REQUESTS');
    }
  };

  const selectedProject = useMemo(() => {
    const proj = projects.find(p => p.id === selectedProjectId);
    if (!proj) return undefined;
    if (isPrivileged) return proj;
    const isCreator = proj.organizerId === member?.id || proj.submittedBy === member?.id;
    const isCommittee = proj.committee?.some(c => c.memberId === member?.id) ?? false;
    return (isCreator || isCommittee) ? proj : undefined;
  }, [projects, selectedProjectId, isPrivileged, member]);

  const handleCreateTemplate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const checklist = (formData.get('checklist') as string)?.split('\n').filter(Boolean) || [];
    const resources = (formData.get('resources') as string)?.split('\n').filter(Boolean) || [];
    const payload = {
      name: formData.get('name') as string,
      description: formData.get('description') as string || undefined,
      type: formData.get('type') as any,
      defaultLocation: formData.get('defaultLocation') as string || undefined,
      defaultMaxAttendees: parseInt(formData.get('defaultMaxAttendees') as string) || undefined,
      defaultBudget: parseFloat(formData.get('defaultBudget') as string) || undefined,
      checklist,
      requiredResources: resources,
      estimatedDuration: parseFloat(formData.get('estimatedDuration') as string) || undefined,
    };
    try {
      if (selectedTemplate?.id) {
        const clean = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined));
        await updateEventTemplate(selectedTemplate.id, clean);
      } else {
        await createEventTemplate({ ...payload, createdBy: member?.id });
      }
      setTemplateModalOpen(false);
      setSelectedTemplate(null);
      e.currentTarget.reset();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save template', 'error');
    }
  };

  const handleUseTemplate = (template: EventTemplate) => {
    try {
      sessionStorage.setItem(PENDING_USE_TEMPLATE_KEY, template.id || '');
      onNavigate?.('EVENTS');
    } catch {
      showToast('Could not navigate to Events', 'error');
    }
  };

  return (
    <div className="space-y-2">
      {selectedProject ? (
        <ProjectsDetailHeader
          project={selectedProject}
          isPrivileged={isPrivileged}
          isStatusUpdating={isStatusUpdating}
          onBack={() => setSelectedProjectId(null)}
          onStatusUpdate={handleStatusUpdate}
        />
      ) : (
        <PageHeader
          title="Events Management"
          description="Create proposals, track approval, and manage activities."
        />
      )}

      {!selectedProject ? (
        <ProjectsListShell
          activeTab={activeTab}
          availableYears={availableYears}
          selectedYear={selectedYear}
          projects={displayedProjects}
          loading={loading}
          error={error}
          templates={eventTemplates}
          templatesLoading={templatesLoading}
          templatesError={templatesError}
          templateSearchTerm={templateSearchTerm}
          templateFilterType={templateFilterType}
          canManageTemplates={isBoard || isAdmin}
          isAdminOrBoard={isBoard || isAdmin}
          selectedProjectIds={selectedProjectIds}
          projectAccounts={projectAccounts}
          projectTrackerTransactions={projectTrackerTransactions}
          onActiveTabChange={(tab) => {
            setActiveTab(tab);
            setSelectedProjectId(null);
          }}
          onYearChange={setSelectedYear}
          onSelectProject={setSelectedProjectId}
          onNewProposal={handleNewProposal}
          onImport={handleImport}
          onToggleSelection={handleToggleSelection}
          onSelectAll={handleSelectAll}
          onTemplateSearchTermChange={setTemplateSearchTerm}
          onTemplateFilterTypeChange={setTemplateFilterType}
          onCreateTemplate={() => { setSelectedTemplate(null); setTemplateModalOpen(true); }}
          onPreviewTemplate={setPreviewTemplate}
          onUseTemplate={handleUseTemplate}
          onEditTemplate={(template) => { setSelectedTemplate(template); setTemplateModalOpen(true); }}
          onDeleteTemplate={(template) => setConfirmState({ open: true, title: 'Delete Template', message: 'Delete this template?', variant: 'danger', onConfirm: async () => { setConfirmState(CONFIRM_CLOSED); await deleteEventTemplate(template.id!); } })}
        />
      ) : (
        <>
          <ProjectDetailTabs
            project={selectedProject}
            onUpdateProject={updateProject}
            onDeleteProject={async (projectId) => {
              await deleteProject(projectId);
              setSelectedProjectId(null);
            }}
            onNavigate={onNavigate}
          />
        </>
      )}

      <ProjectsBatchActions
        visible={(activeTab === 'projects' || activeTab === 'past-projects') && !selectedProjectId && displayedProjects.length > 0 && selectedProjectIds.size > 1}
        selectedCount={selectedProjectIds.size}
        progress={batchOperationProgress}
        isStatusModalOpen={isBatchStatusModalOpen}
        onOpenStatusModal={() => setIsBatchStatusModalOpen(true)}
        onCloseStatusModal={() => setIsBatchStatusModalOpen(false)}
        onDelete={handleBatchDelete}
        onClearSelection={() => setSelectedProjectIds(new Set())}
        onStatusUpdate={handleBatchStatusUpdate}
      />


      <ProjectsCreateDrawer {...createDrawerProps} />


      <ProjectsTemplateModal
        isOpen={isTemplateModalOpen}
        selectedTemplate={selectedTemplate}
        onClose={() => { setTemplateModalOpen(false); setSelectedTemplate(null); }}
        onSubmit={handleCreateTemplate}
      />

      {/* Template Preview Modal */}
      {
        previewTemplate && (
          <TemplatePreviewModal
            template={previewTemplate}
            onClose={() => setPreviewTemplate(null)}
            onUse={() => { handleUseTemplate(previewTemplate); setPreviewTemplate(null); }}
          />
        )
      }

      {/* Project Import Modal */}
      <BatchImportModal
        isOpen={isImportModalOpen}
        onClose={() => setImportModalOpen(false)}
        config={projectImportConfig}
        context={{ user: member }}
        onImported={() => {
          showToast('Projects imported successfully', 'success');
          // Reload is handled by hook's listener usually, but projects state is reactive
        }}
      />

      <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} variant={confirmState.variant} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(CONFIRM_CLOSED)} />
    </div >
  )
}
