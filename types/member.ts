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
export type JciSenatorship = { certified: boolean; senatorNumber?: string; boardValidated?: boolean };

export interface SpecialOffer {
  description: string;
  terms?: string;
  expiryDate?: string;
  logoUrl?: string;
  imageUrl?: string;
  status?: 'Active' | 'Paused';
  /** Who can redeem (same meaning as advertisements.targetCriteria.audiences). Missing/empty = JCI KL only. */
  audiences?: ('kl' | AffiliationCategory)[];
  /** When set, the viewer's country must be listed (case-insensitive). Missing/empty = any country. */
  countries?: string[];
}

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

export interface MemberFoundationPathway extends Partial<MemberPromotionProgress> {
  tasks?: ProbationTask[];
  /** @deprecated legacy alias; use tasks */
  probationTasks?: ProbationTask[];
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
    area?: string;
    state?: string;
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
    specialOffer?: SpecialOffer | string;
    specialOffers?: SpecialOffer[];
    acceptInternationalBusiness: 'Yes' | 'No' | 'Willing to Explore';
    idealReferrals?: string[];
    connections?: InternationalConnection[];
    levelOfManagement?: string;
    departmentAndPosition?: string;
    companyDescription?: string;
    interestedIndustries?: string[];
    idealReferralTypes?: string[];
    bookmarkedBusinessIds?: string[];
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
    foundationPathway?: MemberFoundationPathway;
    /** @deprecated legacy alias; use foundationPathway.tasks */
    probationTasks?: ProbationTask[];
    /** @deprecated legacy alias; use foundationPathway */
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
    careerHistory?: CareerMilestone[];
    /** JCI Malaysia (jcimalaysia.cc) membership no., e.g. "JCIKL-025-0159". Written by scripts/syncJciMalaysia.mjs. */
    jciMalaysiaMembershipNo?: string;
    /** JCI Malaysia join date (YYYY-MM-DD). Written by scripts/syncJciMalaysia.mjs. */
    jciMalaysiaJoinDate?: string;
  };
  createdAt?: string | Timestamp | Date;
  updatedAt?: string | Timestamp | Date;
  /** UID of the admin who last changed this member's role */
  roleChangedBy?: string;
  /** ISO timestamp of the last role change */
  roleChangedAt?: string | Timestamp;
  // Intentionally flat fields (not nested)
  role?: UserRole | string;
  idealReferralIndustry?: string;
  loId?: string;
  churnRisk?: string;
  companyName?: string;
  industry?: string;
  tier?: MemberTier | string;
  skills?: string[];
  badges?: Badge[];
  mentorId?: string;
  menteeIds?: string[];
  points?: number;
  duesStatus?: string;
  /** @deprecated legacy flat alias; use business.bookmarkedBusinessIds */
  bookmarkedBusinessIds?: string[];
  /** @deprecated legacy flat alias; use jciCareer.careerHistory */
  careerHistory?: CareerMilestone[];
  attendanceRate?: number;
  age?: number;
  isCurrentCommissionDirector?: boolean;
  probationApprovedBy?: string;
  probationApprovedAt?: string;
  personaType?: string;
  surveyAnswers?: Record<string, string | string[]>;
  tendencyTags?: string[];
  internationalConnections?: InternationalConnection[];
  privacy?: {
    /** Legacy: no longer read (phone and socials follow shareCardInternationally; alternate phone is never shown). Stored values are kept. */
    showPhone?: boolean;
    showAlternatePhone?: boolean;
    showSocials?: boolean;
    /**
     * Opt-in: show this member's public card (`memberCards`) to members of OTHER chapters.
     * Default false (missing = false). Mirrored into `MemberCard.international`; firestore.rules
     * rejects a card whose `international` differs from this flag. Self-editable.
     */
    shareCardInternationally?: boolean;
    /** Hide my birthday (day / month) from birthday lists. Default false (missing = shown). Self-editable. */
    hideBirthday?: boolean;
  };
  /**
   * Present only on external members (role AFFILIATE / CHAPTER_ADMIN). The chapter itself is the
   * top-level `loId` (a `sisterChapters` id). Locked against self-write in firestore.rules.
   */
  affiliation?: MemberAffiliation;
}

/** Which JCI network an external member comes in through. */
export type AffiliationCategory = 'sister' | 'apicc' | 'global';

/**
 * External member lifecycle:
 * pending_chapter (waiting for own chapter admin) → pending_kl (chapter approved, waiting for KL)
 * → active; active ↔ suspended; expired when the affiliation lapses; rejected when a pending
 * request is turned down (the doc is kept as a record).
 * Only `active` external users pass isActiveExternal() in firestore.rules.
 * Status changes go through netlify/functions/external-accounts.mjs (setStatus), which keeps memberCards in sync.
 */
export type AffiliationStatus = 'pending_chapter' | 'pending_kl' | 'active' | 'suspended' | 'expired' | 'rejected';

/** `members.affiliation` — affiliation data of an external member. */
export interface MemberAffiliation {
  category: AffiliationCategory;
  /** Country of the member's chapter (free text / ISO name, e.g. 'Singapore'). */
  country: string;
  status: AffiliationStatus;
  /** Set by the chapter admin when moving pending_chapter → pending_kl. */
  chapterApprovedAt?: string;
  chapterApprovedBy?: string;
  /** Set by a KL admin when moving pending_kl → active. */
  klApprovedAt?: string;
  klApprovedBy?: string;
  /** Last status change (any actor). */
  statusUpdatedAt?: string;
  statusUpdatedBy?: string;
  /** First time the affiliation became active (server-set). */
  activatedAt?: string;
  /**
   * Who made the last → suspended change (server-set by external-accounts setStatus). A chapter admin may
   * reactivate only a suspension made by a chapter admin, never one made by JCI KL.
   */
  suspendedByRole?: 'CHAPTER_ADMIN' | 'KL';
}

/**
 * `memberCards/{memberId}` — directory-safe public card (no PII). Doc id = member id.
 * This is the ONLY member data external users may read about other people.
 * Kept in sync from `members` by the client (Phase 0 WP2); firestore.rules accepts exactly these keys.
 */
export interface MemberCard {
  displayName: string;
  avatarUrl?: string;
  /** Chapter id (copy of members.loId). Must equal the member doc's loId. */
  loId: string;
  country?: string;
  companyName?: string;
  position?: string;
  department?: string;
  industry?: string;
  businessCategory?: string[];
  /** Short company description / introduction. */
  companyDescription?: string;
  website?: string;
  acceptInternationalBusiness?: 'Yes' | 'No' | 'Willing to Explore';
  /** Description of the member's first live (active, not expired) offer, across both offer formats. */
  specialOfferSummary?: string;
  /** The member's live offers (public keys only). Present only when international is true; omitted when empty. */
  specialOffers?: MemberCardOffer[];
  /** Same source, order and normalisation as the local directory's idealReferralTypes (business.idealReferralTypes, else business.idealReferrals ?? idealReferral ?? idealReferrals); omitted when empty. */
  idealReferrals?: string[];
  /** Primary phone (contact.phone). Present only when international is true. */
  phone?: string;
  /** Non-empty social links (linkedin / facebook / instagram / wechat). Present only when international is true. */
  socials?: Record<string, string>;
  /** Visible to members of other chapters. Must equal members.privacy.shareCardInternationally (default false). */
  international: boolean;
  updatedAt: string;
}

/** One offer on a public card: a live SpecialOffer without `status`. */
export type MemberCardOffer = Pick<SpecialOffer, 'description' | 'terms' | 'expiryDate' | 'logoUrl' | 'imageUrl' | 'audiences' | 'countries'>;

/** Returns a short display string for any specialOffer value (structured or legacy string). */
export function getSpecialOfferSummary(offer: SpecialOffer | string | undefined): string {
  if (!offer) return '';
  if (typeof offer === 'string') return offer;
  return offer.description;
}

/** Returns true if a member has any special offer set. */
export function hasSpecialOffer(offer: SpecialOffer | string | undefined): boolean {
  if (!offer) return false;
  if (typeof offer === 'string') return offer.trim() !== '';
  return offer.description.trim() !== '';
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
  offerTerms?: string;
  offerExpiry?: string;
  logo: string;
  internationalConnections?: InternationalConnection[];
  globalNetworkEnabled?: boolean;
  acceptsInternationalBusiness?: 'Yes' | 'No' | 'Willing to Explore' | boolean;
  idealReferralTypes?: string[];
  interestedIndustries?: string[];
  jciChapters?: string[];
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
