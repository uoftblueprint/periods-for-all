import { parseDate } from '@/features/calendar/calendar-dates';
import type { LocalDate } from '@/features/health/contracts';
import { validateSpoonAmount } from '@/features/spoons/balance';
import type {
  SpoonPriority,
  SpoonTask,
  SpoonTaskDraft,
  SpoonTaskKind,
} from '@/features/spoons/contracts';

export type TaskDraftSubtask = { id: string; name: string; done: boolean };

export type TaskDraftState = {
  name: string;
  kind: SpoonTaskKind;
  amount: number;
  dateEnabled: boolean;
  date: string;
  timeEnabled: boolean;
  time: string;
  priority?: SpoonPriority;
  notes: string;
  subtasks: TaskDraftSubtask[];
};

export type TaskDraftSource =
  | { type: 'create'; kind: SpoonTaskKind }
  | { type: 'edit'; task: SpoonTask };

export type TaskDraftAction =
  | { type: 'setName'; name: string }
  | { type: 'setKind'; kind: SpoonTaskKind }
  | { type: 'setAmount'; amount: number }
  | { type: 'setDateEnabled'; enabled: boolean }
  | { type: 'setDate'; date: string }
  | { type: 'setTimeEnabled'; enabled: boolean }
  | { type: 'setTime'; time: string }
  | { type: 'setPriority'; priority?: SpoonPriority }
  | { type: 'setNotes'; notes: string }
  | { type: 'addSubtask'; id: string }
  | { type: 'renameSubtask'; id: string; name: string }
  | { type: 'setSubtaskDone'; id: string; done: boolean }
  | { type: 'removeSubtask'; id: string };

export type TaskDraftErrors = {
  name?: string;
  amount?: string;
  date?: string;
  time?: string;
  subtasks?: Record<string, string>;
};

const copySubtasks = (subtasks: readonly TaskDraftSubtask[] = []): TaskDraftSubtask[] => (
  subtasks.map((subtask) => ({ ...subtask }))
);

export function createTaskDraftState(
  source: TaskDraftSource,
  initialState?: TaskDraftState,
): TaskDraftState {
  if (initialState) {
    return { ...initialState, subtasks: copySubtasks(initialState.subtasks) };
  }
  if (source.type === 'create') {
    return {
      name: '', kind: source.kind, amount: 0,
      dateEnabled: false, date: '', timeEnabled: false, time: '',
      priority: undefined, notes: '', subtasks: [],
    };
  }
  return {
    name: source.task.name,
    kind: source.task.kind,
    amount: source.task.amount,
    dateEnabled: false,
    date: '',
    timeEnabled: source.task.time !== undefined,
    time: source.task.time ?? '',
    priority: source.task.priority,
    notes: source.task.notes ?? '',
    subtasks: copySubtasks(source.task.subtasks),
  };
}

export function reduceTaskDraft(state: TaskDraftState, action: TaskDraftAction): TaskDraftState {
  switch (action.type) {
    case 'setName': return { ...state, name: action.name };
    case 'setKind': return { ...state, kind: action.kind };
    case 'setAmount': return { ...state, amount: action.amount };
    case 'setDateEnabled': return { ...state, dateEnabled: action.enabled, date: action.enabled ? state.date : '' };
    case 'setDate': return { ...state, date: action.date };
    case 'setTimeEnabled': return { ...state, timeEnabled: action.enabled, time: action.enabled ? state.time : '' };
    case 'setTime': return { ...state, time: action.time };
    case 'setPriority': return { ...state, priority: action.priority };
    case 'setNotes': return { ...state, notes: action.notes };
    case 'addSubtask': return {
      ...state,
      subtasks: [...state.subtasks, { id: action.id, name: '', done: false }],
    };
    case 'renameSubtask': return {
      ...state,
      subtasks: state.subtasks.map((item) => item.id === action.id ? { ...item, name: action.name } : item),
    };
    case 'setSubtaskDone': return {
      ...state,
      subtasks: state.subtasks.map((item) => item.id === action.id ? { ...item, done: action.done } : item),
    };
    case 'removeSubtask': return {
      ...state,
      subtasks: state.subtasks.filter((item) => item.id !== action.id),
    };
  }
}

export function validateTaskDraft(
  state: TaskDraftState,
): { draft?: SpoonTaskDraft; errors: TaskDraftErrors } {
  const errors: TaskDraftErrors = {};
  const name = state.name.trim();
  if (!name) errors.name = 'Enter a task name.';
  try {
    validateSpoonAmount(state.amount);
  } catch {
    errors.amount = 'Choose a whole number between 0 and 5.';
  }
  if (state.dateEnabled && !parseDate(state.date)) {
    errors.date = 'Choose a valid calendar day.';
  }
  if (state.timeEnabled && !/^([01]\d|2[0-3]):[0-5]\d$/.test(state.time)) {
    errors.time = 'Choose a valid local time.';
  }

  const ids = new Set<string>();
  for (const subtask of state.subtasks) {
    if (!subtask.id.trim() || !subtask.name.trim() || ids.has(subtask.id)) {
      (errors.subtasks ??= {})[subtask.id] = 'Give every subtask a unique ID and a name.';
    }
    ids.add(subtask.id);
  }
  if (Object.keys(errors).length > 0) return { errors };

  const draft: SpoonTaskDraft = { name, kind: state.kind, amount: state.amount };
  if (state.dateEnabled) draft.date = state.date as LocalDate;
  if (state.timeEnabled) draft.time = state.time;
  if (state.priority !== undefined) draft.priority = state.priority;
  if (state.notes.trim()) draft.notes = state.notes;
  if (state.subtasks.length > 0) draft.subtasks = copySubtasks(state.subtasks);
  return { draft, errors };
}
