// AI Prediction Service - Advanced AI predictions for events, projects, and sponsors
import { Event, Project, Member } from '../types';
import { EventsService } from './eventsService';
import { ProjectsService } from './projectsService';
import { MembersService } from './membersService';
import { isDevMode } from '../utils/devMode';

export interface EventDemandPrediction {
  eventId?: string;
  eventType: string;
  predictedAttendance: number;
  confidence: number; // 0-100
  factors: {
    historicalAverage: number;
    memberInterest: number;
    timeOfYear: number;
    competingEvents: number;
  };
  recommendations: string[];
  optimalDate?: string;
  optimalTime?: string;
}

export interface ProjectSuccessPrediction {
  projectId: string;
  successProbability: number; // 0-100
  riskLevel: 'Low' | 'Medium' | 'High';
  factors: {
    teamExperience: number;
    budgetAdequacy: number;
    timelineRealism: number;
    resourceAvailability: number;
    memberEngagement: number;
  };
  predictedCompletionDate?: string;
  risks: Array<{
    description: string;
    severity: 'Low' | 'Medium' | 'High';
    mitigation: string;
  }>;
  recommendations: string[];
}

export interface SponsorMatch {
  sponsorId?: string;
  sponsorName: string;
  matchScore: number; // 0-100
  projectId?: string;
  projectName?: string;
  reasons: string[];
  contactInfo?: {
    email?: string;
    phone?: string;
    website?: string;
  };
  previousEngagement?: {
    events: number;
    projects: number;
    totalContribution: number;
  };
}

export interface SentimentAnalysis {
  source: 'post' | 'feedback' | 'survey' | 'comment';
  sourceId: string;
  overallSentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number; // -100 to 100
  emotions: {
    joy: number;
    trust: number;
    fear: number;
    anger: number;
    sadness: number;
    surprise: number;
  };
  keyTopics: string[];
  actionableInsights: string[];
}

export interface MemberChurnPrediction {
  memberId: string;
  churnRisk: 'Low' | 'Medium' | 'High';
  churnProbability: number; // 0-100
  riskFactors: Array<{
    factor: string;
    severity: 'Low' | 'Medium' | 'High';
    description: string;
  }>;
  lastActivityDate?: string;
  daysSinceLastActivity: number;
  recommendations: string[];
  interventionPriority: 'Low' | 'Medium' | 'High' | 'Critical';
}

export interface PersonalizedRecommendation {
  type: 'project' | 'event' | 'training' | 'mentorship' | 'role' | 'hobby_club' | 'business_opportunity';
  itemId: string;
  itemName: string;
  matchScore: number; // 0-100
  reasons: string[];
  priority: 'Low' | 'Medium' | 'High';
  actionUrl?: string;
  metadata?: Record<string, any>;
}

export class AIPredictionService {
  // Predict event demand
  static async predictEventDemand(
    eventType: string,
    proposedDate?: string,
    location?: string
  ): Promise<EventDemandPrediction> {
    if (isDevMode()) {
      return this.getMockEventDemand(eventType);
    }

    try {
      const allEvents = await EventsService.getAllEvents();
      const allMembers = await MembersService.getAllMembers();

      // Calculate historical average for this event type
      const historicalEvents = allEvents.filter(e => e.type === eventType);
      const historicalAverage = historicalEvents.length > 0
        ? historicalEvents.reduce((sum, e) => sum + e.attendees, 0) / historicalEvents.length
        : 20; // Default if no history

      // Calculate member interest (based on past attendance to similar events)
      const activeMembers = allMembers.filter(m => m.attendanceRate > 50);
      const memberInterest = activeMembers.length * 0.3; // 30% of active members typically attend

      // Time of year factor (events in Q1 and Q4 tend to have higher attendance)
      const proposedDateObj = proposedDate ? new Date(proposedDate) : new Date();
      const month = proposedDateObj.getMonth();
      const timeOfYearFactor = (month >= 0 && month <= 2) || (month >= 9 && month <= 11) ? 1.2 : 1.0;

      // Competing events (events on same day reduce attendance)
      const competingEvents = allEvents.filter(e => {
        if (!proposedDate) return false;
        const eventDate = new Date(e.date);
        const proposed = new Date(proposedDate);
        return (
          eventDate.getDate() === proposed.getDate() &&
          eventDate.getMonth() === proposed.getMonth() &&
          eventDate.getFullYear() === proposed.getFullYear()
        );
      }).length;

      // Calculate predicted attendance
      let predictedAttendance = Math.round(
        (historicalAverage * 0.4) +
        (memberInterest * 0.4) +
        (historicalAverage * timeOfYearFactor * 0.2)
      );

      // Reduce for competing events
      predictedAttendance = Math.max(0, predictedAttendance - (competingEvents * 5));

      // Calculate confidence (based on data availability)
      let confidence = 50;
      if (historicalEvents.length >= 5) confidence += 20;
      if (activeMembers.length >= 50) confidence += 15;
      if (proposedDate) confidence += 15;
      confidence = Math.min(100, confidence);

      // Generate recommendations
      const recommendations: string[] = [];
      if (competingEvents > 0) {
        recommendations.push(`Consider rescheduling - ${competingEvents} other event(s) on the same day`);
      }
      if (predictedAttendance < 15) {
        recommendations.push('Low predicted attendance - consider promoting more or adjusting event type');
      }
      if (timeOfYearFactor > 1.1) {
        recommendations.push('Good timing - this period typically has higher attendance');
      }
      if (predictedAttendance > 50) {
        recommendations.push('High demand expected - ensure adequate venue capacity and resources');
      }

      return {
        eventType,
        predictedAttendance,
        confidence,
        factors: {
          historicalAverage: Math.round(historicalAverage),
          memberInterest: Math.round(memberInterest),
          timeOfYear: timeOfYearFactor,
          competingEvents,
        },
        recommendations,
        optimalDate: proposedDate,
      };
    } catch (error) {
      console.error('Error predicting event demand:', error);
      throw error;
    }
  }

  // Predict project success
  static async predictProjectSuccess(projectId: string): Promise<ProjectSuccessPrediction> {
    if (isDevMode()) {
      return this.getMockProjectSuccess(projectId);
    }

    try {
      const project = await ProjectsService.getProjectById(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const allProjects = await ProjectsService.getAllProjects();
      const allMembers = await MembersService.getAllMembers();

      // Get team members
      const teamMemberIds = project.team || [];
      const teamMembers = teamMemberIds
        .map(id => allMembers.find(m => m.id === id))
        .filter(Boolean) as Member[];

      // Calculate team experience (average points and tier)
      const teamExperience = teamMembers.length > 0
        ? teamMembers.reduce((sum, m) => sum + m.points, 0) / teamMembers.length
        : 0;
      const experienceScore = Math.min(100, (teamExperience / 20) * 100); // 20 points = 100 score

      const budget = project.budget ?? project.proposedBudget ?? 0;
      const spent = project.spent ?? 0;
      const budgetAdequacy = budget > 0
        ? Math.min(100, ((budget - spent) / budget) * 100)
        : 50;

      const completion = project.completion ?? 0;
      const timelineRealism = completion > 0 ? 75 : 50;

      // Resource availability (team size vs project complexity)
      const resourceAvailability = teamMembers.length >= 3 ? 80 : teamMembers.length >= 2 ? 60 : 40;

      // Member engagement (average attendance rate of team)
      const memberEngagement = teamMembers.length > 0
        ? teamMembers.reduce((sum, m) => sum + m.attendanceRate, 0) / teamMembers.length
        : 50;

      // Calculate success probability
      const successProbability = Math.round(
        (experienceScore * 0.25) +
        (budgetAdequacy * 0.20) +
        (timelineRealism * 0.20) +
        (resourceAvailability * 0.20) +
        (memberEngagement * 0.15)
      );

      // Determine risk level
      let riskLevel: 'Low' | 'Medium' | 'High';
      if (successProbability >= 70) {
        riskLevel = 'Low';
      } else if (successProbability >= 50) {
        riskLevel = 'Medium';
      } else {
        riskLevel = 'High';
      }

      // Identify risks
      const risks: ProjectSuccessPrediction['risks'] = [];
      if (teamMembers.length < 2) {
        risks.push({
          description: 'Limited team size may impact project delivery',
          severity: 'High',
          mitigation: 'Consider adding more team members or adjusting project scope',
        });
      }
      if (budgetAdequacy < 30) {
        risks.push({
          description: 'Budget may be insufficient for project completion',
          severity: 'High',
          mitigation: 'Review budget allocation or seek additional funding',
        });
      }
      if (memberEngagement < 60) {
        risks.push({
          description: 'Low team engagement may affect project momentum',
          severity: 'Medium',
          mitigation: 'Implement engagement strategies and regular check-ins',
        });
      }

      // Generate recommendations
      const recommendations: string[] = [];
      if (successProbability < 60) {
        recommendations.push('Project success probability is below optimal - review and adjust key factors');
      }
      if (teamMembers.length < 3) {
        recommendations.push('Consider expanding team to improve resource availability');
      }
      if (budgetAdequacy < 50) {
        recommendations.push('Review budget allocation to ensure adequate funding');
      }
      if (memberEngagement < 70) {
        recommendations.push('Focus on improving team engagement through regular communication');
      }

      return {
        projectId,
        successProbability,
        riskLevel,
        factors: {
          teamExperience: Math.round(experienceScore),
          budgetAdequacy: Math.round(budgetAdequacy),
          timelineRealism,
          resourceAvailability,
          memberEngagement: Math.round(memberEngagement),
        },
        risks,
        recommendations,
      };
    } catch (error) {
      console.error('Error predicting project success:', error);
      throw error;
    }
  }

  // Match sponsors to projects
  static async matchSponsors(projectId?: string, projectName?: string): Promise<SponsorMatch[]> {
    if (isDevMode()) {
      return this.getMockSponsorMatches(projectId);
    }

    try {
      // This would typically query a sponsors database
      // For now, we'll use business profiles as potential sponsors
      const { BusinessDirectoryService } = await import('./businessDirectoryService');
      const businesses = await BusinessDirectoryService.getAllBusinesses();

      const project = projectId ? await ProjectsService.getProjectById(projectId) : null;

      // Match businesses based on industry, project needs, etc.
      const matches: SponsorMatch[] = businesses.slice(0, 10).map((biz, index) => {
        let matchScore = 50; // Base score
        const reasons: string[] = [];

        // Industry alignment (simplified - would need actual industry matching)
        if (biz.industry) {
          matchScore += 15;
          reasons.push(`Industry alignment: ${biz.industry}`);
        }

        // Business size (based on website presence - established businesses more likely to sponsor)
        if (biz.website) {
          matchScore += 10;
          reasons.push('Established business with online presence');
        }

        // Project-specific matching (if project provided)
        if (project) {
          if (project.description && biz.description) {
            const projectKeywords = project.description.toLowerCase().split(' ');
            const bizKeywords = biz.description.toLowerCase().split(' ');
            const commonKeywords = projectKeywords.filter(k => bizKeywords.includes(k));
            if (commonKeywords.length > 0) {
              matchScore += 15;
              reasons.push(`Shared interests: ${commonKeywords.slice(0, 3).join(', ')}`);
            }
          }
        }

        matchScore = Math.min(100, matchScore);

        return {
          sponsorId: biz.id,
          sponsorName: biz.companyName,
          matchScore,
          projectId,
          projectName: project?.name,
          reasons,
          contactInfo: {
            email: undefined, // BusinessProfile doesn't have email field
            phone: undefined, // BusinessProfile doesn't have phone field
            website: biz.website, // Use website as contact info
          },
        };
      });

      // Sort by match score (highest first)
      return matches.sort((a, b) => b.matchScore - a.matchScore);
    } catch (error) {
      console.error('Error matching sponsors:', error);
      throw error;
    }
  }

  // Analyze sentiment from text
  static async analyzeSentiment(
    text: string,
    source: SentimentAnalysis['source'],
    sourceId: string
  ): Promise<SentimentAnalysis> {
    if (isDevMode()) {
      return this.getMockSentiment(text, source, sourceId);
    }

    try {
      // Simple sentiment analysis based on keywords
      // In production, this would use a proper NLP service
      const lowerText = text.toLowerCase();

      // Positive keywords
      const positiveKeywords = ['great', 'excellent', 'amazing', 'wonderful', 'good', 'love', 'enjoy', 'happy', 'satisfied', 'helpful', 'thanks', 'thank you'];
      const negativeKeywords = ['bad', 'terrible', 'awful', 'disappointed', 'frustrated', 'angry', 'hate', 'poor', 'worst', 'problem', 'issue', 'complaint'];

      let positiveCount = 0;
      let negativeCount = 0;

      positiveKeywords.forEach(keyword => {
        if (lowerText.includes(keyword)) positiveCount++;
      });

      negativeKeywords.forEach(keyword => {
        if (lowerText.includes(keyword)) negativeCount++;
      });

      // Calculate sentiment score (-100 to 100)
      const sentimentScore = Math.max(-100, Math.min(100, (positiveCount - negativeCount) * 20));

      // Determine overall sentiment
      let overallSentiment: 'positive' | 'neutral' | 'negative';
      if (sentimentScore > 20) {
        overallSentiment = 'positive';
      } else if (sentimentScore < -20) {
        overallSentiment = 'negative';
      } else {
        overallSentiment = 'neutral';
      }

      // Extract key topics (simplified - would use NLP in production)
      const keyTopics: string[] = [];
      const topicKeywords = ['event', 'project', 'training', 'meeting', 'member', 'leadership', 'community', 'network'];
      topicKeywords.forEach(topic => {
        if (lowerText.includes(topic)) {
          keyTopics.push(topic);
        }
      });

      // Generate actionable insights
      const actionableInsights: string[] = [];
      if (overallSentiment === 'negative') {
        actionableInsights.push('Negative sentiment detected - follow up with member to address concerns');
      }
      if (overallSentiment === 'positive') {
        actionableInsights.push('Positive feedback - consider using as testimonial or case study');
      }
      if (keyTopics.length > 0) {
        actionableInsights.push(`Key topics identified: ${keyTopics.join(', ')} - relevant for future planning`);
      }

      // Emotion analysis (simplified)
      const emotions = {
        joy: positiveCount > 0 ? Math.min(100, positiveCount * 20) : 0,
        trust: positiveCount > 0 ? Math.min(100, positiveCount * 15) : 0,
        fear: negativeCount > 0 ? Math.min(100, negativeCount * 15) : 0,
        anger: negativeCount > 0 ? Math.min(100, negativeCount * 20) : 0,
        sadness: negativeCount > 0 ? Math.min(100, negativeCount * 10) : 0,
        surprise: (positiveCount + negativeCount) > 0 ? 30 : 0,
      };

      return {
        source,
        sourceId,
        overallSentiment,
        sentimentScore,
        emotions,
        keyTopics,
        actionableInsights,
      };
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
      throw error;
    }
  }

  // Mock functions for dev mode
  private static getMockEventDemand(eventType: string): EventDemandPrediction {
    return {
      eventType,
      predictedAttendance: 35,
      confidence: 75,
      factors: {
        historicalAverage: 30,
        memberInterest: 25,
        timeOfYear: 1.1,
        competingEvents: 0,
      },
      recommendations: ['Good timing for this event type', 'Consider promoting 2 weeks in advance'],
    };
  }

  private static getMockProjectSuccess(projectId: string): ProjectSuccessPrediction {
    return {
      projectId,
      successProbability: 72,
      riskLevel: 'Low',
      factors: {
        teamExperience: 75,
        budgetAdequacy: 80,
        timelineRealism: 70,
        resourceAvailability: 75,
        memberEngagement: 65,
      },
      risks: [],
      recommendations: ['Project is on track for success', 'Maintain current momentum'],
    };
  }

  private static getMockSponsorMatches(projectId?: string): SponsorMatch[] {
    return [
      {
        sponsorName: 'Tech Solutions Inc.',
        matchScore: 85,
        projectId,
        reasons: ['Industry alignment', 'Local business', 'Previous engagement'],
      },
      {
        sponsorName: 'Community Bank',
        matchScore: 78,
        projectId,
        reasons: ['Community focus', 'Established business'],
      },
    ];
  }

  private static getMockSentiment(
    text: string,
    source: SentimentAnalysis['source'],
    sourceId: string
  ): SentimentAnalysis {
    return {
      source,
      sourceId,
      overallSentiment: 'positive',
      sentimentScore: 65,
      emotions: {
        joy: 70,
        trust: 60,
        fear: 10,
        anger: 5,
        sadness: 5,
        surprise: 30,
      },
      keyTopics: ['event', 'member'],
      actionableInsights: ['Positive feedback received', 'Consider following up for more details'],
    };
  }

  // Predict member churn risk
  static async predictMemberChurn(memberId: string): Promise<MemberChurnPrediction> {
    if (isDevMode()) {
      return this.getMockChurnPrediction(memberId);
    }

    try {
      const member = await MembersService.getMemberById(memberId);
      if (!member) {
        throw new Error('Member not found');
      }

      const allEvents = await EventsService.getAllEvents();
      const allProjects = await ProjectsService.getAllProjects();

      // Calculate risk factors
      const riskFactors: MemberChurnPrediction['riskFactors'] = [];
      let churnScore = 0;

      // Attendance rate factor
      if (member.attendanceRate < 30) {
        churnScore += 40;
        riskFactors.push({
          factor: 'Low Attendance Rate',
          severity: 'High',
          description: `Attendance rate is ${member.attendanceRate}%, well below average`,
        });
      } else if (member.attendanceRate < 50) {
        churnScore += 20;
        riskFactors.push({
          factor: 'Below Average Attendance',
          severity: 'Medium',
          description: `Attendance rate is ${member.attendanceRate}%, below average`,
        });
      }

      // Points activity factor
      if (member.points < 100) {
        churnScore += 20;
        riskFactors.push({
          factor: 'Low Point Accumulation',
          severity: 'Medium',
          description: 'Limited engagement activity reflected in low points',
        });
      }

      // Dues status factor
      if (member.duesStatus === 'Overdue') {
        churnScore += 30;
        riskFactors.push({
          factor: 'Overdue Dues',
          severity: 'High',
          description: 'Membership dues are overdue - immediate attention required',
        });
      } else if (member.duesStatus === 'Pending') {
        churnScore += 10;
        riskFactors.push({
          factor: 'Pending Dues',
          severity: 'Low',
          description: 'Dues payment is pending',
        });
      }

      // Recent activity factor (simplified - would check actual last activity date)
      const daysSinceJoin = Math.floor((new Date().getTime() - new Date(member.joinDate).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceJoin > 365 && member.points < 200) {
        churnScore += 15;
        riskFactors.push({
          factor: 'Long-term Low Engagement',
          severity: 'Medium',
          description: 'Member has been with LO for over a year but shows limited engagement',
        });
      }

      // Project participation factor
      const memberProjects = allProjects.filter(p => p.team?.includes(memberId) || p.lead === memberId);
      if (memberProjects.length === 0 && daysSinceJoin > 180) {
        churnScore += 15;
        riskFactors.push({
          factor: 'No Project Participation',
          severity: 'Medium',
          description: 'Member has not participated in any projects',
        });
      }

      // Determine churn risk level
      let churnRisk: 'Low' | 'Medium' | 'High';
      let interventionPriority: 'Low' | 'Medium' | 'High' | 'Critical';
      if (churnScore >= 60) {
        churnRisk = 'High';
        interventionPriority = 'Critical';
      } else if (churnScore >= 35) {
        churnRisk = 'Medium';
        interventionPriority = 'High';
      } else {
        churnRisk = 'Low';
        interventionPriority = churnScore >= 20 ? 'Medium' : 'Low';
      }

      // Generate recommendations
      const recommendations: string[] = [];
      if (member.attendanceRate < 50) {
        recommendations.push('Invite member to upcoming events matching their interests');
      }
      if (member.duesStatus === 'Overdue') {
        recommendations.push('Contact member immediately regarding overdue dues payment');
      }
      if (memberProjects.length === 0) {
        recommendations.push('Suggest relevant projects based on member skills and interests');
      }
      if (member.points < 100) {
        recommendations.push('Encourage participation in activities to earn points and improve engagement');
      }
      if (riskFactors.length === 0) {
        recommendations.push('Member shows good engagement - maintain regular communication');
      }

      return {
        memberId,
        churnRisk,
        churnProbability: Math.min(100, churnScore),
        riskFactors,
        daysSinceLastActivity: 0, // Would calculate from actual last activity
        recommendations,
        interventionPriority,
      };
    } catch (error) {
      console.error('Error predicting member churn:', error);
      throw error;
    }
  }

  // Get personalized recommendations for a member
  static async getPersonalizedRecommendations(memberId: string, limit: number = 10): Promise<PersonalizedRecommendation[]> {
    if (isDevMode()) {
      return this.getMockRecommendations(memberId, limit);
    }

    try {
      const member = await MembersService.getMemberById(memberId);
      if (!member) {
        throw new Error('Member not found');
      }

      const allEvents = await EventsService.getAllEvents();
      const allProjects = await ProjectsService.getAllProjects();
      const { LearningPathsService } = await import('./learningPathsService');
      const { HobbyClubsService } = await import('./hobbyClubsService');
      const { BusinessDirectoryService } = await import('./businessDirectoryService');

      const recommendations: PersonalizedRecommendation[] = [];

      // Project recommendations based on skills
      const availableProjects = allProjects.filter(p => 
        p.status === 'Active' && 
        !p.team?.includes(memberId) && 
        p.lead !== memberId
      );

      for (const project of availableProjects.slice(0, 5)) {
        let matchScore = 50; // Base score
        const reasons: string[] = [];

        // Skill matching
        if (project.description && member.skills) {
          // Use description as a proxy for skills matching
          const matchingSkills = member.skills.filter(skill =>
            project.description.toLowerCase().includes(skill.toLowerCase())
          );
          if (matchingSkills.length > 0) {
            matchScore += matchingSkills.length * 15;
            reasons.push(`Skills match: ${matchingSkills.join(', ')}`);
          }
        }

        // Tier matching (higher tier members might be better for leadership roles)
        if (member.tier === 'Gold' || member.tier === 'Platinum') {
          matchScore += 10;
          reasons.push('Your leadership tier makes you a great fit');
        }

        if (matchScore > 50) {
          recommendations.push({
            type: 'project' as const,
            itemId: project.id!,
            itemName: project.name,
            matchScore: Math.min(100, matchScore),
            reasons,
            priority: matchScore >= 75 ? 'High' : matchScore >= 60 ? 'Medium' : 'Low',
            actionUrl: `/projects/${project.id}`,
            metadata: { projectStatus: project.status },
          });
        }
      }

      // Event recommendations based on past attendance and interests
      const upcomingEvents = allEvents.filter(e => 
        new Date(e.date) >= new Date() && 
        e.status === 'Upcoming'
      );

      for (const event of upcomingEvents.slice(0, 5)) {
        let matchScore = 40; // Base score
        const reasons: string[] = [];

        // Event type preference (simplified - would use actual preferences)
        if (member.skills.some(skill => event.type.toLowerCase().includes(skill.toLowerCase()))) {
          matchScore += 20;
          reasons.push(`Event type aligns with your interests`);
        }

        // Time-based recommendation (events in next 2 weeks)
        const daysUntilEvent = Math.floor((new Date(event.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilEvent <= 14 && daysUntilEvent >= 0) {
          matchScore += 15;
          reasons.push('Happening soon - perfect timing');
        }

        if (matchScore > 50) {
          recommendations.push({
            type: 'event' as const,
            itemId: event.id!,
            itemName: event.title,
            matchScore: Math.min(100, matchScore),
            reasons,
            priority: matchScore >= 70 ? 'High' : 'Medium',
            actionUrl: `/events/${event.id}`,
            metadata: { eventDate: event.date, eventType: event.type },
          });
        }
      }

      // Training recommendations
      try {
        // Mock learning paths data since getAllPaths doesn't exist
        const learningPaths = [
          { 
            id: '1', 
            title: 'Leadership Development', 
            category: 'Leadership',
            active: true,
            skillsRequired: ['leadership', 'communication'],
            name: 'Leadership Development',
            estimatedDuration: '4 weeks'
          },
          { 
            id: '2', 
            title: 'Project Management', 
            category: 'Management',
            active: true,
            skillsRequired: ['project management', 'planning'],
            name: 'Project Management',
            estimatedDuration: '6 weeks'
          },
          { 
            id: '3', 
            title: 'Public Speaking', 
            category: 'Communication',
            active: true,
            skillsRequired: ['public speaking', 'presentation'],
            name: 'Public Speaking',
            estimatedDuration: '3 weeks'
          }
        ];
        const availablePaths = learningPaths.filter(path => path.active);

        for (const path of availablePaths.slice(0, 3)) {
          let matchScore = 45;
          const reasons: string[] = [];

          // Skill-based matching
          if (path.skillsRequired && member.skills) {
            const matchingSkills = path.skillsRequired.filter(skill =>
              member.skills.some(ms => ms.toLowerCase().includes(skill.toLowerCase()))
            );
            if (matchingSkills.length > 0) {
              matchScore += matchingSkills.length * 20;
              reasons.push(`Builds on your existing skills: ${matchingSkills.join(', ')}`);
            }
          }

          if (matchScore > 50) {
            recommendations.push({
              type: 'training' as const,
              itemId: path.id!,
              itemName: path.name,
              matchScore: Math.min(100, matchScore),
              reasons,
              priority: matchScore >= 70 ? 'High' : 'Medium',
              actionUrl: `/knowledge/learning/${path.id}`,
              metadata: { estimatedDuration: path.estimatedDuration },
            });
          }
        }
      } catch (err) {
        // Learning paths service might not be available
      }

      // Hobby club recommendations
      try {
        const clubs = await HobbyClubsService.getAllClubs();
        const availableClubs = clubs.filter(c => c.name); // Remove status check since HobbyClub doesn't have status

        for (const club of availableClubs.slice(0, 3)) {
          let matchScore = 40;
          const reasons: string[] = [];

          // Interest matching (simplified)
          if (club.category && member.skills.some(skill => club.category.toLowerCase().includes(skill.toLowerCase()))) {
            matchScore += 25;
            reasons.push('Matches your interests');
          }

          if (matchScore > 50) {
            recommendations.push({
              type: 'hobby_club' as const,
              itemId: club.id!,
              itemName: club.name,
              matchScore: Math.min(100, matchScore),
              reasons,
              priority: 'Medium',
              actionUrl: `/hobby-clubs/${club.id}`,
              metadata: { memberCount: club.membersCount },
            });
          }
        }
      } catch (err) {
        // Hobby clubs service might not be available
      }

      // Sort by match score and priority
      recommendations.sort((a, b) => {
        const priorityOrder = { High: 3, Medium: 2, Low: 1 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        return b.matchScore - a.matchScore;
      });

      return recommendations.slice(0, limit);
    } catch (error) {
      console.error('Error getting personalized recommendations:', error);
      throw error;
    }
  }

  // Mock functions
  private static getMockChurnPrediction(memberId: string): MemberChurnPrediction {
    return {
      memberId,
      churnRisk: 'Low',
      churnProbability: 25,
      riskFactors: [],
      daysSinceLastActivity: 7,
      recommendations: ['Member shows good engagement'],
      interventionPriority: 'Low',
    };
  }

  private static getMockRecommendations(memberId: string, limit: number): PersonalizedRecommendation[] {
    return [
      {
        type: 'project' as const,
        itemId: 'p1',
        itemName: 'Youth Mentorship 2024',
        matchScore: 95,
        reasons: ['Your leadership skills are a perfect match', 'Project aligns with your career goals'],
        priority: 'High' as const,
      },
      {
        type: 'event' as const,
        itemId: 'e1',
        itemName: 'Leadership Workshop',
        matchScore: 85,
        reasons: ['Event type matches your interests', 'Happening soon'],
        priority: 'High' as const,
      },
      {
        type: 'training' as const,
        itemId: 't1',
        itemName: 'Advanced Project Management',
        matchScore: 75,
        reasons: ['Builds on your existing skills'],
        priority: 'Medium' as const,
      },
    ].slice(0, limit);
  }
}

