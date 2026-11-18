// TEMPORARY (S3-08). Stand-ins for pieces other Sprint 3 tickets own, so the real
// routes can be built and tested now. Shapes are copied exactly from the issues.
// Delete this file once route-deps.ts points at the real S3-01/03/06/07 code.
//   S3-01 types + demo store · S3-03 PeriodDateEditor · S3-06 DailyLogScreen · S3-07 DayDetails
// Only made-up, in-memory data. Nothing here talks to Supabase.
import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { AppButton } from '@/components/app-button';
import { addDays, formatDate, parseDate } from '@/features/calendar/calendar-dates';
import { MonthCalendar } from '@/features/calendar/month-calendar';
import type { Appearance } from '@/features/settings/appearance';

// ---- S3-01 types (copied from the issue's "Inputs and outputs") ----
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
  getDailyLog(date: LocalDate): Promise<DailyLog>;
  patchDailyLog(date: LocalDate, patch: DailyLogPatch): Promise<DailyLog>;
  getPeriodSetup(): Promise<PeriodSetup>;
  savePeriodSetup(value: PeriodSetup): Promise<void>;
}

const emptyLog = (date: LocalDate): DailyLog => ({
  date, mood: null, flow: null, physicalSymptoms: null, emotionalSymptoms: null, reflection: null,
});

/** In-memory store that starts empty. A new instance per signed-in user. */
export function createPlaceholderHealthStore(): HealthStore {
  const periodDays = new Set<LocalDate>();
  const logs = new Map<LocalDate, DailyLog>();
  let setup: PeriodSetup = { lastPeriodStart: null, cycleLength: null, periodLength: null, step: 'intro' };
  return {
    async getPeriodDays(from, to) {
      return [...periodDays].filter((d) => d >= from && d <= to).sort();
    },
    async updatePeriodDays({ add, remove }) {
      add.forEach((d) => periodDays.add(d));
      remove.forEach((d) => periodDays.delete(d));
    },
    async getDailyLog(date) {
      return { ...(logs.get(date) ?? emptyLog(date)) };
    },
    async patchDailyLog(date, patch) {
      const next = { ...(logs.get(date) ?? emptyLog(date)), ...patch, date };
      if (next.reflection === '') next.reflection = null;
      logs.set(date, next);
      return { ...next };
    },
    async getPeriodSetup() {
      return { ...setup };
    },
    async savePeriodSetup(value) {
      setup = { ...value };
    },
  };
}

// ---- S3-07 DayDetails (props copied from the issue) ----
export type DayDetailsProps = {
  log: DailyLog; isPeriodDay: boolean; today: string;
  appearance: Appearance; onEdit: (date: string) => void;
};

export function PlaceholderDayDetails({ log, isPeriodDay, today, appearance, onEdit }: DayDetailsProps) {
  const text = { color: appearance.colors.text, fontSize: 16 * appearance.fontScale };
  const answers = [
    log.mood && `Mood: ${log.mood}`,
    log.flow && `Flow: ${log.flow}`,
    log.physicalSymptoms && `Physical: ${log.physicalSymptoms.length ? log.physicalSymptoms.join(', ') : 'none'}`,
    log.emotionalSymptoms && `Emotional: ${log.emotionalSymptoms.length ? log.emotionalSymptoms.join(', ') : 'none'}`,
    log.reflection && `Reflection: ${log.reflection}`,
  ].filter(Boolean) as string[];
  return (
    <View>
      <Text style={text}>[Placeholder for S3-07] {log.date}{isPeriodDay ? ' · period day' : ''}</Text>
      {answers.length ? answers.map((a) => <Text key={a} style={text}>{a}</Text>) : <Text style={text}>Nothing recorded for this day</Text>}
      {log.date <= today && (
        <AppButton appearance={appearance} label={answers.length ? 'Edit' : 'Track'} onPress={() => onEdit(log.date)} />
      )}
    </View>
  );
}

// ---- S3-03 PeriodDateEditor (props copied from the issue) ----
export type PeriodDateEditorProps = {
  initialDates: string[];
  initialMonth: string; today: string;
  appearance: Appearance;
  loadDates: (from: string, to: string) => Promise<string[]>;
  onSave: (change: { add: string[]; remove: string[] }) => Promise<void>;
  onDone: () => void; onCancel: () => void;
};

/** Tap-to-toggle, one month only. The real editor (S3-03) adds drag, month changes and confirmation. */
export function PlaceholderPeriodDateEditor(props: PeriodDateEditorProps) {
  const [draft, setDraft] = useState(() => new Set(props.initialDates));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const text = { color: props.appearance.colors.text, fontSize: 16 * props.appearance.fontScale };

  function toggle(date: string) {
    if (date > props.today) return; // never record future days
    setDraft((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  }

  async function save() {
    if (saving) return;
    const initial = new Set(props.initialDates);
    const add = [...draft].filter((d) => !initial.has(d));
    const remove = [...initial].filter((d) => !draft.has(d));
    setSaving(true);
    setError(null);
    try {
      await props.onSave({ add, remove });
      props.onDone();
    } catch {
      setError('Could not save dates. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View>
      <Text style={text}>[Placeholder for S3-03] Tap days to mark or unmark them.</Text>
      <MonthCalendar
        month={props.initialMonth} selectedDate={null} today={props.today}
        periodDates={[...draft]} onSelectDate={toggle} onChangeMonth={() => {}} onEditPeriodDates={() => {}}
        appearance={props.appearance}
      />
      {error && <Text accessibilityRole="alert" style={text}>{error}</Text>}
      <AppButton appearance={props.appearance} label={saving ? 'Saving…' : 'Save Dates'} busy={saving} onPress={save} />
      <AppButton appearance={props.appearance} label="Cancel" onPress={props.onCancel} />
    </View>
  );
}

// ---- S3-06 DailyLogScreen (props copied from the issue) ----
export type DailyLogScreenProps = {
  date: string; today: string; store: HealthStore; appearance: Appearance;
  onDateChange: (date: string) => void; onExit: () => void;
  /** Optional. The screen hands the route a function that saves everything pending and resolves
   *  false if anything is still unsaved; the route calls it before Back/swipe. Returns an unregister. */
  registerExitGuard?: (guard: () => Promise<boolean>) => () => void;
};

/** Saves each choice immediately. The real screen (S3-06) adds the full controls, queueing and debounce. */
export function PlaceholderDailyLogScreen({ date, today, store, appearance, onDateChange, onExit }: DailyLogScreenProps) {
  const [log, setLog] = useState<DailyLog | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready' | 'saving' | 'saveError'>('loading');
  const [reflection, setReflection] = useState('');
  const text = { color: appearance.colors.text, fontSize: 16 * appearance.fontScale };

  useEffect(() => {
    let active = true;
    setStatus('loading');
    store.getDailyLog(date).then(
      (loaded) => { if (active) { setLog(loaded); setReflection(loaded.reflection ?? ''); setStatus('ready'); } },
      () => { if (active) setStatus('error'); },
    );
    return () => { active = false; };
  }, [store, date]);

  async function save(patch: DailyLogPatch) {
    setStatus('saving');
    try {
      setLog(await store.patchDailyLog(date, patch));
      setStatus('ready');
    } catch {
      setStatus('saveError');
    }
  }

  const parts = parseDate(date);
  const step = (delta: -1 | 1) => {
    if (!parts) return;
    const next = addDays(parts, delta);
    onDateChange(formatDate(next, next.day));
  };

  if (status === 'loading' || !log) {
    return status === 'error'
      ? <Text accessibilityRole="alert" style={text}>[Placeholder for S3-06] Could not load this day.</Text>
      : <Text style={text}>Loading…</Text>;
  }
  return (
    <View>
      <Text style={text}>[Placeholder for S3-06] {date}{date === today ? ' · Today' : ''}</Text>
      <AppButton appearance={appearance} label="Previous day" onPress={() => step(-1)} />
      <AppButton appearance={appearance} label="Next day" disabled={date >= today} onPress={() => step(1)} />
      <Text style={text}>Mood: {log.mood ?? 'not answered'} · Flow: {log.flow ?? 'not answered'}</Text>
      <AppButton appearance={appearance} label="Mood: happy" onPress={() => save({ mood: 'happy' })} />
      <AppButton appearance={appearance} label="Flow: light" onPress={() => save({ flow: 'light' })} />
      <AppButton appearance={appearance} label="Symptoms: headache" onPress={() => save({ physicalSymptoms: ['headache'] })} />
      <TextInput
        accessibilityLabel="Reflection" value={reflection} onChangeText={setReflection}
        onBlur={() => save({ reflection })} style={text}
      />
      <Text style={text}>{status === 'saving' ? 'Saving' : status === 'saveError' ? 'Could not save — Try again' : 'Saved'}</Text>
      <AppButton appearance={appearance} label="Back" onPress={onExit} />
    </View>
  );
}
