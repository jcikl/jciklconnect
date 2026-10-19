import { describe, it, expect, vi, beforeEach } from 'vitest';

// The dashboard must read only today-and-later events, not the whole projects collection.
const whereMock = vi.fn((...args: unknown[]) => ({ where: args }));
const getDocsMock = vi.fn();

vi.mock('../config/firebase', () => ({ db: {}, auth: { currentUser: null } }));
vi.mock('firebase/firestore', async (orig) => ({
  ...(await orig<typeof import('firebase/firestore')>()),
  collection: vi.fn(() => ({})),
  query: vi.fn((...parts: unknown[]) => parts),
  where: (...args: unknown[]) => whereMock(...args),
  or: (...parts: unknown[]) => ({ or: parts }),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
}));
vi.mock('./errorLoggingService', () => ({ errorLoggingService: { logError: vi.fn() } }));
vi.mock('../utils/devMode', () => ({ isDevMode: () => false, withDevMode: (_m: unknown, real: () => unknown) => real() }));
vi.mock('../utils/dateUtils', async (orig) => ({ ...(await orig<typeof import('../utils/dateUtils')>()), getMYTTodayStr: () => '2026-10-19' }));

const { EventsService } = await import('./eventsService');

const doc = (id: string, data: Record<string, unknown>) => ({ id, data: () => ({ title: id, ...data }) });

describe('EventsService.getUpcomingEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    EventsService.invalidateEventsCache();
    getDocsMock.mockResolvedValue({
      docs: [
        doc('later', { eventStartDate: '2026-11-11', status: 'Active' }),
        doc('today', { eventStartDate: '2026-10-19', status: 'Active' }),
        doc('draft', { eventStartDate: '2026-10-22', status: 'Draft' }),
        doc('soon', { eventStartDate: '2026-10-22', status: 'Upcoming' }),
      ],
    });
  });

  it('queries by start date from today (MYT) instead of loading every event', async () => {
    await EventsService.getUpcomingEvents();
    expect(whereMock).toHaveBeenCalledTimes(1);
    expect(whereMock).toHaveBeenCalledWith('eventStartDate', '>=', '2026-10-19');
  });

  it('keeps listed statuses only, soonest first, and applies the optional limit', async () => {
    expect((await EventsService.getUpcomingEvents()).map(e => e.id)).toEqual(['today', 'soon', 'later']);
    expect((await EventsService.getUpcomingEvents(2)).map(e => e.id)).toEqual(['today', 'soon']);
  });

  it('is cleared together with the all-events cache after event writes', async () => {
    await EventsService.getUpcomingEvents();
    await EventsService.getUpcomingEvents();
    expect(getDocsMock).toHaveBeenCalledTimes(1);
    EventsService.invalidateEventsCache();
    await EventsService.getUpcomingEvents();
    expect(getDocsMock).toHaveBeenCalledTimes(2);
  });
});

describe('EventsService.getKlEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    EventsService.invalidateEventsCache();
    getDocsMock.mockResolvedValue({
      docs: [
        doc('old', { eventStartDate: '2024-05-01', status: 'Active', hostingLo: 'JCI Kuala Lumpur' }),
        doc('cancelled', { eventStartDate: '2026-01-01', status: 'Cancelled', hostingLo: 'JCI Kuala Lumpur' }),
        doc('new', { eventStartDate: '2026-11-11', status: 'Active', coHosting: ['JCI Kuala Lumpur'] }),
      ],
    });
  });

  it('asks for KL-hosted OR KL-co-hosted events in one query instead of every event', async () => {
    await EventsService.getKlEvents();
    expect(whereMock).toHaveBeenCalledWith('hostingLo', '==', 'JCI Kuala Lumpur');
    expect(whereMock).toHaveBeenCalledWith('coHosting', 'array-contains', 'JCI Kuala Lumpur');
    expect(whereMock).toHaveBeenCalledTimes(2);
  });

  it('drops cancelled events and returns newest first', async () => {
    expect((await EventsService.getKlEvents()).map(e => e.id)).toEqual(['new', 'old']);
  });
});
