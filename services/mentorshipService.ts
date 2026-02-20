// Mentorship Matching Service
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { MembersService } from './membersService';
import { CommunicationService } from './communicationService';
import { Member, MentorMatch, UserRole } from '../types';
import { isDevMode } from '../utils/devMode';

export interface MentorMatchSuggestion {
  mentor: Member;
  mentee: Member;
  matchScore: number;
  reasons: string[];
}

export interface MentorshipCriteria {
  skills?: string[];
  experience?: 'Junior' | 'Mid' | 'Senior';
  industry?: string;
  interests?: string[];
  goals?: string[];
  availability?: 'High' | 'Medium' | 'Low';
}

export interface MentorshipStats {
  totalMentorships: number;
  activeMentors: number;
  unassignedMentees: number;
  averageMenteesPerMentor: number;
  completedMentorships: number;
  successRate: number;
}

export class MentorshipService {
  // Enhanced mentor matching with sophisticated algorithm
  static async findPotentialMentors(
    menteeId: string,
    criteria?: MentorshipCriteria
  ): Promise<MentorMatchSuggestion[]> {
    try {
      const mentee = await MembersService.getMemberById(menteeId);
      if (!mentee) {
        throw new Error('Mentee not found');
      }

      const allMembers = await MembersService.getAllMembers();
      
      // Filter potential mentors with enhanced criteria
      const potentialMentors = allMembers.filter(m => {
        if (m.id === menteeId) return false;
        if (m.menteeIds && m.menteeIds.length >= 5) return false; // Max 5 mentees per mentor
        if (m.points < 500) return false; // Minimum experience threshold
        if (m.role === UserRole.GUEST || m.role === UserRole.PROBATION_MEMBER) return false;
        return true;
      });

      // Calculate sophisticated match scores
      const matches: MentorMatchSuggestion[] = potentialMentors.map(mentor => {
        const { score, factors } = this.calculateCompatibilityScore(mentor, mentee, criteria);
        
        return {
          mentor,
          mentee,
          matchScore: score,
          reasons: factors,
        };
      });

      // Sort by match score and return top matches
      return matches
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 10); // Return top 10 matches
    } catch (error) {
      console.error('Error finding potential mentors:', error);
      throw error;
    }
  }

  // Calculate compatibility score based on multiple factors
  private static calculateCompatibilityScore(
    mentor: Member,
    mentee: Member,
    criteria?: MentorshipCriteria
  ): { score: number; factors: string[] } {
    let score = 0;
    const factors: string[] = [];
    const maxScore = 100;

    // Experience gap scoring (mentors should have more experience)
    const mentorPoints = mentor.points || 0;
    const menteePoints = mentee.points || 0;
    const experienceGap = mentorPoints - menteePoints;
    
    if (experienceGap >= 500) {
      score += 25;
      factors.push('Significant experience advantage');
    } else if (experienceGap >= 200) {
      score += 15;
      factors.push('Good experience gap');
    } else if (experienceGap >= 0) {
      score += 5;
      factors.push('Some experience advantage');
    }

    // Skills alignment
    if (mentor.skills && mentee.skills) {
      const commonSkills = mentor.skills.filter(skill => 
        mentee.skills!.some(ms => ms.toLowerCase().includes(skill.toLowerCase()))
      );
      if (commonSkills.length > 0) {
        const skillScore = Math.min(20, commonSkills.length * 5);
        score += skillScore;
        factors.push(`Shared skills: ${commonSkills.slice(0, 3).join(', ')}`);
      }
    }

    // Professional background alignment
    if (mentor.profession && mentee.profession) {
      if (mentor.profession.toLowerCase().includes(mentee.profession.toLowerCase()) ||
          mentee.profession.toLowerCase().includes(mentor.profession.toLowerCase())) {
        score += 15;
        factors.push('Similar professional background');
      }
    }

    // Industry alignment
    if (mentor.industry && mentee.interestedIndustries) {
      const industryMatch = mentee.interestedIndustries.some(industry =>
        industry.toLowerCase().includes(mentor.industry!.toLowerCase())
      );
      if (industryMatch) {
        score += 15;
        factors.push('Industry alignment');
      }
    }

    // Role and tier scoring
    if (mentor.role === UserRole.BOARD || mentor.role === UserRole.ADMIN) {
      score += 20;
      factors.push('Leadership experience');
    }

    if (mentor.tier === 'Platinum' || mentor.tier === 'Gold') {
      score += 15;
      factors.push(`High achievement level (${mentor.tier})`);
    }

    // Availability and capacity
    const currentMenteeCount = mentor.menteeIds?.length || 0;
    if (currentMenteeCount === 0) {
      score += 10;
      factors.push('Available for new mentees');
    } else if (currentMenteeCount < 3) {
      score += 5;
      factors.push('Has capacity for more mentees');
    }

    // Activity level
    if (mentor.attendanceRate >= 80) {
      score += 10;
      factors.push('High engagement level');
    } else if (mentor.attendanceRate >= 60) {
      score += 5;
      factors.push('Good engagement level');
    }

    // Board history (experienced leaders)
    if (mentor.boardHistory && mentor.boardHistory.length > 0) {
      score += 10;
      factors.push('Previous board experience');
    }

    // Ensure score doesn't exceed maximum
    score = Math.min(score, maxScore);

    return { score, factors };
  }

  // Create a formal mentor match record
  static async createMentorMatch(
    mentorId: string,
    menteeId: string,
    compatibilityScore: number,
    matchingFactors: string[],
    createdBy: string
  ): Promise<MentorMatch> {
    if (isDevMode()) {
      console.log(`[Dev Mode] Would create mentor match: ${mentorId} -> ${menteeId}`);
      return {
        id: 'match1',
        mentorId,
        menteeId,
        compatibilityScore,
        matchingFactors,
        status: 'suggested',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    try {
      const matchData: Omit<MentorMatch, 'id'> = {
        mentorId,
        menteeId,
        compatibilityScore,
        matchingFactors,
        status: 'suggested',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mentorMatchesRef = collection(db, 'mentorMatches');
      const docRef = await addDoc(mentorMatchesRef, matchData);
      
      return {
        id: docRef.id,
        ...matchData,
      };
    } catch (error) {
      console.error('Error creating mentor match:', error);
      throw error;
    }
  }

  // Approve a mentor match and make it active
  static async approveMentorMatch(matchId: string, approvedBy: string): Promise<void> {
    if (isDevMode()) {
      console.log(`[Dev Mode] Would approve mentor match: ${matchId}`);
      return;
    }

    try {
      const matchRef = doc(db, 'mentorMatches', matchId);
      const matchDoc = await getDoc(matchRef);
      
      if (!matchDoc.exists()) {
        throw new Error('Mentor match not found');
      }

      const match = { id: matchDoc.id, ...matchDoc.data() } as MentorMatch;

      // Update match status
      await updateDoc(matchRef, {
        status: 'active',
        startDate: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Update member records
      await MembersService.assignMentor(match.menteeId, match.mentorId);

      // Send notifications
      await this.sendMatchNotifications(match, approvedBy);

    } catch (error) {
      console.error('Error approving mentor match:', error);
      throw error;
    }
  }

  // Send notifications for mentor match
  private static async sendMatchNotifications(match: MentorMatch, approvedBy: string): Promise<void> {
    try {
      // Notify mentor
      await CommunicationService.createNotification({
        memberId: match.mentorId,
        title: 'New Mentee Assigned',
        message: `You have been matched with a new mentee. Your mentoring relationship is now active.`,
        type: 'success',
      });

      // Notify mentee
      await CommunicationService.createNotification({
        memberId: match.menteeId,
        title: 'Mentor Assigned',
        message: `You have been matched with a mentor. Your mentoring relationship is now active.`,
        type: 'success',
      });
    } catch (error) {
      console.error('Error sending match notifications:', error);
    }
  }

  // Auto-match mentees with mentors based on criteria
  static async autoMatchMentors(menteeId: string, criteria?: MentorshipCriteria): Promise<string | null> {
    try {
      const matches = await this.findPotentialMentors(menteeId, criteria);
      if (matches.length === 0) {
        return null;
      }

      // Select the best match (highest score)
      const bestMatch = matches[0];
      
      // Create formal match record
      const mentorMatch = await this.createMentorMatch(
        bestMatch.mentor.id,
        menteeId,
        bestMatch.matchScore,
        bestMatch.reasons,
        'system'
      );

      // Auto-approve if score is high enough
      if (bestMatch.matchScore >= 70) {
        await this.approveMentorMatch(mentorMatch.id, 'system');
      }
      
      return bestMatch.mentor.id;
    } catch (error) {
      console.error('Error auto-matching mentor:', error);
      throw error;
    }
  }

  // Get mentor matches for a member
  static async getMentorMatches(memberId: string): Promise<MentorMatch[]> {
    if (isDevMode()) {
      return [];
    }

    try {
      const mentorMatchesRef = collection(db, 'mentorMatches');
      const q = query(
        mentorMatchesRef,
        where('mentorId', '==', memberId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as MentorMatch[];
    } catch (error) {
      console.error('Error getting mentor matches:', error);
      throw error;
    }
  }

  // Get mentee matches for a member
  static async getMenteeMatches(memberId: string): Promise<MentorMatch[]> {
    if (isDevMode()) {
      return [];
    }

    try {
      const mentorMatchesRef = collection(db, 'mentorMatches');
      const q = query(
        mentorMatchesRef,
        where('menteeId', '==', memberId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as MentorMatch[];
    } catch (error) {
      console.error('Error getting mentee matches:', error);
      throw error;
    }
  }

  // Complete a mentorship relationship
  static async completeMentorship(matchId: string, completedBy: string): Promise<void> {
    if (isDevMode()) {
      console.log(`[Dev Mode] Would complete mentorship: ${matchId}`);
      return;
    }

    try {
      const matchRef = doc(db, 'mentorMatches', matchId);
      await updateDoc(matchRef, {
        status: 'completed',
        endDate: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error completing mentorship:', error);
      throw error;
    }
  }

  // Get enhanced mentorship statistics
  static async getMentorshipStats(): Promise<MentorshipStats> {
    try {
      const members = await MembersService.getAllMembers();
      
      const activeMentors = members.filter(m => m.menteeIds && m.menteeIds.length > 0);
      const totalMentorships = members.reduce((sum, m) => sum + (m.menteeIds?.length || 0), 0);
      const unassignedMentees = members.filter(m => !m.mentorId && m.role === UserRole.MEMBER).length;
      const averageMenteesPerMentor = activeMentors.length > 0 
        ? totalMentorships / activeMentors.length 
        : 0;

      // Get completed mentorships from matches
      let completedMentorships = 0;
      let successRate = 0;

      if (!isDevMode()) {
        try {
          const mentorMatchesRef = collection(db, 'mentorMatches');
          const completedQuery = query(mentorMatchesRef, where('status', '==', 'completed'));
          const completedSnapshot = await getDocs(completedQuery);
          completedMentorships = completedSnapshot.size;

          const totalMatchesQuery = query(mentorMatchesRef);
          const totalSnapshot = await getDocs(totalMatchesQuery);
          const totalMatches = totalSnapshot.size;

          successRate = totalMatches > 0 ? (completedMentorships / totalMatches) * 100 : 0;
        } catch (error) {
          console.error('Error getting mentorship match stats:', error);
        }
      }

      return {
        totalMentorships,
        activeMentors: activeMentors.length,
        unassignedMentees,
        averageMenteesPerMentor: Math.round(averageMenteesPerMentor * 10) / 10,
        completedMentorships,
        successRate: Math.round(successRate * 10) / 10,
      };
    } catch (error) {
      console.error('Error getting mentorship stats:', error);
      throw error;
    }
  }

  // Collect feedback on mentorship relationship
  static async collectFeedback(
    matchId: string,
    fromMemberId: string,
    rating: number,
    feedback: string
  ): Promise<void> {
    if (isDevMode()) {
      console.log(`[Dev Mode] Would collect feedback for match: ${matchId}`);
      return;
    }

    try {
      const feedbackData = {
        matchId,
        fromMemberId,
        rating,
        feedback,
        createdAt: new Date().toISOString(),
      };

      const feedbackRef = collection(db, 'mentorshipFeedback');
      await addDoc(feedbackRef, feedbackData);
    } catch (error) {
      console.error('Error collecting mentorship feedback:', error);
      throw error;
    }
  }
}

