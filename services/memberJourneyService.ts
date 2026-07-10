// Leadership Journey + Trainer Pathway derivation (dashboard journey card for pre-2025 members)
import { Member } from '../types';
import { BoardManagementService } from './boardManagementService';
import { ProjectsService } from './projectsService';
import { isDevMode } from '../utils/devMode';

export interface JourneyStep {
  title: string;
  achieved: boolean;
  detail?: string;
  /** All entries when there are multiple (Commission Director, Board of Director, etc.) */
  details?: string[];
}

export interface MemberJourney {
  leadership: { steps: JourneyStep[]; currentIndex: number };
  trainer: { steps: JourneyStep[]; currentIndex: number };
}

/** 会籍领导力阶梯（低 → 高） */
export const LEADERSHIP_LADDER = [
  'Member',
  'Project Committee',
  'Project OC',
  'Commission Director',
  'Board of Director',
  'President',
  'Area Officer',
  'National Officer',
  'JCI Officer',
] as const;

/** 讲师成长路径（低 → 高） */
export const TRAINER_LADDER = [
  'JCI Trainer',
  'JCIM Intermediate Trainer',
  'JCIM Certified Trainer',
  'JCIM Principal Trainer',
  'JCIM Master Trainer',
] as const;

const NATIONAL_LEVEL_POSITIONS = ['Area Officer', 'National Officer', 'JCI Officer'];

export class MemberJourneyService {
  /** Leadership Journey — derived from project committee assignments + Board of Directors records */
  static async getLeadershipJourney(member: Member): Promise<{ steps: JourneyStep[]; currentIndex: number }> {
    let hasCommittee = false;
    let hasOC = false;
    let hasCommissionDirector = false;
    let hasBoard = false;
    let hasPresident = false;
    let hasAreaOfficer = false;
    let hasNationalOfficer = false;
    let hasJciOfficer = false;
    const details: Record<string, string> = {};
    const multiDetails: Record<string, string[]> = {};

    if (!isDevMode()) {
      const [boardPositions, commissionPositions, projects] = await Promise.all([
        BoardManagementService.getMemberBoardPositions(member.id).catch(() => []),
        BoardManagementService.getMemberCommissionDirectorPositions(member.id).catch(() => []),
        ProjectsService.getAllProjects().catch(() => []),
      ]);

      // Project committee / OC (from project committee assignments)
      for (const proj of projects as any[]) {
        if (!Array.isArray(proj.committee)) continue;
        for (const c of proj.committee) {
          if (c.memberId !== member.id) continue;
          const role = (c.role || '').toLowerCase();
          if (role.includes('organising chairman') || role.includes('organizing chairman') || role === 'oc') {
            hasOC = true;
            details['Project OC'] = proj.name || proj.title || '';
          } else {
            hasCommittee = true;
            if (!details['Project Committee']) details['Project Committee'] = proj.name || proj.title || '';
          }
        }
      }

      // Board of Directors records
      hasCommissionDirector = commissionPositions.length > 0;
      if (hasCommissionDirector) {
        const cdEntries = commissionPositions.map(cp => cp.position ? `${cp.position} · ${cp.term}` : cp.term);
        details['Commission Director'] = cdEntries[0];
        if (cdEntries.length > 1) multiDetails['Commission Director'] = cdEntries;
      }
      const boardEntries: string[] = [];
      for (const bp of boardPositions) {
        if (bp.position === 'President') { hasPresident = true; details['President'] = bp.term; }
        else if (bp.position === 'Area Officer') { hasAreaOfficer = true; details['Area Officer'] = bp.term; }
        else if (bp.position === 'National Officer') { hasNationalOfficer = true; details['National Officer'] = bp.term; }
        else if (bp.position === 'JCI Officer') { hasJciOfficer = true; details['JCI Officer'] = bp.term; }
        if (!NATIONAL_LEVEL_POSITIONS.includes(bp.position)) {
          hasBoard = true;
          boardEntries.push(`${bp.position} · ${bp.term}`);
        }
      }
      if (boardEntries.length > 0) {
        details['Board of Director'] = boardEntries[0];
        if (boardEntries.length > 1) multiDetails['Board of Director'] = boardEntries;
      }
    }

    const achievedMap: Record<(typeof LEADERSHIP_LADDER)[number], boolean> = {
      'Member': true,
      'Project Committee': hasCommittee || hasOC,
      'Project OC': hasOC,
      'Commission Director': hasCommissionDirector,
      'Board of Director': hasBoard,
      'President': hasPresident,
      'Area Officer': hasAreaOfficer,
      'National Officer': hasNationalOfficer,
      'JCI Officer': hasJciOfficer,
    };

    const steps: JourneyStep[] = LEADERSHIP_LADDER.map(title => ({
      title,
      achieved: achievedMap[title],
      detail: details[title],
      details: multiDetails[title],
    }));
    const currentIndex = steps.reduce((acc, s, i) => (s.achieved ? i : acc), 0);
    return { steps, currentIndex };
  }

  /** Trainer Pathway — derived from member skills + points (same criteria as the profile card) */
  static getTrainerJourney(member: Member): { steps: JourneyStep[]; currentIndex: number } {
    const skills = member.skills || [];
    const points = member.points || 0;
    const achieved = [
      skills.includes('JCI Discover') || points >= 150,
      skills.includes('JCI Presenter') || skills.includes('JCI Facilitator') || points >= 400,
      skills.includes('JCIM TTT 1') || points >= 800,
      skills.includes('JCIM TTT 2') || points >= 1500,
      skills.includes('JCIM Master Trainer') || points >= 2500,
    ];
    const steps: JourneyStep[] = TRAINER_LADDER.map((title, i) => ({ title, achieved: achieved[i] }));
    const currentIndex = steps.reduce((acc, s, i) => (s.achieved ? i : acc), -1);
    return { steps, currentIndex };
  }

  static async getJourney(member: Member): Promise<MemberJourney> {
    const leadership = await this.getLeadershipJourney(member);
    const trainer = this.getTrainerJourney(member);
    return { leadership, trainer };
  }
}
