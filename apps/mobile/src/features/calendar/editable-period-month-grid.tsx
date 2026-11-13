import { Image } from 'expo-image';
import { useRef } from 'react';
import {
  type GestureResponderEvent,
  Pressable,
  Text,
  View,
} from 'react-native';

import { Spacing } from '@/constants/theme';
import type { Appearance } from '@/features/settings/appearance';
import type { LocalDate } from '@/features/health/contracts';

import {
  buildMonthDisplayGrid,
  describeDate,
  parseDate,
  parseMonth,
} from './calendar-dates';
import {
  beginDateSelectionGesture,
  isSelectablePeriodDate,
  visitDateSelectionGesture,
} from './period-date-editor-state';

import type { DateSelectionGesture } from './period-date-editor-state';

const PERIOD_COLOR = '#F8453E';
const PAST_MONTH_COLOR = '#8F7F67';
const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const PERIOD_DROP = require('@/assets/images/calendar-period-drop.png');

type Point = { x: number; y: number };
type GridLayout = { width: number; height: number };
type TouchStart = {
  date: LocalDate;
  gridPoint: Point;
  pagePoint: Point;
};

export type EditablePeriodMonthGridProps = {
  month: string;
  today: LocalDate;
  selectedDates: readonly LocalDate[];
  editableMonths: readonly string[];
  onChangeDate: (date: LocalDate, selected: boolean) => void;
  onDraggingChange?: (dragging: boolean) => void;
  onEdgeTouchActiveChange?: (active: boolean) => void;
  appearance: Appearance;
  disabled?: boolean;
};

/** Editable month grid used by the period-date editor. */
export function EditablePeriodMonthGrid({
  month,
  today,
  selectedDates,
  editableMonths,
  onChangeDate,
  onDraggingChange,
  onEdgeTouchActiveChange,
  appearance,
  disabled = false,
}: EditablePeriodMonthGridProps) {
  const parsedMonth = parseMonth(month);
  const weeks = parsedMonth ? buildMonthDisplayGrid(parsedMonth) : [];
  const selected = new Set(selectedDates);
  const { colors, fontScale } = appearance;
  const rowHeight = Math.max(72, Math.ceil(48 + 20 * fontScale));
  const weeksRef = useRef(weeks);
  const selectedRef = useRef(selected);
  const todayRef = useRef(today);
  const disabledRef = useRef(disabled);
  const editableMonthsRef = useRef(new Set(editableMonths));
  const onChangeDateRef = useRef(onChangeDate);
  const onDraggingChangeRef = useRef(onDraggingChange);
  const onEdgeTouchActiveChangeRef = useRef(onEdgeTouchActiveChange);
  const layoutRef = useRef<GridLayout>({ width: 0, height: 0 });
  const touchStartRef = useRef<TouchStart | null>(null);
  const gestureRef = useRef<DateSelectionGesture | null>(null);
  const edgeTouchActiveRef = useRef(false);

  weeksRef.current = weeks;
  selectedRef.current = selected;
  todayRef.current = today;
  disabledRef.current = disabled;
  editableMonthsRef.current = new Set(editableMonths);
  onChangeDateRef.current = onChangeDate;
  onDraggingChangeRef.current = onDraggingChange;
  onEdgeTouchActiveChangeRef.current = onEdgeTouchActiveChange;

  const dateAtPoint = ({ x, y }: Point): LocalDate | null => {
    const currentWeeks = weeksRef.current;
    const { width, height } = layoutRef.current;
    if (!currentWeeks.length || width <= 0 || height <= 0) return null;
    if (x < 0 || x >= width || y < 0 || y >= height) return null;

    const column = Math.floor(x / (width / 7));
    const row = Math.floor(y / (height / currentWeeks.length));
    return currentWeeks[row][column];
  };

  const canChangeDate = (date: LocalDate | null): date is LocalDate => (
    date !== null
    && !disabledRef.current
    && editableMonthsRef.current.has(date.slice(0, 7))
    && isSelectablePeriodDate(date, todayRef.current)
  );

  const beginGestureAt = (point: Point): boolean => {
    const date = dateAtPoint(point);
    if (!canChangeDate(date)) return false;

    const gesture = beginDateSelectionGesture(
      date,
      selectedRef.current.has(date),
    );
    gestureRef.current = gesture;
    onChangeDateRef.current(date, gesture.selecting);
    return true;
  };

  const visitGestureAt = (point: Point) => {
    const date = dateAtPoint(point);
    if (!canChangeDate(date)) return;

    if (!gestureRef.current) {
      beginGestureAt(point);
      return;
    }

    const visit = visitDateSelectionGesture(gestureRef.current, date);
    gestureRef.current = visit.gesture;
    if (visit.shouldApply) {
      onChangeDateRef.current(date, visit.gesture.selecting);
    }
  };

  const rememberTouchStart = (
    date: LocalDate,
    event: GestureResponderEvent,
  ) => {
    const currentWeeks = weeksRef.current;
    const { width, height } = layoutRef.current;
    const row = currentWeeks.findIndex((week) => week.includes(date));
    const column = row < 0 ? -1 : currentWeeks[row].indexOf(date);
    if (row < 0 || column < 0 || width <= 0 || height <= 0) return;

    if (column === 0) {
      edgeTouchActiveRef.current = true;
      onEdgeTouchActiveChangeRef.current?.(true);
    }

    const cellWidth = width / 7;
    const cellHeight = height / currentWeeks.length;
    touchStartRef.current = {
      date,
      gridPoint: {
        x: column * cellWidth + event.nativeEvent.locationX,
        y: row * cellHeight + event.nativeEvent.locationY,
      },
      pagePoint: {
        x: event.nativeEvent.pageX,
        y: event.nativeEvent.pageY,
      },
    };
  };

  const gridPointFromEvent = (event: GestureResponderEvent): Point | null => {
    const start = touchStartRef.current;
    if (!start) return null;
    return {
      x: start.gridPoint.x + event.nativeEvent.pageX - start.pagePoint.x,
      // Keep date drags in the week where they began. Vertical finger drift
      // should neither select an adjacent week nor undo dates there.
      y: start.gridPoint.y,
    };
  };

  const clearGesture = () => {
    const wasDragging = gestureRef.current !== null;
    const wasEdgeTouch = edgeTouchActiveRef.current;
    touchStartRef.current = null;
    gestureRef.current = null;
    edgeTouchActiveRef.current = false;
    if (wasDragging) onDraggingChangeRef.current?.(false);
    if (wasEdgeTouch) onEdgeTouchActiveChangeRef.current?.(false);
  };

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

      <View
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          layoutRef.current = { width, height };
        }}
        onMoveShouldSetResponderCapture={(event) => {
          const start = touchStartRef.current;
          if (disabledRef.current || !start) return false;
          const dx = event.nativeEvent.pageX - start.pagePoint.x;
          return Math.abs(dx) > 4;
        }}
        onResponderGrant={(event) => {
          const start = touchStartRef.current;
          const current = gridPointFromEvent(event);
          if (!start || !current) return;
          if (beginGestureAt(start.gridPoint)) {
            onDraggingChangeRef.current?.(true);
            visitGestureAt(current);
          }
        }}
        onResponderMove={(event) => {
          const current = gridPointFromEvent(event);
          if (current) visitGestureAt(current);
        }}
        onResponderRelease={clearGesture}
        onResponderTerminate={clearGesture}
        onResponderTerminationRequest={() => false}
        onTouchCancel={clearGesture}
        onTouchEnd={clearGesture}
        testID="editable-period-grid">
        {weeks.map((week, weekIndex) => (
          <View
            key={weekIndex}
            style={{ flexDirection: 'row', height: rowHeight }}
            testID={`editable-period-week-${weekIndex}`}>
            {week.map((date) => {
              const dateMonth = date.slice(0, 7);
              const adjacentMonth = dateMonth < month
                ? 'previous'
                : dateMonth > month ? 'next' : null;
              return (
              <EditableDayCell
                key={date}
                date={date}
                today={today}
                selected={selected.has(date)}
                disabled={disabled
                  || !editableMonths.includes(dateMonth)
                  || !isSelectablePeriodDate(date, today)}
                adjacentMonth={adjacentMonth}
                onChangeDate={onChangeDate}
                onPressIn={(event) => rememberTouchStart(date, event)}
                appearance={appearance}
              />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

type EditableDayCellProps = {
  date: LocalDate;
  today: LocalDate;
  selected: boolean;
  disabled: boolean;
  adjacentMonth: 'previous' | 'next' | null;
  onChangeDate: (date: LocalDate, selected: boolean) => void;
  onPressIn: (event: GestureResponderEvent) => void;
  appearance: Appearance;
};

function EditableDayCell({
  date,
  today,
  selected,
  disabled,
  adjacentMonth,
  onChangeDate,
  onPressIn,
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
      accessibilityHint={
        disabled
          ? 'This date cannot be changed right now'
          : selected
            ? 'Removes this period date'
            : 'Adds this period date'
      }
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={() => onChangeDate(date, !selected)}
      onPressIn={onPressIn}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: colors.background,
        borderColor: colors.backgroundElement,
        borderWidth: 0.5,
        flex: 1,
        gap: Spacing.one,
        height: '100%',
        justifyContent: 'center',
        opacity: disabled
          ? 0.45
          : pressed ? 0.7 : adjacentMonth === 'next' ? 0.68 : 1,
        padding: Spacing.two,
      })}>
      <Text
        testID={`period-date-label-${date}`}
        style={{
          color: adjacentMonth === 'previous'
            ? PAST_MONTH_COLOR
            : adjacentMonth === 'next' ? colors.textSecondary
            : selected ? PERIOD_COLOR : colors.text,
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
          borderColor: adjacentMonth === 'previous'
            ? PAST_MONTH_COLOR
            : colors.textSecondary,
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
