import assert from 'node:assert/strict';
import test from 'node:test';
import { createSampleSpoonStore } from '../src/features/spoons/sample-spoon-store.ts';
import { createSpendTaskActions, groupSpendTasks } from '../src/features/spoons/spend-task-actions.ts';

const date = '2026-11-22';

async function setup(balance = 5, amounts = [3, 2, 1]) {
  const sample = createSampleSpoonStore({ now: () => new Date(2026, 10, 22) });
  const { store } = sample;
  let id = 0;
  const nextId = () => String(++id);
  let day = await store.getDay(date);
  const input = () => ({ date, expectedRevision: day.revision, operationId: nextId() });
  if (balance !== null) [day] = await store.setStartingEnergy({ ...input(), amount: balance });
  for (const amount of amounts) {
    [day] = await store.createTask({ ...input(), draft: { kind: 'spend', name: `Cost ${amount}`, amount } });
  }
  const actions = createSpendTaskActions(store, date, nextId);
  await actions.load();
  return { ...sample, actions, input, nextId, task: day.tasks[0] };
}

test('planned spending uses the running total in order and ignores recharge and completed tasks', async () => {
  const { actions } = await setup(5, [3, 2, 3, 1]);
  const day = actions.getSnapshot().day;
  const recharge = { ...day.tasks[0], id: 'recharge', kind: 'recharge' };
  const completed = { ...day.tasks[0], id: 'done', completion: { appliedChange: -1 } };
  const groups = groupSpendTasks({ ...day, tasks: [recharge, completed, ...day.tasks] });
  assert.deepEqual(groups.planned.map((task) => task.amount), [3, 2]);
  assert.deepEqual(groups.overBudget.map((task) => task.amount), [3, 1]);
  assert.deepEqual(groups.completed.map((task) => task.id), ['done']);
  const { actions: smaller } = await setup(5, [3, 3, 1]);
  assert.deepEqual(groupSpendTasks(smaller.getSnapshot().day).overBudget.map((task) => task.amount), [3, 1]);
});

test('an over-budget group is separate from the selected task warning', async () => {
  const { actions } = await setup();
  const over = groupSpendTasks(actions.getSnapshot().day).overBudget[0];
  await actions.toggle(over.id);
  assert.equal(actions.getSnapshot().warning, null);
  assert.equal(actions.getSnapshot().day.balance, 4);
});

test('Cancel leaves the store untouched; Continue completes at zero and undo restores only one', async () => {
  const { actions, store, task } = await setup(1);
  const original = await store.getDay(date);
  actions.toggle(task.id);
  assert.equal(actions.getSnapshot().warning.task.id, task.id);
  actions.cancel();
  assert.deepEqual(await store.getDay(date), original);
  actions.toggle(task.id);
  await actions.confirm();
  assert.equal(actions.getSnapshot().day.balance, 0);
  assert.equal(actions.getSnapshot().day.tasks[0].completion.appliedChange, -1);
  assert.equal(actions.getSnapshot().announcement, 'Cost 3 completed. 0 spoons left.');
  await actions.toggle(task.id);
  assert.equal(actions.getSnapshot().day.balance, 1);
  assert.equal(actions.getSnapshot().day.tasks[0].completion, null);
  assert.equal(actions.getSnapshot().announcement, 'Cost 3 undone. 1 spoon left.');
});

test('explicit zero warns for spending; unanswered energy asks for setup', async () => {
  const zero = await setup(0);
  zero.actions.toggle(zero.task.id);
  assert.equal(zero.actions.getSnapshot().warning.task.id, zero.task.id);
  await zero.actions.confirm();
  assert.equal(zero.actions.getSnapshot().day.tasks[0].completion.appliedChange, 0);
  const unanswered = await setup(null);
  unanswered.actions.toggle(unanswered.task.id);
  assert.match(unanswered.actions.getSnapshot().error, /Set today’s spoons/);
  assert.equal(unanswered.actions.getSnapshot().warning, null);
  assert.equal((await unanswered.store.getDay(date)).balance, null);
});

test('duplicate presses and transient failures preserve the task and retry the same operation', async () => {
  const { store, task, failNextWrite, nextId } = await setup();
  const requests = [];
  const undoRequests = [];
  const actions = createSpendTaskActions({
    ...store,
    completeTask(input) { requests.push(input); return store.completeTask(input); },
    undoCompletion(input) { undoRequests.push(input); return store.undoCompletion(input); },
  }, date, nextId);
  await actions.load();
  const day = actions.getSnapshot().day;
  failNextWrite();
  const inFlight = actions.toggle(task.id);
  actions.toggle(task.id);
  await inFlight;
  assert.deepEqual(actions.getSnapshot().day, day);
  assert.equal(actions.getSnapshot().canRetry, true);
  assert.equal(requests.length, 1);
  await actions.retry();
  assert.deepEqual(requests, [requests[0], requests[0]]);
  assert.equal(actions.getSnapshot().day.balance, 2);
  const completed = actions.getSnapshot().day;
  failNextWrite();
  await actions.toggle(task.id);
  assert.deepEqual(actions.getSnapshot().day, completed);
  await actions.retry();
  assert.deepEqual(undoRequests, [undoRequests[0], undoRequests[0]]);
  assert.equal(actions.getSnapshot().day.balance, 5);
});

test('a stale confirmation reloads and waits for a new action', async () => {
  const { actions, store, task, input } = await setup(1, [3]);
  actions.toggle(task.id);
  await store.setStartingEnergy({ ...input(), amount: 2 });
  await actions.confirm();
  const { day, warning, error } = actions.getSnapshot();
  assert.equal(day.balance, 2);
  assert.equal(day.tasks[0].completion, null);
  assert.equal(warning, null);
  assert.match(error, /changed/);
  actions.toggle(task.id);
  assert.equal(actions.getSnapshot().warning.task.id, task.id);
});

test('a replay after an intervening undo reports the returned state', async () => {
  const { store, nextId, task } = await setup();
  let loseResponse = true;
  const actions = createSpendTaskActions({
    ...store,
    async completeTask(input) {
      const [saved] = await store.completeTask(input);
      if (!loseResponse) return [saved];
      loseResponse = false;
      await store.undoCompletion({
        date, taskId: task.id, expectedRevision: saved.revision, operationId: nextId(),
      });
      throw Object.assign(new Error('Response lost'), { code: 'unavailable' });
    },
  }, date, nextId);
  await actions.load();
  await actions.toggle(task.id);
  await actions.retry();
  const { day, announcement } = actions.getSnapshot();
  assert.equal(day.tasks[0].completion, null);
  assert.equal(day.balance, 5);
  assert.equal(announcement, 'Today’s tasks changed. 5 spoons left.');
});
