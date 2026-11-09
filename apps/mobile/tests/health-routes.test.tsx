// S3-08: the real health routes load the signed-in user's data, never show a failed
// load as empty, ignore late responses, and navigate with only a date or month.
import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import CalendarRoute from '@/app/calendar';
import DailyLogRoute from '@/app/daily-log';
import PeriodEditRoute from '@/app/period-edit';
import { HealthStoreProvider } from '@/features/health/health-routes';
import type { DailyLog, HealthStore } from '@/features/health/health-routes';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), setParams: jest.fn(), canGoBack: jest.fn(() => true) };
let mockParams: Record<string, string> = {};
const mockFocus: { current: (() => void) | null } = { current: null };
const mockCalendar = jest.fn((_props: any) => null);
const mockDayDetails = jest.fn((_props: any) => null);
const mockEditor = jest.fn((_props: any) => null);
const mockLogScreen = jest.fn((_props: any) => null);

jest.mock('expo-router', () => ({
  // A getter, because jest.mock runs before `mockRouter` above is created.
  get router() { return mockRouter; },
  useLocalSearchParams: () => mockParams,
  // Runs on mount like a first focus; tests call mockFocus.current() to simulate returning.
  useFocusEffect: (callback: () => void) => {
    const React = require('react');
    React.useEffect(() => { mockFocus.current = callback; callback(); }, [callback]);
  },
}));
jest.mock('@/features/settings/settings-provider', () => ({
  useSettings: () => ({ settings: require('@/foundation/contracts').defaultSettings }),
}));
jest.mock('@/features/calendar/month-calendar', () => ({ MonthCalendar: (p: any) => mockCalendar(p) }));
// Replace the other tickets' screens with recorders, and fix "today", so these tests check only the wiring.
jest.mock('@/features/health/health-routes', () => ({
  ...(jest.requireActual('@/features/health/health-routes') as object),
  DayDetails: (p: any) => mockDayDetails(p),
  PeriodDateEditor: (p: any) => mockEditor(p),
  DailyLogScreen: (p: any) => mockLogScreen(p),
  localToday: () => '2026-11-15',
}));

const lastProps = (mock: jest.Mock<any>) => mock.mock.calls.at(-1)![0] as any;
const emptyLog = (date: string): DailyLog => ({
  date, mood: null, flow: null, physicalSymptoms: null, emotionalSymptoms: null, reflection: null,
});

/** Fake store whose methods tests can override. */
function fakeStore(overrides: Partial<HealthStore> = {}): HealthStore {
  return {
    getPeriodDays: jest.fn(async () => ['2026-11-14', '2026-11-15']),
    updatePeriodDays: jest.fn(async () => {}),
    getDailyLog: jest.fn(async (date: string) => emptyLog(date)),
    patchDailyLog: jest.fn(async (date: string) => emptyLog(date)),
    getPeriodSetup: jest.fn(async () => ({ lastPeriodStart: null, cycleLength: null, periodLength: null, step: 'intro' as const })),
    savePeriodSetup: jest.fn(async () => {}),
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function renderWithStore(ui: React.ReactElement, store: HealthStore, userId = 'user-a') {
  const createStore = jest.fn(async () => store);
  const view = render(<HealthStoreProvider userId={userId} createStore={createStore}>{ui}</HealthStoreProvider>);
  return { ...view, createStore };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockFocus.current = null;
  mockRouter.canGoBack.mockImplementation(() => true);
});

test('calendar loads the visible month plus edge days and passes marks to MonthCalendar', async () => {
  const store = fakeStore();
  renderWithStore(<CalendarRoute />, store);
  await waitFor(() => expect(mockCalendar).toHaveBeenCalled());

  expect(store.getPeriodDays).toHaveBeenCalledWith('2026-10-31', '2026-12-01');
  expect(lastProps(mockCalendar)).toMatchObject({
    month: '2026-11', today: '2026-11-15', selectedDate: '2026-11-15', periodDates: ['2026-11-14', '2026-11-15'],
  });
  await waitFor(() => expect(mockDayDetails).toHaveBeenCalled());
  expect(lastProps(mockDayDetails)).toMatchObject({ log: emptyLog('2026-11-15'), isPeriodDay: true, today: '2026-11-15' });
});

test('a failed load shows an error and Try again, never an empty calendar', async () => {
  const getPeriodDays = jest.fn<HealthStore['getPeriodDays']>()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(['2026-11-02']);
  renderWithStore(<CalendarRoute />, fakeStore({ getPeriodDays }));

  expect(await screen.findByText('We couldn’t load your period dates.')).toBeTruthy();
  expect(mockCalendar).not.toHaveBeenCalled();

  fireEvent.press(screen.getByLabelText('Try again'));
  await waitFor(() => expect(lastProps(mockCalendar).periodDates).toEqual(['2026-11-02']));
});

test('a late result for a previously selected day never replaces the newer day', async () => {
  const slowDay = deferred<DailyLog>();
  const getDailyLog = jest.fn(async (date: string) => emptyLog(date));
  const store = fakeStore({ getDailyLog });
  renderWithStore(<CalendarRoute />, store);
  await waitFor(() => expect(mockDayDetails).toHaveBeenCalled());

  getDailyLog.mockImplementationOnce(() => slowDay.promise); // Nov 3 is slow
  act(() => { lastProps(mockCalendar).onSelectDate('2026-11-03'); });
  act(() => { lastProps(mockCalendar).onSelectDate('2026-11-04'); });
  await waitFor(() => expect(lastProps(mockDayDetails).log.date).toBe('2026-11-04'));

  await act(async () => { slowDay.resolve({ ...emptyLog('2026-11-03'), mood: 'sad' }); });
  expect(lastProps(mockDayDetails).log.date).toBe('2026-11-04');
});

test('switching account never shows the previous account’s records', async () => {
  const lateA = deferred<string[]>();
  const storeA = fakeStore({ getPeriodDays: jest.fn(() => lateA.promise) });
  const storeB = fakeStore({ getPeriodDays: jest.fn(async () => ['2026-11-20']) });
  const createStore = jest.fn(async (userId: string) => (userId === 'user-a' ? storeA : storeB));
  const view = render(<HealthStoreProvider userId="user-a" createStore={createStore}><CalendarRoute /></HealthStoreProvider>);
  await waitFor(() => expect(storeA.getPeriodDays).toHaveBeenCalled());

  view.rerender(<HealthStoreProvider userId="user-b" createStore={createStore}><CalendarRoute /></HealthStoreProvider>);
  await waitFor(() => expect(lastProps(mockCalendar).periodDates).toEqual(['2026-11-20']));

  await act(async () => { lateA.resolve(['2026-11-01']); }); // A's slow answer arrives after the switch
  expect(mockCalendar.mock.calls.every(([props]: any[]) => !props.periodDates.includes('2026-11-01'))).toBe(true);
  expect(createStore).toHaveBeenCalledWith('user-b');
});

test('coming back to the calendar reloads marks and day details', async () => {
  const store = fakeStore();
  renderWithStore(<CalendarRoute />, store);
  await waitFor(() => expect(mockDayDetails).toHaveBeenCalled());
  expect(store.getPeriodDays).toHaveBeenCalledTimes(1);

  act(() => { mockFocus.current!(); });
  await waitFor(() => expect(store.getPeriodDays).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(store.getDailyLog).toHaveBeenCalledTimes(2));
});

test('navigation passes only the month or date, never health answers', async () => {
  renderWithStore(<CalendarRoute />, fakeStore());
  await waitFor(() => expect(mockDayDetails).toHaveBeenCalled());

  act(() => { lastProps(mockCalendar).onEditPeriodDates(); });
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/period-edit', params: { month: '2026-11' } });
  act(() => { lastProps(mockDayDetails).onEdit('2026-11-15'); });
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/daily-log', params: { date: '2026-11-15' } });
});

test('if the health store cannot be opened, show an error and let the user retry', async () => {
  const store = fakeStore();
  const createStore = jest.fn<(userId: string) => Promise<HealthStore>>()
    .mockRejectedValueOnce(new Error('backend not connected'))
    .mockResolvedValueOnce(store);
  render(<HealthStoreProvider userId="user-a" createStore={createStore}><CalendarRoute /></HealthStoreProvider>);

  expect(await screen.findByText('We couldn’t open your health records.')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Try again'));
  await waitFor(() => expect(mockCalendar).toHaveBeenCalled());
  expect(createStore).toHaveBeenCalledTimes(2);
});

test('period editor gets the saved dates and real save/back callbacks', async () => {
  mockParams = { month: '2026-10' };
  const store = fakeStore({ getPeriodDays: jest.fn(async () => ['2026-10-03']) });
  renderWithStore(<PeriodEditRoute />, store);
  await waitFor(() => expect(mockEditor).toHaveBeenCalled());

  expect(store.getPeriodDays).toHaveBeenCalledWith('2026-09-30', '2026-11-01');
  const props = lastProps(mockEditor);
  expect(props).toMatchObject({ initialDates: ['2026-10-03'], initialMonth: '2026-10', today: '2026-11-15' });

  await props.onSave({ add: ['2026-10-04'], remove: ['2026-10-03'] });
  expect(store.updatePeriodDays).toHaveBeenCalledWith({ add: ['2026-10-04'], remove: ['2026-10-03'] });
  await props.loadDates('2026-08-31', '2026-10-01');
  expect(store.getPeriodDays).toHaveBeenLastCalledWith('2026-08-31', '2026-10-01');

  props.onDone();
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  mockRouter.canGoBack.mockImplementation(() => false);
  props.onCancel();
  expect(mockRouter.replace).toHaveBeenCalledWith('/calendar');
});

test('period editor does not open if saved dates fail to load', async () => {
  const store = fakeStore({ getPeriodDays: jest.fn(async () => { throw new Error('offline'); }) });
  renderWithStore(<PeriodEditRoute />, store);
  expect(await screen.findByText('We couldn’t load your period dates.')).toBeTruthy();
  expect(mockEditor).not.toHaveBeenCalled();
});

test('daily log gets the date from the URL, the store and navigation callbacks', async () => {
  mockParams = { date: '2026-11-10' };
  const store = fakeStore();
  renderWithStore(<DailyLogRoute />, store);
  await waitFor(() => expect(mockLogScreen).toHaveBeenCalled());

  const props = lastProps(mockLogScreen);
  expect(props).toMatchObject({ date: '2026-11-10', today: '2026-11-15', store });
  props.onDateChange('2026-11-09');
  expect(mockRouter.setParams).toHaveBeenCalledWith({ date: '2026-11-09' });
  props.onExit();
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
});

test.each(['2026-11-16', '2026-02-30', 'not-a-date', ''])('daily log refuses %j (future or invalid date)', async (date) => {
  mockParams = date ? { date } : {};
  renderWithStore(<DailyLogRoute />, fakeStore());
  expect(await screen.findByText('This day can’t be logged.')).toBeTruthy();
  expect(mockLogScreen).not.toHaveBeenCalled();
});
