import type { SpoonDay, SpoonStore, SpoonTask, SpoonTaskMutation } from '@/features/spoons/contracts';

export function groupSpendTasks({ tasks, balance }: SpoonDay) {
  const planned: SpoonTask[] = [];
  const overBudget: SpoonTask[] = [];
  const completed: SpoonTask[] = [];
  let total = 0;
  for (const task of tasks) {
    if (task.kind !== 'spend') continue;
    if (task.completion) {
      completed.push(task);
    } else {
      total += task.amount;
      (balance !== null && total > balance ? overBudget : planned).push(task);
    }
  }
  return { planned, overBudget, completed };
}

export function spoonCount(amount: number) {
  return `${amount} ${amount === 1 ? 'spoon' : 'spoons'}`;
}

type Action = { task: SpoonTask; input: SpoonTaskMutation };
type State = {
  day: SpoonDay | null;
  warning: Action | null;
  busy: boolean;
  error: string | null;
  canRetry: boolean;
  announcement: string;
};

/** Bind one controller to a store and date. Unsubscribe when that scope changes. */
export function createSpendTaskActions(
  store: Pick<SpoonStore, 'getDay' | 'completeTask' | 'undoCompletion'>,
  date: string,
  nextId: () => string,
) {
  let state: State = { day: null, warning: null, busy: false, error: null, canRetry: false, announcement: '' };
  let retry: (() => Promise<void>) | undefined;
  const listeners = new Set<() => void>();

  function update(changes: Partial<State>) {
    state = { ...state, ...changes };
    for (const listener of listeners) listener();
  }

  async function load(message: string | null = null) {
    try {
      update({ day: await store.getDay(date), error: message });
    } catch {
      retry = () => load(message);
      update({ error: 'Could not load today’s spoons. Try again.' });
    }
  }

  async function save(action: Action) {
    const { task, input } = action;
    const undoing = task.completion !== null;
    try {
      const [day] = await (undoing ? store.undoCompletion(input) : store.completeTask(input));
      const updated = day.tasks.find((item) => item.id === input.taskId);
      const outcome = updated && Boolean(updated.completion) !== undoing
        ? `${updated.name} ${undoing ? 'undone' : 'completed'}.`
        : 'Today’s tasks changed.';
      const balance = day.balance === null ? 'Today’s spoons are not set.' : `${spoonCount(day.balance)} left.`;
      update({ day, announcement: `${outcome} ${balance}` });
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === 'conflict' || code === 'missing-task') {
        await load('Today’s tasks changed. Review them and try again.');
      } else {
        if (!code || code === 'unavailable') retry = () => save(action);
        update({ error: undoing ? 'Could not undo this task. Try again.' : 'Could not complete this task. Try again.' });
      }
    }
  }

  async function run(job: () => Promise<void>) {
    if (state.busy) return;
    retry = undefined;
    update({ busy: true, warning: null, error: null, canRetry: false, announcement: '' });
    try {
      await job();
    } finally {
      update({ busy: false, canRetry: retry !== undefined });
    }
  }

  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    load: () => run(() => load()),
    retry: () => retry && run(retry),
    cancel: () => update({ warning: null }),
    confirm() {
      const action = state.warning;
      if (action) return run(() => save(action));
    },
    toggle(taskId: string) {
      const { day } = state;
      if (!day || state.busy || state.warning || retry) return;
      const task = day.tasks.find((item) => item.id === taskId && item.kind === 'spend');
      if (!task) return;
      if (day.balance === null) {
        update({ error: 'Set today’s spoons before completing a task.' });
        return;
      }
      const action = { task, input: { date, taskId, expectedRevision: day.revision, operationId: nextId() } };
      if (!task.completion && task.amount > day.balance) {
        update({ warning: action, error: null });
        return;
      }
      return run(() => save(action));
    },
  };
}
