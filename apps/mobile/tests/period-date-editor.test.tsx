import { expect, jest, test } from '@jest/globals';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { SymbolView } from 'expo-symbols';
import {
  BackHandler,
  Modal,
  type HardwareBackPressEvent,
} from 'react-native';

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
    loadDates: jest.fn(() => new Promise<string[]>(() => {})),
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

test('uses theme-aware native calendar and month arrow icons', () => {
  const props = setup();

  const icons = screen.UNSAFE_getAllByType(SymbolView);
  expect(icons.map((symbol) => symbol.props.name)).toEqual([
    { ios: 'calendar', android: 'calendar_today', web: 'calendar_today' },
    { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' },
    { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  ]);
  expect(icons.map((symbol) => symbol.props.size)).toEqual([16, 24, 24]);
  expect(icons.map((symbol) => symbol.props.weight))
    .toEqual(['regular', 'semibold', 'semibold']);
  expect(icons.map((symbol) => symbol.props.tintColor))
    .toEqual(Array(3).fill(props.appearance.colors.text));
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
  expect(props.onSave).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Remove and Save'));

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

test('removing a saved date requires confirmation and explains symptoms stay', () => {
  const props = setup();
  fireEvent.press(day(2));

  fireEvent.press(screen.getByText('Save Dates'));

  expect(screen.getByText('Remove saved period dates?')).toBeTruthy();
  expect(screen.getByText(/Symptoms recorded on those dates will stay/))
    .toBeTruthy();
  expect(props.onSave).not.toHaveBeenCalled();

  fireEvent.press(screen.getByText('Keep Dates'));

  expect(screen.queryByText('Remove saved period dates?')).toBeNull();
  expect(day(2).props.accessibilityState.selected).toBe(false);
  expect(props.onSave).not.toHaveBeenCalled();
});

test('closing removal confirmation returns to the draft without cancelling', () => {
  const props = setup();
  fireEvent.press(day(2));
  fireEvent.press(screen.getByText('Save Dates'));

  act(() => screen.UNSAFE_getByType(Modal).props.onRequestClose());

  expect(screen.queryByText('Remove saved period dates?')).toBeNull();
  expect(day(2).props.accessibilityState.selected).toBe(false);
  expect(props.onCancel).not.toHaveBeenCalled();
  expect(props.onSave).not.toHaveBeenCalled();
});

test('hardware Back discards through onCancel without saving', () => {
  let hardwareBack: ((event: HardwareBackPressEvent) => (
    boolean | null | undefined
  )) | undefined;
  const subscription = { remove: jest.fn() };
  const listener = jest.spyOn(BackHandler, 'addEventListener')
    .mockImplementation((_event, handler) => {
      hardwareBack = handler;
      return subscription;
    });
  const props = setup();
  fireEvent.press(day(2));

  expect(hardwareBack?.({
    type: 'hardwareBackPress',
    timeStamp: 0,
  })).toBe(true);

  expect(props.onCancel).toHaveBeenCalledTimes(1);
  expect(props.onSave).not.toHaveBeenCalled();
  listener.mockRestore();
});

test('a failed save retains the draft and shows the required message', async () => {
  const props = setup({
    onSave: jest.fn(async () => {
      throw new Error('demo failure');
    }),
  });
  fireEvent.press(day(2));

  fireEvent.press(screen.getByText('Save Dates'));
  fireEvent.press(screen.getByText('Remove and Save'));

  expect(await screen.findByText('Could not save dates. Try again.'))
    .toBeTruthy();
  expect(day(2).props.accessibilityState.selected).toBe(false);
  expect(props.onDone).not.toHaveBeenCalled();
});

test('a failed save can retry the same draft successfully', async () => {
  let attempts = 0;
  const props = setup({
    initialDates: [],
    onSave: jest.fn(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('demo failure');
    }),
  });
  fireEvent.press(day(4));

  fireEvent.press(screen.getByText('Save Dates'));
  expect(await screen.findByText('Could not save dates. Try again.'))
    .toBeTruthy();
  fireEvent.press(screen.getByText('Save Dates'));

  await waitFor(() => expect(props.onDone).toHaveBeenCalledTimes(1));
  expect(jest.mocked(props.onSave).mock.calls).toEqual([
    [{ add: ['2026-11-04'], remove: [] }],
    [{ add: ['2026-11-04'], remove: [] }],
  ]);
});

test('saving disables editing, navigation, cancel, and hardware Back', async () => {
  let hardwareBack: ((event: HardwareBackPressEvent) => (
    boolean | null | undefined
  )) | undefined;
  const subscription = { remove: jest.fn() };
  const listener = jest.spyOn(BackHandler, 'addEventListener')
    .mockImplementation((_event, handler) => {
      hardwareBack = handler;
      return subscription;
    });
  const pendingSave = deferred<void>();
  const props = setup({
    initialDates: [],
    onSave: jest.fn(() => pendingSave.promise),
  });
  fireEvent.press(day(4));
  fireEvent.press(screen.getByText('Save Dates'));

  expect(
    screen.getByRole('button', { name: 'Saving…' }).props.accessibilityState,
  )
    .toEqual({ busy: true, disabled: true });
  expect(
    screen.getByRole('button', { name: 'Cancel' }).props.accessibilityState
      .disabled,
  )
    .toBe(true);
  expect(day(5).props.accessibilityState.disabled).toBe(true);
  expect(screen.getByLabelText('Previous month').props.accessibilityState.disabled)
    .toBe(true);
  expect(hardwareBack?.({
    type: 'hardwareBackPress',
    timeStamp: 0,
  })).toBe(true);
  expect(props.onCancel).not.toHaveBeenCalled();

  await act(async () => {
    pendingSave.resolve(undefined);
    await pendingSave.promise;
  });
  listener.mockRestore();
});

test('repeated Save presses submit once and call onDone once', async () => {
  const pendingSave = deferred<void>();
  const props = setup({
    onSave: jest.fn(() => pendingSave.promise),
  });
  fireEvent.press(day(4));
  const saveButton = screen.getByText('Save Dates');

  fireEvent.press(saveButton);
  fireEvent.press(saveButton);

  expect(props.onSave).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Saving…')).toBeTruthy();

  await act(async () => {
    pendingSave.resolve(undefined);
    await pendingSave.promise;
  });

  await waitFor(() => expect(props.onDone).toHaveBeenCalledTimes(1));
  fireEvent.press(screen.getByText('Save Dates'));
  expect(props.onSave).toHaveBeenCalledTimes(1);
  expect(props.onDone).toHaveBeenCalledTimes(1);
});

test('a save resolving after unmount does not call onDone', async () => {
  const pendingSave = deferred<void>();
  const props: PeriodDateEditorProps = {
    initialDates: [],
    initialMonth: '2026-11',
    today: '2026-11-07',
    appearance: getAppearance(defaultSettings),
    loadDates: jest.fn(async () => []),
    onSave: jest.fn(() => pendingSave.promise),
    onDone: jest.fn(),
    onCancel: jest.fn(),
  };
  const view = render(<PeriodDateEditor {...props} />);
  fireEvent.press(day(4));
  fireEvent.press(screen.getByText('Save Dates'));

  view.unmount();
  await act(async () => {
    pendingSave.resolve(undefined);
    await pendingSave.promise;
  });

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

test('preloads the previous and next month around the visible month', async () => {
  const loadDates = jest.fn(async () => []);
  setup({ loadDates });

  await waitFor(() => {
    expect(loadDates).toHaveBeenCalledWith('2026-10-01', '2026-10-31');
    expect(loadDates).toHaveBeenCalledWith('2026-12-01', '2026-12-31');
  });
});

test('loaded adjacent dates can be removed from the visible month', async () => {
  const props = setup({
    initialDates: [],
    initialMonth: '2026-10',
    today: '2026-10-14',
    loadDates: jest.fn(async (from) => (
      from === '2026-09-01' ? ['2026-09-30'] : []
    )),
  });

  const september30 = await screen.findByLabelText(
    /September 30, 2026, selected/,
  );
  expect(september30.props.accessibilityState.disabled).toBe(false);
  fireEvent.press(september30);

  fireEvent.press(screen.getByText('Save Dates'));
  fireEvent.press(screen.getByText('Remove and Save'));
  await waitFor(() => expect(props.onSave).toHaveBeenCalledWith({
    add: [],
    remove: ['2026-09-30'],
  }));
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
  expect(jest.mocked(props.loadDates).mock.calls.filter(
    ([from]) => from === '2026-12-01',
  )).toHaveLength(1);

  fireEvent.press(screen.getByText('Save Dates'));
  fireEvent.press(screen.getByText('Remove and Save'));
  await waitFor(() => expect(props.onSave).toHaveBeenCalledWith({
    add: ['2026-12-04'],
    remove: ['2026-11-02'],
  }));
});

test('a failed month load keeps the grid disabled and Retry loads it again', async () => {
  let decemberAttempts = 0;
  const loadDates = jest.fn(async (from: string) => {
    if (from !== '2026-12-01') return [];
    decemberAttempts += 1;
    if (decemberAttempts < 3) throw new Error('demo read failure');
    return ['2026-12-02'];
  });
  setup({ today: '2026-12-31', loadDates });

  await act(async () => {
    await Promise.resolve();
  });
  fireEvent.press(screen.getByLabelText('Next month'));

  expect(await screen.findByText('Could not load dates. Try again.'))
    .toBeTruthy();
  const decemberSecond = screen.getByLabelText(/December 2, 2026/);
  expect(decemberSecond.props.accessibilityState.disabled).toBe(true);
  fireEvent.press(decemberSecond);

  fireEvent.press(screen.getByText('Retry'));

  await waitFor(() => {
    expect(jest.mocked(loadDates).mock.calls.filter(
      ([from]) => from === '2026-12-01',
    )).toHaveLength(3);
    expect(screen.getByLabelText(/December 2, 2026/).props.accessibilityState)
      .toEqual({ disabled: false, selected: true });
  });
});

test('a loaded month ignores malformed, out-of-range, and future dates', async () => {
  setup({
    today: '2026-12-05',
    loadDates: jest.fn(async () => [
      'not-a-date',
      '2026-11-30',
      '2026-12-02',
      '2026-12-20',
      '2027-01-01',
    ]),
  });

  fireEvent.press(screen.getByLabelText('Next month'));

  await waitFor(() => {
    expect(screen.getByLabelText(/December 2, 2026/).props.accessibilityState)
      .toEqual({ disabled: false, selected: true });
  });
  expect(screen.getByLabelText(/December 20, 2026/).props.accessibilityState)
    .toEqual({ disabled: true, selected: false });
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
  fireEvent(day(1), 'pressIn', {
    nativeEvent: {
      locationX: 25,
      locationY: 36,
      pageX: 125,
      pageY: 236,
    },
  });
  expect(screen.getByTestId('period-date-editor-scroll').props.scrollEnabled)
    .toBe(true);
  fireEvent(grid, 'responderGrant', {
    nativeEvent: { pageX: 175, pageY: 306 },
  });
  expect(screen.getByTestId('period-date-editor-scroll').props.scrollEnabled)
    .toBe(false);
  const movePoints = [
    { pageX: 225, pageY: 166 },
    { pageX: 275, pageY: 326 },
    { pageX: 325, pageY: 156 },
    { pageX: 375, pageY: 316 },
    { pageX: 425, pageY: 176 },
  ];
  for (const { pageX, pageY } of movePoints) {
    fireEvent(grid, 'responderMove', {
      nativeEvent: { pageX, pageY },
    });
  }
  fireEvent(grid, 'responderRelease', { nativeEvent: {} });
  expect(screen.getByTestId('period-date-editor-scroll').props.scrollEnabled)
    .toBe(true);

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
