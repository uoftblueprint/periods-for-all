import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDemoHealthStore,
  DEMO_EMPTY_DATE,
  DEMO_FILLED_DATE,
} from '../src/features/health/demo-health-store.ts';

const TODAY = '2026-11-07';

function createEmptyStore(options = {}) {
  return createDemoHealthStore({
    today: TODAY,
    initialPeriodDays: [],
    initialDailyLogs: [],
    initialPeriodSetup: null,
    ...options,
  });
}

test('default data includes an empty day and a filled day', async () => {
  const store = createDemoHealthStore({ today: TODAY });

  assert.deepEqual(await store.getDailyLog(DEMO_EMPTY_DATE), {
    date: DEMO_EMPTY_DATE,
    mood: null,
    flow: null,
    physicalSymptoms: null,
    emotionalSymptoms: null,
    reflection: null,
  });
  assert.deepEqual(await store.getDailyLog(DEMO_FILLED_DATE), {
    date: DEMO_FILLED_DATE,
    mood: 'happy',
    flow: 'normal',
    physicalSymptoms: ['menstrualCramps', 'backPain'],
    emotionalSymptoms: ['fatigue'],
    reflection: 'Took a walk and rested.',
  });
});

test('a missing daily log returns unanswered fields', async () => {
  const store = createEmptyStore();

  assert.deepEqual(await store.getDailyLog('2026-10-20'), {
    date: '2026-10-20',
    mood: null,
    flow: null,
    physicalSymptoms: null,
    emotionalSymptoms: null,
    reflection: null,
  });
});

test('patches change only provided fields', async () => {
  const store = createDemoHealthStore({ today: TODAY });
  const before = await store.getDailyLog(DEMO_FILLED_DATE);

  const updated = await store.patchDailyLog(DEMO_FILLED_DATE, { mood: 'sad' });

  assert.deepEqual(updated, { ...before, mood: 'sad' });
});

test('undefined patch fields preserve answers while explicit null clears them', async () => {
  const store = createDemoHealthStore({ today: TODAY });
  const before = await store.getDailyLog(DEMO_FILLED_DATE);
  const fields = ['mood', 'flow', 'physicalSymptoms', 'emotionalSymptoms', 'reflection'];
  const undefinedPatch = Object.fromEntries(fields.map((field) => [field, undefined]));
  assert.deepEqual(await store.patchDailyLog(DEMO_FILLED_DATE, undefinedPatch), before);
  assert.deepEqual(await store.getDailyLog(DEMO_FILLED_DATE), before);
  const nullPatch = Object.fromEntries(fields.map((field) => [field, null]));
  assert.deepEqual(await store.patchDailyLog(DEMO_FILLED_DATE, nullPatch), {
    date: DEMO_FILLED_DATE, ...nullPatch,
  });
});

test('explicit none and empty symptoms stay distinct from unanswered fields', async () => {
  const store = createEmptyStore();

  const updated = await store.patchDailyLog('2026-10-20', {
    flow: 'none',
    physicalSymptoms: [],
    emotionalSymptoms: null,
  });

  assert.equal(updated.flow, 'none');
  assert.deepEqual(updated.physicalSymptoms, []);
  assert.equal(updated.emotionalSymptoms, null);
});

test('an empty reflection clears it to null', async () => {
  const store = createDemoHealthStore({ today: TODAY });

  const updated = await store.patchDailyLog(DEMO_FILLED_DATE, {
    reflection: '',
  });

  assert.equal(updated.reflection, null);
});

test('daily log arrays are copied on writes and reads', async () => {
  const store = createEmptyStore();
  const symptoms = ['headache'];

  const updated = await store.patchDailyLog('2026-10-20', {
    physicalSymptoms: symptoms,
  });
  symptoms.push('backPain');
  updated.physicalSymptoms.push('migraines');

  assert.deepEqual(
    (await store.getDailyLog('2026-10-20')).physicalSymptoms,
    ['headache'],
  );
});

test('period-day reads are sorted and inclusive', async () => {
  const store = createEmptyStore({
    initialPeriodDays: ['2026-10-13', '2026-10-11', '2026-10-12'],
  });

  assert.deepEqual(
    await store.getPeriodDays('2026-10-11', '2026-10-12'),
    ['2026-10-11', '2026-10-12'],
  );
});

test('period updates do not change symptoms, and flow patches do not change period days', async () => {
  const date = '2026-10-20';
  const store = createEmptyStore({
    initialPeriodDays: [date],
    initialDailyLogs: [{
      date,
      mood: null,
      flow: null,
      physicalSymptoms: ['headache'],
      emotionalSymptoms: ['fatigue'],
      reflection: null,
    }],
  });

  await store.updatePeriodDays({ add: [], remove: [date] });
  assert.deepEqual((await store.getDailyLog(date)).physicalSymptoms, ['headache']);

  await store.updatePeriodDays({ add: [date], remove: [] });
  await store.patchDailyLog(date, { flow: 'heavy' });
  assert.deepEqual(await store.getPeriodDays(date, date), [date]);
});

test('contradictory period changes reject without applying any changes', async () => {
  const store = createEmptyStore({ initialPeriodDays: ['2026-11-01', '2026-11-02'] });
  await assert.rejects(store.updatePeriodDays({
    add: ['2026-11-01', '2026-11-03'],
    remove: ['2026-11-01', '2026-11-02'],
  }), /Contradictory date changes/);
  assert.deepEqual(await store.getPeriodDays('2026-11-01', TODAY), [
    '2026-11-01', '2026-11-02',
  ]);
});

test('period setup defaults to intro and can be saved', async () => {
  const store = createEmptyStore();
  assert.deepEqual(await store.getPeriodSetup(), {
    lastPeriodStart: null,
    cycleLength: null,
    periodLength: null,
    step: 'intro',
  });

  const setup = {
    lastPeriodStart: '2026-10-20',
    cycleLength: 30,
    periodLength: 6,
    step: 'complete',
  };
  await store.savePeriodSetup(setup);
  setup.cycleLength = 99;

  assert.deepEqual(await store.getPeriodSetup(), {
    lastPeriodStart: '2026-10-20',
    cycleLength: 30,
    periodLength: 6,
    step: 'complete',
  });
});

test('invalid daily answers reject atomically on writes and seeds', async () => {
  const store = createDemoHealthStore({ today: TODAY });
  const before = await store.getDailyLog(DEMO_FILLED_DATE);
  for (const patch of [
    { mood: 'angry' }, { flow: 'medium' },
    { physicalSymptoms: ['madeUp'] }, { emotionalSymptoms: ['madeUp'] },
    { physicalSymptoms: ['fatigue'] }, { emotionalSymptoms: ['headache'] },
    { physicalSymptoms: [null] }, { emotionalSymptoms: [undefined] },
    { physicalSymptoms: 'headache' }, { reflection: 123 },
  ]) {
    await assert.rejects(store.patchDailyLog(DEMO_FILLED_DATE, {
      reflection: 'Should not be saved', ...patch,
    }), /Invalid/);
    assert.deepEqual(await store.getDailyLog(DEMO_FILLED_DATE), before);
    assert.throws(() => createEmptyStore({ initialDailyLogs: [{ ...before, ...patch }] }), /Invalid/);
  }
});

test('invalid setup answers reject atomically on writes and seeds', async () => {
  const store = createDemoHealthStore({ today: TODAY });
  const before = await store.getPeriodSetup();
  for (const patch of [
    { cycleLength: 20 }, { cycleLength: 46 }, { cycleLength: 99 },
    { cycleLength: 28.5 }, { cycleLength: NaN }, { cycleLength: '28' },
    { periodLength: 0 }, { periodLength: 13 }, { periodLength: 5.5 },
    { periodLength: Infinity }, { step: 'oops' }, { step: null },
    { lastPeriodStart: '' },
  ]) {
    const value = { ...before, ...patch };
    await assert.rejects(store.savePeriodSetup(value));
    assert.deepEqual(await store.getPeriodSetup(), before);
    assert.throws(() => createEmptyStore({ initialPeriodSetup: value }));
  }
});

test('setup boundaries, unanswered lengths and all setup steps are accepted', async () => {
  const store = createEmptyStore();
  for (const [cycleLength, periodLength] of [[21, 1], [45, 12], [null, null]]) {
    for (const step of ['intro', 'lastPeriod', 'cycle', 'length', 'complete']) {
      const setup = { lastPeriodStart: null, cycleLength, periodLength, step };
      await store.savePeriodSetup(setup);
      assert.deepEqual(await store.getPeriodSetup(), setup);
    }
  }
});

test('invalid dates and reversed read ranges are rejected', async () => {
  const store = createEmptyStore();

  await assert.rejects(store.getDailyLog('2026-02-30'), /valid local date/);
  await assert.rejects(
    store.getPeriodDays('2026-10-20', '2026-10-19'),
    /from must not be after to/,
  );
  await assert.rejects(
    store.updatePeriodDays({ add: ['not-a-date'], remove: [] }),
    /valid local date/,
  );
});

test('future recorded dates are rejected', async () => {
  const store = createEmptyStore();
  const future = '2026-11-08';

  await assert.rejects(
    store.updatePeriodDays({ add: [future], remove: [] }),
    /cannot be in the future/,
  );
  await assert.rejects(
    store.patchDailyLog(future, { mood: 'happy' }),
    /cannot be in the future/,
  );
  await assert.rejects(
    store.savePeriodSetup({
      lastPeriodStart: future,
      cycleLength: 28,
      periodLength: 5,
      step: 'complete',
    }),
    /cannot be in the future/,
  );
});

test('configured read failures reject without returning sample data', async () => {
  const failure = new Error('Demo read failure');
  const store = createDemoHealthStore({ today: TODAY, readError: failure });

  await assert.rejects(
    store.getDailyLog(DEMO_FILLED_DATE),
    (error) => error === failure,
  );
  await assert.rejects(
    store.getPeriodDays(DEMO_EMPTY_DATE, DEMO_FILLED_DATE),
    (error) => error === failure,
  );
  await assert.rejects(
    store.getPeriodSetup(),
    (error) => error === failure,
  );
});

test('configured write failures reject without changing stored data', async () => {
  const failure = new Error('Demo write failure');
  const store = createEmptyStore({ writeError: failure });
  const date = '2026-10-20';

  await assert.rejects(
    store.updatePeriodDays({ add: [date], remove: [] }),
    (error) => error === failure,
  );
  await assert.rejects(
    store.patchDailyLog(date, { mood: 'happy' }),
    (error) => error === failure,
  );
  await assert.rejects(
    store.savePeriodSetup({
      lastPeriodStart: date,
      cycleLength: 28,
      periodLength: 5,
      step: 'complete',
    }),
    (error) => error === failure,
  );

  assert.deepEqual(await store.getPeriodDays(date, date), []);
  assert.equal((await store.getDailyLog(date)).mood, null);
  assert.equal((await store.getPeriodSetup()).step, 'intro');
});

test('each read can fail once and then return the same data on retry', async () => {
  const store = createDemoHealthStore({ today: TODAY });
  for (const read of [
    () => store.getDailyLog(DEMO_FILLED_DATE),
    () => store.getPeriodDays(DEMO_EMPTY_DATE, DEMO_FILLED_DATE),
    () => store.getPeriodSetup(),
  ]) {
    const before = await read();
    const error = new Error('Read once');
    store.failNextRead(error);
    await assert.rejects(read(), (actual) => actual === error);
    assert.deepEqual(await read(), before);
  }
});

test('each write can fail without mutation and then succeed on retry', async () => {
  const store = createEmptyStore();
  const date = '2026-10-20';
  const setup = { lastPeriodStart: date, cycleLength: 28, periodLength: 5, step: 'complete' };
  for (const [write, read, expected] of [
    [() => store.updatePeriodDays({ add: [date], remove: [] }),
      () => store.getPeriodDays(date, date), [date]],
    [() => store.patchDailyLog(date, { mood: 'happy' }),
      async () => (await store.getDailyLog(date)).mood, 'happy'],
    [() => store.savePeriodSetup(setup), () => store.getPeriodSetup(), setup],
  ]) {
    const before = await read();
    const error = new Error('Write once');
    store.failNextWrite(error);
    await assert.rejects(write(), (actual) => actual === error);
    assert.deepEqual(await read(), before);
    await write();
    assert.deepEqual(await read(), expected);
  }
});

test('pending failures are independent across operation types and stores', async () => {
  const first = createEmptyStore();
  const second = createEmptyStore();
  const readError = new Error('Read');
  const writeError = new Error('Write');
  first.failNextRead(new Error('Replaced'));
  first.failNextRead(readError);
  first.failNextWrite(writeError);
  await second.getPeriodSetup();
  await second.savePeriodSetup(await second.getPeriodSetup());
  await assert.rejects(first.getPeriodSetup(), (error) => error === readError);
  const setup = await first.getPeriodSetup();
  await assert.rejects(first.savePeriodSetup(setup), (error) => error === writeError);
  await first.savePeriodSetup(setup);
});

test('one-shot failures precede permanent failures without clearing them', async () => {
  const permanent = new Error('Permanent');
  const once = new Error('Once');
  const store = createEmptyStore({ readError: permanent, writeError: permanent });
  store.failNextRead(once);
  store.failNextWrite(once);
  for (const operation of [
    () => store.getPeriodSetup(),
    () => store.updatePeriodDays({ add: [], remove: [] }),
  ]) {
    await assert.rejects(operation(), (error) => error === once);
    await assert.rejects(operation(), (error) => error === permanent);
  }
});

test('separate demo stores do not share mutations', async () => {
  const first = createDemoHealthStore({ today: TODAY });
  const second = createDemoHealthStore({ today: TODAY });

  await first.patchDailyLog(DEMO_FILLED_DATE, { mood: 'verySad' });
  await first.updatePeriodDays({ add: [], remove: [DEMO_FILLED_DATE] });

  assert.equal((await second.getDailyLog(DEMO_FILLED_DATE)).mood, 'happy');
  assert.deepEqual(
    await second.getPeriodDays(DEMO_FILLED_DATE, DEMO_FILLED_DATE),
    [DEMO_FILLED_DATE],
  );
});
