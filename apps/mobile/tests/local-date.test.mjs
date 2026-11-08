import assert from 'node:assert/strict';
import test from 'node:test';
import { isOnOrAfter, shiftDay, shortDayTitle } from '../src/features/health/local-date.ts';

for (const [from, delta, expected] of [
  ['2026-11-07', 1, '2026-11-08'],
  ['2026-11-07', -1, '2026-11-06'],
  ['2026-11-30', 1, '2026-12-01'],
  ['2026-12-31', 1, '2027-01-01'],
  ['2027-01-01', -1, '2026-12-31'],
  ['2028-02-28', 1, '2028-02-29'],
  ['2027-03-01', -1, '2027-02-28'],
  // Toronto daylight-saving changes: still exactly one calendar day.
  ['2026-11-01', 1, '2026-11-02'],
  ['2027-03-14', -1, '2027-03-13'],
]) {
  test(`${from} ${delta > 0 ? '+' : ''}${delta} day is ${expected}`, () => {
    assert.equal(shiftDay(from, delta), expected);
  });
}

test('an invalid date throws instead of guessing', () => {
  assert.throws(() => shiftDay('2027-02-29', 1));
});

test('isOnOrAfter compares calendar days', () => {
  assert.equal(isOnOrAfter('2026-11-07', '2026-11-07'), true);
  assert.equal(isOnOrAfter('2026-11-06', '2026-11-07'), false);
  assert.equal(isOnOrAfter('2026-12-01', '2026-11-30'), true);
});

test('shortDayTitle matches the Figma header format', () => {
  assert.equal(shortDayTitle({ year: 2026, month: 10, day: 30 }), 'Fri, Oct 30');
  assert.equal(shortDayTitle({ year: 2026, month: 11, day: 7 }), 'Sat, Nov 7');
});
