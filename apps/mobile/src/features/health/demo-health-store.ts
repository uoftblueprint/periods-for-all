import { formatDate, parseDate } from '@/features/calendar/calendar-dates';
import {
  MOOD_OPTIONS, FLOW_OPTIONS, PHYSICAL_SYMPTOM_OPTIONS, EMOTIONAL_SYMPTOM_OPTIONS,
} from '@/features/health/catalog';

import type {
  DailyLog,
  DailyLogPatch,
  HealthStore,
  LocalDate,
  PeriodSetup,
} from './contracts';

export const DEMO_EMPTY_DATE: LocalDate = '2025-10-12';
export const DEMO_FILLED_DATE: LocalDate = '2025-10-13';

const EMPTY_PERIOD_SETUP: PeriodSetup = {
  lastPeriodStart: null,
  cycleLength: null,
  periodLength: null,
  step: 'intro',
};

const SAMPLE_PERIOD_DAYS: LocalDate[] = [
  '2025-10-12',
  '2025-10-13',
  '2025-10-14',
];

const SAMPLE_DAILY_LOGS: DailyLog[] = [
  {
    date: DEMO_EMPTY_DATE,
    mood: null,
    flow: null,
    physicalSymptoms: null,
    emotionalSymptoms: null,
    reflection: null,
  },
  {
    date: DEMO_FILLED_DATE,
    mood: 'happy',
    flow: 'normal',
    physicalSymptoms: ['menstrualCramps', 'backPain'],
    emotionalSymptoms: ['fatigue'],
    reflection: 'Took a walk and rested.',
  },
];

const SAMPLE_PERIOD_SETUP: PeriodSetup = {
  lastPeriodStart: '2025-10-12',
  cycleLength: 28,
  periodLength: 5,
  step: 'complete',
};

export type DemoHealthStoreOptions = {
  /** Overrides the local current day so previews and tests stay deterministic. */
  today?: LocalDate;
  initialPeriodDays?: readonly LocalDate[];
  initialDailyLogs?: readonly DailyLog[];
  /** `null` represents a store with no saved setup row. */
  initialPeriodSetup?: PeriodSetup | null;
  /** Every read rejects with this exact error when supplied. */
  readError?: Error;
  /** Every write rejects with this exact error when supplied. */
  writeError?: Error;
};

export interface DemoHealthStore extends HealthStore {
  /** Replaces any pending one-shot read error; consumed by the next read. */
  failNextRead(error: Error): void;
  /** Replaces any pending one-shot write error; consumed before any mutation. */
  failNextWrite(error: Error): void;
}

function localToday(): LocalDate {
  const now = new Date();
  return formatDate(
    { year: now.getFullYear(), month: now.getMonth() + 1 },
    now.getDate(),
  );
}

function assertValidDate(date: LocalDate, name: string): void {
  if (!parseDate(date)) {
    throw new Error(`${name} must be a valid local date in YYYY-MM-DD format.`);
  }
}

function assertRecordedDate(date: LocalDate, today: LocalDate, name: string): void {
  assertValidDate(date, name);
  if (date > today) {
    throw new Error(`${name} cannot be in the future.`);
  }
}

function emptyDailyLog(date: LocalDate): DailyLog {
  return {
    date,
    mood: null,
    flow: null,
    physicalSymptoms: null,
    emotionalSymptoms: null,
    reflection: null,
  };
}

const MOODS = new Set<string>(MOOD_OPTIONS.map(({ id }) => id));
const FLOWS = new Set<string>(FLOW_OPTIONS.map(({ id }) => id));
const PHYSICAL_SYMPTOMS = new Set<string>(PHYSICAL_SYMPTOM_OPTIONS.map(({ id }) => id));
const EMOTIONAL_SYMPTOMS = new Set<string>(EMOTIONAL_SYMPTOM_OPTIONS.map(({ id }) => id));
const SETUP_STEPS = new Set<PeriodSetup['step']>([
  'intro', 'lastPeriod', 'cycle', 'length', 'complete',
]);

function assertDailyLogValues(log: DailyLog): void {
  if (log.mood !== null && !MOODS.has(log.mood)) throw new Error('Invalid mood.');
  if (log.flow !== null && !FLOWS.has(log.flow)) throw new Error('Invalid flow.');
  for (const [name, values, allowed] of [
    ['physical symptoms', log.physicalSymptoms, PHYSICAL_SYMPTOMS],
    ['emotional symptoms', log.emotionalSymptoms, EMOTIONAL_SYMPTOMS],
  ] as const) {
    if (values !== null && (!Array.isArray(values)
      || !Array.from(values).every((value) => allowed.has(value)))) {
      throw new Error(`Invalid ${name}.`);
    }
  }
  if (log.reflection !== null && typeof log.reflection !== 'string') {
    throw new Error('Invalid reflection.');
  }
}

function assertPeriodSetup(value: PeriodSetup, today: LocalDate): void {
  if (value.lastPeriodStart !== null) {
    assertRecordedDate(value.lastPeriodStart, today, 'last period start');
  }
  for (const [name, length, min, max] of [
    ['cycle length', value.cycleLength, 21, 45],
    ['period length', value.periodLength, 1, 12],
  ] as const) {
    if (length !== null && (!Number.isInteger(length) || length < min || length > max)) {
      throw new Error(`${name} must be an integer between ${min} and ${max}.`);
    }
  }
  if (!SETUP_STEPS.has(value.step)) throw new Error('Invalid setup step.');
}

function cloneDailyLog(log: DailyLog): DailyLog {
  return {
    ...log,
    physicalSymptoms: log.physicalSymptoms ? [...log.physicalSymptoms] : null,
    emotionalSymptoms: log.emotionalSymptoms ? [...log.emotionalSymptoms] : null,
  };
}

function clonePeriodSetup(value: PeriodSetup): PeriodSetup {
  return { ...value };
}

/**
 * Creates an isolated in-memory store with made-up sample data.
 * Factory options can replace the samples or make reads/writes fail for previews.
 */
export function createDemoHealthStore(
  options: DemoHealthStoreOptions = {},
): DemoHealthStore {
  const today = options.today ?? localToday();
  assertValidDate(today, 'today');

  const seededPeriodDays = options.initialPeriodDays ?? SAMPLE_PERIOD_DAYS;
  const seededDailyLogs = options.initialDailyLogs ?? SAMPLE_DAILY_LOGS;
  const seededPeriodSetup = options.initialPeriodSetup === undefined
    ? SAMPLE_PERIOD_SETUP
    : options.initialPeriodSetup;

  const periodDays = new Set<LocalDate>();
  for (const date of seededPeriodDays) {
    assertRecordedDate(date, today, 'period day');
    periodDays.add(date);
  }

  const dailyLogs = new Map<LocalDate, DailyLog>();
  for (const log of seededDailyLogs) {
    assertRecordedDate(log.date, today, 'daily log date');
    assertDailyLogValues(log);
    dailyLogs.set(log.date, cloneDailyLog(log));
  }

  let periodSetup = seededPeriodSetup
    ? clonePeriodSetup(seededPeriodSetup)
    : null;
  if (periodSetup) assertPeriodSetup(periodSetup, today);

  let nextReadError: Error | undefined;
  let nextWriteError: Error | undefined;

  function failRead(): void {
    if (nextReadError) {
      const error = nextReadError;
      nextReadError = undefined;
      throw error;
    }
    if (options.readError) throw options.readError;
  }

  function failWrite(): void {
    if (nextWriteError) {
      const error = nextWriteError;
      nextWriteError = undefined;
      throw error;
    }
    if (options.writeError) throw options.writeError;
  }

  return {
    failNextRead(error) {
      nextReadError = error;
    },

    failNextWrite(error) {
      nextWriteError = error;
    },

    async getPeriodDays(from, to) {
      failRead();
      assertValidDate(from, 'from');
      assertValidDate(to, 'to');
      if (from > to) throw new Error('from must not be after to.');

      return [...periodDays]
        .filter((date) => date >= from && date <= to)
        .sort();
    },

    async updatePeriodDays(change) {
      failWrite();

      const added = new Set(change.add);
      if (change.remove.some((date) => added.has(date))) {
        throw new Error('Contradictory date changes');
      }

      for (const date of [...change.add, ...change.remove]) {
        assertRecordedDate(date, today, 'period day');
      }

      for (const date of change.remove) periodDays.delete(date);
      for (const date of change.add) periodDays.add(date);
    },

    async getDailyLog(date) {
      failRead();
      assertValidDate(date, 'daily log date');
      return cloneDailyLog(dailyLogs.get(date) ?? emptyDailyLog(date));
    },

    async patchDailyLog(date, patch) {
      failWrite();
      assertRecordedDate(date, today, 'daily log date');

      const next = cloneDailyLog(dailyLogs.get(date) ?? emptyDailyLog(date));
      const supplied = Object.fromEntries(
        Object.entries(patch).filter(([, value]) => value !== undefined),
      );
      assertDailyLogValues({ ...next, ...supplied });
      applyDailyLogPatch(next, patch);
      dailyLogs.set(date, cloneDailyLog(next));
      return cloneDailyLog(next);
    },

    async getPeriodSetup() {
      failRead();
      return clonePeriodSetup(periodSetup ?? EMPTY_PERIOD_SETUP);
    },

    async savePeriodSetup(value) {
      failWrite();
      assertPeriodSetup(value, today);
      periodSetup = clonePeriodSetup(value);
    },
  };
}

function applyDailyLogPatch(log: DailyLog, patch: DailyLogPatch): void {
  if (patch.mood !== undefined) {
    log.mood = patch.mood ?? null;
  }
  if (patch.flow !== undefined) {
    log.flow = patch.flow ?? null;
  }
  if (patch.physicalSymptoms !== undefined) {
    log.physicalSymptoms = patch.physicalSymptoms
      ? [...patch.physicalSymptoms]
      : null;
  }
  if (patch.emotionalSymptoms !== undefined) {
    log.emotionalSymptoms = patch.emotionalSymptoms
      ? [...patch.emotionalSymptoms]
      : null;
  }
  if (patch.reflection !== undefined) {
    const reflection = patch.reflection;
    log.reflection = reflection == null || reflection.trim() === ''
      ? null
      : reflection;
  }
}
