import { expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { MonthCalendar, type MonthCalendarProps } from '@/features/calendar/month-calendar';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings } from '@/foundation/contracts';

const october = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'];

function setup(overrides: Partial<MonthCalendarProps> = {}) {
  const props: MonthCalendarProps = {
    month: '2026-10',
    selectedDate: '2026-10-14',
    today: '2026-10-14',
    periodDates: october,
    onSelectDate: jest.fn(),
    onChangeMonth: jest.fn(),
    onEditPeriodDates: jest.fn(),
    appearance: getAppearance(defaultSettings),
    ...overrides,
  };
  const view = render(<MonthCalendar {...props} />);
  return { props, view };
}

const day = (n: number) => screen.getByLabelText(new RegExp(`October ${n}, 2026`));

test('tapping a date reports its full local date', () => {
  const { props } = setup();
  fireEvent.press(day(20));
  expect(props.onSelectDate).toHaveBeenCalledWith('2026-10-20');
});

test('period marking stays on Oct 5–9 when the selection changes', () => {
  const { props, view } = setup();
  view.rerender(<MonthCalendar {...props} selectedDate="2026-10-20" />);
  for (const n of [5, 6, 7, 8, 9]) expect(day(n).props.accessibilityLabel).toContain('period day');
  for (const n of [4, 10, 14, 20]) expect(day(n).props.accessibilityLabel).not.toContain('period day');
  expect(day(20).props.accessibilityLabel).toContain('selected');
  expect(day(14).props.accessibilityLabel).toContain('today');
  expect(day(14).props.accessibilityLabel).not.toContain('selected');
});

test('next month from December reports January without selecting a date', () => {
  const { props } = setup({ month: '2026-12' });
  fireEvent.press(screen.getByLabelText('Next month'));
  expect(props.onChangeMonth).toHaveBeenCalledWith('2027-01');
  expect(props.onSelectDate).not.toHaveBeenCalled();
});

test("Today jumps to today's month and selects today", () => {
  const { props } = setup({ month: '2026-12', selectedDate: null });
  fireEvent.press(screen.getByLabelText('Go to today'));
  expect(props.onChangeMonth).toHaveBeenCalledWith('2026-10');
  expect(props.onSelectDate).toHaveBeenCalledWith('2026-10-14');
});

test('Edit Period Dates calls the supplied callback', () => {
  const { props } = setup();
  fireEvent.press(screen.getByText('Edit Period Dates'));
  expect(props.onEditPeriodDates).toHaveBeenCalledTimes(1);
});

test('an invalid month fails safely instead of drawing a grid', () => {
  setup({ month: '2026-13' });
  expect(screen.getByText("This month can't be shown.")).toBeTruthy();
  expect(screen.queryByLabelText(/2026/)).toBeNull();
});
