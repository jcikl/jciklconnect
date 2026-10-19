/**
 * Member doc payloads written by hooks/useAuth.tsx on self sign-up. Pure (no Firebase) so they can be
 * unit-tested against what firestore.rules accepts (members create: GUEST branch / isExternalSelfRegistration).
 */
import { UserRole } from '../types/common';
import type { Member } from '../types';
import { categoryForChapter } from './affiliation.mjs';

const KL_LO_ID = 'jcikl'; // same as DEFAULT_LO_ID (config/constants.ts)

const avatarFor = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0097D7&color=fff`;

/** Drop top-level undefined values (Firestore rejects them). */
const stripUndefined = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

/**
 * KL self sign-up (GUEST, or a matched pre-imported profile). Same fields signUp always wrote; reads
 * profile fields from additionalData.general.* / contact.phone (see components/auth/signUpExtras.ts).
 */
export function buildSelfSignUpMember(
  name: string,
  email: string,
  additionalData?: Record<string, any>,
  existingProfile?: Member | null,
): Record<string, unknown> {
  const newMember = {
    general: {
      name,
      avatarUrl: existingProfile?.general?.avatarUrl || avatarFor(name),
      fullName: existingProfile?.general?.fullName || additionalData?.general?.fullName,
      gender: existingProfile?.general?.gender || additionalData?.general?.gender,
      dob: existingProfile?.general?.dob || additionalData?.general?.dob,
      nationality: existingProfile?.general?.nationality || additionalData?.general?.nationality || 'Malaysia',
    } as any,
    contact: { email, phone: existingProfile?.contact?.phone || additionalData?.contact?.phone } as any,
    others: {
      hobbies: existingProfile?.others?.hobbies || (Array.isArray(additionalData?.selectedHobbies) ? additionalData.selectedHobbies : (Array.isArray(additionalData?.others?.hobbies) ? additionalData.others?.hobbies : [])),
      bio: existingProfile?.others?.bio || additionalData?.others?.bio,
    } as any,
    role: existingProfile?.role || UserRole.GUEST,
    tier: existingProfile?.tier || ('Bronze' as any),
    points: existingProfile?.points || 0,
    jciCareer: { joinDate: existingProfile?.jciCareer?.joinDate || new Date().toISOString().split('T')[0] } as any,
    skills: existingProfile?.skills || additionalData?.skills || [],
    churnRisk: existingProfile?.churnRisk || 'Low',
    attendanceRate: existingProfile?.attendanceRate || 100,
    duesStatus: existingProfile?.duesStatus || 'Pending',
    badges: existingProfile?.badges || [],
    // Persona & survey data from registration form
    ...(additionalData?.surveyAnswers ? { surveyAnswers: additionalData.surveyAnswers } : {}),
    ...(additionalData?.personaType ? { personaType: additionalData.personaType } : {}),
    ...(additionalData?.tendencyTags ? { tendencyTags: additionalData.tendencyTags } : {}),
    // Carry over any other imported data if matched
    ...(existingProfile || {}),
  } as unknown as Record<string, unknown>;

  const cleanMember = stripUndefined(newMember);
  if (!cleanMember.loId) cleanMember.loId = KL_LO_ID;
  return cleanMember;
}

export interface ExternalSignUpInput {
  name: string;
  email: string;
  /** Sister chapter id (sisterChapters doc id, never 'jcikl'). */
  loId: string;
  chapter: { country: string; type?: string[] };
  fullName?: string;
  gender?: string;
  /** 'YYYY-MM-DD' */
  dob?: string;
  nationality?: string;
  phone?: string;
}

/**
 * External self-registration (Phase 1 WP-3): an AFFILIATE of an active sister chapter waiting for their
 * chapter admin. firestore.rules isExternalSelfRegistration accepts exactly this shape: affiliation holds only
 * category / country / status, country = the chapter's, and only the GUEST sign-up keys + 'affiliation'.
 * No nested undefined values; no birthdayMMDD / privacy (not self-writable at create).
 */
export function buildExternalSignUpMember(input: ExternalSignUpInput): Record<string, unknown> {
  const general: Record<string, string> = { name: input.name, avatarUrl: avatarFor(input.name) };
  if (input.fullName?.trim()) general.fullName = input.fullName.trim();
  if (input.gender) general.gender = input.gender;
  if (input.dob) general.dob = input.dob;
  if (input.nationality) general.nationality = input.nationality;
  const contact: Record<string, string> = { email: input.email };
  if (input.phone?.trim()) contact.phone = input.phone.trim();
  return {
    general,
    contact,
    role: UserRole.AFFILIATE,
    loId: input.loId,
    affiliation: { category: categoryForChapter(input.chapter), country: input.chapter.country, status: 'pending_chapter' },
    tier: 'Bronze',
    points: 0,
    churnRisk: 'Low',
    attendanceRate: 100,
    duesStatus: 'Pending',
    badges: [],
    jciCareer: { joinDate: new Date().toISOString().split('T')[0] },
  };
}
