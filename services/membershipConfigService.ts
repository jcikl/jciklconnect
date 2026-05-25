import { collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { MembershipRuleConfig, MembershipType } from '../types';

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

