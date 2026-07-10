import { collection, getDocs, query, where, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { ProjectsService } from './projectsService';
import { PromotionService } from './promotionService';
import { MembersService } from './membersService';
import type { EngagementYear } from './promotionService';
import type { MemberEngagementRequirementProgress } from '../types';

// Maps rawCategory values (stored in RadarContributions) to { requirement key, select option value }
// The selectValue must exactly match one of the options[] in ENGAGEMENT_REQUIREMENTS
const RADAR_CATEGORY_MAP: Array<{
  key: string;
  categories: string[];
  selectValue: string;        // the exact option string to save as `detail`
  year: 'firstYear' | 'secondYear' | 'both';
}> = [
  // 1st Year – Skills
  { key: 'skills_jci_malaysia_inspire',          categories: ['JCIM Inspire', 'JCI Malaysia Inspire'],      selectValue: 'JCI Malaysia Inspire',        year: 'firstYear' },
  { key: 'skills_jci_discover',                  categories: ['JCI Discover'],                              selectValue: 'JCI Discover',                year: 'firstYear' },
  { key: 'skills_jci_explore',                   categories: ['JCI Explore', 'JCI Foundational Courses'],   selectValue: 'JCI Explore',                 year: 'firstYear' },
  // 1st Year – Experience
  { key: 'experience_area_or_national_convention', categories: ['Area Convention'],                          selectValue: 'Area Convention',             year: 'firstYear' },
  { key: 'experience_area_or_national_convention', categories: ['National Convention'],                      selectValue: 'National Convention',         year: 'firstYear' },
  // 2nd Year – Skills
  { key: 'skills_effective_meeting',             categories: ['Effective Meetings', 'Effective Meeting', 'JCI Effective Meeting'], selectValue: 'JCI Effective Meeting', year: 'secondYear' },
  { key: 'skills_malaysia_empower',              categories: ['JCIM Empower', 'JCI Malaysia Empower'],      selectValue: 'JCI Malaysia Empower',        year: 'secondYear' },
  { key: 'skills_parliamentary_procedure',       categories: ['Parliamentary Procedure'],                   selectValue: 'Parliamentary Procedure Course', year: 'secondYear' },
  // 2nd Year – Experience
  { key: 'experience_local_academy_or_area_summit', categories: ['Local Academy', 'Area Academy'],          selectValue: 'Local Academy',               year: 'secondYear' },
  { key: 'experience_local_academy_or_area_summit', categories: ['Area Summit'],                            selectValue: 'Area Summit',                 year: 'secondYear' },
  { key: 'experience_area_convention',           categories: ['Area Convention'],                           selectValue: 'Area Convention',             year: 'secondYear' },
  { key: 'experience_national_convention',       categories: ['National Convention'],                       selectValue: 'National Convention',         year: 'secondYear' },
  { key: 'experience_national_events',           categories: ['National AGM', 'National BOD', 'National Board', 'National Conference', 'National Business Meeting', 'National Training', 'National Events', 'National Event'], selectValue: '', year: 'secondYear' },
];

// Maps a committee role string to the closest select option value
function mapRoleToOption(role: string, year: EngagementYear): string {
  const r = role.toLowerCase();
  if (year === 'secondYear') {
    if (/commission.*director|director.*commission/i.test(r)) return 'Commission Director';
    if (/chair/i.test(r)) return 'Local Project Organizing Chairperson';
    return 'Local Project Organizing Chairperson';
  }
  // firstYear
  if (/chair/i.test(r)) return 'Local Project Organizing Chairperson';
  return 'Organizing Committee';
}

// Leadership requirement keys mapped by year; matched against Project.committee roles
const LEADERSHIP_REQUIREMENTS: Record<EngagementYear, { key: string; roleFilter?: RegExp }> = {
  firstYear: { key: 'leadership_local_project_committee' },
  secondYear: {
    key: 'leadership_project_chair_or_commission_director',
    roleFilter: /chair|director|commissioner|commission/i,
  },
};

interface RadarContributionDoc {
  id: string;
  memberId: string;
  rawCategory: string;
  eventTitle: string;
  eventDate: string;
  year: string;
}

/**
 * Extract just the start-date portion from an eventDate string.
 * Handles formats like:
 *   "24 Apr 2026 08:00 am - 26 Apr 2026 23:00 pm"  → "24 Apr 2026"
 *   "01 Jan 2025"                                    → "01 Jan 2025"
 *   ISO strings like "2025-01-01T..."               → kept as-is
 */
function extractStartDate(raw: string): string {
  if (!raw?.trim()) return '';
  // If it contains a range separator, take only the part before " - "
  const beforeDash = raw.split(' - ')[0].trim();
  // Extract "dd MMM yyyy" pattern from the beginning
  const match = beforeDash.match(/^(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/);
  if (match) return match[1]; // e.g. "24 Apr 2026"
  return beforeDash;
}

/** Parse a date string (possibly range format) into a Date for comparison */
function parseDate(raw: string): Date | null {
  if (!raw?.trim()) return null;
  const clean = extractStartDate(raw);
  const d = new Date(clean);
  if (!isNaN(d.getTime())) return d;
  // Try "dd MMM yyyy" → "MMM dd, yyyy"
  const parts = clean.trim().split(/\s+/);
  if (parts.length === 3) {
    const attempt = new Date(`${parts[1]} ${parts[0]}, ${parts[2]}`);
    if (!isNaN(attempt.getTime())) return attempt;
  }
  return null;
}

function toISODateStr(raw: string): string {
  const d = parseDate(raw);
  if (!d) return '';
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

export interface AutoSuggestResult {
  key: string;
  detail: string;
  date: string;
  source: 'radar' | 'committee';
  /** true when an existing verified/manual entry already exists (won't overwrite) */
  skipped: boolean;
  skipReason?: string;
}

/**
 * Queries RadarContributions and Projects to find the earliest matching record for
 * each engagement requirement in the given year, then writes pending suggestions
 * to Firestore. Skips any key that already has a completed or pending entry.
 */
export const EngagementAutoSuggestService = {
  async runAutoSuggest(
    memberId: string,
    year: EngagementYear,
    suggestedByUid: string
  ): Promise<AutoSuggestResult[]> {
    const [allRadar, allProjects, member] = await Promise.all([
      EngagementAutoSuggestService._fetchRadarForMember(memberId),
      ProjectsService.getAllProjects(),
      MembersService.getMemberById(memberId),
    ]);

    if (!member) throw new Error('Member not found');

    const existingProgress = (member.jciCareer?.engagementProgress ?? member.engagementProgress)?.[year] ?? {};
    const results: AutoSuggestResult[] = [];

    // Track which requirement keys have already been handled (first match wins)
    const handled = new Set<string>();

    // --- Radar-based suggestions ---
    for (const mapping of RADAR_CATEGORY_MAP) {
      if (mapping.year !== 'both' && mapping.year !== year) continue;
      if (handled.has(mapping.key)) continue;

      const existing = existingProgress[mapping.key];
      if (existing?.completed && !existing?.pendingVerification) {
        if (!handled.has(mapping.key)) {
          results.push({ key: mapping.key, detail: existing.detail || '', date: existing.date || '', source: 'radar', skipped: true, skipReason: 'Already completed' });
          handled.add(mapping.key);
        }
        continue;
      }
      if (existing?.pendingVerification) {
        if (!handled.has(mapping.key)) {
          results.push({ key: mapping.key, detail: existing.detail || '', date: existing.date || '', source: existing.autoSuggestedFrom || 'radar', skipped: true, skipReason: 'Already pending' });
          handled.add(mapping.key);
        }
        continue;
      }

      // Find matching radar records (by rawCategory containing any of the mapping categories)
      const matches = allRadar.filter(r =>
        mapping.categories.some(cat => r.rawCategory.toLowerCase().includes(cat.toLowerCase()))
      );
      if (matches.length === 0) continue; // try next mapping entry for same key

      // Sort ascending by date and pick earliest
      const sorted = matches
        .map(r => ({ r, d: parseDate(r.eventDate) }))
        .filter(x => x.d !== null)
        .sort((a, b) => a.d!.getTime() - b.d!.getTime());

      const earliest = sorted[0]?.r ?? matches[0];
      // Use eventTitle as the detail value (most descriptive); fall back to rawCategory
      const detailValue = earliest.eventTitle || earliest.rawCategory;

      const suggestion: MemberEngagementRequirementProgress = {
        detail: detailValue,
        date: toISODateStr(earliest.eventDate) || earliest.eventDate,
        completed: false,
        pendingVerification: true,
        autoSuggestedFrom: 'radar',
      };

      await PromotionService.saveEngagementRequirement(memberId, year, mapping.key, suggestion);
      results.push({ key: mapping.key, detail: suggestion.detail!, date: suggestion.date!, source: 'radar', skipped: false });
      handled.add(mapping.key);
    }

    // Report any radar keys that found no data
    for (const mapping of RADAR_CATEGORY_MAP) {
      if (mapping.year !== 'both' && mapping.year !== year) continue;
      if (!handled.has(mapping.key)) {
        results.push({ key: mapping.key, detail: '', date: '', source: 'radar', skipped: true, skipReason: 'No matching record found' });
        handled.add(mapping.key);
      }
    }

    // --- Committee-based suggestion (Leadership) ---
    const leadershipCfg = LEADERSHIP_REQUIREMENTS[year];
    const existing = existingProgress[leadershipCfg.key];

    if (existing?.completed && !existing?.pendingVerification) {
      results.push({ key: leadershipCfg.key, detail: existing.detail || '', date: existing.date || '', source: 'committee', skipped: true, skipReason: 'Already completed' });
    } else if (existing?.pendingVerification) {
      results.push({ key: leadershipCfg.key, detail: existing.detail || '', date: existing.date || '', source: 'committee', skipped: true, skipReason: 'Already pending' });
    } else {
      // Filter projects where this member is in committee (with optional role filter)
      const committeeProjects = allProjects.filter(p =>
        (p.committee ?? []).some(cm => {
          if (cm.memberId !== memberId) return false;
          if (leadershipCfg.roleFilter) return leadershipCfg.roleFilter.test(cm.role);
          return true;
        })
      );

      if (committeeProjects.length === 0) {
        results.push({ key: leadershipCfg.key, detail: '', date: '', source: 'committee', skipped: true, skipReason: 'No matching committee role found' });
      } else {
        // Pick earliest project by date
        const projectsWithDate = committeeProjects
          .map(p => {
            const rawDate = p.eventStartDate || p.startDate || p.date || '';
            return { p, d: parseDate(rawDate), rawDate };
          })
          .filter(x => x.d !== null)
          .sort((a, b) => a.d!.getTime() - b.d!.getTime());

        const earliest = projectsWithDate[0]?.p ?? committeeProjects[0];
        const rawDate = earliest.eventStartDate || earliest.startDate || earliest.date || '';
        const role = (earliest.committee ?? []).find(cm => cm.memberId === memberId)?.role ?? 'Committee Member';
        const optionValue = mapRoleToOption(role, year);

        const suggestion: MemberEngagementRequirementProgress = {
          detail: optionValue,
          date: toISODateStr(rawDate) || rawDate,
          completed: false,
          pendingVerification: true,
          autoSuggestedFrom: 'committee',
        };

        await PromotionService.saveEngagementRequirement(memberId, year, leadershipCfg.key, suggestion);
        results.push({ key: leadershipCfg.key, detail: suggestion.detail!, date: suggestion.date!, source: 'committee', skipped: false });
      }
    }

    return results;
  },

  async approveSuggestion(
    memberId: string,
    year: EngagementYear,
    requirementKey: string,
    verifiedByUid: string
  ): Promise<void> {
    const memberDoc = await MembersService.getMemberById(memberId);
    if (!memberDoc) throw new Error('Member not found');
    const existing = (memberDoc.jciCareer?.engagementProgress ?? memberDoc.engagementProgress)?.[year]?.[requirementKey];
    if (!existing) throw new Error('Requirement not found');

    await PromotionService.saveEngagementRequirement(memberId, year, requirementKey, {
      ...existing,
      completed: true,
      pendingVerification: false,
      verifiedBy: verifiedByUid,
      verifiedAt: new Date().toISOString(),
    });
  },

  async rejectSuggestion(
    memberId: string,
    year: EngagementYear,
    requirementKey: string,
    rejectedByUid: string
  ): Promise<void> {
    // Clear the auto-suggested entry back to empty
    await PromotionService.saveEngagementRequirement(memberId, year, requirementKey, {
      detail: '',
      date: '',
      completed: false,
      pendingVerification: false,
      rejectedBy: rejectedByUid,
      rejectedAt: new Date().toISOString(),
    });
  },

  /**
   * For Probation members — returns pre-fill values for the promotion progress form.
   * Does NOT write to Firestore; caller must display values and let BOD click Save.
   */
  async runProbationAutoSuggest(memberId: string): Promise<{
    event_organizing_committee?: { detail: string; date: string };
    event_participation_1?: { detail: string; date: string };
    event_participation_2?: { detail: string; date: string };
    jci_inspire_completion?: { course: string; date: string };
  }> {
    const [allRadar, allProjects] = await Promise.all([
      EngagementAutoSuggestService._fetchRadarForMember(memberId),
      ProjectsService.getAllProjects(),
    ]);

    const result: Record<string, any> = {};

    // --- Event Organizing Committee ← earliest project where member is in committee ---
    const committeeProjects = allProjects.filter(p =>
      (p.committee ?? []).some(cm => cm.memberId === memberId)
    );
    if (committeeProjects.length > 0) {
      const sorted = committeeProjects
        .map(p => ({ p, d: parseDate(p.eventStartDate || p.startDate || p.date || '') }))
        .filter(x => x.d !== null)
        .sort((a, b) => a.d!.getTime() - b.d!.getTime());
      const earliest = sorted[0]?.p ?? committeeProjects[0];
      const rawDate = earliest.eventStartDate || earliest.startDate || earliest.date || '';
      const role = (earliest.committee ?? []).find(cm => cm.memberId === memberId)?.role ?? 'Committee Member';
      result.event_organizing_committee = {
        detail: `${role} – ${earliest.name || earliest.title || 'Project'}`,
        date: toISODateStr(rawDate) || rawDate,
      };
    }

    // --- JCI Inspire Completion ← earliest matching radar record ---
    const INSPIRE_CATS = ['JCIM Inspire', 'JCI Malaysia Inspire'];
    const inspireRecords = allRadar.filter(r =>
      INSPIRE_CATS.some(cat => r.rawCategory.toLowerCase().includes(cat.toLowerCase()))
    );
    if (inspireRecords.length > 0) {
      const sorted = inspireRecords
        .map(r => ({ r, d: parseDate(r.eventDate) }))
        .filter(x => x.d !== null)
        .sort((a, b) => a.d!.getTime() - b.d!.getTime());
      const earliest = sorted[0]?.r ?? inspireRecords[0];
      result.jci_inspire_completion = {
        course: 'JCIM Inspire',
        date: toISODateStr(earliest.eventDate) || earliest.eventDate,
      };
    }

    // --- Event Participation ← earliest 2 general event records (exclude skills courses) ---
    const SKILL_CATS = ['JCIM Inspire', 'JCI Malaysia Inspire', 'JCI Discover', 'JCI Explore',
      'Effective Meetings', 'JCIM Empower', 'Parliamentary Procedure'];
    const eventRecords = allRadar
      .filter(r => !SKILL_CATS.some(cat => r.rawCategory.toLowerCase().includes(cat.toLowerCase())))
      .map(r => ({ r, d: parseDate(r.eventDate) }))
      .filter(x => x.d !== null)
      .sort((a, b) => a.d!.getTime() - b.d!.getTime());
    if (eventRecords[0]) {
      const e = eventRecords[0].r;
      result.event_participation_1 = {
        detail: e.eventTitle || e.rawCategory,
        date: toISODateStr(e.eventDate) || e.eventDate,
      };
    }
    if (eventRecords[1]) {
      const e = eventRecords[1].r;
      result.event_participation_2 = {
        detail: e.eventTitle || e.rawCategory,
        date: toISODateStr(e.eventDate) || e.eventDate,
      };
    }

    return result;
  },

  async _fetchRadarForMember(memberId: string): Promise<RadarContributionDoc[]> {
    const snap = await getDocs(
      query(collection(db, 'RadarContributions'), where('memberId', '==', memberId))
    );
    return snap.docs.map(d => ({
      id: d.id,
      memberId: d.data().memberId,
      rawCategory: d.data().rawCategory || '',
      eventTitle: d.data().eventTitle || '',
      eventDate: d.data().eventDate || '',
      year: d.data().year || '',
    }));
  },
};
