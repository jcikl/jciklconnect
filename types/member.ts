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
  role: string;
  position?: string;
  loId?: string;
  startDate?: string;
  endDate?: string;
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
    boardHistory: BoardPosition[];
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
  /** UID of the admin who last changed this member's role */
  roleChangedBy?: string;
  /** ISO timestamp of the last role change */
  roleChangedAt?: string | Timestamp;
  /** @deprecated use jciCareer.radarStats */
  radarStats?: RadarStats;
  /** @deprecated use jciCareer.radarStatsByYear */
  radarStatsByYear?: Record<string, RadarStats>;

  // Flat compatibility properties for legacy views/services
  /** @deprecated Use general.name instead. Will be removed in v2. */
  name?: string;
  /** @deprecated Use general.fullName instead. Will be removed in v2. */
  fullName?: string;
  /** @deprecated Use general.chineseName instead. Will be removed in v2. */
  chiName?: string;
  /** @deprecated Flat alias for display name. Will be removed in v2. */
  nickName?: string;
  /** @deprecated Use general.dob instead. Will be removed in v2. */
  dob?: string;
  /** @deprecated Use general.dob instead. Will be removed in v2. */
  dateOfBirth?: string;
  /** @deprecated Use general.race instead. Will be removed in v2. */
  race?: RaceType;
  /** @deprecated Use general.gender instead. Will be removed in v2. */
  gender?: GenderType;
  /** @deprecated Use general.idNumber instead. Will be removed in v2. */
  nationalId?: string;
  /** @deprecated Use general.idNumber instead. Will be removed in v2. */
  idNumber?: string;
  /** @deprecated Use general.nationality instead. Will be removed in v2. */
  nationality?: string;
  /** @deprecated Use general.avatarUrl instead. Will be removed in v2. */
  avatarUrl?: string;
  /** @deprecated Use general.avatar instead. Will be removed in v2. */
  avatar?: string;
  /** @deprecated Use general.avatarUrl instead. Will be removed in v2. */
  profilePicture?: string;
  /** @deprecated Use general.avatarUrl instead. Will be removed in v2. */
  photoUrl?: string;
  /** @deprecated Use contact.address instead. Will be removed in v2. */
  address?: string;
  /** @deprecated Use contact.phone instead. Will be removed in v2. */
  phone?: string;
  /** @deprecated Use contact.alternatePhone instead. Will be removed in v2. */
  alternatePhone?: string;
  /** @deprecated Use contact.email instead. Will be removed in v2. */
  email?: string;
  /** @deprecated Use contact.whatsappJoined instead. Will be removed in v2. */
  whatsappJoined?: boolean;
  /** @deprecated Use contact.whatsappJoined instead. Will be removed in v2. */
  whatsappgroup?: boolean;
  /** @deprecated Use contact.whatsappJoined instead. Will be removed in v2. */
  whatsappGroup?: boolean;
  bookmarkedBusinessIds?: string[];
  /** @deprecated Use contact.emergency instead. Will be removed in v2. */
  emergencyContact?: string;
  /** @deprecated Use contact.emergency.name instead. Will be removed in v2. */
  emergencyContactName?: string;
  /** @deprecated Use contact.emergency.relationship instead. Will be removed in v2. */
  emergencyContactRelationship?: string;
  /** @deprecated Use others.bio instead. Will be removed in v2. */
  bio?: string;
  /** @deprecated Use others.shirtStyle instead. Will be removed in v2. */
  shirtStyle?: 'Unisex' | 'Lady Cut';
  /** @deprecated Use others.tshirtSize instead. Will be removed in v2. */
  tshirtSize?: ShirtSize;
  /** @deprecated Use others.jacketSize instead. Will be removed in v2. */
  jacketSize?: ShirtSize;
  /** @deprecated Use others.embroideredName instead. Will be removed in v2. */
  embroideredName?: string;
  /** @deprecated Use others.tshirtStatus instead. Will be removed in v2. */
  tshirtStatus?: string;
  /** @deprecated Use others.hobbies instead. Will be removed in v2. */
  hobbies?: string[];
  /** @deprecated Use contact.socials.facebook instead. Will be removed in v2. */
  facebook?: string;
  /** @deprecated Use contact.socials.instagram instead. Will be removed in v2. */
  instagram?: string;
  /** @deprecated Use contact.socials.linkedin instead. Will be removed in v2. */
  linkedIn?: string;
  /** @deprecated Use contact.socials.linkedin instead. Will be removed in v2. */
  linkedin?: string;
  /** @deprecated Use contact.socials.wechat instead. Will be removed in v2. */
  wechat?: string;
  /** @deprecated Use contact.socials.wechat instead. Will be removed in v2. */
  weChat?: string;
  /** @deprecated Use business.companyName instead. Will be removed in v2. */
  companyName?: string;
  /** @deprecated use business.levelOfManagement */
  levelOfManagement?: string;
  /** @deprecated Use business.companyWebsite instead. Will be removed in v2. */
  companyWebsite?: string;
  /** @deprecated Use business.companyLogoUrl instead. Will be removed in v2. */
  companyLogoUrl?: string;
  /** @deprecated Use business.introduction instead. Will be removed in v2. */
  introduction?: string;
  /** @deprecated Flat alias for business position/title. Will be removed in v2. */
  title?: string;
  /** @deprecated Use business.position instead. Will be removed in v2. */
  position?: string;
  /** @deprecated Use business.industry instead. Will be removed in v2. */
  industry?: string;
  /** @deprecated Use business.businessCategory instead. Will be removed in v2. */
  category?: string;
  /** @deprecated Use business.businessCategory instead. Will be removed in v2. */
  businessCategory?: string[];
  /** @deprecated Use business.specialOffer instead. Will be removed in v2. */
  specialOffer?: string;
  /** @deprecated Use business.specialOffer instead. Will be removed in v2. */
  offerToMember?: string;
  /** @deprecated Use business.acceptInternationalBusiness instead. Will be removed in v2. */
  exploreInternational?: string;
  /** @deprecated Use business.acceptInternationalBusiness instead. Will be removed in v2. */
  acceptInternationalBusiness?: string;
  /** @deprecated Use business.idealReferrals instead. Will be removed in v2. */
  idealReferralIndustry?: string;
  /** @deprecated Use business.idealReferrals instead. Will be removed in v2. */
  idealReferral?: string;
  /** @deprecated Use business.idealReferrals instead. Will be removed in v2. */
  idealReferrals?: string[];
  /** @deprecated Use business.connections instead. Will be removed in v2. */
  connections?: InternationalConnection[];
  /** @deprecated Use jciCareer.introducer instead. Will be removed in v2. */
  introducer?: string;
  /** @deprecated Use jciCareer.joinDate instead. Will be removed in v2. */
  joinedDate?: string;
  /** @deprecated Use jciCareer.joinDate instead. Will be removed in v2. */
  joinDate?: string;
  loId?: string;
  /** @deprecated Use jciCareer.membershipType instead. Will be removed in v2. */
  membershipType?: MembershipType;
  /** @deprecated Use jciCareer.membershipStatus instead. Will be removed in v2. */
  membershipStatus?: MembershipStatus;
  /** @deprecated Use jciCareer.senatorship instead. Will be removed in v2. */
  senatorship?: JciSenatorship;
  /** @deprecated Use jciCareer.senatorship.senatorNumber instead. Will be removed in v2. */
  senatorshipId?: string;
  /** @deprecated Use jciCareer.senatorship.certified instead. Will be removed in v2. */
  senatorCertified?: boolean;
  /** @deprecated Use jciCareer.senatorship instead. Will be removed in v2. */
  senatorshipBoardValidated?: boolean;
  /** @deprecated Use jciCareer.isDuesPaidCurrentYear instead. Will be removed in v2. */
  isDuesPaidCurrentYear?: boolean;
  /** @deprecated Flat alias for dues payment year tracking. Will be removed in v2. */
  duesYear?: number;
  /** @deprecated Flat summary array, no nested equivalent. Will be removed in v2. */
  trainingSummary?: string[];
  /** @deprecated Flat summary array, no nested equivalent. Will be removed in v2. */
  projectSummary?: string[];
  /** @deprecated Flat summary array, no nested equivalent. Will be removed in v2. */
  bodSummary?: string[];
  /** @deprecated Flat summary array, no nested equivalent. Will be removed in v2. */
  achievementSummary?: string[];
  /** @deprecated use jciCareer.membershipDuesHistory */
  membershipDuesHistory?: Record<string, MembershipRecord>;
  /** @deprecated Use jciCareer.membershipDuesHistory instead. Will be removed in v2. */
  membership?: Record<string, MembershipRecord>;
  /** @deprecated Use jciCareer.probationTasks instead. Will be removed in v2. */
  probationTasks?: ProbationTask[];
  /** @deprecated Use jciCareer.promotionProgress instead. Will be removed in v2. */
  promotionProgress?: MemberPromotionProgress;
  /** @deprecated Use jciCareer.points instead. Will be removed in v2. */
  points?: number;
  /** @deprecated Use jciCareer.attendanceRate instead. Will be removed in v2. */
  attendanceRate?: number;
  /** @deprecated Use jciCareer.attendanceCheckins instead. Will be removed in v2. */
  attendanceCheckins?: number;
  /** @deprecated Use jciCareer.attendanceMonths instead. Will be removed in v2. */
  attendanceMonths?: number;
  /** @deprecated Use jciCareer.attendanceYear instead. Will be removed in v2. */
  attendanceYear?: number;
  /** @deprecated Use jciCareer.badgesCount instead. Will be removed in v2. */
  badgesCount?: number;
  /** @deprecated Use jciCareer.projectsCount instead. Will be removed in v2. */
  projectsCount?: number;
  /** @deprecated Use jciCareer.trainingsCount instead. Will be removed in v2. */
  trainingsCount?: number;
  role?: UserRole | string;
  tier?: MemberTier | string;
  churnRisk?: string;
  duesStatus?: string;
  skills?: string[];
  badges?: Badge[];
  mentorId?: string;
  menteeIds?: string[];
  boardHistory?: BoardPosition[];
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
