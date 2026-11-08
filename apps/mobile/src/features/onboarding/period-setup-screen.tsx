import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import type { Appearance } from '@/features/settings/appearance';
import {
  addMonths, buildMonthGrid, monthTitle, parseDate, parseMonth, type YearMonth,
} from '@/features/calendar/calendar-dates';

// Temporary local type until S3-01 merges shared health types.
// null = "not answered" — never 0 or a guessed average.
export type PeriodSetup = {
  lastPeriodStart: string | null;
  cycleLength: number | null;
  periodLength: number | null;
  step: 'intro' | 'lastPeriod' | 'cycle' | 'length' | 'complete';
};

export const defaultPeriodSetup: PeriodSetup = {
  lastPeriodStart: null, cycleLength: null, periodLength: null, step: 'intro',
};

/** Props for the period setup onboarding flow. */
export type PeriodSetupScreenProps = {
  initialValue: PeriodSetup;
  today: string;
  appearance: Appearance;
  onSave: (next: PeriodSetup) => Promise<void>;
  onFinish: () => void;
  onExit: () => void;
};

// Ordered flow: intro → lastPeriod → cycle → length → complete.
const steps = ['intro', 'lastPeriod', 'cycle', 'length'] as const;
type Step = (typeof steps)[number];

// Headers shown on each question screen (intro has its own layout).
const STEP_INFO: Partial<Record<Step, { number: number; title: string }>> = {
  lastPeriod: { number: 1, title: 'Last Period' },
  cycle: { number: 2, title: 'Cycle Length' },
  length: { number: 3, title: 'Period Length' },
};

// Returns the next step, or 'complete' after the last question.
function nextStep(s: Step): Step | 'complete' {
  const i = steps.indexOf(s);
  return i < steps.length - 1 ? steps[i + 1] : 'complete';
}

// Returns the previous step, or null if already at intro.
function prevStep(s: Step): Step | null {
  const i = steps.indexOf(s);
  return i > 0 ? steps[i - 1] : null;
}

const CYCLE_RANGE = Array.from({ length: 25 }, (_, i) => i + 21); // 21–45 days
const PERIOD_RANGE = Array.from({ length: 12 }, (_, i) => i + 1); // 1–12 days
const WEEKDAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// Wheel picker sizing constants.
const ITEM_HEIGHT = 48;
const VISIBLE_COUNT = 7;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_COUNT;
// Padding so the first/last item can be scrolled to the center.
const PICKER_PAD = ITEM_HEIGHT * Math.floor(VISIBLE_COUNT / 2);

/**
 * Period-setup onboarding flow: intro, last period date, cycle length, period length.
 * Saves each step via onSave before advancing. Resumes from initialValue.step.
 */
export function PeriodSetupScreen({
  initialValue, today, appearance, onSave, onFinish, onExit,
}: PeriodSetupScreenProps) {
  const { colors, fontScale } = appearance;
  const [draft, setDraft] = useState<PeriodSetup>(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ref prevents double-submit while an async save is in flight.
  const saveInFlight = useRef(false);

  // If resumed at 'complete', show the last question step.
  const step = draft.step === 'complete' ? 'length' : draft.step;
  const info = STEP_INFO[step];
  // Question index for progress dots (0-based, -1 for intro).
  const questionIndex = step === 'lastPeriod' ? 0 : step === 'cycle' ? 1 : step === 'length' ? 2 : -1;

  // Persist the next state, then advance. On failure, keep the page with an error.
  async function save(next: PeriodSetup) {
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      await onSave(next);
      setDraft(next);
      if (next.step === 'complete') onFinish();
    } catch {
      setError('Could not save. Please try again.');
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }

  // Continue saves the current answer and advances.
  function handleContinue() {
    save({ ...draft, step: nextStep(step) });
  }

  // Skip clears the current answer to null and advances.
  // On intro, skip finishes setup with whatever answers exist.
  function handleSkip() {
    if (step === 'intro') {
      save({ ...draft, step: 'complete' });
      return;
    }
    const cleared = { ...draft };
    if (step === 'lastPeriod') cleared.lastPeriodStart = null;
    if (step === 'cycle') cleared.cycleLength = null;
    if (step === 'length') cleared.periodLength = null;
    save({ ...cleared, step: nextStep(step) });
  }

  // Back returns one step without discarding answers. Intro back exits.
  function handleBack() {
    if (step === 'intro') { onExit(); return; }
    const ps = prevStep(step);
    if (ps) setDraft({ ...draft, step: ps });
  }

  const isLast = step === 'length';

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Top bar: back arrow + step label/title (question screens only) */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={handleBack}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.backArrow}
          >
            <Text style={{ color: colors.text, fontSize: 22 * fontScale }}>{'<'}</Text>
          </Pressable>
          {info && (
            <View style={styles.stepLabel}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 * fontScale }}>
                Step {info.number}
              </Text>
              <Text style={{ color: colors.text, fontSize: 16 * fontScale, fontWeight: '700' }}>
                {info.title}
              </Text>
            </View>
          )}
        </View>

        {/* Step content */}
        <View style={[styles.content, saving && styles.disabled]}>
          {/* Intro */}
          {step === 'intro' && (
            <View style={styles.introContent}>
              {/* Mascot illustration placeholder — asset provided by design */}
              <Text style={[styles.introTitle, { color: colors.text, fontSize: 24 * fontScale }]}>
                Let's start tracking your period!
              </Text>
              <Text style={{
                color: colors.textSecondary, fontSize: 16 * fontScale,
                lineHeight: 24 * fontScale, textAlign: 'center',
              }}>
                This records your last period to improve cycle predictions.
              </Text>
            </View>
          )}

          {/* Step 1: last period date — calendar picker, today or earlier */}
          {step === 'lastPeriod' && (
            <DatePickerContent
              value={draft.lastPeriodStart}
              today={today}
              onChange={(d) => setDraft({ ...draft, lastPeriodStart: d })}
              colors={colors}
              fontScale={fontScale}
            />
          )}

          {/* Step 2: cycle length — vertical wheel picker, 21–45 days */}
          {step === 'cycle' && (
            <WheelPickerContent
              title="What is your typical cycle length?"
              subtitle={'This is the number of days from the first day of full-flow menstrual bleeding to the day before the next period.'}
              range={CYCLE_RANGE}
              unit="Days"
              value={draft.cycleLength}
              onChange={(n) => setDraft({ ...draft, cycleLength: n })}
              colors={colors}
              fontScale={fontScale}
            />
          )}

          {/* Step 3: period length — vertical wheel picker, 1–12 days */}
          {step === 'length' && (
            <WheelPickerContent
              title="What is your typical period length?"
              subtitle="This is the period of menstrual bleeding."
              range={PERIOD_RANGE}
              unit="Days"
              value={draft.periodLength}
              onChange={(n) => setDraft({ ...draft, periodLength: n })}
              colors={colors}
              fontScale={fontScale}
            />
          )}
        </View>

        {/* Progress dots for question screens (3 steps) */}
        {questionIndex >= 0 && (
          <View style={styles.dots}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: i === questionIndex ? '#A3151C' : colors.backgroundElement },
                ]}
              />
            ))}
          </View>
        )}

        {/* Error with retry — shown after a failed save */}
        {error && (
          <Text style={[styles.error, { fontSize: 14 * fontScale }]}>{error}</Text>
        )}

        {/* Action buttons: Continue/Finish and Skip/"I'm not sure" */}
        <View style={styles.actions}>
          <Pressable
            onPress={handleContinue}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={saving ? 'Saving' : isLast ? 'Finish' : 'Continue'}
            style={[styles.primaryButton, { opacity: saving ? 0.5 : 1 }]}
          >
            <Text style={[styles.primaryButtonText, { fontSize: 16 * fontScale }]}>
              {saving ? 'Saving...' : isLast ? 'Finish' : 'Continue'}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleSkip}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={step === 'intro' ? 'Skip for now' : "I'm not sure"}
            style={styles.textButton}
          >
            <Text style={[styles.textButtonLabel, { color: colors.textSecondary, fontSize: 14 * fontScale }]}>
              {step === 'intro' ? 'Skip for now' : "I'm not sure"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

type Colors = Appearance['colors'];

/** Calendar month grid for picking the last period start date. No future dates allowed. */
function DatePickerContent({ value, today, onChange, colors, fontScale }: {
  value: string | null; today: string; onChange: (d: string) => void;
  colors: Colors; fontScale: number;
}) {
  const todayParts = parseDate(today)!;
  const todayMonth: YearMonth = { year: todayParts.year, month: todayParts.month };
  // Start on the month of the existing value, or today's month.
  const [month, setMonth] = useState<YearMonth>(
    value ? parseMonth(value.slice(0, 7)) ?? todayMonth : todayMonth,
  );
  const grid = buildMonthGrid(month);
  const isCurrentMonth = month.year === todayMonth.year && month.month === todayMonth.month;

  return (
    <>
      <Text style={[styles.questionTitle, { color: colors.text, fontSize: 22 * fontScale }]}>
        When was the start of your last period?
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: 14 * fontScale, lineHeight: 20 * fontScale }}>
        Tap on a date below to choose the start of your last period.
      </Text>

      {/* Month nav: title with chevron on left, arrows on right */}
      <View style={styles.monthNav}>
        <Text style={{ color: colors.text, fontSize: 16 * fontScale, fontWeight: '600' }}>
          {monthTitle(month)} ▾
        </Text>
        <View style={styles.monthArrows}>
          <Pressable
            onPress={() => setMonth(addMonths(month, -1))}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
          >
            <Text style={{ color: colors.text, fontSize: 18 * fontScale }}>{'<'}</Text>
          </Pressable>
          {/* Disabled when already on today's month — no future months */}
          <Pressable
            onPress={() => {
              const next = addMonths(month, 1);
              if (next.year < todayMonth.year ||
                (next.year === todayMonth.year && next.month <= todayMonth.month)) {
                setMonth(next);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            disabled={isCurrentMonth}
            style={{ opacity: isCurrentMonth ? 0.3 : 1 }}
          >
            <Text style={{ color: colors.text, fontSize: 18 * fontScale }}>{'>'}</Text>
          </Pressable>
        </View>
      </View>

      {/* Full weekday headers (SUN–SAT) */}
      <View style={styles.weekRow}>
        {WEEKDAY_NAMES.map((name, i) => (
          <Text key={i} style={[styles.weekCell, { color: colors.textSecondary, fontSize: 11 * fontScale }]}>
            {name}
          </Text>
        ))}
      </View>

      {/* Day grid — selected = filled red, today = red outline, future = dimmed */}
      {grid.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((dateStr, di) => {
            if (!dateStr) return <View key={di} style={styles.dayCell} />;
            const isFuture = dateStr > today;
            const isSelected = dateStr === value;
            const isToday = dateStr === today;
            return (
              <Pressable
                key={di}
                onPress={() => { if (!isFuture) onChange(dateStr); }}
                disabled={isFuture}
                accessibilityRole="button"
                accessibilityLabel={`${dateStr}${isSelected ? ', selected' : ''}${isToday ? ', today' : ''}${isFuture ? ', future date' : ''}`}
                style={[
                  styles.dayCell,
                  isSelected && styles.daySelected,
                  isToday && !isSelected && styles.dayToday,
                  isFuture && { opacity: 0.3 },
                ]}
              >
                <Text style={{
                  color: isSelected ? '#fff' : colors.text,
                  fontSize: 14 * fontScale,
                  textAlign: 'center',
                }}>
                  {parseDate(dateStr)!.day}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </>
  );
}

/**
 * Vertical wheel picker for numeric values (cycle length, period length).
 * Snaps to items on scroll; center item is visually prominent.
 */
function WheelPickerContent({ title, subtitle, range, unit, value, onChange, colors, fontScale }: {
  title: string; subtitle: string; range: number[]; unit: string;
  value: number | null; onChange: (n: number) => void;
  colors: Colors; fontScale: number;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const defaultIndex = Math.floor(range.length / 2);
  // Track which index is visually centered for styling.
  const [centerIndex, setCenterIndex] = useState(
    value != null ? range.indexOf(value) : defaultIndex,
  );

  // Called when scroll settles — update selection to whichever item is centered.
  function handleScrollEnd(y: number) {
    const idx = Math.max(0, Math.min(range.length - 1, Math.round(y / ITEM_HEIGHT)));
    setCenterIndex(idx);
    onChange(range[idx]);
  }

  return (
    <>
      <Text style={[styles.questionTitle, { color: colors.text, fontSize: 22 * fontScale }]}>
        {title}
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: 14 * fontScale, lineHeight: 20 * fontScale }}>
        {subtitle}
      </Text>

      <View style={[styles.wheelContainer, { height: PICKER_HEIGHT }]}>
        <ScrollView
          ref={scrollRef}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          contentOffset={{ x: 0, y: centerIndex * ITEM_HEIGHT }}
          onMomentumScrollEnd={(e) => handleScrollEnd(e.nativeEvent.contentOffset.y)}
        >
          {/* Top/bottom padding so first/last items can reach the center */}
          <View style={{ paddingVertical: PICKER_PAD }}>
            {range.map((n, i) => {
              const dist = Math.abs(i - centerIndex);
              return (
                <Pressable
                  key={n}
                  onPress={() => {
                    setCenterIndex(i);
                    onChange(n);
                    scrollRef.current?.scrollTo({ y: i * ITEM_HEIGHT, animated: true });
                  }}
                  accessibilityRole="radio"
                  accessibilityLabel={`${n} ${unit}`}
                  accessibilityState={{ checked: n === value }}
                  style={styles.wheelItem}
                >
                  <Text style={{
                    color: colors.text,
                    fontSize: (dist === 0 ? 22 : Math.max(13, 18 - dist * 2)) * fontScale,
                    fontWeight: dist === 0 ? '700' : '400',
                    opacity: Math.max(0.3, 1 - dist * 0.15),
                  }}>
                    {n} {unit}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
        {/* Center highlight line (non-interactive overlay) */}
        <View pointerEvents="none" style={[styles.wheelHighlight, {
          top: Math.floor(VISIBLE_COUNT / 2) * ITEM_HEIGHT,
          borderColor: colors.backgroundElement,
        }]} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.four },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  backArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: { flex: 1, alignItems: 'center', marginRight: 40 },
  content: { gap: Spacing.three },
  disabled: { opacity: 0.5 },
  introContent: { alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.five },
  introTitle: { fontWeight: '700', textAlign: 'center' },
  questionTitle: { fontWeight: '700' },
  error: { color: '#A3151C', marginTop: Spacing.two },
  actions: { gap: Spacing.two, marginTop: Spacing.four },
  primaryButton: {
    backgroundColor: '#A3151C',
    borderRadius: 24,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  textButton: { alignItems: 'center', paddingVertical: Spacing.two },
  textButtonLabel: { textDecorationLine: 'underline' },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.one,
    marginTop: Spacing.three,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  // Calendar styles
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  monthArrows: { flexDirection: 'row', gap: Spacing.three },
  weekRow: { flexDirection: 'row' },
  weekCell: { flex: 1, textAlign: 'center', paddingVertical: Spacing.one },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
  },
  daySelected: { backgroundColor: '#A3151C', borderRadius: 20 },
  dayToday: { borderWidth: 1.5, borderColor: '#A3151C', borderRadius: 20 },
  // Wheel picker styles
  wheelContainer: { overflow: 'hidden', marginTop: Spacing.two },
  wheelItem: { height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' },
  wheelHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
});
