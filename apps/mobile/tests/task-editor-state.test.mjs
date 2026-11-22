import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createTaskDraftState,
  reduceTaskDraft,
  validateTaskDraft,
} from '../src/features/spoons/task-editor-state.ts';

test('task editor state initializes create and edit drafts without sharing mutable data', () => {
  assert.deepEqual(createTaskDraftState({ type: 'create', kind: 'recharge' }), {
    name: '', kind: 'recharge', amount: 0,
    dateEnabled: false, date: '', timeEnabled: false, time: '',
    priority: undefined, notes: '', subtasks: [],
  });

  const task = {
    id: 'task-1', date: '2026-11-22', name: '  Keep raw title  ', kind: 'spend', amount: 3,
    time: '08:05', priority: 'high', notes: '  Keep note spacing  ',
    subtasks: [{ id: 'sub-1', name: '  Pack water  ', done: true }], completion: null,
  };
  const state = createTaskDraftState({ type: 'edit', task });
  assert.deepEqual(state, {
    name: '  Keep raw title  ', kind: 'spend', amount: 3,
    dateEnabled: false, date: '', timeEnabled: true, time: '08:05',
    priority: 'high', notes: '  Keep note spacing  ',
    subtasks: [{ id: 'sub-1', name: '  Pack water  ', done: true }],
  });
  state.subtasks[0].name = 'Changed locally';
  assert.equal(task.subtasks[0].name, '  Pack water  ');

  const handedOff = { ...state, subtasks: state.subtasks.map((item) => ({ ...item })) };
  const resumed = createTaskDraftState({ type: 'edit', task }, handedOff);
  assert.deepEqual(resumed, handedOff);
  resumed.subtasks[0].name = 'Changed again';
  assert.equal(handedOff.subtasks[0].name, 'Changed locally');
});

test('task editor reducer updates every field immutably and retains stable subtask IDs', () => {
  const original = createTaskDraftState({ type: 'create', kind: 'spend' });
  const actions = [
    { type: 'setName', name: 'Walk' },
    { type: 'setKind', kind: 'recharge' },
    { type: 'setAmount', amount: 4 },
    { type: 'setDateEnabled', enabled: true },
    { type: 'setDate', date: '2026-11-23' },
    { type: 'setTimeEnabled', enabled: true },
    { type: 'setTime', time: '09:30' },
    { type: 'setPriority', priority: 'medium' },
    { type: 'setNotes', notes: 'Bring water' },
    { type: 'addSubtask', id: 'stable-id' },
    { type: 'renameSubtask', id: 'stable-id', name: 'Shoes' },
    { type: 'setSubtaskDone', id: 'stable-id', done: true },
  ];
  const changed = actions.reduce(reduceTaskDraft, original);
  assert.deepEqual(original, createTaskDraftState({ type: 'create', kind: 'spend' }));
  assert.deepEqual(changed, {
    name: 'Walk', kind: 'recharge', amount: 4,
    dateEnabled: true, date: '2026-11-23', timeEnabled: true, time: '09:30',
    priority: 'medium', notes: 'Bring water',
    subtasks: [{ id: 'stable-id', name: 'Shoes', done: true }],
  });
  assert.deepEqual(
    reduceTaskDraft(changed, { type: 'removeSubtask', id: 'stable-id' }).subtasks,
    [],
  );
  assert.equal(reduceTaskDraft(changed, { type: 'setDateEnabled', enabled: false }).date, '');
  assert.equal(reduceTaskDraft(changed, { type: 'setTimeEnabled', enabled: false }).time, '');
});

test('task editor validation accepts every whole spoon amount from zero through five', () => {
  for (let amount = 0; amount <= 5; amount += 1) {
    const state = { ...createTaskDraftState({ type: 'create', kind: 'spend' }), name: 'Valid', amount };
    assert.deepEqual(validateTaskDraft(state), {
      draft: { name: 'Valid', kind: 'spend', amount }, errors: {},
    });
  }
});

test('task editor validation reports invalid raw fields without changing the state', () => {
  const base = createTaskDraftState({ type: 'create', kind: 'spend' });
  for (const amount of [-1, 6, 1.5, Number.NaN]) {
    const state = { ...base, name: 'Valid', amount };
    assert.equal(validateTaskDraft(state).errors.amount, 'Choose a whole number between 0 and 5.');
    assert.equal(state.amount, amount);
  }
  for (const date of ['2026-02-30', '2026-2-03', 'not-a-date']) {
    const result = validateTaskDraft({ ...base, name: 'Valid', dateEnabled: true, date });
    assert.equal(result.errors.date, 'Choose a valid calendar day.');
  }
  for (const time of ['24:00', '9:30', '12:60']) {
    const result = validateTaskDraft({ ...base, name: 'Valid', timeEnabled: true, time });
    assert.equal(result.errors.time, 'Choose a valid local time.');
  }
  const invalid = {
    ...base, name: '   ', subtasks: [
      { id: 'same', name: ' ', done: false },
      { id: 'same', name: 'Second', done: false },
    ],
  };
  assert.deepEqual(validateTaskDraft(invalid), {
    errors: {
      name: 'Enter a task name.',
      subtasks: {
        same: 'Give every subtask a unique ID and a name.',
      },
    },
  });
});

test('task editor validation normalizes only submission fields and omits disabled or empty options', () => {
  const state = {
    ...createTaskDraftState({ type: 'create', kind: 'recharge' }),
    name: '  Rest  ', amount: 2,
    dateEnabled: true, date: '2026-11-23',
    timeEnabled: true, time: '07:05', priority: 'low',
    notes: '  quiet room  ',
    subtasks: [{ id: 'sub-1', name: '  Put phone away  ', done: false }],
  };
  assert.deepEqual(validateTaskDraft(state), {
    draft: {
      name: 'Rest', kind: 'recharge', amount: 2, date: '2026-11-23', time: '07:05',
      priority: 'low', notes: '  quiet room  ',
      subtasks: [{ id: 'sub-1', name: '  Put phone away  ', done: false }],
    },
    errors: {},
  });
  assert.deepEqual(validateTaskDraft({
    ...state, dateEnabled: false, timeEnabled: false, priority: undefined, notes: '   ', subtasks: [],
  }).draft, { name: 'Rest', kind: 'recharge', amount: 2 });
});
