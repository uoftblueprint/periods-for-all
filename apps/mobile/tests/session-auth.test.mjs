import assert from 'node:assert/strict';
import test from 'node:test';
import { createSessionAuth } from '../src/features/auth/session-auth.ts';

const a = { id: 'a', email: 'a@example.test' };
const b = { id: 'b', email: 'b@example.test' };
const credentials = { email: a.email, password: 'test-only' };
function fixture(initial = a) {
  let user = initial, listener = () => {}, cleanups = 0;
  const raw = {
    getUser: async () => user,
    signIn: async () => { user = a; return { ok: true, user: a }; },
    signOut: async () => { user = null; },
    subscribe(next) { listener = next; return () => { cleanups += 1; }; },
  };
  const session = createSessionAuth(async () => raw);
  const notices = [];
  const stop = session.service.subscribe((next) => notices.push(next));
  return { raw, session, notices, stop, cleanups: () => cleanups,
    setUser(next) { user = next; }, emit(next) { user = next; listener(next); },
    run: (method) => session.service[method](credentials) };
}
async function ready() {
  const f = fixture();
  await f.session.service.getUser();
  return f;
}

test('refreshes preserve the session; logout/relogin replaces it without notifications', async () => {
  const f = fixture();
  assert.deepEqual(await f.session.service.getUser(), a);
  const before = f.session.getSnapshot();
  f.emit({ ...a });
  f.emit({ ...a });
  assert.equal(f.session.getWorkKey(), before.key);
  assert.equal(f.session.getSnapshot().generation, before.generation);
  await f.run('signOut');
  await f.run('signIn');
  assert.notEqual(f.session.getWorkKey(), before.key);
  assert.equal(f.notices.at(-1).id, a.id);
  f.stop();
  assert.equal(f.cleanups(), 1);
});
for (const method of ['signIn', 'signOut']) for (const timing of ['before', 'after', 'absent', 'failure', 'refresh']) {
  test(`${method}: ${timing} notification/outcome preserves session identity`, async () => {
    const f = await ready();
    const before = f.session.getSnapshot();
    const done = Promise.withResolvers(), started = Promise.withResolvers();
    let calls = 0;
    const failed = timing === 'failure';
    const next = method === 'signIn' ? (timing === 'refresh' ? b : a) : null;
    const confirmed = failed ? a : next;
    const expected = next ? { ok: true, user: next } : undefined;
    f.raw[method] = async () => {
      calls += 1;
      started.resolve();
      if (timing === 'before') f.emit(next);
      if (timing === 'refresh') f.emit(a);
      await done.promise;
      if (failed) throw new Error('Fake auth failure');
      f.setUser(next);
      return expected;
    };
    const result = f.run(method);
    assert.equal(f.session.getWorkKey(), null);
    assert.notEqual(f.session.getSnapshot().key, before.key);
    await started.promise;
    if (timing === 'absent') {
      assert.equal((await f.session.service.signIn({ ...credentials, email: b.email })).ok, false);
      await assert.rejects(f.run('signOut'), /Please wait/);
    }
    done.resolve();
    if (failed) await assert.rejects(result, /Fake auth failure/);
    else assert.deepEqual(await result, expected);
    assert.equal(calls, 1);
    if (timing === 'after') f.emit(next);
    assert.equal(f.session.getSnapshot().generation, before.generation + (failed ? 0 : 1));
    assert.equal(f.session.getSnapshot().userId, confirmed?.id ?? null);
    assert.notEqual(f.session.getWorkKey(), before.key);
    assert.equal(f.session.getSnapshot().pending, false);
    assert.deepEqual(f.notices.at(-1), confirmed);
    assert.deepEqual(await f.session.service.getUser(), confirmed);
  });
}

for (const [method, change, fails] of [
  ['getUser', 'notification', false],
  ['getUser', 'operation', true],
  ['signIn', 'notification', false],
]) {
  test(`a late ${method} result/error cannot undo a newer ${change}`, async () => {
    const f = fixture(method === 'getUser' ? null : a);
    if (method === 'signIn') await f.session.service.getUser();
    const done = Promise.withResolvers(), started = Promise.withResolvers();
    f.raw[method] = () => { started.resolve(); return done.promise; };
    const first = f.run(method);
    await started.promise;
    if (change === 'notification') f.emit(b);
    else await f.run('signIn');
    const key = f.session.getSnapshot().key;
    if (fails) done.reject(new Error('Old read failure'));
    else done.resolve(method === 'getUser' ? a : { ok: true, user: a });
    const result = await first;
    const expected = change === 'notification' ? b : a;
    if (method === 'getUser') assert.deepEqual(result, expected);
    assert.equal(f.session.getSnapshot().userId, expected.id);
    assert.equal(f.notices.at(-1).id, expected.id);
    assert.equal(f.session.getSnapshot().key, key);
  });
}
test('the service exists during initialization and can retry initialization failure', async () => {
  const f = fixture(null);
  let calls = 0;
  const session = createSessionAuth(async () => {
    if (++calls === 1) throw new Error('Fake initialization failure');
    return f.raw;
  });
  const stop = session.service.subscribe(() => {});
  await assert.rejects(session.service.getUser(), /initialization/);
  assert.equal(await session.service.getUser(), null);
  assert.equal(calls, 2);
  stop();
});
