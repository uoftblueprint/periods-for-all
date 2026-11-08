// TEMPORARY copy of the S3-01 contract
// Will import from S3-01's module once that PR is merged.

export type LocalDate = string; // YYYY-MM-DD
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
  getDailyLog(date: LocalDate): Promise<DailyLog>; // missing row → all answers null
  patchDailyLog(date: LocalDate, patch: DailyLogPatch): Promise<DailyLog>;
  getPeriodSetup(): Promise<PeriodSetup>;
  savePeriodSetup(value: PeriodSetup): Promise<void>;
}

// Placeholder until S3-01 and S3-04/05 controls merge.
export const MOOD_OPTIONS: { id: Mood; label: string }[] = [
  { id: 'verySad', label: 'Very sad' },
  { id: 'sad', label: 'Sad' },
  { id: 'neutral', label: 'Okay' },
  { id: 'happy', label: 'Happy' },
  { id: 'veryHappy', label: 'Very happy' },
];
export const FLOW_OPTIONS: { id: Flow; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'veryLight', label: 'Very light' },
  { id: 'light', label: 'Light' },
  { id: 'normal', label: 'Normal' },
  { id: 'heavy', label: 'Heavy' },
  { id: 'veryHeavy', label: 'Very heavy' },
];
export const PHYSICAL_SYMPTOMS = [
  { id: 'cramps', label: 'Cramps' },
  { id: 'headache', label: 'Headache' },
  { id: 'tired', label: 'Tired' },
  { id: 'bloating', label: 'Bloating' },
];
export const EMOTIONAL_SYMPTOMS = [
  { id: 'anxious', label: 'Worried' },
  { id: 'irritable', label: 'Grumpy' },
  { id: 'calm', label: 'Calm' },
  { id: 'sad', label: 'Sad' },
];
