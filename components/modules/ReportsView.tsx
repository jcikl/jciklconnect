import React, { useState, useMemo, useEffect } from 'react';
import { 
  FileText, BarChart3, TrendingUp, Users, Calendar, DollarSign, 
  Download, Filter, Plus, Edit, Trash2, Eye, RefreshCw, 
  PieChart, LineChart, Activity, Target, Award, Package
} from 'lucide-react';
import { Card, Button, Badge, Modal, useToast, Tabs, StatCard } from '../ui/Common';
import { Input, Select, Textarea } from '../ui/Form';
import { LoadingState } from '../ui/Loading';
import { ReportService, ReportData, ReportOptions } from '../../services/reportService';
import { useMembers } from '../../hooks/useMembers';
import { useEvents } from '../../hooks/useEvents';
import { useProjects } from '../../hooks/useProjects';
import { FinanceService } from '../../services/financeService';
import { usePoints } from '../../hooks/usePoints';
import { formatCurrency } from '../../utils/formatUtils';
import { formatDate } from '../../utils/dateUtils';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart as RechartsPieChart, Pie, Cell, LineChart as RechartsLineChart, Line
} from 'recharts';

export const ReportsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'financial' | 'membership' | 'engagement' | 'projects' | 'custom'>('dashboard');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportData | null>(null);
  const [reportType, setReportType] = useState<'financial' | 'membership' | 'engagement' | 'projects' | 'inventory'>('financial');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  
  const { members } = useMembers();
  const { events } = useEvents();
  const { projects } = useProjects();
  const [transactions, setTransactions] = useState<any[]>([]);
  
  useEffect(() => {
    FinanceService.getAllTransactions().then(setTransactions).catch(() => setTransactions([]));
  }, []);
  const { leaderboard } = usePoints();

  const dashboardStats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59);
    
    const yearEvents = events.filter(e => {
      const eventDate = new Date(e.date);
      return eventDate >= yearStart && eventDate <= yearEnd;
    });
    
    const yearTransactions = transactions.filter(t => {
      const txDate = new Date(t.date);
      return txDate >= yearStart && txDate <= yearEnd;
    });
    
    const totalIncome = yearTransactions.filter(t => t.type === 'Income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = yearTransactions.filter(t => t.type === 'Expense').reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    return {
      totalMembers: members.length,
      activeProjects: projects.filter(p => p.status === 'Active').length,
      upcomingEvents: events.filter(e => new Date(e.date) > new Date()).length,
      yearEvents: yearEvents.length,
      totalIncome,
      totalExpenses,
      netBalance: totalIncome - totalExpenses,
      averageAttendance: yearEvents.length > 0 
        ? yearEvents.reduce((sum, e) => sum + (e.attendees || 0), 0) / yearEvents.length 
        : 0,
    };
  }, [members, events, projects, transactions]);

  const handleGenerateReport = async () => {
    setLoading(true);
    try {
      const options: ReportOptions = {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        format: 'JSON',
        includeCharts: true,
      };

      let report: ReportData;
      switch (reportType) {
        case 'financial':
          report = await ReportService.generateFinancialReport(options);
          break;
        case 'membership':
          report = await ReportService.generateMembershipReport(options);
          break;
        case 'engagement':
          report = await ReportService.generateEngagementReport(options);
          break;
        case 'projects':
          report = await ReportService.generateProjectReport(options);
          break;
        case 'inventory':
          report = await ReportService.generateInventoryReport(options);
          break;
        default:
          throw new Error('Invalid report type');
      }

      setSelectedReport(report);
      setIsViewModalOpen(true);
      showToast('Report generated successfully', 'success');
    } catch (err) {
      showToast('Failed to generate report', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportReport = async (format: 'CSV' | 'JSON' | 'PDF' | 'Excel') => {
    if (!selectedReport) return;
    
    try {
      const options: ReportOptions = {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        format,
        includeCharts: false,
      };

      let report: ReportData;
      switch (reportType) {
        case 'financial':
          report = await ReportService.generateFinancialReport(options);
          break;
        case 'membership':
          report = await ReportService.generateMembershipReport(options);
          break;
        case 'engagement':
          report = await ReportService.generateEngagementReport(options);
          break;
        case 'projects':
          report = await ReportService.generateProjectReport(options);
          break;
        case 'inventory':
          report = await ReportService.generateInventoryReport(options);
          break;
        default:
          throw new Error('Invalid report type');
      }

      if (format === 'CSV' || format === 'JSON') {
        const content = format === 'CSV' 
          ? ReportService.convertToCSV(report)
          : JSON.stringify(report, null, 2);
        
        const blob = new Blob([content], { type: format === 'CSV' ? 'text/csv' : 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `report-${reportType}-${Date.now()}.${format.toLowerCase()}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      } else {
        showToast(`${format} export coming soon`, 'info');
      }

      showToast(`Report exported as ${format}`, 'success');
    } catch (err) {
      showToast('Failed to export report', 'error');
    }
  };

  const renderDashboard = () => {
    const eventAttendanceData = events.slice(0, 10).map(e => ({
      name: e.title.substring(0, 20),
      registered: e.attendees || 0,
      attended: e.attendees || 0, // Simplified since attendees is a number
    }));

    const categoryBreakdown = transactions.reduce((acc, t) => {
      if (!acc[t.category]) {
        acc[t.category] = { income: 0, expenses: 0 };
      }
      if (t.type === 'Income') {
        acc[t.category].income += t.amount;
      } else {
        acc[t.category].expenses += Math.abs(t.amount);
      }
      return acc;
    }, {} as Record<string, { income: number; expenses: number }>);

    const categoryData = Object.entries(categoryBreakdown).map(([name, data]: [string, { income: number; expenses: number }]) => ({
      name,
      income: data.income,
      expenses: data.expenses,
      net: data.income - data.expenses,
    }));

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Members"
            value={dashboardStats.totalMembers.toString()}
            icon={<Users size={24} />}
            trend={12}
          />
          <StatCard
            title="Active Projects"
            value={dashboardStats.activeProjects.toString()}
            icon={<Target size={24} />}
            trend={3}
          />
          <StatCard
            title="Year Events"
            value={dashboardStats.yearEvents.toString()}
            icon={<Calendar size={24} />}
            trend={Math.round(dashboardStats.averageAttendance)}
          />
          <StatCard
            title="Net Balance"
            value={formatCurrency(dashboardStats.netBalance)}
            icon={<DollarSign size={24} />}
            trend={dashboardStats.netBalance >= 0 ? 1 : -1}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Event Attendance">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={eventAttendanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="registered" fill="#3b82f6" name="Registered" />
                <Bar dataKey="attended" fill="#10b981" name="Attended" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Financial Category Breakdown">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="income" fill="#10b981" name="Income" />
                <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Reports & Business Intelligence</h2>
          <p className="text-slate-500">Generate comprehensive reports and analyze organizational data</p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus size={16} className="mr-2" />
          Generate Report
        </Button>
      </div>

      <Card noPadding>
        <div className="px-6 pt-4">
          <Tabs
            tabs={['Dashboard', 'Financial', 'Membership', 'Engagement', 'Projects', 'Custom']}
            activeTab={
              activeTab === 'dashboard' ? 'Dashboard' :
              activeTab === 'financial' ? 'Financial' :
              activeTab === 'membership' ? 'Membership' :
              activeTab === 'engagement' ? 'Engagement' :
              activeTab === 'projects' ? 'Projects' : 'Custom'
            }
            onTabChange={(tab) => {
              if (tab === 'Dashboard') setActiveTab('dashboard');
              else if (tab === 'Financial') setActiveTab('financial');
              else if (tab === 'Membership') setActiveTab('membership');
              else if (tab === 'Engagement') setActiveTab('engagement');
              else if (tab === 'Projects') setActiveTab('projects');
              else setActiveTab('custom');
            }}
          />
        </div>
        <div className="p-6">
          <LoadingState loading={loading} error={null}>
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'financial' && (
              <div className="text-center py-12">
                <BarChart3 size={48} className="mx-auto mb-4 text-slate-300" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">Financial Reports</h3>
                <p className="text-slate-600 mb-4">Generate detailed financial reports</p>
                <Button onClick={() => { setReportType('financial'); setIsCreateModalOpen(true); }}>
                  Generate Financial Report
                </Button>
              </div>
            )}
            {activeTab === 'membership' && (
              <div className="text-center py-12">
                <Users size={48} className="mx-auto mb-4 text-slate-300" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">Membership Reports</h3>
                <p className="text-slate-600 mb-4">Analyze membership growth and engagement</p>
                <Button onClick={() => { setReportType('membership'); setIsCreateModalOpen(true); }}>
                  Generate Membership Report
                </Button>
              </div>
            )}
            {activeTab === 'engagement' && (
              <div className="text-center py-12">
                <Activity size={48} className="mx-auto mb-4 text-slate-300" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">Engagement Reports</h3>
                <p className="text-slate-600 mb-4">Track member engagement metrics</p>
                <Button onClick={() => { setReportType('engagement'); setIsCreateModalOpen(true); }}>
                  Generate Engagement Report
                </Button>
              </div>
            )}
            {activeTab === 'projects' && (
              <div className="text-center py-12">
                <Target size={48} className="mx-auto mb-4 text-slate-300" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">Project Reports</h3>
                <p className="text-slate-600 mb-4">Analyze project performance and status</p>
                <Button onClick={() => { setReportType('projects'); setIsCreateModalOpen(true); }}>
                  Generate Project Report
                </Button>
              </div>
            )}
            {activeTab === 'custom' && (
              <div className="text-center py-12">
                <FileText size={48} className="mx-auto mb-4 text-slate-300" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">Custom Reports</h3>
                <p className="text-slate-600 mb-4">Create custom reports with advanced filters</p>
                <Button onClick={() => setIsCreateModalOpen(true)}>
                  Create Custom Report
                </Button>
              </div>
            )}
          </LoadingState>
        </div>
      </Card>

      {/* Generate Report Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Generate Report"
        size="lg"
      >
        <form onSubmit={(e) => { e.preventDefault(); handleGenerateReport(); }} className="space-y-4">
          <Select
            label="Report Type"
            value={reportType}
            onChange={(e) => setReportType(e.target.value as any)}
            options={[
              { label: 'Financial Report', value: 'financial' },
              { label: 'Membership Report', value: 'membership' },
              { label: 'Engagement Report', value: 'engagement' },
              { label: 'Project Report', value: 'projects' },
              { label: 'Inventory Report', value: 'inventory' },
            ]}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="pt-4 flex gap-3">
            <Button type="submit" className="flex-1" isLoading={loading}>
              Generate Report
            </Button>
            <Button type="button" variant="ghost" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      {/* View Report Modal */}
      {selectedReport && (
        <Modal
          isOpen={isViewModalOpen}
          onClose={() => { setIsViewModalOpen(false); setSelectedReport(null); }}
          title={selectedReport.title}
          size="xl"
        >
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-4 border-b">
              <div>
                <p className="text-sm text-slate-500">Period</p>
                <p className="font-semibold text-slate-900">{selectedReport.period}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleExportReport('CSV')}>
                  <Download size={14} className="mr-2" />
                  CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExportReport('JSON')}>
                  <Download size={14} className="mr-2" />
                  JSON
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExportReport('PDF')}>
                  <Download size={14} className="mr-2" />
                  PDF
                </Button>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <pre className="bg-slate-50 p-4 rounded-lg text-sm overflow-x-auto">
                {JSON.stringify(selectedReport.data, null, 2)}
              </pre>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

