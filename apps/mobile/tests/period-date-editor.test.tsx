import { expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import {
  PeriodDateEditor,
  type PeriodDateEditorProps,
} from '@/features/calendar/period-date-editor';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings } from '@/foundation/contracts';

function setup(overrides: Partial<PeriodDateEditorProps> = {}) {
  const props: PeriodDateEditorProps = {
    initialDates: ['2026-11-01', '2026-11-02', '2026-11-03'],
    initialMonth: '2026-11',
    today: '2026-11-07',
    appearance: getAppearance(defaultSettings),
    loadDates: jest.fn(async () => []),
    onSave: jest.fn(async () => {}),
    onDone: jest.fn(),
    onCancel: jest.fn(),
    ...overrides,
  };
  render(<PeriodDateEditor {...props} />);
  return props;
}

const day = (date: number) => screen.getByLabelText(
  new RegExp(`November ${date}, 2026`),
);

test('renders the Figma editor shell for the supplied month', () => {
  setup();

  expect(screen.getByText('Track Period')).toBeTruthy();
  expect(screen.getByText('November 2026')).toBeTruthy();
  expect(screen.getByText('Cancel')).toBeTruthy();
  expect(screen.getByText('Save Dates')).toBeTruthy();
  expect(screen.getByLabelText('Go to today').props.accessibilityState.disabled)
    .toBe(true);
  expect(screen.getByLabelText('Previous month').props.accessibilityState.disabled)
    .toBe(true);
  expect(screen.getByLabelText('Next month').props.accessibilityState.disabled)
    .toBe(true);
});

test('editing dates updates the draft without mutating the supplied dates', () => {
  const initialDates = ['2026-11-01', '2026-11-02', '2026-11-03'];
  setup({ initialDates });

  fireEvent.press(day(2));
  fireEvent.press(day(4));

  expect(day(2).props.accessibilityState.selected).toBe(false);
  expect(day(4).props.accessibilityState.selected).toBe(true);
  expect(initialDates).toEqual([
    '2026-11-01',
    '2026-11-02',
    '2026-11-03',
  ]);
});

test('Save Dates sends only the draft difference and calls onDone', async () => {
  const props = setup();
  fireEvent.press(day(2));
  fireEvent.press(day(4));

  fireEvent.press(screen.getByText('Save Dates'));

  await waitFor(() => expect(props.onSave).toHaveBeenCalledWith({
    add: ['2026-11-04'],
    remove: ['2026-11-02'],
  }));
  expect(props.onDone).toHaveBeenCalledTimes(1);
});

test('Cancel discards through onCancel without saving', () => {
  const props = setup();
  fireEvent.press(day(2));

  fireEvent.press(screen.getByText('Cancel'));

  expect(props.onCancel).toHaveBeenCalledTimes(1);
  expect(props.onSave).not.toHaveBeenCalled();
});

test('a failed save retains the draft and shows the required message', async () => {
  const props = setup({
    onSave: jest.fn(async () => {
      throw new Error('demo failure');
    }),
  });
  fireEvent.press(day(2));

  fireEvent.press(screen.getByText('Save Dates'));

  expect(await screen.findByText('Could not save dates. Try again.'))
    .toBeTruthy();
  expect(day(2).props.accessibilityState.selected).toBe(false);
  expect(props.onDone).not.toHaveBeenCalled();
});
