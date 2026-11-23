import { addDays, formatDate, parseDate } from '@/features/calendar/calendar-dates';
import { boundSpoonBalance, getAppliedChange, getCompletionChange, validateSpoonAmount } from '@/features/spoons/balance';
import {
  SpoonStoreError, type SpoonDay, type SpoonEffect,
  type SpoonStore, type SpoonTask, type SpoonTaskDraft, type SpoonTaskMutation,
} from '@/features/spoons/contracts';

type Options = {
  now?: () => Date;
  createId?: () => string;
  fixture?: 'unanswered' | 'zero' | 'planned' | 'activity' | 'previous';
  delay?: (kind: 'read' | 'write') => Promise<void>;
};

const emptyDay = (date: string): SpoonDay => ({
  date, startingEnergy: null, balance: null, revision: 0, tasks: [], effects: [],
});

// Snapshots and requests use JSON data. Sort request keys so retry equality ignores property order.
function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function serializeRequest(method: string, input: object): string {
  return JSON.stringify([method, input], (_, value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, value[key]]));
  });
}

function validateDate(date: string): void {
  if (typeof date !== 'string' || !parseDate(date)) {
    throw new SpoonStoreError('validation', 'Choose a valid calendar day.');
  }
}

function validateDraft(draft: SpoonTaskDraft): void {
  validateSpoonAmount(draft.amount);
  if (typeof draft.name !== 'string' || !draft.name.trim()) {
    throw new SpoonStoreError('validation', 'Enter a task name.');
  }
  if (draft.kind !== 'spend' && draft.kind !== 'recharge') {
    throw new SpoonStoreError('validation', 'Choose spend or recharge.');
  }
  if (draft.time !== undefined && (typeof draft.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time))) {
    throw new SpoonStoreError('validation', 'Choose a valid local time.');
  }
  if (draft.priority !== undefined && !['low', 'medium', 'high'].includes(draft.priority)) {
    throw new SpoonStoreError('validation', 'Choose a valid priority.');
  }
  if (draft.notes !== undefined && typeof draft.notes !== 'string') {
    throw new SpoonStoreError('validation', 'Enter notes as text.');
  }
  if (draft.subtasks !== undefined && !Array.isArray(draft.subtasks)) {
    throw new SpoonStoreError('validation', 'Enter subtasks as a list.');
  }
  const ids = new Set<string>();
  for (const subtask of draft.subtasks ?? []) {
    if (!subtask || typeof subtask.id !== 'string' || !subtask.id.trim() || ids.has(subtask.id)
      || typeof subtask.name !== 'string' || typeof subtask.done !== 'boolean') {
      throw new SpoonStoreError('validation', 'Give every subtask a unique ID and valid details.');
    }
    ids.add(subtask.id);
  }
}

const calendarDay = (time: Date) =>
  ({ year: time.getFullYear(), month: time.getMonth() + 1, day: time.getDate() });

function localDate(time: Date): string {
  const day = calendarDay(time);
  return formatDate(day, day.day);
}

function checkTargetDate(date: string, expectedDate: string): void {
  if (date === expectedDate) return;
  validateDate(date);
  throw new SpoonStoreError('conflict', 'The target day changed. Reload it and try again.');
}

export function createSampleSpoonStore({ now = () => new Date(), createId, fixture, delay }: Options = {}): {
  store: SpoonStore;
  failNextRead(): void;
  failNextWrite(): void;
} {
  const initialDay = fixture ? sampleDay(fixture, now()) : undefined;
  const days = new Map<string, SpoonDay>(initialDay ? [[initialDay.date, initialDay]] : []);
  const taskIds = new Set(initialDay?.tasks.map((task) => task.id));
  const operations = new Map<string, { signature: string; dates: string[] }>();
  let nextId = 0;
  let readFailure = false;
  let writeFailure = false;

  const current = (date: string) => days.get(date) ?? emptyDay(date);

  function checkRevision(date: string, expectedRevision: number | undefined): SpoonDay {
    validateDate(date);
    const day = current(date);
    if (day.revision !== expectedRevision) {
      throw new SpoonStoreError('conflict', 'This day changed. Reload it and try again.');
    }
    return day;
  }

  function findTask(day: SpoonDay, id: string): SpoonTask {
    const task = day.tasks.find((candidate) => candidate.id === id);
    if (!task) throw new SpoonStoreError('missing-task', 'This task no longer exists on the selected day.');
    return task;
  }

  async function read<T>(getValue: () => T): Promise<T> {
    await delay?.('read');
    if (readFailure) {
      readFailure = false;
      throw new SpoonStoreError('unavailable', 'Could not load the sample data. Try again.');
    }
    return copy(getValue());
  }

  async function write<T extends { operationId: string }>(
    method: string, input: T, apply: (request: T, time: Date) => readonly SpoonDay[],
  ): Promise<SpoonDay[]> {
    const signature = serializeRequest(method, input);
    const [, request] = JSON.parse(signature) as [string, T];
    const { operationId } = request;
    if (typeof operationId !== 'string' || !operationId.trim()) {
      throw new SpoonStoreError('validation', 'An operation ID is required.');
    }
    await delay?.('write');
    const previous = operations.get(operationId);
    if (previous) {
      if (previous.signature !== signature) {
        throw new SpoonStoreError('conflict', 'This operation ID has already been used for another request.');
      }
      return copy(previous.dates.map(current));
    }
    if (writeFailure) {
      writeFailure = false;
      throw new SpoonStoreError('unavailable', 'Could not save the sample data. Try again.');
    }

    // Evaluate and validate every affected day before committing any changes.
    const results = apply(request, now());
    for (const day of results) {
      // No-ops return the existing snapshot and preserve its revision.
      if (days.get(day.date) !== day) {
        days.set(day.date, { ...day, revision: day.revision + 1 });
      }
    }
    const dates = results.map((day) => day.date);
    operations.set(operationId, { signature, dates });
    return copy(dates.map(current));
  }

  function taskForEdit(day: SpoonDay, id: string): SpoonTask {
    const task = findTask(day, id);
    if (task.completion) {
      throw new SpoonStoreError('validation', 'Undo completion before editing or moving this task.');
    }
    return task;
  }

  function saveTask(source: SpoonDay, destination: SpoonDay, task: SpoonTask): SpoonDay[] {
    if (source.date === destination.date) {
      return [{ ...source, tasks: source.tasks.map((item) => item.id === task.id ? task : item) }];
    }
    return [
      { ...source, tasks: source.tasks.filter((item) => item.id !== task.id) },
      { ...destination, tasks: [...destination.tasks, task] },
    ];
  }

  function recordEffect(kind: SpoonEffect['kind'], input: SpoonTaskMutation) {
    return write(kind, input, (request, time) => {
      const day = checkRevision(request.date, request.expectedRevision);
      const task = findTask(day, request.taskId);
      if (kind === 'complete' ? task.completion : !task.completion) return [day];
      if (day.balance === null) {
        throw new SpoonStoreError('unanswered-energy', 'Set starting energy before completing a task.');
      }
      const appliedChange = task.completion
        ? getAppliedChange(day.balance, -task.completion.appliedChange)
        : getCompletionChange(day.balance, task.kind, task.amount);
      const effect = { taskId: task.id, kind, requestedAmount: task.amount, appliedChange, at: time.toISOString() };
      const updatedTask = { ...task, completion: kind === 'complete' ? effect : null };
      return [{
        ...day,
        balance: day.balance + appliedChange,
        effects: [...day.effects, effect],
        tasks: day.tasks.map((item) => item.id === task.id ? updatedTask : item),
      }];
    });
  }

  const store: SpoonStore = {
    getDay: (date) => read(() => {
      validateDate(date);
      return current(date);
    }),
    setStartingEnergy: (input) => write('setStartingEnergy', input, (request) => {
      const day = checkRevision(request.date, request.expectedRevision);
      validateSpoonAmount(request.amount);
      if (day.startingEnergy === request.amount) return [day];
      const netChange = day.effects.reduce((sum, effect) => sum + effect.appliedChange, 0);
      return [{ ...day, startingEnergy: request.amount, balance: boundSpoonBalance(request.amount + netChange) }];
    }),
    createTask: (input) => write('createTask', input, (request, time) => {
      const { draft } = request;
      const date = draft.date === undefined ? localDate(time) : draft.date;
      checkTargetDate(date, request.date);
      const day = checkRevision(date, request.expectedRevision);
      validateDraft(draft);
      const id = createId ? createId() : `task-${++nextId}`;
      if (typeof id !== 'string' || !id.trim() || taskIds.has(id)) {
        throw new SpoonStoreError('validation', 'The new task needs a unique ID.');
      }
      taskIds.add(id);
      const task = { ...draft, id, name: draft.name.trim(), date: day.date, completion: null };
      return [{ ...day, tasks: [...day.tasks, task] }];
    }),
    updateTask: (input) => write('updateTask', input, (request) => {
      const day = checkRevision(request.date, request.expectedRevision);
      const task = taskForEdit(day, request.taskId);
      const { draft } = request;
      validateDraft(draft);
      const date = draft.date === undefined ? day.date : draft.date;
      const target = date === day.date ? day : checkRevision(date, request.expectedDestinationRevision);
      return saveTask(day, target, { ...draft, id: task.id, name: draft.name.trim(), date, completion: null });
    }),
    deleteTask: (input) => write('deleteTask', input, (request) => {
      const day = checkRevision(request.date, request.expectedRevision);
      const task = taskForEdit(day, request.taskId);
      return [{ ...day, tasks: day.tasks.filter((item) => item.id !== task.id) }];
    }),
    completeTask: (input) => recordEffect('complete', input),
    undoCompletion: (input) => recordEffect('undo', input),
    listUnfinishedPreviousTasks: (today) => read(() => {
      validateDate(today);
      return [...days.values()]
        .filter((day) => day.date < today)
        .sort((a, b) => b.date.localeCompare(a.date))
        .flatMap((day) => day.tasks.filter((task) => task.completion === null));
    }),
    moveTaskToToday: (input) => write('moveTaskToToday', input, (request, time) => {
      const day = checkRevision(request.date, request.expectedRevision);
      const task = taskForEdit(day, request.taskId);
      const today = localDate(time);
      if (day.date >= today) {
        throw new SpoonStoreError('validation', 'Choose an unfinished task from an earlier day.');
      }
      checkTargetDate(today, request.destinationDate);
      const target = checkRevision(today, request.expectedDestinationRevision);
      return saveTask(day, target, { ...task, date: today });
    }),
  };

  return {
    store,
    failNextRead: () => { readFailure = true; },
    failNextWrite: () => { writeFailure = true; },
  };
}

function sampleDay(fixture: NonNullable<Options['fixture']>, time: Date): SpoonDay {
  const today = localDate(time);
  const day = { ...emptyDay(today), revision: 1 };
  if (fixture === 'unanswered') return emptyDay(today);
  if (fixture === 'zero') return { ...day, startingEnergy: 0, balance: 0 };
  const task = (id: string, name: string, kind: SpoonTask['kind'], amount: number, date = today): SpoonTask =>
    ({ id, date, name, kind, amount, completion: null });
  if (fixture === 'previous') {
    const previous = addDays(calendarDay(time), -1);
    const date = formatDate(previous, previous.day);
    return { ...day, date, tasks: [task('sample-previous', 'Water plants', 'spend', 1, date)] };
  }
  if (fixture === 'planned') {
    const tasks = [task('sample-walk', 'Take a walk', 'spend', 1), task('sample-laundry', 'Do laundry', 'spend', 5)];
    return { ...day, startingEnergy: 3, balance: 3, tasks };
  }
  let balance = 5;
  const tasks = [task('sample-cook', 'Cook dinner', 'spend', 1), task('sample-rest', 'Take a break', 'recharge', 3)]
    .map((item) => {
      const appliedChange = getCompletionChange(balance, item.kind, item.amount);
      balance += appliedChange;
      const completion = {
        taskId: item.id, kind: 'complete' as const, requestedAmount: item.amount, appliedChange, at: time.toISOString(),
      };
      return { ...item, completion };
    });
  return { ...day, startingEnergy: 5, balance, tasks, effects: tasks.map((item) => item.completion) };
}
