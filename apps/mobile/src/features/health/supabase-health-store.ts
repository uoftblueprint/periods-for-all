import type { SupabaseClient } from '@supabase/supabase-js';

// Shapes from S3-01 (#69). Replace with imports from './contracts' once that PR merges.
export type LocalDate = string;
export type Mood = 'verySad' | 'sad' | 'neutral' | 'happy' | 'veryHappy';
export type Flow = 'none' | 'veryLight' | 'light' | 'normal' | 'heavy' | 'veryHeavy';
export type DailyLog = {
  date: LocalDate;
  mood: Mood | null;
  flow: Flow | null;
  physicalSymptoms: string[] | null;
  emotionalSymptoms: string[] | null;
  reflection: string | null;
};
export type DailyLogPatch = Partial<Omit<DailyLog, 'date'>>;
export type PeriodSetup = {
  lastPeriodStart: LocalDate | null;
  cycleLength: number | null;
  periodLength: number | null;
  step: 'intro' | 'lastPeriod' | 'cycle' | 'length' | 'complete';
};
export interface HealthStore {
  getPeriodDays(from: LocalDate, to: LocalDate): Promise<LocalDate[]>;
  updatePeriodDays(change: { add: LocalDate[]; remove: LocalDate[] }): Promise<void>;
  getDailyLog(date: LocalDate): Promise<DailyLog>;
  patchDailyLog(date: LocalDate, patch: DailyLogPatch): Promise<DailyLog>;
  getPeriodSetup(): Promise<PeriodSetup>;
  savePeriodSetup(value: PeriodSetup): Promise<void>;
}

type DailyLogRow = {
  date: LocalDate;
  mood: Mood | null;
  flow: Flow | null;
  physical_symptoms: string[] | null;
  emotional_symptoms: string[] | null;
  reflection: string | null;
};

type PeriodSetupRow = {
  last_period_start: LocalDate | null;
  cycle_length: number | null;
  period_length: number | null;
  step: PeriodSetup['step'];
};

const DAILY_LOG_SELECT = 'date, mood, flow, physical_symptoms, emotional_symptoms, reflection';

const DAILY_LOG_COLUMNS = {
  mood: 'mood',
  flow: 'flow',
  physicalSymptoms: 'physical_symptoms',
  emotionalSymptoms: 'emotional_symptoms',
  reflection: 'reflection',
} as const;

/** Maps only the fields present in the patch to their database columns. */
function toColumns(patch: DailyLogPatch): Record<string, unknown> {
  const columns: Record<string, unknown> = {};
  for (const [field, column] of Object.entries(DAILY_LOG_COLUMNS)) {
    const value = patch[field as keyof DailyLogPatch];
    if (value === undefined) continue;
    // An empty reflection clears it.
    columns[column] = field === 'reflection' && value === '' ? null : value;
  }
  return columns;
}

function toDailyLog(row: DailyLogRow): DailyLog {
  return {
    date: row.date,
    mood: row.mood,
    flow: row.flow,
    physicalSymptoms: row.physical_symptoms,
    emotionalSymptoms: row.emotional_symptoms,
    reflection: row.reflection,
  };
}

// Server errors can echo the submitted answers, so callers only get these messages.
const LOAD_ERROR = 'Could not load your health records. Please try again.';
const SAVE_DATES_ERROR = 'Could not save your period dates. Please try again.';
const SAVE_LOG_ERROR = 'Could not save your daily log. Please try again.';
const SAVE_SETUP_ERROR = 'Could not save your period setup. Please try again.';

/** A HealthStore for one signed-in user. RLS enforces the same user ID in the database. */
export function createSupabaseHealthStore(client: SupabaseClient, userId: string): HealthStore {
  async function getDailyLog(date: LocalDate): Promise<DailyLog> {
    const { data, error } = await client
      .from('daily_logs')
      .select(DAILY_LOG_SELECT)
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle();
    if (error) throw new Error(LOAD_ERROR);
    if (!data) {
      return {
        date,
        mood: null,
        flow: null,
        physicalSymptoms: null,
        emotionalSymptoms: null,
        reflection: null,
      };
    }
    return toDailyLog(data as DailyLogRow);
  }

  return {
    async getPeriodDays(from, to) {
      const { data, error } = await client
        .from('period_days')
        .select('date')
        .eq('user_id', userId)
        .gte('date', from)
        .lte('date', to)
        .order('date');
      if (error || !data) throw new Error(LOAD_ERROR);
      return (data as { date: LocalDate }[]).map((row) => row.date);
    },

    async updatePeriodDays({ add, remove }) {
      // One database call, so the whole change saves or none of it does.
      const { error } = await client.rpc('update_period_days', {
        p_add: add,
        p_remove: remove,
        p_expected_user_id: userId,
      });
      if (error) throw new Error(SAVE_DATES_ERROR);
    },

    getDailyLog,

    /**
     * Saves only the supplied fields in a single upsert. An existing row keeps
     * every column the patch leaves out; a new row starts those columns as null.
     */
    async patchDailyLog(date, patch) {
      const columns = toColumns(patch);
      // Nothing to change: don't create an empty row.
      if (Object.keys(columns).length === 0) return getDailyLog(date);

      const { data, error } = await client
        .from('daily_logs')
        .upsert({ user_id: userId, date, ...columns }, { onConflict: 'user_id,date' })
        .select(DAILY_LOG_SELECT)
        .single();
      if (error || !data) throw new Error(SAVE_LOG_ERROR);
      return toDailyLog(data as DailyLogRow);
    },

    async getPeriodSetup() {
      const { data, error } = await client
        .from('period_setup')
        .select('last_period_start, cycle_length, period_length, step')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw new Error(LOAD_ERROR);
      if (!data) return { lastPeriodStart: null, cycleLength: null, periodLength: null, step: 'intro' };
      const row = data as PeriodSetupRow;
      return {
        lastPeriodStart: row.last_period_start,
        cycleLength: row.cycle_length,
        periodLength: row.period_length,
        step: row.step,
      };
    },

    async savePeriodSetup(value) {
      // Setup answers only: this never writes period days or predictions.
      const { error } = await client.from('period_setup').upsert(
        {
          user_id: userId,
          last_period_start: value.lastPeriodStart,
          cycle_length: value.cycleLength,
          period_length: value.periodLength,
          step: value.step,
        },
        { onConflict: 'user_id' },
      );
      if (error) throw new Error(SAVE_SETUP_ERROR);
    },
  };
}
