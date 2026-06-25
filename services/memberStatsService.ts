// Member Statistics Service - Generates comprehensive member statistics and reports
import { Member, Event, Project } from '../types';
import { MembersService } from './membersService';
import { EventsService } from './eventsService';
import { ProjectsService } from './projectsService';
import { isDevMode } from '../utils/devMode';

export interface MemberStatistics {
  totalMembers: number;
  activeMembers: number;
  newMembersThisMonth: number;
  newMembersThisYear: number;
  membersByRole: Record<string, number>;
  membersByTier: Record<string, number>;
  membersByDuesStatus: Record<string, number>;
  averagePoints: number;
  averageAttendanceRate: number;
  churnRiskDistribution: {
    low: number;
    medium: number;
    high: number;
  };
  growthTrend: Array<{ month: string; count: number }>;
  engagementMetrics: {
    highlyEngaged: number; // >80% attendance
    moderatelyEngaged: number; // 50-80% attendance
    lowEngaged: number; // <50% attendance
  };
  topPerformers: Array<{
    memberId: string;
    name: string;
    points: number;
    attendanceRate: number;
  }>;
}

export interface MemberReport {
  generatedAt: string;
  period: {
    start: string;
    end: string;
  };
  statistics: MemberStatistics;
  insights: string[];
  recommendations: string[];
}

export class MemberStatsService {
  // Generate comprehensive member statistics
  static async generateStatistics(year?: number): Promise<MemberStatistics> {
    if (isDevMode()) {
      return this.getMockStatistics();
    }

    try {
      const allMembers = await MembersService.getAllMembers();
      const now = new Date();
      const currentYear = year || now.getFullYear();
      const currentMonth = now.getMonth();

      // Filter members by year if specified
      const membersInPeriod = year
        ? allMembers.filter(m => {
            const joinDate = new Date(m.joinDate);
            return joinDate.getFullYear() <= year;
          })
        : allMembers;

      // Basic counts
      const totalMembers = membersInPeriod.length;
      const activeMembers = membersInPeriod.filter(
        m => m.duesStatus === 'Paid' && m.attendanceRate > 0
      ).length;

      // New members
      const newMembersThisMonth = allMembers.filter(m => {
        const joinDate = new Date(m.joinDate);
        return (
          joinDate.getFullYear() === currentYear &&
          joinDate.getMonth() === currentMonth
        );
      }).length;

      const newMembersThisYear = allMembers.filter(m => {
        const joinDate = new Date(m.joinDate);
        return joinDate.getFullYear() === currentYear;
      }).length;

      // Group by role
      const membersByRole: Record<string, number> = {};
      membersInPeriod.forEach(m => {
        membersByRole[m.role] = (membersByRole[m.role] || 0) + 1;
      });

      // Group by tier
      const membersByTier: Record<string, number> = {};
      membersInPeriod.forEach(m => {
        membersByTier[m.tier] = (membersByTier[m.tier] || 0) + 1;
      });

      // Group by dues status
      const membersByDuesStatus: Record<string, number> = {};
      membersInPeriod.forEach(m => {
        membersByDuesStatus[m.duesStatus] = (membersByDuesStatus[m.duesStatus] || 0) + 1;
      });

      // Averages
      const totalPoints = membersInPeriod.reduce((sum, m) => sum + m.points, 0);
      const averagePoints = totalMembers > 0 ? totalPoints / totalMembers : 0;

      const totalAttendance = membersInPeriod.reduce((sum, m) => sum + m.attendanceRate, 0);
      const averageAttendanceRate = totalMembers > 0 ? totalAttendance / totalMembers : 0;

      // Churn risk distribution
      const churnRiskDistribution = {
        low: membersInPeriod.filter(m => m.churnRisk === 'Low').length,
        medium: membersInPeriod.filter(m => m.churnRisk === 'Medium').length,
        high: membersInPeriod.filter(m => m.churnRisk === 'High').length,
      };

      // Growth trend (last 12 months)
      const growthTrend: Array<{ month: string; count: number }> = [];
      for (let i = 11; i >= 0; i--) {
        const date = new Date(currentYear, currentMonth - i, 1);
        const monthStr = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        const count = allMembers.filter(m => {
          const joinDate = new Date(m.joinDate);
          return (
            joinDate.getFullYear() === date.getFullYear() &&
            joinDate.getMonth() === date.getMonth()
          );
        }).length;
        growthTrend.push({ month: monthStr, count });
      }

      // Engagement metrics
      const engagementMetrics = {
        highlyEngaged: membersInPeriod.filter(m => m.attendanceRate > 80).length,
        moderatelyEngaged: membersInPeriod.filter(
          m => m.attendanceRate >= 50 && m.attendanceRate <= 80
        ).length,
        lowEngaged: membersInPeriod.filter(m => m.attendanceRate < 50).length,
      };

      // Top performers (top 10 by points)
      const topPerformers = membersInPeriod
        .map(m => ({
          memberId: m.id,
          name: m.name,
          points: m.points,
          attendanceRate: m.attendanceRate,
        }))
        .sort((a, b) => b.points - a.points)
        .slice(0, 10);

      return {
        totalMembers,
        activeMembers,
        newMembersThisMonth,
        newMembersThisYear,
        membersByRole,
        membersByTier,
        membersByDuesStatus,
        averagePoints: Math.round(averagePoints * 10) / 10,
        averageAttendanceRate: Math.round(averageAttendanceRate * 10) / 10,
        churnRiskDistribution,
        growthTrend,
        engagementMetrics,
        topPerformers,
      };
    } catch (error) {
      console.error('Error generating member statistics:', error);
      throw error;
    }
  }

  // Generate comprehensive member report with insights
  static async generateReport(year?: number): Promise<MemberReport> {
    try {
      const statistics = await this.generateStatistics(year);
      const now = new Date();
      const currentYear = year || now.getFullYear();

      const insights: string[] = [];
      const recommendations: string[] = [];

      // Generate insights
      if (statistics.newMembersThisMonth > 0) {
        insights.push(
          `${statistics.newMembersThisMonth} new members joined this month`
        );
      }

      if (statistics.churnRiskDistribution.high > 0) {
        insights.push(
          `${statistics.churnRiskDistribution.high} members are at high risk of churn`
        );
        recommendations.push(
          'Implement targeted engagement programs for high-risk members'
        );
      }

      if (statistics.engagementMetrics.lowEngaged > statistics.engagementMetrics.highlyEngaged) {
        insights.push(
          'More members have low engagement than high engagement'
        );
        recommendations.push(
          'Focus on increasing overall member engagement through events and projects'
        );
      }

      if (statistics.averageAttendanceRate < 70) {
        insights.push(
          `Average attendance rate is ${statistics.averageAttendanceRate.toFixed(1)}%, below target of 70%`
        );
        recommendations.push(
          'Review event scheduling and member communication to improve attendance'
        );
      }

      if (statistics.membersByDuesStatus.Overdue > 0) {
        insights.push(
          `${statistics.membersByDuesStatus.Overdue} members have overdue dues`
        );
        recommendations.push(
          'Send reminders and follow up with members who have overdue dues'
        );
      }

      return {
        generatedAt: new Date().toISOString(),
        period: {
          start: `${currentYear}-01-01`,
          end: `${currentYear}-12-31`,
        },
        statistics,
        insights,
        recommendations,
      };
    } catch (error) {
      console.error('Error generating member report:', error);
      throw error;
    }
  }

  // Mock statistics for dev mode
  private static getMockStatistics(): MemberStatistics {
    return {
      totalMembers: 142,
      activeMembers: 128,
      newMembersThisMonth: 5,
      newMembersThisYear: 23,
      membersByRole: {
        Member: 120,
        Board: 15,
        Admin: 7,
      },
      membersByTier: {
        Bronze: 45,
        Silver: 52,
        Gold: 35,
        Platinum: 10,
      },
      membersByDuesStatus: {
        Paid: 128,
        Pending: 10,
        Overdue: 4,
      },
      averagePoints: 650,
      averageAttendanceRate: 72.5,
      churnRiskDistribution: {
        low: 95,
        medium: 35,
        high: 12,
      },
      growthTrend: [
        { month: 'Jan 2024', count: 3 },
        { month: 'Feb 2024', count: 2 },
        { month: 'Mar 2024', count: 4 },
        { month: 'Apr 2024', count: 1 },
        { month: 'May 2024', count: 5 },
        { month: 'Jun 2024', count: 2 },
        { month: 'Jul 2024', count: 3 },
        { month: 'Aug 2024', count: 1 },
        { month: 'Sep 2024', count: 2 },
        { month: 'Oct 2024', count: 0 },
        { month: 'Nov 2024', count: 0 },
        { month: 'Dec 2024', count: 0 },
      ],
      engagementMetrics: {
        highlyEngaged: 65,
        moderatelyEngaged: 55,
        lowEngaged: 22,
      },
      topPerformers: [
        { memberId: 'u4', name: 'Jessica Day', points: 2100, attendanceRate: 98 },
        { memberId: 'u1', name: 'Alex Rivera', points: 1250, attendanceRate: 92 },
        { memberId: 'u2', name: 'Sarah Chen', points: 850, attendanceRate: 85 },
      ],
    };
  }
}

