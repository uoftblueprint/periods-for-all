/**
 * S3-10: remembers each account's optional period-setup answers and step.
 *
 * This sits between the HealthStore (S3-01 / S3-02) and the period-setup screen (S3-09).
 * It has no React and no UI, so the rules below are unit-tested directly. Period setup is
 * stored only through the HealthStore — never in the display-setup completion store.
 */
import { parseDate } from '@/features/calendar/calendar-dates';

// TODO(S3-01, #69 / PR #79): import these from '@/features/health/contracts' once it merges,
// and delete this local copy. The shapes match PR #79's contracts.ts exactly.
export type LocalDate = string; // YYYY-MM-DD
export type PeriodSetupStep = 'intro' | 'lastPeriod' | 'cycle' | 'length' | 'complete';
export type PeriodSetup = {
  lastPeriodStart: LocalDate | null;
  cycleLength: number | null;
  periodLength: number | null;
  step: PeriodSetupStep;
};
/** The two HealthStore methods this file needs; the real store is already bound to one user. */
export type PeriodSetupStore = {
  getPeriodSetup(): Promise<PeriodSetup>;
  savePeriodSetup(value: PeriodSetup): Promise<void>;
};

export const CYCLE_LENGTH_RANGE = { min: 21, max: 45 } as const;
export const PERIOD_LENGTH_RANGE = { min: 1, max: 12 } as const;

const STEPS: readonly PeriodSetupStep[] = ['intro', 'lastPeriod', 'cycle', 'length', 'complete'];

/** What a new account starts with: nothing answered, at the introduction. */
export const EMPTY_PERIOD_SETUP: Readonly<PeriodSetup> = Object.freeze({
  lastPeriodStart: null,
  cycleLength: null,
  periodLength: null,
  step: 'intro',
});

/** Thrown when a result arrives for an account that is no longer signed in. Callers should ignore it. */
export class StalePeriodSetupError extends Error {
  constructor() {
    super('This period-setup request belongs to a previous account.');
    this.name = 'StalePeriodSetupError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function wholeNumberInRange(value: unknown, range: { min: number; max: number }): number | null {
  return Number.isInteger(value) && (value as number) >= range.min && (value as number) <= range.max
    ? (value as number)
    : null;
}

/**
 * Makes any stored value safe to show. Unknown steps restart at the introduction; invalid,
 * out-of-range or future answers become null ("not answered") instead of a guessed value.
 */
export function normalizePeriodSetup(raw: unknown, today: LocalDate): PeriodSetup {
  if (!isRecord(raw)) return { ...EMPTY_PERIOD_SETUP };
  const lastStart = raw.lastPeriodStart;
  return {
    // Plain string comparison works because both dates are zero-padded YYYY-MM-DD.
    lastPeriodStart:
      typeof lastStart === 'string' && parseDate(lastStart) !== null && lastStart <= today ? lastStart : null,
    cycleLength: wholeNumberInRange(raw.cycleLength, CYCLE_LENGTH_RANGE),
    periodLength: wholeNumberInRange(raw.periodLength, PERIOD_LENGTH_RANGE),
    step: STEPS.includes(raw.step as PeriodSetupStep) ? (raw.step as PeriodSetupStep) : 'intro',
  };
}

export function isPeriodSetupComplete(setup: PeriodSetup): boolean {
  return setup.step === 'complete';
}

/** After display setup, a new account goes to period setup until it is finished or skipped. */
export function routeAfterDisplaySetup(setup: PeriodSetup): '/period-setup' | '/home' {
  return isPeriodSetupComplete(setup) ? '/home' : '/period-setup';
}

/**
 * Where the screen should open. Unfinished setup resumes at its saved step; finished setup
 * is being edited from home, so it starts at the beginning with the saved answers filled in.
 */
export function startingPoint(setup: PeriodSetup): PeriodSetup {
  return isPeriodSetupComplete(setup) ? { ...setup, step: 'intro' } : { ...setup };
}

export type PeriodSetupSession = {
  readonly userId: string;
  /** Reads this account's setup. Rejects on failure; a failed read is never treated as empty. */
  load(): Promise<PeriodSetup>;
  /** Saves the screen's latest answers and step. Rejects on failure without changing anything. */
  save(next: PeriodSetup): Promise<void>;
  /** Call on sign-out or account change: later results are ignored and no new writes start. */
  dispose(): void;
};

/**
 * One session per signed-in account. The route creates a new session when the user changes,
 * so one account's answers can never be shown to, or saved for, another.
 */
export function createPeriodSetupSession(options: {
  userId: string;
  store: PeriodSetupStore;
  today: LocalDate;
}): PeriodSetupSession {
  const { userId, store, today } = options;
  if (typeof userId !== 'string' || !userId.trim()) {
    throw new Error('User ID must not be empty.');
  }

  let disposed = false;
  let loaded = false;
  // Once setup is complete it stays complete, even while the user edits it from home.
  let completed = false;
  // Writes run one at a time in the order they were requested, so an older save can never
  // finish after a newer one and overwrite it.
  let writeQueue: Promise<void> = Promise.resolve();

  function throwIfStale(): void {
    if (disposed) throw new StalePeriodSetupError();
  }

  return {
    userId,

    async load() {
      throwIfStale();
      const raw = await store.getPeriodSetup();
      throwIfStale();
      const setup = normalizePeriodSetup(raw, today);
      loaded = true;
      completed = isPeriodSetupComplete(setup);
      return setup;
    },

    save(next) {
      // Saving before loading could turn a completed setup back into an unfinished one.
      if (!loaded) return Promise.reject(new Error('Load period setup before saving it.'));
      const write = writeQueue.then(async () => {
        throwIfStale();
        const stored: PeriodSetup = completed ? { ...next, step: 'complete' } : { ...next };
        await store.savePeriodSetup(stored);
        throwIfStale();
        if (isPeriodSetupComplete(stored)) completed = true;
      });
      // Keep the queue going after a failure; the caller still receives the rejection.
      writeQueue = write.catch(() => {});
      return write;
    },

    dispose() {
      disposed = true;
    },
  };
}
