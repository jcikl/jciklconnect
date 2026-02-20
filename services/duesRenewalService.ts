// Dues Renewal Service - Annual Membership Dues Management
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
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { 
  Member, 
  MembershipType, 
  MembershipDues, 
  DuesRenewalTransaction, 
  DuesRenewalSummary 
} from '../types';
import { isDevMode } from '../utils/devMode';
import { MOCK_DUES_RENEWAL_TRANSACTIONS, MOCK_MEMBERS } from './mockData';

export class DuesRenewalService {
  /**
   * Validate membership type eligibility
   */
  static validateMembershipTypeEligibility(
    member: Member,
    membershipType: MembershipType
  ): { valid: boolean; reason?: string } {
    switch (membershipType) {
      case 'Honorary':
        if (!member.age || member.age <= 40) {
          return { valid: false, reason: 'Honorary members must be over 40 years old' };
        }
        break;
      
      case 'Senator':
        if (!member.senatorCertified) {
          return { valid: false, reason: 'Senator certification required' };
        }
        break;
      
      case 'Visiting':
        if (member.nationality === 'Malaysia') {
          return { valid: false, reason: 'Visiting members must be non-Malaysian citizens' };
        }
        break;
      
      case 'Probation':
      case 'Full':
        // No special validation required
        break;
      
      default:
        return { valid: false, reason: 'Invalid membership type' };
    }
    
    return { valid: true };
  }

  /**
   * Calculate dues amount for a member based on their membership type
   */
  static calculateDuesAmount(membershipType: MembershipType): number {
    return MembershipDues[membershipType];
  }

  /**
   * Get eligible members for renewal (paid dues in previous year)
   */
  static async getEligibleMembersForRenewal(year: number): Promise<Member[]> {
    if (isDevMode()) {
      return MOCK_MEMBERS.map(m => ({ ...m, duesYear: year - 1 } as Member));
    }

    try {
      // Get all members who paid dues in the previous year
      const q = query(
        collection(db, COLLECTIONS.MEMBERS),
        where('duesYear', '==', year - 1),
        where('duesStatus', '==', 'Paid'),
        orderBy('name', 'asc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Member));
    } catch (error) {
      console.error('Error fetching eligible members for renewal:', error);
      throw error;
    }
  }

  /**
   * Create renewal transactions for eligible members
   */
  static async createRenewalTransactions(
    year: number,
    memberIds?: string[]
  ): Promise<{
    created: number;
    skipped: number;
    errors: Array<{ memberId: string; error: string }>;
  }> {
    if (isDevMode()) {
      console.log(`[Dev Mode] Would create renewal transactions for year ${year}`);
      return { created: 10, skipped: 2, errors: [] };
    }

    try {
      const eligibleMembers = await this.getEligibleMembersForRenewal(year);
      const targetMembers = memberIds 
        ? eligibleMembers.filter(m => memberIds.includes(m.id))
        : eligibleMembers;

      let created = 0;
      let skipped = 0;
      const errors: Array<{ memberId: string; error: string }> = [];

      for (const member of targetMembers) {
        try {
          // Check if renewal transaction already exists
          const existingRenewal = await this.getRenewalTransaction(member.id, year);
          if (existingRenewal) {
            skipped++;
            continue;
          }

          // Validate membership type eligibility
          const membershipType = member.membershipType || 'Probation';
          const validation = this.validateMembershipTypeEligibility(member, membershipType);
          if (!validation.valid) {
            errors.push({ memberId: member.id, error: validation.reason || 'Invalid membership type' });
            continue;
          }

          // Calculate dues amount
          const amount = this.calculateDuesAmount(membershipType);
          
          // Create renewal transaction
          const renewalData: Omit<DuesRenewalTransaction, 'id'> = {
            memberId: member.id,
            membershipType,
            duesYear: year,
            amount,
            status: 'pending',
            dueDate: new Date(year, 2, 31).toISOString(), // March 31st
            isRenewal: true,
            createdAt: new Date().toISOString(),
            remindersSent: 0,
          };

          await addDoc(collection(db, COLLECTIONS.DUES_RENEWALS), {
            ...renewalData,
            dueDate: Timestamp.fromDate(new Date(renewalData.dueDate)),
            createdAt: Timestamp.now(),
          });

          // Send notification
          await this.sendRenewalNotification(member, renewalData);
          
          created++;
        } catch (error) {
          errors.push({ 
            memberId: member.id, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      return { created, skipped, errors };
    } catch (error) {
      console.error('Error creating renewal transactions:', error);
      throw error;
    }
  }

  /**
   * Get renewal transaction for a member and year
   */
  static async getRenewalTransaction(
    memberId: string, 
    year: number
  ): Promise<DuesRenewalTransaction | null> {
    if (isDevMode()) {
      return MOCK_DUES_RENEWAL_TRANSACTIONS.find(
        r => r.memberId === memberId && r.duesYear === year
      ) ?? null;
    }

    try {
      const q = query(
        collection(db, COLLECTIONS.DUES_RENEWALS),
        where('memberId', '==', memberId),
        where('duesYear', '==', year)
      );
      
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
        dueDate: doc.data().dueDate?.toDate?.()?.toISOString() || doc.data().dueDate,
        paidDate: doc.data().paidDate?.toDate?.()?.toISOString() || doc.data().paidDate,
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
      } as DuesRenewalTransaction;
    } catch (error) {
      console.error('Error fetching renewal transaction:', error);
      throw error;
    }
  }

  /**
   * Get all renewal transactions for a year
   */
  static async getRenewalTransactionsByYear(year: number): Promise<DuesRenewalTransaction[]> {
    if (isDevMode()) {
      return MOCK_DUES_RENEWAL_TRANSACTIONS
        .filter(r => r.duesYear === year)
        .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    }

    try {
      const q = query(
        collection(db, COLLECTIONS.DUES_RENEWALS),
        where('duesYear', '==', year),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        dueDate: doc.data().dueDate?.toDate?.()?.toISOString() || doc.data().dueDate,
        paidDate: doc.data().paidDate?.toDate?.()?.toISOString() || doc.data().paidDate,
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
      } as DuesRenewalTransaction));
    } catch (error) {
      console.error('Error fetching renewal transactions by year:', error);
      throw error;
    }
  }

  /**
   * Update renewal transaction status (when payment is received)
   */
  static async updateRenewalTransactionStatus(
    transactionId: string,
    status: 'paid' | 'overdue',
    paidDate?: string
  ): Promise<void> {
    if (isDevMode()) {
      console.log(`[Dev Mode] Would update renewal transaction ${transactionId} to ${status}`);
      return;
    }

    try {
      const updateData: any = {
        status,
        updatedAt: Timestamp.now(),
      };

      if (status === 'paid' && paidDate) {
        updateData.paidDate = Timestamp.fromDate(new Date(paidDate));
      }

      await updateDoc(doc(db, COLLECTIONS.DUES_RENEWALS, transactionId), updateData);

      // Update member's dues status
      if (status === 'paid') {
        const renewal = await this.getRenewalTransactionById(transactionId);
        if (renewal) {
          await this.updateMemberDuesStatus(renewal.memberId, renewal.duesYear, 'Paid');
        }
      }
    } catch (error) {
      console.error('Error updating renewal transaction status:', error);
      throw error;
    }
  }

  /**
   * Get renewal transaction by ID
   */
  static async getRenewalTransactionById(transactionId: string): Promise<DuesRenewalTransaction | null> {
    if (isDevMode()) {
      return MOCK_DUES_RENEWAL_TRANSACTIONS.find(r => r.id === transactionId) ?? null;
    }

    try {
      const docRef = doc(db, COLLECTIONS.DUES_RENEWALS, transactionId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }

      return {
        id: docSnap.id,
        ...docSnap.data(),
        dueDate: docSnap.data().dueDate?.toDate?.()?.toISOString() || docSnap.data().dueDate,
        paidDate: docSnap.data().paidDate?.toDate?.()?.toISOString() || docSnap.data().paidDate,
        createdAt: docSnap.data().createdAt?.toDate?.()?.toISOString() || docSnap.data().createdAt,
        updatedAt: docSnap.data().updatedAt?.toDate?.()?.toISOString() || docSnap.data().updatedAt,
      } as DuesRenewalTransaction;
    } catch (error) {
      console.error('Error fetching renewal transaction by ID:', error);
      throw error;
    }
  }

  /**
   * Update member's dues status
   */
  static async updateMemberDuesStatus(
    memberId: string,
    duesYear: number,
    status: 'Paid' | 'Pending' | 'Overdue'
  ): Promise<void> {
    if (isDevMode()) {
      console.log(`[Dev Mode] Would update member ${memberId} dues status to ${status}`);
      return;
    }

    try {
      await updateDoc(doc(db, COLLECTIONS.MEMBERS, memberId), {
        duesStatus: status,
        duesYear: status === 'Paid' ? duesYear : undefined,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error updating member dues status:', error);
      throw error;
    }
  }

  /**
   * Send renewal notification to member
   */
  static async sendRenewalNotification(
    member: Member,
    renewal: Omit<DuesRenewalTransaction, 'id'>
  ): Promise<void> {
    if (isDevMode()) {
      console.log(`[Dev Mode] Would send renewal notification to ${member.email}`);
      return;
    }

    try {
      // Import services dynamically to avoid circular dependencies
      const { CommunicationService } = await import('./communicationService');
      
      const membershipTypeNames: Record<MembershipType, string> = {
        Probation: 'Probation Member (试用会员)',
        Full: 'Full Member (正式会员)',
        Honorary: 'Honorary Member (特友会员)',
        Senator: 'Senator (参议员)',
        Visiting: 'Visiting Member (访问会员)',
      };

      const message = renewal.membershipType === 'Senator' 
        ? `As a Senator, you are exempt from annual dues for ${renewal.duesYear}. Your membership status remains active.`
        : `Your ${membershipTypeNames[renewal.membershipType]} dues of RM${renewal.amount} for ${renewal.duesYear} are now due. Please complete payment by ${new Date(renewal.dueDate).toLocaleDateString()} to maintain your active membership status.`;

      await CommunicationService.createNotification({
        memberId: member.id,
        title: `Membership Dues Renewal for ${renewal.duesYear}`,
        message,
        type: 'info',
      });
    } catch (error) {
      console.error('Error sending renewal notification:', error);
      // Don't throw error - notification failure shouldn't stop renewal creation
    }
  }

  /**
   * Send reminder notifications for overdue dues
   */
  static async sendDuesReminders(year: number): Promise<number> {
    if (isDevMode()) {
      console.log(`[Dev Mode] Would send dues reminders for year ${year}`);
      return 5;
    }

    try {
      const renewals = await this.getRenewalTransactionsByYear(year);
      const overdueRenewals = renewals.filter(r => {
        const dueDate = new Date(r.dueDate);
        const now = new Date();
        return r.status === 'pending' && now > dueDate && r.membershipType !== 'Senator';
      });

      let remindersSent = 0;

      for (const renewal of overdueRenewals) {
        try {
          // Import services dynamically
          const { MembersService } = await import('./membersService');
          const { CommunicationService } = await import('./communicationService');
          
          const member = await MembersService.getMemberById(renewal.memberId);
          if (!member) continue;

          await CommunicationService.createNotification({
            memberId: renewal.memberId,
            title: `Reminder: Membership Dues Payment Overdue`,
            message: `Your membership dues of RM${renewal.amount} for ${renewal.duesYear} are overdue. Please complete payment to avoid membership suspension.`,
            type: 'warning',
          });

          // Update reminder count
          await updateDoc(doc(db, COLLECTIONS.DUES_RENEWALS, renewal.id), {
            remindersSent: (renewal.remindersSent || 0) + 1,
            lastReminderDate: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });

          remindersSent++;
        } catch (error) {
          console.error(`Error sending reminder for renewal ${renewal.id}:`, error);
        }
      }

      return remindersSent;
    } catch (error) {
      console.error('Error sending dues reminders:', error);
      throw error;
    }
  }

  /**
   * Generate dues renewal summary for a year
   */
  static async generateRenewalSummary(year: number): Promise<DuesRenewalSummary> {
    if (isDevMode()) {
      const renewals = MOCK_DUES_RENEWAL_TRANSACTIONS.filter(r => r.duesYear === year);
      const byMembershipType: DuesRenewalSummary['byMembershipType'] = {
        Probation: { total: 0, paid: 0, pending: 0, overdue: 0, totalAmount: 0, paidAmount: 0 },
        Full: { total: 0, paid: 0, pending: 0, overdue: 0, totalAmount: 0, paidAmount: 0 },
        Honorary: { total: 0, paid: 0, pending: 0, overdue: 0, totalAmount: 0, paidAmount: 0 },
        Senator: { total: 0, paid: 0, pending: 0, overdue: 0, totalAmount: 0, paidAmount: 0 },
        Visiting: { total: 0, paid: 0, pending: 0, overdue: 0, totalAmount: 0, paidAmount: 0 },
      };
      let totalAmount = 0, paidAmount = 0, pendingAmount = 0, overdueAmount = 0;
      renewals.forEach(r => {
        const t = byMembershipType[r.membershipType];
        t.total++;
        t.totalAmount += r.amount;
        totalAmount += r.amount;
        if (r.status === 'paid') { t.paid++; t.paidAmount += r.amount; paidAmount += r.amount; }
        else if (r.status === 'pending') { t.pending++; pendingAmount += r.amount; }
        else if (r.status === 'overdue') { t.overdue++; overdueAmount += r.amount; }
      });
      const collectionRate = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 1000) / 10 : 0;
      return {
        year,
        totalMembers: renewals.length,
        renewalMembers: renewals.filter(r => r.isRenewal).length,
        newMembers: renewals.filter(r => !r.isRenewal).length,
        byMembershipType,
        overallStats: { totalAmount, paidAmount, pendingAmount, overdueAmount, collectionRate },
      };
    }

    try {
      const renewals = await this.getRenewalTransactionsByYear(year);
      const eligibleMembers = await this.getEligibleMembersForRenewal(year);

      const byMembershipType: DuesRenewalSummary['byMembershipType'] = {
        Probation: { total: 0, paid: 0, pending: 0, overdue: 0, totalAmount: 0, paidAmount: 0 },
        Full: { total: 0, paid: 0, pending: 0, overdue: 0, totalAmount: 0, paidAmount: 0 },
        Honorary: { total: 0, paid: 0, pending: 0, overdue: 0, totalAmount: 0, paidAmount: 0 },
        Senator: { total: 0, paid: 0, pending: 0, overdue: 0, totalAmount: 0, paidAmount: 0 },
        Visiting: { total: 0, paid: 0, pending: 0, overdue: 0, totalAmount: 0, paidAmount: 0 },
      };

      let totalAmount = 0;
      let paidAmount = 0;
      let pendingAmount = 0;
      let overdueAmount = 0;

      renewals.forEach(renewal => {
        const typeStats = byMembershipType[renewal.membershipType];
        typeStats.total++;
        typeStats.totalAmount += renewal.amount;
        totalAmount += renewal.amount;

        if (renewal.status === 'paid') {
          typeStats.paid++;
          typeStats.paidAmount += renewal.amount;
          paidAmount += renewal.amount;
        } else if (renewal.status === 'pending') {
          typeStats.pending++;
          pendingAmount += renewal.amount;
        } else if (renewal.status === 'overdue') {
          typeStats.overdue++;
          overdueAmount += renewal.amount;
        }
      });

      const collectionRate = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

      return {
        year,
        totalMembers: renewals.length,
        renewalMembers: renewals.filter(r => r.isRenewal).length,
        newMembers: renewals.filter(r => !r.isRenewal).length,
        byMembershipType,
        overallStats: {
          totalAmount,
          paidAmount,
          pendingAmount,
          overdueAmount,
          collectionRate: Math.round(collectionRate * 10) / 10,
        },
      };
    } catch (error) {
      console.error('Error generating renewal summary:', error);
      throw error;
    }
  }
}