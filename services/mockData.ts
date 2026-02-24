import { Member, Event, Project, UserRole, MemberTier, DashboardStats, Notification, Transaction, BankAccount, PaymentRequest, InventoryItem, BusinessProfile, AutomationRule, HobbyClub, TrainingModule, Document, NewsPost, Task, Survey, DuesRenewalTransaction, MembershipType, ProjectFinancialAccount, ProjectTransaction, BudgetCategory, AlertThreshold } from '../types';

export const CURRENT_USER: Member = {
  id: 'u1',
  name: 'Alex Rivera',
  email: 'alex.rivera@jci.local',
  role: UserRole.BOARD,
  tier: MemberTier.GOLD,
  points: 1250,
  joinDate: '2021-05-15',
  avatar: 'https://i.pravatar.cc/150?u=alex',
  skills: ['Leadership', 'Marketing', 'Public Speaking'],
  churnRisk: 'Low',
  attendanceRate: 92,
  duesStatus: 'Paid',
  badges: [
    { id: 'b1', name: 'Project Lead', icon: '🚀', description: 'Led a successful project' },
    { id: 'b2', name: 'Super Recruiter', icon: '🤝', description: 'Recruited 5+ members' }
  ],
  bio: 'Passionate about community development and digital transformation. Serving as VP Growth for 2024.',
  phone: '+1 (555) 123-4567',
  careerHistory: [
    { year: '2021', role: 'Member', description: 'Joined the local chapter.' },
    { year: '2022', role: 'Project Director', description: 'Led the "Green City" initiative.' },
    { year: '2023', role: 'Secretary', description: 'Managed chapter administration.' }
  ],
  mentorId: 'u4',
  menteeIds: ['u3'],
  membershipType: 'Full'
};

export const MOCK_STATS: DashboardStats = {
  totalMembers: 142,
  activeProjects: 8,
  upcomingEvents: 5,
  financialHealth: 88,
  monthlyGrowth: 4.5,
  duesCollectedPercentage: 78,
};

/** admin@jcikl.com 完整会员数据（dev login 使用） */
export const MOCK_DEV_ADMIN: Member = {
  id: 'dev-admin-001',
  name: 'Admin User',
  email: 'admin@jcikl.com',
  role: UserRole.ADMIN,
  tier: MemberTier.PLATINUM,
  points: 5000,
  joinDate: '2020-01-15',
  avatar: 'https://ui-avatars.com/api/?name=Admin+User&background=0097D7&color=fff',
  skills: ['Leadership', 'Management', 'Development', 'Public Speaking'],
  churnRisk: 'Low',
  attendanceRate: 100,
  duesStatus: 'Paid',
  badges: [
    { id: 'b-admin-1', name: 'Chapter Admin', icon: '🛡️', description: 'System administrator' },
    { id: 'b-admin-2', name: 'Leadership', icon: '⭐', description: 'Board member' },
  ],
  bio: 'JCI Local Organization administrator. Passionate about community development and digital transformation.',
  phone: '+60 12-345 6789',
  alternatePhone: '+60 12-345 6788',
  membershipType: 'Full',
  duesYear: 2024,
  duesPaidDate: '2024-01-10',
  mentorId: undefined,
  menteeIds: ['u1', 'u2', 'u3'],
  careerHistory: [
    { year: '2020', role: 'Member', description: 'Joined the chapter' },
    { year: '2021', role: 'VP Technology', description: 'Led digital initiatives' },
    { year: '2022', role: 'Secretary', description: 'Chapter administration' },
    { year: '2023', role: 'Admin', description: 'System administration' },
  ],
  // Basic Information
  fullName: 'Admin User',
  idNumber: 'A12345678',
  gender: 'Male',
  ethnicity: 'Chinese',
  nationality: 'Malaysia',
  dateOfBirth: '1990-05-20',
  hobbies: ['Leadership', 'Public Speaking', 'Reading', 'Travelling'],
  // Professional & Business
  companyName: 'JCI Local Organization',
  companyWebsite: 'https://jci.local',
  departmentAndPosition: 'Administration / System Admin',
  industry: 'Non-Profit',
  acceptInternationalBusiness: 'Yes',
  businessCategory: ['Community Service'],
  // Contact Information
  address: '123 JCI Street, Kuala Lumpur, Malaysia',
  linkedin: 'https://linkedin.com/in/admin-user',
  facebook: 'https://facebook.com/admin.user',
  instagram: 'https://instagram.com/admin.user',
  wechat: 'admin_wechat',
  emergencyContactName: 'Emergency Contact',
  emergencyContactPhone: '+60 12-999 8888',
  emergencyContactRelationship: 'Spouse',
  // Apparel & Items
  cutStyle: 'Unisex',
  tshirtSize: 'L',
  jacketSize: 'L',
  embroideredName: 'Admin',
  tshirtStatus: 'Received',
};

export const MOCK_MEMBERS: Member[] = [
  { ...CURRENT_USER },
  { ...MOCK_DEV_ADMIN },
  {
    id: 'u2',
    name: 'Sarah Chen',
    email: 'sarah.c@jci.local',
    role: UserRole.PROBATION_MEMBER,
    tier: MemberTier.SILVER,
    points: 850,
    joinDate: '2022-02-10',
    avatar: 'https://i.pravatar.cc/150?u=sarah',
    skills: ['Finance', 'Event Planning'],
    churnRisk: 'Low',
    attendanceRate: 85,
    duesStatus: 'Paid',
    badges: [{ id: 'b3', name: 'Early Bird', icon: '🐦', description: 'Paid dues in Jan' }],
    careerHistory: [
      { year: '2022', role: 'Member', description: 'Joined' },
      { year: '2023', role: 'Committee Chair', description: 'Finance Committee' }
    ],
    mentorId: 'u4',
    membershipType: 'Probation'
  },
  {
    id: 'u3',
    name: 'Michael Ross',
    email: 'm.ross@jci.local',
    role: UserRole.MEMBER,
    tier: MemberTier.BRONZE,
    points: 120,
    joinDate: '2023-11-01',
    avatar: 'https://i.pravatar.cc/150?u=michael',
    skills: ['Web Dev'],
    churnRisk: 'High',
    attendanceRate: 40,
    duesStatus: 'Overdue',
    badges: [],
    mentorId: 'u1',
    membershipType: 'Probation'
  },
  {
    id: 'u4',
    name: 'Jessica Day',
    email: 'jess.day@jci.local',
    role: UserRole.BOARD,
    tier: MemberTier.PLATINUM,
    points: 2100,
    joinDate: '2019-03-12',
    avatar: 'https://i.pravatar.cc/150?u=jessica',
    skills: ['Strategy', 'Mentorship', 'Sales'],
    churnRisk: 'Low',
    attendanceRate: 98,
    duesStatus: 'Paid',
    badges: [
      { id: 'b1', name: 'Project Lead', icon: '🚀', description: 'Led a successful project' },
      { id: 'b4', name: 'Mentor', icon: '🎓', description: 'Mentored 3 members' }
    ],
    careerHistory: [
      { year: '2019', role: 'Member', description: 'Joined' },
      { year: '2020', role: 'VP Community', description: 'Best VP Award' },
      { year: '2021', role: 'President', description: 'Chapter of the Year' }
    ],
    menteeIds: ['u1', 'u2'],
    membershipType: 'Full'
  },
];

export const MOCK_EVENTS: Event[] = [
  { id: 'e1', title: 'Annual General Meeting', date: '2023-12-15T18:00:00', type: 'Meeting', attendees: 85, maxAttendees: 150, status: 'Upcoming', predictedDemand: 'High', location: 'Grand Hall' },
  { id: 'e2', title: 'Public Speaking Masterclass', date: '2023-12-20T10:00:00', type: 'Training', attendees: 24, maxAttendees: 30, status: 'Upcoming', predictedDemand: 'Medium', location: 'Room 3B' },
  { id: 'e3', title: 'Community Clean-up', date: '2024-01-05T08:00:00', type: 'Project', attendees: 45, status: 'Upcoming', predictedDemand: 'Low', location: 'Central Park' },
  { id: 'e4', title: 'Networking Night', date: '2023-11-30T19:00:00', type: 'Social', attendees: 110, status: 'Completed', location: 'The Rooftop Bar' },
];

export const MOCK_PROJECTS: Project[] = [
  { id: 'p1', name: 'Youth Mentorship 2024', lead: 'Jessica Day', status: 'Active', budget: 5000, spent: 2100, completion: 45, teamSize: 12, description: 'Connecting high school students with industry leaders.' },
  { id: 'p2', name: 'Business Expo', lead: 'Alex Rivera', status: 'Planning', budget: 15000, spent: 500, completion: 10, teamSize: 8, description: 'Annual showcase of local businesses.' },
  { id: 'p3', name: 'Tech for Good', lead: 'Michael Ross', status: 'Review', budget: 2000, spent: 1950, completion: 95, teamSize: 4, description: 'Refurbishing laptops for schools.' },
];

export const MOCK_NOTIFICATIONS: Notification[] = [
  { id: 'n1', title: 'Churn Risk Alert', message: 'Michael Ross has missed 3 consecutive meetings. Suggested action: Assign mentor.', type: 'ai', read: false, timestamp: '2h ago' },
  { id: 'n2', title: 'Budget Approval', message: 'Business Expo budget approved by Treasurer.', type: 'success', read: false, timestamp: '5h ago' },
  { id: 'n3', title: 'Membership Dues', message: 'Automatic renewal processing started for 2024. 78% collected.', type: 'info', read: true, timestamp: '1d ago' },
];

export const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 't1',
    date: '2023-12-01',
    description: 'Membership Dues - Batch 1',
    amount: 4500,
    type: 'Income',
    category: 'Membership',
    status: 'Cleared',
    bankAccountId: 'ba1',
    referenceNumber: 'PR-default-lo-20231201-001',
    paymentRequestId: 'pr-mock-001',
    memberId: 'u1',
  },
  {
    id: 't2',
    date: '2026-12-02',
    description: 'Venue Deposit - AGM',
    purpose: 'AGM venue deposit',
    amount: -1200,
    type: 'Expense',
    category: 'Administrative',
    status: 'Cleared',
    bankAccountId: 'ba1',
    referenceNumber: 'PR-default-lo-20231202-001',
    paymentRequestId: 'pr-mock-002',
  },
  {
    id: 't3',
    date: '2023-12-03',
    description: 'Sponsorship - Tech Corp',
    amount: 2000,
    type: 'Income',
    category: 'Projects & Activities',
    status: 'Pending',
    bankAccountId: 'ba1',
    referenceNumber: 'PR-default-lo-20231203-001',
  },
  {
    id: 't4',
    date: '2023-12-05',
    description: 'Marketing Materials',
    purpose: 'Office supplies',
    amount: -350,
    type: 'Expense',
    category: 'Projects & Activities',
    status: 'Cleared',
    bankAccountId: 'ba2',
    referenceNumber: 'PR-default-lo-20231205-001',
    paymentRequestId: 'pr-mock-003',
  },
  {
    id: 't5',
    date: '2025-12-06',
    description: 'Dues - Sarah Chen',
    amount: 300,
    type: 'Income',
    category: 'Membership',
    status: 'Reconciled',
    bankAccountId: 'ba1',
    referenceNumber: 'PR-default-lo-20231206-002',
    paymentRequestId: 'pr-mock-004',
    memberId: 'u2',
    reconciledAt: '2023-12-07',
    reconciledBy: 'u1',
  },
];

export const MOCK_ACCOUNTS: BankAccount[] = [
  {
    id: 'ba1',
    name: 'Main Operations',
    balance: 12450.5,
    initialBalance: 10000.0,
    currency: 'MYR',
    lastReconciled: '2023-11-30',
    accountNumber: '1234567890',
    bankName: 'Maybank',
    accountType: 'Current',
  },
  {
    id: 'ba2',
    name: 'Project Fund',
    balance: 5200.0,
    initialBalance: 5000.0,
    currency: 'MYR',
    lastReconciled: '2023-11-30',
    accountNumber: '9876543210',
    bankName: 'CIMB',
    accountType: 'Savings',
  },
];

const DEFAULT_LO_ID = 'default-lo';

/** Payment Requests mock – references MOCK_MEMBERS (applicantId/applicantName) and aligns with MOCK_TRANSACTIONS (referenceNumber / paymentRequestId). */
export const MOCK_PAYMENT_REQUESTS: PaymentRequest[] = [
  {
    id: 'pr-mock-001',
    applicantId: 'u1',
    applicantName: 'Alex Rivera',
    date: '2023-12-01',
    time: '09:00',
    category: 'administrative',
    totalAmount: 4500,
    items: [{ purpose: 'Membership Dues - Batch 1', amount: 4500 }],
    amount: 4500,
    purpose: 'Membership Dues - Batch 1',
    activityRef: null,
    referenceNumber: 'PR-default-lo-20231201-001',
    status: 'approved',
    loId: DEFAULT_LO_ID,
    createdAt: '2023-12-01T09:00:00.000Z',
    updatedAt: '2023-12-01T10:30:00.000Z',
    updatedBy: 'u1',
    reviewedBy: 'u1',
    reviewedAt: '2023-12-01T10:30:00.000Z',
  },
  {
    id: 'pr-mock-002',
    applicantId: 'u1',
    applicantName: 'Alex Rivera',
    date: '2023-12-02',
    time: '08:00',
    category: 'administrative',
    totalAmount: 1200,
    items: [{ purpose: 'Venue Deposit - AGM', amount: 1200 }],
    amount: 1200,
    purpose: 'Venue Deposit - AGM',
    activityRef: 'evt-agm-2023',
    referenceNumber: 'PR-default-lo-20231202-001',
    status: 'approved',
    loId: DEFAULT_LO_ID,
    createdAt: '2023-12-02T08:00:00.000Z',
    updatedAt: '2023-12-02T14:00:00.000Z',
    updatedBy: 'u1',
    reviewedBy: 'u1',
    reviewedAt: '2023-12-02T14:00:00.000Z',
  },
  {
    id: 'pr-mock-003',
    applicantId: 'u2',
    applicantName: 'Sarah Chen',
    date: '2023-12-03',
    time: '11:00',
    category: 'projects_activities',
    totalAmount: 2000,
    items: [{ purpose: 'Sponsorship - Tech Corp', amount: 2000 }],
    amount: 2000,
    purpose: 'Sponsorship - Tech Corp',
    activityRef: 'Business Expo 2023',
    referenceNumber: 'PR-default-lo-20231203-001',
    status: 'submitted',
    loId: DEFAULT_LO_ID,
    createdAt: '2023-12-03T11:00:00.000Z',
    updatedAt: '2023-12-03T11:00:00.000Z',
    updatedBy: 'u2',
    reviewedBy: null,
    reviewedAt: null,
  },
  {
    id: 'pr-mock-004',
    applicantId: 'u2',
    applicantName: 'Sarah Chen',
    date: '2023-12-05',
    time: '09:30',
    category: 'projects_activities',
    totalAmount: 350,
    items: [{ purpose: 'Marketing Materials', amount: 350 }],
    amount: 350,
    purpose: 'Marketing Materials',
    activityRef: 'Green City Project',
    referenceNumber: 'PR-default-lo-20231205-001',
    status: 'approved',
    loId: DEFAULT_LO_ID,
    createdAt: '2023-12-05T09:30:00.000Z',
    updatedAt: '2023-12-05T16:00:00.000Z',
    updatedBy: 'u2',
    reviewedBy: 'u1',
    reviewedAt: '2023-12-05T16:00:00.000Z',
  },
  {
    id: 'pr-mock-005',
    applicantId: 'u2',
    applicantName: 'Sarah Chen',
    date: '2025-12-06',
    time: '10:00',
    category: 'administrative',
    totalAmount: 300,
    items: [{ purpose: 'Dues - Sarah Chen', amount: 300 }],
    amount: 300,
    purpose: 'Dues - Sarah Chen',
    activityRef: null,
    referenceNumber: 'PR-default-lo-20231206-002',
    status: 'approved',
    loId: DEFAULT_LO_ID,
    createdAt: '2025-12-06T10:00:00.000Z',
    updatedAt: '2025-12-07T09:00:00.000Z',
    updatedBy: 'u2',
    reviewedBy: 'u1',
    reviewedAt: '2025-12-07T09:00:00.000Z',
  },
  {
    id: 'pr-mock-006',
    applicantId: 'u3',
    applicantName: 'Michael Ross',
    date: '2023-12-10',
    time: '14:00',
    category: 'projects_activities',
    totalAmount: 500,
    items: [{ purpose: 'Workshop materials - Leadership 101', amount: 500 }],
    amount: 500,
    purpose: 'Workshop materials - Leadership 101',
    activityRef: 'Leadership 101 Workshop',
    referenceNumber: 'PR-default-lo-20231210-001',
    status: 'submitted',
    loId: DEFAULT_LO_ID,
    createdAt: '2023-12-10T14:00:00.000Z',
    updatedAt: '2023-12-10T14:00:00.000Z',
    updatedBy: 'u3',
    reviewedBy: null,
    reviewedAt: null,
  },
  {
    id: 'pr-mock-007',
    applicantId: 'u4',
    applicantName: 'Jessica Day',
    date: '2023-12-08',
    time: '12:00',
    category: 'administrative',
    totalAmount: 800,
    items: [{ purpose: 'Catering - Board dinner', amount: 800 }],
    amount: 800,
    purpose: 'Catering - Board dinner',
    activityRef: null,
    referenceNumber: 'PR-default-lo-20231208-001',
    status: 'rejected',
    loId: DEFAULT_LO_ID,
    createdAt: '2023-12-08T12:00:00.000Z',
    updatedAt: '2023-12-09T10:00:00.000Z',
    updatedBy: 'u4',
    reviewedBy: 'u1',
    reviewedAt: '2023-12-09T10:00:00.000Z',
  },
];

/** 会费管理 mock：会费续费/新会员缴费记录，与 MOCK_MEMBERS 对应 */
const DUES_YEAR = 2024;
const DUE_DATE = `${DUES_YEAR}-03-31`;

export const MOCK_DUES_RENEWAL_TRANSACTIONS: DuesRenewalTransaction[] = [
  {
    id: 'dues-1',
    memberId: 'u1',
    membershipType: 'Full' as MembershipType,
    duesYear: DUES_YEAR,
    amount: 300,
    status: 'paid',
    dueDate: DUE_DATE,
    paidDate: '2024-02-15',
    isRenewal: true,
    createdAt: '2024-01-10T09:00:00.000Z',
    updatedAt: '2024-02-15T10:00:00.000Z',
    remindersSent: 0,
  },
  {
    id: 'dues-2',
    memberId: 'u2',
    membershipType: 'Full' as MembershipType,
    duesYear: DUES_YEAR,
    amount: 300,
    status: 'paid',
    dueDate: DUE_DATE,
    paidDate: '2024-03-01',
    isRenewal: true,
    createdAt: '2024-01-10T09:00:00.000Z',
    updatedAt: '2024-03-01T11:00:00.000Z',
    remindersSent: 1,
  },
  {
    id: 'dues-3',
    memberId: 'u3',
    membershipType: 'Probation' as MembershipType,
    duesYear: DUES_YEAR,
    amount: 350,
    status: 'pending',
    dueDate: DUE_DATE,
    isRenewal: false,
    createdAt: '2024-01-12T09:00:00.000Z',
    updatedAt: '2024-01-12T09:00:00.000Z',
    remindersSent: 2,
    lastReminderDate: '2024-03-10',
  },
  {
    id: 'dues-4',
    memberId: 'u4',
    membershipType: 'Full' as MembershipType,
    duesYear: DUES_YEAR,
    amount: 300,
    status: 'paid',
    dueDate: DUE_DATE,
    paidDate: '2024-01-20',
    isRenewal: true,
    createdAt: '2024-01-10T09:00:00.000Z',
    updatedAt: '2024-01-20T09:00:00.000Z',
    remindersSent: 0,
  },
  {
    id: 'dues-5',
    memberId: 'u1',
    membershipType: 'Full' as MembershipType,
    duesYear: 2025,
    amount: 300,
    status: 'pending',
    dueDate: '2025-03-31',
    isRenewal: true,
    createdAt: '2025-01-05T09:00:00.000Z',
    updatedAt: '2025-01-05T09:00:00.000Z',
    remindersSent: 0,
  },
  {
    id: 'dues-6',
    memberId: 'u2',
    membershipType: 'Full' as MembershipType,
    duesYear: 2025,
    amount: 300,
    status: 'overdue',
    dueDate: '2025-03-31',
    isRenewal: true,
    createdAt: '2025-01-05T09:00:00.000Z',
    updatedAt: '2025-01-05T09:00:00.000Z',
    remindersSent: 3,
    lastReminderDate: '2025-04-05',
  },
];

export const MOCK_INVENTORY: InventoryItem[] = [
  { id: 'i1', name: 'JCI Banner Stand', category: 'Merchandise', quantity: 4, location: 'Storage A', status: 'Available', lastAudit: '2023-10-01' },
  { id: 'i2', name: 'Projector 4K', category: 'Electronics', quantity: 1, location: 'Meeting Room', status: 'Out of Stock', custodian: 'Jessica Day', lastAudit: '2023-11-15' },
  { id: 'i3', name: 'Event T-Shirts (L)', category: 'Merchandise', quantity: 15, location: 'Storage B', status: 'Low Stock', lastAudit: '2023-11-01' },
];

export const MOCK_BUSINESSES: BusinessProfile[] = [
  { id: 'bp1', memberId: 'u4', companyName: 'Day Strategies', industry: 'Consulting', businessCategory: 'B2B Services', acceptsInternationalBusiness: 'Yes', description: 'Strategic business growth consulting for SMEs.', website: 'www.daystrategies.com', offer: 'Free 1hr Consultation', logo: 'https://placehold.co/100?text=DS' },
  { id: 'bp2', memberId: 'u2', companyName: 'Chen Events', industry: 'Events', businessCategory: 'Corporate Events', acceptsInternationalBusiness: 'Willing to Explore', description: 'Full service corporate event planning.', website: 'www.chenevents.com', offer: '10% Off Venue Booking', logo: 'https://placehold.co/100?text=CE' },
];

export const MOCK_AUTOMATION_RULES: AutomationRule[] = [
  { id: 'ar1', name: 'New Member Onboarding', trigger: 'Member Registered', action: 'Send Welcome Kit + Assign Buddy', active: true, executions: 12 },
  { id: 'ar2', name: 'Dues Late Penalty', trigger: 'Dues Overdue > 30 Days', action: 'Suspend Voting Rights + Email Treasurer', active: true, executions: 3 },
  { id: 'ar3', name: 'Event Gold Tier', trigger: 'Event Attendance > 10', action: 'Upgrade Tier to Silver', active: false, executions: 0 },
];

export const MOCK_CLUBS: HobbyClub[] = [
  { id: 'hc1', name: 'JCI Runners', category: 'Sports', membersCount: 18, nextActivity: 'Morning 5K - Sat 7am', lead: 'Sarah Chen', image: 'https://placehold.co/200/orange/white?text=Run' },
  { id: 'hc2', name: 'Public Speaking Club', category: 'Professional', membersCount: 42, nextActivity: 'Toastmasters Night - Thu 7pm', lead: 'Alex Rivera', image: 'https://placehold.co/200/blue/white?text=Speak' },
  { id: 'hc3', name: 'Foodie Group', category: 'Social', membersCount: 25, nextActivity: 'Sushi Making - Fri 6pm', lead: 'Jessica Day', image: 'https://placehold.co/200/purple/white?text=Food' },
];

export const MOCK_TRAININGS: TrainingModule[] = [
  { id: 'tm1', title: 'JCI Admin', type: 'JCI Official', duration: '3h', completionStatus: 'Completed', pointsReward: 100, image: 'https://placehold.co/100?text=Admin' },
  { id: 'tm2', title: 'JCI Discover', type: 'JCI Official', duration: '4h', completionStatus: 'In Progress', pointsReward: 150, image: 'https://placehold.co/100?text=Discover' },
  { id: 'tm3', title: 'Project Management Fund.', type: 'Local Skill', duration: '2h', completionStatus: 'Not Started', pointsReward: 80, image: 'https://placehold.co/100?text=PM' },
];

export const MOCK_DOCUMENTS: Document[] = [
  { id: 'd1', name: 'LO_Constitution_2023.pdf', type: 'PDF', category: 'Policy', uploadedDate: '2023-01-15', size: '2.4 MB' },
  { id: 'd2', name: 'Dec_Board_Minutes.pdf', type: 'PDF', category: 'Meeting Minutes', uploadedDate: '2023-12-05', size: '0.5 MB' },
  { id: 'd3', name: 'Event_Budget_Template.xlsx', type: 'XLS', category: 'Template', uploadedDate: '2023-06-10', size: '0.1 MB' },
];

export const MOCK_POSTS: NewsPost[] = [
  { id: 'post1', author: { name: 'Jessica Day', avatar: 'https://i.pravatar.cc/150?u=jessica', role: 'President' }, content: 'Big congratulations to the Tech for Good team for hitting 95% completion! 🚀 Only a few laptops left to refurbish.', timestamp: '2 hours ago', likes: 24, comments: 5, type: 'Update' },
  { id: 'post2', author: { name: 'System Bot', avatar: '', role: 'Automated' }, content: '🔔 Event Reminder: Public Speaking Masterclass starts tomorrow at 10:00 AM. 3 spots remaining!', timestamp: '5 hours ago', likes: 0, comments: 0, type: 'Announcement' },
];

export const MOCK_TASKS: Task[] = [
  { id: 't1', projectId: 'p1', title: 'Recruit mentors', status: 'In Progress', priority: 'High', dueDate: '2024-01-15', assignee: 'Jessica Day' },
  { id: 't2', projectId: 'p1', title: 'Finalize curriculum', status: 'Todo', priority: 'Medium', dueDate: '2024-02-01', assignee: 'Alex Rivera' },
  { id: 't3', projectId: 'p2', title: 'Book venue', status: 'Done', priority: 'High', dueDate: '2023-11-01', assignee: 'Sarah Chen' },
  { id: 't4', projectId: 'p2', title: 'Sponsor outreach', status: 'In Progress', priority: 'High', dueDate: '2023-12-10', assignee: 'Alex Rivera' },
  { id: 't5', projectId: 'p3', title: 'Collect laptops', status: 'Done', priority: 'Medium', dueDate: '2023-11-20', assignee: 'Michael Ross' },
];

export const MOCK_SURVEYS: Survey[] = [
  {
    id: 's1',
    title: 'Member Satisfaction Survey 2023',
    description: 'Help us improve by sharing your feedback on this year\'s events and projects.',
    status: 'Active',
    startDate: '2023-01-01',
    endDate: '2023-12-31',
    responsesCount: 82,
    targetAudience: 'All Members',
    questions: [],
    createdBy: 'admin',
    createdAt: '2023-01-01'
  },
  {
    id: 's2',
    title: 'Project Preference Poll',
    description: 'Which community project should we prioritize for Q1 2024?',
    status: 'Closed',
    startDate: '2023-11-01',
    endDate: '2023-11-30',
    responsesCount: 115,
    targetAudience: 'All Members',
    questions: [],
    createdBy: 'admin',
    createdAt: '2023-11-01'
  }
];

export const MOCK_PROJECT_FINANCIAL_ACCOUNTS: ProjectFinancialAccount[] = [
  {
    id: 'pa1',
    projectId: 'p1',
    projectName: 'Youth Mentorship 2024',
    budget: 5000,
    startingBalance: 5000,
    currentBalance: 3900,
    totalIncome: 1000,
    totalExpenses: 2100,
    budgetCategories: [
      { id: 'cat1', name: 'Venue', allocatedAmount: 1500, spentAmount: 1200, color: '#4F46E5' },
      { id: 'cat2', name: 'Marketing', allocatedAmount: 1000, spentAmount: 500, color: '#10B981' },
      { id: 'cat3', name: 'Catering', allocatedAmount: 2000, spentAmount: 400, color: '#F59E0B' },
      { id: 'cat4', name: 'Admin', allocatedAmount: 500, spentAmount: 0, color: '#6B7280' }
    ],
    alertThresholds: [
      { id: 'at1', type: 'budget_warning', threshold: 80, enabled: true, notificationMethod: 'both' }
    ],
    createdAt: '2023-12-01T10:00:00Z',
    updatedAt: '2024-01-15T14:30:00Z',
    createdBy: 'u4'
  },
  {
    id: 'pa2',
    projectId: 'p2',
    projectName: 'Business Expo',
    budget: 15000,
    startingBalance: 15000,
    currentBalance: 16500,
    totalIncome: 2000,
    totalExpenses: 500,
    budgetCategories: [
      { id: 'cat5', name: 'Booth Construction', allocatedAmount: 8000, spentAmount: 0, color: '#3B82F6' },
      { id: 'cat6', name: 'Guest Speakers', allocatedAmount: 4000, spentAmount: 500, color: '#8B5CF6' },
      { id: 'cat7', name: 'Promotion', allocatedAmount: 3000, spentAmount: 0, color: '#EC4899' }
    ],
    alertThresholds: [],
    createdAt: '2023-11-15T09:00:00Z',
    updatedAt: '2023-12-20T11:00:00Z',
    createdBy: 'u1'
  },
  {
    id: 'pa3',
    projectId: 'p3',
    projectName: 'Tech for Good',
    budget: 2000,
    startingBalance: 2000,
    currentBalance: 50,
    totalIncome: 0,
    totalExpenses: 1950,
    budgetCategories: [
      { id: 'cat8', name: 'Hardware Parts', allocatedAmount: 1500, spentAmount: 1450, color: '#EF4444' },
      { id: 'cat9', name: 'Logistics', allocatedAmount: 500, spentAmount: 500, color: '#F97316' }
    ],
    alertThresholds: [
      { id: 'at2', type: 'budget_exceeded', threshold: 100, enabled: true, notificationMethod: 'in_app' }
    ],
    createdAt: '2023-10-20T08:00:00Z',
    updatedAt: '2023-12-30T16:00:00Z',
    createdBy: 'u3'
  }
];

export const MOCK_PROJECT_TRANSACTIONS: ProjectTransaction[] = [
  {
    id: 'pt1',
    projectId: 'p1',
    financialAccountId: 'pa1',
    type: 'income',
    amount: 1000,
    categoryId: undefined,
    description: 'Corporate Sponsorship - Matrix Ltd',
    date: '2024-01-05',
    createdBy: 'u4',
    createdAt: '2024-01-05T11:00:00Z'
  },
  {
    id: 'pt2',
    projectId: 'p1',
    financialAccountId: 'pa1',
    type: 'expense',
    amount: 1200,
    categoryId: 'cat1',
    description: 'Early Bird Venue Payment',
    date: '2024-01-10',
    createdBy: 'u4',
    createdAt: '2024-01-10T15:00:00Z'
  },
  {
    id: 'pt3',
    projectId: 'p1',
    financialAccountId: 'pa1',
    type: 'expense',
    amount: 400,
    categoryId: 'cat3',
    description: 'Refreshments for committee meeting',
    date: '2024-01-12',
    createdBy: 'u4',
    createdAt: '2024-01-12T17:30:00Z'
  },
  {
    id: 'pt4',
    projectId: 'p2',
    financialAccountId: 'pa2',
    type: 'income',
    amount: 2000,
    description: 'Booth Rental Deposit - Vendor A',
    date: '2023-12-01',
    createdBy: 'u1',
    createdAt: '2023-12-01T14:00:00Z'
  },
  {
    id: 'pt5',
    projectId: 'p2',
    financialAccountId: 'pa2',
    type: 'expense',
    amount: 500,
    categoryId: 'cat6',
    description: 'Speaker Honorarium Downpayment',
    date: '2023-12-15',
    createdBy: 'u1',
    createdAt: '2023-12-15T10:00:00Z'
  }
];