import type { SupabaseClient } from '@supabase/supabase-js';

import { parseDate } from '@/features/calendar/calendar-dates';
import type { LocalDate } from '@/features/health/contracts';
import { localDateOf } from '@/features/health/local-date';
import { SpoonStoreError, type SpoonDay, type SpoonStore, type SpoonTask } from '@/features/spoons/contracts';

/*
 * SpoonStore, backed by the functions in
 * supabase/migrations/20261122120100_spoon_store_functions.sql.
 *
 * All rules (0–5 balance, revisions, operation-ID retries, validation) run in
 * the database, in one transaction per call. This store only sends requests and
 * turns database errors into SpoonStoreError codes. It keeps no cached data, so
 * a new account's store never shows the previous account's records.
 */

// SQLSTATEs raised by the database functions.
const ERROR_CODES: Record<string, SpoonStoreError['code']> = {
  SP400: 'validation',
  SP404: 'missing-task',
  SP409: 'conflict',
  SP428: 'unanswered-energy',
};

// Anything else (network, signed out, server error) may echo request details,
// so callers only get these messages. 'unavailable' means retry the same request.
const LOAD_ERROR = 'Could not load your spoons. Please try again.';
const SAVE_ERROR = 'Could not save your spoons. Please try again.';

type RpcError = { code?: string; message?: string };

function toStoreError(error: RpcError | null | undefined, fallback: string): SpoonStoreError {
  const code = error?.code ? ERROR_CODES[error.code] : undefined;
  if (code && error?.message) return new SpoonStoreError(code, error.message);
  return new SpoonStoreError('unavailable', fallback);
}

function checkDate(date: LocalDate): void {
  if (typeof date !== 'string' || !parseDate(date)) {
    throw new SpoonStoreError('validation', 'Choose a valid calendar day.');
  }
}

const isDay = (value: unknown): value is SpoonDay =>
  !!value && typeof value === 'object' && typeof (value as SpoonDay).date === 'string'
  && Array.isArray((value as SpoonDay).tasks) && Array.isArray((value as SpoonDay).effects);

const isTask = (value: unknown): value is SpoonTask =>
  !!value && typeof value === 'object'
  && typeof (value as SpoonTask).id === 'string' && typeof (value as SpoonTask).date === 'string';

type Options = {
  /** The current time, used for the device's local "today". */
  now?: () => Date;
};

/** SpoonStore for one signed-in account. The database enforces the same user ID. */
export function createSupabaseSpoonStore(
  client: SupabaseClient,
  userId: string,
  { now = () => new Date() }: Options = {},
): SpoonStore {
  async function call(name: string, args: Record<string, unknown>, fallback: string): Promise<unknown> {
    let result: { data: unknown; error: RpcError | null };
    try {
      result = await client.rpc(name, { ...args, p_expected_user_id: userId });
    } catch {
      throw new SpoonStoreError('unavailable', fallback);
    }
    if (result.error) throw toStoreError(result.error, fallback);
    return result.data;
  }

  async function read<T>(name: string, args: Record<string, unknown>, isValid: (data: unknown) => data is T) {
    const data = await call(name, args, LOAD_ERROR);
    if (!isValid(data)) throw new SpoonStoreError('unavailable', LOAD_ERROR);
    return data;
  }

  async function write(name: string, input: object, extra: Record<string, unknown> = {}): Promise<SpoonDay[]> {
    const data = await call(name, { p_input: input, ...extra }, SAVE_ERROR);
    // The change may have saved even though the reply is unusable; retrying the
    // same operation ID is safe and returns the saved days.
    if (!Array.isArray(data) || data.length === 0 || !data.every(isDay)) {
      throw new SpoonStoreError('unavailable', SAVE_ERROR);
    }
    return data;
  }

  // The device's local date, read at save time.
  const today = () => localDateOf(now());

  return {
    async getDay(date) {
      checkDate(date);
      return read('get_spoon_day', { p_date: date }, isDay);
    },
    setStartingEnergy: (input) => write('set_spoon_starting_energy', input),
    createTask: (input) => write('create_spoon_task', input, { p_today: today() }),
    updateTask: (input) => write('update_spoon_task', input),
    deleteTask: (input) => write('delete_spoon_task', input),
    completeTask: (input) => write('complete_spoon_task', input),
    undoCompletion: (input) => write('undo_spoon_completion', input),
    async listUnfinishedPreviousTasks(date) {
      checkDate(date);
      return read('list_unfinished_previous_spoon_tasks', { p_today: date },
        (data): data is SpoonTask[] => Array.isArray(data) && data.every(isTask));
    },
    moveTaskToToday: (input) => write('move_spoon_task_to_today', input, { p_today: today() }),
  };
}
