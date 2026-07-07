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

const PENDING_USE_TEMPLATE_KEY = 'jci_pending_use_template_id';

interface RoadmapEventDetails {
  logoUrl: string;
  title: string;
  description: string;
  level: ProjectLevel | '';
  pillar: ProjectPillar | '';
  type: ProjectType | '';
  category: string;
  eventStartDate: string;
  eventEndDate: string;
  eventStartTime: string;
  eventEndTime: string;
  proposedDate: string;
  priceMin?: number;
  priceMax?: number;
}

const fetchRoadmapEventDetails = async (input: string): Promise<RoadmapEventDetails> => {
  let eventId = input.trim();
  if (eventId.includes('eventid=')) {
    const urlParams = new URLSearchParams(eventId.split('?')[1]);
    eventId = urlParams.get('eventid') || '';
  }
  if (!eventId) {
    throw new Error('Invalid Event ID or URL');
  }

  const targetUrl = `https://jcimalaysia.cc/roadmap/event-details-public.php?eventid=${eventId}`;
  let html = '';
  let lastError = '';

  // Try 1: corsproxy.io (extremely popular, fast and supports raw text fetch)
  try {
    const response = await fetch(`https://corsproxy.io/?${encodeURIComponent(targetUrl)}`);
    if (response.ok) {
      html = await response.text();
    } else {
      lastError = `corsproxy.io returned status ${response.status}`;
    }
  } catch (err: any) {
    lastError = err.message || err;
  }

  // Try 2: AllOrigins JSON endpoint (most reliable CORS fallback proxy format)
  if (!html) {
    try {
      const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`);
      if (response.ok) {
        const data = await response.json();
        if (data && data.contents) {
          html = data.contents;
        }
      } else {
        lastError = `AllOrigins returned status ${response.status}`;
      }
    } catch (err: any) {
      lastError = err.message || err;
    }
  }

  // Try 3: CodeTabs Proxy (Fallback 2)
  if (!html) {
    try {
      const response = await fetch(`https://api.codetabs.com/v1/proxy?target=${encodeURIComponent(targetUrl)}`);
      if (response.ok) {
        html = await response.text();
      } else {
        lastError = `CodeTabs returned status ${response.status}`;
      }
    } catch (err: any) {
      lastError = err.message || err;
    }
  }

  // Try 4: Direct fetch (Fallback 3 - in case CORS is allowed directly)
  if (!html) {
    try {
      const response = await fetch(targetUrl);
      if (response.ok) {
        html = await response.text();
      } else {
        lastError = `Direct fetch returned status ${response.status}`;
      }
    } catch (err: any) {
      lastError = err.message || err;
    }
  }

  if (!html) {
    throw new Error(`Failed to fetch page. Please verify your internet connection or try again later. (Details: ${lastError || 'Proxy failed'})`);
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // 1. Get Logo / Poster Url
  let logoUrl = '';
  const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
  if (ogImage) {
    logoUrl = ogImage.trim();
  } else {
    const twitterImage = doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
    if (twitterImage) {
      logoUrl = twitterImage.trim();
    } else {
      const imgElement = doc.querySelector('.d-flex.align-items-center.justify-content-center img.product-img') || doc.querySelector('img.product-img');
      const src = imgElement?.getAttribute('src');
      if (src) {
        logoUrl = src.startsWith('http') ? src.trim() : `https://jcimalaysia.cc/roadmap/${src.trim()}`;
      }
    }
  }

  // 2. Get Title
  const title = doc.querySelector('.col-md-7 h3')?.textContent?.trim() ||
    doc.querySelector('h3')?.textContent?.trim() ||
    doc.querySelector('title')?.textContent?.split('|')[0].trim() || '';

  // 3. Get Description in Paragraph Format
  const cardTexts = Array.from(doc.querySelectorAll('.col-md-7 p.card-text, p.card-text'));
  const shortEl = cardTexts.find(el => !el.querySelector('.badge') && el.textContent?.trim() !== '');
  let shortDesc = '';
  if (shortEl) {
    let htmlContent = shortEl.innerHTML || '';
    htmlContent = htmlContent.replace(/<\/p>/gi, '\n\n').replace(/<br\s*\/?>/gi, '\n');
    const tempDiv = parser.parseFromString(htmlContent, 'text/html');
    shortDesc = (tempDiv.body.textContent || '').trim();
  }

  const pb2Elements = Array.from(doc.querySelectorAll('.pb-2'));
  const longEl = pb2Elements.find(el => !el.querySelector('.badge') && el.textContent?.trim() !== '');
  let longDesc = '';
  if (longEl) {
    let htmlContent = longEl.innerHTML || '';
    htmlContent = htmlContent.replace(/<\/p>/gi, '\n\n').replace(/<br\s*\/?>/gi, '\n');
    const tempDiv = parser.parseFromString(htmlContent, 'text/html');
    longDesc = (tempDiv.body.textContent || '').trim();
  }

  let rawDesc = '';
  if (shortDesc && longDesc) {
    if (longDesc.includes(shortDesc) || shortDesc.includes(longDesc)) {
      rawDesc = longDesc.length >= shortDesc.length ? longDesc : shortDesc;
    } else {
      rawDesc = shortDesc + '\n\n' + longDesc;
    }
  } else {
    rawDesc = shortDesc || longDesc || '';
  }

  const lines = rawDesc.split(/\r?\n/).map(line => line.trim());
  const formattedParagraphs: string[] = [];
  let currentParagraph = '';

  for (const line of lines) {
    if (line === '') {
      if (currentParagraph) {
        formattedParagraphs.push(currentParagraph);
        currentParagraph = '';
      }
    } else {
      // If it starts with a list bullet (e.g. ¢, -, *, 1.), make it a separate block
      const isListItem = /^[¢\-\*\d+\.]/.test(line);
      if (isListItem) {
        if (currentParagraph) {
          formattedParagraphs.push(currentParagraph);
        }
        formattedParagraphs.push(line);
        currentParagraph = '';
      } else {
        if (currentParagraph) {
          currentParagraph += ' ' + line;
        } else {
          currentParagraph = line;
        }
      }
    }
  }
  if (currentParagraph) {
    formattedParagraphs.push(currentParagraph);
  }
  const description = formattedParagraphs.join('\n\n');

  // 4. Parse Dates & Times
  const dateText = doc.querySelector('h6.text-success')?.textContent?.trim() || '';
  let eventStartDate = '';
  let eventEndDate = '';
  let eventStartTime = '';
  let eventEndTime = '';

  const parseRoadmapDate = (str: string) => {
    const cleaned = str.replace(/\s+/g, ' ').trim();
    const parts = cleaned.split(' ');
    let day = '';
    let monthStr = '';
    let year = '';
    let time = '';
    let ampm = '';

    if (parts.length >= 3) {
      day = parts[0];
      monthStr = parts[1];
      year = parts[2];
    }
    if (parts.length >= 5) {
      time = parts[3];
      ampm = parts[4];
    }

    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    const mKey = monthStr.toLowerCase().slice(0, 3);
    const month = months[mKey] || '01';

    const formattedDay = day.padStart(2, '0');
    const formattedDate = (year && month && formattedDay) ? `${year}-${month}-${formattedDay}` : '';

    let formattedTime = '';
    if (time) {
      const [h, m] = time.split(':');
      let hour = parseInt(h, 10);
      const min = m || '00';
      if (ampm.toLowerCase() === 'pm' && hour < 12) {
        hour += 12;
      } else if (ampm.toLowerCase() === 'am' && hour === 12) {
        hour = 0;
      }
      formattedTime = `${hour.toString().padStart(2, '0')}:${min}`;
    }

    return { date: formattedDate, time: formattedTime };
  };

  if (dateText) {
    const parts = dateText.split(' - ');
    if (parts.length === 2) {
      const startParsed = parseRoadmapDate(parts[0]);
      const endParsed = parseRoadmapDate(parts[1]);
      eventStartDate = startParsed.date;
      eventStartTime = startParsed.time;
      eventEndDate = endParsed.date;
      eventEndTime = endParsed.time;
    } else {
      const parsed = parseRoadmapDate(dateText);
      eventStartDate = parsed.date;
      eventStartTime = parsed.time;
    }
  }

  // 5. Parse Level, Pillar, Type, Category from badges
  const badges = Array.from(doc.querySelectorAll('span.badge')).map(el => el.textContent?.trim() || '');
  let level: ProjectLevel | '' = '';
  let pillar: ProjectPillar | '' = '';
  let type: ProjectType | '' = '';
  let category = '';

  badges.forEach(badge => {
    const lower = badge.toLowerCase();

    if (lower === 'national') level = 'National';
    else if (lower === 'jci') level = 'JCI';
    else if (lower.includes('area')) level = 'Area';
    else if (lower.includes('local')) level = 'Local';

    if (lower === 'event') type = 'event';
    else if (lower === 'program') type = 'program';
    else if (lower === 'project') type = 'project';
    else if (lower.includes('skill')) type = 'skill_development';

    if (lower === 'individual') pillar = 'Individual';
    else if (lower === 'community') pillar = 'Community';
    else if (lower === 'business') pillar = 'Business';
    else if (lower === 'international') pillar = 'International';
    else if (lower === 'lom') pillar = 'LOM';
    else if (lower === 'chapter') pillar = 'Chapter';
  });

  const unmatchedBadges = badges.filter(badge => {
    const lower = badge.toLowerCase();
    const isLevel = lower === 'national' || lower === 'jci' || lower.includes('area') || lower.includes('local');
    const isType = lower === 'event' || lower === 'program' || lower === 'project' || lower.includes('skill');
    const isPillar = ['individual', 'community', 'business', 'international', 'lom', 'chapter'].includes(lower);
    return !isLevel && !isType && !isPillar;
  });
  const parsedCategory = unmatchedBadges.join(', ');

  // Match the matched category against allowed system category options
  if (type) {
    const allowedCategories = PROJECT_CATEGORIES_BY_TYPE[type] || [];
    const searchStr = `${parsedCategory} ${title}`.toLowerCase();
    const match = allowedCategories.find(c => {
      const cLower = c.toLowerCase();
      return searchStr.includes(cLower) || cLower.includes(parsedCategory.toLowerCase());
    });
    category = match || allowedCategories[0] || '';
  } else {
    category = parsedCategory;
  }

  // 6. Parse ticket prices from type_ticket radio options
  let priceMin: number | undefined;
  let priceMax: number | undefined;
  const ticketLabels = Array.from(doc.querySelectorAll('label.custom-option-item'));
  const ticketPrices: number[] = [];
  const myrPattern = /MYR\s*([\d,]+(?:\.\d{1,2})?)/i;
  ticketLabels.forEach(label => {
    const spans = Array.from(label.querySelectorAll('span.fw-bolder'));
    spans.forEach(span => {
      const text = span.textContent?.trim() || '';
      const m = text.match(myrPattern);
      if (m) {
        const val = parseFloat(m[1].replace(/,/g, ''));
        if (!isNaN(val) && val >= 0) ticketPrices.push(val);
      }
    });
  });
  // Fallback: scan full text for MYR or RM amounts if no structured tickets found
  if (ticketPrices.length === 0) {
    const allText = doc.body?.textContent || '';
    const fallbackMatches = [...allText.matchAll(/(?:MYR|RM)\s*([\d,]+(?:\.\d{1,2})?)/gi)];
    fallbackMatches.forEach(m => {
      const val = parseFloat(m[1].replace(/,/g, ''));
      if (!isNaN(val) && val > 0 && val < 100000) ticketPrices.push(val);
    });
  }
  if (ticketPrices.length > 0) {
    priceMin = Math.min(...ticketPrices);
    priceMax = Math.max(...ticketPrices);
    if (priceMin === priceMax) priceMax = undefined;
  }

  return {
    logoUrl,
    title,
    description,
    level,
    pillar,
    type,
    category,
    eventStartDate,
    eventEndDate,
    eventStartTime,
    eventEndTime,
    proposedDate: eventStartDate,
    priceMin,
    priceMax,
  };
};

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

  // ä½¿ç"¨ ref æ¥é˜²æ­¢é‡å¤åŠ è½½
  const isLoadingRef = useRef(false);
  const lastLoadTimeRef = useRef<number>(0);

  const loadTasks = useCallback(async () => {
    // é˜²æ­¢é‡å¤åŠ è½½ï¼šå¦‚æžœæ­£åœ¨åŠ è½½æˆ–è·ç¦»ä¸Šæ¬¡åŠ è½½ä¸åˆ° 500msï¼Œåˆ™è·³è¿‡
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
      // updateTask ä¼šè‡ªåŠ¨è®°å½• statusHistory
      await updateTask(taskId, { status: newStatus });
      await loadTasks();
      // æ›´æ–° selectedTask ä»¥åæ˜ æ–°çŠ¶æ€
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
      // èŽ·å–çŽ°æœ‰ task ä»¥åˆå¹¶ remarks
      const existingTask = await getTaskById(taskId);
      const existingRemarks = existingTask?.remarks || {};

      // æ·»åŠ æ–° remark
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

      // æ›´æ–° selectedTask
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

  const COL_STYLE: Record<string, { border: string; badge: string; dot: string }> = {
    'Todo': { border: 'border-l-4 border-slate-400', badge: 'bg-slate-200 text-slate-600', dot: 'bg-slate-400' },
    'In Progress': { border: 'border-l-4 border-jci-blue', badge: 'bg-jci-blue/10 text-jci-blue', dot: 'bg-jci-blue' },
    'Done': { border: 'border-l-4 border-green-500', badge: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  };

  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(new Set(['Todo', 'Done']));
  const toggleCol = (col: string) => setCollapsedCols(prev => {
    const next = new Set(prev);
    next.has(col) ? next.delete(col) : next.add(col);
    return next;
  });

  const today = new Date(); today.setHours(0, 0, 0, 0);

  return (
    <>
      {/* Desktop: horizontal 3-column scroll; Mobile: stacked accordion */}
      <div className="md:flex md:gap-5 md:overflow-x-auto md:pb-6 space-y-3 md:space-y-0">
        {columns.map(col => {
          const columnTasks = tasks.filter(t => String(t.status || 'Todo').trim() === col);
          const style = COL_STYLE[col];
          const isCollapsed = collapsedCols.has(col);

          return (
            <div
              key={col}
              className={`md:w-80 md:flex-shrink-0 md:flex md:flex-col bg-slate-50 rounded-xl transition-all ${style.border} ${dragOverColumn === col ? 'ring-2 ring-jci-blue ring-offset-2' : ''}`}
              onDragOver={(e) => handleDragOver(e, col)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col)}
            >
              {/* Column header */}
              <div
                className="px-4 py-3 flex justify-between items-center cursor-pointer md:cursor-default select-none"
                onClick={() => toggleCol(col)}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />
                  <span className="font-semibold text-sm text-slate-700">{col}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${style.badge}`}>
                    {columnTasks.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="text-slate-400 hover:text-jci-blue p-1 rounded transition-colors hidden md:block"
                    onClick={(e) => { e.stopPropagation(); setSelectedTask(null); setIsTaskModalOpen(true); }}
                    title="Add task"
                  >
                    <Plus size={15} />
                  </button>
                  <ChevronDown size={16} className={`text-slate-400 transition-transform md:hidden ${isCollapsed ? '' : 'rotate-180'}`} />
                </div>
              </div>

              {/* Tasks list */}
              <div className={`${isCollapsed ? 'hidden md:block' : ''} px-3 pb-3 space-y-2 md:overflow-y-auto md:flex-1 md:max-h-[560px]`}>
                {loading ? (
                  <div className="text-center py-6 text-slate-400 text-sm">Loading</div>
                ) : (
                  <>
                    {columnTasks.map(task => {
                      const due = task.dueDate ? new Date(task.dueDate) : null;
                      const isOverdue = due && due < today && col !== 'Done';
                      const latestRemark = getLatestRemark(task);
                      const allRemarks = getSortedRemarks(task.remarks);
                      const isExpanded = expandedRemarks.has(task.id);

                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task)}
                          className={`bg-white p-3 rounded-lg shadow-sm border border-slate-200 cursor-move hover:shadow-md transition-all ${draggedTask?.id === task.id ? 'opacity-40' : ''}`}
                          onClick={() => setSelectedTask(task)}
                        >
                          {/* Title row */}
                          <h4 className="text-sm font-semibold text-slate-800 line-clamp-2 mb-2">{task.title}</h4>

                          {/* Meta row */}
                          <div className="flex flex-wrap items-center gap-1.5 mb-2">
                            {task.role && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">{task.role}</span>
                            )}
                            <span className="text-xs text-slate-500 truncate">{getMemberName(task.assignee)}</span>
                          </div>

                          {/* Footer row: priority + due date */}
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${task.priority === 'High' ? 'bg-red-50 text-red-600' : task.priority === 'Medium' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                              {task.priority}
                            </span>
                            {due && (
                              <span className={`flex items-center gap-0.5 text-[10px] font-medium ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
                                <Calendar size={10} />
                                {due.toLocaleDateString()}
                              </span>
                            )}
                          </div>

                          {/* Latest remark */}
                          {allRemarks.length > 0 && (
                            <div className="mt-2 border-t border-slate-100 pt-2">
                              <div className="flex justify-between items-start gap-1">
                                <div className="flex-1 min-w-0">
                                  {!isExpanded && latestRemark && (
                                    <p className="text-xs text-slate-500 line-clamp-2 bg-slate-50 rounded px-2 py-1">{latestRemark.content}</p>
                                  )}
                                  {isExpanded && (
                                    <div className="space-y-1 max-h-28 overflow-y-auto">
                                      {allRemarks.map(r => (
                                        <div key={r.id} className="text-xs text-slate-500 bg-slate-50 rounded px-2 py-1">
                                          <p>{r.content}</p>
                                          <p className="text-[10px] text-slate-400 mt-0.5">{new Date(r.timestamp).toLocaleString()}</p>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                {allRemarks.length > 1 && (
                                  <button
                                    onClick={(e) => toggleRemarksExpansion(task.id, e)}
                                    className="flex-shrink-0 text-slate-400 hover:text-jci-blue p-0.5 rounded"
                                  >
                                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Add task button */}
                    <button
                      className="w-full py-2 text-slate-400 hover:text-slate-600 text-sm border border-dashed border-slate-200 rounded-lg hover:bg-white transition-colors"
                      onClick={(e) => { e.stopPropagation(); setSelectedTask(null); setIsTaskModalOpen(true); }}
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
        onClose={() => { setIsTaskModalOpen(false); setSelectedTask(null); setNewRemark(''); setShowStatusHistory(false); }}
        title={selectedTask ? 'Task Details' : 'New Task'}
        drawerOnMobile
      >
        {selectedTask ? (
          <div className="space-y-4">
            {/* Title + meta */}
            <div>
              <h3 className="font-bold text-base text-slate-900 mb-3">{selectedTask.title}</h3>
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-slate-500">Status</span>
                  <Badge variant="neutral">{selectedTask.status}</Badge>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-slate-500">Priority</span>
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
                    className="text-xs bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-jci-blue"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-slate-500">Assigned to</span>
                  <span className="font-medium text-slate-800">
                    {selectedTask.role ? `${selectedTask.role} · ` : ''}{getMemberName(selectedTask.assignee)}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-slate-500">Due date</span>
                  <span className="font-medium text-slate-800">{new Date(selectedTask.dueDate).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Remarks */}
            <div>
              <div className="text-sm font-semibold text-slate-700 mb-2">Remarks</div>
              <Textarea
                value={newRemark}
                onChange={(e) => setNewRemark(e.target.value)}
                placeholder="Add a remark"
                rows={3}
              />
              <div className="flex justify-end mt-2">
                <Button type="button" size="sm" onClick={() => handleAddRemark(selectedTask.id)} disabled={!newRemark.trim()}>
                  Add Remark
                </Button>
              </div>
              {selectedTask.remarks && Object.keys(selectedTask.remarks).length > 0 && (
                <div className="space-y-2 max-h-52 overflow-y-auto mt-3">
                  {Object.entries(selectedTask.remarks)
                    .sort(([, a], [, b]) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .map(([id, remark]) => (
                      <div key={id} className="text-sm bg-slate-50 rounded-lg border border-slate-100 px-3 py-2.5 flex justify-between items-start gap-3">
                        <div className="text-slate-700 flex-1">{remark.content}</div>
                        <div className="text-xs text-slate-400 whitespace-nowrap">{new Date(remark.timestamp).toLocaleString()}</div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="pt-3 flex justify-end border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => { setSelectedTask(null); setNewRemark(''); setShowStatusHistory(false); }}>Close</Button>
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
            <div className="pt-2 flex gap-3">
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
  onNavigate?: (view: string) => void;
}

const ProjectFinancialAccount: React.FC<ProjectFinancialAccountProps> = ({
  projectId,
  project,
  account,
  loading,
  onReconcile,
  onUpdateBudget,
  onRefresh,
  onNavigate
}) => {
  const { showToast } = useToast();

  const [isClaimDrawerOpen, setIsClaimDrawerOpen] = useState(false);

  const handleClaimReimbursement = () => setIsClaimDrawerOpen(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bankTransactions, setBankTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [loadingBankTransactions, setLoadingBankTransactions] = useState(false);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [newBudget, setNewBudget] = useState(0);
  const [activeFinancialTab, setActiveFinancialTab] = useState('budget');
  const [activeTrxType, setActiveTrxType] = useState<'Income' | 'Expense'>('Income');
  const [activeBankTrxType, setActiveBankTrxType] = useState<'Income' | 'Expense'>('Income');
  const [incomePurposeValue, setIncomePurposeValue] = useState('');
  const [expensePurposeValue, setExpensePurposeValue] = useState('');
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankTxSearchQuery, setBankTxSearchQuery] = useState('');
  const [selectedBankTxIds, setSelectedBankTxIds] = useState<string[]>([]);
  const [selectedProjectTxIds, setSelectedProjectTxIds] = useState<string[]>([]);
  const [batchProjectPurposeValue, setBatchProjectPurposeValue] = useState('');
  const [batchProjectTxIds, setBatchProjectTxIds] = useState<string[]>([]);
  const isMixedBankTxSelected = useMemo(() => {
    if (selectedBankTxIds.length === 0) return false;
    const selectedTxTypes = selectedBankTxIds.map(id => {
      const tx = bankTransactions.find(bt => bt.id === id);
      return tx?.type;
    }).filter(Boolean);
    return new Set(selectedTxTypes).size > 1;
  }, [selectedBankTxIds, bankTransactions]);
  const [tempSelectedProjectTxIds, setTempSelectedProjectTxIds] = useState<Record<string, string[]>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingIncome, setIsAddingIncome] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Transaction>>({});
  const [addForm, setAddForm] = useState<Partial<Transaction>>({});
  const { members } = useMembers();

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

  const refreshTransactionsBackground = async () => {
    if (!account) return;
    try {
      const [projectTx, bankTx] = await Promise.all([
        FinanceService.getProjectTransactions(account.projectId),
        FinanceService.getBankTransactionsByProject(account.projectId)
      ]);
      setTransactions(projectTx);
      setBankTransactions(bankTx);
    } catch (err) {
      console.error('Failed to load transactions in background', err);
    }
  };


  const handleTablePaste = async (e: React.ClipboardEvent, type: 'Income' | 'Expense', currentPurpose: string) => {
    const pastedText = e.clipboardData.getData('Text');
    if (!pastedText || !pastedText.includes('\t')) {
      return;
    }

    e.preventDefault();

    const rows = pastedText.split(/\r?\n/).filter(r => r.trim());
    let parsedCount = 0;
    let dynamicPurpose = currentPurpose;

    const parsePastedDate = (dateStr: string): string => {
      if (!dateStr) return '';
      const clean = dateStr.trim();

      // Pattern 1: DD/MM/YYYY or DD-MM-YYYY
      const dmyMatch = clean.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
      if (dmyMatch) {
        const day = dmyMatch[1].padStart(2, '0');
        const month = dmyMatch[2].padStart(2, '0');
        const year = dmyMatch[3];
        return `${year}-${month}-${day}`;
      }

      // Pattern 2: YYYY/MM/DD or YYYY-MM-DD
      const ymdMatch = clean.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})$/);
      if (ymdMatch) {
        const year = ymdMatch[1];
        const month = ymdMatch[2].padStart(2, '0');
        const day = ymdMatch[3].padStart(2, '0');
        return `${year}-${month}-${day}`;
      }

      // Fallback: standard parser
      try {
        const d = new Date(clean);
        if (!isNaN(d.getTime())) {
          return d.toISOString().split('T')[0];
        }
      } catch { }

      return '';
    };

    setLoadingTransactions(true);
    try {
      for (const row of rows) {
        const cols = row.split('\t');
        if (cols.length === 0) continue;

        const description = cols[0]?.trim();
        const remark = cols.length > 1 ? cols[1]?.trim() : '';

        const incomeStr = cols.length > 2 ? cols[2]?.replace(/[^0-9.-]+/g, '') : '';
        const expenseStr = cols.length > 3 ? cols[3]?.replace(/[^0-9.-]+/g, '') : '';

        const incomeAmount = parseFloat(incomeStr) || 0;
        const expenseAmount = parseFloat(expenseStr) || 0;

        // If row has a description but no amount in either column, it's a Purpose header
        if (description && !incomeStr && !expenseStr) {
          dynamicPurpose = description;
          continue;
        }

        const amount = incomeAmount > 0 ? incomeAmount : expenseAmount;
        if (!description || !amount) continue;

        let txType = type;
        if (incomeAmount > 0) txType = 'Income';
        else if (expenseAmount > 0) txType = 'Expense';

        // Check 5th column for date. If empty, dateStr will be '' representing unpaid payment request.
        const rawDate = cols.length > 4 ? cols[4]?.trim() : '';
        const dateStr = parsePastedDate(rawDate);

        if (account?.projectId) {
          await FinanceService.createProjectTransaction({
            projectId: account.projectId,
            type: txType,
            amount: amount,
            description: description,
            referenceNumber: remark || undefined,
            date: dateStr,
            purpose: dynamicPurpose || undefined,
            category: 'Projects & Activities',
            status: 'Pending',
          } as any);
          parsedCount++;
        }
      }

      if (parsedCount > 0) {
        showToast(`Successfully pasted and added ${parsedCount} transactions`, 'success');
        loadTransactions();
      } else {
        showToast('Could not parse any valid transactions from clipboard', 'warning');
      }
    } catch (err) {
      console.error('Error pasting transactions:', err);
      showToast('Error parsing or adding transactions', 'error');
    } finally {
      setLoadingTransactions(false);
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
      // Unlink this transaction from any bank transactions
      const relatedBankTxs = bankTransactions.filter(btx => {
        const btxLinkedIds = (btx as any).projectTransactionIds || ((btx as any).projectTransactionId ? [(btx as any).projectTransactionId] : []);
        return btxLinkedIds.includes(transactionId);
      });

      if (relatedBankTxs.length > 0) {
        await Promise.all(relatedBankTxs.map(btx => {
          const btxLinkedIds = (btx as any).projectTransactionIds || ((btx as any).projectTransactionId ? [(btx as any).projectTransactionId] : []);
          const newLinkedIds = btxLinkedIds.filter((id: string) => id !== transactionId);
          const updates: any = {
            projectTransactionIds: newLinkedIds,
            projectTransactionId: newLinkedIds[0] || null,
            status: newLinkedIds.length > 0 ? 'Reconciled' : 'Cleared'
          };
          if (newLinkedIds.length === 0) {
            updates.purpose = '';
          }
          if ((btx as any).isSplitChild) {
            return FinanceService.updateTransactionSplit(btx.id, updates);
          } else {
            return FinanceService.updateTransaction(btx.id, updates);
          }
        }));
      }

      await FinanceService.deleteProjectTransaction(transactionId);
      showToast('Transaction deleted successfully', 'success');
      loadTransactions();
      onRefresh(); // Refresh parent account data
    } catch (err) {
      console.error(err);
      showToast('Failed to delete transaction', 'error');
    }
  };

  const handleBatchDeleteProjectTransactions = async () => {
    if (selectedProjectTxIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedProjectTxIds.length} selected transactions?`)) return;

    try {
      setLoadingTransactions(true);

      // Unlink any bank transactions tied to these project transactions
      const relatedBankTxs = bankTransactions.filter(btx => {
        const btxLinkedIds = (btx as any).projectTransactionIds || ((btx as any).projectTransactionId ? [(btx as any).projectTransactionId] : []);
        return btxLinkedIds.some(id => selectedProjectTxIds.includes(id));
      });

      if (relatedBankTxs.length > 0) {
        await Promise.all(relatedBankTxs.map(btx => {
          const btxLinkedIds = (btx as any).projectTransactionIds || ((btx as any).projectTransactionId ? [(btx as any).projectTransactionId] : []);
          const newLinkedIds = btxLinkedIds.filter((id: string) => !selectedProjectTxIds.includes(id));
          const updates: any = {
            projectTransactionIds: newLinkedIds,
            projectTransactionId: newLinkedIds[0] || null,
            status: newLinkedIds.length > 0 ? 'Reconciled' : 'Cleared'
          };
          if (newLinkedIds.length === 0) {
            updates.purpose = '';
          }
          if ((btx as any).isSplitChild) {
            return FinanceService.updateTransactionSplit(btx.id, updates);
          } else {
            return FinanceService.updateTransaction(btx.id, updates);
          }
        }));
      }

      await Promise.all(selectedProjectTxIds.map(id => FinanceService.deleteProjectTransaction(id)));

      showToast(`Successfully deleted ${selectedProjectTxIds.length} transactions`, 'success');
      setSelectedProjectTxIds([]);
      loadTransactions();
      onRefresh(); // Refresh parent account data
    } catch (err) {
      console.error('Failed to batch delete transactions', err);
      showToast('Failed to delete transactions', 'error');
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleBatchSetProjectTxPurpose = async () => {
    if (selectedProjectTxIds.length === 0 || !batchProjectPurposeValue.trim()) return;
    try {
      setLoadingTransactions(true);
      let successCount = 0;
      let failCount = 0;

      for (const id of selectedProjectTxIds) {
        try {
          await FinanceService.updateProjectTransaction(id, {
            purpose: batchProjectPurposeValue.trim()
          });
          successCount++;
        } catch (err) {
          console.error(`Failed to update purpose for project transaction ${id}`, err);
          failCount++;
        }
      }

      if (successCount > 0) {
        showToast(
          `Successfully set purpose for ${successCount} transaction${successCount > 1 ? 's' : ''}${failCount > 0 ? `, failed ${failCount}` : ''}`,
          'success'
        );
      } else if (failCount > 0) {
        showToast(`Failed to update purpose for selected transactions`, 'error');
      }

      setSelectedProjectTxIds([]);
      setBatchProjectPurposeValue('');
      loadTransactions();
      onRefresh(); // Refresh parent account data
    } catch (err) {
      console.error('Batch set project transaction purpose failed', err);
      showToast('Failed to batch set purpose', 'error');
    } finally {
      setLoadingTransactions(false);
    }
  };


  const handleAutoMatch = async () => {
    try {
      const matches = ReconciliationService.analyzeMatches(bankTransactions, transactions || [], members);

      if (matches.length === 0) {
        showToast('No matching transactions found', 'info');
        return;
      }

      const summary = await ReconciliationService.executeAutoMatch(
        matches,
        bankTransactions,
        transactions || [],
        account?.projectId || '',
        'current-user'
      );

      const parts: string[] = [];
      if (summary.matched > 0) parts.push(`${summary.matched} matched`);
      if (summary.splitCreated > 0) parts.push(`${summary.splitCreated} auto-split`);
      if (summary.remainderSplits > 0) parts.push(`${summary.remainderSplits} with unallocated balance`);
      if (summary.errors.length > 0) parts.push(`${summary.errors.length} errors`);

      showToast(parts.length > 0 ? `Auto-match: ${parts.join(', ')}` : 'Auto-match completed', summary.errors.length > 0 ? 'warning' : 'success');

      await refreshTransactionsBackground();
    } catch (err) {
      console.error('Auto match failed', err);
      showToast('Failed to auto-match transactions', 'error');
    }
  };

  const handleLinkBankTransaction = async (bankTxId: string, projectTxIds: string[]) => {
    try {
      if (projectTxIds.length === 0) {
        // Unlink
        await ReconciliationService.unlinkMatch(
          bankTxId, undefined, bankTransactions, transactions || [], account?.projectId || ''
        );
        showToast('Link removed', 'success');
      } else {
        const result = await ReconciliationService.manualMatch(
          bankTxId, projectTxIds, bankTransactions, transactions || [], account?.projectId || '', 'current-user'
        );
        const msg = result.splitCreated
          ? `Linked and auto-split${result.remainder > 0 ? ` (${formatCurrency(result.remainder, account?.currency || 'MYR')} unallocated)` : ''}`
          : 'Bank transaction linked to project transaction';
        showToast(msg, 'success');
      }
      setTempSelectedProjectTxIds(prev => {
        const copy = { ...prev };
        delete copy[bankTxId];
        return copy;
      });
      await refreshTransactionsBackground();
    } catch (err) {
      console.error('Failed to link bank transaction', err);
      showToast('Failed to update bank transaction link', 'error');
    }
  };

  const handleBatchLinkBankTransactions = async () => {
    if (selectedBankTxIds.length === 0 || batchProjectTxIds.length === 0) return;
    try {
      let successCount = 0;
      let failCount = 0;

      // Process sequentially to avoid concurrent write/read conflicts in ReconciliationService
      for (const id of selectedBankTxIds) {
        try {
          await ReconciliationService.manualMatch(
            id,
            batchProjectTxIds,
            bankTransactions,
            transactions || [],
            account?.projectId || '',
            'current-user'
          );
          successCount++;
        } catch (err) {
          console.error(`Failed to link bank transaction ${id}`, err);
          failCount++;
        }
      }

      if (successCount > 0) {
        showToast(
          `Successfully linked ${successCount} transaction${successCount > 1 ? 's' : ''}${failCount > 0 ? `, failed ${failCount}` : ''}`,
          'success'
        );
      } else if (failCount > 0) {
        showToast(`Failed to link selected transactions`, 'error');
      }

      setSelectedBankTxIds([]);
      setBatchProjectTxIds([]);
      await refreshTransactionsBackground();
    } catch (err) {
      console.error('Batch link failed', err);
      showToast('Failed to batch link transactions', 'error');
    }
  };

  const handleBatchUnlinkBankTransactions = async () => {
    if (selectedBankTxIds.length === 0) return;
    if (!confirm(`Are you sure you want to remove matches for ${selectedBankTxIds.length} selected bank transactions?`)) return;
    try {
      await Promise.all(selectedBankTxIds.map(id =>
        ReconciliationService.unlinkMatch(
          id, undefined, bankTransactions, transactions || [], account?.projectId || ''
        )
      ));
      showToast(`Successfully removed matches for ${selectedBankTxIds.length} transactions`, 'success');
      setSelectedBankTxIds([]);
      await refreshTransactionsBackground();
    } catch (err) {
      console.error('Batch unlink failed', err);
      showToast('Failed to batch remove matches', 'error');
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
    <>
      <div className="space-y-6">
        <Tabs
          tabs={[
            { id: 'budget', label: 'Budget' },
            { id: 'projectTrx', label: 'Transactions' },
            { id: 'bankTrx', label: 'Bank Trx' }
          ]}
          activeTab={activeFinancialTab}
          onTabChange={setActiveFinancialTab}
        />

        {activeFinancialTab === 'budget' && (
          <div className="space-y-4 animate-in fade-in duration-500">
            {/* KPI strip — rows on mobile, 4-col grid on desktop */}
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden divide-y divide-slate-100 shadow-sm md:bg-transparent md:border-none md:rounded-none md:overflow-visible md:shadow-none md:divide-y-0 md:grid md:grid-cols-4 md:gap-2">
              {/* Budget */}
              <div className="flex justify-between items-center px-4 py-2.5 md:block md:rounded-xl md:border md:border-slate-200 md:bg-white md:px-3 md:py-2.5 md:shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500 md:text-[10px] md:font-semibold md:text-slate-400 md:uppercase md:tracking-wider md:block md:mb-1">Budget</span>
                  <button onClick={() => setIsEditingBudget(true)} className="text-slate-300 hover:text-jci-blue transition-colors md:hidden"><Edit size={12} /></button>
                </div>
                <div className="md:hidden">
                  {isEditingBudget ? (
                    <div className="flex gap-1 items-center">
                      <Input type="number" value={newBudget.toString()} onChange={(e) => setNewBudget(parseFloat(e.target.value) || 0)} className="h-7 text-xs w-28" />
                      <Button size="sm" onClick={handleSaveBudget}><Check size={12} /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setIsEditingBudget(false)}><X size={12} /></Button>
                    </div>
                  ) : (
                    <span className="text-sm font-bold font-mono text-slate-900 tabular-nums">{formatCurrency(account.budget, account.currency)}</span>
                  )}
                </div>
                <div className="hidden md:block">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Budget</span>
                    <button onClick={() => setIsEditingBudget(true)} className="text-slate-300 hover:text-jci-blue transition-colors"><Edit size={12} /></button>
                  </div>
                  {isEditingBudget ? (
                    <div className="flex gap-1 items-center">
                      <Input type="number" value={newBudget.toString()} onChange={(e) => setNewBudget(parseFloat(e.target.value) || 0)} className="h-7 text-xs" />
                      <Button size="sm" onClick={handleSaveBudget}><Check size={12} /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setIsEditingBudget(false)}><X size={12} /></Button>
                    </div>
                  ) : (
                    <div className="text-base font-bold text-slate-900 tabular-nums">{formatCurrency(account.budget, account.currency)}</div>
                  )}
                </div>
              </div>
              {/* Income */}
              <div className="flex justify-between items-center px-4 py-2.5 md:block md:rounded-xl md:border md:border-green-100 md:bg-green-50 md:px-3 md:py-2.5 md:shadow-sm">
                <span className="text-sm text-slate-500 md:text-[10px] md:font-semibold md:text-green-600 md:uppercase md:tracking-wider md:block md:mb-1">Income</span>
                <span className="text-sm font-bold font-mono text-green-700 tabular-nums md:text-base">{formatCurrency(totalIncome, account.currency)}</span>
              </div>
              {/* Expenses */}
              <div className="flex justify-between items-center px-4 py-2.5 md:block md:rounded-xl md:border md:border-red-100 md:bg-red-50 md:px-3 md:py-2.5 md:shadow-sm">
                <span className="text-sm text-slate-500 md:text-[10px] md:font-semibold md:text-red-500 md:uppercase md:tracking-wider md:block md:mb-1">Expenses</span>
                <span className="text-sm font-bold font-mono text-red-600 tabular-nums md:text-base">{formatCurrency(totalExpenses, account.currency)}</span>
              </div>
              {/* Balance */}
              <div className={`flex justify-between items-center px-4 py-2.5 md:block md:rounded-xl md:border md:px-3 md:py-2.5 md:shadow-sm ${remainingBudget >= 0 ? 'md:border-emerald-100 md:bg-emerald-50' : 'md:border-red-100 md:bg-red-50'}`}>
                <span className={`text-sm text-slate-500 md:text-[10px] md:font-semibold md:uppercase md:tracking-wider md:block md:mb-1 ${remainingBudget >= 0 ? 'md:text-emerald-600' : 'md:text-red-500'}`}>Balance</span>
                <span className={`text-sm font-bold font-mono tabular-nums md:text-base ${remainingBudget >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatCurrency(remainingBudget, account.currency)}</span>
              </div>
            </div>

            {/* Main card " single unified card, 2-col on desktop */}
            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">

                {/* Left: utilization hero */}
                <div className="px-4 py-5 space-y-4">
                  {/* Big % + label */}
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Budget Utilization</p>
                      <p className={`text-4xl font-black tabular-nums leading-none ${budgetUtilization > 100 ? 'text-red-600' : budgetUtilization > 80 ? 'text-amber-500' : 'text-emerald-600'}`}>
                        {budgetUtilization.toFixed(1)}<span className="text-xl font-bold">%</span>
                      </p>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${budgetUtilization > 100 ? 'bg-red-100 text-red-600' : budgetUtilization > 80 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                      {budgetUtilization > 100 ? 'Over Budget' : budgetUtilization > 80 ? 'High Usage' : 'On Track'}
                    </span>
                  </div>

                  {/* Progress bar " thicker */}
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${budgetUtilization > 100 ? 'bg-red-500' : budgetUtilization > 80 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(budgetUtilization, 100)}%` }}
                    />
                  </div>

                  {/* Breakdown list */}
                  <div className="space-y-2 pt-1">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Total Budget</span>
                      <span className="font-semibold tabular-nums">{formatCurrency(account.budget, account.currency)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Expenses</span>
                      <span className="font-semibold text-red-600 tabular-nums">{formatCurrency(totalExpenses, account.currency)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-100">
                      <span className="font-semibold text-slate-800">Remaining</span>
                      <span className={`font-bold tabular-nums ${remainingBudget >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(remainingBudget, account.currency)}</span>
                    </div>
                  </div>
                </div>

                {/* Right: income vs expense + actions */}
                <div className="px-4 py-5 space-y-4">
                  {/* Income vs Expenses visual bar */}
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Income vs Expenses</p>
                    {(() => {
                      const total = totalIncome + totalExpenses || 1;
                      const incomePct = Math.round((totalIncome / total) * 100);
                      const expensePct = 100 - incomePct;
                      return (
                        <div className="space-y-2">
                          <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
                            <div className="bg-emerald-400 rounded-l-full transition-all" style={{ width: `${incomePct}%` }} />
                            <div className="bg-red-400 rounded-r-full transition-all" style={{ width: `${expensePct}%` }} />
                          </div>
                          <div className="flex justify-between text-xs text-slate-500">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />Income {incomePct}%</span>
                            <span className="flex items-center gap-1">Expenses {expensePct}%<span className="w-2 h-2 rounded-full bg-red-400 inline-block" /></span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Net position */}
                  <div className="rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-3">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Net Position</p>
                    <p className={`text-xl font-black tabular-nums ${totalIncome - totalExpenses >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {totalIncome - totalExpenses >= 0 ? '+' : ''}{formatCurrency(totalIncome - totalExpenses, account.currency)}
                    </p>
                  </div>

                  {account.lastReconciled && (
                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock size={11} />Last reconciled: {formatDate(toDate(account.lastReconciled))}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="pt-1">
                    <Button variant="success" size="sm" className="w-full" onClick={handleClaimReimbursement}>
                      <DollarSign size={13} className="mr-1.5" />Claim Reimbursement
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeFinancialTab === 'projectTrx' && (
          <div className="space-y-4 animate-in slide-in-from-right-2 duration-300">

            {/* Summary strip — rows on mobile, 3-col on desktop */}
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden divide-y divide-slate-100 shadow-sm md:bg-transparent md:border-none md:rounded-none md:overflow-visible md:shadow-none md:divide-y-0 md:grid md:grid-cols-3 md:gap-2">
              <div className="flex justify-between items-center px-4 py-2.5 md:block md:bg-green-50 md:border md:border-green-100 md:rounded-xl md:px-3 md:py-2.5">
                <span className="text-sm text-slate-500 md:text-[10px] md:font-semibold md:text-green-600 md:uppercase md:tracking-wider md:block md:mb-0.5">Income</span>
                <span className="text-sm font-bold font-mono text-green-700 tabular-nums md:text-base">{formatCurrency(totalIncome, account.currency)}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-2.5 md:block md:bg-red-50 md:border md:border-red-100 md:rounded-xl md:px-3 md:py-2.5">
                <span className="text-sm text-slate-500 md:text-[10px] md:font-semibold md:text-red-500 md:uppercase md:tracking-wider md:block md:mb-0.5">Expenses</span>
                <span className="text-sm font-bold font-mono text-red-600 tabular-nums md:text-base">{formatCurrency(totalExpenses, account.currency)}</span>
              </div>
              <div className={`flex justify-between items-center px-4 py-2.5 md:block md:border md:rounded-xl md:px-3 md:py-2.5 ${(totalIncome - totalExpenses) >= 0 ? 'md:bg-slate-50 md:border-slate-200' : 'md:bg-rose-50 md:border-rose-100'}`}>
                <span className="text-sm text-slate-500 md:text-[10px] md:font-semibold md:text-slate-500 md:uppercase md:tracking-wider md:block md:mb-0.5">Net</span>
                <span className={`text-sm font-bold font-mono tabular-nums md:text-base ${(totalIncome - totalExpenses) >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>{formatCurrency(totalIncome - totalExpenses, account.currency)}</span>
              </div>
            </div>

            {/* Type toggle + Add button */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex bg-slate-100 p-1 rounded-lg gap-1 shrink-0">
                <button type="button"
                  onClick={() => { setActiveTrxType('Income'); setSelectedProjectTxIds([]); }}
                  className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-all ${activeTrxType === 'Income' ? 'bg-white text-green-700 shadow-sm border border-green-200' : 'text-slate-500 hover:text-slate-800'}`}>
                  Income <span className="ml-1 text-xs font-mono opacity-70">{transactions.filter(t => t.type === 'Income').length}</span>
                </button>
                <button type="button"
                  onClick={() => { setActiveTrxType('Expense'); setSelectedProjectTxIds([]); }}
                  className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-all ${activeTrxType === 'Expense' ? 'bg-white text-red-600 shadow-sm border border-red-200' : 'text-slate-500 hover:text-slate-800'}`}>
                  Expenses <span className="ml-1 text-xs font-mono opacity-70">{transactions.filter(t => t.type === 'Expense').length}</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Combobox
                  className="w-36 hidden sm:block"
                  placeholder="Purpose..."
                  options={uniquePurposes}
                  value={activeTrxType === 'Income' ? incomePurposeValue : expensePurposeValue}
                  onChange={activeTrxType === 'Income' ? setIncomePurposeValue : setExpensePurposeValue}
                />
                <Button size="sm" variant="ghost" className="text-jci-blue hover:bg-jci-blue/10"
                  onClick={() => activeTrxType === 'Income' ? startInlineAdd('Income', incomePurposeValue) : startInlineAdd('Expense', expensePurposeValue)}>
                  <Plus size={15} className="mr-1" /> Add
                </Button>
              </div>
            </div>

            {loadingTransactions && (
              <div className="flex justify-center py-8">
                <RefreshCw className="animate-spin text-jci-blue" size={28} />
              </div>
            )}

            {/* Desktop table */}
            {!loadingTransactions && (
              <Card className="hidden md:block overflow-hidden border-none shadow-sm" noPadding>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm"
                    onPaste={(e) => handleTablePaste(e, activeTrxType, activeTrxType === 'Income' ? incomePurposeValue : expensePurposeValue)}>
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="py-2.5 px-3 w-[36px]">
                          <Checkbox
                            checked={transactions.filter(t => t.type === activeTrxType).length > 0 && transactions.filter(t => t.type === activeTrxType).every(t => selectedProjectTxIds.includes(t.id))}
                            onChange={(e) => {
                              const ids = transactions.filter(t => t.type === activeTrxType).map(t => t.id);
                              if (e.target.checked) setSelectedProjectTxIds([...new Set([...selectedProjectTxIds, ...ids])]);
                              else setSelectedProjectTxIds(selectedProjectTxIds.filter(id => !ids.includes(id)));
                            }}
                          />
                        </th>
                        <th className="py-2.5 px-2 text-xs font-semibold w-[32%]">Item / Category</th>
                        <th className="py-2.5 px-2 text-xs font-semibold w-[18%]">Ref No.</th>
                        <th className="py-2.5 px-2 text-xs font-semibold w-[18%]">Account</th>
                        <th className="py-2.5 px-2 text-xs font-semibold text-right w-[12%]">Amount</th>
                        <th className="py-2.5 px-2 text-xs font-semibold w-[10%]">Date</th>
                        <th className="py-2.5 px-2 text-xs font-semibold w-[12%]">Reconciled</th>
                        <th className="py-2.5 px-2 w-[44px]"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {/* Inline add row */}
                      {((activeTrxType === 'Income' && isAddingIncome) || (activeTrxType === 'Expense' && isAddingExpense)) && (
                        <tr className={activeTrxType === 'Income' ? 'bg-green-50/40' : 'bg-red-50/30'}>
                          <td className="py-2 px-3 w-[36px]"></td>
                          <td className="py-2 px-2">
                            <Input className="h-8 text-xs" value={addForm.description || ''} onChange={(e) => setAddForm({ ...addForm, description: e.target.value })} placeholder="Description" />
                          </td>
                          <td className="py-2 px-2">
                            <Input className="h-8 text-xs" value={addForm.referenceNumber || ''} onChange={(e) => setAddForm({ ...addForm, referenceNumber: e.target.value })} placeholder="Ref No." />
                          </td>
                          <td className="py-2 px-2">
                            <Select className="h-8 text-xs" value={addForm.bankAccountId || ''} onChange={(e) => setAddForm({ ...addForm, bankAccountId: e.target.value })}
                              options={[{ label: 'None', value: '' }, ...bankAccounts.map(acc => ({ label: acc.name, value: acc.id }))]} />
                          </td>
                          <td className="py-2 px-2">
                            <Input className={`h-8 text-xs font-mono text-right ${activeTrxType === 'Expense' ? 'text-red-600' : ''}`} type="number" step="0.01" value={addForm.amount || ''} onChange={(e) => setAddForm({ ...addForm, amount: parseFloat(e.target.value) })} placeholder="0.00" />
                          </td>
                          <td className="py-2 px-2">
                            <Input className="h-8 text-xs" type="date" value={addForm.date || ''} onChange={(e) => setAddForm({ ...addForm, date: e.target.value })} />
                          </td>
                          <td className="py-2 px-2"><Badge variant="warning">Pending</Badge></td>
                          <td className="py-2 px-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => handleInlineSave('', true)} className="p-1 text-green-600 hover:bg-green-100 rounded"><Check size={15} /></button>
                              <button onClick={() => handleInlineCancel(true)} className="p-1 text-red-500 hover:bg-red-100 rounded"><X size={15} /></button>
                            </div>
                          </td>
                        </tr>
                      )}
                      {/* Grouped rows */}
                      {(() => {
                        const grouped = transactions
                          .filter(t => t.type === activeTrxType)
                          .reduce((g, t) => { const k = t.purpose || 'Uncategorized'; (g[k] = g[k] || []).push(t); return g; }, {} as Record<string, Transaction[]>);
                        const entries = Object.entries(grouped);
                        const isAdding = activeTrxType === 'Income' ? isAddingIncome : isAddingExpense;
                        if (entries.length === 0 && !isAdding) return (
                          <tr><td colSpan={8} className="py-10 text-center text-slate-400">
                            <Layout size={28} className="mx-auto mb-2 opacity-20" />
                            <p className="text-sm">No {activeTrxType.toLowerCase()} entries yet</p>
                            <p className="text-xs mt-0.5 opacity-70">Paste cells from Excel or click Add</p>
                          </td></tr>
                        );
                        const accentColor = activeTrxType === 'Income' ? 'text-green-600' : 'text-red-600';
                        const groupBg = activeTrxType === 'Income' ? 'bg-green-50/60' : 'bg-red-50/40';
                        return entries.map(([purpose, grpTxs]) => (
                          <React.Fragment key={purpose}>
                            <tr>
                              <td colSpan={4} className={`py-1.5 px-3 text-xs font-bold text-slate-600 ${groupBg}`}>{purpose} <span className="font-normal opacity-60">({grpTxs.length})</span></td>
                              <td className={`py-1.5 px-2 text-right text-xs font-bold font-mono ${accentColor} ${groupBg}`}>
                                {formatCurrency(grpTxs.reduce((s, t) => s + Math.abs(t.amount), 0), account.currency)}
                              </td>
                              <td colSpan={3} className={groupBg}></td>
                            </tr>
                            {grpTxs.map(tx => {
                              const linkedAmount = bankTransactions.reduce((sum, btx) => {
                                const ids = (btx as any).projectTransactionIds || ((btx as any).projectTransactionId ? [(btx as any).projectTransactionId] : []);
                                return ids.includes(tx.id) ? sum + Math.abs(btx.amount) : sum;
                              }, 0);
                              const badgeVariant: any = linkedAmount <= 0 ? 'neutral' : Math.abs(linkedAmount - Math.abs(tx.amount)) < 0.01 ? 'success' : linkedAmount > Math.abs(tx.amount) + 0.01 ? 'error' : 'warning';
                              return (
                                <tr key={tx.id} className="hover:bg-slate-50/70 group transition-colors">
                                  {editingId === tx.id ? (
                                    <>
                                      <td className="py-2 px-3"></td>
                                      <td className="py-2 px-2">
                                        <div className="flex flex-col gap-1">
                                          <Combobox className="w-full" placeholder="Purpose" options={uniquePurposes} value={editForm.purpose || ''} onChange={(val) => setEditForm({ ...editForm, purpose: val })} />
                                          <Input className="h-8 text-xs" value={editForm.description || ''} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="Description" />
                                        </div>
                                      </td>
                                      <td className="py-2 px-2"><Input className="h-8 text-xs" value={editForm.referenceNumber || ''} onChange={(e) => setEditForm({ ...editForm, referenceNumber: e.target.value })} /></td>
                                      <td className="py-2 px-2">
                                        <Select className="h-8 text-xs" value={editForm.bankAccountId || ''} onChange={(e) => setEditForm({ ...editForm, bankAccountId: e.target.value })}
                                          options={[{ label: 'None', value: '' }, ...bankAccounts.map(acc => ({ label: acc.name, value: acc.id }))]} />
                                      </td>
                                      <td className="py-2 px-2"><Input className={`h-8 text-xs text-right font-mono ${activeTrxType === 'Expense' ? 'text-red-600' : ''}`} type="number" step="0.01" value={editForm.amount || ''} onChange={(e) => setEditForm({ ...editForm, amount: parseFloat(e.target.value) })} /></td>
                                      <td className="py-2 px-2"><Input className="h-8 text-xs" type="date" value={editForm.date ? editForm.date.split('T')[0] : ''} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} /></td>
                                      <td className="py-2 px-2 text-center text-slate-300">—</td>
                                      <td className="py-2 px-2 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                          <button onClick={() => handleInlineSave(tx.id)} className="p-1 text-green-600 hover:bg-green-100 rounded"><Check size={15} /></button>
                                          <button onClick={() => handleInlineCancel()} className="p-1 text-red-500 hover:bg-red-100 rounded"><X size={15} /></button>
                                        </div>
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      <td className="py-1.5 px-3">
                                        <Checkbox checked={selectedProjectTxIds.includes(tx.id)} onChange={(e) => {
                                          if (e.target.checked) setSelectedProjectTxIds([...selectedProjectTxIds, tx.id]);
                                          else setSelectedProjectTxIds(selectedProjectTxIds.filter(id => id !== tx.id));
                                        }} />
                                      </td>
                                      <td className="py-1.5 px-2 text-slate-800 text-sm">{tx.description || '—'}</td>
                                      <td className="py-1.5 px-2 text-slate-400 text-xs font-mono">{tx.referenceNumber || '—'}</td>
                                      <td className="py-1.5 px-2 text-slate-500 text-xs truncate max-w-[140px]">{bankAccounts.find(a => a.id === tx.bankAccountId)?.name || '—'}</td>
                                      <td className={`py-1.5 px-2 text-right font-mono font-semibold text-sm ${accentColor}`}>{formatCurrency(Math.abs(tx.amount), account.currency)}</td>
                                      <td className="py-1.5 px-2 text-slate-400 text-xs whitespace-nowrap">{new Date(tx.date).toLocaleDateString()}</td>
                                      <td className="py-1.5 px-2">
                                        <Badge variant={badgeVariant}>{formatCurrency(linkedAmount, account.currency)} / {formatCurrency(Math.abs(tx.amount), account.currency)}</Badge>
                                      </td>
                                      <td className="py-1.5 px-2 text-right">
                                        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button onClick={() => startInlineEdit(tx)} className="text-slate-400 hover:text-jci-blue p-1 rounded transition-colors"><Edit size={13} /></button>
                                          <button onClick={() => handleDeleteTransaction(tx.id)} className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors"><Trash2 size={13} /></button>
                                        </div>
                                      </td>
                                    </>
                                  )}
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Mobile card list */}
            {!loadingTransactions && (
              <div className="md:hidden space-y-1">
                {/* Mobile purpose combobox */}
                <div className="flex items-center gap-2 mb-3">
                  <Combobox
                    className="flex-1"
                    placeholder="Set purpose for new entry..."
                    options={uniquePurposes}
                    value={activeTrxType === 'Income' ? incomePurposeValue : expensePurposeValue}
                    onChange={activeTrxType === 'Income' ? setIncomePurposeValue : setExpensePurposeValue}
                  />
                </div>
                {transactions.filter(t => t.type === activeTrxType).length === 0 ? (
                  <div className="py-10 text-center text-slate-400">
                    <Layout size={28} className="mx-auto mb-2 opacity-20" />
                    <p className="text-sm">No {activeTrxType.toLowerCase()} entries yet</p>
                    <p className="text-xs mt-0.5 opacity-70">Tap Add to create one</p>
                  </div>
                ) : (
                  transactions.filter(t => t.type === activeTrxType).map(tx => {
                    const linkedAmount = bankTransactions.reduce((sum, btx) => {
                      const ids = (btx as any).projectTransactionIds || ((btx as any).projectTransactionId ? [(btx as any).projectTransactionId] : []);
                      return ids.includes(tx.id) ? sum + Math.abs(btx.amount) : sum;
                    }, 0);
                    const badgeVariant: any = linkedAmount <= 0 ? 'neutral' : Math.abs(linkedAmount - Math.abs(tx.amount)) < 0.01 ? 'success' : linkedAmount > Math.abs(tx.amount) + 0.01 ? 'error' : 'warning';
                    const isIncome = activeTrxType === 'Income';
                    const isSelected = selectedProjectTxIds.includes(tx.id);
                    return (
                      <div key={tx.id}
                        className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${isSelected ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100'}`}
                        onClick={() => {
                          if (isSelected) setSelectedProjectTxIds(selectedProjectTxIds.filter(id => id !== tx.id));
                          else setSelectedProjectTxIds([...selectedProjectTxIds, tx.id]);
                        }}>
                        <Checkbox checked={isSelected} onChange={() => {}} className="mt-0.5 shrink-0 pointer-events-none" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-800 truncate">{tx.description || '—'}</p>
                            <span className={`text-sm font-bold font-mono shrink-0 ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                              {isIncome ? '+' : '-'}{formatCurrency(Math.abs(tx.amount), account.currency)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {tx.purpose && <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{tx.purpose}</span>}
                            <span className="text-[11px] text-slate-400">{new Date(tx.date).toLocaleDateString()}</span>
                            {tx.referenceNumber && <span className="text-[11px] font-mono text-slate-400">{tx.referenceNumber}</span>}
                            <Badge variant={badgeVariant}>{formatCurrency(linkedAmount, account.currency)}/{formatCurrency(Math.abs(tx.amount), account.currency)}</Badge>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <button onClick={(e) => { e.stopPropagation(); startInlineEdit(tx); }} className="p-1.5 text-slate-400 hover:text-jci-blue hover:bg-slate-100 rounded-lg transition-colors"><Edit size={14} /></button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteTransaction(tx.id); }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Batch toolbar — sticky bottom */}
            {selectedProjectTxIds.length > 0 && (
              <div className="sticky bottom-2 z-20 mx-1">
                <div className="bg-slate-900 text-white rounded-2xl px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl">
                  <span className="text-sm font-semibold shrink-0">{selectedProjectTxIds.length} selected</span>
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <div className="flex items-center gap-1.5 bg-slate-800 rounded-xl px-2 py-1 flex-1 sm:flex-none">
                      <Combobox
                        placeholder="Set purpose..."
                        options={uniquePurposes}
                        value={batchProjectPurposeValue}
                        onChange={setBatchProjectPurposeValue}
                        className="w-44 border-none bg-transparent text-white placeholder-slate-400 text-sm"
                      />
                      <Button onClick={handleBatchSetProjectTxPurpose} disabled={!batchProjectPurposeValue.trim() || loadingTransactions} size="sm" className="shrink-0 bg-jci-blue hover:bg-jci-blue/90 border-none text-white">
                        Apply
                      </Button>
                    </div>
                    <Button variant="danger" size="sm" onClick={handleBatchDeleteProjectTransactions} disabled={loadingTransactions} className="shrink-0">
                      <Trash2 size={14} className="mr-1.5" /> Delete
                    </Button>
                    <button onClick={() => setSelectedProjectTxIds([])} className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors shrink-0">
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeFinancialTab === 'bankTrx' && (
          <div className="space-y-4 animate-in slide-in-from-right-2 duration-300">
            {(() => {
              const filteredBankTx = bankTransactions.filter(tx => {
                if (!bankTxSearchQuery) return true;
                const q = bankTxSearchQuery.toLowerCase().trim();
                const isNumericStr = q !== '' && !isNaN(Number(q));
                return (isNumericStr && tx.amount === Number(q)) ||
                  tx.description?.toLowerCase().includes(q) ||
                  tx.referenceNumber?.toLowerCase().includes(q);
              });
              const bankIncomes = filteredBankTx.filter(tx => tx.type === 'Income');
              const bankExpenses = filteredBankTx.filter(tx => tx.type === 'Expense');
              const bankIncomeTotal = bankIncomes.reduce((sum, tx) => sum + tx.amount, 0);
              const bankExpensesTotal = bankExpenses.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
              const activeList = activeBankTrxType === 'Income' ? bankIncomes : bankExpenses;
              const isIncome = activeBankTrxType === 'Income';
              const accentColor = isIncome ? 'text-green-600' : 'text-red-600';
              const groupBg = isIncome ? 'bg-green-50/60' : 'bg-red-50/40';

              const getAvailableProjectTxOptions = (currentBankTx: any) => {
                const currentLinkedIds = currentBankTx.projectTransactionIds || (currentBankTx.projectTransactionId ? [currentBankTx.projectTransactionId] : []);
                const opts = (transactions || []).filter(t => {
                  if (t.type !== currentBankTx.type) return false;
                  if (currentLinkedIds.includes(t.id)) return true;
                  const totalLinked = bankTransactions.reduce((sum, btx) => {
                    const ids = (btx as any).projectTransactionIds || ((btx as any).projectTransactionId ? [(btx as any).projectTransactionId] : []);
                    return ids.includes(t.id) ? sum + Math.abs(btx.amount) : sum;
                  }, 0);
                  return totalLinked < Math.abs(t.amount) - 0.01;
                }).map(t => ({
                  label: `${t.description || t.purpose || 'Txn'}${t.referenceNumber ? ` (${t.referenceNumber})` : ''} · ${formatCurrency(t.amount, account.currency)}`,
                  value: t.id
                }));
                opts.sort((a, b) => {
                  const aS = currentLinkedIds.includes(a.value), bS = currentLinkedIds.includes(b.value);
                  return aS === bS ? a.label.localeCompare(b.label) : aS ? -1 : 1;
                });
                return opts;
              };

              const batchLinkOptions = (() => {
                const selectedTxTypes = selectedBankTxIds.map(id => bankTransactions.find(bt => bt.id === id)?.type).filter(Boolean);
                const targetType = selectedTxTypes[0];
                const opts = (transactions || []).filter(t => {
                  if (targetType && t.type !== targetType) return false;
                  const totalLinked = bankTransactions.reduce((sum, btx) => {
                    const ids = (btx as any).projectTransactionIds || ((btx as any).projectTransactionId ? [(btx as any).projectTransactionId] : []);
                    return ids.includes(t.id) ? sum + Math.abs(btx.amount) : sum;
                  }, 0);
                  return totalLinked < Math.abs(t.amount) - 0.01 || batchProjectTxIds.includes(t.id);
                }).map(t => ({
                  label: `${t.description || t.purpose || 'Txn'}${t.referenceNumber ? ` (${t.referenceNumber})` : ''} · ${formatCurrency(t.amount, account.currency)}`,
                  value: t.id
                }));
                opts.sort((a, b) => {
                  const aS = batchProjectTxIds.includes(a.value), bS = batchProjectTxIds.includes(b.value);
                  return aS === bS ? a.label.localeCompare(b.label) : aS ? -1 : 1;
                });
                return opts;
              })();

              const grouped = activeList.reduce((g, tx) => {
                const linkedIds = (tx as any).projectTransactionIds || ((tx as any).projectTransactionId ? [(tx as any).projectTransactionId] : []);
                const matchedTx = transactions.find(t => linkedIds.includes(t.id));
                const purpose = tx.purpose || matchedTx?.purpose || 'Unmatched / Uncategorized';
                (g[purpose] = g[purpose] || []).push(tx);
                return g;
              }, {} as Record<string, Transaction[]>);

              return (
                <>
                  {/* Summary strip — rows on mobile, 3-col on desktop */}
                  <div className="bg-white rounded-xl border border-slate-100 overflow-hidden divide-y divide-slate-100 shadow-sm md:bg-transparent md:border-none md:rounded-none md:overflow-visible md:shadow-none md:divide-y-0 md:grid md:grid-cols-3 md:gap-2">
                    <div className="flex justify-between items-center px-4 py-2.5 md:block md:bg-green-50 md:border md:border-green-100 md:rounded-xl md:px-3 md:py-2.5">
                      <span className="text-sm text-slate-500 md:text-[10px] md:font-semibold md:text-green-600 md:uppercase md:tracking-wider md:block md:mb-0.5">Bank Income</span>
                      <span className="text-sm font-bold font-mono text-green-700 tabular-nums md:text-base">{formatCurrency(bankIncomeTotal, account.currency)}</span>
                    </div>
                    <div className="flex justify-between items-center px-4 py-2.5 md:block md:bg-red-50 md:border md:border-red-100 md:rounded-xl md:px-3 md:py-2.5">
                      <span className="text-sm text-slate-500 md:text-[10px] md:font-semibold md:text-red-500 md:uppercase md:tracking-wider md:block md:mb-0.5">Bank Expenses</span>
                      <span className="text-sm font-bold font-mono text-red-600 tabular-nums md:text-base">{formatCurrency(bankExpensesTotal, account.currency)}</span>
                    </div>
                    <div className={`flex justify-between items-center px-4 py-2.5 md:block md:border md:rounded-xl md:px-3 md:py-2.5 ${(bankIncomeTotal - bankExpensesTotal) >= 0 ? 'md:bg-slate-50 md:border-slate-200' : 'md:bg-rose-50 md:border-rose-100'}`}>
                      <span className="text-sm text-slate-500 md:text-[10px] md:font-semibold md:text-slate-500 md:uppercase md:tracking-wider md:block md:mb-0.5">Net</span>
                      <span className={`text-sm font-bold font-mono tabular-nums md:text-base ${(bankIncomeTotal - bankExpensesTotal) >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>{formatCurrency(bankIncomeTotal - bankExpensesTotal, account.currency)}</span>
                    </div>
                  </div>

                  {/* Toggle row */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex bg-slate-100 p-1 rounded-lg gap-1 shrink-0">
                      <button type="button"
                        onClick={() => { setActiveBankTrxType('Income'); setSelectedBankTxIds([]); }}
                        className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-all ${activeBankTrxType === 'Income' ? 'bg-white text-green-700 shadow-sm border border-green-200' : 'text-slate-500 hover:text-slate-800'}`}>
                        Income <span className="ml-1 text-xs font-mono opacity-70">{bankIncomes.length}</span>
                      </button>
                      <button type="button"
                        onClick={() => { setActiveBankTrxType('Expense'); setSelectedBankTxIds([]); }}
                        className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-all ${activeBankTrxType === 'Expense' ? 'bg-white text-red-600 shadow-sm border border-red-200' : 'text-slate-500 hover:text-slate-800'}`}>
                        Expenses <span className="ml-1 text-xs font-mono opacity-70">{bankExpenses.length}</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <div className="relative max-w-xs w-full">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <Input placeholder="Search..." value={bankTxSearchQuery} onChange={(e) => setBankTxSearchQuery(e.target.value)} className="pl-8 h-9 text-sm" />
                      </div>
                      <Button onClick={handleAutoMatch} variant="outline" size="sm" className="shrink-0 text-jci-blue border-jci-blue hover:bg-jci-blue hover:text-white">
                        <BrainCircuit size={14} className="mr-1.5" /> Auto Match
                      </Button>
                    </div>
                  </div>

                  {loadingBankTransactions ? (
                    <div className="flex justify-center py-8">
                      <RefreshCw className="animate-spin text-jci-blue" size={28} />
                    </div>
                  ) : bankTransactions.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                      <Layout size={28} className="mx-auto mb-2 opacity-20" />
                      <p className="text-sm">No bank transactions linked to this project</p>
                    </div>
                  ) : (
                    <>
                      {/* Desktop table */}
                      <Card className="hidden md:block overflow-hidden border-none shadow-sm" noPadding>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500">
                              <tr>
                                <th className="py-2.5 px-3 w-[36px]">
                                  <Checkbox
                                    checked={activeList.length > 0 && activeList.every(tx => selectedBankTxIds.includes(tx.id))}
                                    onChange={(e) => {
                                      const ids = activeList.map(tx => tx.id);
                                      if (e.target.checked) setSelectedBankTxIds([...new Set([...selectedBankTxIds, ...ids])]);
                                      else setSelectedBankTxIds(selectedBankTxIds.filter(id => !ids.includes(id)));
                                    }}
                                  />
                                </th>
                                <th className="py-2.5 px-2 text-xs font-semibold w-[10%]">Date</th>
                                <th className="py-2.5 px-2 text-xs font-semibold w-[22%]">Description</th>
                                <th className="py-2.5 px-2 text-xs font-semibold w-[10%]">Ref</th>
                                <th className="py-2.5 px-2 text-xs font-semibold w-[30%]">Link to Project Trx</th>
                                <th className="py-2.5 px-2 text-xs font-semibold text-right w-[12%]">Amount</th>
                                <th className="py-2.5 px-2 text-xs font-semibold w-[10%]">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {activeList.length === 0 ? (
                                <tr><td colSpan={7} className="py-10 text-center text-slate-400">
                                  <p className="text-sm">No {activeBankTrxType.toLowerCase()} bank transactions</p>
                                </td></tr>
                              ) : Object.entries(grouped).map(([purpose, grpTxs]) => (
                                <React.Fragment key={purpose}>
                                  <tr>
                                    <td colSpan={4} className={`py-1.5 px-3 text-xs font-bold text-slate-600 ${groupBg}`}>{purpose} <span className="font-normal opacity-60">({grpTxs.length})</span></td>
                                    <td className={groupBg}></td>
                                    <td className={`py-1.5 px-2 text-right text-xs font-bold font-mono ${accentColor} ${groupBg}`}>
                                      {formatCurrency(grpTxs.reduce((s, t) => s + Math.abs(t.amount), 0), account.currency)}
                                    </td>
                                    <td className={groupBg}></td>
                                  </tr>
                                  {grpTxs.map(tx => {
                                    const linkedIds = (tx as any).projectTransactionIds || ((tx as any).projectTransactionId ? [(tx as any).projectTransactionId] : []);
                                    const tempSelected = tempSelectedProjectTxIds[tx.id];
                                    const hasChanged = tempSelected !== undefined && JSON.stringify(tempSelected.slice().sort()) !== JSON.stringify(linkedIds.slice().sort());
                                    const selectedValue = tempSelected !== undefined ? tempSelected : linkedIds;
                                    return (
                                      <tr key={tx.id} className="hover:bg-slate-50/70 group transition-colors">
                                        <td className="py-1.5 px-3">
                                          <Checkbox checked={selectedBankTxIds.includes(tx.id)} onChange={(e) => {
                                            if (e.target.checked) setSelectedBankTxIds([...selectedBankTxIds, tx.id]);
                                            else setSelectedBankTxIds(selectedBankTxIds.filter(id => id !== tx.id));
                                          }} />
                                        </td>
                                        <td className="py-1.5 px-2 text-slate-400 text-xs font-mono whitespace-nowrap">{new Date(tx.date).toLocaleDateString()}</td>
                                        <td className="py-1.5 px-2 text-slate-800 text-sm">{tx.description}</td>
                                        <td className="py-1.5 px-2 text-slate-400 text-xs font-mono">{tx.referenceNumber || '—'}</td>
                                        <td className="py-1.5 px-2">
                                          <div className="flex items-center gap-1.5">
                                            <div className="flex-1 min-w-0">
                                              <MultiSelectDropdown
                                                selected={selectedValue}
                                                onChange={(ids) => setTempSelectedProjectTxIds(prev => ({ ...prev, [tx.id]: ids }))}
                                                options={getAvailableProjectTxOptions(tx)}
                                                placeholder="Link..."
                                              />
                                            </div>
                                            {hasChanged && (
                                              <div className="flex gap-1 shrink-0">
                                                <button onClick={() => handleLinkBankTransaction(tx.id, selectedValue)} className="p-1 text-green-600 border border-green-200 hover:bg-green-50 rounded shadow-sm"><Check size={14} /></button>
                                                <button onClick={() => setTempSelectedProjectTxIds(prev => { const c = { ...prev }; delete c[tx.id]; return c; })} className="p-1 text-red-500 border border-red-200 hover:bg-red-50 rounded shadow-sm"><X size={14} /></button>
                                              </div>
                                            )}
                                          </div>
                                        </td>
                                        <td className={`py-1.5 px-2 text-right font-mono font-semibold text-sm ${accentColor}`}>
                                          {isIncome ? '+' : '-'}{formatCurrency(Math.abs(tx.amount), account.currency)}
                                        </td>
                                        <td className="py-1.5 px-2">
                                          <Badge variant={linkedIds.length > 0 ? 'success' : 'warning'}>
                                            {linkedIds.length > 0 ? 'Reconciled' : 'Unreconciled'}
                                          </Badge>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </React.Fragment>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Card>

                      {/* Mobile card list */}
                      <div className="md:hidden space-y-1.5">
                        {activeList.length === 0 ? (
                          <div className="py-10 text-center text-slate-400">
                            <p className="text-sm">No {activeBankTrxType.toLowerCase()} bank transactions</p>
                          </div>
                        ) : activeList.map(tx => {
                          const linkedIds = (tx as any).projectTransactionIds || ((tx as any).projectTransactionId ? [(tx as any).projectTransactionId] : []);
                          const tempSelected = tempSelectedProjectTxIds[tx.id];
                          const hasChanged = tempSelected !== undefined && JSON.stringify(tempSelected.slice().sort()) !== JSON.stringify(linkedIds.slice().sort());
                          const selectedValue = tempSelected !== undefined ? tempSelected : linkedIds;
                          const isSelected = selectedBankTxIds.includes(tx.id);
                          return (
                            <div key={tx.id}
                              className={`rounded-xl border p-3 transition-all ${isSelected ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100'}`}
                              onClick={() => {
                                if (isSelected) setSelectedBankTxIds(selectedBankTxIds.filter(id => id !== tx.id));
                                else setSelectedBankTxIds([...selectedBankTxIds, tx.id]);
                              }}>
                              <div className="flex items-start gap-3">
                                <Checkbox checked={isSelected} onChange={() => {}} className="mt-0.5 shrink-0 pointer-events-none" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-semibold text-slate-800 truncate">{tx.description}</p>
                                    <span className={`text-sm font-bold font-mono shrink-0 ${accentColor}`}>
                                      {isIncome ? '+' : '-'}{formatCurrency(Math.abs(tx.amount), account.currency)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    <span className="text-[11px] text-slate-400">{new Date(tx.date).toLocaleDateString()}</span>
                                    {tx.referenceNumber && <span className="text-[11px] font-mono text-slate-400">{tx.referenceNumber}</span>}
                                    <Badge variant={linkedIds.length > 0 ? 'success' : 'warning'}>
                                      {linkedIds.length > 0 ? 'Reconciled' : 'Unreconciled'}
                                    </Badge>
                                  </div>
                                  {/* Link row */}
                                  <div className="mt-2 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                    <div className="flex-1 min-w-0">
                                      <MultiSelectDropdown
                                        selected={selectedValue}
                                        onChange={(ids) => setTempSelectedProjectTxIds(prev => ({ ...prev, [tx.id]: ids }))}
                                        options={getAvailableProjectTxOptions(tx)}
                                        placeholder="Link to project trx..."
                                      />
                                    </div>
                                    {hasChanged && (
                                      <div className="flex gap-1 shrink-0">
                                        <button onClick={() => handleLinkBankTransaction(tx.id, selectedValue)} className="p-1.5 text-green-600 border border-green-200 hover:bg-green-50 rounded-lg shadow-sm"><Check size={14} /></button>
                                        <button onClick={() => setTempSelectedProjectTxIds(prev => { const c = { ...prev }; delete c[tx.id]; return c; })} className="p-1.5 text-red-500 border border-red-200 hover:bg-red-50 rounded-lg shadow-sm"><X size={14} /></button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Batch toolbar — sticky bottom */}
                      {selectedBankTxIds.length > 0 && (
                        <div className="sticky bottom-2 z-20 mx-1">
                          <div className="bg-slate-900 text-white rounded-2xl px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl">
                            <span className="text-sm font-semibold shrink-0">{selectedBankTxIds.length} selected</span>
                            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                              {isMixedBankTxSelected ? (
                                <span className="text-xs text-rose-300 bg-rose-900/40 px-2.5 py-1.5 rounded-lg border border-rose-700/50 font-medium">
                                  Cannot link mixed Income & Expense
                                </span>
                              ) : (
                                <div className="flex items-center gap-1.5 bg-slate-800 rounded-xl px-2 py-1 flex-1 sm:flex-none">
                                  <MultiSelectDropdown
                                    selected={batchProjectTxIds}
                                    onChange={setBatchProjectTxIds}
                                    options={batchLinkOptions}
                                    placeholder="Link to project trx..."
                                    className="w-52 border-none bg-transparent text-white text-sm"
                                  />
                                  <Button onClick={handleBatchLinkBankTransactions} disabled={batchProjectTxIds.length === 0} size="sm" className="shrink-0 bg-jci-blue hover:bg-jci-blue/90 border-none text-white">
                                    Apply
                                  </Button>
                                </div>
                              )}
                              {bankTransactions.some(t => selectedBankTxIds.includes(t.id) && ((t as any).projectTransactionIds?.length > 0 || (t as any).projectTransactionId)) && (
                                <Button onClick={handleBatchUnlinkBankTransactions} variant="outline" size="sm" className="shrink-0 text-rose-300 border-rose-700/50 hover:bg-rose-900/40">
                                  Unlink
                                </Button>
                              )}
                              <button onClick={() => setSelectedBankTxIds([])} className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors shrink-0">
                                <X size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Claim Reimbursement — reuse full Submit Payment Request modal */}
      <SubmitPaymentRequestModal
        isOpen={isClaimDrawerOpen}
        onClose={() => setIsClaimDrawerOpen(false)}
        preselectedProjectId={projectId}
        preselectedCategory="projects_activities"
        onSuccess={() => showToast('Reimbursement claim submitted', 'success')}
      />
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
  const { showToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editStep, setEditStep] = useState<1 | 2>(1);
  const [formType, setFormType] = useState<string>(project.type || '');
  const [isSaving, setIsSaving] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState<string[]>([]);
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [editRoadmapUrl, setEditRoadmapUrl] = useState(project.roadmapUrl || '');
  const [editLogoUrl, setEditLogoUrl] = useState(project.logoUrl || '');
  const [isFetchingPoster, setIsFetchingPoster] = useState(false);

  // States for Edit Project Form
  const [editTitle, setEditTitle] = useState(project.title ?? project.name ?? '');
  const [editDescription, setEditDescription] = useState(project.description || '');
  const [editLevel, setEditLevel] = useState<ProjectLevel | ''>(project.level || '');
  const [editPillar, setEditPillar] = useState<ProjectPillar | ''>(project.pillar || '');
  const [editCategory, setEditCategory] = useState(project.category || '');
  const [editProposedDate, setEditProposedDate] = useState(project.proposedDate || '');
  const [editEventStartDate, setEditEventStartDate] = useState(project.eventStartDate || '');
  const [editEventEndDate, setEditEventEndDate] = useState(project.eventEndDate || '');
  const [editEventStartTime, setEditEventStartTime] = useState(project.eventStartTime || '');
  const [editEventEndTime, setEditEventEndTime] = useState(project.eventEndTime || '');
  const [editPriceMin, setEditPriceMin] = useState(project.priceMin != null ? String(project.priceMin) : '');
  const [editPriceMax, setEditPriceMax] = useState(project.priceMax != null ? String(project.priceMax) : '');
  const [descExpanded, setDescExpanded] = useState(false);

  useEffect(() => {
    setEditRoadmapUrl(project.roadmapUrl || '');
    setEditLogoUrl(project.logoUrl || '');
    setEditTitle(project.title ?? project.name ?? '');
    setEditDescription(project.description || '');
    setEditLevel(project.level || '');
    setEditPillar(project.pillar || '');
    setFormType(project.type || '');
    setEditCategory(project.category || '');
    setEditProposedDate(project.proposedDate || '');
    setEditEventStartDate(project.eventStartDate || '');
    setEditEventEndDate(project.eventEndDate || '');
    setEditEventStartTime(project.eventStartTime || '');
    setEditEventEndTime(project.eventEndTime || '');
    setEditPriceMin(project.priceMin != null ? String(project.priceMin) : '');
    setEditPriceMax(project.priceMax != null ? String(project.priceMax) : '');
    // Reset edit mode when project changes so stepper always starts at step 1
    setIsEditing(false);
    setEditStep(1);
  }, [project.id]);

  const handleFetchPosterForEdit = async () => {
    if (!editRoadmapUrl) {
      showToast('Please enter a Roadmap Event URL or ID', 'warning');
      return;
    }
    setIsFetchingPoster(true);
    try {
      const details = await fetchRoadmapEventDetails(editRoadmapUrl);
      setEditLogoUrl(details.logoUrl);
      if (details.title) setEditTitle(details.title);
      if (details.description) setEditDescription(details.description);
      if (details.level) setEditLevel(details.level);
      if (details.pillar) setEditPillar(details.pillar);
      if (details.type) {
        setFormType(details.type);
      }
      if (details.category) setEditCategory(details.category);
      if (details.eventStartDate) {
        setEditEventStartDate(details.eventStartDate);
        setEditProposedDate(details.eventStartDate);
      }
      if (details.eventEndDate) setEditEventEndDate(details.eventEndDate);
      if (details.eventStartTime) setEditEventStartTime(details.eventStartTime);
      if (details.eventEndTime) setEditEventEndTime(details.eventEndTime);
      if (details.priceMin != null) setEditPriceMin(String(details.priceMin));
      if (details.priceMax != null) setEditPriceMax(String(details.priceMax));

      showToast('Successfully synchronized event details!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to sync event details', 'error');
    } finally {
      setIsFetchingPoster(false);
    }
  };

  // Auto-sync when a valid JCI Roadmap URL is pasted
  useEffect(() => {
    const isJciRoadmapUrl = /jcimalaysia\.cc\/roadmap\/.*[?&]eventid=\d+/.test(editRoadmapUrl)
      || /^\d{4,6}$/.test(editRoadmapUrl.trim());
    if (isJciRoadmapUrl && !isFetchingPoster) {
      handleFetchPosterForEdit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editRoadmapUrl]);

  useEffect(() => {
    const urls = project.galleryUrls || [];
    setGalleryPhotos(urls);
    setNewPhotoUrl(urls[0] || '');
  }, [project.galleryUrls]);

  const hasPlanFields =
    project.proposedDate ||
    project.proposedBudget != null ||
    project.objectives ||
    project.eventStartDate ||
    project.eventEndDate ||
    project.logoUrl ||
    (project.galleryUrls && project.galleryUrls.length > 0);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Guard: if Enter pressed on step 1, advance instead of saving
    if (editStep === 1) {
      if (!editTitle.trim()) { showToast('Title is required', 'error'); return; }
      setEditStep(2);
      return;
    }
    setIsSaving(true);
    try {
      const formData = new FormData(e.currentTarget);
      await onSave({
        // Step 1 fields " use state because those inputs are unmounted on step 2
        title: editTitle,
        name: editTitle,
        description: editDescription || '',
        logoUrl: editLogoUrl || '',
        roadmapUrl: editRoadmapUrl || '',
        galleryUrls: galleryPhotos,
        // Step 2 fields " inputs are mounted at submit time, formData is fine
        level: (formData.get('level') as any) || undefined,
        pillar: (formData.get('pillar') as any) || undefined,
        type: (formData.get('type') as any) || undefined,
        category: (formData.get('category') as string) || undefined,
        proposedDate: editProposedDate || '',
        objectives: (formData.get('objectives') as string) || '',
        expectedImpact: (formData.get('expectedImpact') as string) || '',
        eventStartDate: editEventStartDate || undefined,
        eventEndDate: editEventEndDate || undefined,
        eventStartTime: editEventStartTime || undefined,
        eventEndTime: editEventEndTime || undefined,
        priceMin: editPriceMin !== '' ? Number(editPriceMin) : undefined,
        priceMax: editPriceMax !== '' ? Number(editPriceMax) : undefined,
      });
      setIsEditing(false);
      setEditStep(1);
    } catch (err) {
      // Error handling is done by caller via toast
    } finally {
      setIsSaving(false);
    }
  };

  // Edit form " bottom drawer (rendered alongside view/empty state)
  const STEPS: { s: 1 | 2; label: string }[] = [
    { s: 1, label: 'Basics & Media' },
    { s: 2, label: 'Classification & Schedule' },
  ];

  const editDrawer = (
    <Drawer
      isOpen={isEditing}
      onClose={() => { setIsEditing(false); setEditStep(1); }}
      title={editStep === 1 ? 'Edit Activity Plan " Basics & Media' : 'Edit Activity Plan " Classification & Schedule'}
      position="bottom"
      size="xl"
      footer={
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" type="button" onClick={() => {
              if (editStep === 1) { setIsEditing(false); setEditStep(1); }
              else setEditStep(1);
            }}>
              {editStep === 1 ? 'Cancel' : '← Back'}
            </Button>
            <button
              type="button"
              onClick={async () => { await onDelete(); setIsEditing(false); }}
              className="text-xs font-medium text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
            >
              <Trash2 size={12} className="inline mr-1" />Delete
            </button>
          </div>
          {editStep === 1 ? (
            <Button key="next" type="button" onClick={() => {
              if (!editTitle.trim()) { showToast('Title is required', 'error'); return; }
              setEditStep(2);
            }}>Next →</Button>
          ) : (
            <Button key="save" type="submit" form="plan-edit-form" disabled={isSaving}>{isSaving ? 'Saving' : 'Save Changes'}</Button>
          )}
        </div>
      }
    >
      {/* Stepper */}
      <div className="flex items-center gap-2 mb-4">
        {STEPS.map(({ s, label }, i) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${s < editStep ? 'bg-jci-blue/10 text-jci-blue' :
              s === editStep ? 'bg-jci-blue text-white shadow-sm' :
                'bg-slate-100 text-slate-400'
              }`}>
              <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 bg-white/30">
                {s < editStep ? 'âœ"' : s}
              </span>
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{s === 1 ? 'Media' : 'Details'}</span>
            </div>
            {i === 0 && <div className={`flex-1 h-px max-w-[24px] ${editStep > 1 ? 'bg-jci-blue' : 'bg-slate-200'}`} />}
          </React.Fragment>
        ))}
      </div>

      <form id="plan-edit-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Step 1: Basics & Media */}
        {editStep === 1 && (
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-l-4 border-jci-blue/40 pl-2 mb-3">Project Info</p>
              <div className="space-y-3">
                <Input name="title" label="Title *" placeholder="e.g. Summer Leadership Summit"
                  value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                  icon={<FileText size={16} />} required />
                <Textarea name="description" label="Description" placeholder="Brief description of the activity plan..."
                  value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} />
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
                          value={editRoadmapUrl} onChange={(e) => setEditRoadmapUrl(e.target.value)} icon={<Globe size={16} />} />
                      </div>
                      <Button type="button" variant="outline" onClick={handleFetchPosterForEdit} disabled={isFetchingPoster}
                        className="h-10 shrink-0 flex items-center gap-1.5 border-jci-blue text-jci-blue hover:bg-sky-50 mb-px">
                        {isFetchingPoster ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}
                        <span className="text-xs">{isFetchingPoster ? 'Syncing' : 'Sync'}</span>
                      </Button>
                    </div>
                  </div>
                  <Input name="logoUrl" label="Poster / Logo URL" placeholder="https://example.com/poster.png"
                    value={editLogoUrl} onChange={(e) => setEditLogoUrl(e.target.value)} icon={<Image size={16} />} />
                  {editLogoUrl && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex justify-center p-2">
                      <img src={editLogoUrl} alt="Poster preview" className="max-h-36 object-contain rounded-lg" />
                    </div>
                  )}
                </div>
                <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold text-slate-500">Activity Photo Gallery</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">Paste a Google Drive <strong>folder</strong> link shared as "Anyone with the link"</p>
                  <Input label="" placeholder="https://drive.google.com/drive/folders/"
                    value={newPhotoUrl} onChange={(e) => {
                      setNewPhotoUrl(e.target.value);
                      setGalleryPhotos(e.target.value.trim() ? [e.target.value.trim()] : []);
                    }} />
                  {galleryPhotos.length > 0 && (
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
        {editStep === 2 && (
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-l-4 border-jci-blue/40 pl-2 mb-2">Classification</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Select name="level" label="Level *" required value={editLevel} onChange={(e) => setEditLevel(e.target.value as any)}
                  options={[{ label: '" Select "', value: '' }, ...PROJECT_LEVELS.map(l => ({ label: l, value: l }))]} />
                <Select name="pillar" label="Pillar *" required value={editPillar} onChange={(e) => setEditPillar(e.target.value as any)}
                  options={[{ label: '" Select "', value: '' }, ...PROJECT_PILLARS.map(p => ({ label: p, value: p }))]} />
                <Select name="type" label="Type *" required value={formType}
                  options={[{ label: '" Select "', value: '' }, ...PROJECT_TYPES.map(c => ({ label: PROJECT_TYPE_LABELS[c] || c, value: c }))]}
                  onChange={(e) => { setFormType(e.target.value); setEditCategory(''); }} />
                <Select name="category" label="Category *" required value={editCategory} onChange={(e) => setEditCategory(e.target.value)}
                  options={[{ label: '" Select "', value: '' }, ...(formType ? (PROJECT_CATEGORIES_BY_TYPE[formType] ?? []) : []).map(t => ({ label: t, value: t }))]} />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-l-4 border-jci-blue/40 pl-2 mb-2">Schedule</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Input name="proposedDate" label="Proposed *" type="date" value={editProposedDate}
                  onChange={(e) => setEditProposedDate(e.target.value)} icon={<Calendar size={16} />} required />
                <Input name="eventStartDate" label="Start Date *" type="date" value={editEventStartDate}
                  onChange={(e) => setEditEventStartDate(e.target.value)} icon={<Calendar size={16} />} required />
                <Input name="eventEndDate" label="End Date" type="date" value={editEventEndDate}
                  onChange={(e) => setEditEventEndDate(e.target.value)} icon={<Calendar size={16} />} />
                <div />
                <Input name="eventStartTime" label="Start Time" type="time" value={editEventStartTime}
                  onChange={(e) => setEditEventStartTime(e.target.value)} icon={<Clock size={16} />} />
                <Input name="eventEndTime" label="End Time" type="time" value={editEventEndTime}
                  onChange={(e) => setEditEventEndTime(e.target.value)} icon={<Clock size={16} />} />
                <Input name="priceMin" label="Min Price (RM)" type="number" min="0" placeholder="0"
                  value={editPriceMin} onChange={(e) => setEditPriceMin(e.target.value)} icon={<DollarSign size={16} />} />
                <Input name="priceMax" label="Max Price (RM)" type="number" min="0" placeholder="e.g. 150"
                  value={editPriceMax} onChange={(e) => setEditPriceMax(e.target.value)} icon={<DollarSign size={16} />} />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-l-4 border-jci-blue/40 pl-2 mb-2">Goals</p>
              <div className="md:grid md:grid-cols-2 md:gap-3 space-y-2 md:space-y-0">
                <Textarea name="objectives" label="Objectives & Goals" placeholder="Goals and expected community impact..."
                  defaultValue={project.objectives} rows={2} />
                <Textarea name="expectedImpact" label="Expected Impact" placeholder="Expected outcomes and impact..."
                  defaultValue={project.expectedImpact} rows={2} />
              </div>
            </div>
          </div>
        )}
      </form>
    </Drawer>
  );

  // Empty state (no plan data yet)
  if (!hasPlanFields) {
    return (
      <>
        <div className="text-center py-12">
          <FileText className="mx-auto text-slate-400 mb-4" size={48} />
          <p className="text-slate-500 mb-4">No activity plan data found on this project</p>
          <Button onClick={() => { setIsEditing(true); setEditStep(1); }}>
            <Plus size={16} className="mr-2" />
            Create Activity Plan
          </Button>
        </div>
        {editDrawer}
      </>
    );
  }

  // View mode
  const scheduleItems: { label: string; date: string; time?: string }[] = [];
  if (project.proposedDate) scheduleItems.push({ label: 'Proposed', date: formatDate(toDate(project.proposedDate as any)) });
  if (project.eventStartDate) scheduleItems.push({ label: 'Start', date: formatDate(toDate(project.eventStartDate as any)), time: project.eventStartTime });
  if (project.eventEndDate) scheduleItems.push({ label: 'End', date: formatDate(toDate(project.eventEndDate as any)), time: project.eventEndTime });

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => { setIsEditing(true); setEditStep(1); }}>
          <Edit size={14} className="mr-1.5" />Edit
        </Button>
        <Button variant="danger" size="sm" onClick={onDelete}>
          <Trash2 size={14} className="mr-1.5" />Delete
        </Button>
      </div>

      {/* Classification badges " visible on mobile above poster */}
      <div className="flex flex-wrap gap-1.5 md:hidden">
        {project.level && <Badge variant="jci" className="text-xs px-2.5 py-1">{project.level}</Badge>}
        {project.pillar && <Badge variant="neutral" className="text-xs px-2.5 py-1">{project.pillar}</Badge>}
        {project.type && <Badge variant="neutral" className="text-xs px-2.5 py-1">{PROJECT_TYPE_LABELS[project.type] || project.type}</Badge>}
        {project.category && <Badge variant="neutral" className="text-xs px-2.5 py-1">{project.category}</Badge>}
      </div>

      {/* 2-col on desktop, single col on mobile */}
      <div className="md:grid md:grid-cols-[240px_1fr] md:gap-5">
        {/* Left: poster + gallery */}
        <div className="space-y-3 mb-4 md:mb-0">
          {project.logoUrl ? (
            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 aspect-[4/3] md:aspect-[3/4] w-full shadow-sm">
              <img src={project.logoUrl} alt="Poster" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 aspect-[4/3] md:aspect-[3/4] w-full flex flex-col items-center justify-center gap-2 text-slate-300">
              <Image size={32} />
              <span className="text-xs font-semibold">No poster</span>
            </div>
          )}
          {project.galleryUrls && project.galleryUrls.length > 0 && project.galleryUrls[0] && (
            <a
              href={project.galleryUrls[0]}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-jci-blue hover:bg-sky-50 transition-colors"
            >
              <ExternalLink size={14} />
              Photo Gallery
            </a>
          )}
        </div>

        {/* Right: metadata + info */}
        <div className="space-y-4">
          {/* Classification badges " desktop only */}
          <div className="hidden md:block">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Classification</p>
            <div className="flex flex-wrap gap-1.5">
              {project.level && <Badge variant="jci" className="text-xs px-2.5 py-1">{project.level}</Badge>}
              {project.pillar && <Badge variant="neutral" className="text-xs px-2.5 py-1">{project.pillar}</Badge>}
              {project.type && <Badge variant="neutral" className="text-xs px-2.5 py-1">{PROJECT_TYPE_LABELS[project.type] || project.type}</Badge>}
              {project.category && <Badge variant="neutral" className="text-xs px-2.5 py-1">{project.category}</Badge>}
              {!project.level && !project.pillar && !project.type && !project.category && <span className="text-xs text-slate-400">"</span>}
            </div>
          </div>

          {/* Schedule " compact grid */}
          {(scheduleItems.length > 0 || project.priceMin != null || project.priceMax != null) && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Schedule</p>
              <div className={`grid gap-2 ${scheduleItems.length >= 3 ? 'grid-cols-3' : scheduleItems.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {scheduleItems.map(item => (
                  <div key={item.label} className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-0.5">{item.label}</p>
                    <p className="text-sm font-semibold text-slate-800 leading-tight">{item.date}</p>
                    {item.time && <p className="text-xs text-slate-500 mt-0.5">{item.time}</p>}
                  </div>
                ))}
              </div>
              {(project.priceMin != null || project.priceMax != null) && (
                <div className="mt-2 flex items-center gap-2.5 rounded-xl bg-blue-50 border border-blue-100 px-3 py-2.5">
                  <DollarSign size={13} className="text-jci-blue shrink-0" />
                  <div>
                    <p className="text-[10px] text-blue-500 font-semibold uppercase tracking-wide">Price Range</p>
                    <p className="text-sm font-semibold text-slate-800">
                      {project.priceMin != null && project.priceMax != null
                        ? `RM ${project.priceMin} - RM ${project.priceMax}`
                        : project.priceMin != null
                          ? `From RM ${project.priceMin}`
                          : `Up to RM ${project.priceMax}`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {project.description && (() => {
            const lines = project.description!.split('\n');
            const isLong = lines.length > 3 || project.description!.length > 180;
            const preview = isLong && !descExpanded
              ? lines.slice(0, 3).join('\n').slice(0, 180) + ''
              : project.description!;
            return (
              <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Info size={11} />About</p>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{preview}</p>
                {isLong && (
                  <button type="button" onClick={() => setDescExpanded(v => !v)}
                    className="mt-1.5 text-xs font-medium text-jci-blue hover:underline">
                    {descExpanded ? 'Show less' : 'Read more'}
                  </button>
                )}
              </div>
            );
          })()}

          {/* Objectives + Expected Impact */}
          {(project.objectives || project.expectedImpact) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {project.objectives && (
                <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Objectives</p>
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{project.objectives}</p>
                </div>
              )}
              {project.expectedImpact && (
                <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Expected Impact</p>
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{project.expectedImpact}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {editDrawer}
    </div>
  );
};

// Project Event Committee Tab Component
interface ProjectCommitteeTabProps {
  project: Project;
  onSave: (updates: Partial<Project>) => Promise<void>;
}

const DEFAULT_EX_OFFICIO_ROLE = 'Ex-Officio';
const DEFAULT_ORGANISING_ROLE = 'Organising Chairperson';

const COMMITTEE_ROLES = [
  DEFAULT_EX_OFFICIO_ROLE,
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
    // ç›´æŽ¥ä½¿ç"¨ project.committee ä¸­çš„æ•°æ®ï¼Œä¸å†è‡ªåŠ¨åˆ›å»º baseline
    // DEFAULT_EX_OFFICIO_ROLE å’Œ DEFAULT_ORGANISING_ROLE åªåœ¨åˆ›å»º project æ—¶æ·»åŠ 
    const existing = project.committee || [];

    if (existing.length === 0) {
      // å¦‚æžœæ²¡æœ‰ä¿å­˜çš„ committee æ•°æ®ï¼Œè¿"å›žç©ºæ•°ç»„ï¼ˆç"¨æˆ·å¯ä»¥æ‰‹åŠ¨æ·»åŠ è§’è‰²ï¼‰
      return [];
    }

    // å°†å·²ä¿å­˜çš„ committee æ•°æ®è½¬æ¢ä¸º rows æ ¼å¼
    return existing.map(c => {
      const mappedTasks = (c.tasks || []).map(t => ({
        taskId: t.taskId, // ä¿ç•™çŽ°æœ‰çš„ taskId
        title: t.title || '',
        dueDate: t.dueDate || '',
      }));

      return {
        role: c.role || '',
        memberId: c.memberId || '',
        // ç¡®ä¿è‡³å°‘æœ‰ä¸€ä¸ª task è¡Œï¼ˆå³ä½¿ä¸ºç©ºï¼‰ï¼Œä»¥ä¾¿ UI å¯ä»¥æ˜¾ç¤ºå’Œç¼–è¾‘
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
                return null; // è·³è¿‡å®Œå…¨ç©ºç™½çš„ task
              }

              const task: { taskId?: string; title: string; dueDate?: string } = { title };

              // å¦‚æžœ task æœ‰ titleï¼Œç¡®ä¿å®ƒæœ‰ taskIdï¼ˆå¦‚æžœæ²¡æœ‰åˆ™ç"Ÿæˆï¼‰
              if (title) {
                task.taskId = t.taskId || uuidv4();
              }

              if (t.dueDate) {
                task.dueDate = t.dueDate;
              }

              return task;
            })
            .filter((t): t is { taskId?: string; title: string; dueDate?: string } => t !== null)
            .filter(t => t.title || t.dueDate); // è‡³å°‘æœ‰ä¸€ä¸ªéžç©ºå­—æ®µ

          return {
            role: r.role.trim(),
            memberId: r.memberId,
            ...(cleanedTasks.length > 0 ? { tasks: cleanedTasks } : {}),
          };
        })
        .filter(r => r.role.trim().length > 0); // åªè¦ role å­˜åœ¨å°±ä¿å­˜ï¼ˆå³ä½¿å…¶ä»–å­—æ®µä¸ºç©ºï¼‰

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
    <form onSubmit={handleSave} className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-base font-semibold text-slate-900">Event Committee</h3>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setIsEditing(false); resetRows(); }} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSaving}>
                {isSaving ? 'Saving' : 'Save'}
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit size={14} className="mr-1.5" /> Edit
            </Button>
          )}
        </div>
      </div>

      {/* VIEW MODE " card per member */}
      {!isEditing && (
        <div className="space-y-3">
          {rows.length === 0 ? (
            <div className="text-center py-10 text-sm text-slate-400">
              No committee assigned yet.{' '}
              <button type="button" className="text-jci-blue underline" onClick={() => setIsEditing(true)}>Add members</button>
            </div>
          ) : rows.map((row, rowIndex) => {
            const member = members.find(m => m.id === row.memberId);
            const initials = member
              ? (member.name || member.fullName || '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
              : '?';
            const visibleTasks = row.tasks.filter(t => t.title.trim());
            return (
              <div key={rowIndex} className="flex gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                {/* Avatar */}
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-jci-blue/10 text-jci-blue font-semibold text-sm flex items-center justify-center">
                  {initials}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-slate-900 truncate">
                      {member ? (member.fullName || member.name) : <span className="italic text-slate-400">Unassigned</span>}
                    </span>
                    {row.role && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                        {row.role}
                      </span>
                    )}
                  </div>
                  {visibleTasks.length > 0 && (
                    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100 mt-2 overflow-hidden">
                      {visibleTasks.map((task, tIdx) => (
                        <li key={tIdx} className="flex items-center justify-between px-3 py-1.5 text-xs text-slate-700 bg-slate-50">
                          <span className="truncate flex-1">{task.title}</span>
                          {task.dueDate && (
                            <span className="ml-3 flex-shrink-0 text-slate-400 tabular-nums">{task.dueDate}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* EDIT MODE " accordion sections */}
      {isEditing && (
        <div className="space-y-3">
          {rows.map((row, rowIndex) => {
            const isProtectedRole = row.role === DEFAULT_ORGANISING_ROLE || row.role === DEFAULT_EX_OFFICIO_ROLE;
            return (
              <div key={rowIndex} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                {/* Role + Member header row */}
                <div className="flex flex-wrap gap-2 items-center p-3 bg-slate-50 border-b border-slate-100">
                  <div className="flex-1 min-w-[120px]">
                    <Input
                      placeholder="Role title"
                      value={row.role}
                      disabled={isProtectedRole}
                      className="text-sm h-8"
                      onChange={(e) => {
                        if (isProtectedRole) return;
                        const value = e.target.value;
                        setRows(prev => { const next = [...prev]; next[rowIndex] = { ...next[rowIndex], role: value }; return next; });
                      }}
                    />
                  </div>
                  <div className="flex-[2] min-w-[160px] flex items-center gap-1">
                    <div className="flex-1">
                      <MemberSelector
                        label=""
                        placeholder="Select member"
                        members={members}
                        value={row.memberId || ''}
                        onChange={(value) => {
                          setRows(prev => { const next = [...prev]; next[rowIndex] = { ...next[rowIndex], memberId: value }; return next; });
                        }}
                        selfOption={false}
                        showLookupFields={false}
                        getOptionLabel={(m) => m.fullName ? `${m.name} (${m.fullName})` : m.name}
                      />
                    </div>
                    {row.memberId && (
                      <button
                        type="button"
                        className="flex-shrink-0 self-stretch flex items-center gap-1 px-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 text-xs font-semibold transition-colors"
                        title="Clear member"
                        onClick={() => setRows(prev => { const next = [...prev]; next[rowIndex] = { ...next[rowIndex], memberId: '' }; return next; })}
                      >
                        <X size={12} />
                        Remove
                      </button>
                    )}
                  </div>
                  {!isProtectedRole && (
                    <button
                      type="button"
                      className="flex-shrink-0 text-slate-400 hover:text-red-500 transition-colors p-1 rounded"
                      title="Remove role"
                      onClick={() => setRows(prev => prev.filter((_, i) => i !== rowIndex))}
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>

                {/* Tasks compact table */}
                <div className="divide-y divide-slate-100">
                  {row.tasks.map((task, tIndex) => (
                    <div key={tIndex} className="flex gap-2 items-center px-3 py-2">
                      <Input
                        placeholder="Task title"
                        value={task.title}
                        className="flex-1 text-sm h-8"
                        onChange={(e) => {
                          const value = e.target.value;
                          setRows(prev => {
                            const next = [...prev];
                            const tasks = [...next[rowIndex].tasks];
                            tasks[tIndex] = { ...tasks[tIndex], title: value };
                            next[rowIndex] = { ...next[rowIndex], tasks };
                            return next;
                          });
                        }}
                      />
                      <Input
                        type="date"
                        value={task.dueDate}
                        className="w-36 text-sm h-8"
                        onChange={(e) => {
                          const value = e.target.value;
                          setRows(prev => {
                            const next = [...prev];
                            const tasks = [...next[rowIndex].tasks];
                            tasks[tIndex] = { ...tasks[tIndex], dueDate: value };
                            next[rowIndex] = { ...next[rowIndex], tasks };
                            return next;
                          });
                        }}
                      />
                      {row.tasks.length > 1 && (
                        <button
                          type="button"
                          className="flex-shrink-0 text-slate-300 hover:text-red-400 transition-colors p-1 rounded"
                          onClick={() => setRows(prev => {
                            const next = [...prev];
                            next[rowIndex] = { ...next[rowIndex], tasks: next[rowIndex].tasks.filter((_, i) => i !== tIndex) };
                            return next;
                          })}
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add Task inline link */}
                <div className="px-3 pb-2.5">
                  <button
                    type="button"
                    className="text-xs text-jci-blue hover:underline"
                    onClick={() => setRows(prev => {
                      const next = [...prev];
                      next[rowIndex] = { ...next[rowIndex], tasks: [...next[rowIndex].tasks, { title: '', dueDate: '' }] };
                      return next;
                    })}
                  >
                    + Add task
                  </button>
                </div>
              </div>
            );
          })}

          {/* Add Role dashed row */}
          <button
            type="button"
            className="w-full rounded-xl border-2 border-dashed border-slate-200 py-2.5 text-sm text-slate-400 hover:border-jci-blue hover:text-jci-blue transition-colors"
            onClick={() => setRows(prev => [...prev, { role: '', memberId: '', tasks: [{ title: '', dueDate: '' }] }])}
          >
            + Add Role
          </button>
        </div>
      )}
    </form>
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
