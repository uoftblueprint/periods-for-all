import type { Appearance } from '@/features/settings/appearance';

export type LocalDate = string; // YYYY-MM-DD, a calendar day, not a UTC timestamp

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
  getPeriodSetup(): Promise<PeriodSetup>; // missing → null answers, intro
  savePeriodSetup(value: PeriodSetup): Promise<void>;
}
export type SymptomPickerProps = {
  label: string; options: readonly { readonly id: string; readonly label: string }[];
  value: string[] | null; onChange: (v: string[] | null) => void;
  appearance: Appearance;
};
export type ReflectionInputProps = {
  value: string; onChangeText: (text: string) => void;
  onBlur: () => void; appearance: Appearance;
};
