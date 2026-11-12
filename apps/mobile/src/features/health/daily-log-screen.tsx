import { useRef, useState, type PropsWithChildren } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import { describeDate, parseDate } from '@/features/calendar/calendar-dates';
import type { Answers, SaveStatus } from '@/features/health/autosave';
import {
  EMOTIONAL_SYMPTOMS, FLOW_OPTIONS, MOOD_OPTIONS, PHYSICAL_SYMPTOMS,
  type HealthStore, type LocalDate,
} from '@/features/health/health-types';
import { isOnOrAfter, shiftDay, shortDayTitle } from '@/features/health/local-date';
import { useDailyLog } from '@/features/health/use-daily-log';
import type { Appearance } from '@/features/settings/appearance';

export type DailyLogScreenProps = {
  date: LocalDate;
  today: LocalDate;
  store: HealthStore;
  appearance: Appearance;
  onDateChange: (date: LocalDate) => void;
  onExit: () => void;
};

const statusText: Record<SaveStatus, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Could not save',
};

/**
 * One day's log. Changes save automatically; there is no Save button.
 * Every way out (previous/next day, Done) finishes pending saves first, and a failed save
 * keeps the user on this day with their draft until they retry or choose to stay.
 */
export function DailyLogScreen({ date, today, store, appearance, onDateChange, onExit }: DailyLogScreenProps) {
  const log = useDailyLog(store, date);
  const [blocked, setBlocked] = useState<{ go: () => void } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const { colors, fontScale } = appearance;
  const text = (size: number) => ({ color: colors.text, fontSize: size * fontScale });

  const parsed = parseDate(date);
  if (!parsed) {
    return <Text style={text(16)}>This day can&apos;t be shown.</Text>;
  }

  async function leave(go: () => void) {
    if (log.phase !== 'ready') return go(); // nothing has been edited yet
    setLeaving(true);
    const saved = await log.autosave.flushAll();
    setLeaving(false);
    if (!saved) {
      setBlocked({ go });
      // done is at the bottom; bring the "Not saved yet" line into view.
      scrollRef.current?.scrollTo({ y: 0, animated: !appearance.reduceMotion });
      return;
    }
    setBlocked(null);
    go();
  }

  const isToday = date === today;
  const nextDisabled = leaving || isOnOrAfter(date, today);

  return (
    <ScrollView
      ref={scrollRef}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: Spacing.three, gap: Spacing.three }}
    >
      
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
        <ArrowButton
          label="Previous day"
          glyph="‹"
          appearance={appearance}
          disabled={leaving}
          onPress={() => void leave(() => onDateChange(shiftDay(date, -1)))}
        />
        <Text
          accessibilityRole="header"
          accessibilityLabel={`${isToday ? 'Today, ' : ''}${describeDate(parsed)}`}
          style={[text(18), { flex: 1, textAlign: 'center' }]}
        >
          {isToday ? 'Today · ' : ''}
          <Text style={{ fontWeight: '700' }}>{shortDayTitle(parsed)}</Text>
        </Text>
        <ArrowButton
          label="Next day"
          glyph="›"
          appearance={appearance}
          disabled={nextDisabled}
          onPress={() => void leave(() => onDateChange(shiftDay(date, 1)))}
        />
      </View>

      {log.phase === 'loading' && <Text style={text(16)}>Loading…</Text>}

      {log.phase === 'error' && (
        <View style={{ gap: Spacing.two }}>
          <Text accessibilityRole="alert" style={text(16)}>Could not load this day.</Text>
          <Chip label="Try again" appearance={appearance} onPress={log.retry} />
        </View>
      )}

      {log.phase === 'ready' && (
        <>
          {/* a visible save status. Kept small, under the date. */}
          <View
            accessibilityRole={blocked ? 'alert' : undefined}
            style={{ alignItems: 'center', gap: Spacing.two, marginTop: -Spacing.two }}
          >
            <Text
              accessibilityLiveRegion="polite"
              style={{ color: colors.textSecondary, fontSize: 14 * fontScale, minHeight: 20 * fontScale }}
            >
              {blocked ? 'Not saved yet' : statusText[log.status]}
            </Text>
            {(blocked || log.status === 'error') && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.two }}>
                {blocked ? (
                  <>
                    <Chip label="Retry" appearance={appearance} disabled={leaving} onPress={() => void leave(blocked.go)} />
                    <Chip label="Stay" appearance={appearance} onPress={() => setBlocked(null)} />
                  </>
                ) : (
                  <Chip label="Try again" appearance={appearance} onPress={log.autosave.retry} />
                )}
              </View>
            )}
          </View>
          <AnswerControls draft={log.draft} appearance={appearance} set={log.autosave.setField} />
          <Card title="Daily Reflection" appearance={appearance}>
            <TextInput
              accessibilityLabel="Daily reflection"
              placeholder="How was today?"
              placeholderTextColor={colors.textSecondary}
              multiline
              value={log.draft.reflection ?? ''}
              onChangeText={(value) => log.autosave.setField('reflection', value)}
              onBlur={log.autosave.blurReflection}
              style={[text(16), { minHeight: 96, textAlignVertical: 'top' }]}
            />
          </Card>
        </>
      )}

      <Chip label="Done" appearance={appearance} disabled={leaving} onPress={() => void leave(onExit)} />
    </ScrollView>
  );
}

// TEMPORARY: to replace with S3-04's MoodPicker/FlowPicker and S3-05's SymptomPicker.
function AnswerControls({ draft, appearance, set }: {
  draft: Answers;
  appearance: Appearance;
  set: <K extends keyof Answers>(field: K, value: Answers[K]) => void;
}) {
  return (
    <>
      <Card title="Mood" appearance={appearance} wrap>
        {MOOD_OPTIONS.map((o) => (
          <Chip
            key={o.id}
            label={`Mood: ${o.label}`}
            text={o.label}
            selected={draft.mood === o.id}
            appearance={appearance}
            onPress={() => set('mood', draft.mood === o.id ? null : o.id)}
          />
        ))}
      </Card>
      <Card title="Flow" appearance={appearance} wrap>
        {FLOW_OPTIONS.map((o) => (
          <Chip
            key={o.id}
            label={`Flow: ${o.label}`}
            text={o.label}
            selected={draft.flow === o.id}
            appearance={appearance}
            onPress={() => set('flow', draft.flow === o.id ? null : o.id)}
          />
        ))}
      </Card>
      <SymptomGroup
        title="Physical Symptoms"
        labelPrefix="Physical symptom"
        options={PHYSICAL_SYMPTOMS}
        value={draft.physicalSymptoms}
        appearance={appearance}
        onChange={(value) => set('physicalSymptoms', value)}
      />
      <SymptomGroup
        title="Emotional Symptoms"
        labelPrefix="Emotional symptom"
        options={EMOTIONAL_SYMPTOMS}
        value={draft.emotionalSymptoms}
        appearance={appearance}
        onChange={(value) => set('emotionalSymptoms', value)}
      />
    </>
  );
}

// null = not answered, [] = "none of these" chosen on purpose.
function SymptomGroup({ title, labelPrefix, options, value, appearance, onChange }: {
  title: string;
  labelPrefix: string;
  options: { id: string; label: string }[];
  value: string[] | null;
  appearance: Appearance;
  onChange: (value: string[] | null) => void;
}) {
  function toggle(id: string) {
    const current = value ?? [];
    const next = current.includes(id) ? current.filter((v) => v !== id) : [...current, id];
    onChange(next.length ? next : null);
  }
  return (
    <Card title={title} appearance={appearance} wrap>
      {options.map((o) => (
        <Chip
          key={o.id}
          label={`${labelPrefix}: ${o.label}`}
          text={o.label}
          selected={value?.includes(o.id) ?? false}
          appearance={appearance}
          onPress={() => toggle(o.id)}
        />
      ))}
      <Chip
        label={`${labelPrefix}: None of these`}
        text="None of these"
        selected={value !== null && value.length === 0}
        appearance={appearance}
        onPress={() => onChange(value !== null && value.length === 0 ? null : [])}
      />
    </Card>
  );
}

function Card({ title, appearance, wrap = false, children }: PropsWithChildren<{
  title: string;
  appearance: Appearance;
  wrap?: boolean;
}>) {
  const { colors, fontScale } = appearance;
  return (
    <View style={{ borderWidth: 1, borderColor: colors.textSecondary, borderRadius: Spacing.two, overflow: 'hidden' }}>
      <View
        style={{
          backgroundColor: colors.backgroundElement,
          borderBottomWidth: 1,
          borderBottomColor: colors.textSecondary,
          paddingVertical: Spacing.two,
          paddingHorizontal: Spacing.three,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{ color: colors.text, fontSize: 16 * fontScale, fontWeight: '700', textAlign: 'center' }}
        >
          {title}
        </Text>
      </View>
      <View
        style={[
          { padding: Spacing.three, backgroundColor: colors.background },
          wrap && { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function ArrowButton({ label, glyph, disabled, appearance, onPress }: {
  label: string;
  glyph: string;
  disabled: boolean;
  appearance: Appearance;
  onPress: () => void;
}) {
  const { colors, fontScale } = appearance;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ color: disabled ? colors.textSecondary : colors.text, fontSize: 28 * fontScale }}>{glyph}</Text>
    </Pressable>
  );
}

function Chip({ label, text, selected, disabled = false, appearance, onPress }: {
  label: string;
  text?: string;
  selected?: boolean;
  disabled?: boolean;
  appearance: Appearance;
  onPress: () => void;
}) {
  const { colors, fontScale } = appearance;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 44,
        minWidth: 44,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: Spacing.three,
        borderRadius: Spacing.two,
        borderWidth: selected ? 3 : 1,
        borderColor: colors.text,
        backgroundColor: selected ? colors.backgroundSelected : colors.backgroundElement,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 16 * fontScale }}>
        {selected ? '✓ ' : ''}{text ?? label}
      </Text>
    </Pressable>
  );
}
