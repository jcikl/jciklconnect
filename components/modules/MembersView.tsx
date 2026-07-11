import * as React from 'react';
import { useState, useEffect, useMemo, useRef } from 'react';
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
import { BatchActionBar } from './Members/BatchActionBar';
import { MemberTable } from './Members/MemberTable';
import { MyProfileSelfView } from './Members/MyProfileSelfView';

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

  const getMemberDisplayMembershipType = (member: Member): MembershipType =>
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
    );

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

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === paginatedMembers.length && paginatedMembers.every(m => selectedIds.has(m.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedMembers.map(m => m.id)));
    }
  };

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
              <GuestManagementView searchQuery={searchQuery} onSelect={setSelectedMemberId} />
            )}

            {activeTab === 'statistics' && (
              <MemberStatisticsView statistics={statistics} loading={loadingStats} members={members} />
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

// Member Statistics View Component
const MemberDetail: React.FC<{ member: Member, onBack: () => void, isSelfView?: boolean }> = ({ member: memberProp, onBack, isSelfView = false }) => {
  const { members, updateMember, deleteMember } = useMembers();
  const { resetPassword, member: currentAuthMember } = useAuth();
  // Points columns in the Activities Log are visible to the President only
  const isPresident = (currentAuthMember?.jciCareer?.currentBoardPosition || currentAuthMember?.currentBoardPosition) === 'President';
  // Always derive the latest member data from the live members array so the UI
  // updates automatically after every save (without a page reload).
  const member = useMemo(
    () => members.find(m => m.id === memberProp.id) ?? memberProp,
    [members, memberProp]
  );
  const { isAdmin, isDeveloper, hasPermission, effectiveRole } = usePermissions();
  const canEditMembers = hasPermission('canEditMembers');
  const { showToast } = useToast();
  const [showMentorMatchModal, setShowMentorMatchModal] = useState(false);
  const [potentialMentors, setPotentialMentors] = useState<MentorMatchSuggestion[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [churnPrediction, setChurnPrediction] = useState<MemberChurnPrediction | null>(null);
  const [loadingChurnPrediction, setLoadingChurnPrediction] = useState(false);
  const [showChurnModal, setShowChurnModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [memberClubs, setMemberClubs] = useState<HobbyClub[]>([]);
  const [loadingClubs, setLoadingClubs] = useState(false);
  const [editFormTab, setEditFormTab] = useState<'basic' | 'professional' | 'contact' | 'apparel'>('basic');
  const [boardPositions, setBoardPositions] = useState<BoardMember[]>([]);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [assessmentAnswers, setAssessmentAnswers] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    if (member.surveyAnswers) {
      Object.keys(member.surveyAnswers).forEach(key => {
        const val = member.surveyAnswers![key];
        init[key] = Array.isArray(val) ? val : (val ? [val] : []);
      });
    }
    return init;
  });
  const [assessmentShowZh, setAssessmentShowZh] = useState(false);
  const [savingAssessment, setSavingAssessment] = useState(false);
  const [showPaymentHistoryModal, setShowPaymentHistoryModal] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUploadProgress, setAvatarUploadProgress] = useState(0);
  const sessionUploads = useRef<string[]>([]);

  const [activeInlineEditCard, setActiveInlineEditCard] = useState<'basic' | 'professional' | 'contact' | 'apparel' | 'career' | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [inlineValues, setInlineValues] = useState<any>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'basic' | 'professional' | 'career' | 'activities'>('basic');
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [projectRoles, setProjectRoles] = useState<any[]>([]);
  const [sponsorshipRecords, setSponsorshipRecords] = useState<any[]>([]);
  const [radarContributions, setRadarContributions] = useState<any[]>([]);
  const [recruitedMembers, setRecruitedMembers] = useState<any[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const currentYear = new Date().getFullYear();
  const [radarYear, setRadarYear] = useState(currentYear);
  const availableYears = useMemo(() => Array.from({ length: 5 }, (_, i) => currentYear - i), [currentYear]);

  const groupedRadarContributions = useMemo(() => {
    const sorted = [...radarContributions].sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      const valA = isNaN(dateA.getTime()) ? 0 : dateA.getTime();
      const valB = isNaN(dateB.getTime()) ? 0 : dateB.getTime();
      return valB - valA;
    });

    const groups: { [year: string]: any[] } = {};
    sorted.forEach((log) => {
      const dateObj = new Date(log.date);
      const year = isNaN(dateObj.getTime()) ? 'Unknown' : String(dateObj.getFullYear());
      if (!groups[year]) {
        groups[year] = [];
      }
      groups[year].push(log);
    });

    const sortedYears = Object.keys(groups).sort((a, b) => {
      if (a === 'Unknown') return 1;
      if (b === 'Unknown') return -1;
      return b.localeCompare(a);
    });

    return { groups, sortedYears };
  }, [radarContributions]);

  const HOBBY_OPTIONS = [
    "Art & Design", "Badminton", "Baking", "Basketball", "Car Enthusiast",
    "Cigar", "Cooking", "Cycling", "Dancing", "Diving",
    "E-Sport Mlbb", "Fashion", "Golf", "Hiking", "Leadership",
    "Liquor/ Wine Tasting", "Make Up", "Movie", "Other E-Sport", "Pickle Ball",
    "Pilates", "Public Speaking", "Reading", "Rock Climbing", "Singing",
    "Social Etiquette", "Social Service", "Travelling", "Women Empowerment", "Yoga"
  ];

  const resolveIntroducerDisplay = (introVal?: string) => {
    if (!introVal) return 'Direct Join';
    const foundMember = members.find(m => m.id === introVal);
    if (foundMember) {
      const shortName = foundMember.name || '';
      const fullName = foundMember.fullName || '';
      if (shortName && fullName && shortName !== fullName) {
        return `JCI KL Member: ${shortName} (${fullName})`;
      }
      return `JCI KL Member: ${shortName || fullName || 'Unnamed'}`;
    }
    return introVal;
  };

  const resolveIntroducerShort = (introVal?: string) => {
    if (!introVal) return 'Direct Join';
    const foundMember = members.find(m => m.id === introVal);
    if (foundMember) return foundMember.name || foundMember.fullName || 'Unnamed';
    return introVal;
  };

  const startInlineEdit = (card: 'basic' | 'professional' | 'contact' | 'apparel' | 'career') => {
    setInlineValues({
      name: member.name || '',
      avatar: member.avatar || member.avatarUrl || member.general?.avatarUrl || '',
      fullName: member.fullName || '',
      idNumber: member.idNumber || member.general?.idNumber || '',
      birthPlace: (() => { const ic = member.idNumber || member.general?.idNumber || ''; return isMalaysianIC(ic) ? (getBirthPlaceFromIC(ic) || member.birthPlace || member.general?.birthPlace || '') : (member.birthPlace || member.general?.birthPlace || ''); })(),
      dateOfBirth: (() => { const ic = member.idNumber || member.general?.idNumber || ''; return isMalaysianIC(ic) ? (getDateOfBirthFromIC(ic) || member.dateOfBirth || member.general?.dob || '') : (member.dateOfBirth || member.general?.dob || ''); })(),
      gender: (() => { const ic = member.idNumber || member.general?.idNumber || ''; return isMalaysianIC(ic) ? (getGenderFromIC(ic) || member.gender || member.general?.gender || '') : (member.gender || member.general?.gender || ''); })(),
      ethnicity: (member.general?.ethnicity ?? member.ethnicity) || '',
      dietaryPreference: (member.general?.dietaryPreference ?? member.dietaryPreference) || '',
      nationality: member.nationality || 'Malaysia',
      introducer: member.introducer || '',
      bio: member.bio || '',
      hobbies: Array.isArray(member.hobbies) ? [...member.hobbies] : [],
      skills: Array.isArray(member.skills) ? member.skills.join(', ') : (member.skills || ''),

      companyName: member.companyName || '',
      companyWebsite: member.companyWebsite || '',
      companyDescription: (member.business?.companyDescription ?? member.companyDescription) || '',
      departmentAndPosition: (member.business?.departmentAndPosition ?? member.departmentAndPosition) || '',
      acceptInternationalBusiness: member.acceptInternationalBusiness || '',
      businessCategory: Array.isArray(member.businessCategory) ? [...member.businessCategory] : [],
      industry: member.industry || '',
      interestedIndustries: Array.isArray(member.business?.interestedIndustries ?? member.interestedIndustries) ? [...(member.business?.interestedIndustries ?? member.interestedIndustries)!] : [],
      levelOfManagement: (member.business?.levelOfManagement ?? member.levelOfManagement) || '',
      idealReferralIndustry: member.idealReferralIndustry || '',
      idealReferral: member.idealReferral || (Array.isArray(member.idealReferrals) ? member.idealReferrals.join(', ') : ''),
      specialOffer: member.specialOffer || '',

      phone: member.phone || '',
      alternatePhone: member.alternatePhone || '',
      whatsappGroup: !!member.whatsappGroup,
      email: member.email || '',
      address: member.address || '',
      linkedin: member.linkedin || '',
      facebook: member.facebook || '',
      instagram: member.instagram || '',
      wechat: member.wechat || '',
      emergencyContactName: member.emergencyContactName || '',
      emergencyContactPhone: member.emergencyContactPhone || '',
      emergencyContactRelationship: member.emergencyContactRelationship || '',

      cutStyle: member.cutStyle || '',
      tshirtSize: member.tshirtSize || '',
      jacketSize: member.jacketSize || '',
      embroideredName: member.embroideredName || '',
      tshirtStatus: member.tshirtStatus || 'NA',

      senatorCertified: !!member.senatorCertified,
      senatorshipId: member.senatorshipId || '',
      senatorshipBoardValidated: !!member.senatorshipBoardValidated,
      senatorshipValidatedBy: (member.jciCareer?.senatorshipValidatedBy ?? member.senatorshipValidatedBy) || '',
      senatorshipValidatedAt: (member.jciCareer?.senatorshipValidatedAt ?? member.senatorshipValidatedAt) || '',
    });
    setActiveInlineEditCard(card);
    setIsEditMode(true);
  };

  const handleInlineAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !inlineValues) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file', 'error');
      return;
    }

    setAvatarUploading(true);
    setAvatarUploadProgress(0);
    try {
      const uploadedUrl = await uploadMemberAvatarToCloudinary(file, member, setAvatarUploadProgress);
      sessionUploads.current.push(uploadedUrl);
      setInlineValues((prev: any) => ({ ...prev, avatar: uploadedUrl, _avatarTs: Date.now() }));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to upload avatar', 'error');
    } finally {
      setAvatarUploading(false);
      setAvatarUploadProgress(0);
    }
  };

  const handleInlineSave = async (card: 'basic' | 'professional' | 'contact' | 'apparel' | 'career', updates: Partial<Member>) => {
    try {
      await updateMember(member.id, updates);
      setActiveInlineEditCard(null);
      showToast('Profile updated successfully', 'success');
      return true;
    } catch (err) {
      showToast('Failed to update profile', 'error');
      return false;
    }
  };

  const handleGlobalSave = async () => {
    if (!inlineValues) return;
    const skillsArr = inlineValues.skills.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (updateMember as (id: string, updates: any) => Promise<void>)(member.id, {
        avatar: inlineValues.avatar || '', avatarUrl: inlineValues.avatar || '',
        name: inlineValues.name, fullName: inlineValues.fullName, idNumber: inlineValues.idNumber,
        birthPlace: inlineValues.birthPlace || undefined,
        'general.birthPlace': inlineValues.birthPlace || undefined,
        dateOfBirth: inlineValues.dateOfBirth, gender: inlineValues.gender, ethnicity: inlineValues.ethnicity,
        'general.ethnicity': inlineValues.ethnicity || undefined,
        dietaryPreference: (inlineValues.dietaryPreference as Member['dietaryPreference']) || undefined,
        'general.dietaryPreference': (inlineValues.dietaryPreference as Member['dietaryPreference']) || undefined,
        nationality: inlineValues.nationality, introducer: inlineValues.introducer, bio: inlineValues.bio,
        hobbies: inlineValues.hobbies, skills: skillsArr,
        companyName: inlineValues.companyName, companyWebsite: inlineValues.companyWebsite,
        companyDescription: inlineValues.companyDescription,
        'business.companyDescription': inlineValues.companyDescription || undefined,
        departmentAndPosition: inlineValues.departmentAndPosition,
        'business.departmentAndPosition': inlineValues.departmentAndPosition || undefined,
        acceptInternationalBusiness: inlineValues.acceptInternationalBusiness, businessCategory: inlineValues.businessCategory,
        industry: inlineValues.industry, interestedIndustries: inlineValues.interestedIndustries,
        'business.interestedIndustries': inlineValues.interestedIndustries,
        levelOfManagement: inlineValues.levelOfManagement,
        'business.levelOfManagement': inlineValues.levelOfManagement || undefined,
        idealReferralIndustry: inlineValues.idealReferralIndustry,
        idealReferral: inlineValues.idealReferral, specialOffer: inlineValues.specialOffer,
        phone: inlineValues.phone, alternatePhone: inlineValues.alternatePhone, email: inlineValues.email,
        whatsappGroup: inlineValues.whatsappGroup, address: inlineValues.address,
        emergencyContactName: inlineValues.emergencyContactName, emergencyContactRelationship: inlineValues.emergencyContactRelationship,
        emergencyContactPhone: inlineValues.emergencyContactPhone, linkedin: inlineValues.linkedin,
        facebook: inlineValues.facebook, instagram: inlineValues.instagram, wechat: inlineValues.wechat,
        cutStyle: inlineValues.cutStyle, tshirtSize: inlineValues.tshirtSize, jacketSize: inlineValues.jacketSize,
        tshirtStatus: inlineValues.tshirtStatus, embroideredName: inlineValues.embroideredName,
        senatorshipId: inlineValues.senatorshipId?.trim(), senatorCertified: inlineValues.senatorCertified,
        senatorshipBoardValidated: inlineValues.senatorshipBoardValidated,
        senatorshipValidatedBy: inlineValues.senatorshipValidatedBy?.trim(),
        'jciCareer.senatorshipValidatedBy': inlineValues.senatorshipValidatedBy?.trim(),
        senatorshipValidatedAt: inlineValues.senatorshipValidatedAt?.trim(),
        'jciCareer.senatorshipValidatedAt': inlineValues.senatorshipValidatedAt?.trim(),
      });
      const finalAvatar = inlineValues.avatar;
      const originalAvatar = member.avatar || member.avatarUrl || member.general?.avatarUrl || '';
      // Delete original saved avatar if replaced
      if (originalAvatar && originalAvatar !== finalAvatar) {
        deleteFromCloudinary(originalAvatar).catch(console.error);
      }
      // Delete any intermediate session uploads that were replaced
      sessionUploads.current.forEach(url => {
        if (url !== finalAvatar) deleteFromCloudinary(url).catch(console.error);
      });
      sessionUploads.current = [];
      setIsEditMode(false);
      setActiveInlineEditCard(null);
      setInlineValues(null);
      showToast('Profile updated successfully', 'success');
    } catch (err) {
      showToast('Failed to update profile', 'error');
    }
  };

  // Sync assessmentAnswers whenever the live member's surveyAnswers change (e.g. after save)
  useEffect(() => {
    if (!showAssessmentModal) {
      const synced: Record<string, string[]> = {};
      if (member.surveyAnswers) {
        Object.keys(member.surveyAnswers).forEach(key => {
          const val = member.surveyAnswers![key];
          synced[key] = Array.isArray(val) ? val : (val ? [val] : []);
        });
      }
      setAssessmentAnswers(synced);
    }
  }, [member.surveyAnswers, showAssessmentModal]);

  const diagnosePersona = (answers: Record<string, string[]>) => {
    const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    const tags = new Set<string>();

    JOIN_US_SURVEY_QUESTIONS.forEach(q => {
      const selectedValues = answers[q.id] || [];
      if (!selectedValues.length) return;

      selectedValues.forEach(answer => {
        if (['Q1', 'Q2', 'Q3', 'Q4'].includes(q.id)) {
          counts[answer] = (counts[answer] || 0) + 1;
        }

        const option = q.options.find(opt => opt.value === answer);
        if (option && option.mapping) {
          if (option.mapping.direction !== 'None') tags.add(option.mapping.direction);
          if (option.mapping.category !== 'Engagement') tags.add(option.mapping.category);
          option.mapping.items.forEach(item => tags.add(item));
        }
      });
    });

    let dominant = 'A';
    let max = -1;
    ['A', 'B', 'C', 'D'].forEach(key => {
      if (counts[key] > max) {
        max = counts[key];
        dominant = key;
      }
    });

    const personas: Record<string, string> = {
      A: 'Learning-oriented (å­¦ä¹ åž‹)',
      B: 'Practical-oriented (åŠ¡å®žåž‹)',
      C: 'Backbone-oriented (éª¨å¹²åž‹)',
      D: 'Explorer-oriented (æŽ¢ç´¢åž‹)'
    };

    return {
      personaType: personas[dominant],
      tendencyTags: Array.from(tags)
    };
  };

  const handleSaveAssessment = async () => {
    setSavingAssessment(true);
    try {
      const { personaType, tendencyTags } = diagnosePersona(assessmentAnswers);
      await updateMember(member.id, {
        surveyAnswers: assessmentAnswers,
        personaType,
        tendencyTags
      });
      showToast('Personalized assessment updated successfully', 'success');
      setShowAssessmentModal(false);
    } catch (err) {
      showToast('Failed to update assessment', 'error');
    } finally {
      setSavingAssessment(false);
    }
  };
  const [commissionDirectorPositions, setCommissionDirectorPositions] = useState<BoardMember[]>([]);

  const mentor = members.find(m => m.id === member.mentorId);
  const mentees = members.filter(m => member.menteeIds?.includes(m.id));

  // Load member's hobby clubs
  useEffect(() => {
    const loadMemberClubs = async () => {
      setLoadingClubs(true);
      try {
        const allClubs = await HobbyClubsService.getAllClubs();
        const clubs = allClubs.filter(club =>
          club.memberIds?.includes(member.id)
        );
        setMemberClubs(clubs);
      } catch (err) {
        console.error('Failed to load member clubs:', err);
      } finally {
        setLoadingClubs(false);
      }
    };
    loadMemberClubs();
  }, [member.id]);

  // Load board positions for this member directly from boardMembers collection
  useEffect(() => {
    const loadBoardPositions = async () => {
      try {
        const [positions, commissionPositions] = await Promise.all([
          BoardManagementService.getMemberBoardPositions(member.id),
          BoardManagementService.getMemberCommissionDirectorPositions(member.id),
        ]);
        setBoardPositions(positions);
        setCommissionDirectorPositions(commissionPositions);
      } catch (err) {
        console.error('Failed to load board positions:', err);
      }
    };
    loadBoardPositions();
  }, [member.id]);

  // Load projects for IntroducerSelector
  useEffect(() => {
    ProjectsService.getAllProjects().then(setAllProjects).catch(() => { });
  }, []);

  // Load activities log data
  useEffect(() => {
    if (activeDetailTab !== 'activities') return;

    let cancelled = false;
    const fetchActivitiesData = async () => {
      setActivitiesLoading(true);
      try {
        // Fetch all needed collections in parallel
        const [projects, sponsorshipsSnap, contributionsSnap, allMembers] = await Promise.all([
          ProjectsService.getAllProjects(),
          getDocs(query(collection(db, 'sponsorships'), where('memberId', '==', member.id))),
          getDocs(query(collection(db, 'RadarContributions'), where('memberId', '==', member.id))),
          MembersService.getAllMembers()
        ]);

        if (cancelled) return;

        // 1. Process Project Roles (Committee & Trainers)
        const roles: any[] = [];
        projects.forEach((proj: any) => {
          // Check committee
          if (proj.committee && Array.isArray(proj.committee)) {
            proj.committee.forEach((c: any) => {
              if (c.memberId === member.id) {
                roles.push({
                  id: `comm-${proj.id}`,
                  projectName: proj.name || 'Unnamed Project',
                  role: c.role || 'Committee Member',
                  type: 'Committee',
                  date: proj.startDate || proj.proposedDate || proj.eventStartDate || '',
                });
              }
            });
          }

          // Check trainers
          if (proj.trainers && Array.isArray(proj.trainers)) {
            proj.trainers.forEach((t: any) => {
              if (t.memberId === member.id) {
                roles.push({
                  id: `trainer-${proj.id}`,
                  projectName: proj.name || 'Unnamed Project',
                  role: 'Trainer',
                  type: 'Trainer',
                  hours: parseFloat(t.durationHours) || 0,
                  date: proj.startDate || proj.proposedDate || proj.eventStartDate || '',
                });
              }
            });
          }
        });
        setProjectRoles(roles.sort((a, b) => b.date.localeCompare(a.date)));

        // 2. Process Sponsorships
        const sponsorList: any[] = [];
        sponsorshipsSnap.forEach((doc) => {
          const data = doc.data();
          const amt = parseFloat(data.amount) || 0;
          sponsorList.push({
            id: doc.id,
            projectName: data.projectName || 'General Sponsorship',
            amount: amt,
            points: Math.floor(amt / 100) * 2, // 2 points per RM100 sponsor
            date: data.createdAt?.toDate?.() || data.createdAt || '',
          });
        });
        setSponsorshipRecords(sponsorList);

        // 3. Process Radar Contributions
        const contribList: any[] = [];
        contributionsSnap.forEach((doc) => {
          const data = doc.data();
          const rawDateVal = typeof data.eventDate === 'string'
            ? data.eventDate.trim().substring(0, 11)
            : (data.eventDate || data.createdAt?.toDate?.() || data.createdAt || '');
          contribList.push({
            id: doc.id,
            description: data.eventTitle || data.description || 'Imported Radar Score',
            points: parseFloat(data.points) || 0,
            type: data.rawCategory || data.type || 'Event',
            date: rawDateVal,
          });
        });
        setRadarContributions(contribList);

        // 4. Process Recruited Members
        const recruitList: any[] = [];
        const memberName = member.name || '';
        const memberFullName = member.fullName || member.general?.name || '';
        allMembers.forEach((m: any) => {
          const intro = (m.introducer || '').trim().toLowerCase();
          if (intro) {
            if (
              intro === member.id.toLowerCase() ||
              (memberName && intro === memberName.trim().toLowerCase()) ||
              (memberFullName && intro === memberFullName.trim().toLowerCase())
            ) {
              recruitList.push({
                id: m.id,
                name: m.name,
                email: m.email,
                joinDate: m.joinDate,
                avatar: m.avatar
              });
            }
          }
        });
        setRecruitedMembers(recruitList);

      } catch (err) {
        console.error('Error fetching activities logs:', err);
      } finally {
        if (!cancelled) setActivitiesLoading(false);
      }
    };

    fetchActivitiesData();

    return () => {
      cancelled = true;
    };
  }, [activeDetailTab, member.id]);

  const handleFindMentors = async () => {
    setLoadingMatches(true);
    try {
      const matches = await MentorshipService.findPotentialMentors(member.id, {
        skills: member.skills,
      });
      setPotentialMentors(matches);
      setShowMentorMatchModal(true);
    } catch (err) {
      showToast('Failed to find potential mentors', 'error');
    } finally {
      setLoadingMatches(false);
    }
  };

  const handleAssignMentor = async (mentorId: string) => {
    try {
      await MembersService.assignMentor(member.id, mentorId);
      showToast('Mentor assigned successfully', 'success');
      setShowMentorMatchModal(false);
    } catch (err) {
      showToast('Failed to assign mentor', 'error');
    }
  };

  const handleAnalyzeChurn = async () => {
    setLoadingChurnPrediction(true);
    try {
      const prediction = await AIPredictionService.predictMemberChurn(member.id);
      setChurnPrediction(prediction);
      setShowChurnModal(true);
    } catch (err) {
      showToast('Failed to analyze churn risk', 'error');
    } finally {
      setLoadingChurnPrediction(false);
    }
  };

  const handleEditProfile = async (updates: Partial<Member>) => {
    try {
      await updateMember(member.id, updates);
      setShowEditModal(false);
    } catch (err) {
      // Error is handled in the hook
    }
  };

  const handleSendInviteEmail = async () => {
    const email = member.contact?.email || member.email;
    if (!email) { showToast('No email address found for this member', 'error'); return; }
    try {
      const res = await fetch('/.netlify/functions/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error);
      }
      showToast(`Invitation email sent to ${email}`, 'success');
      setAuthEmailExists(true);
    } catch (err) {
      showToast(`Failed to send invite: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  // Whether this member's email already has a Firebase Auth account (Google/password) â€”
  // if so, the CTA becomes "Reset Password" instead of "Send Invite"
  const [authEmailExists, setAuthEmailExists] = useState<boolean | null>(null);
  useEffect(() => {
    const email = member.contact?.email || member.email;
    if (!email) { setAuthEmailExists(false); return; }
    let cancelled = false;
    setAuthEmailExists(null);
    fetch('/.netlify/functions/check-auth-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (!cancelled && data) setAuthEmailExists(!!data.exists); })
      .catch(() => { /* keep null â€” fall back to Send Invite */ });
    return () => { cancelled = true; };
  }, [member.id]);

  const handleResetPassword = async () => {
    const email = member.contact?.email || member.email;
    if (!email) { showToast('No email address found for this member', 'error'); return; }
    try {
      const { sendPasswordResetEmail } = await import('firebase/auth');
      const { auth } = await import('../../config/firebase');
      await sendPasswordResetEmail(auth, email);
      showToast(`Password reset email sent to ${email}`, 'success');
    } catch (err) {
      showToast(`Failed to send reset email: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  const handleDeleteMember = async () => {
    try {
      setIsDeleting(true);
      await deleteMember(member.id);
      onBack(); // Go back to directory
    } catch (err) {
      // Error is handled in the hook
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // JCI Pillar Diagnosis dynamic scoring
  const pillarDiagnosis = useMemo(() => {
    const tags = member.tendencyTags || [];

    // 1. Individual
    let indTagsScore = tags.includes('Individual') ? 10 : 0;
    const indTagItems = ['Effective Communications', 'Public Speaking', 'JCIM Inspire', 'Mentorship', 'Local Academy', 'Explore/Discover workshop', 'JCIM Empower', 'Leadership Series', 'Workshops', 'Personal Transformation', 'TOYM'];
    indTagsScore += tags.filter(t => indTagItems.includes(t)).length * 4;
    const indBase = 60;
    const indAttendance = Math.round((member.attendanceRate || 0) * 0.15);
    const indPersona = member.personaType?.includes('Learning') ? 10 : 0;
    const individual = Math.min(99, Math.max(20, indBase + Math.min(25, indTagsScore) + indAttendance + indPersona));

    // 2. Business
    let bizTagsScore = tags.includes('Business') ? 10 : 0;
    const bizTagItems = ['JIB', 'CYEA', 'CYE', 'BCP', 'Networking', 'BSP', 'BSP Supercharge'];
    bizTagsScore += tags.filter(t => bizTagItems.includes(t)).length * 5;
    const bizBase = 40;
    const bizWillingness = member.acceptInternationalBusiness === 'Yes' ? 25 : member.acceptInternationalBusiness === 'Willing to Explore' ? 12 : 0;
    const bizProfile = ((member.companyName || member.business?.position)) ? 5 : 0;
    const bizPersona = member.personaType?.includes('Practical') ? 10 : 0;
    const business = Math.min(99, Math.max(15, bizBase + Math.min(25, bizTagsScore) + bizWillingness + bizProfile + bizPersona));

    // 3. Community
    let commTagsScore = tags.includes('Community') ? 10 : 0;
    const commTagItems = ['Project Management', 'Leadership Toolkit', 'Leaders School Program', 'Chairperson', 'Zero Waste', 'Blood Donation', 'SDA'];
    commTagsScore += tags.filter(t => commTagItems.includes(t)).length * 5;
    const commBase = 50;
    const commRole = (member.role === UserRole.BOARD || member.role === UserRole.ADMIN || member.isCurrentBoardMember) ? 20 : member.role === UserRole.MEMBER ? 10 : 0;
    const commPersona = member.personaType?.includes('Backbone') ? 10 : 0;
    const community = Math.min(99, Math.max(15, commBase + Math.min(25, commTagsScore) + commRole + commPersona));

    // 4. International
    let intTagsScore = tags.includes('International') ? 15 : 0;
    const intTagItems = ['ASPAC', 'World Congress', 'Twin Chapter', 'National Convention', 'Conference'];
    intTagsScore += tags.filter(t => intTagItems.includes(t)).length * 5;
    const intBase = 30;
    const intWillingness = member.acceptInternationalBusiness === 'Yes' ? 10 : member.acceptInternationalBusiness === 'Willing to Explore' ? 5 : 0;
    const intConnections = (member.internationalConnections && member.internationalConnections.length > 0) ? 15 : 0;
    const intPersona = member.personaType?.includes('Explorer') ? 10 : 0;
    const international = Math.min(99, Math.max(15, intBase + Math.min(25, intTagsScore) + intWillingness + intConnections + intPersona));

    // Calculate dynamic dominant persona
    let dominant = 'LOCAL COMMUNITY LEADER';
    if (member.personaType) {
      if (member.personaType.includes('Learning')) dominant = 'CONTINUOUS SELF-IMPROVER';
      else if (member.personaType.includes('Practical')) dominant = 'GLOBAL ASSET HUNTER';
      else if (member.personaType.includes('Backbone')) dominant = 'COMMUNITY BACKBONE LEAD';
      else if (member.personaType.includes('Explorer')) dominant = 'GLOBAL HORIZONS EXPLORER';
    } else {
      const maxScore = Math.max(individual, business, community, international);
      if (maxScore === individual) dominant = 'CONTINUOUS SELF-IMPROVER';
      else if (maxScore === business) dominant = 'GLOBAL ASSET HUNTER';
      else if (maxScore === community) dominant = 'COMMUNITY BACKBONE LEAD';
      else if (maxScore === international) dominant = 'GLOBAL HORIZONS EXPLORER';
    }

    return { individual, business, community, international, dominant };
  }, [member]);

  // Elite Leaderboard Radar Data
  const radarData = useMemo(() => {
    const stats = (member.jciCareer?.radarStats ?? member.radarStats) || {
      training: 0,
      leadership: 0,
      events: 0,
      recruitment: 0,
      sponsorship: 0
    };
    return [
      { subject: 'Training', value: stats.training || 0 },
      { subject: 'Leadership', value: stats.leadership || 0 },
      { subject: 'Events', value: stats.events || 0 },
      { subject: 'Recruitment', value: stats.recruitment || 0 },
      { subject: 'Sponsorship', value: stats.sponsorship || 0 }
    ].map(item => ({
      ...item,
      displaySubject: `${item.subject}: ${item.value}`
    }));
  }, [member.jciCareer?.radarStats, member.radarStats]);

  const maxRadarVal = useMemo(() => {
    const vals = radarData.map(d => d.value);
    return Math.max(10, ...vals);
  }, [radarData]);

  return (
    <div className="space-y-6 animate-in slide-in-from-right duration-300 pb-20 md:pb-0">
      {/* Header Card */}
      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-md group">

        {/* â”€â”€ MOBILE hero â”€â”€ */}
        <div className="md:hidden bg-gradient-to-br from-jci-blue via-jci-blue to-jci-navy px-4 pt-4 pb-3 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
          {!isSelfView && (
            <button
              onClick={onBack}
              aria-label="Close member detail"
              className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-white/15 backdrop-blur-sm border border-white/25 flex items-center justify-center text-white/80 hover:bg-white/30 hover:text-white active:scale-95 transition-all"
            >
              <X size={16} />
            </button>
          )}
          <div className="relative flex items-center gap-3">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="p-0.5 bg-white/30 rounded-full shadow-lg">
                <img
                  src={member.avatar || undefined}
                  className="w-16 h-16 rounded-full border-2 border-white/50 bg-slate-200 object-cover"
                  alt={member.name}
                />
              </div>
              <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-jci-navy shadow ${(member.role === UserRole.MEMBER || member.role === UserRole.BOARD || member.role === UserRole.ADMIN) ? 'bg-green-400' : member.role === UserRole.PROBATION ? 'bg-amber-400' : 'bg-slate-400'}`} title={member.role} />
            </div>
            {/* Name + meta */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-white font-black text-xl leading-tight">{member.name}</h1>
              </div>
              {(member.companyName || (member.business?.departmentAndPosition ?? member.departmentAndPosition)) && (
                <p className="text-white/70 text-xs mt-0.5 truncate">
                  <Briefcase size={10} className="inline mr-1 opacity-70" />
                  {[(member.business?.departmentAndPosition ?? member.departmentAndPosition), member.companyName].filter(Boolean).join(' Â· ')}
                </p>
              )}
              <div className="flex flex-col gap-0.5 mt-1 text-white/60 text-[10px]">
                {member.email && <span className="flex items-center gap-1"><Mail size={9} />{member.email}</span>}
                {member.phone && <span className="flex items-center gap-1"><Phone size={9} />{member.phone}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* â”€â”€ MOBILE contact + actions strip â”€â”€ */}
        <div className="md:hidden px-4 py-3 space-y-2.5 border-b border-slate-100">
          <div className="flex flex-wrap gap-1.5">
            <span className="flex items-center gap-1 text-[11px] bg-slate-50 border border-slate-100 rounded-lg px-2 py-1">
              <Shield size={10} className="text-jci-blue shrink-0" />
              <span className="text-jci-blue">{member.role}</span>
              {member.introducer && (
                <>
                  <span className="text-slate-300 mx-0.5">Â·</span>
                  <span className="text-jci-blue">Introducer: {resolveIntroducerShort(member.introducer)}</span>
                </>
              )}
            </span>
            <span className="flex items-center gap-2 px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg">
              {member.linkedin
                ? <a href={member.linkedin} target="_blank" rel="noreferrer" className="text-[#0077B5]"><Linkedin size={13} /></a>
                : <Linkedin size={13} className="text-slate-400" />}
              {member.facebook
                ? <a href={member.facebook} target="_blank" rel="noreferrer" className="text-[#1877F2]"><Facebook size={13} /></a>
                : <Facebook size={13} className="text-slate-400" />}
              {member.instagram
                ? <a href={member.instagram} target="_blank" rel="noreferrer" className="text-[#E1306C]"><Instagram size={13} /></a>
                : <Instagram size={13} className="text-slate-400" />}
              {member.wechat
                ? <span className="text-[#07C160] flex items-center gap-1 text-[10px]"><MessageCircle size={13} /></span>
                : <MessageCircle size={13} className="text-slate-400" />}
            </span>
          </div>
          <div className="flex gap-2">
            {isEditMode ? (
              <>
                <Button variant="primary" size="sm" onClick={handleGlobalSave} className="flex-1 h-9 font-bold">Save Changes</Button>
                <Button variant="outline" size="sm" onClick={() => { setIsEditMode(false); setActiveInlineEditCard(null); setInlineValues(null); }} className="flex-1 h-9 font-bold">Cancel</Button>
              </>
            ) : (
              <>
                {(canEditMembers || isSelfView) && (
                  <Button variant="outline" size="sm" onClick={() => startInlineEdit('basic')} className="flex-1 h-9 font-bold">Edit Profile</Button>
                )}
                {(isAdmin || isDeveloper) && !isSelfView && (
                  <Button
                    variant="outline"
                    size="sm"
                    className={`flex-1 h-9 font-bold ${member.role === UserRole.INACTIVE ? 'text-green-600 border-green-200 hover:bg-green-50' : 'text-amber-600 border-amber-200 hover:bg-amber-50'}`}
                    onClick={async () => {
                      const newRole = member.role === UserRole.INACTIVE ? UserRole.MEMBER : UserRole.INACTIVE;
                      try {
                        await updateMember(member.id, { role: newRole });
                        showToast(`Member ${newRole === UserRole.INACTIVE ? 'deactivated' : 'activated'} successfully`, 'success');
                      } catch (err) {
                        showToast('Failed to update member status', 'error');
                      }
                    }}
                  >
                    {member.role === UserRole.INACTIVE ? 'Activate' : 'Set Inactive'}
                  </Button>
                )}
                {(isAdmin || isDeveloper) && !isSelfView && (
                  authEmailExists ? (
                    <Button variant="outline" size="sm" className="h-9 px-3 text-amber-600 border-amber-200 hover:bg-amber-50 font-bold" onClick={handleResetPassword}>Reset Password</Button>
                  ) : (
                    <Button variant="outline" size="sm" className="h-9 px-3 text-sky-600 border-sky-200 hover:bg-sky-50 font-bold" onClick={handleSendInviteEmail}>Send Invite</Button>
                  )
                )}
                {isDeveloper && !isSelfView && (
                  <Button variant="outline" size="sm" className="h-9 px-3 text-red-500 border-red-200 hover:bg-red-50 font-bold" onClick={() => setShowDeleteConfirm(true)}>Delete</Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* â”€â”€ DESKTOP hero + strip wrapper â”€â”€ */}
        <div className="hidden md:block relative">
          {/* åŒºå—ä¸€: banner */}
          <div className="h-40 bg-gradient-to-br from-jci-blue via-jci-blue to-jci-navy relative overflow-hidden">
            <div className="absolute inset-0 opacity-20 mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-700"></div>
            {!isSelfView && (
              <button
                onClick={onBack}
                aria-label="Close member detail"
                className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm border border-white/25 flex items-center justify-center text-white/80 hover:bg-white/30 hover:text-white active:scale-95 transition-all"
              >
                <X size={17} />
              </button>
            )}
            {/* Name, Tier Badge, position, company â€” pl-52 clears avatar */}
            <div className="absolute bottom-4 left-0 right-0 px-6 pl-52 flex flex-col justify-end gap-1">
              <div className="flex flex-row items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-black text-white tracking-tight leading-tight break-words drop-shadow">{member.name}</h1>
              </div>
              {(member.companyName || (member.business?.departmentAndPosition ?? member.departmentAndPosition)) && (
                <p className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
                  <Briefcase size={13} className="text-white/50 shrink-0" />
                  {[(member.business?.departmentAndPosition ?? member.departmentAndPosition), member.companyName].filter(Boolean).join(' Â· ')}
                </p>
              )}
            </div>
          </div>

          {/* åŒºå—äºŒ: avatar â€” absolute, straddles banner/strip boundary (top-24 = 10rem - 4rem) */}
          <div className="absolute left-6 top-24 z-20">
            <div className="relative">
              <div className="p-1 bg-white rounded-full shadow-xl">
                <img
                  src={member.avatar || undefined}
                  className="w-32 h-32 rounded-full border-4 border-slate-50 bg-slate-100 object-cover"
                  alt={member.name}
                />
              </div>
              <div className={`absolute bottom-2 right-2 w-8 h-8 rounded-full border-4 border-white shadow-sm ${(member.role === UserRole.MEMBER || member.role === UserRole.BOARD || member.role === UserRole.ADMIN) ? 'bg-green-500' : member.role === UserRole.PROBATION ? 'bg-amber-500' : 'bg-slate-500'}`} title={member.role} />
            </div>
          </div>

          {/* åŒºå—ä¸‰: contact + actions strip â€” directly below banner, pl-52 clears avatar */}
          <div className="px-6 pl-52 py-3 border-b border-slate-100 flex items-center gap-4">
            {/* å·¦ï¼šchips */}
            <div className="flex-1 flex flex-col gap-1.5">
              {/* è¡Œä¸€ï¼šemail / phone */}
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-lg border border-slate-100 text-xs font-medium text-slate-600"><Mail size={12} className="text-jci-blue shrink-0" />{member.email}</span>
                {member.phone && <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-lg border border-slate-100 text-xs font-medium text-slate-600"><Phone size={12} className="text-jci-blue shrink-0" />{member.phone}</span>}
              </div>
              {/* è¡ŒäºŒï¼šrole + introducer + ç¤¾äº¤åª’ä½“ */}
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-lg border border-slate-100 text-xs font-medium">
                  <Shield size={12} className="text-jci-blue shrink-0" />
                  <span className="text-jci-blue">{member.role}</span>
                  {member.introducer && (
                    <>
                      <span className="text-slate-300 mx-0.5">Â·</span>
                      <span className="text-jci-blue">Introducer: {resolveIntroducerShort(member.introducer)}</span>
                    </>
                  )}
                </span>
                <span className="flex items-center gap-2 px-2 py-1 bg-slate-50 rounded-lg border border-slate-100">
                  {member.linkedin
                    ? <a href={member.linkedin} target="_blank" rel="noreferrer" className="text-[#0077B5]"><Linkedin size={14} /></a>
                    : <Linkedin size={14} className="text-slate-400" />}
                  {member.facebook
                    ? <a href={member.facebook} target="_blank" rel="noreferrer" className="text-[#1877F2]"><Facebook size={14} /></a>
                    : <Facebook size={14} className="text-slate-400" />}
                  {member.instagram
                    ? <a href={member.instagram} target="_blank" rel="noreferrer" className="text-[#E1306C]"><Instagram size={14} /></a>
                    : <Instagram size={14} className="text-slate-400" />}
                  {member.wechat
                    ? <span className="text-[#07C160] flex items-center gap-1 text-xs"><MessageCircle size={14} /></span>
                    : <MessageCircle size={14} className="text-slate-400" />}
                </span>
              </div>

            </div>
            {/* å³ï¼šæ“ä½œæŒ‰é’®ç»„ */}
            <div className="flex gap-2 shrink-0">
              {isEditMode ? (
                <>
                  <Button variant="primary" size="sm" onClick={handleGlobalSave} className="flex-none h-10 px-6 font-bold">Save Changes</Button>
                  <Button variant="outline" size="sm" onClick={() => { setIsEditMode(false); setActiveInlineEditCard(null); setInlineValues(null); }} className="flex-none h-10 px-6 font-bold">Cancel</Button>
                </>
              ) : (
                <>
                  {(canEditMembers || isSelfView) && (
                    <Button variant="outline" size="sm" onClick={() => startInlineEdit('basic')} className="flex-none h-10 px-6 font-bold">Edit Profile</Button>
                  )}
                  {(isAdmin || isDeveloper) && !isSelfView && (
                    <Button
                      variant="outline"
                      size="sm"
                      className={`flex-none h-10 px-6 font-bold ${member.role === UserRole.INACTIVE ? 'text-green-600 border-green-200 hover:bg-green-50' : 'text-amber-600 border-amber-200 hover:bg-amber-50'}`}
                      onClick={async () => {
                        const newRole = member.role === UserRole.INACTIVE ? UserRole.MEMBER : UserRole.INACTIVE;
                        try {
                          await updateMember(member.id, { role: newRole });
                          showToast(`Member ${newRole === UserRole.INACTIVE ? 'deactivated' : 'activated'} successfully`, 'success');
                        } catch (err) {
                          showToast('Failed to update member status', 'error');
                        }
                      }}
                    >
                      {member.role === UserRole.INACTIVE ? 'Activate Member' : 'Set Inactive'}
                    </Button>
                  )}
                  {(isAdmin || isDeveloper) && !isSelfView && (
                    authEmailExists ? (
                      <Button variant="outline" size="sm" className="flex-none h-10 px-6 text-amber-600 border-amber-200 hover:bg-amber-50 font-bold" onClick={handleResetPassword}>Reset Password</Button>
                    ) : (
                      <Button variant="outline" size="sm" className="flex-none h-10 px-6 text-sky-600 border-sky-200 hover:bg-sky-50 font-bold" onClick={handleSendInviteEmail}>Send Invite</Button>
                    )
                  )}
                  {isDeveloper && !isSelfView && (
                    <Button variant="outline" size="sm" className="flex-none h-10 px-6 text-red-600 border-red-200 hover:bg-red-50 font-bold" onClick={() => setShowDeleteConfirm(true)}>Delete</Button>
                  )}
                </>
              )}
            </div>
          </div>{/* end åŒºå—ä¸‰ */}
        </div>{/* end desktop hero wrapper */}

        <div className="grid grid-cols-4 gap-0 border-t border-slate-100 divide-x divide-slate-100 bg-slate-50/50">
          <div className="p-2 md:p-4 text-center hover:bg-white transition-colors group">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Coins size={12} className="text-jci-blue" />
              <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Total Points</p>
            </div>
            <p className="text-lg md:text-2xl font-black text-jci-blue">{member.points.toLocaleString()}</p>
          </div>
          <div className="p-2 md:p-4 text-center hover:bg-white transition-colors">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Calendar size={12} className="text-slate-400" />
              <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Join Date</p>
            </div>
            <p className="text-xs md:text-base font-black text-slate-900 leading-snug">{formatDateToDDMMMYYYY(member.joinDate)}</p>
          </div>
          <div className="p-2 md:p-4 text-center hover:bg-white transition-colors">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <CalendarCheck size={12} className="text-slate-400" />
              <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Attendance</p>
            </div>
            {(() => {
              const att = getAttendanceDisplay(member);
              return (
                <>
                  <p className="text-lg md:text-2xl font-black text-slate-900 whitespace-nowrap">{att.text}</p>
                  <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide">check-ins / months</p>
                </>
              );
            })()}
          </div>
          <div className="p-2 md:p-4 text-center flex flex-col items-center justify-center hover:bg-white transition-colors">
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <CheckCircle size={12} className="text-slate-400" />
              <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Dues {new Date().getFullYear()}</p>
            </div>
            <Badge
              variant={
                (member.membership?.[String(new Date().getFullYear())]?.status === 'paid' ||
                  member.membership?.[String(new Date().getFullYear())]?.status === 'over paid') ? 'success' :
                  member.membership?.[String(new Date().getFullYear())]?.status === 'pending' ? 'warning' : 'error'
              }
              className="px-4 font-black capitalize"
            >
              {member.membership?.[String(new Date().getFullYear())]?.status || 'pending'}
            </Badge>
          </div>
        </div>
      </section>

      {/* NEW: Wolf-like Persona & Ambition Visualizer (Phase 1) */}
      {canEditMembers && <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white border-none shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Target size={120} />
          </div>
          <div className="relative z-10 p-2">
            <div className="flex justify-between items-center mb-4 gap-2">
              <h3 className="text-sm font-black text-blue-300 uppercase tracking-widest flex items-center gap-2">
                <Sparkles size={16} /> JCI Pillar Diagnosis
              </h3>
              {(canEditMembers || isSelfView) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAssessmentModal(true)}
                  className="text-[10px] bg-white/10 hover:bg-white/20 text-white border border-white/20 px-2.5 py-1 h-auto flex items-center gap-1 font-bold rounded-lg transition-all"
                >
                  <Settings size={12} />
                  Update Assessment
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Individual', val: pillarDiagnosis.individual, color: 'bg-blue-400' },
                { label: 'Business', val: pillarDiagnosis.business, color: 'bg-emerald-400' },
                { label: 'Community', val: pillarDiagnosis.community, color: 'bg-purple-400' },
                { label: 'International', val: pillarDiagnosis.international, color: 'bg-orange-400' }
              ].map((p, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter">
                    <span>{p.label}</span>
                    <span>{p.val}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${p.val}%` }}
                      className={`h-full ${p.color} shadow-[0_0_8px_rgba(255,255,255,0.3)]`}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-3 bg-white/5 rounded-xl border border-white/10">
              <p className="text-[10px] text-blue-200 font-bold uppercase mb-1">Dominant Persona</p>
              <p className="text-lg font-black italic text-white flex items-center gap-2">
                {pillarDiagnosis.dominant}
                <Badge className="bg-jci-blue text-blue text-[8px]">AI Profile</Badge>
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-white border-2 border-slate-900 border-b-8 border-r-8 hover:translate-x-1 hover:translate-y-1 transition-all flex flex-col justify-between">
          <div className="p-2 h-full flex flex-col justify-between">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <Target size={16} className="text-jci-blue animate-pulse" /> Elite Leaderboard Radar
              </h3>
              <div className="relative">
                <select
                  value={radarYear}
                  onChange={(e) => setRadarYear(Number(e.target.value))}
                  className="appearance-none bg-slate-100 text-jci-blue text-[10px] font-black uppercase tracking-wider rounded-full pl-2.5 pr-6 py-1 border border-slate-200 cursor-pointer hover:bg-slate-200/70 transition-all focus:outline-none focus:ring-1 focus:ring-jci-blue/50"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%230097D7' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}
                >
                  {availableYears.map(y => (
                    <option key={y} value={y} className="bg-white text-slate-900">{y}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex-1 min-h-[220px] w-full relative">
              <PointsSourceRadarChart memberId={member.id} year={radarYear} lightTheme={true} />
            </div>
          </div>
        </Card>
      </div>}

      {/* Tab Selector */}
      <div className="border-b border-slate-200 mb-6">
        <Tabs
          tabs={[
            { id: 'basic', label: 'Basic Information' },
            { id: 'professional', label: 'Professional & Business' },
            { id: 'career', label: 'JCI Career' },
            { id: 'activities', label: 'Activities Log' }
          ]}
          activeTab={activeDetailTab}
          onTabChange={(tabId) => setActiveDetailTab(tabId as any)}
          variant="underline"
        />
      </div>

      {activeDetailTab !== 'activities' && (
        <div className="grid lg:grid-cols-3 gap-6">
          {activeDetailTab !== 'professional' && (
            <div className="space-y-6">
              {activeDetailTab === 'basic' && (
                <>
                  <Card
                    title="Basic Information"
                  >
                    {isEditMode && inlineValues ? (
                      <div className="space-y-4 text-sm">
                        <div className="flex flex-row items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white bg-blue-50 shadow-sm shrink-0">
                            {inlineValues.avatar ? (
                              <img src={inlineValues._avatarTs ? `${inlineValues.avatar}?v=${inlineValues._avatarTs}` : inlineValues.avatar} alt={inlineValues.name || member.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xl font-black text-jci-blue">
                                {(inlineValues.name || member.name || 'M').charAt(0)}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 space-y-3">
                            <div>
                              <p className="font-bold text-slate-900">Member Avatar</p>
                              <p className="text-xs text-slate-500 mt-0.5">Upload a profile photo for member-facing pages.</p>
                            </div>
                            {avatarUploading && (
                              <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                                <div className="h-full bg-jci-blue transition-all" style={{ width: `${avatarUploadProgress}%` }} />
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2">
                              <label className={`inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-bold transition-colors ${avatarUploading ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-jci-blue text-white hover:bg-jci-navy cursor-pointer'}`}>
                                {avatarUploading ? 'Uploading...' : 'Upload'}
                                <input type="file" accept="image/*" className="hidden" disabled={avatarUploading} onChange={handleInlineAvatarUpload} />
                              </label>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Name (Short)<span className="text-red-500 ml-1">*</span></label>
                            <input
                              type="text"
                              value={inlineValues.name}
                              onChange={e => setInlineValues({ ...inlineValues, name: e.target.value })}
                              required
                              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20"
                            />
                          </div>
                          <div>
                            <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Full Name (ID)</label>
                            <input
                              type="text"
                              value={inlineValues.fullName}
                              onChange={e => setInlineValues({ ...inlineValues, fullName: e.target.value })}
                              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20"
                            />
                          </div>
                          <div>
                            <label className="text-slate-500 block text-xs uppercase font-medium mb-1">ID Number</label>
                            <input
                              type="text"
                              value={inlineValues.idNumber}
                              onChange={e => {
                                const ic = e.target.value;
                                const updates: any = { idNumber: ic };
                                if (isMalaysianIC(ic)) {
                                  const bp = getBirthPlaceFromIC(ic); if (bp) updates.birthPlace = bp;
                                  const dob = getDateOfBirthFromIC(ic); if (dob) updates.dateOfBirth = dob;
                                  const gender = getGenderFromIC(ic); if (gender) updates.gender = gender;
                                }
                                setInlineValues({ ...inlineValues, ...updates });
                              }}
                              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20"
                            />
                          </div>
                          <div>
                            <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Date of Birth</label>
                            <input
                              type="date"
                              value={inlineValues.dateOfBirth}
                              onChange={e => setInlineValues({ ...inlineValues, dateOfBirth: e.target.value })}
                              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20"
                            />
                          </div>
                          <div>
                            <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Nationality</label>
                            <Combobox
                              options={nationalityOptionsForValue(inlineValues.nationality)}
                              value={inlineValues.nationality}
                              onChange={val => setInlineValues({ ...inlineValues, nationality: val })}
                              placeholder="Select nationality..."
                            />
                          </div>
                          <div>
                            <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Birth Place</label>
                            <input
                              type="text"
                              value={inlineValues.birthPlace || ''}
                              onChange={e => setInlineValues({ ...inlineValues, birthPlace: e.target.value })}
                              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20"
                            />
                          </div>
                          <div>
                            <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Gender</label>
                            <select
                              value={inlineValues.gender}
                              onChange={e => setInlineValues({ ...inlineValues, gender: e.target.value })}
                              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 bg-white"
                            >
                              <option value="">Select Gender</option>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Ethnicity</label>
                            <select
                              value={inlineValues.ethnicity}
                              onChange={e => setInlineValues({ ...inlineValues, ethnicity: e.target.value })}
                              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 bg-white"
                            >
                              <option value="">Select Ethnicity</option>
                              <option value="Chinese">Chinese</option>
                              <option value="Malay">Malay</option>
                              <option value="Indian">Indian</option>
                              <option value="Others">Others</option>
                            </select>
                          </div>
                          <div className="col-span-2">
                            <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Dietary Preference</label>
                            <div className="flex w-full rounded-lg border border-slate-300 overflow-hidden divide-x divide-slate-200">
                              {(['Vegetarian', 'Halal', 'Normal'] as const).map((opt) => (
                                <label key={opt} className="cursor-pointer flex-1 flex">
                                  <input type="radio" name="inlineDietaryPreference" value={opt.toLowerCase()} checked={inlineValues.dietaryPreference === opt.toLowerCase()} onChange={e => setInlineValues({ ...inlineValues, dietaryPreference: e.target.value })} className="hidden" />
                                  <span className={`flex-1 text-center px-1 md:px-4 py-2 text-[10px] md:text-sm font-medium transition-colors ${inlineValues.dietaryPreference === opt.toLowerCase() ? 'bg-jci-blue text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>{opt}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Introducer</label>
                            <IntroducerSelector
                              value={inlineValues.introducer || ''}
                              onChange={val => setInlineValues({ ...inlineValues, introducer: val })}
                              members={members}
                              projects={allProjects}
                            />
                          </div>
                        </div>

                        <div className="border-t pt-3">
                          <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Personal Biography</label>
                          <textarea
                            value={inlineValues.bio}
                            onChange={e => setInlineValues({ ...inlineValues, bio: e.target.value })}
                            rows={2}
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 resize-y"
                          />
                        </div>

                        <div className="border-t pt-3">
                          <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Hobbies</label>
                          <div className="flex flex-wrap gap-1.5 p-2 border border-slate-200 rounded-lg bg-slate-50">
                            {HOBBY_OPTIONS.map(opt => {
                              const isChecked = inlineValues.hobbies.includes(opt);
                              return (
                                <label key={opt} className="cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={e => {
                                      const newHobbies = e.target.checked
                                        ? [...inlineValues.hobbies, opt]
                                        : inlineValues.hobbies.filter((h: string) => h !== opt);
                                      setInlineValues({ ...inlineValues, hobbies: newHobbies });
                                    }}
                                    className="hidden"
                                  />
                                  <span className={`inline-block px-2 py-1 rounded text-[10px] font-semibold border ${isChecked
                                    ? 'bg-jci-blue text-white border-jci-blue'
                                    : 'bg-white text-slate-600 border-slate-300 hover:border-jci-blue'
                                    }`}>
                                    {opt}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <div className="border-t pt-3">
                          <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Skills</label>
                          <input
                            type="text"
                            value={inlineValues.skills}
                            onChange={e => setInlineValues({ ...inlineValues, skills: e.target.value })}
                            placeholder="e.g. Public Speaking, Event Management (comma separated)"
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20"
                          />
                        </div>

                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-slate-500 block text-xs uppercase font-medium">Full Name (ID)</span>
                            <p className="font-medium text-slate-900">{member.fullName || 'Not provided'}</p>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-xs uppercase font-medium">ID Number</span>
                            <p className="font-medium text-slate-900 uppercase">{member.idNumber || 'Not provided'}</p>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-xs uppercase font-medium">Date of Birth</span>
                            <p className="font-medium text-slate-900">{formatDateToDDMMMYYYY(member.dateOfBirth)}</p>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-xs uppercase font-medium">Nationality</span>
                            <p className="font-medium text-slate-900">{member.nationality || 'Not provided'}</p>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-xs uppercase font-medium">Birth Place</span>
                            {(() => {
                              const storedBp = member.general?.birthPlace ?? member.birthPlace;
                              const bp = storedBp
                                || (isMalaysianIC(member.idNumber || '') ? getBirthPlaceFromIC(member.idNumber || '') : '');
                              return (
                                <p className="font-medium text-slate-900 flex items-center gap-1.5">
                                  {bp || 'Not provided'}
                                  {!storedBp && bp && (
                                    <span className="text-[10px] text-jci-blue font-normal">from IC</span>
                                  )}
                                </p>
                              );
                            })()}
                          </div>
                          <div>
                            <span className="text-slate-500 block text-xs uppercase font-medium">Gender</span>
                            <p className="font-medium text-slate-900">{member.gender || 'Not provided'}</p>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-xs uppercase font-medium">Ethnicity</span>
                            <p className="font-medium text-slate-900">{(member.general?.ethnicity ?? member.ethnicity) || 'Not provided'}</p>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-xs uppercase font-medium">Dietary Preference</span>
                            <p className="font-medium text-slate-900 capitalize">{(member.general?.dietaryPreference ?? member.dietaryPreference) || 'Not provided'}</p>
                          </div>
                        </div>

                        <div className="border-t pt-3">
                          <span className="text-slate-500 block text-xs uppercase font-medium mb-1">Introducer</span>
                          <p className="text-sm font-medium text-slate-900">{resolveIntroducerDisplay(member.introducer)}</p>
                        </div>

                        <div className="border-t pt-3">
                          <span className="text-slate-500 block text-xs uppercase font-medium mb-1">Personal Biography</span>
                          <p className="text-sm text-slate-600 line-clamp-4 italic">
                            {member.bio || 'No biography provided.'}
                          </p>
                        </div>

                        <div className="border-t pt-3">
                          <span className="text-slate-500 block text-xs uppercase font-medium mb-2">Hobbies</span>
                          <div className="flex flex-wrap gap-1">
                            {Array.isArray(member.hobbies) && member.hobbies.length > 0 ? (
                              member.hobbies.map(hobby => (
                                <Badge key={hobby} variant="neutral" className="text-[10px]">{hobby}</Badge>
                              ))
                            ) : (
                              <span className="text-xs text-slate-400 italic">No hobbies listed</span>
                            )}
                          </div>
                        </div>

                        <div className="border-t pt-3">
                          <span className="text-slate-500 block text-xs uppercase font-medium mb-2">Skills</span>
                          <div className="flex flex-wrap gap-1">
                            {Array.isArray(member.skills) && member.skills.length > 0 ? (
                              member.skills.map(skill => (
                                <Badge key={skill} variant="neutral" className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100">{skill}</Badge>
                              ))
                            ) : (
                              <span className="text-xs text-slate-400 italic">No skills listed</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>

                  {(isAdmin || isDeveloper) && (
                    <Button variant="outline" size="sm" className="w-full" onClick={handleAnalyzeChurn} isLoading={loadingChurnPrediction}>
                      <Sparkles size={14} className="mr-2" /> Analyze Churn Risk
                    </Button>
                  )}
                </>
              )}

              {activeDetailTab === 'career' && (
                <Card title="Mentorship & Growth">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Current Mentor</h4>
                      {mentor ? (
                        <div className="flex items-center gap-3 p-3 border border-slate-100 rounded-lg hover:bg-slate-50 cursor-pointer">
                          <img src={mentor.avatar || undefined} className="w-10 h-10 rounded-full" alt="" />
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{mentor.name}</p>
                            <p className="text-xs text-slate-500">{mentor.role}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 border border-dashed border-slate-300 rounded-lg text-center">
                          <p className="text-sm text-slate-500 mb-2">No mentor assigned</p>
                          <Button size="sm" variant="outline" onClick={handleFindMentors} isLoading={loadingMatches}>
                            <Zap size={14} className="mr-2" /> Find Mentor
                          </Button>
                        </div>
                      )}
                    </div>

                    {mentees.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Mentees</h4>
                        <div className="space-y-2">
                          {mentees.map(m => (
                            <div key={m.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                              <img src={m.avatar || undefined} className="w-8 h-8 rounded-full" alt="" />
                              <span className="text-sm font-medium">{m.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {activeDetailTab === 'basic' && (
                <Card title="Hobby Clubs">
                  {loadingClubs ? (
                    <div className="text-center py-4 text-slate-400 text-sm">Loading clubs...</div>
                  ) : memberClubs.length > 0 ? (
                    <div className="space-y-2">
                      {memberClubs.map(club => (
                        <div key={club.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-900">{club.name}</p>
                            <p className="text-xs text-slate-500">{club.category}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-slate-400 text-sm">Not a member of any clubs</div>
                  )}
                </Card>
              )}

              {activeDetailTab === 'career' && (
                <Card title="Membership & Dues">
                  {isEditMode && inlineValues ? (
                    <div className="space-y-4 text-sm">
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Senatorship Number</label>
                          <input
                            type="text"
                            placeholder="e.g. 12345"
                            value={inlineValues.senatorshipId}
                            onChange={e => setInlineValues({ ...inlineValues, senatorshipId: e.target.value })}
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                          />
                        </div>
                        <div className="flex items-center gap-4 py-1">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={inlineValues.senatorCertified}
                              onChange={e => setInlineValues({ ...inlineValues, senatorCertified: e.target.checked })}
                              className="w-4 h-4 rounded border-slate-300 text-jci-blue focus:ring-jci-blue/20"
                            />
                            <span className="text-sm font-medium text-slate-700">Senator Certified</span>
                          </label>
                        </div>
                        <div className="flex items-center gap-4 py-1">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={inlineValues.senatorshipBoardValidated}
                              onChange={e => setInlineValues({ ...inlineValues, senatorshipBoardValidated: e.target.checked })}
                              className="w-4 h-4 rounded border-slate-300 text-jci-blue focus:ring-jci-blue/20"
                            />
                            <span className="text-sm font-medium text-slate-700">Board Validated</span>
                          </label>
                        </div>
                        {inlineValues.senatorshipBoardValidated && (
                          <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-200">
                            <div>
                              <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Validated By</label>
                              <input
                                type="text"
                                value={inlineValues.senatorshipValidatedBy}
                                onChange={e => setInlineValues({ ...inlineValues, senatorshipValidatedBy: e.target.value })}
                                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                              />
                            </div>
                            <div>
                              <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Validated At</label>
                              <input
                                type="date"
                                value={inlineValues.senatorshipValidatedAt}
                                onChange={e => setInlineValues({ ...inlineValues, senatorshipValidatedAt: e.target.value })}
                                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <span className="text-xs text-slate-500 uppercase font-bold">Type</span>
                          <MembershipTypeDisplay
                            member={{
                              nationality: member.nationality,
                              dateOfBirth: member.dateOfBirth,
                              senatorCertified: member.senatorCertified,
                              senatorshipId: member.senatorshipId,
                              role: member.role,
                              membershipType: member.membershipType,
                            }}
                          />
                        </div>
                        {member.senatorCertified && (
                          <Badge variant="success" className="animate-pulse">Senator Certified</Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">Current Status ({new Date().getFullYear()}):</span>
                          <Badge
                            variant={
                              (member.membership?.[String(new Date().getFullYear())]?.status === 'paid' ||
                                member.membership?.[String(new Date().getFullYear())]?.status === 'over paid') ? 'success' :
                                member.membership?.[String(new Date().getFullYear())]?.status === 'pending' ? 'warning' : 'error'
                            }
                            className="capitalize"
                          >
                            {member.membership?.[String(new Date().getFullYear())]?.status || 'pending'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">Last Payment Amount:</span>
                          <span className="font-bold">RM {member.membership?.[String(new Date().getFullYear())]?.amount || 0}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">Last Payment Date:</span>
                          <span className="font-medium text-slate-900">{formatDateToDDMMMYYYY(member.membership?.[String(new Date().getFullYear())]?.paymentDate)}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowPaymentHistoryModal(true)}
                          className="mt-2 w-full font-bold text-slate-700 hover:text-jci-blue border-slate-200 hover:border-jci-blue flex items-center justify-center gap-1.5"
                        >
                          <Clock size={12} /> View Payment History
                        </Button>
                      </div>

                      {/* Senator Details Section */}
                      <div className="border-t pt-4 space-y-3">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Senatorship Details</h4>
                        <div className="grid grid-cols-1 gap-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Certified Senator:</span>
                            <Badge variant={member.senatorCertified ? 'success' : 'neutral'}>
                              {member.senatorCertified ? 'Yes' : 'No'}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Senator Number:</span>
                            <span className="font-semibold text-slate-900">{member.senatorshipId || 'N/A'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Board Validated:</span>
                            <Badge variant={member.senatorshipBoardValidated ? 'success' : 'neutral'}>
                              {member.senatorshipBoardValidated ? 'Validated' : 'Pending'}
                            </Badge>
                          </div>
                          {member.senatorshipBoardValidated && (member.jciCareer?.senatorshipValidatedBy ?? member.senatorshipValidatedBy) && (
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span>Validated By:</span>
                              <span className="font-medium">{member.jciCareer?.senatorshipValidatedBy ?? member.senatorshipValidatedBy}</span>
                            </div>
                          )}
                          {member.senatorshipBoardValidated && (member.jciCareer?.senatorshipValidatedAt ?? member.senatorshipValidatedAt) && (
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span>Validated At:</span>
                              <span className="font-medium">{formatDateToDDMMMYYYY((member.jciCareer?.senatorshipValidatedAt ?? member.senatorshipValidatedAt)!)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              )}
            </div>
          )}

          <div className={`${activeDetailTab === 'professional' ? 'lg:col-span-3' : 'lg:col-span-2'} space-y-6`}>
            {activeDetailTab === 'professional' && (member.companyName || member.industry) && activeInlineEditCard !== 'professional' && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5 bg-gradient-to-r from-slate-50 to-white rounded-2xl border border-slate-200">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-black text-slate-900 truncate">{member.companyName || 'â€”'}</h3>
                  <p className="text-sm text-slate-500 mt-0.5">{[(member.business?.departmentAndPosition ?? member.departmentAndPosition), member.industry].filter(Boolean).join(' Â· ')}</p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {member.industry && (
                    <span className="px-3 py-1 rounded-full bg-blue-50 text-jci-blue text-xs font-bold border border-blue-100">{member.industry}</span>
                  )}
                  {member.acceptInternationalBusiness && member.acceptInternationalBusiness !== 'No' && (
                    <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">ðŸŒ Intl Business</span>
                  )}
                  {member.companyWebsite && (
                    <a href={member.companyWebsite} target="_blank" rel="noreferrer" className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200 hover:bg-slate-200 transition-colors flex items-center gap-1">
                      <ArrowUpRight size={11} /> Website
                    </a>
                  )}
                </div>
              </div>
            )}
            {activeDetailTab === 'professional' && (
              <Card
                title="Professional & Business"
              >
                {isEditMode && inlineValues ? (
                  <div className="space-y-4 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Company Name</label>
                        <input
                          type="text"
                          value={inlineValues.companyName}
                          onChange={e => setInlineValues({ ...inlineValues, companyName: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                        />
                      </div>
                      <div>
                        <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Company Website</label>
                        <input
                          type="text"
                          value={inlineValues.companyWebsite}
                          onChange={e => setInlineValues({ ...inlineValues, companyWebsite: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                        />
                      </div>
                      <div>
                        <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Position / Title</label>
                        <input
                          type="text"
                          value={inlineValues.departmentAndPosition}
                          onChange={e => setInlineValues({ ...inlineValues, departmentAndPosition: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                        />
                      </div>
                      <div>
                        <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Level of Mgmt</label>
                        <select
                          value={inlineValues.levelOfManagement}
                          onChange={e => setInlineValues({ ...inlineValues, levelOfManagement: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue bg-white"
                        >
                          <option value="">Select Level</option>
                          <option value="Top">Top</option>
                          <option value="Middle">Middle</option>
                          <option value="Frontline">Frontline</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Industry</label>
                        <select
                          value={inlineValues.industry}
                          onChange={e => setInlineValues({ ...inlineValues, industry: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue bg-white"
                        >
                          <option value="">Select Industry</option>
                          {INDUSTRY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Intl. Business Engagement</label>
                        <select
                          value={inlineValues.acceptInternationalBusiness}
                          onChange={e => setInlineValues({ ...inlineValues, acceptInternationalBusiness: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue bg-white"
                        >
                          <option value="">Select Option</option>
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                          <option value="Willing to Explore">Willing to Explore</option>
                        </select>
                      </div>
                    </div>

                    <div className="border-t pt-3">
                      <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Company Description</label>
                      <textarea
                        value={inlineValues.companyDescription}
                        onChange={e => setInlineValues({ ...inlineValues, companyDescription: e.target.value })}
                        rows={2}
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue resize-y"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t pt-3">
                      <div className="col-span-2">
                        <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Business Categories</label>
                        <MultiSelectDropdown
                          options={BUSINESS_CATEGORIES_OPTIONS}
                          selected={inlineValues.businessCategory}
                          onChange={selected => setInlineValues({ ...inlineValues, businessCategory: selected })}
                          placeholder="Select categories..."
                        />
                      </div>
                      <div>
                        <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Ideal Referral Industry</label>
                        <MultiSelectDropdown
                          options={INDUSTRY_OPTIONS}
                          selected={inlineValues.idealReferralIndustry ? inlineValues.idealReferralIndustry.split(', ').filter(Boolean) : []}
                          onChange={selected => setInlineValues({ ...inlineValues, idealReferralIndustry: selected.join(', ') })}
                          placeholder="Select industries..."
                        />
                      </div>
                      <div>
                        <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Ideal Referral</label>
                        <MultiSelectDropdown
                          options={IDEAL_REFERRAL_OPTIONS.map(opt => opt.label)}
                          selected={inlineValues.idealReferral ? inlineValues.idealReferral.split(', ').filter(Boolean) : []}
                          onChange={selected => setInlineValues({ ...inlineValues, idealReferral: selected.join(', ') })}
                          placeholder="Select referrals..."
                        />
                      </div>
                    </div>

                    <div className="border-t pt-3">
                      <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Special Member Offer</label>
                      <input
                        type="text"
                        value={inlineValues.specialOffer}
                        onChange={e => setInlineValues({ ...inlineValues, specialOffer: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                      />
                    </div>

                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Col 1 */}
                      <div className="space-y-4 text-sm md:border-r md:border-slate-100 md:pr-6">
                        <div>
                          <span className="text-slate-500 text-xs uppercase font-medium">Company Name</span>
                          <p className="font-bold text-slate-900 leading-tight mt-0.5">{member.companyName || 'Freelance / Not Provided'}</p>
                          {member.companyWebsite && (
                            <a href={member.companyWebsite.startsWith('http') ? member.companyWebsite : `https://${member.companyWebsite}`} target="_blank" rel="noopener noreferrer" className="text-xs text-jci-blue hover:underline block mt-1">
                              {member.companyWebsite}
                            </a>
                          )}
                        </div>
                        <div>
                          <span className="text-slate-500 text-xs uppercase font-medium">Position</span>
                          <p className="font-medium text-slate-900 mt-0.5">{(member.business?.departmentAndPosition ?? member.departmentAndPosition) || 'Not provided'}</p>
                        </div>
                        <div>
                          <span className="text-slate-500 text-xs uppercase font-medium">Level of Mgmt</span>
                          <p className="font-medium text-slate-900 mt-0.5">{(member.business?.levelOfManagement ?? member.levelOfManagement) || 'Not provided'}</p>
                        </div>
                        <div>
                          <span className="text-slate-500 text-xs uppercase font-medium">Industry</span>
                          <p className="font-medium text-slate-900 mt-0.5">{member.industry || 'Not provided'}</p>
                        </div>
                        <div>
                          <span className="text-slate-500 text-xs uppercase font-medium">Intl. Business</span>
                          <p className="font-medium text-slate-900 mt-0.5">{member.acceptInternationalBusiness || 'Unknown'}</p>
                        </div>
                        <div>
                          <span className="text-slate-500 text-xs uppercase font-medium">Business Categories</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Array.isArray(member.businessCategory) && member.businessCategory.length > 0 ? (
                              member.businessCategory.map((cat, idx) => (
                                <Badge key={idx} variant="neutral" className="text-[10px]">{cat}</Badge>
                              ))
                            ) : (
                              <span className="text-slate-400 italic">None</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Col 2-3 */}
                      <div className="md:col-span-2 space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                          <div>
                            <span className="text-slate-500 text-xs uppercase font-medium">Ideal Referral Industry</span>
                            <div className="mt-1 text-slate-700 font-medium">
                              {member.idealReferralIndustry ? (
                                <span>{member.idealReferralIndustry}</span>
                              ) : (
                                <span className="text-slate-400 italic font-normal">None</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <span className="text-slate-500 text-xs uppercase font-medium">Ideal Referral</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Array.isArray(member.idealReferrals) && member.idealReferrals.length > 0 ? (
                                member.idealReferrals.map((type, idx) => (
                                  <Badge key={idx} variant="info" className="text-[10px] bg-sky-50 text-sky-600 border-sky-100">{type}</Badge>
                                ))
                              ) : member.idealReferral ? (
                                <span className="text-sm text-slate-700 font-medium">{member.idealReferral}</span>
                              ) : (
                                <span className="text-slate-400 italic font-normal">None</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {(member.business?.companyDescription ?? member.companyDescription) && (
                          <div className="p-3 bg-slate-50 rounded-lg border-l-4 border-slate-300">
                            <span className="text-slate-500 text-xs uppercase font-bold mb-1 block">Company Description</span>
                            <p className="text-xs text-slate-600 leading-relaxed">{member.business?.companyDescription ?? member.companyDescription}</p>
                          </div>
                        )}

                        {member.specialOffer && (
                          <div className="p-3 bg-jci-blue/5 rounded-lg border-l-4 border-jci-blue">
                            <span className="text-jci-blue text-xs uppercase font-bold mb-1 block">Special Member Offer</span>
                            <p className="text-sm font-medium text-slate-800">{member.specialOffer}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            )}

            {activeDetailTab === 'basic' && (
              <>
                <Card
                  title="Contact Information"
                >
                  {isEditMode && inlineValues ? (
                    <div className="space-y-4 text-sm">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Primary Phone</label>
                          <input
                            type="text"
                            value={inlineValues.phone}
                            onChange={e => setInlineValues({ ...inlineValues, phone: e.target.value })}
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                          />
                        </div>
                        <div>
                          <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Alternate Phone</label>
                          <input
                            type="text"
                            value={inlineValues.alternatePhone}
                            onChange={e => setInlineValues({ ...inlineValues, alternatePhone: e.target.value })}
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                          />
                        </div>
                        <div>
                          <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Email</label>
                          <input
                            type="email"
                            value={inlineValues.email}
                            onChange={e => setInlineValues({ ...inlineValues, email: e.target.value })}
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                          />
                        </div>
                        <div>
                          <label className="text-slate-500 block text-xs uppercase font-medium mb-1">WhatsApp Group Added</label>
                          <select
                            value={inlineValues.whatsappGroup ? 'Yes' : 'No'}
                            onChange={e => setInlineValues({ ...inlineValues, whatsappGroup: e.target.value === 'Yes' })}
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue bg-white"
                          >
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Address</label>
                          <textarea
                            value={inlineValues.address}
                            onChange={e => setInlineValues({ ...inlineValues, address: e.target.value })}
                            rows={2}
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue resize-y"
                          />
                        </div>
                      </div>

                      <div className="border-t pt-3">
                        <h4 className="text-xs font-bold text-slate-400 uppercase border-b pb-1 mb-3">Emergency Contact</h4>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Name</label>
                            <input
                              type="text"
                              value={inlineValues.emergencyContactName}
                              onChange={e => setInlineValues({ ...inlineValues, emergencyContactName: e.target.value })}
                              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                            />
                          </div>
                          <div>
                            <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Relationship</label>
                            <input
                              type="text"
                              value={inlineValues.emergencyContactRelationship}
                              onChange={e => setInlineValues({ ...inlineValues, emergencyContactRelationship: e.target.value })}
                              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                            />
                          </div>
                          <div>
                            <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Phone</label>
                            <input
                              type="text"
                              value={inlineValues.emergencyContactPhone}
                              onChange={e => setInlineValues({ ...inlineValues, emergencyContactPhone: e.target.value })}
                              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="border-t pt-3">
                        <h4 className="text-xs font-bold text-slate-400 uppercase border-b pb-1 mb-3">Social Media Links</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-slate-500 block text-xs font-medium mb-1">LinkedIn</label>
                            <input
                              type="text"
                              value={inlineValues.linkedin}
                              onChange={e => setInlineValues({ ...inlineValues, linkedin: e.target.value })}
                              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                            />
                          </div>
                          <div>
                            <label className="text-slate-500 block text-xs font-medium mb-1">Facebook</label>
                            <input
                              type="text"
                              value={inlineValues.facebook}
                              onChange={e => setInlineValues({ ...inlineValues, facebook: e.target.value })}
                              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                            />
                          </div>
                          <div>
                            <label className="text-slate-500 block text-xs font-medium mb-1">Instagram</label>
                            <input
                              type="text"
                              value={inlineValues.instagram}
                              onChange={e => setInlineValues({ ...inlineValues, instagram: e.target.value })}
                              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                            />
                          </div>
                          <div>
                            <label className="text-slate-500 block text-xs font-medium mb-1">WeChat ID</label>
                            <input
                              type="text"
                              value={inlineValues.wechat}
                              onChange={e => setInlineValues({ ...inlineValues, wechat: e.target.value })}
                              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                            />
                          </div>
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                            <Phone size={16} />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 uppercase font-medium">Primary Phone</p>
                            <p className="text-sm font-bold">{member.phone || 'N/A'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                            <Phone size={16} className="rotate-90" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 uppercase font-medium">Alternate Phone</p>
                            <p className="text-sm font-bold">{member.alternatePhone || 'N/A'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-jci-blue">
                            <MessageCircle size={16} />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 uppercase font-medium">WhatsApp Group</p>
                            <p className="text-sm font-bold">{member.whatsappGroup ? 'Yes' : 'Not Added'}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                            <MapPin size={16} />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 uppercase font-medium">Address</p>
                            <p className="text-sm text-slate-700">{member.address || 'No address on file'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-xs font-bold text-slate-400 uppercase border-b pb-1">Emergency Contact</h4>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{member.emergencyContactName || 'None Listed'}</p>
                          <p className="text-xs text-slate-500">{member.emergencyContactRelationship} â€¢ {member.emergencyContactPhone}</p>
                        </div>

                        <h4 className="text-xs font-bold text-slate-400 uppercase border-b pb-1 mt-4">Social Media</h4>
                        <div className="flex gap-4 items-center">
                          {member.linkedin
                            ? <a href={member.linkedin} target="_blank" rel="noreferrer" className="text-[#0077B5]"><Linkedin size={20} /></a>
                            : <Linkedin size={20} className="text-slate-300" />}
                          {member.facebook
                            ? <a href={member.facebook} target="_blank" rel="noreferrer" className="text-[#1877F2]"><Facebook size={20} /></a>
                            : <Facebook size={20} className="text-slate-300" />}
                          {member.instagram
                            ? <a href={member.instagram} target="_blank" rel="noreferrer" className="text-[#E1306C]"><Instagram size={20} /></a>
                            : <Instagram size={20} className="text-slate-300" />}
                          {member.wechat
                            ? <div className="text-[#07C160] flex items-center gap-1"><MessageCircle size={20} /></div>
                            : <MessageCircle size={20} className="text-slate-300" />}
                        </div>
                      </div>
                    </div>
                  )}
                </Card>

                <Card
                  title="Apparel & Items"
                >
                  {isEditMode && inlineValues ? (
                    <div className="space-y-4 text-sm">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Cut Style</label>
                          <select
                            value={inlineValues.cutStyle}
                            onChange={e => setInlineValues({ ...inlineValues, cutStyle: e.target.value })}
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue bg-white"
                          >
                            <option value="">Select Cut</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-slate-500 block text-xs uppercase font-medium mb-1">T-Shirt Size</label>
                          <select
                            value={inlineValues.tshirtSize}
                            onChange={e => setInlineValues({ ...inlineValues, tshirtSize: e.target.value })}
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue bg-white"
                          >
                            <option value="">Select Size</option>
                            {['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'].map(sz => <option key={sz} value={sz}>{sz}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Jacket Size</label>
                          <select
                            value={inlineValues.jacketSize}
                            onChange={e => setInlineValues({ ...inlineValues, jacketSize: e.target.value })}
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue bg-white"
                          >
                            <option value="">Select Size</option>
                            {['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'].map(sz => <option key={sz} value={sz}>{sz}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Logo Status</label>
                          <select
                            value={inlineValues.tshirtStatus}
                            onChange={e => setInlineValues({ ...inlineValues, tshirtStatus: e.target.value })}
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue bg-white"
                          >
                            <option value="NA">NA</option>
                            <option value="Pending">Pending</option>
                            <option value="Received">Received</option>
                            <option value="Delivered">Delivered</option>
                          </select>
                        </div>
                      </div>

                      <div className="border-t pt-3">
                        <label className="text-slate-500 block text-xs uppercase font-medium mb-1">Embroidered Name</label>
                        <input
                          type="text"
                          value={inlineValues.embroideredName}
                          onChange={e => setInlineValues({ ...inlineValues, embroideredName: e.target.value })}
                          placeholder="Embroidered Name on Jacket"
                          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-jci-blue"
                        />
                      </div>

                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-3 border rounded-lg text-center">
                          <span className="text-slate-500 block text-[10px] uppercase font-bold">Cut Style</span>
                          <p className="font-bold text-slate-900">{member.cutStyle || 'N/A'}</p>
                        </div>
                        <div className="p-3 border rounded-lg text-center">
                          <span className="text-slate-500 block text-[10px] uppercase font-bold">T-Shirt</span>
                          <p className="font-bold text-slate-900">{member.tshirtSize || 'N/A'}</p>
                        </div>
                        <div className="p-3 border rounded-lg text-center">
                          <span className="text-slate-500 block text-[10px] uppercase font-bold">Jacket</span>
                          <p className="font-bold text-slate-900">{member.jacketSize || 'N/A'}</p>
                        </div>
                        <div className="p-3 border rounded-lg text-center">
                          <span className="text-slate-500 block text-[10px] uppercase font-bold">Logo Status</span>
                          <Badge variant={member.tshirtStatus === 'Received' || member.tshirtStatus === 'Delivered' ? 'success' : 'warning'}>
                            {member.tshirtStatus || 'N/A'}
                          </Badge>
                        </div>
                      </div>
                      {member.embroideredName && (
                        <div className="mt-4 p-2 bg-slate-50 rounded text-center border-t border-slate-200">
                          <span className="text-xs text-slate-500">Embroidered Name: </span>
                          <span className="text-sm font-bold text-slate-900 italic">"{member.embroideredName}"</span>
                        </div>
                      )}
                    </>
                  )}
                </Card>
              </>
            )}

            {activeDetailTab === 'career' && (
              <><Card title="Recent Badges">
                <div className="flex gap-4">
                  {Array.isArray(member.badges) && member.badges.map(b => (
                    <div key={b.id} className="text-center">
                      <div className="text-3xl mb-1">{b.icon}</div>
                      <div className="text-xs font-medium text-slate-900">{b.name}</div>
                    </div>
                  ))}
                  {(!member.badges || member.badges.length === 0) && (
                    <p className="text-sm text-slate-400 italic">No badges earned yet</p>
                  )}
                </div>
              </Card>
                <div className="grid lg:grid-cols-2 gap-6 items-start">
                  <Card title="JCI Career Path">
                    <div className="relative pl-8 space-y-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                      {/* Join milestone */}
                      <div className="relative">
                        <div className="absolute -left-8 bg-green-100 text-green-600 p-1 rounded-full border-4 border-white">
                          <UserPlus size={14} />
                        </div>
                        <span className="text-xs text-slate-400 font-mono mb-1 block">{member.joinDate}</span>
                        <h4 className="text-sm font-bold text-slate-900">Joined JCI Local Chapter</h4>
                      </div>

                      {/* Merged & sorted: careerHistory + board positions + commission director roles from Firestore */}
                      {(() => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);

                        // Date-based status helper
                        const getBodStatus = (bp: BoardMember): 'former' | 'current' | 'elected' => {
                          const start = bp.startDate ? new Date(bp.startDate) : null;
                          const end = bp.endDate ? new Date(bp.endDate) : null;
                          if (end && today > end) return 'former';
                          if (start && today < start) return 'elected';
                          return 'current';
                        };

                        type TimelineItem = {
                          sortKey: string; type: 'career' | 'board' | 'commission';
                          year: string; title: string; subtitle?: string;
                          bodStatus?: 'former' | 'current' | 'elected';
                        };
                        const items: TimelineItem[] = [];

                        // Career history from member profile
                        if (Array.isArray(member.careerHistory)) {
                          member.careerHistory.forEach(m => {
                            items.push({ sortKey: String(m.year), type: 'career', year: String(m.year), title: m.role, subtitle: m.description });
                          });
                        }

                        // Board positions from Firestore boardMembers collection
                        boardPositions.forEach(bp => {
                          items.push({
                            sortKey: bp.term,
                            type: 'board',
                            year: bp.term,
                            title: bp.position,
                            subtitle: `Board of Directors â€“ ${bp.term}`,
                            bodStatus: getBodStatus(bp),
                          });
                        });

                        // Commission Director records from Board of Directors assignments
                        commissionDirectorPositions.forEach(bp => {
                          items.push({
                            sortKey: bp.term,
                            type: 'commission',
                            year: bp.term,
                            title: 'Commission Director',
                            subtitle: `Under ${bp.position} - ${bp.term}`,
                            bodStatus: getBodStatus(bp),
                          });
                        });

                        // Sort chronologically
                        items.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

                        return items.map((item, idx) => {
                          if (item.type === 'board') {
                            const statusConfig = {
                              current: { dot: 'bg-amber-100 text-amber-600', badge: 'bg-amber-100 text-amber-700', label: 'Current', icon: 'text-amber-500' },
                              elected: { dot: 'bg-blue-100 text-blue-600', badge: 'bg-blue-100 text-blue-700', label: 'Elected', icon: 'text-blue-500' },
                              former: { dot: 'bg-slate-100 text-slate-500', badge: 'bg-slate-100 text-slate-600', label: 'Former', icon: 'text-slate-400' },
                            };
                            const cfg = statusConfig[item.bodStatus!] ?? statusConfig.former;
                            return (
                              <div key={`board-${idx}`} className="relative">
                                <div className={`absolute -left-8 p-1 rounded-full border-4 border-white ${cfg.dot}`}>
                                  <Award size={14} />
                                </div>
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-xs text-slate-400 font-mono">{item.year}</span>
                                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                                </div>
                                <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <Shield size={10} className={cfg.icon} />
                                  <p className={`text-xs font-medium ${cfg.icon}`}>Board of Directors</p>
                                </div>
                              </div>
                            );
                          }
                          if (item.type === 'commission') {
                            const statusConfig = {
                              current: { dot: 'bg-sky-100 text-sky-600', badge: 'bg-sky-100 text-sky-700', label: 'Current', icon: 'text-sky-500' },
                              elected: { dot: 'bg-blue-100 text-blue-600', badge: 'bg-blue-100 text-blue-700', label: 'Elected', icon: 'text-blue-500' },
                              former: { dot: 'bg-slate-100 text-slate-500', badge: 'bg-slate-100 text-slate-600', label: 'Former', icon: 'text-slate-400' },
                            };
                            const cfg = statusConfig[item.bodStatus!] ?? statusConfig.former;
                            return (
                              <div key={`commission-${idx}`} className="relative">
                                <div className={`absolute -left-8 p-1 rounded-full border-4 border-white ${cfg.dot}`}>
                                  <UserCog size={14} />
                                </div>
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-xs text-slate-400 font-mono">{item.year}</span>
                                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                                </div>
                                <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <UserCog size={10} className={cfg.icon} />
                                  <p className={`text-xs font-medium ${cfg.icon}`}>{item.subtitle}</p>
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div key={`career-${idx}`} className="relative">
                              <div className="absolute -left-8 bg-blue-100 text-jci-blue p-1 rounded-full border-4 border-white">
                                <Briefcase size={14} />
                              </div>
                              <span className="text-xs text-slate-400 font-mono mb-1 block">{item.year}</span>
                              <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                              {item.subtitle && <p className="text-sm text-slate-600">{item.subtitle}</p>}
                            </div>
                          );
                        });
                      })()}

                      {/* Empty state */}
                      {(!member.careerHistory || member.careerHistory.length === 0) && boardPositions.length === 0 && commissionDirectorPositions.length === 0 && (
                        <p className="text-sm text-slate-400 italic">No career milestones or board positions recorded yet.</p>
                      )}
                    </div>
                  </Card>

                  <Card title="JCI Trainer Pathway">
                    <div className="relative pl-8 space-y-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                      {[
                        {
                          label: 'Level 1',
                          title: 'JCI Trainer',
                          description: 'Pre-requisites: Graduate from JCI Discover',
                          status: (member.skills?.includes('JCI Discover') || member.points >= 150) ? 'Completed' : 'Upcoming',
                          tone: (member.skills?.includes('JCI Discover') || member.points >= 150) ? 'green' : 'slate',
                          icon: GraduationCap,
                        },
                        {
                          label: 'Level 2',
                          title: 'JCIM Intermediate Trainer',
                          description: 'Pre-requisites: Graduate from JCI Presenter/ JCI Facilitator, JCIM Inspire, JCIM Empower',
                          status: (member.skills?.includes('JCI Presenter') || member.skills?.includes('JCI Facilitator') || member.points >= 400) ? 'Completed' : (member.points >= 150 ? 'In Progress' : 'Upcoming'),
                          tone: (member.skills?.includes('JCI Presenter') || member.skills?.includes('JCI Facilitator') || member.points >= 400) ? 'green' : (member.points >= 150 ? 'blue' : 'slate'),
                          icon: UserCheck,
                        },
                        {
                          label: 'Level 3',
                          title: 'JCIM Certified Trainer',
                          description: 'Pre-requisites: Accumulate 10 training hours, graduate from JCIM TTT 1',
                          status: (member.skills?.includes('JCIM TTT 1') || member.points >= 800) ? 'Completed' : (member.points >= 400 ? 'In Progress' : 'Upcoming'),
                          tone: (member.skills?.includes('JCIM TTT 1') || member.points >= 800) ? 'green' : (member.points >= 400 ? 'blue' : 'slate'),
                          icon: Award,
                        },
                        {
                          label: 'Level 4',
                          title: 'JCIM Principal Trainer',
                          description: 'Pre-requisites: Accumulate 25 training hours, Head trainer of JCIM Empower or JCIM Inspire, graduate from JCIM TTT 2',
                          status: (member.skills?.includes('JCIM TTT 2') || member.points >= 1500) ? 'Completed' : (member.points >= 800 ? 'In Progress' : 'Upcoming'),
                          tone: (member.skills?.includes('JCIM TTT 2') || member.points >= 1500) ? 'green' : (member.points >= 800 ? 'blue' : 'slate'),
                          icon: Shield,
                        },
                        {
                          label: 'Level 5',
                          title: 'JCIM Master Trainer',
                          description: 'Pre-requisites: Accumulate 30 training hours, assistant trainer to area academy',
                          status: (member.skills?.includes('JCIM Master Trainer') || member.points >= 2500) ? 'Completed' : (member.points >= 1500 ? 'In Progress' : 'Upcoming'),
                          tone: (member.skills?.includes('JCIM Master Trainer') || member.points >= 2500) ? 'green' : (member.points >= 1500 ? 'blue' : 'slate'),
                          icon: Zap,
                        },
                      ].map((step) => {
                        const Icon = step.icon;
                        const toneClass = {
                          green: { dot: 'bg-green-100 text-green-600', badge: 'bg-green-100 text-green-700 font-bold border border-green-200' },
                          blue: { dot: 'bg-blue-100 text-blue-600', badge: 'bg-blue-100 text-blue-700 font-bold border border-blue-200' },
                          amber: { dot: 'bg-amber-100 text-amber-600', badge: 'bg-amber-100 text-amber-700 font-bold border border-amber-200' },
                          slate: { dot: 'bg-slate-100 text-slate-500', badge: 'bg-slate-100 text-slate-600 font-bold border border-slate-200' },
                        }[step.tone];

                        return (
                          <div key={step.title} className="relative">
                            <div className={`absolute -left-8 p-1 rounded-full border-4 border-white ${toneClass.dot}`}>
                              <Icon size={14} />
                            </div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs text-slate-400 font-mono">{step.label}</span>
                              <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded-full ${toneClass.badge}`}>{step.status}</span>
                            </div>
                            <h4 className="text-sm font-bold text-slate-900">{step.title}</h4>
                            <p className="text-xs text-slate-600 leading-normal">{step.description}</p>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                </div>


              </>
            )}
          </div>
        </div>
      )}

      {/* Activities Log Tab content */}
      {activeDetailTab === 'activities' && (
        <div className="grid lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          <div className="lg:col-span-2 space-y-6">
            {/* Radar Contributions / Events Log */}
            <Card title="Radar Contribution History" description="Historical points imported from JCI Radar system">
              {activitiesLoading ? (
                <div className="py-8 text-center text-slate-400">Loading contribution logs...</div>
              ) : radarContributions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-slate-500">
                    <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                      <tr>
                        <th className="px-4 py-2 text-slate-600 font-bold">Date</th>
                        <th className="px-4 py-2 text-slate-600 font-bold">Category / Description</th>
                        {isPresident && <th className="px-4 py-2 text-right text-slate-600 font-bold w-[100px]">Points</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {groupedRadarContributions.sortedYears.map((year) => (
                        <React.Fragment key={year}>
                          {/* Year Segment Header */}
                          <tr className="bg-slate-100/60 border-y border-slate-200">
                            <td colSpan={isPresident ? 3 : 2} className="px-4 py-2 text-xs font-black text-slate-700 tracking-wider bg-slate-50/80 select-none">
                              {year}
                            </td>
                          </tr>
                          {groupedRadarContributions.groups[year].map((log) => (
                            <tr key={log.id} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                                {formatDateToDDMMMYYYY(log.date)}
                              </td>
                              <td className="px-4 py-3">
                                <span className="font-bold text-slate-900 block">{log.description}</span>
                                <span className="text-[10px] text-slate-400 uppercase tracking-wider">{log.type}</span>
                              </td>
                              {isPresident && (
                                <td className="px-4 py-3 text-right font-black text-green-600 w-[100px]">
                                  +{log.points} pts
                                </td>
                              )}
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 italic text-sm">No radar contribution history recorded.</div>
              )}
            </Card>

            {/* Sponsorship Records */}
            <Card title="Sponsorship Records" description="Sponsorships obtained and converted to Radar points">
              {activitiesLoading ? (
                <div className="py-8 text-center text-slate-400">Loading sponsorships...</div>
              ) : sponsorshipRecords.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-slate-500">
                    <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                      <tr>
                        <th className="px-4 py-2 text-slate-600 font-bold">Date</th>
                        <th className="px-4 py-2 text-slate-600 font-bold">Project Name</th>
                        <th className="px-4 py-2 text-slate-600 font-bold">Sponsorship Amount</th>
                        {isPresident && <th className="px-4 py-2 text-right text-slate-600 font-bold">Points</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sponsorshipRecords.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                            {formatDateToDDMMMYYYY(s.date)}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {s.projectName}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-700">
                            RM {s.amount.toLocaleString()}
                          </td>
                          {isPresident && (
                            <td className="px-4 py-3 text-right font-black text-green-600">
                              +{s.points} pts
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 italic text-sm">No sponsorship records found.</div>
              )}
            </Card>

            {/* Project Roles Timeline */}
            <Card title="Project Committee & Trainer Roles" description="Positions held in chapter projects and events">
              {activitiesLoading ? (
                <div className="py-8 text-center text-slate-400">Loading project roles...</div>
              ) : projectRoles.length > 0 ? (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {projectRoles.map((role) => (
                    <div key={role.id} className="relative">
                      <div className={`absolute -left-[30px] p-1 rounded-full border-4 border-white ${role.type === 'Trainer' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-jci-blue'}`}>
                        {role.type === 'Trainer' ? <GraduationCap size={12} /> : <Award size={12} />}
                      </div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs text-slate-400 font-mono">{formatDateToDDMMMYYYY(role.date)}</span>
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${role.type === 'Trainer' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                          {role.type}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">{role.projectName}</h4>
                      <p className="text-xs text-slate-500">
                        {role.type === 'Trainer' ? `Trainer session duration: ${role.hours} hours` : `Role: ${role.role}`}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 italic text-sm">No project or trainer roles recorded.</div>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            {/* Recruited Members (Introductions) */}
            <Card title="Introduced Members" description="LO Members recruited by this member">
              {activitiesLoading ? (
                <div className="py-4 text-center text-slate-400 text-sm">Loading recruited members...</div>
              ) : recruitedMembers.length > 0 ? (
                <div className="space-y-3">
                  {recruitedMembers.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl bg-slate-50/50">
                      <img src={m.avatar || undefined} className="w-10 h-10 rounded-full object-cover bg-slate-200 border border-slate-100 shrink-0" alt="" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate">{m.name}</p>
                        <p className="text-[10px] text-slate-400">Joined: {formatDateToDDMMMYYYY(m.joinDate)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-4 text-center text-slate-400 italic text-sm">No introductions recorded.</div>
              )}
            </Card>

            {/* Config Overview Card â€” points info is President-only */}
            {isPresident && (
              <Card title="Points Standard Reference" className="bg-slate-50/50">
                <div className="text-xs space-y-3 text-slate-600">
                  <p className="font-semibold text-slate-800 border-b pb-1.5 mb-2">How points are credited:</p>
                  <div className="flex justify-between items-center">
                    <span>Organising Chairman Role</span>
                    <span className="font-bold text-slate-900">5 pts</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Committee Member Role</span>
                    <span className="font-bold text-slate-900">3 pts</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Ex-Officio Role</span>
                    <span className="font-bold text-slate-900">2 pts</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Certified Training</span>
                    <span className="font-bold text-slate-900">1 pt / hr</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Member Recruitment</span>
                    <span className="font-bold text-slate-900">10 pts / pax</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Sponsorship Obtained</span>
                    <span className="font-bold text-slate-900">2 pts / RM100</span>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {showAssessmentModal && (
        <Modal
          isOpen={showAssessmentModal}
          onClose={() => setShowAssessmentModal(false)}
          title="Personalized Assessment Update"
          size="lg"
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Update member's alignment answers to recalculate JCI Pillar Diagnosis scores and tags.
              </p>
              <button
                type="button"
                onClick={() => setAssessmentShowZh(v => !v)}
                title={assessmentShowZh ? 'Switch to English' : 'Switch to Chinese'}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${assessmentShowZh
                  ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                  : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
                  }`}
              >
                <span className="text-[11px]">ðŸŒ</span>
                {assessmentShowZh ? 'EN' : 'ä¸­æ–‡'}
              </button>
            </div>

            <div className="space-y-4">
              {JOIN_US_SURVEY_QUESTIONS.map((q, idx) => {
                const selectedValues = assessmentAnswers[q.id] || [];
                const isAnswered = selectedValues.length > 0;
                return (
                  <div
                    key={q.id}
                    className={`rounded-xl border-2 overflow-hidden transition-all duration-200 ${isAnswered ? 'border-blue-200 shadow-sm' : 'border-slate-100'
                      }`}
                  >
                    {/* Question Header */}
                    <div
                      className={`px-4 py-3 flex items-center justify-between gap-3 ${isAnswered ? 'bg-blue-50/60' : 'bg-slate-50/80'
                        }`}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <span
                          className={`flex-none flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold border-2 transition-all ${isAnswered
                            ? 'bg-jci-blue text-white border-jci-blue shadow-sm'
                            : 'bg-white text-slate-400 border-slate-200'
                            }`}
                        >
                          {isAnswered ? <CheckCircle size={12} /> : idx + 1}
                        </span>
                        <h4
                          className={`text-xs font-bold leading-snug ${isAnswered ? 'text-slate-800' : 'text-slate-600'
                            }`}
                        >
                          {assessmentShowZh ? (q as any).titleZh ?? q.title : q.title}
                        </h4>
                      </div>
                      {isAnswered && (
                        <span className="text-[10px] font-bold text-jci-blue bg-blue-100 px-2 py-0.5 rounded-full flex-shrink-0">
                          {selectedValues.length} selected
                        </span>
                      )}
                    </div>
                    {/* Options */}
                    <div className="px-2 pb-2 pt-1 grid grid-cols-1 gap-0.5">
                      {q.options.map(opt => {
                        const isSelected = selectedValues.includes(opt.value);
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              const current = assessmentAnswers[q.id] || [];
                              const updated = isSelected
                                ? current.filter(v => v !== opt.value)
                                : [...current, opt.value];
                              setAssessmentAnswers({
                                ...assessmentAnswers,
                                [q.id]: updated
                              });
                            }}
                            className={`
                              w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all duration-150 group border-none outline-none
                              ${isSelected ? 'bg-blue-50/80' : 'hover:bg-slate-50'}
                            `}
                          >
                            {/* Checkbox indicator */}
                            <div
                              className={`
                                flex-none w-4 h-4 rounded border flex items-center justify-center transition-all duration-150
                                ${isSelected
                                  ? 'bg-jci-blue border-jci-blue text-white'
                                  : 'border-slate-300 group-hover:border-blue-300 bg-white'
                                }
                              `}
                            >
                              {isSelected && (
                                <svg width="8" height="6" viewBox="0 0 10 8" fill="none">
                                  <path
                                    d="M1 4L3.5 6.5L9 1"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              )}
                            </div>
                            <span
                              className={`text-[12px] font-semibold leading-relaxed flex-1 ${isSelected ? 'text-jci-blue' : 'text-slate-600'
                                }`}
                            >
                              {assessmentShowZh ? (opt as any).labelZh ?? opt.label : opt.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => setShowAssessmentModal(false)}
                disabled={savingAssessment}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveAssessment}
                isLoading={savingAssessment}
              >
                Save & Recalculate
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {showPaymentHistoryModal && (
        <Modal
          isOpen={showPaymentHistoryModal}
          onClose={() => setShowPaymentHistoryModal(false)}
          title={`Membership Dues History â€” ${member.name}`}
          size="md"
          bottomSheet
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Complete record of annual membership dues payments.
            </p>

            <div className="divide-y divide-slate-100">
              {member.membership && Object.keys(member.membership).length > 0 ? (
                Object.keys(member.membership)
                  .sort((a, b) => b.localeCompare(a))
                  .map((yr) => {
                    const record = member.membership![yr];
                    const isPaid = record.status === 'paid' || record.status === 'over paid';
                    const isPending = record.status === 'pending';
                    const statusColorClass = isPaid
                      ? 'bg-green-100 text-green-800 border border-green-200'
                      : isPending
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-red-100 text-red-800 border border-red-200';

                    const isCurrentYear = yr === String(new Date().getFullYear());

                    return (
                      <div key={yr} className={`py-4 flex items-start justify-between gap-4 first:pt-0 last:pb-0 ${isCurrentYear ? 'relative' : ''}`}>
                        {isCurrentYear && (
                          <div className="absolute -left-1 top-3 bottom-3 w-0.5 bg-jci-blue rounded-full" />
                        )}
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-black ${isCurrentYear ? 'text-jci-blue' : 'text-slate-900'}`}>
                              {yr} Membership Dues
                            </span>
                            {isCurrentYear && (
                              <span className="text-[9px] font-black uppercase tracking-wider bg-jci-blue/10 text-jci-blue px-1.5 py-0.5 rounded">
                                Current Year
                              </span>
                            )}
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusColorClass}`}>
                              {record.status}
                            </span>
                          </div>
                          {record.paymentDate && (
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                              <Calendar size={11} className="text-slate-400" />
                              Paid on: {formatDateToDDMMMYYYY(record.paymentDate)}
                            </p>
                          )}
                          {record.purpose && (
                            <p className="text-xs text-slate-500 italic leading-relaxed">
                              "{record.purpose}"
                            </p>
                          )}
                          {Array.isArray(record.transactionId) && record.transactionId.length > 0 && (
                            <p className="text-[10px] text-slate-400 font-mono">
                              {record.transactionId.length} transaction{record.transactionId.length > 1 ? 's' : ''} linked
                            </p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-base font-black ${isPaid ? 'text-green-700' : isPending ? 'text-amber-700' : 'text-red-700'}`}>
                            RM {record.amount || 0}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            Target: RM {record.dues || 0}
                          </p>
                          {record.dues > 0 && record.amount >= record.dues && (
                            <p className="text-[10px] text-green-600 font-bold">âœ“ Fulfilled</p>
                          )}
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div className="py-10 text-center text-slate-400">
                  <Coins size={36} className="mx-auto mb-3 text-slate-400" />
                  <p className="text-sm font-medium">No payment history found.</p>
                  <p className="text-xs mt-1">Dues records will appear here once processed.</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setShowPaymentHistoryModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {showMentorMatchModal && (
        <MentorMatchingModal
          mentee={member}
          potentialMentors={potentialMentors}
          onSelect={handleAssignMentor}
          onClose={() => setShowMentorMatchModal(false)}
        />
      )}

      {showChurnModal && churnPrediction && (
        <ChurnPredictionModal
          member={member}
          prediction={churnPrediction}
          onClose={() => setShowChurnModal(false)}
        />
      )}


      {showDeleteConfirm && (
        <Modal
          isOpen={showDeleteConfirm}
          onClose={() => !isDeleting && setShowDeleteConfirm(false)}
          title="Confirm Member Deletion"
          size="sm"
        >
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-900">Warning: This action is permanent.</p>
                <p className="text-sm text-red-700 mt-1">
                  Are you sure you want to delete member <strong>{member.name}</strong>? All their data, points, and history will be removed.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>Cancel</Button>
              <Button variant="danger" onClick={handleDeleteMember} isLoading={isDeleting}>Delete Member</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

interface MentorMatchingModalProps {
  mentee: Member;
  potentialMentors: MentorMatchSuggestion[];
  onSelect: (mentorId: string) => void;
  onClose: () => void;
}

const MentorMatchingModal: React.FC<MentorMatchingModalProps> = ({ mentee, potentialMentors, onSelect, onClose }) => {
  return (
    <Modal isOpen={true} onClose={onClose} title={`Find Mentor for ${mentee.name}`} size="lg">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Based on {mentee.name}'s profile, here are the best mentor matches:
        </p>

        {potentialMentors.length === 0 ? (
          <div className="text-center py-8">
            <Users className="mx-auto text-slate-400 mb-2" size={32} />
            <p className="text-slate-500">No suitable mentors found</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {potentialMentors.map((match, index) => (
              <Card key={match.mentor.id} className="hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <img src={match.mentor.avatar || undefined} className="w-12 h-12 rounded-full border border-slate-100" alt="" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-slate-900 truncate">{match.mentor.name}</h4>
                        {index === 0 && <Badge variant="success">Best Match</Badge>}
                        <div className="flex items-center gap-1 text-xs text-jci-blue font-bold">
                          <Zap size={10} fill="currentColor" /> {match.matchScore}%
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mb-2">{match.mentor.role} â€¢ {match.mentor.tier}</p>

                      <div className="flex flex-wrap gap-1 mb-3">
                        {Array.isArray(match.mentor.skills) && match.mentor.skills.slice(0, 3).map(skill => (
                          <Badge key={skill} variant="neutral" className="text-[10px] py-0">{skill}</Badge>
                        ))}
                      </div>

                      <div className="bg-blue-50 p-2.5 rounded-lg">
                        <p className="text-[11px] font-bold text-blue-900 mb-1">Why this match?</p>
                        <ul className="text-[11px] text-blue-700 space-y-0.5">
                          {Array.isArray(match.reasons) && match.reasons.map((reason, idx) => (
                            <li key={idx} className="flex items-start gap-1">
                              <span className="mt-1 w-1 h-1 rounded-full bg-blue-400 shrink-0" />
                              {reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => onSelect(match.mentor.id)}>Select</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};

interface ChurnPredictionModalProps {
  member: Member;
  prediction: MemberChurnPrediction;
  onClose: () => void;
}

const ChurnPredictionModal: React.FC<ChurnPredictionModalProps> = ({ member, prediction, onClose }) => {
  const risk = prediction.churnRisk;
  const riskColor = risk === 'High' ? 'red' : risk === 'Medium' ? 'amber' : 'green';

  return (
    <Modal isOpen={true} onClose={onClose} title={`Churn Prediction Analysis: ${member.name}`} size="lg">
      <div className="space-y-6">
        <div className={`p-5 rounded-xl border-2 bg-${riskColor}-50 border-${riskColor}-100`}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className={`text-sm font-bold text-${riskColor}-900 uppercase tracking-wider`}>Overall Risk Level</p>
              <h3 className={`text-2xl font-black text-${riskColor}-600 uppercase`}>{risk} Risk</h3>
            </div>
            <div className="text-right">
              <span className={`text-3xl font-black text-${riskColor}-600`}>{prediction.churnProbability}%</span>
              <p className={`text-xs font-bold text-${riskColor}-900`}>Probability</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold bg-${riskColor}-600 text-white uppercase`}>
              Priority: {prediction.interventionPriority}
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-red-50 p-4 rounded-lg border border-red-100">
            <h4 className="text-sm font-bold text-red-900 mb-2 flex items-center gap-2">
              <AlertCircle size={16} /> Risk Factors
            </h4>
            <ul className="space-y-2">
              {Array.isArray(prediction.riskFactors) && prediction.riskFactors.map((factor, idx) => (
                <li key={idx} className="text-xs text-red-700 flex items-start gap-2">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-red-400 shrink-0" />
                  {typeof factor === 'string' ? factor : factor.factor}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border border-green-100">
            <h4 className="text-sm font-bold text-green-900 mb-2 flex items-center gap-2">
              <Sparkles size={16} /> Recommendations
            </h4>
            <ul className="space-y-2">
              {Array.isArray(prediction.recommendations) && prediction.recommendations.map((rec, idx) => (
                <li key={idx} className="text-xs text-green-700 flex items-start gap-2">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-green-400 shrink-0" />
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Modal>
  );
};

// Guest Management View Component
