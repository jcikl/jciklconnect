// Application Constants
/** Default LO id when single-LO (MVP). Override via env or auth for multi-LO. */
export const DEFAULT_LO_ID = 'default-lo';

export const COLLECTIONS = {
  MEMBERS: 'members',
  EVENTS: 'events',
  PROJECTS: 'projects',
  TRANSACTIONS: 'transactions',
  PROJECT_TRANSACTIONS: 'projectTrx',
  BANK_ACCOUNTS: 'bankAccounts',
  INVENTORY: 'inventory',
  POINTS: 'points',
  POINT_RULES: 'pointRules',
  AUTOMATION_RULES: 'automationRules',
  WORKFLOWS: 'workflows',
  WORKFLOW_EXECUTIONS: 'workflow_executions',
  NOTIFICATIONS: 'notifications',
  DOCUMENTS: 'documents',
  TRAINING_MODULES: 'trainingModules',
  HOBBY_CLUBS: 'hobbyClubs',
  BUSINESS_PROFILES: 'businessProfiles',
  SURVEYS: 'surveys',
  SURVEY_RESPONSES: 'surveyResponses',
  COMMUNICATION: 'communication',
  ACTIVITY_PLANS: 'activityPlans',
  TEMPLATES: 'templates',
  MEMBER_BENEFITS: 'memberBenefits',
  BENEFIT_USAGE: 'benefitUsage',
  DOCUMENT_VERSIONS: 'documentVersions',
  LEARNING_PATHS: 'learningPaths',
  LEARNING_PROGRESS: 'learningProgress',
  CERTIFICATES: 'certificates',
  ADVERTISEMENTS: 'advertisements',
  PROMOTION_PACKAGES: 'promotionPackages',
  EVENT_FEEDBACK: 'eventFeedback',
  PROJECT_REPORTS: 'projectReports',
  CONVERSATIONS: 'conversations',
  MESSAGES: 'messages',
  BADGES: 'badges',
  BADGE_AWARDS: 'badgeAwards',
  WEBHOOKS: 'webhooks',
  WEBHOOK_LOGS: 'webhook_logs',
  MAINTENANCE_SCHEDULES: 'maintenance_schedules',
  INVENTORY_ALERTS: 'inventory_alerts',
  RECONCILIATIONS: 'reconciliations',
  TRANSACTION_SPLITS: 'transactionSplits',
  ACHIEVEMENTS: 'achievements',
  ACHIEVEMENT_AWARDS: 'achievementAwards',
  ACHIEVEMENT_PROGRESS: 'achievementProgress',
  POINTS_RULES: 'pointsRules',
  POINTS_RULE_EXECUTIONS: 'pointsRuleExecutions',
  EMAIL_LOGS: 'emailLogs',
  NUDGE_RULES: 'nudgeRules',
  GUEST_REGISTRATIONS: 'guestRegistrations',
  DUES_RENEWALS: 'duesRenewals',
  PAYMENT_REQUESTS: 'paymentRequests',
  /** 活动报名/缴费/签到统一名单（Story 8.1） */
  EVENT_REGISTRATIONS: 'eventRegistrations',
  /** 非会员留资（Story 9.1） */
  NON_MEMBER_LEADS: 'nonMemberLeads',
  STOCK_MOVEMENTS: 'stock_movements',
} as const;

/** 付款申请参考编号前缀：PR-{loId}-{YYYYMMDD}-{序号}，与银行备注约定一致（Story 2.1） */
export const REFERENCE_NUMBER_PREFIX = 'PR';

export const POINT_CATEGORIES = {
  EVENT_ATTENDANCE: 'event_attendance',
  PROJECT_TASK: 'project_task',
  ROLE_FULFILLMENT: 'role_fulfillment',
  RECRUITMENT: 'recruitment',
  TRAINING: 'training',
  JCI_EVENT: 'jci_event',
  FUNDRAISING: 'fundraising',
  MEDIA_CONTRIBUTION: 'media_contribution',
  HOBBY_CLUB: 'hobby_club',
  BUSINESS_DIRECTORY: 'business_directory',
  SPONSORSHIP_REFERRAL: 'sponsorship_referral',
} as const;

/** 会员本人可编辑的主档字段（个人主档维护）；其余字段仅只读 */
export const MEMBER_SELF_EDITABLE_FIELDS = [
  'phone',
  'alternatePhone',
  'email',
  'address',
  'linkedin',
  'facebook',
  'instagram',
  'wechat',
  'emergencyContactName',
  'emergencyContactPhone',
  'emergencyContactRelationship',
  'cutStyle',
  'tshirtSize',
  'jacketSize',
  'embroideredName',
] as const;

export const MEMBER_TIERS = {
  BRONZE: { minPoints: 0, maxPoints: 499, name: 'Bronze' },
  SILVER: { minPoints: 500, maxPoints: 999, name: 'Silver' },
  GOLD: { minPoints: 1000, maxPoints: 1999, name: 'Gold' },
  PLATINUM: { minPoints: 2000, maxPoints: Infinity, name: 'Platinum' },
} as const;

export const EVENT_TYPES = {
  MEETING: 'Meeting',
  TRAINING: 'Training',
  SOCIAL: 'Social',
  PROJECT: 'Project',
  INTERNATIONAL: 'International',
} as const;

export const PROJECT_STATUS = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Review',
  REJECTED: 'Rejected',
  APPROVED: 'Approved',
  PLANNING: 'Planning',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  REVIEW: 'Review',
  UPCOMING: 'Upcoming',
  CANCELLED: 'Cancelled',
} as const;

/** Level: JCI, National, Area, Local */
export const PROJECT_LEVELS = ['JCI', 'National', 'Area', 'Local'] as const;

/** Pillar: Individual, Community, Business, International, LOM, Chapter */
export const PROJECT_PILLARS = ['Individual', 'Community', 'Business', 'International', 'LOM', 'Chapter'] as const;

/** Category: programs, skill_development, events, projects */
export const PROJECT_CATEGORIES = ['programs', 'skill_development', 'events', 'projects'] as const;

/** Type options by category (simplified - extend as needed) */
export const PROJECT_TYPES_BY_CATEGORY: Record<string, string[]> = {
  programs: ['TOYM', 'CYEA', 'SDA', 'CYE', 'R&R', 'BCP', 'BSP', 'BSP Supercharge', 'Other Program', 'Zero Waste Campaign', 'Leaders School Program', 'JIB'],
  skill_development: ['JCI Discover', 'JCI Explore', 'Effective Communications', 'Effective Leadership', 'Effective Meetings', 'Networking', 'Project Management', 'JCIM Inspire', 'JCIM Empower', 'JCIM Leadership Summit', 'Area Academy', 'Local Academy', 'Other'],
  events: ['Workshop', 'Training', 'Conference', 'Networking', 'Other'],
  projects: ['Community', 'Business', 'Individual', 'International', 'Other'],
};

export const TRANSACTION_TYPES = {
  INCOME: 'Income',
  EXPENSE: 'Expense',
} as const;

export const TRANSACTION_CATEGORIES = {
  PROJECTS_ACTIVITIES: 'Projects & Activities',
  MEMBERSHIP: 'Membership',
  ADMINISTRATIVE: 'Administrative',
} as const;

/** Administrative projectId options (行政费户口) - default + user can add */
export const ADMINISTRATIVE_PROJECT_IDS = ['National Due', 'Maintenance', 'Professional Fee'] as const;

/** Administrative purpose options */
export const ADMINISTRATIVE_PURPOSES = ['National Due', 'Utilities', 'Audit Fee', 'Water Fee', 'Electricity'] as const;

