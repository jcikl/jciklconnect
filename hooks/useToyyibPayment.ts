import { useState } from 'react';
import { collection, doc, getDocs, limit, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { ToyyibService } from '../services/toyyibService';
import {
  MembershipConfigService,
  DEFAULT_MEMBERSHIP_RULES,
  getTargetDuesForMembershipType,
} from '../services/membershipConfigService';
import type { Member, MembershipType } from '../types';

export interface ToyyibPaymentResult {
  billCode: string;
  paymentUrl: string;
  /** true when an existing unpaid bill was reused instead of creating a new one */
  isExisting: boolean;
}

export function useToyyibPayment() {
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payMembershipDues = async (
    member: Member,
    year: number,
  ): Promise<ToyyibPaymentResult> => {
    setIsPaying(true);
    setError(null);
    try {
      // 1. Lazy-create category
      const categoryCode = await ToyyibService.getOrCreateMembershipCategory(year);

      // 2. Duplicate check — return existing active bill if found
      const existing = await ToyyibService.findExistingActiveBill(member.id!, categoryCode);
      if (existing) return { ...existing, isExisting: true };

      // 3. Resolve dues amount from config
      const isFirstYear = !member.membership ||
        !Object.keys(member.membership).some(y =>
          Number(y) < year &&
          (member.membership![y]?.status === 'paid' || member.membership![y]?.status === 'over paid')
        );
      let amount: number;
      try {
        const config = await MembershipConfigService.getConfig();
        amount = getTargetDuesForMembershipType(
          member.membershipType as MembershipType,
          isFirstYear,
          config.rules,
        );
      } catch {
        amount = DEFAULT_MEMBERSHIP_RULES[member.membershipType as MembershipType]?.duesAmount ?? 0;
      }

      // 4. Bill description
      const isGuest = member.membershipType === 'Guest';
      const billDesc = ToyyibService.formatMembershipBillDescription(
        member.name,
        member.nationalId,
        member.phone || '',
        year,
        isGuest,
      );

      // 5. Create bill
      const bill = await ToyyibService.createBill({
        billName: `${year} Renewal Membership`,
        billDescription: billDesc,
        billAmount: amount,
        billTo: member.name,
        billEmail: member.email || '',
        billPhone: member.phone || '',
        categoryCode,
        memberId: member.id,
      });

      // 6. Write toyyib fields back to member's membership record
      if (member.id) {
        await updateDoc(doc(db, COLLECTIONS.MEMBERS, member.id), {
          [`membership.${year}.toyyibBillCode`]: bill.billCode,
          [`membership.${year}.toyyibPaymentUrl`]: bill.paymentUrl,
          [`membership.${year}.toyyibPaymentStatus`]: '2',
          [`membership.${year}.toyyibBillName`]: `${year} Renewal Membership`,
        });
      }

      return { ...bill, isExisting: false };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Payment link generation failed';
      setError(msg);
      throw e;
    } finally {
      setIsPaying(false);
    }
  };

  const payEventTicket = async (
    member: Member,
    project: { id: string; title: string; ticketPrice: number },
  ): Promise<ToyyibPaymentResult> => {
    setIsPaying(true);
    setError(null);
    try {
      const categoryCode = await ToyyibService.getOrCreateProjectCategory(project.id, project.title);

      const existing = await ToyyibService.findExistingActiveBill(member.id!, categoryCode, project.id);
      if (existing) return { ...existing, isExisting: true };

      const billDesc = ToyyibService.formatEventBillDescription(
        project.title,
        member.name,
        member.nationalId,
        member.phone || '',
      );

      const bill = await ToyyibService.createBill({
        billName: 'Ticketing',
        billDescription: billDesc,
        billAmount: project.ticketPrice,
        billTo: member.name,
        billEmail: member.email || '',
        billPhone: member.phone || '',
        categoryCode,
        memberId: member.id,
        projectId: project.id,
      });

      // Write toyyib fields back to the member's event registration record
      if (member.id) {
        const regQuery = query(
          collection(db, COLLECTIONS.EVENT_REGISTRATIONS),
          where('eventId', '==', project.id),
          where('memberId', '==', member.id),
          limit(1),
        );
        const snap = await getDocs(regQuery);
        if (!snap.empty) {
          await updateDoc(snap.docs[0].ref, {
            toyyibBillCode: bill.billCode,
            toyyibPaymentUrl: bill.paymentUrl,
            toyyibPaymentStatus: '2',
          });
        }
      }

      return { ...bill, isExisting: false };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Payment link generation failed';
      setError(msg);
      throw e;
    } finally {
      setIsPaying(false);
    }
  };

  return { isPaying, error, payMembershipDues, payEventTicket };
}
