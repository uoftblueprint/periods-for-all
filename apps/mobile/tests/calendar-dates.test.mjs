import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addMonths, buildMonthGrid, daysInMonth, describeDate, formatMonth, monthTitle, parseDate, parseMonth,
} from '../src/features/calendar/calendar-dates.ts';

test('October 2026 starts on Thursday and has 31 days', () => {
  const grid = buildMonthGrid({ year: 2026, month: 10 });
  assert.deepEqual(grid[0].slice(0, 5), [null, null, null, null, '2026-10-01']);
  assert.equal(grid.flat().filter(Boolean).length, 31);
  assert.ok(grid.every((week) => week.length === 7));
});

test('leap-year February', () => {
  assert.equal(daysInMonth({ year: 2028, month: 2 }), 29);
  assert.equal(daysInMonth({ year: 2027, month: 2 }), 28);
  assert.equal(daysInMonth({ year: 2100, month: 2 }), 28); // divisible by 100 but not 400
  assert.equal(daysInMonth({ year: 2000, month: 2 }), 29); // divisible by 400
  assert.equal(buildMonthGrid({ year: 2028, month: 2 })[0][2], '2028-02-01'); // starts on Tuesday
  assert.ok(buildMonthGrid({ year: 2028, month: 2 }).flat().includes('2028-02-29'));
});

test('December/January transitions', () => {
  assert.equal(formatMonth(addMonths({ year: 2026, month: 12 }, 1)), '2027-01');
  assert.equal(formatMonth(addMonths({ year: 2027, month: 1 }, -1)), '2026-12');
  assert.equal(buildMonthGrid({ year: 2027, month: 1 })[0][5], '2027-01-01'); // Friday
});

test('invalid inputs fail safely', () => {
  for (const value of ['2026-13', '2026-00', '2026-1', 'abc', '']) assert.equal(parseMonth(value), null);
  for (const value of ['2027-02-29', '2026-10-32', '2026-10-1', 'abc', '']) assert.equal(parseDate(value), null);
  assert.deepEqual(parseDate('2028-02-29'), { year: 2028, month: 2, day: 29 });
});

test('labels use local calendar dates', () => {
  assert.equal(monthTitle({ year: 2026, month: 10 }), 'October 2026');
  assert.equal(describeDate({ year: 2026, month: 10, day: 14 }), 'Wednesday, October 14, 2026');
});
