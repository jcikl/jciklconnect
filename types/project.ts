export type ProjectStatus =
  | 'Draft' | 'Submitted' | 'Under Review' | 'Rejected'
  | 'Approved' | 'Planning' | 'Active' | 'Completed' | 'Review'
  | 'Upcoming' | 'Cancelled';

export type ProjectLevel = 'JCI' | 'National' | 'Area' | 'Local';
export type ProjectPillar = 'Individual' | 'Community' | 'Business' | 'International' | 'LOM' | 'Chapter';
export type ProjectType = 'program' | 'skill_development' | 'event' | 'project';
export type ProjectCategory = string;

export interface ProjectCommitteeTask {
  taskId?: string;
  title: string;
  dueDate?: string;
}

export interface ProjectCommitteeMember {
  role: string;
  memberId: string;
  tasks?: ProjectCommitteeTask[];
}

export interface ProjectTrainer {
  name: string;
  memberId?: string;
  role?: string;
  durationHours?: number;
}

export interface Project {
  id: string;
  status: ProjectStatus;
  title?: string;
  name?: string;
  description?: string;
  logoUrl?: string;
  roadmapUrl?: string;
  galleryUrls?: string[];
  lead?: string;
  organizerId?: string | null;
  level?: ProjectLevel;
  pillar?: ProjectPillar;
  category?: ProjectCategory;
  type?: ProjectType;
  date?: string;
  startDate?: string;
  endDate?: string;
  time?: string;
  proposedDate?: string;
  eventStartDate?: string;
  eventEndDate?: string;
  eventStartTime?: string;
  eventEndTime?: string;
  budget?: number;
  spent?: number;
  proposedBudget?: number;
  priceMin?: number;
  priceMax?: number;
  completion?: number;
  teamSize?: number;
  team?: string[];
  financialAccountId?: string;
  objectives?: string;
  expectedImpact?: string;
  targetAudience?: string;
  resources?: string[];
  timeline?: string;
  submittedBy?: string;
  submittedDate?: string;
  reviewedBy?: string;
  reviewedDate?: string;
  reviewComments?: string;
  version?: number;
  previousVersionId?: string;
  attachments?: string[];
  attendees?: number;
  maxAttendees?: number;
  location?: string;
  predictedDemand?: 'Low' | 'Medium' | 'High';
  registeredMembers?: string[];
  committee?: ProjectCommitteeMember[];
  trainers?: ProjectTrainer[];
  createdAt?: string;
  updatedAt?: string;
}

export interface FlagshipProject {
  id: string;
  title: string;
  description: string;
  logoUrl?: string;
  galleryUrls?: string[];
  status: 'Active' | 'Inactive';
  teamSize?: number;
  completion?: number;
  startDate?: string;
  endDate?: string;
  level?: string;
  pillar?: string;
  unsdg?: string[];
  galleryByYear?: { [folder: string]: string[] };
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectFinancialAccount {
  id: string;
  projectId: string;
  projectName: string;
  budget: number;
  startingBalance: number;
  currentBalance: number;
  totalIncome: number;
  totalExpenses: number;
  budgetCategories: BudgetCategory[];
  alertThresholds: AlertThreshold[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface BudgetCategory {
  id: string;
  name: string;
  allocatedAmount: number;
  spentAmount: number;
  description?: string;
  color?: string;
}

export interface AlertThreshold {
  id: string;
  type: 'budget_warning' | 'budget_exceeded' | 'category_warning';
  threshold: number;
  enabled: boolean;
  notificationMethod: 'email' | 'in_app' | 'both';
}

export interface ProjectTransaction {
  id: string;
  projectId: string;
  financialAccountId: string;
  type: 'income' | 'expense';
  amount: number;
  categoryId?: string;
  description: string;
  purpose?: string;
  date: string;
  createdBy: string;
  createdAt: string;
  receiptUrl?: string;
  approvedBy?: string;
  approvedAt?: string;
  tags?: string[];
  status?: string;
}

export interface ProjectFinancialSummary {
  projectId: string;
  budgetUtilization: number;
  remainingFunds: number;
  totalAllocated: number;
  totalSpent: number;
  categoryBreakdown: CategorySpending[];
  monthlySpending: MonthlySpending[];
  alerts: ProjectFinancialAlert[];
}

export interface CategorySpending {
  categoryId: string;
  categoryName: string;
  allocated: number;
  spent: number;
  remaining: number;
  utilizationPercentage: number;
}

export interface MonthlySpending {
  month: string;
  income: number;
  expenses: number;
  netFlow: number;
}

export interface ProjectFinancialAlert {
  id: string;
  type: 'budget_warning' | 'budget_exceeded' | 'category_warning' | 'low_funds';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  threshold?: number;
  currentValue?: number;
  categoryId?: string;
  createdAt: string;
  acknowledged?: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface Task {
  id: string;
  projectId: string;
  projectTitle?: string;
  role?: string;
  committeeMemberId?: string;
  committeeName?: string;
  title: string;
  status: 'Todo' | 'In Progress' | 'Done';
  priority: 'High' | 'Medium' | 'Low';
  dueDate: string;
  startDate?: string;
  duration?: number;
  assignee: string;
  dependencies?: string[];
  progress?: number;
  remarks?: Record<string, { content: string; timestamp: string }>;
  statusHistory?: Record<string, { status: string; timestamp: string }>;
}

export interface GanttTask {
  id: string;
  projectId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  progress: number;
  dependencies: string[];
  assignees: string[];
  status: 'not_started' | 'in_progress' | 'completed' | 'overdue';
  priority?: 'High' | 'Medium' | 'Low';
  type?: 'task' | 'milestone' | 'project';
  styles?: {
    backgroundColor?: string;
    backgroundSelectedColor?: string;
    progressColor?: string;
    progressSelectedColor?: string;
  };
}
