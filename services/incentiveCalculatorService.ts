import {
    collection,
    query,
    where,
    getDocs,
    Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import {
    IncentiveLogicId,
    IncentiveStandard,
    Member
} from '../types';
import { PointsService } from './pointsService';

export class IncentiveCalculatorService {
    /**
     * Main entry point to recalculate all automated standards for an LO
     * @param loId The Local Organization ID
     * @param programId The Active Incentive Program ID
     */
    static async calculateAll(loId: string, programId: string): Promise<void> {
        try {
            const standards = await PointsService.getStandards(programId);
            const autoStandards = standards.filter(s =>
                s.verificationType === 'AUTO_SYSTEM' || s.verificationType === 'HYBRID'
            );

            for (const standard of autoStandards) {
                if (standard.autoLogicId) {
                    await this.executeLogic(loId, standard);
                }
            }
        } catch (error) {
            console.error('Error in batch incentive calculation:', error);
            throw error;
        }
    }

    /**
     * Execute specific logic for a standard
     */
    private static async executeLogic(loId: string, standard: IncentiveStandard): Promise<void> {
        let result: { quantity: number; score: number; milestones?: any[] } = { quantity: 0, score: 0 };

        switch (standard.autoLogicId) {
            case IncentiveLogicId.EFFICIENT_MEMBERSHIP_CONVERSION:
                result = await this.calcMembershipConversion(loId, standard);
                break;
            case IncentiveLogicId.EFFICIENT_DUES_PAYMENT:
                result = await this.calcDuesPayment(loId, standard);
                break;
            case IncentiveLogicId.EFFICIENT_BOD_MEETINGS:
                result = await this.calcBODMeetings(loId, standard);
                break;
            case IncentiveLogicId.EFFICIENT_MEMBERSHIP_GROWTH:
                result = await this.calcMembershipGrowth(loId, standard);
                break;
            case IncentiveLogicId.NETWORK_EVENT_ATTENDANCE:
                result = await this.calcEventAttendance(loId, standard);
                break;
            default:
                // If no specific logic but milestones have activityType, run generic activity calc
                if (standard.milestones?.some(m => m.activityType)) {
                    result = await this.calcEventBasedMilestones(loId, standard);
                } else {
                    console.warn(`Logic ID ${standard.autoLogicId} not yet implemented.`);
                    return;
                }
        }

        // Handle milestones if they exist in result or standard
        if (result.milestones && result.milestones.length > 0) {
            if (standard.isTiered) {
                // Award points only for the highest achieved milestone
                const highest = [...result.milestones].sort((a, b) => b.points - a.points)[0];
                await this.syncSubmission(loId, standard, result.quantity, highest.points);
            } else {
                // Award points for each achieved milestone independently
                for (const ms of result.milestones) {
                    await this.syncSubmission(loId, standard, 1, ms.points, ms.id);
                }
            }
        } else if (result.quantity > 0 || result.score > 0) {
            await this.syncSubmission(loId, standard, result.quantity, result.score);
        }
    }

    /**
     * Logic: 30% / 50% / 60% conversion of Friends to Members
     */
    private static async calcMembershipConversion(loId: string, standard: IncentiveStandard): Promise<{ quantity: number, score: number, milestones?: any[] }> {
        const q = query(collection(db, COLLECTIONS.MEMBERS), where('loId', '==', loId));
        const snapshot = await getDocs(q);
        const members = snapshot.docs.map(d => d.data() as Member);

        const fullMembers = members.filter(m => m.role === 'MEMBER' || m.role === 'BOARD' || m.role === 'ADMIN');
        const totalPotential = members.length;

        if (totalPotential === 0) return { quantity: 0, score: 0 };

        const ratio = (fullMembers.length / totalPotential) * 100;

        // If standard has milestones, calculate which are achieved
        if (standard.milestones && standard.milestones.length > 0) {
            const achieved = standard.milestones.filter(ms => {
                const threshold = ms.logicThreshold || (parseFloat(ms.label.match(/\d+/)?.[0] || '0'));
                return ratio >= threshold;
            });
            return { quantity: ratio, score: 0, milestones: achieved };
        }

        const target = standard.logicParams?.targetPercent || 60;
        const fallbackPoints = standard.milestones?.[0]?.points || 0;

        if (ratio >= target) {
            return { quantity: 1, score: fallbackPoints };
        }

        return { quantity: 0, score: 0 };
    }

    /**
     * Logic: Dues payment before deadline
     */
    private static async calcDuesPayment(loId: string, standard: IncentiveStandard): Promise<{ quantity: number, score: number }> {
        const q = query(
            collection(db, COLLECTIONS.TRANSACTIONS),
            where('loId', '==', loId),
            where('category', '==', 'Membership'),
            where('purpose', '==', 'National Due')
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return { quantity: 0, score: 0 };

        const fallbackPoints = standard.milestones?.[0]?.points || 0;
        return { quantity: 1, score: fallbackPoints };
    }

    /**
     * Logic: BOD Meeting frequency
     */
    private static async calcBODMeetings(loId: string, standard: IncentiveStandard): Promise<{ quantity: number, score: number }> {
        const q = query(
            collection(db, COLLECTIONS.EVENTS),
            where('loId', '==', loId),
            where('type', '==', 'Meeting'),
            where('status', '==', 'Completed')
        );
        const snapshot = await getDocs(q);
        const count = snapshot.docs.length;
        const required = standard.logicParams?.minMeetings || 8;
        const fallbackPoints = standard.milestones?.[0]?.points || 0;

        if (count >= required) {
            return { quantity: count, score: fallbackPoints };
        }
        return { quantity: 0, score: 0 };
    }

    /**
     * Logic: Event Attendance (Network Star)
     */
    private static async calcEventAttendance(loId: string, standard: IncentiveStandard): Promise<{ quantity: number, score: number }> {
        const q = query(
            collection(db, COLLECTIONS.EVENT_REGISTRATIONS),
            where('loId', '==', loId),
            where('status', '==', 'checked_in')
        );
        const snapshot = await getDocs(q);

        const count = snapshot.docs.length;
        const fallbackPoints = standard.milestones?.[0]?.points || 5;
        const points = count * fallbackPoints;
        const cappedPoints = standard.pointCap ? Math.min(points, standard.pointCap) : points;

        return { quantity: count, score: cappedPoints };
    }

    /**
     * Logic: Membership Growth vs Baseline
     */
    private static async calcMembershipGrowth(loId: string, standard: IncentiveStandard): Promise<{ quantity: number, score: number }> {
        const q = query(collection(db, COLLECTIONS.MEMBERS), where('loId', '==', loId));
        const snapshot = await getDocs(q);
        const currentCount = snapshot.docs.length;

        const baselineCount = standard.logicParams?.baselineCount || 20;

        const growth = ((currentCount - baselineCount) / baselineCount) * 100;
        const target = standard.logicParams?.targetPercent || 10; // e.g. 10% growth
        const fallbackPoints = standard.milestones?.[0]?.points || 20;

        if (growth >= target) {
            return { quantity: currentCount - baselineCount, score: fallbackPoints };
        }

        return { quantity: 0, score: 0 };
    }

    /**
     * Logic: Generic Event-based milestones (based on activityType and minParticipants)
     */
    private static async calcEventBasedMilestones(loId: string, standard: IncentiveStandard): Promise<{ quantity: number, score: number, milestones?: any[] }> {
        if (!standard.milestones) return { quantity: 0, score: 0 };

        const achieved: any[] = [];

        const q = query(
            collection(db, COLLECTIONS.EVENTS),
            where('loId', '==', loId),
            where('status', '==', 'Completed')
        );
        const snapshot = await getDocs(q);
        const events = snapshot.docs.map(d => d.data());

        for (const ms of standard.milestones) {
            if (!ms.activityType) continue;

            const matchingEvents = events.filter(e => {
                const matchesType = e.type === ms.activityType;
                const matchesAttendance = ms.minParticipants ? (e.attendeeCount || 0) >= ms.minParticipants : true;
                return matchesType && matchesAttendance;
            });

            if (matchingEvents.length > 0) {
                achieved.push(ms);
            }
        }

        return { quantity: achieved.length, score: 0, milestones: achieved };
    }

    /**
     * Synchronize the calculation result with IncentiveSubmission table
     */
    private static async syncSubmission(loId: string, standard: IncentiveStandard, quantity: number, score: number, milestoneId?: string): Promise<void> {
        let q = query(
            collection(db, COLLECTIONS.INCENTIVE_SUBMISSIONS),
            where('loId', '==', loId),
            where('standardId', '==', standard.id)
        );

        if (milestoneId) {
            q = query(q, where('milestoneId', '==', milestoneId));
        }

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            // Create new auto-approved submission
            const submission: any = {
                standardId: standard.id,
                loId,
                quantity,
                scoreAwarded: score,
                status: 'APPROVED',
                evidenceText: `Auto-calculated${milestoneId ? ` for milestone ${milestoneId}` : ''} by system on ${new Date().toLocaleDateString()}`
            };
            if (milestoneId) submission.milestoneId = milestoneId;

            await PointsService.submitIncentiveClaim(submission);
        } else {
            // Update existing if it was an auto-submission
            const sub = snapshot.docs[0];
            const subData = sub.data();
            if (subData.status === 'APPROVED' && subData.evidenceText?.includes('Auto-calculated')) {
                const { doc, updateDoc } = await import('firebase/firestore');
                await updateDoc(doc(db, COLLECTIONS.INCENTIVE_SUBMISSIONS, sub.id), {
                    quantity,
                    scoreAwarded: score,
                    updatedAt: Timestamp.now()
                });
            }
        }
    }
}
