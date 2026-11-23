import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import { describeDate, parseDate } from '@/features/calendar/calendar-dates';
import type { Answers, SaveStatus } from '@/features/health/autosave';
import { EMOTIONAL_SYMPTOM_OPTIONS, PHYSICAL_SYMPTOM_OPTIONS } from '@/features/health/catalog';
import type { HealthStore, LocalDate } from '@/features/health/contracts';
import { FlowPicker } from '@/features/health/flow-picker';
import { MoodPicker } from '@/features/health/mood-picker';
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
  /**
   * Agreed with S3-08: the screen hands the route an exit guard, and the route calls it before
   * header Back or swipe back. The guard finishes every pending save. If a save fails, the screen
   * shows "Not saved yet" with Retry / Stay, and the guard resolves true after a successful
   * Retry or false when the user chooses Stay. The route shows no message of its own.
   * Returns a function that unregisters the guard.
   */
  registerExitGuard?: (guard: () => Promise<boolean>) => () => void;
};

/** A blocked exit: `go` runs after a successful Retry; `stay` runs if the user stays instead. */
type BlockedExit = { go: () => void; stay?: () => void };

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
export function DailyLogScreen({
  date, today, store, appearance, onDateChange, onExit, registerExitGuard,
}: DailyLogScreenProps) {
  const log = useDailyLog(store, date);
  const [blocked, setBlockedState] = useState<BlockedExit | null>(null);
  const blockedRef = useRef<BlockedExit | null>(null);
  const [leaving, setLeaving] = useState(false);
  const mounted = useRef(true);
  const pendingGuards = useRef(new Set<(saved: boolean) => void>());
  const scrollRef = useRef<ScrollView>(null);
  const { colors, fontScale } = appearance;
  const text = (size: number) => ({ color: colors.text, fontSize: size * fontScale });

  // Replacing or clearing a blocked exit tells its owner the user stayed (resolves the guard false).
  function setBlocked(next: BlockedExit | null) {
    const previous = blockedRef.current;
    blockedRef.current = next;
    setBlockedState(next);
    if (previous && previous !== next && previous.stay !== next?.stay) previous.stay?.();
  }

  async function leave(go: () => void, stay?: () => void) {
    if (!mounted.current) return stay?.();
    // A different exit (e.g. Done after a failed header Back) cancels the old guard
    // before navigating, so the route can process the new action.
    if (blockedRef.current && blockedRef.current.stay !== stay) setBlocked(null);
    if (log.phase !== 'ready') return go(); // nothing has been edited yet
    setLeaving(true);
    const saved = await log.autosave.flushAll();
    if (!mounted.current) return stay?.();
    setLeaving(false);
    if (!saved) {
      setBlocked({ go, stay });
      // done is at the bottom; bring the "Not saved yet" line into view.
      scrollRef.current?.scrollTo({ y: 0, animated: !appearance.reduceMotion });
      return;
    }
    blockedRef.current = null; // finished: neither stayed nor replaced
    setBlockedState(null);
    go();
  }

  // Hand the route a guard for header Back / swipe back. It always uses the latest `leave`.
  const leaveRef = useRef(leave);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      for (const settle of pendingGuards.current) settle(false);
      blockedRef.current = null;
    };
  }, []);
  useEffect(() => {
    leaveRef.current = leave;
  });
  useEffect(() => {
    if (!registerExitGuard) return;
    const unregister = registerExitGuard(
      () => new Promise<boolean>((resolve) => {
        const settle = (saved: boolean) => {
          if (!pendingGuards.current.delete(settle)) return;
          resolve(saved);
        };
        pendingGuards.current.add(settle);
        void leaveRef.current(() => settle(true), () => settle(false));
      }),
    );
    return () => {
      unregister();
      for (const settle of pendingGuards.current) settle(false);
      blockedRef.current = null;
    };
  }, [registerExitGuard]);

  const parsed = parseDate(date);
  if (!parsed) {
    return <Text style={text(16)}>This day can&apos;t be shown.</Text>;
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
                    <Chip
                      label="Retry"
                      appearance={appearance}
                      disabled={leaving}
                      onPress={() => void leave(blocked.go, blocked.stay)}
                    />
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

// S3-04's Mood/Flow pickers and S3-05's symptom picker. Mood and Flow have no heading of their
// own, so their cards keep the Figma title bar; the symptom pickers show their own heading.
function AnswerControls({ draft, appearance, set }: {
  draft: Answers;
  appearance: Appearance;
  set: <K extends keyof Answers>(field: K, value: Answers[K]) => void;
}) {
  return (
    <>
      <Card title="Mood" appearance={appearance}>
        <MoodPicker value={draft.mood} onChange={(value) => set('mood', value)} appearance={appearance} />
      </Card>
      <Card title="Flow" appearance={appearance}>
        <FlowPicker value={draft.flow} onChange={(value) => set('flow', value)} appearance={appearance} />
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
