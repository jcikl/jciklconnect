// Project Report Service - Generates automated project reports
import { Project, Task, Member } from '../types';
import { ProjectsService } from './projectsService';
import { MembersService } from './membersService';
import { EventsService } from './eventsService';
import { projectFinancialService } from './projectFinancialService';
import { isDevMode } from '../utils/devMode';
import { formatDate } from '../utils/dateUtils';
import { formatCurrency } from '../utils/formatUtils';

export interface ProjectReport {
  projectId: string;
  projectName: string;
  reportType: 'status' | 'progress' | 'financial' | 'comprehensive';
  generatedAt: string;
  period: {
    start: string;
    end: string;
  };
  executiveSummary: {
    status: string;
    completionPercentage: number;
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    pendingTasks: number;
    budgetStatus?: {
      allocated: number;
      spent: number;
      remaining: number;
      utilizationPercentage: number;
    };
  };
  teamPerformance: {
    totalMembers: number;
    activeMembers: number;
    memberContributions: Array<{
      memberId: string;
      memberName: string;
      tasksCompleted: number;
      tasksInProgress: number;
      contributionPercentage: number;
    }>;
  };
  timeline: {
    startDate: string;
    expectedEndDate?: string;
    actualProgress: number;
    milestones: Array<{
      name: string;
      targetDate: string;
      status: 'completed' | 'pending' | 'overdue';
    }>;
    upcomingDeadlines: Array<{
      taskId: string;
      taskName: string;
      dueDate: string;
      assignee?: string;
      priority: string;
    }>;
  };
  financialSummary?: {
    budget: number;
    totalIncome: number;
    totalExpenses: number;
    currentBalance: number;
    budgetUtilization: number;
    categoryBreakdown: Array<{
      categoryName: string;
      allocated: number;
      spent: number;
      remaining: number;
      utilizationPercentage: number;
    }>;
    varianceAnalysis: {
      budgetVariance: number;
      categoryVariances: Array<{
        categoryName: string;
        budgetedAmount: number;
        actualAmount: number;
        variance: number;
        variancePercentage: number;
      }>;
    };
  };
  risksAndIssues: Array<{
    type: 'risk' | 'issue';
    description: string;
    severity: 'low' | 'medium' | 'high';
    mitigation?: string;
  }>;
  recommendations: string[];
  nextSteps: string[];
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  reportType: 'status' | 'progress' | 'financial' | 'comprehensive';
  sections: Array<{
    id: string;
    name: string;
    type: 'text' | 'chart' | 'table' | 'summary';
    enabled: boolean;
    configuration: Record<string, any>;
  }>;
  formatting: {
    includeCharts: boolean;
    includeFinancials: boolean;
    includeTeamDetails: boolean;
    includeRisks: boolean;
  };
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface ReportExportOptions {
  format: 'pdf' | 'excel' | 'json' | 'text';
  templateId?: string;
  includeCharts?: boolean;
  customSections?: string[];
}

export class ProjectReportService {
  private static templates: Map<string, ReportTemplate> = new Map();

  // Generate project report with specified type
  static async generateReport(
    projectId: string, 
    reportType: 'status' | 'progress' | 'financial' | 'comprehensive' = 'comprehensive'
  ): Promise<ProjectReport> {
    if (isDevMode()) {
      return this.getMockReport(projectId);
    }

    try {
      const project = await ProjectsService.getProjectById(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Get project tasks
      const tasks = await ProjectsService.getProjectTasks(projectId);

      // Calculate task statistics
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === 'Done').length;
      const inProgressTasks = tasks.filter(t => t.status === 'In Progress').length;
      const pendingTasks = tasks.filter(t => t.status === 'Todo').length;
      const completionPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

      // Get team members
      const teamMemberIds = project.team || [];
      const teamMembers = await Promise.all(
        teamMemberIds.map(id => MembersService.getMemberById(id))
      );
      const activeTeamMembers = teamMembers.filter(Boolean) as Member[];

      // Calculate member contributions
      const memberContributions = activeTeamMembers.map(member => {
        const memberTasks = tasks.filter(t => t.assignee === member.id || t.assignee === member.name);
        const completed = memberTasks.filter(t => t.status === 'Done').length;
        const inProgress = memberTasks.filter(t => t.status === 'In Progress').length;
        const contributionPercentage = totalTasks > 0 ? (memberTasks.length / totalTasks) * 100 : 0;

        return {
          memberId: member.id,
          memberName: member.name,
          tasksCompleted: completed,
          tasksInProgress: inProgress,
          contributionPercentage: Math.round(contributionPercentage * 10) / 10,
        };
      });

      // Get upcoming deadlines
      const upcomingDeadlines = tasks
        .filter(t => t.dueDate && t.status !== 'Done')
        .map(t => ({
          taskId: t.id,
          taskName: t.title,
          dueDate: t.dueDate!,
          assignee: activeTeamMembers.find(m => m.id === t.assignee || m.name === t.assignee)?.name,
          priority: t.priority || 'Medium',
        }))
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        .slice(0, 10);

      // Get financial data if requested
      let financialSummary;
      if (reportType === 'financial' || reportType === 'comprehensive') {
        try {
          const financialAccount = await projectFinancialService.getProjectFinancialAccount(projectId);
          if (financialAccount) {
            const summary = await projectFinancialService.getProjectFinancialSummary(projectId);
            const reportData = await projectFinancialService.generateProjectFinancialReport(projectId);
            
            if (summary && reportData) {
              financialSummary = {
                budget: financialAccount.budget,
                totalIncome: financialAccount.totalIncome,
                totalExpenses: financialAccount.totalExpenses,
                currentBalance: financialAccount.currentBalance,
                budgetUtilization: summary.budgetUtilization,
                categoryBreakdown: summary.categoryBreakdown,
                varianceAnalysis: reportData.varianceAnalysis,
              };
            }
          }
        } catch (error) {
          console.warn('Could not load financial data for project report:', error);
        }
      }

      // Identify risks and issues
      const risksAndIssues: ProjectReport['risksAndIssues'] = [];

      // Overdue tasks
      const now = new Date();
      const overdueTasks = tasks.filter(t => {
        if (!t.dueDate || t.status === 'Done') return false;
        return new Date(t.dueDate) < now;
      });

      if (overdueTasks.length > 0) {
        risksAndIssues.push({
          type: 'issue',
          description: `${overdueTasks.length} task(s) are overdue`,
          severity: overdueTasks.length > 3 ? 'high' : 'medium',
          mitigation: 'Review task priorities and reassign resources if needed',
        });
      }

      // Low completion rate
      if (completionPercentage < 30 && totalTasks > 5) {
        risksAndIssues.push({
          type: 'risk',
          description: 'Project completion rate is below 30%',
          severity: 'medium',
          mitigation: 'Review project timeline and resource allocation',
        });
      }

      // Team size issues
      if (activeTeamMembers.length < 2 && totalTasks > 10) {
        risksAndIssues.push({
          type: 'risk',
          description: 'Limited team size may impact project delivery',
          severity: 'medium',
          mitigation: 'Consider adding more team members or adjusting scope',
        });
      }

      // Generate recommendations
      const recommendations: string[] = [];
      if (completionPercentage < 50) {
        recommendations.push('Focus on completing pending tasks to improve project momentum');
      }
      if (inProgressTasks > completedTasks) {
        recommendations.push('Review in-progress tasks to ensure timely completion');
      }
      if (memberContributions.some(m => m.contributionPercentage > 50)) {
        recommendations.push('Distribute workload more evenly across team members');
      }
      if (overdueTasks.length > 0) {
        recommendations.push('Address overdue tasks immediately to prevent project delays');
      }

      // Next steps
      const nextSteps: string[] = [];
      const nextPendingTasks = tasks
        .filter(t => t.status === 'Todo')
        .sort((a, b) => {
          const priorityOrder = { High: 3, Medium: 2, Low: 1 };
          return (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) -
                 (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);
        })
        .slice(0, 3);

      nextPendingTasks.forEach(task => {
        nextSteps.push(`Complete task: ${task.title} (Priority: ${task.priority})`);
      });

      if (nextSteps.length === 0 && inProgressTasks > 0) {
        nextSteps.push('Focus on completing in-progress tasks');
      }

      return {
        projectId: project.id,
        projectName: project.name,
        reportType,
        generatedAt: new Date().toISOString(),
        period: {
          start: (project as any).startDate || new Date().toISOString(),
          end: (project as any).endDate || new Date().toISOString(),
        },
        executiveSummary: {
          status: project.status,
          completionPercentage: Math.round(completionPercentage * 10) / 10,
          totalTasks,
          completedTasks,
          inProgressTasks,
          pendingTasks,
          budgetStatus: financialSummary ? {
            allocated: financialSummary.budget,
            spent: financialSummary.totalExpenses,
            remaining: financialSummary.currentBalance,
            utilizationPercentage: financialSummary.budgetUtilization,
          } : undefined,
        },
        teamPerformance: {
          totalMembers: activeTeamMembers.length,
          activeMembers: activeTeamMembers.filter(m => {
            const memberTasks = tasks.filter(t => t.assignee === m.id || t.assignee === m.name);
            return memberTasks.some(t => t.status !== 'Done');
          }).length,
          memberContributions,
        },
        timeline: {
          startDate: (project as any).startDate || new Date().toISOString(),
          expectedEndDate: (project as any).endDate,
          actualProgress: completionPercentage,
          milestones: [], // Would need milestone data from project
          upcomingDeadlines,
        },
        financialSummary,
        risksAndIssues,
        recommendations,
        nextSteps,
      };
    } catch (error) {
      console.error('Error generating project report:', error);
      throw error;
    }
  }

  // Export report as JSON
  static async exportReportAsJSON(projectId: string): Promise<string> {
    const report = await this.generateReport(projectId);
    return JSON.stringify(report, null, 2);
  }

  // Export report as formatted text
  static async exportReportAsText(projectId: string): Promise<string> {
    const report = await this.generateReport(projectId);
    
    let text = `PROJECT REPORT: ${report.projectName}\n`;
    text += `Generated: ${formatDate(new Date(report.generatedAt))}\n`;
    text += `Period: ${formatDate(new Date(report.period.start))} - ${formatDate(new Date(report.period.end))}\n\n`;
    
    text += `EXECUTIVE SUMMARY\n`;
    text += `Status: ${report.executiveSummary.status}\n`;
    text += `Completion: ${report.executiveSummary.completionPercentage}%\n`;
    text += `Tasks: ${report.executiveSummary.completedTasks}/${report.executiveSummary.totalTasks} completed\n\n`;
    
    text += `TEAM PERFORMANCE\n`;
    text += `Total Members: ${report.teamPerformance.totalMembers}\n`;
    text += `Active Members: ${report.teamPerformance.activeMembers}\n\n`;
    
    if (report.risksAndIssues.length > 0) {
      text += `RISKS AND ISSUES\n`;
      report.risksAndIssues.forEach(risk => {
        text += `- [${risk.severity.toUpperCase()}] ${risk.description}\n`;
        if (risk.mitigation) {
          text += `  Mitigation: ${risk.mitigation}\n`;
        }
      });
      text += `\n`;
    }
    
    if (report.recommendations.length > 0) {
      text += `RECOMMENDATIONS\n`;
      report.recommendations.forEach(rec => {
        text += `- ${rec}\n`;
      });
      text += `\n`;
    }
    
    if (report.nextSteps.length > 0) {
      text += `NEXT STEPS\n`;
      report.nextSteps.forEach(step => {
        text += `- ${step}\n`;
      });
    }
    
    return text;
  }

  // Generate status report (Requirements 7.1)
  static async generateStatusReport(projectId: string): Promise<ProjectReport> {
    return this.generateReport(projectId, 'status');
  }

  // Generate progress report (Requirements 7.2)
  static async generateProgressReport(projectId: string): Promise<ProjectReport> {
    return this.generateReport(projectId, 'progress');
  }

  // Generate financial report (Requirements 7.3)
  static async generateFinancialReport(projectId: string): Promise<ProjectReport> {
    return this.generateReport(projectId, 'financial');
  }

  // Create report template (Requirements 7.4)
  static async createReportTemplate(
    templateData: Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>,
    createdBy: string
  ): Promise<ReportTemplate> {
    const template: ReportTemplate = {
      ...templateData,
      id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy,
    };

    this.templates.set(template.id, template);
    return template;
  }

  // Get report template
  static async getReportTemplate(templateId: string): Promise<ReportTemplate | null> {
    return this.templates.get(templateId) || null;
  }

  // List all report templates
  static async listReportTemplates(): Promise<ReportTemplate[]> {
    return Array.from(this.templates.values());
  }

  // Update report template
  static async updateReportTemplate(
    templateId: string,
    updates: Partial<Omit<ReportTemplate, 'id' | 'createdAt' | 'createdBy'>>
  ): Promise<ReportTemplate> {
    const existing = this.templates.get(templateId);
    if (!existing) {
      throw new Error('Template not found');
    }

    const updated: ReportTemplate = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.templates.set(templateId, updated);
    return updated;
  }

  // Delete report template
  static async deleteReportTemplate(templateId: string): Promise<boolean> {
    return this.templates.delete(templateId);
  }

  // Export report with options (Requirements 7.5)
  static async exportReport(
    projectId: string,
    options: ReportExportOptions
  ): Promise<{ data: string | Buffer; filename: string; mimeType: string }> {
    const reportType = options.templateId ? 
      (await this.getReportTemplate(options.templateId))?.reportType || 'comprehensive' :
      'comprehensive';
    
    const report = await this.generateReport(projectId, reportType);

    switch (options.format) {
      case 'pdf':
        return this.exportToPDF(report, options);
      case 'excel':
        return this.exportToExcel(report, options);
      case 'json':
        return this.exportToJSON(report);
      case 'text':
        return this.exportToText(report);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  // Export to PDF
  private static async exportToPDF(
    report: ProjectReport,
    options: ReportExportOptions
  ): Promise<{ data: Buffer; filename: string; mimeType: string }> {
    // In a real implementation, this would use a PDF library like jsPDF or Puppeteer
    // For now, we'll create a simple text-based PDF representation
    const textContent = await this.exportReportAsText(report.projectId);
    const pdfBuffer = Buffer.from(textContent, 'utf-8'); // Simplified - would be actual PDF

    return {
      data: pdfBuffer,
      filename: `${report.projectName}_${report.reportType}_report_${new Date().toISOString().split('T')[0]}.pdf`,
      mimeType: 'application/pdf',
    };
  }

  // Export to Excel
  private static async exportToExcel(
    report: ProjectReport,
    options: ReportExportOptions
  ): Promise<{ data: Buffer; filename: string; mimeType: string }> {
    // In a real implementation, this would use a library like xlsx
    // For now, we'll create a CSV representation
    let csvContent = `Project Report: ${report.projectName}\n`;
    csvContent += `Generated: ${report.generatedAt}\n`;
    csvContent += `Type: ${report.reportType}\n\n`;
    
    csvContent += `Executive Summary\n`;
    csvContent += `Status,${report.executiveSummary.status}\n`;
    csvContent += `Completion %,${report.executiveSummary.completionPercentage}\n`;
    csvContent += `Total Tasks,${report.executiveSummary.totalTasks}\n`;
    csvContent += `Completed Tasks,${report.executiveSummary.completedTasks}\n\n`;
    
    if (report.financialSummary) {
      csvContent += `Financial Summary\n`;
      csvContent += `Budget,${report.financialSummary.budget}\n`;
      csvContent += `Expenses,${report.financialSummary.totalExpenses}\n`;
      csvContent += `Balance,${report.financialSummary.currentBalance}\n`;
      csvContent += `Utilization %,${report.financialSummary.budgetUtilization}\n\n`;
    }

    const excelBuffer = Buffer.from(csvContent, 'utf-8'); // Simplified - would be actual Excel

    return {
      data: excelBuffer,
      filename: `${report.projectName}_${report.reportType}_report_${new Date().toISOString().split('T')[0]}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  // Export to JSON
  private static async exportToJSON(
    report: ProjectReport
  ): Promise<{ data: string; filename: string; mimeType: string }> {
    return {
      data: JSON.stringify(report, null, 2),
      filename: `${report.projectName}_${report.reportType}_report_${new Date().toISOString().split('T')[0]}.json`,
      mimeType: 'application/json',
    };
  }

  // Export to Text
  private static async exportToText(
    report: ProjectReport
  ): Promise<{ data: string; filename: string; mimeType: string }> {
    const textContent = await this.exportReportAsText(report.projectId);
    return {
      data: textContent,
      filename: `${report.projectName}_${report.reportType}_report_${new Date().toISOString().split('T')[0]}.txt`,
      mimeType: 'text/plain',
    };
  }

  // Initialize default templates
  static async initializeDefaultTemplates(): Promise<void> {
    const defaultTemplates: Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>[] = [
      {
        name: 'Executive Summary',
        description: 'High-level project overview for executives',
        reportType: 'status',
        sections: [
          { id: 'summary', name: 'Executive Summary', type: 'summary', enabled: true, configuration: {} },
          { id: 'status', name: 'Project Status', type: 'chart', enabled: true, configuration: { chartType: 'progress' } },
          { id: 'risks', name: 'Key Risks', type: 'table', enabled: true, configuration: {} },
        ],
        formatting: {
          includeCharts: true,
          includeFinancials: false,
          includeTeamDetails: false,
          includeRisks: true,
        },
      },
      {
        name: 'Detailed Progress Report',
        description: 'Comprehensive progress tracking for project managers',
        reportType: 'progress',
        sections: [
          { id: 'summary', name: 'Executive Summary', type: 'summary', enabled: true, configuration: {} },
          { id: 'timeline', name: 'Timeline & Milestones', type: 'chart', enabled: true, configuration: { chartType: 'timeline' } },
          { id: 'tasks', name: 'Task Details', type: 'table', enabled: true, configuration: {} },
          { id: 'team', name: 'Team Performance', type: 'chart', enabled: true, configuration: { chartType: 'team' } },
        ],
        formatting: {
          includeCharts: true,
          includeFinancials: false,
          includeTeamDetails: true,
          includeRisks: true,
        },
      },
      {
        name: 'Financial Analysis',
        description: 'Budget and financial performance analysis',
        reportType: 'financial',
        sections: [
          { id: 'financial', name: 'Financial Summary', type: 'summary', enabled: true, configuration: {} },
          { id: 'budget', name: 'Budget Analysis', type: 'chart', enabled: true, configuration: { chartType: 'budget' } },
          { id: 'variance', name: 'Variance Analysis', type: 'table', enabled: true, configuration: {} },
        ],
        formatting: {
          includeCharts: true,
          includeFinancials: true,
          includeTeamDetails: false,
          includeRisks: false,
        },
      },
    ];

    for (const template of defaultTemplates) {
      await this.createReportTemplate(template, 'system');
    }
  }

  // Mock report for dev mode
  private static getMockReport(projectId: string): ProjectReport {
    return {
      projectId,
      projectName: 'Sample Project',
      reportType: 'comprehensive',
      generatedAt: new Date().toISOString(),
      period: {
        start: new Date().toISOString(),
        end: new Date().toISOString(),
      },
      executiveSummary: {
        status: 'Active',
        completionPercentage: 65,
        totalTasks: 20,
        completedTasks: 13,
        inProgressTasks: 5,
        pendingTasks: 2,
        budgetStatus: {
          allocated: 10000,
          spent: 6500,
          remaining: 3500,
          utilizationPercentage: 65,
        },
      },
      teamPerformance: {
        totalMembers: 5,
        activeMembers: 4,
        memberContributions: [
          {
            memberId: 'member1',
            memberName: 'John Doe',
            tasksCompleted: 5,
            tasksInProgress: 2,
            contributionPercentage: 35,
          },
          {
            memberId: 'member2',
            memberName: 'Jane Smith',
            tasksCompleted: 4,
            tasksInProgress: 1,
            contributionPercentage: 25,
          },
        ],
      },
      timeline: {
        startDate: new Date().toISOString(),
        actualProgress: 65,
        milestones: [
          {
            name: 'Phase 1 Complete',
            targetDate: new Date().toISOString(),
            status: 'completed',
          },
          {
            name: 'Phase 2 Complete',
            targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'pending',
          },
        ],
        upcomingDeadlines: [
          {
            taskId: 'task1',
            taskName: 'Complete documentation',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            assignee: 'John Doe',
            priority: 'High',
          },
        ],
      },
      financialSummary: {
        budget: 10000,
        totalIncome: 2000,
        totalExpenses: 6500,
        currentBalance: 5500,
        budgetUtilization: 65,
        categoryBreakdown: [
          {
            categoryName: 'Development',
            allocated: 5000,
            spent: 3500,
            remaining: 1500,
            utilizationPercentage: 70,
          },
          {
            categoryName: 'Marketing',
            allocated: 3000,
            spent: 2000,
            remaining: 1000,
            utilizationPercentage: 67,
          },
        ],
        varianceAnalysis: {
          budgetVariance: 3500,
          categoryVariances: [
            {
              categoryName: 'Development',
              budgetedAmount: 5000,
              actualAmount: 3500,
              variance: 1500,
              variancePercentage: 30,
            },
          ],
        },
      },
      risksAndIssues: [
        {
          type: 'risk',
          description: 'Potential delay in Phase 2',
          severity: 'medium',
          mitigation: 'Add additional resources',
        },
      ],
      recommendations: ['Continue current progress', 'Focus on pending tasks'],
      nextSteps: ['Complete in-progress tasks', 'Review project timeline'],
    };
  }
}

