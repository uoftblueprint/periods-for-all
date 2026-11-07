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
