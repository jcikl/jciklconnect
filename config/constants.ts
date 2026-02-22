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

export const INDUSTRY_OPTIONS = [
  'Advertising, Marketing & Media',
  'Agriculture & Animals',
  'Architecture, Engineering & Construction',
  'Art, Entertainment & Design',
  'Automotive & Accessories',
  'Food & Beverages',
  'Telecom, AI, Computers & IT',
  'Consulting & Professional Services',
  'Education & Training',
  'Event & Hospitality',
  'Crypto, Blockchain, Finance & Insurance',
  'Health & Wellness',
  'Legal, HR, Accounting & Tax',
  'Manufacturing & Supply Chain',
  'Wholesale, Retail & E-Commerce',
  'Personal, Beauty & Sports',
  'Real Estate & Property Services',
  'Transport & Logistics',
  'Travel & Tourism',
  'Other'
] as const;


/** Join Us Survey Questions and Mappings */
export const JOIN_US_SURVEY_QUESTIONS = [
  {
    id: 'Q1',
    title: '如果你参加一个30人的聚会，你通常希望：',
    options: [
      {
        label: '学习如何成为全场焦点，提升表达底气',
        value: 'A',
        mapping: {
          direction: 'Individual',
          category: 'Skill Development',
          items: ['Effective Communications', 'Public Speaking', 'JCIM Inspire', 'Mentorship', 'Local Academy']
        }
      },
      {
        label: '结识2-3位能直接在事业上帮到我或合作的人',
        value: 'B',
        mapping: {
          direction: 'Business',
          category: 'Programs',
          items: ['JIB', 'CYEA', 'BCP', 'Networking Events', 'BSP Supercharge']
        }
      },
      {
        label: '观察别人是如何组织这场活动的，学习管理经验',
        value: 'C',
        mapping: {
          direction: 'Community',
          category: 'Projects',
          items: ['Project Management', 'Leadership Toolkit', 'Leaders School Program', 'Chairperson roles']
        }
      },
      {
        label: '认识一些不同背景的朋友，单纯跳出原有圈子',
        value: 'D',
        mapping: {
          direction: 'International',
          category: 'Events',
          items: ['Conference', 'Twin Chapter', 'Area/National/Overseas Conferences', 'International Networking']
        }
      }
    ]
  },
  {
    id: 'Q2',
    title: '在目前的工作或生活中，哪种感觉最让你困扰？',
    options: [
      {
        label: '有想法但说不出来，或者说服不了别人',
        value: 'A',
        mapping: {
          direction: 'Individual',
          category: 'Skill Development',
          items: ['Effective Meetings', 'Leadership', 'Training', 'Explore/Discover workshop', 'Leadership Summit']
        }
      },
      {
        label: '每天重复劳动，感觉视野越来越窄',
        value: 'B',
        mapping: {
          direction: 'International',
          category: 'Projects',
          items: ['Zero Waste Campaign', 'SDA', 'UN SDGs', 'International Cross-border CSR', 'Area Academy']
        }
      },
      {
        label: '朋友圈太单一，遇到问题找不到专业人士请教',
        value: 'C',
        mapping: {
          direction: 'Business',
          category: 'Programs',
          items: ['JIB', 'CYE', 'BSP', 'Business growth platform', 'Networking Relationship capital']
        }
      },
      {
        label: '想做点有意义的事，但不知道从哪开始上手',
        value: 'D',
        mapping: {
          direction: 'Community',
          category: 'Projects',
          items: ['Community-based', 'Zero Waste', 'Blood Donation', 'SDA', 'R&R workshop']
        }
      }
    ]
  },
  {
    id: 'Q3',
    title: '如果有一个周末，你更愿意如何度过？',
    options: [
      {
        label: '参加一场能拿证书、有干货的实战训练营',
        value: 'A',
        mapping: {
          direction: 'Individual',
          category: 'Skill Development',
          items: ['Workshops', 'Skill mastery', 'JCIM Empower', 'Leadership Series', 'Skills-based training']
        }
      },
      {
        label: '策划并执行一个能落地、看得到社会反馈的小项目',
        value: 'B',
        mapping: {
          direction: 'Community',
          category: 'Projects',
          items: ['Result-oriented action', 'Leaders School', 'SDA project execution', 'Zero Waste']
        }
      },
      {
        label: '与一群创业者或高管共进晚餐，交换商业信息',
        value: 'C',
        mapping: {
          direction: 'Business',
          category: 'Programs',
          items: ['Networking', 'CYEA', 'Startup Pitch Night', 'JIB Biz Matching', 'BSP']
        }
      },
      {
        label: '出发去另一个城市或国家，看看外面的世界',
        value: 'D',
        mapping: {
          direction: 'International',
          category: 'Events',
          items: ['Conferences', 'Twin Chapter exchange', 'ASPAC', 'World Congress', 'National Convention']
        }
      }
    ]
  },
  {
    id: 'Q4',
    title: '加入JCI一年后，你最希望别人怎么评价你？',
    options: [
      {
        label: '“你现在的谈吐和自信程度判若两人。”',
        value: 'A',
        mapping: {
          direction: 'Individual',
          category: 'Skill Development',
          items: ['Discover', 'Explore', 'Personal Transformation', 'TOYM', 'Public Speaking series']
        }
      },
      {
        label: '“你的事业因为这个平台得到了实际的增长。”',
        value: 'B',
        mapping: {
          direction: 'Business',
          category: 'Programs',
          items: ['Business growth & matching', 'JIB', 'CYEA', 'BSP Supercharge']
        }
      },
      {
        label: '“你成功带领团队完成了一个了不起的挑战。”',
        value: 'C',
        mapping: {
          direction: 'Community',
          category: 'Projects',
          items: ['Leadership & Execution', 'Project Chairperson', 'Leaders School', 'National platform recognition']
        }
      },
      {
        label: '“你的眼界变高了，看问题的维度完全不一样。”',
        value: 'D',
        mapping: {
          direction: 'International',
          category: 'Events',
          items: ['Scale & Ideas', 'National/International Leadership Summit', 'Global CYE']
        }
      }
    ]
  },
  {
    id: 'Q5',
    title: '你每周愿意为这个“更好的自己”拨出多少小时？',
    options: [
      { label: '2小时（轻度参与）', value: 'A', mapping: { direction: 'None', category: 'Engagement', items: ['Casual'] } },
      { label: '5小时（积极分子）', value: 'B', mapping: { direction: 'None', category: 'Engagement', items: ['Active'] } },
      { label: '10小时以上（核心骨干潜力）', value: 'C', mapping: { direction: 'None', category: 'Engagement', items: ['Core'] } }
    ]
  }
];

