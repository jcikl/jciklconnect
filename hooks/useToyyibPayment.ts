import { useState, useRef } from 'react';
import { collection, getDocs, limit, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { ToyyibService } from '../services/toyyibService';
import type { Member } from '../types';

export interface ToyyibPaymentResult {
  billCode: string;
  paymentUrl: string;
  /** true when an existing unpaid bill was reused instead of creating a new one */
  isExisting: boolean;
}

export function useToyyibPayment() {
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPayingRef = useRef(false);

  const payMembershipDues = async (
    member: Member,
    year: number,
  ): Promise<ToyyibPaymentResult> => {
    if (isPayingRef.current) return null as unknown as ToyyibPaymentResult;
    isPayingRef.current = true;
    setIsPaying(true);
    setError(null);
    try {
      // Server-side: amount from membership rules, existing-bill reuse, bill record and the
      // member's link to the bill (members cannot write those themselves under the rules).
      return await ToyyibService.createDuesBill(member.id!, year);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Payment link generation failed';
      setError(msg);
      throw e;
    } finally {
      isPayingRef.current = false;
      setIsPaying(false);
    }
  };

  const payEventTicket = async (
    member: Member,
    project: { id: string; title: string; ticketPrice: number },
  ): Promise<ToyyibPaymentResult> => {
    if (isPayingRef.current) return null as unknown as ToyyibPaymentResult;
    isPayingRef.current = true;
    setIsPaying(true);
    setError(null);
    try {
      const categoryCode = await ToyyibService.getOrCreateProjectCategory(project.id, project.title);

      const existing = await ToyyibService.findExistingActiveBill(member.id!, categoryCode, project.id);
      if (existing) return { ...existing, isExisting: true };

      const billDesc = ToyyibService.formatEventBillDescription(
        project.title,
        member.general?.name ?? member.general?.name,
        member.general?.idNumber ?? member.general?.idNumber ?? member.general?.idNumber,
        (member.contact?.phone ?? member.contact?.phone) || '',
      );

      const bill = await ToyyibService.createBill({
        billName: 'Ticketing',
        billDescription: billDesc,
        billAmount: project.ticketPrice,
        billTo: member.general?.name ?? member.general?.name,
        billEmail: (member.contact?.email ?? member.contact?.email) || '',
        billPhone: (member.contact?.phone ?? member.contact?.phone) || '',
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
      isPayingRef.current = false;
      setIsPaying(false);
    }
  };

  return { isPaying, error, payMembershipDues, payEventTicket };
}
