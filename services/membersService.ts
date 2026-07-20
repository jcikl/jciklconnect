// Members Service - CRUD Operations
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Timestamp,
  DocumentData,
  writeBatch,
  runTransaction,
  deleteField,
  arrayRemove,
  arrayUnion,
  DocumentSnapshot,
  WriteBatch,
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { logWrite, logDelete } from './firestoreLogger';
import { logError as logServiceError, errorLoggingService } from './errorLoggingService';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { COLLECTIONS, DEFAULT_LO_ID } from '../config/constants';
import {
  Member,
  MemberCreateInput,
  UserRole,
  MembershipDues,
  MembershipStatus,
  MembershipRecord,
  MembershipType,
  MembershipRuleConfig,
  Transaction,
} from '../types';
import { isDevMode } from '../utils/devMode';
import { getMYTYear } from '../utils/dateUtils';
import { apiCache, CACHE_TTL_3MIN } from './cacheService';
import { MOCK_MEMBERS } from './mockData';
import { AuditLogService } from './auditLogService';

const CACHE_KEY_ALL_MEMBERS = 'members:all';
const CACHE_KEY_LO = (loId: string) => `members:lo:${loId}`;
const MEMBERS_TTL = CACHE_TTL_3MIN;
import {
  MembershipConfigService,
  getTargetDuesForMembershipType,
  resolveMembershipTypeFromDues,
  computeMembershipTypeFromMember,
  roleForMembershipType,
  resolveEligibleMembershipType,
} from './membershipConfigService';

const FIRST_MEMBERSHIP_DUES_TARGET = 350;

// Type-safe helpers for reading Firestore member document fields
function getMemberRole(data: DocumentData | undefined): string | null {
  if (!data) return null;
  const role = data['role'];
  return typeof role === 'string' ? role : null;
}
function getMemberLoId(data: DocumentData | undefined): string | null {
  if (!data) return null;
  const loId = data['loId'];
  return typeof loId === 'string' ? loId : null;
}

export class MembersService {
  /**
   * Commit a WriteBatch with exponential-backoff retry (1 s → 2 s → 4 s).
   * Throws the last error if all attempts fail.
   */
  private static async commitWithRetry(batch: WriteBatch, maxRetries = 3): Promise<void> {
    let lastError: unknown;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await batch.commit();
        return;
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
      }
    }
    throw lastError;
  }

  /** Recompute membershipType from profile + promotion (Full); always persisted on save. */
  static async syncComputedMembershipType(
    data: Partial<Member>,
    existing?: Member | null
  ): Promise<Partial<Member>> {
    const merged = { ...(existing || {}), ...data } as Member;
    const rules = await MembershipConfigService.getRules();
    const profileInput = {
      nationality: merged.nationality,
      dateOfBirth: merged.dateOfBirth,
      senatorCertified: merged.senatorCertified,
      senatorshipId: merged.senatorshipId,
      senatorshipBoardValidated: merged.senatorshipBoardValidated,
      role: merged.role,
      membershipType: merged.membershipType,
    };
    // When the caller explicitly passes membershipType (e.g. guest approval → 'Probation'),
    // validate+honour it rather than silently overriding with the profile-derived value.
    // resolveEligibleMembershipType keeps the proposed type when eligible; otherwise suggests a valid alternative.
    const computed = ('membershipType' in data && data.membershipType)
      ? resolveEligibleMembershipType(data.membershipType as MembershipType, profileInput, rules)
      : computeMembershipTypeFromMember(profileInput, rules);
    const newRole = roleForMembershipType(computed as MembershipType, merged.role as UserRole);
    const roleChanges: Partial<Member> = newRole !== (merged.role as UserRole) ? { role: newRole } : {};
    if (merged.membershipType === computed && !('membershipType' in data) && !Object.keys(roleChanges).length) return data;
    return { ...data, membershipType: computed, ...roleChanges };
  }
  /** Invalidate all members cache (call after any write to members collection). */
  static invalidateMembersCache(): void {
    apiCache.delete(CACHE_KEY_ALL_MEMBERS);
    apiCache.deleteByPrefix('members:lo:');
    apiCache.deleteByPrefix('members:byRole:');
  }

  /** Get all members, optionally filtered by loId (for multi-LO). */
  static async getAllMembers(loIdFilter?: string | null): Promise<Member[]> {
    // Treat jcikl same as "all" — single-LO deployments share one cache entry.
    const normalised = (!loIdFilter || loIdFilter === DEFAULT_LO_ID) ? null : loIdFilter;
    const cacheKey = normalised ? CACHE_KEY_LO(normalised) : CACHE_KEY_ALL_MEMBERS;

    return apiCache.getOrSet(cacheKey, async () => {
      try {
        let q;
        if (normalised != null) {
          q = query(
            collection(db, COLLECTIONS.MEMBERS),
            where('loId', '==', normalised),
            orderBy('updatedAt', 'desc')
          );
        } else {
          q = query(collection(db, COLLECTIONS.MEMBERS), limit(500));
        }
        const snapshot = await getDocs(q);
        const docs = snapshot.docs.map(d => ({ ...(d.data() as Omit<Member, 'id'>), id: d.id } as Member));
        if (docs.length === 500) {
          console.warn('[MembersService] getAllMembers hit limit(500), results may be incomplete');
        }

        if (docs.length === 0 && isDevMode()) {
          const list = normalised
            ? MOCK_MEMBERS.filter((m: Member) => (m as any).loId === normalised || !(m as any).loId)
            : MOCK_MEMBERS;
          return list;
        }
        return docs;
      } catch (error) {
        if (isDevMode()) {
          const list = normalised
            ? MOCK_MEMBERS.filter((m: Member) => (m as any).loId === normalised || !(m as any).loId)
            : MOCK_MEMBERS;
          return list;
        }
        errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'MembersService.getAllMembers' });
        throw error;
      }
    }, MEMBERS_TTL, 'membersService.getAllMembers');
  }

  // Get member by ID
  static async getMemberById(memberId: string): Promise<Member | null> {
    if (isDevMode()) {
      return MOCK_MEMBERS.find(m => m.id === memberId) || null;
    }

    try {
      const docRef = doc(db, COLLECTIONS.MEMBERS, memberId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { ...docSnap.data(), id: docSnap.id } as Member;
      }
      return null;
    } catch (error) {
      errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'MembersService.getMemberById' });
      throw error;
    }
  }

  // Helper to recalculate radar stats for an introducer (dynamic import to avoid circular dependency)
  static async recalculateIntroducerStats(introducerVal?: string) {
    if (!introducerVal || introducerVal.trim() === '' || isDevMode()) return;
    try {
      const trimmed = introducerVal.trim();
      const { PointsService } = await import('./pointsService');

      // 1. Check if the introducer matches a member ID
      const docRef = doc(db, COLLECTIONS.MEMBERS, trimmed);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        await PointsService.recalculateMemberRadarStats(docSnap.id);
        return;
      }

      // 2. Otherwise, check if it matches a member name
      const q = query(collection(db, COLLECTIONS.MEMBERS), where('name', '==', trimmed));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await PointsService.recalculateMemberRadarStats(d.id);
      }

      // 3. Also check general.name
      const q2 = query(collection(db, COLLECTIONS.MEMBERS), where('general.name', '==', trimmed));
      const snap2 = await getDocs(q2);
      for (const d of snap2.docs) {
        await PointsService.recalculateMemberRadarStats(d.id);
      }

      // 4. Also check top-level fullName
      const q3 = query(collection(db, COLLECTIONS.MEMBERS), where('fullName', '==', trimmed));
      const snap3 = await getDocs(q3);
      for (const d of snap3.docs) {
        await PointsService.recalculateMemberRadarStats(d.id);
      }
    } catch (e) {
      errorLoggingService.logError(e instanceof Error ? e : new Error(String(e)), { context: 'MembersService.recalculateIntroducerStats' });
    }
  }

  /** Helper to map flat properties to standard nested sub-objects (general, contact, etc.) for database consistency. */
  static normalizeMemberData(data: Record<string, any>, existing?: Member | null): Record<string, any> {
    const result = { ...data };

    // 1. General
    type MemberGeneral = NonNullable<Member['general']>;
    const general: Partial<MemberGeneral> & { fullName?: string } = {
      ...(existing?.general || {}),
    };
    if (data.name !== undefined) general.name = data.name;
    if (data.fullName !== undefined) general.fullName = data.fullName;
    if (data.chineseName !== undefined) general.chineseName = data.chineseName;
    else if (data.chiName !== undefined) general.chineseName = data.chiName;
    if (data.idNumber !== undefined) general.idNumber = data.idNumber;
    else if (data.nationalId !== undefined) general.idNumber = data.nationalId;
    if (data.dateOfBirth !== undefined) {
      general.dob = data.dateOfBirth;
      // Index field for birthday queries: "MMDD" e.g. "0706" for July 6
      const dobStr: string = data.dateOfBirth;
      if (dobStr && dobStr.length >= 10) {
        result.birthdayMMDD = dobStr.slice(5, 7) + dobStr.slice(8, 10);
      }
    } else if (data.dob !== undefined) {
      general.dob = data.dob;
      const dobStr: string = data.dob;
      if (dobStr && dobStr.length >= 10) {
        result.birthdayMMDD = dobStr.slice(5, 7) + dobStr.slice(8, 10);
      }
    }
    if (data.gender !== undefined) general.gender = data.gender;
    if (data.race !== undefined) general.race = data.race;
    else if (data.ethnicity !== undefined) general.race = data.ethnicity;
    if (data.ethnicity !== undefined) general.ethnicity = data.ethnicity;
    if (data.dietaryPreference !== undefined) general.dietaryPreference = data.dietaryPreference;
    if (data.nationality !== undefined) general.nationality = data.nationality;
    if (data.birthPlace !== undefined) general.birthPlace = data.birthPlace;
    if (data.avatarUrl !== undefined) general.avatarUrl = data.avatarUrl;
    else if (data.avatar !== undefined) general.avatarUrl = data.avatar;

    if (Object.keys(general).length > 0 || existing?.general) {
      result.general = general;
    }

    // 2. Contact
    type MemberContact = NonNullable<Member['contact']>;
    const contact: Partial<Omit<MemberContact, 'socials' | 'emergency'>> & {
      socials: Partial<MemberContact['socials']>;
      emergency: Partial<MemberContact['emergency']>;
    } = {
      ...(existing?.contact || {}),
      socials: { ...(existing?.contact?.socials || {}) },
      emergency: { ...(existing?.contact?.emergency || {}) }
    };
    if (data.email !== undefined) contact.email = data.email;
    if (data.phone !== undefined) contact.phone = data.phone;
    if (data.alternatePhone !== undefined) contact.alternatePhone = data.alternatePhone;
    if (data.address !== undefined) contact.address = data.address;
    
    if (data.whatsappJoined !== undefined) contact.whatsappJoined = !!data.whatsappJoined;
    else if (data.whatsappGroup !== undefined) contact.whatsappJoined = !!data.whatsappGroup;
    else if (data.whatsappgroup !== undefined) contact.whatsappJoined = !!data.whatsappgroup;

    if (data.linkedin !== undefined) contact.socials.linkedin = data.linkedin;
    else if (data.linkedIn !== undefined) contact.socials.linkedin = data.linkedIn;
    if (data.facebook !== undefined) contact.socials.facebook = data.facebook;
    if (data.instagram !== undefined) contact.socials.instagram = data.instagram;
    if (data.wechat !== undefined) contact.socials.wechat = data.wechat;
    else if (data.weChat !== undefined) contact.socials.wechat = data.weChat;

    if (data.emergencyContactName !== undefined) contact.emergency.name = data.emergencyContactName;
    else if (data.emergencyContact !== undefined) contact.emergency.name = data.emergencyContact;
    if (data.emergencyContactPhone !== undefined) contact.emergency.phone = data.emergencyContactPhone;
    if (data.emergencyContactRelationship !== undefined) contact.emergency.relationship = data.emergencyContactRelationship;

    if (Object.keys(contact.socials).length === 0 && !existing?.contact?.socials) delete contact.socials;
    if (Object.keys(contact.emergency).length === 0 && !existing?.contact?.emergency) delete contact.emergency;
    
    if (Object.keys(contact).length > 0 || existing?.contact) {
      result.contact = contact;
    }

    // 3. Others
    const others: Partial<NonNullable<Member['others']>> = {
      ...(existing?.others || {}),
    };
    if (data.bio !== undefined) others.bio = data.bio;
    if (data.shirtStyle !== undefined) others.shirtStyle = data.shirtStyle;
    else if (data.cutStyle !== undefined) others.shirtStyle = data.cutStyle;
    if (data.tshirtSize !== undefined) others.tshirtSize = data.tshirtSize;
    if (data.jacketSize !== undefined) others.jacketSize = data.jacketSize;
    if (data.embroideredName !== undefined) others.embroideredName = data.embroideredName;
    if (data.tshirtStatus !== undefined) others.tshirtStatus = data.tshirtStatus;
    if (data.hobbies !== undefined) others.hobbies = data.hobbies;

    if (Object.keys(others).length > 0 || existing?.others) {
      result.others = others;
    }

    // 4. Business
    const business: Partial<NonNullable<Member['business']>> = {
      ...(existing?.business || {}),
    };
    if (data.companyName !== undefined) business.companyName = data.companyName;
    if (data.companyWebsite !== undefined) business.companyWebsite = data.companyWebsite;
    if (data.companyLogoUrl !== undefined) business.companyLogoUrl = data.companyLogoUrl;
    if (data.introduction !== undefined) business.introduction = data.introduction;
    else if (data.companyDescription !== undefined) business.introduction = data.companyDescription;
    if (data.companyDescription !== undefined) business.companyDescription = data.companyDescription;
    if (data.title !== undefined) business.position = data.title;
    else if (data.position !== undefined) business.position = data.position;
    else if (data.profession !== undefined) business.position = data.profession;
    else if (data.departmentAndPosition !== undefined) business.position = data.departmentAndPosition;
    if (data.departmentAndPosition !== undefined) business.departmentAndPosition = data.departmentAndPosition;
    if (data.industry !== undefined) business.industry = data.industry;
    if (data.businessCategory !== undefined) business.businessCategory = data.businessCategory;
    else if (data.category !== undefined) business.businessCategory = data.category;
    if (data.specialOffer !== undefined) business.specialOffer = data.specialOffer;
    else if (data.offerToMember !== undefined) business.specialOffer = data.offerToMember;
    if (data.acceptInternationalBusiness !== undefined) business.acceptInternationalBusiness = data.acceptInternationalBusiness;
    
    if (data.idealReferrals !== undefined) {
      business.idealReferrals = data.idealReferrals;
    } else if (data.idealReferral !== undefined) {
      business.idealReferrals = typeof data.idealReferral === 'string'
        ? data.idealReferral.split(', ').filter(Boolean)
        : data.idealReferral;
    } else if (data.idealReferralIndustry !== undefined) {
      business.idealReferrals = typeof data.idealReferralIndustry === 'string'
        ? data.idealReferralIndustry.split(', ').filter(Boolean)
        : data.idealReferralIndustry;
    }
    if (data.connections !== undefined) business.connections = data.connections;
    if (data.levelOfManagement !== undefined) business.levelOfManagement = data.levelOfManagement;
    if (data.interestedIndustries !== undefined) business.interestedIndustries = data.interestedIndustries;
    if (data.idealReferralTypes !== undefined) business.idealReferralTypes = data.idealReferralTypes;

    if (Object.keys(business).length > 0 || existing?.business) {
      result.business = business;
    }

    // 5. JCI Career
    type MemberJciCareer = NonNullable<Member['jciCareer']>;
    // senatorship uses Record<string,unknown> because legacy import fields (senatorshipId, senatorCertified,
    // senatorshipBoardValidated) are stored here but not declared in JciSenatorship.
    const jciCareer: Partial<Omit<MemberJciCareer, 'senatorship'>> & {
      senatorship: Partial<MemberJciCareer['senatorship']> & Record<string, unknown>;
    } = {
      ...(existing?.jciCareer || {}),
      senatorship: { ...(existing?.jciCareer?.senatorship || {}) }
    };
    if (data.membershipType !== undefined) jciCareer.membershipType = data.membershipType;
    // membershipStatus legacy field removed (E5) — use membership[year].status instead
    if (data.joinDate !== undefined) jciCareer.joinDate = data.joinDate;
    else if (data.joinedDate !== undefined) jciCareer.joinDate = data.joinedDate;
    if (data.introducer !== undefined) jciCareer.introducer = data.introducer;

    if (data.senatorshipId !== undefined) jciCareer.senatorship.senatorshipId = data.senatorshipId;
    if (data.senatorCertified !== undefined) jciCareer.senatorship.senatorCertified = data.senatorCertified;
    if (data.senatorshipBoardValidated !== undefined) jciCareer.senatorship.senatorshipBoardValidated = data.senatorshipBoardValidated;

    if (data.currentBoardYear !== undefined) jciCareer.currentBoardYear = data.currentBoardYear;
    if (data.currentBoardPosition !== undefined) jciCareer.currentBoardPosition = data.currentBoardPosition;
    if (data.isCurrentBoardMember !== undefined) jciCareer.isCurrentBoardMember = data.isCurrentBoardMember;
    if (data.boardHistory !== undefined) jciCareer.boardHistory = data.boardHistory;

    if (data.points !== undefined) jciCareer.points = data.points;
    // attendanceRate deprecated (E6) — use attendanceCheckins/attendanceMonths/attendanceYear instead
    if (data.badgesCount !== undefined) jciCareer.badgesCount = data.badgesCount;
    if (data.projectsCount !== undefined) jciCareer.projectsCount = data.projectsCount;
    if (data.trainingsCount !== undefined) jciCareer.trainingsCount = data.trainingsCount;

    if (data.probationTasks !== undefined) jciCareer.probationTasks = data.probationTasks;
    if (data.promotionProgress !== undefined) jciCareer.promotionProgress = data.promotionProgress;
    if (data.isDuesPaidCurrentYear !== undefined) jciCareer.isDuesPaidCurrentYear = data.isDuesPaidCurrentYear;
    if (data.engagementProgress !== undefined) jciCareer.engagementProgress = data.engagementProgress;
    if (data.radarStats !== undefined) jciCareer.radarStats = data.radarStats;
    if (data.radarStatsByYear !== undefined) jciCareer.radarStatsByYear = data.radarStatsByYear;
    if (data.membershipDuesHistory !== undefined) jciCareer.membershipDuesHistory = data.membershipDuesHistory;
    if (data.leaderboardVisibility !== undefined) jciCareer.leaderboardVisibility = data.leaderboardVisibility;
    if (data.hasPaidInitiationFee !== undefined) jciCareer.hasPaidInitiationFee = data.hasPaidInitiationFee;
    if (data.senatorshipValidatedAt !== undefined) jciCareer.senatorshipValidatedAt = data.senatorshipValidatedAt;
    if (data.senatorshipValidatedBy !== undefined) jciCareer.senatorshipValidatedBy = data.senatorshipValidatedBy;

    if (Object.keys(jciCareer.senatorship).length === 0 && !existing?.jciCareer?.senatorship) delete jciCareer.senatorship;
    if (Object.keys(jciCareer).length > 0 || existing?.jciCareer) {
      result.jciCareer = jciCareer;
    }

    const companyName =
      business.companyName ??
      result.companyName ??
      existing?.companyName ??
      existing?.business?.companyName;
    if (companyName !== undefined) {
      result.companyName = companyName;
    }
    const industry =
      business.industry ??
      result.industry ??
      existing?.industry ??
      existing?.business?.industry;
    if (industry !== undefined) {
      result.industry = industry;
    }

    return result;
  }

  /** Create new member. Caller should pass loId (or use DEFAULT_LO_ID for single-LO). */
  static async createMember(memberData: MemberCreateInput, createdBy?: string): Promise<string> {
    if (isDevMode()) {
      const mockId = `mock-member-${Date.now()}`;
      return mockId;
    }

    try {
      if (!memberData.name?.trim()) throw new Error('Member name is required');
      if (!memberData.email?.trim()) throw new Error('Member email is required');
      const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!EMAIL_RE.test(memberData.email)) throw new Error('Invalid email format');
      if (memberData.idNumber && !/^\d{12}$/.test(memberData.idNumber)) throw new Error('IC number must be 12 digits');

      // P0 Fix: Claim email slot AND create the member document inside the same
      // runTransaction so there is no window where the email slot exists but the
      // member document does not (or vice-versa). Two concurrent calls with the
      // same email both attempt to set the same emailSlot doc — only the first wins.
      const sanitizedEmail = memberData.email.toLowerCase().replace(/[^a-z0-9@.]/g, '_');
      const emailSlotRef = doc(db, 'memberEmails', sanitizedEmail);

      const payload = {
        ...memberData,
        ...(await this.syncComputedMembershipType(memberData as Partial<Member>)),
      };
      const now = Timestamp.now();
      const cleanMemberData: Record<string, any> = {};

      Object.keys(payload).forEach(key => {
        const value = payload[key as keyof typeof payload];
        if (value !== undefined) {
          cleanMemberData[key] = value;
        }
      });

      cleanMemberData.createdAt = now;
      cleanMemberData.updatedAt = now;
      if (createdBy != null && createdBy !== '') cleanMemberData.createdBy = createdBy;
      if (cleanMemberData.loId == null || cleanMemberData.loId === '') cleanMemberData.loId = DEFAULT_LO_ID;

      const normalizedData = this.normalizeMemberData(cleanMemberData);

      // Pre-generate a member doc ref so we can use txn.set inside the transaction
      const memberRef = doc(collection(db, COLLECTIONS.MEMBERS));
      await runTransaction(db, async (txn) => {
        const existing = await txn.get(emailSlotRef);
        if (existing.exists()) {
          throw new Error('A member with this email already exists');
        }
        txn.set(emailSlotRef, { email: memberData.email, memberId: memberRef.id, createdAt: Timestamp.now() });
        txn.set(memberRef, normalizedData);
      });
      const docRef = memberRef;
      logWrite(CACHE_KEY_ALL_MEMBERS, 'membersService.createMember');
      this.invalidateMembersCache();

      // Isolate syncPublicListing so a failure here does not roll back the member creation (E-02)
      try {
        const { BusinessDirectoryService } = await import('./businessDirectoryService');
        await BusinessDirectoryService.syncPublicListing(docRef.id, normalizedData);
      } catch (syncErr) {
        errorLoggingService.logError(syncErr instanceof Error ? syncErr : new Error(String(syncErr)), { context: 'MembersService.createMember', additionalInfo: 'syncPublicListing failed — member was created successfully' });
      }

      if (cleanMemberData.introducer) {
        this.recalculateIntroducerStats(cleanMemberData.introducer).catch(err => errorLoggingService.logError(err, { action: 'recalculate-introducer-stats', additionalData: { introducer: cleanMemberData.introducer } }));
      }

      return docRef.id;
    } catch (error) {
      errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'MembersService.createMember' });
      throw error;
    }
  }

  /** Update member. Sets updatedAt and optionally updatedBy (audit). */
  static async updateMember(memberId: string, updates: Partial<Member>, updatedBy?: string): Promise<void> {
    if (isDevMode()) { return; }
    try {
      const memberRef = doc(db, COLLECTIONS.MEMBERS, memberId);
      const currentSnap = await getDoc(memberRef);
      const currentData = currentSnap.exists()
        ? ({ ...currentSnap.data(), id: memberId } as Member)
        : null;

      // Shallow-copy to avoid mutating the caller's object (E11)
      updates = { ...updates };

      if (updates.email != null) {
        const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!EMAIL_RE.test(updates.email)) throw new Error('Invalid email format');
      }

      // mentorId must go through assignMentor() to keep menteeIds bidirectionally in sync (N2 fix)
      if ('mentorId' in updates) {
        throw new Error('Use assignMentor() to change mentorId — updateMember does not sync menteeIds on mentor documents.');
      }

      if (currentData?.senatorshipBoardValidated) {
        if (
          'senatorshipId' in updates &&
          updates.senatorshipId !== currentData.senatorshipId
        ) {
          delete updates.senatorshipId;
        }
        if ('senatorCertified' in updates) {
          delete updates.senatorCertified;
        }
        if ('senatorshipBoardValidated' in updates) {
          delete updates.senatorshipBoardValidated;
        }
        if ('senatorshipValidatedAt' in updates) {
          delete updates.senatorshipValidatedAt;
        }
        if ('senatorshipValidatedBy' in updates) {
          delete updates.senatorshipValidatedBy;
        }
      }

      updates = {
        ...updates,
        ...(await this.syncComputedMembershipType(updates, currentData)),
      };

      // Check for GUEST -> MEMBER transition to initialize membership record (if not already handled by caller)
      if (updates.role === UserRole.MEMBER && !updates.membership) {
        if (currentData) {
          // If moving from GUEST (or no role) to MEMBER
          if (currentData.role === UserRole.GUEST || !currentData.role) {
            const joinDate = updates.joinDate || currentData.joinDate;
            const yearStr = joinDate ? String(new Date(joinDate).getFullYear()) : String(getMYTYear());
            
            const membership = currentData.membership || {};
            if (!membership[yearStr]) {
              membership[yearStr] = {
                year: parseInt(yearStr),
                dues: (await MembershipConfigService.getRules()).Probation?.duesAmount ?? MembershipDues.Probation,
                type: 'Probation',
                amount: 0,
                status: 'pending',
                transactionId: []
              };
              updates.membership = membership;
              console.log(`Initialized membership record for member ${memberId} for year ${yearStr}`);
            }
          }
        }
      }

      // Capture email change intent before building cleanUpdates — Auth sync happens AFTER
      // Firestore is written so that a conflict (409) can revert the already-written Firestore
      // fields rather than leaving Auth updated but Firestore stale.
      const newEmail = (updates as any).email ?? (updates.contact as any)?.email;
      const currentEmail = currentData?.contact?.email || currentData?.email;
      const emailChanging =
        !!(newEmail &&
        currentEmail &&
        newEmail.toLowerCase() !== currentEmail.toLowerCase() &&
        !isDevMode());

      const cleanUpdates: Record<string, any> = {
        updatedAt: Timestamp.now(),
        ...(updatedBy != null && updatedBy !== '' && { updatedBy }),
      };

      Object.keys(updates).forEach(key => {
        const value = updates[key as keyof Member];
        if (value !== undefined) {
          cleanUpdates[key] = value;
        }
      });

      const normalizedUpdates = this.normalizeMemberData(cleanUpdates, currentData);

      // SYNC-004 NOTE: If updates contain membership[year].amount (e.g. admin correction),
      // membership[year].status is NOT automatically recomputed here — callers must explicitly
      // call financeService.syncMemberMembership(memberId, `${year} membership`) afterwards.
      // TODO (SYNC-004): Detect membership.amount changes here and trigger syncMemberMembership
      // via dynamic import to avoid circular dependency.

      // FIX: When email is changing, update memberEmails uniqueness slots atomically in the
      // same writeBatch as the member document update — no window where the old slot is freed
      // and the new slot is unclaimed (or vice-versa).
      if (emailChanging && newEmail && currentEmail) {
        const sanitizedOld = currentEmail.toLowerCase().replace(/[^a-z0-9@.]/g, '_');
        const sanitizedNew = newEmail.toLowerCase().replace(/[^a-z0-9@.]/g, '_');
        const emailBatch = writeBatch(db);
        emailBatch.update(memberRef, normalizedUpdates);
        emailBatch.delete(doc(db, 'memberEmails', sanitizedOld));
        emailBatch.set(doc(db, 'memberEmails', sanitizedNew), {
          email: newEmail,
          memberId,
          createdAt: Timestamp.now(),
        });
        await emailBatch.commit();
      } else {
        await updateDoc(memberRef, normalizedUpdates);
      }
      const _frames = (new Error().stack ?? '').split('\n').slice(2);
      const _named = _frames
        .map(l => l.trim().replace(/^at /, '').replace(/ \(.*\)/, '').trim())
        .filter(n => n && n !== 'async' && !n.startsWith('Promise') && !n.includes('membersService') && !n.includes('node_modules'));
      const _caller = _named.slice(0, 3).join(' ← ') || 'membersService.updateMember';
      logWrite(CACHE_KEY_ALL_MEMBERS, _caller);
      this.invalidateMembersCache();

      // Auth email sync — runs AFTER Firestore succeeds so we can revert if Auth rejects
      if (emailChanging) {
        try {
          // ERR-R-005: timeout prevents spinner hanging if Netlify function hangs.
          const res = await fetchWithTimeout('/.netlify/functions/update-auth-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: memberId, newEmail }),
          });
          if (res.status === 409) {
            // Email already taken in Auth — revert the email fields we just wrote to Firestore
            const revertFields: Record<string, unknown> = { updatedAt: Timestamp.now() };
            if ('email' in normalizedUpdates) revertFields['email'] = currentEmail;
            if (normalizedUpdates['contact.email'] !== undefined || (normalizedUpdates['contact'] as any)?.email !== undefined) {
              revertFields['contact.email'] = currentEmail;
            }
            await updateDoc(memberRef, revertFields).catch(e =>
              errorLoggingService.logError(e instanceof Error ? e : new Error(String(e)), { context: 'MembersService.updateMember', additionalInfo: 'Failed to revert email in Firestore after Auth 409' })
            );
            this.invalidateMembersCache();
            throw new Error('This email is already used by another account. Email not updated.');
          }
          if (!res.ok) {
            errorLoggingService.logWarning(`update-auth-email returned ${res.status} — Firestore email updated without Auth sync`, { component: 'MembersService', action: 'updateMember' });
          }
        } catch (err) {
          if (err instanceof Error && err.message.includes('already used')) throw err;
          // Function unreachable (e.g. local dev) — Firestore email was updated; Auth email stays unchanged
          errorLoggingService.logError(err instanceof Error ? err : new Error(String(err)), { context: 'MembersService.updateMember', additionalInfo: 'update-auth-email unreachable, skipping Auth sync' });
        }
      }

      const mergedMember = { ...(currentData ?? {}), ...normalizedUpdates, id: memberId };
      const { BusinessDirectoryService } = await import('./businessDirectoryService');
      try {
        await BusinessDirectoryService.syncPublicListing(memberId, mergedMember as Record<string, unknown>);
      } catch (syncErr) {
        errorLoggingService.logError(syncErr instanceof Error ? syncErr : new Error(String(syncErr)), { context: 'MembersService.updateMember', additionalInfo: 'syncPublicListing failed — member update was saved successfully' });
      }
      try {
        await this.syncBoardMemberDisplayFields(memberId, mergedMember as Member);
      } catch (syncErr) {
        // Note: sync failure is intentionally non-fatal. The calling UI hook (useMemberMutations)
        // shows a toast on any error returned. Developer visibility is provided via console.warn.
        errorLoggingService.logError(syncErr as Error, { component: 'MembersService', action: 'syncBoardMemberDisplayFields', additionalData: { memberId } });
      }

      // TODO (SYNC-NAME-EVENTREG): When member name changes (general.name / fullName), the
      // denormalised memberName field in eventRegistrations is not updated here because the
      // volume of registrations per member can be high (hundreds) and a synchronous batch
      // would block the write path unacceptably. Accepted eventual-consistency trade-off:
      // eventRegistrations.memberName may be stale until a periodic reconciliation job
      // (or a manual admin trigger) backfills it. If this becomes a product issue, add a
      // Cloud Function triggered on members/{memberId} onUpdate that fans out the patch in
      // background batches of 500 (Firestore writeBatch limit).
      // Related field: eventRegistrations.memberName (denormalized from member.general.name)

      // Trigger introducer recalculation if introducer changes
      if (cleanUpdates.introducer !== undefined && (!currentData || cleanUpdates.introducer !== currentData.introducer)) {
        if (currentData?.introducer) {
          const introducer = currentData.introducer;
          this.recalculateIntroducerStats(introducer).catch(err => errorLoggingService.logError(err, { action: 'recalculate-introducer-stats', additionalData: { introducer } }));
        }
        if (cleanUpdates.introducer) {
          const introducer = cleanUpdates.introducer;
          this.recalculateIntroducerStats(introducer).catch(err => errorLoggingService.logError(err, { action: 'recalculate-introducer-stats', additionalData: { introducer } }));
        }
      }
    } catch (error) {
      errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'MembersService.updateMember' });
      throw error;
    }
  }

  /** Board of Directors validates a member's senatorship number (locks future edits). */
  static async validateSenatorshipByBoard(
    memberId: string,
    validatedByMemberId: string,
    validatedByName?: string
  ): Promise<void> {
    const member = await this.getMemberById(memberId);
    if (!member) throw new Error('Member not found');
    if (!member.senatorshipId?.trim()) {
      throw new Error('Senatorship number is required before validation');
    }
    if (member.senatorshipBoardValidated) {
      throw new Error('Senatorship is already validated');
    }

    await this.updateMember(
      memberId,
      {
        senatorshipBoardValidated: true,
        senatorCertified: true,
        senatorshipValidatedAt: new Date().toISOString(),
        senatorshipValidatedBy: validatedByName || validatedByMemberId,
      },
      validatedByMemberId
    );
  }

  /** Revoke board validation (admin / board only). Clears certification. */
  static async revokeSenatorshipValidation(
    memberId: string,
    revokedBy?: string
  ): Promise<void> {
    const member = await this.getMemberById(memberId);
    if (!member?.senatorshipBoardValidated) {
      throw new Error('Senatorship is not validated');
    }

    // Compute new membershipType BEFORE writing, using simulated post-revocation state (E3 fix:
    // eliminates second updateDoc so revoke is a single atomic write — no partial failure risk).
    const simulatedMember = { ...member, senatorCertified: false, senatorshipBoardValidated: false } as Member;
    const typePatch = await this.syncComputedMembershipType({}, simulatedMember);

    const memberRef = doc(db, COLLECTIONS.MEMBERS, memberId);
    await updateDoc(memberRef, {
      senatorshipBoardValidated: false,
      senatorCertified: false,
      senatorshipValidatedAt: deleteField(),
      senatorshipValidatedBy: deleteField(),
      'jciCareer.senatorshipValidatedAt': deleteField(),
      'jciCareer.senatorshipValidatedBy': deleteField(),
      ...(typePatch.membershipType ? { membershipType: typePatch.membershipType } : {}),
      ...(typePatch.role ? { role: typePatch.role } : {}),
      updatedAt: Timestamp.now(),
      ...(revokedBy ? { updatedBy: revokedBy } : {}),
    });
    this.invalidateMembersCache();
  }

  private static async syncBoardMemberDisplayFields(memberId: string, member: Member): Promise<void> {
    try {
      const memberAny = member as any;
      const firstText = (...values: unknown[]): string | undefined => {
        const found = values.find((value) => typeof value === 'string' && value.trim().length > 0);
        return typeof found === 'string' ? found.trim() : undefined;
      };

      const display: Record<string, unknown> = {
        memberName: firstText(
          memberAny.general?.name,
          memberAny.general?.fullName,
          memberAny.fullName,
          memberAny.name
        ),
        avatarUrl: firstText(
          memberAny.general?.avatar,
          memberAny.general?.avatarUrl,
          memberAny.avatarUrl,
          memberAny.avatar
        ) || '',
        companyName: firstText(
          memberAny.business?.companyName,
          memberAny.companyName,
          memberAny.business?.position,
          memberAny.departmentAndPosition
        ),
      };

      // Sync displayRole so boardMembers stays consistent when updateMember changes role.
      // updateMemberRole() already does this atomically, but updateMember() with a role
      // field also reaches this path — keep both in sync.
      const memberRole = memberAny.role as string | undefined;
      if (memberRole) {
        display.displayRole = memberRole;
      }

      const cleanDisplay = Object.fromEntries(
        Object.entries(display).filter(([, value]) => value !== undefined)
      );
      if (Object.keys(cleanDisplay).length === 0) return;

      const boardSnapshot = await getDocs(
        query(collection(db, COLLECTIONS.BOARD_MEMBERS), where('memberId', '==', memberId))
      );

      const batch = writeBatch(db);
      boardSnapshot.docs.forEach((boardDoc) => {
        batch.update(doc(db, COLLECTIONS.BOARD_MEMBERS, boardDoc.id), {
          ...cleanDisplay,
          updatedAt: new Date().toISOString(),
        });
      });
      await batch.commit();
    } catch (err) {
      logServiceError(
        err instanceof Error ? err : new Error(String(err)),
        { component: 'MembersService', action: 'syncBoardMemberDisplayFields', additionalData: { memberId } }
      );
      throw err;
    }
  }

  // Delete member
  static async deleteMember(memberId: string): Promise<void> {
    if (isDevMode()) {
      const index = MOCK_MEMBERS.findIndex(m => m.id === memberId);
      if (index !== -1) {
        MOCK_MEMBERS.splice(index, 1);
      }
      return;
    }

    try {
      // Prevent unnecessary Firestore permission errors by checking current user's role
      const currentUid = auth?.currentUser?.uid || null;
      if (!currentUid) {
        const e: any = new Error('User not authenticated');
        e.code = 'permission-denied';
        throw e;
      }

      // Read current user's member doc to verify ADMIN role
      const currentMemberDoc = await getDoc(doc(db, COLLECTIONS.MEMBERS, currentUid));
      const currentRole = currentMemberDoc.exists() ? getMemberRole(currentMemberDoc.data()) : null;
      const myLoId = currentMemberDoc.exists() ? getMemberLoId(currentMemberDoc.data()) ?? null : null;
      if (!['ADMIN', 'SUPER_ADMIN'].includes(currentRole)) {
        const e: any = new Error('User lacks ADMIN / SUPER_ADMIN role for deletion');
        e.code = 'permission-denied';
        errorLoggingService.logWarning(`Delete blocked: user ${currentUid} (role=${currentRole}) attempted to delete member ${memberId}`, { component: 'MembersService', action: 'deleteMember' });
        throw e;
      }

      // Read target member doc to enforce LO-level delete rule (matches Firestore rules)
      const targetDoc = await getDoc(doc(db, COLLECTIONS.MEMBERS, memberId));
      const targetLoId = targetDoc.exists() ? (targetDoc.data() as Omit<Member, 'id'>).loId ?? null : null;

      // Firestore rule requires (resource == null || resourceInMyLo(resource.data)).
      // If target has an loId and current admin has a different loId, deny client-side to avoid permission error.
      if (targetLoId != null && myLoId != null && targetLoId !== myLoId) {
        const e: any = new Error('Cannot delete member from a different LO');
        e.code = 'permission-denied';
        console.warn(`Delete blocked by LO mismatch: user ${currentUid} lo=${myLoId} target ${memberId} lo=${targetLoId}`);
        throw e;
      }

      // P1 fix: read ALL dependent docs in parallel BEFORE any writes so the primary write
      // is a single batch covering soft-delete + mentor cleanup + email release + boardMembers +
      // bizListings (was previously 3 sequential batches: delete → cleanup → cascade).
      const mentorId: string | undefined = targetDoc.exists()
        ? (targetDoc.data() as Omit<Member, 'id'>).mentorId
        : undefined;
      const targetEmailRaw: string | undefined = targetDoc.exists()
        ? ((targetDoc.data() as any)?.contact?.email || (targetDoc.data() as any)?.email)
        : undefined;
      const [boardSnap, bizSnap, regSnap, prSnap, notifSnap] = await Promise.all([
        getDocs(query(collection(db, COLLECTIONS.BOARD_MEMBERS), where('memberId', '==', memberId))),
        getDocs(query(collection(db, COLLECTIONS.PUBLIC_BUSINESS_LISTINGS), where('memberId', '==', memberId))),
        getDocs(query(collection(db, COLLECTIONS.EVENT_REGISTRATIONS), where('memberId', '==', memberId))),
        getDocs(query(collection(db, COLLECTIONS.PAYMENT_REQUESTS), where('memberId', '==', memberId), where('status', 'in', ['pending', 'submitted', 'approved']))),
        getDocs(query(collection(db, COLLECTIONS.NOTIFICATIONS), where('memberId', '==', memberId))),
      ]);

      // Primary batch: soft-delete + mentor cleanup + email release + boardMembers + bizListings
      const primaryBatch = writeBatch(db);
      primaryBatch.update(doc(db, COLLECTIONS.MEMBERS, memberId), {
        role: 'INACTIVE',
        deletedAt: Timestamp.now(),
        deletedBy: currentUid,
        updatedAt: Timestamp.now(),
      });
      if (mentorId) {
        primaryBatch.update(doc(db, COLLECTIONS.MEMBERS, mentorId), {
          menteeIds: arrayRemove(memberId),
          updatedAt: Timestamp.now(),
        });
      }
      if (targetEmailRaw) {
        const sanitizedDelEmail = targetEmailRaw.toLowerCase().replace(/[^a-z0-9@.]/g, '_');
        primaryBatch.delete(doc(db, 'memberEmails', sanitizedDelEmail));
      }
      boardSnap.docs.forEach(d => primaryBatch.delete(d.ref));
      bizSnap.docs.forEach(d => primaryBatch.delete(d.ref));
      await this.commitWithRetry(primaryBatch);

      // Cascade batch: soft-cancel eventRegistrations + paymentRequests, delete notifications (P1 fix).
      // Points, transactions, achievements, badgeAwards, loStarProgress are kept as historical
      // records — safe because this is a soft-delete (INACTIVE member still exists in Firestore so
      // memberId references continue to resolve; no orphan risk for read-only history collections).
      const cascadeOps: Array<{ ref: ReturnType<typeof doc>; data: Record<string, unknown>; op: 'update' | 'delete' }> = [
        ...regSnap.docs.map(d => ({ ref: d.ref, data: { status: 'cancelled', updatedAt: Timestamp.now() }, op: 'update' as const })),
        ...prSnap.docs.map(d => ({ ref: d.ref, data: { status: 'memberDeleted', updatedAt: Timestamp.now() }, op: 'update' as const })),
        ...notifSnap.docs.map(d => ({ ref: d.ref, data: {}, op: 'delete' as const })),
      ];
      for (let i = 0; i < cascadeOps.length; i += 400) {
        const cascadeBatch = writeBatch(db);
        cascadeOps.slice(i, i + 400).forEach(({ ref, data, op }) => {
          if (op === 'delete') { cascadeBatch.delete(ref); }
          else { cascadeBatch.update(ref, data); }
        });
        await this.commitWithRetry(cascadeBatch);
      }

      logDelete(CACHE_KEY_ALL_MEMBERS, 'membersService.deleteMember');
      this.invalidateMembersCache();
    } catch (error) {
      errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'MembersService.deleteMember', additionalInfo: `memberId=${memberId}` });
      throw error;
    }
  }

  // Search members
  static async searchMembers(searchTerm: string): Promise<Member[]> {
    try {
      // Firestore doesn't support full-text search natively
      // This is a simple implementation - consider using Algolia for production
      const allMembers = await this.getAllMembers();
      const term = searchTerm.toLowerCase();

      return allMembers.filter(member =>
        (member.name ?? '').toLowerCase().includes(term) ||
        (member.email ?? '').toLowerCase().includes(term) ||
        (member.skills ?? []).some(skill => skill.toLowerCase().includes(term))
      );
    } catch (error) {
      errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'MembersService.searchMembers' });
      throw error;
    }
  }

  // Get members by role
  static async getMembersByRole(role: UserRole): Promise<Member[]> {
    const cacheKey = `members:byRole:${role}`;
    const cached = apiCache.get<Member[]>(cacheKey);
    if (cached) return cached;

    try {
      const q = query(
        collection(db, COLLECTIONS.MEMBERS),
        where('role', '==', role),
        // PERF11: Increased from 200 to 500 to match getAllMembers cap. TODO: implement pagination for very large chapters.
        limit(500)
      );

      const snapshot = await getDocs(q);
      if (snapshot.docs.length >= 500) {
        console.warn('[membersService] Member query hit 500 cap — some members may be excluded');
      }
      const results = snapshot.docs.map(doc => ({
        ...(doc.data() as Omit<Member, 'id'>),
        id: doc.id,
      } as Member));
      apiCache.set(cacheKey, results, 300000);
      return results;
    } catch (error) {
      errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'MembersService.getMembersByRole' });
      throw error;
    }
  }

  // Get member by email (for account linking)
  static async getMemberByEmail(email: string): Promise<Member | null> {
    if (isDevMode()) {
      return MOCK_MEMBERS.find(m => m.email.toLowerCase() === email.toLowerCase()) || null;
    }

    try {
      const q = query(
        collection(db, COLLECTIONS.MEMBERS),
        where('email', '==', email),
        limit(1)
      );

      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const d = snapshot.docs[0];
        return { ...(d.data() as Omit<Member, 'id'>), id: d.id } as Member;
      }

      // P2 Fix: Also try the nested contact.email field — some members store email
      // only under contact.email and the flat field may not be populated.
      const q2 = query(
        collection(db, COLLECTIONS.MEMBERS),
        where('contact.email', '==', email),
        limit(1)
      );
      const snapshot2 = await getDocs(q2);
      if (!snapshot2.empty) {
        const d = snapshot2.docs[0];
        return { ...(d.data() as Omit<Member, 'id'>), id: d.id } as Member;
      }

      return null;
    } catch (error) {
      errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'MembersService.getMemberByEmail' });
      throw error;
    }
  }

  // Get members at risk (churn prediction)
  static async getMembersAtRisk(): Promise<Member[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.MEMBERS),
        where('churnRisk', 'in', ['High', 'Medium'])
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        ...(doc.data() as Omit<Member, 'id'>),
        id: doc.id,
      } as Member));
    } catch (error) {
      errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'MembersService.getMembersAtRisk' });
      throw error;
    }
  }

  // Update member role (for Board transitions)
  /** 当年应计月份数：入会年份从入会月起算，否则从 1 月起算 */
  static computeAttendanceMonths(joinDate?: string | null, now: Date = new Date()): number {
    const year = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-based
    let startMonth = 1;
    if (joinDate) {
      const jd = new Date(joinDate);
      if (!isNaN(jd.getTime()) && jd.getFullYear() === year) {
        startMonth = jd.getMonth() + 1;
      }
    }
    return Math.max(1, currentMonth - startMonth + 1);
  }

  /** 按当年 checked_in 记录重算出席对比（签到次数 vs 已过月份），写回会员档案 */
  static async recalculateAttendance(memberId: string): Promise<void> {
    if (isDevMode()) return;
    try {
      const member = await this.getMemberById(memberId);
      if (!member) return;
      const now = new Date();
      const year = now.getFullYear();
      const joinDate = member.jciCareer?.joinDate || member.joinDate;
      const months = this.computeAttendanceMonths(joinDate, now);

      const { EventRegistrationService } = await import('./eventRegistrationService');
      const regs = await EventRegistrationService.listByMember(memberId);
      const checkins = regs.filter(r =>
        r.status === 'checked_in' &&
        r.checkedInAt &&
        new Date(r.checkedInAt).getFullYear() === year
      ).length;

      await updateDoc(doc(db, COLLECTIONS.MEMBERS, memberId), {
        attendanceCheckins: checkins,
        attendanceMonths: months,
        attendanceYear: year,
        updatedAt: Timestamp.now(),
      });
      logWrite(CACHE_KEY_ALL_MEMBERS, 'membersService.recalculateAttendance');
      this.invalidateMembersCache();
    } catch (error) {
      errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'MembersService.recalculateAttendance' });
      throw error;
    }
  }

  static async updateMemberRole(memberId: string, newRole: UserRole): Promise<void> {
    if (isDevMode()) return;
    try {
      // Promoting to ADMIN / SUPER_ADMIN requires the caller to also be ADMIN+ (E13 fix)
      const adminOnlyRoles: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN];
      if (adminOnlyRoles.includes(newRole)) {
        const currentUid = auth?.currentUser?.uid;
        if (!currentUid) {
          const e: any = new Error('User not authenticated'); e.code = 'permission-denied'; throw e;
        }
        const callerDoc = await getDoc(doc(db, COLLECTIONS.MEMBERS, currentUid));
        const callerRole = callerDoc.exists() ? getMemberRole(callerDoc.data()) : null;
        if (!adminOnlyRoles.includes(callerRole as UserRole)) {
          const e: any = new Error(`Only ADMIN / SUPER_ADMIN may assign the ${newRole} role`);
          e.code = 'permission-denied'; throw e;
        }
      }
      // Query boardMembers first so we can include the displayRole update in the same batch (E-03)
      const boardSnap = await getDocs(
        query(collection(db, COLLECTIONS.BOARD_MEMBERS), where('memberId', '==', memberId))
      );
      const roleBatch = writeBatch(db);
      roleBatch.update(doc(db, COLLECTIONS.MEMBERS, memberId), {
        role: newRole,
        updatedAt: Timestamp.now(),
        roleChangedBy: auth?.currentUser?.uid ?? null,
        roleChangedAt: Timestamp.now(),
      });
      boardSnap.docs.forEach(d =>
        roleBatch.update(d.ref, { displayRole: newRole, updatedAt: Timestamp.now() })
      );
      await this.commitWithRetry(roleBatch);
      this.invalidateMembersCache();
      // P1-fix: audit role changes — these are high-sensitivity operations.
      AuditLogService.writeAuditEntry({
        action: 'UPDATE_MEMBER_ROLE',
        performedBy: auth?.currentUser?.uid ?? 'unknown',
        targetCollection: COLLECTIONS.MEMBERS,
        targetId: memberId,
        after: { role: newRole },
      }).catch(err => errorLoggingService.logError(err instanceof Error ? err : new Error(String(err)), { context: 'MembersService.updateMemberRole', additionalInfo: 'Audit write failed' }));
    } catch (error) {
      errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'MembersService.updateMemberRole' });
      throw error;
    }
  }

  // Assign mentor
  static async assignMentor(memberId: string, mentorId: string): Promise<void> {
    try {
      // P1 Fix: Use arrayUnion instead of read-then-spread so concurrent assignMentor
      // calls cannot overwrite each other's writes. arrayUnion is idempotent — calling
      // it twice with the same memberId is safe.
      const batch = writeBatch(db);
      batch.update(doc(db, COLLECTIONS.MEMBERS, memberId), {
        mentorId,
        updatedAt: Timestamp.now(),
      });
      batch.update(doc(db, COLLECTIONS.MEMBERS, mentorId), {
        menteeIds: arrayUnion(memberId),
        updatedAt: Timestamp.now(),
      });
      await this.commitWithRetry(batch);
      this.invalidateMembersCache();
    } catch (error) {
      errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'MembersService.assignMentor' });
      throw error;
    }
  }

  /** Batch update members — uses writeBatch for atomicity (E01) */
  static async batchUpdateMembers(memberIds: string[], updates: Partial<Member>): Promise<void> {
    if (isDevMode()) {
      await Promise.all(memberIds.map(id => this.updateMember(id, updates)));
      return;
    }
    try {
      // mentorId changes must go through assignMentor to keep menteeIds in sync (E12 fix)
      if ('mentorId' in updates) {
        throw new Error('Use assignMentor() to change mentorId — batchUpdateMembers does not sync menteeIds on mentor documents.');
      }
      // Email changes must go through updateMember so the memberEmails uniqueness slot
      // and Auth email are updated atomically per-member (each member has a different
      // current email, which a single batch payload cannot handle correctly).
      if ('email' in updates || (updates.contact && (updates.contact as any)?.email)) {
        throw new Error('Use updateMember() to change email — batchUpdateMembers cannot safely update email uniqueness slots for multiple members.');
      }
      // Base normalization used for display-field detection and display sync
      const normalized = this.normalizeMemberData(updates as Record<string, any>);
      const now = Timestamp.now();

      // Fetch all current member docs for:
      //   (a) per-member normalization to preserve existing nested fields (E3 fix),
      //   (b) introducer tracking for stats recalculation (M2 fix), and
      //   (c) senatorship lock guard + membership type sync (variant symmetry fix).
      const introducerChanging = 'introducer' in normalized;
      const oldIntroducerMap = new Map<string, string | undefined>();
      // Chunk reads in batches of 30 to avoid excessive concurrent Firestore connections at scale.
      const CHUNK = 30;
      const existingSnaps: DocumentSnapshot[] = [];
      for (let c = 0; c < memberIds.length; c += CHUNK) {
        const chunkSnaps = await Promise.all(
          memberIds.slice(c, c + CHUNK).map(id => getDoc(doc(db, COLLECTIONS.MEMBERS, id)))
        );
        existingSnaps.push(...chunkSnaps);
      }
      const existingByIds = new Map<string, Member>();
      existingSnaps.forEach((snap, i) => {
        if (snap.exists()) {
          existingByIds.set(memberIds[i], { ...snap.data(), id: memberIds[i] } as Member);
          if (introducerChanging) {
            oldIntroducerMap.set(memberIds[i], (snap.data() as Omit<Member, 'id'> & { introducer?: string }).introducer);
          }
        }
      });

      // Pre-compute syncComputedMembershipType per member when updates touch fields that affect
      // membershipType (nationality, role, senatorship, etc.). Mirrors updateMember behaviour.
      const MEMBERSHIP_TYPE_FIELDS = new Set([
        'membershipType', 'role', 'nationality', 'dateOfBirth', 'dob',
        'senatorCertified', 'senatorshipId', 'senatorshipBoardValidated',
      ]);
      const needsMembershipTypeSync = Object.keys(normalized).some(k => MEMBERSHIP_TYPE_FIELDS.has(k));
      const membershipTypePatchMap = new Map<string, Partial<Member>>();
      if (needsMembershipTypeSync) {
        await Promise.all(
          memberIds.map(async id => {
            const existing = existingByIds.get(id) ?? null;
            const patch = await this.syncComputedMembershipType(updates, existing);
            membershipTypePatchMap.set(id, patch);
          })
        );
      }

      // Fields that are locked once senatorship is board-validated (mirrors updateMember guard).
      const SENATORSHIP_LOCK_FIELDS = new Set([
        'senatorshipId', 'senatorCertified', 'senatorshipBoardValidated',
        'senatorshipValidatedAt', 'senatorshipValidatedBy',
      ]);
      const hasSenatorshipFields = Object.keys(normalized).some(k => SENATORSHIP_LOCK_FIELDS.has(k));

      // Pre-compute per-member GUEST→MEMBER membership[year] initialization patches.
      // Mirrors updateMember lines 565-587 (variant symmetry fix): when a member is promoted
      // from GUEST to MEMBER via batch, they must receive a Probation membership record for the
      // current year — otherwise they carry MEMBER role with no dues entry.
      const membershipInitPatchMap = new Map<string, Record<string, unknown>>();
      if (updates.role === UserRole.MEMBER && !updates.membership) {
        const probationRules = (await MembershipConfigService.getRules()).Probation;
        const probationDues = probationRules?.duesAmount ?? MembershipDues.Probation;
        memberIds.forEach(id => {
          const existing = existingByIds.get(id) ?? null;
          if (!existing) return;
          if (existing.role !== UserRole.GUEST && existing.role != null) return; // only GUEST→MEMBER
          const joinDate = (updates as any).joinDate || existing.joinDate;
          const yearStr = joinDate ? String(new Date(joinDate).getFullYear()) : String(getMYTYear());
          const existingMembership = (existing.membership as Record<string, unknown> | undefined) ?? {};
          if (existingMembership[yearStr]) return; // already has a record for this year
          membershipInitPatchMap.set(id, {
            [`membership.${yearStr}`]: {
              year: parseInt(yearStr),
              dues: probationDues,
              type: 'Probation',
              amount: 0,
              status: 'pending',
              transactionId: [],
            },
          });
        });
      }

      // Firestore writeBatch limit is 500; flush every 400 to stay safe
      for (let i = 0; i < memberIds.length; i += 400) {
        const batch = writeBatch(db);
        memberIds.slice(i, i + 400).forEach(id => {
          const existing = existingByIds.get(id) ?? null;

          // Senatorship lock guard: strip protected fields for board-validated members (mirrors updateMember)
          let memberUpdates: Partial<Member> = updates;
          if (hasSenatorshipFields && existing?.senatorshipBoardValidated) {
            memberUpdates = { ...updates };
            if ('senatorshipId' in memberUpdates && (memberUpdates as any).senatorshipId !== existing.senatorshipId) {
              delete (memberUpdates as any).senatorshipId;
            }
            if ('senatorCertified' in memberUpdates) delete (memberUpdates as any).senatorCertified;
            if ('senatorshipBoardValidated' in memberUpdates) delete (memberUpdates as any).senatorshipBoardValidated;
            if ('senatorshipValidatedAt' in memberUpdates) delete (memberUpdates as any).senatorshipValidatedAt;
            if ('senatorshipValidatedBy' in memberUpdates) delete (memberUpdates as any).senatorshipValidatedBy;
          }

          // Normalize per-member so existing nested fields (socials, emergency, etc.) are preserved (E3 fix)
          const perMemberNormalized = this.normalizeMemberData(memberUpdates as Record<string, any>, existing);
          // Merge pre-computed membership type patch (mirrors updateMember syncComputedMembershipType)
          const typePatch = membershipTypePatchMap.get(id) ?? {};
          // Merge GUEST→MEMBER membership initialization patch (variant symmetry fix)
          const membershipInitPatch = membershipInitPatchMap.get(id) ?? {};
          batch.update(doc(db, COLLECTIONS.MEMBERS, id), { ...perMemberNormalized, ...typePatch, ...membershipInitPatch, updatedAt: now });
        });
        await this.commitWithRetry(batch);
      }
      this.invalidateMembersCache();

      // Sync display side effects when any display-affecting field is updated (N1 fix).
      // Mirrors updateMember behaviour. Fires concurrently; failures are silent.
      const DISPLAY_FIELDS = new Set(['name','email','avatar','avatarUrl','companyName','general','business','contact']);
      if (Object.keys(normalized).some(k => DISPLAY_FIELDS.has(k))) {
        const { BusinessDirectoryService } = await import('./businessDirectoryService');
        await Promise.allSettled(
          memberIds.map(id =>
            Promise.allSettled([
              BusinessDirectoryService.syncPublicListing(id, { ...normalized, id }),
              this.syncBoardMemberDisplayFields(id, { ...normalized, id } as Member),
            ])
          )
        );
      }

      // Recalculate introducer stats for all affected old + new introducers (M2 fix).
      // Mirrors updateMember behaviour. Fires concurrently; failures are silent.
      if (introducerChanging) {
        const newIntroducer = normalized.introducer as string | undefined;
        const affectedIntroducers = new Set<string>();
        oldIntroducerMap.forEach(oldId => { if (oldId) affectedIntroducers.add(oldId); });
        if (newIntroducer) affectedIntroducers.add(newIntroducer);
        await Promise.allSettled(
          [...affectedIntroducers].map(id => this.recalculateIntroducerStats(id))
        );
      }
    } catch (error) {
      errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'MembersService.batchUpdateMembers' });
      throw error;
    }
  }

  /** Batch delete members — uses writeBatch for atomicity (E02) */
  static async batchDeleteMembers(memberIds: string[]): Promise<void> {
    if (isDevMode()) {
      memberIds.forEach(id => {
        const idx = MOCK_MEMBERS.findIndex(m => m.id === id);
        if (idx !== -1) MOCK_MEMBERS.splice(idx, 1);
      });
      return;
    }
    try {
      // Verify caller is ADMIN before building the batch
      const currentUid = auth?.currentUser?.uid;
      if (!currentUid) {
        const e: any = new Error('User not authenticated'); e.code = 'permission-denied'; throw e;
      }
      const callerDoc = await getDoc(doc(db, COLLECTIONS.MEMBERS, currentUid));
      if (!callerDoc.exists() || !['ADMIN', 'SUPER_ADMIN'].includes(getMemberRole(callerDoc.data()) ?? '')) {
        const e: any = new Error('User lacks ADMIN / SUPER_ADMIN role for deletion'); e.code = 'permission-denied'; throw e;
      }

      // Fetch all target docs in chunks of 30 to avoid excessive concurrent Firestore connections.
      const CHUNK = 30;
      const targetDocs: DocumentSnapshot[] = [];
      for (let c = 0; c < memberIds.length; c += CHUNK) {
        const chunkSnaps = await Promise.all(
          memberIds.slice(c, c + CHUNK).map(id => getDoc(doc(db, COLLECTIONS.MEMBERS, id)))
        );
        targetDocs.push(...chunkSnaps);
      }

      // Group menteeIds to remove per mentor (skip mentors who are also being deleted)
      const mentorCleanup = new Map<string, string[]>();
      const deletingSet = new Set(memberIds);
      targetDocs.forEach((d, i) => {
        if (!d.exists()) return;
        const mentorId = (d.data() as Omit<Member, 'id'>).mentorId;
        if (mentorId && !deletingSet.has(mentorId)) {
          if (!mentorCleanup.has(mentorId)) mentorCleanup.set(mentorId, []);
          mentorCleanup.get(mentorId)!.push(memberIds[i]);
        }
      });

      const now = Timestamp.now();

      // Build all write ops (soft-deletes + menteeIds cleanup) into a single list so they
      // are committed in the same batch chunks — if any chunk fails the retry covers both
      // sides together, preventing members from being deleted while their mentors still list them.
      type UpdateOp = { id: string; data: Record<string, unknown> };
      const allOps: UpdateOp[] = [
        ...memberIds.map(id => ({
          id,
          data: { role: 'INACTIVE', deletedAt: now, deletedBy: currentUid, updatedAt: now } as Record<string, unknown>,
        })),
        ...[...mentorCleanup.entries()].map(([mentorId, ids]) => ({
          id: mentorId,
          data: { menteeIds: arrayRemove(...ids), updatedAt: now } as Record<string, unknown>,
        })),
      ];

      for (let i = 0; i < allOps.length; i += 400) {
        const batch = writeBatch(db);
        allOps.slice(i, i + 400).forEach(({ id, data }) => {
          batch.update(doc(db, COLLECTIONS.MEMBERS, id), data);
        });
        await this.commitWithRetry(batch);
      }

      // FIX: Release memberEmails uniqueness slots so emails can be re-registered.
      // Mirror the logic in single deleteMember: contact.email → email → sanitize → batch.delete.
      const memberEmailsToRelease: string[] = [];
      targetDocs.forEach(d => {
        if (!d.exists()) return;
        const data = d.data() as any;
        const rawEmail: string | undefined = data?.contact?.email || data?.email;
        if (rawEmail) {
          memberEmailsToRelease.push(rawEmail.toLowerCase().replace(/[^a-z0-9@.]/g, '_'));
        }
      });
      if (memberEmailsToRelease.length > 0) {
        for (let i = 0; i < memberEmailsToRelease.length; i += 400) {
          const emailBatch = writeBatch(db);
          memberEmailsToRelease.slice(i, i + 400).forEach(sanitizedEmail => {
            emailBatch.delete(doc(db, 'memberEmails', sanitizedEmail));
          });
          await this.commitWithRetry(emailBatch);
        }
      }

      // Clean up boardMembers and businessDirectory for all deleted members (E-01)
      const [boardSnaps, bizSnaps] = await Promise.all([
        getDocs(query(collection(db, COLLECTIONS.BOARD_MEMBERS), where('memberId', 'in', memberIds.slice(0, 30)))),
        getDocs(query(collection(db, COLLECTIONS.PUBLIC_BUSINESS_LISTINGS), where('memberId', 'in', memberIds.slice(0, 30)))),
      ]);
      // Handle batches > 30 (Firestore 'in' limit is 30)
      const extraBoardSnaps = memberIds.length > 30
        ? await Promise.all(
            Array.from({ length: Math.ceil((memberIds.length - 30) / 30) }, (_, i) =>
              getDocs(query(collection(db, COLLECTIONS.BOARD_MEMBERS), where('memberId', 'in', memberIds.slice(30 + i * 30, 60 + i * 30))))
            )
          )
        : [];
      const extraBizSnaps = memberIds.length > 30
        ? await Promise.all(
            Array.from({ length: Math.ceil((memberIds.length - 30) / 30) }, (_, i) =>
              getDocs(query(collection(db, COLLECTIONS.PUBLIC_BUSINESS_LISTINGS), where('memberId', 'in', memberIds.slice(30 + i * 30, 60 + i * 30))))
            )
          )
        : [];
      const allBoardDocs = [...boardSnaps.docs, ...extraBoardSnaps.flatMap(s => s.docs)];
      const allBizDocs = [...bizSnaps.docs, ...extraBizSnaps.flatMap(s => s.docs)];
      if (allBoardDocs.length > 0 || allBizDocs.length > 0) {
        const sideCleanupOps = [...allBoardDocs, ...allBizDocs];
        for (let i = 0; i < sideCleanupOps.length; i += 400) {
          const cleanBatch = writeBatch(db);
          sideCleanupOps.slice(i, i + 400).forEach(d => cleanBatch.delete(d.ref));
          await this.commitWithRetry(cleanBatch);
        }
      }

      // Cascade: soft-cancel eventRegistrations and open paymentRequests, and delete notifications
      // for all deleted members. Mirrors deleteMember's cascadeBatch logic (variant symmetry fix).
      // Firestore 'in' operator supports up to 30 values; chunk accordingly.
      const chunkSize = 30;
      const allRegDocs: any[] = [];
      const allPrDocs: any[] = [];
      const allNotifDocs: any[] = [];
      for (let i = 0; i < memberIds.length; i += chunkSize) {
        const chunk = memberIds.slice(i, i + chunkSize);
        const [chunkRegs, chunkPrs, chunkNotifs] = await Promise.all([
          getDocs(query(collection(db, COLLECTIONS.EVENT_REGISTRATIONS), where('memberId', 'in', chunk))),
          getDocs(query(collection(db, COLLECTIONS.PAYMENT_REQUESTS), where('memberId', 'in', chunk), where('status', 'in', ['pending', 'submitted', 'approved']))),
          getDocs(query(collection(db, COLLECTIONS.NOTIFICATIONS), where('memberId', 'in', chunk))),
        ]);
        allRegDocs.push(...chunkRegs.docs);
        allPrDocs.push(...chunkPrs.docs);
        allNotifDocs.push(...chunkNotifs.docs);
      }
      if (allRegDocs.length > 0 || allPrDocs.length > 0 || allNotifDocs.length > 0) {
        type CascadeOp = { ref: ReturnType<typeof doc>; data: Record<string, unknown>; op: 'update' | 'delete' };
        const cascadeOps: CascadeOp[] = [
          ...allRegDocs.map((d: any) => ({ ref: d.ref, data: { status: 'cancelled', updatedAt: now }, op: 'update' as const })),
          ...allPrDocs.map((d: any) => ({ ref: d.ref, data: { status: 'memberDeleted', updatedAt: now }, op: 'update' as const })),
          ...allNotifDocs.map((d: any) => ({ ref: d.ref, data: {}, op: 'delete' as const })),
        ];
        for (let i = 0; i < cascadeOps.length; i += 400) {
          const cascadeBatch = writeBatch(db);
          cascadeOps.slice(i, i + 400).forEach(({ ref, data, op }) => {
            if (op === 'delete') { cascadeBatch.delete(ref); }
            else { cascadeBatch.update(ref, data); }
          });
          await this.commitWithRetry(cascadeBatch);
        }
      }

      logDelete(CACHE_KEY_ALL_MEMBERS, 'membersService.batchDeleteMembers');
      this.invalidateMembersCache();
    } catch (error) {
      errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { context: 'MembersService.batchDeleteMembers' });
      throw error;
    }
  }

  /** Earliest year key on member.membership (e.g. "2024"). */
  static getFirstMembershipYearKey(
    membership?: Record<string, MembershipRecord> | null
  ): string | null {
    if (!membership || typeof membership !== 'object') return null;

    const years = Object.keys(membership)
      .map((key) => Number.parseInt(key, 10))
      .filter((year) => Number.isInteger(year) && year >= 1900 && year <= 2200)
      .sort((a, b) => a - b);

    return years.length > 0 ? String(years[0]) : null;
  }

  static statusFromMembershipAmount(amount: number, dues: number): MembershipStatus {
    if (!amount) return 'pending';
    if (amount === dues) return 'paid';
    if (amount > dues) return 'over paid';
    return 'partial';
  }

  /**
   * Set dues on each member's first membership year to RM350 and recalculate status from paid amount.
   *
   * SYNC-004 NOTE: This method intentionally bypasses financeService.syncMemberMembership.
   * It replicates the same status-from-amount formula locally for bulk efficiency (calling
   * syncMemberMembership per member would trigger N×Firestore query fans and risk a circular
   * import). Acceptable here because this is an admin correction tool, not a payment flow.
   * If the status formula in syncMemberMembership changes, update statusFromMembershipAmount here too.
   * TODO (SYNC-004): Consider extracting the shared status formula into a pure utility function
   * in membershipConfig.ts so both paths stay in sync automatically.
   */
  static async fixFirstMembershipDuesTo350(loIdFilter?: string | null): Promise<{
    scanned: number;
    updated: number;
    skippedNoMembership: number;
    alreadyCorrect: number;
    errors: string[];
  }> {
    const result = {
      scanned: 0,
      updated: 0,
      skippedNoMembership: 0,
      alreadyCorrect: 0,
      errors: [] as string[],
    };

    if (isDevMode()) {
      for (const member of MOCK_MEMBERS) {
        result.scanned += 1;
        const membership = { ...(member.membership || {}) } as Record<string, MembershipRecord>;
        const firstYear = this.getFirstMembershipYearKey(membership);
        if (!firstYear) {
          result.skippedNoMembership += 1;
          continue;
        }
        const firstRecord = membership[firstYear] || ({} as MembershipRecord);
        const amount = Number(firstRecord.amount || 0);
        const nextStatus = this.statusFromMembershipAmount(amount, FIRST_MEMBERSHIP_DUES_TARGET);
        if (firstRecord.dues === FIRST_MEMBERSHIP_DUES_TARGET && firstRecord.status === nextStatus) {
          result.alreadyCorrect += 1;
          continue;
        }
        membership[firstYear] = {
          ...firstRecord,
          year: Number.parseInt(firstYear, 10),
          dues: FIRST_MEMBERSHIP_DUES_TARGET,
          status: nextStatus,
        };
        member.membership = membership;
        result.updated += 1;
      }
      return result;
    }

    const members = await this.getAllMembers(loIdFilter);
    let batch = writeBatch(db);
    let batchOps = 0;

    const flushBatch = async () => {
      if (batchOps === 0) return;
      await batch.commit();
      batch = writeBatch(db);
      batchOps = 0;
    };

    for (const member of members) {
      result.scanned += 1;

      try {
        const membership = { ...(member.membership || {}) } as Record<string, MembershipRecord>;
        const firstYear = this.getFirstMembershipYearKey(membership);

        if (!firstYear) {
          result.skippedNoMembership += 1;
          continue;
        }

        const firstRecord = membership[firstYear] || ({} as MembershipRecord);
        const amount = Number(firstRecord.amount || 0);
        const nextStatus = this.statusFromMembershipAmount(amount, FIRST_MEMBERSHIP_DUES_TARGET);

        if (firstRecord.dues === FIRST_MEMBERSHIP_DUES_TARGET && firstRecord.status === nextStatus) {
          result.alreadyCorrect += 1;
          continue;
        }

        membership[firstYear] = {
          ...firstRecord,
          year: Number.parseInt(firstYear, 10),
          dues: FIRST_MEMBERSHIP_DUES_TARGET,
          status: nextStatus,
        };

        batch.update(doc(db, COLLECTIONS.MEMBERS, member.id), {
          membership,
          updatedAt: Timestamp.now(),
        });
        batchOps += 1;
        result.updated += 1;

        if (batchOps >= 400) {
          await flushBatch();
        }
      } catch (err) {
        result.errors.push(
          `${member.id}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    await flushBatch();
    this.invalidateMembersCache();
    return result;
  }

  /**
   * Effective membership start year (calendar Oct rollover or first payment year).
   */
  static getEffectiveJoinYear(
    member: Pick<Member, 'id' | 'joinDate'>,
    calculationMode: 'calendar' | 'payment_date',
    membershipTransactions?: Pick<Transaction, 'memberId' | 'category' | 'date'>[]
  ): number {
    if (calculationMode === 'payment_date' && membershipTransactions?.length) {
      const memberTxs = membershipTransactions.filter(
        (tx) => tx.memberId === member.id && tx.category === 'Membership'
      );
      if (memberTxs.length > 0) {
        const sorted = [...memberTxs].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        return new Date(sorted[0].date).getFullYear();
      }
    }

    if (!member.joinDate) return new Date().getFullYear();
    const date = new Date(member.joinDate);
    const calendarYear = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    if (month > 9 || (month === 9 && day >= 1)) {
      return calendarYear + 1;
    }
    return calendarYear;
  }

  /**
   * Infer membershipType from role, senatorship, and membership[year].dues (Config rules).
   */
  static inferMembershipType(
    member: Member,
    _year: number,
    rules: Record<MembershipType, MembershipRuleConfig>
  ): MembershipType {
    return computeMembershipTypeFromMember(
      {
        nationality: member.nationality,
        dateOfBirth: member.dateOfBirth,
        senatorCertified: member.senatorCertified,
        senatorshipId: member.senatorshipId,
        senatorshipBoardValidated: member.senatorshipBoardValidated,
        role: member.role,
        membershipType: member.membershipType,
      },
      rules
    );
  }

  /**
   * Batch-sync members.membershipType from membership dues + role + Config.
   * Does not modify members.membership.
   */
  static async batchSyncMembershipTypes(options: {
    year: number;
    loIdFilter?: string | null;
  }): Promise<{
    year: number;
    scanned: number;
    updated: number;
    alreadyCorrect: number;
    errors: string[];
  }> {
    const { year, loIdFilter } = options;
    const result = {
      year,
      scanned: 0,
      updated: 0,
      alreadyCorrect: 0,
      errors: [] as string[],
    };

    const { rules } = await MembershipConfigService.getConfig();

    const applyType = (member: Member): MembershipType | null => {
      const nextType = this.inferMembershipType(member, year, rules);
      const current = (member.membershipType || 'Probation') as MembershipType;
      if (nextType === current) {
        result.alreadyCorrect += 1;
        return null;
      }
      member.membershipType = nextType;
      result.updated += 1;
      return nextType;
    };

    if (isDevMode()) {
      for (const member of MOCK_MEMBERS) {
        result.scanned += 1;
        try {
          applyType(member as Member);
        } catch (err) {
          result.errors.push(
            `${member.id}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
      return result;
    }

    const members = await this.getAllMembers(loIdFilter);
    let batch = writeBatch(db);
    let batchOps = 0;
    // Track which member IDs are in the current pending batch for error attribution
    let batchIds: string[] = [];

    const flushBatch = async () => {
      if (batchOps === 0) return;
      const idsInBatch = batchIds;
      try {
        await this.commitWithRetry(batch);
      } catch (err) {
        idsInBatch.forEach(id =>
          result.errors.push(`${id}: ${err instanceof Error ? err.message : String(err)}`)
        );
        result.updated -= idsInBatch.length;
      }
      batch = writeBatch(db);
      batchOps = 0;
      batchIds = [];
    };

    for (const member of members) {
      result.scanned += 1;
      try {
        const memberWorking = { ...member } as Member;
        const nextType = applyType(memberWorking);
        if (!nextType) continue;

        // Also sync role so membershipType and role never diverge (E4 fix)
        const nextRole = roleForMembershipType(nextType, memberWorking.role as UserRole);
        const roleChanged = nextRole !== (memberWorking.role as UserRole);
        batch.update(doc(db, COLLECTIONS.MEMBERS, member.id), {
          membershipType: nextType,
          ...(roleChanged ? { role: nextRole } : {}),
          updatedAt: Timestamp.now(),
        });
        batchIds.push(member.id);
        batchOps += 1;

        if (batchOps >= 400) {
          await flushBatch();
        }
      } catch (err) {
        result.errors.push(
          `${member.id}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    await flushBatch();
    this.invalidateMembersCache();
    return result;
  }

  /**
   * Batch-sync members.membership[year] from each member's membershipType + Membership Config.
   * Recalculates status from existing paid amount. Does not change membershipType.
   *
   * SYNC-004 NOTE: Intentionally bypasses financeService.syncMemberMembership for the same
   * reasons as fixFirstMembershipDuesTo350 (bulk performance, circular import). Status is
   * computed inline via statusFromMembershipAmount. If syncMemberMembership's status formula
   * changes, this method must be updated in sync.
   * TODO (SYNC-004): Extract shared status formula into membershipConfig.ts utility.
   */
  static async batchSyncMembershipRecords(options: {
    year: number;
    /** When set, sync all years from each member's effectiveJoinYear up to toYear (inclusive). `year` is ignored. */
    toYear?: number;
    loIdFilter?: string | null;
    membershipTransactions?: Pick<Transaction, 'memberId' | 'category' | 'date'>[];
    /** When true, only members who already have membership[year] */
    onlyExistingRecords?: boolean;
  }): Promise<{
    year: number;
    scanned: number;
    updated: number;
    created: number;
    skippedNotEligible: number;
    skippedNoRecord: number;
    alreadyCorrect: number;
    errors: string[];
  }> {
    const {
      year,
      toYear,
      loIdFilter,
      membershipTransactions,
      onlyExistingRecords = false,
    } = options;

    const effectiveToYear = toYear ?? year;

    const result = {
      year: effectiveToYear,
      scanned: 0,
      updated: 0,
      created: 0,
      skippedNotEligible: 0,
      skippedNoRecord: 0,
      alreadyCorrect: 0,
      errors: [] as string[],
    };

    const config = await MembershipConfigService.getConfig();
    const { rules, calculationMode } = config;

    const applyToMember = (member: Member): boolean => {
      const membershipType = (member.membershipType || 'Probation') as MembershipType;
      const effectiveJoinYear = this.getEffectiveJoinYear(
        member,
        calculationMode,
        membershipTransactions
      );

      const membership = { ...(member.membership || {}) } as Record<string, MembershipRecord>;
      let anyChange = false;

      if (toYear !== undefined) {
        // Multi-year mode: loop from member's own join year to toYear
        if (effectiveJoinYear > effectiveToYear) {
          result.skippedNotEligible += 1;
          return false;
        }
        for (let y = effectiveJoinYear; y <= effectiveToYear; y++) {
          const yStr = String(y);
          const existing = membership[yStr];
          if (onlyExistingRecords && !existing) {
            result.skippedNoRecord += 1;
            continue;
          }
          const isFirstYear = effectiveJoinYear === y;
          const targetDues = getTargetDuesForMembershipType(membershipType, isFirstYear, rules);
          const amount = Number(existing?.amount || 0);
          const nextStatus = this.statusFromMembershipAmount(amount, targetDues);
          if (existing && existing.dues === targetDues && existing.status === nextStatus) {
            result.alreadyCorrect += 1;
            continue;
          }
          const hadRecord = Boolean(existing);
          membership[yStr] = {
            ...(existing || {}),
            year: y,
            dues: targetDues,
            amount,
            status: nextStatus,
            transactionId: existing?.transactionId || [],
            ...(existing?.purpose !== undefined ? { purpose: existing.purpose } : {}),
            ...(existing?.paymentDate !== undefined ? { paymentDate: existing.paymentDate } : {}),
          };
          if (hadRecord) { result.updated += 1; } else { result.created += 1; }
          anyChange = true;
        }
      } else {
        // Single-year mode (original behavior)
        const yearStr = String(year);
        if (effectiveJoinYear > year) {
          result.skippedNotEligible += 1;
          return false;
        }
        const existing = membership[yearStr];
        if (onlyExistingRecords && !existing) {
          result.skippedNoRecord += 1;
          return false;
        }
        const isFirstYear = effectiveJoinYear === year;
        const targetDues = getTargetDuesForMembershipType(membershipType, isFirstYear, rules);
        const amount = Number(existing?.amount || 0);
        const nextStatus = this.statusFromMembershipAmount(amount, targetDues);
        if (existing && existing.dues === targetDues && existing.status === nextStatus) {
          result.alreadyCorrect += 1;
          return false;
        }
        const hadRecord = Boolean(existing);
        membership[yearStr] = {
          ...(existing || {}),
          year,
          dues: targetDues,
          amount,
          status: nextStatus,
          transactionId: existing?.transactionId || [],
          ...(existing?.purpose !== undefined ? { purpose: existing.purpose } : {}),
          ...(existing?.paymentDate !== undefined ? { paymentDate: existing.paymentDate } : {}),
        };
        if (hadRecord) { result.updated += 1; } else { result.created += 1; }
        anyChange = true;
      }

      if (anyChange) member.membership = membership;
      return anyChange;
    };

    if (isDevMode()) {
      for (const member of MOCK_MEMBERS) {
        result.scanned += 1;
        try {
          applyToMember(member as Member);
        } catch (err) {
          result.errors.push(
            `${member.id}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
      return result;
    }

    const members = await this.getAllMembers(loIdFilter);
    let batch = writeBatch(db);
    let batchOps = 0;
    let batchIds: string[] = [];

    const flushBatch = async () => {
      if (batchOps === 0) return;
      const idsInBatch = batchIds;
      try {
        await this.commitWithRetry(batch);
      } catch (err) {
        idsInBatch.forEach(id =>
          result.errors.push(`${id}: ${err instanceof Error ? err.message : String(err)}`)
        );
        // Roll back the optimistic counters for members in this failed batch
        result.updated -= idsInBatch.filter(id => members.find(m => m.id === id)?.membership).length;
        result.created -= idsInBatch.filter(id => !members.find(m => m.id === id)?.membership).length;
      }
      batch = writeBatch(db);
      batchOps = 0;
      batchIds = [];
    };

    for (const member of members) {
      result.scanned += 1;
      try {
        const membership = { ...(member.membership || {}) } as Record<string, MembershipRecord>;
        const memberWorking = { ...member, membership } as Member;
        if (!applyToMember(memberWorking)) continue;

        batch.update(doc(db, COLLECTIONS.MEMBERS, member.id), {
          membership: memberWorking.membership,
          updatedAt: Timestamp.now(),
        });
        batchIds.push(member.id);
        batchOps += 1;

        if (batchOps >= 400) {
          await flushBatch();
        }
      } catch (err) {
        result.errors.push(
          `${member.id}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    await flushBatch();
    this.invalidateMembersCache();
    return result;
  }

  /** @deprecated Use batchSyncMembershipRecords */
  static async syncMembershipFromMembershipType(
    options: Parameters<typeof MembersService.batchSyncMembershipRecords>[0]
  ) {
    return MembersService.batchSyncMembershipRecords(options);
  }

  /** TEMP MIGRATION: membershipType 'Full' → 'Official' */
  static async migrateMembershipTypeFullToOfficial(): Promise<{ scanned: number; updated: number; errors: string[] }> {
    const result = { scanned: 0, updated: 0, errors: [] as string[] };
    if (isDevMode()) return result;

    const members = await this.getAllMembers();
    let batch = writeBatch(db);
    let batchOps = 0;

    for (const member of members) {
      result.scanned++;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((member as any).membershipType !== 'Full') continue;
      try {
        batch.update(doc(db, COLLECTIONS.MEMBERS, member.id), {
          membershipType: 'Official',
          updatedAt: Timestamp.now(),
        });
        batchOps++;
        result.updated++;
        if (batchOps >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          batchOps = 0;
        }
      } catch (err) {
        result.errors.push(`${member.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (batchOps > 0) await batch.commit();
    this.invalidateMembersCache();
    return result;
  }

  /** TEMP MIGRATION: copy root-level dateOfBirth/dob into general.dob for members missing it */
  static async migrateDobToGeneralDob(): Promise<{ scanned: number; updated: number; errors: string[] }> {
    const result = { scanned: 0, updated: 0, errors: [] as string[] };
    if (isDevMode()) return result;

    const members = await this.getAllMembers();
    let batch = writeBatch(db);
    let batchOps = 0;

    for (const member of members) {
      result.scanned++;
      const generalDob = member.general?.dob;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = member as any;
      const flatDob: string | undefined = raw.dateOfBirth || raw.dob;
      if (generalDob || !flatDob) continue;
      try {
        batch.update(doc(db, COLLECTIONS.MEMBERS, member.id), {
          'general.dob': flatDob,
          updatedAt: Timestamp.now(),
        });
        batchOps++;
        result.updated++;
        if (batchOps >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          batchOps = 0;
        }
      } catch (err) {
        result.errors.push(`${member.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (batchOps > 0) await batch.commit();
    this.invalidateMembersCache();
    return result;
  }

  /**
   * Cursor-based paginated member fetch (ordered by name).
   * Pass `lastDoc` from the previous page's result to advance the cursor.
   * Falls back to a mock slice in dev mode.
   */
  static async getMembersPaginated(
    pageSize: number = 50,
    lastDoc?: DocumentSnapshot
  ): Promise<{ members: Member[]; lastDoc: DocumentSnapshot | null; hasMore: boolean }> {
    if (isDevMode()) {
      const slice = MOCK_MEMBERS.slice(0, pageSize);
      return { members: slice, lastDoc: null, hasMore: false };
    }

    let q = query(
      collection(db, COLLECTIONS.MEMBERS),
      orderBy('name'),
      limit(pageSize)
    );
    if (lastDoc) {
      q = query(
        collection(db, COLLECTIONS.MEMBERS),
        orderBy('name'),
        startAfter(lastDoc),
        limit(pageSize)
      );
    }
    const snapshot = await getDocs(q);
    const members = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as object) } as Member));
    return {
      members,
      lastDoc: snapshot.docs[snapshot.docs.length - 1] ?? null,
      hasMore: snapshot.docs.length === pageSize,
    };
  }
}

