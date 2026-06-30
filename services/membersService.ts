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
  Timestamp,
  writeBatch,
  deleteField,
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';
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
import { MOCK_MEMBERS } from './mockData';
import {
  MembershipConfigService,
  getTargetDuesForMembershipType,
  resolveMembershipTypeFromDues,
  computeMembershipTypeFromMember,
} from './membershipConfigService';

const FIRST_MEMBERSHIP_DUES_TARGET = 350;

export class MembersService {
  /** Recompute membershipType from profile + promotion (Full); always persisted on save. */
  static async syncComputedMembershipType(
    data: Partial<Member>,
    existing?: Member | null
  ): Promise<Partial<Member>> {
    const merged = { ...(existing || {}), ...data } as Member;
    const rules = await MembershipConfigService.getRules();
    const computed = computeMembershipTypeFromMember(
      {
        nationality: merged.nationality,
        dateOfBirth: merged.dateOfBirth,
        senatorCertified: merged.senatorCertified,
        senatorshipId: merged.senatorshipId,
        senatorshipBoardValidated: merged.senatorshipBoardValidated,
        role: merged.role,
        membershipType: merged.membershipType,
      },
      rules
    );
    if (merged.membershipType === computed && !('membershipType' in data)) return data;
    return { ...data, membershipType: computed };
  }
  /** Get all members, optionally filtered by loId (for multi-LO). */
  static async getAllMembers(loIdFilter?: string | null): Promise<Member[]> {
    try {
      let q;
      if (loIdFilter != null && loIdFilter !== '') {
        q = query(
          collection(db, COLLECTIONS.MEMBERS),
          where('loId', '==', loIdFilter),
          orderBy('updatedAt', 'desc')
        );
      } else {
        q = query(collection(db, COLLECTIONS.MEMBERS));
      }
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(d => ({ ...(d.data() as any), id: d.id } as Member));

      if (docs.length === 0 && isDevMode()) {
        const list = loIdFilter
          ? MOCK_MEMBERS.filter((m: Member) => (m as any).loId === loIdFilter || !(m as any).loId)
          : MOCK_MEMBERS;
        return list;
      }
      return docs;
    } catch (error) {
      if (isDevMode()) {
        const list = loIdFilter
          ? MOCK_MEMBERS.filter((m: Member) => (m as any).loId === loIdFilter || !(m as any).loId)
          : MOCK_MEMBERS;
        return list;
      }
      console.error('Error fetching members:', error);
      throw error;
    }
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
      console.error('Error fetching member:', error);
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
      console.error('Error recalculating introducer stats:', e);
    }
  }

  /** Helper to map flat properties to standard nested sub-objects (general, contact, etc.) for database consistency. */
  static normalizeMemberData(data: Record<string, any>, existing?: Member | null): Record<string, any> {
    const result = { ...data };

    // 1. General
    const general = {
      ...(existing?.general || {}),
    } as any;
    if (data.name !== undefined) general.name = data.name;
    if (data.fullName !== undefined) general.fullName = data.fullName;
    if (data.chineseName !== undefined) general.chineseName = data.chineseName;
    else if (data.chiName !== undefined) general.chineseName = data.chiName;
    if (data.idNumber !== undefined) general.idNumber = data.idNumber;
    else if (data.nationalId !== undefined) general.idNumber = data.nationalId;
    if (data.dateOfBirth !== undefined) general.dob = data.dateOfBirth;
    else if (data.dob !== undefined) general.dob = data.dob;
    if (data.gender !== undefined) general.gender = data.gender;
    if (data.race !== undefined) general.race = data.race;
    else if (data.ethnicity !== undefined) general.race = data.ethnicity;
    if (data.nationality !== undefined) general.nationality = data.nationality;
    if (data.avatarUrl !== undefined) general.avatarUrl = data.avatarUrl;
    else if (data.avatar !== undefined) general.avatarUrl = data.avatar;

    if (Object.keys(general).length > 0 || existing?.general) {
      result.general = general;
    }

    // 2. Contact
    const contact = {
      ...(existing?.contact || {}),
      socials: { ...(existing?.contact?.socials || {}) },
      emergency: { ...(existing?.contact?.emergency || {}) }
    } as any;
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
    const others = {
      ...(existing?.others || {}),
    } as any;
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
    const business = {
      ...(existing?.business || {}),
    } as any;
    if (data.companyName !== undefined) business.companyName = data.companyName;
    if (data.companyWebsite !== undefined) business.companyWebsite = data.companyWebsite;
    if (data.companyLogoUrl !== undefined) business.companyLogoUrl = data.companyLogoUrl;
    if (data.introduction !== undefined) business.introduction = data.introduction;
    else if (data.companyDescription !== undefined) business.introduction = data.companyDescription;
    if (data.title !== undefined) business.title = data.title;
    else if (data.position !== undefined) business.title = data.position;
    else if (data.departmentAndPosition !== undefined) business.title = data.departmentAndPosition;
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

    if (Object.keys(business).length > 0 || existing?.business) {
      result.business = business;
    }

    // 5. JCI Career
    const jciCareer = {
      ...(existing?.jciCareer || {}),
      senatorship: { ...(existing?.jciCareer?.senatorship || {}) }
    } as any;
    if (data.membershipType !== undefined) jciCareer.membershipType = data.membershipType;
    if (data.membershipStatus !== undefined) jciCareer.membershipStatus = data.membershipStatus;
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
    if (data.attendanceRate !== undefined) jciCareer.attendanceRate = data.attendanceRate;
    if (data.badgesCount !== undefined) jciCareer.badgesCount = data.badgesCount;
    if (data.projectsCount !== undefined) jciCareer.projectsCount = data.projectsCount;
    if (data.trainingsCount !== undefined) jciCareer.trainingsCount = data.trainingsCount;

    if (data.probationTasks !== undefined) jciCareer.probationTasks = data.probationTasks;
    if (data.promotionProgress !== undefined) jciCareer.promotionProgress = data.promotionProgress;
    if (data.isDuesPaidCurrentYear !== undefined) jciCareer.isDuesPaidCurrentYear = data.isDuesPaidCurrentYear;

    if (Object.keys(jciCareer.senatorship).length === 0 && !existing?.jciCareer?.senatorship) delete jciCareer.senatorship;
    if (Object.keys(jciCareer).length > 0 || existing?.jciCareer) {
      result.jciCareer = jciCareer;
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

      const docRef = await addDoc(collection(db, COLLECTIONS.MEMBERS), normalizedData);
      
      if (cleanMemberData.introducer) {
        this.recalculateIntroducerStats(cleanMemberData.introducer).catch(console.error);
      }

      return docRef.id;
    } catch (error) {
      console.error('Error creating member:', error);
      throw error;
    }
  }

  /** Update member. Sets updatedAt and optionally updatedBy (audit). */
  static async updateMember(memberId: string, updates: Partial<Member>, updatedBy?: string): Promise<void> {
    try {
      const memberRef = doc(db, COLLECTIONS.MEMBERS, memberId);
      const currentSnap = await getDoc(memberRef);
      const currentData = currentSnap.exists()
        ? ({ ...currentSnap.data(), id: memberId } as Member)
        : null;

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

      // Check for GUEST -> PROBATION transition to initialize membership record (if not already handled by caller)
      if (updates.role === UserRole.PROBATION && !updates.membership) {
        if (currentData) {
          // If moving from GUEST (or no role) to PROBATION
          if (currentData.role === UserRole.GUEST || !currentData.role) {
            const joinDate = updates.joinDate || currentData.joinDate;
            const yearStr = joinDate ? String(new Date(joinDate).getFullYear()) : String(new Date().getFullYear());
            
            const membership = currentData.membership || {};
            if (!membership[yearStr]) {
              membership[yearStr] = {
                year: parseInt(yearStr),
                dues: MembershipDues.Probation, // 350
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

      await updateDoc(memberRef, normalizedUpdates);

      // Trigger introducer recalculation if introducer changes
      if (cleanUpdates.introducer !== undefined && (!currentData || cleanUpdates.introducer !== currentData.introducer)) {
        if (currentData?.introducer) {
          this.recalculateIntroducerStats(currentData.introducer).catch(console.error);
        }
        if (cleanUpdates.introducer) {
          this.recalculateIntroducerStats(cleanUpdates.introducer).catch(console.error);
        }
      }
    } catch (error) {
      console.error('Error updating member:', error);
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

    const memberRef = doc(db, COLLECTIONS.MEMBERS, memberId);
    await updateDoc(memberRef, {
      senatorshipBoardValidated: false,
      senatorCertified: false,
      senatorshipValidatedAt: deleteField(),
      senatorshipValidatedBy: deleteField(),
      updatedAt: Timestamp.now(),
      ...(revokedBy ? { updatedBy: revokedBy } : {}),
    });
    const refreshed = await this.getMemberById(memberId);
    if (refreshed) {
      const typePatch = await this.syncComputedMembershipType({}, refreshed);
      if (typePatch.membershipType) {
        await updateDoc(memberRef, {
          membershipType: typePatch.membershipType,
          updatedAt: Timestamp.now(),
        });
      }
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
      const currentRole = currentMemberDoc.exists() ? (currentMemberDoc.data() as any).role : null;
      const myLoId = currentMemberDoc.exists() ? (currentMemberDoc.data() as any).loId ?? null : null;
      if (currentRole !== 'ADMIN') {
        const e: any = new Error('User lacks ADMIN role for deletion');
        e.code = 'permission-denied';
        console.warn(`Delete blocked: user ${currentUid} with role=${currentRole} attempted to delete member ${memberId}`);
        throw e;
      }

      // Read target member doc to enforce LO-level delete rule (matches Firestore rules)
      const targetDoc = await getDoc(doc(db, COLLECTIONS.MEMBERS, memberId));
      const targetLoId = targetDoc.exists() ? (targetDoc.data() as any).loId ?? null : null;

      // Firestore rule requires (resource == null || resourceInMyLo(resource.data)).
      // If target has an loId and current admin has a different loId, deny client-side to avoid permission error.
      if (targetLoId != null && myLoId != null && targetLoId !== myLoId) {
        const e: any = new Error('Cannot delete member from a different LO');
        e.code = 'permission-denied';
        console.warn(`Delete blocked by LO mismatch: user ${currentUid} lo=${myLoId} target ${memberId} lo=${targetLoId}`);
        throw e;
      }

      await deleteDoc(doc(db, COLLECTIONS.MEMBERS, memberId));
    } catch (error) {
      console.error('Error deleting member:', error, 'memberId=', memberId);
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
        member.name.toLowerCase().includes(term) ||
        member.email.toLowerCase().includes(term) ||
        member.skills.some(skill => skill.toLowerCase().includes(term))
      );
    } catch (error) {
      console.error('Error searching members:', error);
      throw error;
    }
  }

  // Get members by role
  static async getMembersByRole(role: UserRole): Promise<Member[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.MEMBERS),
        where('role', '==', role)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        ...(doc.data() as any),
        id: doc.id,
      } as Member));
    } catch (error) {
      console.error('Error fetching members by role:', error);
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
      if (snapshot.empty) return null;

      // Return the first match
      const doc = snapshot.docs[0];
      return { ...(doc.data() as any), id: doc.id } as Member;
    } catch (error) {
      console.error('Error fetching member by email:', error);
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
        ...(doc.data() as any),
        id: doc.id,
      } as Member));
    } catch (error) {
      console.error('Error fetching members at risk:', error);
      throw error;
    }
  }

  // Update member role (for Board transitions)
  static async updateMemberRole(memberId: string, newRole: UserRole): Promise<void> {
    try {
      await this.updateMember(memberId, { role: newRole });
    } catch (error) {
      console.error('Error updating member role:', error);
      throw error;
    }
  }

  // Assign mentor
  static async assignMentor(memberId: string, mentorId: string): Promise<void> {
    try {
      await this.updateMember(memberId, { mentorId });

      // Also update mentor's menteeIds
      const mentor = await this.getMemberById(mentorId);
      if (mentor) {
        const menteeIds = mentor.menteeIds || [];
        if (!menteeIds.includes(memberId)) {
          await this.updateMember(mentorId, {
            menteeIds: [...menteeIds, memberId],
          });
        }
      }
    } catch (error) {
      console.error('Error assigning mentor:', error);
      throw error;
    }
  }

  /** Batch update members */
  static async batchUpdateMembers(memberIds: string[], updates: Partial<Member>): Promise<void> {
    try {
      await Promise.all(memberIds.map(id => this.updateMember(id, updates)));
    } catch (error) {
      console.error('Error in batch update:', error);
      throw error;
    }
  }

  /** Batch delete members */
  static async batchDeleteMembers(memberIds: string[]): Promise<void> {
    try {
      await Promise.all(memberIds.map(id => this.deleteMember(id)));
    } catch (error) {
      console.error('Error in batch delete:', error);
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

    const flushBatch = async () => {
      if (batchOps === 0) return;
      await batch.commit();
      batch = writeBatch(db);
      batchOps = 0;
    };

    for (const member of members) {
      result.scanned += 1;
      try {
        const memberWorking = { ...member } as Member;
        const nextType = applyType(memberWorking);
        if (!nextType) continue;

        batch.update(doc(db, COLLECTIONS.MEMBERS, member.id), {
          membershipType: nextType,
          updatedAt: Timestamp.now(),
        });
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
    return result;
  }

  /**
   * Batch-sync members.membership[year] from each member's membershipType + Membership Config.
   * Recalculates status from existing paid amount. Does not change membershipType.
   */
  static async batchSyncMembershipRecords(options: {
    year: number;
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
      loIdFilter,
      membershipTransactions,
      onlyExistingRecords = false,
    } = options;

    const result = {
      year,
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
    const yearStr = String(year);

    const applyToMember = (member: Member): boolean => {
      const membershipType = (member.membershipType || 'Probation') as MembershipType;
      const effectiveJoinYear = this.getEffectiveJoinYear(
        member,
        calculationMode,
        membershipTransactions
      );

      if (effectiveJoinYear > year) {
        result.skippedNotEligible += 1;
        return false;
      }

      const membership = { ...(member.membership || {}) } as Record<string, MembershipRecord>;
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

      member.membership = membership;
      if (hadRecord) {
        result.updated += 1;
      } else {
        result.created += 1;
      }
      return true;
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
        const memberWorking = { ...member, membership } as Member;
        if (!applyToMember(memberWorking)) continue;

        batch.update(doc(db, COLLECTIONS.MEMBERS, member.id), {
          membership: memberWorking.membership,
          updatedAt: Timestamp.now(),
        });
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
    return result;
  }

  /** @deprecated Use batchSyncMembershipRecords */
  static async syncMembershipFromMembershipType(
    options: Parameters<typeof MembersService.batchSyncMembershipRecords>[0]
  ) {
    return MembersService.batchSyncMembershipRecords(options);
  }
}

