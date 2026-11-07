import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import type { Appearance } from '@/features/settings/appearance';
import type { LocalDate } from '@/features/health/contracts';

import {
  buildMonthGrid,
  describeDate,
  parseDate,
  parseMonth,
} from './calendar-dates';
import { isSelectablePeriodDate } from './period-date-editor-state';

const PERIOD_COLOR = '#F8453E';
const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const PERIOD_DROP = require('@/assets/images/calendar-period-drop.png');

export type EditablePeriodMonthGridProps = {
  month: string;
  today: LocalDate;
  selectedDates: readonly LocalDate[];
  onChangeDate: (date: LocalDate, selected: boolean) => void;
  appearance: Appearance;
  disabled?: boolean;
};

/** Editable month grid used by the period-date editor. */
export function EditablePeriodMonthGrid({
  month,
  today,
  selectedDates,
  onChangeDate,
  appearance,
  disabled = false,
}: EditablePeriodMonthGridProps) {
  const parsedMonth = parseMonth(month);
  const selected = new Set(selectedDates);
  const { colors, fontScale } = appearance;

  if (!parsedMonth) {
    return (
      <Text
        accessibilityRole="alert"
        style={{ color: colors.text, fontSize: 16 * fontScale }}>
        This month can&apos;t be edited.
      </Text>
    );
  }

  return (
    <View style={{ backgroundColor: colors.background }}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ flexDirection: 'row', paddingBottom: Spacing.two }}>
        {WEEKDAY_LETTERS.map((letter, index) => (
          <Text
            key={index}
            style={{
              color: colors.textSecondary,
              flex: 1,
              fontSize: 14 * fontScale,
              textAlign: 'center',
            }}>
            {letter}
          </Text>
        ))}
      </View>

      {buildMonthGrid(parsedMonth).map((week, weekIndex) => (
        <View key={weekIndex} style={{ flexDirection: 'row' }}>
          {week.map((date, dayIndex) => date ? (
            <EditableDayCell
              key={date}
              date={date}
              today={today}
              selected={selected.has(date)}
              disabled={disabled || !isSelectablePeriodDate(date, today)}
              onChangeDate={onChangeDate}
              appearance={appearance}
            />
          ) : (
            <View
              key={`blank-${dayIndex}`}
              style={{
                borderColor: colors.backgroundElement,
                borderWidth: 0.5,
                flex: 1,
                minHeight: 72,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

type EditableDayCellProps = {
  date: LocalDate;
  today: LocalDate;
  selected: boolean;
  disabled: boolean;
  onChangeDate: (date: LocalDate, selected: boolean) => void;
  appearance: Appearance;
};

function EditableDayCell({
  date,
  today,
  selected,
  disabled,
  onChangeDate,
  appearance,
}: EditableDayCellProps) {
  const parsed = parseDate(date)!;
  const { colors, fontScale } = appearance;
  const label = [
    describeDate(parsed),
    date === today && 'today',
    selected ? 'selected' : 'not selected',
  ].filter(Boolean).join(', ');

  return (
    <Pressable
      accessibilityHint={selected
        ? 'Removes this period date'
        : 'Adds this period date'}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={() => onChangeDate(date, !selected)}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: colors.background,
        borderColor: colors.backgroundElement,
        borderWidth: 0.5,
        flex: 1,
        gap: Spacing.one,
        justifyContent: 'center',
        minHeight: 72,
        opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
        padding: Spacing.two,
      })}>
      <Text
        style={{
          color: selected ? PERIOD_COLOR : colors.text,
          fontSize: 16 * fontScale,
          fontWeight: selected || date === today ? '700' : '400',
          textAlign: 'center',
        }}>
        {parsed.day}
      </Text>

      <View
        testID={`period-date-marker-${date}`}
        style={selected ? {
          alignItems: 'center',
          backgroundColor: PERIOD_COLOR,
          borderRadius: 12,
          height: 24,
          justifyContent: 'center',
          padding: Spacing.one,
          width: 24,
        } : {
          borderColor: colors.textSecondary,
          borderRadius: 12,
          borderStyle: 'dashed',
          borderWidth: 2,
          height: 24,
          width: 24,
        }}>
        {selected && (
          <Image
            accessibilityElementsHidden
            contentFit="contain"
            source={PERIOD_DROP}
            style={{ height: 16, width: 16 }}
          />
        )}
      </View>
    </Pressable>
  );
}
