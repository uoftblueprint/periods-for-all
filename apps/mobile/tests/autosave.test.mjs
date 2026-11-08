import assert from 'node:assert/strict';
import test from 'node:test';
import { createAutosave, emptyAnswers, REFLECTION_DEBOUNCE_MS } from '../src/features/health/autosave.ts';

const DAY = '2026-11-07';
const settle = () => new Promise((resolve) => setImmediate(resolve));

// Every save waits until the test resolves or rejects it by hand.
function createManualStore() {
  const calls = [];
  return {
    calls,
    store: {
      patchDailyLog(date, patch) {
        return new Promise((resolve, reject) => calls.push({ date, patch, resolve, reject }));
      },
    },
  };
}

function setup(initial = emptyAnswers) {
  const { calls, store } = createManualStore();
  const autosave = createAutosave({ date: DAY, store, initial });
  return { calls, autosave };
}

test('opening a day saves nothing and shows no status', () => {
  const { calls, autosave } = setup();
  assert.equal(calls.length, 0);
  assert.equal(autosave.getStatus(), 'idle');
});

test('a choice saves right away with only that field', () => {
  const { calls, autosave } = setup({ ...emptyAnswers, flow: 'light', reflection: 'Kept' });
  autosave.setField('mood', 'happy');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].patch, { mood: 'happy' });
  assert.equal(calls[0].date, DAY);
  assert.equal(autosave.getStatus(), 'saving');
});

test('choosing the same value again does not save', () => {
  const { calls, autosave } = setup({ ...emptyAnswers, mood: 'happy', physicalSymptoms: ['cramps'] });
  autosave.setField('mood', 'happy');
  autosave.setField('physicalSymptoms', ['cramps']);
  assert.equal(calls.length, 0);
});

test('edits during a slow save wait for it, then go out together; newest value wins', async () => {
  const { calls, autosave } = setup();
  autosave.setField('mood', 'happy');
  autosave.setField('mood', 'sad');
  autosave.setField('flow', 'heavy');
  assert.equal(calls.length, 1, 'only one save is in flight');

  calls[0].resolve();
  await settle();
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].patch, { mood: 'sad', flow: 'heavy' });
  assert.equal(autosave.getStatus(), 'saving', 'not Saved until the latest edit is confirmed');

  calls[1].resolve();
  await settle();
  assert.equal(autosave.getStatus(), 'saved');
  assert.equal(autosave.getDraft().mood, 'sad');
});

test('reflection waits for a pause in typing before saving', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { calls, autosave } = setup();
  autosave.setField('reflection', 'Go');
  t.mock.timers.tick(REFLECTION_DEBOUNCE_MS - 1);
  autosave.setField('reflection', 'Good day');
  t.mock.timers.tick(REFLECTION_DEBOUNCE_MS - 1);
  assert.equal(calls.length, 0);
  assert.equal(autosave.getStatus(), 'saving');

  t.mock.timers.tick(1);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].patch, { reflection: 'Good day' });
});

test('leaving the reflection field saves immediately', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { calls, autosave } = setup();
  autosave.setField('reflection', 'Tired');
  autosave.blurReflection();
  assert.deepEqual(calls[0].patch, { reflection: 'Tired' });
  t.mock.timers.tick(REFLECTION_DEBOUNCE_MS);
  assert.equal(calls.length, 1, 'the debounce does not send it a second time');
});

test('a choice does not send half-typed reflection early', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { calls, autosave } = setup();
  autosave.setField('reflection', 'Hal');
  autosave.setField('mood', 'neutral');
  assert.deepEqual(calls[0].patch, { mood: 'neutral' });
});

test('a failed save keeps the draft and Try again resends the same fields', async () => {
  const { calls, autosave } = setup();
  autosave.setField('flow', 'normal');
  calls[0].reject(new Error('offline'));
  await settle();
  assert.equal(autosave.getStatus(), 'error');
  assert.equal(autosave.getDraft().flow, 'normal');
  assert.equal(calls.length, 1, 'no automatic retry loop');

  autosave.retry();
  assert.deepEqual(calls[1].patch, { flow: 'normal' });
  calls[1].resolve();
  await settle();
  assert.equal(autosave.getStatus(), 'saved');
});

test('an edit made while a save is failing is kept and wins over the failed value', async () => {
  const { calls, autosave } = setup();
  autosave.setField('mood', 'happy');
  autosave.setField('mood', 'sad'); // queued behind the first save
  calls[0].reject(new Error('offline'));
  await settle();
  autosave.retry();
  assert.deepEqual(calls[1].patch, { mood: 'sad' });
});

test('a new edit after a failure retries the failed fields with it', async () => {
  const { calls, autosave } = setup();
  autosave.setField('flow', 'light');
  calls[0].reject(new Error('offline'));
  await settle();
  autosave.setField('mood', 'happy');
  assert.deepEqual(calls[1].patch, { flow: 'light', mood: 'happy' });
});

test('clearing answers sends null, and an explicit "none" stays an empty list', async () => {
  const { calls, autosave } = setup({
    ...emptyAnswers, mood: 'happy', reflection: 'Old note', physicalSymptoms: ['cramps'],
  });
  autosave.setField('mood', null);
  autosave.setField('physicalSymptoms', []);
  autosave.setField('reflection', '');
  autosave.blurReflection();
  calls[0].resolve();
  await settle();
  assert.deepEqual(calls[0].patch, { mood: null });
  assert.deepEqual(calls[1].patch, { physicalSymptoms: [], reflection: null });
});

test('flushAll sends typed reflection and reports success', async () => {
  const { calls, autosave } = setup();
  autosave.setField('reflection', 'Almost done');
  const done = autosave.flushAll();
  assert.deepEqual(calls[0].patch, { reflection: 'Almost done' });
  calls[0].resolve();
  assert.equal(await done, true);
});

test('flushAll waits for edits queued behind an in-flight save', async () => {
  const { calls, autosave } = setup();
  autosave.setField('mood', 'happy');
  autosave.setField('flow', 'light');
  const done = autosave.flushAll();
  calls[0].resolve();
  await settle();
  calls[1].resolve();
  assert.equal(await done, true);
});

test('flushAll reports failure so navigation can be stopped', async () => {
  const { calls, autosave } = setup();
  autosave.setField('mood', 'sad');
  const done = autosave.flushAll();
  calls[0].reject(new Error('offline'));
  assert.equal(await done, false);
  assert.equal(autosave.getDraft().mood, 'sad');
});

test('after dispose, late results are ignored and answers are cleared from memory', async () => {
  const { calls, autosave } = setup({ ...emptyAnswers, mood: 'happy' });
  let notified = 0;
  autosave.subscribe(() => { notified += 1; });
  autosave.setField('flow', 'heavy');
  notified = 0;
  autosave.dispose();
  calls[0].resolve();
  await settle();
  assert.equal(notified, 0);
  assert.deepEqual(autosave.getDraft(), emptyAnswers);
  autosave.setField('mood', 'sad');
  assert.equal(calls.length, 1, 'a disposed controller never saves');
});
