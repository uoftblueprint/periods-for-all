import { expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import {
  EditablePeriodMonthGrid,
  type EditablePeriodMonthGridProps,
} from '@/features/calendar/editable-period-month-grid';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings } from '@/foundation/contracts';

function setup(overrides: Partial<EditablePeriodMonthGridProps> = {}) {
  const props: EditablePeriodMonthGridProps = {
    month: '2026-11',
    today: '2026-11-07',
    selectedDates: ['2026-11-01', '2026-11-02', '2026-11-03'],
    onChangeDate: jest.fn(),
    appearance: getAppearance(defaultSettings),
    ...overrides,
  };
  render(<EditablePeriodMonthGrid {...props} />);
  return props;
}

const day = (date: number) => screen.getByLabelText(
  new RegExp(`November ${date}, 2026`),
);

test('tapping an empty date requests selection', () => {
  const props = setup();

  fireEvent.press(day(4));

  expect(props.onChangeDate).toHaveBeenCalledWith('2026-11-04', true);
});

test('tapping a selected date requests removal', () => {
  const props = setup();

  fireEvent.press(day(2));

  expect(props.onChangeDate).toHaveBeenCalledWith('2026-11-02', false);
});

test('date labels and state announce whether the date is selected', () => {
  setup();

  expect(day(2).props.accessibilityLabel).toContain(
    'Monday, November 2, 2026, selected',
  );
  expect(day(4).props.accessibilityLabel).toContain(
    'Wednesday, November 4, 2026, not selected',
  );
  expect(day(2).props.accessibilityState).toEqual({
    disabled: false,
    selected: true,
  });
});

test('future dates are disabled and cannot be selected', () => {
  const props = setup();

  fireEvent.press(day(8));

  expect(day(8).props.accessibilityState).toEqual({
    disabled: true,
    selected: false,
  });
  expect(props.onChangeDate).not.toHaveBeenCalled();
});

test('the whole grid can be disabled while its month is unavailable', () => {
  const props = setup({ disabled: true });

  fireEvent.press(day(4));

  expect(day(4).props.accessibilityState.disabled).toBe(true);
  expect(props.onChangeDate).not.toHaveBeenCalled();
});

test('dragging across dates applies the first date action once per day', () => {
  const props = setup({
    selectedDates: [],
    today: '2026-11-30',
  });
  const grid = screen.getByTestId('editable-period-grid');
  fireEvent(grid, 'layout', {
    nativeEvent: { layout: { height: 360, width: 350 } },
  });
  fireEvent(grid, 'touchStart', {
    nativeEvent: { locationX: 25, locationY: 36 },
  });
  fireEvent(grid, 'responderGrant', {
    nativeEvent: { locationX: 75, locationY: 36 },
  });
  fireEvent(grid, 'responderMove', {
    nativeEvent: { locationX: 125, locationY: 36 },
  });
  fireEvent(grid, 'responderMove', {
    nativeEvent: { locationX: 175, locationY: 36 },
  });
  fireEvent(grid, 'responderMove', {
    nativeEvent: { locationX: 75, locationY: 36 },
  });
  fireEvent(grid, 'responderRelease', { nativeEvent: {} });

  expect(jest.mocked(props.onChangeDate).mock.calls).toEqual([
    ['2026-11-01', true],
    ['2026-11-02', true],
    ['2026-11-03', true],
    ['2026-11-04', true],
  ]);
});

test('a drag beginning on a selected date consistently removes dates', () => {
  const props = setup({
    selectedDates: [
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
    ],
    today: '2026-11-30',
  });
  const grid = screen.getByTestId('editable-period-grid');
  fireEvent(grid, 'layout', {
    nativeEvent: { layout: { height: 360, width: 350 } },
  });
  fireEvent(grid, 'touchStart', {
    nativeEvent: { locationX: 25, locationY: 36 },
  });
  fireEvent(grid, 'responderGrant', {
    nativeEvent: { locationX: 75, locationY: 36 },
  });
  fireEvent(grid, 'responderMove', {
    nativeEvent: { locationX: 125, locationY: 36 },
  });

  expect(jest.mocked(props.onChangeDate).mock.calls).toEqual([
    ['2026-11-01', false],
    ['2026-11-02', false],
    ['2026-11-03', false],
  ]);
});

test('dragging ignores future dates', () => {
  const props = setup({
    selectedDates: [],
    today: '2026-11-03',
  });
  const grid = screen.getByTestId('editable-period-grid');
  fireEvent(grid, 'layout', {
    nativeEvent: { layout: { height: 360, width: 350 } },
  });
  fireEvent(grid, 'touchStart', {
    nativeEvent: { locationX: 75, locationY: 36 },
  });
  fireEvent(grid, 'responderGrant', {
    nativeEvent: { locationX: 125, locationY: 36 },
  });
  fireEvent(grid, 'responderMove', {
    nativeEvent: { locationX: 175, locationY: 36 },
  });

  expect(jest.mocked(props.onChangeDate).mock.calls).toEqual([
    ['2026-11-02', true],
    ['2026-11-03', true],
  ]);
});

test('selected dates use the Figma period marker asset', () => {
  setup();

  expect(screen.getByTestId('period-date-marker-2026-11-02').children)
    .toHaveLength(1);
  expect(screen.getByTestId('period-date-marker-2026-11-04').children)
    .toHaveLength(0);
});

test('an invalid month fails safely', () => {
  setup({ month: '2026-13' });

  expect(screen.getByText("This month can't be edited.")).toBeTruthy();
  expect(screen.queryByLabelText(/November/)).toBeNull();
});
