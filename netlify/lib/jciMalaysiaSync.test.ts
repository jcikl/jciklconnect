import { describe, it, expect } from 'vitest';
import {
  buildPlan, computePlan, applyPlan, runAction, isSyncDeveloper, backupOf, SOURCE_FIELDS, BATCH_SIZE,
} from './jciMalaysiaSync.mjs';

type Data = Record<string, any>;

/** Minimal in-memory stand-in for an Admin SDK Firestore: collections, select, doc get/set/update, add, batch. */
function fakeDb(initial: Record<string, Record<string, Data>> = {}) {
  const store: Record<string, Record<string, Data>> = JSON.parse(JSON.stringify(initial));
  const log = { selects: [] as { collection: string; fields: string[] }[], commits: 0, memberUpdates: [] as string[] };
  let auto = 0;
  const table = (name: string) => (store[name] ??= {});
  const setPath = (obj: Data, dotted: string, value: unknown) => {
    const keys = dotted.split('.');
    let o = obj;
    for (const k of keys.slice(0, -1)) o = (o[k] ??= {});
    o[keys[keys.length - 1]] = value;
  };
  const ref = (collection: string, id: string) => ({
    id,
    get: async () => ({ exists: id in table(collection), data: () => table(collection)[id] }),
    set: async (data: Data) => { table(collection)[id] = { ...data }; },
    update: async (u: Data) => {
      if (!(id in table(collection))) throw new Error(`no doc ${collection}/${id}`);
      for (const [k, v] of Object.entries(u)) setPath(table(collection)[id], k, v);
      if (collection === 'members') log.memberUpdates.push(id);
    },
  });
  const snap = (name: string) => ({ docs: Object.entries(table(name)).map(([id, d]) => ({ id, data: () => d })) });
  const db = {
    collection: (name: string) => ({
      select: (...fields: string[]) => ({ get: async () => { log.selects.push({ collection: name, fields }); return snap(name); } }),
      get: async () => snap(name),
      doc: (id?: string) => ref(name, id ?? `auto${++auto}`),
      add: async (data: Data) => { const id = `auto${++auto}`; table(name)[id] = data; return { id }; },
    }),
    batch: () => {
      const ops: (() => Promise<void>)[] = [];
      return {
        update: (r: ReturnType<typeof ref>, u: Data) => { ops.push(() => r.update(u)); },
        commit: async () => { log.commits++; for (const op of ops) await op(); },
      };
    },
  };
  return { db, store, log };
}

const KL = 'JCI Kuala Lumpur';
const sourceRows = {
  r1: { id: '1', membership: 'JCIKL-1', joindate: '2020-01-02 10:00:00', email: 'ali@x.com', contact: '0121111111', chapter: KL, fullname: 'Ali' },
  r2: { id: '2', membership: 'JCIKL-2', joindate: '2021-03-04 10:00:00', email: 'bob@x.com', contact: '0122222222', chapter: KL, fullname: 'Bob A' },
  r3: { id: '3', membership: 'JCIKL-3', joindate: '2022-05-06 10:00:00', email: 'bob2@x.com', contact: '0123333333', chapter: KL, fullname: 'Bob B' },
  r4: { id: '4', membership: 'JCIPJ-4', joindate: '2019-01-01 10:00:00', email: 'pj@x.com', contact: '0124444444', chapter: 'JCI Petaling Jaya', fullname: 'Pat' },
  r5: { id: '5', membership: 'JCIKL-5', joindate: '2018-01-01 10:00:00', email: 'other@x.com', contact: '0125555555', chapter: KL, fullname: 'Other' },
};
const members = {
  ali: { loId: 'jcikl', general: { name: 'Ali' }, contact: { email: 'ali@x.com' } },
  bob: { general: { name: 'Bob' }, contact: { email: 'bob@x.com', phone: '0123333333' } }, // conflict: r2 vs r3
  pat: { loId: 'jcikl', general: { name: 'Pat' }, contact: { email: 'pj@x.com' } }, // other chapter
  zed: { loId: 'jcikl', general: { name: 'Zed' }, contact: { email: 'zed@x.com' } }, // not found
  done: { loId: 'jcikl', general: { name: 'Done' }, contact: { email: 'other@x.com' },
    jciCareer: { jciMalaysiaMembershipNo: 'JCIKL-5', jciMalaysiaJoinDate: '2018-01-01', jciMalaysiaUserId: '5' } },
  sister: { loId: 'jcisg', general: { name: 'Sister' }, contact: { email: 'ali@x.com' } }, // not KL: ignored
};
const setup = (extra: Record<string, Record<string, Data>> = {}) => {
  const source = fakeDb({ member_directory: sourceRows });
  const target = fakeDb({ members, ...extra });
  return { source, target };
};

describe('jciMalaysiaSync core', () => {
  it('plans writes, conflicts (A = email, B = phone), other chapter and not found; KL members only', async () => {
    const { source, target } = setup();
    const plan = await computePlan({ sourceDb: source.db, db: target.db });
    expect(plan.sourceRows).toBe(5);
    expect(plan.counts).toMatchObject({ members: 5, byEmail: 1, byUserId: 1, conflict: 1, otherChapter: 1, none: 1, toWrite: 1, unchanged: 1 });
    expect(plan.writes[0]).toMatchObject({ memberId: 'ali', name: 'Ali', by: 'email' });
    expect(Object.fromEntries(plan.writes[0].fields.map((f: Data) => [f.key, f.after]))).toEqual({
      userId: '1', membershipNo: 'JCIKL-1', joinDate: '2020-01-02',
    });
    expect(plan.conflicts).toEqual([{
      memberId: 'bob', name: 'Bob',
      candidates: {
        A: { sourceId: '2', fullname: 'Bob A', chapter: KL, membershipNo: 'JCIKL-2', joinDate: '2021-03-04' },
        B: { sourceId: '3', fullname: 'Bob B', chapter: KL, membershipNo: 'JCIKL-3', joinDate: '2022-05-06' },
      },
    }]);
    expect(plan.otherChapter).toEqual([{ memberId: 'pat', name: 'Pat', chapter: 'JCI Petaling Jaya', by: 'email' }]);
    expect(plan.notFound).toEqual([{ memberId: 'zed', name: 'Zed' }]);
  });

  it('reads the source with the field mask', async () => {
    const { source, target } = setup();
    await computePlan({ sourceDb: source.db, db: target.db });
    expect(source.log.selects).toEqual([{ collection: 'member_directory', fields: SOURCE_FIELDS }]);
    // SOURCE_FIELDS is derived from the field catalog; it must cover the match keys and the nested profile object.
    for (const need of ['id', 'membership', 'joindate', 'email', 'contact', 'chapter', 'fullname', 'gender', 'dob', 'level', 'area', 'profileDetails']) {
      expect(SOURCE_FIELDS).toContain(need);
    }
  });

  it('the preview never contains emails or phone numbers', async () => {
    const { source, target } = setup();
    const res = await runAction({ action: 'preview', sourceDb: source.db, db: target.db, callerUid: 'dev', now: new Date() });
    expect(res.status).toBe(200);
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/@/);
    expect(text).not.toMatch(/012\d{7}/);
    expect(res.body.writes[0]).not.toHaveProperty('updates');
  });

  it('manual picks from jciMalaysiaOverrides resolve a conflict', async () => {
    const { source, target } = setup({ jciMalaysiaOverrides: { bob: { sourceId: '3', pickedBy: 'dev', pickedAt: 'x' } } });
    const plan = await computePlan({ sourceDb: source.db, db: target.db });
    expect(plan.conflicts).toEqual([]);
    const bob = plan.writes.find((w: Data) => w.memberId === 'bob');
    expect(bob).toMatchObject({ by: 'manual' });
    expect(Object.fromEntries(bob.fields.map((f: Data) => [f.key, f.after])).membershipNo).toBe('JCIKL-3');
  });

  it('apply recomputes the plan server-side and ignores a client-sent plan', async () => {
    const { source, target } = setup();
    const clientPlan = { writes: [{ memberId: 'zed', updates: { 'jciCareer.jciMalaysiaMembershipNo': 'HACKED' } }], counts: { toWrite: 99 } };
    const res = await runAction({
      action: 'apply', body: { plan: clientPlan, writes: clientPlan.writes, counts: clientPlan.counts },
      sourceDb: source.db, db: target.db, callerUid: 'dev1', now: 'NOW',
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ written: 1, counts: { toWrite: 1 } });
    expect(target.log.memberUpdates).toEqual(['ali']);
    expect(target.store.members.zed.jciCareer).toBeUndefined();
    expect(target.store.members.ali.jciCareer).toEqual({ jciMalaysiaMembershipNo: 'JCIKL-1', jciMalaysiaJoinDate: '2020-01-02', jciMalaysiaUserId: '1' });

    const run = target.store.jciMalaysiaSyncRuns[res.body.runId];
    expect(run).toMatchObject({ by: 'dev1', at: 'NOW', status: 'done', written: 1, counts: { toWrite: 1 } });
    expect(run.before).toEqual([{ memberId: 'ali', before: { 'jciCareer.jciMalaysiaUserId': null, 'jciCareer.jciMalaysiaMembershipNo': null, 'jciCareer.jciMalaysiaJoinDate': null } }]);

    const audits = Object.values(target.store.auditLog);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ action: 'jci_malaysia_sync_apply', performedBy: 'dev1', targetId: res.body.runId, metadata: { written: 1 } });
    expect(JSON.stringify(audits[0])).not.toMatch(/@|JCIKL-1/);
  });

  it('apply with nothing to write stores no run and writes nothing', async () => {
    const { source } = setup();
    const target = fakeDb({ members: { done: members.done } });
    const res = await runAction({ action: 'apply', sourceDb: source.db, db: target.db, callerUid: 'dev1', now: 'NOW' });
    expect(res.body).toMatchObject({ runId: null, written: 0 });
    expect(target.store.jciMalaysiaSyncRuns).toBeUndefined();
    expect(target.log.commits).toBe(0);
  });

  it(`applyPlan writes in batches of at most ${BATCH_SIZE}`, async () => {
    const many = Object.fromEntries(Array.from({ length: BATCH_SIZE + 1 }, (_, i) => [`m${i}`, {}]));
    const target = fakeDb({ members: many });
    const plan = { writes: Object.keys(many).map(memberId => ({ memberId, updates: { 'jciCareer.jciMalaysiaUserId': 'x' } })) };
    const progress: number[] = [];
    expect(await applyPlan(target.db, plan, (done: number) => progress.push(done))).toBe(BATCH_SIZE + 1);
    expect(target.log.commits).toBe(2);
    expect(progress).toEqual([BATCH_SIZE, BATCH_SIZE + 1]);
  });

  it('pick accepts either conflict candidate or any KL source row, and rejects anything else', async () => {
    const { source, target } = setup();
    const pick = (memberId: unknown, sourceId: unknown) =>
      runAction({ action: 'pick', body: { memberId, sourceId }, sourceDb: source.db, db: target.db, callerUid: 'dev1', now: 'NOW' });

    expect((await pick('bob', '3')).status).toBe(200);
    expect(target.store.jciMalaysiaOverrides.bob).toEqual({ sourceId: '3', pickedBy: 'dev1', pickedAt: 'NOW' });
    expect((await pick('bob', '2')).status).toBe(200);
    expect((await pick('zed', '5')).status).toBe(200); // another valid KL row
    expect((await pick('zed', '4')).status).toBe(400); // other chapter, not a candidate
    expect((await pick('zed', '999')).status).toBe(400); // unknown source row
    expect((await pick('nobody', '1')).status).toBe(404);
    expect((await pick('sister', '1')).status).toBe(404); // not a KL member
    expect((await pick('', '1')).status).toBe(400);
    expect((await pick('bob', '')).status).toBe(400);
    expect(Object.values(target.store.auditLog).filter((a: Data) => a.action === 'jci_malaysia_sync_pick')).toHaveLength(3);
  });

  it('unknown actions are rejected', async () => {
    const { source, target } = setup();
    expect((await runAction({ action: 'delete', sourceDb: source.db, db: target.db, callerUid: 'dev1', now: 'NOW' })).status).toBe(400);
  });

  it('only members with isDeveloper === true (and not INACTIVE) may sync', () => {
    expect(isSyncDeveloper({ role: 'MEMBER', isDeveloper: true })).toBe(true);
    expect(isSyncDeveloper({ role: 'SUPER_ADMIN' })).toBe(false);
    expect(isSyncDeveloper({ role: 'ADMIN', isDeveloper: 'true' })).toBe(false);
    expect(isSyncDeveloper({ role: 'INACTIVE', isDeveloper: true })).toBe(false);
    expect(isSyncDeveloper(null)).toBe(false);
  });

  it('backupOf keeps the raw old values of the changed fields (dot-path keys for rollback)', () => {
    const plan = buildPlan({ rows: [sourceRows.r1], members: [{ id: 'a', contact: { email: 'ali@x.com' }, jciCareer: { jciMalaysiaMembershipNo: 'OLD' } }] });
    expect(backupOf(plan)).toEqual([{ memberId: 'a', before: { 'jciCareer.jciMalaysiaMembershipNo': 'OLD', 'jciCareer.jciMalaysiaJoinDate': null, 'jciCareer.jciMalaysiaUserId': null } }]);
  });

  it('selected fields: JCIM-only fields write; core profile fields only fill a blank', () => {
    const row = { id: '7', membership: 'JCIKL-9', joindate: '2024-01-02 00:00:00', email: 'x@x.com', chapter: 'JCI Kuala Lumpur', fullname: 'From JCIM', gender: 'Female' };
    const member = { id: 'm', contact: { email: 'x@x.com' }, general: { name: 'Our Name' } }; // has a name already, no gender
    const plan = buildPlan({ rows: [row], members: [member], selected: ['chapter', 'name', 'gender'] });
    const w = plan.writes[0];
    const by = Object.fromEntries(w.fields.map(f => [f.key, f.after]));
    expect(by.chapter).toBe('JCI Kuala Lumpur');          // JCIM-only field written
    expect(by.gender).toBe('Female');                    // core field was blank -> filled
    expect('name' in by).toBe(false);                    // core field already set -> NOT overwritten
    expect(w.updates['general.name']).toBeUndefined();
  });

  it('nested profileDetails fields: fill a blank, skip placeholders, handle arrays', () => {
    const row = {
      id: '7', membership: 'JCIKL-9', joindate: '2024-01-02 00:00:00', email: 'x@x.com', chapter: 'JCI Kuala Lumpur',
      profileDetails: {
        employment: { companyName: 'Acme', industry: 'Tech', website: 'http://none', linkedin: 'none' },
        personal: { address: '12 Jalan X', state: 'Selangor', bio: 'hi', interests: ['A', 'B'] },
        jci: { profileLink: 'https://jvc.jci.cc/p/7' },
        general: { nationality: 'Malaysian' },
      },
    };
    const member = { id: 'm', contact: { email: 'x@x.com', address: 'OLD ADDR' } }; // already has an address
    const plan = buildPlan({ rows: [row], members: [member], selected: ['company', 'industry', 'companyWebsite', 'linkedin', 'address', 'state', 'bio', 'interests', 'nationality', 'profileLink'] });
    const u = plan.writes[0].updates;
    expect(u['business.companyName']).toBe('Acme');
    expect(u['business.industry']).toBe('Tech');
    expect(u['business.companyWebsite']).toBeUndefined();   // 'http://none' placeholder -> skipped
    expect(u['contact.socials.linkedin']).toBeUndefined();  // 'none' placeholder -> skipped
    expect(u['contact.address']).toBeUndefined();           // already have an address -> fill-if-empty skips
    expect(u['contact.state']).toBe('Selangor');
    expect(u['others.bio']).toBe('hi');
    expect(u['others.hobbies']).toEqual(['A', 'B']);        // array fills a blank
    expect(u['general.nationality']).toBe('Malaysian');
    expect(u['jciCareer.jciMalaysiaProfileLink']).toBe('https://jvc.jci.cc/p/7');
  });

  it('preview masks PII embedded in free-text values, but the real value is still written', () => {
    const row = {
      id: '7', membership: 'JCIKL-9', joindate: '2024-01-02 00:00:00', email: 'x@x.com', chapter: 'JCI Kuala Lumpur',
      profileDetails: { personal: { bio: 'Reach me at john@mail.com or 012-3456789' }, employment: { title: 'Head @ Acme' } },
    };
    const member = { id: 'm', contact: { email: 'x@x.com' } };
    const plan = buildPlan({ rows: [row], members: [member], selected: ['bio', 'position'] });
    const shown = Object.fromEntries(plan.writes[0].fields.map(f => [f.key, f.after]));
    expect(shown.bio).not.toMatch(/@/);           // email stripped
    expect(shown.bio).not.toMatch(/\d{6,}/);      // phone stripped
    expect(shown.position).not.toMatch(/@/);      // lone "@" -> "at"
    expect(plan.writes[0].updates['others.bio']).toContain('john@mail.com'); // real value preserved for the write
  });
});
