import { formatDate, parseDate } from '@/features/calendar/calendar-dates';

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
): HealthStore {
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
    dailyLogs.set(log.date, cloneDailyLog(log));
  }

  let periodSetup = seededPeriodSetup
    ? clonePeriodSetup(seededPeriodSetup)
    : null;
  if (periodSetup?.lastPeriodStart) {
    assertRecordedDate(periodSetup.lastPeriodStart, today, 'last period start');
  }

  function failRead(): void {
    if (options.readError) throw options.readError;
  }

  function failWrite(): void {
    if (options.writeError) throw options.writeError;
  }

  return {
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
      if (value.lastPeriodStart) {
        assertRecordedDate(value.lastPeriodStart, today, 'last period start');
      }
      periodSetup = clonePeriodSetup(value);
    },
  };
}

function applyDailyLogPatch(log: DailyLog, patch: DailyLogPatch): void {
  if (Object.prototype.hasOwnProperty.call(patch, 'mood')) {
    log.mood = patch.mood ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'flow')) {
    log.flow = patch.flow ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'physicalSymptoms')) {
    log.physicalSymptoms = patch.physicalSymptoms
      ? [...patch.physicalSymptoms]
      : null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'emotionalSymptoms')) {
    log.emotionalSymptoms = patch.emotionalSymptoms
      ? [...patch.emotionalSymptoms]
      : null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'reflection')) {
    const reflection = patch.reflection;
    log.reflection = reflection == null || reflection.trim() === ''
      ? null
      : reflection;
  }
}
