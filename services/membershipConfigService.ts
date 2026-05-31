import { collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { MembershipDues, MembershipRuleConfig, MembershipType, UserRole } from '../types';

export interface MembershipEligibilityInput {
  membershipType: MembershipType;
  nationality?: string;
  dateOfBirth?: string;
  senatorCertified?: boolean;
  senatorshipId?: string;
  role?: UserRole | string;
}

/** Age on reference date (full years, birthday-aware). */
export function getMemberAge(
  dateOfBirth: string | undefined,
  referenceDate: Date = new Date()
): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  let age = referenceDate.getFullYear() - dob.getFullYear();
  const monthDiff = referenceDate.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

export function isMalaysianNationality(nationality?: string): boolean {
  return !nationality || nationality === 'Malaysia';
}

/** Validate membershipType against Config nationality / age / senatorship rules. */
export function validateMembershipTypeEligibility(
  input: MembershipEligibilityInput,
  rules: Record<MembershipType, MembershipRuleConfig>,
  referenceDate: Date = new Date()
): { valid: boolean; errors: string[] } {
  const rule = rules[input.membershipType];
  if (!rule) return { valid: true, errors: [] };

  const errors: string[] = [];
  const type = input.membershipType;

  if (rule.nationalityLimit === 'Malaysian' && !isMalaysianNationality(input.nationality)) {
    errors.push(`${type} requires Malaysian nationality`);
  }
  if (rule.nationalityLimit === 'Non-Malaysian' && isMalaysianNationality(input.nationality)) {
    errors.push(`${type} requires non-Malaysian nationality`);
  }

  if (rule.requiresSenatorship && !input.senatorCertified && !input.senatorshipId?.trim()) {
    errors.push(`Senatorship ID is required for ${type}`);
  }

  const hasAgeRule = rule.ageLimit.min != null || rule.ageLimit.max != null;
  if (hasAgeRule) {
    const age = getMemberAge(input.dateOfBirth, referenceDate);
    if (age === null) {
      errors.push(`Date of birth is required to validate age for ${type}`);
    } else {
      if (rule.ageLimit.min != null && age < rule.ageLimit.min) {
        errors.push(`${type} requires minimum age ${rule.ageLimit.min} (current: ${age})`);
      }
      if (rule.ageLimit.max != null && age > rule.ageLimit.max) {
        errors.push(`${type} requires maximum age ${rule.ageLimit.max} (current: ${age})`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Best-fit membershipType from profile (nationality, age, senatorship).
 * Used when proposed type fails Config rules.
 */
export function suggestMembershipTypeForMember(
  member: Pick<
    MembershipEligibilityInput,
    'nationality' | 'dateOfBirth' | 'senatorCertified' | 'senatorshipId' | 'role'
  > & { senatorshipBoardValidated?: boolean },
  rules: Record<MembershipType, MembershipRuleConfig>,
  referenceDate: Date = new Date()
): MembershipType {
  if (member.role === UserRole.GUEST || member.role === 'GUEST') return 'Guest';
  if (member.senatorshipBoardValidated && member.senatorshipId?.trim()) {
    return 'Senator';
  }

  const malaysian = isMalaysianNationality(member.nationality);
  if (!malaysian) return 'Visiting';

  const age = getMemberAge(member.dateOfBirth, referenceDate);
  if (age !== null) {
    const associateMin = rules.Associate?.ageLimit?.min ?? 41;
    if (age >= associateMin) return 'Associate';

    const probationMin = rules.Probation?.ageLimit?.min ?? 18;
    const probationMax = rules.Probation?.ageLimit?.max ?? 40;
    if (age >= probationMin && age <= probationMax) return 'Probation';
    if (age < probationMin) return 'Guest';
  }

  return 'Probation';
}

/** Return proposed type if eligible; otherwise suggestMembershipTypeForMember. */
export function resolveEligibleMembershipType(
  proposed: MembershipType,
  member: Pick<
    MembershipEligibilityInput,
    'nationality' | 'dateOfBirth' | 'senatorCertified' | 'senatorshipId' | 'role'
  >,
  rules: Record<MembershipType, MembershipRuleConfig>,
  referenceDate?: Date
): MembershipType {
  const check = validateMembershipTypeEligibility(
    { membershipType: proposed, ...member },
    rules,
    referenceDate
  );
  if (check.valid) return proposed;
  return suggestMembershipTypeForMember(member, rules, referenceDate);
}

export function roleForMembershipType(
  membershipType: MembershipType,
  currentRole?: UserRole | string
): UserRole {
  if (membershipType === 'Guest') return UserRole.GUEST;
  if (membershipType === 'Probation') return UserRole.PROBATION;
  if (currentRole === UserRole.BOARD || currentRole === UserRole.ADMIN || currentRole === UserRole.SUPER_ADMIN) {
    return currentRole as UserRole;
  }
  return UserRole.MEMBER;
}

export type ComputeMembershipTypeInput = Pick<
  MembershipEligibilityInput,
  'nationality' | 'dateOfBirth' | 'senatorCertified' | 'senatorshipId' | 'role'
> & {
  /** Stored type — used to retain Full after PromotionTracking promotion */
  membershipType?: MembershipType;
  senatorshipBoardValidated?: boolean;
};

/**
 * Derive membershipType from profile (age, nationality, senatorship) and promotion state (Full).
 * This is the single source of truth; the field is not user-editable.
 */
export function computeMembershipTypeFromMember(
  member: ComputeMembershipTypeInput,
  rules: Record<MembershipType, MembershipRuleConfig>,
  referenceDate: Date = new Date()
): MembershipType {
  if (member.role === UserRole.GUEST || member.role === 'GUEST') return 'Guest';

  if (member.senatorshipBoardValidated && member.senatorshipId?.trim()) {
    const senatorCheck = validateMembershipTypeEligibility(
      {
        membershipType: 'Senator',
        nationality: member.nationality,
        dateOfBirth: member.dateOfBirth,
        senatorCertified: true,
        senatorshipId: member.senatorshipId,
        role: member.role,
      },
      rules,
      referenceDate
    );
    if (senatorCheck.valid) return 'Senator';
  }

  if (member.membershipType === 'Full') {
    const fullCheck = validateMembershipTypeEligibility(
      {
        membershipType: 'Full',
        nationality: member.nationality,
        dateOfBirth: member.dateOfBirth,
        senatorCertified: member.senatorCertified,
        senatorshipId: member.senatorshipId,
        role: member.role,
      },
      rules,
      referenceDate
    );
    if (fullCheck.valid) return 'Full';
  }

  const suggested = suggestMembershipTypeForMember(member, rules, referenceDate);

  if (suggested === 'Probation' && member.membershipType !== 'Full') {
    return 'Probation';
  }

  return suggested;
}

/** Registration fee added to Probation/Full first-year dues */
export const FIRST_YEAR_REGISTRATION_FEE = 50;

/** Target annual dues from membershipType + config (matches Dues Renewal Dashboard). */
export function getTargetDuesForMembershipType(
  membershipType: MembershipType,
  isFirstYear: boolean,
  rules: Record<MembershipType, MembershipRuleConfig>
): number {
  const base = rules[membershipType]?.duesAmount ?? MembershipDues[membershipType] ?? 0;
  if ((membershipType === 'Probation' || membershipType === 'Full') && isFirstYear) {
    return base + FIRST_YEAR_REGISTRATION_FEE;
  }
  return base;
}

/** Infer membershipType from stored dues amount (inverse of dues lookup). */
export function resolveMembershipTypeFromDues(
  dues: number,
  rules: Record<MembershipType, MembershipRuleConfig>,
  fallback: MembershipType
): MembershipType {
  if (!dues) return fallback;

  const exact = Object.entries(rules).find(([, cfg]) => cfg.duesAmount === dues);
  if (exact) return exact[0] as MembershipType;

  const probationBase = rules.Probation?.duesAmount ?? MembershipDues.Probation;
  const fullBase = rules.Full?.duesAmount ?? MembershipDues.Full;
  if (dues === probationBase + FIRST_YEAR_REGISTRATION_FEE || dues === fullBase + FIRST_YEAR_REGISTRATION_FEE) {
    return 'Probation';
  }

  return fallback;
}

export const DEFAULT_MEMBERSHIP_RULES: Record<MembershipType, MembershipRuleConfig> = {
  Guest: { type: 'Guest', duesAmount: 0, nationalityLimit: 'None', ageLimit: {}, requiresSenatorship: false },
  Probation: { type: 'Probation', duesAmount: 300, nationalityLimit: 'Malaysian', ageLimit: { min: 18, max: 40 }, requiresSenatorship: false },
  Full: { type: 'Full', duesAmount: 300, nationalityLimit: 'Malaysian', ageLimit: { min: 18, max: 40 }, requiresSenatorship: false },
  Honorary: { type: 'Honorary', duesAmount: 300, nationalityLimit: 'Malaysian', ageLimit: { min: 18, max: 40 }, requiresSenatorship: false },
  Senator: { type: 'Senator', duesAmount: 0, nationalityLimit: 'Malaysian', ageLimit: {}, requiresSenatorship: true },
  Visiting: { type: 'Visiting', duesAmount: 500, nationalityLimit: 'Non-Malaysian', ageLimit: {}, requiresSenatorship: false },
  Associate: { type: 'Associate', duesAmount: 50, nationalityLimit: 'Malaysian', ageLimit: { min: 41 }, requiresSenatorship: false },
};

const DOC_REF = doc(db, 'systemSettings', 'membershipRules');

export const MembershipConfigService = {
  getConfig: async (): Promise<{
    rules: Record<MembershipType, MembershipRuleConfig>;
    calculationMode: 'calendar' | 'payment_date';
  }> => {
    try {
      const snap = await getDoc(DOC_REF);
      if (snap.exists()) {
        const data = snap.data();
        return {
          rules: (data.rules || DEFAULT_MEMBERSHIP_RULES) as Record<MembershipType, MembershipRuleConfig>,
          calculationMode: (data.calculationMode || 'calendar') as 'calendar' | 'payment_date'
        };
      }
    } catch (error: any) {
      if (error?.code !== 'permission-denied') {
        console.warn('Membership settings not available from Firestore, using defaults.');
      }
    }
    return {
      rules: DEFAULT_MEMBERSHIP_RULES,
      calculationMode: 'calendar'
    };
  },

  updateConfig: async (
    rules: Record<MembershipType, MembershipRuleConfig>,
    calculationMode: 'calendar' | 'payment_date'
  ): Promise<void> => {
    await setDoc(DOC_REF, { rules, calculationMode }, { merge: true });
  },

  getRules: async (): Promise<Record<MembershipType, MembershipRuleConfig>> => {
    const config = await MembershipConfigService.getConfig();
    return config.rules;
  },

  updateRules: async (rules: Record<MembershipType, MembershipRuleConfig>): Promise<void> => {
    await MembershipConfigService.updateConfig(rules, 'calendar');
  }
};

export function resolveMembershipPurpose(
  amount: number,
  year: number,
  rules: Record<MembershipType, MembershipRuleConfig>
): string {
  const probationDues = rules.Probation?.duesAmount ?? 300;
  const fullDues = rules.Full?.duesAmount ?? 300;
  const visitingDues = rules.Visiting?.duesAmount ?? 500;
  const associateDues = rules.Associate?.duesAmount ?? 50;

  if (amount === visitingDues) {
    return `${year} Visiting Membership`;
  }
  if (amount === associateDues) {
    return `${year} Associate Membership`;
  }
  if (amount === probationDues + 50 || amount === fullDues + 50) {
    return `${year} New Membership`;
  }
  if (amount === fullDues || amount === probationDues) {
    return `${year} Renewed Membership`;
  }
  return `${year} Membership`;
}

export async function getMembershipPurpose(amount: number, year: number): Promise<string> {
  const rules = await MembershipConfigService.getRules();
  return resolveMembershipPurpose(amount, year, rules);
}

