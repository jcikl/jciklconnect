// types.ts

export enum UserRole {
  GUEST = 'GUEST',
  PROBATION_MEMBER = 'PROBATION_MEMBER',
  MEMBER = 'MEMBER',
  BOARD = 'BOARD',
  ADMIN = 'ADMIN',
  /** 组织秘书：主档维护与宣导 */
  ORGANIZATION_SECRETARY = 'ORGANIZATION_SECRETARY',
  /** 组织财政长：组织级财务与对账 */
  ORGANIZATION_FINANCE = 'ORGANIZATION_FINANCE',
  /** 活动财政：仅本活动相关财务与数据 */
  ACTIVITY_FINANCE = 'ACTIVITY_FINANCE'
}

export enum MemberTier {
  BRONZE = 'Bronze',
  SILVER = 'Silver',
  GOLD = 'Gold',
  PLATINUM = 'Platinum'
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  earnedDate?: string;
}

// Enhanced Badge System Types (from design document)
export interface BadgeCriteria {
  type: 'event_attendance' | 'project_completion' | 'points_threshold' | 'custom';
  threshold: number;
  conditions: Record<string, any>;
}

export interface BadgeAward {
  id: string;
  badgeId: string;
  memberId: string;
  awardedAt: Date;
  awardedBy?: string; // for manual awards
}

export interface Achievement {
  id?: string;
  name: string;
  description: string;
  icon: string; // Icon name or emoji
  category: 'Event' | 'Project' | 'Leadership' | 'Training' | 'Recruitment' | 'Social' | 'Milestone' | 'Special';
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  pointsReward: number;
  criteria: AchievementCriteria;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  // Enhanced with milestones from design document
  milestones?: AchievementMilestone[];
}

export interface AchievementMilestone {
  level: string; // e.g., "Bronze", "Silver", "Gold"
  threshold: number;
  pointValue: number;
  reward?: string;
}

export interface MemberAchievementProgress {
  memberId: string;
  achievementId: string;
  currentProgress: number;
  completedMilestones: string[];
  lastUpdated: Date;
}

export interface AchievementCriteria {
  type: 'points_threshold' | 'event_count' | 'project_count' | 'consecutive_attendance' | 'role_held' | 'training_completed' | 'recruitment_count' | 'custom';
  value: number; // Threshold value
  timeframe?: 'lifetime' | 'monthly' | 'quarterly' | 'yearly'; // For time-based achievements
  conditions?: Record<string, any>; // Additional conditions
  description?: string; // Optional description of the criteria
}

export interface AchievementAward {
  id?: string;
  achievementId: string;
  memberId: string;
  earnedAt: string;
  progress?: number; // Progress percentage (0-100) if achievement is in progress
  metadata?: Record<string, any>; // Additional data about the award
}

// Points Rule Configuration Types
export interface PointsRule {
  id: string;
  name: string;
  description?: string;
  trigger: 'event_attendance' | 'task_completion' | 'project_completion' | 'training_completion' | 'recruitment' | 'custom';
  conditions: PointsRuleCondition[];
  pointValue: number;
  multiplier: number;
  weight: number;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface PointsRuleCondition {
  id: string;
  field: string; // e.g., "member.role", "event.type", "project.status"
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains' | 'in' | 'not_in';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export interface PointsRuleExecution {
  id: string;
  ruleId: string;
  ruleName: string;
  memberId: string;
  trigger: string;
  triggerData: Record<string, any>;
  pointsAwarded: number;
  calculation: PointsCalculationBreakdown;
  executedAt: string;
}

export interface PointsCalculationBreakdown {
  basePoints: number;
  multiplier: number;
  weight: number;
  finalPoints: number;
  appliedRules: Array<{
    ruleId: string;
    ruleName: string;
    points: number;
    weight: number;
  }>;
}

export interface PointsRuleTestResult {
  ruleId: string;
  ruleName: string;
  testData: Record<string, any>;
  conditionResults: Array<{
    conditionId: string;
    field: string;
    operator: string;
    expectedValue: any;
    actualValue: any;
    passed: boolean;
  }>;
  pointsAwarded: number;
  calculation: PointsCalculationBreakdown;
  passed: boolean;
  errors?: string[];
}

export interface PointsRuleAnalytics {
  ruleId: string;
  ruleName: string;
  executionCount: number;
  totalPointsAwarded: number;
  averagePointsPerExecution: number;
  lastExecuted?: string;
  topTriggers: Array<{
    trigger: string;
    count: number;
  }>;
}

export interface CareerMilestone {
  year: string;
  role: string;
  description: string;
}

export interface BoardPosition {
  year: number;
  position: string; // e.g., 'President', 'VP Growth', 'Secretary'
  startDate: string;
  endDate: string;
}

export interface BoardMember {
  id: string;
  memberId: string;
  position: string;
  term: string; // e.g., "2024"
  startDate: string;
  endDate?: string;
  isActive: boolean;
  permissions: string[];
  commissionDirectorIds?: string[]; // IDs of members serving as Commission Directors under this position
  createdAt: string;
  updatedAt: string;
}

export interface BoardTransition {
  id: string;
  year: string;
  outgoingBoard: BoardMember[];
  incomingBoard: BoardMember[];
  transitionDate: string;
  completedBy: string;
  status: 'draft' | 'in_progress' | 'completed';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MentorMatch {
  id: string;
  mentorId: string;
  menteeId: string;
  compatibilityScore: number;
  matchingFactors: string[];
  status: 'suggested' | 'approved' | 'active' | 'completed';
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

/** 主档带出时使用的约定字段（与 config/常量一致，用于选会员即带出） */
export const MEMBER_LOOKUP_FIELDS = ['name', 'email', 'phone', 'fullName', 'currentBoardYear', 'loId'] as const;

export interface Member {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** 多 LO 租户；新数据必填，MVP 单 LO 时仍写入当前 LO id；历史数据可为空 */
  loId?: string;
  /** 活动财政负责的活动 ID，仅 ACTIVITY_FINANCE 角色使用；规则按此过滤付款申请 */
  activityFinanceActivityId?: string | null;
  /** 分区（可选），多 LO 扩展时使用 */
  areaId?: string | null;
  /** 国家（可选），多 LO 扩展时使用 */
  countryId?: string | null;
  tier: MemberTier;
  points: number;
  joinDate: string;
  avatar: string;
  skills: string[];
  churnRisk: 'Low' | 'Medium' | 'High';
  attendanceRate: number;
  duesStatus: 'Paid' | 'Pending' | 'Overdue';
  badges: Badge[];
  // Membership type and dues information
  membershipType?: MembershipType;
  introducer?: string; // Name of the person who introduced the member
  duesYear?: number; // Current dues year paid
  duesPaidDate?: string; // Date when current year dues were paid
  senatorCertified?: boolean; // For senator membership type
  age?: number; // For honorary member validation
  // New fields for Deep Profiling
  bio?: string;
  phone?: string;
  profession?: string; // Professional career/job title
  careerHistory?: CareerMilestone[];
  mentorId?: string; // ID of their mentor
  menteeIds?: string[]; // IDs of members they mentor
  // Board management fields
  boardHistory?: BoardPosition[]; // Historical board positions
  currentBoardYear?: number; // Current board year (if on board)
  currentBoardPosition?: string; // Current board position
  // Leaderboard visibility
  leaderboardVisibility?: 'public' | 'members_only' | 'private';
  lastLogin?: string; // Last login date

  // Probation member fields
  probationTasks?: ProbationTask[]; // Tasks required for probation members
  probationApprovedBy?: string; // Member ID who approved the probation
  probationApprovedAt?: string; // Date when approved to probation
  probationCompletedAt?: string; // Date when probation tasks were completed

  // 1. 基本信息 (Basic Information)
  fullName?: string; // 身份证全名
  idNumber?: string; // 身份证(或护照)
  gender?: 'Male' | 'Female'; // 性别
  ethnicity?: 'Chinese' | 'Malay' | 'Indian' | 'Others'; // 种族
  nationality?: string; // 国籍 (default: Malaysia)
  dateOfBirth?: string; // 出生日期
  hobbies?: string[]; // 兴趣爱好

  // 2. 职业与商业信息 (Professional & Business Information)
  companyName?: string; // 公司名字
  companyWebsite?: string; // 公司网站
  companyDescription?: string; // 公司介绍
  departmentAndPosition?: string; // 部门与职位
  acceptInternationalBusiness?: 'Yes' | 'No' | 'Willing to Explore'; // 接受国际业务
  businessCategory?: string[]; // 商业类别 (允许多选)
  industry?: string; // 所属行业
  interestedIndustries?: string[]; // 感兴趣行业
  specialOffer?: string; // Special offer for members
  companyLogoUrl?: string; // URL for company logo
  internationalConnections?: InternationalConnection[]; // Global JCI connections

  // 3. 联系信息 (Contact Information)
  // 3.1 个人联系方式
  alternatePhone?: string; // 备用电话
  whatsappGroup?: string; // WhatsApp群组
  address?: string; // 地址
  // 3.2 社交媒体
  linkedin?: string; // LinkedIn
  facebook?: string; // Facebook
  instagram?: string; // Instagram
  wechat?: string; // 微信
  // 3.3 紧急联络人
  emergencyContactName?: string; // 紧急联络人姓名
  emergencyContactPhone?: string; // 紧急联络人电话
  emergencyContactRelationship?: string; // 紧急联络人关系

  // 4. 服装与物品 (Apparel & Items)
  cutStyle?: 'Unisex' | 'Lady Cut'; // 裁剪/版型
  tshirtSize?: 'XS' | 'S' | 'M' | 'L' | 'XL' | '2XL' | '3XL' | '5XL' | '7XL'; // T恤尺寸
  jacketSize?: 'XS' | 'S' | 'M' | 'L' | 'XL' | '2XL' | '3XL' | '5XL' | '7XL'; // 夹克尺寸
  embroideredName?: string; // 刺绣名称
  tshirtStatus?: 'NA' | 'Requested' | 'Sent' | 'Delivered' | 'Received'; // T恤领取状态

  // 5. 准会员调查 (Join Us Survey)
  surveyAnswers?: Record<string, string>; // Q1-Q5 answers
  personaType?: string; // Learning-oriented, Practical-oriented, etc.
  tendencyTags?: string[]; // Directional, Category, and Activity tags
}

export interface BusinessProfile {
  id: string;
  memberId: string;
  companyName: string;
  industry: string;
  description: string;
  website: string;
  offer: string; // Special offer for JCI members
  logo: string;
  internationalConnections?: InternationalConnection[];
  globalNetworkEnabled?: boolean;
  jciChapters?: string[]; // JCI chapters this business is connected with
}

export interface InternationalConnection {
  id?: string;
  jciChapter: string;
  country: string;
  connectionType: 'Business Partnership' | 'Networking' | 'Collaboration' | 'Referral';
  contactPerson?: string;
  contactEmail?: string;
  establishedDate?: string;
  notes?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: 'Electronics' | 'Furniture' | 'Merchandise' | 'Stationery' | 'Equipment' | 'Supplies' | 'Other';
  quantity: number;
  location: string;
  status: 'Available' | 'Low Stock' | 'Out of Stock' | 'Checked Out';
  lastAudit?: string;
  custodian?: string;
  condition?: string;
  description?: string;
  lastCheckedOut?: string;
  expectedReturnDate?: string;
  checkedOutTo?: string; // Member ID who checked out the item
  checkedOutDate?: string; // Date when item was checked out
  returnedDate?: string; // Date when item was returned
  minQuantity?: number; // Minimum stock threshold for alerts
  maintenanceSchedule?: MaintenanceSchedule;
  lastSaleDate?: string; // Last sale date for tracking
  // Depreciation tracking
  purchaseDate?: string;
  purchasePrice?: number;
  depreciationMethod?: 'Straight Line' | 'Declining Balance' | 'Units of Production' | 'None';
  depreciationRate?: number; // Percentage per year
  currentValue?: number; // Calculated based on depreciation
  usefulLife?: number; // Years
  lastDepreciationUpdate?: string; // Last time depreciation was calculated
  /** 规格支持：针对衣服、外套等不同尺寸的库存量 */
  variants?: { size: string; quantity: number; sku?: string }[];
}

export interface MaintenanceSchedule {
  id?: string;
  itemId: string;
  type: 'Preventive' | 'Corrective' | 'Inspection' | 'Calibration';
  frequency?: 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Semi-Annual' | 'Annual' | 'Custom';
  customDays?: number; // For custom frequency
  lastMaintained?: string;
  nextMaintenanceDate?: string;
  scheduledDate?: string;
  assignedTo?: string; // Member ID
  notes?: string;
  description?: string;
  status?: 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';
  estimatedDuration?: number; // Duration in minutes
  priority?: 'Low' | 'Medium' | 'High' | 'Critical';
  createdAt?: string;
  completedDate?: string; // Date when maintenance was completed
  active?: boolean;
}

export interface StockMovement {
  id: string;
  itemId: string;
  itemName: string;
  date: string;
  type: 'In' | 'Out' | 'Adjustment';
  quantity: number; // The change in quantity
  previousQuantity: number;
  newQuantity: number;
  variant?: string;
  reason: string; // e.g., 'Purchase', 'Sale', 'Manual Adjustment', 'Damage', 'Loss', 'Stock Count'
  referenceId?: string; // e.g., transactionId
  performedBy: string; // Member name or ID
}
export interface InventoryAlert {
  id?: string;
  itemId: string;
  type: 'Low Stock' | 'Overdue Return' | 'Maintenance Due' | 'Maintenance Overdue' | 'Out of Stock';
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  message: string;
  createdAt: string;
  acknowledged?: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  active: boolean;
  executions: number;
}

export interface Event {
  id: string;
  title: string;
  description?: string;
  date: string;
  endDate?: string; // End date for multi-day events
  time?: string; // Time for the event (if not all-day)
  type: 'Meeting' | 'Training' | 'Social' | 'Project' | 'International';
  attendees: number;
  maxAttendees?: number;
  status: 'Upcoming' | 'Completed' | 'Cancelled';
  predictedDemand?: 'Low' | 'Medium' | 'High'; // AI Feature
  location: string;
  /** 活动负责人/筹委会员 ID（选会员带出，Story 3.2） */
  organizerId?: string | null;
  /** List of registered member IDs (for UI checking) */
  registeredMembers?: string[];
  /** Organizing committee assignments (for access control) */
  committee?: ProjectCommitteeMember[];
}

/** 活动参与状态：报名/缴费/签到一致可查（Story 8.1） */
export type EventRegistrationStatus = 'registered' | 'paid' | 'checked_in';

export interface EventRegistration {
  id: string;
  eventId: string;
  memberId: string;
  status: EventRegistrationStatus;
  paidAt?: string | null;
  checkedInAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  loId?: string | null;
}

/** 非会员留资：联络方式与兴趣，供组织跟进与推广（Story 9.1 / FR27） */
export interface NonMemberLead {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  interests?: string[] | null;
  source?: string | null;
  eventId?: string | null;
  loId: string;
  createdAt: string;
  notes?: string | null;
}

/** Unified status: proposal flow + execution */
export type ProjectStatus =
  | 'Draft' | 'Submitted' | 'Under Review' | 'Rejected'  // proposal
  | 'Approved' | 'Planning' | 'Active' | 'Completed' | 'Review'  // execution
  | 'Upcoming' | 'Cancelled';

/** Level: JCI, National, Area, Local */
export type ProjectLevel = 'JCI' | 'National' | 'Area' | 'Local';

/** Pillar: Individual, Community, Business, International, LOM, Chapter */
export type ProjectPillar = 'Individual' | 'Community' | 'Business' | 'International' | 'LOM' | 'Chapter';

/** Category: programs, skill_development, events, projects */
export type ProjectCategory = 'programs' | 'skill_development' | 'events' | 'projects';

/** Type options (category-dependent, simplified set - extend as needed) */
export type ProjectType = string;  // e.g. 'TOYM', 'CYEA', 'JCI Discover', etc.

/** Task assigned to a specific organizing committee role */
export interface ProjectCommitteeTask {
  /** 唯一参考编号（UUID v4，系统自动生成） */
  taskId?: string;
  /** Task title/description, e.g. "Book venue", "Prepare sponsorship deck" */
  title: string;
  /** Optional due date (ISO string, YYYY-MM-DD) */
  dueDate?: string;
}

/** Project organizing committee member */
export interface ProjectCommitteeMember {
  /** Role name, e.g. "Project Director", "Secretary" */
  role: string;
  /** Member ID from `members` collection */
  memberId: string;
  /** Optional list of tasks & deadlines for this role */
  tasks?: ProjectCommitteeTask[];
}

export interface Project {
  id: string;
  status: ProjectStatus;

  // --- Core fields (all projects: proposal + execution) ---
  title?: string;
  name?: string;
  description?: string;
  lead?: string;
  organizerId?: string | null;
  level?: ProjectLevel;
  pillar?: ProjectPillar;
  category?: ProjectCategory;
  type?: ProjectType;

  // --- Dates ---
  date?: string;
  startDate?: string;
  endDate?: string;
  time?: string;
  proposedDate?: string;
  /** Event start date (ISO string) */
  eventStartDate?: string;
  /** Event end date (ISO string) */
  eventEndDate?: string;
  /** Event start time (e.g. "09:00" or "9:00 AM") */
  eventStartTime?: string;
  /** Event end time (e.g. "17:00" or "5:00 PM") */
  eventEndTime?: string;

  // --- Budget & execution ---
  budget?: number;
  spent?: number;
  proposedBudget?: number;
  completion?: number;
  teamSize?: number;
  team?: string[];
  financialAccountId?: string;

  // --- Proposal/approval ---
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

  // --- Event/registration ---
  attendees?: number;
  maxAttendees?: number;
  location?: string;
  predictedDemand?: 'Low' | 'Medium' | 'High';
  /** List of registered member IDs (for UI checking) */
  registeredMembers?: string[];

  /** Organizing committee assignments for this project */
  committee?: ProjectCommitteeMember[];

  createdAt?: string;
  updatedAt?: string;
}

// Project Financial Account Management Types
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
  color?: string; // For UI visualization
}

export interface AlertThreshold {
  id: string;
  type: 'budget_warning' | 'budget_exceeded' | 'category_warning';
  threshold: number; // Percentage (e.g., 80 for 80%)
  enabled: boolean;
  notificationMethod: 'email' | 'in_app' | 'both';
}

export interface ProjectTransaction {
  id: string;
  projectId: string;
  financialAccountId: string;
  type: 'income' | 'expense';
  amount: number;
  categoryId?: string; // Link to BudgetCategory
  description: string;
  purpose?: string;
  date: string;
  createdBy: string;
  createdAt: string;
  receiptUrl?: string;
  approvedBy?: string;
  approvedAt?: string;
  tags?: string[];
}

export interface ProjectFinancialSummary {
  projectId: string;
  budgetUtilization: number; // Percentage
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
  month: string; // YYYY-MM format
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

export interface Notification {
  id: string;
  memberId?: string; // Optional for backward compatibility, but typically required
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'ai';
  read: boolean;
  timestamp: string;
}

export type TransactionType = 'project' | 'operations' | 'dues' | 'merchandise';

export interface TransactionSplit {
  id: string;
  parentTransactionId: string;
  category: 'Projects & Activities' | 'Membership' | 'Administrative';
  type: 'Income' | 'Expense';
  year?: number;
  projectId?: string;
  memberId?: string;
  purpose?: string;
  paymentRequestId?: string;
  amount: number;
  description: string;
  createdAt: string;
  createdBy: string;
  /** 关联库存联动字段 */
  inventoryLinkId?: string;
  inventoryVariant?: string;
  inventoryQuantity?: number;
}

// Membership Types and Dues
export type MembershipType = 'Probation' | 'Full' | 'Honorary' | 'Senator' | 'Visiting';

export const MembershipDues: Record<MembershipType, number> = {
  Probation: 350,
  Full: 300,
  Honorary: 50,
  Senator: 0,
  Visiting: 500,
};

export interface DuesRenewalTransaction {
  id?: string;
  memberId: string;
  membershipType: MembershipType;
  duesYear: number;
  amount: number;
  status: 'pending' | 'paid' | 'overdue';
  dueDate: string;
  paidDate?: string;
  isRenewal: boolean; // true for renewal, false for new member
  createdAt?: string;
  updatedAt?: string;
  remindersSent?: number;
  lastReminderDate?: string;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  /** 用途（交易目的/说明） */
  purpose?: string;
  amount: number;
  type: 'Income' | 'Expense';
  category: 'Projects & Activities' | 'Membership' | 'Administrative';
  status: 'Pending' | 'Cleared' | 'Reconciled';
  projectId?: string; // Link to project for project-specific financial accounts
  memberId?: string; // Link to member for member-specific transactions (e.g., dues)
  bankAccountId?: string;
  reconciledAt?: string;
  reconciledBy?: string;
  /** 唯一参考编号，与付款申请/银行备注一致（Story 4.1） */
  referenceNumber?: string | null;
  /** 关联付款申请 ID，便于对账 */
  paymentRequestId?: string | null;
  /** Linked project transaction id (optional) */
  projectTransactionId?: string | null;
  // Transaction split support
  transactionType?: TransactionType; // Primary transaction type
  splitIds?: string[]; // IDs of split records (only store IDs, not full objects)
  splits?: TransactionSplit[]; // Split components if transaction is split (deprecated - use splitIds)
  isSplit?: boolean; // Flag indicating if this transaction has splits
  year?: number; // For split transactions
  isSplitChild?: boolean; // Flag for split child entries
  parentTransactionId?: string; // Parent transaction ID for split children
  /** 关联库存联动字段 */
  inventoryLinkId?: string;
  inventoryVariant?: string;
  inventoryQuantity?: number;
}

export interface BankAccount {
  id: string;
  name: string;
  balance: number;
  initialBalance?: number;
  currency: string;
  lastReconciled: string;
  accountNumber?: string;
  bankName?: string;
  accountType?: 'Current' | 'Savings' | 'Investment' | 'Fixed Deposit' | 'Cash' | 'Other';
}

/** 付款申请状态（Story 2.1） */
export type PaymentRequestStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'cancelled';

export interface PaymentRequestItem {
  purpose: string;
  amount: number;
  attachment?: string | null; // URL or name
}

export interface PaymentRequest {
  id: string;
  applicantId: string;
  applicantName?: string | null;
  applicantEmail?: string | null;
  applicantPosition?: string | null;
  date: string;
  time: string;
  category: 'administrative' | 'projects_activities';
  activityId?: string | null;
  totalAmount: number;
  remark?: string | null;
  items: PaymentRequestItem[];
  claimFromBankAccountId?: string | null;
  bankName?: string | null;
  accountHolder?: string | null;
  accountNumber?: string | null;

  // Legacy/Compatibility fields
  amount: number;
  purpose: string;
  /** 活动 ID 或活动名称等关联；活动财政仅见本活动 */
  activityRef?: string | null;
  referenceNumber: string;
  status: PaymentRequestStatus;
  loId: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
}

export interface ReconciliationRecord {
  id?: string;
  bankAccountId: string;
  reconciliationDate: string;
  statementBalance: number;
  systemBalance: number;
  adjustedBalance: number;
  discrepancies: ReconciliationDiscrepancy[];
  reconciledBy: string;
  notes?: string;
  status: 'in_progress' | 'completed';
  transactionTypeSummary: {
    project: number;
    operations: number;
    dues: number;
    merchandise: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface ReconciliationDiscrepancy {
  id: string;
  transactionId: string;
  type: 'missing' | 'amount_mismatch' | 'duplicate';
  expectedAmount?: number;
  actualAmount?: number;
  description: string;
  resolved?: boolean;
  resolutionNotes?: string;
}

export interface DashboardStats {
  totalMembers: number;
  activeProjects: number;
  upcomingEvents: number;
  financialHealth: number; // Percentage
  monthlyGrowth: number;
  duesCollectedPercentage: number;
}

export interface WorkflowExecution {
  id?: string;
  workflowId: string;
  workflowName: string;
  status: 'success' | 'failed' | 'running' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  duration?: number; // milliseconds
  triggeredBy: 'manual' | 'event' | 'schedule' | 'webhook' | 'condition';
  triggerData?: Record<string, any>;
  nodeExecutions: WorkflowNodeExecution[];
  executedSteps: WorkflowExecutionStep[];
  error?: {
    message: string;
    stepId?: string;
    stepType?: string;
    stack?: string;
  };
  context?: Record<string, any>;
  createdAt?: string;
}

export interface WorkflowExecutionStep {
  stepId: string;
  stepType: string;
  stepOrder: number;
  status: 'pending' | 'running' | 'completed' | 'success' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  duration?: number; // milliseconds
  error?: string;
  output?: Record<string, any>;
}

export interface WorkflowNodeExecution {
  id?: string;
  nodeId: string;
  nodeType: string;
  status: 'success' | 'failed' | 'running' | 'pending' | 'skipped' | 'completed';
  startedAt?: string;
  completedAt?: string;
  input?: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  duration?: number;
}

export interface HobbyClub {
  id: string;
  name: string;
  category: 'Sports' | 'Social' | 'Professional' | 'Arts';
  membersCount: number;
  nextActivity?: string;
  lead: string;
  image: string;
  memberIds?: string[];
  description?: string;
}

export interface TrainingModule {
  id: string;
  title: string;
  type: 'JCI Official' | 'Local Skill' | 'Leadership';
  duration: string;
  completionStatus: 'Not Started' | 'In Progress' | 'Completed';
  pointsReward: number;
  image: string;
}

export interface Document {
  id: string;
  name: string;
  description?: string;
  type: 'PDF' | 'DOC' | 'XLS' | 'IMG';
  category: 'Policy' | 'Meeting Minutes' | 'Project Report' | 'Template';
  uploadedDate: string;
  size: string;
}

export interface NewsPost {
  id: string;
  author: { name: string; avatar: string; role: string };
  content: string;
  timestamp: string;
  likes: number;
  comments: number;
  type: 'Announcement' | 'Update' | 'Poll';
  image?: string;
}

export interface Task {
  /** 唯一参考编号（UUID v4，作为 Firestore 文档 ID） */
  id: string;
  projectId: string;
  /** 项目标题 */
  projectTitle?: string;
  /** 岗位名称（role） */
  role?: string;
  /** Committee member ID */
  committeeMemberId?: string;
  /** Committee member 名称 */
  committeeName?: string;
  title: string;
  status: 'Todo' | 'In Progress' | 'Done';
  priority: 'High' | 'Medium' | 'Low';
  dueDate: string;
  startDate?: string; // For Gantt chart
  duration?: number; // Duration in days
  assignee: string;
  dependencies?: string[]; // Task IDs this task depends on
  progress?: number; // Progress percentage (0-100)
  /** Remark 历史记录：Map<remarkId, { content: string, timestamp: string }> */
  remarks?: Record<string, { content: string; timestamp: string }>;
  /** Status 变更历史：Map<statusChangeId, { status: string, timestamp: string }> */
  statusHistory?: Record<string, { status: string; timestamp: string }>;
}

// Gantt Chart specific task interface
export interface GanttTask {
  id: string;
  projectId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  progress: number; // 0-100
  dependencies: string[]; // IDs of predecessor tasks
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

export interface ProbationTask {
  id: string;
  title: string;
  description?: string;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Verified';
  assignedAt: string; // Date when task was assigned
  completedAt?: string; // Date when task was completed
  verifiedBy?: string; // Member ID who verified completion
  verifiedAt?: string; // Date when task was verified
  dueDate?: string; // Optional due date
  category?: 'Training' | 'Event' | 'Project' | 'Documentation' | 'Other';
}

export interface Candidate {
  id: string;
  name: string;
  position: string;
  avatar: string;
  votes?: number; // Vote count for this candidate
  // Enhanced Election Management fields
  memberId: string;
  positionId: string;
  statement: string;
  nominatedBy: string;
  nominatedAt: Date;
}

export interface Election {
  id: string;
  title: string;
  status: 'Active' | 'Completed' | 'Upcoming' | 'Cancelled';
  startDate?: string;
  endDate: string;
  candidates: Candidate[];
  totalVotes?: number;
  votedBy?: string[];
  description?: string;
  // Enhanced Election Management fields
  name: string;
  positions: ElectionPosition[];
  nominationStartDate: Date;
  nominationEndDate: Date;
  votingStartDate: Date;
  votingEndDate: Date;
  votingMethod: 'plurality' | 'ranked_choice' | 'approval';
  electionStatus: 'nomination' | 'voting' | 'completed';
}

// ============================================
// Enhanced Election Management System Types
// ============================================

export interface ElectionPosition {
  id: string;
  title: string;
  seats: number;
  candidates: Candidate[];
}

export interface ElectionBallot {
  id: string;
  electionId: string;
  voterId: string;
  votes: Record<string, string | string[]>; // positionId -> candidateId(s)
  timestamp: Date;
}

export interface ProposalVotes {
  for: number;
  against: number;
  abstain: number;
}

export interface Proposal {
  id: string;
  title: string;
  description: string;
  submittedBy: string;
  status: 'Voting' | 'Approved' | 'Rejected' | 'Draft';
  votes: ProposalVotes;
  submittedDate?: string;
  votedBy?: string[];
}

export interface Survey {
  id: string;
  title: string;
  description: string;
  questions: Array<{
    id: string;
    type: 'text' | 'multiple-choice' | 'rating' | 'yes-no';
    question: string;
    options?: string[];
    required: boolean;
  }>;
  targetAudience: 'All Members' | 'Board' | 'Project Leads' | 'Specific Group';
  status: 'Draft' | 'Active' | 'Closed';
  startDate: string;
  endDate: string;
  responsesCount: number;
  createdBy: string;
  createdAt: string;
}

// ============================================
// Electronic Voting System Types
// ============================================

export interface Vote {
  id: string;
  question: string;
  description: string;
  options: VoteOption[];
  eligibleVoters: string[]; // member IDs
  startDate: Date;
  endDate: Date;
  anonymous: boolean;
  status: 'draft' | 'active' | 'closed';
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface VoteOption {
  id: string;
  text: string;
  voteCount: number;
}

export interface VoteCast {
  id: string;
  voteId: string;
  voterId: string;
  optionId: string;
  timestamp: Date;
}

// ============================================
// Annual Dues Renewal System Types
// ============================================

export interface DuesRenewalSummary {
  year: number;
  totalMembers: number;
  renewalMembers: number;
  newMembers: number;
  byMembershipType: Record<MembershipType, {
    total: number;
    paid: number;
    pending: number;
    overdue: number;
    totalAmount: number;
    paidAmount: number;
  }>;
  overallStats: {
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    overdueAmount: number;
    collectionRate: number; // percentage
  };
}
// Workflow and Automation Types

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  data: WorkflowNodeData;
  connections: WorkflowConnection[];
  status?: 'idle' | 'running' | 'completed' | 'error';
  config?: Record<string, any>;
}

export type WorkflowNodeType =
  | 'trigger'
  | 'action'
  | 'condition'
  | 'delay'
  | 'email'
  | 'notification'
  | 'data_update'
  | 'task_create'
  | 'webhook'
  | 'approval'
  | 'loop'
  | 'end';

export interface WorkflowNodeData {
  label: string;
  description?: string;
  category: WorkflowNodeCategory;
  icon: string;
  configSchema?: Record<string, any>;
  inputs?: WorkflowNodeInput[];
  outputs?: WorkflowNodeOutput[];
}

export type WorkflowNodeCategory =
  | 'triggers'
  | 'actions'
  | 'logic'
  | 'communication'
  | 'data'
  | 'integrations'
  | 'utilities';

export interface WorkflowNodeInput {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description?: string;
}

export interface WorkflowNodeOutput {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
}

export interface WorkflowConnection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string;
  targetHandle?: string;
  condition?: WorkflowCondition;
}

export interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains' | 'exists' | 'not_exists';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  triggers: WorkflowTrigger[];
  status: 'draft' | 'active' | 'paused' | 'archived';
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastExecuted?: string;
  executionCount: number;
  tags?: string[];
}

export interface WorkflowTrigger {
  id: string;
  type: 'manual' | 'schedule' | 'event' | 'webhook' | 'data_change';
  config: Record<string, any>;
  enabled: boolean;
}



// Rule Engine Types

export interface Rule {
  id: string;
  name: string;
  description?: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
  logicalOperator?: 'AND' | 'OR';
  enabled: boolean;
  priority: number;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  lastExecuted?: string;
  executionCount?: number;
  tags?: string[];
}

export interface RuleCondition {
  id: string;
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'greater_equal' | 'less_equal' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'exists' | 'not_exists' | 'in' | 'not_in';
  value: any;
  dataType?: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  logicalOperator?: 'AND' | 'OR';
}

export interface RuleAction {
  id: string;
  type: 'send_email' | 'send_notification' | 'update_field' | 'update_member' | 'create_task' | 'award_points' | 'award_badge' | 'trigger_workflow' | 'webhook' | 'send_webhook' | 'log_event';
  config: Record<string, any>;
  enabled?: boolean;
  order?: number;
}

export interface RuleExecution {
  id: string;
  ruleId: string;
  status: 'success' | 'failed' | 'partial';
  executedAt: string;
  triggeredBy: string;
  triggerData: Record<string, any>;
  conditionsEvaluated: RuleConditionResult[];
  actionsExecuted: RuleActionResult[];
  duration: number;
  error?: string;
}

export interface RuleConditionResult {
  conditionId: string;
  result: boolean;
  actualValue: any;
  expectedValue: any;
  operator: string;
}

export interface RuleActionResult {
  actionId: string;
  status: 'success' | 'failed' | 'skipped';
  result?: any;
  error?: string;
  duration: number;
}

// Event Management - Calendar View Types

export interface CalendarEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  location: string;
  description: string;
  type: string;
  eventId?: string; // Reference to the main Event record
  color?: string; // For calendar display
  resource?: any; // Additional data for react-big-calendar
}

// Event Template Types

export interface EventTemplate {
  id: string;
  name: string;
  type: string;
  description: string;
  location: string;
  duration: number; // in minutes
  capacity: number;
  registrationSettings: any;
  committee?: { title: string; dueDate: Date }[]; // Added committee field
  budgetTemplate: EventBudgetTemplate;
  createdAt: Date;
  createdBy: string;
  usageCount?: number;
  category?: string;
}

export interface EventBudgetTemplate {
  plannedIncome: BudgetCategoryTemplate[];
  plannedExpense: BudgetCategoryTemplate[];
  totalBudget: number;
}

export interface BudgetCategoryTemplate {
  category: string;
  plannedAmount: number;
  description?: string;
}

// Event Budget Management Types

export interface EventBudget {
  id: string;
  eventId: string;
  plannedIncome: EventBudgetCategory[];
  plannedExpense: EventBudgetCategory[];
  actualIncome: number;
  actualExpense: number;
  status: 'on_track' | 'warning' | 'exceeded';
  createdAt: Date;
  updatedAt: Date;
  warningThreshold?: number; // Percentage (default 80%)
}

export interface EventBudgetCategory {
  category: string;
  plannedAmount: number;
  actualAmount: number;
  description?: string;
  transactions?: string[]; // Transaction IDs
}

export interface EventExpense {
  id: string;
  eventId: string;
  category: string;
  amount: number;
  description: string;
  date: Date;
  receiptUrl?: string;
  approvedBy?: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface EventBudgetAlert {
  id: string;
  eventId: string;
  type: 'warning' | 'exceeded' | 'category_exceeded';
  message: string;
  threshold: number;
  currentAmount: number;
  createdAt: Date;
  acknowledged: boolean;
}

// Data Import/Export Types

export interface DataImportResult {
  id: string;
  filename: string;
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  errors: DataImportError[];
  warnings: DataImportWarning[];
  status: 'success' | 'partial' | 'failed';
  importedAt: Date;
  importedBy: string;
  duration: number; // in milliseconds
  summary: DataImportSummary;
}

export interface DataImportError {
  row: number;
  field?: string;
  message: string;
  value?: any;
  severity: 'error' | 'warning';
}

export interface DataImportWarning {
  row: number;
  field?: string;
  message: string;
  value?: any;
}

export interface DataImportSummary {
  created: number;
  updated: number;
  skipped: number;
  duplicates: number;
  invalidRecords: number;
}

export interface DataExportRequest {
  id: string;
  entityType: 'members' | 'events' | 'projects' | 'transactions' | 'all';
  format: 'csv' | 'excel';
  fields: string[];
  filters?: DataExportFilter[];
  requestedBy: string;
  requestedAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  downloadUrl?: string;
  expiresAt?: Date;
}

export interface DataExportFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'between' | 'in' | 'not_in';
  value: any;
  values?: any[]; // For 'in', 'not_in', 'between' operators
}

export interface DataValidationRule {
  field: string;
  type: 'required' | 'email' | 'phone' | 'date' | 'number' | 'enum' | 'unique' | 'length' | 'pattern';
  config?: {
    min?: number;
    max?: number;
    pattern?: string;
    values?: string[];
    message?: string;
  };
}

export interface ImportTemplate {
  id: string;
  name: string;
  entityType: 'members' | 'events' | 'projects' | 'transactions';
  requiredFields: string[];
  optionalFields: string[];
  validationRules: DataValidationRule[];
  fieldMappings: Record<string, string>; // CSV column -> entity field
  sampleData?: Record<string, any>[];
  createdAt: Date;
  createdBy: string;
}

export interface DataOperation {
  id: string;
  type: 'import' | 'export';
  entityType: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  filename?: string;
  fileSize?: number;
  recordCount?: number;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  performedBy: string;
  result?: DataImportResult | DataExportRequest;
  error?: string;
}
// Probation to Full Member Promotion Types

export interface PromotionProgress {
  id: string;
  memberId: string;
  memberName: string;
  currentMembershipType: 'Probation';
  requirements: PromotionRequirement[];
  overallProgress: number; // Percentage (0-100)
  isEligibleForPromotion: boolean;
  promotedAt?: Date;
  promotedBy?: string; // 'system' for automatic, user ID for manual
  promotionReason?: string; // For manual promotions
  createdAt: Date;
  updatedAt: Date;
}

export interface PromotionRequirement {
  id: string;
  type: 'bod_meeting_attendance' | 'event_organizing_committee' | 'event_participation' | 'jci_inspire_completion';
  name: string;
  description: string;
  isCompleted: boolean;
  completedAt?: Date;
  completionDetails?: PromotionRequirementDetails;
  evidence?: string[]; // URLs or references to proof
}

export interface PromotionRequirementDetails {
  eventId?: string;
  eventName?: string;
  meetingId?: string;
  meetingDate?: Date;
  courseId?: string;
  courseName?: string;
  completionCertificate?: string;
  role?: string; // For organizing committee roles
}

export interface PromotionHistory {
  id: string;
  memberId: string;
  memberName: string;
  fromMembershipType: string;
  toMembershipType: string;
  promotionDate: Date;
  promotionMethod: 'automatic' | 'manual';
  promotedBy: string; // 'system' or administrator ID
  requirementsCompleted: PromotionRequirement[];
  oldDuesAmount: number;
  newDuesAmount: number;
  notificationSent: boolean;
  notes?: string;
}

export interface PromotionNotification {
  id: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  promotionDate: Date;
  fromMembershipType: string;
  toMembershipType: string;
  newDuesAmount: number;
  message: string;
  sentAt?: Date;
  status: 'pending' | 'sent' | 'failed';
  retryCount: number;
}

export interface PromotionSettings {
  id: string;
  automaticPromotionEnabled: boolean;
  requireAllFourRequirements: boolean;
  probationDuesAmount: number; // RM350
  fullMemberDuesAmount: number; // RM300
  notificationTemplate: string;
  requireAdminApproval: boolean;
  gracePeriodDays: number; // Days to complete requirements after joining
  updatedAt: Date;
  updatedBy: string;
}

export interface ManualPromotionRequest {
  id: string;
  memberId: string;
  memberName: string;
  requestedBy: string;
  requestedAt: Date;
  reason: string;
  overrideRequirements: boolean;
  missingRequirements: string[];
  approvedBy?: string;
  approvedAt?: Date;
  status: 'pending' | 'approved' | 'rejected';
  adminNotes?: string;
}