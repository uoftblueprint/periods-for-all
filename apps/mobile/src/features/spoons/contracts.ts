import type { LocalDate } from '@/features/health/contracts';

export type SpoonTaskKind = 'spend' | 'recharge';
export type SpoonPriority = 'low' | 'medium' | 'high';

export type SpoonTaskDraft = {
  date?: LocalDate;
  name: string;
  kind: SpoonTaskKind;
  amount: number;
  time?: string;
  priority?: SpoonPriority;
  notes?: string;
  subtasks?: readonly { id: string; name: string; done: boolean }[];
};

export type SpoonEffect = {
  taskId: string;
  kind: 'complete' | 'undo';
  requestedAmount: number;
  appliedChange: number;
  at: string;
};

export type SpoonTask = Omit<SpoonTaskDraft, 'date'> & {
  id: string;
  date: LocalDate;
  completion: SpoonEffect | null;
};

export type SpoonDay = {
  date: LocalDate;
  startingEnergy: number | null;
  balance: number | null;
  revision: number;
  tasks: readonly SpoonTask[];
  effects: readonly SpoonEffect[];
};

export type SpoonMutation = {
  date: LocalDate;
  operationId: string;
  expectedRevision: number;
};

export type SpoonTaskMutation = SpoonMutation & { taskId: string };
export type SpoonUpdate = SpoonTaskMutation & {
  draft: SpoonTaskDraft;
  expectedDestinationRevision?: number;
};
export type SpoonMove = SpoonTaskMutation & {
  destinationDate: LocalDate;
  expectedDestinationRevision: number;
};

export class SpoonStoreError extends Error {
  readonly code: 'validation' | 'conflict' | 'missing-task' | 'unanswered-energy' | 'unavailable';

  constructor(code: SpoonStoreError['code'], message: string) {
    super(message);
    this.code = code;
    this.name = 'SpoonStoreError';
  }
}

/** One instance per account. Mutations return the affected days, source first. */
export interface SpoonStore {
  getDay(date: LocalDate): Promise<SpoonDay>;
  setStartingEnergy(input: SpoonMutation & { amount: number }): Promise<SpoonDay[]>;
  createTask(input: SpoonMutation & { draft: SpoonTaskDraft }): Promise<SpoonDay[]>;
  updateTask(input: SpoonUpdate): Promise<SpoonDay[]>;
  deleteTask(input: SpoonTaskMutation): Promise<SpoonDay[]>;
  completeTask(input: SpoonTaskMutation): Promise<SpoonDay[]>;
  undoCompletion(input: SpoonTaskMutation): Promise<SpoonDay[]>;
  listUnfinishedPreviousTasks(today: LocalDate): Promise<SpoonTask[]>;
  moveTaskToToday(input: SpoonMove): Promise<SpoonDay[]>;
}
