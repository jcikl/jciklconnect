// Report Service - Generate and export reports
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { isDevMode } from '../utils/devMode';
import { MembersService } from './membersService';
import { EventsService } from './eventsService';
import { ProjectsService } from './projectsService';
import { FinanceService } from './financeService';
import { PointsService } from './pointsService';

export interface ReportData {
  title: string;
  period: string;
  generatedAt: Date;
  data: any;
  summary?: any;
}

export interface ReportOptions {
  startDate?: Date;
  endDate?: Date;
  format: 'PDF' | 'Excel' | 'CSV' | 'JSON';
  includeCharts?: boolean;
  filters?: Record<string, any>;
}

export interface MykdRow {
  no: number;
  fullName: string;
  nationalId: string;
  age: number | string;
  ethnicity: string;
  birthDate: string;
  birthPlace: string;
  occupation: string;
  homeAddress: string;
  contactNumber: string;
  email: string;
}

export const MYKD_COLUMNS: { key: keyof MykdRow; label: string }[] = [
  { key: 'no',            label: 'No.' },
  { key: 'fullName',      label: 'Full Name' },
  { key: 'nationalId',    label: 'National ID' },
  { key: 'age',           label: 'Age' },
  { key: 'ethnicity',     label: 'Ethnicity' },
  { key: 'birthDate',     label: 'Birth Date' },
  { key: 'birthPlace',    label: 'Birth Place' },
  { key: 'occupation',    label: 'Occupation' },
  { key: 'homeAddress',   label: 'Home Address' },
  { key: 'contactNumber', label: 'Contact Number' },
  { key: 'email',         label: 'Email' },
];

export class ReportService {
  // Generate financial report
  static async generateFinancialReport(options: ReportOptions): Promise<ReportData> {
    if (isDevMode()) {
      return {
        title: 'Financial Report',
        period: options.startDate && options.endDate 
          ? `${options.startDate.toLocaleDateString()} - ${options.endDate.toLocaleDateString()}`
          : 'All Time',
        generatedAt: new Date(),
        data: {
          income: 50000,
          expenses: 30000,
          netBalance: 20000,
        },
      };
    }

    try {
      const summary = await FinanceService.getFinancialSummary();
      const transactions = await FinanceService.getAllTransactions();

      // Filter transactions by date range if provided
      let filteredTransactions = transactions;
      if (options.startDate && options.endDate) {
        filteredTransactions = transactions.filter(t => {
          const transactionDate = new Date(t.date);
          return transactionDate >= options.startDate! && transactionDate <= options.endDate!;
        });
      }

      // Calculate filtered summary
      const filteredIncome = filteredTransactions
        .filter(t => t.type === 'Income')
        .reduce((sum, t) => sum + t.amount, 0);
      const filteredExpenses = filteredTransactions
        .filter(t => t.type === 'Expense')
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        title: 'Financial Report',
        period: options.startDate && options.endDate 
          ? `${options.startDate.toLocaleDateString()} - ${options.endDate.toLocaleDateString()}`
          : 'All Time',
        generatedAt: new Date(),
        data: {
          transactions: filteredTransactions,
          income: filteredIncome,
          expenses: filteredExpenses,
          netBalance: filteredIncome - filteredExpenses,
          categoryBreakdown: this.calculateCategoryBreakdown(filteredTransactions),
        },
        summary: {
          totalIncome: filteredIncome,
          totalExpenses: filteredExpenses,
          netBalance: filteredIncome - filteredExpenses,
          transactionCount: filteredTransactions.length,
        },
      };
    } catch (error) {
      console.error('Error generating financial report:', error);
      throw error;
    }
  }

  // Generate membership report
  static async generateMembershipReport(options: ReportOptions): Promise<ReportData> {
    if (isDevMode()) {
      return {
        title: 'Membership Report',
        period: options.startDate && options.endDate 
          ? `${options.startDate.toLocaleDateString()} - ${options.endDate.toLocaleDateString()}`
          : 'All Time',
        generatedAt: new Date(),
        data: {
          totalMembers: 100,
          newMembers: 10,
          activeMembers: 80,
        },
      };
    }

    try {
      const members = await MembersService.getAllMembers();

      // Filter members by join date if provided
      let filteredMembers = members;
      if (options.startDate && options.endDate) {
        filteredMembers = members.filter(m => {
          const joinDate = new Date(m.joinDate);
          return joinDate >= options.startDate! && joinDate <= options.endDate!;
        });
      }

      // Calculate statistics
      const roleDistribution = this.calculateRoleDistribution(filteredMembers);
      const tierDistribution = this.calculateTierDistribution(filteredMembers);
      const churnRiskDistribution = this.calculateChurnRiskDistribution(filteredMembers);

      return {
        title: 'Membership Report',
        period: options.startDate && options.endDate 
          ? `${options.startDate.toLocaleDateString()} - ${options.endDate.toLocaleDateString()}`
          : 'All Time',
        generatedAt: new Date(),
        data: {
          members: filteredMembers,
          totalMembers: filteredMembers.length,
          activeMembers: filteredMembers.filter(m => m.duesStatus === 'Paid').length,
          newMembers: filteredMembers.filter(m => {
            const joinDate = new Date(m.joinDate);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            return joinDate >= thirtyDaysAgo;
          }).length,
          roleDistribution,
          tierDistribution,
          churnRiskDistribution,
        },
        summary: {
          totalMembers: filteredMembers.length,
          activeMembers: filteredMembers.filter(m => m.duesStatus === 'Paid').length,
          engagementRate: filteredMembers.length > 0
            ? Math.round((filteredMembers.filter(m => m.duesStatus === 'Paid').length / filteredMembers.length) * 100)
            : 0,
        },
      };
    } catch (error) {
      console.error('Error generating membership report:', error);
      throw error;
    }
  }

  // Generate engagement report
  static async generateEngagementReport(options: ReportOptions): Promise<ReportData> {
    if (isDevMode()) {
      return {
        title: 'Engagement Report',
        period: options.startDate && options.endDate 
          ? `${options.startDate.toLocaleDateString()} - ${options.endDate.toLocaleDateString()}`
          : 'All Time',
        generatedAt: new Date(),
        data: {
          totalPoints: 50000,
          averagePoints: 500,
          topPerformers: [],
        },
      };
    }

    try {
      const members = await MembersService.getAllMembers();
      const events = await EventsService.getAllEvents();
      const projects = await ProjectsService.getAllProjects();
      const leaderboard = await PointsService.getLeaderboard(100);

      // Filter by date range if provided
      let filteredEvents = events;
      let filteredProjects = projects;
      if (options.startDate && options.endDate) {
        filteredEvents = events.filter(e => {
          const eventDate = new Date(e.date);
          return eventDate >= options.startDate! && eventDate <= options.endDate!;
        });
        filteredProjects = projects.filter(p => {
          if (!p.startDate) return false;
          const projectDate = new Date(p.startDate);
          return projectDate >= options.startDate! && projectDate <= options.endDate!;
        });
      }

      // Calculate engagement metrics
      const totalPoints = leaderboard.reduce((sum, m) => sum + (m.points || 0), 0);
      const averagePoints = leaderboard.length > 0 ? Math.round(totalPoints / leaderboard.length) : 0;
      const topPerformers = leaderboard.slice(0, 10);
      const eventAttendanceRate = this.calculateEventAttendanceRate(filteredEvents);
      const projectParticipationRate = this.calculateProjectParticipationRate(filteredProjects, members);

      return {
        title: 'Engagement Report',
        period: options.startDate && options.endDate 
          ? `${options.startDate.toLocaleDateString()} - ${options.endDate.toLocaleDateString()}`
          : 'All Time',
        generatedAt: new Date(),
        data: {
          totalPoints,
          averagePoints,
          topPerformers,
          eventAttendanceRate,
          projectParticipationRate,
          events: filteredEvents,
          projects: filteredProjects,
        },
        summary: {
          totalPoints,
          averagePoints,
          totalEvents: filteredEvents.length,
          totalProjects: filteredProjects.length,
          averageAttendanceRate: eventAttendanceRate,
        },
      };
    } catch (error) {
      console.error('Error generating engagement report:', error);
      throw error;
    }
  }

  // Generate project report
  static async generateProjectReport(options: ReportOptions): Promise<ReportData> {
    if (isDevMode()) {
      return {
        title: 'Project Report',
        period: options.startDate && options.endDate 
          ? `${options.startDate.toLocaleDateString()} - ${options.endDate.toLocaleDateString()}`
          : 'All Time',
        generatedAt: new Date(),
        data: {
          totalProjects: 20,
          activeProjects: 10,
          completedProjects: 10,
        },
      };
    }

    try {
      const projects = await ProjectsService.getAllProjects();

      // Filter by date range if provided
      let filteredProjects = projects;
      if (options.startDate && options.endDate) {
        filteredProjects = projects.filter(p => {
          if (!p.startDate) return false;
          const projectDate = new Date(p.startDate);
          return projectDate >= options.startDate! && projectDate <= options.endDate!;
        });
      }

      // Calculate project statistics
      const statusDistribution = this.calculateProjectStatusDistribution(filteredProjects);
      const averageCompletion = filteredProjects.length > 0
        ? Math.round(filteredProjects.reduce((sum, p) => sum + p.completion, 0) / filteredProjects.length)
        : 0;

      return {
        title: 'Project Report',
        period: options.startDate && options.endDate 
          ? `${options.startDate.toLocaleDateString()} - ${options.endDate.toLocaleDateString()}`
          : 'All Time',
        generatedAt: new Date(),
        data: {
          projects: filteredProjects,
          totalProjects: filteredProjects.length,
          activeProjects: filteredProjects.filter(p => p.status === 'Active').length,
          completedProjects: filteredProjects.filter(p => p.status === 'Completed').length,
          statusDistribution,
          averageCompletion,
        },
        summary: {
          totalProjects: filteredProjects.length,
          activeProjects: filteredProjects.filter(p => p.status === 'Active').length,
          completedProjects: filteredProjects.filter(p => p.status === 'Completed').length,
          averageCompletion,
        },
      };
    } catch (error) {
      console.error('Error generating project report:', error);
      throw error;
    }
  }

  // Generate MYKD (ROY) member report
  static async generateMykdReport(options: ReportOptions): Promise<ReportData & { rows: MykdRow[] }> {
    const calcAge = (dob: string): number => {
      if (!dob) return 0;
      const birth = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      if (
        today.getMonth() < birth.getMonth() ||
        (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
      ) age--;
      return age;
    };

    if (isDevMode()) {
      const mockRows: MykdRow[] = Array.from({ length: 5 }, (_, i) => ({
        no: i + 1,
        fullName: `Member ${i + 1}`,
        nationalId: `000000-00-000${i}`,
        age: 25 + i,
        ethnicity: ['Malay', 'Chinese', 'Indian', 'Others'][i % 4],
        birthDate: `199${i}-01-01`,
        birthPlace: 'Kuala Lumpur',
        occupation: 'Business Owner',
        homeAddress: `No. ${i + 1}, Jalan Test, KL`,
        contactNumber: `+6011-0000000${i}`,
        email: `member${i + 1}@example.com`,
      }));
      return {
        title: 'MYKD (ROY) Member Report',
        period: 'All Time',
        generatedAt: new Date(),
        data: { rows: mockRows },
        rows: mockRows,
      };
    }

    const members = await MembersService.getAllMembers();
    let filtered = members;
    if (options.startDate && options.endDate) {
      filtered = members.filter(m => {
        const d = new Date(m.joinDate || m.joinedDate || '');
        return d >= options.startDate! && d <= options.endDate!;
      });
    }

    const rows: MykdRow[] = filtered.map((m, i) => {
      const dob = m.general?.dob || m.dob || m.dateOfBirth || '';
      const race = (m.general?.race || m.general?.ethnicity || m.race || m.ethnicity || '') as string;
      return {
        no: i + 1,
        fullName: m.general?.name || m.fullName || m.name || '',
        nationalId: m.general?.idNumber || m.nationalId || m.idNumber || '',
        age: dob ? calcAge(dob) : '',
        ethnicity: race,
        birthDate: dob,
        birthPlace: (m.general as any)?.birthPlace || m.birthPlace || '',
        occupation: m.business?.title || m.title || m.profession || m.departmentAndPosition || '',
        homeAddress: m.contact?.address || m.address || '',
        contactNumber: m.contact?.phone || m.phone || '',
        email: m.contact?.email || m.email || '',
      };
    });

    return {
      title: 'MYKD (ROY) Member Report',
      period: options.startDate && options.endDate
        ? `${options.startDate.toLocaleDateString()} - ${options.endDate.toLocaleDateString()}`
        : 'All Time',
      generatedAt: new Date(),
      data: { rows },
      rows,
    };
  }

  // Export MYKD rows to CSV
  static exportMykdToCSV(rows: MykdRow[]): string {
    const headers = MYKD_COLUMNS.map(c => c.label).join(',');
    const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const body = rows.map(r =>
      MYKD_COLUMNS.map(c => escape(r[c.key])).join(',')
    ).join('\n');
    return `${headers}\n${body}`;
  }

  // Export report to CSV
  static exportReportToCSV(reportData: ReportData): string {
    const lines: string[] = [];
    
    // Header
    lines.push(reportData.title);
    lines.push(`Period: ${reportData.period}`);
    lines.push(`Generated: ${reportData.generatedAt.toLocaleString()}`);
    lines.push('');

    // Summary
    if (reportData.summary) {
      lines.push('Summary');
      Object.entries(reportData.summary).forEach(([key, value]) => {
        lines.push(`${key},${value}`);
      });
      lines.push('');
    }

    // Data
    if (Array.isArray(reportData.data)) {
      if (reportData.data.length > 0) {
        const headers = Object.keys(reportData.data[0]);
        lines.push(headers.join(','));
        reportData.data.forEach((row: any) => {
          lines.push(headers.map(h => row[h] || '').join(','));
        });
      }
    } else {
      lines.push('Data');
      Object.entries(reportData.data).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          lines.push(`${key},${value.length} items`);
        } else {
          lines.push(`${key},${value}`);
        }
      });
    }

    return lines.join('\n');
  }

  // Export report to JSON
  static exportReportToJSON(reportData: ReportData): string {
    return JSON.stringify(reportData, null, 2);
  }

  // Helper methods
  private static calculateCategoryBreakdown(transactions: any[]): Record<string, { income: number; expenses: number }> {
    const breakdown: Record<string, { income: number; expenses: number }> = {};
    
    transactions.forEach(t => {
      if (!breakdown[t.category]) {
        breakdown[t.category] = { income: 0, expenses: 0 };
      }
      if (t.type === 'Income') {
        breakdown[t.category].income += t.amount;
      } else {
        breakdown[t.category].expenses += t.amount;
      }
    });

    return breakdown;
  }

  private static calculateRoleDistribution(members: any[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    members.forEach(m => {
      distribution[m.role] = (distribution[m.role] || 0) + 1;
    });
    return distribution;
  }

  private static calculateTierDistribution(members: any[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    members.forEach(m => {
      const tier = m.tier || 'Bronze';
      distribution[tier] = (distribution[tier] || 0) + 1;
    });
    return distribution;
  }

  private static calculateChurnRiskDistribution(members: any[]): Record<string, number> {
    const distribution: Record<string, number> = { High: 0, Medium: 0, Low: 0 };
    members.forEach(m => {
      const risk = m.churnRisk || 'Low';
      distribution[risk] = (distribution[risk] || 0) + 1;
    });
    return distribution;
  }

  private static calculateEventAttendanceRate(events: any[]): number {
    if (events.length === 0) return 0;
    const totalCapacity = events.reduce((sum, e) => sum + (e.capacity || 0), 0);
    const totalAttendees = events.reduce((sum, e) => sum + (e.attendees?.length || 0), 0);
    return totalCapacity > 0 ? Math.round((totalAttendees / totalCapacity) * 100) : 0;
  }

  private static calculateProjectParticipationRate(projects: any[], members: any[]): number {
    if (projects.length === 0) return 0;
    const totalTeamSize = projects.reduce((sum, p) => sum + (p.team?.length || 0), 0);
    return members.length > 0 ? Math.round((totalTeamSize / members.length) * 100) : 0;
  }

  private static calculateProjectStatusDistribution(projects: any[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    projects.forEach(p => {
      distribution[p.status] = (distribution[p.status] || 0) + 1;
    });
    return distribution;
  }

  // Generate inventory report
  static async generateInventoryReport(options: ReportOptions): Promise<ReportData> {
    if (isDevMode()) {
      return {
        title: 'Inventory Report',
        period: options.startDate && options.endDate 
          ? `${options.startDate.toLocaleDateString()} - ${options.endDate.toLocaleDateString()}`
          : 'All Time',
        generatedAt: new Date(),
        data: {
          totalItems: 50,
          availableItems: 30,
          checkedOutItems: 20,
        },
      };
    }

    try {
      const { InventoryService } = await import('./inventoryService');
      const items = await InventoryService.getAllItems();
      const itemsWithDepreciation = await InventoryService.getItemsWithDepreciation();

      const categoryDistribution: Record<string, number> = {};
      items.forEach(item => {
        categoryDistribution[item.category] = (categoryDistribution[item.category] || 0) + 1;
      });

      const statusDistribution: Record<string, number> = {};
      items.forEach(item => {
        statusDistribution[item.status] = (statusDistribution[item.status] || 0) + 1;
      });

      const totalValue = itemsWithDepreciation.reduce((sum, item) => sum + (item.calculatedValue || 0), 0);
      const totalDepreciation = itemsWithDepreciation.reduce((sum, item) => {
        const depreciationAmount = (item.purchasePrice || 0) - (item.calculatedValue || item.purchasePrice || 0);
        return sum + depreciationAmount;
      }, 0);

      return {
        title: 'Inventory Report',
        period: options.startDate && options.endDate 
          ? `${options.startDate.toLocaleDateString()} - ${options.endDate.toLocaleDateString()}`
          : 'All Time',
        generatedAt: new Date(),
        data: {
          items: itemsWithDepreciation,
          totalItems: items.length,
          availableItems: items.filter(i => i.status === 'Available').length,
          checkedOutItems: items.filter(i => i.status === 'Checked Out').length,
          lowStockItems: items.filter(i => i.status === 'Low Stock').length,
          categoryDistribution,
          statusDistribution,
          totalValue,
          totalDepreciation,
        },
        summary: {
          totalItems: items.length,
          availableItems: items.filter(i => i.status === 'Available').length,
          checkedOutItems: items.filter(i => i.status === 'Checked Out').length,
          totalValue,
          totalDepreciation,
        },
      };
    } catch (error) {
      console.error('Error generating inventory report:', error);
      throw error;
    }
  }

  // Convert report to CSV format
  static convertToCSV(reportData: ReportData): string {
    return this.exportReportToCSV(reportData);
  }
}

