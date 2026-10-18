import { describe, it, expect, vi, beforeEach } from 'vitest';

// R-039: check-in must award attendance points after the check-in batch commits.
const calls: string[] = [];
const award = vi.fn(async () => { calls.push('award'); return 'pts'; });

vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', async (orig) => ({
  ...(await orig<typeof import('firebase/firestore')>()),
  doc: vi.fn(() => ({})),
  updateDoc: vi.fn(async () => { calls.push('updateDoc'); }),
  writeBatch: vi.fn(() => ({ update: vi.fn(), commit: vi.fn(async () => { calls.push('commit'); }) })),
  arrayUnion: vi.fn((x) => x),
}));
vi.mock('./pointsService', () => ({ PointsService: { awardEventAttendancePoints: award } }));
vi.mock('./membersService', () => ({ MembersService: { recalculateAttendance: vi.fn(async () => {}) } }));
vi.mock('./errorLoggingService', () => ({ errorLoggingService: { logError: vi.fn() } }));
vi.mock('../utils/devMode', () => ({ isDevMode: () => false, withDevMode: (_m: unknown, real: () => unknown) => real() }));

const { EventsService } = await import('./eventsService');
const { EventRegistrationService } = await import('./eventRegistrationService');
const { errorLoggingService } = await import('./errorLoggingService');

describe('EventsService.markAttendance attendance points', () => {
  beforeEach(() => {
    calls.length = 0;
    vi.clearAllMocks();
    vi.spyOn(EventsService, 'getEventById').mockResolvedValue({ id: 'e1', type: 'Training' } as any);
    vi.spyOn(EventsService, 'invalidateEventsCache').mockImplementation(() => {});
  });

  it('awards points with the event type after the check-in batch commits', async () => {
    vi.spyOn(EventRegistrationService, 'getByEventAndMember').mockResolvedValue({ id: 'r1', status: 'registered' } as any);
    await EventsService.markAttendance('e1', 'm1');
    expect(award).toHaveBeenCalledWith('m1', 'e1', 'Training');
    expect(calls).toEqual(['commit', 'award']);
  });

  it('awards points when there is no registration doc', async () => {
    vi.spyOn(EventRegistrationService, 'getByEventAndMember').mockResolvedValue(null as any);
    await EventsService.markAttendance('e1', 'm1');
    expect(calls).toEqual(['updateDoc', 'award']);
  });

  it('keeps the check-in and logs the error when awarding points fails', async () => {
    vi.spyOn(EventRegistrationService, 'getByEventAndMember').mockResolvedValue({ id: 'r1', status: 'registered' } as any);
    award.mockRejectedValueOnce(new Error('rules denied'));
    await expect(EventsService.markAttendance('e1', 'm1')).resolves.toBeUndefined();
    expect(errorLoggingService.logError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ context: 'EventsService.markAttendance.points' }),
    );
  });

  it('does not award points for a cancelled registration', async () => {
    vi.spyOn(EventRegistrationService, 'getByEventAndMember').mockResolvedValue({ id: 'r1', status: 'cancelled' } as any);
    await expect(EventsService.markAttendance('e1', 'm1')).rejects.toThrow('cancelled');
    expect(award).not.toHaveBeenCalled();
  });
});
