import React, { useState, useMemo, useEffect } from 'react';
import {
  Users, Calendar, DollarSign,
  Download, Plus, Activity, Target, FileText,
} from 'lucide-react';
import { Card, Button, Modal, useToast, Tabs, StatCard, StatCardsContainer } from '../ui/Common';
import { Input, Select } from '../ui/Form';
import { LoadingState } from '../ui/Loading';
import { ReportService, ReportData, ReportOptions, MykdRow, MYKD_COLUMNS } from '../../services/reportService';
import { useMembers } from '../../hooks/useMembers';
import { useEvents } from '../../hooks/useEvents';
import { useProjects } from '../../hooks/useProjects';
import { FinanceService } from '../../services/financeService';
import { formatCurrency } from '../../utils/formatUtils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

type ReportTab = 'dashboard' | 'financial' | 'membership' | 'engagement' | 'projects' | 'custom';
type ReportType = 'financial' | 'membership' | 'engagement' | 'projects' | 'inventory';

interface MemberReportTemplate {
  id: string;
  name: string;
  tag: string;
  description: string;
  columns: string[];
}

const MEMBER_REPORT_TEMPLATES: MemberReportTemplate[] = [
  {
    id: 'mykd',
    name: 'MYKD',
    tag: 'ROY',
    description: 'Standard member registry report for Registrar of Youth submission.',
    columns: ['No.', 'Full Name', 'National ID', 'Age', 'Ethnicity', 'Birth Date', 'Birth Place', 'Occupation', 'Home Address', 'Contact Number', 'Email'],
  },
];

const NON_MEMBER_REPORT_CARDS = [
  {
    id: 'financial' as ReportTab,
    type: 'financial' as ReportType,
    icon: <DollarSign size={20} />,
    color: 'bg-emerald-50 text-emerald-600',
    title: 'Financial Report',
    description: 'Income, expenses, net balance, and transaction breakdowns by category.',
  },
  {
    id: 'engagement' as ReportTab,
    type: 'engagement' as ReportType,
    icon: <Activity size={20} />,
    color: 'bg-violet-50 text-violet-600',
    title: 'Engagement Report',
    description: 'Event attendance rates, participation trends, and top contributors.',
  },
  {
    id: 'projects' as ReportTab,
    type: 'projects' as ReportType,
    icon: <Target size={20} />,
    color: 'bg-amber-50 text-amber-600',
    title: 'Project Report',
    description: 'Project status summary, budget utilization, and completion metrics.',
  },
  {
    id: 'custom' as ReportTab,
    type: 'financial' as ReportType,
    icon: <FileText size={20} />,
    color: 'bg-slate-100 text-slate-600',
    title: 'Custom Report',
    description: 'Build a tailored report by choosing type, date range, and filters.',
  },
];

export const ReportsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportTab>('dashboard');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [reportType, setReportType] = useState<ReportType>('financial');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  // MYKD report state
  const [mykdLoading, setMykdLoading] = useState(false);
  const [mykdRows, setMykdRows] = useState<MykdRow[] | null>(null);
  const [mykdModal, setMykdModal] = useState(false);
  const [mykdStart, setMykdStart] = useState('');
  const [mykdEnd, setMykdEnd] = useState('');
  const [mykdGenModal, setMykdGenModal] = useState(false);

  const { showToast } = useToast();
  const { members } = useMembers();
  const { events } = useEvents();
  const { projects } = useProjects();
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    FinanceService.getAllTransactions().then(setTransactions).catch(() => setTransactions([]));
  }, []);

  const stats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const ys = new Date(currentYear, 0, 1);
    const ye = new Date(currentYear, 11, 31, 23, 59, 59);
    const yearEvents = events.filter(e => { const d = new Date(e.date); return d >= ys && d <= ye; });
    const yearTx = transactions.filter(t => { const d = new Date(t.date); return d >= ys && d <= ye; });
    const totalIncome = yearTx.filter(t => t.type === 'Income').reduce((s, t) => s + t.amount, 0);
    const totalExpenses = yearTx.filter(t => t.type === 'Expense').reduce((s, t) => s + Math.abs(t.amount), 0);
    return {
      totalMembers: members.length,
      activeProjects: projects.filter(p => p.status === 'Active').length,
      yearEvents: yearEvents.length,
      netBalance: totalIncome - totalExpenses,
      totalIncome,
      totalExpenses,
      avgAttendance: yearEvents.length > 0
        ? Math.round(yearEvents.reduce((s, e) => s + (e.attendees || 0), 0) / yearEvents.length)
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
      switch (reportType) {
        case 'financial':  await ReportService.generateFinancialReport(options); break;
        case 'membership': await ReportService.generateMembershipReport(options); break;
        case 'engagement': await ReportService.generateEngagementReport(options); break;
        case 'projects':   await ReportService.generateProjectReport(options); break;
        case 'inventory':  await ReportService.generateInventoryReport(options); break;
      }
      setIsCreateModalOpen(false);
      showToast('Report generated successfully', 'success');
    } catch {
      showToast('Failed to generate report', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateMykd = async () => {
    setMykdLoading(true);
    try {
      const options: ReportOptions = {
        startDate: mykdStart ? new Date(mykdStart) : undefined,
        endDate: mykdEnd ? new Date(mykdEnd) : undefined,
        format: 'JSON',
      };
      const result = await ReportService.generateMykdReport(options);
      setMykdRows(result.rows);
      setMykdGenModal(false);
      setMykdModal(true);
      showToast(`${result.rows.length} members loaded`, 'success');
    } catch {
      showToast('Failed to generate MYKD report', 'error');
    } finally {
      setMykdLoading(false);
    }
  };

  const handleExportMykd = () => {
    if (!mykdRows) return;
    const csv = ReportService.exportMykdToCSV(mykdRows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'mykd-roy-report.csv';
    document.body.appendChild(link); link.click();
    document.body.removeChild(link); URL.revokeObjectURL(link.href);
    showToast('Exported as CSV', 'success');
  };

  // ── Dashboard tab ──
  const renderDashboard = () => {
    const attendanceData = events.slice(0, 8).map(e => ({
      name: e.title.length > 14 ? e.title.substring(0, 14) + '…' : e.title,
      attended: e.attendees || 0,
    }));
    const catBreakdown = transactions.reduce((acc, t) => {
      if (!acc[t.category]) acc[t.category] = { income: 0, expenses: 0 };
      if (t.type === 'Income') acc[t.category].income += t.amount;
      else acc[t.category].expenses += Math.abs(t.amount);
      return acc;
    }, {} as Record<string, { income: number; expenses: number }>);
    const catData = Object.entries(catBreakdown).map(([name, d]: any) => ({
      name: name.length > 10 ? name.substring(0, 10) + '…' : name,
      income: d.income, expenses: d.expenses,
    }));

    return (
      <div className="space-y-5">
        <StatCardsContainer>
          <StatCard title="Total Members"   value={stats.totalMembers.toString()}    icon={<Users size={24} />}      trend={12} />
          <StatCard title="Active Projects" value={stats.activeProjects.toString()}  icon={<Target size={24} />}     trend={3} />
          <StatCard title="Year Events"     value={stats.yearEvents.toString()}      icon={<Calendar size={24} />}   trend={stats.avgAttendance} />
          <StatCard title="Net Balance"     value={formatCurrency(stats.netBalance)} icon={<DollarSign size={24} />} trend={stats.netBalance >= 0 ? 1 : -1} />
        </StatCardsContainer>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="Event Attendance">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={attendanceData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="attended" fill="#3b82f6" name="Attended" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card title="Finance by Category">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={catData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="income"   fill="#10b981" name="Income"   radius={[3, 3, 0, 0]} />
                <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {NON_MEMBER_REPORT_CARDS.slice(0, 3).map(r => (
            <button key={r.id} type="button" onClick={() => { setReportType(r.type); setIsCreateModalOpen(true); }}
              className="flex flex-col items-center gap-2 p-3 bg-white border border-slate-200 rounded-xl hover:border-jci-blue hover:shadow-sm transition-all text-center group">
              <span className={`w-9 h-9 rounded-full flex items-center justify-center ${r.color}`}>{r.icon}</span>
              <span className="text-xs font-semibold text-slate-700 group-hover:text-jci-blue leading-tight">{r.title}</span>
            </button>
          ))}
          <button type="button" onClick={() => setActiveTab('membership')}
            className="flex flex-col items-center gap-2 p-3 bg-white border border-slate-200 rounded-xl hover:border-jci-blue hover:shadow-sm transition-all text-center group">
            <span className="w-9 h-9 rounded-full flex items-center justify-center bg-blue-50 text-blue-600"><Users size={18} /></span>
            <span className="text-xs font-semibold text-slate-700 group-hover:text-jci-blue leading-tight">Membership</span>
          </button>
        </div>
      </div>
    );
  };

  // ── Membership tab ──
  const renderMembership = () => (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-slate-800">Membership Report Templates</p>
        <p className="text-xs text-slate-500 mt-0.5">{MEMBER_REPORT_TEMPLATES.length} template{MEMBER_REPORT_TEMPLATES.length > 1 ? 's' : ''} available</p>
      </div>

      {MEMBER_REPORT_TEMPLATES.map(tmpl => (
        <div key={tmpl.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-start justify-between gap-4 px-5 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <Users size={18} className="text-blue-600" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">{tmpl.name}</span>
                  <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-semibold rounded uppercase tracking-wide">{tmpl.tag}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{tmpl.description}</p>
              </div>
            </div>
            <Button size="sm" className="shrink-0 flex items-center gap-1.5" onClick={() => setMykdGenModal(true)}>
              <Plus size={14} />Generate
            </Button>
          </div>
          <div className="px-5 pb-4">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Columns</p>
            <div className="flex flex-wrap gap-1.5">
              {tmpl.columns.map(col => (
                <span key={col} className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600">{col}</span>
              ))}
            </div>
          </div>
        </div>
      ))}

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Members',   value: stats.totalMembers },
          { label: 'Active Projects', value: stats.activeProjects },
          { label: 'Year Events',     value: stats.yearEvents },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
            <p className="text-base font-bold text-slate-800">{s.value}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Non-membership report tab ──
  const renderReportCard = (card: typeof NON_MEMBER_REPORT_CARDS[0]) => {
    type StatEntry = { label: string; value: string; color?: string };
    const quickStatsMap: Record<string, StatEntry[]> = {
      financial: [
        { label: 'Income (YTD)',   value: formatCurrency(stats.totalIncome),  color: 'text-emerald-600' },
        { label: 'Expenses (YTD)', value: formatCurrency(stats.totalExpenses), color: 'text-red-500' },
        { label: 'Net Balance',    value: formatCurrency(stats.netBalance),    color: stats.netBalance >= 0 ? 'text-emerald-600' : 'text-red-500' },
      ],
      engagement: [
        { label: 'Year Events',    value: String(stats.yearEvents) },
        { label: 'Avg Attendance', value: String(stats.avgAttendance) },
      ],
      projects: [
        { label: 'Active Projects', value: String(stats.activeProjects) },
        { label: 'Total Projects',  value: String(projects.length) },
      ],
      custom: [],
    };
    const qs = quickStatsMap[card.id] ?? [];

    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4">
          <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${card.color}`}>
            {React.cloneElement(card.icon as React.ReactElement, { size: 22 })}
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 text-base">{card.title}</h3>
            <p className="text-sm text-slate-500 mt-0.5">{card.description}</p>
          </div>
          <Button size="sm" className="shrink-0 flex items-center gap-1.5" onClick={() => { setReportType(card.type); setIsCreateModalOpen(true); }}>
            <Plus size={14} />Generate
          </Button>
        </div>
        {qs.length > 0 && (
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${qs.length}, minmax(0, 1fr))` }}>
            {qs.map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
                <p className={`text-base font-bold ${s.color ?? 'text-slate-800'}`}>{s.value}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const TAB_IDS: ReportTab[] = ['dashboard', 'financial', 'membership', 'engagement', 'projects', 'custom'];
  const TAB_LABELS = ['Dashboard', 'Financial', 'Membership', 'Engagement', 'Projects', 'Custom'];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Reports</h2>
          <p className="text-sm text-slate-500 hidden sm:block">Generate and analyze organizational reports</p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)} size="sm" className="flex items-center gap-1.5 shrink-0">
          <Plus size={14} />Generate Report
        </Button>
      </div>

      <Card noPadding>
        <div className="px-4 pt-4">
          <Tabs
            tabs={TAB_LABELS}
            activeTab={TAB_LABELS[TAB_IDS.indexOf(activeTab)]}
            onTabChange={(tab) => setActiveTab(TAB_IDS[TAB_LABELS.indexOf(tab)])}
          />
        </div>
        <div className="p-4">
          <LoadingState loading={loading} error={null}>
            {activeTab === 'dashboard'  && renderDashboard()}
            {activeTab === 'membership' && renderMembership()}
            {NON_MEMBER_REPORT_CARDS.map(card =>
              activeTab === card.id ? <div key={card.id}>{renderReportCard(card)}</div> : null
            )}
          </LoadingState>
        </div>
      </Card>

      {/* Generic Generate Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Generate Report" size="md" drawerOnMobile>
        <form onSubmit={(e) => { e.preventDefault(); handleGenerateReport(); }} className="space-y-4">
          <Select label="Report Type" value={reportType} onChange={(e) => setReportType(e.target.value as ReportType)}
            options={[
              { label: 'Financial Report',   value: 'financial' },
              { label: 'Membership Report',  value: 'membership' },
              { label: 'Engagement Report',  value: 'engagement' },
              { label: 'Project Report',     value: 'projects' },
              { label: 'Inventory Report',   value: 'inventory' },
            ]} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <Input label="End Date"   type="date" value={endDate}   onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1" isLoading={loading}>Generate</Button>
            <Button type="button" variant="ghost" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {/* MYKD Generate Modal */}
      <Modal isOpen={mykdGenModal} onClose={() => setMykdGenModal(false)} title="Generate MYKD (ROY) Report" size="md" drawerOnMobile>
        <form onSubmit={(e) => { e.preventDefault(); handleGenerateMykd(); }} className="space-y-4">
          <p className="text-sm text-slate-500">Filter by member join date, or leave empty to include all members.</p>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Join Date From" type="date" value={mykdStart} onChange={(e) => setMykdStart(e.target.value)} />
            <Input label="Join Date To"   type="date" value={mykdEnd}   onChange={(e) => setMykdEnd(e.target.value)} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1" isLoading={mykdLoading}>Generate</Button>
            <Button type="button" variant="ghost" onClick={() => setMykdGenModal(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {/* MYKD View Modal */}
      <Modal
        isOpen={mykdModal}
        onClose={() => setMykdModal(false)}
        title={`MYKD (ROY) — ${mykdRows?.length ?? 0} members`}
        size="xl"
        drawerOnMobile
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <p className="text-xs text-slate-500">
              Generated {new Date().toLocaleDateString()} · {mykdRows?.length ?? 0} rows
            </p>
            <Button size="sm" variant="outline" onClick={handleExportMykd} className="flex items-center gap-1.5">
              <Download size={13} />Export CSV
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {MYKD_COLUMNS.map(col => (
                    <th key={col.key} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(mykdRows ?? []).map(row => (
                  <tr key={row.no} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-3 py-2.5 text-slate-400 text-xs">{row.no}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-800 whitespace-nowrap">{row.fullName}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-600 whitespace-nowrap">{row.nationalId}</td>
                    <td className="px-3 py-2.5 text-slate-700 text-center">{row.age}</td>
                    <td className="px-3 py-2.5 text-slate-700">{row.ethnicity}</td>
                    <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{row.birthDate}</td>
                    <td className="px-3 py-2.5 text-slate-700">{row.birthPlace}</td>
                    <td className="px-3 py-2.5 text-slate-700">{row.occupation}</td>
                    <td className="px-3 py-2.5 text-slate-600 text-xs max-w-[160px] truncate">{row.homeAddress}</td>
                    <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{row.contactNumber}</td>
                    <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{row.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </div>
  );
};
