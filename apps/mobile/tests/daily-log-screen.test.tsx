import { expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { DailyLogScreen, type DailyLogScreenProps } from '@/features/health/daily-log-screen';
import type { DailyLog, HealthStore } from '@/features/health/health-types';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings } from '@/foundation/contracts';

const TODAY = '2026-11-07';
const blank = (date: string): DailyLog => ({
  date, mood: null, flow: null, physicalSymptoms: null, emotionalSymptoms: null, reflection: null,
});
const filled: DailyLog = {
  date: '2026-11-06', mood: 'happy', flow: 'light',
  physicalSymptoms: ['cramps'], emotionalSymptoms: [], reflection: 'Went for a walk.',
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

const selected = (label: string) => screen.getByLabelText(label).props.accessibilityState?.selected;

test('an empty day loads blank and saves nothing', async () => {
  const props = setup();
  expect(await screen.findByLabelText('Mood: Happy')).toBeTruthy();
  expect(selected('Mood: Happy')).toBe(false);
  expect(screen.getByLabelText('Daily reflection').props.value).toBe('');
  expect(props.store.patchDailyLog).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: /save/i })).toBeNull();
});

test('a filled day shows its saved answers', async () => {
  setup({ date: filled.date });
  expect(await screen.findByLabelText('Daily reflection')).toHaveProp('value', 'Went for a walk.');
  expect(selected('Mood: Happy')).toBe(true);
  expect(selected('Flow: Light')).toBe(true);
  expect(selected('Physical symptom: Cramps')).toBe(true);
  expect(selected('Emotional symptom: None of these')).toBe(true);
});

test('tapping a choice saves only that field, then shows Saved', async () => {
  const props = setup({ date: filled.date });
  fireEvent.press(await screen.findByLabelText('Mood: Sad'));
  expect(props.store.patchDailyLog).toHaveBeenCalledWith(filled.date, { mood: 'sad' });
  expect(await screen.findByText('Saved')).toBeTruthy();
  // Unrelated answers are untouched.
  expect(selected('Flow: Light')).toBe(true);
  expect(selected('Physical symptom: Cramps')).toBe(true);
  expect(selected('Emotional symptom: None of these')).toBe(true);
  expect(screen.getByLabelText('Daily reflection').props.value).toBe('Went for a walk.');
});

test('a failed load offers Try again', async () => {
  const getDailyLog = jest.fn<HealthStore['getDailyLog']>()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(blank(TODAY));
  setup({ store: createStore({ getDailyLog }) });
  expect(await screen.findByText('Could not load this day.')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Try again'));
  expect(await screen.findByLabelText('Mood: Happy')).toBeTruthy();
});

test('today shows "Today · Sat, Nov 7" and next is disabled', async () => {
  setup();
  await screen.findByLabelText('Mood: Happy');
  expect(screen.getByRole('header', { name: 'Today, Saturday, November 7, 2026' })).toBeTruthy();
  expect(screen.getByText('Sat, Nov 7')).toBeTruthy();
  expect(screen.getByLabelText('Next day').props.accessibilityState?.disabled).toBe(true);
});

test('another day hides "Today" and moves exactly one day', async () => {
  const props = setup({ date: '2026-11-30', today: '2026-12-05' });
  await screen.findByLabelText('Mood: Happy');
  expect(screen.getByRole('header', { name: 'Monday, November 30, 2026' })).toBeTruthy();
  expect(screen.getByText('Mon, Nov 30')).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByLabelText('Next day')));
  expect(props.onDateChange).toHaveBeenCalledWith('2026-12-01');
});

test('a failed save stops navigation, keeps the draft and offers Retry or Stay', async () => {
  const patchDailyLog = jest.fn<HealthStore['patchDailyLog']>().mockRejectedValue(new Error('offline'));
  const props = setup({ store: createStore({ patchDailyLog }) });
  fireEvent.press(await screen.findByLabelText('Flow: Heavy'));
  expect(await screen.findByText('Could not save')).toBeTruthy();

  await act(async () => fireEvent.press(screen.getByLabelText('Previous day')));
  expect(props.onDateChange).not.toHaveBeenCalled();
  expect(screen.getByText('Not saved yet')).toBeTruthy();
  expect(screen.queryByText('Could not save')).toBeNull();
  expect(screen.queryByLabelText('Try again')).toBeNull();
  expect(selected('Flow: Heavy')).toBe(true);

  patchDailyLog.mockImplementation(async (date, patch) => ({ ...blank(date), ...patch }));
  await act(async () => fireEvent.press(screen.getByLabelText('Retry')));
  expect(patchDailyLog).toHaveBeenLastCalledWith(TODAY, { flow: 'heavy' });
  expect(props.onDateChange).toHaveBeenCalledWith('2026-11-06');
});

test('Stay keeps the user on the day with their draft', async () => {
  const patchDailyLog = jest.fn<HealthStore['patchDailyLog']>().mockRejectedValue(new Error('offline'));
  const props = setup({ store: createStore({ patchDailyLog }) });
  fireEvent.press(await screen.findByLabelText('Mood: Okay'));
  await act(async () => fireEvent.press(screen.getByLabelText('Done')));
  fireEvent.press(screen.getByLabelText('Stay'));
  expect(props.onExit).not.toHaveBeenCalled();
  expect(screen.queryByText('Not saved yet')).toBeNull();
  expect(screen.getByText('Could not save')).toBeTruthy(); // the status line comes back
  expect(selected('Mood: Okay')).toBe(true);
});

test('leaving the reflection saves it, and clearing it saves null', async () => {
  const props = setup({ date: filled.date });
  const input = await screen.findByLabelText('Daily reflection');
  fireEvent.changeText(input, '');
  fireEvent(input, 'blur');
  expect(props.store.patchDailyLog).toHaveBeenCalledWith(filled.date, { reflection: null });
  expect(await screen.findByText('Saved')).toBeTruthy();
});

test('Done finishes pending saves before calling onExit', async () => {
  const props = setup();
  const input = await screen.findByLabelText('Daily reflection');
  fireEvent.changeText(input, 'Short note');
  await act(async () => fireEvent.press(screen.getByLabelText('Done')));
  expect(props.store.patchDailyLog).toHaveBeenCalledWith(TODAY, { reflection: 'Short note' });
  expect(props.onExit).toHaveBeenCalledTimes(1);
});

test("moving to another day never sends one day's answers to the other", async () => {
  const store = createStore();
  const props = setup({ store });
  fireEvent.press(await screen.findByLabelText('Mood: Okay'));
  fireEvent.changeText(screen.getByLabelText('Daily reflection'), 'Today only');
  await act(async () => fireEvent.press(screen.getByLabelText('Previous day')));
  expect(props.onDateChange).toHaveBeenCalledWith(filled.date);

  props.rerender({ date: filled.date });
  expect(await screen.findByLabelText('Daily reflection')).toHaveProp('value', 'Went for a walk.');
  fireEvent.press(screen.getByLabelText('Flow: Heavy'));
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
  expect(await screen.findByLabelText('Mood: Happy')).toBeTruthy();

  await act(async () => finishOldLoad(filled)); // the answers arrive late
  expect(selected('Mood: Happy')).toBe(false);
  expect(screen.getByLabelText('Daily reflection').props.value).toBe('');
  fireEvent.press(screen.getByLabelText('Mood: Sad'));
  expect(props.store.patchDailyLog).toHaveBeenCalledWith(TODAY, { mood: 'sad' });
  expect(await screen.findByText('Saved')).toBeTruthy();
});
