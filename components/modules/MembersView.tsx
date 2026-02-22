import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import {
  Trash2, Settings, X, ChevronDown, Sparkles, ArrowLeft, Phone, Mail,
  Award, Clock, Briefcase, GraduationCap, UserPlus, Search, Users,
  TrendingUp, Zap, Download, Upload, BarChart3, FileText, RefreshCw,
  Calendar, Shield, UserCheck, AlertCircle, CheckCircle, MapPin,
  Linkedin, Facebook, Instagram, MessageCircle, CalendarCheck, UserCog
} from 'lucide-react';
import { Button, Card, Badge, ProgressBar, Modal, useToast, Pagination, Tabs } from '../ui/Common';
import { Input, Select, Textarea, ButtonGroup } from '../ui/Form';
import { MemberEditForm } from './MemberEditForm';
import { LoadingState } from '../ui/Loading';
import { useMembers } from '../../hooks/useMembers';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { UserRole, Member, MemberTier, ProbationTask } from '../../types';
import { MembersService } from '../../services/membersService';
import { MEMBER_SELF_EDITABLE_FIELDS } from '../../config/constants';
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
import { BoardOfDirectorsSection } from './MemberManagement/BoardOfDirectorsSection';
import { MemberBatchImportModal } from './Members/MemberBatchImportModal';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const HOBBY_OPTIONS = [
  "Art & Design", "Badminton", "Baking", "Basketball", "Car Enthusiast",
  "Cigar", "Cooking", "Cycling", "Dancing", "Diving",
  "E-Sport Mlbb", "Fashion", "Golf", "Hiking", "Leadership",
  "Liquor/ Wine Tasting", "Make Up", "Movie", "Other E-Sport", "Pickle Ball",
  "Pilates", "Public Speaking", "Reading", "Rock Climbing", "Singing",
  "Social Etiquette", "Social Service", "Travelling", "Women Empowerment", "Yoga"
];

const COUNTRIES = [
  'Malaysia', 'Singapore', 'Indonesia', 'Thailand', 'Vietnam', 'Philippines',
  'China', 'Japan', 'South Korea', 'India', 'Australia', 'New Zealand',
  'United States', 'United Kingdom', 'Canada', 'Germany', 'France', 'Other'
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
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div><span className="text-slate-500">姓名</span><p className="font-medium">{member.name}</p></div>
          <div><span className="text-slate-500">角色</span><p className="font-medium">{member.role}</p></div>
          <div><span className="text-slate-500">入会日期</span><p className="font-medium">{member.joinDate}</p></div>
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
      <Card className="p-6">
        <h3 className="font-semibold text-slate-800 mb-4">Dues Status & Participation History</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <span className="text-slate-500 text-sm">Dues Status</span>
            <p className="font-medium">{DUES_STATUS_LABEL[member.duesStatus] ?? member.duesStatus ?? '—'}</p>
          </div>
          <div>
            <span className="text-slate-500 text-sm">Dues Year</span>
            <p className="font-medium">{member.duesYear ?? '—'}</p>
          </div>
          <div>
            <span className="text-slate-500 text-sm">Last Payment Date</span>
            <p className="font-medium">{member.duesPaidDate ?? '—'}</p>
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

export const MembersView: React.FC = () => {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [activeTab, setActiveTab] = useState<'directory' | 'guest' | 'statistics' | 'board-of-directors' | 'mentorship' | 'promotion-tracking'>('directory');
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
  const [loIdFilter, setLoIdFilter] = useState<string | null>(null);
  const { members, loading, error, createMember, updateMember, deleteMember, batchUpdateMembers, batchDeleteMembers, loadMembers } = useMembers(loIdFilter);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchActionModalOpen, setIsBatchActionModalOpen] = useState(false);
  const [batchActionType, setBatchActionType] = useState<'delete' | 'set' | null>(null);
  const [batchSetField, setBatchSetField] = useState<string>('');
  const [batchSetValue, setBatchSetValue] = useState<any>('');

  const { member: currentMember } = useAuth();
  const { isAdmin, isBoard, isOrganizationSecretary } = usePermissions();
  const { showToast } = useToast();
  const canManageMembers = isAdmin || isBoard || isOrganizationSecretary;

  const selectedMember = members.find(m => m.id === selectedMemberId);

  // Filter members based on search
  const filteredMembers = useMemo(() => {
    return searchTerm
      ? members.filter(m =>
        (m.name ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.email ?? '').toLowerCase().includes(searchTerm.toLowerCase())
      )
      : members;
  }, [members, searchTerm]);

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

  // Reset to page 1 when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

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

  const handleAddMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const name = `${firstName} ${lastName}`.trim();
    const email = formData.get('email') as string;

    try {
      const skillsInput = formData.get('skills') as string;
      const skills = skillsInput ? skillsInput.split(',').map(s => s.trim()).filter(s => s.length > 0) : [];

      const hobbies = addModalHobbies.length > 0 ? addModalHobbies : undefined;

      const interestedIndustriesInput = formData.get('interestedIndustries') as string;
      const interestedIndustries = interestedIndustriesInput ? interestedIndustriesInput.split(',').map(s => s.trim()).filter(s => s.length > 0) : undefined;

      const newMember: Omit<Member, 'id'> = {
        name,
        email,
        phone: formData.get('phone') as string || '',
        role: (formData.get('role') as UserRole) || UserRole.MEMBER,
        tier: (formData.get('tier') as MemberTier) || MemberTier.BRONZE,
        points: 0,
        joinDate: new Date().toISOString().split('T')[0],
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0097D7&color=fff`,
        churnRisk: (formData.get('churnRisk') as any) || 'Low',
        attendanceRate: parseInt(formData.get('attendanceRate') as string) || 100,
        duesStatus: (formData.get('duesStatus') as any) || 'Pending',
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

        // Membership
        membershipType: (formData.get('membershipType') as any) || undefined,
        duesYear: formData.get('duesYear') ? parseInt(formData.get('duesYear') as string) : undefined,
        duesPaidDate: formData.get('duesPaidDate') as string || undefined,
        senatorCertified: formData.get('senatorCertified') === 'on',

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
        whatsappGroup: formData.get('whatsappGroup') as string || undefined,
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
      setAddModalOpen(false);
      showToast('Member registered successfully', 'success');
      e.currentTarget.reset();
    } catch (error) {
      // Error is already handled in the hook
    }
  };

  // Self-view or Guest view: only show profile detail
  if (!canManageMembers && currentMember) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Profile</h2>
        </div>
        <MemberDetail member={currentMember} onBack={() => { }} isSelfView />
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
              <Button variant="outline"><Sparkles size={16} className="mr-2" /> AI Analysis</Button>
            </div>
          </div>

          <Card noPadding>
            <div className="px-4 md:px-6 pt-4">
              <Tabs
                tabs={['Directory', 'Guest', 'Statistics', 'Board of Directors', 'Mentorship', 'Promotion Tracking']}
                activeTab={
                  activeTab === 'directory' ? 'Directory' :
                    activeTab === 'guest' ? 'Guest' :
                      activeTab === 'statistics' ? 'Statistics' :
                        activeTab === 'board-of-directors' ? 'Board of Directors' :
                          activeTab === 'mentorship' ? 'Mentorship' : 'Promotion Tracking'
                }
                onTabChange={(tab) => {
                  if (tab === 'Directory') setActiveTab('directory');
                  else if (tab === 'Guest') setActiveTab('guest');
                  else if (tab === 'Statistics') setActiveTab('statistics');
                  else if (tab === 'Board of Directors') setActiveTab('board-of-directors');
                  else if (tab === 'Mentorship') setActiveTab('mentorship');
                  else setActiveTab('promotion-tracking');
                }}
              />
            </div>
            <div className="p-6">
              {activeTab === 'directory' && (
                <>

                  {/* Search Bar */}
                  <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                    <Input
                      placeholder="Search members by name or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <LoadingState loading={loading} error={error} empty={filteredMembers.length === 0} emptyMessage="No members found">
                    <MemberTable
                      members={paginatedMembers}
                      onSelect={setSelectedMemberId}
                      selectedIds={selectedIds}
                      onToggleSelection={toggleSelection}
                      onToggleAll={toggleAll}
                      isAllSelected={isAllSelected}
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
                </>
              )}

              {activeTab === 'guest' && (
                <GuestManagementView />
              )}

              {activeTab === 'statistics' && (
                <MemberStatisticsView statistics={statistics} loading={loadingStats} />
              )}

              {activeTab === 'board-of-directors' && (
                <BoardOfDirectorsSection members={members} canManage={canManageMembers} />
              )}

              {activeTab === 'mentorship' && (
                <MentorMatching />
              )}

              {activeTab === 'promotion-tracking' && (
                <PromotionTracking />
              )}
            </div>
          </Card>
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
        />
      )}

      {/* Batch Action Modal */}
      <Modal
        isOpen={isBatchActionModalOpen}
        onClose={() => setIsBatchActionModalOpen(false)}
        title={batchActionType === 'delete' ? 'Confirm Batch Delete' : 'Batch Set Fields'}
      >
        <div className="space-y-4">
          {batchActionType === 'delete' ? (
            <>
              <p className="text-slate-600">Are you sure you want to delete <span className="font-bold text-red-600">{selectedIds.size}</span> members? This action cannot be undone.</p>
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setIsBatchActionModalOpen(false)}>Cancel</Button>
                <Button variant="danger" onClick={async () => {
                  await batchDeleteMembers(Array.from(selectedIds));
                  setSelectedIds(new Set());
                  setIsBatchActionModalOpen(false);
                }}>Delete Members</Button>
              </div>
            </>
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
                      options={Object.values(UserRole).map(r => ({ label: r, value: r }))}
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

              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setIsBatchActionModalOpen(false)}>Cancel</Button>
                <Button disabled={!batchSetField || !batchSetValue} onClick={async () => {
                  const updates: Partial<Member> = { [batchSetField]: batchSetValue };
                  await batchUpdateMembers(Array.from(selectedIds), updates);
                  setSelectedIds(new Set());
                  setIsBatchActionModalOpen(false);
                }}>Apply Changes</Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal isOpen={isAddModalOpen} onClose={() => setAddModalOpen(false)} title="Register New Member" size="xl" drawerOnMobile>
        <form onSubmit={handleAddMember} className="space-y-4">
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
                  <Select name="nationality" label="Nationality" defaultValue="Malaysia" options={COUNTRIES.map(c => ({ label: c, value: c }))} />

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
                  <Select name="role" label="System Role" defaultValue={UserRole.MEMBER} options={Object.values(UserRole).map(r => ({ label: r, value: r }))} />
                  <Select name="membershipType" label="Membership Type" options={['Full', 'Probation', 'Honorary', 'Visiting', 'Senator'].map(t => ({ label: t, value: t }))} />
                  <Select name="duesStatus" label="Dues Status" defaultValue="Pending" options={['Paid', 'Pending', 'Overdue'].map(s => ({ label: s, value: s }))} />
                  <Input name="introducer" label="Introducer Name" placeholder="Who brought them in?" />
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold text-slate-900 border-b pb-2 mb-4">Professional Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Input name="companyName" label="Company Name" />
                  <Input
                    name="industry"
                    label="Industry"
                    list="register-industry-options"
                    placeholder="Select or type..."
                  />
                  <datalist id="register-industry-options">
                    {INDUSTRY_OPTIONS.map(opt => (
                      <option key={opt} value={opt} />
                    ))}
                  </datalist>
                  <div className="col-span-2">
                    <Input name="skills" label="Skills (comma-separated)" placeholder="Leadership, Networking, Marketing..." />
                  </div>
                  <div className="col-span-2">
                    <Input name="interestedIndustries" label="Interested Industries (comma-separated)" placeholder="Technology, Finance, Healthcare..." />
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

          <div className="pt-4 border-t flex gap-3">
            <Button variant="outline" className="flex-1" type="button" onClick={() => setAddModalOpen(false)}>Cancel</Button>
            <Button className="flex-1" type="submit">Register Member</Button>
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
      <Modal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} title="Export Data" drawerOnMobile>
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
          <Button onClick={handleExportFromModal} disabled={isExporting} className="w-full">
            <Download size={16} className="mr-2" />
            {isExporting ? 'Exporting...' : `Export ${exportType} as ${exportFormat}`}
          </Button>
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
  if (loading) {
    return <div className="text-center py-8 text-slate-400">Loading statistics...</div>;
  }

  if (!statistics) {
    return <div className="text-center py-8 text-slate-400">No statistics available</div>;
  }

  const tierData = Object.entries(statistics.membersByTier).map(([tier, count]) => ({ name: tier, value: count }));
  const roleData = Object.entries(statistics.membersByRole).map(([role, count]) => ({ name: role, value: count }));
  const COLORS = ['#0097D7', '#6EC4E8', '#1C3F94', '#00B5B5'];

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <div className="text-sm text-slate-500 mb-1">Total Members</div>
          <div className="text-2xl font-bold text-slate-900">{statistics.totalMembers}</div>
        </Card>
        <Card>
          <div className="text-sm text-slate-500 mb-1">Active Members</div>
          <div className="text-2xl font-bold text-green-600">{statistics.activeMembers}</div>
        </Card>
        <Card>
          <div className="text-sm text-slate-500 mb-1">New This Month</div>
          <div className="text-2xl font-bold text-blue-600">{statistics.newMembersThisMonth}</div>
        </Card>
        <Card>
          <div className="text-sm text-slate-500 mb-1">Average Points</div>
          <div className="text-2xl font-bold text-amber-600">{statistics.averagePoints}</div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Members by Tier">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={tierData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {tierData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Members by Role">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={roleData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip />
              <Bar dataKey="value" fill="#0097D7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="Engagement Metrics">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{statistics.engagementMetrics.highlyEngaged}</div>
            <div className="text-sm text-slate-600 mt-1">Highly Engaged (&gt;80%)</div>
          </div>
          <div className="text-center p-4 bg-amber-50 rounded-lg">
            <div className="text-2xl font-bold text-amber-600">{statistics.engagementMetrics.moderatelyEngaged}</div>
            <div className="text-sm text-slate-600 mt-1">Moderately Engaged (50-80%)</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{statistics.engagementMetrics.lowEngaged}</div>
            <div className="text-sm text-slate-600 mt-1">Low Engaged (&lt;50%)</div>
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
  onBatchSet: () => void
}> = ({ selectedCount, onClear, onBatchDelete, onBatchSet }) => {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 border border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-3 pr-6 border-r border-white/20">
          <div className="w-8 h-8 rounded-full bg-jci-blue flex items-center justify-center font-bold text-sm">
            {selectedCount}
          </div>
          <span className="text-sm font-medium whitespace-nowrap">Members selected</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={onBatchSet}
            className="text-white hover:bg-white/10"
          >
            <Settings size={16} className="mr-2" />
            Batch Set
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onBatchDelete}
            className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
          >
            <Trash2 size={16} className="mr-2" />
            Delete
          </Button>
        </div>

        <button
          onClick={onClear}
          className="p-1 hover:bg-white/10 rounded-full transition-colors ml-2"
          title="Clear selection"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

// Member Table Component
const MemberTable: React.FC<{
  members: Member[],
  onSelect: (id: string) => void,
  selectedIds: Set<string>,
  onToggleSelection: (id: string) => void,
  onToggleAll: () => void,
  isAllSelected: boolean
}> = ({ members, onSelect, selectedIds, onToggleSelection, onToggleAll, isAllSelected }) => {
  return (
    <Card noPadding>
      {/* Desktop View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left">
          <thead>
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
              <th className="px-6 py-4 text-sm font-semibold text-slate-500">Role</th>
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
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="h-32 bg-gradient-to-r from-jci-blue to-jci-navy"></div>
        <div className="flex items-end gap-4 px-6 -mt-12 pb-6">
          <div className="relative">
            <img src={member.avatar || undefined} className="w-24 h-24 rounded-full border-4 border-white bg-slate-100 shadow-md" alt="" />
            <div className={`absolute bottom-1 right-1 w-6 h-6 rounded-full border-4 border-white ${(member.role === UserRole.MEMBER || member.role === UserRole.BOARD || member.role === UserRole.ADMIN) ? 'bg-green-500' :
              member.role === UserRole.PROBATION_MEMBER ? 'bg-amber-500' : 'bg-slate-500'
              }`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-slate-900 truncate">{member.name}</h1>
              <Badge variant={member.tier.toLowerCase() as any}>{member.tier}</Badge>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-slate-500">
              <span className="flex items-center gap-1.5"><Mail size={14} />{member.email}</span>
              {member.phone && <span className="flex items-center gap-1.5"><Phone size={14} />{member.phone}</span>}
              <span className="flex items-center gap-1.5"><Briefcase size={14} />{member.role}</span>
              {member.introducer && (
                <span className="flex items-center gap-1.5 text-jci-blue font-medium">
                  <UserPlus size={14} />
                  Introduced by: {member.introducer}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {(canEditMembers || isSelfView) && (
              <Button variant="outline" size="sm" onClick={() => setShowEditModal(true)}>Edit Profile</Button>
            )}
            {(isAdmin || (isDeveloper && effectiveRole === UserRole.ADMIN)) && !isSelfView && (
              <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setShowDeleteConfirm(true)}>Delete</Button>
            )}
            {!isSelfView && (
              <Button variant="outline" size="sm" className="hidden md:flex">Message</Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-slate-50 border-t border-slate-100">
          <div className="text-center md:text-left">
            <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Total Points</p>
            <p className="text-xl font-bold text-jci-blue">{member.points.toLocaleString()}</p>
          </div>
          <div className="text-center md:text-left">
            <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Join Date</p>
            <p className="text-xl font-bold text-slate-900">{member.joinDate}</p>
          </div>
          <div className="text-center md:text-left">
            <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Attendance</p>
            <p className="text-xl font-bold text-slate-900">{member.attendanceRate}%</p>
          </div>
          <div className="text-center md:text-left">
            <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Dues Status</p>
            <Badge variant={member.duesStatus === 'Paid' ? 'success' : member.duesStatus === 'Overdue' ? 'error' : 'warning'}>
              {member.duesStatus}
            </Badge>
          </div>
        </div>
      </section>

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
                  <p className="font-medium text-slate-900">{member.dateOfBirth || 'Not provided'}</p>
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
                  <p className="font-bold text-slate-900">{member.membershipType || 'Standard'}</p>
                </div>
                {member.senatorCertified && (
                  <Badge variant="success" className="animate-pulse">Senator Certified</Badge>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Payment Status:</span>
                  <Badge variant={member.duesStatus === 'Paid' ? 'success' : member.duesStatus === 'Overdue' ? 'error' : 'warning'}>
                    {member.duesStatus}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Dues Paid Year:</span>
                  <span className="font-bold">{member.duesYear || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Payment Date:</span>
                  <span className="font-medium">{member.duesPaidDate || 'N/A'}</span>
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

              <div className="text-sm">
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
              <div className="relative">
                <div className="absolute -left-8 bg-green-100 text-green-600 p-1 rounded-full border-4 border-white">
                  <UserPlus size={14} />
                </div>
                <span className="text-xs text-slate-400 font-mono mb-1 block">{member.joinDate}</span>
                <h4 className="text-sm font-bold text-slate-900">Joined JCI Local Chapter</h4>
              </div>

              {Array.isArray(member.careerHistory) && member.careerHistory.map((milestone, idx) => (
                <div key={idx} className="relative">
                  <div className="absolute -left-8 bg-blue-100 text-jci-blue p-1 rounded-full border-4 border-white">
                    <Briefcase size={14} />
                  </div>
                  <span className="text-xs text-slate-400 font-mono mb-1 block">{milestone.year}</span>
                  <h4 className="text-sm font-bold text-slate-900">{milestone.role}</h4>
                  <p className="text-sm text-slate-600">{milestone.description}</p>
                </div>
              ))}
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
const GuestManagementView: React.FC = () => {
  const { members, updateMember } = useMembers();
  const { member: currentMember } = useAuth();
  const { isBoard, isAdmin } = usePermissions();
  const { showToast } = useToast();
  const [guests, setGuests] = useState<Member[]>([]);
  const [probationMembers, setProbationMembers] = useState<Member[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<Member | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showProbationTasksModal, setShowProbationTasksModal] = useState(false);
  const [selectedProbationMember, setSelectedProbationMember] = useState<Member | null>(null);
  const canApprove = isBoard || isAdmin;

  useEffect(() => {
    const guestList = members.filter(m => m.role === UserRole.GUEST);
    const probationList = members.filter(m => m.role === UserRole.PROBATION_MEMBER);
    setGuests(guestList);
    setProbationMembers(probationList);
  }, [members]);

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

      await updateMember(guestId, {
        role: UserRole.PROBATION_MEMBER,
        probationTasks: defaultTasks,
        probationApprovedBy: currentMember?.id,
        probationApprovedAt: new Date().toISOString(),
      });

      showToast('Guest approved and moved to probation member', 'success');
      setShowApprovalModal(false);
      setSelectedGuest(null);
    } catch (err) {
      showToast('Failed to approve guest', 'error');
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
      {/* Guests Section */}
      <Card title="Pending Guest Approvals">
        {guests.length === 0 ? (
          <p className="text-center text-slate-500 py-4">No guests pending approval</p>
        ) : (
          <div className="space-y-3">
            {guests.map(guest => (
              <div key={guest.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <img src={guest.avatar || undefined} className="w-10 h-10 rounded-full" alt={guest.name} />
                  <div>
                    <div className="font-medium text-slate-900">{guest.name}</div>
                    <div className="text-sm text-slate-500">{guest.email}</div>
                    {guest.phone && <div className="text-xs text-slate-400">{guest.phone}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="neutral">Guest</Badge>
                  {canApprove && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedGuest(guest);
                        setShowApprovalModal(true);
                      }}
                    >
                      <UserCheck size={14} className="mr-2" />
                      Approve
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Probation Members Section */}
      <Card title="Probation Members">
        {probationMembers.length === 0 ? (
          <p className="text-center text-slate-500 py-4">No probation members</p>
        ) : (
          <div className="space-y-3">
            {probationMembers.map(member => {
              const tasks = member.probationTasks || [];
              const completedTasks = tasks.filter(t => t.status === 'Completed' || t.status === 'Verified').length;
              const totalTasks = tasks.length;
              const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
              const allCompleted = totalTasks > 0 && completedTasks === totalTasks;

              return (
                <div key={member.id} className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <img src={member.avatar || undefined} className="w-10 h-10 rounded-full" alt={member.name} />
                      <div>
                        <div className="font-medium text-slate-900">{member.name}</div>
                        <div className="text-sm text-slate-500">{member.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={allCompleted ? 'success' : 'warning'}>
                        {allCompleted ? 'Ready for Promotion' : 'Probation'}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedProbationMember(member);
                          setShowProbationTasksModal(true);
                        }}
                      >
                        View Tasks
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Progress: {completedTasks}/{totalTasks} tasks</span>
                      <span className="font-medium text-slate-900">{Math.round(progress)}%</span>
                    </div>
                    <ProgressBar progress={progress} color={allCompleted ? 'bg-green-500' : 'bg-blue-500'} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

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
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900">{task.title}</h4>
                        {task.description && (
                          <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                        )}
                        {task.category && (
                          <Badge variant="neutral" className="mt-2">{task.category}</Badge>
                        )}
                      </div>
                      <Badge
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