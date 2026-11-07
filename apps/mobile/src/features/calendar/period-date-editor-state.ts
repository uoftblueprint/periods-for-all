import {
  daysInMonth,
  formatDate,
  parseDate,
  parseMonth,
} from '@/features/calendar/calendar-dates';

import type { LocalDate } from '@/features/health/contracts';

export type DraftOverrides = ReadonlyMap<LocalDate, boolean>;

export type PeriodDateChange = {
  add: LocalDate[];
  remove: LocalDate[];
};

export type DateSelectionGesture = {
  selecting: boolean;
  visited: ReadonlySet<LocalDate>;
};

export type GestureVisit = {
  gesture: DateSelectionGesture;
  shouldApply: boolean;
};

/** Returns the inclusive first and last local dates for a valid YYYY-MM month. */
export function getMonthRange(
  month: string,
): { from: LocalDate; to: LocalDate } | null {
  const parsed = parseMonth(month);
  if (!parsed) return null;

  return {
    from: formatDate(parsed, 1),
    to: formatDate(parsed, daysInMonth(parsed)),
  };
}

/** Invalid and future dates cannot be recorded as period days. */
export function isSelectablePeriodDate(
  date: LocalDate,
  today: LocalDate,
): boolean {
  return parseDate(date) !== null
    && parseDate(today) !== null
    && date <= today;
}

/** Reads a draft override when present, otherwise falls back to the saved value. */
export function isDraftDateSelected(
  savedDates: ReadonlySet<LocalDate>,
  overrides: DraftOverrides,
  date: LocalDate,
): boolean {
  return overrides.get(date) ?? savedDates.has(date);
}

/**
 * Sets one draft value without mutating its inputs. Values matching the saved
 * baseline are removed from the override map so unchanged dates are not saved.
 */
export function setDraftDateSelected(
  savedDates: ReadonlySet<LocalDate>,
  overrides: DraftOverrides,
  date: LocalDate,
  selected: boolean,
): Map<LocalDate, boolean> {
  const next = new Map(overrides);

  if (selected === savedDates.has(date)) {
    next.delete(date);
  } else {
    next.set(date, selected);
  }

  return next;
}

export function toggleDraftDate(
  savedDates: ReadonlySet<LocalDate>,
  overrides: DraftOverrides,
  date: LocalDate,
): Map<LocalDate, boolean> {
  return setDraftDateSelected(
    savedDates,
    overrides,
    date,
    !isDraftDateSelected(savedDates, overrides, date),
  );
}

/** Produces the minimal, deterministic change sent to HealthStore. */
export function getPeriodDateChange(
  savedDates: ReadonlySet<LocalDate>,
  overrides: DraftOverrides,
): PeriodDateChange {
  const add: LocalDate[] = [];
  const remove: LocalDate[] = [];

  for (const [date, selected] of overrides) {
    if (selected && !savedDates.has(date)) add.push(date);
    if (!selected && savedDates.has(date)) remove.push(date);
  }

  return { add: add.sort(), remove: remove.sort() };
}

/** The first visited date decides whether the whole gesture adds or removes. */
export function beginDateSelectionGesture(
  date: LocalDate,
  isSelected: boolean,
): DateSelectionGesture {
  return {
    selecting: !isSelected,
    visited: new Set([date]),
  };
}

/** Records a newly visited date. Revisiting one never applies the action twice. */
export function visitDateSelectionGesture(
  gesture: DateSelectionGesture,
  date: LocalDate,
): GestureVisit {
  if (gesture.visited.has(date)) {
    return { gesture, shouldApply: false };
  }

  return {
    gesture: {
      ...gesture,
      visited: new Set([...gesture.visited, date]),
    },
    shouldApply: true,
  };
}
