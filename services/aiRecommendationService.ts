// AI Recommendation Service - Personalized recommendations for members
import { Member, Event, Project, TrainingModule, HobbyClub, UserRole } from '../types';
import { MembersService } from './membersService';
import { EventsService } from './eventsService';
import { ProjectsService } from './projectsService';
import { KnowledgeService } from './knowledgeService';
import { HobbyClubsService } from './hobbyClubsService';
import { isDevMode } from '../utils/devMode';

export interface Recommendation {
  type: 'project' | 'event' | 'training' | 'mentor' | 'club' | 'role';
  id: string;
  title: string;
  description: string;
  reason: string;
  score: number; // 0-100 confidence score
  metadata?: Record<string, any>;
}

export class AIRecommendationService {
  // Get personalized recommendations for a member
  static async getRecommendations(memberId: string): Promise<Recommendation[]> {
    if (isDevMode()) {
      return this.getMockRecommendations(memberId);
    }

    try {
      const member = await MembersService.getMemberById(memberId);
      if (!member) return [];

      const recommendations: Recommendation[] = [];

      // Get recommendations from different categories
      const projectRecs = await this.recommendProjects(member);
      const eventRecs = await this.recommendEvents(member);
      const trainingRecs = await this.recommendTraining(member);
      const mentorRecs = await this.recommendMentors(member);
      const clubRecs = await this.recommendClubs(member);
      const roleRecs = await this.recommendRoles(member);

      recommendations.push(...projectRecs);
      recommendations.push(...eventRecs);
      recommendations.push(...trainingRecs);
      recommendations.push(...mentorRecs);
      recommendations.push(...clubRecs);
      recommendations.push(...roleRecs);

      // Sort by score (highest first) and return top 10
      return recommendations
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    } catch (error) {
      console.error('Error getting recommendations:', error);
      return [];
    }
  }

  // Recommend projects based on skills, interests, and past participation
  private static async recommendProjects(member: Member): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    const allProjects = await ProjectsService.getAllProjects();
    const activeProjects = allProjects.filter(p => p.status === 'Active');

    for (const project of activeProjects) {
      let score = 0;
      const reasons: string[] = [];

      // Skill matching (using project description as skill indicator)
      if (member.skills && project.description) {
        const projectKeywords = project.description.toLowerCase().split(/\s+/);
        const matchingSkills = member.skills.filter(skill =>
          projectKeywords.some(keyword => 
            keyword.includes(skill.toLowerCase()) ||
            skill.toLowerCase().includes(keyword)
          )
        );
        if (matchingSkills.length > 0) {
          score += matchingSkills.length * 15;
          reasons.push(`Matches your skills: ${matchingSkills.join(', ')}`);
        }
      }

      // Points-based recommendation (members with lower points get higher scores)
      if (member.points < 500) {
        score += 10;
        reasons.push('Great opportunity to earn points');
      }

      // Engagement-based (members with low attendance get higher scores)
      if (member.attendanceRate < 70) {
        score += 10;
        reasons.push('Opportunity to increase engagement');
      }

      if (score > 20) {
        recommendations.push({
          type: 'project',
          id: project.id,
          title: project.name,
          description: project.description || '',
          reason: reasons.join('. ') || 'Based on your profile',
          score: Math.min(score, 100),
          metadata: { projectId: project.id, status: project.status },
        });
      }
    }

    return recommendations;
  }

  // Recommend events based on interests and past attendance
  private static async recommendEvents(member: Member): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    const allEvents = await EventsService.getAllEvents();
    const upcomingEvents = allEvents.filter(e => {
      const eventDate = new Date(e.date);
      return eventDate >= new Date() && e.status === 'Upcoming';
    });

    for (const event of upcomingEvents) {
      let score = 0;
      const reasons: string[] = [];

      // Event type preference (based on past attendance patterns)
      // Training events for members with low points
      if (event.type === 'Training' && member.points < 500) {
        score += 20;
        reasons.push('Training events help build skills and earn points');
      }

      // Social events for members with low attendance
      if (event.type === 'Social' && member.attendanceRate < 70) {
        score += 15;
        reasons.push('Social events are great for networking');
      }

      // High-value events (International, major trainings)
      if (event.type === 'International' || event.type === 'Training') {
        score += 10;
        reasons.push('High-value event for professional development');
      }

      if (score > 15) {
        recommendations.push({
          type: 'event',
          id: event.id,
          title: event.title,
          description: event.description || '',
          reason: reasons.join('. ') || 'Based on your interests',
          score: Math.min(score, 100),
          metadata: { eventId: event.id, date: event.date, type: event.type },
        });
      }
    }

    return recommendations;
  }

  // Recommend training modules
  private static async recommendTraining(member: Member): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    const allModules = await KnowledgeService.getAllTrainingModules();

    for (const module of allModules) {
      let score = 0;
      const reasons: string[] = [];

      // Training type matching (using module type as skill indicator)
      if (member.skills && module.type) {
        const moduleTypeKeywords = module.type.toLowerCase().split(/\s+/);
        const matchingSkills = member.skills.filter(skill =>
          moduleTypeKeywords.some(keyword => 
            keyword.includes(skill.toLowerCase()) ||
            skill.toLowerCase().includes(keyword)
          )
        );
        if (matchingSkills.length === 0) {
          score += 10;
          reasons.push(`Covers ${module.type} training you haven't explored`);
        }
      }

      // Low points members get training recommendations
      if (member.points < 500) {
        score += 15;
        reasons.push('Training helps you earn points and grow');
      }

      if (score > 15) {
        recommendations.push({
          type: 'training',
          id: module.id,
          title: module.title,
          description: module.title || '',
          reason: reasons.join('. ') || 'Based on your learning needs',
          score: Math.min(score, 100),
          metadata: { moduleId: module.id },
        });
      }
    }

    return recommendations;
  }

  // Recommend mentors based on skills and experience
  private static async recommendMentors(member: Member): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    
    // Only recommend if member doesn't have a mentor
    if (member.mentorId) return recommendations;

    const allMembers = await MembersService.getAllMembers();
    const potentialMentors = allMembers.filter(m =>
      m.id !== member.id &&
      m.role !== UserRole.GUEST &&
      (m.points > member.points || m.tier === 'Gold' || m.tier === 'Platinum') &&
      (!m.menteeIds || m.menteeIds.length < 3) // Not too many mentees
    );

    for (const mentor of potentialMentors) {
      let score = 0;
      const reasons: string[] = [];

      // Skill overlap
      if (member.skills && mentor.skills) {
        const commonSkills = member.skills.filter(skill =>
          mentor.skills.some(ms => 
            ms.toLowerCase().includes(skill.toLowerCase()) ||
            skill.toLowerCase().includes(ms.toLowerCase())
          )
        );
        if (commonSkills.length > 0) {
          score += commonSkills.length * 10;
          reasons.push(`Shares your skills: ${commonSkills.join(', ')}`);
        }
      }

      // Experience level
      if (mentor.points > member.points * 1.5) {
        score += 15;
        reasons.push('Experienced member who can guide your growth');
      }

      // Tier-based
      if (mentor.tier === 'Platinum' || mentor.tier === 'Gold') {
        score += 10;
        reasons.push('High-tier member with valuable experience');
      }

      if (score > 20) {
        recommendations.push({
          type: 'mentor',
          id: mentor.id,
          title: mentor.name,
          description: mentor.bio || `${mentor.tier} member with ${mentor.points} points`,
          reason: reasons.join('. ') || 'Potential mentor match',
          score: Math.min(score, 100),
          metadata: { mentorId: mentor.id, tier: mentor.tier, points: mentor.points },
        });
      }
    }

    return recommendations;
  }

  // Recommend hobby clubs
  private static async recommendClubs(member: Member): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    const allClubs = await HobbyClubsService.getAllClubs();

    for (const club of allClubs) {
      let score = 0;
      const reasons: string[] = [];

      // Interest matching (if club has interests defined)
      if (club.description) {
        const descriptionLower = club.description.toLowerCase();
        if (member.skills) {
          const matchingInterests = member.skills.filter(skill =>
            descriptionLower.includes(skill.toLowerCase())
          );
          if (matchingInterests.length > 0) {
            score += matchingInterests.length * 15;
            reasons.push(`Matches your interests`);
          }
        }
      }

      // Engagement boost
      if (member.attendanceRate < 70) {
        score += 10;
        reasons.push('Clubs are great for building connections');
      }

      if (score > 15) {
        recommendations.push({
          type: 'club',
          id: club.id,
          title: club.name,
          description: club.description || '',
          reason: reasons.join('. ') || 'Based on your interests',
          score: Math.min(score, 100),
          metadata: { clubId: club.id },
        });
      }
    }

    return recommendations;
  }

  // Recommend leadership roles
  private static async recommendRoles(member: Member): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    
    // Only recommend for active members with good engagement
    if (member.attendanceRate < 70 || member.points < 300) return recommendations;

    const reasons: string[] = [];
    let score = 0;

    // High engagement
    if (member.attendanceRate >= 85) {
      score += 20;
      reasons.push('High attendance rate shows commitment');
    }

    // Good point accumulation
    if (member.points >= 500) {
      score += 15;
      reasons.push('Active participation and contribution');
    }

    // Skills alignment
    if (member.skills && member.skills.length >= 3) {
      score += 10;
      reasons.push('Diverse skill set suitable for leadership');
    }

    // Not currently on board
    if (member.role !== UserRole.BOARD && member.role !== UserRole.ADMIN) {
      score += 10;
      reasons.push('Ready for leadership opportunities');
    }

    if (score > 30) {
      recommendations.push({
        type: 'role',
        id: 'leadership-opportunity',
        title: 'Leadership Role Opportunity',
        description: 'Consider applying for a committee chair or board position',
        reason: reasons.join('. ') || 'Based on your engagement and skills',
        score: Math.min(score, 100),
        metadata: { suggestedRoles: ['Committee Chair', 'Project Lead', 'Board Member'] },
      });
    }

    return recommendations;
  }

  // Mock recommendations for dev mode
  private static getMockRecommendations(memberId: string): Recommendation[] {
    return [
      {
        type: 'project',
        id: 'p1',
        title: 'Community Garden Initiative',
        description: 'A project to create community gardens',
        reason: 'Matches your skills: Leadership, Marketing',
        score: 85,
      },
      {
        type: 'event',
        id: 'e1',
        title: 'Leadership Training Workshop',
        description: 'Advanced leadership training',
        reason: 'Training events help build skills and earn points',
        score: 75,
      },
    ];
  }
}

