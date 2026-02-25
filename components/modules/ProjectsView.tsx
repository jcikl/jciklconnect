import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Settings, Zap, Layout, Kanban, Plus, UserCircle, FileText, Calendar, DollarSign, CheckCircle, XCircle, Clock, Edit, Trash2, Eye, GitBranch, BarChart3, RefreshCw, Download, Search, Copy, MapPin, Users, ChevronDown, ChevronUp, Send, Check, X, Globe, Lock, Layers } from 'lucide-react';
import { Button, Card, Badge, ProgressBar, Modal, useToast, Tabs } from '../ui/Common';
import { Input, Select, Textarea, Checkbox } from '../ui/Form';
import { Combobox } from '../ui/Combobox';
import { LoadingState } from '../ui/Loading';
import { useProjects } from '../../hooks/useProjects';
import { useTemplates } from '../../hooks/useTemplates';
import { useAuth } from '../../hooks/useAuth';
import { useMembers } from '../../hooks/useMembers';
import { usePermissions } from '../../hooks/usePermissions';
import { formatCurrency } from '../../utils/formatUtils';
import { formatDate, toDate } from '../../utils/dateUtils';
import { Project, Task, ProjectCommitteeMember, BankAccount } from '../../types';
import { PROJECT_LEVELS, PROJECT_PILLARS, PROJECT_CATEGORIES, PROJECT_TYPES_BY_CATEGORY } from '../../config/constants';
import { BatchImportModal } from '../shared/batchImport/BatchImportModal';
import { projectImportConfig } from './Projects/config/projectImportConfig';
import { EventTemplate } from '../../services/templatesService';
import { AIPredictionService } from '../../services/aiPredictionService';
import { BrainCircuit, TrendingUp, AlertTriangle } from 'lucide-react';
import { ProjectGanttChart } from './ProjectManagement/ProjectGanttChart';
import { ProjectAccountsService, ProjectAccount } from '../../services/projectAccountsService';
import { ProjectReportService, ProjectReport } from '../../services/projectReportService';
// ProjectTransactionModal removed Header: Title and Due Date
import { FinanceService } from '../../services/financeService';
import { Transaction } from '../../types';
import { useBatchMode } from '../../contexts/BatchModeContext';

const PENDING_USE_TEMPLATE_KEY = 'jci_pending_use_template_id';

export const ProjectsView: React.FC<{ onNavigate?: (view: string) => void; searchQuery?: string }> = ({ onNavigate, searchQuery }) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isProposalModalOpen, setProposalModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'projects' | 'past-projects' | 'templates'>('projects');
  const [isTemplateModalOpen, setTemplateModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EventTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EventTemplate | null>(null);
  const [templateSearchTerm, setTemplateSearchTerm] = useState('');
  const [templateFilterType, setTemplateFilterType] = useState<string>('all');
  // For project creation form: track selected category so Type options can update
  const [projectCategory, setProjectCategory] = useState<string>('');
  const { projects, loading, error, createProject, updateProject, deleteProject } = useProjects();
  const { eventTemplates, loading: templatesLoading, createEventTemplate, updateEventTemplate, deleteEventTemplate } = useTemplates();
  const { member } = useAuth();
  const { isBoard, isAdmin, isDeveloper } = usePermissions();
  const isPrivileged = isBoard || isAdmin || isDeveloper;
  const { showToast } = useToast();
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [isImportModalOpen, setImportModalOpen] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const { setIsBatchMode } = useBatchMode();

  useEffect(() => {
    setIsBatchMode(selectedProjectIds.size > 1);
    return () => setIsBatchMode(false);
  }, [selectedProjectIds.size, setIsBatchMode]);
  const [isBatchStatusModalOpen, setIsBatchStatusModalOpen] = useState(false);
  const [batchOperationProgress, setBatchOperationProgress] = useState<{ current: number; total: number } | null>(null);

  const displayedProjects = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const term = (searchQuery || '').toLowerCase();

    let filtered = projects;

    if (activeTab === 'past-projects') {
      filtered = projects.filter(p => p.eventStartDate && p.eventStartDate < today);
    } else if (activeTab === 'projects') {
      filtered = projects.filter(p => !p.eventStartDate || p.eventStartDate >= today);
    } else {
      return [];
    }

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
  }, [projects, activeTab, searchQuery]);

  const handleBatchDelete = async () => {
    if (selectedProjectIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedProjectIds.size} selected events? This action cannot be undone.`)) return;

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

  const handleBatchStatusUpdate = async (newStatus: Project['status']) => {
    if (selectedProjectIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to set status to ${newStatus} for ${selectedProjectIds.size} selected events?`)) return;

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

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const handleCreateProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!member) {
      showToast('Please login to create projects', 'error');
      return;
    }

    const formData = new FormData(e.currentTarget);
    try {
      // Create new project with Activity Plan fields
      // Initialize default committee with Organising Chairperson role
      const defaultCommittee: ProjectCommitteeMember[] = [
        {
          role: 'Organising Chairperson',
          memberId: '',
          tasks: [{ title: '', dueDate: '' }],
        },
      ];

      const projectId = await createProject({
        name: formData.get('title') as string,
        title: formData.get('title') as string,
        description: formData.get('description') as string || '',
        level: (formData.get('level') as any) || undefined,
        pillar: (formData.get('pillar') as any) || undefined,
        category: (formData.get('category') as any) || undefined,
        type: (formData.get('projectType') as string) || undefined,
        proposedDate: formData.get('proposedDate') as string,
        proposedBudget: parseFloat(formData.get('proposedBudget') as string) || 0,
        objectives: formData.get('objectives') as string,
        expectedImpact: formData.get('expectedImpact') as string || '',
        targetAudience: formData.get('targetAudience') as string || undefined,
        eventStartDate: (formData.get('eventStartDate') as string) || undefined,
        eventEndDate: (formData.get('eventEndDate') as string) || undefined,
        eventStartTime: (formData.get('eventStartTime') as string) || undefined,
        eventEndTime: (formData.get('eventEndTime') as string) || undefined,
        status: 'Planning',
        submittedBy: member.id,
        committee: defaultCommittee,
      });

      // Activity Plan will be created/managed in the Project Detail page's Activity Plan tab

      setProposalModalOpen(false);
      e.currentTarget.reset();
      showToast('Project created successfully', 'success');
    } catch (err) {
      // Error handled by hook
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const checklist = (formData.get('checklist') as string)?.split('\n').filter(Boolean) || [];
    const resources = (formData.get('resources') as string)?.split('\n').filter(Boolean) || [];
    try {
      await createEventTemplate({
        name: formData.get('name') as string,
        description: formData.get('description') as string || undefined,
        type: formData.get('type') as any,
        defaultLocation: formData.get('defaultLocation') as string || undefined,
        defaultMaxAttendees: parseInt(formData.get('defaultMaxAttendees') as string) || undefined,
        defaultBudget: parseFloat(formData.get('defaultBudget') as string) || undefined,
        checklist,
        requiredResources: resources,
        estimatedDuration: parseFloat(formData.get('estimatedDuration') as string) || undefined,
        createdBy: member?.id,
      });
      setTemplateModalOpen(false);
      setSelectedTemplate(null);
      e.currentTarget.reset();
    } catch (err) {
      // Error handled by hook
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          {selectedProject ? (
            <div className="flex items-center gap-2">
              <button onClick={() => setSelectedProjectId(null)} className="text-slate-400 hover:text-slate-600 text-sm">Events Management /</button>
              <h2 className="text-2xl font-bold text-slate-900">{selectedProject.name ?? selectedProject.title ?? 'Project'}</h2>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-slate-900">Events Management</h2>
              <p className="text-slate-500">Create proposals, track approval, and manage activities.</p>
            </>
          )}
        </div>
        <div className="flex gap-2">
          {!selectedProject && (
            <>
              {/* Create New Project button - always visible */}
              <Button onClick={() => setProposalModalOpen(true)}>
                <Plus size={16} className="mr-2" /> Start New Project
              </Button>
              <Button variant="outline" onClick={() => setImportModalOpen(true)}>
                <Copy size={16} className="mr-2" /> Paste Import
              </Button>
              {activeTab === 'templates' && (
                <Button onClick={() => { setSelectedTemplate(null); setTemplateModalOpen(true); }}>
                  <Plus size={16} className="mr-2" /> Create Template
                </Button>
              )}
            </>
          )}
          {selectedProject && (
            <div className="flex gap-2">
              {/* Member Workflow */}
              {(selectedProject.status === 'Planning' || selectedProject.status === 'Draft') && (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => handleStatusUpdate('Planning')}
                    disabled={isStatusUpdating}
                  >
                    Save Draft
                  </Button>
                  <Button
                    onClick={() => handleStatusUpdate('Under Review')}
                    disabled={isStatusUpdating}
                  >
                    <Send size={16} className="mr-2" /> Submit
                  </Button>
                </>
              )}

              {selectedProject.status === 'Under Review' && !isPrivileged && (
                <Button disabled variant="outline">
                  <Clock size={16} className="mr-2" /> Under Review
                </Button>
              )}

              {/* Board Workflow */}
              {selectedProject.status === 'Under Review' && isPrivileged && (
                <>
                  {/* Status indicator for privileged users */}
                  <div className="flex items-center px-3 bg-slate-100 rounded-lg text-slate-600 text-sm font-medium mr-2">
                    <Clock size={14} className="mr-1" /> Under Review
                  </div>
                  <Button
                    variant="danger"
                    onClick={() => handleStatusUpdate('Planning')}
                    disabled={isStatusUpdating}
                  >
                    <X size={16} className="mr-2" /> Reject
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => handleStatusUpdate('Approved')}
                    disabled={isStatusUpdating}
                  >
                    <Check size={16} className="mr-2" /> Approve
                  </Button>
                </>
              )}

              {/* Publish Workflow */}
              {selectedProject.status === 'Approved' && (
                <Button
                  onClick={() => handleStatusUpdate('Active')}
                  disabled={isStatusUpdating}
                >
                  <Globe size={16} className="mr-2" /> Publish
                </Button>
              )}

              {selectedProject.status === 'Active' && (
                <>
                  <Badge variant="success" className="h-10 px-4">
                    <Globe size={14} className="mr-1" /> Published
                  </Badge>
                  <Button
                    variant="danger"
                    onClick={() => handleStatusUpdate('Approved')}
                    disabled={isStatusUpdating}
                  >
                    <Lock size={16} className="mr-2" /> Unpublish
                  </Button>
                </>
              )}

            </div>
          )}
        </div>
      </div>

      {!selectedProject ? (
        <Card noPadding>
          <div className="px-4 md:px-6 pt-4">
            <Tabs
              tabs={['Ongoing Events', 'Past Events', 'Templates']}
              activeTab={activeTab === 'projects' ? 'Ongoing Events' : activeTab === 'past-projects' ? 'Past Events' : 'Templates'}
              onTabChange={(tab) => {
                if (tab === 'Ongoing Events') setActiveTab('projects');
                else if (tab === 'Past Events') setActiveTab('past-projects');
                else setActiveTab('templates');
                setSelectedProjectId(null);
              }}
            />
          </div>
          <div className="p-4">
            {(activeTab === 'projects' || activeTab === 'past-projects') ? (
              <ProjectGrid
                projects={displayedProjects}
                loading={loading}
                error={error}
                onSelect={setSelectedProjectId}
                onNewProposal={() => setProposalModalOpen(true)}
                onImport={() => setImportModalOpen(true)}
                selectedIds={selectedProjectIds}
                onToggleSelection={(id) => {
                  setSelectedProjectIds(prev => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  });
                }}
                onSelectAll={handleSelectAll}
              />
            ) : (
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      placeholder="Search templates..."
                      value={templateSearchTerm}
                      onChange={(e) => setTemplateSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-jci-blue"
                    />
                  </div>
                  <Select
                    value={templateFilterType}
                    onChange={(e) => setTemplateFilterType(e.target.value)}
                    options={[
                      { label: 'All Types', value: 'all' },
                      { label: 'Meeting', value: 'Meeting' },
                      { label: 'Training', value: 'Training' },
                      { label: 'Social', value: 'Social' },
                      { label: 'Project', value: 'Project' },
                      { label: 'International', value: 'International' },
                    ]}
                    className="w-48"
                  />
                </div>
                <LoadingState
                  loading={templatesLoading}
                  error={null}
                  empty={eventTemplates.length === 0}
                  emptyMessage="No templates created yet. Create your first template to streamline event planning."
                >
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {eventTemplates
                      .filter(template => {
                        const matchesSearch = !templateSearchTerm ||
                          template.name.toLowerCase().includes(templateSearchTerm.toLowerCase()) ||
                          (template.description?.toLowerCase().includes(templateSearchTerm.toLowerCase()) ?? false);
                        const matchesType = templateFilterType === 'all' || template.type === templateFilterType;
                        return matchesSearch && matchesType;
                      })
                      .map(template => (
                        <Card key={template.id} className="hover:shadow-lg transition-all cursor-pointer group">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <h3 className="text-lg font-bold text-slate-900 group-hover:text-jci-blue transition-colors">{template.name}</h3>
                              <Badge variant="neutral" className="mt-1">{template.type}</Badge>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setPreviewTemplate(template); }} title="Preview Template">
                                <Eye size={14} />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleUseTemplate(template); }} title="Use Template">
                                <Copy size={14} />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedTemplate(template); setTemplateModalOpen(true); }} title="Edit Template">
                                <Edit size={14} />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={async (e) => { e.stopPropagation(); if (window.confirm('Are you sure you want to delete this template?')) { await deleteEventTemplate(template.id!); } }} className="text-red-500 hover:text-red-700" title="Delete Template">
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </div>
                          {template.description && <p className="text-sm text-slate-600 mb-3 line-clamp-2">{template.description}</p>}
                          <div className="space-y-2 text-xs text-slate-500">
                            {template.defaultLocation && <div className="flex items-center gap-1"><MapPin size={12} /><span>{template.defaultLocation}</span></div>}
                            {template.estimatedDuration && <div className="flex items-center gap-1"><Clock size={12} /><span>{template.estimatedDuration} hours</span></div>}
                            {template.defaultBudget && <div className="flex items-center gap-1"><DollarSign size={12} /><span>{formatCurrency(template.defaultBudget)}</span></div>}
                            {template.checklist && template.checklist.length > 0 && <div className="flex items-center gap-1"><CheckCircle size={12} /><span>{template.checklist.length} checklist items</span></div>}
                            {template.requiredResources && template.requiredResources.length > 0 && <div className="flex items-center gap-1"><FileText size={12} /><span>{template.requiredResources.length} resources</span></div>}
                          </div>
                          <div className="mt-4 pt-3 border-t border-slate-100">
                            <Button variant="outline" size="sm" className="w-full" onClick={(e) => { e.stopPropagation(); handleUseTemplate(template); }}>
                              <Copy size={14} className="mr-2" />
                              Use This Template
                            </Button>
                          </div>
                        </Card>
                      ))}
                  </div>
                </LoadingState>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <>
          <ProjectDetailTabs
            project={selectedProject}
            onUpdateProject={updateProject}
            onDeleteProject={async (projectId) => {
              await deleteProject(projectId);
              setSelectedProjectId(null);
            }}
          />
        </>
      )}

      {/* Floating Batch Action Bar */}
      {(activeTab === 'projects' || activeTab === 'past-projects') && !selectedProjectId && displayedProjects.length > 0 && selectedProjectIds.size > 1 && (
        <div className="fixed bottom-6 left-6 right-6 md:left-1/2 md:right-auto md:-translate-x-1/2 z-[60] animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-slate-900 text-white px-2 md:px-6 py-3 md:py-4 rounded-[40px] md:rounded-2xl shadow-2xl flex items-center justify-around md:justify-start gap-0 md:gap-6 border border-white/10 backdrop-blur-md h-20 md:h-auto">
            <div className="flex flex-col md:flex-row items-center gap-1 md:gap-3 md:pr-4 md:border-r border-white/20 min-w-[70px] md:min-w-0">
              <Layers size={20} className="text-blue-400 md:w-4 md:h-4" />
              <span className="text-[9px] md:text-sm font-bold md:font-medium tracking-widest md:tracking-tight uppercase md:capitalize whitespace-nowrap">{selectedProjectIds.size} Selected</span>
            </div>

            {batchOperationProgress ? (
              <div className="flex-1 max-w-[150px] md:w-48 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                <div
                  className="h-full bg-blue-500 transition-all duration-300 ease-out"
                  style={{ width: `${(batchOperationProgress.current / batchOperationProgress.total) * 100}%` }}
                />
              </div>
            ) : (
              <>
                <button
                  onClick={() => setIsBatchStatusModalOpen(true)}
                  className="flex flex-col md:flex-row items-center gap-1 md:gap-2 text-blue-400 hover:text-blue-300 transition-all min-w-[70px] md:min-w-0"
                >
                  <div className="p-2 md:p-0 rounded-2xl md:rounded-none bg-white/5 md:bg-transparent">
                    <Settings size={20} className="md:w-4 md:h-4" />
                  </div>
                  <span className="text-[9px] md:text-sm font-bold tracking-widest md:tracking-normal uppercase md:capitalize">Status</span>
                </button>
                <button
                  onClick={handleBatchDelete}
                  className="flex flex-col md:flex-row items-center gap-1 md:gap-2 text-red-400 hover:text-red-300 transition-all min-w-[70px] md:min-w-0"
                >
                  <div className="p-2 md:p-0 rounded-2xl md:rounded-none bg-white/5 md:bg-transparent">
                    <Trash2 size={20} className="md:w-4 md:h-4" />
                  </div>
                  <span className="text-[9px] md:text-sm font-bold tracking-widest md:tracking-normal uppercase md:capitalize">Delete</span>
                </button>
                <button
                  onClick={() => setSelectedProjectIds(new Set())}
                  className="flex flex-col md:flex-row items-center gap-1 md:gap-2 text-slate-400 hover:text-white transition-all min-w-[70px] md:min-w-0"
                >
                  <div className="p-2 md:p-0 rounded-2xl md:rounded-none bg-white/5 md:bg-transparent">
                    <X size={20} className="md:w-4 md:h-4" />
                  </div>
                  <span className="text-[9px] md:text-sm font-bold tracking-widest md:tracking-normal uppercase md:capitalize">Clear</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Project Creation Modal */}
      <Modal
        isOpen={isProposalModalOpen}
        onClose={() => {
          setProposalModalOpen(false);
        }}
        title="Start New Project"
        size="lg"
        drawerOnMobile
        footer={
          <div className="flex gap-3 w-full">
            <Button className="flex-1" type="submit" form="create-project-form">Create Project</Button>
            <Button variant="ghost" type="button" onClick={() => setProposalModalOpen(false)}>Cancel</Button>
          </div>
        }
      >
        <form id="create-project-form" onSubmit={handleCreateProject} className="space-y-4">
          <p className="text-sm text-slate-500 mb-4 bg-blue-50 p-3 rounded text-blue-800">
            Create a new project. You can add an Activity Plan later in the project detail page.
          </p>

          <Input
            name="title"
            label="Project Title *"
            placeholder="e.g. Summer Leadership Summit"
            icon={<FileText size={16} />}
            required
          />

          <Textarea
            name="description"
            label="Description"
            placeholder="Brief description of the project..."
            rows={3}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              name="level"
              label="Level"
              options={[
                { label: '— Select —', value: '' },
                ...PROJECT_LEVELS.map(l => ({ label: l, value: l })),
              ]}
            />
            <Select
              name="pillar"
              label="Pillar"
              options={[
                { label: '— Select —', value: '' },
                ...PROJECT_PILLARS.map(p => ({ label: p, value: p })),
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              name="category"
              label="Category"
              value={projectCategory}
              onChange={(e) => setProjectCategory(e.target.value)}
              options={[
                { label: '— Select —', value: '' },
                ...PROJECT_CATEGORIES.map(c => ({ label: c.replace('_', ' '), value: c })),
              ]}
            />
            <Select
              name="projectType"
              label="Type"
              options={[
                { label: '— Select —', value: '' },
                ...(projectCategory ? (PROJECT_TYPES_BY_CATEGORY[projectCategory] ?? []) : []).map(t => ({ label: t, value: t })),
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              name="proposedDate"
              label="Proposed Date *"
              type="date"
              icon={<Calendar size={16} />}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              name="eventStartDate"
              label="Event Start Date"
              type="date"
              icon={<Calendar size={16} />}
            />
            <Input
              name="eventEndDate"
              label="Event End Date"
              type="date"
              icon={<Calendar size={16} />}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              name="eventStartTime"
              label="Event Start Time"
              type="time"
              icon={<Clock size={16} />}
            />
            <Input
              name="eventEndTime"
              label="Event End Time"
              type="time"
              icon={<Clock size={16} />}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              name="proposedBudget"
              label="Proposed Budget (RM) *"
              type="number"
              step="0.01"
              placeholder="5000"
              icon={<DollarSign size={16} />}
              required
            />
            <Input
              name="targetAudience"
              label="Target Audience"
              placeholder="e.g. All Members, Youth, etc."
            />
          </div>

          <Textarea
            name="objectives"
            label="Objectives & Goals *"
            placeholder="Describe the goals and expected community impact..."
            rows={4}
            required
          />

          <Textarea
            name="expectedImpact"
            label="Expected Impact"
            placeholder="Describe the expected outcomes and impact..."
            rows={3}
          />


        </form>
      </Modal>


      {/* Create/Edit Event Template Modal */}
      <Modal
        isOpen={isTemplateModalOpen}
        onClose={() => { setTemplateModalOpen(false); setSelectedTemplate(null); }}
        title={selectedTemplate ? "Edit Template" : "Create Event Template"}
        size="lg"
        drawerOnMobile
        footer={
          <div className="flex gap-3 w-full">
            <Button className="flex-1" type="submit" form="create-template-form">{selectedTemplate ? 'Update Template' : 'Create Template'}</Button>
            <Button variant="ghost" type="button" onClick={() => { setTemplateModalOpen(false); setSelectedTemplate(null); }}>Cancel</Button>
          </div>
        }
      >
        <form id="create-template-form" onSubmit={handleCreateTemplate} className="space-y-4">
          <Input name="name" label="Template Name" placeholder="e.g. Monthly Networking Event" defaultValue={selectedTemplate?.name} required />
          <Textarea name="description" label="Description" placeholder="Template description..." defaultValue={selectedTemplate?.description} rows={3} />
          <Select name="type" label="Event Type" options={[{ label: 'Meeting', value: 'Meeting' }, { label: 'Training', value: 'Training' }, { label: 'Social', value: 'Social' }, { label: 'Project', value: 'Project' }, { label: 'International', value: 'International' }]} defaultValue={selectedTemplate?.type} required />
          <div className="grid grid-cols-2 gap-4">
            <Input name="defaultLocation" label="Default Location" placeholder="e.g. JCI KL Office" defaultValue={selectedTemplate?.defaultLocation} />
            <Input name="defaultMaxAttendees" label="Default Max Attendees" type="number" defaultValue={selectedTemplate?.defaultMaxAttendees?.toString()} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input name="defaultBudget" label="Default Budget (RM)" type="number" step="0.01" defaultValue={selectedTemplate?.defaultBudget?.toString()} />
            <Input name="estimatedDuration" label="Estimated Duration (hours)" type="number" step="0.5" defaultValue={selectedTemplate?.estimatedDuration?.toString()} />
          </div>
          <Textarea name="checklist" label="Checklist (one item per line)" placeholder="Venue booking&#10;Catering&#10;Registration setup" defaultValue={selectedTemplate?.checklist?.join('\n')} rows={4} helperText="Enter each checklist item on a new line" />
          <Textarea name="resources" label="Required Resources (one item per line)" placeholder="Projector&#10;Sound system&#10;Tables" defaultValue={selectedTemplate?.requiredResources?.join('\n')} rows={3} helperText="Enter each resource on a new line" />
        </form>
      </Modal>

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

      {/* Batch Status Update Modal */}
      <Modal
        isOpen={isBatchStatusModalOpen}
        onClose={() => setIsBatchStatusModalOpen(false)}
        title="Batch Update Status"
        size="md"
        drawerOnMobile
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Apply a new status to the {selectedProjectIds.size} selected events.
          </p>
          <div className="grid grid-cols-1 gap-2">
            {(['Planning', 'Draft', 'Under Review', 'Approved', 'Active', 'Completed', 'Cancelled'] as Project['status'][]).map((status) => (
              <Button
                key={status}
                variant="outline"
                className="justify-start"
                onClick={() => handleBatchStatusUpdate(status)}
              >
                {status === 'Active' ? 'Published' : status === 'Planning' ? 'Draft / Unpublished' : status}
              </Button>
            ))}
          </div>
          <div className="pt-2">
            <Button variant="ghost" className="w-full" onClick={() => setIsBatchStatusModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div >
  )
}

const ProjectGrid: React.FC<{
  projects: Project[];
  loading: boolean;
  error: string | null;
  onSelect: (id: string) => void;
  onNewProposal: () => void;
  onImport: () => void;
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
  onSelectAll?: () => void;
}> = ({ projects, loading, error, onSelect, onNewProposal, onImport, selectedIds, onToggleSelection, onSelectAll }) => {
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

  return (
    <LoadingState loading={loading} error={error} empty={false}>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {/* Always show the CTA card first */}
        <div
          onClick={onNewProposal}
          className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-slate-500 hover:border-jci-blue hover:text-jci-blue hover:bg-sky-50 transition-colors h-full min-h-[300px] cursor-pointer"
        >
          <Zap size={32} className="mb-3" />
          <span className="font-medium">Start New Project</span>
          <span className="text-xs mt-1">or submit an activity plan</span>
          <div className="mt-4 pt-4 border-t border-slate-200 w-full flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onImport(); }}
              className="text-xs"
            >
              <Copy size={14} className="mr-1" /> Paste Import
            </Button>
          </div>
        </div>

        {/* Then render all existing projects (if any) */}
        {projects.map(project => (
          <Card
            key={project.id}
            className={`flex flex-col h-full cursor-pointer transition-all group relative ${selectedIds?.has(project.id) ? 'border-jci-blue bg-blue-50/30' : 'hover:border-jci-blue'}`}
            onClick={() => onToggleSelection?.(project.id)}
          >
            {/* Checkbox for batch selection */}
            <div
              className="absolute top-4 right-4 z-10 pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <Checkbox
                checked={selectedIds?.has(project.id)}
                onChange={() => onToggleSelection?.(project.id)}
              />
            </div>

            {/* Wrapper div to capture click event but stop propagation on buttons if needed */}
            <div className="pointer-events-none">
              <div className="flex justify-between items-start mb-4">
                <Badge variant={getStatusVariant(project.status)}>{getStatusLabel(project.status)}</Badge>
              </div>

              <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-jci-blue transition-colors">{project.name ?? project.title ?? 'Unnamed'}</h3>
              <p className="text-sm text-slate-500 mb-6">{project.description ?? `Lead: ${project.lead ?? '-'}`}</p>

              <div className="space-y-4 mb-6 flex-1">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600">Completion</span>
                    <span className="font-medium text-slate-900">{project.completion ?? 0}%</span>
                  </div>
                  <ProgressBar progress={project.completion ?? 0} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <span className="text-xs text-slate-500 block">Budget Used</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(project.spent ?? 0)} / {formatCurrency(project.budget ?? 0)}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <span className="text-xs text-slate-500 block">Team Size</span>
                    <span className="font-semibold text-slate-900">{project.teamSize ?? 0} Members</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 mt-auto">
              <Button variant="outline" className="w-full text-sm" onClick={(e) => { e.stopPropagation(); onSelect(project.id); }}>Open Board</Button>
            </div>
          </Card>
        ))}
      </div>
    </LoadingState>
  );
}

// Project AI Predictions Component
const ProjectAIPredictions: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [successPrediction, setSuccessPrediction] = useState<any>(null);
  const [sponsorMatches, setSponsorMatches] = useState<any[]>([]);
  const [isLoadingPrediction, setIsLoadingPrediction] = useState(false);
  const [isLoadingSponsors, setIsLoadingSponsors] = useState(false);
  const [activeTab, setActiveTab] = useState<'success' | 'sponsors'>('success');
  const { showToast } = useToast();

  useEffect(() => {
    loadPredictions();
  }, [projectId]);

  const loadPredictions = async () => {
    setIsLoadingPrediction(true);
    setIsLoadingSponsors(true);
    try {
      const [prediction, sponsors] = await Promise.all([
        AIPredictionService.predictProjectSuccess(projectId),
        AIPredictionService.matchSponsors(projectId),
      ]);
      setSuccessPrediction(prediction);
      setSponsorMatches(sponsors);
    } catch (err) {
      showToast('Failed to load AI predictions', 'error');
    } finally {
      setIsLoadingPrediction(false);
      setIsLoadingSponsors(false);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Low': return 'text-green-600 bg-green-50';
      case 'Medium': return 'text-yellow-600 bg-yellow-50';
      case 'High': return 'text-red-600 bg-red-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BrainCircuit className="text-jci-blue" size={20} />
          <h3 className="text-lg font-bold text-slate-900">AI Insights & Recommendations</h3>
        </div>
        <Tabs
          tabs={['Success Prediction', 'Sponsor Matching']}
          activeTab={activeTab === 'success' ? 'Success Prediction' : 'Sponsor Matching'}
          onTabChange={(tab) => setActiveTab(tab === 'Success Prediction' ? 'success' : 'sponsors')}
        />
      </div>

      {activeTab === 'success' ? (
        <LoadingState loading={isLoadingPrediction} error={null} empty={!successPrediction} emptyMessage="No prediction available">
          {successPrediction && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-slate-900">Project Success Probability</h4>
                  <Badge variant="info" className={getRiskColor(successPrediction.riskLevel)}>
                    {successPrediction.riskLevel} Risk
                  </Badge>
                </div>
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <div className="text-4xl font-bold text-jci-blue mb-2">
                      {successPrediction.successProbability}%
                    </div>
                    <ProgressBar progress={successPrediction.successProbability} color="bg-jci-blue" />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 mb-3">Success Factors</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Team Experience</div>
                    <div className="text-lg font-bold text-slate-900">{successPrediction.factors.teamExperience}%</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Budget Adequacy</div>
                    <div className="text-lg font-bold text-slate-900">{successPrediction.factors.budgetAdequacy}%</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Timeline Realism</div>
                    <div className="text-lg font-bold text-slate-900">{successPrediction.factors.timelineRealism}%</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Resources</div>
                    <div className="text-lg font-bold text-slate-900">{successPrediction.factors.resourceAvailability}%</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Engagement</div>
                    <div className="text-lg font-bold text-slate-900">{successPrediction.factors.memberEngagement}%</div>
                  </div>
                </div>
              </div>

              {successPrediction.risks && successPrediction.risks.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <AlertTriangle className="text-yellow-600" size={18} />
                    Identified Risks
                  </h4>
                  <div className="space-y-3">
                    {successPrediction.risks.map((risk: any, idx: number) => (
                      <div key={idx} className="border border-slate-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <span className="font-medium text-slate-900">{risk.description}</span>
                          <Badge variant={risk.severity === 'High' ? 'error' : risk.severity === 'Medium' ? 'warning' : 'neutral'}>
                            {risk.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600">{risk.mitigation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {successPrediction.recommendations && successPrediction.recommendations.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <TrendingUp className="text-jci-blue" size={18} />
                    Recommendations
                  </h4>
                  <ul className="space-y-2">
                    {successPrediction.recommendations.map((rec: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="text-jci-blue mt-1">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </LoadingState>
      ) : (
        <LoadingState loading={isLoadingSponsors} error={null} empty={sponsorMatches.length === 0} emptyMessage="No sponsor matches found">
          <div className="space-y-4">
            {sponsorMatches.map((match, idx) => (
              <Card key={idx} className="hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900 mb-1">{match.sponsorName}</h4>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="info">Match Score: {match.matchScore}%</Badge>
                    </div>
                    {match.reasons && match.reasons.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-slate-500 mb-1">Why this match:</p>
                        <ul className="text-sm text-slate-700 space-y-1">
                          {match.reasons.map((reason: string, rIdx: number) => (
                            <li key={rIdx} className="flex items-start gap-2">
                              <span className="text-jci-blue mt-1">•</span>
                              <span>{reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {match.contactInfo && (
                      <div className="text-sm text-slate-600">
                        {match.contactInfo.email && <div>Email: {match.contactInfo.email}</div>}
                        {match.contactInfo.phone && <div>Phone: {match.contactInfo.phone}</div>}
                      </div>
                    )}
                  </div>
                  <Button variant="outline" size="sm">
                    Contact
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </LoadingState>
      )}
    </Card>
  );
};

const ProjectKanban: React.FC<{ projectId: string; projectName: string; project: Project }> = ({ projectId, projectName, project }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [newRemark, setNewRemark] = useState('');
  const [showStatusHistory, setShowStatusHistory] = useState(false);
  const [expandedRemarks, setExpandedRemarks] = useState<Set<string>>(new Set()); // Track which cards have expanded remarks
  const { getProjectTasks, createTask, updateTask, getTaskById } = useProjects();
  const { members } = useMembers();
  const { member } = useAuth();
  const { showToast } = useToast();
  const columns: Array<'Todo' | 'In Progress' | 'Done'> = ['Todo', 'In Progress', 'Done'];

  // Helper function to get sorted remarks (newest first)
  const getSortedRemarks = (remarks?: Record<string, { content: string; timestamp: string }>) => {
    if (!remarks) return [];
    return Object.entries(remarks)
      .map(([id, remark]) => ({ id, ...remark }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  // Helper function to get latest remark
  const getLatestRemark = (task: Task) => {
    const sortedRemarks = getSortedRemarks(task.remarks);
    return sortedRemarks.length > 0 ? sortedRemarks[0] : null;
  };

  // Toggle remarks expansion for a task
  const toggleRemarksExpansion = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    setExpandedRemarks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  // 使用 ref 来防止重复加载
  const isLoadingRef = useRef(false);
  const lastLoadTimeRef = useRef<number>(0);

  const loadTasks = useCallback(async () => {
    // 防止重复加载：如果正在加载或距离上次加载不到 500ms，则跳过
    const now = Date.now();
    if (isLoadingRef.current || (now - lastLoadTimeRef.current < 500)) {
      console.log('[Kanban] Skipping duplicate loadTasks call');
      return;
    }

    isLoadingRef.current = true;
    lastLoadTimeRef.current = now;

    try {
      setLoading(true);
      // Load tasks from Firestore
      const projectTasks = await getProjectTasks(projectId);
      console.log('[Kanban] Loaded tasks:', projectTasks.length);

      // Normalize task status
      const normalizedTasks = projectTasks.map(t => ({
        ...t,
        status: String(t.status || 'Todo') as 'Todo' | 'In Progress' | 'Done',
      }));

      setTasks(normalizedTasks);
    } catch (err) {
      console.error('[Kanban] Error loading tasks:', err);
      showToast(`Failed to load tasks: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [projectId, getProjectTasks, showToast]);

  useEffect(() => {
    loadTasks();
  }, [projectId, loadTasks]);

  const handleTaskStatusChange = async (taskId: string, newStatus: 'Todo' | 'In Progress' | 'Done') => {
    try {
      // updateTask 会自动记录 statusHistory
      await updateTask(taskId, { status: newStatus });
      await loadTasks();
      // 更新 selectedTask 以反映新状态
      if (selectedTask && selectedTask.id === taskId) {
        const updatedTask = await getTaskById(taskId);
        if (updatedTask) {
          setSelectedTask(updatedTask);
        }
      }
      showToast('Task status updated successfully', 'success');
    } catch (err) {
      showToast('Failed to update task status', 'error');
    }
  };

  const handleAddRemark = async (taskId: string) => {
    if (!newRemark.trim()) {
      showToast('Please enter a remark', 'warning');
      return;
    }

    try {
      // 获取现有 task 以合并 remarks
      const existingTask = await getTaskById(taskId);
      const existingRemarks = existingTask?.remarks || {};

      // 添加新 remark
      const remarkId = `remark-${Date.now()}`;
      const updatedRemarks = {
        ...existingRemarks,
        [remarkId]: {
          content: newRemark.trim(),
          timestamp: new Date().toISOString(),
        },
      };

      await updateTask(taskId, { remarks: updatedRemarks });
      setNewRemark('');
      await loadTasks();

      // 更新 selectedTask
      if (selectedTask && selectedTask.id === taskId) {
        const updatedTask = await getTaskById(taskId);
        if (updatedTask) {
          setSelectedTask(updatedTask);
        }
      }

      showToast('Remark added successfully', 'success');
    } catch (err) {
      showToast('Failed to add remark', 'error');
    }
  };

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', task.id);
  };

  const handleDragOver = (e: React.DragEvent, column: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(column);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, targetColumn: 'Todo' | 'In Progress' | 'Done') => {
    e.preventDefault();
    setDragOverColumn(null);

    if (draggedTask && draggedTask.status !== targetColumn) {
      await handleTaskStatusChange(draggedTask.id, targetColumn);
    }
    setDraggedTask(null);
  };

  const handleCreateTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      await createTask({
        projectId,
        title: formData.get('title') as string,
        status: 'Todo',
        priority: (formData.get('priority') as 'High' | 'Medium' | 'Low') || 'Medium',
        dueDate: formData.get('dueDate') as string,
        assignee: formData.get('assignee') as string || member?.id || '',
      });
      setIsTaskModalOpen(false);
      e.currentTarget.reset();
      await loadTasks();
    } catch (err) {
      showToast('Failed to create task', 'error');
    }
  };

  const getMemberName = (memberId: string) => {
    const member = members.find(m => m.id === memberId);
    return member?.name || memberId;
  };

  return (
    <>
      <div className="flex gap-6 overflow-x-auto pb-6">
        {columns.map(col => {
          const columnTasks = tasks.filter(t => {
            const taskStatus = String(t.status || 'Todo').trim();
            return taskStatus === col;
          });
          console.log(`[Kanban] Column ${col}: ${columnTasks.length} tasks`, columnTasks.map(t => ({ id: t.id, title: t.title, status: t.status, statusType: typeof t.status, assignee: t.assignee })));
          // 调试：显示所有任务的状态
          if (col === 'Todo' && columnTasks.length === 0 && tasks.length > 0) {
            console.log('[Kanban] All tasks statuses:', tasks.map(t => ({ id: t.id, title: t.title, status: t.status, statusType: typeof t.status })));
          }
          return (
            <div
              key={col}
              className={`w-80 flex-shrink-0 flex flex-col bg-slate-100 rounded-xl max-h-[600px] transition-all ${dragOverColumn === col ? 'ring-2 ring-jci-blue ring-offset-2' : ''
                }`}
              onDragOver={(e) => handleDragOver(e, col)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col)}
            >
              <div className="p-4 font-bold text-slate-700 flex justify-between items-center">
                {col}
                <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full">
                  {columnTasks.length}
                </span>
              </div>
              <div className="p-3 space-y-3 overflow-y-auto flex-1">
                {loading ? (
                  <div className="text-center py-8 text-slate-400 text-sm">Loading tasks...</div>
                ) : (
                  <>
                    {columnTasks.map(task => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task)}
                        className={`bg-white p-3 rounded shadow-sm border border-slate-200 cursor-move hover:shadow-md transition-all ${draggedTask?.id === task.id ? 'opacity-50' : ''
                          }`}
                        onClick={() => setSelectedTask(task)}
                      >
                        {/* Header: Title and Due Date */}
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="text-sm font-bold text-slate-800 line-clamp-2 pr-2" title={task.title}>{task.title}</h4>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap">
                            {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Middle: Role(Name) and Priority */}
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-[10px] text-slate-600 truncate mr-2" title={task.role ? `${task.role}(${getMemberName(task.assignee)})` : getMemberName(task.assignee)}>
                            {task.role ? `${task.role}(${getMemberName(task.assignee)})` : getMemberName(task.assignee)}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${task.priority === 'High' ? 'bg-red-50 text-red-600' :
                            task.priority === 'Medium' ? 'bg-yellow-50 text-yellow-600' :
                              'bg-blue-50 text-blue-600'
                            }`}>
                            {task.priority}
                          </span>
                        </div>

                        {/* Remarks Section */}
                        {(() => {
                          const latestRemark = getLatestRemark(task);
                          const allRemarks = getSortedRemarks(task.remarks);
                          const isExpanded = expandedRemarks.has(task.id);
                          const hasRemarks = allRemarks.length > 0;

                          if (!hasRemarks) return null;

                          return (
                            <div className="mb-2 border-t border-slate-100 pt-2 flex justify-between items-start gap-2">
                              <div className="flex-1 min-w-0">
                                {/* Latest Remark */}
                                {!isExpanded && latestRemark && (
                                  <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded">
                                    <div className="line-clamp-2">{latestRemark.content}</div>
                                    <div className="text-[10px] text-slate-400 mt-1">
                                      {new Date(latestRemark.timestamp).toLocaleString()}
                                    </div>
                                  </div>
                                )}

                                {/* All Remarks (when expanded) */}
                                {isExpanded && (
                                  <div className="space-y-2 max-h-32 overflow-y-auto">
                                    {allRemarks.map((remark) => (
                                      <div key={remark.id} className="text-xs text-slate-600 bg-slate-50 p-2 rounded">
                                        <div>{remark.content}</div>
                                        <div className="text-[10px] text-slate-400 mt-1">
                                          {new Date(remark.timestamp).toLocaleString()}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Expand/Collapse Button (Icon only, on the right) */}
                              {allRemarks.length > 1 && (
                                <button
                                  onClick={(e) => toggleRemarksExpansion(task.id, e)}
                                  className="text-jci-blue hover:text-jci-blue-dark mt-1 p-1 hover:bg-slate-100 rounded transition-colors"
                                  title={isExpanded ? "Show less" : `View all (${allRemarks.length})`}
                                >
                                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>
                              )}
                            </div>
                          );
                        })()}


                      </div>
                    ))}
                    <button
                      className="w-full py-2 text-slate-400 hover:text-slate-600 text-sm border border-dashed border-slate-300 rounded hover:bg-white transition-colors"
                      onClick={() => {
                        setSelectedTask(null);
                        setIsTaskModalOpen(true);
                      }}
                    >
                      + Add Task
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Modal */}
      <Modal
        isOpen={isTaskModalOpen || !!selectedTask}
        onClose={() => {
          setIsTaskModalOpen(false);
          setSelectedTask(null);
          setNewRemark('');
          setShowStatusHistory(false);
        }}
        title={selectedTask ? 'Task Details' : 'Create New Task'}
        drawerOnMobile
      >
        {selectedTask ? (
          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-lg mb-2">{selectedTask.title}</h3>
              <div className="flex gap-2 mb-4">
                <Badge variant={selectedTask.priority === 'High' ? 'error' : selectedTask.priority === 'Medium' ? 'warning' : 'info'}>
                  {selectedTask.priority}
                </Badge>
                <Badge variant="neutral">{selectedTask.status}</Badge>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Priority:</span>
                  <select
                    value={selectedTask.priority}
                    onChange={(e) => {
                      const priority = e.target.value as 'High' | 'Medium' | 'Low';
                      updateTask(selectedTask.id, { priority }).then(() => {
                        loadTasks();
                        setSelectedTask(prev => prev ? { ...prev, priority } : null);
                        showToast('Priority updated', 'success');
                      });
                    }}
                    className="text-xs bg-white border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-jci-blue"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-slate-500">Assigned to:</span> {selectedTask.role ? `${selectedTask.role}(${getMemberName(selectedTask.assignee)})` : getMemberName(selectedTask.assignee)}
                </div>
                <div>
                  <span className="text-slate-500">Due date:</span> {new Date(selectedTask.dueDate).toLocaleDateString()}
                </div>
              </div>
            </div>



            {/* Remarks Section */}
            <div className="border-t pt-4">
              <div className="text-sm font-semibold text-slate-700 mb-2">Remarks</div>
              <div className="space-y-2 mb-3">
                <Textarea
                  value={newRemark}
                  onChange={(e) => setNewRemark(e.target.value)}
                  placeholder="Add a remark..."
                  rows={3}
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleAddRemark(selectedTask.id)}
                    disabled={!newRemark.trim()}
                  >
                    Add Remark
                  </Button>
                </div>
              </div>
              {selectedTask.remarks && Object.keys(selectedTask.remarks).length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto mt-4">
                  {Object.entries(selectedTask.remarks)
                    .sort(([, a], [, b]) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .map(([id, remark]) => (
                      <div key={id} className="text-sm bg-slate-50 p-3 rounded border border-slate-200 flex justify-between items-start gap-3">
                        <div className="text-slate-800 flex-1">{remark.content}</div>
                        <div className="text-xs text-slate-400 whitespace-nowrap">{new Date(remark.timestamp).toLocaleString()}</div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="pt-4 flex justify-end border-t">
              <Button variant="outline" onClick={() => {
                setSelectedTask(null);
                setNewRemark('');
                setShowStatusHistory(false);
              }}>Close</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateTask} className="space-y-4">
            <Input name="title" label="Task Title" placeholder="e.g. Design event flyer" required />
            <div className="grid grid-cols-2 gap-4">
              <Select
                name="priority"
                label="Priority"
                options={[
                  { label: 'High', value: 'High' },
                  { label: 'Medium', value: 'Medium' },
                  { label: 'Low', value: 'Low' }
                ]}
                defaultValue="Medium"
              />
              <Input name="dueDate" label="Due Date" type="date" required />
            </div>
            <Select
              name="assignee"
              label="Assign To"
              options={[
                { label: 'Unassigned', value: '' },
                ...members.map(m => ({ label: m.name, value: m.id }))
              ]}
            />
            <div className="pt-4 flex gap-3">
              <Button className="flex-1" type="submit">Create Task</Button>
              <Button variant="ghost" type="button" onClick={() => setIsTaskModalOpen(false)}>Cancel</Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
};

// Project Detail Tabs Component
interface ProjectDetailTabsProps {
  project: Project;
  onUpdateProject: (projectId: string, updates: Partial<Project>) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
}

const ProjectDetailTabs: React.FC<ProjectDetailTabsProps> = ({ project, onUpdateProject, onDeleteProject }) => {
  const { projectId, projectName } = { projectId: project.id, projectName: project.name ?? project.title ?? 'Project' };
  const [activeTab, setActiveTab] = useState<'activity-plan' | 'committee' | 'kanban' | 'gantt' | 'finance' | 'reports' | 'ai'>('activity-plan');
  const [projectAccount, setProjectAccount] = useState<ProjectAccount | null>(null);
  const [projectReport, setProjectReport] = useState<ProjectReport | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  // Modal states removed for inline editing
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

  const handleDeleteProject = async () => {
    const confirmed = window.confirm('Are you sure you want to delete this project and its activity plan? This action cannot be undone.');
    if (!confirmed) return;
    try {
      await onDeleteProject(projectId);
    } catch (err) {
      showToast('Failed to delete project', 'error');
    }
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

  return (
    <>
      <Card noPadding>
        <div className="px-6 pt-4">
          <Tabs
            tabs={['Activity Plan', 'Event Committee', 'Kanban Board', 'Gantt Chart', 'Financial Account', 'Reports', 'AI Insights']}
            activeTab={
              activeTab === 'activity-plan' ? 'Activity Plan' :
                activeTab === 'committee' ? 'Event Committee' :
                  activeTab === 'kanban' ? 'Kanban Board' :
                    activeTab === 'gantt' ? 'Gantt Chart' :
                      activeTab === 'finance' ? 'Financial Account' :
                        activeTab === 'reports' ? 'Reports' : 'AI Insights'
            }
            onTabChange={(tab) => {
              if (tab === 'Activity Plan') setActiveTab('activity-plan');
              else if (tab === 'Event Committee') setActiveTab('committee');
              else if (tab === 'Kanban Board') setActiveTab('kanban');
              else if (tab === 'Gantt Chart') setActiveTab('gantt');
              else if (tab === 'Financial Account') setActiveTab('finance');
              else if (tab === 'Reports') setActiveTab('reports');
              else setActiveTab('ai');
            }}
          />
        </div>
        <div className="p-4">
          {activeTab === 'committee' && (
            <ProjectCommitteeTab
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
            <ProjectActivityPlanTab
              project={project}
              onSave={(updates) => onUpdateProject(projectId, updates)}
              onDelete={handleDeleteProject}
            />
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
    </>
  );
};

// Project Financial Account Component
interface ProjectFinancialAccountProps {
  projectId: string;
  project: Project;
  account: ProjectAccount | null;
  loading: boolean;
  onReconcile: () => Promise<{
    discrepancies: Array<{
      type: 'Missing Transaction' | 'Amount Mismatch' | 'Duplicate';
      description: string;
      projectAmount?: number;
      mainAccountAmount?: number;
      difference?: number;
    }>;
    reconciled: boolean;
  }>;
  onUpdateBudget: (newBudget: number) => Promise<void>;
  onRefresh: () => void;
}

const ProjectFinancialAccount: React.FC<ProjectFinancialAccountProps> = ({
  account,
  loading,
  onReconcile,
  onUpdateBudget,
  onRefresh
}) => {
  const { showToast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bankTransactions, setBankTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [loadingBankTransactions, setLoadingBankTransactions] = useState(false);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [newBudget, setNewBudget] = useState(0);
  const [activeFinancialTab, setActiveFinancialTab] = useState('budget');
  const [incomePurposeValue, setIncomePurposeValue] = useState('');
  const [expensePurposeValue, setExpensePurposeValue] = useState('');
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingIncome, setIsAddingIncome] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Transaction>>({});
  const [addForm, setAddForm] = useState<Partial<Transaction>>({});

  const uniquePurposes = useMemo(() => {
    return Array.from(new Set(transactions.map(t => t.purpose).filter(Boolean))) as string[];
  }, [transactions]);

  useEffect(() => {
    if (account) {
      setNewBudget(account.budget);
      loadTransactions();
      loadBankAccounts();
    }
  }, [account]);

  const loadBankAccounts = async () => {
    try {
      const accounts = await FinanceService.getAllBankAccounts();
      setBankAccounts(accounts);
    } catch (err) {
      console.error('Failed to load bank accounts', err);
    }
  };

  const loadTransactions = async () => {
    if (!account) return;
    setLoadingTransactions(true);
    setLoadingBankTransactions(true);
    try {
      // Fetch internal project transactions (projectTrx collection)
      const projectTx = await FinanceService.getProjectTransactions(account.projectId);
      setTransactions(projectTx);

      // Fetch official bank transactions (transactions collection tagged with projectId)
      const bankTx = await FinanceService.getBankTransactionsByProject(account.projectId);
      setBankTransactions(bankTx);
    } catch (err) {
      console.error('Failed to load transactions', err);
    } finally {
      setLoadingTransactions(false);
      setLoadingBankTransactions(false);
    }
  };

  const handleInlineSave = async (id: string, isNew = false) => {
    const data = isNew ? addForm : editForm;
    if (!data.amount || !data.description || !data.date) {
      showToast('Please fill in all required fields (Amount, Description, Date)', 'warning');
      return;
    }

    try {
      if (isNew) {
        await FinanceService.createProjectTransaction({
          ...(data as any),
          projectId: account?.projectId,
          category: 'Projects & Activities',
          status: 'Pending',
        });
        showToast('Transaction added successfully', 'success');
        setIsAddingIncome(false);
        setIsAddingExpense(false);
        setAddForm({});
      } else {
        await FinanceService.updateProjectTransaction(id, data);
        showToast('Transaction updated successfully', 'success');
        setEditingId(null);
        setEditForm({});
      }
      loadTransactions();
    } catch (err) {
      showToast('Failed to save transaction', 'error');
    }
  };

  const handleInlineCancel = (isNew = false) => {
    if (isNew) {
      setIsAddingIncome(false);
      setIsAddingExpense(false);
      setAddForm({});
    } else {
      setEditingId(null);
      setEditForm({});
    }
  };

  const startInlineEdit = (tx: Transaction) => {
    setEditingId(tx.id);
    setEditForm(tx);
  };

  const startInlineAdd = (type: 'Income' | 'Expense', purpose?: string) => {
    const isIncome = type === 'Income';
    if (isIncome) setIsAddingIncome(true);
    else setIsAddingExpense(true);

    setAddForm({
      type,
      purpose,
      date: new Date().toISOString().split('T')[0],
    });
  };

  const handleSaveBudget = async () => {
    try {
      await onUpdateBudget(newBudget);
      setIsEditingBudget(false);
      showToast('Budget updated successfully', 'success');
    } catch (err) {
      showToast('Failed to update budget', 'error');
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    try {
      await FinanceService.deleteProjectTransaction(transactionId);
      showToast('Transaction deleted successfully', 'success');
      loadTransactions();
      onRefresh(); // Refresh parent account data
    } catch (err) {
      console.error(err);
      showToast('Failed to delete transaction', 'error');
    }
  };

  const handleLinkBankTransaction = async (bankTxId: string, projectTxId?: string) => {
    try {
      await FinanceService.updateTransaction(bankTxId, { projectTransactionId: projectTxId || null } as any);
      showToast(projectTxId ? 'Bank transaction linked to project transaction' : 'Link removed', 'success');
      loadTransactions();
      const bankTx = await FinanceService.getBankTransactionsByProject(account!.projectId);
      setBankTransactions(bankTx);
    } catch (err) {
      console.error('Failed to link bank transaction', err);
      showToast('Failed to update bank transaction link', 'error');
    }
  };



  if (loading) {
    return <LoadingState loading={true} error={null} empty={false}><div>Loading...</div></LoadingState>;
  }

  if (!account) {
    return (
      <div className="text-center py-12">
        <DollarSign className="mx-auto text-slate-400 mb-4" size={48} />
        <p className="text-slate-500 mb-4">No financial account found for this project</p>
        <p className="text-sm text-slate-400 mb-6">Financial account will be created automatically when project transactions are recorded</p>
        <Button onClick={() => startInlineAdd('Income')}>
          <Plus size={16} className="mr-2" /> Add First Transaction
        </Button>
      </div>
    );
  }

  // Calculate financials from transactions to ensure data consistency with projectTrx collection
  const totalExpenses = transactions
    .filter(t => t.type === 'Expense')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const totalIncome = transactions
    .filter(t => t.type === 'Income')
    .reduce((sum, t) => sum + t.amount, 0);

  const budgetUtilization = account.budget > 0 ? (totalExpenses / account.budget) * 100 : 0;
  const remainingBudget = account.budget - totalExpenses;

  return (
    <div className="space-y-6">
      <Tabs
        tabs={[
          { id: 'budget', label: 'Project Budget' },
          { id: 'projectTrx', label: 'Projects Transactions' },
          { id: 'bankTrx', label: 'Bank Transactions' }
        ]}
        activeTab={activeFinancialTab}
        onTabChange={setActiveFinancialTab}
      />

      {activeFinancialTab === 'budget' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <div className="flex justify-between items-start mb-1">
                <div className="text-sm text-slate-500">Budget</div>
                <button onClick={() => setIsEditingBudget(true)} className="text-slate-400 hover:text-jci-blue transition-colors">
                  <Edit size={14} />
                </button>
              </div>
              {isEditingBudget ? (
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    value={newBudget.toString()}
                    onChange={(e) => setNewBudget(parseFloat(e.target.value) || 0)}
                    className="h-8 text-sm"
                  />
                  <Button size="sm" onClick={handleSaveBudget}><Check size={14} /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsEditingBudget(false)}><X size={14} /></Button>
                </div>
              ) : (
                <div className="text-2xl font-bold text-slate-900">{formatCurrency(account.budget, account.currency)}</div>
              )}
            </Card>
            <Card>
              <div className="text-sm text-slate-500 mb-1">Allocated</div>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(account.budget, account.currency)}</div>
            </Card>
            <Card>
              <div className="text-sm text-slate-500 mb-1">Expenses</div>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses, account.currency)}</div>
            </Card>
            <Card>
              <div className="text-sm text-slate-500 mb-1">Balance</div>
              <div className={`text-2xl font-bold ${remainingBudget >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(remainingBudget, account.currency)}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card title="Budget Health" className="lg:col-span-1 border-jci-blue/20">
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-500">Budget Utilization</span>
                    <span className={`font-semibold ${budgetUtilization > 100 ? 'text-red-600' : 'text-slate-700'}`}>
                      {budgetUtilization.toFixed(1)}%
                    </span>
                  </div>
                  <ProgressBar
                    progress={Math.min(budgetUtilization, 100)}
                    color={budgetUtilization > 90 ? (budgetUtilization > 100 ? 'danger' : 'warning') : 'primary'}
                  />
                </div>

                <div className="space-y-3 font-mono">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Total Budget</span>
                    <span className="font-medium">{formatCurrency(account.budget, account.currency)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Expenses</span>
                    <span className="font-medium text-red-600">-{formatCurrency(totalExpenses, account.currency)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-100">
                    <span className="font-medium text-slate-900">Remaining</span>
                    <span className={`font-bold ${remainingBudget >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(remainingBudget, account.currency)}
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <Button variant="outline" className="w-full" onClick={onReconcile}>
                    <RefreshCw size={16} className="mr-2" /> Reconcile Account
                  </Button>
                </div>
              </div>
            </Card>

            <Card title="Financial Overview" className="lg:col-span-2">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Project Income</div>
                    <div className="text-xl font-bold text-green-600">{formatCurrency(totalIncome, account.currency)}</div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Project Expenses</div>
                    <div className="text-xl font-bold text-red-600">{formatCurrency(totalExpenses, account.currency)}</div>
                  </div>
                </div>

                <div className="bg-jci-blue/5 p-4 rounded-lg border border-jci-blue/10">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={16} className="text-jci-blue" />
                    <span className="font-semibold text-jci-blue">Budget Utilization Status</span>
                  </div>
                  <p className="text-sm text-slate-600">
                    {budgetUtilization > 100
                      ? "The project has exceeded its allocated budget. Please review the expenses."
                      : budgetUtilization > 80
                        ? "Warning: Budget utilization is high. More than 80% of funds have been spent."
                        : "Budget utilization is currently within healthy limits."}
                  </p>
                </div>

                {account.lastReconciled && (
                  <div className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock size={12} />
                    Last reconciled: {formatDate(toDate(account.lastReconciled))}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeFinancialTab === 'projectTrx' && (
        <div className="space-y-6 animate-in slide-in-from-right-2 duration-300">
          {loadingTransactions && (
            <div className="flex justify-center py-8">
              <RefreshCw className="animate-spin text-jci-blue" size={32} />
            </div>
          )}

          {/* Incomes Section */}
          <Card className="overflow-hidden border-none shadow-sm" noPadding>
            <div className="flex justify-between items-center p-4 border-b-2 border-green-500">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-full text-green-600">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-green-700">Incomes</h3>
                  <p className="text-xs text-slate-500">{transactions.filter(t => t.type === 'Income').length} Items</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Combobox
                  className="w-48"
                  placeholder="Set Purpose"
                  options={uniquePurposes}
                  value={incomePurposeValue}
                  onChange={setIncomePurposeValue}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-jci-blue hover:bg-jci-blue/10"
                  onClick={() => startInlineAdd('Income', incomePurposeValue)}
                >
                  <Plus size={16} className="mr-1" /> Add
                </Button>
              </div>
            </div>

            <div className="p-0">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-medium">
                  <tr>
                    <th className="py-3 px-4 text-xs font-semibold w-[30%]">Item/Category</th>

                    <th className="py-3 px-2 text-xs font-semibold w-[20%]">Ref No.</th>
                    <th className="py-3 px-2 text-xs font-semibold w-[20%]">Paid Via / To</th>
                    <th className="py-3 px-2 text-xs font-semibold text-right w-[10%]">Amount</th>
                    <th className="py-3 px-2 text-xs font-semibold w-[10%]">Date</th>
                    <th className="py-3 px-2 text-xs font-semibold w-[10%]">Status</th>
                    <th className="py-3 px-2 text-xs font-semibold w-[50px]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isAddingIncome && (
                    <tr className="bg-blue-50/30">
                      <td className="py-2 px-2">
                        <Input
                          className="h-8 text-xs"
                          value={addForm.description || ''}
                          onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                          placeholder="Description"
                        />
                      </td>

                      <td className="py-2 px-2">
                        <Input
                          className="h-8 text-xs"
                          value={addForm.referenceNumber || ''}
                          onChange={(e) => setAddForm({ ...addForm, referenceNumber: e.target.value })}
                          placeholder="Ref No."
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Select
                          className="h-8 text-xs"
                          value={addForm.bankAccountId || ''}
                          onChange={(e) => setAddForm({ ...addForm, bankAccountId: e.target.value })}
                          options={[
                            { label: 'None', value: '' },
                            ...bankAccounts.map(acc => ({ label: acc.name, value: acc.id }))
                          ]}
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          className="h-8 text-xs font-mono text-right"
                          type="number"
                          step="0.01"
                          value={addForm.amount || ''}
                          onChange={(e) => setAddForm({ ...addForm, amount: parseFloat(e.target.value) })}
                          placeholder="0.00"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          className="h-8 text-xs"
                          type="date"
                          value={addForm.date || ''}
                          onChange={(e) => setAddForm({ ...addForm, date: e.target.value })}
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant="warning">Pending</Badge>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleInlineSave('', true)}
                            className="p-1 text-green-600 hover:bg-green-100 rounded"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => handleInlineCancel(true)}
                            className="p-1 text-red-600 hover:bg-red-100 rounded"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {Object.entries(
                    transactions
                      .filter(t => t.type === 'Income')
                      .reduce((groups, t) => {
                        const purpose = t.purpose || 'Uncategorized';
                        if (!groups[purpose]) groups[purpose] = [];
                        groups[purpose].push(t);
                        return groups;
                      }, {} as Record<string, Transaction[]>)
                  ).length === 0 && !isAddingIncome ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        <Layout size={32} className="mx-auto mb-2 opacity-20" />
                        No data available
                      </td>
                    </tr>
                  ) : (
                    Object.entries(
                      transactions
                        .filter(t => t.type === 'Income')
                        .reduce((groups, t) => {
                          const purpose = t.purpose || 'Uncategorized';
                          if (!groups[purpose]) groups[purpose] = [];
                          groups[purpose].push(t);
                          return groups;
                        }, {} as Record<string, Transaction[]>)
                    ).map(([purpose, groupTransactions]) => (
                      <React.Fragment key={purpose}>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                          <td colSpan={3} className="py-2 px-4 font-bold text-slate-600 bg-green-100/50">
                            <span>{purpose} ({groupTransactions.length})</span>
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-bold text-green-600 bg-green-100/50">
                            {formatCurrency(groupTransactions.reduce((sum, t) => sum + t.amount, 0), account.currency)}
                          </td>
                          <td colSpan={3} className="bg-green-100/50"></td>
                        </tr>
                        {groupTransactions.map((tx) => (
                          <tr key={tx.id} className="hover:bg-slate-50 group transition-colors">
                            {editingId === tx.id ? (
                              <>
                                <td className="py-2 px-2">
                                  <div className="flex flex-col gap-1">
                                    <Combobox
                                      className="w-full"
                                      placeholder="Purpose"
                                      options={uniquePurposes}
                                      value={editForm.purpose || ''}
                                      onChange={(val) => setEditForm({ ...editForm, purpose: val })}
                                    />
                                    <Input
                                      className="h-8 text-xs"
                                      value={editForm.description || ''}
                                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                      placeholder="Description"
                                    />
                                  </div>
                                </td>

                                <td className="py-2 px-2">
                                  <Input
                                    className="h-8 text-xs"
                                    value={editForm.referenceNumber || ''}
                                    onChange={(e) => setEditForm({ ...editForm, referenceNumber: e.target.value })}
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <Select
                                    className="h-8 text-xs"
                                    value={editForm.bankAccountId || ''}
                                    onChange={(e) => setEditForm({ ...editForm, bankAccountId: e.target.value })}
                                    options={[
                                      { label: 'None', value: '' },
                                      ...bankAccounts.map(acc => ({ label: acc.name, value: acc.id }))
                                    ]}
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <Input
                                    className="h-8 text-xs text-right font-mono"
                                    type="number"
                                    step="0.01"
                                    value={editForm.amount || ''}
                                    onChange={(e) => setEditForm({ ...editForm, amount: parseFloat(e.target.value) })}
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <Input
                                    className="h-8 text-xs"
                                    type="date"
                                    value={editForm.date || ''}
                                    onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                                  />
                                </td>
                                <td className="py-2 px-2 text-center">-</td>
                                <td className="py-2 px-2 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      onClick={() => handleInlineSave(tx.id)}
                                      className="p-1 text-green-600 hover:bg-green-100 rounded"
                                    >
                                      <Check size={16} />
                                    </button>
                                    <button
                                      onClick={() => handleInlineCancel()}
                                      className="p-1 text-red-600 hover:bg-red-100 rounded"
                                    >
                                      <X size={16} />
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="py-1 px-4 text-slate-900">- {tx.description}</td>

                                <td className="py-1 px-2 text-slate-500 text-xs">{tx.referenceNumber || '-'}</td>
                                <td className="py-1 px-2 text-slate-500 text-xs">
                                  {bankAccounts.find(a => a.id === tx.bankAccountId)?.name || '-'}
                                </td>
                                <td className="py-1 px-2 text-right font-mono text-green-600">
                                  {formatCurrency(tx.amount, account.currency)}
                                </td>
                                <td className="py-1 px-2 text-slate-500 text-xs">{new Date(tx.date).toLocaleDateString()}</td>
                                <td className="py-1 px-2">
                                  {(() => {
                                    const isVerified = bankTransactions.some(bt => (bt as any).projectTransactionId === tx.id);
                                    return (
                                      <Badge variant={isVerified ? 'success' : tx.status === 'Cleared' ? 'success' : tx.status === 'Pending' ? 'warning' : 'info'}>
                                        {isVerified ? 'Verified' : tx.status}
                                      </Badge>
                                    );
                                  })()}
                                </td>
                                <td className="py-1 px-2 text-right">
                                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => startInlineEdit(tx)}
                                      className="text-slate-400 hover:text-jci-blue p-1 transition-colors"
                                    >
                                      <Edit size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteTransaction(tx.id)}
                                      className="text-slate-400 hover:text-red-600 p-1 transition-colors"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Expenses Section */}
          <Card className="overflow-hidden border-none shadow-sm" noPadding>
            <div className="flex justify-between items-center p-4 border-b-2 border-red-500">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-full text-red-600">
                  <TrendingUp size={20} className="rotate-180" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-red-700">Expenses</h3>
                  <p className="text-xs text-slate-500">{transactions.filter(t => t.type === 'Expense').length} Items</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Combobox
                  className="w-48"
                  placeholder="Set Purpose"
                  options={uniquePurposes}
                  value={expensePurposeValue}
                  onChange={setExpensePurposeValue}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-jci-blue hover:bg-jci-blue/10"
                  onClick={() => startInlineAdd('Expense', expensePurposeValue)}
                >
                  <Plus size={16} className="mr-1" /> Add
                </Button>
              </div>
            </div>

            <div className="p-0">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-medium">
                  <tr>
                    <th className="py-3 px-4 text-xs font-semibold w-[30%]">Item/Category</th>

                    <th className="py-3 px-2 text-xs font-semibold w-[20%]">Ref No.</th>
                    <th className="py-3 px-2 text-xs font-semibold w-[20%]">Paid Via / To</th>
                    <th className="py-3 px-2 text-xs font-semibold text-right w-[10%]">Amount</th>
                    <th className="py-3 px-2 text-xs font-semibold w-[10%]">Date</th>
                    <th className="py-3 px-2 text-xs font-semibold w-[10%]">Status</th>
                    <th className="py-3 px-2 text-xs font-semibold w-[50px]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isAddingExpense && (
                    <tr className="bg-red-50/30">
                      <td className="py-2 px-2">
                        <Input
                          className="h-8 text-xs"
                          value={addForm.description || ''}
                          onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                          placeholder="Description"
                        />
                      </td>

                      <td className="py-2 px-2">
                        <Input
                          className="h-8 text-xs h-8 text-xs"
                          value={addForm.referenceNumber || ''}
                          onChange={(e) => setAddForm({ ...addForm, referenceNumber: e.target.value })}
                          placeholder="Ref No."
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Select
                          className="h-8 text-xs"
                          value={addForm.bankAccountId || ''}
                          onChange={(e) => setAddForm({ ...addForm, bankAccountId: e.target.value })}
                          options={[
                            { label: 'None', value: '' },
                            ...bankAccounts.map(acc => ({ label: acc.name, value: acc.id }))
                          ]}
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          className="h-8 text-xs text-right font-mono text-red-600"
                          type="number"
                          step="0.01"
                          value={addForm.amount || ''}
                          onChange={(e) => setAddForm({ ...addForm, amount: parseFloat(e.target.value) })}
                          placeholder="0.00"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          className="h-8 text-xs h-8 text-xs"
                          type="date"
                          value={addForm.date || ''}
                          onChange={(e) => setAddForm({ ...addForm, date: e.target.value })}
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant="warning">Pending</Badge>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleInlineSave('', true)}
                            className="p-1 text-green-600 hover:bg-green-100 rounded"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => handleInlineCancel(true)}
                            className="p-1 text-red-600 hover:bg-red-100 rounded"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {Object.entries(
                    transactions
                      .filter(t => t.type === 'Expense')
                      .reduce((groups, t) => {
                        const purpose = t.purpose || 'Uncategorized';
                        if (!groups[purpose]) groups[purpose] = [];
                        groups[purpose].push(t);
                        return groups;
                      }, {} as Record<string, Transaction[]>)
                  ).length === 0 && !isAddingExpense ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        <Layout size={32} className="mx-auto mb-2 opacity-20" />
                        No data available
                      </td>
                    </tr>
                  ) : (
                    Object.entries(
                      transactions
                        .filter(t => t.type === 'Expense')
                        .reduce((groups, t) => {
                          const purpose = t.purpose || 'Uncategorized';
                          if (!groups[purpose]) groups[purpose] = [];
                          groups[purpose].push(t);
                          return groups;
                        }, {} as Record<string, Transaction[]>)
                    ).map(([purpose, groupTransactions]) => (
                      <React.Fragment key={purpose}>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                          <td colSpan={3} className="py-2 px-4 font-bold text-slate-600 bg-red-100/50">
                            <span>{purpose} ({groupTransactions.length})</span>
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-bold text-red-600 bg-red-100/50">
                            {formatCurrency(groupTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0), account.currency)}
                          </td>
                          <td colSpan={3} className="bg-red-100/50"></td>
                        </tr>
                        {groupTransactions.map((tx) => (
                          <tr key={tx.id} className="hover:bg-slate-50 group transition-colors">
                            {editingId === tx.id ? (
                              <>
                                <td className="py-2 px-2">
                                  <div className="flex flex-col gap-1">
                                    <Combobox
                                      className="w-full"
                                      placeholder="Purpose"
                                      options={uniquePurposes}
                                      value={editForm.purpose || ''}
                                      onChange={(val) => setEditForm({ ...editForm, purpose: val })}
                                    />
                                    <Input
                                      className="h-8 text-xs"
                                      value={editForm.description || ''}
                                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                    />
                                  </div>
                                </td>

                                <td className="py-2 px-2">
                                  <Input
                                    className="h-8 text-xs"
                                    value={editForm.referenceNumber || ''}
                                    onChange={(e) => setEditForm({ ...editForm, referenceNumber: e.target.value })}
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <Select
                                    className="h-8 text-xs"
                                    value={editForm.bankAccountId || ''}
                                    onChange={(e) => setEditForm({ ...editForm, bankAccountId: e.target.value })}
                                    options={[
                                      { label: 'None', value: '' },
                                      ...bankAccounts.map(acc => ({ label: acc.name, value: acc.id }))
                                    ]}
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <Input
                                    className="h-8 text-xs text-right font-mono text-red-600"
                                    type="number"
                                    step="0.01"
                                    value={editForm.amount || ''}
                                    onChange={(e) => setEditForm({ ...editForm, amount: parseFloat(e.target.value) })}
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <Input
                                    className="h-8 text-xs"
                                    type="date"
                                    value={editForm.date || ''}
                                    onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                                  />
                                </td>
                                <td className="py-2 px-2 text-center">-</td>
                                <td className="py-2 px-2 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      onClick={() => handleInlineSave(tx.id)}
                                      className="p-1 text-green-600 hover:bg-green-100 rounded"
                                    >
                                      <Check size={16} />
                                    </button>
                                    <button
                                      onClick={() => handleInlineCancel()}
                                      className="p-1 text-red-600 hover:bg-red-100 rounded"
                                    >
                                      <X size={16} />
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="py-1 px-4 text-slate-900">- {tx.description}</td>

                                <td className="py-1 px-2 text-slate-500 text-xs">{tx.referenceNumber || '-'}</td>
                                <td className="py-1 px-2 text-slate-500 text-xs">
                                  {bankAccounts.find(a => a.id === tx.bankAccountId)?.name || '-'}
                                </td>
                                <td className="py-1 px-2 text-right font-mono text-red-600">
                                  {formatCurrency(Math.abs(tx.amount), account.currency)}
                                </td>
                                <td className="py-1 px-2 text-slate-500 text-xs">{new Date(tx.date).toLocaleDateString()}</td>
                                <td className="py-2 px-2">
                                  {(() => {
                                    const isVerified = bankTransactions.some(bt => (bt as any).projectTransactionId === tx.id);
                                    return (
                                      <Badge variant={isVerified ? 'success' : tx.status === 'Cleared' ? 'success' : tx.status === 'Pending' ? 'warning' : 'info'}>
                                        {isVerified ? 'Verified' : tx.status}
                                      </Badge>
                                    );
                                  })()}
                                </td>
                                <td className="py-1 px-2 text-right">
                                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => startInlineEdit(tx)}
                                      className="text-slate-400 hover:text-jci-blue p-1 transition-colors"
                                    >
                                      <Edit size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteTransaction(tx.id)}
                                      className="text-slate-400 hover:text-red-600 p-1 transition-colors"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Summary Footer Section */}
          <div className="mt-8 p-6 bg-slate-50 rounded-xl border border-slate-200">
            <div className="space-y-4 w-full">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-slate-700">Total Income</span>
                <span className="text-xl font-bold text-green-600 font-mono">{formatCurrency(totalIncome, account.currency)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-slate-700">Total Expenses</span>
                <span className="text-xl font-bold text-red-600 font-mono">-{formatCurrency(totalExpenses, account.currency)}</span>
              </div>
              <div className="h-px bg-slate-200 my-2"></div>
              <div className="flex justify-between items-center">
                <span className="text-xl font-extrabold text-slate-900">Net Profit</span>
                <span className={`text-2xl font-black font-mono ${(totalIncome - totalExpenses) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totalIncome - totalExpenses, account.currency)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeFinancialTab === 'bankTrx' && (
        <Card title="Bank Transactions" className="animate-in slide-in-from-right-2 duration-300">
          <div className="space-y-6">
            <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-600">
              <p>These transactions are recorded in the general ledger and tagged with this project ID. They represent official financial records for reconciliation.</p>
            </div>

            {loadingBankTransactions ? (
              <div className="text-center py-4 text-slate-500">Loading bank transactions...</div>
            ) : bankTransactions.length === 0 ? (
              <div className="text-center py-4 text-slate-500">No bank transactions linked to this project found</div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="py-2 px-3 pl-4">Date</th>
                    <th className="py-2 px-3">Description</th>
                    <th className="py-2 px-3">Ref</th>
                    <th className="py-2 px-3">Project Trx</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bankTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 pl-4 text-slate-500 font-mono">{new Date(tx.date).toLocaleDateString()}</td>
                      <td className="py-2 px-3 font-medium text-slate-900">{tx.description}</td>
                      <td className="py-2 px-3 text-slate-500">{tx.referenceNumber || '-'}</td>
                      <td className="py-2 px-3">
                        <Select
                          value={(tx as any).projectTransactionId || ''}
                          onChange={(e) => handleLinkBankTransaction(tx.id, e.target.value || undefined)}
                          options={[{ label: '—', value: '' }, ...(transactions || []).map(t => ({ label: `${t.description || t.purpose || 'Txn'} • ${formatCurrency(t.amount, account.currency)}`, value: t.id }))]}
                          className="w-56"
                        />
                      </td>
                      <td className={`py-2 px-3 text-right font-mono ${tx.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.type === 'Income' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount), account.currency)}
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant={tx.status === 'Cleared' ? 'success' : tx.status === 'Reconciled' ? 'info' : 'warning'}>
                          {tx.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

// Project Reports Tab Component
interface ProjectReportsTabProps {
  projectId: string;
  projectName: string;
  onGenerateReport: () => Promise<void>;
  loading: boolean;
}

const ProjectReportsTab: React.FC<ProjectReportsTabProps> = ({
  projectName,
  onGenerateReport,
  loading,
}) => {
  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Project Reports</h3>
            <p className="text-sm text-slate-500">Generate comprehensive reports for {projectName}</p>
          </div>
          <Button onClick={onGenerateReport} disabled={loading}>
            <FileText size={16} className="mr-2" />
            {loading ? 'Generating...' : 'Generate Report'}
          </Button>
        </div>
        <div className="p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            Reports include executive summary, team performance, timeline analysis, risks and issues, and recommendations.
          </p>
        </div>
      </Card>
    </div>
  );
};

// Project Report Modal Component
interface ProjectReportModalProps {
  report: ProjectReport;
  onClose: () => void;
}

const ProjectReportModal: React.FC<ProjectReportModalProps> = ({ report, onClose }) => {
  const { showToast } = useToast();

  const handleExportJSON = async () => {
    try {
      const json = await ProjectReportService.exportReportAsJSON(report.projectId);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-report-${report.projectId}-${new Date().toISOString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Report exported successfully', 'success');
    } catch (err) {
      showToast('Failed to export report', 'error');
    }
  };

  const handleExportText = async () => {
    try {
      const text = await ProjectReportService.exportReportAsText(report.projectId);
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-report-${report.projectId}-${new Date().toISOString()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Report exported successfully', 'success');
    } catch (err) {
      showToast('Failed to export report', 'error');
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`Project Report: ${report.projectName}`} size="xl">
      <div className="space-y-6 max-h-[80vh] overflow-y-auto">
        <div className="flex gap-2 pb-4 border-b">
          <Button variant="outline" size="sm" onClick={handleExportJSON}>
            Export JSON
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportText}>
            Export Text
          </Button>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Executive Summary</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <span className="text-sm text-slate-500">Status:</span>
              <Badge variant="info" className="ml-2">{report.executiveSummary.status}</Badge>
            </div>
            <div>
              <span className="text-sm text-slate-500">Completion:</span>
              <span className="ml-2 font-semibold">{report.executiveSummary.completionPercentage.toFixed(1)}%</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-50 p-3 rounded">
              <div className="text-sm text-slate-500">Total Tasks</div>
              <div className="text-xl font-bold">{report.executiveSummary.totalTasks}</div>
            </div>
            <div className="bg-green-50 p-3 rounded">
              <div className="text-sm text-green-600">Completed</div>
              <div className="text-xl font-bold text-green-700">{report.executiveSummary.completedTasks}</div>
            </div>
            <div className="bg-amber-50 p-3 rounded">
              <div className="text-sm text-amber-600">In Progress</div>
              <div className="text-xl font-bold text-amber-700">{report.executiveSummary.inProgressTasks}</div>
            </div>
          </div>
        </div>

        {report.teamPerformance && (
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Team Performance</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Total Members:</span>
                <span className="font-semibold">{report.teamPerformance.totalMembers}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Active Members:</span>
                <span className="font-semibold">{report.teamPerformance.activeMembers}</span>
              </div>
            </div>
          </div>
        )}

        {report.risksAndIssues.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Risks & Issues</h3>
            <div className="space-y-2">
              {report.risksAndIssues.map((risk, index) => (
                <div key={index} className="p-3 bg-slate-50 rounded">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={risk.severity === 'high' ? 'error' : risk.severity === 'medium' ? 'warning' : 'neutral'}>
                      {risk.severity}
                    </Badge>
                    <Badge variant="neutral">{risk.type}</Badge>
                  </div>
                  <p className="text-sm text-slate-700">{risk.description}</p>
                  {risk.mitigation && (
                    <p className="text-xs text-slate-500 mt-1">Mitigation: {risk.mitigation}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {report.recommendations.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Recommendations</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
              {report.recommendations.map((rec, index) => (
                <li key={index}>{rec}</li>
              ))}
            </ul>
          </div>
        )}

        {report.nextSteps.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Next Steps</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
              {report.nextSteps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
};

// Project Activity Plan Tab Component (inline edit, no modal)
interface ProjectActivityPlanTabProps {
  project: Project;
  onSave: (planData: Partial<Project>) => Promise<void>;
  onDelete: () => void | Promise<void>;
}

const ProjectActivityPlanTab: React.FC<ProjectActivityPlanTabProps> = ({
  project,
  onSave,
  onDelete,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formCategory, setFormCategory] = useState<string>(project.category || '');
  const [isSaving, setIsSaving] = useState(false);

  const hasPlanFields =
    project.proposedDate ||
    project.proposedBudget != null ||
    project.objectives ||
    project.eventStartDate ||
    project.eventEndDate;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const formData = new FormData(e.currentTarget);
      await onSave({
        title: formData.get('title') as string,
        description: (formData.get('description') as string) || '',
        level: (formData.get('level') as any) || undefined,
        pillar: (formData.get('pillar') as any) || undefined,
        category: (formData.get('category') as any) || undefined,
        type: (formData.get('projectType') as string) || undefined,
        proposedDate: formData.get('proposedDate') as string,
        proposedBudget: parseFloat(formData.get('proposedBudget') as string) || 0,
        objectives: formData.get('objectives') as string,
        expectedImpact: (formData.get('expectedImpact') as string) || '',
        targetAudience: (formData.get('targetAudience') as string) || undefined,
        eventStartDate: (formData.get('eventStartDate') as string) || undefined,
        eventEndDate: (formData.get('eventEndDate') as string) || undefined,
        eventStartTime: (formData.get('eventStartTime') as string) || undefined,
        eventEndTime: (formData.get('eventEndTime') as string) || undefined,
      });
      setIsEditing(false);
    } catch (err) {
      // Error handling is done by caller via toast
    } finally {
      setIsSaving(false);
    }
  };

  // Empty state (no data yet)
  if (!hasPlanFields && !isEditing) {
    return (
      <div className="text-center py-12">
        <FileText className="mx-auto text-slate-400 mb-4" size={48} />
        <p className="text-slate-500 mb-4">No activity plan data found on this project</p>
        <Button onClick={() => setIsEditing(true)}>
          <Plus size={16} className="mr-2" />
          Create Activity Plan
        </Button>
      </div>
    );
  }

  // Edit mode – inline form
  if (isEditing) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-900">Edit Activity Plan</h3>
          <Button
            variant="danger"
            onClick={async () => {
              await onDelete();
            }}
          >
            <Trash2 size={16} className="mr-2" />
            Delete Project
          </Button>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              name="title"
              label="Title *"
              placeholder="e.g. Summer Leadership Summit"
              defaultValue={project.title ?? project.name}
              icon={<FileText size={16} />}
              required
            />

            <Textarea
              name="description"
              label="Description"
              placeholder="Brief description of the activity plan..."
              defaultValue={project.description}
              rows={3}
            />

            <div className="grid grid-cols-2 gap-4">
              <Select
                name="level"
                label="Level"
                defaultValue={project.level}
                options={[
                  { label: '— Select —', value: '' },
                  ...PROJECT_LEVELS.map(l => ({ label: l, value: l })),
                ]}
              />
              <Select
                name="pillar"
                label="Pillar"
                defaultValue={project.pillar}
                options={[
                  { label: '— Select —', value: '' },
                  ...PROJECT_PILLARS.map(p => ({ label: p, value: p })),
                ]}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Select
                name="category"
                label="Category"
                defaultValue={project.category ?? formCategory}
                options={[
                  { label: '— Select —', value: '' },
                  ...PROJECT_CATEGORIES.map(c => ({ label: c.replace('_', ' '), value: c })),
                ]}
                onChange={(e) => setFormCategory(e.target.value)}
              />
              <Select
                name="projectType"
                label="Type"
                defaultValue={project.type}
                options={[
                  { label: '— Select —', value: '' },
                  ...((formCategory || project.category)
                    ? (PROJECT_TYPES_BY_CATEGORY[formCategory || project.category || ''] ?? []).map(t => ({
                      label: t,
                      value: t,
                    }))
                    : []),
                ]}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                name="proposedDate"
                label="Proposed Date *"
                type="date"
                defaultValue={project.proposedDate}
                icon={<Calendar size={16} />}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                name="eventStartDate"
                label="Event Start Date"
                type="date"
                defaultValue={project.eventStartDate}
                icon={<Calendar size={16} />}
              />
              <Input
                name="eventEndDate"
                label="Event End Date"
                type="date"
                defaultValue={project.eventEndDate}
                icon={<Calendar size={16} />}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                name="eventStartTime"
                label="Event Start Time"
                type="time"
                defaultValue={project.eventStartTime}
                icon={<Clock size={16} />}
              />
              <Input
                name="eventEndTime"
                label="Event End Time"
                type="time"
                defaultValue={project.eventEndTime}
                icon={<Clock size={16} />}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                name="proposedBudget"
                label="Proposed Budget (RM) *"
                type="number"
                step="0.01"
                placeholder="5000"
                defaultValue={project.proposedBudget?.toString()}
                icon={<DollarSign size={16} />}
                required
              />
              <Input
                name="targetAudience"
                label="Target Audience"
                placeholder="e.g. All Members, Youth, etc."
                defaultValue={project.targetAudience}
              />
            </div>

            <Textarea
              name="objectives"
              label="Objectives & Goals *"
              placeholder="Describe the goals and expected community impact..."
              defaultValue={project.objectives}
              rows={4}
              required
            />

            <Textarea
              name="expectedImpact"
              label="Expected Impact"
              placeholder="Describe the expected outcomes and impact..."
              defaultValue={project.expectedImpact}
              rows={3}
            />

            <div className="pt-4 flex gap-3">
              <Button className="flex-1" type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Activity Plan'}
              </Button>
              <Button
                variant="ghost"
                type="button"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  // View mode – read-only card
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-slate-900">Activity Plan Details</h3>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsEditing(true)}>
            <Edit size={16} className="mr-2" />
            Edit
          </Button>
          <Button
            variant="danger"
            onClick={onDelete}
          >
            <Trash2 size={16} className="mr-2" />
            Delete Project
          </Button>
        </div>
      </div>

      <Card>
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Title *</h4>
            <p className="text-slate-900">{project.title ?? project.name ?? '—'}</p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Description</h4>
            <p className="text-slate-600 whitespace-pre-wrap">{project.description || '—'}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-1">Level</h4>
              <p className="text-slate-600">{project.level || '—'}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-1">Pillar</h4>
              <p className="text-slate-600">{project.pillar || '—'}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-1">Category</h4>
              <p className="text-slate-600">
                {project.category ? project.category.replace('_', ' ') : '—'}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-1">Type</h4>
              <p className="text-slate-600">{project.type || '—'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-1">Proposed Date *</h4>
              <p className="text-slate-600">
                {project.proposedDate ? formatDate(toDate(project.proposedDate as any)) : '—'}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-1">Proposed Budget (RM) *</h4>
              <p className="text-slate-600 font-semibold">
                {project.proposedBudget != null ? formatCurrency(project.proposedBudget) : '—'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-1">Event Start Date</h4>
              <p className="text-slate-600">
                {project.eventStartDate ? formatDate(toDate(project.eventStartDate as any)) : '—'}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-1">Event End Date</h4>
              <p className="text-slate-600">
                {project.eventEndDate ? formatDate(toDate(project.eventEndDate as any)) : '—'}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-1">Event Start Time</h4>
              <p className="text-slate-600">{project.eventStartTime || '—'}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-1">Event End Time</h4>
              <p className="text-slate-600">{project.eventEndTime || '—'}</p>
            </div>
          </div>

          {project.targetAudience && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-1">Target Audience</h4>
              <p className="text-slate-600">{project.targetAudience}</p>
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Objectives & Goals *</h4>
            <p className="text-slate-600 whitespace-pre-wrap">{project.objectives || '—'}</p>
          </div>

          {project.expectedImpact && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Expected Impact</h4>
              <p className="text-slate-600 whitespace-pre-wrap">{project.expectedImpact}</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

// Project Event Committee Tab Component
interface ProjectCommitteeTabProps {
  project: Project;
  onSave: (updates: Partial<Project>) => Promise<void>;
}

const DEFAULT_ORGANISING_ROLE = 'Organising Chairperson';

const COMMITTEE_ROLES = [
  DEFAULT_ORGANISING_ROLE,
  'Project Secretary',
  'Project Treasurer',
  'Ticketing Director',
  'Program Director',
  'Marketing Director',
  'Venue Director',
  'Emcee',
];

const ProjectCommitteeTab: React.FC<ProjectCommitteeTabProps> = ({ project, onSave }) => {
  const { members } = useMembers();
  const { showToast } = useToast();
  const { createTask, getTaskById } = useProjects();
  const [rows, setRows] = useState<{ role: string; memberId: string; tasks: { taskId?: string; title: string; dueDate: string }[] }[]>(() => {
    // 直接使用 project.committee 中的数据，不再自动创建 baseline
    // DEFAULT_ORGANISING_ROLE 只在创建 project 时添加
    const existing = project.committee || [];

    if (existing.length === 0) {
      // 如果没有保存的 committee 数据，返回空数组（用户可以手动添加角色）
      return [];
    }

    // 将已保存的 committee 数据转换为 rows 格式
    return existing.map(c => {
      const mappedTasks = (c.tasks || []).map(t => ({
        taskId: t.taskId, // 保留现有的 taskId
        title: t.title || '',
        dueDate: t.dueDate || '',
      }));

      return {
        role: c.role || '',
        memberId: c.memberId || '',
        // 确保至少有一个 task 行（即使为空），以便 UI 可以显示和编辑
        tasks: mappedTasks.length > 0 ? mappedTasks : [{ title: '', dueDate: '' }],
      };
    });
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const resetRows = () => {
    const existing = project.committee || [];
    if (existing.length === 0) {
      setRows([]);
      return;
    }
    setRows(existing.map(c => {
      const mappedTasks = (c.tasks || []).map(t => ({
        taskId: t.taskId,
        title: t.title || '',
        dueDate: t.dueDate || '',
      }));
      return {
        role: c.role || '',
        memberId: c.memberId || '',
        tasks: mappedTasks.length > 0 ? mappedTasks : [{ title: '', dueDate: '' }],
      };
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const committee = rows
        .map(r => {
          const cleanedTasks = (r.tasks || [])
            .map(t => {
              const title = t.title.trim();
              if (!title && !t.dueDate) {
                return null; // 跳过完全空白的 task
              }

              const task: { taskId?: string; title: string; dueDate?: string } = { title };

              // 如果 task 有 title，确保它有 taskId（如果没有则生成）
              if (title) {
                task.taskId = t.taskId || uuidv4();
              }

              if (t.dueDate) {
                task.dueDate = t.dueDate;
              }

              return task;
            })
            .filter((t): t is { taskId?: string; title: string; dueDate?: string } => t !== null)
            .filter(t => t.title || t.dueDate); // 至少有一个非空字段

          return {
            role: r.role.trim(),
            memberId: r.memberId,
            ...(cleanedTasks.length > 0 ? { tasks: cleanedTasks } : {}),
          };
        })
        .filter(r => r.role.trim().length > 0); // 只要 role 存在就保存（即使其他字段为空）

      // Save committee data to project
      await onSave({ committee });

      // Sync tasks to Firestore
      const projectTitle = project.title || project.name || 'Project';
      const tasksToSync: Array<Promise<void>> = [];

      for (const committeeMember of committee) {
        if (committeeMember.memberId && committeeMember.tasks && committeeMember.tasks.length > 0) {
          const committeeMemberName = members.find(m => m.id === committeeMember.memberId)?.name || '';

          for (const committeeTask of committeeMember.tasks) {
            if (committeeTask.taskId && committeeTask.title && committeeTask.title.trim()) {
              const taskId = committeeTask.taskId;
              const taskTitle = committeeTask.title.trim();

              const syncPromise = (async () => {
                try {
                  const existingTask = await getTaskById(taskId);

                  const taskData: Omit<Task, 'id'> = {
                    projectId: project.id,
                    projectTitle,
                    role: committeeMember.role,
                    committeeMemberId: committeeMember.memberId,
                    committeeName: committeeMemberName,
                    title: taskTitle,
                    status: existingTask?.status || 'Todo',
                    priority: existingTask?.priority || 'Medium',
                    dueDate: committeeTask.dueDate || existingTask?.dueDate || new Date().toISOString().split('T')[0],
                    assignee: committeeMember.memberId,
                    remarks: existingTask?.remarks,
                    statusHistory: existingTask?.statusHistory,
                  };

                  await createTask(taskData, taskId);
                } catch (err) {
                  console.error('[Committee] Failed to sync task:', taskId, err);
                }
              })();

              tasksToSync.push(syncPromise);
            }
          }
        }
      }

      if (tasksToSync.length > 0) {
        await Promise.all(tasksToSync);
        showToast(`Event committee updated and ${tasksToSync.length} task(s) synced`, 'success');
      } else {
        showToast('Event committee updated', 'success');
      }
      setIsEditing(false);
    } catch (err) {
      showToast('Failed to update event committee', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-slate-900">Event Committee</h3>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsEditing(false);
                  resetRows();
                }}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Committee'}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditing(true)}
            >
              <Edit size={16} className="mr-2" /> Edit Committee
            </Button>
          )}
        </div>
      </div>

      <Card>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Assign committee members for this project. Role names are pre-filled but can be edited to match your LO&apos;s naming.
          </p>

          {/* Single header row for desktop */}
          <div className="hidden md:grid md:grid-cols-5 gap-2 text-xs font-semibold text-slate-500 px-1">
            <span>Role</span>
            <span>Committee Member</span>
            <span className="md:col-span-2">Task</span>
            <span className="text-right pr-6">Due Date</span>
          </div>

          <div className="space-y-4">
            {rows.map((row, rowIndex) => {
              const isOrganisingChair = row.role === DEFAULT_ORGANISING_ROLE;
              const isEven = rowIndex % 2 === 0;
              return (
                <div
                  key={rowIndex}
                  className={`
                  space-y-2 rounded-lg px-2 py-2
                  ${rowIndex > 0 ? 'border-t border-slate-200' : ''}
                  ${isEven ? 'bg-slate-100' : 'bg-slate-300'}
                `}
                >
                  {row.tasks.map((task, tIndex) => (
                    <div
                      key={tIndex}
                      className="grid gap-2 md:grid-cols-5 items-end"
                    >
                      {/* Role - 1/5 */}
                      <div className="md:col-span-1">
                        {tIndex === 0 ? (
                          <Input
                            value={row.role}
                            disabled={isOrganisingChair || !isEditing}
                            onChange={(e) => {
                              if (isOrganisingChair || !isEditing) return;
                              const value = e.target.value;
                              setRows(prev => {
                                const next = [...prev];
                                next[rowIndex] = { ...next[rowIndex], role: value };
                                return next;
                              });
                            }}
                          />
                        ) : (
                          <div className="hidden md:block" />
                        )}
                      </div>

                      {/* Committee - 1/5 */}
                      <div className="md:col-span-1">
                        {tIndex === 0 ? (
                          <Select
                            value={row.memberId || ''}
                            disabled={!isEditing}
                            onChange={(e) => {
                              if (!isEditing) return;
                              const value = e.target.value;
                              setRows(prev => {
                                const next = [...prev];
                                next[rowIndex] = { ...next[rowIndex], memberId: value };
                                return next;
                              });
                            }}
                            options={[
                              { label: '— Not Assigned —', value: '' },
                              ...members.map((m) => ({ label: m.name, value: m.id })),
                            ]}
                          />
                        ) : (
                          <div className="hidden md:block" />
                        )}
                      </div>

                      {/* Task - 3/5 */}
                      <div className="md:col-span-2">
                        <Input
                          placeholder="e.g. Book venue"
                          value={task.title}
                          disabled={!isEditing}
                          onChange={(e) => {
                            if (!isEditing) return;
                            const value = e.target.value;
                            setRows(prev => {
                              const next = [...prev];
                              const tasks = [...next[rowIndex].tasks];
                              tasks[tIndex] = { ...tasks[tIndex], title: value, taskId: tasks[tIndex].taskId }; // 保留 taskId
                              next[rowIndex] = { ...next[rowIndex], tasks };
                              return next;
                            });
                          }}
                        />
                      </div>

                      {/* Due Date - 1/5 */}
                      <div className="md:col-span-1 flex gap-2 items-end">
                        <Input
                          type="date"
                          value={task.dueDate}
                          disabled={!isEditing}
                          onChange={(e) => {
                            if (!isEditing) return;
                            const value = e.target.value;
                            setRows(prev => {
                              const next = [...prev];
                              const tasks = [...next[rowIndex].tasks];
                              tasks[tIndex] = { ...tasks[tIndex], dueDate: value, taskId: tasks[tIndex].taskId }; // 保留 taskId
                              next[rowIndex] = { ...next[rowIndex], tasks };
                              return next;
                            });
                          }}
                        />
                        {isEditing && row.tasks.length > 1 && (
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              setRows(prev => {
                                const next = [...prev];
                                const tasks = next[rowIndex].tasks.filter((_, i) => i !== tIndex);
                                next[rowIndex] = { ...next[rowIndex], tasks };
                                return next;
                              });
                            }}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}

                  {isEditing && (
                    <div className="flex justify-between gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setRows(prev => {
                            const next = [...prev];
                            const tasks = [...next[rowIndex].tasks, { title: '', dueDate: '' }]; // 新 task 没有 taskId，保存时会自动生成
                            next[rowIndex] = { ...next[rowIndex], tasks };
                            return next;
                          });
                        }}
                      >
                        + Add Task
                      </Button>
                      {!isOrganisingChair && (
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            setRows(prev => prev.filter((_, i) => i !== rowIndex));
                          }}
                        >
                          Delete Role
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            {isEditing && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setRows(prev => [
                    ...prev,
                    { role: '', memberId: '', tasks: [{ title: '', dueDate: '' }] },
                  ]);
                }}
              >
                + Add Role
              </Button>
            )}
          </div>
        </div>
      </Card>
    </form>
  );
};

// Template Preview Modal (Event Templates)
interface TemplatePreviewModalProps {
  template: EventTemplate;
  onClose: () => void;
  onUse: () => void;
}

const TemplatePreviewModal: React.FC<TemplatePreviewModalProps> = ({ template, onClose, onUse }) => (
  <Modal
    isOpen={true}
    onClose={onClose}
    title={`Template Preview: ${template.name}`}
    size="lg"
    footer={
      <div className="flex gap-3 w-full">
        <Button onClick={onUse} className="flex-1"><Copy size={16} className="mr-2" />Use This Template</Button>
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>
    }
  >
    <div className="space-y-6">
      <div>
        <Badge variant="neutral" className="mb-2">{template.type}</Badge>
        {template.description && <p className="text-slate-600">{template.description}</p>}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {template.defaultLocation && (
          <div className="flex items-start gap-2">
            <MapPin className="text-slate-400 mt-1" size={18} />
            <div><div className="text-xs text-slate-500">Default Location</div><div className="font-medium">{template.defaultLocation}</div></div>
          </div>
        )}
        {template.estimatedDuration && (
          <div className="flex items-start gap-2">
            <Clock className="text-slate-400 mt-1" size={18} />
            <div><div className="text-xs text-slate-500">Estimated Duration</div><div className="font-medium">{template.estimatedDuration} hours</div></div>
          </div>
        )}
        {template.defaultMaxAttendees && (
          <div className="flex items-start gap-2">
            <Users className="text-slate-400 mt-1" size={18} />
            <div><div className="text-xs text-slate-500">Max Attendees</div><div className="font-medium">{template.defaultMaxAttendees}</div></div>
          </div>
        )}
        {template.defaultBudget && (
          <div className="flex items-start gap-2">
            <DollarSign className="text-slate-400 mt-1" size={18} />
            <div><div className="text-xs text-slate-500">Default Budget</div><div className="font-medium">{formatCurrency(template.defaultBudget)}</div></div>
          </div>
        )}
      </div>
      {template.checklist && template.checklist.length > 0 && (
        <div>
          <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2"><CheckCircle size={18} className="text-green-500" />Checklist ({template.checklist.length} items)</h4>
          <ul className="space-y-2">{template.checklist.map((item, i) => <li key={i} className="flex items-start gap-2 text-sm"><CheckCircle size={16} className="text-slate-300 mt-0.5" /><span className="text-slate-700">{item}</span></li>)}</ul>
        </div>
      )}
      {template.requiredResources && template.requiredResources.length > 0 && (
        <div>
          <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2"><FileText size={18} className="text-blue-500" />Required Resources ({template.requiredResources.length} items)</h4>
          <div className="flex flex-wrap gap-2">{template.requiredResources.map((r, i) => <Badge key={i} variant="neutral">{r}</Badge>)}</div>
        </div>
      )}
    </div>
  </Modal>
);