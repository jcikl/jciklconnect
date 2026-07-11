import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Settings, Zap, Layout, Kanban, Plus, UserCircle, FileText, Calendar, DollarSign, CheckCircle, XCircle, Clock, Edit, Trash2, Eye, GitBranch, BarChart3, RefreshCw, Download, Search, Copy, MapPin, Users, ChevronDown, ChevronUp, Send, Check, X, Globe, Lock, Layers, Image, MoreVertical, Info, Tag, ExternalLink } from 'lucide-react';
import { Button, Card, Badge, ProgressBar, Modal, useToast, Tabs, Drawer } from '../ui/Common';
import { Input, Select, Textarea, Checkbox } from '../ui/Form';
import { Combobox } from '../ui/Combobox';
import { MultiSelectDropdown } from '../ui/MultiSelectDropdown';
import { LoadingState } from '../ui/Loading';
import { MemberSelector } from '../ui/MemberSelector';
import { useProjects } from '../../hooks/useProjects';
import { useTemplates } from '../../hooks/useTemplates';
import { useAuth } from '../../hooks/useAuth';
import { useMembers } from '../../hooks/useMembers';
import { usePermissions } from '../../hooks/usePermissions';
import { formatCurrency } from '../../utils/formatUtils';
import { formatDate, toDate } from '../../utils/dateUtils';
import { Project, Task, ProjectCommitteeMember, BankAccount, ProjectLevel, ProjectPillar, ProjectType } from '../../types';
import { PROJECT_LEVELS, PROJECT_PILLARS, PROJECT_TYPES, PROJECT_CATEGORIES_BY_TYPE, PROJECT_TYPE_LABELS } from '../../config/constants';
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
import { ReconciliationService } from '../../services/reconciliationService';
import { Transaction } from '../../types';
import type { ProjectFinancialAccount as ProjectFinancialAccountType, ProjectTransaction } from '../../types';
import { useBatchMode } from '../../contexts/BatchModeContext';
import { projectFinancialService } from '../../services/projectFinancialService';
import { SubmitPaymentRequestModal } from './PaymentRequests/SubmitPaymentRequestModal';
import { PENDING_USE_TEMPLATE_KEY, fetchRoadmapEventDetails } from '../../utils/roadmapUtils';
import { ProjectKanban } from './Projects/ProjectKanban';
import { ProjectFinancialAccount } from './Projects/ProjectFinancialAccount';
import { ProjectActivityPlanTab } from './Projects/ProjectActivityPlanTab';
import { ProjectCommitteeTab } from './Projects/ProjectCommitteeTab';

// fetchRoadmapEventDetails, RoadmapEventDetails, PENDING_USE_TEMPLATE_KEY extracted to utils/roadmapUtils.ts
// ProjectKanban, ProjectFinancialAccount, ProjectActivityPlanTab, ProjectCommitteeTab extracted to Projects/

export const ProjectsView: React.FC<{ onNavigate?: (view: string) => void; searchQuery?: string; initialSelectedProjectId?: string | null; onClearSelection?: () => void }> = ({ onNavigate, searchQuery, initialSelectedProjectId, onClearSelection }) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialSelectedProjectId ?? null);
  const [isProposalModalOpen, setProposalModalOpen] = useState(false);
  const [createProjectStep, setCreateProjectStep] = useState<1 | 2>(1);
  const [newRoadmapUrl, setNewRoadmapUrl] = useState('');
  const [newLogoUrl, setNewLogoUrl] = useState('');
  const [isFetchingPoster, setIsFetchingPoster] = useState(false);
  const [activeTab, setActiveTab] = useState<'projects' | 'past-projects' | 'templates'>('projects');
  const [isTemplateModalOpen, setTemplateModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EventTemplate | null>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<EventTemplate | null>(null);
  const [templateSearchTerm, setTemplateSearchTerm] = useState('');
  const [templateFilterType, setTemplateFilterType] = useState<string>('all');

  // States for Create Project Form
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newLevel, setNewLevel] = useState<ProjectLevel | ''>('');
  const [newPillar, setNewPillar] = useState<ProjectPillar | ''>('');
  const [projectType, setProjectType] = useState<string>('');
  const [newCategory, setNewCategory] = useState('');
  const [newProposedDate, setNewProposedDate] = useState('');
  const [newEventStartDate, setNewEventStartDate] = useState('');
  const [newEventEndDate, setNewEventEndDate] = useState('');
  const [newEventStartTime, setNewEventStartTime] = useState('');
  const [newEventEndTime, setNewEventEndTime] = useState('');
  const [newPriceMin, setNewPriceMin] = useState('');
  const [newPriceMax, setNewPriceMax] = useState('');
  const [newGalleryUrl, setNewGalleryUrl] = useState('');

  const { projects, loading, error, createProject, updateProject, deleteProject } = useProjects();
  const { eventTemplates, loading: templatesLoading, createEventTemplate, updateEventTemplate, deleteEventTemplate } = useTemplates();
  const { member } = useAuth();
  const { isBoard, isAdmin, isDeveloper } = usePermissions();
  const isPrivileged = isBoard || isAdmin || isDeveloper;
  const { showToast } = useToast();

  useEffect(() => {
    if (isProposalModalOpen) {
      setNewRoadmapUrl('');
      setNewLogoUrl('');
      setNewTitle('');
      setNewDescription('');
      setNewLevel('');
      setNewPillar('');
      setProjectType('');
      setNewCategory('');
      setNewProposedDate('');
      setNewEventStartDate('');
      setNewEventEndDate('');
      setNewEventStartTime('');
      setNewEventEndTime('');
      setNewPriceMin('');
      setNewPriceMax('');
      setNewGalleryUrl('');
    }
  }, [isProposalModalOpen]);

  const handleFetchPosterForCreate = async () => {
    if (!newRoadmapUrl) {
      showToast('Please enter a Roadmap Event URL or ID', 'warning');
      return;
    }
    setIsFetchingPoster(true);
    try {
      const details = await fetchRoadmapEventDetails(newRoadmapUrl);
      setNewLogoUrl(details.logoUrl);
      if (details.title) setNewTitle(details.title);
      if (details.description) setNewDescription(details.description);
      if (details.level) setNewLevel(details.level);
      if (details.pillar) setNewPillar(details.pillar);
      if (details.type) setProjectType(details.type);
      if (details.category) setNewCategory(details.category);
      if (details.eventStartDate) {
        setNewEventStartDate(details.eventStartDate);
        setNewProposedDate(details.eventStartDate);
      }
      if (details.eventEndDate) setNewEventEndDate(details.eventEndDate);
      if (details.eventStartTime) setNewEventStartTime(details.eventStartTime);
      if (details.eventEndTime) setNewEventEndTime(details.eventEndTime);
      if (details.priceMin != null) setNewPriceMin(String(details.priceMin));
      if (details.priceMax != null) setNewPriceMax(String(details.priceMax));

      showToast('Successfully synchronized event details!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to sync event details', 'error');
    } finally {
      setIsFetchingPoster(false);
    }
  };
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

  const handleCreateProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!member) {
      showToast('Please login to create projects', 'error');
      return;
    }

    const formData = new FormData(e.currentTarget);
    try {
      // Create new project with Activity Plan fields
      // Initialize default committee with Ex-Officio and Organising Chairperson roles
      const defaultCommittee: ProjectCommitteeMember[] = [
        {
          role: 'Ex-Officio',
          memberId: '',
          tasks: [{ title: '', dueDate: '' }],
        },
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
        type: (formData.get('type') as any) || undefined,
        category: (formData.get('category') as string) || undefined,
        proposedDate: formData.get('proposedDate') as string,
        objectives: formData.get('objectives') as string,
        expectedImpact: formData.get('expectedImpact') as string || '',
        eventStartDate: (formData.get('eventStartDate') as string) || undefined,
        eventEndDate: (formData.get('eventEndDate') as string) || undefined,
        eventStartTime: (formData.get('eventStartTime') as string) || undefined,
        eventEndTime: (formData.get('eventEndTime') as string) || undefined,
        status: 'Planning',
        submittedBy: member.id,
        committee: defaultCommittee,
        logoUrl: newLogoUrl || undefined,
        roadmapUrl: newRoadmapUrl || undefined,
        galleryUrls: newGalleryUrl ? [newGalleryUrl] : undefined,
        priceMin: newPriceMin !== '' ? Number(newPriceMin) : undefined,
        priceMax: newPriceMax !== '' ? Number(newPriceMax) : undefined,
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
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          {selectedProject ? (
            <div className="min-w-0">
              <button onClick={() => setSelectedProjectId(null)} className="text-xs text-slate-400 hover:text-jci-blue font-semibold transition-colors">← Events Management</button>
              <h2 className="text-lg md:text-2xl font-bold text-slate-900 truncate leading-tight mt-0.5">{selectedProject.name ?? selectedProject.title ?? 'Project'}</h2>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-slate-900">Events Management</h2>
              <p className="text-slate-500">Create proposals, track approval, and manage activities.</p>
            </>
          )}
        </div>
        <div className="flex gap-2 shrink-0 self-end sm:self-auto">
          {!selectedProject && (
            <>
              <div className="hidden md:flex gap-2"></div>
            </>
          )}
          {selectedProject && (
            <>
              {/* Desktop: show all workflow buttons */}
              <div className="hidden md:flex gap-2">
                {(selectedProject.status === 'Planning' || selectedProject.status === 'Draft') && (
                  <>
                    <Button variant="ghost" onClick={() => handleStatusUpdate('Planning')} disabled={isStatusUpdating}>Save Draft</Button>
                    <Button onClick={() => handleStatusUpdate('Under Review')} disabled={isStatusUpdating}><Send size={16} className="mr-2" />Submit</Button>
                  </>
                )}
                {selectedProject.status === 'Under Review' && !isPrivileged && (
                  <Button disabled variant="outline"><Clock size={16} className="mr-2" />Under Review</Button>
                )}
                {selectedProject.status === 'Under Review' && isPrivileged && (
                  <>
                    <div className="flex items-center px-3 bg-slate-100 rounded-lg text-slate-600 text-sm font-medium"><Clock size={14} className="mr-1" />Under Review</div>
                    <Button variant="danger" onClick={() => handleStatusUpdate('Planning')} disabled={isStatusUpdating}><X size={16} className="mr-2" />Reject</Button>
                    <Button variant="primary" onClick={() => handleStatusUpdate('Approved')} disabled={isStatusUpdating}><Check size={16} className="mr-2" />Approve</Button>
                  </>
                )}
                {selectedProject.status === 'Approved' && (
                  <Button onClick={() => handleStatusUpdate('Active')} disabled={isStatusUpdating}><Globe size={16} className="mr-2" />Publish</Button>
                )}
                {selectedProject.status === 'Active' && (
                  <>
                    <Badge variant="success" className="h-10 px-4"><Globe size={14} className="mr-1" />Published</Badge>
                    <Button variant="danger" onClick={() => handleStatusUpdate('Approved')} disabled={isStatusUpdating}><Lock size={16} className="mr-2" />Unpublish</Button>
                  </>
                )}
                {(selectedProject.status === 'Approved' || selectedProject.status === 'Active') && (
                  <Button variant="outline" onClick={handleClaimReimbursement} className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100">
                    <DollarSign size={16} className="mr-2" />Claim Reimbursement
                  </Button>
                )}
              </div>

              {/* Mobile: primary CTA + kebab overflow */}
              <div className="flex md:hidden items-center gap-2">
                {/* Primary action only */}
                {(selectedProject.status === 'Planning' || selectedProject.status === 'Draft') && (
                  <Button size="sm" onClick={() => handleStatusUpdate('Under Review')} disabled={isStatusUpdating}><Send size={14} className="mr-1" />Submit</Button>
                )}
                {selectedProject.status === 'Under Review' && !isPrivileged && (
                  <Badge variant="neutral" className="h-8 px-3 text-xs"><Clock size={12} className="mr-1" />Reviewing</Badge>
                )}
                {selectedProject.status === 'Under Review' && isPrivileged && (
                  <Button size="sm" variant="primary" onClick={() => handleStatusUpdate('Approved')} disabled={isStatusUpdating}><Check size={14} className="mr-1" />Approve</Button>
                )}
                {selectedProject.status === 'Approved' && (
                  <Button size="sm" onClick={() => handleStatusUpdate('Active')} disabled={isStatusUpdating}><Globe size={14} className="mr-1" />Publish</Button>
                )}
                {selectedProject.status === 'Active' && (
                  <Badge variant="success" className="h-8 px-3 text-xs"><Globe size={12} className="mr-1" />Published</Badge>
                )}
                {/* Kebab for secondary actions */}
                <div className="relative group">
                  <button className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:border-slate-300 hover:bg-slate-50 transition-all">
                    <MoreVertical size={16} />
                  </button>
                  <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50 hidden group-focus-within:block">
                    {(selectedProject.status === 'Planning' || selectedProject.status === 'Draft') && (
                      <button onClick={() => handleStatusUpdate('Planning')} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                        <FileText size={14} />Save Draft
                      </button>
                    )}
                    {selectedProject.status === 'Under Review' && isPrivileged && (
                      <button onClick={() => handleStatusUpdate('Planning')} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                        <X size={14} />Reject
                      </button>
                    )}
                    {selectedProject.status === 'Active' && (
                      <button onClick={() => handleStatusUpdate('Approved')} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                        <Lock size={14} />Unpublish
                      </button>
                    )}
                    {(selectedProject.status === 'Approved' || selectedProject.status === 'Active') && (
                      <button onClick={handleClaimReimbursement} className="w-full text-left px-4 py-2.5 text-sm text-green-700 hover:bg-green-50 flex items-center gap-2">
                        <DollarSign size={14} />Claim Reimbursement
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {!selectedProject ? (
        <div className="space-y-2">
          {/* Mobile: segmented control + year filter standalone */}
          <div className="md:hidden p-1.5 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-2">
            <Tabs
              variant="button"
              fullWidth
              tabs={['Ongoing', 'Past', 'Templates']}
              activeTab={activeTab === 'projects' ? 'Ongoing' : activeTab === 'past-projects' ? 'Past' : 'Templates'}
              onTabChange={(tab) => {
                if (tab === 'Ongoing') setActiveTab('projects');
                else if (tab === 'Past') setActiveTab('past-projects');
                else setActiveTab('templates');
                setSelectedProjectId(null);
              }}
            />
            {activeTab !== 'templates' && (
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="shrink-0 text-xs font-bold border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-jci-blue focus:border-jci-blue bg-white outline-none transition-all cursor-pointer"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            )}
          </div>

          {/* Mobile: content without card wrapper */}
          <div className="md:hidden">
            {(activeTab === 'projects' || activeTab === 'past-projects') ? (
              <ProjectGrid
                projects={displayedProjects}
                loading={loading}
                error={error}
                onSelect={setSelectedProjectId}
                onNewProposal={() => { setCreateProjectStep(1); setProposalModalOpen(true); }}
                onImport={() => setImportModalOpen(true)}
                isAdminOrBoard={isBoard || isAdmin}
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
                projectAccounts={projectAccounts}
                projectTrackerTransactions={projectTrackerTransactions}
              />
            ) : (
              <div className="space-y-2">
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
                <LoadingState loading={templatesLoading} error={null} empty={false}>
                  <div className="divide-y divide-slate-100">
                    {(isBoard || isAdmin) && (
                      <div onClick={() => { setSelectedTemplate(null); setTemplateModalOpen(true); }}
                        className="flex items-center gap-3 px-1 py-3 text-slate-400 hover:text-jci-blue transition-colors cursor-pointer group">
                        <div className="w-9 h-9 rounded-lg border-2 border-dashed border-current flex items-center justify-center shrink-0">
                          <Plus size={16} />
                        </div>
                        <span className="text-sm font-semibold">New Template</span>
                      </div>
                    )}
                    {eventTemplates
                      .filter(template => {
                        const matchesSearch = !templateSearchTerm ||
                          template.name.toLowerCase().includes(templateSearchTerm.toLowerCase()) ||
                          (template.description?.toLowerCase().includes(templateSearchTerm.toLowerCase()) ?? false);
                        const matchesType = templateFilterType === 'all' || template.type === templateFilterType;
                        return matchesSearch && matchesType;
                      })
                      .map(template => (
                        <div key={template.id} className="flex items-center gap-3 py-3 px-1">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-slate-900 text-sm">{template.name}</p>
                              <Badge variant="neutral">{template.type}</Badge>
                            </div>
                            {template.description && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{template.description}</p>}
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {template.estimatedDuration && <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500"><Clock size={9} />{template.estimatedDuration}h</span>}
                              {template.defaultBudget && <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500"><DollarSign size={9} />{formatCurrency(template.defaultBudget)}</span>}
                              {template.checklist?.length > 0 && <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500"><CheckCircle size={9} />{template.checklist.length} tasks</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <Button variant="ghost" size="sm" onClick={() => setPreviewTemplate(template)} title="Preview"><Eye size={14} /></Button>
                            <Button variant="ghost" size="sm" onClick={() => handleUseTemplate(template)} title="Use"><Copy size={14} /></Button>
                            <Button variant="ghost" size="sm" onClick={() => { setSelectedTemplate(template); setTemplateModalOpen(true); }} title="Edit"><Edit size={14} /></Button>
                            <Button variant="ghost" size="sm" onClick={async () => { if (window.confirm('Delete this template?')) { await deleteEventTemplate(template.id!); } }} className="text-red-500 hover:text-red-700" title="Delete"><Trash2 size={14} /></Button>
                          </div>
                        </div>
                      ))}
                  </div>
                </LoadingState>
              </div>
            )}
          </div>

          {/* Desktop: card with underline tabs + content */}
          <Card noPadding className="hidden md:block">
            <div className="px-6 pt-4 flex flex-row justify-between items-end gap-3 border-b border-slate-100">
              <div className="flex-1 min-w-0">
                <Tabs
                  tabs={['Ongoing Events', 'Past Events', 'Templates']}
                  activeTab={activeTab === 'projects' ? 'Ongoing Events' : activeTab === 'past-projects' ? 'Past Events' : 'Templates'}
                  onTabChange={(tab) => {
                    if (tab === 'Ongoing Events') setActiveTab('projects');
                    else if (tab === 'Past Events') setActiveTab('past-projects');
                    else setActiveTab('templates');
                    setSelectedProjectId(null);
                  }}
                  className="border-b-0"
                />
              </div>
              {activeTab !== 'templates' && (
                <div className="flex items-center gap-2 pb-2">
                  <span className="text-xs font-semibold text-slate-500">Year:</span>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="text-xs font-bold border border-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-jci-blue focus:border-jci-blue bg-white shadow-sm outline-none transition-all cursor-pointer"
                  >
                    {availableYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="p-6">
              {(activeTab === 'projects' || activeTab === 'past-projects') ? (
                <ProjectGrid
                  projects={displayedProjects}
                  loading={loading}
                  error={error}
                  onSelect={setSelectedProjectId}
                  onNewProposal={() => { setCreateProjectStep(1); setProposalModalOpen(true); }}
                  onImport={() => setImportModalOpen(true)}
                  isAdminOrBoard={isBoard || isAdmin}
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
                  projectAccounts={projectAccounts}
                  projectTrackerTransactions={projectTrackerTransactions}
                />
              ) : (
                <div className="space-y-2">
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
                  <LoadingState loading={templatesLoading} error={null} empty={false}>
                    <div className="divide-y divide-slate-100">
                      {(isBoard || isAdmin) && (
                        <div onClick={() => { setSelectedTemplate(null); setTemplateModalOpen(true); }}
                          className="flex items-center gap-3 px-2 py-3 text-slate-400 hover:text-jci-blue transition-colors cursor-pointer group">
                          <div className="w-9 h-9 rounded-lg border-2 border-dashed border-current flex items-center justify-center shrink-0">
                            <Plus size={16} />
                          </div>
                          <span className="text-sm font-semibold">New Template</span>
                        </div>
                      )}
                      {eventTemplates
                        .filter(template => {
                          const matchesSearch = !templateSearchTerm ||
                            template.name.toLowerCase().includes(templateSearchTerm.toLowerCase()) ||
                            (template.description?.toLowerCase().includes(templateSearchTerm.toLowerCase()) ?? false);
                          const matchesType = templateFilterType === 'all' || template.type === templateFilterType;
                          return matchesSearch && matchesType;
                        })
                        .map(template => (
                          <div key={template.id} className="flex items-center gap-4 px-2 py-3 hover:bg-slate-50/50 transition-colors group">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-slate-900 group-hover:text-jci-blue transition-colors text-sm">{template.name}</p>
                                <Badge variant="neutral">{template.type}</Badge>
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                {template.description && <span className="text-xs text-slate-400 line-clamp-1 max-w-xs">{template.description}</span>}
                                {template.estimatedDuration && <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-400"><Clock size={10} />{template.estimatedDuration}h</span>}
                                {template.defaultBudget && <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-400"><DollarSign size={10} />{formatCurrency(template.defaultBudget)}</span>}
                                {template.checklist?.length > 0 && <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-400"><CheckCircle size={10} />{template.checklist.length} tasks</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="sm" onClick={() => setPreviewTemplate(template)} title="Preview"><Eye size={14} /></Button>
                              <Button variant="ghost" size="sm" onClick={() => handleUseTemplate(template)} title="Use"><Copy size={14} /></Button>
                              <Button variant="ghost" size="sm" onClick={() => { setSelectedTemplate(template); setTemplateModalOpen(true); }} title="Edit"><Edit size={14} /></Button>
                              <Button variant="ghost" size="sm" onClick={async () => { if (window.confirm('Delete this template?')) { await deleteEventTemplate(template.id!); } }} className="text-red-500 hover:text-red-700" title="Delete"><Trash2 size={14} /></Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </LoadingState>
                </div>
              )}
            </div>
          </Card>
        </div>
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


      {/* Project Creation Drawer */}
      {(() => {
        const CREATE_STEPS: { s: 1 | 2; label: string }[] = [
          { s: 1, label: 'Basics & Media' },
          { s: 2, label: 'Classification & Schedule' },
        ];
        return (
          <Drawer
            isOpen={isProposalModalOpen}
            onClose={() => { setProposalModalOpen(false); setCreateProjectStep(1); }}
            title={createProjectStep === 1 ? 'New Activity " Basics & Media' : 'New Activity " Classification & Schedule'}
            position="bottom"
            size="xl"
            footer={
              <div className="flex items-center justify-between">
                <Button variant="ghost" type="button" onClick={() => {
                  if (createProjectStep === 1) { setProposalModalOpen(false); setCreateProjectStep(1); }
                  else setCreateProjectStep(1);
                }}>
                  {createProjectStep === 1 ? 'Cancel' : '← Back'}
                </Button>
                {createProjectStep === 1 ? (
                  <Button key="next" type="button" onClick={() => {
                    if (!newTitle.trim()) { showToast('Project title is required', 'error'); return; }
                    setCreateProjectStep(2);
                  }}>Next →</Button>
                ) : (
                  <Button key="create" type="submit" form="create-project-form">Create Project</Button>
                )}
              </div>
            }
          >
            {/* Stepper */}
            <div className="flex items-center gap-2 mb-4">
              {CREATE_STEPS.map(({ s, label }, i) => (
                <React.Fragment key={s}>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${s < createProjectStep ? 'bg-jci-blue/10 text-jci-blue' :
                    s === createProjectStep ? 'bg-jci-blue text-white shadow-sm' :
                      'bg-slate-100 text-slate-400'
                    }`}>
                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 bg-white/30">
                      {s < createProjectStep ? 'âœ"' : s}
                    </span>
                    <span className="hidden sm:inline">{label}</span>
                    <span className="sm:hidden">{s === 1 ? 'Media' : 'Details'}</span>
                  </div>
                  {i === 0 && <div className={`flex-1 h-px max-w-[24px] ${createProjectStep > 1 ? 'bg-jci-blue' : 'bg-slate-200'}`} />}
                </React.Fragment>
              ))}
            </div>

            <form id="create-project-form" onSubmit={handleCreateProject} className="space-y-4">
              {/* Step 1: Basics & Media */}
              {createProjectStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-l-4 border-jci-blue/40 pl-2 mb-3">Project Info</p>
                    <div className="space-y-3">
                      <Input name="title" label="Title *" placeholder="e.g. Summer Leadership Summit"
                        value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                        icon={<FileText size={16} />} required />
                      <Textarea name="description" label="Description" placeholder="Brief description of the project..."
                        value={newDescription} onChange={(e) => setNewDescription(e.target.value)} rows={3} />
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-l-4 border-jci-blue/40 pl-2 mb-3">Media</p>
                    <div className="md:grid md:grid-cols-2 md:gap-4 space-y-3 md:space-y-0">
                      <div className="space-y-2">
                        <div>
                          <p className="text-[11px] font-semibold text-slate-500 mb-1.5">JCI Roadmap Sync</p>
                          <div className="flex gap-2 items-end">
                            <div className="flex-1">
                              <Input name="roadmapUrl" label="" placeholder="Roadmap URL or Event ID (e.g. 6274)"
                                value={newRoadmapUrl} onChange={(e) => setNewRoadmapUrl(e.target.value)} icon={<Globe size={16} />} />
                            </div>
                            <Button type="button" variant="outline" onClick={handleFetchPosterForCreate} disabled={isFetchingPoster}
                              className="h-10 shrink-0 flex items-center gap-1.5 border-jci-blue text-jci-blue hover:bg-sky-50 mb-px">
                              {isFetchingPoster ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}
                              <span className="text-xs">{isFetchingPoster ? 'Syncing' : 'Sync'}</span>
                            </Button>
                          </div>
                        </div>
                        <Input name="logoUrl" label="Poster / Logo URL" placeholder="https://example.com/poster.png"
                          value={newLogoUrl} onChange={(e) => setNewLogoUrl(e.target.value)} icon={<Image size={16} />} />
                        {newLogoUrl && (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex justify-center p-2">
                            <img src={newLogoUrl} alt="Preview" className="max-h-36 object-contain rounded-lg" />
                          </div>
                        )}
                      </div>
                      <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[11px] font-semibold text-slate-500">Activity Photo Gallery</p>
                        <p className="text-[11px] text-slate-400 leading-relaxed">Paste a Google Drive <strong>folder</strong> link shared as "Anyone with the link"</p>
                        <Input label="" placeholder="https://drive.google.com/drive/folders/"
                          value={newGalleryUrl} onChange={(e) => setNewGalleryUrl(e.target.value)} />
                        {newGalleryUrl && (
                          <p className="text-[11px] text-green-700 font-medium flex items-center gap-1">
                            <Check size={11} />Folder linked
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Classification & Schedule */}
              {createProjectStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-l-4 border-jci-blue/40 pl-2 mb-2">Classification</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <Select name="level" label="Level *" required value={newLevel}
                        onChange={(e) => setNewLevel(e.target.value as any)}
                        options={[{ label: '" Select "', value: '' }, ...PROJECT_LEVELS.map(l => ({ label: l, value: l }))]} />
                      <Select name="pillar" label="Pillar *" required value={newPillar}
                        onChange={(e) => setNewPillar(e.target.value as any)}
                        options={[{ label: '" Select "', value: '' }, ...PROJECT_PILLARS.map(p => ({ label: p, value: p }))]} />
                      <Select name="type" label="Type *" required value={projectType}
                        onChange={(e) => { setProjectType(e.target.value); setNewCategory(''); }}
                        options={[{ label: '" Select "', value: '' }, ...PROJECT_TYPES.map(c => ({ label: PROJECT_TYPE_LABELS[c] || c, value: c }))]} />
                      <Select name="category" label="Category *" required value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        options={[{ label: '" Select "', value: '' }, ...(projectType ? (PROJECT_CATEGORIES_BY_TYPE[projectType] ?? []) : []).map(t => ({ label: t, value: t }))]} />
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-l-4 border-jci-blue/40 pl-2 mb-2">Schedule</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <Input name="proposedDate" label="Proposed *" type="date" value={newProposedDate}
                        onChange={(e) => setNewProposedDate(e.target.value)} icon={<Calendar size={16} />} required />
                      <Input name="eventStartDate" label="Start Date *" type="date" value={newEventStartDate}
                        onChange={(e) => setNewEventStartDate(e.target.value)} icon={<Calendar size={16} />} required />
                      <Input name="eventEndDate" label="End Date" type="date" value={newEventEndDate}
                        onChange={(e) => setNewEventEndDate(e.target.value)} icon={<Calendar size={16} />} />
                      <div />
                      <Input name="eventStartTime" label="Start Time" type="time" value={newEventStartTime}
                        onChange={(e) => setNewEventStartTime(e.target.value)} icon={<Clock size={16} />} />
                      <Input name="eventEndTime" label="End Time" type="time" value={newEventEndTime}
                        onChange={(e) => setNewEventEndTime(e.target.value)} icon={<Clock size={16} />} />
                      <Input name="priceMin" label="Min Price (RM)" type="number" min="0" placeholder="0"
                        value={newPriceMin} onChange={(e) => setNewPriceMin(e.target.value)} icon={<DollarSign size={16} />} />
                      <Input name="priceMax" label="Max Price (RM)" type="number" min="0" placeholder="e.g. 150"
                        value={newPriceMax} onChange={(e) => setNewPriceMax(e.target.value)} icon={<DollarSign size={16} />} />
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-l-4 border-jci-blue/40 pl-2 mb-2">Goals</p>
                    <div className="md:grid md:grid-cols-2 md:gap-3 space-y-2 md:space-y-0">
                      <Textarea name="objectives" label="Objectives & Goals" placeholder="Goals and expected community impact..." rows={2} />
                      <Textarea name="expectedImpact" label="Expected Impact" placeholder="Expected outcomes and impact..." rows={2} />
                    </div>
                  </div>
                </div>
              )}
            </form>
          </Drawer>
        );
      })()}


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
  isAdminOrBoard?: boolean;
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
  onSelectAll?: () => void;
  projectAccounts?: ProjectFinancialAccountType[];
  projectTrackerTransactions?: ProjectTransaction[];
}> = ({
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
                          âš  {formatCurrency(Math.abs(diff))} diff
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
                      âš  {formatCurrency(Math.abs(diff))}
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

  const FACTORS = [
    { key: 'teamExperience', label: 'Team Experience' },
    { key: 'budgetAdequacy', label: 'Budget Adequacy' },
    { key: 'timelineRealism', label: 'Timeline Realism' },
    { key: 'resourceAvailability', label: 'Resources' },
    { key: 'memberEngagement', label: 'Engagement' },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BrainCircuit className="text-jci-blue flex-shrink-0" size={18} />
        <h3 className="text-base font-semibold text-slate-900">AI Insights & Recommendations</h3>
      </div>

      {/* Toggle tabs */}
      <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-slate-50 p-0.5 gap-0.5">
        {(['success', 'sponsors'] as const).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === tab
              ? 'bg-white text-jci-blue shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            {tab === 'success' ? 'Prediction' : 'Sponsors'}
          </button>
        ))}
      </div>

      {/* Success Prediction */}
      {activeTab === 'success' && (
        <LoadingState loading={isLoadingPrediction} error={null} empty={!successPrediction} emptyMessage="No prediction available">
          {successPrediction && (
            <div className="space-y-4">
              {/* Probability hero card */}
              <div className="rounded-xl bg-gradient-to-br from-jci-blue/5 to-indigo-50 border border-jci-blue/20 p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Success Probability</p>
                    <div className="text-4xl font-black text-jci-blue tabular-nums leading-none">
                      {successPrediction.successProbability}%
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getRiskColor(successPrediction.riskLevel)}`}>
                    {successPrediction.riskLevel} Risk
                  </span>
                </div>
                <ProgressBar progress={successPrediction.successProbability} color="primary" />
              </div>

              {/* Success Factors " divide-y list with mini bars */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Success Factors</h4>
                <div className="rounded-xl border border-slate-100 overflow-hidden bg-white divide-y divide-slate-100">
                  {FACTORS.map(f => {
                    const val: number = successPrediction.factors[f.key] ?? 0;
                    return (
                      <div key={f.key} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="text-sm text-slate-600 w-36 flex-shrink-0">{f.label}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${val >= 70 ? 'bg-green-400' : val >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
                            style={{ width: `${val}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-slate-800 tabular-nums w-10 text-right">{val}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Identified Risks */}
              {successPrediction.risks && successPrediction.risks.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <AlertTriangle size={13} className="text-amber-500" /> Identified Risks
                  </h4>
                  <div className="space-y-2">
                    {successPrediction.risks.map((risk: any, idx: number) => (
                      <div key={idx} className="rounded-xl border border-slate-100 bg-white p-3">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Badge variant={risk.severity === 'High' ? 'error' : risk.severity === 'Medium' ? 'warning' : 'neutral'}>
                            {risk.severity}
                          </Badge>
                          <span className="text-sm font-medium text-slate-800">{risk.description}</span>
                        </div>
                        {risk.mitigation && (
                          <p className="text-xs text-slate-400 italic mt-1">Mitigation: {risk.mitigation}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {successPrediction.recommendations && successPrediction.recommendations.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <TrendingUp size={13} className="text-jci-blue" /> Recommendations
                  </h4>
                  <ul className="space-y-1.5">
                    {successPrediction.recommendations.map((rec: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                        <CheckCircle size={14} className="flex-shrink-0 mt-0.5 text-green-500" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </LoadingState>
      )}

      {/* Sponsor Matching */}
      {activeTab === 'sponsors' && (
        <LoadingState loading={isLoadingSponsors} error={null} empty={sponsorMatches.length === 0} emptyMessage="No sponsor matches found">
          <div className="rounded-xl border border-slate-100 overflow-hidden bg-white divide-y divide-slate-100">
            {sponsorMatches.map((match, idx) => (
              <div key={idx} className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <h4 className="font-semibold text-slate-900 truncate">{match.sponsorName}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden max-w-[120px]">
                        <div className="h-full rounded-full bg-jci-blue" style={{ width: `${match.matchScore}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-jci-blue tabular-nums">{match.matchScore}% match</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="flex-shrink-0">Contact</Button>
                </div>
                {match.reasons && match.reasons.length > 0 && (
                  <ul className="space-y-1 mt-2">
                    {match.reasons.map((reason: string, rIdx: number) => (
                      <li key={rIdx} className="flex items-start gap-2 text-xs text-slate-500">
                        <span className="text-jci-blue mt-0.5">¢</span>{reason}
                      </li>
                    ))}
                  </ul>
                )}
                {match.contactInfo && (
                  <div className="mt-2 text-xs text-slate-400 space-y-0.5">
                    {match.contactInfo.email && <div>{match.contactInfo.email}</div>}
                    {match.contactInfo.phone && <div>{match.contactInfo.phone}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </LoadingState>
      )}
    </div>
  );
};


// Project Detail Tabs Component
interface ProjectDetailTabsProps {
  project: Project;
  onUpdateProject: (projectId: string, updates: Partial<Project>) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  onNavigate?: (view: string) => void;
}

const ProjectDetailTabs: React.FC<ProjectDetailTabsProps> = ({ project, onUpdateProject, onDeleteProject, onNavigate }) => {
  const { projectId, projectName } = { projectId: project.id, projectName: project.name ?? project.title ?? 'Project' };
  const [activeTab, setActiveTab] = useState<'activity-plan' | 'committee' | 'trainers' | 'kanban' | 'gantt' | 'finance' | 'reports' | 'ai'>('activity-plan');
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
        {/* Mobile: select dropdown */}
        <div className="md:hidden px-4 pt-4 pb-2 border-b border-slate-100">
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as typeof activeTab)}
            className="w-full text-sm font-semibold border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:ring-2 focus:ring-jci-blue focus:border-jci-blue outline-none appearance-none cursor-pointer text-slate-800"
          >
            {TAB_ITEMS.map(t => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </div>
        {/* Desktop: horizontal underline tabs with short labels */}
        <div className="hidden md:block px-6 pt-4 border-b border-slate-100">
          <Tabs
            tabs={TAB_ITEMS.map(t => t.shortLabel)}
            activeTab={TAB_ITEMS.find(t => t.key === activeTab)?.shortLabel ?? 'Plan'}
            onTabChange={(tab) => {
              const found = TAB_ITEMS.find(t => t.shortLabel === tab);
              if (found) setActiveTab(found.key);
            }}
            className="border-b-0"
          />
        </div>
        <div className="p-4">
          {activeTab === 'committee' && (
            <ProjectCommitteeTab
              project={project}
              onSave={(updates) => onUpdateProject(projectId, updates)}
            />
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
  const REPORT_SECTIONS = [
    { icon: <BarChart3 size={16} />, label: 'Executive Summary', color: 'text-jci-blue bg-jci-blue/10' },
    { icon: <Users size={16} />, label: 'Team Performance', color: 'text-violet-600 bg-violet-100' },
    { icon: <GitBranch size={16} />, label: 'Risks & Issues', color: 'text-amber-600 bg-amber-100' },
    { icon: <CheckCircle size={16} />, label: 'Recommendations', color: 'text-green-600 bg-green-100' },
  ];

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Project Reports</h3>
          <p className="text-sm text-slate-500 mt-0.5">Comprehensive AI-generated report for <span className="font-medium text-slate-700">{projectName}</span></p>
        </div>
        <Button onClick={onGenerateReport} disabled={loading} size="sm">
          {loading
            ? <><RefreshCw size={14} className="mr-1.5 animate-spin" /> Generating</>
            : <><FileText size={14} className="mr-1.5" /> Generate Report</>}
        </Button>
      </div>

      {/* Feature chips */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {REPORT_SECTIONS.map(s => (
          <div key={s.label} className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
            <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${s.color}`}>
              {s.icon}
            </div>
            <span className="text-xs font-medium text-slate-700 leading-tight">{s.label}</span>
          </div>
        ))}
      </div>
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
      <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-1">
        {/* Export actions */}
        <div className="flex gap-2 pb-4 border-b border-slate-100">
          <Button variant="outline" size="sm" onClick={handleExportJSON}>
            <Download size={13} className="mr-1.5" /> JSON
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportText}>
            <Download size={13} className="mr-1.5" /> Text
          </Button>
        </div>

        {/* Executive Summary */}
        <div className="pl-4 border-l-4 border-jci-blue">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Executive Summary</h3>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Status</span>
              <Badge variant="info">{report.executiveSummary.status}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Completion</span>
              <span className="text-sm font-bold text-slate-800">{report.executiveSummary.completionPercentage.toFixed(1)}%</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-xl p-3 min-w-0">
              <div className="text-xs text-slate-500 mb-1">Total Tasks</div>
              <div className="text-xl font-bold text-slate-900 tabular-nums">{report.executiveSummary.totalTasks}</div>
            </div>
            <div className="bg-green-50 rounded-xl p-3 min-w-0">
              <div className="text-xs text-green-600 mb-1">Completed</div>
              <div className="text-xl font-bold text-green-700 tabular-nums">{report.executiveSummary.completedTasks}</div>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 min-w-0">
              <div className="text-xs text-amber-600 mb-1">In Progress</div>
              <div className="text-xl font-bold text-amber-700 tabular-nums">{report.executiveSummary.inProgressTasks}</div>
            </div>
          </div>
        </div>

        {/* Team Performance */}
        {report.teamPerformance && (
          <div className="pl-4 border-l-4 border-violet-400">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Team Performance</h3>
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
              <div className="flex justify-between items-center px-4 py-2.5 text-sm bg-white">
                <span className="text-slate-600">Total Members</span>
                <span className="font-semibold tabular-nums">{report.teamPerformance.totalMembers}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-2.5 text-sm bg-white">
                <span className="text-slate-600">Active Members</span>
                <span className="font-semibold tabular-nums">{report.teamPerformance.activeMembers}</span>
              </div>
            </div>
          </div>
        )}

        {/* Risks & Issues */}
        {report.risksAndIssues.length > 0 && (
          <div className="pl-4 border-l-4 border-amber-400">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Risks & Issues</h3>
            <div className="space-y-2">
              {report.risksAndIssues.map((risk, index) => (
                <div key={index} className="rounded-xl border border-slate-100 bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <Badge variant={risk.severity === 'high' ? 'error' : risk.severity === 'medium' ? 'warning' : 'neutral'}>
                      {risk.severity}
                    </Badge>
                    <Badge variant="neutral">{risk.type}</Badge>
                  </div>
                  <p className="text-sm text-slate-700">{risk.description}</p>
                  {risk.mitigation && (
                    <p className="text-xs text-slate-400 mt-1.5 italic">Mitigation: {risk.mitigation}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {report.recommendations.length > 0 && (
          <div className="pl-4 border-l-4 border-green-400">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Recommendations</h3>
            <ul className="space-y-1.5">
              {report.recommendations.map((rec, index) => (
                <li key={index} className="flex gap-2 text-sm text-slate-700">
                  <CheckCircle size={14} className="flex-shrink-0 mt-0.5 text-green-500" />
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Next Steps */}
        {report.nextSteps.length > 0 && (
          <div className="pl-4 border-l-4 border-slate-300">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Next Steps</h3>
            <ul className="space-y-1.5">
              {report.nextSteps.map((step, index) => (
                <li key={index} className="flex gap-2 text-sm text-slate-700">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center mt-0.5">{index + 1}</span>
                  {step}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
};

interface ProjectTrainerTabProps {
  project: Project;
  onSave: (updates: Partial<Project>) => Promise<void>;
}

const ProjectTrainerTab: React.FC<ProjectTrainerTabProps> = ({ project, onSave }) => {
  const { members } = useMembers();
  const [rows, setRows] = useState<{ name: string; memberId: string; role: string; durationHours: string }[]>(() => {
    return (project.trainers || []).map(t => ({
      name: t.name || '',
      memberId: t.memberId || '',
      role: t.role || '',
      durationHours: t.durationHours?.toString() || '',
    }));
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const resetRows = () => {
    setRows((project.trainers || []).map(t => ({
      name: t.name || '',
      memberId: t.memberId || '',
      role: t.role || '',
      durationHours: t.durationHours?.toString() || '',
    })));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const trainers = rows
        .map(r => ({
          name: r.name.trim(),
          memberId: r.memberId,
          role: r.role.trim(),
          durationHours: r.durationHours ? parseFloat(r.durationHours) : undefined,
        }))
        .filter(r => r.name);
      await onSave({ trainers });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-base font-semibold text-slate-900">Trainers & Facilitators</h3>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setIsEditing(false); resetRows(); }} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" size="sm" isLoading={isSaving}>
                Save
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit size={14} className="mr-1.5" /> Edit
            </Button>
          )}
        </div>
      </div>

      {/* VIEW MODE */}
      {!isEditing && (
        <div className="space-y-3">
          {rows.length === 0 ? (
            <div className="text-center py-10 text-sm text-slate-400">
              No trainers assigned yet.{' '}
            </div>
          ) : rows.map((row, rowIndex) => {
            const initials = row.name
              ? row.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
              : '?';
            return (
              <div key={rowIndex} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-violet-100 text-violet-600 font-semibold text-sm flex items-center justify-center">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 truncate">{row.name}</span>
                    {row.role && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{row.role}</span>
                    )}
                    {row.memberId && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">JCI Member</span>
                    )}
                  </div>
                  {row.durationHours && (
                    <div className="text-xs text-slate-400 mt-0.5 tabular-nums">{row.durationHours} hrs</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* EDIT MODE */}
      {isEditing && (
        <div className="space-y-3">
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              {/* Top row: member selector + name */}
              <div className="flex flex-wrap gap-2 items-end p-3 bg-slate-50 border-b border-slate-100">
                <div className="flex-[2] min-w-[160px]">
                  <MemberSelector
                    label="Link to Member"
                    placeholder="Search member"
                    members={members}
                    value={row.memberId || ''}
                    onChange={(value) => {
                      setRows(prev => {
                        const next = [...prev];
                        next[rowIndex].memberId = value;
                        if (value) {
                          const member = members.find(m => m.id === value);
                          if (member) next[rowIndex].name = member.name || '';
                        }
                        return next;
                      });
                    }}
                    selfOption={false}
                    showLookupFields={false}
                    getOptionLabel={(m) => m.fullName ? `${m.name} (${m.fullName})` : m.name}
                  />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <Input
                    label="Trainer Name *"
                    required
                    value={row.name}
                    className="text-sm h-8"
                    placeholder="e.g. John Doe"
                    onChange={(e) => {
                      setRows(prev => { const next = [...prev]; next[rowIndex].name = e.target.value; return next; });
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="flex-shrink-0 mb-1 text-slate-300 hover:text-red-400 transition-colors p-1 rounded"
                  title="Remove trainer"
                  onClick={() => setRows(prev => prev.filter((_, i) => i !== rowIndex))}
                >
                  <X size={15} />
                </button>
              </div>
              {/* Bottom row: role + duration */}
              <div className="flex flex-wrap gap-2 items-end p-3">
                <div className="flex-1 min-w-[120px]">
                  <Input
                    label="Role"
                    value={row.role}
                    className="text-sm h-8"
                    placeholder="e.g. Head Trainer"
                    onChange={(e) => {
                      setRows(prev => { const next = [...prev]; next[rowIndex].role = e.target.value; return next; });
                    }}
                  />
                </div>
                <div className="w-32">
                  <Input
                    label="Duration (hrs)"
                    type="number"
                    step="0.5"
                    min="0"
                    value={row.durationHours}
                    className="text-sm h-8"
                    placeholder="e.g. 2.5"
                    onChange={(e) => {
                      setRows(prev => { const next = [...prev]; next[rowIndex].durationHours = e.target.value; return next; });
                    }}
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Add Trainer dashed row */}
          <button
            type="button"
            className="w-full rounded-xl border-2 border-dashed border-slate-200 py-2.5 text-sm text-slate-400 hover:border-jci-blue hover:text-jci-blue transition-colors"
            onClick={() => setRows(prev => [...prev, { name: '', role: '', memberId: '', durationHours: '' }])}
          >
            + Add Trainer
          </button>
        </div>
      )}
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
