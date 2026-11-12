import {
  MONTH_NAMES, WEEKDAY_NAMES, addDays, formatDate, parseDate, weekday, type CalendarDate,
} from '@/features/calendar/calendar-dates';
import type { LocalDate } from '@/features/health/health-types';

// the local calendar day one day before or after the given date
export function shiftDay(date: LocalDate, delta: -1 | 1): LocalDate {
  const parsed = parseDate(date);
  if (!parsed) throw new Error('Expected a YYYY-MM-DD date.');
  const next = addDays(parsed, delta);
  return formatDate(next, next.day);
}

export const isOnOrAfter = (date: LocalDate, other: LocalDate) => date >= other;

// example: Fri, Oct 30
export function shortDayTitle({ year, month, day }: CalendarDate): string {
  return `${WEEKDAY_NAMES[weekday(year, month, day)].slice(0, 3)}, ${MONTH_NAMES[month - 1].slice(0, 3)} ${day}`;
}
