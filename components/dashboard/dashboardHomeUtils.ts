import { UserRole } from '../../types';

export type DashboardMembershipKind = 'probation' | 'full' | 'guest';

interface DashboardMemberLike {
  role?: UserRole | string;
  companyName?: string;
  industry?: string;
  idealReferralIndustry?: string;
  general?: {
    avatarUrl?: string;
  };
  contact?: {
    address?: string;
    emergency?: {
      name?: string;
    };
  };
  business?: {
    departmentAndPosition?: string;
    businessCategory?: unknown[];
    companyDescription?: string;
    idealReferrals?: string | unknown[];
    acceptInternationalBusiness?: boolean;
    levelOfManagement?: string;
  };
  others?: {
    tshirtSize?: string;
    shirtStyle?: string;
  };
  jciCareer?: {
    membershipType?: string;
  };
}

export interface ProfileCompletenessCheck {
  label: string;
  done: boolean;
}

export interface ProfileCompletenessTabStat {
  label: string;
  done: number;
  total: number;
  pct: number;
}

export interface ProfileCompleteness {
  done: number;
  total: number;
  pct: number;
  missing: ProfileCompletenessCheck[];
  tabStats: ProfileCompletenessTabStat[];
}

export const PROFILE_BASIC_LABELS = ['Profile photo', 'Apparel & Items'];
export const PROFILE_CONTACT_LABELS = ['Phone number', 'Address', 'Emergency contact'];
export const PROFILE_PROFESSIONAL_LABELS = [
  'Company name',
  'Industry',
  'Position / title',
  'Business categories',
  'Company description',
  'Ideal referral',
  'International business',
  'Level of management',
];

export const normalizeMembership = (member: DashboardMemberLike | null): DashboardMembershipKind => {
  if (!member) return 'guest';
  const membershipType = (member.jciCareer?.membershipType || '').toLowerCase();
  if (membershipType.includes('probation')) return 'probation';
  if (membershipType && !membershipType.includes('guest')) return 'full';
  if (!membershipType) {
    const memberRoles = [UserRole.MEMBER, UserRole.BOARD, UserRole.ADMIN, UserRole.SUPER_ADMIN];
    if (member.role && memberRoles.includes(member.role as UserRole)) return 'full';
  }
  return 'guest';
};

export const getProfileCompleteness = (member: DashboardMemberLike | null): ProfileCompleteness | null => {
  if (!member) return null;

  const tabs = [
    {
      label: 'Basic',
      checks: [
        { label: 'Profile photo', done: !!member.general?.avatarUrl },
        { label: 'Apparel & Items', done: !!(member.others?.tshirtSize && member.others?.shirtStyle) },
      ],
    },
    {
      label: 'Contact',
      checks: [
        { label: 'Address', done: !!member.contact?.address },
        { label: 'Emergency contact', done: !!member.contact?.emergency?.name },
      ],
    },
    {
      label: 'Professional',
      checks: [
        { label: 'Company name', done: !!member.companyName },
        { label: 'Industry', done: !!member.industry },
        { label: 'Position / title', done: !!member.business?.departmentAndPosition },
        { label: 'Business categories', done: Array.isArray(member.business?.businessCategory) && member.business.businessCategory.length > 0 },
        { label: 'Company description', done: !!member.business?.companyDescription },
        {
          label: 'Ideal referral',
          done: !!(
            member.idealReferralIndustry ||
            (Array.isArray(member.business?.idealReferrals)
              ? member.business.idealReferrals.length > 0
              : member.business?.idealReferrals)
          ),
        },
        { label: 'International business', done: !!member.business?.acceptInternationalBusiness },
        { label: 'Level of management', done: !!member.business?.levelOfManagement },
      ],
    },
  ];

  const allChecks = tabs.flatMap(tab => tab.checks);
  const done = allChecks.filter(check => check.done).length;
  const total = allChecks.length;
  const pct = Math.round((done / total) * 100);
  const missing = allChecks.filter(check => !check.done);
  const tabStats = tabs.map(tab => {
    const tabDone = tab.checks.filter(check => check.done).length;
    return {
      label: tab.label,
      done: tabDone,
      total: tab.checks.length,
      pct: Math.round((tabDone / tab.checks.length) * 100),
    };
  });

  return pct < 100 ? { done, total, pct, missing, tabStats } : null;
};

export const getProfileMissingCounts = (missing: ProfileCompletenessCheck[]) => ({
  basicCount: missing.filter(field => PROFILE_BASIC_LABELS.includes(field.label)).length,
  contactCount: missing.filter(field => PROFILE_CONTACT_LABELS.includes(field.label)).length,
  professionalCount: missing.filter(field => PROFILE_PROFESSIONAL_LABELS.includes(field.label)).length,
});

export const buildProfileUpdatePayload = (profileDraft: Record<string, string>): Record<string, unknown> => {
  const updates: Record<string, unknown> = {};
  if ('phone' in profileDraft) updates['contact.phone'] = profileDraft.phone;
  if ('companyName' in profileDraft) updates.companyName = profileDraft.companyName;
  if ('industry' in profileDraft) updates.industry = profileDraft.industry;
  if ('companyDescription' in profileDraft) updates['business.companyDescription'] = profileDraft.companyDescription;
  if ('idealReferral' in profileDraft) updates['business.idealReferrals'] = profileDraft.idealReferral;
  if ('address' in profileDraft) updates['contact.address'] = profileDraft.address;
  if ('emergencyContactName' in profileDraft) updates['contact.emergency.name'] = profileDraft.emergencyContactName;
  if ('emergencyContactRelationship' in profileDraft) updates['contact.emergency.relationship'] = profileDraft.emergencyContactRelationship;
  if ('emergencyContact' in profileDraft) updates['contact.emergency.name'] = profileDraft.emergencyContact;
  if ('shirtStyle' in profileDraft) updates['others.shirtStyle'] = profileDraft.shirtStyle;
  if ('tshirtSize' in profileDraft) updates['others.tshirtSize'] = profileDraft.tshirtSize;
  if ('jacketSize' in profileDraft) updates['others.jacketSize'] = profileDraft.jacketSize;
  if ('departmentAndPosition' in profileDraft) updates['business.departmentAndPosition'] = profileDraft.departmentAndPosition;
  if ('specialOffer' in profileDraft) updates['business.specialOffer'] = profileDraft.specialOffer;
  if ('companyWebsite' in profileDraft) updates['business.companyWebsite'] = profileDraft.companyWebsite;
  if ('acceptInternationalBusiness' in profileDraft) updates['business.acceptInternationalBusiness'] = profileDraft.acceptInternationalBusiness;
  if ('levelOfManagement' in profileDraft) updates['business.levelOfManagement'] = profileDraft.levelOfManagement;
  return updates;
};

export const getMemberDob = (member: any): string | undefined =>
  member.general?.dob || member.general?.dob || member.general?.dob;

export const getMemberDisplayName = (member: any): string =>
  member.general?.name || member.general?.name || '';

export const getMemberInitials = (member: any): string =>
  getMemberDisplayName(member)
    .split(' ')
    .map((part: string) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export const getAvatarGradientClass = (seed: string): string => {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = seed.charCodeAt(index) + ((hash << 5) - hash);
  }
  const gradients = [
    'from-pink-400 to-rose-500',
    'from-violet-400 to-purple-500',
    'from-sky-400 to-blue-500',
    'from-teal-400 to-emerald-500',
    'from-amber-400 to-orange-500',
  ];
  return gradients[Math.abs(hash) % gradients.length];
};
