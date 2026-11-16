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

test('finish saves a copy, captures the account/session, and waits for completion', async () => {
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
  input.userId = 'test-b';
  input.sessionKey = 'changed';
  saved.resolve();
  await marking.promise;
  assert.deepEqual(f.calls, [['save', settings], ['complete', 'test-a']]);
  assert.equal(finished, false);
  marked.resolve();
  await result;
  assert.equal(finished, true);
  assert.equal(f.handler.isPending('1'), false);
  assert.deepEqual(settings, { textSize: 'large', colorScheme: 'dark', reduceMotion: true });
});

test('an invalid session rejects without saving', async () => {
  const f = fixture();
  const input = f.input();
  f.nextSession();
  await assert.rejects(f.handler.finish(input), /session has ended/);
  assert.deepEqual(f.calls, []);
});

for (const userId of ['test-a', 'test-b']) for (const stage of ['preferences', 'completion']) for (const fails of [false, true]) {
  test(`${userId}: old ${stage} ${fails ? 'failure' : 'success'} cannot affect a newer pending finish`, async () => {
    const f = fixture();
    const oldWrite = Promise.withResolvers();
    const newWrite = Promise.withResolvers();
    const marking = Promise.withResolvers();
    const input = f.input(stage === 'preferences' ? { saveSettings: () => oldWrite.promise } : {
      completionStore: {
        isComplete: async () => false,
        markComplete(id) { f.calls.push(['complete', id]); marking.resolve(); return oldWrite.promise; },
      },
    });
    const first = assert.rejects(f.handler.finish(input), fails ? /Late failure/ : /session has ended/);
    if (stage === 'completion') await marking.promise;
    f.nextSession();
    const next = f.input({ userId, saveSettings: () => newWrite.promise });
    const second = f.handler.finish(next);
    if (fails) oldWrite.reject(new Error('Late failure'));
    else oldWrite.resolve();
    await first;
    if (stage === 'preferences') assert.deepEqual(f.calls, []);
    else assert.deepEqual(f.calls.at(-1), ['complete', 'test-a']);
    assert.equal(f.handler.isPending('2'), true);
    await assert.rejects(f.handler.finish(next), (error) => error === finishInProgress);
    newWrite.resolve();
    await second;
    assert.equal(f.calls.at(-1)[1], userId);
  });
}

test('an inactive completion read does not start storage work', async () => {
  let calls = 0;
  const result = await readCompletion({ isComplete: async () => { calls += 1; return false; } }, 'test-a', () => false);
  assert.equal(result, undefined);
  assert.equal(calls, 0);
});
