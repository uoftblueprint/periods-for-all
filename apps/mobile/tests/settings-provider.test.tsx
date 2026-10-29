import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SettingsProvider, useSettings } from '@/features/settings/settings-provider';
import { loadSettings, saveSettings } from '@/features/settings/settings-storage';
import { defaultSettings, type Settings } from '@/foundation/contracts';

jest.mock('@/features/settings/settings-storage', () => ({ loadSettings: jest.fn(), saveSettings: jest.fn() }));
const load = jest.mocked(loadSettings);
const save = jest.mocked(saveSettings);
let value: ReturnType<typeof useSettings>;
function Probe() {
  value = useSettings();
  return <Text>{JSON.stringify(value.settings)}</Text>;
}

beforeEach(() => { jest.resetAllMocks(); load.mockResolvedValue(null); save.mockResolvedValue(undefined); });

async function ready() {
  render(<SettingsProvider><Probe /></SettingsProvider>);
  await waitFor(() => expect(value.isLoading).toBe(false));
}

test('readiness stays false until saved preferences are loaded', async () => {
  const reading = Promise.withResolvers<Settings | null>();
  load.mockReturnValue(reading.promise);
  render(<SettingsProvider><Probe /></SettingsProvider>);
  expect(value.isLoading).toBe(true);
  const stored: Settings = { textSize: 'largest', colorScheme: 'highContrast', reduceMotion: true };
  await act(async () => reading.resolve(stored));
  await waitFor(() => expect(value.isLoading).toBe(false));
  expect(value.settings).toEqual(stored);
  expect(value.loadError).toBeNull();
});

test('load failure blocks readiness through loadError and retry recovers', async () => {
  load.mockRejectedValueOnce(new Error('Fake read failure'));
  await ready();
  expect(value.loadError).toBeTruthy();
  expect(value.error).toBe(value.loadError);
  load.mockResolvedValueOnce({ ...defaultSettings, colorScheme: 'dark' });
  act(() => value.retryLoad());
  expect(value.isLoading).toBe(true);
  await waitFor(() => expect(value.isLoading).toBe(false));
  expect(value.loadError).toBeNull();
  expect(value.settings.colorScheme).toBe('dark');
});

test('a failed save rejects, keeps optimistic choices, and permits retry', async () => {
  await ready();
  save.mockRejectedValueOnce(new Error('Fake write failure'));
  await act(async () => {
    await expect(value.updateSettings({ textSize: 'largest' })).rejects.toThrow('Could not save');
  });
  expect(value.settings.textSize).toBe('largest');
  expect(value.error).toBeTruthy();
  await act(async () => value.updateSettings({ textSize: 'largest' }));
  expect(value.error).toBeNull();
  expect(save).toHaveBeenLastCalledWith({ ...defaultSettings, textSize: 'largest' });
});

test('early updates merge with stored preferences and await their actual save', async () => {
  const reading = Promise.withResolvers<Settings | null>();
  const writing = Promise.withResolvers<void>();
  load.mockReturnValue(reading.promise);
  save.mockReturnValue(writing.promise);
  render(<SettingsProvider><Probe /></SettingsProvider>);
  let settled = false;
  let result!: Promise<void>;
  act(() => { result = value.updateSettings({ textSize: 'largest' }).then(() => { settled = true; }); });
  expect(settled).toBe(false);
  await act(async () => reading.resolve({ ...defaultSettings, colorScheme: 'dark', reduceMotion: true }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(settled).toBe(false);
  expect(save).toHaveBeenCalledWith({ textSize: 'largest', colorScheme: 'dark', reduceMotion: true });
  await act(async () => { writing.resolve(); await result; });
  expect(settled).toBe(true);
});

test('an early save failure rejects its caller without an unhandled background rejection', async () => {
  const reading = Promise.withResolvers<Settings | null>();
  load.mockReturnValue(reading.promise);
  save.mockRejectedValue(new Error('Fake write failure'));
  render(<SettingsProvider><Probe /></SettingsProvider>);
  let result!: Promise<unknown>;
  act(() => { result = value.updateSettings({ reduceMotion: true }).catch((error: unknown) => error); });
  await act(async () => reading.resolve(defaultSettings));
  expect(await result).toBeInstanceOf(Error);
  await waitFor(() => expect(value.isLoading).toBe(false));
  expect(value.settings.reduceMotion).toBe(true);
  expect(value.error).toBeTruthy();
  expect(value.loadError).toBeNull();
});

test('an early update rejects on read failure and its selection survives a retry', async () => {
  const reading = Promise.withResolvers<Settings | null>();
  load.mockReturnValueOnce(reading.promise);
  render(<SettingsProvider><Probe /></SettingsProvider>);
  let result!: Promise<unknown>;
  act(() => { result = value.updateSettings({ textSize: 'largest' }).catch((error: unknown) => error); });
  await act(async () => reading.reject(new Error('Fake read failure')));
  expect(await result).toBeInstanceOf(Error);
  load.mockResolvedValueOnce({ ...defaultSettings, colorScheme: 'dark' });
  act(() => value.retryLoad());
  await waitFor(() => expect(value.isLoading).toBe(false));
  expect(value.settings).toEqual({ ...defaultSettings, textSize: 'largest', colorScheme: 'dark' });
});

test('writes serialize, recover after failure, and only the newest write controls the message', async () => {
  await ready();
  const firstWrite = Promise.withResolvers<void>();
  save.mockReturnValueOnce(firstWrite.promise);
  let first!: Promise<unknown>;
  let second!: Promise<void>;
  act(() => {
    first = value.updateSettings({ textSize: 'largest' }).catch((error: unknown) => error);
    second = value.updateSettings({ colorScheme: 'dark' });
  });
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  await act(async () => { firstWrite.reject(new Error('Old write failure')); await second; });
  expect(await first).toBeInstanceOf(Error);
  expect(save).toHaveBeenCalledTimes(2);
  expect(save).toHaveBeenLastCalledWith({ ...defaultSettings, textSize: 'largest', colorScheme: 'dark' });
  expect(value.error).toBeNull();
});
