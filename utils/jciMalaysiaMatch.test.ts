import { describe, it, expect } from 'vitest';
import { buildSourceIndex, matchMember, planUpdate, phoneKey, toIsoDate, pickRow } from './jciMalaysiaMatch.mjs';

const row = (o: Record<string, unknown>) => ({ chapter: 'JCI Kuala Lumpur', joindate: '2020-01-01 10:00:00', ...o });

describe('jciMalaysiaMatch', () => {
  it('normalises phone numbers and dates', () => {
    expect(phoneKey('+60 12-345 6789')).toBe('123456789');
    expect(phoneKey('012-3456789')).toBe('123456789');
    expect(phoneKey('123')).toBe('');
    expect(toIsoDate('2026-03-01 11:11:02')).toBe('2026-03-01');
    expect(toIsoDate('')).toBe('');
  });

  it('prefers the JCI Kuala Lumpur row, then the latest join date', () => {
    const rows = [
      row({ membership: 'A', chapter: 'JCI Kuala Lumpur West', joindate: '2024-01-01' }),
      row({ membership: 'B', joindate: '2019-01-01' }),
      row({ membership: 'C', joindate: '2022-01-01' }),
    ];
    expect(pickRow(rows)?.membership).toBe('C');
  });

  it('matches by stored membership no. first, then email, then phone', () => {
    const index = buildSourceIndex([
      row({ membership: 'JCIK-1', email: 'a@x.com', contact: '0121111111' }),
      row({ membership: 'JCIK-2', email: 'b@x.com', contact: '0122222222' }),
    ]);
    expect(matchMember({ jciCareer: { jciMalaysiaMembershipNo: 'jcik-2' }, contact: { email: 'a@x.com' } }, index))
      .toMatchObject({ status: 'matched', by: 'membershipNo', row: { membership: 'JCIK-2' } });
    expect(matchMember({ contact: { email: 'A@X.com ' } }, index)).toMatchObject({ status: 'matched', by: 'email' });
    expect(matchMember({ contact: { phone: '+6012-222 2222' } }, index)).toMatchObject({ status: 'matched', by: 'phone', row: { membership: 'JCIK-2' } });
    expect(matchMember({ contact: { email: 'none@x.com' } }, index)).toEqual({ status: 'none' });
  });

  it('flags email and phone that point to different people', () => {
    const index = buildSourceIndex([
      row({ membership: 'JCIK-1', email: 'a@x.com' }),
      row({ membership: 'JCIK-2', contact: '0122222222' }),
    ]);
    expect(matchMember({ contact: { email: 'a@x.com', phone: '0122222222' } }, index)).toMatchObject({
      status: 'conflict', candidates: { email: { membership: 'JCIK-1' }, phone: { membership: 'JCIK-2' } },
    });
  });

  it('two different people both without a membership no. are still a conflict', () => {
    const index = buildSourceIndex([
      row({ id: '1', membership: 'N/A', email: 'a@x.com' }),
      row({ id: '2', membership: 'N/A', contact: '0122222222' }),
    ]);
    expect(matchMember({ contact: { email: 'a@x.com', phone: '0122222222' } }, index)).toMatchObject({ status: 'conflict' });
    const same = buildSourceIndex([row({ id: '1', membership: 'N/A', email: 'a@x.com', contact: '0122222222' })]);
    expect(matchMember({ contact: { email: 'a@x.com', phone: '0122222222' } }, same)).toMatchObject({ status: 'matched', by: 'email' });
  });

  it('a manual pick (our id -> source record id) wins over email and phone', () => {
    const index = buildSourceIndex([
      row({ id: '1', membership: 'JCIK-1', email: 'a@x.com' }),
      row({ id: '2', membership: 'JCIK-2', contact: '0122222222' }),
    ]);
    const m = { id: 'm1', contact: { email: 'a@x.com', phone: '0122222222' } };
    expect(matchMember(m, index)).toMatchObject({ status: 'conflict' });
    expect(matchMember(m, index, { m1: '2' })).toMatchObject({ status: 'matched', by: 'manual', row: { membership: 'JCIK-2' } });
  });

  it('with a stored membership no. shared by several records, the one with the member own email wins', () => {
    const index = buildSourceIndex([
      row({ id: '1', membership: 'JCIKL-1', email: 'own@x.com', joindate: '2023-03-04 10:00:00' }),
      row({ id: '2', membership: 'JCIKL-1', email: 'other@x.com', joindate: '2023-10-02 10:00:00' }),
    ]);
    const m = { jciCareer: { jciMalaysiaMembershipNo: 'JCIKL-1', jciMalaysiaJoinDate: '2023-03-04' }, contact: { email: 'own@x.com' } };
    const res = matchMember(m, index);
    expect(res).toMatchObject({ by: 'membershipNo', row: { id: '1' } });
    // Membership no. and join date unchanged; only the user id of that same record is added.
    expect(planUpdate(m, res.row)).toEqual({ 'jciCareer.jciMalaysiaUserId': '1' });
  });

  it('a stored JCI Malaysia user id matches first, even when email and phone changed', () => {
    const index = buildSourceIndex([row({ id: '77', membership: 'N/A', email: 'new@x.com' })]);
    const m = { jciCareer: { jciMalaysiaUserId: '77' }, contact: { email: 'old@x.com' } };
    expect(matchMember(m, index)).toMatchObject({ status: 'matched', by: 'userId', row: { id: '77' } });
  });

  it('skips people whose only record is in another chapter', () => {
    const index = buildSourceIndex([row({ membership: 'JCIPJ-1', email: 'p@x.com', chapter: 'JCI Petaling Jaya' })]);
    expect(matchMember({ contact: { email: 'p@x.com' } }, index)).toMatchObject({ status: 'otherChapter', by: 'email' });
  });

  it('treats N/A membership numbers as missing', () => {
    expect(planUpdate({}, row({ membership: 'N/A', joindate: '2024-05-02 10:00:00' }))).toEqual({ 'jciCareer.jciMalaysiaJoinDate': '2024-05-02' });
    expect(buildSourceIndex([row({ membership: 'N/A' })]).byMembership.size).toBe(0);
  });

  it('plans only changed, non-empty fields', () => {
    const r = row({ membership: 'JCIK-1', joindate: '2021-05-06 09:00:00' });
    expect(planUpdate({}, { ...r, id: '9' })).toEqual({ 'jciCareer.jciMalaysiaMembershipNo': 'JCIK-1', 'jciCareer.jciMalaysiaJoinDate': '2021-05-06', 'jciCareer.jciMalaysiaUserId': '9' });
    expect(planUpdate({ jciCareer: { jciMalaysiaMembershipNo: 'JCIK-1', jciMalaysiaJoinDate: '2021-05-06' } }, r)).toEqual({});
    expect(planUpdate({ jciCareer: { jciMalaysiaMembershipNo: 'JCIK-1', jciMalaysiaJoinDate: '2021-05-06', jciMalaysiaUserId: '9' } }, { ...r, id: '9' })).toEqual({});
    expect(planUpdate({ jciCareer: { jciMalaysiaMembershipNo: 'OLD' } }, row({ membership: '', joindate: '' }))).toEqual({});
  });
});
