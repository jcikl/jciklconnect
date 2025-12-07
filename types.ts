// types.ts

export enum UserRole {
  GUEST = 'GUEST',
  MEMBER = 'MEMBER',
  BOARD = 'BOARD',
  ADMIN = 'ADMIN'
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

export interface CareerMilestone {
  year: string;
  role: string;
  description: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tier: MemberTier;
  points: number;
  joinDate: string;
  avatar: string;
  skills: string[];
  churnRisk: 'Low' | 'Medium' | 'High';
  attendanceRate: number;
  duesStatus: 'Paid' | 'Pending' | 'Overdue';
  badges: Badge[];
  // New fields for Deep Profiling
  bio?: string;
  phone?: string;
  careerHistory?: CareerMilestone[];
  mentorId?: string; // ID of their mentor
  menteeIds?: string[]; // IDs of members they mentor
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
}

export interface InventoryItem {
  id: string;
  name: string;
  category: 'Electronics' | 'Furniture' | 'Merchandise' | 'Stationery';
  quantity: number;
  location: string;
  status: 'Available' | 'Low Stock' | 'Out of Stock';
  lastAudit: string;
  custodian?: string;
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
  date: string;
  type: 'Meeting' | 'Training' | 'Social' | 'Project' | 'International';
  attendees: number;
  maxAttendees?: number;
  status: 'Upcoming' | 'Completed' | 'Cancelled';
  predictedDemand?: 'Low' | 'Medium' | 'High'; // AI Feature
  location: string;
}

export interface Project {
  id: string;
  name: string;
  lead: string;
  status: 'Planning' | 'Active' | 'Completed' | 'Review';
  budget: number;
  spent: number;
  completion: number;
  teamSize: number;
  description?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'ai';
  read: boolean;
  timestamp: string;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'Income' | 'Expense';
  category: 'Dues' | 'Event' | 'Project' | 'Admin' | 'Sponsorship';
  status: 'Pending' | 'Cleared';
}

export interface BankAccount {
  id: string;
  name: string;
  balance: number;
  currency: string;
  lastReconciled: string;
}

export interface DashboardStats {
  totalMembers: number;
  activeProjects: number;
  upcomingEvents: number;
  financialHealth: number; // Percentage
  monthlyGrowth: number;
  duesCollectedPercentage: number;
}

export interface HobbyClub {
  id: string;
  name: string;
  category: 'Sports' | 'Social' | 'Professional' | 'Arts';
  membersCount: number;
  nextActivity?: string;
  lead: string;
  image: string;
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
  id: string;
  projectId: string;
  title: string;
  status: 'Todo' | 'In Progress' | 'Done';
  priority: 'High' | 'Medium' | 'Low';
  dueDate: string;
  assignee: string;
}

export interface Candidate {
  id: string;
  name: string;
  position: string;
  avatar: string;
}

export interface Election {
  id: string;
  title: string;
  status: 'Active' | 'Completed' | 'Upcoming';
  endDate: string;
  candidates: Candidate[];
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
}

export interface Survey {
  id: string;
  title: string;
  description: string;
  status: 'Active' | 'Closed';
  deadline: string;
  responses: number;
  targetAudience: string;
}