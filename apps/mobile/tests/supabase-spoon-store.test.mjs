// The Supabase SpoonStore against a fake client. No real backend;
// the database rules are covered by the SQL tests in supabase/tests.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SpoonStoreError } from '../src/features/spoons/contracts.ts';
import { createSupabaseSpoonStore } from '../src/features/spoons/supabase-spoon-store.ts';

const day = (date, fields = {}) => ({
  date, startingEnergy: null, balance: null, revision: 0, tasks: [], effects: [], ...fields,
});

/** Fake client: records rpc calls and answers each with the next queued reply. */
function fakeClient(...replies) {
  const calls = [];
  const client = {
    rpc: async (name, args) => {
      calls.push([name, args]);
      const reply = replies.length > 1 ? replies.shift() : replies[0];
      if (reply instanceof Error) throw reply;
      return reply;
    },
  };
  return { client, calls };
}

const ok = (data) => ({ data, error: null });
const failed = (code, message) => ({ data: null, error: { code, message } });

// 2026-11-22 at 23:59 local time, then one minute later.
let clock = new Date(2026, 10, 22, 23, 59);
const now = () => clock;
const setup = (...replies) => {
  const fake = fakeClient(...replies);
  return { ...fake, store: createSupabaseSpoonStore(fake.client, 'user-a', { now }) };
};

const mutation = { date: '2026-11-22', operationId: 'op-1', expectedRevision: 0 };
const task = { ...mutation, taskId: 'task-1' };
const move = { ...task, date: '2026-11-21', destinationDate: '2026-11-22', expectedDestinationRevision: 0 };

test('each method calls its database function with the input and the account ID', async () => {
  clock = new Date(2026, 10, 22, 23, 59);
  const { store, calls } = setup(ok([day('2026-11-22')]));
  const draft = { name: 'Walk', kind: 'spend', amount: 1 };

  await store.setStartingEnergy({ ...mutation, amount: 3 });
  await store.createTask({ ...mutation, draft });
  await store.updateTask({ ...task, draft });
  await store.deleteTask(task);
  await store.completeTask(task);
  await store.undoCompletion(task);
  await store.moveTaskToToday(move);

  assert.deepEqual(calls, [
    ['set_spoon_starting_energy', { p_input: { ...mutation, amount: 3 }, p_expected_user_id: 'user-a' }],
    ['create_spoon_task', { p_input: { ...mutation, draft }, p_today: '2026-11-22', p_expected_user_id: 'user-a' }],
    ['update_spoon_task', { p_input: { ...task, draft }, p_expected_user_id: 'user-a' }],
    ['delete_spoon_task', { p_input: task, p_expected_user_id: 'user-a' }],
    ['complete_spoon_task', { p_input: task, p_expected_user_id: 'user-a' }],
    ['undo_spoon_completion', { p_input: task, p_expected_user_id: 'user-a' }],
    ['move_spoon_task_to_today', { p_input: move, p_today: '2026-11-22', p_expected_user_id: 'user-a' }],
  ]);
});

test('reads call their functions and return the saved records', async () => {
  const saved = day('2026-11-22', { startingEnergy: 0, balance: 0, revision: 1 });
  const unfinished = [{ id: 'task-1', date: '2026-11-21', name: 'Walk' }];
  const { store, calls } = setup(ok(saved), ok(unfinished));

  // Explicit zero comes back as zero, not unanswered.
  assert.deepEqual(await store.getDay('2026-11-22'), saved);
  assert.deepEqual(await store.listUnfinishedPreviousTasks('2026-11-22'), unfinished);
  assert.deepEqual(calls, [
    ['get_spoon_day', { p_date: '2026-11-22', p_expected_user_id: 'user-a' }],
    ['list_unfinished_previous_spoon_tasks', { p_today: '2026-11-22', p_expected_user_id: 'user-a' }],
  ]);
});

test('an unanswered day comes back as null, not zero', async () => {
  const { store } = setup(ok(day('2026-11-23')));
  const unanswered = await store.getDay('2026-11-23');
  assert.equal(unanswered.startingEnergy, null);
  assert.equal(unanswered.balance, null);
});

test('mutations return the affected days, source first', async () => {
  const days = [day('2026-11-21', { revision: 3 }), day('2026-11-22', { revision: 1 })];
  const { store } = setup(ok(days));
  assert.deepEqual(await store.moveTaskToToday(move), days);
});

test('"today" is read when saving, so a save after midnight uses the new day', async () => {
  clock = new Date(2026, 10, 22, 23, 59);
  const { store, calls } = setup(ok([day('2026-11-22')]));
  const draft = { name: 'Walk', kind: 'spend', amount: 1 };

  await store.createTask({ ...mutation, draft });
  clock = new Date(2026, 10, 23, 0, 0);
  await store.createTask({ ...mutation, operationId: 'op-2', draft });

  assert.deepEqual(calls.map(([, args]) => args.p_today), ['2026-11-22', '2026-11-23']);
});

test('database error codes become SpoonStoreError codes with their messages', async () => {
  const cases = [
    ['SP400', 'validation', 'Choose a whole number between 0 and 5.'],
    ['SP404', 'missing-task', 'This task no longer exists on the selected day.'],
    ['SP409', 'conflict', 'This day changed. Reload it and try again.'],
    ['SP428', 'unanswered-energy', 'Set starting energy before completing a task.'],
  ];
  for (const [sqlState, code, message] of cases) {
    const { store } = setup(failed(sqlState, message));
    await assert.rejects(store.completeTask(task), (error) => {
      assert.ok(error instanceof SpoonStoreError);
      assert.deepEqual([error.code, error.message], [code, message]);
      return true;
    });
  }
});

test('other failures are "unavailable" and never show server details', async () => {
  const replies = [
    failed('42501', 'user mismatch: call was made for a different user'),
    failed('23514', 'new row violates check constraint, Failing row contains (private note)'),
    failed(undefined, 'TypeError: fetch failed'),
    new Error('Network request failed'),
  ];
  for (const reply of replies) {
    const { store } = setup(reply);
    await assert.rejects(store.setStartingEnergy({ ...mutation, amount: 2 }), (error) => {
      assert.ok(error instanceof SpoonStoreError);
      assert.deepEqual([error.code, error.message], ['unavailable', 'Could not save your spoons. Please try again.']);
      return true;
    });
  }

  const { store } = setup(failed('PGRST202', 'Could not find the function'));
  await assert.rejects(store.getDay('2026-11-22'), {
    code: 'unavailable', message: 'Could not load your spoons. Please try again.',
  });
});

test('a failed save rejects instead of claiming success', async () => {
  for (const reply of [ok(null), ok([]), ok([{ date: '2026-11-22' }]), ok({ date: '2026-11-22' })]) {
    const { store } = setup(reply);
    await assert.rejects(store.completeTask(task), { code: 'unavailable' });
  }
  const { store } = setup(ok(null));
  await assert.rejects(store.getDay('2026-11-22'), { code: 'unavailable' });

  for (const reply of [ok(null), ok([null]), ok([{ name: 'Walk' }])]) {
    const { store: list } = setup(reply);
    await assert.rejects(list.listUnfinishedPreviousTasks('2026-11-22'), { code: 'unavailable' });
  }
});

test('a retry sends the same operation ID unchanged', async () => {
  const { store, calls } = setup(new Error('Network request failed'), ok([day('2026-11-22')]));
  await assert.rejects(store.completeTask(task), { code: 'unavailable' });
  await store.completeTask(task);
  assert.deepEqual(calls[0], calls[1]);
});

test('invalid dates are rejected before calling the database', async () => {
  const { store, calls } = setup(ok(day('2026-11-22')));
  await assert.rejects(store.getDay('2026-02-30'), { code: 'validation' });
  await assert.rejects(store.listUnfinishedPreviousTasks('yesterday'), { code: 'validation' });
  assert.equal(calls.length, 0);
});

test('nothing is cached between calls or shared between accounts', async () => {
  const fake = fakeClient(ok(day('2026-11-22')));
  const storeA = createSupabaseSpoonStore(fake.client, 'user-a', { now });
  const storeB = createSupabaseSpoonStore(fake.client, 'user-b', { now });

  await storeA.getDay('2026-11-22');
  await storeA.getDay('2026-11-22');
  await storeB.getDay('2026-11-22');

  assert.deepEqual(fake.calls.map(([, args]) => args.p_expected_user_id), ['user-a', 'user-a', 'user-b']);
});
