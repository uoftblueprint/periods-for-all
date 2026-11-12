// The Supabase HealthStore against a fake client. No network or real backend;
// database behaviour is covered by the SQL tests in supabase/tests.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseHealthStore } from '../src/features/health/supabase-health-store.ts';

/**
 * Fake client: every query method is recorded and chains, and awaiting the
 * query (or calling rpc) gives `result`.
 */
function fakeClient(result) {
  const calls = [];
  const query = new Proxy({}, {
    get: (_, name) =>
      name === 'then'
        ? (resolve, reject) => Promise.resolve(result).then(resolve, reject)
        : (...args) => {
            calls.push([name, ...args]);
            return query;
          },
  });
  const client = {
    from: (table) => {
      calls.push(['from', table]);
      return query;
    },
    rpc: async (...args) => {
      calls.push(['rpc', ...args]);
      return result;
    },
  };
  return { store: createSupabaseHealthStore(client, 'user-a'), calls };
}

const call = (calls, name) => calls.find(([method]) => method === name);

test('patchDailyLog sends only the supplied fields and returns the saved record', async () => {
  const { store, calls } = fakeClient({
    data: {
      date: '2026-10-01',
      mood: 'happy',
      flow: null,
      physical_symptoms: [],
      emotional_symptoms: null,
      reflection: null,
    },
    error: null,
  });

  const saved = await store.patchDailyLog('2026-10-01', { physicalSymptoms: [], reflection: '' });

  // mood, flow and emotional symptoms are left out, so the database keeps them.
  assert.deepEqual(call(calls, 'upsert'), [
    'upsert',
    { user_id: 'user-a', date: '2026-10-01', physical_symptoms: [], reflection: null },
    { onConflict: 'user_id,date' },
  ]);
  assert.deepEqual(saved, {
    date: '2026-10-01',
    mood: 'happy',
    flow: null,
    physicalSymptoms: [],
    emotionalSymptoms: null,
    reflection: null,
  });
});

test('an empty patch reads the day instead of creating a row', async () => {
  const { store, calls } = fakeClient({ data: null, error: null });

  const log = await store.patchDailyLog('2026-10-01', {});

  assert.equal(call(calls, 'upsert'), undefined);
  assert.equal(log.mood, null);
});

test('missing rows load as unanswered', async () => {
  const { store } = fakeClient({ data: null, error: null });

  assert.deepEqual(await store.getDailyLog('2026-10-01'), {
    date: '2026-10-01',
    mood: null,
    flow: null,
    physicalSymptoms: null,
    emotionalSymptoms: null,
    reflection: null,
  });
  assert.deepEqual(await store.getPeriodSetup(), {
    lastPeriodStart: null,
    cycleLength: null,
    periodLength: null,
    step: 'intro',
  });
});

test('updatePeriodDays sends the whole change in one database call', async () => {
  const { store, calls } = fakeClient({ data: null, error: null });

  await store.updatePeriodDays({ add: ['2026-10-02'], remove: ['2026-10-01'] });

  assert.deepEqual(calls, [
    [
      'rpc',
      'update_period_days',
      { p_add: ['2026-10-02'], p_remove: ['2026-10-01'], p_expected_user_id: 'user-a' },
    ],
  ]);
});

test('a failed save rejects without exposing the answers', async () => {
  const { store } = fakeClient({
    data: null,
    error: { message: 'violates check constraint: mood = "secret"' },
  });

  await assert.rejects(store.patchDailyLog('2026-10-01', { mood: 'happy' }), {
    message: 'Could not save your daily log. Please try again.',
  });
});
