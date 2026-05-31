import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import {
  Trash2, Settings, X, ChevronDown, Sparkles, ArrowLeft, Phone, Mail,
  Award, Clock, Briefcase, GraduationCap, UserPlus, Search, Users,
  TrendingUp, Zap, Download, Upload, BarChart3, FileText, RefreshCw,
  Calendar, Shield, UserCheck, AlertCircle, CheckCircle, MapPin,
  Linkedin, Facebook, Instagram, MessageCircle, CalendarCheck, UserCog,
  Target, Coins, ArrowUpRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button, Card, Badge, ProgressBar, Modal, useToast, Pagination, Tabs } from '../ui/Common';
import { Input, Select, Textarea, ButtonGroup } from '../ui/Form';
import { MemberEditForm } from './MemberEditForm';
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
} from '../../types';
import {
  DEFAULT_MEMBERSHIP_RULES,
  MembershipConfigService,
  computeMembershipTypeFromMember,
} from '../../services/membershipConfigService';
import { MembersService } from '../../services/membersService';
import { MEMBER_SELF_EDITABLE_FIELDS, NATIONALITY_OPTIONS } from '../../config/constants';
import { MentorshipService, MentorMatchSuggestion } from '../../services/mentorshipService';
import { INDUSTRY_OPTIONS } from '../../config/constants';
import { HobbyClubsService } from '../../services/hobbyClubsService';
import { HobbyClub } from '../../types';
import { DataImportExportService } from '../../services/dataImportExportService';
import { MemberStatsService, MemberStatistics } from '../../services/memberStatsService';
import { EventRegistrationService } from '../../services/eventRegistrationService';
import { EventsService } from '../../services/eventsService';
import type { EventRegistration } from '../../types';
import type { Event } from '../../types';
import { BoardManagementService } from '../../services/boardManagementService';
import { AIPredictionService, MemberChurnPrediction } from '../../services/aiPredictionService';
import { MentorMatching } from './MemberManagement/MentorMatching';
import { PromotionTracking } from './MemberManagement/PromotionTracking';
import { SenatorshipManagement } from './MemberManagement/SenatorshipManagement';
import { BoardOfDirectorsSection } from './MemberManagement/BoardOfDirectorsSection';
import { MemberBatchImportModal } from './Members/MemberBatchImportModal';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useBatchMode } from '../../contexts/BatchModeContext';
import { formatDateToDDMMMYYYY } from '../../utils/dateUtils';
import { MembershipTypeDisplay } from '../shared/MembershipTypeDisplay';
import { ColumnFilterHeader } from '../ui/ColumnFilterHeader';

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
const MyProfileSelfView: React.FC<{ member: Member; onSave: (updates: Partial<Member>) => Promise<void> }> = ({ member, onSave }) => {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [participations, setParticipations] = useState<EventRegistration[]>([]);
  const [organizerEvents, setOrganizerEvents] = useState<Event[]>([]);
  const [eventsById, setEventsById] = useState<Record<string, Event>>({});
  const [loadingExtra, setLoadingExtra] = useState(true);
  const [form, setForm] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    MEMBER_SELF_EDITABLE_FIELDS.forEach((key) => {
      const v = (member as unknown as Record<string, unknown>)[key];
      init[key] = v != null ? String(v) : '';
    });
    return init;
  });

  const handleChange = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingExtra(true);
      try {
        const [regs, allEvents] = await Promise.all([
          EventRegistrationService.listByMember(member.id),
          EventsService.getAllEvents(),
        ]);
        if (cancelled) return;
        setParticipations(regs);
        setOrganizerEvents(allEvents.filter((e) => (e as Event).organizerId === member.id));
        const byId: Record<string, Event> = {};
        allEvents.forEach((e) => { byId[e.id] = e as Event; });
        setEventsById(byId);
      } catch {
        if (!cancelled) setParticipations([]);
        if (!cancelled) setOrganizerEvents([]);
      } finally {
        if (!cancelled) setLoadingExtra(false);
      }
    })();
    return () => { cancelled = true; };
  }, [member.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updates: Partial<Member> = {};
      MEMBER_SELF_EDITABLE_FIELDS.forEach((key) => {
        (updates as Record<string, unknown>)[key] = form[key]?.trim() || null;
      });
      await onSave(updates);
      showToast('Profile updated', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const labels: Record<string, string> = {
    phone: 'Phone', alternatePhone: 'Alt Phone', email: 'Email', address: 'Address',
    linkedin: 'LinkedIn', facebook: 'Facebook', instagram: 'Instagram', wechat: 'WeChat',
    emergencyContactName: 'Emergency Contact', emergencyContactPhone: 'Emergency Phone', emergencyContactRelationship: 'Relationship',
    cutStyle: 'Cut Style', tshirtSize: 'T-Shirt Size', jacketSize: 'Jacket Size', embroideredName: 'Embroidered Name',
  };

  const statusLabel = (s: string) => (s === 'registered' ? 'Registered' : s === 'paid' ? 'Paid' : 'Checked In');

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div><span className="text-slate-500">姓名</span><p className="font-medium">{member.name}</p></div>
          <div><span className="text-slate-500">角色</span><p className="font-medium">{member.role}</p></div>
          <div><span className="text-slate-500">入会日期</span><p className="font-medium">{formatDateToDDMMMYYYY(member.joinDate)}</p></div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {MEMBER_SELF_EDITABLE_FIELDS.map((key) => (
            <div key={key}>
              <label className="block text-sm text-slate-600 mb-1">{labels[key] ?? key}</label>
              {key === 'address' ? (
                <Textarea value={form[key] ?? ''} onChange={(e) => handleChange(key, e.target.value)} rows={2} />
              ) : (
                <Input value={form[key] ?? ''} onChange={(e) => handleChange(key, e.target.value)} />
              )}
            </div>
          ))}
          <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </form>
      </Card>

      {/* Story 8.1：会费状态与活动参与、筹委经历 */}
      <Card className="p-4">
        <h3 className="font-semibold text-slate-800 mb-4">Dues Status & Participation History</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <span className="text-slate-500 text-sm">Dues Status ({new Date().getFullYear()})</span>
            <p className="font-medium capitalize">{member.membership?.[String(new Date().getFullYear())]?.status || 'pending'}</p>
          </div>
          <div>
            <span className="text-slate-500 text-sm">Total Paid This Year</span>
            <p className="font-medium">RM {member.membership?.[String(new Date().getFullYear())]?.amount || 0}</p>
          </div>
          <div>
            <span className="text-slate-500 text-sm">Last Payment Date</span>
            <p className="font-medium">{formatDateToDDMMMYYYY(member.membership?.[String(new Date().getFullYear())]?.paymentDate)}</p>
          </div>
        </div>
        {loadingExtra ? (
          <p className="text-slate-500 text-sm">Loading records...</p>
        ) : (
          <>
            <div className="mb-4">
              <h4 className="text-sm font-medium text-slate-600 mb-2 flex items-center gap-2"><CalendarCheck size={16} /> Activity Participation History</h4>
              {participations.length === 0 ? (
                <p className="text-slate-500 text-sm">No records found</p>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {participations.slice(0, 20).map((r) => (
                    <li key={r.id} className="py-2 flex justify-between items-center">
                      <span className="text-slate-700">{eventsById[r.eventId]?.title ?? r.eventId}</span>
                      <Badge variant={r.status === 'checked_in' ? 'success' : r.status === 'paid' ? 'warning' : 'neutral'}>{statusLabel(r.status)}</Badge>
                    </li>
                  ))}
                  {participations.length > 20 && <li className="py-2 text-slate-500">Total {participations.length}, showing latest 20</li>}
                </ul>
              )}
            </div>
            <div>
              <h4 className="text-sm font-medium text-slate-600 mb-2 flex items-center gap-2"><UserCog size={16} /> Committee Experience</h4>
              {organizerEvents.length === 0 ? (
                <p className="text-slate-500 text-sm">No records found</p>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {organizerEvents.slice(0, 10).map((e) => (
                    <li key={e.id} className="py-2 text-slate-700">{e.title}（{e.date?.slice(0, 10)}）</li>
                  ))}
                  {organizerEvents.length > 10 && <li className="py-2 text-slate-500">Total {organizerEvents.length}, showing latest 10</li>}
                </ul>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export const MembersView: React.FC<{ searchQuery?: string; initialSelectedMemberId?: string | null; onClearSelection?: () => void }> = ({ searchQuery, initialSelectedMemberId, onClearSelection }) => {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(initialSelectedMemberId ?? null);
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [activeTab, setActiveTab] = useState<
    'directory' | 'guest' | 'statistics' | 'board-of-directors' | 'mentorship' | 'promotion-tracking' | 'senatorship'
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
  const [loIdFilter, setLoIdFilter] = useState<string | null>(null);
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
    MembershipConfigService.getRules().then(setMembershipRules).catch(() => {});
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
      list = list.filter((m) => roleFilters.includes(m.role));
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

      const newMember: MemberCreateInput = {
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
        businessCategory: formData.getAll('businessCategory').length > 0 ? (formData.getAll('businessCategory') as string[]) : undefined,

        // Basic Info
        fullName: formData.get('fullName') as string || undefined,
        idNumber: formData.get('idNumber') as string || undefined,
        gender: (formData.get('gender') as any) || undefined,
        ethnicity: (formData.get('ethnicity') as any) || undefined,
        nationality: formData.get('nationality') as string || 'Malaysia',
        dateOfBirth: formData.get('dateOfBirth') as string || undefined,
        introducer: formData.get('introducer') as string || undefined,
        bio: formData.get('bio') as string || undefined,

        senatorshipId: formSenatorshipId,

        // Professional
        companyName: formData.get('companyName') as string || undefined,
        companyWebsite: formData.get('companyWebsite') as string || undefined,
        companyDescription: formData.get('companyDescription') as string || undefined,
        departmentAndPosition: formData.get('departmentAndPosition') as string || undefined,
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

  return (
    <div className="space-y-6 pb-40 md:pb-0">
      {!selectedMember ? (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Member Directory</h2>
              <p className="text-slate-500">Manage membership, tiers, and engagement.</p>
            </div>
            <div className="flex space-x-2">
              {canManageMembers && (
                <>
                  <Button variant="outline" onClick={() => setIsExportModalOpen(true)}>
                    <Download size={16} className="mr-2" /> Export
                  </Button>
                  <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
                    <Upload size={16} className="mr-2" /> Import
                  </Button>
                  <Button onClick={() => setAddModalOpen(true)}><UserPlus size={16} className="mr-2" /> Add Member</Button>
                </>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <Tabs
                tabs={['Directory', 'Guest', 'Statistics', 'Board of Directors', 'Mentorship', 'Promotion Tracking', 'Senatorship']}
                activeTab={
                  activeTab === 'directory' ? 'Directory' :
                    activeTab === 'guest' ? 'Guest' :
                      activeTab === 'statistics' ? 'Statistics' :
                        activeTab === 'board-of-directors' ? 'Board of Directors' :
                          activeTab === 'mentorship' ? 'Mentorship' :
                            activeTab === 'senatorship' ? 'Senatorship' : 'Promotion Tracking'
                }
                onTabChange={(tab) => {
                  if (tab === 'Directory') setActiveTab('directory');
                  else if (tab === 'Guest') setActiveTab('guest');
                  else if (tab === 'Statistics') setActiveTab('statistics');
                  else if (tab === 'Board of Directors') setActiveTab('board-of-directors');
                  else if (tab === 'Mentorship') setActiveTab('mentorship');
                  else if (tab === 'Senatorship') setActiveTab('senatorship');
                  else setActiveTab('promotion-tracking');
                }}
              />
            </div>
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
                <MemberStatisticsView statistics={statistics} loading={loadingStats} />
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
            </div>
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
                  <Input name="introducer" label="Introducer Name" placeholder="Who brought them in?" />
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

      {/* Export Modal – Export Data (migrated from Import/Export tab) */}
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
const MemberStatisticsView: React.FC<{ statistics: MemberStatistics | null; loading: boolean }> = ({ statistics, loading }) => {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (loading) {
    return <div className="text-center py-8 text-slate-400">Loading statistics...</div>;
  }

  if (!statistics) {
    return <div className="text-center py-8 text-slate-400">No statistics available</div>;
  }

  const tierData = Object.entries(statistics.membersByTier).map(([tier, count]) => ({ name: tier, value: count }));
  const roleData = Object.entries(statistics.membersByRole).map(([role, count]) => ({ name: role, value: count }));
  const COLORS = ['#0097D7', '#6EC4E8', '#1C3F94', '#00B5B5', '#A5B4FC', '#F472B6'];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Mobile: Combined Card for all 4 stats (Single Row) */}
        <Card className="md:hidden">
          <div className="grid grid-cols-4 divide-x divide-slate-100 -m-4">
            <div className="py-4 px-1 text-center">
              <div className="text-[9px] text-slate-500 uppercase tracking-tighter mb-1 whitespace-nowrap">Total</div>
              <div className="text-sm font-bold text-slate-900">{statistics.totalMembers}</div>
            </div>
            <div className="py-4 px-1 text-center">
              <div className="text-[9px] text-slate-500 uppercase tracking-tighter mb-1 whitespace-nowrap">Active</div>
              <div className="text-sm font-bold text-green-600">{statistics.activeMembers}</div>
            </div>
            <div className="py-4 px-1 text-center">
              <div className="text-[9px] text-slate-500 uppercase tracking-tighter mb-1 whitespace-nowrap">New</div>
              <div className="text-sm font-bold text-blue-600">{statistics.newMembersThisMonth}</div>
            </div>
            <div className="py-4 px-1 text-center">
              <div className="text-[9px] text-slate-500 uppercase tracking-tighter mb-1 whitespace-nowrap">Avg Pts</div>
              <div className="text-sm font-bold text-amber-600">{statistics.averagePoints}</div>
            </div>
          </div>
        </Card>

        {/* Desktop: Separate Cards */}
        <Card className="hidden md:block">
          <div className="text-sm text-slate-500 mb-1">Total Members</div>
          <div className="text-2xl font-bold text-slate-900">{statistics.totalMembers}</div>
        </Card>
        <Card className="hidden md:block">
          <div className="text-sm text-slate-500 mb-1">Active Members</div>
          <div className="text-2xl font-bold text-green-600">{statistics.activeMembers}</div>
        </Card>
        <Card className="hidden md:block">
          <div className="text-sm text-slate-500 mb-1">New This Month</div>
          <div className="text-2xl font-bold text-blue-600">{statistics.newMembersThisMonth}</div>
        </Card>
        <Card className="hidden md:block">
          <div className="text-sm text-slate-500 mb-1">Average Points</div>
          <div className="text-2xl font-bold text-amber-600">{statistics.averagePoints}</div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Members by Tier">
          <ResponsiveContainer width="100%" height={isMobile ? 350 : 300}>
            <PieChart>
              <Pie
                data={tierData}
                cx="50%"
                cy="50%"
                labelLine={!isMobile}
                label={isMobile ? false : ({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={isMobile ? 70 : 80}
                fill="#8884d8"
                dataKey="value"
              >
                {tierData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              {isMobile && <Legend verticalAlign="bottom" height={36} />}
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Members by Role">
          <ResponsiveContainer width="100%" height={isMobile ? 350 : 300}>
            <PieChart>
              <Pie
                data={roleData}
                cx="50%"
                cy="50%"
                labelLine={!isMobile}
                label={isMobile ? false : ({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={isMobile ? 70 : 80}
                fill="#8884d8"
                dataKey="value"
              >
                {roleData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              {isMobile && <Legend verticalAlign="bottom" height={36} />}
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="Member Engagement Overview">
        <div className="grid grid-cols-3 divide-x divide-slate-100 -m-4 border-t border-slate-50 bg-slate-50/30">
          <div className="p-2 text-center">
            <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Highly</div>
            <div className="text-2xl font-black text-green-600">{statistics.engagementMetrics.highlyEngaged}</div>
            <p className="text-[9px] text-slate-400 font-bold mt-1 tracking-tighter">&gt;80% Engagement</p>
          </div>
          <div className="p-2 text-center">
            <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Moderate</div>
            <div className="text-2xl font-black text-amber-500">{statistics.engagementMetrics.moderatelyEngaged}</div>
            <p className="text-[9px] text-slate-400 font-bold mt-1 tracking-tighter">50-80% Engagement</p>
          </div>
          <div className="p-2 text-center">
            <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Low</div>
            <div className="text-2xl font-black text-red-500">{statistics.engagementMetrics.lowEngaged}</div>
            <p className="text-[9px] text-slate-400 font-bold mt-1 tracking-tighter">&lt;50% Engagement</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

// Batch Action Bar Component
const BatchActionBar: React.FC<{
  selectedCount: number,
  onClear: () => void,
  onBatchDelete: () => void,
  onBatchSet: () => void,
  isDeveloper: boolean
}> = ({ selectedCount, onClear, onBatchDelete, onBatchSet, isDeveloper }) => {
  return (
    <div className="fixed bottom-6 left-6 right-6 md:left-1/2 md:right-auto md:-translate-x-1/2 z-[40] animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-slate-900 text-white px-2 md:px-6 py-3 md:py-4 rounded-[40px] md:rounded-2xl shadow-2xl flex items-center justify-around md:justify-start gap-0 md:gap-6 border border-white/10 backdrop-blur-md h-20 md:h-auto">
        <div className="flex flex-col md:flex-row items-center gap-1 md:gap-3 md:pr-6 md:border-r border-white/20 min-w-[70px] md:min-w-0">
          <div className="w-8 h-8 rounded-full bg-jci-blue flex items-center justify-center font-bold text-sm">
            {selectedCount}
          </div>
          <span className="text-[9px] md:text-sm font-bold md:font-medium tracking-widest md:tracking-normal uppercase md:capitalize whitespace-nowrap">Selected</span>
        </div>

        <button
          onClick={onBatchSet}
          className="flex flex-col md:flex-row items-center gap-1 md:gap-2 text-white hover:text-jci-blue transition-all min-w-[70px] md:min-w-0"
        >
          <div className="p-2 md:p-0 rounded-2xl md:rounded-none bg-white/5 md:bg-transparent">
            <Settings size={20} className="md:w-4 md:h-4" />
          </div>
          <span className="text-[9px] md:text-sm font-bold tracking-widest md:tracking-normal uppercase md:capitalize">Batch Set</span>
        </button>

        {isDeveloper && (
          <button
            onClick={onBatchDelete}
            className="flex flex-col md:flex-row items-center gap-1 md:gap-2 text-red-400 hover:text-red-300 transition-all min-w-[70px] md:min-w-0"
          >
            <div className="p-2 md:p-0 rounded-2xl md:rounded-none bg-white/5 md:bg-transparent">
              <Trash2 size={20} className="md:w-4 md:h-4" />
            </div>
            <span className="text-[9px] md:text-sm font-bold tracking-widest md:tracking-normal uppercase md:capitalize">Delete</span>
          </button>
        )}

        <button
          onClick={onClear}
          className="flex flex-col md:flex-row items-center gap-1 md:gap-2 text-slate-400 hover:text-white transition-all min-w-[70px] md:min-w-0"
        >
          <div className="p-2 md:p-0 rounded-2xl md:rounded-none bg-white/5 md:bg-transparent">
            <X size={20} className="md:w-4 md:h-4" />
          </div>
          <span className="text-[9px] md:text-sm font-bold tracking-widest md:tracking-normal uppercase md:capitalize">Clear</span>
        </button>
      </div>
    </div>
  );
};

const ROLE_FILTER_OPTIONS: { value: UserRole; label: string }[] = [
  { value: UserRole.GUEST, label: 'Guest' },
  { value: UserRole.PROBATION, label: 'Probation' },
  { value: UserRole.MEMBER, label: 'Member' },
  { value: UserRole.BOARD, label: 'Board' },
  { value: UserRole.ADMIN, label: 'Admin' },
  { value: UserRole.SUPER_ADMIN, label: 'Super Admin' },
  { value: UserRole.INACTIVE, label: 'Inactive' },
];

const MEMBERSHIP_TYPE_FILTER_OPTIONS: { value: MembershipType; label: string }[] = [
  { value: 'Guest', label: 'Guest' },
  { value: 'Probation', label: 'Probation' },
  { value: 'Full', label: 'Full' },
  { value: 'Honorary', label: 'Honorary' },
  { value: 'Senator', label: 'Senator' },
  { value: 'Visiting', label: 'Visiting' },
  { value: 'Associate', label: 'Associate' },
];

const membershipTypeBadgeVariant = (
  type?: MembershipType
): 'success' | 'warning' | 'info' | 'neutral' => {
  if (type === 'Full') return 'success';
  if (type === 'Probation') return 'warning';
  if (type === 'Visiting' || type === 'Senator') return 'info';
  return 'neutral';
};

// Member Table Component
const MemberTable: React.FC<{
  members: Member[],
  onSelect: (id: string) => void,
  selectedIds: Set<string>,
  onToggleSelection: (id: string) => void,
  onToggleAll: () => void,
  isAllSelected: boolean,
  roleFilters: UserRole[],
  onRoleFiltersChange: (roles: UserRole[]) => void,
  membershipTypeFilters: MembershipType[],
  onMembershipTypeFiltersChange: (types: MembershipType[]) => void,
  getDisplayMembershipType: (member: Member) => MembershipType,
}> = ({
  members,
  onSelect,
  selectedIds,
  onToggleSelection,
  onToggleAll,
  isAllSelected,
  roleFilters,
  onRoleFiltersChange,
  membershipTypeFilters,
  onMembershipTypeFiltersChange,
  getDisplayMembershipType,
}) => {
  return (
    <Card noPadding>
      {/* Desktop View */}
      <div className="hidden md:block overflow-x-auto overflow-y-visible">
        <table className="w-full text-left">
          <thead className="relative z-10">
            <tr className="bg-slate-50/50">
              <th className="px-6 py-4 w-10">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-jci-blue focus:ring-jci-blue"
                  checked={isAllSelected}
                  onChange={onToggleAll}
                />
              </th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-500">Member</th>
              <th className="px-6 py-4 overflow-visible">
                <ColumnFilterHeader
                  label="Role"
                  options={ROLE_FILTER_OPTIONS}
                  selected={roleFilters}
                  onChange={(vals) => onRoleFiltersChange(vals as UserRole[])}
                />
              </th>
              <th className="px-6 py-4 overflow-visible">
                <ColumnFilterHeader
                  label="Membership Type"
                  options={MEMBERSHIP_TYPE_FILTER_OPTIONS}
                  selected={membershipTypeFilters}
                  onChange={(vals) => onMembershipTypeFiltersChange(vals as MembershipType[])}
                />
              </th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-500">Tier / Points</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-500">Engagement</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-500">Risk Status</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-500">Action</th>
            </tr>
          </thead>
          <tbody>
            {members.map(member => (
              <tr
                key={member.id}
                className={`hover:bg-slate-50 transition-colors ${selectedIds.has(member.id) ? 'bg-blue-50/50' : ''}`}
              >
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-jci-blue focus:ring-jci-blue"
                    checked={selectedIds.has(member.id)}
                    onChange={() => onToggleSelection(member.id)}
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-3">
                    <img src={member.avatar || undefined} alt={member.name} className="w-10 h-10 rounded-full bg-slate-200" />
                    <div>
                      <div className="font-medium text-slate-900">{member.name}</div>
                      <div className="text-xs text-slate-500">{member.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <Badge variant={member.role === UserRole.BOARD ? 'info' : 'neutral'}>{member.role}</Badge>
                </td>
                <td className="px-6 py-4">
                  <Badge variant={membershipTypeBadgeVariant(getDisplayMembershipType(member))}>
                    {getDisplayMembershipType(member)}
                  </Badge>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className={`text-sm font-medium ${member.tier === 'Platinum' ? 'text-purple-600' : member.tier === 'Gold' ? 'text-amber-600' : 'text-slate-600'}`}>
                      {member.tier}
                    </span>
                    <span className="text-xs text-slate-500">{member.points} pts</span>
                  </div>
                </td>
                <td className="px-6 py-4 w-48">
                  <div className="flex items-center space-x-2">
                    <ProgressBar progress={member.attendanceRate} color={member.attendanceRate < 50 ? 'bg-red-500' : 'bg-green-500'} />
                    <span className="text-xs font-medium text-slate-600">{member.attendanceRate}%</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {member.churnRisk === 'High' && (
                    <Badge variant="error">At Risk</Badge>
                  )}
                  {member.churnRisk === 'Low' && (
                    <Badge variant="success">Stable</Badge>
                  )}
                  {member.churnRisk === 'Medium' && (
                    <Badge variant="warning">Monitor</Badge>
                  )}
                </td>
                <td className="px-6 py-4">
                  <Button variant="ghost" size="sm" onClick={() => onSelect(member.id)}>View</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile View */}
      <div className="md:hidden border-b border-slate-100 px-4 py-3 flex flex-wrap gap-4 bg-slate-50/50">
        <ColumnFilterHeader
          label="Role"
          options={ROLE_FILTER_OPTIONS}
          selected={roleFilters}
          onChange={(vals) => onRoleFiltersChange(vals as UserRole[])}
        />
        <ColumnFilterHeader
          label="Membership Type"
          options={MEMBERSHIP_TYPE_FILTER_OPTIONS}
          selected={membershipTypeFilters}
          onChange={(vals) => onMembershipTypeFiltersChange(vals as MembershipType[])}
        />
      </div>
      <div className="md:hidden divide-y divide-slate-100">
        {members.map(member => (
          <div
            key={member.id}
            className={`p-4 transition-colors ${selectedIds.has(member.id) ? 'bg-blue-50/50' : ''}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="pr-1">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-jci-blue focus:ring-jci-blue"
                    checked={selectedIds.has(member.id)}
                    onChange={() => onToggleSelection(member.id)}
                  />
                </div>
                <img src={member.avatar || undefined} alt={member.name} className="w-10 h-10 rounded-full bg-slate-200" />
                <div>
                  <div className="font-bold text-slate-900">{member.name}</div>
                  <div className="text-xs text-slate-500">{member.email}</div>
                </div>
              </div>
              <Badge variant={member.role === UserRole.BOARD ? 'info' : 'neutral'}>{member.role}</Badge>
            </div>

            <div className="mb-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-0.5">Membership Type</span>
              <Badge variant={membershipTypeBadgeVariant(getDisplayMembershipType(member))}>
                {getDisplayMembershipType(member)}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-0.5">Tier / Points</span>
                <div className="flex items-baseline gap-1">
                  <span className={`text-sm font-bold ${member.tier === 'Platinum' ? 'text-purple-600' : member.tier === 'Gold' ? 'text-amber-600' : 'text-slate-600'}`}>
                    {member.tier}
                  </span>
                  <span className="text-xs text-slate-500">{member.points} pts</span>
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-0.5">Status</span>
                <div>
                  {member.churnRisk === 'High' && <Badge variant="error">At Risk</Badge>}
                  {member.churnRisk === 'Low' && <Badge variant="success">Stable</Badge>}
                  {member.churnRisk === 'Medium' && <Badge variant="warning">Monitor</Badge>}
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] uppercase tracking-wider text-slate-400">Engagement</span>
                <span className="text-xs font-bold text-slate-700">{member.attendanceRate}%</span>
              </div>
              <ProgressBar
                progress={member.attendanceRate}
                color={member.attendanceRate < 50 ? 'bg-red-500' : 'bg-green-500'}
              />
            </div>
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => onSelect(member.id)}
              >
                View Profile
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

const MemberDetail: React.FC<{ member: Member, onBack: () => void, isSelfView?: boolean }> = ({ member, onBack, isSelfView = false }) => {
  const { members, updateMember, deleteMember } = useMembers();
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
      // Refresh member data
      window.location.reload();
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
      window.location.reload();
    } catch (err) {
      // Error is handled in the hook
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

  return (
    <div className="space-y-6 animate-in slide-in-from-right duration-300">
      {!isSelfView && (
        <Button variant="ghost" onClick={onBack} className="text-slate-500">
          <ArrowLeft size={16} className="mr-2" /> Back to Directory
        </Button>
      )}

      {/* Header Card */}
      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-md group">
        <div className="h-40 bg-gradient-to-br from-jci-blue via-jci-blue to-jci-navy relative overflow-hidden">
          <div className="absolute inset-0 opacity-20 mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-700"></div>
        </div>

        <div className="px-6 pb-6">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6 -mt-16 relative z-10">
            <div className="relative">
              <div className="p-1 bg-white rounded-full shadow-xl">
                <img
                  src={member.avatar || undefined}
                  className="w-32 h-32 rounded-full border-4 border-slate-50 bg-slate-100 object-cover"
                  alt={member.name}
                />
              </div>
              <div className={`absolute bottom-2 right-2 w-8 h-8 rounded-full border-4 border-white shadow-sm ${(member.role === UserRole.MEMBER || member.role === UserRole.BOARD || member.role === UserRole.ADMIN) ? 'bg-green-500' :
                member.role === UserRole.PROBATION ? 'bg-amber-500' : 'bg-slate-500'
                }`}
                title={member.role}
              />
            </div>

            <div className="flex-1 text-center md:text-left space-y-3">
              <div className="flex flex-col md:flex-row items-center gap-3">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight break-words">{member.name}</h1>
                <Badge variant={member.tier.toLowerCase() as any} className="px-3 py-0.5 text-xs font-bold uppercase tracking-wider">{member.tier}</Badge>
              </div>

              <div className="flex flex-wrap justify-center md:justify-start gap-y-2 gap-x-4 text-sm font-medium text-slate-500">
                <span className="flex items-center gap-2 px-2 py-1 bg-slate-50 rounded-lg border border-slate-100"><Mail size={14} className="text-jci-blue" />{member.email}</span>
                {member.phone && <span className="flex items-center gap-2 px-2 py-1 bg-slate-50 rounded-lg border border-slate-100"><Phone size={14} className="text-jci-blue" />{member.phone}</span>}
                <span className="flex items-center gap-2 px-2 py-1 bg-slate-50 rounded-lg border border-slate-100"><Briefcase size={14} className="text-jci-blue" />{member.role}</span>
                {member.introducer && (
                  <span className="flex items-center gap-2 px-2 py-1 bg-blue-50 text-jci-blue rounded-lg border border-blue-100">
                    <UserPlus size={14} />
                    Introduced by: {member.introducer}
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-2 w-full md:w-auto">
              {(canEditMembers || isSelfView) && (
                <Button variant="outline" size="sm" onClick={() => setShowEditModal(true)} className="flex-1 md:flex-none h-10 px-6 font-bold">Edit Profile</Button>
              )}
              {(isAdmin || isDeveloper) && !isSelfView && (
                <Button
                  variant="outline"
                  size="sm"
                  className={`flex-1 md:flex-none h-10 px-6 font-bold ${member.role === UserRole.INACTIVE ? 'text-green-600 border-green-200 hover:bg-green-50' : 'text-amber-600 border-amber-200 hover:bg-amber-50'}`}
                  onClick={async () => {
                    const newRole = member.role === UserRole.INACTIVE ? UserRole.MEMBER : UserRole.INACTIVE;
                    try {
                      await updateMember(member.id, { role: newRole });
                      showToast(`Member ${newRole === UserRole.INACTIVE ? 'deactivated' : 'activated'} successfully`, 'success');
                      window.location.reload();
                    } catch (err) {
                      showToast('Failed to update member status', 'error');
                    }
                  }}
                >
                  {member.role === UserRole.INACTIVE ? 'Activate Member' : 'Set Inactive'}
                </Button>
              )}
              {isDeveloper && !isSelfView && (
                <Button variant="outline" size="sm" className="flex-1 md:flex-none h-10 px-6 text-red-600 border-red-200 hover:bg-red-50 font-bold" onClick={() => setShowDeleteConfirm(true)}>Delete</Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-t border-slate-100 divide-x divide-slate-100 bg-slate-50/50">
          <div className="p-6 text-center hover:bg-white transition-colors">
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Total Points</p>
            <p className="text-2xl font-black text-jci-blue">{member.points.toLocaleString()}</p>
          </div>
          <div className="p-6 text-center hover:bg-white transition-colors">
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Join Date</p>
            <p className="text-2xl font-black text-slate-900">{formatDateToDDMMMYYYY(member.joinDate)}</p>
          </div>
          <div className="p-6 text-center hover:bg-white transition-colors">
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Attendance</p>
            <p className="text-2xl font-black text-slate-900">{member.attendanceRate}%</p>
          </div>
          <div className="p-6 text-center flex flex-col items-center justify-center hover:bg-white transition-colors">
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2">Dues Status ({new Date().getFullYear()})</p>
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
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white border-none shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Target size={120} />
          </div>
          <div className="relative z-10 p-2">
            <h3 className="text-sm font-black text-blue-300 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Sparkles size={16} /> JCI Pillar Diagnosis
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Individual', val: member.attendanceRate > 80 ? 95 : 65, color: 'bg-blue-400' },
                { label: 'Business', val: member.acceptInternationalBusiness === 'Yes' ? 90 : 40, color: 'bg-emerald-400' },
                { label: 'Community', val: member.role !== UserRole.GUEST ? 85 : 30, color: 'bg-purple-400' },
                { label: 'International', val: member.acceptInternationalBusiness === 'Willing to Explore' ? 75 : 20, color: 'bg-orange-400' }
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
                {member.acceptInternationalBusiness === 'Yes' ? 'GLOBAL ASSET HUNTER' : 'LOCAL COMMUNITY LEADER'}
                <Badge className="bg-jci-blue text-blue text-[8px]">AI Profile</Badge>
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-white border-2 border-slate-900 border-b-8 border-r-8 hover:translate-x-1 hover:translate-y-1 transition-all">
          <div className="p-2">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Coins size={16} className="text-amber-500" /> Ambition & Resources
            </h3>
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase leading-none">Wants (From Assessment)</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {Array.isArray(member.interestedIndustries) && member.interestedIndustries.map(ind => (
                    <Badge key={ind} className="bg-slate-100 text-slate-900 border-none font-bold italic">{ind}</Badge>
                  ))}
                  {(!member.interestedIndustries || member.interestedIndustries.length === 0) && <span className="text-xs text-slate-400 italic">No explicit wants on file.</span>}
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase leading-none">Needs (Matchable Capital)</span>
                <div className="mt-2 p-3 bg-amber-50 rounded-xl border border-amber-100 relative group">
                  <div className="flex items-center gap-2 text-amber-900 font-black text-sm">
                    <Zap size={14} className="fill-amber-500" />
                    {member.specialOffer || 'Ready for Strategic Partnership'}
                  </div>
                  <p className="text-[10px] text-amber-700 mt-1 uppercase font-bold">Available as Bounty Reward</p>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowUpRight size={16} className="text-amber-600" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card title="Basic Information">
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
                  <span className="text-slate-500 block text-xs uppercase font-medium">Gender</span>
                  <p className="font-medium text-slate-900">{member.gender || 'Not provided'}</p>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs uppercase font-medium">Ethnicity</span>
                  <p className="font-medium text-slate-900">{member.ethnicity || 'Not provided'}</p>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs uppercase font-medium">Nationality</span>
                  <p className="font-medium text-slate-900">{member.nationality || 'Not provided'}</p>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs uppercase font-medium">Date of Birth</span>
                  <p className="font-medium text-slate-900">{formatDateToDDMMMYYYY(member.dateOfBirth)}</p>
                </div>
              </div>

              <div className="border-t pt-3">
                <span className="text-slate-500 block text-xs uppercase font-medium mb-1">Introducer</span>
                <p className="text-sm font-medium text-slate-900">{member.introducer || 'Direct Join'}</p>
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
            </div>
          </Card>

          <Card title="Quick Stats">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 rounded-lg text-center">
                <span className="block text-2xl font-bold text-slate-900">{member.points}</span>
                <span className="text-xs text-slate-500 uppercase">Points</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg text-center">
                <span className="block text-2xl font-bold text-slate-900">{member.attendanceRate}%</span>
                <span className="text-xs text-slate-500 uppercase">Attendance</span>
              </div>
            </div>
            <div className="mt-4">
              <Button variant="outline" size="sm" className="w-full" onClick={handleAnalyzeChurn} isLoading={loadingChurnPrediction}>
                <Sparkles size={14} className="mr-2" /> Analyze Churn Risk
              </Button>
            </div>
          </Card>

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

          <Card title="Skills Matrix">
            <div className="flex flex-wrap gap-2">
              {Array.isArray(member.skills) && member.skills.map(skill => (
                <Badge key={skill} variant="neutral">{skill}</Badge>
              ))}
              <button className="px-2 py-1 text-xs border border-dashed border-slate-300 rounded hover:border-jci-blue hover:text-jci-blue transition-colors">
                + Add
              </button>
            </div>
          </Card>

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

          <Card title="Membership & Dues">
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
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card title="Professional & Business">
            <div className="space-y-6">
              <div className="text-sm">
                <p className="font-bold text-slate-900 leading-tight">{member.companyName || 'Freelance / Not Provided'}</p>
                {member.companyWebsite && (
                  <a href={member.companyWebsite.startsWith('http') ? member.companyWebsite : `https://${member.companyWebsite}`} target="_blank" rel="noopener noreferrer" className="text-xs text-jci-blue hover:underline">
                    Visit Website
                  </a>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                <div>
                  <span className="text-slate-500 text-xs uppercase font-medium">Position</span>
                  <p className="font-medium text-slate-900">{member.departmentAndPosition || 'Not provided'}</p>
                </div>
                <div>
                  <span className="text-slate-500 text-xs uppercase font-medium">Industry</span>
                  <p className="font-medium text-slate-900">{member.industry || 'Not provided'}</p>
                </div>
                <div>
                  <span className="text-slate-500 text-xs uppercase font-medium">Intl. Business</span>
                  <p className="font-medium text-slate-900">{member.acceptInternationalBusiness || 'Unknown'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
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
                <div>
                  <span className="text-slate-500 text-xs uppercase font-medium">Interested Industries</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Array.isArray(member.interestedIndustries) && member.interestedIndustries.length > 0 ? (
                      member.interestedIndustries.map((ind, idx) => (
                        <Badge key={idx} variant="info" className="text-[10px] bg-indigo-50 text-indigo-600 border-indigo-100">{ind}</Badge>
                      ))
                    ) : (
                      <span className="text-slate-400 italic">None</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 text-xs uppercase font-medium">International Partnerships</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Array.isArray(member.internationalPartnershipTypes) && member.internationalPartnershipTypes.length > 0 ? (
                      member.internationalPartnershipTypes.map((type, idx) => (
                        <Badge key={idx} variant="info" className="text-[10px] bg-sky-50 text-sky-600 border-sky-100">{type}</Badge>
                      ))
                    ) : (
                      <span className="text-slate-400 italic">None</span>
                    )}
                  </div>
                </div>
              </div>

              {member.companyDescription && (
                <div className="p-3 bg-slate-50 rounded-lg border-l-4 border-slate-300">
                  <span className="text-slate-500 text-xs uppercase font-bold mb-1 block">Company Description</span>
                  <p className="text-xs text-slate-600 leading-relaxed">{member.companyDescription}</p>
                </div>
              )}

              {member.specialOffer && (
                <div className="p-3 bg-jci-blue/5 rounded-lg border-l-4 border-jci-blue">
                  <span className="text-jci-blue text-xs uppercase font-bold mb-1 block">Special Member Offer</span>
                  <p className="text-sm font-medium text-slate-800">{member.specialOffer}</p>
                </div>
              )}
            </div>
          </Card>

          <Card title="Contact Information">
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
                    <p className="text-sm font-bold">{member.whatsappGroup || 'Not Added'}</p>
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
                  <p className="text-xs text-slate-500">{member.emergencyContactRelationship} • {member.emergencyContactPhone}</p>
                </div>

                <h4 className="text-xs font-bold text-slate-400 uppercase border-b pb-1 mt-4">Social Media</h4>
                <div className="flex gap-4">
                  {member.linkedin && <a href={member.linkedin} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-jci-blue"><Linkedin size={20} /></a>}
                  {member.facebook && <a href={member.facebook} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-jci-blue"><Facebook size={20} /></a>}
                  {member.instagram && <a href={member.instagram} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-jci-blue"><Instagram size={20} /></a>}
                  {member.wechat && <div className="text-slate-400 flex items-center gap-1"><MessageCircle size={20} /><span className="text-xs font-medium">{member.wechat}</span></div>}
                </div>
              </div>
            </div>
          </Card>

          <Card title="Apparel & Items">
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
          </Card>

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
                    subtitle: `Board of Directors – ${bp.term}`,
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
                      current:  { dot: 'bg-amber-100 text-amber-600',  badge: 'bg-amber-100 text-amber-700',  label: '现任', icon: 'text-amber-500' },
                      elected:  { dot: 'bg-blue-100 text-blue-600',    badge: 'bg-blue-100 text-blue-700',    label: 'Elected', icon: 'text-blue-500' },
                      former:   { dot: 'bg-slate-100 text-slate-500',  badge: 'bg-slate-100 text-slate-600',  label: '历届', icon: 'text-slate-400' },
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

          <Card title="Recent Badges">
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
        </div>
      </div>

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

      {showEditModal && (
        <Modal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          title={isSelfView ? `Edit Your Profile` : `Edit Member Profile: ${member.name}`}
          size="xl"
          bottomSheet
          scrollInBody={false}
        >
          <MemberEditForm
            member={member}
            onSubmit={handleEditProfile}
            onCancel={() => setShowEditModal(false)}
            selfEditableOnly={isSelfView}
          />
        </Modal>
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
                      <p className="text-xs text-slate-500 mb-2">{match.mentor.role} • {match.mentor.tier}</p>

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
const GuestManagementView: React.FC<{ searchQuery?: string; onSelect: (id: string) => void }> = ({ searchQuery, onSelect }) => {
  const { members, updateMember, batchUpdateMembers } = useMembers();
  const { member: currentMember } = useAuth();
  const { isBoard, isAdmin } = usePermissions();
  const { showToast } = useToast();
  const [guests, setGuests] = useState<Member[]>([]);
  const [probationMembers, setProbationMembers] = useState<Member[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<Member | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showProbationTasksModal, setShowProbationTasksModal] = useState(false);
  const [selectedProbationMember, setSelectedProbationMember] = useState<Member | null>(null);

  const getInitiationYear = (dateStr?: string | null) => {
    if (!dateStr) return new Date().getFullYear();
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed: 9 is October
    return month >= 9 ? year + 1 : year;
  };

  const [approvalYear, setApprovalYear] = useState(getInitiationYear(new Date().toISOString()));

  // Batch approval states
  const [selectedGuestIds, setSelectedGuestIds] = useState<Set<string>>(new Set());
  const [showBatchApprovalModal, setShowBatchApprovalModal] = useState(false);

  const canApprove = isBoard || isAdmin;

  useEffect(() => {
    const term = (searchQuery || '').toLowerCase();
    const filterFn = (m: Member) => {
      if (!term) return true;
      return (
        (m.name ?? '').toLowerCase().includes(term) ||
        (m.email ?? '').toLowerCase().includes(term) ||
        (m.phone ?? '').toLowerCase().includes(term) ||
        (m.fullName ?? '').toLowerCase().includes(term) ||
        (m.address ?? '').toLowerCase().includes(term)
      );
    };

    const guestList = members.filter(m => m.role === UserRole.GUEST && filterFn(m));
    const probationList = members.filter(m => m.role === UserRole.PROBATION && filterFn(m));
    setGuests(guestList);
    setProbationMembers(probationList);
  }, [members, searchQuery]);

  useEffect(() => {
    if (selectedGuest) {
      setApprovalYear(getInitiationYear(selectedGuest.joinDate));
    }
  }, [selectedGuest]);

  const handleApproveGuest = async (guestId: string) => {
    if (!canApprove) {
      showToast('Only board members can approve guests', 'error');
      return;
    }

    try {
      // Default probation tasks
      const defaultTasks: ProbationTask[] = [
        {
          id: `task-${Date.now()}-1`,
          title: 'Attend Orientation Session',
          description: 'Attend the new member orientation session',
          status: 'Pending',
          assignedAt: new Date().toISOString(),
          category: 'Training',
        },
        {
          id: `task-${Date.now()}-2`,
          title: 'Complete Member Profile',
          description: 'Complete your member profile with all required information',
          status: 'Pending',
          assignedAt: new Date().toISOString(),
          category: 'Documentation',
        },
        {
          id: `task-${Date.now()}-3`,
          title: 'Attend First Event',
          description: 'Attend at least one JCI event',
          status: 'Pending',
          assignedAt: new Date().toISOString(),
          category: 'Event',
        },
      ];

      const yearStr = String(approvalYear);

      await updateMember(guestId, {
        role: UserRole.PROBATION,
        membershipType: 'Probation' as any,
        probationTasks: defaultTasks,
        probationApprovedBy: currentMember?.id,
        probationApprovedAt: new Date().toISOString(),
        membership: {
          ...(selectedGuest?.membership || {}),
          [yearStr]: {
            year: approvalYear,
            dues: (selectedGuest?.hasPaidInitiationFee ? 0 : 50) + MembershipDues.Probation, // 300 + 50 = 350
            amount: 0,
            status: 'pending',
            transactionId: []
          }
        }
      });

      showToast('Guest approved and moved to probation member', 'success');
      setShowApprovalModal(false);
      setSelectedGuest(null);
    } catch (err) {
      showToast('Failed to approve guest', 'error');
    }
  };

  const handleBatchApproveGuests = async () => {
    if (!canApprove) {
      showToast('Only board members can approve guests', 'error');
      return;
    }

    try {
      const defaultTasks: ProbationTask[] = [
        {
          id: `task-${Date.now()}-1`,
          title: 'Attend Orientation Session',
          description: 'Attend the new member orientation session',
          status: 'Pending',
          assignedAt: new Date().toISOString(),
          category: 'Training',
        },
        {
          id: `task-${Date.now()}-2`,
          title: 'Complete Member Profile',
          description: 'Complete your member profile with all required information',
          status: 'Pending',
          assignedAt: new Date().toISOString(),
          category: 'Documentation',
        },
        {
          id: `task-${Date.now()}-3`,
          title: 'Attend First Event',
          description: 'Attend at least one JCI event',
          status: 'Pending',
          assignedAt: new Date().toISOString(),
          category: 'Event',
        },
      ];

      const yearStr = String(approvalYear);
      const updates = Array.from(selectedGuestIds).map(id => {
        const guest = guests.find(g => g.id === id);
        return {
          id,
          role: UserRole.PROBATION,
          membershipType: 'Probation' as any,
          probationTasks: defaultTasks,
          probationApprovedBy: currentMember?.id,
          probationApprovedAt: new Date().toISOString(),
          membership: {
            ...(guest?.membership || {}),
            [yearStr]: {
              year: approvalYear,
              dues: (guest?.hasPaidInitiationFee ? 0 : 50) + MembershipDues.Probation, // 300 + 50 = 350
              amount: 0,
              status: 'pending',
              transactionId: []
            }
          }
        } as Partial<Member>;
      });

      await Promise.all(updates.map(update => updateMember(update.id, update)));

      showToast(`Successfully approved ${selectedGuestIds.size} guests`, 'success');
      setShowBatchApprovalModal(false);
      setSelectedGuestIds(new Set());
    } catch (err) {
      showToast('Failed to approve guests', 'error');
    }
  };

  const toggleGuestSelection = (id: string) => {
    setSelectedGuestIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllGuests = () => {
    if (selectedGuestIds.size === guests.length && guests.length > 0) {
      setSelectedGuestIds(new Set());
    } else {
      setSelectedGuestIds(new Set(guests.map(g => g.id)));
    }
  };

  const handleCompleteTask = async (memberId: string, taskId: string) => {
    try {
      const member = members.find(m => m.id === memberId);
      if (!member || !member.probationTasks) return;

      const updatedTasks = member.probationTasks.map(task =>
        task.id === taskId
          ? { ...task, status: 'Completed' as const, completedAt: new Date().toISOString() }
          : task
      );

      // Check if all tasks are completed
      const allCompleted = updatedTasks.every(task => task.status === 'Completed' || task.status === 'Verified');

      await updateMember(memberId, {
        probationTasks: updatedTasks,
        ...(allCompleted && {
          role: UserRole.MEMBER,
          probationCompletedAt: new Date().toISOString(),
        }),
      });

      if (allCompleted) {
        showToast('All probation tasks completed! Member promoted to official member', 'success');
      } else {
        showToast('Task marked as completed', 'success');
      }
    } catch (err) {
      showToast('Failed to update task', 'error');
    }
  };

  const handleVerifyTask = async (memberId: string, taskId: string) => {
    if (!canApprove) {
      showToast('Only board members can verify tasks', 'error');
      return;
    }

    try {
      const member = members.find(m => m.id === memberId);
      if (!member || !member.probationTasks) return;

      const updatedTasks = member.probationTasks.map(task =>
        task.id === taskId
          ? {
            ...task,
            status: 'Verified' as const,
            verifiedBy: currentMember?.id,
            verifiedAt: new Date().toISOString(),
          }
          : task
      );

      // Check if all tasks are verified
      const allVerified = updatedTasks.every(task => task.status === 'Verified');

      await updateMember(memberId, {
        probationTasks: updatedTasks,
        ...(allVerified && {
          role: UserRole.MEMBER,
          probationCompletedAt: new Date().toISOString(),
        }),
      });

      if (allVerified) {
        showToast('All tasks verified! Member promoted to official member', 'success');
      } else {
        showToast('Task verified', 'success');
      }
    } catch (err) {
      showToast('Failed to verify task', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Guests Section - Rendered directly without outer Card wrapper */}
      <div className="space-y-4">
        {guests.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {canApprove && (
              <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 text-jci-blue focus:ring-jci-blue"
                    checked={selectedGuestIds.size === guests.length && guests.length > 0}
                    onChange={toggleAllGuests}
                  />
                  <span className="text-sm font-medium text-slate-700">
                    Select All ({selectedGuestIds.size} selected)
                  </span>
                </div>
                {selectedGuestIds.size > 0 && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      let defaultYear = getInitiationYear(new Date().toISOString());
                      if (selectedGuestIds.size > 0) {
                        const firstId = Array.from(selectedGuestIds)[0];
                        const firstGuest = guests.find(g => g.id === firstId);
                        defaultYear = getInitiationYear(firstGuest?.joinDate);
                      }
                      setApprovalYear(defaultYear);
                      setShowBatchApprovalModal(true);
                    }}
                    className="flex items-center gap-2"
                  >
                    <UserCheck size={14} />
                    Batch Approve
                  </Button>
                )}
              </div>
            )}
            {guests.map(guest => (
              <div key={guest.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all gap-4">
                <div className="flex items-center gap-4 flex-1">
                  {canApprove && (
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 text-jci-blue focus:ring-jci-blue"
                      checked={selectedGuestIds.has(guest.id)}
                      onChange={() => toggleGuestSelection(guest.id)}
                    />
                  )}
                  <div className="relative">
                    <img src={guest.avatar || undefined} className="w-12 h-12 rounded-full border border-slate-100" alt={guest.name} />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-slate-500 border-2 border-white rounded-full"></div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="font-bold text-slate-900 break-words">{guest.name}</div>
                      <Badge variant="neutral" className="bg-slate-100 text-slate-600 border-none px-2 py-0 text-[10px] uppercase font-bold tracking-wider shrink-0">Guest</Badge>
                    </div>
                    <div className="flex flex-col gap-0.5 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Mail size={12} className="shrink-0" /> {guest.email}</span>
                      {guest.phone && <span className="flex items-center gap-1"><Phone size={12} className="shrink-0" /> {guest.phone}</span>}
                      <span className="flex items-center gap-1"><Calendar size={12} className="shrink-0" /> Joined: {formatDateToDDMMMYYYY(guest.joinDate)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSelect(guest.id)}
                    className="flex-1 sm:flex-none h-9 px-4 rounded-lg font-medium text-slate-600 hover:text-jci-blue hover:border-jci-blue hover:bg-jci-blue/5 transition-colors"
                  >
                    <FileText size={14} className="mr-2" />
                    Review
                  </Button>
                  {canApprove && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedGuest(guest);
                        setApprovalYear(getInitiationYear(guest.joinDate));
                        setShowApprovalModal(true);
                      }}
                      className="flex-1 sm:flex-none h-9 px-4 rounded-lg font-bold bg-jci-blue hover:bg-jci-navy text-white shadow-sm shadow-jci-blue/20 transition-colors"
                    >
                      <UserCheck size={14} className="mr-2" />
                      Approve
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <Users className="mx-auto text-slate-300 mb-3" size={32} />
            <p className="text-slate-500 font-medium">No guests pending approval</p>
          </div>
        )}
      </div>

      {/* Approval Modal */}
      {showApprovalModal && selectedGuest && (
        <Modal
          isOpen={showApprovalModal}
          onClose={() => {
            setShowApprovalModal(false);
            setSelectedGuest(null);
          }}
          title={`Approve Guest: ${selectedGuest.name}`}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Approving this guest will move them to probation member status. They will need to complete probation tasks before becoming an official member.
            </p>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">Default Probation Tasks:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Attend Orientation Session</li>
                <li>• Complete Member Profile</li>
                <li>• Attend First Event</li>
              </ul>
            </div>

            <div className="space-y-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <label className="block text-sm font-bold text-amber-700 mb-1">Set Initiation Year:</label>
              <select
                value={approvalYear}
                onChange={(e) => setApprovalYear(parseInt(e.target.value))}
                className="w-full rounded-lg border-2 border-amber-200 bg-white px-3 py-2 text-sm font-bold text-amber-900 focus:border-amber-500"
              >
                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + 2 - i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <p className="text-[10px] text-amber-600 italic">This will set the year for the initial membership record.</p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowApprovalModal(false);
                  setSelectedGuest(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleApproveGuest(selectedGuest.id)}
              >
                <UserCheck size={16} className="mr-2" />
                Approve as Probation Member
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Batch Approval Modal */}
      {showBatchApprovalModal && (
        <Modal
          isOpen={showBatchApprovalModal}
          onClose={() => setShowBatchApprovalModal(false)}
          title={`Approve ${selectedGuestIds.size} Guests`}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Approving these guests will move them to probation member status. They will need to complete probation tasks before becoming official members.
            </p>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">Default Probation Tasks:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Attend Orientation Session</li>
                <li>• Complete Member Profile</li>
                <li>• Attend First Event</li>
              </ul>
            </div>

            <div className="space-y-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <label className="block text-sm font-bold text-amber-700 mb-1">Set Initiation Year for All:</label>
              <select
                value={approvalYear}
                onChange={(e) => setApprovalYear(parseInt(e.target.value))}
                className="w-full rounded-lg border-2 border-amber-200 bg-white px-3 py-2 text-sm font-bold text-amber-900 focus:border-amber-500"
              >
                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + 2 - i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <p className="text-[10px] text-amber-600 italic">This will set the year for their initial membership records.</p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowBatchApprovalModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBatchApproveGuests}
              >
                <UserCheck size={16} className="mr-2" />
                Batch Approve
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Probation Tasks Modal */}
      {showProbationTasksModal && selectedProbationMember && (
        <Modal
          isOpen={showProbationTasksModal}
          onClose={() => {
            setShowProbationTasksModal(false);
            setSelectedProbationMember(null);
          }}
          title={`Probation Tasks: ${selectedProbationMember.name}`}
          size="lg"
        >
          <div className="space-y-4">
            {selectedProbationMember.probationTasks && selectedProbationMember.probationTasks.length > 0 ? (
              <div className="space-y-3">
                {selectedProbationMember.probationTasks.map(task => (
                  <div
                    key={task.id}
                    className={`p-4 border rounded-lg ${task.status === 'Verified'
                      ? 'bg-green-50 border-green-200'
                      : task.status === 'Completed'
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-slate-50 border-slate-200'
                      }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-3 gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-slate-900 truncate">{task.title}</h4>
                          <Badge
                            className="shrink-0"
                            variant={
                              task.status === 'Verified'
                                ? 'success'
                                : task.status === 'Completed'
                                  ? 'info'
                                  : 'neutral'
                            }
                          >
                            {task.status}
                          </Badge>
                        </div>
                        {task.description && (
                          <p className="text-sm text-slate-600 mb-2">{task.description}</p>
                        )}
                        {task.category && (
                          <Badge variant="neutral">{task.category}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      {task.status === 'Pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCompleteTask(selectedProbationMember.id, task.id)}
                        >
                          <CheckCircle size={14} className="mr-2" />
                          Mark Complete
                        </Button>
                      )}
                      {task.status === 'Completed' && canApprove && (
                        <Button
                          size="sm"
                          onClick={() => handleVerifyTask(selectedProbationMember.id, task.id)}
                        >
                          <Shield size={14} className="mr-2" />
                          Verify
                        </Button>
                      )}
                      {task.verifiedAt && (
                        <span className="text-xs text-slate-500">
                          Verified on {new Date(task.verifiedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-slate-500 py-4">No probation tasks assigned</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
