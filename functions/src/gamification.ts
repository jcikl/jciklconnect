import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

// Function to check and award badges automatically
// Collections written by this function — triggering on them would cause an infinite loop
const SELF_TRIGGERING_COLLECTIONS = ['notifications', 'points', 'badgeAwards', 'achievementProgress', 'pointEscrow'];

// F04 FIX: only fire on collections that actually affect badge criteria.
// Firing on every collection wastes reads and risks timeout on large datasets.
const BADGE_RELEVANT_COLLECTIONS = ['members', 'points', 'eventRegistrations', 'achievements'];

export const checkBadgeAwards = functions
  .runWith({ timeoutSeconds: 300, memory: '512MB' })
  .firestore
  .document('{collection}/{documentId}')
  .onWrite(async (change, context) => {
    // Guard: skip if the triggering collection is one we write to, to prevent infinite loops
    const collectionName = context.params.collection;
    if (SELF_TRIGGERING_COLLECTIONS.includes(collectionName)) return null;

    // F04 FIX step 1: skip collections that cannot affect any badge criteria
    if (!BADGE_RELEVANT_COLLECTIONS.includes(collectionName)) return null;

    // Get all active badges
    const badgesSnapshot = await db.collection('badges').get();

    if (badgesSnapshot.empty) {
      return null;
    }

    // Get member ID from the document (if applicable)
    const document = change.after.exists ? change.after.data() : null;
    let memberId: string | null = null;

    // Try to extract member ID from various possible fields
    if (document) {
      memberId = document.memberId || document.authorId || document.userId || null;
    }

    if (!memberId) {
      return null; // No member to award badge to
    }

    // F04 FIX step 2: run all per-badge checks in parallel instead of sequentially
    // to avoid O(N*M) sequential Firestore reads that cause timeouts.
    async function checkSingleBadge(badgeDoc: FirebaseFirestore.QueryDocumentSnapshot): Promise<void> {
      const badge = badgeDoc.data();
      const badgeId = badgeDoc.id;

      try {
        // Evaluate badge criteria (existingAward query removed — F03: the deterministic
        // document ID below makes a duplicate write a no-op, so the pre-check is redundant
        // and was itself a race-condition source).
        const criteriaResult = await evaluateBadgeCriteria(badge.criteria, memberId!);

        if (criteriaResult.eligible) {
          // Fetch current member doc so we can append to member.badges atomically
          const memberSnap = await db.collection('members').doc(memberId).get();
          const memberData = memberSnap.exists ? memberSnap.data() : null;
          const currentBadges: any[] = (memberData && memberData.badges) ? memberData.badges : [];
          const alreadyInMember = currentBadges.some((b: any) => b.id === badgeId);

          // F03 fix: use a deterministic document ID so concurrent executions that both
          // pass the criteria check write to the same document. The second batch.set()
          // is an idempotent overwrite with merge:false; no duplicate record is created.
          const batch = db.batch();

          const badgeAwardRef = db.collection('badgeAwards').doc(memberId + '_' + badgeId);
          batch.set(badgeAwardRef, {
            // Use 'awardId' to match gamificationService.awardAward() schema so UI hooks can join correctly
            awardId: badgeId,
            memberId: memberId,
            earnedAt: admin.firestore.FieldValue.serverTimestamp(),
            awardedBy: null, // Automatic award
            reason: `Badge awarded automatically: ${badge.name}`,
            criteria: badge.criteria,
            progress: criteriaResult.progress
          }, { merge: false });

          if (!alreadyInMember) {
            const userBadge = {
              id: badgeId,
              name: badge.name,
              icon: badge.icon || '',
              description: badge.description || '',
              earnedDate: new Date().toISOString()
            };
            batch.update(db.collection('members').doc(memberId), {
              badges: admin.firestore.FieldValue.arrayUnion(userBadge)
            });
          }

          await batch.commit();

          // Award points if badge has point value (separate from batch — survivable failure)
          if (badge.pointValue && badge.pointValue > 0) {
            try {
              await db.collection('points').add({
                memberId: memberId,
                points: badge.pointValue,
                reason: `Badge awarded: ${badge.name}`,
                source: 'badge',
                sourceId: badgeId,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
              });
            } catch (pointsError) {
              console.error(`[checkBadgeAwards] Points award failed for badge ${badgeId} member ${memberId}:`, pointsError);
            }
          }

          // Create notification (separate from batch — survivable failure)
          try {
            await db.collection('notifications').add({
              memberId: memberId,
              type: 'badge_awarded',
              title: `Badge Earned: ${badge.name}`,
              message: `Congratulations! You have earned the "${badge.name}" badge. ${badge.description}`,
              data: {
                badgeId: badgeId,
                badgeName: badge.name,
                pointsAwarded: badge.pointValue || 0
              },
              read: false,
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
          } catch (notifError) {
            console.error(`[checkBadgeAwards] Notification failed for badge ${badgeId} member ${memberId}:`, notifError);
          }

          console.log(`Badge ${badge.name} awarded to member ${memberId!}`);
        }
      } catch (error) {
        console.error(`Error checking badge ${badgeId} for member ${memberId!}:`, error);
      }
    }

    // F04 FIX step 2: run all badge checks in parallel
    await Promise.all(badgesSnapshot.docs.map(badgeDoc => checkSingleBadge(badgeDoc)));

    return null;
  });

// Helper function to evaluate badge criteria
async function evaluateBadgeCriteria(criteria: any, memberId: string): Promise<{ eligible: boolean; progress: any }> {
  switch (criteria.type) {
    case 'event_attendance':
      return await checkEventAttendanceCriteria(criteria, memberId);
    
    case 'project_completion':
      return await checkProjectCompletionCriteria(criteria, memberId);
    
    case 'points_threshold':
      return await checkPointsThresholdCriteria(criteria, memberId);
    
    case 'custom':
      return await checkCustomCriteria(criteria, memberId);
    
    default:
      return { eligible: false, progress: null };
  }
}

// Helper function to check event attendance criteria
async function checkEventAttendanceCriteria(criteria: any, memberId: string): Promise<{ eligible: boolean; progress: any }> {
  const eventsSnapshot = await db.collection('events')
    .where('attendees', 'array-contains', memberId)
    .get();

  const attendedCount = eventsSnapshot.size;
  const threshold = criteria.threshold || 1;

  return {
    eligible: attendedCount >= threshold,
    progress: {
      current: attendedCount,
      required: threshold,
      percentage: Math.min((attendedCount / threshold) * 100, 100)
    }
  };
}

// Helper function to check project completion criteria
async function checkProjectCompletionCriteria(criteria: any, memberId: string): Promise<{ eligible: boolean; progress: any }> {
  const projectsSnapshot = await db.collection('projects')
    .where('members', 'array-contains', memberId)
    .where('status', '==', 'completed')
    .get();

  const completedCount = projectsSnapshot.size;
  const threshold = criteria.threshold || 1;

  return {
    eligible: completedCount >= threshold,
    progress: {
      current: completedCount,
      required: threshold,
      percentage: Math.min((completedCount / threshold) * 100, 100)
    }
  };
}

// Helper function to check points threshold criteria
async function checkPointsThresholdCriteria(criteria: any, memberId: string): Promise<{ eligible: boolean; progress: any }> {
  const pointsSnapshot = await db.collection('points')
    .where('memberId', '==', memberId)
    .get();

  const totalPoints = pointsSnapshot.docs.reduce((sum, doc) => sum + (doc.data().points || 0), 0);
  const threshold = criteria.threshold || 100;

  return {
    eligible: totalPoints >= threshold,
    progress: {
      current: totalPoints,
      required: threshold,
      percentage: Math.min((totalPoints / threshold) * 100, 100)
    }
  };
}

// Helper function to check custom criteria
async function checkCustomCriteria(criteria: any, memberId: string): Promise<{ eligible: boolean; progress: any }> {
  // Custom criteria would be implemented based on specific requirements
  // For now, return false
  return { eligible: false, progress: null };
}

// Function to update achievement progress
export const updateAchievementProgress = functions
  .runWith({ timeoutSeconds: 300, memory: '512MB' })
  .firestore
  .document('{collection}/{documentId}')
  .onWrite(async (change, context) => {
    // Guard: skip if the triggering collection is one we write to, to prevent infinite loops
    const collectionName = context.params.collection;
    if (SELF_TRIGGERING_COLLECTIONS.includes(collectionName)) return null;

    // Get all achievements
    const achievementsSnapshot = await db.collection('achievements').get();
    
    if (achievementsSnapshot.empty) {
      return null;
    }

    // Get member ID from the document
    const document = change.after.exists ? change.after.data() : null;
    let memberId: string | null = null;

    if (document) {
      memberId = document.memberId || document.authorId || document.userId || null;
    }

    if (!memberId) {
      return null;
    }

    // Update progress for each achievement
    for (const achievementDoc of achievementsSnapshot.docs) {
      const achievement = achievementDoc.data();
      const achievementId = achievementDoc.id;

      try {
        // Calculate current progress outside the transaction (read-only, no contention risk)
        const progress = await calculateAchievementProgress(achievement, memberId);

        // F07 fix: use a deterministic document ID and wrap the read-compare-write in a
        // Firestore transaction to eliminate the TOCTOU race where two concurrent executions
        // both read stale progress and both award the same milestone rewards.
        const progressRef = db.collection('achievementProgress').doc(memberId + '_' + achievementId);

        let newMilestones: string[] = [];

        await db.runTransaction(async (txn) => {
          const progressSnap = await txn.get(progressRef);
          const currentData = progressSnap.exists
            ? progressSnap.data()!
            : { memberId, achievementId, currentProgress: 0, completedMilestones: [] };

          // Compute milestones that are newly completed in this invocation
          newMilestones = progress.completedMilestones.filter(
            (m: string) => !currentData.completedMilestones.includes(m)
          );

          if (
            currentData.currentProgress === progress.current &&
            newMilestones.length === 0
          ) {
            // No change — skip the write to avoid unnecessary document churn
            return;
          }

          txn.set(progressRef, {
            memberId,
            achievementId,
            currentProgress: progress.current,
            completedMilestones: progress.completedMilestones,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        });

        // Award points and notifications AFTER the transaction so the transaction
        // stays lightweight and retryable without duplicating side-effects.
        for (const milestoneLevel of newMilestones) {
          const milestone = achievement.milestones.find((m: any) => m.level === milestoneLevel);
          if (milestone) {
            if (milestone.pointValue > 0) {
              await db.collection('points').add({
                memberId: memberId,
                points: milestone.pointValue,
                reason: `Achievement milestone: ${achievement.name} - ${milestone.level}`,
                source: 'achievement',
                sourceId: achievementId,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
              });
            }

            await db.collection('notifications').add({
              memberId: memberId,
              type: 'achievement_milestone',
              title: `Milestone Reached: ${achievement.name}`,
              message: `Congratulations! You have reached the ${milestone.level} level of "${achievement.name}".`,
              data: {
                achievementId: achievementId,
                achievementName: achievement.name,
                milestoneLevel: milestone.level,
                pointsAwarded: milestone.pointValue || 0
              },
              read: false,
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        }
      } catch (error) {
        console.error(`Error updating achievement progress for ${achievementId}:`, error);
      }
    }

    return null;
  });

// Helper function to calculate achievement progress
async function calculateAchievementProgress(achievement: any, memberId: string): Promise<{ current: number; completedMilestones: string[] }> {
  // This would be implemented based on the specific achievement criteria
  // For now, return a placeholder implementation
  
  let current = 0;
  const completedMilestones: string[] = [];

  // Example: Event attendance achievement
  if (achievement.category === 'participation') {
    const eventsSnapshot = await db.collection('events')
      .where('attendees', 'array-contains', memberId)
      .get();
    
    current = eventsSnapshot.size;
  }

  // Check which milestones are completed
  for (const milestone of achievement.milestones) {
    if (current >= milestone.threshold) {
      completedMilestones.push(milestone.level);
    }
  }

  return { current, completedMilestones };
}

// Function to calculate points based on rules
export const calculatePointsFromRules = functions
  .runWith({ timeoutSeconds: 300, memory: '512MB' })
  .https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  let { memberId, trigger, activityData, idempotencyKey } = data;

  if (!memberId || !trigger) {
    throw new functions.https.HttpsError('invalid-argument', 'Member ID and trigger are required');
  }

  // F06 FIX: if caller supplied an idempotencyKey, check for a prior write before proceeding.
  // Callers that do not pass idempotencyKey continue to work exactly as before.
  if (idempotencyKey) {
    const existing = await db.collection('points')
      .where('idempotencyKey', '==', idempotencyKey)
      .limit(1)
      .get();
    if (!existing.empty) {
      return { success: true, cached: true, pointsId: existing.docs[0].id };
    }
  }

  // Security: only ADMIN/SUPER_ADMIN/BOARD may award points to an arbitrary memberId.
  // All other callers are forced to award points to themselves only.
  if (context.auth.uid !== memberId) {
    const callerDoc = await db.collection('members').doc(context.auth.uid).get();
    const callerRole = callerDoc.data()?.role;
    if (!['ADMIN', 'SUPER_ADMIN', 'BOARD'].includes(callerRole)) {
      memberId = context.auth.uid;
    }
  }

  // Get all active point rules for this trigger
  const rulesSnapshot = await db.collection('pointsRules')
    .where('trigger', '==', trigger)
    .where('enabled', '==', true)
    .get();

  if (rulesSnapshot.empty) {
    return { totalPoints: 0, appliedRules: [] };
  }

  let totalPoints = 0;
  const appliedRules = [];

  // Apply each rule
  for (const ruleDoc of rulesSnapshot.docs) {
    const rule = ruleDoc.data();
    
    try {
      // Check if rule conditions are met
      const conditionsMet = rule.conditions.every((condition: any) => {
        const fieldValue = activityData[condition.field];
        return evaluateCondition(condition, { [condition.field]: fieldValue });
      });

      if (conditionsMet) {
        // Calculate points with multiplier and weight
        const rulePoints = (rule.pointValue * rule.multiplier * rule.weight) || 0;
        totalPoints += rulePoints;
        
        appliedRules.push({
          ruleId: ruleDoc.id,
          ruleName: rule.name,
          points: rulePoints,
          basePoints: rule.pointValue,
          multiplier: rule.multiplier,
          weight: rule.weight
        });
      }
    } catch (error) {
      console.error(`Error applying point rule ${ruleDoc.id}:`, error);
    }
  }

  // Award the calculated points
  if (totalPoints > 0) {
    const pointsDoc: Record<string, any> = {
      memberId: memberId,
      points: totalPoints,
      reason: `Activity: ${trigger}`,
      source: 'rules',
      appliedRules: appliedRules,
      activityData: activityData,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    // F06 FIX: persist idempotencyKey so future duplicate calls can be detected.
    if (idempotencyKey) {
      pointsDoc.idempotencyKey = idempotencyKey;
    }
    await db.collection('points').add(pointsDoc);
  }

  return {
    totalPoints: totalPoints,
    appliedRules: appliedRules
  };
});

// Helper function to evaluate condition (reused from automation.ts)
function evaluateCondition(config: any, data: any): boolean {
  const { field, operator, value } = config;
  const fieldValue = data[field];

  switch (operator) {
    case 'equals':
      return fieldValue === value;
    case 'not_equals':
      return fieldValue !== value;
    case 'greater_than':
      return fieldValue > value;
    case 'less_than':
      return fieldValue < value;
    case 'contains':
      return String(fieldValue).includes(String(value));
    default:
      return false;
  }
}

export const gamificationFunctions = {
  checkBadgeAwards,
  updateAchievementProgress,
  calculatePointsFromRules
};