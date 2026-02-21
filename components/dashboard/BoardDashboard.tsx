import React, { useMemo } from 'react';
import { TrendingUp, Users, DollarSign, Calendar, Briefcase, Award, AlertTriangle, CheckCircle, BarChart3, FileText, Download, PieChart, Activity, Package, Building2, Heart, CreditCard, RefreshCw, Clock, Sparkles, AlertCircle, Lightbulb, Cake, Gift, Search } from 'lucide-react';
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
import { useState, useEffect } from 'react';
import { formatCurrency } from '../../utils/formatUtils';
import { UserRole, Member } from '../../types';
import { MemberGrowthChart, PointsDistributionChart } from './Analytics';
import { LineChart, Line, BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface BoardDashboardProps {
  onNavigate?: (view: string) => void;
}

export const BoardDashboard: React.FC<BoardDashboardProps> = ({ onNavigate }) => {
  const { members, loading: membersLoading } = useMembers();
  const { events, loading: eventsLoading } = useEvents();
  const { projects, loading: projectsLoading } = useProjects();
  const { leaderboard, pointHistory } = usePoints();
  const { items: inventoryItems, loading: inventoryLoading } = useInventory();
  const { clubs: hobbyClubs, loading: clubsLoading } = useHobbyClubs();
  const { businesses, loading: businessesLoading } = useBusinessDirectory();
  const [financialSummary, setFinancialSummary] = useState<any>(null);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [loadingFinance, setLoadingFinance] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'reports' | 'insights'>('overview');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState<'financial' | 'membership' | 'engagement' | 'projects'>('financial');
  const { showToast } = useToast();
  const [reportPeriod, setReportPeriod] = useState('Last Month');
  const [reportFormat, setReportFormat] = useState<'PDF' | 'Excel' | 'CSV' | 'JSON'>('CSV');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [duesStatusFilter, setDuesStatusFilter] = useState<'All' | 'Paid' | 'Pending' | 'Overdue'>('All');
  const [insightSearch, setInsightSearch] = useState('');
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
    const groups: Record<number, Member[]> = {};
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

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="space-y-6">
      {/* Executive Summary Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Executive Dashboard</h2>
            <p className="text-slate-300">Real-time insights into LO health and performance</p>
            <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
              <Clock size={14} />
              <span>Last updated: {lastRefresh.toLocaleTimeString()}</span>
              {autoRefreshEnabled && (
                <Badge variant="success" className="text-xs ml-2">Auto-refresh enabled</Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex gap-4">
              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/20">
                <p className="text-xs text-slate-300 mb-1">Active Members</p>
                <p className="text-2xl font-bold">{metrics.activeMembers}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/20">
                <p className="text-xs text-slate-300 mb-1">Active Projects</p>
                <p className="text-2xl font-bold">{metrics.activeProjects}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                loadFinancialData();
                showToast('Dashboard refreshed', 'success');
              }}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <Card noPadding>
        <div className="px-6 pt-4">
          <Tabs
            tabs={['Overview', 'Analytics', 'Reports', 'Member Insights']}
            activeTab={
              activeTab === 'overview' ? 'Overview' :
                activeTab === 'analytics' ? 'Analytics' :
                  activeTab === 'reports' ? 'Reports' : 'Member Insights'
            }
            onTabChange={(tab) => {
              if (tab === 'Overview') setActiveTab('overview');
              else if (tab === 'Analytics') setActiveTab('analytics');
              else if (tab === 'Reports') setActiveTab('reports');
              else setActiveTab('insights');
            }}
          />
        </div>
        <div className="p-6">
          {activeTab === 'overview' && (
            <>
              {/* Key Metrics Grid: 同排显示，总宽度控制在卡片内 */}
              <div className="grid grid-cols-4 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-6 mb-6">
                <div className="min-w-0">
                  <StatCard
                    title="Total Members"
                    value={metrics.totalMembers.toString()}
                    icon={<Users size={20} />}
                    subtext={`${metrics.newMembersThisMonth} new this month`}
                    trend={metrics.newMembersThisMonth > 0 ? metrics.newMembersThisMonth : undefined}
                  />
                </div>
                <div className="min-w-0">
                  <StatCard
                    title="Active Members"
                    value={metrics.activeMembers.toString()}
                    icon={<CheckCircle size={20} />}
                    subtext={`${Math.round((metrics.activeMembers / Math.max(metrics.totalMembers, 1)) * 100)}% engagement`}
                  />
                </div>
                <div className="min-w-0">
                  <StatCard
                    title="Upcoming Events"
                    value={metrics.upcomingEvents.toString()}
                    icon={<Calendar size={20} />}
                    subtext="Scheduled activities"
                  />
                </div>
                <div className="min-w-0">
                  <StatCard
                    title="Active Projects"
                    value={metrics.activeProjects.toString()}
                    icon={<Briefcase size={20} />}
                    subtext={`${metrics.completedProjects} completed`}
                  />
                </div>
              </div>

              {/* Financial Overview */}
              {loadingFinance ? (
                <Card title="Financial Overview">
                  <div className="text-center py-8 text-slate-400 text-sm">Loading financial data...</div>
                </Card>
              ) : financialSummary ? (
                <Card title="Financial Overview">
                  <div className="grid grid-cols-3 gap-2 md:gap-6">
                    <div className="min-w-0 bg-green-50 p-3 md:p-4 rounded-lg border border-green-200">
                      <div className="flex items-center justify-between mb-1 md:mb-2">
                        <span className="text-xs md:text-sm font-medium text-green-700 truncate">Total Income</span>
                        <DollarSign size={18} className="text-green-600 flex-shrink-0 md:w-5 md:h-5" />
                      </div>
                      <p className="text-lg md:text-2xl font-bold text-green-900 truncate">
                        {formatCurrency(financialSummary.totalIncome || 0)}
                      </p>
                    </div>
                    <div className="min-w-0 bg-red-50 p-3 md:p-4 rounded-lg border border-red-200">
                      <div className="flex items-center justify-between mb-1 md:mb-2">
                        <span className="text-xs md:text-sm font-medium text-red-700 truncate">Total Expenses</span>
                        <DollarSign size={18} className="text-red-600 flex-shrink-0 md:w-5 md:h-5" />
                      </div>
                      <p className="text-lg md:text-2xl font-bold text-red-900 truncate">
                        {formatCurrency(financialSummary.totalExpenses || 0)}
                      </p>
                    </div>
                    <div className="min-w-0 bg-blue-50 p-3 md:p-4 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between mb-1 md:mb-2">
                        <span className="text-xs md:text-sm font-medium text-blue-700 truncate">Net Balance</span>
                        <TrendingUp size={18} className="text-blue-600 flex-shrink-0 md:w-5 md:h-5" />
                      </div>
                      <p className="text-lg md:text-2xl font-bold text-blue-900 truncate">
                        {formatCurrency((financialSummary.totalIncome || 0) - (financialSummary.totalExpenses || 0))}
                      </p>
                    </div>
                  </div>
                </Card>
              ) : null}

              {/* Main Content Grid */}
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  {/* Member Engagement */}
                  <Card title="Member Engagement Metrics">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-slate-700">Average Points per Member</p>
                          <p className="text-2xl font-bold text-slate-900 mt-1">{metrics.averagePoints}</p>
                        </div>
                        <Award size={32} className="text-jci-blue" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle size={18} className="text-amber-600" />
                            <span className="text-sm font-medium text-amber-700">High Risk Members</span>
                          </div>
                          <p className="text-2xl font-bold text-amber-900">{metrics.highRiskMembers}</p>
                          <p className="text-xs text-amber-600 mt-1">Requires attention</p>
                        </div>
                        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle size={18} className="text-green-600" />
                            <span className="text-sm font-medium text-green-700">Engagement Rate</span>
                          </div>
                          <p className="text-2xl font-bold text-green-900">
                            {metrics.totalMembers > 0 ? Math.round((metrics.activeMembers / metrics.totalMembers) * 100) : 0}%
                          </p>
                          <p className="text-xs text-green-600 mt-1">Active participation</p>
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Project Status */}
                  <Card title="Project Status Overview">
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
                  </Card>

                  {/* Additional Metrics Grid */}
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Inventory Status */}
                    <Card title="Inventory Status">
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
                    </Card>

                    {/* Bank Accounts */}
                    <Card title="Bank Accounts">
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
                          {bankAccounts.slice(0, 3).map(account => (
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
                    </Card>

                    {/* Hobby Clubs Activity */}
                    <Card title="Hobby Clubs Activity">
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
                    </Card>

                    {/* Business Directory Engagement */}
                    <Card title="Business Directory">
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
                    </Card>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Quick Actions */}
                  <Card title="Quick Actions">
                    <div className="space-y-2">
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => {
                          setSelectedReportType('financial');
                          setIsReportModalOpen(true);
                        }}
                      >
                        <FileText size={16} className="mr-2" />
                        Generate Financial Report
                      </Button>
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => onNavigate?.('MEMBERS')}
                      >
                        <Users size={16} className="mr-2" />
                        Member Analytics
                      </Button>
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => onNavigate?.('INVENTORY')}
                      >
                        <Package size={16} className="mr-2" />
                        Inventory Management
                      </Button>
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => onNavigate?.('FINANCE')}
                      >
                        <DollarSign size={16} className="mr-2" />
                        Financial Management
                      </Button>
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => onNavigate?.('CLUBS')}
                      >
                        <Heart size={16} className="mr-2" />
                        Hobby Clubs
                      </Button>
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => onNavigate?.('DIRECTORY')}
                      >
                        <Building2 size={16} className="mr-2" />
                        Business Directory
                      </Button>
                    </div>
                  </Card>

                  {/* AI Insights & Predictions */}
                  <Card title="AI Insights & Predictions" className="border-l-4 border-l-purple-500">
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
                  </Card>

                  {/* Top Performers */}
                  <Card title="Top Performers">
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
                  </Card>
                </div>
              </div>
            </>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="grid lg:grid-cols-2 gap-6">
                <MemberGrowthChart members={members} />
                <PointsDistributionChart pointHistory={pointHistory} />
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
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
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
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

              {/* Monthly Birthday Grid */}
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                {monthNames.map((month, index) => {
                  const monthMembers = memberInsightsGroups[index];
                  if (monthMembers.length === 0 && !insightSearch && duesStatusFilter === 'All') {
                    // Still show the month even if empty if no filters are active? 
                    // No, let's only show months with members to save space.
                    return null;
                  }

                  if (monthMembers.length === 0) return null;

                  return (
                    <Card
                      key={month}
                      title={
                        <div className="flex items-center gap-2">
                          <Calendar className="text-jci-blue" size={18} />
                          <span>{month}</span>
                        </div>
                      }
                      className="h-full border-t-4 border-t-jci-blue"
                      noPadding
                    >
                      <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
                        {monthMembers.map(m => (
                          <div key={m.id} className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h4 className="font-bold text-slate-900 group-hover:text-jci-blue transition-colors">{m.name}</h4>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <Badge variant={m.duesStatus === 'Paid' ? 'success' : m.duesStatus === 'Overdue' ? 'error' : 'warning'} className="text-[10px] px-1.5 py-0">
                                    {m.duesStatus}
                                  </Badge>
                                  {m.duesYear && (
                                    <span className="text-[10px] text-slate-400 font-medium">FY {m.duesYear}</span>
                                  )}
                                </div>
                              </div>
                              <div className="bg-jci-blue/10 p-1.5 rounded-lg">
                                <Gift size={14} className="text-jci-blue" />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-50">
                              <div className="flex items-center gap-2">
                                <div className="p-1 bg-pink-50 rounded-md">
                                  <Cake size={12} className="text-pink-500" />
                                </div>
                                <div>
                                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Birthday</p>
                                  <p className="text-xs font-semibold text-slate-700">{m.dateOfBirth ? new Date(m.dateOfBirth).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : 'N/A'}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="p-1 bg-blue-50 rounded-md">
                                  <Users size={12} className="text-jci-blue" />
                                </div>
                                <div>
                                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Joined</p>
                                  <p className="text-xs font-semibold text-slate-700">{m.joinDate ? m.joinDate.split('-')[0] : 'N/A'}</p>
                                </div>
                              </div>
                            </div>

                            {m.duesPaidDate && m.duesStatus === 'Paid' && (
                              <div className="mt-2 flex items-center gap-1.5 text-[10px] text-green-600 bg-green-50/50 p-1.5 rounded-lg border border-green-100/50">
                                <CheckCircle size={10} />
                                <span className="font-medium">Paid on {new Date(m.duesPaidDate).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="px-4 py-2 bg-slate-50/50 border-t border-slate-100">
                        <p className="text-[10px] text-slate-400 font-medium">{monthMembers.length} {monthMembers.length === 1 ? 'member' : 'members'}</p>
                      </div>
                    </Card>
                  );
                })}

                {Object.values(memberInsightsGroups).every(g => g.length === 0) && (
                  <div className="col-span-full py-12 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                    <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                      <Users className="text-slate-400" size={24} />
                    </div>
                    <h3 className="text-slate-900 font-semibold">No members found</h3>
                    <p className="text-slate-500 text-sm mt-1">Try adjusting your filters or search terms.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Report Generation Modal */}
      <Modal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        title={`Generate ${selectedReportType.charAt(0).toUpperCase() + selectedReportType.slice(1)} Report`}
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
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  value={customDateRange.start}
                  onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">End Date</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
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

          <div className="pt-4 border-t flex gap-3">
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
        </div>
      </Modal>
    </div>
  );
};

