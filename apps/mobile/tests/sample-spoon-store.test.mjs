import assert from 'node:assert/strict';
import test from 'node:test';
import { createSampleSpoonStore } from '../src/features/spoons/sample-spoon-store.ts';

const today = '2026-11-19';
const yesterday = '2026-11-18';
const now = () => new Date(2026, 10, 19, 14);
const setup = (options = {}) => createSampleSpoonStore({ now, ...options });
const mutation = (operationId, expectedRevision, date = today) => ({ date, operationId, expectedRevision });
const draft = { name: 'Take a walk', kind: 'spend', amount: 3 };
const create = (operationId, expectedRevision, fields = {}, date = today) =>
  ({ ...mutation(operationId, expectedRevision, date), draft: { ...draft, ...fields } });
const choose = (store, amount, expectedRevision = 0) =>
  store.setStartingEnergy({ ...mutation(`choose-${expectedRevision}`, expectedRevision), amount });

test('new stores distinguish unanswered from zero and isolate instances', async () => {
  const { store } = setup();
  const another = setup().store;
  assert.deepEqual(await store.getDay(today), {
    date: today, startingEnergy: null, balance: null, revision: 0, tasks: [], effects: [],
  });
  const [day] = await choose(store, 0);
  assert.deepEqual([day.startingEnergy, day.balance, day.revision], [0, 0, 1]);
  assert.equal((await another.getDay(today)).balance, null);
});

test('task details round-trip and caller mutations cannot change saved data', async () => {
  const { store } = setup();
  const fields = { time: '08:05', priority: 'medium', notes: 'Bring water', subtasks: [{ id: 'sub-1', name: 'Pack', done: false }] };
  const [day] = await store.createTask(create('create', 0, fields));
  const [task] = day.tasks;
  assert.deepEqual(task, { ...draft, ...fields, id: task.id, date: today, completion: null });
  assert.equal(day.balance, null);
  fields.subtasks[0].name = 'Changed';
  task.subtasks[0].done = true;
  const saved = (await store.getDay(today)).tasks[0];
  assert.deepEqual(saved.subtasks, [{ id: 'sub-1', name: 'Pack', done: false }]);
  const [updated] = await store.updateTask({
    ...mutation('update', 1), taskId: task.id, draft: { ...draft, subtasks: [{ ...saved.subtasks[0], done: true }] },
  });
  assert.equal(updated.tasks[0].subtasks[0].done, true);
  assert.equal(updated.balance, null);
  const [deleted] = await store.deleteTask({ ...mutation('delete', 2), taskId: task.id });
  assert.deepEqual(deleted.tasks, []);
});

test('invalid dates, names, and amounts leave the day untouched', async () => {
  const { store } = setup();
  for (const amount of [-1, 6, 1.5, NaN, Infinity]) {
    await assert.rejects(choose(store, amount), { code: 'validation' });
    await assert.rejects(store.createTask(create('invalid', 0, { amount })), { code: 'validation' });
  }
  for (const fields of [{ name: ' ' }, { date: '2026-02-30' }, { time: '24:05' }, {
    subtasks: [{ id: 'same', name: 'One', done: false }, { id: 'same', name: 'Two', done: false }],
  }]) {
    await assert.rejects(store.createTask(create('invalid', 0, fields)), { code: 'validation' });
  }
  await assert.rejects(store.getDay('2026-02-30'), { code: 'validation' });
  assert.equal((await store.getDay(today)).revision, 0);
  assert.equal((await store.createTask(create('invalid', 0)))[0].revision, 1);
});

test('completion requires an answer and explicit zero allows a capped completion', async () => {
  const { store } = setup();
  const [day] = await store.createTask(create('add', 0));
  const taskId = day.tasks[0].id;
  await assert.rejects(store.completeTask({ ...mutation('finish', 1), taskId }), { code: 'unanswered-energy' });
  await choose(store, 0, 1);
  const [done] = await store.completeTask({ ...mutation('finish', 2), taskId });
  assert.equal(done.balance, 0);
  assert.equal(done.tasks[0].completion.appliedChange, 0);
});

for (const [kind, starting, balance, applied] of [['spend', 1, 0, -1], ['recharge', 4, 5, 1], ['recharge', 5, 5, 0]]) {
  test(`${kind} from ${starting} records only the change that fits and repeated actions do nothing`, async () => {
    const { store } = setup();
    await choose(store, starting);
    const [planned] = await store.createTask(create('add', 1, { kind }));
    const taskId = planned.tasks[0].id;
    assert.equal(planned.balance, starting);
    const complete = { ...mutation('finish', 2), taskId };
    const [done] = await store.completeTask(complete);
    assert.equal(done.balance, balance);
    assert.deepEqual(done.effects, [{ taskId, kind: 'complete', requestedAmount: 3, appliedChange: applied, at: now().toISOString() }]);
    const [alreadyDone] = await store.completeTask({ ...mutation('new-finish', 3), taskId });
    assert.equal(alreadyDone.revision, 3);
    const [undone] = await store.undoCompletion({ ...mutation('undo', 3), taskId });
    assert.equal(undone.balance, starting);
    assert.equal(undone.effects[1].appliedChange, 0 - applied);
    assert.equal(undone.tasks[0].completion, null);
    const [again] = await store.undoCompletion({ ...mutation('again', 4), taskId });
    assert.equal(again.revision, 4);
    assert.deepEqual(await store.completeTask(complete), [again]);
  });
}

for (const [firstKind, secondKind, start, expected] of [['spend', 'recharge', 1, 5], ['recharge', 'spend', 4, 0]]) {
  test(`undo of ${firstKind} is bounded after an intervening ${secondKind}`, async () => {
    const { store } = setup();
    await choose(store, start);
    const [first] = await store.createTask(create('first', 1, { kind: firstKind }));
    const [second] = await store.createTask(create('second', 2, { kind: secondKind, amount: 5 }));
    await store.completeTask({ ...mutation('finish-1', 3), taskId: first.tasks[0].id });
    await store.completeTask({ ...mutation('finish-2', 4), taskId: second.tasks[1].id });
    const [undone] = await store.undoCompletion({ ...mutation('undo', 5), taskId: first.tasks[0].id });
    assert.equal(undone.balance, expected);
    assert.equal(undone.effects.at(-1).appliedChange, 0);
  });
}

test('starting-energy edits keep effects and completed tasks require undo before edits or deletion', async () => {
  const { store } = setup();
  await choose(store, 3);
  const [planned] = await store.createTask(create('add', 1, { amount: 2 }));
  const taskId = planned.tasks[0].id;
  const [done] = await store.completeTask({ ...mutation('finish', 2), taskId });
  const [edited] = await choose(store, 1, 3);
  assert.equal(edited.balance, 0);
  const [restored] = await choose(store, 3, 4);
  assert.equal(restored.balance, 1);
  assert.deepEqual(restored.effects, done.effects);
  await assert.rejects(store.deleteTask({ ...mutation('delete', 5), taskId }), { code: 'validation' });
  await assert.rejects(store.updateTask({ ...mutation('edit', 5), taskId, draft }), { code: 'validation' });
  await store.undoCompletion({ ...mutation('undo', 5), taskId });
  const [deleted] = await store.deleteTask({ ...mutation('delete', 6), taskId });
  assert.equal(deleted.effects.length, 2);
  assert.deepEqual(deleted.tasks, []);
});

test('failed reads and writes are retryable and leave atomic effects intact', async () => {
  const { store, failNextRead, failNextWrite } = setup();
  await choose(store, 3);
  const [planned] = await store.createTask(create('add', 1));
  const input = { ...mutation('finish', 2), taskId: planned.tasks[0].id };
  failNextRead();
  await assert.rejects(store.getDay(today), { code: 'unavailable' });
  failNextWrite();
  await assert.rejects(store.completeTask(input), { code: 'unavailable' });
  assert.deepEqual(await store.getDay(today), planned);
  const [done] = await store.completeTask(input);
  assert.equal(done.balance, 0);
  assert.equal(done.effects.length, 1);
});

test('concurrent writes serialize at the revision check and duplicate IDs are safe', async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const { store } = setup({ delay: (kind) => kind === 'write' ? pending : Promise.resolve() });
  const request = create('add', 0, { notes: 'Original' });
  const first = store.createTask(request);
  const duplicate = store.createTask({ draft: { notes: 'Original', ...draft }, ...mutation('add', 0) });
  const competing = assert.rejects(store.createTask(create('different', 0)), { code: 'conflict' });
  request.draft.notes = 'Changed while pending';
  assert.deepEqual((await store.getDay(today)).tasks, []);
  release();
  const [day] = await first;
  assert.deepEqual(await duplicate, [day]);
  await competing;
  assert.equal(day.tasks.length, 1);
  assert.equal(day.tasks[0].notes, 'Original');
  await assert.rejects(store.createTask(create('add', 0)), { code: 'conflict' });
});

test('the next local day starts unanswered and rollover moves only the selected unfinished task', async () => {
  let time = new Date(2026, 10, 18, 23, 59);
  const { store } = setup({ now: () => time });
  await store.setStartingEnergy({ ...mutation('yesterday-energy', 0, yesterday), amount: 4 });
  const [planned] = await store.createTask(create('add-previous', 1, { notes: 'Keep me' }, yesterday));
  const [donePlan] = await store.createTask(create('add-done', 2, {}, yesterday));
  const taskId = planned.tasks[0].id;
  const finishedId = donePlan.tasks[1].id;
  await store.completeTask({ ...mutation('finish-previous', 3, yesterday), taskId: finishedId });
  time = now();
  assert.equal((await store.getDay(today)).balance, null);
  assert.deepEqual((await store.listUnfinishedPreviousTasks(today)).map((task) => task.id), [taskId]);
  await assert.rejects(store.moveTaskToToday({
    ...mutation('move-done', 4, yesterday), destinationDate: today, expectedDestinationRevision: 0, taskId: finishedId,
  }), { code: 'validation' });
  const move = { ...mutation('move', 4, yesterday), destinationDate: today, expectedDestinationRevision: 0, taskId };
  const [oldDay, newDay] = await store.moveTaskToToday(move);
  assert.equal(oldDay.balance, 1);
  assert.equal(newDay.balance, null);
  assert.deepEqual(newDay.tasks, [{ ...planned.tasks[0], date: today }]);
  assert.deepEqual(await store.listUnfinishedPreviousTasks(today), []);
  const tomorrow = '2026-11-20';
  const update = { ...mutation('reschedule', 1), taskId, draft: { ...draft, date: tomorrow } };
  await assert.rejects(store.updateTask(update), { code: 'conflict' });
  assert.deepEqual(await store.getDay(today), newDay);
  const [source, destination] = await store.updateTask({ ...update, expectedDestinationRevision: 0 });
  assert.deepEqual(source.tasks, []);
  assert.equal(destination.tasks[0].id, taskId);
  time = new Date(2026, 10, 20, 9);
  assert.deepEqual(await store.moveTaskToToday(move), [oldDay, source]);
  assert.equal((await store.createTask(create('draft-on-new-day', 1, {}, tomorrow)))[0].date, tomorrow);
});

test('create and rollover reject a new target day even when its revision matches', async () => {
  let time = new Date(2026, 10, 19, 23, 59);
  const tomorrow = '2026-11-20';
  const { store } = setup({ now: () => time, fixture: 'previous' });
  const [previous] = await store.listUnfinishedPreviousTasks(today);
  const request = create('create', 0);
  const move = {
    ...mutation('move', 1, yesterday), taskId: previous.id,
    destinationDate: today, expectedDestinationRevision: 0,
  };
  const pending = [store.createTask(request), store.moveTaskToToday(move)];
  time = new Date(2026, 10, 20, 0, 1);
  await Promise.all(pending.map((result) => assert.rejects(result, { code: 'conflict' })));
  assert.equal((await store.getDay(tomorrow)).revision, 0);
  assert.deepEqual((await store.getDay(yesterday)).tasks, [previous]);
  const [, moved] = await store.moveTaskToToday({ ...move, destinationDate: tomorrow });
  const [created] = await store.createTask({ ...request, date: tomorrow, expectedRevision: moved.revision });
  assert.deepEqual(created.tasks.map((task) => task.date), [tomorrow, tomorrow]);
});

test('fixture states are opt-in and readable through the shared interface', async () => {
  const get = (fixture) => setup({ fixture }).store;
  assert.equal((await get('unanswered').getDay(today)).balance, null);
  assert.equal((await get('zero').getDay(today)).balance, 0);
  const planned = await get('planned').getDay(today);
  assert.ok(planned.tasks.some((task) => task.amount <= planned.balance));
  assert.ok(planned.tasks.some((task) => task.amount > planned.balance));
  const activity = await get('activity').getDay(today);
  assert.deepEqual(activity.effects.map(({ requestedAmount, appliedChange }) => [requestedAmount, appliedChange]), [[1, -1], [3, 1]]);
  assert.equal((await get('previous').listUnfinishedPreviousTasks(today))[0].date, yesterday);
});
