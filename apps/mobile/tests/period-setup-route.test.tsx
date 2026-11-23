// S3-10: the period-setup route and the automatic offer load the signed-in user's setup,
// resume where it stopped, never complete it from a failed save, and never mix accounts.
import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import PeriodSetupRoute from '@/app/period-setup';
import { createDemoHealthStore } from '@/features/health/demo-health-store';
import { HealthStoreProvider, type HealthStore } from '@/features/health/health-routes';
import type { PeriodSetup } from '@/features/health/contracts';
import { PeriodSetupOffer } from '@/features/onboarding/period-setup-offer';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) };
const mockScreen = jest.fn((_props: any) => null);

jest.mock('expo-router', () => ({
  // A getter, because jest.mock runs before `mockRouter` above is created.
  get router() { return mockRouter; },
}));
jest.mock('@/features/settings/settings-provider', () => ({
  useSettings: () => ({ settings: require('@/foundation/contracts').defaultSettings }),
}));
// S3-09's screen is replaced by a recorder, so these tests check only the S3-10 wiring.
jest.mock('@/features/onboarding/period-setup-screen', () => ({
  PeriodSetupScreen: (p: any) => mockScreen(p),
}));
jest.mock('@/features/health/health-routes', () => ({
  ...(jest.requireActual('@/features/health/health-routes') as object),
  localToday: () => '2026-11-15',
}));

const TODAY = '2026-11-15';
const EMPTY: PeriodSetup = { lastPeriodStart: null, cycleLength: null, periodLength: null, step: 'intro' };
const screenProps = () => mockScreen.mock.calls.at(-1)![0] as any;

function demoStore(initialPeriodSetup: PeriodSetup | null = null) {
  return createDemoHealthStore({ today: TODAY, initialPeriodSetup });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

/** Renders `ui` with one store per user, the way S3-08's provider creates them. */
function renderFor(ui: React.ReactElement, stores: Record<string, HealthStore>, userId: string | null) {
  const createStore = async (id: string) => stores[id];
  const tree = (id: string | null, child = ui) =>
    <HealthStoreProvider userId={id} createStore={createStore}>{child}</HealthStoreProvider>;
  const view = render(tree(userId));
  return { ...view, switchTo: (id: string | null, child?: React.ReactElement) => view.rerender(tree(id, child)) };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRouter.canGoBack.mockReturnValue(true);
});

// ---- The route ----

test('reopening resumes at the saved step with the saved answer', async () => {
  const store = demoStore({ ...EMPTY, lastPeriodStart: '2026-11-01', step: 'cycle' });
  renderFor(<PeriodSetupRoute />, { a: store }, 'a');
  await waitFor(() => expect(mockScreen).toHaveBeenCalled());
  expect(screenProps().initialValue).toEqual({ ...EMPTY, lastPeriodStart: '2026-11-01', step: 'cycle' });
  expect(screenProps().today).toBe(TODAY);
});

test('each step is saved to the store, so answering one question and leaving keeps it', async () => {
  const store = demoStore();
  renderFor(<PeriodSetupRoute />, { a: store }, 'a');
  await waitFor(() => expect(mockScreen).toHaveBeenCalled());
  const answered = { ...EMPTY, lastPeriodStart: '2026-11-01', step: 'cycle' as const };
  await act(() => screenProps().onSave(answered));
  expect(await store.getPeriodSetup()).toEqual(answered);
});

test('finished setup opens from the start for editing and stays finished', async () => {
  const done: PeriodSetup = { lastPeriodStart: '2026-11-01', cycleLength: 28, periodLength: 5, step: 'complete' };
  const store = demoStore(done);
  renderFor(<PeriodSetupRoute />, { a: store }, 'a');
  await waitFor(() => expect(mockScreen).toHaveBeenCalled());
  expect(screenProps().initialValue).toEqual({ ...done, step: 'intro' });
  await act(() => screenProps().onSave({ ...done, cycleLength: 30, step: 'length' }));
  expect(await store.getPeriodSetup()).toEqual({ ...done, cycleLength: 30 });
});

test('a failed read shows Try again instead of empty answers', async () => {
  const store = demoStore({ ...EMPTY, cycleLength: 30, step: 'length' });
  store.failNextRead(new Error('offline'));
  renderFor(<PeriodSetupRoute />, { a: store }, 'a');
  expect(await screen.findByText('We couldn’t load your period setup.')).toBeTruthy();
  expect(mockScreen).not.toHaveBeenCalled();

  fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(mockScreen).toHaveBeenCalled());
  expect(screenProps().initialValue.cycleLength).toBe(30);
});

test('a failed finish rejects to the screen and does not complete setup', async () => {
  const store = demoStore({ ...EMPTY, step: 'length' });
  renderFor(<PeriodSetupRoute />, { a: store }, 'a');
  await waitFor(() => expect(mockScreen).toHaveBeenCalled());
  store.failNextWrite(new Error('offline'));
  await expect(screenProps().onSave({ ...EMPTY, periodLength: 5, step: 'complete' })).rejects.toThrow('offline');
  expect((await store.getPeriodSetup()).step).toBe('length');
  expect(mockRouter.back).not.toHaveBeenCalled();
});

test('finishing leaves once, even when finish is reported twice', async () => {
  renderFor(<PeriodSetupRoute />, { a: demoStore() }, 'a');
  await waitFor(() => expect(mockScreen).toHaveBeenCalled());
  screenProps().onFinish();
  screenProps().onFinish();
  screenProps().onExit();
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
});

test('with nowhere to go back to, leaving goes home', async () => {
  mockRouter.canGoBack.mockReturnValue(false);
  renderFor(<PeriodSetupRoute />, { a: demoStore() }, 'a');
  await waitFor(() => expect(mockScreen).toHaveBeenCalled());
  screenProps().onExit();
  expect(mockRouter.replace).toHaveBeenCalledWith('/home');
  expect(mockRouter.back).not.toHaveBeenCalled();
});

test('after an account switch, the old account’s save cannot finish and its answers are not shown', async () => {
  const pendingWrite = deferred<void>();
  const storeA = demoStore({ ...EMPTY, lastPeriodStart: '2026-11-01', step: 'length' });
  const savePeriodSetup = jest.spyOn(storeA, 'savePeriodSetup').mockImplementation(() => pendingWrite.promise);
  const storeB = demoStore();
  const { switchTo } = renderFor(<PeriodSetupRoute />, { a: storeA, b: storeB }, 'a');
  await waitFor(() => expect(mockScreen).toHaveBeenCalled());
  const saveA = screenProps().onSave({ ...EMPTY, lastPeriodStart: '2026-11-01', step: 'complete' });
  await waitFor(() => expect(savePeriodSetup).toHaveBeenCalled());

  mockScreen.mockClear();
  switchTo('b');
  await waitFor(() => expect(mockScreen).toHaveBeenCalled());
  expect(screenProps().initialValue).toEqual(EMPTY);

  pendingWrite.resolve();
  await expect(saveA).rejects.toThrow('previous account');
  expect(await storeB.getPeriodSetup()).toEqual(EMPTY);
});

// ---- The automatic offer ----

test('unfinished setup opens once per sign-in, only when active', async () => {
  const store = demoStore({ ...EMPTY, step: 'cycle' });
  const { switchTo } = renderFor(<PeriodSetupOffer active={false} />, { a: store }, 'a');
  await act(async () => {});
  expect(mockRouter.push).not.toHaveBeenCalled();

  switchTo('a', <PeriodSetupOffer active />);
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/period-setup'));
  // Coming back to home in the same sign-in does not reopen it.
  switchTo('a', <PeriodSetupOffer active={false} />);
  switchTo('a', <PeriodSetupOffer active />);
  await act(async () => {});
  expect(mockRouter.push).toHaveBeenCalledTimes(1);
});

test('finished or skipped setup never opens by itself', async () => {
  renderFor(<PeriodSetupOffer active />, { a: demoStore({ ...EMPTY, step: 'complete' }) }, 'a');
  await act(async () => {});
  expect(mockRouter.push).not.toHaveBeenCalled();
});

test('a failed read or leaving home first does not open it, and the next visit tries again', async () => {
  const store = demoStore();
  store.failNextRead(new Error('offline'));
  const { switchTo } = renderFor(<PeriodSetupOffer active />, { a: store }, 'a');
  await act(async () => {});
  expect(mockRouter.push).not.toHaveBeenCalled();

  const slowRead = deferred<PeriodSetup>();
  jest.spyOn(store, 'getPeriodSetup').mockImplementationOnce(() => slowRead.promise);
  switchTo('a', <PeriodSetupOffer active={false} />);
  switchTo('a', <PeriodSetupOffer active />);
  switchTo('a', <PeriodSetupOffer active={false} />); // left home before the read finished
  await act(async () => slowRead.resolve(EMPTY));
  expect(mockRouter.push).not.toHaveBeenCalled();

  switchTo('a', <PeriodSetupOffer active />);
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalledTimes(1));
});

test('a new sign-in is offered again, and signing out cancels a pending offer', async () => {
  const slowRead = deferred<PeriodSetup>();
  const first = demoStore();
  jest.spyOn(first, 'getPeriodSetup').mockImplementationOnce(() => slowRead.promise);
  const { switchTo } = renderFor(<PeriodSetupOffer active />, { a: first, b: demoStore() }, 'a');
  await waitFor(() => expect(first.getPeriodSetup).toHaveBeenCalled());
  switchTo(null);
  await act(async () => slowRead.resolve(EMPTY));
  expect(mockRouter.push).not.toHaveBeenCalled();

  switchTo('b');
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalledTimes(1));
});
