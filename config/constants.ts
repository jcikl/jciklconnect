// Application Constants
/** Default LO id when single-LO (MVP). Override via env or auth for multi-LO. */
export const DEFAULT_LO_ID = 'default-lo';

export const COLLECTIONS = {
  MEMBERS: 'members',
  EVENTS: 'events',
  PROJECTS: 'projects',
  FLAGSHIP_PROJECTS: 'flagship_projects',
  TRANSACTIONS: 'transactions',
  PROJECT_TRANSACTIONS: 'projectTrx',
  BANK_ACCOUNTS: 'bankAccounts',
  INVENTORY: 'inventory',
  POINTS: 'points',
  POINT_RULES: 'pointRules',
  SPONSORSHIPS: 'sponsorships',
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
  /** JCI Gamification refactoring */
  INCENTIVE_PROGRAMS: 'incentivePrograms',
  INCENTIVE_STANDARDS: 'incentiveStandards',
  INCENTIVE_SUBMISSIONS: 'incentiveSubmissions',
  LO_STAR_PROGRESS: 'loStarProgress',
  /** Wolf-like Competition System Collections */
  BOUNTIES: 'bounties',
  CONTRACTS: 'contracts',
  OPPORTUNITY_DROPS: 'opportunityDrops',
  POINT_ESCROW: 'pointEscrow', // For holding funds during bounty/contract
  PUBLICATIONS: 'publications',
  PARTNERSHIPS: 'partnerships',
} as const;

/** 付款申请参考编号前缀：PR-{loId}-{YYYYMMDD}-{序号}，与银行备注约定一致（Story 2.1） */
export const REFERENCE_NUMBER_PREFIX = 'PR';

export const TOYYIB_CONFIG = {
  ENDPOINT: 'https://toyyibpay.com/index.php/api',
  SANDBOX_ENDPOINT: 'https://dev.toyyibpay.com/index.php/api',
  IS_SANDBOX: true,
  USER_SECRET_KEY: 'tl5be74e-pazq-kti6-xci2-bh6npgb4gcjv', // To be filled in via environment or dashboard
  CATEGORY_CODE: '6x9mw99z',    // To be filled in via environment or dashboard
  RETURN_URL_SUFFIX: '/payment-return',
  CALLBACK_URL_SUFFIX: '/api/webhooks/toyyibpay'
};

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

/** Type: program, skill_development, event, project */
export const PROJECT_TYPES = ['program', 'skill_development', 'event', 'project'] as const;

export const PROJECT_TYPE_LABELS: Record<string, string> = {
  program: 'JCIM Program',
  project: 'LO Projects',
  event: 'events',
  skill_development: 'skill Development',
};

/** Category options by type */
export const PROJECT_CATEGORIES_BY_TYPE: Record<string, string[]> = {
  program: [
    'TOYM', 'CYEA', 'SDA', 'CYE', 'BCP (Business Connect Program)', 
    'BSP (Business School Program)', 'R&R', 'BSP (Business Supercharge Program)', 
    'Zero Waste Campaign', 'Leaders School Program', 'JIB (JCI In Business)'
  ],
  skill_development: [
    'JCI Discover', 'JCI Explore', 'Effective Communications - Building a Foundation', 
    'Effective Communications - Crafting Your Message', 'Effective Communications - Mastering Management', 
    'Effective Communications - Message Delivery', 'Effective Leadership', 'Effective Meetings', 
    'Engage, Empower, Grow', 'Networking', 'Project Management', 'Social Responsibility', 
    'Facilitator', 'JCI Presenter', 'JCIM Leadership Summit', 'JCIM Inspire', 'JCIM Empower', 
    'JCIM Train The Trainer 1', 'JCIM Train The Trainer 2', 'JCIM Competent Trainer Academy', 
    'JCIM Trainer Arena', 'JCIM National Academy', 'Area Academy', 'Local Academy', 
    'JCIM Other Courses & Training', 'Recruitment & Retention Workshop', 
    'JCI Other Courses & Training', 'Parliamentary Procedure', 'Public Speaking', 'Debate'
  ],
  event: [
    'Area Convention', 'National Convention', 'JCI Area Conference (Asia-Pacific)', 
    'Other Convention', 'Installation Ceremony', 'Anniversary Ceremony', 'Gala Dinner & Gathering', 
    'General Member Meeting', 'Partnership Summit', 'Entertainments, Concerts & Shows', 
    'Exhibitions, Fairs & Expo', 'Other Event', 'Nomination', 'Press Conference', 
    'Interview Session', 'Announcement Of Finalist', 'Meeting', 'JCI World Congress', 
    'Workshop', 'Business Networking', 'JCI Asia-Pacific Senate Golf', 'Visitation', 
    'Linguistic Competitions', 'Senate Conference'
  ],
  project: [
    'Community', 'Business', 'International', 'Personal'
  ],
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

export const BUSINESS_CATEGORIES_OPTIONS = [
  'Distributor / Exporter / Importer',
  'Manufacturer / Producer',
  'Retailer / E-Commerce',
  'Service Provider'
] as const;

export { NATIONALITY_OPTIONS, nationalityOptionsForValue } from './nationalities';

export const IDEAL_REFERRAL_OPTIONS = [
  { label: 'Distributors', description: 'To help resell and distribute products in local or international markets' },
  { label: 'Resellers', description: 'To purchase and resell products/services to end users' },
  { label: 'Co-developers', description: 'For joint product or service development' },
  { label: 'Strategic Alliances', description: 'Long-term partnerships for mutual growth' },
  { label: 'Investors', description: 'For funding and scaling opportunities' },
  { label: 'Suppliers / Vendors', description: 'To source materials, components, or services' },
  { label: 'Technology Partners', description: 'For tech integration or digital transformation' },
  { label: 'Marketing / Branding Partners', description: 'To co-promote or brand products' },
  { label: 'Referral Partners / Affiliates', description: 'To refer potential customers or leads' },
  { label: 'Joint Venture Partners', description: 'For shared ownership in a new entity or project' },
  { label: 'Franchise Partners', description: 'To replicate business model in new regions' },
  { label: 'Channel Partners', description: 'To sell or promote products through different sales channels' },
  { label: 'Training / Content Partners', description: 'To create or deliver training programs or educational content' },
  { label: 'Operational Partners', description: 'To support backend operations, logistics, or HR' },
  { label: 'Government / NGO Collaborators', description: 'For public-private initiatives or CSR programs' },
  { label: 'Community / Ecosystem Partners', description: 'To build networks, events, or shared platforms' },
  { label: 'Other', description: '' }
] as const;


/** Join Us Survey Questions and Mappings */
export const JOIN_US_SURVEY_QUESTIONS = [
  {
    id: 'Q1',
    title: 'If you attend a 30-person gathering, what would you most want to get out of it?',
    titleZh: '如果你参加一个30人的聚会，你通常希望：',
    options: [
      {
        label: 'Learn how to speak confidently and become more expressive in front of others',
        labelZh: '学习如何成为全场焦点，提升表达底气',
        value: 'A',
        mapping: {
          direction: 'Individual',
          category: 'Skill Development',
          items: ['Effective Communications', 'Public Speaking', 'JCIM Inspire', 'Mentorship', 'Local Academy']
        }
      },
      {
        label: 'Meet 2–3 people who can directly help or collaborate with me on my career or business',
        labelZh: '结识2-3位能直接在事业上帮到我或合作的人',
        value: 'B',
        mapping: {
          direction: 'Business',
          category: 'Programs',
          items: ['JIB', 'CYEA', 'BCP', 'Networking Events', 'BSP Supercharge']
        }
      },
      {
        label: 'Observe how the event is organised and pick up leadership and management insights',
        labelZh: '观察别人是如何组织这场活动的，学习管理经验',
        value: 'C',
        mapping: {
          direction: 'Community',
          category: 'Projects',
          items: ['Project Management', 'Leadership Toolkit', 'Leaders School Program', 'Chairperson roles']
        }
      },
      {
        label: 'Make new friends from different backgrounds and step outside my usual social circle',
        labelZh: '认识一些不同背景的朋友，单纯跳出原有圈子',
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
    title: 'Which of these feels most frustrating in your current work or life?',
    titleZh: '在目前的工作或生活中，哪种感觉最让你困扰？',
    options: [
      {
        label: 'I have ideas but struggle to express them clearly or persuade others',
        labelZh: '有想法但说不出来，或者说服不了别人',
        value: 'A',
        mapping: {
          direction: 'Individual',
          category: 'Skill Development',
          items: ['Effective Meetings', 'Leadership', 'Training', 'Explore/Discover workshop', 'Leadership Summit']
        }
      },
      {
        label: 'My days feel repetitive and my perspective is getting narrower',
        labelZh: '每天重复劳动，感觉视野越来越窄',
        value: 'B',
        mapping: {
          direction: 'International',
          category: 'Projects',
          items: ['Zero Waste Campaign', 'SDA', 'UN SDGs', 'International Cross-border CSR', 'Area Academy']
        }
      },
      {
        label: "My network is too limited — I can't find the right people when I need advice",
        labelZh: '朋友圈太单一，遇到问题找不到专业人士请教',
        value: 'C',
        mapping: {
          direction: 'Business',
          category: 'Programs',
          items: ['JIB', 'CYE', 'BSP', 'Business growth platform', 'Networking Relationship capital']
        }
      },
      {
        label: "I want to do something meaningful but don't know where to start",
        labelZh: '想做点有意义的事，但不知道从哪开始上手',
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
    title: 'If you had a free weekend, how would you most like to spend it?',
    titleZh: '如果有一个周末，你更愿意如何度过？',
    options: [
      {
        label: 'Attending a hands-on training with practical takeaways and a certificate',
        labelZh: '参加一场能拿证书、有干货的实战训练营',
        value: 'A',
        mapping: {
          direction: 'Individual',
          category: 'Skill Development',
          items: ['Workshops', 'Skill mastery', 'JCIM Empower', 'Leadership Series', 'Skills-based training']
        }
      },
      {
        label: 'Planning and running a small project that creates real, visible community impact',
        labelZh: '策划并执行一个能落地、看得到社会反馈的小项目',
        value: 'B',
        mapping: {
          direction: 'Community',
          category: 'Projects',
          items: ['Result-oriented action', 'Leaders School', 'SDA project execution', 'Zero Waste']
        }
      },
      {
        label: 'Having dinner with entrepreneurs and executives to exchange business ideas',
        labelZh: '与一群创业者或高管共进晚餐，交换商业信息',
        value: 'C',
        mapping: {
          direction: 'Business',
          category: 'Programs',
          items: ['Networking', 'CYEA', 'Startup Pitch Night', 'JIB Biz Matching', 'BSP']
        }
      },
      {
        label: 'Travelling to another city or country to explore new perspectives',
        labelZh: '出发去另一个城市或国家，看看外面的世界',
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
    title: 'After one year in JCI, how would you most love others to describe you?',
    titleZh: '加入JCI一年后，你最希望别人怎么评价你？',
    options: [
      {
        label: '"You\'ve completely transformed — so much more confident and articulate now."',
        labelZh: '"你现在的谈吐和自信程度判若两人。"',
        value: 'A',
        mapping: {
          direction: 'Individual',
          category: 'Skill Development',
          items: ['Discover', 'Explore', 'Personal Transformation', 'TOYM', 'Public Speaking series']
        }
      },
      {
        label: '"Your business actually grew because of the connections you made here."',
        labelZh: '"你的事业因为这个平台得到了实际的增长。"',
        value: 'B',
        mapping: {
          direction: 'Business',
          category: 'Programs',
          items: ['Business growth & matching', 'JIB', 'CYEA', 'BSP Supercharge']
        }
      },
      {
        label: '"You led a team and pulled off something truly impressive."',
        labelZh: '"你成功带领团队完成了一个了不起的挑战。"',
        value: 'C',
        mapping: {
          direction: 'Community',
          category: 'Projects',
          items: ['Leadership & Execution', 'Project Chairperson', 'Leaders School', 'National platform recognition']
        }
      },
      {
        label: '"Your worldview has expanded — you think on a completely different level now."',
        labelZh: '"你的眼界变高了，看问题的维度完全不一样。"',
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
    title: 'If this community keeps delivering value, how many events or gatherings would you typically join per month?',
    titleZh: '如果这里能持续带给你价值，你认为自己平均每月愿意参与多少次活动或聚会？',
    options: [
      {
        label: 'Around 1 time (e.g. attend an event that interests me, meet new people, and learn about the organisation)',
        labelZh: '1次左右 (例如参加感兴趣的活动，认识新朋友和了解组织文化)',
        value: 'A',
        mapping: { direction: 'None', category: 'Engagement', items: ['Casual'] }
      },
      {
        label: '2–3 times (e.g. regularly join activities, gatherings, or learning sessions)',
        labelZh: '2-3次 (例如定期参与活动、聚会或学习交流)',
        value: 'B',
        mapping: { direction: 'None', category: 'Engagement', items: ['Active'] }
      },
      {
        label: '4–5 times (e.g. actively participate in various events and project planning to enrich my experience)',
        labelZh: '4-5次 (例如积极参与不同活动和项目筹办，丰富自己的体验)',
        value: 'C',
        mapping: { direction: 'None', category: 'Engagement', items: ['Core'] }
      },
      {
        label: 'As many as my schedule allows — I want to be fully involved',
        labelZh: '只要时间允许，我愿意参加更多',
        value: 'D',
        mapping: { direction: 'None', category: 'Engagement', items: ['All-in'] }
      }
    ]
  }
];

/** 
 * Wolf-like Competition System Logic Enums 
 * Designed to trigger psychological urgency (FOMO, Greed, Loss Aversion)
 */
export const BOUNTY_STATUS = {
  OPEN: 'Open',           // Waiting for a hunter
  CLAIMED: 'Claimed',     // Hunter working on it, points escrowed
  COMPLETED: 'Completed', // Success, points transferred
  DISPUTED: 'Disputed',   // Conflict, needs admin
  CANCELLED: 'Cancelled', // Refunded
} as const;

export const CONTRACT_STATUS = {
  ACTIVE: 'Active',       // Under commitment
  VERIFYING: 'Verifying', // Proof submitted
  FULFILLED: 'Fulfilled', // Reward granted
  FAILED: 'Failed',       // Penalty triggered (Loss Aversion)
  EXPIRED: 'Expired',
} as const;

export const OPPORTUNITY_URGENCY = {
  SCARCE: 'Scarce',     // < 3 slots
  LIMIT_REACHED: 'Full',
  ENDING_SOON: 'Ending', // < 24h
} as const;

/** Points Tiers with privilege descriptions */
export const MEMBER_PRIVILEGES = {
  BRONZE: ['Basic Community Access'],
  SILVER: ['Bounty Hunting Allowed', 'Business Directory Listing'],
  GOLD: ['Priority Opportunity Drops', 'Matching Service'],
  PLATINUM: ['Exclusive Boardroom Access', 'Global HQ Referral'],
} as const;

