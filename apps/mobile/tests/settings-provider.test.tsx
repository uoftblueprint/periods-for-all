import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, render, waitFor } from '@testing-library/react-native';
import { SettingsProvider, useSettings } from '@/features/settings/settings-provider';
import { loadSettings, saveSettings } from '@/features/settings/settings-storage';
import { defaultSettings, type Settings } from '@/foundation/contracts';

jest.mock('@/features/settings/settings-storage', () => ({ loadSettings: jest.fn(), saveSettings: jest.fn() }));
const load = jest.mocked(loadSettings);
const save = jest.mocked(saveSettings);
let value: ReturnType<typeof useSettings>;
function Probe() {
  value = useSettings();
  return null;
}

beforeEach(() => { jest.resetAllMocks(); load.mockResolvedValue(null); save.mockResolvedValue(undefined); });

test.each([false, true])('loading preserves saved preferences and waits for early edits: %s', async (earlyEdit) => {
  const reading = Promise.withResolvers<Settings | null>();
  const writing = Promise.withResolvers<void>();
  const stored: Settings = { textSize: 'standard', colorScheme: 'dark', reduceMotion: true };
  const expected = { ...stored, textSize: earlyEdit ? 'largest' : stored.textSize };
  const settled = jest.fn();
  load.mockReturnValue(reading.promise);
  save.mockReturnValue(writing.promise);
  render(<SettingsProvider><Probe /></SettingsProvider>);
  expect(value.isLoading).toBe(true);
  if (earlyEdit) act(() => { void value.updateSettings({ textSize: 'largest' }).then(settled); });
  await act(async () => reading.resolve(stored));
  expect(value.settings).toEqual(expected);
  expect(value.loadError).toBeNull();
  if (earlyEdit) {
    expect(save).toHaveBeenCalledWith(expected);
    expect(settled).not.toHaveBeenCalled();
    await act(async () => writing.resolve());
    expect(settled).toHaveBeenCalledTimes(1);
  }
  expect(value.isLoading).toBe(false);
  expect(save).toHaveBeenCalledTimes(earlyEdit ? 1 : 0);
});

test.each([false, true])('read failure rejects early edits and retry preserves the selection: %s', async (earlyEdit) => {
  const reading = Promise.withResolvers<Settings | null>();
  load.mockReturnValueOnce(reading.promise);
  render(<SettingsProvider><Probe /></SettingsProvider>);
  let result: Promise<unknown> | undefined;
  if (earlyEdit) act(() => { result = value.updateSettings({ textSize: 'largest' }).catch((error: unknown) => error); });
  await act(async () => reading.reject(new Error('Fake read failure')));
  if (earlyEdit) expect(await result).toBeInstanceOf(Error);
  expect(value.loadError).toBeTruthy();
  expect(value.error).toBe(value.loadError);
  load.mockResolvedValueOnce({ ...defaultSettings, colorScheme: 'dark' });
  act(() => value.retryLoad());
  expect(value.isLoading).toBe(true);
  await waitFor(() => expect(value.isLoading).toBe(false));
  expect(value.loadError).toBeNull();
  expect(value.settings).toEqual({ ...defaultSettings, textSize: earlyEdit ? 'largest' : 'standard', colorScheme: 'dark' });
});

test.each([false, true])('save failure rejects without an unhandled background error, retains choices and retries (early: %s)', async (earlyEdit) => {
  const reading = Promise.withResolvers<Settings | null>();
  load.mockReturnValue(reading.promise);
  save.mockRejectedValueOnce(new Error('Fake write failure'));
  render(<SettingsProvider><Probe /></SettingsProvider>);
  if (!earlyEdit) await act(async () => reading.resolve(defaultSettings));
  let result!: Promise<unknown>;
  act(() => { result = value.updateSettings({ reduceMotion: true }).catch((error: unknown) => error); });
  if (earlyEdit) await act(async () => reading.resolve(defaultSettings));
  await act(async () => { expect(await result).toBeInstanceOf(Error); });
  expect(value.isLoading).toBe(false);
  expect(value.settings.reduceMotion).toBe(true);
  expect(value.error).toBeTruthy();
  expect(value.loadError).toBeNull();
  await act(async () => value.updateSettings({ reduceMotion: true }));
  expect(value.error).toBeNull();
  expect(save).toHaveBeenLastCalledWith({ ...defaultSettings, reduceMotion: true });
});

test('writes serialize, recover after failure, and only the newest write controls the message', async () => {
  render(<SettingsProvider><Probe /></SettingsProvider>);
  await waitFor(() => expect(value.isLoading).toBe(false));
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
