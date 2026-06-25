import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

// Function to check and award badges automatically
export const checkBadgeAwards = functions.firestore
  .document('{collection}/{documentId}')
  .onWrite(async (change, context) => {
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

    // Check each badge criteria
    for (const badgeDoc of badgesSnapshot.docs) {
      const badge = badgeDoc.data();
      const badgeId = badgeDoc.id;

      try {
        // Check if member already has this badge
        const existingAward = await db.collection('badgeAwards')
          .where('badgeId', '==', badgeId)
          .where('memberId', '==', memberId)
          .get();

        if (!existingAward.empty) {
          continue; // Member already has this badge
        }

        // Evaluate badge criteria
        const criteriaResult = await evaluateBadgeCriteria(badge.criteria, memberId);
        
        if (criteriaResult.eligible) {
          // Award the badge
          await db.collection('badgeAwards').add({
            badgeId: badgeId,
            memberId: memberId,
            awardedAt: admin.firestore.FieldValue.serverTimestamp(),
            awardedBy: null, // Automatic award
            criteria: badge.criteria,
            progress: criteriaResult.progress
          });

          // Award points if badge has point value
          if (badge.pointValue && badge.pointValue > 0) {
            await db.collection('points').add({
              memberId: memberId,
              points: badge.pointValue,
              reason: `Badge awarded: ${badge.name}`,
              source: 'badge',
              sourceId: badgeId,
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }

          // Create notification
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

          console.log(`Badge ${badge.name} awarded to member ${memberId}`);
        }
      } catch (error) {
        console.error(`Error checking badge ${badgeId} for member ${memberId}:`, error);
      }
    }

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
export const updateAchievementProgress = functions.firestore
  .document('{collection}/{documentId}')
  .onWrite(async (change, context) => {
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
        // Calculate current progress
        const progress = await calculateAchievementProgress(achievement, memberId);
        
        // Get or create progress record
        const progressQuery = await db.collection('achievementProgress')
          .where('memberId', '==', memberId)
          .where('achievementId', '==', achievementId)
          .get();

        let progressDoc;
        if (progressQuery.empty) {
          // Create new progress record
          progressDoc = await db.collection('achievementProgress').add({
            memberId: memberId,
            achievementId: achievementId,
            currentProgress: progress.current,
            completedMilestones: progress.completedMilestones,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
          });
        } else {
          // Update existing progress record
          progressDoc = progressQuery.docs[0];
          const currentData = progressDoc.data();
          
          // Only update if progress has changed
          if (currentData.currentProgress !== progress.current || 
              JSON.stringify(currentData.completedMilestones) !== JSON.stringify(progress.completedMilestones)) {
            
            await progressDoc.ref.update({
              currentProgress: progress.current,
              completedMilestones: progress.completedMilestones,
              lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            });

            // Check for new milestone completions
            const newMilestones = progress.completedMilestones.filter(
              (milestone: string) => !currentData.completedMilestones.includes(milestone)
            );

            // Award rewards for new milestones
            for (const milestoneLevel of newMilestones) {
              const milestone = achievement.milestones.find((m: any) => m.level === milestoneLevel);
              if (milestone) {
                // Award points
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

                // Create notification
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
export const calculatePointsFromRules = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { memberId, trigger, activityData } = data;

  if (!memberId || !trigger) {
    throw new functions.https.HttpsError('invalid-argument', 'Member ID and trigger are required');
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
    await db.collection('points').add({
      memberId: memberId,
      points: totalPoints,
      reason: `Activity: ${trigger}`,
      source: 'rules',
      appliedRules: appliedRules,
      activityData: activityData,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
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