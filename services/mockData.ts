import { Member, Event, Project, UserRole, MemberTier, DashboardStats, Notification, Transaction, BankAccount, InventoryItem, BusinessProfile, AutomationRule, HobbyClub, TrainingModule, Document, NewsPost, Task, Election, Proposal, Survey } from '../types';

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
  menteeIds: ['u3']
};

export const MOCK_STATS: DashboardStats = {
  totalMembers: 142,
  activeProjects: 8,
  upcomingEvents: 5,
  financialHealth: 88,
  monthlyGrowth: 4.5,
  duesCollectedPercentage: 78,
};

export const MOCK_MEMBERS: Member[] = [
  { ...CURRENT_USER },
  {
    id: 'u2',
    name: 'Sarah Chen',
    email: 'sarah.c@jci.local',
    role: UserRole.MEMBER,
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
    mentorId: 'u4'
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
    mentorId: 'u1'
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
    menteeIds: ['u1', 'u2']
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
  { id: 't1', date: '2023-12-01', description: 'Membership Dues - Batch 1', amount: 4500, type: 'Income', category: 'Dues', status: 'Cleared' },
  { id: 't2', date: '2023-12-02', description: 'Venue Deposit - AGM', amount: -1200, type: 'Expense', category: 'Event', status: 'Cleared' },
  { id: 't3', date: '2023-12-03', description: 'Sponsorship - Tech Corp', amount: 2000, type: 'Income', category: 'Sponsorship', status: 'Pending' },
  { id: 't4', date: '2023-12-05', description: 'Marketing Materials', amount: -350, type: 'Expense', category: 'Project', status: 'Cleared' },
];

export const MOCK_ACCOUNTS: BankAccount[] = [
  { id: 'ba1', name: 'Main Operations', balance: 12450.50, currency: 'USD', lastReconciled: '2023-11-30' },
  { id: 'ba2', name: 'Project Fund', balance: 5200.00, currency: 'USD', lastReconciled: '2023-11-30' },
];

export const MOCK_INVENTORY: InventoryItem[] = [
  { id: 'i1', name: 'JCI Banner Stand', category: 'Merchandise', quantity: 4, location: 'Storage A', status: 'Available', lastAudit: '2023-10-01' },
  { id: 'i2', name: 'Projector 4K', category: 'Electronics', quantity: 1, location: 'Meeting Room', status: 'Out of Stock', custodian: 'Jessica Day', lastAudit: '2023-11-15' },
  { id: 'i3', name: 'Event T-Shirts (L)', category: 'Merchandise', quantity: 15, location: 'Storage B', status: 'Low Stock', lastAudit: '2023-11-01' },
];

export const MOCK_BUSINESSES: BusinessProfile[] = [
  { id: 'bp1', memberId: 'u4', companyName: 'Day Strategies', industry: 'Consulting', description: 'Strategic business growth consulting for SMEs.', website: 'www.daystrategies.com', offer: 'Free 1hr Consultation', logo: 'https://placehold.co/100?text=DS' },
  { id: 'bp2', memberId: 'u2', companyName: 'Chen Events', industry: 'Events', description: 'Full service corporate event planning.', website: 'www.chenevents.com', offer: '10% Off Venue Booking', logo: 'https://placehold.co/100?text=CE' },
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

export const MOCK_ELECTIONS: Election[] = [
  {
    id: 'el1',
    title: '2024 Board Election',
    status: 'Active',
    endDate: '2023-12-20',
    candidates: [
      { id: 'c1', name: 'Sarah Chen', position: 'VP Membership', avatar: 'https://i.pravatar.cc/150?u=sarah' },
      { id: 'c2', name: 'Michael Ross', position: 'VP Membership', avatar: 'https://i.pravatar.cc/150?u=michael' },
      { id: 'c3', name: 'Alex Rivera', position: 'Secretary', avatar: 'https://i.pravatar.cc/150?u=alex' }
    ]
  },
  {
    id: 'el2',
    title: 'Local President 2024',
    status: 'Completed',
    endDate: '2023-11-15',
    candidates: [
      { id: 'c4', name: 'Jessica Day', position: 'President', avatar: 'https://i.pravatar.cc/150?u=jessica' }
    ]
  }
];

export const MOCK_PROPOSALS: Proposal[] = [
  {
    id: 'pr1',
    title: 'Increase Annual Dues by 10%',
    description: 'To cover rising venue costs and inflation, we propose increasing annual membership dues from $150 to $165 effective Jan 1st.',
    submittedBy: 'Jessica Day (Treasurer)',
    status: 'Voting',
    votes: { for: 45, against: 12, abstain: 5 }
  },
  {
    id: 'pr2',
    title: 'Adopt New Logo for Local Chapter',
    description: 'Update our local logo to align with the new national branding guidelines released last month.',
    submittedBy: 'Alex Rivera',
    status: 'Approved',
    votes: { for: 80, against: 2, abstain: 0 }
  }
];

export const MOCK_SURVEYS: Survey[] = [
  {
    id: 's1',
    title: 'Member Satisfaction Survey 2023',
    description: 'Help us improve by sharing your feedback on this year\'s events and projects.',
    status: 'Active',
    deadline: '2023-12-31',
    responses: 82,
    targetAudience: 'All Members'
  },
  {
    id: 's2',
    title: 'Project Preference Poll',
    description: 'Which community project should we prioritize for Q1 2024?',
    status: 'Closed',
    deadline: '2023-11-30',
    responses: 115,
    targetAudience: 'Active Members'
  }
];