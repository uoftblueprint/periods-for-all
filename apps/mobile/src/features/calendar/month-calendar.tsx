import { Pressable, Text, View } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import type { Appearance } from '@/features/settings/appearance';
import {
  addMonths, buildMonthGrid, describeDate, formatDate, formatMonth, monthTitle, parseDate, parseMonth,
} from './calendar-dates';

export type MonthCalendarProps = {
  month: string; // YYYY-MM, e.g. '2026-10'
  selectedDate: string | null; // YYYY-MM-DD
  today: string; // supplied for reproducible previews/tests
  periodDates: string[]; // explicit dates to mark, not predictions
  onSelectDate: (date: string) => void;
  onChangeMonth: (month: string) => void;
  onEditPeriodDates: () => void;
  appearance: Appearance;
};

// Temporary accent colours taken from the Figma handoff
const ACCENT = '#A3151C'; // today circle, selected outline, primary button
const PERIOD = '#E5484D'; // period bar
const ON_ACCENT = '#FFFFFF';
const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * Month grid that only displays the dates it is given and reports taps through callbacks.
 * It never saves, selects or predicts anything on its own.
 */
export function MonthCalendar(props: MonthCalendarProps) {
  const { colors, fontScale } = props.appearance;
  const current = parseMonth(props.month);
  const today = parseDate(props.today) ? props.today : null;
  const periodDates = new Set(props.periodDates.filter((date) => parseDate(date) !== null));

  // Invalid input fails safely instead of drawing a misleading month.
  if (!current) {
    return (
      <Text accessibilityRole="alert" style={{ color: colors.text, fontSize: 16 * fontScale }}>
        This month can&apos;t be shown.
      </Text>
    );
  }

  const textStyle = (size: number) => ({ color: colors.text, fontSize: size * fontScale });
  const goToMonth = (delta: number) => props.onChangeMonth(formatMonth(addMonths(current, delta)));
  const goToToday = () => {
    if (!today) return;
    props.onChangeMonth(today.slice(0, 7));
    props.onSelectDate(today);
  };

  return (
    <View style={{ backgroundColor: colors.background, gap: Spacing.three }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two }}>
        <HeaderButton label="Today" accessibilityLabel="Go to today" disabled={!today} onPress={goToToday} appearance={props.appearance} />
        <View style={{ flexDirection: 'row', gap: Spacing.two }}>
          <HeaderButton label="‹" accessibilityLabel="Previous month" onPress={() => goToMonth(-1)} appearance={props.appearance} />
          <HeaderButton label="›" accessibilityLabel="Next month" onPress={() => goToMonth(1)} appearance={props.appearance} />
        </View>
      </View>

      <Text accessibilityRole="header" style={[textStyle(22), { fontWeight: '700' }]}>
        {monthTitle(current)}
      </Text>

      <View>
        <View style={{ flexDirection: 'row' }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {WEEKDAY_LETTERS.map((letter, index) => (
            <Text key={index} style={[textStyle(12), { flex: 1, textAlign: 'center', color: colors.textSecondary }]}>
              {letter}
            </Text>
          ))}
        </View>
        {buildMonthGrid(current).map((week, weekIndex) => (
          <View key={weekIndex} style={{ flexDirection: 'row' }}>
            {week.map((date, dayIndex) =>
              date ? (
                <DayCell
                  key={date}
                  date={date}
                  isToday={date === today}
                  isSelected={date === props.selectedDate}
                  periodDates={periodDates}
                  onPress={() => props.onSelectDate(date)}
                  appearance={props.appearance}
                />
              ) : (
                <View key={`blank-${dayIndex}`} style={{ flex: 1 }} />
              ),
            )}
          </View>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={props.onEditPeriodDates}
        style={{ backgroundColor: ACCENT, borderRadius: 999, minHeight: 44, paddingVertical: Spacing.two, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: ON_ACCENT, fontSize: 16 * fontScale, fontWeight: '600' }}>Edit Period Dates</Text>
      </Pressable>
    </View>
  );
}

type HeaderButtonProps = {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  appearance: Appearance;
};

function HeaderButton({ label, accessibilityLabel, onPress, disabled = false, appearance }: HeaderButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minWidth: 44, minHeight: 44, paddingHorizontal: Spacing.three, borderRadius: 999,
        alignItems: 'center', justifyContent: 'center', backgroundColor: appearance.colors.backgroundElement,
        opacity: disabled ? 0.5 : 1,
      }}>
      <Text style={{ color: appearance.colors.text, fontSize: 16 * appearance.fontScale }}>{label}</Text>
    </Pressable>
  );
}

type DayCellProps = {
  date: string;
  isToday: boolean;
  isSelected: boolean;
  periodDates: Set<string>;
  onPress: () => void;
  appearance: Appearance;
};

function DayCell({ date, isToday, isSelected, periodDates, onPress, appearance }: DayCellProps) {
  const parts = parseDate(date)!;
  const { colors, fontScale } = appearance;
  const isPeriod = periodDates.has(date);
  // Round the bar's ends so a run of period days reads as one connected stretch.
  const startsBar = isPeriod && !periodDates.has(formatDate(parts, parts.day - 1));
  const endsBar = isPeriod && !periodDates.has(formatDate(parts, parts.day + 1));
  const circleSize = 32 * fontScale;
  // The dark-red outline is too faint on a black background, so dark mode uses the lighter red.
  const outlineColor = colors === Colors.dark ? PERIOD : ACCENT;

  const label = [describeDate(parts), isToday && 'today', isSelected && 'selected', isPeriod && 'period day']
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={{ flex: 1, minHeight: 48, alignItems: 'center', paddingVertical: Spacing.one }}>
      {isSelected && (
        // Drawn as an overlay (not a cell border) so the period bar stays continuous between days.
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, bottom: 0, left: 2, right: 2, borderWidth: 2, borderRadius: 8, borderColor: outlineColor }}
        />
      )}
      <View
        style={{
          width: circleSize, height: circleSize, borderRadius: circleSize / 2,
          alignItems: 'center', justifyContent: 'center', backgroundColor: isToday ? ACCENT : 'transparent',
        }}>
        <Text style={{ color: isToday ? ON_ACCENT : colors.text, fontSize: 14 * fontScale, fontWeight: isSelected || isToday ? '700' : '400' }}>
          {parts.day}
        </Text>
      </View>
      <View
        style={{
          alignSelf: 'stretch', height: 4, marginTop: Spacing.half,
          backgroundColor: isPeriod ? PERIOD : 'transparent',
          borderTopLeftRadius: startsBar ? 2 : 0, borderBottomLeftRadius: startsBar ? 2 : 0,
          borderTopRightRadius: endsBar ? 2 : 0, borderBottomRightRadius: endsBar ? 2 : 0,
        }}
      />
    </Pressable>
  );
}
