// Probation to Official Member Promotion Service
import {
  PromotionProgress,
  PromotionRequirement,
  PromotionHistory,
  PromotionNotification,
  PromotionSettings,
  ManualPromotionRequest,
  Member,
  MemberEngagementRequirementProgress,
  Event,
  UserRole,
  MemberTier,
  MembershipType
} from '../types';
import { MembersService } from './membersService';
import {
  MembershipConfigService,
  computeMembershipTypeFromMember,
} from './membershipConfigService';
import {
  collection,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
  doc,
  setDoc,
  updateDoc,
  writeBatch,
  serverTimestamp,
  DocumentReference
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { isDevMode } from '../utils/devMode';
import { errorLoggingService } from './errorLoggingService';

// Local interface for ManualPromotionRequest if not yet in types.ts
interface LocalManualPromotionRequest {
  id: string;
  memberId: string;
  memberName?: string;
  requestedBy: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  reason?: string;
  overrideRequirements?: boolean;
  missingRequirements?: string[];
  requestedAt?: Date;
}

export type EngagementYear = 'firstYear' | 'secondYear';

export interface EngagementRequirementDefinition {
  key: string;
  group: 'Leadership Experience' | 'Skills Development' | 'JCI Experience';
  title: string;
  description: string;
  inputType: 'text' | 'select';
  options?: string[];
}

export interface EngagementRequirementStatus extends EngagementRequirementDefinition {
  progress: MemberEngagementRequirementProgress;
  isCompleted: boolean;
}

export interface MemberEngagementProgressSummary {
  year: EngagementYear;
  memberId: string;
  memberName: string;
  requirements: EngagementRequirementStatus[];
  completedCount: number;
  totalCount: number;
  overallProgress: number;
  isCompleted: boolean;
}

export class PromotionService {
  private static readonly PROBATION_DUES = 350; // RM350
  private static readonly FULL_MEMBER_DUES = 300; // RM300

  static readonly ENGAGEMENT_REQUIREMENTS: Record<EngagementYear, EngagementRequirementDefinition[]> = {
    firstYear: [
      {
        key: 'leadership_local_project_committee',
        group: 'Leadership Experience',
        title: 'Local Project / Activity Leadership',
        description: 'Serve as a Local Project or Activity Organizing Chairperson or Committee.',
        inputType: 'select',
        options: ['Local Project Organizing Chairperson', 'Activity Organizing Chairperson', 'Organizing Committee']
      },
      {
        key: 'skills_jci_malaysia_inspire',
        group: 'Skills Development',
        title: 'JCI Malaysia Inspire',
        description: 'Graduate from JCI Malaysia Inspire.',
        inputType: 'select',
        options: ['JCI Malaysia Inspire']
      },
      {
        key: 'skills_jci_discover',
        group: 'Skills Development',
        title: 'JCI Discover',
        description: 'Graduate from JCI Discover.',
        inputType: 'select',
        options: ['JCI Discover']
      },
      {
        key: 'skills_jci_explore',
        group: 'Skills Development',
        title: 'JCI Explore',
        description: 'Graduate from JCI Explore.',
        inputType: 'select',
        options: ['JCI Explore']
      },
      {
        key: 'experience_area_or_national_convention',
        group: 'JCI Experience',
        title: 'Area / National Convention',
        description: 'Register and attend Area and/or National Convention.',
        inputType: 'select',
        options: ['Area Convention', 'National Convention']
      }
    ],
    secondYear: [
      {
        key: 'leadership_project_chair_or_commission_director',
        group: 'Leadership Experience',
        title: 'Project Chairperson / Commission Director',
        description: 'Serve as a Local Project or Activity Organizing Chairperson, or Commission Director.',
        inputType: 'select',
        options: ['Local Project Organizing Chairperson', 'Activity Organizing Chairperson', 'Commission Director']
      },
      {
        key: 'skills_effective_meeting',
        group: 'Skills Development',
        title: 'JCI Effective Meeting',
        description: 'Graduate from JCI Effective Meeting.',
        inputType: 'select',
        options: ['JCI Effective Meeting']
      },
      {
        key: 'skills_malaysia_empower',
        group: 'Skills Development',
        title: 'JCI Malaysia Empower',
        description: 'Graduate from JCI Malaysia Empower.',
        inputType: 'select',
        options: ['JCI Malaysia Empower']
      },
      {
        key: 'skills_parliamentary_procedure',
        group: 'Skills Development',
        title: 'Parliamentary Procedure Course',
        description: 'Graduate from Parliamentary Procedure Course.',
        inputType: 'select',
        options: ['Parliamentary Procedure Course']
      },
      {
        key: 'experience_local_academy_or_area_summit',
        group: 'JCI Experience',
        title: 'Local Academy / Area Summit',
        description: 'Register and attend Local Academy or Area Summit.',
        inputType: 'select',
        options: ['Local Academy', 'Area Summit']
      },
      {
        key: 'experience_area_convention',
        group: 'JCI Experience',
        title: 'Area Convention',
        description: 'Register and attend Area Convention.',
        inputType: 'select',
        options: ['Area Convention']
      },
      {
        key: 'experience_national_convention',
        group: 'JCI Experience',
        title: 'National Convention',
        description: 'Register and attend National Convention.',
        inputType: 'select',
        options: ['National Convention']
      },
      {
        key: 'experience_national_events',
        group: 'JCI Experience',
        title: 'National Events',
        description: 'Register and attend National Events.',
        inputType: 'text'
      }
    ]
  };

  private static async getComputedMembershipType(member: Member): Promise<string> {
    const rules = await MembershipConfigService.getRules();
    return this.getComputedMembershipTypeWithRules(member, rules);
  }

  private static getComputedMembershipTypeWithRules(
    member: Member,
    rules: Awaited<ReturnType<typeof MembershipConfigService.getRules>>
  ): string {
    return computeMembershipTypeFromMember(
      {
        nationality: member.nationality,
        dateOfBirth: member.dateOfBirth,
        senatorCertified: member.senatorCertified,
        senatorshipId: member.senatorshipId,
        role: member.role,
        membershipType: member.membershipType,
      },
      rules
    );
  }

  private static createBaseRequirements(): PromotionRequirement[] {
    return [
      {
        id: 'bod_meeting',
        type: 'bod_meeting_attendance',
        name: 'BOD Meeting Attendance',
        description: 'Attend at least one Board of Directors meeting',
        isCompleted: false
      },
      {
        id: 'organizing_committee',
        type: 'event_organizing_committee',
        name: 'Event Organizing Committee',
        description: 'Serve as organizing committee member for at least one event',
        isCompleted: false
      },
      {
        id: 'event_participation',
        type: 'event_participation',
        name: 'Event Participation',
        description: 'Participate in at least two events',
        isCompleted: false
      },
      {
        id: 'jci_inspire',
        type: 'jci_inspire_completion',
        name: 'Course Completion',
        description: 'Complete the JCIM Inspire course OR JCI KL New Membersâ„¢ Orientation',
        isCompleted: false
      }
    ];
  }

  private static getRequirementCompletionFromMember(
    member: Member,
    requirementType: PromotionRequirement['type']
  ): {
    completedAt: Date;
    details: Record<string, string | number | boolean | string[]>;
    evidence?: string[];
  } | null {
    const progress = member.promotionProgress ?? member.jciCareer?.promotionProgress;

    switch (requirementType) {
      case 'bod_meeting_attendance': {
        const value = String(progress?.bodMeetingAttended ?? '');
        return value.trim()
          ? { completedAt: new Date(), details: { meetingId: value }, evidence: [] }
          : null;
      }

      case 'event_organizing_committee': {
        const value = String(progress?.eventOrganizerParticipation ?? '');
        return value.trim()
          ? { completedAt: new Date(), details: { eventName: value }, evidence: [] }
          : null;
      }

      case 'event_participation': {
        const value = String(progress?.eventParticipation ?? '');
        if (!value.trim()) return null;

        const events = value.split(/[,\n;]+/).filter(e => e.trim().length > 0);
        return events.length >= 2
          ? { completedAt: new Date(), details: { eventNames: events }, evidence: [] }
          : null;
      }

      case 'jci_inspire_completion': {
        const value = String(progress?.jciInspireCompleted ?? '');
        return value.trim()
          ? { completedAt: new Date(), details: { courseName: value }, evidence: [] }
          : null;
      }

      default:
        return null;
    }
  }

  private static checkAllRequirementsForMember(member: Member): PromotionRequirement[] {
    return this.createBaseRequirements().map(requirement => {
      const completion = this.getRequirementCompletionFromMember(member, requirement.type);
      if (!completion) return requirement;

      return {
        ...requirement,
        isCompleted: true,
        completedAt: completion.completedAt,
        completionDetails: completion.details,
        evidence: completion.evidence
      };
    });
  }

  private static buildPromotionProgress(member: Member): PromotionProgress {
    const requirements = this.checkAllRequirementsForMember(member);
    const completedCount = requirements.filter(req => req.isCompleted).length;
    const overallProgress = (completedCount / requirements.length) * 100;
    const isEligibleForPromotion = completedCount === requirements.length;

    return {
      id: `progress_${member.id}`,
      memberId: member.id,
      memberName: member.name,
      currentMembershipType: 'Probation',
      requirements,
      overallProgress,
      isEligibleForPromotion,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Get promotion progress for a Probation Member
   */
  static async getPromotionProgress(memberId: string): Promise<PromotionProgress | null> {
    const member = await this.getMemberById(memberId);
    if (!member) return null;
    return this.getPromotionProgressForMember(member);
  }

  static async getPromotionProgressForMember(member: Member): Promise<PromotionProgress | null> {
    const computedType = await this.getComputedMembershipType(member);
    if (computedType !== 'Probation') {
      return null;
    }

    return this.buildPromotionProgress(member);
  }

  static buildEngagementProgress(member: Member, year: EngagementYear): MemberEngagementProgressSummary {
    const storedProgress = (member.jciCareer?.engagementProgress ?? member.engagementProgress)?.[year] || {};

    const requirements = this.ENGAGEMENT_REQUIREMENTS[year].map((definition) => {
      const progress = storedProgress[definition.key] || {};
      // Pending verification items are NOT yet completed â€” BOD must approve first
      const isCompleted = !progress.pendingVerification &&
        (progress.completed === true || Boolean(progress.detail?.trim() && progress.date?.trim()));

      return {
        ...definition,
        progress,
        isCompleted
      };
    });

    const completedCount = requirements.filter(req => req.isCompleted).length;
    const totalCount = requirements.length;
    const isCompleted = totalCount > 0 && completedCount === totalCount;

    return {
      year,
      memberId: member.id,
      memberName: member.fullName || member.name,
      requirements,
      completedCount,
      totalCount,
      overallProgress: totalCount > 0 ? (completedCount / totalCount) * 100 : 0,
      isCompleted
    };
  }

  static async saveEngagementRequirement(
    memberId: string,
    year: EngagementYear,
    requirementKey: string,
    progress: MemberEngagementRequirementProgress
  ): Promise<void> {
    const member = await this.getMemberById(memberId);
    if (!member) throw new Error('Member not found');

    const currentEngagement = member.jciCareer?.engagementProgress ?? member.engagementProgress ?? {};
    const yearProgress = currentEngagement[year] || {};
    const cleanProgress: Record<string, any> = {
      detail: progress.detail || '',
      date: progress.date || '',
      completed: progress.completed ?? Boolean(progress.detail?.trim() && progress.date?.trim()),
    };
    // Preserve optional verification fields
    if (progress.pendingVerification !== undefined) cleanProgress.pendingVerification = progress.pendingVerification;
    if (progress.autoSuggestedFrom !== undefined) cleanProgress.autoSuggestedFrom = progress.autoSuggestedFrom;
    if (progress.verifiedBy !== undefined) cleanProgress.verifiedBy = progress.verifiedBy;
    if (progress.verifiedAt !== undefined) cleanProgress.verifiedAt = progress.verifiedAt;
    if (progress.rejectedBy !== undefined) cleanProgress.rejectedBy = progress.rejectedBy;
    if (progress.rejectedAt !== undefined) cleanProgress.rejectedAt = progress.rejectedAt;

    const updatedEngagement = {
      ...currentEngagement,
      [year]: {
        ...yearProgress,
        [requirementKey]: cleanProgress
      }
    };
    await MembersService.updateMember(memberId, {
      'jciCareer.engagementProgress': updatedEngagement,
      engagementProgress: updatedEngagement,
    } as unknown as Partial<Member>); // Firestore dotted field paths are not representable in Partial<Member>
  }

  /**
   * Check all four promotion requirements for a member
   */
  static async checkAllRequirements(memberId: string): Promise<PromotionRequirement[]> {
    const member = await this.getMemberById(memberId);
    return member ? this.checkAllRequirementsForMember(member) : this.createBaseRequirements();
  }

  /**
   * Check a specific requirement for a member
   */
  static async checkRequirement(
    memberId: string,
    requirementType: PromotionRequirement['type']
  ): Promise<{
    completedAt: Date;
    details: Record<string, string | number | boolean | string[]>;
    evidence?: string[];
  } | null> {
    const member = await this.getMemberById(memberId);
    return member ? this.getRequirementCompletionFromMember(member, requirementType) : null;
  }

  /**
   * Process automatic promotion for eligible members
   */
  static async processAutomaticPromotions(): Promise<PromotionHistory[]> {
    const settings = await this.getPromotionSettings();
    if (!settings.automaticPromotionEnabled) {
      return [];
    }

    const probationMembers = await this.getProbationMembers();
    const promotions: PromotionHistory[] = [];

    // FIX 4 (P1): isolate each member so one failure does not abort remaining promotions
    for (const member of probationMembers) {
      try {
        const progress = await this.getPromotionProgress(member.id);
        if (progress?.isEligibleForPromotion) {
          const promotion = await this.promoteToOfficialMember(member.id, 'system', 'automatic');
          if (promotion) {
            promotions.push(promotion);
          }
        }
      } catch (error) {
        errorLoggingService.logError(error as Error, { component: 'processAutomaticPromotions', additionalData: { memberId: member.id } });
        // continue to next member
      }
    }

    return promotions;
  }

  /**
   * Promote a Probation Member to Full Member
   */
  static async promoteToOfficialMember(
    memberId: string,
    promotedBy: string,
    method: 'automatic' | 'manual' = 'automatic',
    reason?: string,
    promotionRequestId?: string,
    // When provided, the request document is created inside this batch (atomic override path).
    // The ref must be pre-generated by the caller via doc(collection(db, MANUAL_PROMOTION_REQUESTS)).
    requestToCreate?: { ref: DocumentReference; data: ManualPromotionRequest }
  ): Promise<PromotionHistory | null> {
    const member = await this.getMemberById(memberId);
    if (!member) {
      throw new Error('Member not found');
    }
    const computedType = await this.getComputedMembershipType(member);
    if (computedType !== 'Probation') {
      throw new Error('Member is not a Probation Member (computed from profile)');
    }

    const progress = await this.getPromotionProgress(memberId);
    if (!progress) {
      throw new Error('Unable to get promotion progress');
    }

    // For manual promotions, allow override
    if (method === 'automatic' && !progress.isEligibleForPromotion) {
      throw new Error('Member is not eligible for automatic promotion');
    }

    // FIX 1 (P0): atomic writeBatch for member update + dues + promotion history
    const batch = writeBatch(db);

    // batch: member role + membershipType
    const memberRef = doc(db, COLLECTIONS.MEMBERS ?? 'members', memberId);
    batch.update(memberRef, { membershipType: 'Official', role: UserRole.MEMBER });

    // batch: dues update
    const currentYear = new Date().getFullYear().toString();
    if (member.membership?.[currentYear]) {
      const updatedMembership = {
        ...member.membership,
        [currentYear]: { ...member.membership[currentYear], dues: this.FULL_MEMBER_DUES }
      };
      batch.update(memberRef, { membership: updatedMembership });
    }

    // FIX 5 (P2): pre-generate docRef so id field matches document ID
    const promotionRef = doc(collection(db, COLLECTIONS.PROMOTION_HISTORY));
    const promotion: PromotionHistory = {
      id: promotionRef.id,
      memberId,
      memberName: member.name,
      fromMembershipType: 'Probation',
      toMembershipType: 'Official',
      promotionDate: new Date(),
      promotionMethod: method,
      promotedBy,
      requirementsCompleted: progress.requirements.filter(req => req.isCompleted),
      oldDuesAmount: this.PROBATION_DUES,
      newDuesAmount: this.FULL_MEMBER_DUES,
      notificationSent: false,
      notes: reason
    };
    if (!isDevMode()) {
      batch.set(promotionRef, { ...promotion, promotionDate: serverTimestamp() });
    }

    // Atomic request handling inside the same batch.
    // Two cases:
    //   (a) requestToCreate — first-time write for the override path (batch.set with final approved status)
    //   (b) promotionRequestId — existing pending request being approved (batch.update to stamp approved)
    if (!isDevMode()) {
      if (requestToCreate) {
        batch.set(requestToCreate.ref, {
          ...requestToCreate.data,
          requestedAt: serverTimestamp(),
          status: 'approved',
          approvedBy: promotedBy,
          approvedAt: serverTimestamp()
        });
      } else if (promotionRequestId) {
        const reqRef = doc(db, COLLECTIONS.MANUAL_PROMOTION_REQUESTS, promotionRequestId);
        batch.update(reqRef, {
          status: 'approved',
          approvedBy: promotedBy,
          approvedAt: serverTimestamp()
        });
      }
    }

    await batch.commit();

    // Fix 4: invalidate members cache after promotion write
    MembersService.invalidateMembersCache();

    // Fix 5: sync board member display fields (non-fatal — log only)
    // member was fetched above at the top of this method
    try {
      await (MembersService as any).syncBoardMemberDisplayFields(memberId, { ...member, membershipType: 'Official', role: 'MEMBER' });
    } catch (syncErr) {
      console.warn('[promoteToOfficialMember] syncBoardMemberDisplayFields failed (non-fatal):', syncErr);
    }

    // Fix 10 (P1): notification failure must not make the caller believe the promotion failed —
    // the batch already committed successfully above.
    // P2 fix: update notificationSent=true on the promotionHistory doc after success.
    try {
      await this.sendPromotionNotification(promotion);
      if (!isDevMode()) {
        await updateDoc(promotionRef, { notificationSent: true }).catch(err =>
          console.warn('[promoteToOfficialMember] Failed to set notificationSent=true:', err)
        );
      }
    } catch (notificationErr) {
      errorLoggingService.logError(
        notificationErr instanceof Error ? notificationErr : new Error(String(notificationErr)),
        { component: 'promoteToOfficialMember.notification', additionalData: { memberId } }
      );
      // Intentionally do not rethrow — promotion succeeded, notification failure is non-fatal
    }

    return promotion;
  }

  /**
   * Create manual promotion request
   */
  static async createManualPromotionRequest(
    memberId: string,
    requestedBy: string,
    reason: string,
    overrideRequirements: boolean = false,
    callerRole?: string
  ): Promise<ManualPromotionRequest> {
    // P0 fix: only ADMIN/SUPER_ADMIN may override requirements — prevents Board members from
    // bypassing the pending-review flow and promoting members without admin sign-off.
    if (overrideRequirements) {
      const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];
      if (!callerRole || !ADMIN_ROLES.includes(callerRole.toUpperCase())) {
        throw new Error('Only administrators can override promotion requirements');
      }
    }

    const member = await this.getMemberById(memberId);
    if (!member) {
      throw new Error('Member not found');
    }
    if ((await this.getComputedMembershipType(member)) !== 'Probation') {
      throw new Error('Member is not a Probation Member (computed from profile)');
    }

    const progress = await this.getPromotionProgress(memberId);
    const missingRequirements = progress?.requirements
      .filter(req => !req.isCompleted)
      .map(req => req.name) || [];

    if (overrideRequirements && !isDevMode()) {
      // P0 fix (TASK 2): atomic path — request creation + member promotion in one writeBatch.
      // Pre-generate the Firestore doc ref so the id is known before committing.
      const requestRef = doc(collection(db, COLLECTIONS.MANUAL_PROMOTION_REQUESTS));
      const request: ManualPromotionRequest = {
        id: requestRef.id,
        memberId,
        memberName: member.name,
        requestedBy,
        requestedAt: new Date(),
        reason,
        overrideRequirements: true,
        missingRequirements,
        status: 'approved'
      };
      // promoteToOfficialMember will write this request doc inside its own writeBatch,
      // making the request creation, member role change, and promotion history all atomic.
      await this.promoteToOfficialMember(memberId, requestedBy, 'manual', reason, undefined, { ref: requestRef, data: request });
      return request;
    }

    if (overrideRequirements && isDevMode()) {
      // Dev mode: no Firestore writes, return a mock approved request.
      const request: ManualPromotionRequest = {
        id: `dev-override-${memberId}-${Date.now()}`,
        memberId,
        memberName: member.name,
        requestedBy,
        requestedAt: new Date(),
        reason,
        overrideRequirements: true,
        missingRequirements,
        status: 'approved'
      };
      await this.promoteToOfficialMember(memberId, requestedBy, 'manual', reason);
      return request;
    }

    // Normal (non-override) path: save request as pending for BOD review.
    const request: ManualPromotionRequest = {
      id: `manual_promotion_${memberId}_${Date.now()}`,
      memberId,
      memberName: member.name,
      requestedBy,
      requestedAt: new Date(),
      reason,
      overrideRequirements: false,
      missingRequirements,
      status: 'pending'
    };

    const savedId = await this.saveManualPromotionRequest(request);
    // Overwrite synthetic id with the real Firestore doc id.
    request.id = savedId;

    return request;
  }

  /**
   * Update member activity that might affect promotion requirements
   */
  static async updateMemberActivity(
    memberId: string,
    activityType: 'bod_meeting' | 'event_organizing' | 'event_participation' | 'course_completion',
    activityData: Record<string, string | number | boolean>
  ): Promise<void> {
    const member = await this.getMemberById(memberId);
    if (!member || (await this.getComputedMembershipType(member)) !== 'Probation') {
      return;
    }

    // Record the activity
    await this.recordMemberActivity(memberId, activityType, activityData);

    // Check if this completes any requirements
    const progress = await this.getPromotionProgress(memberId);
    if (progress?.isEligibleForPromotion) {
      // Trigger automatic promotion if enabled
      const settings = await this.getPromotionSettings();
      if (settings.automaticPromotionEnabled) {
        await this.promoteToOfficialMember(memberId, 'system', 'automatic');
      }
    }
  }

  /**
   * Get promotion statistics
   */
  static async getPromotionStatistics(): Promise<{
    totalProbationMembers: number;
    eligibleForPromotion: number;
    promotedThisYear: number;
    averageTimeToPromotion: number; // in days
    requirementCompletionRates: Record<string, number>;
  }> {
    const probationMembers = await this.getProbationMembers();
    return this.calculatePromotionStatistics(probationMembers);
  }

  static async getPromotionTrackingOverview(loIdFilter?: string | null): Promise<{
    statistics: {
      totalProbationMembers: number;
      eligibleForPromotion: number;
      promotedThisYear: number;
      averageTimeToPromotion: number;
      requirementCompletionRates: Record<string, number>;
    };
    members: Awaited<ReturnType<typeof PromotionService.getProbationMembersForDisplay>>;
  }> {
    const rules = await MembershipConfigService.getRules();
    const allMembers = await MembersService.getAllMembers(loIdFilter);
    const probationMembers = this.getProbationMembersFromList(allMembers, rules);

    const [statistics, members] = await Promise.all([
      this.calculatePromotionStatistics(probationMembers),
      Promise.resolve(this.toProbationMembersForDisplay(probationMembers, rules))
    ]);

    return { statistics, members };
  }

  private static async calculatePromotionStatistics(probationMembers: Member[]): Promise<{
    totalProbationMembers: number;
    eligibleForPromotion: number;
    promotedThisYear: number;
    averageTimeToPromotion: number;
    requirementCompletionRates: Record<string, number>;
  }> {
    const totalProbationMembers = probationMembers.length;

    let eligibleForPromotion = 0;
    const requirementCounts = {
      bod_meeting_attendance: 0,
      event_organizing_committee: 0,
      event_participation: 0,
      jci_inspire_completion: 0
    };

    for (const member of probationMembers) {
      const progress = this.buildPromotionProgress(member);
      if (progress.isEligibleForPromotion) {
        eligibleForPromotion++;
      }

      progress.requirements.forEach(req => {
        if (req.isCompleted) {
          requirementCounts[req.type]++;
        }
      });
    }

    const requirementCompletionRates = Object.entries(requirementCounts).reduce(
      (rates, [type, count]) => {
        rates[type] = totalProbationMembers > 0 ? (count / totalProbationMembers) * 100 : 0;
        return rates;
      },
      {} as Record<string, number>
    );

    // Get promotions this year
    const thisYear = new Date().getFullYear();
    const promotionsThisYear = await this.getPromotionsInYear(thisYear);
    const promotedThisYear = promotionsThisYear.length;

    // Calculate average time to promotion
    const averageTimeToPromotion = await this.calculateAveragePromotionTime();

    return {
      totalProbationMembers,
      eligibleForPromotion,
      promotedThisYear,
      averageTimeToPromotion,
      requirementCompletionRates
    };
  }

  // Private helper methods

  private static async getMemberById(memberId: string): Promise<Member | null> {
    return MembersService.getMemberById(memberId);
  }

  private static async getProbationMembers(loIdFilter?: string | null): Promise<Member[]> {
    const rules = await MembershipConfigService.getRules();
    const all = await MembersService.getAllMembers(loIdFilter);
    return this.getProbationMembersFromList(all, rules);
  }

  private static getProbationMembersFromList(
    members: Member[],
    rules: Awaited<ReturnType<typeof MembershipConfigService.getRules>>
  ): Member[] {
    return members.filter(
      (m) =>
        this.getComputedMembershipTypeWithRules(m, rules) === 'Probation'
    );
  }

  /** Public API for UI: probation members with computed membership type */
  static async getProbationMembersForDisplay(loIdFilter?: string | null): Promise<
    {
      id: string;
      name: string;
      fullName?: string;
      joinDate: string;
      nationality?: string;
      dateOfBirth?: string;
      senatorCertified?: boolean;
      senatorshipId?: string;
      role?: string;
      membershipType?: string;
      computedMembershipType: string;
      promotionProgress?: import('../types').MemberPromotionProgress;
    }[]
  > {
    const rules = await MembershipConfigService.getRules();
    const allMembers = await MembersService.getAllMembers(loIdFilter);
    const probation = this.getProbationMembersFromList(allMembers, rules);
    return this.toProbationMembersForDisplay(probation, rules);
  }

  private static toProbationMembersForDisplay(
    probation: Member[],
    rules: Awaited<ReturnType<typeof MembershipConfigService.getRules>>
  ): {
    id: string;
    name: string;
    fullName?: string;
    joinDate: string;
    nationality?: string;
    dateOfBirth?: string;
    senatorCertified?: boolean;
    senatorshipId?: string;
    role?: string;
    membershipType?: string;
    computedMembershipType: string;
    promotionProgress?: import('../types').MemberPromotionProgress;
  }[] {
    return probation.map((m) => ({
      id: m.id,
      name: m.name || '',
      fullName: m.fullName,
      joinDate: (typeof m.joinDate === 'string' ? m.joinDate : m.joinDate ? String(m.joinDate) : '') || '',
      nationality: m.nationality,
      dateOfBirth: m.dateOfBirth,
      senatorCertified: m.senatorCertified,
      senatorshipId: m.senatorshipId,
      role: m.role,
      membershipType: m.membershipType,
      computedMembershipType: this.getComputedMembershipTypeWithRules(m, rules),
      promotionProgress: m.promotionProgress ?? m.jciCareer?.promotionProgress,
    }));
  }

  /**
   * Save a single promotion progress field for a member
   */
  static async savePromotionProgressField(
    memberId: string,
    field: 'bodMeetingAttended' | 'eventOrganizerParticipation' | 'eventParticipation' | 'jciInspireCompleted',
    value: string
  ): Promise<void> {
    await MembersService.updateMember(memberId, {
      promotionProgress: {
        ...((await this.getMemberById(memberId))?.promotionProgress || {}),
        [field]: value
      }
    } as unknown as Partial<Member>); // computed field key not statically checkable against MemberPromotionProgress
  }

  private static async updateMembershipType(memberId: string, newType: string): Promise<void> {
    await MembersService.updateMember(memberId, { membershipType: newType as MembershipType });
    console.log(`Updated member ${memberId} to ${newType} membership`);
  }

  private static async updateMemberDues(memberId: string, newAmount: number): Promise<void> {
    const currentYear = new Date().getFullYear();
    const member = await this.getMemberById(memberId);

    if (member?.membership) {
      const yearStr = currentYear.toString();
      const updatedMembership = { ...member.membership };

      if (updatedMembership[yearStr]) {
        updatedMembership[yearStr] = {
          ...updatedMembership[yearStr],
          dues: newAmount
        };

        await MembersService.updateMember(memberId, { membership: updatedMembership });
      }
    }
    // SEC-A-008: Gate financial PII log to dev only.
    if (process.env.NODE_ENV === 'development') {
      console.log(`Updated member ${memberId} dues to RM${newAmount}`);
    }
  }

  private static async savePromotionHistory(promotion: PromotionHistory): Promise<void> {
    // FIX 2 (P1): isDevMode guard
    if (isDevMode()) {
      console.log('Dev: savePromotionHistory skipped');
      return;
    }
    // FIX 5 (P2): use setDoc with pre-generated ID so id field matches docRef.id
    const docRef = doc(collection(db, COLLECTIONS.PROMOTION_HISTORY));
    const promotionWithId = { ...promotion, id: docRef.id, promotionDate: serverTimestamp() };
    await setDoc(docRef, promotionWithId);
    console.log(`Saved promotion history for member ${promotion.memberId}`);
  }

  private static async saveManualPromotionRequest(request: ManualPromotionRequest): Promise<string> {
    if (isDevMode()) return 'dev-mock-request-id';
    const docRef = await addDoc(collection(db, COLLECTIONS.MANUAL_PROMOTION_REQUESTS), {
      ...request,
      requestedAt: serverTimestamp()
    });
    console.log(`Saved manual promotion request for member ${request.memberId}`);
    return docRef.id;
  }

  // FIX 6 (P1): read/list/approve/reject methods for manualPromotionRequests

  /**
   * List manual promotion requests, optionally filtered by status.
   */
  static async getManualPromotionRequests(status?: string): Promise<ManualPromotionRequest[]> {
    if (isDevMode()) {
      return [];
    }
    try {
      const col = collection(db, COLLECTIONS.MANUAL_PROMOTION_REQUESTS);
      const q = status ? query(col, where('status', '==', status)) : query(col);
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ ...d.data(), id: d.id } as ManualPromotionRequest));
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'getManualPromotionRequests', additionalData: { status } });
      return [];
    }
  }

  /**
   * Approve a manual promotion request and trigger the actual promotion.
   */
  static async approveManualPromotionRequest(requestId: string, approvedBy: string): Promise<void> {
    if (isDevMode()) {
      console.log('Dev: approveManualPromotionRequest skipped');
      return;
    }
    try {
      const requestRef = doc(db, COLLECTIONS.MANUAL_PROMOTION_REQUESTS, requestId);
      // Fetch the request by direct document reference (where('__name__') never works in queries)
      const snap = await getDoc(requestRef);
      if (!snap.exists()) throw new Error(`Manual promotion request ${requestId} not found`);
      const requestData = { ...snap.data(), id: requestId } as ManualPromotionRequest;

      // P0 fix: validate status is 'pending' before approving — prevents double-approval and
      // re-promoting an already-promoted member when the same request is submitted twice.
      if (requestData.status !== 'pending') {
        throw new Error(`Cannot approve request with status '${requestData.status}' — only 'pending' requests can be approved`);
      }

      // Pass requestId so the request status update is included in the same writeBatch
      // inside promoteToOfficialMember — making member promotion and request approval atomic.
      await this.promoteToOfficialMember(requestData.memberId, approvedBy, 'manual', undefined, requestId);
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'approveManualPromotionRequest', additionalData: { requestId, approvedBy } });
      throw error;
    }
  }

  /**
   * Reject a manual promotion request with a reason.
   */
  static async rejectManualPromotionRequest(requestId: string, reason: string, rejectedBy?: string): Promise<void> {
    if (isDevMode()) {
      console.log('Dev: rejectManualPromotionRequest skipped');
      return;
    }
    try {
      const requestRef = doc(db, COLLECTIONS.MANUAL_PROMOTION_REQUESTS, requestId);

      // P1 fix: pre-check status so we don't reject an already-actioned request
      const snap = await getDoc(requestRef);
      if (!snap.exists()) throw new Error(`Manual promotion request ${requestId} not found`);
      const currentStatus = (snap.data() as ManualPromotionRequest).status;
      if (currentStatus !== 'pending') {
        throw new Error(`Cannot reject request with status '${currentStatus}' — only 'pending' requests can be rejected`);
      }

      // P1 fix: write rejectedBy + rejectedAt alongside status + rejectionReason
      const now = Timestamp.now();
      const rejectBatch = writeBatch(db);
      rejectBatch.update(requestRef, {
        status: 'rejected',
        rejectionReason: reason,
        ...(rejectedBy ? { rejectedBy } : {}),
        rejectedAt: now,
        updatedAt: now,
      });
      await rejectBatch.commit();
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'rejectManualPromotionRequest', additionalData: { requestId } });
      throw error;
    }
  }

  private static async sendPromotionNotification(promotion: PromotionHistory): Promise<void> {
    const { CommunicationService } = await import('./communicationService');
    await CommunicationService.createNotification({
      memberId: promotion.memberId,
      title: 'Membership Promotion',
      message: `Congratulations! You have been promoted to ${promotion.toMembershipType} Member. Your new dues amount is RM${promotion.newDuesAmount}.`,
      type: 'success',
    });
  }

  private static async recordMemberActivity(
    memberId: string,
    activityType: string,
    activityData: Record<string, string | number | boolean>
  ): Promise<void> {
    // Map activityType to the corresponding promotionProgress field
    const fieldMap: Record<string, string> = {
      bod_meeting: 'bodMeetingAttended',
      event_organizing: 'eventOrganizerParticipation',
      event_participation: 'eventParticipation',
      course_completion: 'jciInspireCompleted',
    };
    const field = fieldMap[activityType];
    if (field && !isDevMode()) {
      try {
        // Persist increment to Firestore so progress survives page reloads
        await MembersService.updateMember(memberId, {
          promotionProgress: {
            [field]: (activityData.value ?? 1) as string | number
          }
        } as unknown as Partial<Member>);
      } catch (err) {
        console.warn(`[recordMemberActivity] Failed to persist ${activityType} for ${memberId}:`, err);
      }
    } else {
      console.log(`Recorded ${activityType} activity for member ${memberId}`, activityData);
    }
  }

  private static async getPromotionSettings(): Promise<PromotionSettings> {
    // Default values used both as dev mock and as fallback when Firestore doc doesn't exist
    const defaults: PromotionSettings = {
      id: 'promotion_settings',
      automaticPromotionEnabled: true,
      requireAllFourRequirements: true,
      probationDuesAmount: this.PROBATION_DUES,
      fullMemberDuesAmount: this.FULL_MEMBER_DUES,
      notificationTemplate: 'Congratulations on your promotion to Full Member!',
      requireAdminApproval: false,
      gracePeriodDays: 365,
      updatedAt: new Date(),
      updatedBy: 'system'
    };

    if (isDevMode()) return defaults;

    try {
      // TODO: Move 'system' to COLLECTIONS.SYSTEM in constants.ts
      const snap = await getDoc(doc(db, 'system', 'promotionSettings'));
      if (snap.exists()) return snap.data() as PromotionSettings;
    } catch (e) {
      // Fall through to defaults if Firestore is unavailable
      console.warn('[getPromotionSettings] Could not read from Firestore, using defaults:', e);
    }
    return defaults;
  }

  // FIX 3 (P1): real Firestore query instead of stub
  private static async getPromotionsInYear(year: number): Promise<PromotionHistory[]> {
    if (isDevMode()) {
      return [];
    }
    try {
      const yearStart = Timestamp.fromDate(new Date(year, 0, 1));
      const yearEnd = Timestamp.fromDate(new Date(year, 11, 31, 23, 59, 59));
      const q = query(
        collection(db, COLLECTIONS.PROMOTION_HISTORY),
        where('promotionDate', '>=', yearStart),
        where('promotionDate', '<=', yearEnd)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ ...d.data(), id: d.id } as PromotionHistory));
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'getPromotionsInYear', additionalData: { year } });
      return [];
    }
  }

  private static async calculateAveragePromotionTime(): Promise<number> {
    if (isDevMode()) return 180; // 180 days average (mock)

    try {
      const snap = await getDocs(collection(db, COLLECTIONS.PROMOTION_HISTORY));
      if (snap.empty) return 0;

      const days: number[] = [];
      snap.docs.forEach(d => {
        const data = d.data();
        const promotionTs = data.promotionDate?.toMillis?.();
        const joinTs = data.joinDate?.toMillis?.();
        if (promotionTs && joinTs && promotionTs > joinTs) {
          days.push((promotionTs - joinTs) / 86400000);
        }
      });

      if (days.length === 0) return 0;
      return Math.round(days.reduce((sum, d) => sum + d, 0) / days.length);
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'calculateAveragePromotionTime' });
      return 0;
    }
  }
}

