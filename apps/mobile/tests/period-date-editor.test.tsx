import { expect, jest, test } from '@jest/globals';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, reject, resolve };
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
    .toBe(false);
  expect(screen.getByLabelText('Previous month').props.accessibilityState.disabled)
    .toBe(false);
  expect(screen.getByLabelText('Next month').props.accessibilityState.disabled)
    .toBe(false);
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

test('a newly visited month loads before its dates can be edited', async () => {
  const december = deferred<string[]>();
  const loadDates = jest.fn(() => december.promise);
  setup({
    today: '2026-12-31',
    loadDates,
  });

  fireEvent.press(screen.getByLabelText('Next month'));

  expect(screen.getByText('December 2026')).toBeTruthy();
  expect(screen.getByText('Loading dates…')).toBeTruthy();
  expect(loadDates).toHaveBeenCalledWith('2026-12-01', '2026-12-31');
  expect(screen.getByLabelText(/December 2, 2026/).props.accessibilityState.disabled)
    .toBe(true);

  await act(async () => {
    december.resolve(['2026-12-02']);
    await december.promise;
  });

  await waitFor(() => {
    expect(screen.queryByText('Loading dates…')).toBeNull();
    expect(screen.getByLabelText(/December 2, 2026/).props.accessibilityState)
      .toEqual({ disabled: false, selected: true });
  });
});

test('draft changes survive month navigation and loaded months are cached', async () => {
  const props = setup({
    today: '2026-12-31',
    loadDates: jest.fn(async () => ['2026-12-03']),
  });
  fireEvent.press(day(2));

  fireEvent.press(screen.getByLabelText('Next month'));
  await screen.findByLabelText(/December 3, 2026, selected/);
  fireEvent.press(screen.getByLabelText(/December 4, 2026/));
  fireEvent.press(screen.getByLabelText('Previous month'));

  expect(day(2).props.accessibilityState.selected).toBe(false);
  expect(props.loadDates).toHaveBeenCalledTimes(1);

  fireEvent.press(screen.getByText('Save Dates'));
  await waitFor(() => expect(props.onSave).toHaveBeenCalledWith({
    add: ['2026-12-04'],
    remove: ['2026-11-02'],
  }));
});

test('a failed month load keeps the grid disabled and Retry loads it again', async () => {
  let attempts = 0;
  const loadDates = jest.fn(async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('demo read failure');
    return ['2026-12-02'];
  });
  setup({ today: '2026-12-31', loadDates });

  fireEvent.press(screen.getByLabelText('Next month'));

  expect(await screen.findByText('Could not load dates. Try again.'))
    .toBeTruthy();
  const decemberSecond = screen.getByLabelText(/December 2, 2026/);
  expect(decemberSecond.props.accessibilityState.disabled).toBe(true);
  fireEvent.press(decemberSecond);

  fireEvent.press(screen.getByText('Retry'));

  await waitFor(() => {
    expect(loadDates).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText(/December 2, 2026/).props.accessibilityState)
      .toEqual({ disabled: false, selected: true });
  });
});

test('Today loads the supplied current month using local calendar dates', async () => {
  const props = setup({
    today: '2027-01-15',
    loadDates: jest.fn(async () => []),
  });

  fireEvent.press(screen.getByLabelText('Go to today'));

  expect(await screen.findByText('January 2027')).toBeTruthy();
  expect(props.loadDates).toHaveBeenCalledWith('2027-01-01', '2027-01-31');
});

test('next month crosses December into January', async () => {
  const props = setup({
    initialDates: [],
    initialMonth: '2026-12',
    today: '2027-01-31',
    loadDates: jest.fn(async () => []),
  });

  fireEvent.press(screen.getByLabelText('Next month'));

  expect(await screen.findByText('January 2027')).toBeTruthy();
  expect(props.loadDates).toHaveBeenCalledWith('2027-01-01', '2027-01-31');
});

test('dragging across a week adds each visited date to the draft once', async () => {
  const props = setup({
    initialDates: [],
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
  for (const locationX of [125, 175, 225, 275, 325, 25]) {
    fireEvent(grid, 'responderMove', {
      nativeEvent: { locationX, locationY: 36 },
    });
  }
  fireEvent(grid, 'responderRelease', { nativeEvent: {} });

  fireEvent.press(screen.getByText('Save Dates'));

  await waitFor(() => expect(props.onSave).toHaveBeenCalledWith({
    add: [
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
    ],
    remove: [],
  }));
});
