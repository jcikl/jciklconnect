import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Search, TrendingUp, Users, DollarSign, Calendar, Briefcase, Award, AlertTriangle, CheckCircle, BarChart3, FileText, Download, PieChart, Activity, Package, Building2, Heart, CreditCard, RefreshCw, Clock, Sparkles, AlertCircle, Lightbulb, Cake, Gift, Zap, Eye, LayoutDashboard, CheckSquare, BookOpen, Target, Smartphone, FileCheck, Edit3, MessageCircle, Phone, XCircle } from 'lucide-react';
import { Card, StatCard, Badge, Button, Tabs, Modal, useToast } from '../ui/Common';
import { Select, Input } from '../ui/Form';
import { useMembers } from '../../hooks/useMembers';
import { useEvents } from '../../hooks/useEvents';
import { useProjects } from '../../hooks/useProjects';
import { usePoints } from '../../hooks/usePoints';
import { useInventory } from '../../hooks/useInventory';
import { useHobbyClubs } from '../../hooks/useHobbyClubs';
import { useBusinessDirectory } from '../../hooks/useBusinessDirectory';
import { FinanceService } from '../../services/financeService';
import { ReportService, ReportOptions } from '../../services/reportService';
import { AIPredictionService } from '../../services/aiPredictionService';
import { formatCurrency } from '../../utils/formatUtils';
import { UserRole, Member } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { MemberGrowthChart, PointsDistributionChart } from './Analytics';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type MemberWithDues = Member & { duesStatus: string; duesYear: number; duesPaidDate?: string; latestPaidYear?: string | null };

const HOBBY_OPTIONS = [
  "Art & Design", "Badminton", "Baking", "Basketball", "Car Enthusiast",
  "Cigar", "Cooking", "Cycling", "Dancing", "Diving",
  "E-Sport Mlbb", "Fashion", "Golf", "Hiking", "Leadership",
  "Liquor/ Wine Tasting", "Make Up", "Movie", "Other E-Sport", "Pickle Ball",
  "Pilates", "Public Speaking", "Reading", "Rock Climbing", "Singing",
  "Social Etiquette", "Social Service", "Travelling", "Women Empowerment", "Yoga"
];

interface BoardDashboardProps {
  onNavigate?: (view: any, memberId?: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  scrollRef?: React.RefObject<HTMLDivElement>;
}

export const BoardDashboard: React.FC<BoardDashboardProps> = ({ onNavigate, searchQuery, onSearchChange, scrollRef }) => {
  const { member, isDevMode, simulatedRole, simulateRole } = useAuth();
  const { members: rawMembers, loading: membersLoading } = useMembers();
  const members = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return rawMembers.map(m => {
      const record = (m.membership as any)?.[currentYear];
      const isPaid = record?.status === 'paid' || record?.status === 'over paid';
      const isOverdue = record?.status === 'overdue';

      // Find the latest paid year in membership history
      let latestPaidYear: string | null = null;
      if (m.membership) {
        const paidYears = Object.entries(m.membership)
          .filter(([_, rec]: [string, any]) => rec.status === 'paid' || rec.status === 'over paid')
          .map(([year]) => parseInt(year, 10));
        if (paidYears.length > 0) {
          latestPaidYear = Math.max(...paidYears).toString();
        }
      }

      return {
        ...m,
        duesStatus: isPaid ? 'Paid' : isOverdue ? 'Overdue' : 'Pending',
        duesYear: record?.year || currentYear,
        duesPaidDate: record?.paymentDate,
        latestPaidYear
      } as MemberWithDues;
    });
  }, [rawMembers]);
  const { events, loading: eventsLoading } = useEvents();
  const { projects, loading: projectsLoading } = useProjects();
  const { leaderboard, pointHistory } = usePoints();
  const { items: inventoryItems, loading: inventoryLoading } = useInventory();
  const { clubs: hobbyClubs, loading: clubsLoading } = useHobbyClubs();
  const { businesses, loading: businessesLoading } = useBusinessDirectory();
  const [financialSummary, setFinancialSummary] = useState<any>(null);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [loadingFinance, setLoadingFinance] = useState(true);

  if (!member) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-12 h-12 border-4 border-jci-blue border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium">Initializing Board Dashboard...</p>
      </div>
    );
  }
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'reports' | 'insights'>('overview');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState<'financial' | 'membership' | 'engagement' | 'projects'>('financial');
  const { showToast } = useToast();
  const [reportPeriod, setReportPeriod] = useState('Last Month');
  const [reportFormat, setReportFormat] = useState<'PDF' | 'Excel' | 'CSV' | 'JSON'>('CSV');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [duesStatusFilter, setDuesStatusFilter] = useState<'All' | 'Paid' | 'Pending' | 'Overdue'>('All');
  const [insightSearch, setInsightSearch] = useState('');
  const [selectedBirthdayMonth, setSelectedBirthdayMonth] = useState<number>(new Date().getMonth());
  const [selectedHobbies, setSelectedHobbies] = useState<string[]>([]);
  const [aiInsights, setAiInsights] = useState<{
    churnRisk: any[];
    topRecommendations: any[];
    eventPredictions: any[];
    projectPredictions: any[];
  }>({
    churnRisk: [],
    topRecommendations: [],
    eventPredictions: [],
    projectPredictions: [],
  });
  const [loadingAI, setLoadingAI] = useState(false);
  const handleGenerateReport = async (reportName: string) => {
    try {
      showToast(`Generating ${reportName}...`, 'info');

      // Calculate date range based on period
      let startDate: Date | undefined;
      let endDate: Date | undefined;
      const now = new Date();

      switch (reportPeriod) {
        case 'Last Month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), 0);
          break;
        case 'Last Quarter':
          const quarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), quarter * 3 - 3, 1);
          endDate = new Date(now.getFullYear(), quarter * 3, 0);
          break;
        case 'Last 6 Months':
          startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
          endDate = now;
          break;
        case 'This Year':
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = now;
          break;
        case 'Last Year':
          startDate = new Date(now.getFullYear() - 1, 0, 1);
          endDate = new Date(now.getFullYear() - 1, 11, 31);
          break;
        case 'Custom Range':
          if (customDateRange.start && customDateRange.end) {
            startDate = new Date(customDateRange.start);
            endDate = new Date(customDateRange.end);
          }
          break;
      }

      const options: ReportOptions = {
        startDate,
        endDate,
        format: reportFormat,
        includeCharts: true,
      };

      let reportData;
      switch (selectedReportType) {
        case 'financial':
          reportData = await ReportService.generateFinancialReport(options);
          break;
        case 'membership':
          reportData = await ReportService.generateMembershipReport(options);
          break;
        case 'engagement':
          reportData = await ReportService.generateEngagementReport(options);
          break;
        case 'projects':
          reportData = await ReportService.generateProjectReport(options);
          break;
        default:
          throw new Error('Invalid report type');
      }

      // Export report
      if (reportFormat === 'CSV') {
        const csv = ReportService.exportReportToCSV(reportData);
        downloadReportAsFile(csv, `${reportName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
      } else if (reportFormat === 'JSON') {
        const json = ReportService.exportReportToJSON(reportData);
        downloadReportAsFile(json, `${reportName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
      } else {
        // PDF and Excel would require additional libraries
        showToast('PDF and Excel export coming soon. Using CSV format.', 'info');
        const csv = ReportService.exportReportToCSV(reportData);
        downloadReportAsFile(csv, `${reportName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
      }

      showToast(`${reportName} generated successfully!`, 'success');
      setIsReportModalOpen(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate report';
      showToast(errorMessage, 'error');
    }
  };

  const downloadReportAsFile = (content: string, fileName: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  // Auto-refresh interval (5 minutes)
  const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000;
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  const loadFinancialData = async () => {
    try {
      setLoadingFinance(true);
      const [summary, accounts] = await Promise.all([
        FinanceService.getFinancialSummary(),
        FinanceService.getAllBankAccounts(),
      ]);
      setFinancialSummary(summary);
      setBankAccounts(accounts);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to load financial data:', error);
    } finally {
      setLoadingFinance(false);
    }
  };

  const loadAIInsights = async () => {
    try {
      setLoadingAI(true);
      const [churnRisk, recommendations, eventPreds, projectPreds] = await Promise.all([
        Promise.all(members.slice(0, 10).map(m => AIPredictionService.predictMemberChurn(m.id))).catch(() => []),
        AIPredictionService.getPersonalizedRecommendations(members[0]?.id || '', 5).catch(() => []),
        Promise.all(events.slice(0, 5).map(e => AIPredictionService.predictEventDemand(e.id))).catch(() => []),
        Promise.all(projects.slice(0, 5).map(p => AIPredictionService.predictProjectSuccess(p.id))).catch(() => []),
      ]);

      setAiInsights({
        churnRisk: churnRisk.filter(r => r && r.riskLevel === 'High'),
        topRecommendations: recommendations.slice(0, 3),
        eventPredictions: eventPreds.filter(p => p),
        projectPredictions: projectPreds.filter(p => p),
      });
    } catch (error) {
      console.error('Failed to load AI insights:', error);
    } finally {
      setLoadingAI(false);
    }
  };

  useEffect(() => {
    loadFinancialData();

    // Set up auto-refresh if enabled
    if (autoRefreshEnabled) {
      const interval = setInterval(() => {
        loadFinancialData();
      }, AUTO_REFRESH_INTERVAL);

      return () => clearInterval(interval);
    }
  }, [autoRefreshEnabled]);

  useEffect(() => {
    if (members.length > 0 && events.length > 0 && projects.length > 0) {
      loadAIInsights();
    }
  }, [members.length, events.length, projects.length]);

  // Calculate key metrics
  const metrics = useMemo(() => {
    const totalMembers = members.length;
    const activeMembers = members.filter(m => m.role !== UserRole.GUEST && m.duesStatus === 'Paid').length;
    const newMembersThisMonth = members.filter(m => {
      const joinDate = new Date(m.joinDate);
      const now = new Date();
      return joinDate.getMonth() === now.getMonth() && joinDate.getFullYear() === now.getFullYear();
    }).length;

    const upcomingEvents = events.filter(e => new Date(e.date) >= new Date() && e.status === 'Upcoming');
    const activeProjects = projects.filter(p => p.status === 'Active');
    const completedProjects = projects.filter(p => p.status === 'Completed');

    const highRiskMembers = members.filter(m => m.churnRisk === 'High').length;
    const averagePoints = leaderboard.length > 0
      ? Math.round(leaderboard.reduce((sum, m) => sum + (m.points || 0), 0) / leaderboard.length)
      : 0;

    // Inventory metrics
    const totalInventoryItems = inventoryItems.length;
    const availableItems = inventoryItems.filter(i => i.status === 'Available').length;
    const checkedOutItems = inventoryItems.filter(i => i.status === 'Checked Out').length;
    const totalInventoryValue = inventoryItems.reduce((sum, item) => sum + (item.currentValue || item.purchasePrice || 0), 0);

    // Hobby clubs metrics
    const totalClubs = hobbyClubs.length;
    const totalClubMembers = hobbyClubs.reduce((sum, club) => sum + (club.membersCount || 0), 0);
    const activeClubs = hobbyClubs.filter(c => c.membersCount > 0).length;

    // Business directory metrics
    const totalBusinesses = businesses.length;
    const verifiedBusinesses = businesses.filter(b => b.globalNetworkEnabled).length;

    // Bank accounts metrics
    const totalBankBalance = bankAccounts.reduce((sum, account) => sum + (account.balance || 0), 0);
    const lowBalanceAccounts = bankAccounts.filter(account => {
      const balance = account.balance || 0;
      const minBalance = account.minimumBalance || 0;
      return balance < minBalance;
    }).length;

    return {
      totalMembers,
      activeMembers,
      newMembersThisMonth,
      upcomingEvents: upcomingEvents.length,
      activeProjects: activeProjects.length,
      completedProjects: completedProjects.length,
      highRiskMembers,
      averagePoints,
      totalInventoryItems,
      availableItems,
      checkedOutItems,
      totalInventoryValue,
      totalClubs,
      totalClubMembers,
      activeClubs,
      totalBusinesses,
      verifiedBusinesses,
      totalBankBalance,
      lowBalanceAccounts,
    };
  }, [members, events, projects, leaderboard, inventoryItems, hobbyClubs, businesses, bankAccounts]);

  // Calculate analytics data for charts
  const engagementTrendData = useMemo(() => {
    const now = new Date();
    const months: { month: string; events: number; projects: number; members: number }[] = [];

    // Generate last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });

      // Count events in this month
      const eventsInMonth = events.filter(e => {
        const eventDate = new Date(e.date);
        return eventDate.getMonth() === date.getMonth() &&
          eventDate.getFullYear() === date.getFullYear();
      }).length;

      // Count projects - Project type doesn't have createdAt/startDate
      // So we can't accurately track project creation by month
      // Set to 0 for now, or could track by status changes if that data existed
      const projectsInMonth = 0;

      // Count members joined in this month
      const membersInMonth = members.filter(m => {
        const joinDate = new Date(m.joinDate);
        return joinDate.getMonth() === date.getMonth() &&
          joinDate.getFullYear() === date.getFullYear();
      }).length;

      months.push({
        month: monthName,
        events: eventsInMonth,
        projects: projectsInMonth,
        members: membersInMonth,
      });
    }

    return months;
  }, [events, projects, members]);

  const projectStatusData = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    projects.forEach(project => {
      statusCounts[project.status] = (statusCounts[project.status] || 0) + 1;
    });

    return Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
    }));
  }, [projects]);

  const eventTypeData = useMemo(() => {
    const typeCounts: Record<string, number> = {};
    events.forEach(event => {
      typeCounts[event.type] = (typeCounts[event.type] || 0) + 1;
    });

    return Object.entries(typeCounts).map(([type, count]) => ({
      type,
      count,
    }));
  }, [events]);

  const memberInsightsGroups = useMemo(() => {
    const groups: Record<number, MemberWithDues[]> = {};
    for (let i = 0; i < 12; i++) groups[i] = [];

    const filtered = members.filter(m => {
      const matchDues = duesStatusFilter === 'All' || m.duesStatus === duesStatusFilter;
      const matchSearch = !insightSearch ||
        (m.name ?? '').toLowerCase().includes(insightSearch.toLowerCase()) ||
        (m.email ?? '').toLowerCase().includes(insightSearch.toLowerCase());
      return matchDues && matchSearch;
    });

    filtered.forEach(m => {
      if (m.dateOfBirth) {
        const date = new Date(m.dateOfBirth);
        if (!isNaN(date.getTime())) {
          groups[date.getMonth()].push(m);
        }
      }
    });

    return groups;
  }, [members, duesStatusFilter, insightSearch]);

  const birthdaysToday = useMemo(() => {
    const today = new Date();
    return members.filter(m => {
      if (!m.dateOfBirth) return false;
      const bday = new Date(m.dateOfBirth);
      return bday.getDate() === today.getDate() && bday.getMonth() === today.getMonth();
    });
  }, [members]);

  const monthNamesBase = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentMonthIndex = new Date().getMonth();

  // Create a rotated version of month names starting from current month
  const rotatedMonths = useMemo(() => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      const idx = (currentMonthIndex + i) % 12;
      months.push({
        name: monthNamesBase[idx],
        index: idx,
        isCurrent: i === 0
      });
    }
    return months;
  }, [currentMonthIndex]);

  return (
    <div className="space-y-4 pb-24">



      <Tabs
        tabs={['Overview', 'Analytics', 'Reports', 'Insights']}
        activeTab={
          activeTab === 'overview' ? 'Overview' :
            activeTab === 'analytics' ? 'Analytics' :
              activeTab === 'reports' ? 'Reports' : 'Insights'
        }
        onTabChange={(tab) => {
          if (tab === 'Overview') setActiveTab('overview');
          else if (tab === 'Analytics') setActiveTab('analytics');
          else if (tab === 'Reports') setActiveTab('reports');
          else setActiveTab('insights');
        }}
      />

      <div>
        {activeTab === 'overview' && (
          <>
            {/* Member Metrics Row */}
            <Card noPadding className="mb-4 overflow-hidden">
              <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-slate-100">
                <div className="p-4 hover:bg-slate-50 transition-colors cursor-pointer group relative" onClick={() => onNavigate?.('MEMBERS')}>
                  <div className="absolute top-4 right-4 p-2 bg-blue-50 text-jci-blue rounded-lg group-hover:bg-jci-blue group-hover:text-white transition-colors">
                    <Users size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Members</span>
                    <span className="text-2xl font-black text-slate-900 leading-tight">{metrics.totalMembers}</span>
                    <span className="text-[10px] text-slate-400 font-medium mt-1">{metrics.newMembersThisMonth} new this month</span>
                  </div>
                </div>
                <div className="p-4 hover:bg-slate-50 transition-colors cursor-pointer group relative" onClick={() => onNavigate?.('MEMBERS')}>
                  <div className="absolute top-4 right-4 p-2 bg-green-50 text-green-600 rounded-lg group-hover:bg-green-600 group-hover:text-white transition-colors">
                    <CheckCircle size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Members</span>
                    <span className="text-2xl font-black text-slate-900 leading-tight">{metrics.activeMembers}</span>
                    <span className="text-[10px] text-slate-400 font-medium mt-1">{Math.round((metrics.activeMembers / Math.max(metrics.totalMembers, 1)) * 100)}% engagement</span>
                  </div>
                </div>
                <div className="p-4 hover:bg-slate-50 transition-colors cursor-pointer group relative" onClick={() => onNavigate?.('EVENTS')}>
                  <div className="absolute top-4 right-4 p-2 bg-purple-50 text-purple-600 rounded-lg group-hover:bg-purple-600 group-hover:text-white transition-colors">
                    <Calendar size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Upcoming Events</span>
                    <span className="text-2xl font-black text-slate-900 leading-tight">{metrics.upcomingEvents}</span>
                    <span className="text-[10px] text-slate-400 font-medium mt-1">Scheduled activities</span>
                  </div>
                </div>
                <div className="p-4 hover:bg-slate-50 transition-colors cursor-pointer group relative" onClick={() => onNavigate?.('PROJECTS')}>
                  <div className="absolute top-4 right-4 p-2 bg-amber-50 text-amber-600 rounded-lg group-hover:bg-amber-600 group-hover:text-white transition-colors">
                    <Briefcase size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Projects</span>
                    <span className="text-2xl font-black text-slate-900 leading-tight">{metrics.activeProjects}</span>
                    <span className="text-[10px] text-slate-400 font-medium mt-1">{metrics.completedProjects} completed</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Financial Overview */}
            {loadingFinance ? (
              <Card noPadding noHeaderPadding className="mb-4" title={<div className="px-4 py-3">Financial Overview</div>}>
                <div className="text-center py-8 text-slate-400 text-sm">Loading financial data...</div>
              </Card>
            ) : financialSummary ? (
              <Card
                noPadding
                noHeaderPadding
                className="mb-2 overflow-hidden"
                title={<div className="px-4 py-3 font-semibold text-slate-800 text-base">Financial Overview</div>}
                action={
                  <div className="px-4">
                    <Button variant="ghost" size="sm" onClick={() => onNavigate?.('FINANCE')}>
                      <Eye size={18} />
                    </Button>
                  </div>
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                  {/* Total Income */}
                  <div className="p-4 group relative">
                    <div className="absolute top-4 right-4 p-2 bg-green-50 text-green-600 rounded-lg group-hover:bg-green-600 group-hover:text-white transition-colors">
                      <DollarSign size={16} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Income</span>
                      <span className="text-2xl font-black text-green-600 leading-tight">
                        {formatCurrency(financialSummary.totalIncome || 0)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium mt-1">Year to date</span>
                    </div>
                  </div>

                  {/* Total Expenses */}
                  <div className="p-4 group relative">
                    <div className="absolute top-4 right-4 p-2 bg-red-50 text-red-600 rounded-lg group-hover:bg-red-600 group-hover:text-white transition-colors">
                      <DollarSign size={16} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Expenses</span>
                      <span className="text-2xl font-black text-red-600 leading-tight">
                        {formatCurrency(financialSummary.totalExpenses || 0)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium mt-1">Administrative & Projects</span>
                    </div>
                  </div>

                  {/* Net Balance */}
                  <div className="p-4 group relative">
                    <div className="absolute top-4 right-4 p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <TrendingUp size={16} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Net Balance</span>
                      <span className="text-2xl font-black text-blue-900 leading-tight">
                        {formatCurrency((financialSummary.totalIncome || 0) - (financialSummary.totalExpenses || 0))}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium mt-1">Current treasury</span>
                    </div>
                  </div>
                </div>
              </Card>
            ) : null}

            {/* Quick Actions Bar */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
              {[
                { label: 'Financial Report', icon: FileText, action: () => { setSelectedReportType('financial'); setIsReportModalOpen(true); } },
                { label: 'Members', icon: Users, action: () => onNavigate?.('MEMBERS') },
                { label: 'Inventory', icon: Package, action: () => onNavigate?.('INVENTORY') },
                { label: 'Finance', icon: DollarSign, action: () => onNavigate?.('FINANCE') },
              ].map(({ label, icon: Icon, action }) => (
                <button key={label} onClick={action}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white border border-slate-100 hover:border-jci-blue/30 hover:bg-jci-blue/5 hover:shadow-sm transition-all group">
                  <Icon size={18} className="text-slate-400 group-hover:text-jci-blue transition-colors" />
                  <span className="text-[10px] font-bold text-slate-500 group-hover:text-jci-blue text-center leading-tight">{label}</span>
                </button>
              ))}
            </div>

            {/* Main Content */}
            <div className="space-y-4">
                {/* Member Engagement */}
                <Card noPadding noHeaderPadding className="mb-2" title={<div className="px-4 py-3 font-semibold text-slate-800 text-base">Member Engagement & Celebrations</div>}>
                  <div className="p-4">
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Left Side: Engagement Metrics */}
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3">
                          {/* Average Points */}
                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 relative group transition-all hover:shadow-md">
                            <div className="absolute top-4 right-4 p-2 bg-white text-jci-blue rounded-lg shadow-sm group-hover:bg-jci-blue group-hover:text-white transition-colors">
                              <Award size={18} />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Avg Points / Member</span>
                              <span className="text-2xl font-black text-slate-900 leading-tight">{metrics.averagePoints}</span>
                              <span className="text-[10px] text-slate-500 font-medium mt-1">Overall performance</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            {/* High Risk */}
                            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 relative group transition-all hover:shadow-md">
                              <div className="absolute top-3 right-3 p-1.5 bg-white text-amber-600 rounded-lg shadow-sm group-hover:bg-amber-600 group-hover:text-white transition-colors">
                                <AlertTriangle size={14} />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">High Risk</span>
                                <span className="text-xl font-black text-amber-900 leading-tight">{metrics.highRiskMembers}</span>
                                <span className="text-[9px] text-amber-600 font-medium mt-1">Needs attention</span>
                              </div>
                            </div>

                            {/* Engagement Rate */}
                            <div className="p-4 bg-green-50 rounded-xl border border-green-100 relative group transition-all hover:shadow-md">
                              <div className="absolute top-3 right-3 p-1.5 bg-white text-green-600 rounded-lg shadow-sm group-hover:bg-green-600 group-hover:text-white transition-colors">
                                <TrendingUp size={14} />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[10px] font-black text-green-500 uppercase tracking-widest mb-1">Engagement</span>
                                <span className="text-xl font-black text-green-900 leading-tight">
                                  {metrics.totalMembers > 0 ? Math.round((metrics.activeMembers / metrics.totalMembers) * 100) : 0}%
                                </span>
                                <span className="text-[9px] text-green-600 font-medium mt-1">Active rate</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Side: Birthdays */}
                      <div className="flex flex-col">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Cake size={14} className="text-pink-500" />
                            Today's Birthdays
                          </h4>
                          <Badge variant="info" className="text-[10px] px-2 py-0">
                            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </Badge>
                        </div>

                        {birthdaysToday.length > 0 ? (
                          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2 scrollbar-thin">
                            {birthdaysToday.map(member => (
                              <div key={member.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-slate-100 group hover:border-pink-200 hover:shadow-sm transition-all">
                                <div className="w-10 h-10 rounded-full bg-slate-50 border-2 border-white shadow-sm flex items-center justify-center text-slate-400 font-bold overflow-hidden">
                                  {member.avatar ? (
                                    <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-500">
                                      {member.name.charAt(0)}
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-slate-900 truncate group-hover:text-pink-600 transition-colors">{member.name}</p>
                                  <span className="text-[10px] text-pink-600 font-semibold flex items-center gap-1">
                                    <Gift size={10} /> Happy Birthday!
                                  </span>
                                </div>
                                <div className="group-hover:animate-bounce">
                                  <Cake size={16} className="text-pink-400" />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center py-8 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                            <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center mb-3">
                              <Cake size={24} className="text-slate-300" />
                            </div>
                            <p className="text-xs text-slate-400 font-medium text-center px-6 leading-relaxed">No member birthdays recorded for today</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Project Status */}
                <Card noPadding noHeaderPadding className="mb-6" title={<div className="px-4 py-3 font-semibold text-slate-800 text-base">Project Status Overview</div>}>
                  <div className="p-4">
                    <div className="space-y-4">
                      {projects.slice(0, 5).map(project => (
                        <div key={project.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div className="flex-1">
                            <h4 className="font-semibold text-slate-900">{project.name ?? project.title ?? 'Project'}</h4>
                            <p className="text-sm text-slate-500">{project.status} • {project.completion ?? 0}% Complete</p>
                          </div>
                          <Badge variant={project.status === 'Active' ? 'success' : 'neutral'}>
                            {project.status}
                          </Badge>
                        </div>
                      ))}
                      {projects.length === 0 && (
                        <div className="text-center py-8 text-slate-400 text-sm">No projects found</div>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Additional Metrics Grid */}
                <div className="grid md:grid-cols-2 gap-2">
                  {/* Inventory Status */}
                  <Card
                    noPadding noHeaderPadding
                    title={<div className="px-4 py-3 font-semibold text-slate-800 text-base">Inventory Status</div>}
                    action={
                      <div className="px-4">
                        <Button variant="ghost" size="sm" onClick={() => onNavigate?.('INVENTORY')}>
                          <Eye size={18} />
                        </Button>
                      </div>
                    }
                  >
                    <div className="p-4">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Package size={20} className="text-jci-blue" />
                            <div>
                              <p className="text-sm font-medium text-slate-700">Total Items</p>
                              <p className="text-2xl font-bold text-slate-900">{metrics.totalInventoryItems}</p>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                            <p className="text-xs text-green-700 mb-1">Available</p>
                            <p className="text-lg font-bold text-green-900">{metrics.availableItems}</p>
                          </div>
                          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                            <p className="text-xs text-amber-700 mb-1">Checked Out</p>
                            <p className="text-lg font-bold text-amber-900">{metrics.checkedOutItems}</p>
                          </div>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-xs text-blue-700 mb-1">Total Value</p>
                          <p className="text-lg font-bold text-blue-900">{formatCurrency(metrics.totalInventoryValue)}</p>
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Bank Accounts */}
                  <Card noPadding noHeaderPadding
                    title={<div className="px-4 py-3 font-semibold text-slate-800 text-base">Bank Accounts</div>}>
                    <div className="p-4">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <CreditCard size={20} className="text-jci-blue" />
                            <div>
                              <p className="text-sm font-medium text-slate-700">Total Balance</p>
                              <p className="text-2xl font-bold text-slate-900">{formatCurrency(metrics.totalBankBalance)}</p>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {bankAccounts.map(account => (
                            <div key={account.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                              <div>
                                <p className="text-sm font-medium text-slate-900">{account.name}</p>
                                <p className="text-xs text-slate-500">{account.accountNumber}</p>
                              </div>
                              <div className="text-right">
                                <p className={`text-sm font-bold ${(account.balance || 0) < (account.minimumBalance || 0) ? 'text-red-600' : 'text-green-600'}`}>
                                  {formatCurrency(account.balance || 0)}
                                </p>
                                {(account.balance || 0) < (account.minimumBalance || 0) && (
                                  <Badge variant="error" className="text-xs mt-1">Low Balance</Badge>
                                )}
                              </div>
                            </div>
                          ))}
                          {bankAccounts.length === 0 && (
                            <div className="text-center py-4 text-slate-400 text-sm">No bank accounts</div>
                          )}
                          {metrics.lowBalanceAccounts > 0 && (
                            <div className="p-2 bg-red-50 rounded-lg border border-red-200">
                              <p className="text-xs text-red-700">
                                <AlertTriangle size={14} className="inline mr-1" />
                                {metrics.lowBalanceAccounts} account(s) below minimum balance
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Hobby Clubs Activity */}
                  <Card noPadding noHeaderPadding className="mb-2" title={<div className="px-4 py-3 font-semibold text-slate-800 text-base">Hobby Clubs Activity</div>}>
                    <div className="p-4">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Heart size={20} className="text-jci-blue" />
                            <div>
                              <p className="text-sm font-medium text-slate-700">Total Clubs</p>
                              <p className="text-2xl font-bold text-slate-900">{metrics.totalClubs}</p>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                            <p className="text-xs text-green-700 mb-1">Active Clubs</p>
                            <p className="text-lg font-bold text-green-900">{metrics.activeClubs}</p>
                          </div>
                          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <p className="text-xs text-blue-700 mb-1">Total Members</p>
                            <p className="text-lg font-bold text-blue-900">{metrics.totalClubMembers}</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {hobbyClubs.slice(0, 3).map(club => (
                            <div key={club.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                              <div>
                                <p className="text-sm font-medium text-slate-900">{club.name}</p>
                                <p className="text-xs text-slate-500">{club.category}</p>
                              </div>
                              <Badge variant="neutral">{club.membersCount || 0} members</Badge>
                            </div>
                          ))}
                          {hobbyClubs.length === 0 && (
                            <div className="text-center py-4 text-slate-400 text-sm">No clubs</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Business Directory Engagement */}
                  <Card noPadding noHeaderPadding className="mb-2" title={<div className="px-4 py-3 font-semibold text-slate-800 text-base">Business Directory</div>}>
                    <div className="p-4">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Building2 size={20} className="text-jci-blue" />
                            <div>
                              <p className="text-sm font-medium text-slate-700">Total Businesses</p>
                              <p className="text-2xl font-bold text-slate-900">{metrics.totalBusinesses}</p>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                            <p className="text-xs text-green-700 mb-1">Verified</p>
                            <p className="text-lg font-bold text-green-900">{metrics.verifiedBusinesses}</p>
                          </div>
                          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <p className="text-xs text-blue-700 mb-1">Pending</p>
                            <p className="text-lg font-bold text-blue-900">{metrics.totalBusinesses - metrics.verifiedBusinesses}</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {businesses.slice(0, 3).map(business => (
                            <div key={business.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                              <div>
                                <p className="text-sm font-medium text-slate-900">{business.companyName}</p>
                                <p className="text-xs text-slate-500">{business.industry}</p>
                              </div>
                              {business.globalNetworkEnabled ? (
                                <Badge variant="success">Verified</Badge>
                              ) : (
                                <Badge variant="warning">Pending</Badge>
                              )}
                            </div>
                          ))}
                          {businesses.length === 0 && (
                            <div className="text-center py-4 text-slate-400 text-sm">No businesses</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
            </div>

            {/* AI Insights + Top Performers */}
            <div className="grid md:grid-cols-2 gap-4">
                {/* AI Insights & Predictions */}
                <Card noPadding noHeaderPadding className="mb-6 border-l-4 border-l-purple-500" title={<div className="px-4 py-3 font-semibold text-slate-800 text-base">AI Insights & Predictions</div>}>
                  <div className="p-4">
                    <div className="space-y-4">
                      {loadingAI ? (
                        <div className="text-center py-4 text-slate-400 text-sm">Loading AI insights...</div>
                      ) : (
                        <>
                          {aiInsights.churnRisk.length > 0 && (
                            <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                              <div className="flex items-center gap-2 mb-2">
                                <AlertCircle size={16} className="text-red-600" />
                                <span className="text-sm font-semibold text-red-900">High Churn Risk</span>
                              </div>
                              <p className="text-xs text-red-700">
                                {aiInsights.churnRisk.length} member(s) at high risk of leaving.
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs h-auto p-0 ml-1 text-red-700 hover:text-red-900"
                                  onClick={() => onNavigate?.('AI_INSIGHTS')}
                                >
                                  View Details →
                                </Button>
                              </p>
                            </div>
                          )}

                          {aiInsights.topRecommendations.length > 0 && (
                            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                              <div className="flex items-center gap-2 mb-2">
                                <Lightbulb size={16} className="text-blue-600" />
                                <span className="text-sm font-semibold text-blue-900">Top Recommendations</span>
                              </div>
                              <div className="space-y-2">
                                {aiInsights.topRecommendations.slice(0, 2).map((rec: any, idx: number) => (
                                  <div key={idx} className="text-xs text-blue-700">
                                    • {rec.itemName} ({rec.matchScore}% match)
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {aiInsights.eventPredictions.length > 0 && (
                            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                              <div className="flex items-center gap-2 mb-2">
                                <TrendingUp size={16} className="text-green-600" />
                                <span className="text-sm font-semibold text-green-900">Event Predictions</span>
                              </div>
                              <p className="text-xs text-green-700">
                                {aiInsights.eventPredictions.length} upcoming event(s) analyzed for demand
                              </p>
                            </div>
                          )}

                          {aiInsights.projectPredictions.length > 0 && (
                            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                              <div className="flex items-center gap-2 mb-2">
                                <Sparkles size={16} className="text-amber-600" />
                                <span className="text-sm font-semibold text-amber-900">Project Forecasts</span>
                              </div>
                              <p className="text-xs text-amber-700">
                                {aiInsights.projectPredictions.length} active project(s) with success predictions
                              </p>
                            </div>
                          )}

                          {(aiInsights.churnRisk.length === 0 &&
                            aiInsights.topRecommendations.length === 0 &&
                            aiInsights.eventPredictions.length === 0 &&
                            aiInsights.projectPredictions.length === 0) && (
                              <div className="text-center py-4 text-slate-400 text-sm">
                                No AI insights available yet
                              </div>
                            )}

                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => onNavigate?.('AI_INSIGHTS')}
                          >
                            <Sparkles size={14} className="mr-2" />
                            View Full AI Insights
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Top Performers */}
                <Card noPadding noHeaderPadding className="mb-6" title={<div className="px-4 py-3 font-semibold text-slate-800 text-base">Top Performers</div>}>
                  <div className="p-4">
                    <div className="space-y-3">
                      {leaderboard.slice(0, 5).map((member, index) => (
                        <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${index === 0 ? 'bg-yellow-100 text-yellow-700' :
                            index === 1 ? 'bg-slate-100 text-slate-600' :
                              index === 2 ? 'bg-amber-100 text-amber-700' :
                                'bg-slate-100 text-slate-500'
                            }`}>
                            {index + 1}
                          </div>
                          <img src={member.avatar || undefined} alt={member.name} className="w-8 h-8 rounded-full" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{member.name}</p>
                            <p className="text-xs text-slate-500">{member.points} points</p>
                          </div>
                        </div>
                      ))}
                      {leaderboard.length === 0 && (
                        <div className="text-center py-4 text-slate-400 text-sm">No data available</div>
                      )}
                    </div>
                  </div>
                </Card>
            </div>
          </>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-4">
            <div className="grid lg:grid-cols-2 gap-4">
              <MemberGrowthChart members={members} />
              <PointsDistributionChart pointHistory={pointHistory} />
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <Card title="Engagement Trends">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={engagementTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Legend />
                    <Line type="monotone" dataKey="events" stroke="#0097D7" strokeWidth={2} name="Events" />
                    <Line type="monotone" dataKey="projects" stroke="#6EC4E8" strokeWidth={2} name="Projects" />
                    <Line type="monotone" dataKey="members" stroke="#1C3F94" strokeWidth={2} name="Members" />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              <Card title="Project Status Distribution">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={projectStatusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry: any) => `${entry.status}: ${(entry.percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {projectStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#0097D7', '#6EC4E8', '#1C3F94', '#00B5B5'][index % 4]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => value} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </div>

            <Card title="Event Types Distribution">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={eventTypeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="type" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="count" fill="#0097D7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-2">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => { setSelectedReportType('financial'); setIsReportModalOpen(true); }}>
                <div className="text-center">
                  <DollarSign className="mx-auto mb-3 text-jci-blue" size={32} />
                  <h3 className="font-semibold text-slate-900 mb-1">Financial Report</h3>
                  <p className="text-sm text-slate-500">Income, expenses, and balance sheets</p>
                </div>
              </Card>

              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => { setSelectedReportType('membership'); setIsReportModalOpen(true); }}>
                <div className="text-center">
                  <Users className="mx-auto mb-3 text-jci-blue" size={32} />
                  <h3 className="font-semibold text-slate-900 mb-1">Membership Report</h3>
                  <p className="text-sm text-slate-500">Growth, engagement, and demographics</p>
                </div>
              </Card>

              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => { setSelectedReportType('engagement'); setIsReportModalOpen(true); }}>
                <div className="text-center">
                  <Activity className="mx-auto mb-3 text-jci-blue" size={32} />
                  <h3 className="font-semibold text-slate-900 mb-1">Engagement Report</h3>
                  <p className="text-sm text-slate-500">Points, activities, and participation</p>
                </div>
              </Card>

              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => { setSelectedReportType('projects'); setIsReportModalOpen(true); }}>
                <div className="text-center">
                  <Briefcase className="mx-auto mb-3 text-jci-blue" size={32} />
                  <h3 className="font-semibold text-slate-900 mb-1">Project Report</h3>
                  <p className="text-sm text-slate-500">Status, progress, and outcomes</p>
                </div>
              </Card>
            </div>

            <Card title="Quick Report Generation">
              <div className="space-y-2">
                <div className="grid md:grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => handleGenerateReport('Monthly Financial Summary')}
                  >
                    <FileText size={16} className="mr-2" />
                    Monthly Financial Summary
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => handleGenerateReport('Member Engagement Analysis')}
                  >
                    <BarChart3 size={16} className="mr-2" />
                    Member Engagement Analysis
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => handleGenerateReport('Project Status Report')}
                  >
                    <Briefcase size={16} className="mr-2" />
                    Project Status Report
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => handleGenerateReport('Event Attendance Report')}
                  >
                    <Calendar size={16} className="mr-2" />
                    Event Attendance Report
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => {
                      setSelectedReportType('financial');
                      setIsReportModalOpen(true);
                    }}
                  >
                    <DollarSign size={16} className="mr-2" />
                    Annual Financial Report
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => {
                      setSelectedReportType('membership');
                      setIsReportModalOpen(true);
                    }}
                  >
                    <Users size={16} className="mr-2" />
                    Member Benefits Usage Report
                  </Button>
                </div>
              </div>
            </Card>

            <Card title="Report History">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900">Financial Report - January 2024</p>
                    <p className="text-xs text-slate-500">Generated on Jan 31, 2024</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm">
                      <Download size={14} />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900">Member Engagement Report - Q4 2023</p>
                    <p className="text-xs text-slate-500">Generated on Dec 31, 2023</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm">
                      <Download size={14} />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="space-y-6">
            {/* Filter Controls */}
            <Card className="bg-slate-50/50">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search members..."
                    icon={<Search size={18} />}
                    value={insightSearch}
                    onChange={(e) => setInsightSearch(e.target.value)}
                  />
                </div>
                <div className="w-full md:w-64">
                  <Select
                    options={[
                      { label: 'All Dues Status', value: 'All' },
                      { label: 'Paid', value: 'Paid' },
                      { label: 'Pending', value: 'Pending' },
                      { label: 'Overdue', value: 'Overdue' },
                    ]}
                    value={duesStatusFilter}
                    onChange={(e) => setDuesStatusFilter(e.target.value as any)}
                  />
                </div>
              </div>
            </Card>

            {/* Grid Container for Side-by-Side Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* WhatsApp Group Status Card */}
              <Card
                title={
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="text-green-500" size={20} />
                      <span className="font-bold text-lg text-slate-800">WhatsApp Group Status</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="success" className="bg-green-50 text-green-700 border-green-100 text-xs">
                        {members.filter(m => m.whatsappGroup).length} In Group
                      </Badge>
                      <Badge variant="neutral" className="bg-slate-50 text-slate-600 border-slate-200 text-xs">
                        {members.filter(m => !m.whatsappGroup).length} Not In Group
                      </Badge>
                    </div>
                  </div>
                }
                className="border-t-4 border-t-green-400"
                noPadding
              >
                {/* Table Header */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-100 text-[11px] uppercase font-bold tracking-wider text-slate-500">
                  <div className="col-span-6">Member Name & Phone</div>
                  <div className="col-span-3 text-center">Dues Status</div>
                  <div className="col-span-3 text-center">WhatsApp Group</div>
                </div>

                {/* Member Rows */}
                <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
                  {[...members]
                    .filter(m => {
                      if (!insightSearch) return true;
                      const q = insightSearch.toLowerCase();
                      return (m.name ?? '').toLowerCase().includes(q) || (m.phone ?? '').toLowerCase().includes(q);
                    })
                    .sort((a, b) => {
                      // 1. WhatsApp Group Priority (In Group > Not In Group)
                      if (a.whatsappGroup && !b.whatsappGroup) return -1;
                      if (!a.whatsappGroup && b.whatsappGroup) return 1;

                      // 2. Paid Status Priority (Paid > Pending > Overdue)
                      const getDuesScore = (status: string) => {
                        if (status === 'Paid') return 3;
                        if (status === 'Pending') return 2;
                        return 1; // Overdue or others
                      };
                      const scoreA = getDuesScore(a.duesStatus);
                      const scoreB = getDuesScore(b.duesStatus);
                      if (scoreA !== scoreB) {
                        return scoreB - scoreA; // Descending: Paid(3) comes before Pending(2)
                      }

                      // 3. Name Alphabetical
                      return (a.name ?? '').localeCompare(b.name ?? '');
                    })
                    .map(m => (
                      <div key={m.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-6 py-3 hover:bg-slate-50/80 transition-colors items-center">
                        {/* Name & Phone */}
                        <div className="col-span-6 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-jci-blue to-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {(m.name ?? '?')[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-slate-900 truncate">{m.name}</p>
                            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                              <Phone size={11} className="text-slate-400 flex-shrink-0" />
                              <span className="truncate">{m.phone || '—'}</span>
                            </p>
                          </div>
                        </div>

                        {/* Dues Status */}
                        <div className="col-span-3 flex flex-col items-center justify-center gap-0.5">
                          <Badge
                            variant={m.duesStatus === 'Paid' ? 'success' : m.duesStatus === 'Overdue' ? 'error' : 'warning'}
                            className="text-[10px] px-2 py-0.5"
                          >
                            {m.duesStatus}
                          </Badge>
                          <span className="text-[9px] text-slate-400 font-medium whitespace-nowrap">
                            {m.latestPaidYear ? `Paid: ${m.latestPaidYear}` : 'Never Paid'}
                          </span>
                        </div>

                        {/* WhatsApp Status */}
                        <div className="col-span-3 flex justify-center">
                          {m.whatsappGroup ? (
                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 border border-green-100">
                              <CheckCircle size={12} className="text-green-500" />
                              <span className="text-[11px] font-semibold text-green-700">In Group</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-100">
                              <XCircle size={12} className="text-red-400" />
                              <span className="text-[11px] font-semibold text-red-600">Not In Group</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500 font-medium">
                  <span>Total: {members.length} members</span>
                  <span>In Group: {members.filter(m => m.whatsappGroup).length} / {members.length}</span>
                </div>
              </Card>
            </div>

            {/* Hobbies Insight Card */}
            <Card
              title={
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Heart className="text-pink-500" size={20} />
                    <span className="font-bold text-lg text-slate-800">Hobbies & Interests</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedHobbies.length > 0 && (
                      <Badge variant="neutral" className="bg-pink-50 text-pink-700 border-pink-200 text-xs">
                        {selectedHobbies.length} selected
                      </Badge>
                    )}
                    {selectedHobbies.length > 0 && (
                      <button
                        onClick={() => setSelectedHobbies([])}
                        className="text-[10px] text-slate-400 hover:text-red-500 transition-colors font-medium"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              }
              className="border-t-4 border-t-pink-400"
              noPadding
            >
              {/* Hobby Selector Chips */}
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/30">
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-3">Select hobbies to filter members</p>
                <div className="flex flex-wrap gap-2">
                  {HOBBY_OPTIONS.map(hobby => {
                    const isSelected = selectedHobbies.includes(hobby);
                    const count = members.filter(m => Array.isArray(m.hobbies) && m.hobbies.includes(hobby)).length;
                    return (
                      <button
                        key={hobby}
                        onClick={() => {
                          setSelectedHobbies(prev =>
                            prev.includes(hobby) ? prev.filter(h => h !== hobby) : [...prev, hobby]
                          );
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all border ${isSelected
                          ? 'bg-pink-500 text-white border-pink-500 shadow-sm shadow-pink-200'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-pink-300 hover:text-pink-600'
                          }`}
                      >
                        {hobby}
                        {count > 0 && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                            }`}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Filtered Members List */}
              {selectedHobbies.length > 0 ? (
                <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                  {(() => {
                    const filteredMembers = members.filter(m =>
                      Array.isArray(m.hobbies) && selectedHobbies.some(h => m.hobbies!.includes(h))
                    );
                    if (filteredMembers.length === 0) {
                      return (
                        <div className="py-12 text-center">
                          <Heart className="mx-auto text-slate-300 mb-3" size={32} />
                          <p className="text-slate-500 font-medium text-sm">No members found with the selected hobbies</p>
                        </div>
                      );
                    }
                    return filteredMembers
                      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
                      .map(m => {
                        const matchingHobbies = selectedHobbies.filter(h => Array.isArray(m.hobbies) && m.hobbies.includes(h));
                        return (
                          <div key={m.id} className="px-6 py-3 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                {(m.name ?? '?')[0]?.toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-sm text-slate-900 truncate">{m.name}</p>
                                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                  <Phone size={11} className="text-slate-400 flex-shrink-0" />
                                  <span className="truncate">{m.phone || '—'}</span>
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1 justify-end flex-shrink-0 max-w-[50%]">
                              {matchingHobbies.map(h => (
                                <span key={h} className="inline-block px-2 py-0.5 rounded-full bg-pink-50 text-pink-600 text-[9px] font-semibold border border-pink-100 whitespace-nowrap">
                                  {h}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      });
                  })()}
                </div>
              ) : (
                <div className="py-10 text-center">
                  <Heart className="mx-auto text-slate-200 mb-3" size={36} />
                  <p className="text-slate-400 font-medium text-sm">Select one or more hobbies above to see matching members</p>
                </div>
              )}

              {/* Footer */}
              {selectedHobbies.length > 0 && (
                <div className="px-6 py-3 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500 font-medium">
                  <span>Matching: {members.filter(m => Array.isArray(m.hobbies) && selectedHobbies.some(h => m.hobbies!.includes(h))).length} members</span>
                  <span>{selectedHobbies.length} hobbies selected</span>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* Report Generation Modal */}
      <Modal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        title={`Generate ${selectedReportType.charAt(0).toUpperCase() + selectedReportType.slice(1)} Report`}
        footer={
          <div className="flex gap-3 w-full">
            <Button
              className="flex-1"
              onClick={() => handleGenerateReport(selectedReportType)}
            >
              <Download size={16} className="mr-2" />
              Generate & Download
            </Button>
            <Button
              variant="ghost"
              onClick={() => setIsReportModalOpen(false)}
            >
              Cancel
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Report Period</label>
            <select
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              value={reportPeriod}
              onChange={(e) => {
                setReportPeriod(e.target.value);
                if (e.target.value !== 'Custom Range') {
                  setCustomDateRange({ start: '', end: '' });
                }
              }}
            >
              <option>Last Month</option>
              <option>Last Quarter</option>
              <option>Last 6 Months</option>
              <option>This Year</option>
              <option>Last Year</option>
              <option>Custom Range</option>
            </select>
          </div>

          {reportPeriod === 'Custom Range' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Start Date</label>
                <Input
                  type="date"
                  value={customDateRange.start}
                  onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">End Date</label>
                <Input
                  type="date"
                  value={customDateRange.end}
                  onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Format</label>
            <div className="flex gap-2">
              <Button
                variant={reportFormat === 'PDF' ? 'primary' : 'outline'}
                className="flex-1"
                onClick={() => setReportFormat('PDF')}
              >
                PDF
              </Button>
              <Button
                variant={reportFormat === 'Excel' ? 'primary' : 'outline'}
                className="flex-1"
                onClick={() => setReportFormat('Excel')}
              >
                Excel
              </Button>
              <Button
                variant={reportFormat === 'CSV' ? 'primary' : 'outline'}
                className="flex-1"
                onClick={() => setReportFormat('CSV')}
              >
                CSV
              </Button>
            </div>
          </div>

          {selectedReportType === 'financial' && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800 font-medium mb-2">Report Includes:</p>
              <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                <li>Income Statement</li>
                <li>Expense Breakdown</li>
                <li>Balance Sheet</li>
                <li>Cash Flow Statement</li>
                <li>Bank Account Reconciliation</li>
              </ul>
            </div>
          )}

          {selectedReportType === 'membership' && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800 font-medium mb-2">Report Includes:</p>
              <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                <li>Member Growth Trends</li>
                <li>Role Distribution</li>
                <li>Tier Breakdown</li>
                <li>New Member Analysis</li>
                <li>Churn Risk Assessment</li>
              </ul>
            </div>
          )}

          {selectedReportType === 'engagement' && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800 font-medium mb-2">Report Includes:</p>
              <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                <li>Points Distribution</li>
                <li>Event Attendance Rates</li>
                <li>Project Participation</li>
                <li>Leaderboard Rankings</li>
                <li>Activity Trends</li>
              </ul>
            </div>
          )}

          {selectedReportType === 'projects' && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800 font-medium mb-2">Report Includes:</p>
              <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                <li>Project Status Overview</li>
                <li>Completion Rates</li>
                <li>Resource Allocation</li>
                <li>Financial Performance</li>
                <li>Timeline Analysis</li>
              </ul>
            </div>
          )}


        </div>
      </Modal>

    </div>
  );
};

