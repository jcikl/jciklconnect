// Probation to Full Member Promotion Service
import {
  PromotionProgress,
  PromotionRequirement,
  PromotionHistory,
  PromotionNotification,
  PromotionSettings,
  ManualPromotionRequest,
  Member,
  Event,
  UserRole,
  MemberTier
} from '../types';
import { MembersService } from './membersService';

export class PromotionService {
  private static readonly PROBATION_DUES = 350; // RM350
  private static readonly FULL_MEMBER_DUES = 300; // RM300

  /**
   * Get promotion progress for a Probation Member
   */
  static async getPromotionProgress(memberId: string): Promise<PromotionProgress | null> {
    // In real implementation, this would fetch from database
    const member = await this.getMemberById(memberId);
    if (!member || member.membershipType !== 'Probation') {
      return null;
    }

    const requirements = await this.checkAllRequirements(memberId);
    const completedCount = requirements.filter(req => req.isCompleted).length;
    const overallProgress = (completedCount / requirements.length) * 100;
    const isEligibleForPromotion = completedCount === requirements.length;

    return {
      id: `progress_${memberId}`,
      memberId,
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
   * Check all four promotion requirements for a member
   */
  static async checkAllRequirements(memberId: string): Promise<PromotionRequirement[]> {
    const requirements: PromotionRequirement[] = [
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
        description: 'Participate in at least one event',
        isCompleted: false
      },
      {
        id: 'jci_inspire',
        type: 'jci_inspire_completion',
        name: 'JCI Inspire Course',
        description: 'Complete the JCI Inspire course',
        isCompleted: false
      }
    ];

    // Check each requirement
    for (const requirement of requirements) {
      const completion = await this.checkRequirement(memberId, requirement.type);
      if (completion) {
        requirement.isCompleted = true;
        requirement.completedAt = completion.completedAt;
        requirement.completionDetails = completion.details;
        requirement.evidence = completion.evidence;
      }
    }

    return requirements;
  }

  /**
   * Check a specific requirement for a member
   */
  static async checkRequirement(
    memberId: string, 
    requirementType: PromotionRequirement['type']
  ): Promise<{
    completedAt: Date;
    details: any;
    evidence?: string[];
  } | null> {
    // In real implementation, this would query the database
    switch (requirementType) {
      case 'bod_meeting_attendance':
        return this.checkBODMeetingAttendance(memberId);
      
      case 'event_organizing_committee':
        return this.checkEventOrganizingCommittee(memberId);
      
      case 'event_participation':
        return this.checkEventParticipation(memberId);
      
      case 'jci_inspire_completion':
        return this.checkJCIInspireCompletion(memberId);
      
      default:
        return null;
    }
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

    for (const member of probationMembers) {
      const progress = await this.getPromotionProgress(member.id);
      if (progress?.isEligibleForPromotion) {
        const promotion = await this.promoteToFullMember(member.id, 'system', 'automatic');
        if (promotion) {
          promotions.push(promotion);
        }
      }
    }

    return promotions;
  }

  /**
   * Promote a Probation Member to Full Member
   */
  static async promoteToFullMember(
    memberId: string, 
    promotedBy: string, 
    method: 'automatic' | 'manual' = 'automatic',
    reason?: string
  ): Promise<PromotionHistory | null> {
    const member = await this.getMemberById(memberId);
    if (!member || member.membershipType !== 'Probation') {
      throw new Error('Member not found or not a Probation Member');
    }

    const progress = await this.getPromotionProgress(memberId);
    if (!progress) {
      throw new Error('Unable to get promotion progress');
    }

    // For manual promotions, allow override
    if (method === 'automatic' && !progress.isEligibleForPromotion) {
      throw new Error('Member is not eligible for automatic promotion');
    }

    // Update member status
    await this.updateMembershipType(memberId, 'Full');
    await this.updateMemberDues(memberId, this.FULL_MEMBER_DUES);

    // Create promotion history record
    const promotion: PromotionHistory = {
      id: `promotion_${memberId}_${Date.now()}`,
      memberId,
      memberName: member.name,
      fromMembershipType: 'Probation',
      toMembershipType: 'Full',
      promotionDate: new Date(),
      promotionMethod: method,
      promotedBy,
      requirementsCompleted: progress.requirements.filter(req => req.isCompleted),
    oldDuesAmount: this.PROBATION_DUES,
    newDuesAmount: this.FULL_MEMBER_DUES,
      notificationSent: false,
      notes: reason
    };

    await this.savePromotionHistory(promotion);

    // Send notification
    await this.sendPromotionNotification(promotion);

    return promotion;
  }

  /**
   * Create manual promotion request
   */
  static async createManualPromotionRequest(
    memberId: string,
    requestedBy: string,
    reason: string,
    overrideRequirements: boolean = false
  ): Promise<ManualPromotionRequest> {
    const member = await this.getMemberById(memberId);
    if (!member || member.membershipType !== 'Probation') {
      throw new Error('Member not found or not a Probation Member');
    }

    const progress = await this.getPromotionProgress(memberId);
    const missingRequirements = progress?.requirements
      .filter(req => !req.isCompleted)
      .map(req => req.name) || [];

    const request: ManualPromotionRequest = {
      id: `manual_promotion_${memberId}_${Date.now()}`,
      memberId,
      memberName: member.name,
      requestedBy,
      requestedAt: new Date(),
      reason,
      overrideRequirements,
      missingRequirements,
      status: 'pending'
    };

    await this.saveManualPromotionRequest(request);
    return request;
  }

  /**
   * Update member activity that might affect promotion requirements
   */
  static async updateMemberActivity(
    memberId: string,
    activityType: 'bod_meeting' | 'event_organizing' | 'event_participation' | 'course_completion',
    activityData: any
  ): Promise<void> {
    const member = await this.getMemberById(memberId);
    if (!member || member.membershipType !== 'Probation') {
      return; // Only track for Probation Members
    }

    // Record the activity
    await this.recordMemberActivity(memberId, activityType, activityData);

    // Check if this completes any requirements
    const progress = await this.getPromotionProgress(memberId);
    if (progress?.isEligibleForPromotion) {
      // Trigger automatic promotion if enabled
      const settings = await this.getPromotionSettings();
      if (settings.automaticPromotionEnabled) {
        await this.promoteToFullMember(memberId, 'system', 'automatic');
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
    const totalProbationMembers = probationMembers.length;

    let eligibleForPromotion = 0;
    const requirementCounts = {
      bod_meeting_attendance: 0,
      event_organizing_committee: 0,
      event_participation: 0,
      jci_inspire_completion: 0
    };

    for (const member of probationMembers) {
      const progress = await this.getPromotionProgress(member.id);
      if (progress?.isEligibleForPromotion) {
        eligibleForPromotion++;
      }
      
      progress?.requirements.forEach(req => {
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
    const all = await MembersService.getAllMembers(loIdFilter);
    return all.filter((m) => (m.membershipType || '') === 'Probation');
  }

  /** Public API for UI: list of probation members for display (id, name, joinDate). */
  static async getProbationMembersForDisplay(loIdFilter?: string | null): Promise<{ id: string; name: string; joinDate: string }[]> {
    const probation = await this.getProbationMembers(loIdFilter);
    return probation.map((m) => ({
      id: m.id,
      name: m.name || '',
      joinDate: (typeof m.joinDate === 'string' ? m.joinDate : m.joinDate ? String(m.joinDate) : '') || ''
    }));
  }

  private static async checkBODMeetingAttendance(memberId: string) {
    // Simulate checking BOD meeting attendance
    const hasAttended = Math.random() > 0.5;
    return hasAttended ? {
      completedAt: new Date('2023-06-15'),
      details: {
        meetingId: 'bod_meeting_2023_06',
        meetingDate: new Date('2023-06-15')
      },
      evidence: ['attendance_record_bod_2023_06.pdf']
    } : null;
  }

  private static async checkEventOrganizingCommittee(memberId: string) {
    // Simulate checking organizing committee participation
    const hasParticipated = Math.random() > 0.6;
    return hasParticipated ? {
      completedAt: new Date('2023-07-20'),
      details: {
        eventId: 'event_2023_07_charity',
        eventName: 'Charity Fundraiser 2023',
        role: 'Logistics Coordinator'
      },
      evidence: ['organizing_committee_certificate.pdf']
    } : null;
  }

  private static async checkEventParticipation(memberId: string) {
    // Simulate checking event participation
    const hasParticipated = Math.random() > 0.3;
    return hasParticipated ? {
      completedAt: new Date('2023-05-10'),
      details: {
        eventId: 'event_2023_05_training',
        eventName: 'Leadership Training Workshop'
      },
      evidence: ['participation_certificate.pdf']
    } : null;
  }

  private static async checkJCIInspireCompletion(memberId: string) {
    // Simulate checking JCI Inspire course completion
    const hasCompleted = Math.random() > 0.7;
    return hasCompleted ? {
      completedAt: new Date('2023-08-01'),
      details: {
        courseId: 'jci_inspire_2023',
        courseName: 'JCI Inspire Leadership Course',
        completionCertificate: 'jci_inspire_certificate_2023.pdf'
      },
      evidence: ['jci_inspire_certificate_2023.pdf']
    } : null;
  }

  private static async updateMembershipType(memberId: string, newType: string): Promise<void> {
    // Simulate database update
    console.log(`Updated member ${memberId} to ${newType} membership`);
  }

  private static async updateMemberDues(memberId: string, newAmount: number): Promise<void> {
    // Simulate database update
    console.log(`Updated member ${memberId} dues to RM${newAmount}`);
  }

  private static async savePromotionHistory(promotion: PromotionHistory): Promise<void> {
    // Simulate database save
    console.log(`Saved promotion history for member ${promotion.memberId}`);
  }

  private static async saveManualPromotionRequest(request: ManualPromotionRequest): Promise<void> {
    // Simulate database save
    console.log(`Saved manual promotion request for member ${request.memberId}`);
  }

  private static async sendPromotionNotification(promotion: PromotionHistory): Promise<void> {
    // Simulate sending notification
    const notification: PromotionNotification = {
      id: `notification_${promotion.id}`,
      memberId: promotion.memberId,
      memberName: promotion.memberName,
      memberEmail: 'member@example.com', // Would get from member record
      promotionDate: promotion.promotionDate,
      fromMembershipType: promotion.fromMembershipType,
      toMembershipType: promotion.toMembershipType,
      newDuesAmount: promotion.newDuesAmount,
      message: `Congratulations! You have been promoted to ${promotion.toMembershipType} Member. Your new dues amount is RM${promotion.newDuesAmount}.`,
      status: 'sent',
      sentAt: new Date(),
      retryCount: 0
    };

    console.log(`Sent promotion notification to ${notification.memberEmail}`);
  }

  private static async recordMemberActivity(
    memberId: string, 
    activityType: string, 
    activityData: any
  ): Promise<void> {
    // Simulate recording activity
    console.log(`Recorded ${activityType} activity for member ${memberId}`, activityData);
  }

  private static async getPromotionSettings(): Promise<PromotionSettings> {
    // Simulate getting settings
    return {
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
  }

  private static async getPromotionsInYear(year: number): Promise<PromotionHistory[]> {
    // Simulate getting promotions for a specific year
    return [];
  }

  private static async calculateAveragePromotionTime(): Promise<number> {
    // Simulate calculating average time from Probation to Full Member
    return 180; // 180 days average
  }
}