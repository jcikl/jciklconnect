import * as React from 'react';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Trash2, Settings, X, Sparkles, ArrowLeft, Phone, Mail,
  Award, Clock, Briefcase, GraduationCap, UserPlus, Search, Users,
  TrendingUp, Zap, Download, Upload, BarChart3, FileText, RefreshCw,
  Calendar, Shield, UserCheck, AlertCircle, CheckCircle, MapPin,
  Linkedin, Facebook, Instagram, MessageCircle, CalendarCheck, UserCog,
  Target, Coins, ArrowUpRight, Edit, MoreHorizontal, Star, TrendingDown,
  BookOpen, Trophy, Network, ChevronRight, LayoutList
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button, Card, Badge, ProgressBar, Modal, useToast, Pagination, Tabs, PageHeader } from '../ui/Common';
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

/** å‡ºå¸­å¯¹æ¯"ï¼šå½"å¹´ç­¾åˆ°æ¬¡æ•° vs å·²è¿‡æœˆä»½ï¼ˆå…¥ä¼šå¹´ä»½ä»Žå…¥ä¼šæœˆèµ·ç®—ï¼‰ï¼Œæ¯å¹´é‡ç®— */
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
import { MemberCreateModal } from './Members/MemberCreateModal';
import { BatchFieldUpdateModal } from './Members/BatchFieldUpdateModal';
import { useMemberSearch } from '../../hooks/useMemberSearch';
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
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loIdFilter, setLoIdFilter] = useState<string | null>(null);
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

  // Count all members by membershipType (unfiltered, for filter option badges)
  const membershipTypeCounts = useMemo(() => {
    const counts: Partial<Record<MembershipType, number>> = {};
    for (const m of members) {
      const t = getMemberDisplayMembershipType(m);
      counts[t] = (counts[t] ?? 0) + 1;
    }
    return counts;
  }, [members, membershipRules]);

  // Count all members by role (unfiltered, for filter option badges)
  const roleCounts = useMemo(() => {
    const counts: Partial<Record<UserRole, number>> = {};
    for (const m of members) {
      const r = m.role as UserRole;
      if (r) counts[r] = (counts[r] ?? 0) + 1;
    }
    return counts;
  }, [members]);

  // Filter members based on search + column filters
  const filteredMembers = useMemberSearch({
    members,
    searchTerm,
    searchQuery,
    roleFilters,
    membershipTypeFilters,
    getMemberDisplayMembershipType,
  });

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
        const loId = loIdFilter ?? (currentMember as { loId?: string })?.loId ?? 'jcikl';
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

  const handleAddMember = async (data: MemberCreateInput & Record<string, any>) => {
    await createMember(data);
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

  const memberTabItems = TAB_CONFIG.map(t => {
    const Icon = t.icon;
    const showBadge = t.id === 'directory' && filteredMembers.length > 0;
    return {
      id: t.id,
      label: t.label,
      icon: <Icon size={15} />,
      badge: showBadge
        ? <span className="bg-jci-blue text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{filteredMembers.length}</span>
        : undefined,
    };
  });

  return (
    <div className="space-y-0 pb-24 md:pb-0">
      {!selectedMember ? (
        <>
          {/* â"€â"€ PAGE HEADER â"€â"€ */}
          <PageHeader
            title="Member Directory"
            description="Manage membership, tiers, and engagement."
            className="mb-4"
            action={canManageMembers ? (
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
            ) : undefined}
          />

          {/* TAB NAVIGATION */}
          <Tabs
            variant="button"
            tabs={memberTabItems}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as typeof activeTab)}
            mobileFallback="select"
            className="mb-4"
          />

          <div>
            {activeTab === 'directory' && (
              <LoadingState loading={loading} error={error} empty={filteredMembers.length === 0 && roleFilters.length === 0 && membershipTypeFilters.length === 0 && !searchTerm && !searchQuery} emptyMessage="No members found">
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
                  membershipTypeCounts={membershipTypeCounts}
                  roleCounts={roleCounts}
                />
                {filteredMembers.length === 0 && (roleFilters.length > 0 || membershipTypeFilters.length > 0 || searchTerm || searchQuery) && (
                  <div className="py-12 text-center text-slate-400 text-sm">No members match the current filters.</div>
                )}
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
                canRevoke={canManageMembers}
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

      {selectedIds.size > 1 && isAdmin && (
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
          isAdmin={isAdmin}
        />
      )}

      {/* Batch delete confirm modal */}
      <Modal
        isOpen={isBatchActionModalOpen && batchActionType === 'delete'}
        onClose={() => setIsBatchActionModalOpen(false)}
        title="Confirm Batch Delete"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button variant="outline" onClick={() => setIsBatchActionModalOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={async () => {
              await batchDeleteMembers(Array.from(selectedIds));
              setSelectedIds(new Set());
              setIsBatchActionModalOpen(false);
            }}>Delete Members</Button>
          </div>
        }
      >
        <p className="text-slate-600">Are you sure you want to deactivate <span className="font-bold text-red-600">{selectedIds.size}</span> members? They will be marked as inactive and can be restored by an admin if needed.</p>
      </Modal>

      <BatchFieldUpdateModal
        isOpen={isBatchActionModalOpen && batchActionType === 'set'}
        onClose={() => setIsBatchActionModalOpen(false)}
        selectedCount={selectedIds.size}
        onApply={async (updates) => {
          await batchUpdateMembers(Array.from(selectedIds), updates);
          setSelectedIds(new Set());
        }}
      />

      <MemberCreateModal
        isOpen={isAddModalOpen}
        onClose={() => setAddModalOpen(false)}
        members={members}
        allProjects={allProjects}
        onCreateMember={handleAddMember}
      />

      {/* Batch Import Modal */}
      <MemberBatchImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImported={() => {
          loadMembers();
          showToast('Members imported successfully', 'success');
        }}
      />

      {/* Export Modal â€" Export Data (migrated from Import/Export tab) */}
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
