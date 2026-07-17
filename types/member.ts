import { Timestamp } from 'firebase/firestore';
import { UserRole, MemberTier, RadarStats } from './common';
import type { Badge } from './gamification';

export type MembershipType =
  | 'Guest'
  | 'Probation'
  | 'Official'
  | 'Honorary'
  | 'Senator'
  | 'Visiting'
  | 'Associate';

export type RaceType = 'Chinese' | 'Malay' | 'Indian' | 'Others';
export type GenderType = 'Male' | 'Female';
export type ShirtSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | '2XL' | '3XL' | '5XL' | '7XL';
export type MembershipStatus = 'paid_due' | 'unpaid_due' | 'terminated' | 'pending' | 'paid' | 'overdue' | 'partial' | 'over paid';
export type JciSenatorship = { certified: boolean; senatorNumber?: string };

export interface MembershipRecord {
  year: string | number;
  duesPaid?: boolean;
  paymentRef?: string;
  validatedBy?: string;
  dues?: number | string;
  type?: MembershipType | string;
  amount?: number | string;
  status?: 'paid' | 'over paid' | 'overdue' | 'partial' | 'pending' | string;
  transactionId?: string[];
  purpose?: string;
  paymentDate?: string;
  toyyibBillCode?: string;
  toyyibPaymentUrl?: string;
  /** billpaymentStatus: "1"=paid, "2"=pending, "3"=failed, "4"=settling */
  toyyibPaymentStatus?: string;
  billExternalReferenceNo?: string;
}

export interface MemberPromotionProgress {
  bodMeetingAttended: boolean | number | null;
  eventOrganizerParticipation: boolean | number | null;
  eventParticipation: boolean | number | null;
  jciInspireCompleted: boolean | number | null;
  completedAt?: string;
}

export interface InternationalConnection {
  country: string;
  loName: string;
  contactPerson: string;
  purpose: string;
  jciChapter?: string;
  connectionType?: string;
  notes?: string;
}

export interface ProbationTask {
  id?: string;
  title?: string;
  description?: string;
  status?: string;
  assignedAt?: string;
  completedAt?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  dueDate?: string;
  category?: string;
  taskId?: string;
  name?: string;
  completed?: boolean;
  evidenceUrl?: string;
}

export interface CareerMilestone {
  year: string;
  role: string;
  description: string;
}

export interface BoardPosition {
  year: number;
  position: string;
  startDate: string;
  endDate: string;
}

export interface BoardTermSettings {
  year: string;
  presidentTheme?: string;
  tagline?: string;
  shortDescription?: string;
  logoUrl?: string;
  groupPhotoUrl?: string;
  memberGroupPhotoUrl?: string;
  updatedAt: string;
}

export interface BoardMember {
  id: string;
  memberId: string;
  position: string;
  term: string;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  permissions: string[];
  commissionDirectorIds?: string[];
  commissionDirectorAvatars?: Record<string, string>;
  commissionDirectorNames?: Record<string, string>;
  memberName?: string;
  avatarUrl?: string;
  boardAvatarUrl?: string;
  companyName?: string;
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

export interface MemberEngagementRequirementProgress {
  detail?: string;
  date?: string;
  completed?: boolean;
  pendingVerification?: boolean;
  autoSuggestedFrom?: 'radar' | 'committee';
  verifiedBy?: string;
  verifiedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
}

export const MEMBER_LOOKUP_FIELDS = ['name', 'email', 'phone', 'fullName', 'currentBoardYear', 'loId'] as const;

export interface Member {
  id: string;

  general?: {
    name: string;
    fullName?: string;
    chineseName?: string;
    idNumber: string;
    dob: string;
    birthPlace?: string;
    gender: GenderType;
    race: RaceType;
    nationality: string;
    avatarUrl?: string;
    avatar?: string;
    ethnicity?: string;
    dietaryPreference?: 'vegetarian' | 'halal' | 'normal' | null;
  };
  contact?: {
    email: string;
    phone: string;
    alternatePhone?: string;
    address: string;
    whatsappJoined: boolean;
    socials: {
      linkedin?: string;
      facebook?: string;
      instagram?: string;
      wechat?: string;
    };
    emergency: {
      name: string;
      relationship: string;
      phone: string;
    };
  };
  others?: {
    bio?: string;
    shirtStyle: 'Unisex' | 'Lady Cut';
    tshirtSize: ShirtSize;
    jacketSize: ShirtSize;
    embroideredName: string;
    tshirtStatus: 'NA' | 'Requested' | 'Sent' | 'Delivered' | 'Received';
    hobbies: string[];
    surveyAnswers?: Record<string, string | string[]>;
    personaType?: string;
    tendencyTags?: string[];
  };
  business?: {
    companyName: string;
    companyWebsite?: string;
    companyLogoUrl?: string;
    introduction?: string;
    position: string;
    industry: string;
    businessCategory: string[];
    specialOffer?: string;
    acceptInternationalBusiness: 'Yes' | 'No' | 'Willing to Explore';
    idealReferrals?: string[];
    connections?: InternationalConnection[];
    levelOfManagement?: string;
    departmentAndPosition?: string;
    companyDescription?: string;
    interestedIndustries?: string[];
    idealReferralTypes?: string[];
  };
  jciCareer?: {
    membershipType: MembershipType;
    membershipStatus: MembershipStatus;
    joinDate: string;
    introducer?: string;
    senatorship: JciSenatorship;
    currentBoardYear?: number;
    currentBoardPosition?: string;
    isCurrentBoardMember: boolean;
    boardHistory: { year: number; role: string; loId?: string }[];
    points: number;
    /** @deprecated legacy hand-filled percentage */
    attendanceRate: number;
    attendanceCheckins?: number;
    attendanceMonths?: number;
    attendanceYear?: number;
    badgesCount: number;
    projectsCount: number;
    trainingsCount: number;
    probationTasks: ProbationTask[];
    promotionProgress?: MemberPromotionProgress;
    isDuesPaidCurrentYear?: boolean;
    engagementProgress?: {
      firstYear?: Record<string, MemberEngagementRequirementProgress>;
      secondYear?: Record<string, MemberEngagementRequirementProgress>;
    };
    radarStats?: RadarStats;
    radarStatsByYear?: Record<string, RadarStats>;
    membershipDuesHistory?: Record<string, MembershipRecord>;
    leaderboardVisibility?: boolean | string;
    hasPaidInitiationFee?: boolean;
    senatorshipValidatedAt?: string;
    senatorshipValidatedBy?: string;
  };
  createdAt?: string | Timestamp | Date;
  updatedAt?: string | Timestamp | Date;
  /** @deprecated use jciCareer.radarStats */
  radarStats?: RadarStats;
  /** @deprecated use jciCareer.radarStatsByYear */
  radarStatsByYear?: Record<string, RadarStats>;

  // Flat compatibility properties for legacy views/services
  name?: string;
  fullName?: string;
  chiName?: string;
  nickName?: string;
  dob?: string;
  dateOfBirth?: string;
  race?: RaceType;
  gender?: GenderType;
  nationalId?: string;
  idNumber?: string;
  nationality?: string;
  avatarUrl?: string;
  avatar?: string;
  profilePicture?: string;
  photoUrl?: string;
  address?: string;
  phone?: string;
  alternatePhone?: string;
  email?: string;
  whatsappJoined?: boolean;
  whatsappgroup?: boolean;
  whatsappGroup?: boolean;
  bookmarkedBusinessIds?: string[];
  emergencyContact?: string;
  emergencyContactName?: string;
  emergencyContactRelationship?: string;
  bio?: string;
  shirtStyle?: 'Unisex' | 'Lady Cut';
  tshirtSize?: ShirtSize;
  jacketSize?: ShirtSize;
  embroideredName?: string;
  tshirtStatus?: string;
  hobbies?: string[];
  facebook?: string;
  instagram?: string;
  linkedIn?: string;
  linkedin?: string;
  wechat?: string;
  weChat?: string;
  companyName?: string;
  /** @deprecated use business.levelOfManagement */
  levelOfManagement?: string;
  companyWebsite?: string;
  companyLogoUrl?: string;
  introduction?: string;
  title?: string;
  position?: string;
  industry?: string;
  category?: string;
  businessCategory?: string[];
  specialOffer?: string;
  offerToMember?: string;
  exploreInternational?: string;
  acceptInternationalBusiness?: string;
  idealReferralIndustry?: string;
  idealReferral?: string;
  idealReferrals?: string[];
  connections?: InternationalConnection[];
  introducer?: string;
  joinedDate?: string;
  joinDate?: string;
  loId?: string;
  membershipType?: MembershipType;
  membershipStatus?: MembershipStatus;
  senatorship?: JciSenatorship;
  senatorshipId?: string;
  senatorCertified?: boolean;
  senatorshipBoardValidated?: boolean;
  isDuesPaidCurrentYear?: boolean;
  duesYear?: number;
  trainingSummary?: string[];
  projectSummary?: string[];
  bodSummary?: string[];
  achievementSummary?: string[];
  /** @deprecated use jciCareer.membershipDuesHistory */
  membershipDuesHistory?: Record<string, MembershipRecord>;
  membership?: Record<string, MembershipRecord>;
  probationTasks?: ProbationTask[];
  promotionProgress?: MemberPromotionProgress;
  points?: number;
  attendanceRate?: number;
  attendanceCheckins?: number;
  attendanceMonths?: number;
  attendanceYear?: number;
  badgesCount?: number;
  projectsCount?: number;
  trainingsCount?: number;
  role?: UserRole | string;
  tier?: MemberTier | string;
  churnRisk?: string;
  duesStatus?: string;
  skills?: string[];
  badges?: Badge[];
  mentorId?: string;
  menteeIds?: string[];
  boardHistory?: { year: number; role: string; loId?: string }[];
  careerHistory?: CareerMilestone[];
  /** @deprecated use jciCareer.leaderboardVisibility */
  leaderboardVisibility?: boolean | string;
  /** @deprecated use jciCareer.hasPaidInitiationFee */
  hasPaidInitiationFee?: boolean;
  /** @deprecated use general.ethnicity */
  ethnicity?: string;
  /** @deprecated use general.birthPlace */
  birthPlace?: string;
  /** @deprecated use general.dietaryPreference */
  dietaryPreference?: 'vegetarian' | 'halal' | 'normal' | null;
  /** @deprecated use business.interestedIndustries */
  interestedIndustries?: string[];
  /** @deprecated use business.position */
  profession?: string;
  /** @deprecated use jciCareer.senatorshipValidatedAt */
  senatorshipValidatedAt?: string;
  /** @deprecated use jciCareer.senatorshipValidatedBy */
  senatorshipValidatedBy?: string;
  age?: number;
  currentBoardYear?: number;
  currentBoardPosition?: string;
  isCurrentBoardMember?: boolean;
  isCurrentCommissionDirector?: boolean;
  probationApprovedBy?: string;
  probationApprovedAt?: string;
  cutStyle?: string;
  personaType?: string;
  /** @deprecated use business.departmentAndPosition */
  departmentAndPosition?: string;
  /** @deprecated use business.idealReferralTypes */
  idealReferralTypes?: string[];
  /** @deprecated use business.companyDescription */
  companyDescription?: string;
  emergencyContactPhone?: string;
  surveyAnswers?: Record<string, string | string[]>;
  tendencyTags?: string[];
  internationalConnections?: InternationalConnection[];
  internationalPartnershipTypes?: string[];
  /** @deprecated use jciCareer.engagementProgress */
  engagementProgress?: {
    firstYear?: Record<string, MemberEngagementRequirementProgress>;
    secondYear?: Record<string, MemberEngagementRequirementProgress>;
  };
}

export type MemberCreateInput = Omit<Member, 'id' | 'membershipType'> & {
  membershipType?: MembershipType;
};

export interface Inquiry {
  id?: string;
  senderId: string;
  senderName: string;
  senderPhone: string;
  senderCompany?: string;
  recipientId: string;
  recipientName: string;
  recipientPhone: string;
  businessId: string;
  businessName: string;
  requirements: string;
  channel: 'whatsapp_direct' | 'whapi_bot' | 'no_phone';
  status: 'sent' | 'failed';
  createdAt?: any;
}

export interface BusinessProfile {
  id: string;
  memberId: string;
  ownerName: string;
  companyName: string;
  industry: string;
  businessCategory?: string;
  description: string;
  website: string;
  offer: string;
  logo: string;
  internationalConnections?: InternationalConnection[];
  globalNetworkEnabled?: boolean;
  acceptsInternationalBusiness?: 'Yes' | 'No' | 'Willing to Explore' | boolean;
  idealReferralTypes?: string[];
  interestedIndustries?: string[];
  jciChapters?: string[];
  internationalPartnershipTypes?: string[];
}

/** @deprecated Use getTargetDuesForMembershipType() from membershipConfigService instead */
export const MembershipDues: Record<MembershipType, number> = {
  Guest: 350,
  Probation: 300,
  Official: 300,
  Honorary: 0,
  Senator: 0,
  Visiting: 500,
  Associate: 50
};

export interface MembershipRuleConfig {
  type: MembershipType;
  duesAmount: number;
  nationalityLimit: 'Malaysian' | 'Non-Malaysian' | 'None';
  ageLimit: {
    min?: number;
    max?: number;
  };
  requiresSenatorship: boolean;
}

export interface PromotionProgress {
  id: string;
  memberId: string;
  memberName: string;
  currentMembershipType: 'Probation';
  requirements: PromotionRequirement[];
  overallProgress: number;
  isEligibleForPromotion: boolean;
  promotedAt?: Date;
  promotedBy?: string;
  promotionReason?: string;
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
  evidence?: string[];
}

export interface PromotionRequirementDetails {
  eventId?: string;
  eventName?: string;
  meetingId?: string;
  meetingDate?: Date;
  courseId?: string;
  courseName?: string;
  completionCertificate?: string;
  role?: string;
}

export interface PromotionHistory {
  id: string;
  memberId: string;
  memberName: string;
  fromMembershipType: string;
  toMembershipType: string;
  promotionDate: Date;
  promotionMethod: 'automatic' | 'manual';
  promotedBy: string;
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
  probationDuesAmount: number;
  fullMemberDuesAmount: number;
  notificationTemplate: string;
  requireAdminApproval: boolean;
  gracePeriodDays: number;
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
