import { useEffect, useLayoutEffect, type ComponentProps } from 'react';
import { afterEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Dimensions, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { OnboardingGate, type GatePresentation } from '@/features/onboarding/onboarding-gate';
import { OnboardingShell } from '@/features/onboarding/onboarding-shell';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings } from '@/foundation/contracts';

// Resolve the lazy native mock before Jest starts timing individual tests.
void ScrollView;

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
  function Navigator({ view }: { view: GatePresentation['view'] }) {
    useEffect(() => { mounts += 1; }, []);
    useLayoutEffect(() => { committed.push(view); });
    return <Pressable accessibilityRole="button" accessibilityLabel="Private action"><Text>Private action</Text></Pressable>;
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
      return <OnboardingShell model={next} appearance={appearance} navigator={<Navigator view={next.view} />}
        sessionId={props.sessionId ?? 1} workKey={props.sessionKey ?? '1:0'} getWorkKey={getKey} onHomeReady={onHome} />;
    }} />;
  }
  return { App, store, save, onHome, committed, model: () => model!, mounts: () => mounts, setKey(next: string | null) { key = next; } };
}

test.each(['complete', 'incomplete', 'error'])('completion recheck (%s) protects Home and resets on account change', async (outcome) => {
  jest.replaceProperty(Platform, 'OS', 'web');
  const f = fixture();
  f.store.isComplete.mockResolvedValue(true);
  const result = render(<f.App />);
  await screen.findByRole('button', { name: 'Private action' });
  expect(f.onHome).not.toHaveBeenCalled();
  const node = screen.UNSAFE_getAllByType(View).find((view) => view.props.testID === 'app-navigator')!.instance;
  const reading = Promise.withResolvers<boolean>();
  f.store.isComplete.mockReturnValueOnce(reading.promise);
  f.setKey(null);
  result.rerender(<f.App sessionKey="1:1" auth={{ status: 'checking', user: { id: 'a', email: 'a@example.test' }, error: null }} />);
  expect(screen.getByTestId('app-navigator', { includeHiddenElements: true })).toHaveStyle({ display: 'flex', pointerEvents: 'none' });
  expect(node.inert).toBe(true);
  expect(screen.queryByText('Checking if you’re signed in')).toBeNull();
  expect(screen.getByText('Please wait…')).toBeTruthy();
  f.committed.length = 0;
  f.setKey('1:1');
  result.rerender(<f.App sessionKey="1:1" />);
  expect(f.store.isComplete).toHaveBeenCalledTimes(2);
  expect(f.committed).not.toContain('home');
  expect(screen.queryByRole('button', { name: 'Private action' })).toBeNull();
  if (outcome === 'error') {
    await act(async () => reading.reject(new Error('Read failed')));
    await screen.findByText('Could not check display setup. Try again.');
    expect(f.committed).not.toContain('home');
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  } else {
    await act(async () => reading.resolve(outcome === 'complete'));
  }
  if (outcome === 'incomplete') {
    await screen.findByText('Display setup');
    f.setKey(null);
    result.rerender(<f.App sessionKey="1:2" />);
    expect(screen.getByTestId('app-navigator', { includeHiddenElements: true })).toHaveStyle({ display: 'none' });
  } else {
    await screen.findByRole('button', { name: 'Private action' });
  }
  expect(node.inert).toBe(false);
  f.store.isComplete.mockResolvedValue(false);
  f.setKey('2:2');
  result.rerender(<f.App sessionId={2} sessionKey="2:2"
    auth={{ status: 'signedIn', user: { id: 'b', email: 'b@example.test' }, error: null }} />);
  expect(screen.getByTestId('app-navigator', { includeHiddenElements: true })).toHaveStyle({ display: 'none' });
  await screen.findByText('Display setup');
  expect(f.mounts()).toBe(1);
});

test('heading layout focuses once per setup appearance and preserves focus while changing text size', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
  const f = fixture();
  const result = render(<f.App />, { createNodeMock: () => ({}) });
  const heading = await screen.findByText('Display setup');
  fireEvent(heading, 'layout', { nativeEvent: { layout: { width: 300, height: 32 } } });
  expect(focus).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole('button', { name: /^Continue/ }));
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
  fireEvent.press(screen.getByRole('button', { name: /^Continue/ }));
  expect(screen.getByRole('radio', { name: /Largest/ })).toBeChecked();
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
  fireEvent.press(screen.getByRole('button', { name: /^Continue/ }));
  fireEvent.press(screen.getByRole('radio', { name: /Largest/ }));
  fireEvent.press(screen.getByRole('button', { name: /^Continue/ }));
  fireEvent(screen.getByRole('switch'), 'valueChange', true);
  fireEvent.press(screen.getByRole('button', { name: /^Continue/ }));
  fireEvent.press(screen.getByRole('radio', { name: /Dark Mode/ }));
}

test.each(['preferences', 'completion'])('%s failure retains choices through text scaling, rejects duplicates, and retries', async (stage) => {
  const originalWindow = Dimensions.get('window');
  const f = fixture();
  const saving = Promise.withResolvers<void>();
  f.save.mockReturnValueOnce(saving.promise);
  if (stage === 'completion') f.store.markComplete.mockRejectedValueOnce(new Error('Fake completion failure'));
  render(<f.App />);
  try {
    await screen.findByText('Display setup');
    chooseDisplaySettings();
    const scroll = screen.UNSAFE_getByType(ScrollView);
    act(() => Dimensions.set({ window: { ...originalWindow, width: originalWindow.width + 100 } }));
    expect(screen.UNSAFE_getByType(ScrollView)).toBe(scroll);
    fireEvent.press(screen.getByRole('button', { name: /^Continue/ }));
    act(() => Dimensions.set({ window: { ...originalWindow, fontScale: originalWindow.fontScale * 2 } }));
    expect(screen.UNSAFE_getByType(ScrollView)).not.toBe(scroll);
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Skip/ })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Default/ })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Dark Mode/ })).toBeChecked();
    fireEvent.press(screen.getByRole('radio', { name: /Default/ }));
    fireEvent.press(screen.getByRole('button', { name: 'Saving…' }));
    act(() => {
      f.model().setup!.onChange(defaultSettings);
      f.model().setup!.onExit();
    });
    await expect(f.model().setup!.onFinish()).rejects.toThrow('already');
    await expect(f.model().setup!.onFinish()).rejects.toThrow('already');
    expect(f.save).toHaveBeenCalledTimes(1);
    expect(f.save).toHaveBeenCalledWith({ textSize: 'largest', colorScheme: 'dark', reduceMotion: true });
    expect(screen.queryByRole('button', { name: 'Private action' })).toBeNull();
    await act(async () => stage === 'preferences' ? saving.reject(new Error('Fake save failure')) : saving.resolve());
    await screen.findByText("We couldn't save your display settings. Please try again.");
    act(() => Dimensions.set({ window: originalWindow }));
    expect(screen.getByText('Colour Themes')).toBeVisible();
    expect(screen.getByRole('radio', { name: /Dark Mode/ })).toBeChecked();
    expect(f.model().setup!.settings).toEqual({ textSize: 'largest', colorScheme: 'dark', reduceMotion: true });
    expect(f.store.markComplete).toHaveBeenCalledTimes(stage === 'preferences' ? 0 : 1);
    fireEvent.press(screen.getByRole('button', { name: /^Continue/ }));
    await screen.findByRole('button', { name: 'Private action' });
    expect(f.save).toHaveBeenCalledTimes(2);
    expect(f.store.markComplete).toHaveBeenLastCalledWith('a');
    expect(f.onHome).toHaveBeenCalledTimes(1);
    expect(f.mounts()).toBe(1);
  } finally {
    act(() => Dimensions.set({ window: originalWindow }));
  }
});

test('same-account re-login ignores late writes and clears the old draft without remounting navigation', async () => {
  const f = fixture();
  const saving = Promise.withResolvers<void>();
  f.save.mockReturnValueOnce(saving.promise);
  const result = render(<f.App />);
  await screen.findByText('Display setup');
  fireEvent.press(screen.getByRole('button', { name: /^Continue/ }));
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
  fireEvent.press(screen.getByRole('button', { name: /^Continue/ }));
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

test.each([
  ['same-account', 'success'], ['different-account', 'success'],
  ['same-account', 'failure'], ['different-account', 'failure'],
])('a late completion %s read (%s) cannot affect a newer session', async (account, outcome) => {
  const f = fixture();
  const oldRead = Promise.withResolvers<boolean>();
  f.store.isComplete.mockReturnValueOnce(oldRead.promise);
  const result = render(<f.App settings={null} />);
  expect(f.store.isComplete).toHaveBeenNthCalledWith(1, 'a');
  expect(screen.getByText('Checking if you’re signed in')).toBeTruthy();
  expect(screen.getByTestId('app-navigator', { includeHiddenElements: true })).toHaveStyle({ display: 'none' });
  expect(screen.getByTestId('app-navigator', { includeHiddenElements: true })).toHaveProp('importantForAccessibility', 'no-hide-descendants');
  expect(screen.queryByRole('button', { name: 'Private action' })).toBeNull();
  result.rerender(<f.App />);
  f.setKey('2:2');
  const id = account === 'same-account' ? 'a' : 'b';
  result.rerender(<f.App sessionId={2} sessionKey="2:2"
    auth={{ status: 'signedIn', user: { id, email: `${id}@example.test` }, error: null }} />);
  await screen.findByText('Display setup');
  await act(async () => outcome === 'failure' ? oldRead.reject(new Error('Old account read failed')) : oldRead.resolve(true));
  expect(f.store.isComplete).toHaveBeenLastCalledWith(id);
  expect(screen.queryByRole('button', { name: 'Private action' })).toBeNull();
  expect(f.onHome).not.toHaveBeenCalled();
  expect(f.mounts()).toBe(1);
  expect(f.model().view).toBe('setup');
  expect(f.model().error).toBeNull();
});
