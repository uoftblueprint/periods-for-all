import { useImperativeHandle, useRef, useState, type PropsWithChildren, type Ref } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import { describeDate, parseDate } from '@/features/calendar/calendar-dates';
import type { Answers, SaveStatus } from '@/features/health/autosave';
import {
  EMOTIONAL_SYMPTOM_OPTIONS, FLOW_OPTIONS, MOOD_OPTIONS, PHYSICAL_SYMPTOM_OPTIONS,
} from '@/features/health/catalog';
import type { HealthStore, LocalDate } from '@/features/health/contracts';
import { ReflectionInput } from '@/features/health/reflection-input';
import { SymptomPicker } from '@/features/health/symptom-picker';
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
  /** Lets the route (S3-08) run the same guarded exit for back gestures and tab taps. */
  ref?: Ref<DailyLogScreenHandle>;
};

export type DailyLogScreenHandle = {
  /**
   * Finishes every pending save, then calls `go`. If a save fails, `go` is not called and the
   * screen shows "Not saved yet" with Retry (saves, then calls `go`) or Stay.
   */
  leave(go: () => void): Promise<void>;
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
export function DailyLogScreen({ date, today, store, appearance, onDateChange, onExit, ref }: DailyLogScreenProps) {
  const log = useDailyLog(store, date);
  const [blocked, setBlocked] = useState<{ go: () => void } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const { colors, fontScale } = appearance;
  const text = (size: number) => ({ color: colors.text, fontSize: size * fontScale });
  useImperativeHandle(ref, () => ({ leave }));

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
          <Card appearance={appearance}>
            <ReflectionInput
              value={log.draft.reflection ?? ''}
              onChangeText={(value) => log.autosave.setField('reflection', value)}
              onBlur={log.autosave.blurReflection}
              appearance={appearance}
            />
          </Card>
        </>
      )}

      <Chip label="Done" appearance={appearance} disabled={leaving} onPress={() => void leave(onExit)} />
    </ScrollView>
  );
}

// Mood and Flow are temporary chips until S3-04's pickers merge. Symptoms use S3-05's picker,
// which shows its own heading, so those cards have no title bar.
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
      <Card appearance={appearance}>
        <SymptomPicker
          label="Physical Symptoms"
          options={PHYSICAL_SYMPTOM_OPTIONS}
          value={draft.physicalSymptoms}
          onChange={(value) => set('physicalSymptoms', value)}
          appearance={appearance}
        />
      </Card>
      <Card appearance={appearance}>
        <SymptomPicker
          label="Emotional Symptoms"
          options={EMOTIONAL_SYMPTOM_OPTIONS}
          value={draft.emotionalSymptoms}
          onChange={(value) => set('emotionalSymptoms', value)}
          appearance={appearance}
        />
      </Card>
    </>
  );
}

function Card({ title, appearance, wrap = false, children }: PropsWithChildren<{
  title?: string;
  appearance: Appearance;
  wrap?: boolean;
}>) {
  const { colors, fontScale } = appearance;
  return (
    <View style={{ borderWidth: 1, borderColor: colors.textSecondary, borderRadius: Spacing.two, overflow: 'hidden' }}>
      {title !== undefined && (
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
      )}
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
