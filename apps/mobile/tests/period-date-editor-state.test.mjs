import assert from 'node:assert/strict';
import test from 'node:test';

import {
  beginDateSelectionGesture,
  getMonthRange,
  getPeriodDateChange,
  isDraftDateSelected,
  isSelectablePeriodDate,
  setDraftDateSelected,
  toggleDraftDate,
  visitDateSelectionGesture,
} from '../src/features/calendar/period-date-editor-state.ts';

test('month ranges include every day and handle leap years', () => {
  assert.deepEqual(getMonthRange('2028-02'), {
    from: '2028-02-01',
    to: '2028-02-29',
  });
  assert.equal(getMonthRange('2028-13'), null);
});

test('only real dates through today are selectable', () => {
  const today = '2026-11-07';

  assert.equal(isSelectablePeriodDate('2026-11-06', today), true);
  assert.equal(isSelectablePeriodDate(today, today), true);
  assert.equal(isSelectablePeriodDate('2026-11-08', today), false);
  assert.equal(isSelectablePeriodDate('2026-02-30', today), false);
  assert.equal(isSelectablePeriodDate(today, 'not-a-date'), false);
});

test('draft overrides stay separate from saved dates and collapse when restored', () => {
  const saved = new Set(['2026-11-01']);
  const original = new Map();

  const removed = toggleDraftDate(saved, original, '2026-11-01');
  assert.equal(isDraftDateSelected(saved, removed, '2026-11-01'), false);
  assert.equal(saved.has('2026-11-01'), true);
  assert.equal(original.size, 0);

  const restored = toggleDraftDate(saved, removed, '2026-11-01');
  assert.equal(isDraftDateSelected(saved, restored, '2026-11-01'), true);
  assert.equal(restored.size, 0);
});

test('the ticket example produces only the added and removed dates', () => {
  const saved = new Set([
    '2026-11-01',
    '2026-11-02',
    '2026-11-03',
  ]);
  let draft = new Map();

  draft = setDraftDateSelected(saved, draft, '2026-11-02', false);
  draft = setDraftDateSelected(saved, draft, '2026-11-04', true);

  assert.deepEqual(getPeriodDateChange(saved, draft), {
    add: ['2026-11-04'],
    remove: ['2026-11-02'],
  });
});

test('the first gesture date chooses add or remove for the whole gesture', () => {
  const add = beginDateSelectionGesture('2026-11-01', false);
  const remove = beginDateSelectionGesture('2026-11-02', true);

  assert.equal(add.selecting, true);
  assert.equal(remove.selecting, false);
});

test('a date crossed twice during one gesture is only applied once', () => {
  const started = beginDateSelectionGesture('2026-11-01', false);
  const second = visitDateSelectionGesture(started, '2026-11-02');
  const repeated = visitDateSelectionGesture(second.gesture, '2026-11-01');

  assert.equal(second.shouldApply, true);
  assert.deepEqual([...second.gesture.visited], [
    '2026-11-01',
    '2026-11-02',
  ]);
  assert.equal(repeated.shouldApply, false);
  assert.equal(repeated.gesture, second.gesture);
});
