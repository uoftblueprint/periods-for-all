import { useEffect, useLayoutEffect, type ComponentProps } from 'react';
import { afterEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Dimensions, Pressable, Text } from 'react-native';
import { OnboardingGate, type GatePresentation } from '@/features/onboarding/onboarding-gate';
import { OnboardingShell } from '@/features/onboarding/onboarding-shell';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings } from '@/foundation/contracts';

afterEach(() => { jest.restoreAllMocks(); });

function fixture() {
  let key: string | null = '1:0';
  let mounts = 0;
  let model: GatePresentation;
  const onHome = jest.fn();
  const committed: string[] = [];
  const save = jest.fn<(next: typeof defaultSettings) => Promise<void>>().mockResolvedValue(undefined);
  const store = {
    isComplete: jest.fn<(id: string) => Promise<boolean>>().mockResolvedValue(false),
    markComplete: jest.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined),
  };
  function Navigator() {
    useEffect(() => { mounts += 1; }, []);
    return <><Text>Private home</Text><Pressable accessibilityRole="button" accessibilityLabel="Private action"><Text>Private action</Text></Pressable></>;
  }
  function CommitProbe({ view }: { view: GatePresentation['view'] }) {
    useLayoutEffect(() => { committed.push(view); });
    return null;
  }
  const getKey = () => key;
  const appearance = getAppearance(defaultSettings);
  const base = {
    auth: { status: 'signedIn' as const, user: { id: 'a', email: 'a@example.test' }, error: null },
    sessionId: 1, sessionKey: '1:0', getSessionKey: getKey,
    settings: defaultSettings, settingsError: null,
    onRetry: jest.fn(), saveSettings: save, completionStore: store,
  };
  function App(props: Partial<Omit<ComponentProps<typeof OnboardingGate>, 'render'>>) {
    return <OnboardingGate {...base} {...props} render={(next) => {
      model = next;
      return <OnboardingShell model={next} appearance={appearance} navigator={<><CommitProbe view={next.view} /><Navigator /></>}
        sessionId={props.sessionId ?? 1} workKey={props.sessionKey ?? '1:0'} getWorkKey={getKey} onHomeReady={onHome} />;
    }} />;
  }
  return { App, store, save, onHome, committed, model: () => model!, mounts: () => mounts, setKey(next: string | null) { key = next; } };
}

test.each(['success', 'failure'])('completion reload never commits Home before %s after a failed auth operation', async (outcome) => {
  const f = fixture();
  f.store.isComplete.mockResolvedValue(true);
  const result = render(<f.App />);
  await screen.findByRole('button', { name: 'Private action' });
  const reading = Promise.withResolvers<boolean>();
  f.store.isComplete.mockReturnValueOnce(reading.promise);
  f.setKey(null);
  result.rerender(<f.App sessionKey="1:1" auth={{ status: 'checking', user: { id: 'a', email: 'a@example.test' }, error: null }} />);
  f.committed.length = 0;
  f.setKey('1:1');
  result.rerender(<f.App sessionKey="1:1" />);
  expect(f.store.isComplete).toHaveBeenCalledTimes(2);
  expect(f.committed).not.toContain('home');
  expect(screen.queryByRole('button', { name: 'Private action' })).toBeNull();
  if (outcome === 'failure') {
    await act(async () => reading.reject(new Error('Read failed')));
    await screen.findByText('Could not check display setup. Try again.');
    expect(f.committed).not.toContain('home');
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  } else {
    await act(async () => reading.resolve(true));
  }
  await screen.findByRole('button', { name: 'Private action' });
  expect(f.mounts()).toBe(1);
});

test('heading layout focuses once per setup appearance and preserves focus while changing text size', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
  const f = fixture();
  const result = render(<f.App />, { createNodeMock: () => ({}) });
  const heading = await screen.findByText('Display setup');
  fireEvent(heading, 'layout', { nativeEvent: { layout: { width: 300, height: 32 } } });
  expect(focus).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.press(screen.getByRole('radio', { name: /Largest/ }));
  fireEvent(heading, 'layout', { nativeEvent: { layout: { width: 300, height: 48 } } });
  expect(focus).toHaveBeenCalledTimes(1);
  f.setKey(null);
  result.rerender(<f.App sessionKey="1:1" auth={{ status: 'checking', user: { id: 'a', email: 'a@example.test' }, error: null }} />);
  f.setKey('1:1');
  result.rerender(<f.App sessionKey="1:1" />);
  const reopened = await screen.findByText('Display setup');
  fireEvent(reopened, 'layout', { nativeEvent: { layout: { width: 300, height: 48 } } });
  expect(focus).toHaveBeenCalledTimes(2);
});

test('navigator stays mounted but hidden/inaccessible throughout loading, setup, and session changes', async () => {
  const f = fixture();
  const read = Promise.withResolvers<boolean>();
  f.store.isComplete.mockReturnValueOnce(read.promise);
  const result = render(<f.App settings={null} />);
  expect(f.mounts()).toBe(1);
  expect(screen.getByTestId('app-navigator', { includeHiddenElements: true })).toHaveStyle({ display: 'none' });
  expect(screen.queryByRole('button', { name: 'Private action' })).toBeNull();
  expect(screen.getByTestId('app-navigator', { includeHiddenElements: true })).toHaveProp('importantForAccessibility', 'no-hide-descendants');
  result.rerender(<f.App />);
  await act(async () => read.resolve(false));
  await screen.findByText('Display setup');
  expect(f.mounts()).toBe(1);
  expect(screen.queryByRole('button', { name: 'Private action' })).toBeNull();
  f.setKey('2:0');
  result.rerender(<f.App sessionId={2} sessionKey="2:0" auth={{ status: 'signedIn', user: { id: 'b', email: 'b@example.test' }, error: null }} />);
  await screen.findByText('Display setup');
  expect(f.mounts()).toBe(1);
});

test('Back permits Home only for the session, without writing completion', async () => {
  const f = fixture();
  const result = render(<f.App />);
  await screen.findByText('Display setup');
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  await screen.findByRole('button', { name: 'Private action' });
  expect(f.store.markComplete).not.toHaveBeenCalled();
  expect(f.onHome).toHaveBeenCalledTimes(1);
  result.rerender(<f.App />);
  expect(f.onHome).toHaveBeenCalledTimes(1);
  f.setKey('2:0');
  result.rerender(<f.App sessionId={2} sessionKey="2:0" />);
  await screen.findByText('Display setup');
  expect(screen.queryByRole('button', { name: 'Private action' })).toBeNull();
  expect(f.mounts()).toBe(1);
});

function chooseDisplaySettings() {
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.press(screen.getByRole('radio', { name: /Largest/ }));
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  fireEvent(screen.getByRole('switch'), 'valueChange', true);
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.press(screen.getByRole('radio', { name: /Dark Mode/ }));
}

test.each([
  { name: 'the real flow disables controls, retains the step/choices on failure, and retries', resize: false },
  { name: 'a live system font change preserves the gate draft, pending save, and mounted navigator', resize: true },
])('$name', async ({ resize }) => {
  const originalWindow = Dimensions.get('window');
  const f = fixture();
  const saving = Promise.withResolvers<void>();
  f.save.mockReturnValueOnce(saving.promise);
  render(<f.App />);
  try {
    await screen.findByText('Display setup');
    chooseDisplaySettings();
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    if (resize) act(() => Dimensions.set({ window: { ...originalWindow, fontScale: originalWindow.fontScale * 2 } }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Default/ })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Dark Mode/ })).toBeChecked();
    expect(screen.queryByRole('button', { name: 'Private action' })).toBeNull();
    expect(f.mounts()).toBe(1);
    fireEvent.press(screen.getByRole('radio', { name: /Default/ }));
    expect(f.save).toHaveBeenCalledTimes(1);
    expect(f.save).toHaveBeenCalledWith({ textSize: 'largest', colorScheme: 'dark', reduceMotion: true });
    if (resize) await act(async () => saving.resolve());
    else {
      await act(async () => saving.reject(new Error('Fake save failure')));
      await screen.findByText("We couldn't save your display settings. Please try again.");
      expect(screen.getByRole('radio', { name: /Dark Mode/ })).toBeChecked();
      expect(f.store.markComplete).not.toHaveBeenCalled();
      fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    }
    await screen.findByRole('button', { name: 'Private action' });
    expect(f.store.markComplete).toHaveBeenCalledWith('a');
    expect(f.onHome).toHaveBeenCalledTimes(1);
    expect(f.mounts()).toBe(1);
  } finally {
    act(() => Dimensions.set({ window: originalWindow }));
  }
});

test('gate rejects two immediate programmatic finishes and does not expose Home on completion failure', async () => {
  const f = fixture();
  const saving = Promise.withResolvers<void>();
  f.save.mockReturnValueOnce(saving.promise);
  f.store.markComplete.mockRejectedValueOnce(new Error('Fake completion failure'));
  render(<f.App />);
  await screen.findByText('Display setup');
  let first!: Promise<unknown>;
  await act(async () => {
    const setup = f.model().setup!;
    first = setup.onFinish().catch((error: unknown) => error);
    await expect(setup.onFinish()).rejects.toThrow('already');
  });
  expect(f.save).toHaveBeenCalledTimes(1);
  await act(async () => { saving.resolve(); await first; });
  expect(await first).toBeInstanceOf(Error);
  expect(screen.queryByRole('button', { name: 'Private action' })).toBeNull();
  await act(async () => f.model().setup!.onFinish());
  await screen.findByRole('button', { name: 'Private action' });
});

test('same-account re-login ignores late writes and clears the old draft without remounting navigation', async () => {
  const f = fixture();
  const saving = Promise.withResolvers<void>();
  f.save.mockReturnValueOnce(saving.promise);
  const result = render(<f.App />);
  await screen.findByText('Display setup');
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.press(screen.getByRole('radio', { name: /Largest/ }));
  let first!: Promise<unknown>;
  act(() => { first = f.model().setup!.onFinish().catch((error: unknown) => error); });
  f.setKey('2:2');
  result.rerender(<f.App sessionId={2} sessionKey="2:2" />);
  await screen.findByText('Display setup');
  await act(async () => { saving.resolve(); await first; });
  expect(await first).toBeInstanceOf(Error);
  expect(f.store.markComplete).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Private action' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByRole('radio', { name: /Standard/ })).toBeChecked();
  expect(f.mounts()).toBe(1);
});

test('a changed work key immediately rejects an old callback, before React re-renders', async () => {
  const f = fixture();
  render(<f.App />);
  await screen.findByText('Display setup');
  const finish = f.model().setup!.onFinish;
  f.setKey(null);
  await expect(finish()).rejects.toThrow('not ready');
  expect(f.save).not.toHaveBeenCalled();
});

test('a failed auth operation preserves draft choices in the confirmed session', async () => {
  const f = fixture();
  const result = render(<f.App />);
  await screen.findByText('Display setup');
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.press(screen.getByRole('radio', { name: /Largest/ }));
  f.setKey(null);
  result.rerender(<f.App sessionKey="1:1" auth={{ status: 'checking', user: { id: 'a', email: 'a@example.test' }, error: null }} />);
  expect(screen.queryByRole('button', { name: 'Private action' })).toBeNull();
  f.setKey('1:1');
  result.rerender(<f.App sessionKey="1:1" />);
  await screen.findByText('Display setup');
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByRole('radio', { name: /Largest/ })).toBeChecked();
  expect(f.mounts()).toBe(1);
});

test('an already-completed session does not redirect away from a restored settings route', async () => {
  const f = fixture();
  f.store.isComplete.mockResolvedValue(true);
  render(<f.App />);
  await screen.findByRole('button', { name: 'Private action' });
  expect(f.onHome).not.toHaveBeenCalled();
  expect(f.mounts()).toBe(1);
});

test.each([
  ['same-account', 'success'], ['different-account', 'success'],
  ['same-account', 'failure'], ['different-account', 'failure'],
])('a late completion %s read (%s) cannot affect a newer session', async (account, outcome) => {
  const f = fixture();
  const oldRead = Promise.withResolvers<boolean>();
  f.store.isComplete.mockReturnValueOnce(oldRead.promise);
  const result = render(<f.App />);
  f.setKey('2:2');
  const id = account === 'same-account' ? 'a' : 'b';
  result.rerender(<f.App sessionId={2} sessionKey="2:2"
    auth={{ status: 'signedIn', user: { id, email: `${id}@example.test` }, error: null }} />);
  await screen.findByText('Display setup');
  await act(async () => outcome === 'failure' ? oldRead.reject(new Error('Old account read failed')) : oldRead.resolve(true));
  expect(screen.queryByRole('button', { name: 'Private action' })).toBeNull();
  expect(f.onHome).not.toHaveBeenCalled();
  expect(f.mounts()).toBe(1);
  expect(f.model().view).toBe('setup');
  expect(f.model().error).toBeNull();
});
