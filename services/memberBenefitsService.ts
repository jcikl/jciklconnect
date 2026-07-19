// Member Benefits Service
// Handles the memberBenefits collection and benefitUsage write path.
// Read path for advertisements-as-benefits lives in advertisementService; this
// service owns the benefitUsage write path (claimBenefit) that was previously
// deleted when the original file was moved to trash/.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  runTransaction,
  increment,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { COLLECTIONS } from '@/config/constants';
import { withDevMode } from '@/utils/devMode';
import { toDate } from '@/utils/dateUtils';
import { apiCache } from './cacheService';
import { errorLoggingService } from './errorLoggingService';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface MemberBenefit {
  id?: string;
  name: string;
  description: string;
  type: 'Discount' | 'Exclusive Access' | 'Free Service' | 'Priority' | 'Other';
  category: 'Event' | 'Training' | 'Business' | 'Social' | 'General';
  eligibilityCriteria: {
    tier?: string[];
    role?: string[];
    points?: number;
    joinDate?: string;
    custom?: string;
  };
  validFrom: Date | Timestamp | string;
  validUntil?: Date | Timestamp | string;
  usageLimit?: number; // Per-member claim limit
  currentUsage: number; // Total usage count across all members
  status: 'Active' | 'Inactive' | 'Expired';
  provider?: string;
  termsAndConditions?: string;
  bannerUrl?: string;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

export interface BenefitUsage {
  id?: string;
  memberId: string;
  benefitId: string;
  usedAt: Date | Timestamp | string;
  /** P0-fix: field name aligned with Firestore hasOnly whitelist ('notes', not 'details'). */
  notes?: string;
}

// ── Cache keys ────────────────────────────────────────────────────────────────

const CACHE_TTL = 3 * 60 * 1000; // 3 minutes
const CACHE_KEY_ALL_BENEFITS = 'memberBenefits:all';
const CACHE_KEY_USAGE_PREFIX = 'memberBenefits:usage:';

// ── Service ───────────────────────────────────────────────────────────────────

export class MemberBenefitsService {
  // ── Cache helpers ──────────────────────────────────────────────────────────

  static invalidateBenefitsCache(): void {
    apiCache.delete(CACHE_KEY_ALL_BENEFITS);
  }

  static invalidateUsageCache(memberId: string): void {
    apiCache.delete(`${CACHE_KEY_USAGE_PREFIX}${memberId}`);
  }

  // ── getMemberBenefits ──────────────────────────────────────────────────────
  // Returns all active MemberBenefit records from the memberBenefits collection.

  static async getMemberBenefits(): Promise<MemberBenefit[]> {
    return withDevMode<MemberBenefit[]>(
      () => [
        {
          id: 'b1',
          name: '20% Off Event Tickets',
          description: 'Exclusive discount on all JCI events',
          type: 'Discount',
          category: 'Event',
          eligibilityCriteria: { tier: ['Silver', 'Gold', 'Platinum'] },
          validFrom: new Date('2024-01-01'),
          status: 'Active',
          currentUsage: 45,
          usageLimit: 1,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'b2',
          name: 'Free Leadership Training',
          description: 'Complimentary access to all leadership training modules',
          type: 'Free Service',
          category: 'Training',
          eligibilityCriteria: { tier: ['Gold', 'Platinum'], points: 1000 },
          validFrom: new Date('2024-01-01'),
          status: 'Active',
          currentUsage: 12,
          usageLimit: 1,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ],
      () =>
        apiCache.getOrSet<MemberBenefit[]>(
          CACHE_KEY_ALL_BENEFITS,
          async () => {
            try {
              const snapshot = await getDocs(
                query(
                  collection(db, COLLECTIONS.MEMBER_BENEFITS || 'memberBenefits'),
                  where('status', '==', 'Active'),
                  orderBy('createdAt', 'desc')
                )
              );
              return snapshot.docs.map(d => ({
                id: d.id,
                ...d.data(),
                validFrom: d.data().validFrom?.toDate?.() ?? d.data().validFrom,
                validUntil: d.data().validUntil?.toDate?.() ?? d.data().validUntil,
                createdAt: d.data().createdAt?.toDate() ?? new Date(),
                updatedAt: d.data().updatedAt?.toDate() ?? new Date(),
              })) as MemberBenefit[];
            } catch (error) {
              errorLoggingService.logError(error as Error, {
                action: 'MemberBenefitsService.getMemberBenefits',
              });
              throw error;
            }
          },
          CACHE_TTL,
          'MemberBenefitsService.getMemberBenefits'
        )
    );
  }

  // ── getBenefitUsage ────────────────────────────────────────────────────────
  // Returns all benefitUsage docs for the given member.

  static async getBenefitUsage(memberId: string): Promise<BenefitUsage[]> {
    return withDevMode<BenefitUsage[]>(
      () => [],
      () =>
        apiCache.getOrSet<BenefitUsage[]>(
          `${CACHE_KEY_USAGE_PREFIX}${memberId}`,
          async () => {
            try {
              const snapshot = await getDocs(
                query(
                  collection(db, COLLECTIONS.BENEFIT_USAGE || 'benefitUsage'),
                  where('memberId', '==', memberId),
                  orderBy('usedAt', 'desc')
                )
              );
              return snapshot.docs.map(d => ({
                id: d.id,
                ...d.data(),
                usedAt: d.data().usedAt?.toDate?.() ?? d.data().usedAt,
              })) as BenefitUsage[];
            } catch (error) {
              errorLoggingService.logError(error as Error, {
                action: 'MemberBenefitsService.getBenefitUsage',
                additionalData: { memberId },
              });
              throw error;
            }
          },
          CACHE_TTL,
          'MemberBenefitsService.getBenefitUsage'
        )
    );
  }

  // ── claimBenefit ───────────────────────────────────────────────────────────
  // Atomically writes a benefitUsage doc and increments the benefit's
  // usageCount in a single writeBatch.
  //
  // Throws 'Limit reached' if the member has already claimed this benefit
  // up to its usageLimit.

  static async claimBenefit(
    memberId: string,
    benefitId: string,
    details?: string
  ): Promise<void> {
    await withDevMode<void>(
      () => {
        console.log(`[DEV MODE] claimBenefit memberId=${memberId} benefitId=${benefitId}`);
      },
      async () => {
        try {
          // 1. Determine which collection holds this benefit (outside transaction — fast pre-check).
          const mbRef = doc(db, COLLECTIONS.MEMBER_BENEFITS || 'memberBenefits', benefitId);
          const adsRef = doc(db, COLLECTIONS.ADVERTISEMENTS || 'advertisements', benefitId);
          const [mbDoc, benefitSnap0] = await Promise.all([getDoc(mbRef), getDoc(adsRef)]);
          const isMemberBenefit = mbDoc.exists();
          const benefitRef = isMemberBenefit ? mbRef : adsRef;
          // When mbDoc exists use it directly; otherwise benefitSnap0 (ads doc) was already fetched.
          const preCheckBenefit = isMemberBenefit ? mbDoc : benefitSnap0;

          // 2a. Pre-check usage limit outside the transaction (fast-fail for obvious over-limit).
          //     This is NOT the authoritative check — see the transactional counter check below.
          //     Firestore transactions do not support collection queries (getDocs inside a
          //     transaction callback runs outside transaction isolation), so we do a pre-read
          //     here and rely on the transaction-read benefit counter for the final gate.
          const preCheckSnap = await getDocs(
            query(
              collection(db, COLLECTIONS.BENEFIT_USAGE || 'benefitUsage'),
              where('memberId', '==', memberId),
              where('benefitId', '==', benefitId)
            )
          );
          const preCheckLimit = preCheckBenefit.data()?.usageLimit as number | undefined;
          if (preCheckLimit !== undefined && preCheckSnap.size >= preCheckLimit) {
            throw new Error('Limit reached');
          }

          // 2b. Atomic runTransaction: re-read benefit for usageLimit, verify counter,
          //     write usage record + increment counter in one transaction.
          await runTransaction(db, async (transaction) => {
            // Re-read the benefit doc inside the transaction to get the freshest usageLimit.
            const freshBenefitSnap = await transaction.get(benefitRef);
            const usageLimit = freshBenefitSnap.data()?.usageLimit as number | undefined;
            const currentUsage = (freshBenefitSnap.data()?.currentUsage as number | undefined) ?? 0;

            // Authoritative limit check using the transactionally-read counter.
            // Per-member granularity is protected by the pre-check above; the transaction
            // protects the total usage counter from concurrent over-claims.
            if (usageLimit !== undefined && currentUsage >= usageLimit) {
              throw new Error('Limit reached');
            }

            // Write usage record using a pre-generated ref (addDoc not available in transaction).
            // P0-fix: write field 'notes' to match Firestore hasOnly whitelist (was 'details').
            const usageRef = doc(collection(db, COLLECTIONS.BENEFIT_USAGE || 'benefitUsage'));
            transaction.set(usageRef, {
              memberId,
              benefitId,
              usedAt: Timestamp.now(),
              ...(details ? { notes: details } : {}),
            });

            // Increment counter on the owning collection.
            if (isMemberBenefit) {
              transaction.update(benefitRef, { currentUsage: increment(1), updatedAt: Timestamp.now() });
            } else {
              // advertisements collection uses `clicks` as the usage counter.
              transaction.update(benefitRef, { clicks: increment(1), updatedAt: Timestamp.now() });
            }
          });

          // 3. Invalidate caches after successful transaction.
          this.invalidateUsageCache(memberId);
          this.invalidateBenefitsCache();
          apiCache.delete('ads:all');
          apiCache.deleteByPrefix('ads:active:');
        } catch (error) {
          if ((error as Error).message === 'Limit reached') throw error;
          errorLoggingService.logError(error as Error, {
            action: 'MemberBenefitsService.claimBenefit',
            additionalData: { memberId, benefitId },
          });
          throw error;
        }
      }
    );
  }

  // ── getAllBenefits (alias for backward compat) ─────────────────────────────

  static async getAllBenefits(): Promise<MemberBenefit[]> {
    return this.getMemberBenefits();
  }

  // ── getBenefitUsageHistory (for admin views) ───────────────────────────────
  // Queries by benefitId and/or memberId. No cache (admin use; low frequency).

  static async getBenefitUsageHistory(
    benefitId?: string,
    memberId?: string
  ): Promise<BenefitUsage[]> {
    return withDevMode<BenefitUsage[]>(
      () => [],
      async () => {
        try {
          const conditions: ReturnType<typeof where>[] = [];
          if (benefitId) conditions.push(where('benefitId', '==', benefitId));
          if (memberId) conditions.push(where('memberId', '==', memberId));

          const q =
            conditions.length > 0
              ? query(
                  collection(db, COLLECTIONS.BENEFIT_USAGE || 'benefitUsage'),
                  ...conditions,
                  orderBy('usedAt', 'desc')
                )
              : query(
                  collection(db, COLLECTIONS.BENEFIT_USAGE || 'benefitUsage'),
                  orderBy('usedAt', 'desc')
                );

          const snapshot = await getDocs(q);
          return snapshot.docs.map(d => ({
            id: d.id,
            ...d.data(),
            usedAt: d.data().usedAt?.toDate?.() ?? d.data().usedAt,
          })) as BenefitUsage[];
        } catch (error) {
          errorLoggingService.logError(error as Error, {
            action: 'MemberBenefitsService.getBenefitUsageHistory',
          });
          throw error;
        }
      }
    );
  }
}
