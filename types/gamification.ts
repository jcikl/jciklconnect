export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  earnedDate?: string;
}

export interface AwardDefinition {
  id?: string;
  name: string;
  description: string;
  icon: string;
  category: 'Event' | 'Project' | 'Leadership' | 'Training' | 'Recruitment' | 'Social' | 'Milestone' | 'Special';
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Legendary';
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
  pointsReward: number;
  criteria: AwardCriteria;
  milestones?: AwardMilestone[];
  active: boolean;
  createdAt?: string | import('firebase/firestore').Timestamp | Date;
  updatedAt?: string | import('firebase/firestore').Timestamp | Date;
}

export interface AwardCriteria {
  type: 'points_threshold' | 'event_count' | 'project_count' | 'consecutive_attendance' | 'role_held' | 'training_completed' | 'recruitment_count' | 'custom' | 'event_attendance' | 'project_completion';
  value: number;
  timeframe?: 'lifetime' | 'monthly' | 'quarterly' | 'yearly';
  conditions?: Record<string, any>;
  description?: string;
}

export interface AwardMilestone {
  level: string;
  threshold: number;
  pointValue: number;
  reward?: string;
}

export interface MemberAward {
  id?: string;
  awardId: string;
  memberId: string;
  earnedAt: string | import('firebase/firestore').Timestamp | Date;
  progress?: number;
  completedMilestones?: string[];
  awardedBy?: string;
  reason?: string;
  metadata?: Record<string, any>;
}

// Backward compatibility aliases
export type Achievement = AwardDefinition;
export type BadgeDefinition = AwardDefinition;
export type AchievementAward = MemberAward;
export type BadgeAward = MemberAward;
export type AchievementCriteria = AwardCriteria;
export type AchievementMilestone = AwardMilestone;
export type MemberAchievementProgress = MemberAward;

export interface PointsRule {
  id: string;
  name: string;
  description?: string;
  trigger: 'event_attendance' | 'task_completion' | 'project_completion' | 'training_completion' | 'recruitment' | 'custom';
  conditions: PointsRuleCondition[];
  pointValue: number;
  multiplier: number;
  weight: number;
  enabled: boolean;
  /** If true, the rule can fire multiple times for the same member (no global dedup check). */
  isRepeatable?: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface PointsRuleCondition {
  id: string;
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains' | 'in' | 'not_in';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export interface PointsRuleExecution {
  id: string;
  ruleId: string;
  ruleName: string;
  memberId: string;
  trigger: string;
  triggerData: Record<string, any>;
  pointsAwarded: number;
  calculation: PointsCalculationBreakdown;
  executedAt: string;
  /** LO identifier for cross-LO isolation queries. */
  loId?: string;
}

export interface PointsCalculationBreakdown {
  basePoints: number;
  multiplier: number;
  weight: number;
  finalPoints: number;
  appliedRules: Array<{
    ruleId: string;
    ruleName: string;
    points: number;
    weight: number;
  }>;
}

export interface PointsRuleTestResult {
  ruleId: string;
  ruleName: string;
  testData: Record<string, any>;
  conditionResults: Array<{
    conditionId: string;
    field: string;
    operator: string;
    expectedValue: any;
    actualValue: any;
    passed: boolean;
  }>;
  pointsAwarded: number;
  calculation: PointsCalculationBreakdown;
  passed: boolean;
  errors?: string[];
}

export interface PointsRuleAnalytics {
  ruleId: string;
  ruleName: string;
  executionCount: number;
  totalPointsAwarded: number;
  averagePointsPerExecution: number;
  lastExecuted?: string;
  topTriggers: Array<{
    trigger: string;
    count: number;
  }>;
}

export interface IncentiveProgram {
  id: string;
  year: number;
  name: string;
  isActive: boolean;
  categories: Record<string, { label: string; minScore: number; isFundamental?: boolean }>;
  specialAwards: Array<{ name: string; criteria: string[] }>;
}

export enum IncentiveLogicId {
  EFFICIENT_MEMBERSHIP_CONVERSION = 'EFFICIENT_MEMBERSHIP_CONVERSION',
  EFFICIENT_DUES_PAYMENT = 'EFFICIENT_DUES_PAYMENT',
  EFFICIENT_BOD_MEETINGS = 'EFFICIENT_BOD_MEETINGS',
  EFFICIENT_MEMBERSHIP_GROWTH = 'EFFICIENT_MEMBERSHIP_GROWTH',
  NETWORK_EVENT_ATTENDANCE = 'NETWORK_EVENT_ATTENDANCE',
  NETWORK_HOSTING_RIGHTS = 'NETWORK_HOSTING_RIGHTS',
  EXPERIENCE_FIRST_YEAR = 'EXPERIENCE_FIRST_YEAR',
  EXPERIENCE_TRAINER_GROOMING = 'EXPERIENCE_TRAINER_GROOMING',
  IMPACT_GMM_FREQUENCY = 'IMPACT_GMM_FREQUENCY',
  IMPACT_MENTOR_MATCH = 'IMPACT_MENTOR_MATCH'
}

export interface IncentiveMilestone {
  id: string;
  label: string;
  points: number;
  deadline?: string;
  logicThreshold?: number;
  activityType?: string;
  minParticipants?: number;
}

export interface IncentiveStandard {
  id: string;
  programId: string;
  category: string;
  order: number;
  title: string;
  remarks?: string;
  targetType: 'LO' | 'MEMBER';
  pointCap?: number;
  verificationType: 'AUTO_SYSTEM' | 'MANUAL_UPLOAD' | 'HYBRID';
  autoTriggerEvent?: string;
  autoLogicId?: IncentiveLogicId;
  logicParams?: Record<string, any>;
  evidenceRequirements?: string[];
  milestones?: IncentiveMilestone[];
  isTiered?: boolean;
}

export interface IncentiveSubmission {
  id: string;
  standardId: string;
  milestoneId?: string;
  loId: string;
  memberId?: string;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
  evidenceFiles: string[];
  evidenceText?: string;
  quantity: number;
  submittedAt: string;
  scoreAwarded: number;
  approvedBy?: string;
  rejectionReason?: string;
}

export interface LOStarProgress {
  loId: string;
  year: number;
  categories: Record<string, { current: number; total: number; stars: number }>;
  details: Record<string, boolean | number>;
  totalPoints: number;
  starsUnlocked: number;
  lastUpdated: string;
}

export interface SponsorshipRecord {
  id?: string;
  memberId: string;
  memberName: string;
  sponsorName: string;
  amount: number;
  date: string;
  description?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface RadarPointsConfig {
  leadership: {
    exOfficio: number;
    organisingChairman: number;
    committee: number;
  };
  training: {
    pointsPerHour: number;
  };
  recruitment: {
    pointsPerPax: number;
  };
  sponsorship: {
    pointsPer100: number;
  };
}
