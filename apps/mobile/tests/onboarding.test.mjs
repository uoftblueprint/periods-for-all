import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createFinishHandler, finishInProgress, getGateView, readCompletion,
} from '../src/features/onboarding/onboarding-logic.ts';

const settings = Object.freeze({ textSize: 'large', colorScheme: 'dark', reduceMotion: true });
const ready = { authStatus: 'signedIn', settingsReady: true, error: null, complete: false, exited: false };

for (const [description, input, expected] of [
  ['checking auth', { authStatus: 'checking' }, 'loading'],
  ['signed out', { authStatus: 'signedOut' }, 'signedOut'],
  ['auth failure', { authStatus: 'error' }, 'error'],
  ['preferences not ready', { settingsReady: false }, 'loading'],
  ['completion not ready', { complete: null }, 'loading'],
  ['load failure', { error: 'Read failed' }, 'error'],
  ['incomplete account', {}, 'setup'],
  ['completed account', { complete: true }, 'home'],
  ['exited this session', { exited: true }, 'home'],
  ['exit does not skip preferences loading', { exited: true, settingsReady: false }, 'loading'],
  ['exit does not skip completion loading', { exited: true, complete: null }, 'loading'],
  ['signed-out content wins over old errors', { authStatus: 'signedOut', error: 'Old error' }, 'signedOut'],
]) {
  test(`gate decision: ${description}`, () => {
    assert.equal(getGateView({ ...ready, ...input }), expected);
  });
}

function fixture() {
  let sessionKey = 1;
  const calls = [];
  const handler = createFinishHandler();
  return {
    handler, calls,
    nextSession() { sessionKey += 1; },
    input(overrides = {}) {
      const captured = String(sessionKey);
      return {
        sessionKey: captured,
        userId: 'test-a',
        settings,
        isCurrent: () => String(sessionKey) === captured,
        saveSettings: async (next) => { calls.push(['save', next]); },
        completionStore: {
          isComplete: async () => false,
          markComplete: async (id) => { calls.push(['complete', id]); },
        },
        ...overrides,
      };
    },
  };
}

test('finish saves a copy, then marks the captured account, then resolves', async () => {
  const f = fixture();
  const saved = Promise.withResolvers();
  const marked = Promise.withResolvers();
  const marking = Promise.withResolvers();
  const input = f.input({
    saveSettings: (next) => { f.calls.push(['save', next]); return saved.promise; },
    completionStore: {
      isComplete: async () => false,
      markComplete(id) { f.calls.push(['complete', id]); marking.resolve(); return marked.promise; },
    },
  });
  let finished = false;
  const result = f.handler.finish(input).then(() => { finished = true; });
  assert.deepEqual(f.calls, [['save', settings]]);
  assert.notEqual(f.calls[0][1], settings);
  assert.equal(finished, false);
  saved.resolve();
  await marking.promise;
  assert.deepEqual(f.calls, [['save', settings], ['complete', 'test-a']]);
  assert.equal(finished, false);
  marked.resolve();
  await result;
  assert.equal(finished, true);
  assert.deepEqual(settings, { textSize: 'large', colorScheme: 'dark', reduceMotion: true });
});

for (const stage of ['preferences', 'completion']) {
  test(`${stage} failure rejects, releases the lock, and permits retry`, async () => {
    const f = fixture();
    const failure = new Error('Fake save failure');
    const input = f.input(stage === 'preferences' ? {
      saveSettings: async () => { throw failure; },
    } : {
      completionStore: { isComplete: async () => false, markComplete: async () => { throw failure; } },
    });
    await assert.rejects(f.handler.finish(input), (error) => error === failure);
    assert.equal(f.handler.isPending('1'), false);
    if (stage === 'preferences') assert.deepEqual(f.calls, []);
    await f.handler.finish(f.input());
    assert.deepEqual(f.calls.at(-1), ['complete', 'test-a']);
  });
}

test('two immediate finish calls start exactly one save; duplicate leaves the lock held', async () => {
  const f = fixture();
  const saving = Promise.withResolvers();
  const input = f.input({ saveSettings: () => { f.calls.push('save'); return saving.promise; } });
  const first = f.handler.finish(input);
  await assert.rejects(f.handler.finish(input), (error) => error === finishInProgress);
  assert.deepEqual(f.calls, ['save']);
  assert.equal(f.handler.isPending('1'), true);
  saving.resolve();
  await first;
  assert.equal(f.handler.isPending('1'), false);
});

test('an invalid session rejects without saving', async () => {
  const f = fixture();
  const input = f.input();
  f.nextSession();
  await assert.rejects(f.handler.finish(input), /session has ended/);
  assert.deepEqual(f.calls, []);
});

test('changing the caller input cannot retarget a pending completion write', async () => {
  const f = fixture();
  const saving = Promise.withResolvers();
  const input = f.input({ saveSettings: () => saving.promise });
  const result = f.handler.finish(input);
  input.userId = 'test-b';
  input.sessionKey = 99;
  saving.resolve();
  await result;
  assert.deepEqual(f.calls, [['complete', 'test-a']]);
  assert.equal(f.handler.isPending('1'), false);
});

for (const account of ['same account', 'different account']) for (const stage of ['preferences', 'completion']) {
  const name = stage === 'preferences' ? `${account}: a late preference save cannot mark completion or resolve as success`
    : `${account}: a late completion write cannot resolve as success for the new session`;
  test(name, async () => {
    const f = fixture();
    const pending = Promise.withResolvers();
    const started = Promise.withResolvers();
    const input = f.input(stage === 'preferences' ? { saveSettings: () => pending.promise } : {
      completionStore: {
        isComplete: async () => false,
        markComplete(id) { f.calls.push(['complete', id]); started.resolve(); return pending.promise; },
      },
    });
    const first = assert.rejects(f.handler.finish(input), /session has ended/);
    if (stage === 'completion') await started.promise;
    f.nextSession();
    pending.resolve();
    await first;
    if (stage === 'preferences') assert.deepEqual(f.calls, []);
    else assert.deepEqual(f.calls.at(-1), ['complete', 'test-a']);
    const next = f.input({ userId: account === 'same account' ? 'test-a' : 'test-b' });
    await f.handler.finish(next);
    assert.equal(f.calls.at(-1)[1], next.userId);
  });
}

for (const oldFails of [false, true]) {
  test(`old attempt ${oldFails ? 'failure' : 'cleanup'} cannot unlock a newer attempt`, async () => {
    const f = fixture();
    const oldSave = Promise.withResolvers();
    const newSave = Promise.withResolvers();
    const first = assert.rejects(f.handler.finish(f.input({ saveSettings: () => oldSave.promise })));
    f.nextSession();
    const nextInput = f.input({ saveSettings: () => newSave.promise });
    const second = f.handler.finish(nextInput);
    if (oldFails) oldSave.reject(new Error('Late failure'));
    else oldSave.resolve();
    await first;
    assert.equal(f.handler.isPending('2'), true);
    await assert.rejects(f.handler.finish(nextInput), (error) => error === finishInProgress);
    newSave.resolve();
    await second;
  });
}

for (const complete of [false, true]) {
  test(`completion read returns ${complete} for the active session`, async () => {
    const store = { isComplete: async (id) => { assert.equal(id, 'test-a'); return complete; } };
    assert.equal(await readCompletion(store, 'test-a', () => true), complete);
  });
}

test('completion read failures reach the current session and can be retried', async () => {
  const failure = new Error('Fake read failure');
  const store = { isComplete: async () => { throw failure; } };
  await assert.rejects(readCompletion(store, 'test-a', () => true), (error) => error === failure);
  store.isComplete = async () => false;
  assert.equal(await readCompletion(store, 'test-a', () => true), false);
});

for (const fails of [false, true]) {
  test(`late completion ${fails ? 'failure' : 'result'} is ignored after same-account re-login`, async () => {
    const f = fixture();
    const read = Promise.withResolvers();
    const result = readCompletion({ isComplete: () => read.promise }, 'test-a', f.input().isCurrent);
    f.nextSession();
    if (fails) read.reject(new Error('Old session failure'));
    else read.resolve(true);
    assert.equal(await result, undefined);
  });
}

test('an inactive completion read does not start storage work', async () => {
  let calls = 0;
  const result = await readCompletion({ isComplete: async () => { calls += 1; return false; } }, 'test-a', () => false);
  assert.equal(result, undefined);
  assert.equal(calls, 0);
});
