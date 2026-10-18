import { describe, it, expect, vi, beforeEach } from 'vitest';

// R-039: check-in must award attendance points after the check-in batch commits.
const calls: string[] = [];
const award = vi.fn(async () => { calls.push('award'); return 'pts'; });
const awardPoints = vi.fn(async () => 'rev');
const updateDocMock = vi.fn(async (_ref: unknown, data?: unknown) => { calls.push('updateDoc'); return data; });

vi.mock('../config/firebase', () => ({ db: {}, auth: { currentUser: { uid: 'admin-uid' } } }));
vi.mock('firebase/firestore', async (orig) => ({
  ...(await orig<typeof import('firebase/firestore')>()),
  doc: vi.fn(() => ({})),
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  updateDoc: (ref: unknown, data?: unknown) => updateDocMock(ref, data),
  getDocs: vi.fn(async () => ({ docs: [{ data: () => ({ amount: 10 }) }] })),
  runTransaction: vi.fn(async (_db, fn) => fn({ get: async () => ({ exists: () => false }), update: vi.fn() })),
  writeBatch: vi.fn(() => ({ update: vi.fn(), commit: vi.fn(async () => { calls.push('commit'); }) })),
  arrayUnion: vi.fn((x) => x),
  arrayRemove: vi.fn((x) => x),
}));
vi.mock('./pointsService', () => ({ PointsService: { awardEventAttendancePoints: award, awardPoints } }));
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

describe('EventsService.undoAttendance points reversal', () => {
  beforeEach(() => {
    calls.length = 0;
    vi.clearAllMocks();
    vi.spyOn(EventsService, 'invalidateEventsCache').mockImplementation(() => {});
    vi.spyOn(EventRegistrationService, 'getByEventAndMember').mockResolvedValue({ id: 'e1_m1', status: 'checked_in' } as any);
  });

  it('reverses another member\'s points with the caller as awardedBy', async () => {
    await EventsService.undoAttendance('e1', 'm1');
    expect(awardPoints).toHaveBeenCalledWith('m1', -10, 'EVENT_ATTENDANCE', 'Reversed: attendance undone', 'e1', 'event', undefined, 'admin-uid');
  });

  it('releases the reversal claim and logs when the reversal fails', async () => {
    awardPoints.mockRejectedValueOnce(new Error('rules denied'));
    await EventsService.undoAttendance('e1', 'm1');
    expect(updateDocMock).toHaveBeenCalledWith(expect.anything(), { pointsReversed: false });
    expect(errorLoggingService.logError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ context: 'EventsService.undoAttendance' }),
    );
  });
});
