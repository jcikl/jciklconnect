import { getMYTTodayStr } from './dateUtils';

export type ActivityPhase = 'upcoming' | 'ongoing' | 'completed';

/**
 * Phase of an activity from its dates (MYT, YYYY-MM-DD strings compare as dates):
 * completed = status "Completed" or the end date has passed; upcoming = starts after today;
 * ongoing = today is between start and end. Other statuses are ignored because imported
 * Roadmap events keep "Active" after they end. Returns null when there is no start date.
 */
export function activityPhase(
  activity: { date?: string; endDate?: string; status?: string },
  today: string = getMYTTodayStr(),
): ActivityPhase | null {
  const start = (activity.date ?? '').slice(0, 10);
  if (!start) return null;
  const endRaw = (activity.endDate ?? '').slice(0, 10);
  const end = endRaw && endRaw >= start ? endRaw : start;
  if (activity.status === 'Completed' || end < today) return 'completed';
  if (start > today) return 'upcoming';
  return 'ongoing';
}
