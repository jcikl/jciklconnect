import { ProjectCommitteeMember } from './project';

export interface Event {
  id: string;
  title: string;
  description?: string;
  date: string;
  endDate?: string;
  time?: string;
  endTime?: string;
  type: 'Meeting' | 'Training' | 'Social' | 'Project' | 'International';
  attendees: number;
  maxAttendees?: number;
  status: 'Upcoming' | 'Completed' | 'Cancelled';
  predictedDemand?: 'Low' | 'Medium' | 'High';
  location: string;
  price?: number;
  priceMin?: number;
  priceMax?: number;
  imageUrl?: string;
  organizerId?: string | null;
  registeredMembers?: string[];
  committee?: ProjectCommitteeMember[];
}

export type EventRegistrationStatus = 'registered' | 'paid' | 'checked_in' | 'cancelled';

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
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  cancelledByName?: string | null;
  cancelledByRole?: 'self' | 'admin' | 'board' | 'committee' | null;
  dietary?: 'normal' | 'vegetarian' | 'halal' | null;
  isVegetarian?: boolean | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  tshirtSize?: string | null;
  memberName?: string | null;
  registeredBy?: string | null;
  registeredByName?: string | null;
  paidByName?: string | null;
  checkedInByName?: string | null;
  toyyibBillCode?: string;
  toyyibPaymentUrl?: string;
  /** billpaymentStatus: "1"=paid, "2"=pending, "3"=failed, "4"=settling */
  toyyibPaymentStatus?: string;
  billExternalReferenceNo?: string;
}

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

export interface CalendarEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  location: string;
  description: string;
  type: string;
  eventId?: string;
  color?: string;
  resource?: any;
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

export interface EventTemplate {
  id: string;
  name: string;
  type: string;
  description: string;
  location: string;
  duration: number;
  capacity: number;
  registrationSettings: any;
  committee?: { title: string; dueDate: Date }[];
  budgetTemplate: EventBudgetTemplate;
  createdAt: Date;
  createdBy: string;
  usageCount?: number;
  category?: string;
}

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
  warningThreshold?: number;
}

export interface EventBudgetCategory {
  category: string;
  plannedAmount: number;
  actualAmount: number;
  description?: string;
  transactions?: string[];
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
