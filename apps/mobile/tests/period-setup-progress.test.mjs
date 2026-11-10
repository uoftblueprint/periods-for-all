import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EMPTY_PERIOD_SETUP,
  StalePeriodSetupError,
  createPeriodSetupSession,
  isPeriodSetupComplete,
  normalizePeriodSetup,
  routeAfterDisplaySetup,
  startingPoint,
} from '../src/features/onboarding/period-setup-progress.ts';

const TODAY = '2026-11-04';

/** Fake HealthStore for one user: remembers saves and can be told to fail. */
function fakeStore(initial = EMPTY_PERIOD_SETUP) {
  const store = {
    saved: { ...initial },
    writes: [],
    failNextRead: false,
    failNextWrite: false,
    async getPeriodSetup() {
      if (store.failNextRead) {
        store.failNextRead = false;
        throw new Error('read failed');
      }
      return { ...store.saved };
    },
    async savePeriodSetup(value) {
      if (store.failNextWrite) {
        store.failNextWrite = false;
        throw new Error('write failed');
      }
      store.writes.push(value);
      store.saved = { ...value };
    },
  };
  return store;
}

/** A promise you resolve later, to control the order things finish in. */
function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

const session = (store, userId = 'user-a') => createPeriodSetupSession({ userId, store, today: TODAY });

test('a new account starts at the introduction with nothing answered', async () => {
  const setup = await session(fakeStore()).load();
  assert.deepEqual(setup, EMPTY_PERIOD_SETUP);
  assert.equal(routeAfterDisplaySetup(setup), '/period-setup');
});

test('answer one question, leave, reopen: the answer and step are restored', async () => {
  const store = fakeStore();
  const first = session(store);
  await first.load();
  await first.save({ ...EMPTY_PERIOD_SETUP, lastPeriodStart: '2026-10-20', step: 'cycle' });
  first.dispose(); // user leaves

  const reopened = await session(store).load();
  assert.deepEqual(reopened, { ...EMPTY_PERIOD_SETUP, lastPeriodStart: '2026-10-20', step: 'cycle' });
  assert.deepEqual(startingPoint(reopened), reopened); // resumes at the stored step
});

test('a failed read rejects instead of looking like an empty setup', async () => {
  const store = fakeStore({ ...EMPTY_PERIOD_SETUP, cycleLength: 28, step: 'length' });
  store.failNextRead = true;
  const s = session(store);
  await assert.rejects(s.load(), /read failed/);
  assert.deepEqual(await s.load(), { ...EMPTY_PERIOD_SETUP, cycleLength: 28, step: 'length' }); // retry works
});

test('a failed write rejects, changes nothing, and can be retried', async () => {
  const store = fakeStore();
  const s = session(store);
  await s.load();
  const next = { ...EMPTY_PERIOD_SETUP, step: 'complete' };

  store.failNextWrite = true;
  await assert.rejects(s.save(next), /write failed/);
  assert.equal(isPeriodSetupComplete(store.saved), false); // not falsely complete

  await s.save(next);
  assert.equal(isPeriodSetupComplete(store.saved), true);
});

test('skipping every question still completes setup, with every answer left as null', async () => {
  const store = fakeStore();
  const s = session(store);
  await s.load();
  await s.save({ ...EMPTY_PERIOD_SETUP, step: 'complete' });

  assert.deepEqual(store.saved, { ...EMPTY_PERIOD_SETUP, step: 'complete' });
  assert.equal(routeAfterDisplaySetup(store.saved), '/home'); // not offered again
});

test('editing a finished setup from home keeps it complete, even if the user leaves halfway', async () => {
  const done = { lastPeriodStart: '2026-10-20', cycleLength: 28, periodLength: 5, step: 'complete' };
  const store = fakeStore(done);
  const s = session(store);

  const opened = startingPoint(await s.load());
  assert.deepEqual(opened, { ...done, step: 'intro' }); // starts at the beginning, answers kept

  await s.save({ ...done, cycleLength: 30, step: 'length' }); // user changes one answer, then leaves
  assert.deepEqual(store.saved, { ...done, cycleLength: 30 }); // answer saved, still complete
  assert.equal(routeAfterDisplaySetup(store.saved), '/home');
});

test('finishing twice does not cause extra changes or undo completion', async () => {
  const store = fakeStore();
  const s = session(store);
  await s.load();
  const finished = { ...EMPTY_PERIOD_SETUP, periodLength: 4, step: 'complete' };

  await Promise.all([s.save(finished), s.save(finished)]);
  assert.deepEqual(store.saved, finished);
  assert.ok(store.writes.every((write) => write.step === 'complete'));
});

test('saves are written in the order they were made', async () => {
  const store = fakeStore();
  const slowWrite = deferred();
  const realSave = store.savePeriodSetup.bind(store);
  let calls = 0;
  store.savePeriodSetup = async (value) => {
    calls += 1;
    if (calls === 1) await slowWrite.promise; // the first save is slow
    return realSave(value);
  };
  const s = session(store);
  await s.load();

  const older = s.save({ ...EMPTY_PERIOD_SETUP, cycleLength: 28, step: 'length' });
  const newer = s.save({ ...EMPTY_PERIOD_SETUP, cycleLength: 30, step: 'length' });
  slowWrite.resolve();
  await Promise.all([older, newer]);

  assert.equal(store.saved.cycleLength, 30); // the newer answer wins
});

test('a failed save does not block the saves after it', async () => {
  const store = fakeStore();
  const s = session(store);
  await s.load();
  store.failNextWrite = true;

  const failed = s.save({ ...EMPTY_PERIOD_SETUP, step: 'cycle' });
  const next = s.save({ ...EMPTY_PERIOD_SETUP, step: 'length' });
  await assert.rejects(failed);
  await next;
  assert.equal(store.saved.step, 'length');
});

test("after an account switch, the old account's late answers are ignored", async () => {
  const slowRead = deferred();
  const storeA = fakeStore({ ...EMPTY_PERIOD_SETUP, cycleLength: 28, step: 'length' });
  storeA.getPeriodSetup = async () => {
    await slowRead.promise;
    return { ...EMPTY_PERIOD_SETUP, cycleLength: 28, step: 'length' };
  };
  const sessionA = session(storeA, 'user-a');
  const pendingA = sessionA.load();

  sessionA.dispose(); // A signs out before the read returns; B signs in
  const sessionB = session(fakeStore(), 'user-b');
  slowRead.resolve();

  await assert.rejects(pendingA, StalePeriodSetupError);
  assert.deepEqual(await sessionB.load(), EMPTY_PERIOD_SETUP); // B never sees A's answers
});

test('after sign-out, no new writes start for the old account', async () => {
  const store = fakeStore();
  const s = session(store);
  await s.load();
  s.dispose();

  await assert.rejects(s.save({ ...EMPTY_PERIOD_SETUP, step: 'complete' }), StalePeriodSetupError);
  assert.equal(store.writes.length, 0);
});

test('saving before loading is refused, so a finished setup cannot be reset by accident', async () => {
  const store = fakeStore({ ...EMPTY_PERIOD_SETUP, step: 'complete' });
  await assert.rejects(session(store).save({ ...EMPTY_PERIOD_SETUP, step: 'cycle' }), /Load period setup/);
  assert.equal(store.writes.length, 0);
});

test('an empty user ID is rejected', () => {
  for (const userId of ['', '   ']) {
    assert.throws(() => createPeriodSetupSession({ userId, store: fakeStore(), today: TODAY }), /User ID/);
  }
});

test('valid stored answers are kept unchanged', () => {
  const setup = { lastPeriodStart: TODAY, cycleLength: 21, periodLength: 12, step: 'length' };
  assert.deepEqual(normalizePeriodSetup(setup, TODAY), setup);
});

for (const [description, raw, expected] of [
  ['missing data', null, EMPTY_PERIOD_SETUP],
  ['an array', [], EMPTY_PERIOD_SETUP],
  ['an unknown step', { ...EMPTY_PERIOD_SETUP, step: 'done' }, EMPTY_PERIOD_SETUP],
  ['a future start date', { ...EMPTY_PERIOD_SETUP, lastPeriodStart: '2026-11-05' }, EMPTY_PERIOD_SETUP],
  ['an impossible date', { ...EMPTY_PERIOD_SETUP, lastPeriodStart: '2026-02-30' }, EMPTY_PERIOD_SETUP],
  ['a cycle length below 21', { ...EMPTY_PERIOD_SETUP, cycleLength: 20 }, EMPTY_PERIOD_SETUP],
  ['a cycle length above 45', { ...EMPTY_PERIOD_SETUP, cycleLength: 46 }, EMPTY_PERIOD_SETUP],
  ['a period length of 0', { ...EMPTY_PERIOD_SETUP, periodLength: 0 }, EMPTY_PERIOD_SETUP],
  ['a fractional period length', { ...EMPTY_PERIOD_SETUP, periodLength: 4.5 }, EMPTY_PERIOD_SETUP],
  ['a numeric string', { ...EMPTY_PERIOD_SETUP, cycleLength: '28' }, EMPTY_PERIOD_SETUP],
]) {
  test(`stored ${description} becomes "not answered" instead of a guessed value`, () => {
    assert.deepEqual(normalizePeriodSetup(raw, TODAY), expected);
  });
}
