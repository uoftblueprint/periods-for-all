import { expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import {
  DailyLogScreen, type DailyLogScreenProps,
} from '@/features/health/daily-log-screen';
import type { DailyLog, HealthStore } from '@/features/health/contracts';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings } from '@/foundation/contracts';

const TODAY = '2026-11-07';
const blank = (date: string): DailyLog => ({
  date, mood: null, flow: null, physicalSymptoms: null, emotionalSymptoms: null, reflection: null,
});
const filled: DailyLog = {
  date: '2026-11-06', mood: 'happy', flow: 'light',
  physicalSymptoms: ['menstrualCramps'], emotionalSymptoms: [], reflection: 'Went for a walk.',
};

function createStore(overrides: Partial<HealthStore> = {}) {
  return {
    getDailyLog: jest.fn<HealthStore['getDailyLog']>(async (date) => (date === filled.date ? filled : blank(date))),
    patchDailyLog: jest.fn<HealthStore['patchDailyLog']>(async (date, patch) => ({ ...blank(date), ...patch })),
    getPeriodDays: jest.fn<HealthStore['getPeriodDays']>(async () => []),
    updatePeriodDays: jest.fn<HealthStore['updatePeriodDays']>(async () => {}),
    getPeriodSetup: jest.fn<HealthStore['getPeriodSetup']>(async () => ({
      lastPeriodStart: null, cycleLength: null, periodLength: null, step: 'intro' as const,
    })),
    savePeriodSetup: jest.fn<HealthStore['savePeriodSetup']>(async () => {}),
    ...overrides,
  };
}

function setup(overrides: Partial<DailyLogScreenProps> = {}) {
  const props: DailyLogScreenProps = {
    date: TODAY,
    today: TODAY,
    store: createStore(),
    appearance: getAppearance(defaultSettings),
    onDateChange: jest.fn(),
    onExit: jest.fn(),
    ...overrides,
  };
  const view = render(<DailyLogScreen {...props} />);
  const rerender = (next: Partial<DailyLogScreenProps>) => view.rerender(<DailyLogScreen {...props} {...next} />);
  return { ...props, rerender };
}

// S3-05 buttons report `selected`; S3-04's mood/flow radios report `checked`.
const selected = (label: string) => {
  const state = screen.getByLabelText(label).props.accessibilityState;
  return Boolean(state?.selected ?? state?.checked);
};
// S3-05's picker labels "No symptoms" the same in both sections: physical first, then emotional.
const noSymptoms = (section: 'physical' | 'emotional') =>
  screen.getAllByLabelText('No symptoms')[section === 'physical' ? 0 : 1].props.accessibilityState?.selected;

test('an empty day loads blank and saves nothing', async () => {
  const props = setup();
  expect(await screen.findByLabelText('Happy')).toBeTruthy();
  expect(selected('Happy')).toBe(false);
  expect(screen.getByLabelText('Daily Reflection').props.value).toBe('');
  expect(props.store.patchDailyLog).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: /save/i })).toBeNull();
});

test('a filled day shows its saved answers', async () => {
  setup({ date: filled.date });
  expect(await screen.findByLabelText('Daily Reflection')).toHaveProp('value', 'Went for a walk.');
  expect(selected('Happy')).toBe(true);
  expect(selected('Light')).toBe(true);
  expect(selected('Menstrual Cramps')).toBe(true);
  expect(noSymptoms('emotional')).toBe(true);
});

test('tapping a choice saves only that field, then shows Saved', async () => {
  const props = setup({ date: filled.date });
  fireEvent.press(await screen.findByLabelText('Sad'));
  expect(props.store.patchDailyLog).toHaveBeenCalledWith(filled.date, { mood: 'sad' });
  expect(await screen.findByText('Saved')).toBeTruthy();
  // Unrelated answers are untouched.
  expect(selected('Light')).toBe(true);
  expect(selected('Menstrual Cramps')).toBe(true);
  expect(noSymptoms('emotional')).toBe(true);
  expect(screen.getByLabelText('Daily Reflection').props.value).toBe('Went for a walk.');
});

test('a failed load offers Try again', async () => {
  const getDailyLog = jest.fn<HealthStore['getDailyLog']>()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(blank(TODAY));
  setup({ store: createStore({ getDailyLog }) });
  expect(await screen.findByText('Could not load this day.')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Try again'));
  expect(await screen.findByLabelText('Happy')).toBeTruthy();
});

test('today shows "Today · Sat, Nov 7" and next is disabled', async () => {
  setup();
  await screen.findByLabelText('Happy');
  expect(screen.getByRole('header', { name: 'Today, Saturday, November 7, 2026' })).toBeTruthy();
  expect(screen.getByText('Sat, Nov 7')).toBeTruthy();
  expect(screen.getByLabelText('Next day').props.accessibilityState?.disabled).toBe(true);
});

test('another day hides "Today" and moves exactly one day', async () => {
  const props = setup({ date: '2026-11-30', today: '2026-12-05' });
  await screen.findByLabelText('Happy');
  expect(screen.getByRole('header', { name: 'Monday, November 30, 2026' })).toBeTruthy();
  expect(screen.getByText('Mon, Nov 30')).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByLabelText('Next day')));
  expect(props.onDateChange).toHaveBeenCalledWith('2026-12-01');
});

test('a failed save stops navigation, keeps the draft and offers Retry or Stay', async () => {
  const patchDailyLog = jest.fn<HealthStore['patchDailyLog']>().mockRejectedValue(new Error('offline'));
  const props = setup({ store: createStore({ patchDailyLog }) });
  fireEvent.press(await screen.findByLabelText('Heavy'));
  expect(await screen.findByText('Could not save')).toBeTruthy();

  await act(async () => fireEvent.press(screen.getByLabelText('Previous day')));
  expect(props.onDateChange).not.toHaveBeenCalled();
  expect(screen.getByText('Not saved yet')).toBeTruthy();
  expect(screen.queryByText('Could not save')).toBeNull();
  expect(screen.queryByLabelText('Try again')).toBeNull();
  expect(selected('Heavy')).toBe(true);

  patchDailyLog.mockImplementation(async (date, patch) => ({ ...blank(date), ...patch }));
  await act(async () => fireEvent.press(screen.getByLabelText('Retry')));
  expect(patchDailyLog).toHaveBeenLastCalledWith(TODAY, { flow: 'heavy' });
  expect(props.onDateChange).toHaveBeenCalledWith('2026-11-06');
});

test('Stay keeps the user on the day with their draft', async () => {
  const patchDailyLog = jest.fn<HealthStore['patchDailyLog']>().mockRejectedValue(new Error('offline'));
  const props = setup({ store: createStore({ patchDailyLog }) });
  fireEvent.press(await screen.findByLabelText('Neutral'));
  await act(async () => fireEvent.press(screen.getByLabelText('Done')));
  fireEvent.press(screen.getByLabelText('Stay'));
  expect(props.onExit).not.toHaveBeenCalled();
  expect(screen.queryByText('Not saved yet')).toBeNull();
  expect(screen.getByText('Could not save')).toBeTruthy(); // the status line comes back
  expect(selected('Neutral')).toBe(true);
});

test('leaving the reflection saves it, and clearing it saves null', async () => {
  const props = setup({ date: filled.date });
  const input = await screen.findByLabelText('Daily Reflection');
  fireEvent.changeText(input, '');
  fireEvent(input, 'blur');
  expect(props.store.patchDailyLog).toHaveBeenCalledWith(filled.date, { reflection: null });
  expect(await screen.findByText('Saved')).toBeTruthy();
});

test('Done finishes pending saves before calling onExit', async () => {
  const props = setup();
  const input = await screen.findByLabelText('Daily Reflection');
  fireEvent.changeText(input, 'Short note');
  await act(async () => fireEvent.press(screen.getByLabelText('Done')));
  expect(props.store.patchDailyLog).toHaveBeenCalledWith(TODAY, { reflection: 'Short note' });
  expect(props.onExit).toHaveBeenCalledTimes(1);
});

test("moving to another day never sends one day's answers to the other", async () => {
  const store = createStore();
  const props = setup({ store });
  fireEvent.press(await screen.findByLabelText('Neutral'));
  fireEvent.changeText(screen.getByLabelText('Daily Reflection'), 'Today only');
  await act(async () => fireEvent.press(screen.getByLabelText('Previous day')));
  expect(props.onDateChange).toHaveBeenCalledWith(filled.date);

  props.rerender({ date: filled.date });
  expect(await screen.findByLabelText('Daily Reflection')).toHaveProp('value', 'Went for a walk.');
  fireEvent.press(screen.getByLabelText('Heavy'));
  await screen.findByText('Saved');

  expect(jest.mocked(store.patchDailyLog).mock.calls).toEqual([
    [TODAY, { mood: 'neutral' }],
    [TODAY, { reflection: 'Today only' }],
    [filled.date, { flow: 'heavy' }],
  ]);
});

test('a slow load for an older date never replaces the newer day', async () => {
  let finishOldLoad!: (log: DailyLog) => void;
  const getDailyLog = jest.fn<HealthStore['getDailyLog']>((date) =>
    date === filled.date
      ? new Promise<DailyLog>((resolve) => { finishOldLoad = resolve; })
      : Promise.resolve(blank(date)),
  );
  const props = setup({ date: filled.date, store: createStore({ getDailyLog }) });
  props.rerender({ date: TODAY });
  expect(await screen.findByLabelText('Happy')).toBeTruthy();

  await act(async () => finishOldLoad(filled)); // the answers arrive late
  expect(selected('Happy')).toBe(false);
  expect(screen.getByLabelText('Daily Reflection').props.value).toBe('');
  fireEvent.press(screen.getByLabelText('Sad'));
  expect(props.store.patchDailyLog).toHaveBeenCalledWith(TODAY, { mood: 'sad' });
  expect(await screen.findByText('Saved')).toBeTruthy();
});

// The S3-08 route calls the registered guard before header Back / swipe back.
function setupWithGuard(overrides: Partial<DailyLogScreenProps> = {}) {
  let guard: (() => Promise<boolean>) | null = null;
  const unregister = jest.fn();
  const registerExitGuard = jest.fn((next: () => Promise<boolean>) => {
    guard = next;
    return unregister;
  });
  const props = setup({ registerExitGuard, ...overrides });
  return { props, unregister, runGuard: () => guard!() };
}

test('the exit guard saves pending text, then lets the route leave', async () => {
  const { props, runGuard } = setupWithGuard();
  fireEvent.changeText(await screen.findByLabelText('Daily Reflection'), 'Before the back gesture');
  let result: boolean | undefined;
  await act(async () => { result = await runGuard(); });
  expect(props.store.patchDailyLog).toHaveBeenCalledWith(TODAY, { reflection: 'Before the back gesture' });
  expect(result).toBe(true);
});

test('a failed save makes the exit guard wait for Retry or Stay on the screen', async () => {
  const patchDailyLog = jest.fn<HealthStore['patchDailyLog']>().mockRejectedValue(new Error('offline'));
  const { runGuard } = setupWithGuard({ store: createStore({ patchDailyLog }) });
  fireEvent.press(await screen.findByLabelText('Sad'));

  // Stay: the route is told not to leave, and the draft is kept.
  let first: boolean | undefined;
  await act(async () => { void runGuard().then((r) => { first = r; }); });
  expect(screen.getByText('Not saved yet')).toBeTruthy();
  expect(first).toBeUndefined(); // still waiting for the user
  await act(async () => fireEvent.press(screen.getByLabelText('Stay')));
  expect(first).toBe(false);
  expect(selected('Sad')).toBe(true);

  // Retry after the connection comes back: the route is told it can leave.
  let second: boolean | undefined;
  await act(async () => { void runGuard().then((r) => { second = r; }); });
  patchDailyLog.mockImplementation(async (date, patch) => ({ ...blank(date), ...patch }));
  await act(async () => fireEvent.press(screen.getByLabelText('Retry')));
  expect(second).toBe(true);
  expect(patchDailyLog).toHaveBeenLastCalledWith(TODAY, { mood: 'sad' });
});

test('unmounting unregisters the guard and never leaves the route waiting', async () => {
  const patchDailyLog = jest.fn<HealthStore['patchDailyLog']>().mockRejectedValue(new Error('offline'));
  const { unregister, runGuard } = setupWithGuard({ store: createStore({ patchDailyLog }) });
  fireEvent.press(await screen.findByLabelText('Sad'));
  let result: boolean | undefined;
  await act(async () => { void runGuard().then((r) => { result = r; }); });
  await act(async () => screen.unmount());
  expect(unregister).toHaveBeenCalledTimes(1);
  expect(result).toBe(false);
});

test("S3-05's symptom picker saves through autosave, only that field", async () => {
  const props = setup();
  fireEvent.press(await screen.findByLabelText('Headache'));
  expect(props.store.patchDailyLog).toHaveBeenCalledWith(TODAY, { physicalSymptoms: ['headache'] });
  expect(await screen.findByText('Saved')).toBeTruthy();
  fireEvent.press(screen.getAllByLabelText('No symptoms')[1]);
  expect(props.store.patchDailyLog).toHaveBeenLastCalledWith(TODAY, { emotionalSymptoms: [] });
  expect(await screen.findByText('Saved')).toBeTruthy();
});

test("S3-04's Clear buttons save mood and flow as not answered (null)", async () => {
  const props = setup({ date: filled.date });
  fireEvent.press(await screen.findByLabelText('Clear mood'));
  expect(props.store.patchDailyLog).toHaveBeenCalledWith(filled.date, { mood: null });
  expect(await screen.findByText('Saved')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Clear flow'));
  expect(props.store.patchDailyLog).toHaveBeenLastCalledWith(filled.date, { flow: null });
  expect(await screen.findByText('Saved')).toBeTruthy();
  expect(selected('Happy')).toBe(false);
  expect(selected('Light')).toBe(false);
});
