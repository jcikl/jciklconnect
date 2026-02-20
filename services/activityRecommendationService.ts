// Activity Recommendation - 基于参与历史的简单推荐，减少无关打扰（Story 9.1 / FR28）
import { EventsService } from './eventsService';
import { EventRegistrationService } from './eventRegistrationService';
import type { Event } from '../types';

export const ActivityRecommendationService = {
  /**
   * 根据会员过往参与的活动类型，推荐即将举办的活动（同类型优先）
   */
  async getRecommendedEvents(memberId: string, limitCount: number = 5): Promise<Event[]> {
    const [registrations, allEvents] = await Promise.all([
      EventRegistrationService.listByMember(memberId),
      EventsService.getAllEvents(),
    ]);
    const now = new Date().toISOString();
    const upcoming = allEvents.filter(
      (e) => e.status === 'Upcoming' && e.date >= now
    ) as Event[];
    if (upcoming.length === 0) return [];

    const eventTypeCount: Record<string, number> = {};
    for (const r of registrations) {
      const evt = allEvents.find((e) => e.id === r.eventId);
      if (evt?.type) eventTypeCount[evt.type] = (eventTypeCount[evt.type] ?? 0) + 1;
    }

    const scored = upcoming.map((e) => {
      const score = eventTypeCount[e.type] ?? 0;
      return { event: e, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limitCount).map((x) => x.event);
  },
};
