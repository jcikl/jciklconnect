import { AwardDefinition } from '../types';

/**
 * Pure function: calculates progress percentage (0–100) toward an award.
 * Milestone-based awards use segment logic; simple awards use linear ratio.
 * Extracted here so tests can import the same implementation as the service.
 */
export function calculateAwardProgress(award: AwardDefinition, currentProgressValue: number): number {
  if (award.milestones && award.milestones.length > 0) {
    const sortedMilestones = [...award.milestones].sort((a, b) => a.threshold - b.threshold);
    let lastThreshold = 0;
    let currentTarget = sortedMilestones[0];

    for (const milestone of sortedMilestones) {
      if (currentProgressValue >= milestone.threshold) {
        lastThreshold = milestone.threshold;
      } else {
        currentTarget = milestone;
        break;
      }
    }

    if (currentProgressValue >= sortedMilestones[sortedMilestones.length - 1].threshold) {
      return 100;
    }

    const range = currentTarget.threshold - lastThreshold;
    const progressInRange = currentProgressValue - lastThreshold;
    return Math.min(100, Math.round((progressInRange / range) * 100));
  }

  const threshold = award.criteria.value;
  if (threshold <= 0) return 0;
  return Math.min(100, Math.round((currentProgressValue / threshold) * 100));
}
