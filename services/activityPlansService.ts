// Activity Plans Service - CRUD Operations
// P0 fix: all methods now query COLLECTIONS.ACTIVITY_PLANS (was COLLECTIONS.PROJECTS)
// P1 fixes: isDevMode guard, cacheService, status guards, writeBatch for createNewVersion
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
  Timestamp,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { withDevMode } from '../utils/devMode';
import { apiCache, CACHE_TTL_3MIN } from './cacheService';
import { errorLoggingService } from './errorLoggingService';

// ---------------------------------------------------------------------------
// Cache constants
// ---------------------------------------------------------------------------
const CACHE_PREFIX_ACTIVITY_PLANS = 'activity_plans';
const CACHE_KEY_ALL = `${CACHE_PREFIX_ACTIVITY_PLANS}_all`;
const ACTIVITY_PLANS_TTL = CACHE_TTL_3MIN;

function cacheKeyByStatus(status: string) {
  return `${CACHE_PREFIX_ACTIVITY_PLANS}_status_${status}`;
}
function cacheKeyById(id: string) {
  return `${CACHE_PREFIX_ACTIVITY_PLANS}_id_${id}`;
}
function cacheKeyByProject(projectId: string) {
  return `${CACHE_PREFIX_ACTIVITY_PLANS}_project_${projectId}`;
}

export interface ActivityPlan {
  id?: string;
  title: string;
  description: string;
  /** @deprecated use pillar + category + type instead */
  type?: 'Community' | 'Business' | 'Individual' | 'International';
  level?: 'JCI' | 'National' | 'Area' | 'Local';
  pillar?: 'Individual' | 'Community' | 'Business' | 'International' | 'LOM' | 'Chapter';
  category?: 'programs' | 'skill_development' | 'events' | 'projects';
  /** Project type from PROJECT_TYPES_BY_CATEGORY */
  projectType?: string;
  proposedDate: string;
  proposedBudget: number;
  eventStartDate?: string;
  eventEndDate?: string;
  eventStartTime?: string;
  eventEndTime?: string;
  objectives: string;
  expectedImpact: string;
  targetAudience?: string;
  resources?: string[];
  timeline?: string;
  status: 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected' | 'Active';
  submittedBy: string;
  submittedDate?: Date | Timestamp;
  reviewedBy?: string;
  reviewedDate?: Date | Timestamp;
  reviewComments?: string;
  version: number;
  previousVersionId?: string;
  attachments?: string[];
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  /** Parent project/activity this plan belongs to (when created from project view) */
  parentProjectId?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapDoc(d: { id: string; data: () => Record<string, any> }): ActivityPlan {
  const data = d.data();
  return {
    id: d.id,
    ...data,
    proposedDate: data.proposedDate?.toDate?.()?.toISOString?.() ?? data.proposedDate,
    submittedDate: data.submittedDate?.toDate?.() ?? data.submittedDate,
    reviewedDate: data.reviewedDate?.toDate?.() ?? data.reviewedDate,
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
    updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
  } as ActivityPlan;
}

export class ActivityPlansService {

  // ---------------------------------------------------------------------------
  // Cache management
  // ---------------------------------------------------------------------------

  static invalidateActivityPlansCache(): void {
    apiCache.deleteByPrefix(CACHE_PREFIX_ACTIVITY_PLANS);
  }

  // ---------------------------------------------------------------------------
  // Read operations
  // ---------------------------------------------------------------------------

  /** Get all activity plans (cached 3 min). */
  // FIX P0: was COLLECTIONS.PROJECTS
  // FIX P1: added cacheService + isDevMode via withDevMode
  static async getAllActivityPlans(): Promise<ActivityPlan[]> {
    return withDevMode<ActivityPlan[]>(
      () => [
        {
          id: 'ap1',
          title: 'Summer Leadership Summit',
          description: 'Annual leadership development program for young professionals',
          type: 'Community' as const,
          proposedDate: '2024-07-15',
          proposedBudget: 15000,
          objectives: 'Develop leadership skills, network building, community impact',
          expectedImpact: '50+ participants, 10+ partnerships, media coverage',
          status: 'Under Review' as const,
          submittedBy: 'u1',
          version: 1,
          createdAt: new Date('2024-01-10'),
          updatedAt: new Date('2024-01-15'),
        },
        {
          id: 'ap2',
          title: 'Business Networking Mixer',
          description: 'Quarterly networking event for members and local businesses',
          type: 'Business' as const,
          proposedDate: '2024-03-20',
          proposedBudget: 5000,
          objectives: 'Facilitate business connections, member engagement',
          expectedImpact: '100+ attendees, 20+ business connections',
          status: 'Draft' as const,
          submittedBy: 'u2',
          version: 1,
          createdAt: new Date('2024-02-01'),
          updatedAt: new Date('2024-02-05'),
        },
      ],
      () =>
        apiCache.getOrSet(
          CACHE_KEY_ALL,
          async () => {
            try {
              const snapshot = await getDocs(
                query(
                  collection(db, COLLECTIONS.ACTIVITY_PLANS), // FIX P0
                  orderBy('createdAt', 'desc')
                )
              );
              return snapshot.docs.map(mapDoc);
            } catch (error) {
              errorLoggingService.logError(error as Error, {
                component: 'ActivityPlansService',
                action: 'getAllActivityPlans',
              });
              throw error;
            }
          },
          ACTIVITY_PLANS_TTL
        )
    );
  }

  /** Get a single activity plan by ID (cached 3 min). */
  // FIX P0: was COLLECTIONS.PROJECTS
  // FIX P1: added withDevMode + cacheService
  static async getActivityPlanById(planId: string): Promise<ActivityPlan | null> {
    return withDevMode<ActivityPlan | null>(
      () => null,
      () =>
        apiCache.getOrSet(
          cacheKeyById(planId),
          async () => {
            try {
              const docRef = doc(db, COLLECTIONS.ACTIVITY_PLANS, planId); // FIX P0
              const docSnap = await getDoc(docRef);
              if (!docSnap.exists()) return null;
              return mapDoc({ id: docSnap.id, data: () => docSnap.data() as Record<string, any> });
            } catch (error) {
              errorLoggingService.logError(error as Error, {
                component: 'ActivityPlansService',
                action: 'getActivityPlanById',
                additionalData: { planId },
              });
              throw error;
            }
          },
          ACTIVITY_PLANS_TTL
        )
    );
  }

  /** Get activity plans linked to a parent project (cached 3 min). */
  // FIX P1: added cacheService + isDevMode (already used ACTIVITY_PLANS — correct)
  static async getActivityPlansByProjectId(projectId: string): Promise<ActivityPlan[]> {
    return withDevMode<ActivityPlan[]>(
      () => [
        {
          id: 'ap-p1',
          title: 'Venue & Catering Plan',
          description: 'Detailed plan for venue booking and catering arrangements',
          type: 'Community' as const,
          parentProjectId: projectId,
          proposedDate: '2024-06-01',
          proposedBudget: 8000,
          objectives: 'Secure venue, finalize menu',
          expectedImpact: 'Smooth event execution',
          status: 'Draft' as const,
          submittedBy: 'u1',
          version: 1,
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15'),
        },
      ],
      () =>
        apiCache.getOrSet(
          cacheKeyByProject(projectId),
          async () => {
            try {
              const snapshot = await getDocs(
                query(
                  collection(db, COLLECTIONS.ACTIVITY_PLANS),
                  where('parentProjectId', '==', projectId),
                  orderBy('createdAt', 'desc')
                )
              );
              return snapshot.docs.map(mapDoc);
            } catch (error) {
              errorLoggingService.logError(error as Error, {
                component: 'ActivityPlansService',
                action: 'getActivityPlansByProjectId',
                additionalData: { projectId },
              });
              throw error;
            }
          },
          ACTIVITY_PLANS_TTL
        )
    );
  }

  /** Get activity plans filtered by status (cached 3 min). */
  // FIX P0: was COLLECTIONS.PROJECTS
  // FIX P1: added withDevMode + cacheService
  static async getActivityPlansByStatus(status: ActivityPlan['status']): Promise<ActivityPlan[]> {
    return withDevMode<ActivityPlan[]>(
      () => [],
      () =>
        apiCache.getOrSet(
          cacheKeyByStatus(status),
          async () => {
            try {
              const snapshot = await getDocs(
                query(
                  collection(db, COLLECTIONS.ACTIVITY_PLANS), // FIX P0
                  where('status', '==', status),
                  orderBy('createdAt', 'desc')
                )
              );
              return snapshot.docs.map(mapDoc);
            } catch (error) {
              errorLoggingService.logError(error as Error, {
                component: 'ActivityPlansService',
                action: 'getActivityPlansByStatus',
                additionalData: { status },
              });
              throw error;
            }
          },
          ACTIVITY_PLANS_TTL
        )
    );
  }

  // ---------------------------------------------------------------------------
  // Write operations
  // ---------------------------------------------------------------------------

  /** Create a new activity plan in the activityPlans collection. */
  // FIX P0: was COLLECTIONS.PROJECTS
  // FIX P0: added callerRole guard — Firestore rules only allow isBoard()||isAdmin()
  // FIX P1: added withDevMode, cache invalidation, errorLoggingService
  static async createActivityPlan(
    planData: Omit<ActivityPlan, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
    callerRole?: string
  ): Promise<string> {
    return withDevMode<string>(
      () => 'mock-plan-id',
      async () => {
        // P0 FIX: Firestore rules only allow isBoard()||isAdmin() to create
        const ALLOWED_ROLES = ['BOARD', 'ADMIN', 'SUPER_ADMIN'];
        if (!callerRole || !ALLOWED_ROLES.includes(callerRole.toUpperCase())) {
          throw new Error('Only board members or administrators can create activity plans');
        }

        try {
          const cleanPlanData: Record<string, unknown> = {
            version: 1,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };
          Object.keys(planData).forEach(key => {
            const value = planData[key as keyof typeof planData];
            if (value !== undefined) {
              if (key === 'proposedDate' && value) {
                cleanPlanData.proposedDate = Timestamp.fromDate(new Date(value as string | Date));
              } else if (key === 'submittedDate' || key === 'reviewedDate') {
                cleanPlanData[key] = value instanceof Date ? Timestamp.fromDate(value) : value;
              } else {
                cleanPlanData[key] = value;
              }
            }
          });

          const docRef = await addDoc(collection(db, COLLECTIONS.ACTIVITY_PLANS), cleanPlanData); // FIX P0
          this.invalidateActivityPlansCache(); // FIX P1
          return docRef.id;
        } catch (error) {
          errorLoggingService.logError(error as Error, {
            component: 'ActivityPlansService',
            action: 'createActivityPlan',
          });
          throw error;
        }
      }
    );
  }

  /** Update an activity plan. */
  // FIX P0: was COLLECTIONS.PROJECTS
  // FIX P0: added callerRole guard — Firestore rules only allow isBoard()||isAdmin()
  // FIX P1: added withDevMode, cache invalidation, errorLoggingService
  // FIX P1: use runTransaction for optimistic concurrency (prevent concurrent overwrites)
  static async updateActivityPlan(planId: string, updates: Partial<ActivityPlan>, callerRole?: string): Promise<void> {
    return withDevMode<void>(
      () => {},
      async () => {
        // P0 FIX: Firestore rules only allow isBoard()||isAdmin() to update
        const ALLOWED_ROLES = ['BOARD', 'ADMIN', 'SUPER_ADMIN'];
        if (!callerRole || !ALLOWED_ROLES.includes(callerRole.toUpperCase())) {
          throw new Error('Only board members or administrators can update activity plans');
        }

        try {
          const planRef = doc(db, COLLECTIONS.ACTIVITY_PLANS, planId);

          // P1 FIX: use runTransaction for optimistic concurrency
          await runTransaction(db, async (txn) => {
            const freshSnap = await txn.get(planRef);
            if (!freshSnap.exists()) throw new Error('Activity plan not found');

            const updateData: Record<string, unknown> = {
              updatedAt: Timestamp.now(),
            };

            Object.keys(updates).forEach(key => {
              const value = updates[key as keyof typeof updates];
              if (value !== undefined) {
                if (key === 'proposedDate' && value) {
                  updateData.proposedDate = Timestamp.fromDate(new Date(value as string | Date));
                } else {
                  updateData[key] = value;
                }
              }
            });

            txn.update(planRef, updateData);
          });

          this.invalidateActivityPlansCache();
        } catch (error) {
          errorLoggingService.logError(error as Error, {
            component: 'ActivityPlansService',
            action: 'updateActivityPlan',
            additionalData: { planId },
          });
          throw error;
        }
      }
    );
  }

  /**
   * Submit a Draft activity plan for review.
   * FIX P1: status guard — only allowed when status === 'Draft'.
   */
  static async submitActivityPlan(planId: string, submittedBy: string): Promise<void> {
    return withDevMode<void>(
      () => {},
      async () => {
        try {
          // P2 Fix: wrap live read + updateDoc in runTransaction to close the concurrent submit window.
          const planRef = doc(db, COLLECTIONS.ACTIVITY_PLANS, planId);
          await runTransaction(db, async (txn) => {
            const freshSnap = await txn.get(planRef);
            if (!freshSnap.exists()) throw new Error('Activity plan not found');
            if (freshSnap.data()?.status !== 'Draft') {
              throw new Error(`Cannot submit plan in status "${freshSnap.data()?.status}" — only Draft plans can be submitted`);
            }
            txn.update(planRef, {
              status: 'Submitted',
              submittedBy,
              submittedDate: Timestamp.now(),
              updatedAt: Timestamp.now(),
            });
          });
          this.invalidateActivityPlansCache();
        } catch (error) {
          errorLoggingService.logError(error as Error, {
            component: 'ActivityPlansService',
            action: 'submitActivityPlan',
            additionalData: { planId },
          });
          throw error;
        }
      }
    );
  }

  /**
   * Approve or reject a Submitted activity plan.
   * FIX P1: status guard — only allowed when status === 'Submitted'.
   */
  static async reviewActivityPlan(
    planId: string,
    decision: 'Approved' | 'Rejected',
    reviewedBy: string,
    comments?: string
  ): Promise<void> {
    return withDevMode<void>(
      () => {},
      async () => {
        try {
          // P1 Fix: wrap status check + update in runTransaction to prevent stale-cache race.
          const planRef = doc(db, COLLECTIONS.ACTIVITY_PLANS, planId);
          let planTitle = '';
          let planSubmittedBy = '';
          await runTransaction(db, async (txn) => {
            const freshSnap = await txn.get(planRef);
            if (!freshSnap.exists()) throw new Error('Activity plan not found');
            const freshData = freshSnap.data() as ActivityPlan;
            if (freshData.status !== 'Submitted') {
              throw new Error(`Cannot review plan in status "${freshData.status}" — only Submitted plans can be reviewed`);
            }
            planTitle = freshData.title;
            planSubmittedBy = freshData.submittedBy;
            txn.update(planRef, {
              status: decision,
              reviewedBy,
              reviewedAt: Timestamp.now(),
              reviewComments: comments ?? null,
              updatedAt: Timestamp.now(),
            });
          });
          this.invalidateActivityPlansCache();
          // Reconstruct plan-like object for notification below
          const plan = { title: planTitle, submittedBy: planSubmittedBy };

          // Send notification to plan submitter (non-blocking)
          try {
            const { CommunicationService } = await import('./communicationService');
            await CommunicationService.createNotification({
              memberId: plan.submittedBy,
              title: `Activity Plan ${decision}: ${plan.title}`,
              message: comments
                ? `Your activity plan has been ${decision.toLowerCase()}. Comments: ${comments}`
                : `Your activity plan has been ${decision.toLowerCase()}.`,
              type: decision === 'Approved' ? 'success' : 'warning',
            });
          } catch (notifError) {
            // Non-blocking — notification failure must not prevent the review from persisting
            errorLoggingService.logError(notifError as Error, {
              component: 'ActivityPlansService',
              action: 'reviewActivityPlan_notification',
              additionalData: { planId },
            });
          }
        } catch (error) {
          errorLoggingService.logError(error as Error, {
            component: 'ActivityPlansService',
            action: 'reviewActivityPlan',
            additionalData: { planId },
          });
          throw error;
        }
      }
    );
  }

  /**
   * Create a new version of an existing activity plan.
   * FIX P0: was COLLECTIONS.PROJECTS for the addDoc call.
   * FIX P1: rewritten with writeBatch — new version doc + previousVersionId update in one batch.
   */
  static async createNewVersion(
    planId: string,
    updates: Partial<ActivityPlan>,
    submittedBy: string
  ): Promise<string> {
    return withDevMode<string>(
      () => 'mock-new-version-id',
      async () => {
        try {
          // P2 fix: use runTransaction with a fresh getDoc so that concurrent
          // createNewVersion calls cannot both read the same cached version number
          // and produce duplicate version numbers.
          const skipKeys = new Set([
            'id', 'version', 'previousVersionId',
            'submittedDate', 'reviewedBy', 'reviewedDate',
            'reviewComments', 'createdAt', 'updatedAt',
          ]);

          let newDocId = '';
          await runTransaction(db, async (txn) => {
            const freshSnap = await txn.get(doc(db, COLLECTIONS.ACTIVITY_PLANS, planId));
            if (!freshSnap.exists()) throw new Error('Activity plan not found');
            const freshPlan = mapDoc({ id: freshSnap.id, data: () => freshSnap.data() as Record<string, any> });

            const newVersionData: Record<string, unknown> = {
              version: freshPlan.version + 1,
              previousVersionId: planId,
              status: 'Draft' as const,
              submittedBy,
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
            };

            // Copy existing plan fields (excluding versioning / review fields)
            Object.keys(freshPlan).forEach(key => {
              if (!skipKeys.has(key)) {
                const value = freshPlan[key as keyof ActivityPlan];
                if (value !== undefined) newVersionData[key] = value;
              }
            });

            // Apply caller-provided overrides
            Object.keys(updates).forEach(key => {
              const value = updates[key as keyof typeof updates];
              if (value !== undefined) newVersionData[key] = value;
            });

            const newDocRef = doc(collection(db, COLLECTIONS.ACTIVITY_PLANS));
            newDocId = newDocRef.id;
            txn.set(newDocRef, newVersionData);
            txn.update(doc(db, COLLECTIONS.ACTIVITY_PLANS, planId), {
              previousVersionId: newDocRef.id,
              updatedAt: Timestamp.now(),
            });
          });

          this.invalidateActivityPlansCache();
          return newDocId;
        } catch (error) {
          errorLoggingService.logError(error as Error, {
            component: 'ActivityPlansService',
            action: 'createNewVersion',
            additionalData: { planId },
          });
          throw error;
        }
      }
    );
  }

  /** Delete an activity plan. */
  // FIX P0: was COLLECTIONS.PROJECTS
  // FIX P1: added withDevMode, cache invalidation, errorLoggingService
  // FIX P2: clean up version-chain docs that reference this plan before deleting the main doc
  static async deleteActivityPlan(planId: string): Promise<void> {
    return withDevMode<void>(
      () => {},
      async () => {
        try {
          // P2 FIX: iteratively walk full version chain to prevent orphaned descendants.
          const toDelete = [planId];
          let currentIds = [planId];
          while (currentIds.length > 0) {
            const q = query(
              collection(db, COLLECTIONS.ACTIVITY_PLANS),
              where('previousVersionId', 'in', currentIds)
            );
            const snap = await getDocs(q);
            if (snap.empty) break;
            const childIds = snap.docs.map(d => d.id);
            toDelete.push(...childIds);
            currentIds = childIds;
            if (toDelete.length >= 490) {
              await errorLoggingService.logError(
                new Error('deleteActivityPlan: version chain exceeds 490 documents, deletion incomplete'),
                { component: 'ActivityPlansService', action: 'deleteActivityPlan', additionalData: { planId, deletedCount: toDelete.length } }
              );
              throw new Error('Activity plan version chain is too large to delete in one operation. Please contact an administrator.');
            }
          }

          const batch = writeBatch(db);
          toDelete.forEach(id => batch.delete(doc(db, COLLECTIONS.ACTIVITY_PLANS, id)));
          await batch.commit();

          this.invalidateActivityPlansCache(); // FIX P1
        } catch (error) {
          errorLoggingService.logError(error as Error, {
            component: 'ActivityPlansService',
            action: 'deleteActivityPlan',
            additionalData: { planId },
          });
          throw error;
        }
      }
    );
  }
}
