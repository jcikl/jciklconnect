import { describe, it, expect } from 'vitest';
import { activityPhase } from './activityPhase';

const today = '2026-10-19';

describe('activityPhase', () => {
  it('upcoming / ongoing / completed by start and end dates', () => {
    expect(activityPhase({ date: '2026-10-22', endDate: '2026-10-24' }, today)).toBe('upcoming');
    expect(activityPhase({ date: '2026-10-18', endDate: '2026-10-20' }, today)).toBe('ongoing');
    expect(activityPhase({ date: '2026-10-19' }, today)).toBe('ongoing');
    expect(activityPhase({ date: '2026-10-10', endDate: '2026-10-18' }, today)).toBe('completed');
  });
  it('ignores a stale "Active" status but honours "Completed"', () => {
    expect(activityPhase({ date: '2025-03-01', status: 'Active' }, today)).toBe('completed');
    expect(activityPhase({ date: '2026-10-22', status: 'Completed' }, today)).toBe('completed');
  });
  it('treats an end date before the start as a single-day activity, and no date as unknown', () => {
    expect(activityPhase({ date: '2026-10-18', endDate: '2026-10-01' }, today)).toBe('completed');
    expect(activityPhase({ date: '' }, today)).toBeNull();
  });
});
