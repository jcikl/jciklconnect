// Churn Prediction Service - Predicts member churn risk
import { Member } from '../types';
import { MembersService } from './membersService';
import { EventsService } from './eventsService';
import { isDevMode } from '../utils/devMode';

export interface ChurnRiskFactors {
  attendanceRate: number;
  lastEventDate?: Date;
  daysSinceLastEvent: number;
  pointsEarnedLast30Days: number;
  duesStatus: 'Paid' | 'Pending' | 'Overdue';
  daysSinceJoin: number;
  engagementScore: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  riskScore: number; // 0-100
  recommendations: string[];
}

export class ChurnPredictionService {
  // Predict churn risk for a member
  static async predictChurnRisk(memberId: string): Promise<ChurnRiskFactors> {
    if (isDevMode()) {
      return this.getMockChurnRisk(memberId);
    }

    try {
      const member = await MembersService.getMemberById(memberId);
      if (!member) {
        throw new Error('Member not found');
      }

      // Get recent events
      const allEvents = await EventsService.getAllEvents();
      const recentEvents = allEvents
        .filter(e => {
          const eventDate = new Date(e.date);
          const now = new Date();
          const daysDiff = Math.floor((now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
          return daysDiff <= 30 && eventDate <= now;
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const lastEventDate = recentEvents.length > 0 ? new Date(recentEvents[0].date) : undefined;
      const daysSinceLastEvent = lastEventDate
        ? Math.floor((new Date().getTime() - lastEventDate.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      // Calculate days since join
      const joinDate = new Date(member.joinDate);
      const daysSinceJoin = Math.floor((new Date().getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24));

      // Calculate engagement score (0-100)
      let engagementScore = 0;
      engagementScore += Math.min(member.attendanceRate, 100) * 0.4; // 40% weight
      engagementScore += Math.min((member.points / 20), 50) * 0.3; // 30% weight (20 points = 50 score)
      engagementScore += member.duesStatus === 'Paid' ? 20 : 0; // 20% weight
      engagementScore += daysSinceLastEvent < 30 ? 10 : 0; // 10% weight

      // Calculate risk score (0-100, higher = more risk)
      let riskScore = 0;
      const recommendations: string[] = [];

      // Attendance rate factor
      if (member.attendanceRate < 50) {
        riskScore += 30;
        recommendations.push('Low attendance rate - consider attending more events');
      } else if (member.attendanceRate < 70) {
        riskScore += 15;
        recommendations.push('Moderate attendance - try to increase participation');
      }

      // Last event attendance
      if (daysSinceLastEvent > 90) {
        riskScore += 25;
        recommendations.push('Haven\'t attended events in 90+ days - reconnect with the community');
      } else if (daysSinceLastEvent > 60) {
        riskScore += 15;
        recommendations.push('Consider attending upcoming events to stay engaged');
      }

      // Dues status
      if (member.duesStatus === 'Overdue') {
        riskScore += 20;
        recommendations.push('Overdue dues - please complete payment to maintain membership');
      } else if (member.duesStatus === 'Pending') {
        riskScore += 10;
        recommendations.push('Pending dues payment - complete payment soon');
      }

      // Points activity
      if (member.points < 100 && daysSinceJoin > 180) {
        riskScore += 15;
        recommendations.push('Low point accumulation - consider participating in more activities');
      }

      // New member factor (less risk if very new)
      if (daysSinceJoin < 90) {
        riskScore -= 10; // Reduce risk for new members
      }

      // Determine risk level
      let riskLevel: 'Low' | 'Medium' | 'High';
      if (riskScore < 30) {
        riskLevel = 'Low';
      } else if (riskScore < 60) {
        riskLevel = 'Medium';
      } else {
        riskLevel = 'High';
      }

      // Ensure risk score is between 0-100
      riskScore = Math.max(0, Math.min(100, riskScore));

      return {
        attendanceRate: member.attendanceRate,
        lastEventDate,
        daysSinceLastEvent,
        pointsEarnedLast30Days: 0, // Would need point history to calculate
        duesStatus: member.duesStatus,
        daysSinceJoin,
        engagementScore: Math.round(engagementScore),
        riskLevel,
        riskScore: Math.round(riskScore),
        recommendations,
      };
    } catch (error) {
      console.error('Error predicting churn risk:', error);
      throw error;
    }
  }

  // Get all members at risk
  static async getMembersAtRisk(threshold: 'Low' | 'Medium' | 'High' = 'Medium'): Promise<Array<Omit<Member, 'churnRisk'> & { churnRisk: ChurnRiskFactors }>> {
    if (isDevMode()) {
      const allMembers = await MembersService.getAllMembers();
      return allMembers
        .filter(m => m.churnRisk === threshold || m.churnRisk === 'High')
        .map(m => {
          const { churnRisk, ...memberWithoutRisk } = m;
          return {
            ...memberWithoutRisk,
            churnRisk: this.getMockChurnRisk(m.id),
          };
        });
    }

    try {
      const allMembers = await MembersService.getAllMembers();
      const membersWithRisk = await Promise.all(
        allMembers.map(async (member) => {
          const risk = await this.predictChurnRisk(member.id);
          const { churnRisk, ...memberWithoutRisk } = member;
          return { ...memberWithoutRisk, churnRisk: risk };
        })
      );

      // Filter by threshold
      const riskThresholds = {
        Low: ['Low'],
        Medium: ['Low', 'Medium'],
        High: ['Low', 'Medium', 'High'],
      };

      return membersWithRisk
        .filter(m => riskThresholds[threshold].includes(m.churnRisk.riskLevel))
        .sort((a, b) => b.churnRisk.riskScore - a.churnRisk.riskScore);
    } catch (error) {
      console.error('Error getting members at risk:', error);
      throw error;
    }
  }

  // Mock churn risk for dev mode
  private static getMockChurnRisk(memberId: string): ChurnRiskFactors {
    return {
      attendanceRate: 65,
      daysSinceLastEvent: 45,
      pointsEarnedLast30Days: 50,
      duesStatus: 'Paid',
      daysSinceJoin: 365,
      engagementScore: 65,
      riskLevel: 'Medium',
      riskScore: 45,
      recommendations: [
        'Consider attending more events to increase engagement',
        'Participate in projects to earn more points',
      ],
    };
  }
}

