import * as React from 'react';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Trash2, Settings, X, ChevronDown, Sparkles, ArrowLeft, Phone, Mail,
  Award, Clock, Briefcase, GraduationCap, UserPlus, Search, Users,
  TrendingUp, Zap, Download, Upload, BarChart3, FileText, RefreshCw,
  Calendar, Shield, UserCheck, AlertCircle, CheckCircle, MapPin,
  Linkedin, Facebook, Instagram, MessageCircle, CalendarCheck, UserCog,
  Target, Coins, ArrowUpRight, Edit, MoreHorizontal, Star, TrendingDown,
  BookOpen, Trophy, Network, ChevronRight, LayoutList
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button, Card, Badge, ProgressBar, Modal, useToast, Pagination, Tabs } from '../ui/Common';
import { Input, Select, Textarea, ButtonGroup } from '../ui/Form';
import { MultiSelectDropdown } from '../ui/MultiSelectDropdown';
import { MemberEditForm } from './MemberEditForm';
import { IntroducerSelector } from '../ui/IntroducerSelector';
import { LoadingState } from '../ui/Loading';
import { useMembers, type UseMembersResult } from '../../hooks/useMembers';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import {
  UserRole,
  Member,
  MemberTier,
  MemberCreateInput,
  MembershipType,
  MembershipRuleConfig,
  ProbationTask,
  MembershipDues,
  BoardMember,
  Project,
} from '../../types';
import {
  DEFAULT_MEMBERSHIP_RULES,
  MembershipConfigService,
  computeMembershipTypeFromMember,
} from '../../services/membershipConfigService';
import { MembersService } from '../../services/membersService';

/** å‡ºå¸­å¯¹æ¯”ï¼šå½“å¹´ç­¾åˆ°æ¬¡æ•° vs å·²è¿‡æœˆä»½ï¼ˆå…¥ä¼šå¹´ä»½ä»Žå…¥ä¼šæœˆèµ·ç®—ï¼‰ï¼Œæ¯å¹´é‡ç®— */
const getAttendanceDisplay = (m: Member) => {
  const year = new Date().getFullYear();
  const months = MembersService.computeAttendanceMonths(m.jciCareer?.joinDate || m.joinDate);
  const checkins = m.attendanceYear === year ? (m.attendanceCheckins || 0) : 0;
  return { checkins, months, text: `${checkins} / ${months}`, ratio: Math.min(100, (checkins / months) * 100) };
};
import { MEMBER_SELF_EDITABLE_FIELDS, NATIONALITY_OPTIONS, JOIN_US_SURVEY_QUESTIONS, nationalityOptionsForValue } from '../../config/constants';
import { Combobox } from '../ui/Combobox';
import { MentorshipService, MentorMatchSuggestion } from '../../services/mentorshipService';
import { INDUSTRY_OPTIONS, IDEAL_REFERRAL_OPTIONS, BUSINESS_CATEGORIES_OPTIONS } from '../../config/constants';
import { HobbyClubsService } from '../../services/hobbyClubsService';
import { getBirthPlaceFromIC, isMalaysianIC, getDateOfBirthFromIC, getGenderFromIC } from '../../utils/malaysianIdUtils';
import { HobbyClub } from '../../types';
import { DataImportExportService } from '../../services/dataImportExportService';
import { MemberStatsService, MemberStatistics } from '../../services/memberStatsService';
import { DuplicateMembersView } from './Members/DuplicateMembersView';
import { deleteFromCloudinary, uploadMemberAvatarToCloudinary } from '../../services/cloudinaryService';
import { EventRegistrationService } from '../../services/eventRegistrationService';
import { EventsService } from '../../services/eventsService';
import type { EventRegistration } from '../../types';
import type { Event } from '../../types';
import { BoardManagementService } from '../../services/boardManagementService';
import { AIPredictionService, MemberChurnPrediction } from '../../services/aiPredictionService';
import { MentorMatching } from './MemberManagement/MentorMatching';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { ProjectsService } from '../../services/projectsService';
import { PointsService } from '../../services/pointsService';
import type { PointRule } from '../../services/pointsService';
import { PromotionTracking } from './MemberManagement/PromotionTracking';
import { SenatorshipManagement } from './MemberManagement/SenatorshipManagement';
import { BoardOfDirectorsSection } from './MemberManagement/BoardOfDirectorsSection';
import { IntroducerManagement } from './MemberManagement/IntroducerManagement';
import { MemberBatchImportModal } from './Members/MemberBatchImportModal';
import { PointsSourceRadarChart } from '../dashboard/Analytics';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { useBatchMode } from '../../contexts/BatchModeContext';
import { formatDateToDDMMMYYYY } from '../../utils/dateUtils';
import { MembershipTypeDisplay } from '../shared/MembershipTypeDisplay';
import { ColumnFilterHeader } from '../ui/ColumnFilterHeader';
import { GuestManagementView } from './Members/GuestManagementView';
import { MemberStatisticsView } from './Members/MemberStatisticsView';
import { AsyncErrorBoundary } from '../ui/AsyncErrorBoundary';
import { BatchActionBar } from './Members/BatchActionBar';
import { MemberTable } from './Members/MemberTable';
import { MyProfileSelfView } from './Members/MyProfileSelfView';
import { MemberDetail } from './Members/MemberDetail';
import { MentorMatchingModal } from './Members/MentorMatchingModal';
import { ChurnPredictionModal } from './Members/ChurnPredictionModal';

const HOBBY_OPTIONS = [
  "Art & Design", "Badminton", "Baking", "Basketball", "Car Enthusiast",
  "Cigar", "Cooking", "Cycling", "Dancing", "Diving",
  "E-Sport Mlbb", "Fashion", "Golf", "Hiking", "Leadership",
  "Liquor/ Wine Tasting", "Make Up", "Movie", "Other E-Sport", "Pickle Ball",
  "Pilates", "Public Speaking", "Reading", "Rock Climbing", "Singing",
  "Social Etiquette", "Social Service", "Travelling", "Women Empowerment", "Yoga"
];

/** Dues status labels (Story 8.1) */
const DUES_STATUS_LABEL: Record<string, string> = { Paid: 'Paid', Pending: 'Pending', Overdue: 'Overdue' };

/** My Profile: Only shows self and allows editing MEMBER_SELF_EDITABLE_FIELDS (Story 1.3); Dues status and participation history (Story 8.1) */
export const MembersView: React.FC<{ searchQuery?: string; initialSelectedMemberId?: string | null; onClearSelection?: () => void }> = ({ searchQuery, initialSelectedMemberId, onClearSelection }) => {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(initialSelectedMemberId ?? null);
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [activeTab, setActiveTab] = useState<
    'directory' | 'guest' | 'statistics' | 'board-of-directors' | 'mentorship' | 'promotion-tracking' | 'senatorship' | 'introducer' | 'duplicates'
  >('directory');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<'members' | 'events' | 'projects' | 'transactions'>('members');
  const [exportFormat, setExportFormat] = useState<'CSV' | 'JSON'>('CSV');
  const [statistics, setStatistics] = useState<MemberStatistics | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [lastImportResult, setLastImportResult] = useState<any | null>(null);
  const [addModalHobbies, setAddModalHobbies] = useState<string[]>([]);
  const [addModalInterestedIndustries, setAddModalInterestedIndustries] = useState<string[]>([]);
  const [addModalIntroducer, setAddModalIntroducer] = useState('');
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loIdFilter, setLoIdFilter] = useState<string | null>(null);
  const [showTabSheet, setShowTabSheet] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [roleFilters, setRoleFilters] = useState<UserRole[]>([]);
  const [membershipTypeFilters, setMembershipTypeFilters] = useState<MembershipType[]>([]);
  const [membershipRules, setMembershipRules] = useState<
    Record<MembershipType, MembershipRuleConfig>
  >(DEFAULT_MEMBERSHIP_RULES);
  const {
    members,
    loading,
    error,
    createMember,
    updateMember,
    deleteMember,
    batchUpdateMembers,
    batchDeleteMembers,
    loadMembers,
  }: UseMembersResult = useMembers(loIdFilter);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { setIsBatchMode } = useBatchMode();

  useEffect(() => {
    setIsBatchMode(selectedIds.size > 1);
    return () => setIsBatchMode(false);
  }, [selectedIds.size, setIsBatchMode]);

  useEffect(() => {
    if (initialSelectedMemberId && members.length > 0) {
      if (members.some(m => m.id === initialSelectedMemberId)) {
        setSelectedMemberId(initialSelectedMemberId);
        if (onClearSelection) onClearSelection();
      }
    }
  }, [initialSelectedMemberId, members, onClearSelection]);

  const [isBatchActionModalOpen, setIsBatchActionModalOpen] = useState(false);
  const [batchActionType, setBatchActionType] = useState<'delete' | 'set' | null>(null);
  const [batchSetField, setBatchSetField] = useState<string>('');
  const [batchSetValue, setBatchSetValue] = useState<any>('');

  const { member: currentMember } = useAuth();
  const { isAdmin, isBoard, isDeveloper } = usePermissions();
  const { showToast } = useToast();
  const canManageMembers = isAdmin || isBoard || isDeveloper;

  const selectedMember = members.find(m => m.id === selectedMemberId);

  useEffect(() => {
    MembershipConfigService.getRules().then(setMembershipRules).catch(() => { });
  }, []);

  useEffect(() => {
    ProjectsService.getAllProjects().then(setAllProjects).catch(err => console.error('Failed to load projects:', err));
  }, []);

  const getMemberDisplayMembershipType = useCallback((member: Member): MembershipType =>
    computeMembershipTypeFromMember(
      {
        nationality: member.nationality,
        dateOfBirth: member.dateOfBirth,
        senatorCertified: member.senatorCertified,
        senatorshipId: member.senatorshipId,
        senatorshipBoardValidated: member.senatorshipBoardValidated,
        role: member.role,
        membershipType: member.membershipType,
      },
      membershipRules
    ), [membershipRules]);

  // Filter members based on search + column filters
  const filteredMembers = useMemo(() => {
    const term = (searchQuery || searchTerm).toLowerCase();
    let list = members;

    if (term) {
      list = list.filter(
        (m) =>
          (m.name ?? '').toLowerCase().includes(term) ||
          (m.email ?? '').toLowerCase().includes(term) ||
          (m.phone ?? '').toLowerCase().includes(term) ||
          (m.fullName ?? '').toLowerCase().includes(term) ||
          (m.address ?? '').toLowerCase().includes(term)
      );
    }

    if (roleFilters.length > 0) {
      list = list.filter((m) => roleFilters.includes(m.role as UserRole));
    }

    if (membershipTypeFilters.length > 0) {
      list = list.filter((m) =>
        membershipTypeFilters.includes(getMemberDisplayMembershipType(m))
      );
    }

    return list;
  }, [members, searchTerm, searchQuery, roleFilters, membershipTypeFilters, membershipRules]);

  // Paginate filtered members
  const paginatedMembers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredMembers.slice(startIndex, endIndex);
  }, [filteredMembers, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedIds.size === paginatedMembers.length && paginatedMembers.every(m => selectedIds.has(m.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedMembers.map(m => m.id)));
    }
  }, [selectedIds, paginatedMembers]);

  const isAllSelected = paginatedMembers.length > 0 && paginatedMembers.every(m => selectedIds.has(m.id));

  // Reset to page 1 when search or column filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, searchQuery, roleFilters, membershipTypeFilters]);

  // Handle Ctrl+A for Select All on current page
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        const activeElement = document.activeElement;
        const isTyping = activeElement instanceof HTMLInputElement ||
          activeElement instanceof HTMLTextAreaElement ||
          (activeElement as HTMLElement)?.isContentEditable;

        if (activeTab === 'directory' && !isTyping && paginatedMembers.length > 0) {
          e.preventDefault();
          const allIds = paginatedMembers.map(m => m.id);
          setSelectedIds(new Set(allIds));
          showToast(`Selected all ${allIds.length} members on current page`, 'info');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, paginatedMembers, showToast]);

  // Load statistics when statistics tab is active
  useEffect(() => {
    if (activeTab === 'statistics' && !statistics) {
      loadStatistics();
    }
  }, [activeTab]);

  const loadStatistics = async () => {
    setLoadingStats(true);
    try {
      const stats = await MemberStatsService.generateStatistics();
      setStatistics(stats);
    } catch (err) {
      showToast('Failed to load statistics', 'error');
    } finally {
      setLoadingStats(false);
    }
  };

  const handleExport = async (format: 'CSV' | 'JSON' | 'Excel') => {
    try {
      showToast(`Exporting members as ${format}...`, 'info');

      const fields = ['id', 'name', 'email', 'phone', 'membershipType', 'status', 'joinDate'];
      const filters: any[] = [];
      const userId = 'current_user_id'; // Would come from auth context

      let exportData: string | ArrayBuffer;
      let mimeType: string;
      let fileExtension: string;

      if (format === 'Excel') {
        exportData = await DataImportExportService.exportToExcel('members', fields, filters, userId);
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        fileExtension = 'xlsx';
      } else {
        exportData = await DataImportExportService.exportToCSV('members', fields, filters, userId);
        mimeType = 'text/csv;charset=utf-8;';
        fileExtension = 'csv';
      }

      const blob = new Blob([exportData], { type: mimeType });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `jci-members-${new Date().toISOString().split('T')[0]}.${fileExtension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      showToast('Members exported successfully', 'success');
      setIsExportModalOpen(false);
    } catch (err) {
      showToast('Failed to export members', 'error');
    }
  };

  const handleExportFromModal = async () => {
    try {
      setIsExporting(true);
      showToast(`Exporting ${exportType} as ${exportFormat}...`, 'info');
      const template = DataImportExportService.generateImportTemplate(exportType);
      const fields = template.requiredFields.concat(template.optionalFields);
      const filters: { field: string; operator: 'equals'; value: string }[] = [];
      if (exportType === 'members') {
        const loId = loIdFilter ?? (currentMember as { loId?: string })?.loId ?? 'default-lo';
        filters.push({ field: 'loId', operator: 'equals', value: loId });
      }
      const userId = currentMember?.id || 'current_user_id';

      let content: string | ArrayBuffer;
      let filename: string;
      let mimeType: string;

      if (exportFormat === 'CSV') {
        content = await DataImportExportService.exportToCSV(exportType, fields, filters, userId);
        filename = `${exportType}_export_${new Date().toISOString().split('T')[0]}.csv`;
        mimeType = 'text/csv';
      } else if (exportFormat === 'JSON') {
        content = await DataImportExportService.exportToJSON(exportType, fields, filters, userId);
        filename = `${exportType}_export_${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
      } else {
        content = await DataImportExportService.exportToExcel(exportType, fields, filters, userId);
        filename = `${exportType}_export_${new Date().toISOString().split('T')[0]}.xlsx`;
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      }

      const blob = new Blob([content as BlobPart], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showToast('Export completed successfully', 'success');
      setIsExportModalOpen(false);
    } catch (err) {
      showToast('Failed to export data', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFromModal = async () => {
    if (!importFile) {
      showToast('Please select a file to import', 'error');
      return;
    }
    try {
      setIsImporting(true);
      const data = await DataImportExportService.parseFile(importFile);
      const userId = currentMember?.id || 'current_user_id';
      const result = await DataImportExportService.importData(data, 'members', userId, importFile.name);
      setImportResult(result);
      if (result.successfulRows > 0) showToast(`Successfully imported ${result.successfulRows} records`, 'success');
      if (result.failedRows > 0) showToast(`${result.failedRows} records failed to import`, 'error');
    } catch (err) {
      showToast('Failed to import data', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleCloseAddModal = () => {
    setAddModalOpen(false);
    setAddModalHobbies([]);
    setAddModalInterestedIndustries([]);
    setAddModalIntroducer('');
  };

  const handleAddMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const name = `${firstName} ${lastName}`.trim();
    const email = formData.get('email') as string;

    try {
      const formNationality = formData.get('nationality') as string || 'Malaysia';
      const formDateOfBirth = formData.get('dateOfBirth') as string || undefined;
      const formSenatorshipId = formData.get('senatorshipId') as string || undefined;
      const formRole = (formData.get('role') as UserRole) || UserRole.MEMBER;

      const skillsInput = formData.get('skills') as string;
      const skills = skillsInput ? skillsInput.split(',').map(s => s.trim()).filter(s => s.length > 0) : [];

      const hobbies = addModalHobbies.length > 0 ? addModalHobbies : undefined;

      const interestedIndustries = addModalInterestedIndustries.length > 0 ? addModalInterestedIndustries : undefined;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newMember: MemberCreateInput & Record<string, any> = {
        name,
        email,
        phone: formData.get('phone') as string || '',
        role: formRole,
        tier: (formData.get('tier') as MemberTier) || MemberTier.BRONZE,
        points: 0,
        joinDate: new Date().toISOString().split('T')[0],
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0097D7&color=fff`,
        churnRisk: (formData.get('churnRisk') as any) || 'Low',
        attendanceRate: parseInt(formData.get('attendanceRate') as string) || 100,
        badges: [],
        skills,
        hobbies,
        interestedIndustries,
        'business.interestedIndustries': interestedIndustries,
        businessCategory: formData.getAll('businessCategory').length > 0 ? (formData.getAll('businessCategory') as string[]) : undefined,

        // Basic Info
        fullName: formData.get('fullName') as string || undefined,
        idNumber: formData.get('idNumber') as string || undefined,
        gender: (formData.get('gender') as any) || undefined,
        ethnicity: (formData.get('ethnicity') as any) || undefined,
        'general.ethnicity': (formData.get('ethnicity') as any) || undefined,
        nationality: formData.get('nationality') as string || 'Malaysia',
        dateOfBirth: formData.get('dateOfBirth') as string || undefined,
        'general.birthPlace': (formData.get('birthPlace') as string) || undefined,
        introducer: formData.get('introducer') as string || undefined,
        bio: formData.get('bio') as string || undefined,
        dietaryPreference: (formData.get('dietaryPreference') as any) || undefined,
        'general.dietaryPreference': (formData.get('dietaryPreference') as any) || undefined,

        senatorshipId: formSenatorshipId,

        // Professional
        companyName: formData.get('companyName') as string || undefined,
        companyWebsite: formData.get('companyWebsite') as string || undefined,
        companyDescription: formData.get('companyDescription') as string || undefined,
        'business.companyDescription': (formData.get('companyDescription') as string) || undefined,
        departmentAndPosition: formData.get('departmentAndPosition') as string || undefined,
        'business.departmentAndPosition': (formData.get('departmentAndPosition') as string) || undefined,
        industry: formData.get('industry') as string || undefined,
        companyLogoUrl: formData.get('companyLogoUrl') as string || undefined,
        specialOffer: formData.get('specialOffer') as string || undefined,
        acceptInternationalBusiness: (formData.get('acceptInternationalBusiness') as any) || undefined,

        // Contact
        alternatePhone: formData.get('alternatePhone') as string || undefined,
        whatsappGroup: false, // Managed by API
        address: formData.get('address') as string || undefined,
        linkedin: formData.get('linkedin') as string || undefined,
        facebook: formData.get('facebook') as string || undefined,
        instagram: formData.get('instagram') as string || undefined,
        wechat: formData.get('wechat') as string || undefined,
        emergencyContactName: formData.get('emergencyContactName') as string || undefined,
        emergencyContactPhone: formData.get('emergencyContactPhone') as string || undefined,
        emergencyContactRelationship: formData.get('emergencyContactRelationship') as string || undefined,

        // Apparel
        cutStyle: (formData.get('cutStyle') as any) || undefined,
        tshirtSize: (formData.get('tshirtSize') as any) || undefined,
        jacketSize: (formData.get('jacketSize') as any) || undefined,
        embroideredName: formData.get('embroideredName') as string || undefined,
        tshirtStatus: (formData.get('tshirtStatus') as any) || 'NA',
      };

      await createMember(newMember);
      handleCloseAddModal();
      showToast('Member registered successfully', 'success');
      e.currentTarget.reset();
    } catch (error) {
      // Error is already handled in the hook
    }
  };

  // Self-view or Guest view: only show profile detail
  if (!canManageMembers && currentMember) {
    return (
      <div className="space-y-6 pb-40 md:pb-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Profile</h2>
        </div>
        <MemberDetail member={currentMember} onBack={() => { }} isSelfView />
      </div>
    );
  }

  const TAB_CONFIG = [
    { id: 'directory', label: 'Directory', short: 'Directory', icon: Users },
    { id: 'guest', label: 'Guests', short: 'Guests', icon: UserCheck },
    { id: 'statistics', label: 'Statistics', short: 'Stats', icon: BarChart3 },
    { id: 'board-of-directors', label: 'Board', short: 'Board', icon: Shield },
    { id: 'mentorship', label: 'Mentorship', short: 'Mentors', icon: BookOpen },
    { id: 'promotion-tracking', label: 'Promotions', short: 'Promotions', icon: TrendingUp },
    { id: 'senatorship', label: 'Senatorship', short: 'Senators', icon: Trophy },
    { id: 'introducer', label: 'Introducer', short: 'Introducers', icon: Network },
    { id: 'duplicates', label: 'Duplicates', short: 'Duplicates', icon: AlertCircle },
  ] as const;

  const activeTabConfig = TAB_CONFIG.find(t => t.id === activeTab) ?? TAB_CONFIG[0];

  return (
    <div className="space-y-0 pb-24 md:pb-0">
      {!selectedMember ? (
        <>
          {/* â”€â”€ PAGE HEADER â”€â”€ */}
          <div className="flex items-center justify-between gap-3 mb-4">
            {/* Left: title */}
            <div>
              <h2 className="text-xl font-black text-slate-900 leading-tight">Member Directory</h2>
              <p className="text-slate-400 text-xs mt-0.5 hidden sm:block">Manage membership, tiers, and engagement.</p>
            </div>
            {/* Right: actions */}
            {canManageMembers && (
              <div className="flex items-center gap-2">
                {/* Desktop: full buttons */}
                <div className="hidden sm:flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsExportModalOpen(true)}>
                    <Download size={14} className="mr-1.5" /> Export
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setIsImportModalOpen(true)}>
                    <Upload size={14} className="mr-1.5" /> Import
                  </Button>
                  <Button size="sm" onClick={() => setAddModalOpen(true)}>
                    <UserPlus size={14} className="mr-1.5" /> Add Member
                  </Button>
                </div>
                {/* Mobile: Add + overflow menu */}
                <div className="flex sm:hidden items-center gap-2">
                  <div className="relative">
                    <button
                      onClick={() => setShowActionsMenu(v => !v)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                    {showActionsMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowActionsMenu(false)} />
                        <div className="absolute right-0 top-10 z-50 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 min-w-[160px]">
                          <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                            onClick={() => { setIsExportModalOpen(true); setShowActionsMenu(false); }}>
                            <Download size={15} className="text-slate-400" /> Export
                          </button>
                          <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                            onClick={() => { setIsImportModalOpen(true); setShowActionsMenu(false); }}>
                            <Upload size={15} className="text-slate-400" /> Import
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => setAddModalOpen(true)}
                    className="h-8 px-3 flex items-center gap-1.5 bg-jci-blue text-white rounded-xl text-sm font-bold shadow-sm"
                  >
                    <UserPlus size={14} /> Add
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* â”€â”€ TAB NAVIGATION â”€â”€ */}
          {/* Desktop: scrollable icon+label tabs */}
          <div className="hidden md:flex items-center gap-1 overflow-x-auto pb-1 mb-4 scrollbar-none border-b border-slate-100">
            {TAB_CONFIG.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-t-xl text-sm font-semibold whitespace-nowrap transition-all border-b-2 -mb-[1px] ${isActive
                    ? 'text-jci-blue border-jci-blue bg-jci-blue/5'
                    : 'text-slate-500 border-transparent hover:text-slate-800 hover:bg-slate-50'
                    }`}
                >
                  <Icon size={15} />
                  {tab.label}
                  {isActive && tab.id === 'directory' && (
                    <span className="ml-1 bg-jci-blue text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                      {filteredMembers.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Mobile: current tab pill â†’ tap â†’ bottom sheet */}
          <div className="md:hidden mb-4">
            <button
              onClick={() => setShowTabSheet(true)}
              className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-2.5 shadow-sm w-full mb-4"
            >
              {React.createElement(activeTabConfig.icon, { size: 16, className: 'text-jci-blue shrink-0' })}
              <span className="font-bold text-slate-800 flex-1 text-left text-sm">{activeTabConfig.label}</span>
              {activeTab === 'directory' && (
                <span className="bg-jci-blue/10 text-jci-blue text-xs font-black px-2 py-0.5 rounded-full">{filteredMembers.length}</span>
              )}
              <ChevronDown size={16} className="text-slate-400 shrink-0" />
            </button>
          </div>

          {/* Mobile tab bottom sheet */}
          {showTabSheet && (
            <>
              <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setShowTabSheet(false)} />
              <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white rounded-t-3xl shadow-2xl pb-24">
                <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-4" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest px-6 mb-2">Switch View</p>
                <div className="divide-y divide-slate-50 pb-6">
                  {TAB_CONFIG.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id as any); setShowTabSheet(false); }}
                        className={`w-full flex items-center gap-4 px-6 py-3.5 transition-colors ${isActive ? 'bg-jci-blue/5' : 'hover:bg-slate-50'}`}
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isActive ? 'bg-jci-blue text-white' : 'bg-slate-100 text-slate-500'}`}>
                          <Icon size={17} />
                        </div>
                        <span className={`font-semibold text-sm flex-1 text-left ${isActive ? 'text-jci-blue' : 'text-slate-700'}`}>{tab.label}</span>
                        {isActive && <CheckCircle size={16} className="text-jci-blue" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <div>
            {activeTab === 'directory' && (
              <LoadingState loading={loading} error={error} empty={filteredMembers.length === 0} emptyMessage="No members found">
                <MemberTable
                  members={paginatedMembers}
                  onSelect={setSelectedMemberId}
                  selectedIds={selectedIds}
                  onToggleSelection={toggleSelection}
                  onToggleAll={toggleAll}
                  isAllSelected={isAllSelected}
                  roleFilters={roleFilters}
                  onRoleFiltersChange={setRoleFilters}
                  membershipTypeFilters={membershipTypeFilters}
                  onMembershipTypeFiltersChange={setMembershipTypeFilters}
                  getDisplayMembershipType={getMemberDisplayMembershipType}
                />
                {filteredMembers.length > 0 && (
                  <div className="mt-4">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalItems={filteredMembers.length}
                      itemsPerPage={itemsPerPage}
                      onPageChange={setCurrentPage}
                      onItemsPerPageChange={(newItemsPerPage) => {
                        setItemsPerPage(newItemsPerPage);
                        setCurrentPage(1);
                      }}
                    />
                  </div>
                )}
              </LoadingState>
            )}

            {activeTab === 'guest' && (
              <AsyncErrorBoundary>
                <GuestManagementView searchQuery={searchQuery} onSelect={setSelectedMemberId} />
              </AsyncErrorBoundary>
            )}

            {activeTab === 'statistics' && (
              <AsyncErrorBoundary>
                <MemberStatisticsView statistics={statistics} loading={loadingStats} members={members} />
              </AsyncErrorBoundary>
            )}

            {activeTab === 'board-of-directors' && (
              <BoardOfDirectorsSection members={members} canManage={canManageMembers} />
            )}

            {activeTab === 'mentorship' && (
              <MentorMatching searchQuery={searchQuery} />
            )}

            {activeTab === 'promotion-tracking' && (
              <PromotionTracking searchQuery={searchQuery} />
            )}

            {activeTab === 'senatorship' && (
              <SenatorshipManagement
                members={members}
                canValidate={canManageMembers}
                searchQuery={searchQuery}
                onMembersChanged={loadMembers}
              />
            )}

            {activeTab === 'introducer' && (
              <IntroducerManagement
                members={members}
                allProjects={allProjects}
                onUpdateMember={updateMember}
                onBatchUpdateMembers={batchUpdateMembers}
              />
            )}

            {activeTab === 'duplicates' && (
              <DuplicateMembersView
                members={members}
                onMembersChanged={loadMembers}
              />
            )}
          </div>
        </>
      ) : (
        <MemberDetail member={selectedMember} onBack={() => setSelectedMemberId(null)} />
      )}

      {selectedIds.size > 1 && (
        <BatchActionBar
          selectedCount={selectedIds.size}
          onClear={() => setSelectedIds(new Set())}
          onBatchDelete={() => {
            setBatchActionType('delete');
            setIsBatchActionModalOpen(true);
          }}
          onBatchSet={() => {
            setBatchActionType('set');
            setIsBatchActionModalOpen(true);
          }}
          isDeveloper={isDeveloper}
        />
      )}

      {/* Batch Action Modal */}
      <Modal
        isOpen={isBatchActionModalOpen}
        onClose={() => setIsBatchActionModalOpen(false)}
        title={batchActionType === 'delete' ? 'Confirm Batch Delete' : 'Batch Set Fields'}
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button variant="outline" onClick={() => setIsBatchActionModalOpen(false)}>Cancel</Button>
            {batchActionType === 'delete' ? (
              <Button variant="danger" onClick={async () => {
                await batchDeleteMembers(Array.from(selectedIds));
                setSelectedIds(new Set());
                setIsBatchActionModalOpen(false);
              }}>Delete Members</Button>
            ) : (
              <Button disabled={!batchSetField || !batchSetValue} onClick={async () => {
                const updates: Partial<Member> = { [batchSetField]: batchSetValue };
                await batchUpdateMembers(Array.from(selectedIds), updates);
                setSelectedIds(new Set());
                setIsBatchActionModalOpen(false);
              }}>Apply Changes</Button>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          {batchActionType === 'delete' ? (
            <p className="text-slate-600">Are you sure you want to delete <span className="font-bold text-red-600">{selectedIds.size}</span> members? This action cannot be undone.</p>
          ) : (
            <>
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">Field to Set</label>
                <Select
                  options={[
                    { label: 'Select field...', value: '' },
                    { label: 'Introducer', value: 'introducer' },
                    { label: 'Cut Style', value: 'cutStyle' },
                    { label: 'T-Shirt Size', value: 'tshirtSize' },
                    { label: 'Jacket Size', value: 'jacketSize' },
                    { label: 'Role', value: 'role' },
                  ]}
                  value={batchSetField}
                  onChange={(e) => {
                    setBatchSetField(e.target.value);
                    setBatchSetValue('');
                  }}
                />
              </div>

              {batchSetField && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700">Value</label>
                  {batchSetField === 'introducer' ? (
                    <Input value={batchSetValue} onChange={(e) => setBatchSetValue(e.target.value)} placeholder="Enter introducer name" />
                  ) : batchSetField === 'role' ? (
                    <Select
                      options={[UserRole.GUEST, UserRole.MEMBER, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.INACTIVE].map(r => ({ label: r, value: r }))}
                      value={batchSetValue}
                      onChange={(e) => setBatchSetValue(e.target.value)}
                    />
                  ) : batchSetField === 'cutStyle' ? (
                    <Select
                      options={['Unisex', 'Lady Cut'].map(v => ({ label: v, value: v }))}
                      value={batchSetValue}
                      onChange={(e) => setBatchSetValue(e.target.value)}
                    />
                  ) : (
                    <Select
                      options={['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '5XL', '7XL'].map(v => ({ label: v, value: v }))}
                      value={batchSetValue}
                      onChange={(e) => setBatchSetValue(e.target.value)}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={isAddModalOpen}
        onClose={handleCloseAddModal}
        title="Register New Member"
        size="xl"
        drawerOnMobile
        footer={
          <div className="flex gap-3 w-full">
            <Button variant="outline" className="flex-1" type="button" onClick={handleCloseAddModal}>Cancel</Button>
            <Button className="flex-1" type="submit" form="add-member-form">Register Member</Button>
          </div>
        }
      >
        <form id="add-member-form" onSubmit={handleAddMember} className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg mb-4">
            <p className="text-xs text-blue-700 flex items-start gap-2">
              <Sparkles size={14} className="shrink-0 mt-0.5" />
              Fill in as much information as possible to create a complete member profile. You can also import members from CSV for bulk registration.
            </p>
          </div>

          <div className="max-h-[60vh] overflow-y-auto pr-2">
            <div className="space-y-6">
              <section>
                <h3 className="text-sm font-bold text-slate-900 border-b pb-2 mb-4">Identity & Account</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Input name="firstName" label="First Name" placeholder="John" required />
                  <Input name="lastName" label="Last Name" placeholder="Doe" required />
                  <Input name="email" label="Email Address" type="email" placeholder="john@example.com" required />
                  <Input name="phone" label="Phone" type="tel" placeholder="+60..." />
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold text-slate-900 border-b pb-2 mb-4">Identity Verification</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Input name="fullName" label="Full Name (ID Card)" />
                  <Input name="idNumber" label="ID Number" />
                  <Input name="dateOfBirth" label="Date of Birth" type="date" />
                  <Select name="nationality" label="Nationality" defaultValue="Malaysia" options={NATIONALITY_OPTIONS.map(c => ({ label: c, value: c }))} />

                  <div className="col-span-2 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Gender</label>
                      <div className="flex gap-2">
                        {['Male', 'Female'].map(opt => (
                          <label key={opt} className="cursor-pointer flex-1 text-center">
                            <input type="radio" name="gender" value={opt} className="hidden peer" />
                            <span className="block px-3 py-2 rounded-lg text-xs font-medium border-2 border-slate-200 peer-checked:border-jci-blue peer-checked:bg-jci-blue/5 peer-checked:text-jci-blue transition-all">
                              {opt}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Ethnicity</label>
                      <div className="flex gap-2">
                        {['Chinese', 'Malay', 'Indian', 'Others'].map(opt => (
                          <label key={opt} className="cursor-pointer flex-1 text-center">
                            <input type="radio" name="ethnicity" value={opt} className="hidden peer" />
                            <span className="block px-2 py-2 rounded-lg text-[10px] font-medium border-2 border-slate-200 peer-checked:border-jci-blue peer-checked:bg-jci-blue/5 peer-checked:text-jci-blue transition-all">
                              {opt}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold text-slate-900 border-b pb-2 mb-4">Internal Profile</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Select name="role" label="System Role" defaultValue={UserRole.MEMBER} options={[UserRole.GUEST, UserRole.MEMBER, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.INACTIVE].map(r => ({ label: r, value: r }))} />
                  <p className="col-span-2 text-xs text-slate-500 -mt-2">
                    Membership type is computed from profile. Senatorship numbers are validated under the Senatorship tab.
                  </p>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Introducer</label>
                    <IntroducerSelector
                      value={addModalIntroducer}
                      onChange={setAddModalIntroducer}
                      members={members}
                      projects={allProjects}
                    />
                    <input type="hidden" name="introducer" value={addModalIntroducer} />
                  </div>
                  <Input name="senatorshipId" label="Senatorship Number (optional)" placeholder="e.g. 12345" />
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold text-slate-900 border-b pb-2 mb-4">Professional Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Input name="companyName" label="Company Name" />
                  <Select
                    name="industry"
                    label="Industry"
                    options={[
                      { label: 'Select industry...', value: '' },
                      ...INDUSTRY_OPTIONS.map(opt => ({ label: opt, value: opt }))
                    ]}
                  />
                  <div className="col-span-2">
                    <Input name="skills" label="Skills (comma-separated)" placeholder="Leadership, Networking, Marketing..." />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Interested Industries</label>
                    <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      {INDUSTRY_OPTIONS.map(opt => (
                        <label key={opt} className="cursor-pointer">
                          <input
                            type="checkbox"
                            checked={addModalInterestedIndustries.includes(opt)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAddModalInterestedIndustries([...addModalInterestedIndustries, opt]);
                              } else {
                                setAddModalInterestedIndustries(addModalInterestedIndustries.filter(i => i !== opt));
                              }
                            }}
                            className="hidden"
                          />
                          <span className={`inline-block px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border-2 ${addModalInterestedIndustries.includes(opt) ? 'bg-sky-500 text-white border-sky-500 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:border-sky-500/30'}`}>
                            {opt}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold text-slate-900 border-b pb-2 mb-4">Hobbies & Interests</h3>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-3 bg-slate-50 rounded-lg border border-slate-200">
                  {HOBBY_OPTIONS.map(opt => (
                    <label key={opt} className="cursor-pointer">
                      <input
                        type="checkbox"
                        checked={addModalHobbies.includes(opt)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAddModalHobbies([...addModalHobbies, opt]);
                          } else {
                            setAddModalHobbies(addModalHobbies.filter(h => h !== opt));
                          }
                        }}
                        className="hidden"
                      />
                      <span className={`inline-block px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border-2 ${addModalHobbies.includes(opt) ? 'bg-jci-blue text-white border-jci-blue shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:border-jci-blue/30'}`}>
                        {opt}
                      </span>
                    </label>
                  ))}
                </div>
              </section>

              <p className="text-xs text-slate-400 italic text-center py-4">
                Additional detailed fields such as Apparel, Social Media, and Emergency Contacts can be filled after registration via the Edit Profile button.
              </p>
            </div>
          </div>

        </form>
      </Modal>

      {/* Batch Import Modal */}
      <MemberBatchImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImported={() => {
          loadMembers();
          showToast('Members imported successfully', 'success');
        }}
      />

      {/* Export Modal â€“ Export Data (migrated from Import/Export tab) */}
      <Modal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="Export Data"
        drawerOnMobile
        footer={
          <Button onClick={handleExportFromModal} disabled={isExporting} className="w-full">
            <Download size={16} className="mr-2" />
            {isExporting ? 'Exporting...' : `Export ${exportType} as ${exportFormat}`}
          </Button>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Data Type</label>
            <Select
              value={exportType}
              onChange={(e) => setExportType(e.target.value as typeof exportType)}
              options={[
                { label: 'Members', value: 'members' },
                { label: 'Events', value: 'events' },
                { label: 'Projects', value: 'projects' },
                { label: 'Transactions', value: 'transactions' },
              ]}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Export Format</label>
            <Select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as typeof exportFormat)}
              options={[
                { label: 'CSV', value: 'CSV' },
                { label: 'JSON', value: 'JSON' },
              ]}
            />
          </div>
        </div>
      </Modal>

      {/* Import Result Summary Modal */}
      {lastImportResult && (
        <Modal
          isOpen={!!lastImportResult}
          onClose={() => {
            if (lastImportResult.status === 'success') window.location.reload();
            setLastImportResult(null);
          }}
          title="Import Results"
          drawerOnMobile
        >
          <div className="space-y-4">
            <div className={`p-4 rounded-lg flex items-center gap-3 ${lastImportResult.status === 'success' ? 'bg-green-50 border border-green-100' :
              lastImportResult.status === 'partial' ? 'bg-amber-50 border border-amber-100' :
                'bg-red-50 border border-red-100'
              }`}>
              {lastImportResult.status === 'success' ? (
                <CheckCircle className="text-green-600" size={24} />
              ) : (
                <AlertCircle className={lastImportResult.status === 'partial' ? 'text-amber-600' : 'text-red-600'} size={24} />
              )}
              <div>
                <p className="font-bold text-slate-900">
                  {lastImportResult.status === 'success' ? 'Import Successful' :
                    lastImportResult.status === 'partial' ? 'Import Partially Successful' :
                      'Import Failed'}
                </p>
                <p className="text-sm text-slate-600">
                  {lastImportResult.successfulRows} rows imported, {lastImportResult.failedRows} rows failed.
                </p>
              </div>
            </div>

            {lastImportResult.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-700">Detailed Error Logs:</h4>
                <div className="max-h-60 overflow-auto border border-slate-200 rounded-md">
                  <table className="min-w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Row</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Field</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {lastImportResult.errors.map((error: any, idx: number) => (
                        <tr key={idx}>
                          <td className="px-3 py-2 text-xs font-mono text-slate-500 whitespace-nowrap">Line {error.row}</td>
                          <td className="px-3 py-2 text-xs font-medium text-slate-700 whitespace-nowrap">{error.field}</td>
                          <td className="px-3 py-2 text-xs text-red-600">{error.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button onClick={() => {
                if (lastImportResult.status === 'success' || lastImportResult.status === 'partial') {
                  window.location.reload();
                }
                setLastImportResult(null);
              }}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};


// Guest Management View Component
