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

test('initial read identifies the user; same-user refreshes do not change identity', async () => {
  const f = fixture();
  assert.deepEqual(await f.session.service.getUser(), a);
  const before = f.session.getSnapshot();
  f.emit({ ...a });
  f.emit({ ...a });
  assert.equal(f.session.getWorkKey(), before.key);
  assert.equal(f.session.getSnapshot().generation, before.generation);
  f.stop();
  assert.equal(f.cleanups(), 1);
});
for (const method of ['signIn', 'signOut']) for (const timing of ['before', 'after', 'absent']) {
  const name = method === 'signIn' ? `explicit same-account sign-in with ${timing} notification creates one boundary`
    : `explicit logout with ${timing} notification ends the session once`;
  test(name, async () => {
    const f = await ready();
    const before = f.session.getSnapshot();
    const done = Promise.withResolvers(), started = Promise.withResolvers();
    const next = method === 'signIn' ? a : null;
    const expected = next ? { ok: true, user: next } : undefined;
    f.raw[method] = async () => {
      started.resolve();
      if (timing === 'before') f.emit(next);
      await done.promise;
      f.setUser(next);
      return expected;
    };
    const result = f.run(method);
    assert.equal(f.session.getWorkKey(), null);
    assert.notEqual(f.session.getSnapshot().key, before.key);
    await started.promise;
    done.resolve();
    assert.deepEqual(await result, expected);
    if (timing === 'after') f.emit(next);
    assert.equal(f.session.getSnapshot().generation, before.generation + 1);
    assert.notEqual(f.session.getWorkKey(), before.key);
    assert.equal(f.session.getSnapshot().pending, false);
    assert.deepEqual(f.notices.at(-1), next);
    assert.deepEqual(await f.session.service.getUser(), next);
  });
}

test('logout/login to the same account invalidates work without requiring notifications', async () => {
  const f = await ready(), first = f.session.getWorkKey();
  await f.run('signOut');
  await f.run('signIn');
  assert.notEqual(f.session.getWorkKey(), first);
  assert.equal(f.notices.at(-1).id, a.id);
});
for (const method of ['signIn', 'signOut']) {
  test(`failed ${method} retains auth state but never restores the old work key`, async () => {
    const f = await ready(), before = f.session.getSnapshot();
    f.raw[method] = async () => { throw new Error('Fake auth failure'); };
    await assert.rejects(f.run(method), /Fake auth failure/);
    assert.equal(f.session.getSnapshot().userId, a.id);
    assert.equal(f.session.getSnapshot().generation, before.generation);
    assert.equal(f.session.getSnapshot().pending, false);
    assert.notEqual(f.session.getWorkKey(), before.key);
  });
}
test('overlapping explicit operations do not reach the raw service', async () => {
  const f = await ready(), wait = Promise.withResolvers();
  let calls = 0;
  f.raw.signIn = async () => { calls += 1; await wait.promise; return { ok: true, user: a }; };
  const first = f.run('signIn');
  assert.equal((await f.session.service.signIn({ ...credentials, email: b.email })).ok, false);
  await assert.rejects(f.run('signOut'), /Please wait/);
  wait.resolve();
  await first;
  assert.equal(calls, 1);
});
test('an external account change supersedes an older explicit sign-in result', async () => {
  const f = await ready(), done = Promise.withResolvers(), started = Promise.withResolvers();
  f.raw.signIn = async () => { started.resolve(); return done.promise; };
  const first = f.run('signIn');
  await started.promise;
  f.emit(b);
  done.resolve({ ok: true, user: a });
  await first;
  assert.equal(f.session.getSnapshot().userId, b.id);
  assert.equal(f.notices.at(-1).id, b.id);
});
for (const outcome of ['notification', 'operation']) {
  const name = outcome === 'notification' ? 'an old initial read cannot undo newer auth notifications'
    : 'an old initial read error cannot replace a newer operation result';
  test(name, async () => {
    const f = fixture(null), read = Promise.withResolvers(), started = Promise.withResolvers();
    f.raw.getUser = () => { started.resolve(); return read.promise; };
    const first = f.session.service.getUser();
    await started.promise;
    if (outcome === 'notification') f.emit(b);
    else await f.run('signIn');
    const key = f.session.getWorkKey();
    if (outcome === 'notification') read.resolve(a);
    else read.reject(new Error('Old read failure'));
    assert.equal((await first).id, outcome === 'notification' ? b.id : a.id);
    assert.equal(f.session.getWorkKey(), key);
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
for (const method of ['signIn', 'signOut']) {
  test(`a refresh during ${method} does not suppress its explicit confirmation`, async () => {
    const f = await ready(), done = Promise.withResolvers(), started = Promise.withResolvers();
    f.raw[method] = async () => { started.resolve(); await done.promise; return method === 'signIn' ? { ok: true, user: b } : undefined; };
    const result = f.run(method);
    await started.promise;
    f.emit(a);
    done.resolve();
    await result;
    assert.equal(f.session.getSnapshot().userId, method === 'signIn' ? b.id : null);
  });
}
