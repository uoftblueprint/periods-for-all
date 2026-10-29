// Pure date helpers for the month calendar.
// Everything works on plain year/month/day numbers. We never call `new Date('YYYY-MM-DD')`:
// it parses the string as midnight UTC, which is still the previous evening in Toronto,
// so the calendar would show the wrong day.

export type YearMonth = { year: number; month: number }; // month is 1–12
export type CalendarDate = YearMonth & { day: number };

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export const WEEKDAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;

const pad = (n: number) => String(n).padStart(2, '0');

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth({ year, month }: YearMonth): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/** 'YYYY-MM' → { year, month }, or null if it isn't a real month. */
export function parseMonth(value: string): YearMonth | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? { year, month } : null;
}

/** 'YYYY-MM-DD' → parts, or null if it isn't a real calendar date (e.g. 2027-02-29). */
export function parseDate(value: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const ym = parseMonth(`${match[1]}-${match[2]}`);
  const day = Number(match[3]);
  return ym && day >= 1 && day <= daysInMonth(ym) ? { ...ym, day } : null;
}

export const formatMonth = ({ year, month }: YearMonth) => `${year}-${pad(month)}`;
export const formatDate = (ym: YearMonth, day: number) => `${formatMonth(ym)}-${pad(day)}`;

/** Day of the week, 0 = Sunday … 6 = Saturday (Sakamoto's method, no Date objects). */
export function weekday(year: number, month: number, day: number): number {
  const offsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const y = month < 3 ? year - 1 : year;
  return (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + offsets[month - 1] + day) % 7;
}

/** Shifts a month by `delta` months, handling December ↔ January. */
export function addMonths(value: YearMonth, delta: number): YearMonth {
  // Count months since year 0, shift, then split back into year and month.
  const index = value.year * 12 + (value.month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** The calendar date one day before (-1) or after (+1), crossing month and year edges. */
export function addDays(date: CalendarDate, delta: -1 | 1): CalendarDate {
  if (delta === -1 && date.day === 1) {
    const prev = addMonths(date, -1);
    return { ...prev, day: daysInMonth(prev) };
  }
  if (delta === 1 && date.day === daysInMonth(date)) {
    return { ...addMonths(date, 1), day: 1 };
  }
  return { ...date, day: date.day + delta };
}

/** Sunday-first weeks for the month; null cells are blanks before the 1st / after the last day. */
export function buildMonthGrid(ym: YearMonth): (string | null)[][] {
  const cells: (string | null)[] = Array(weekday(ym.year, ym.month, 1)).fill(null);
  for (let day = 1; day <= daysInMonth(ym); day++) cells.push(formatDate(ym, day));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** 'October 2026' */
export const monthTitle = ({ year, month }: YearMonth) => `${MONTH_NAMES[month - 1]} ${year}`;

/** 'Wednesday, October 14, 2026' — the start of a day's screen-reader label. */
export function describeDate({ year, month, day }: CalendarDate): string {
  return `${WEEKDAY_NAMES[weekday(year, month, day)]}, ${MONTH_NAMES[month - 1]} ${day}, ${year}`;
}
