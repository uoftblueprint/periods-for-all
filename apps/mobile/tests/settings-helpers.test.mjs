// F01 independent checks with FAKE storage (no device storage involved).
// Real saving/loading and app-wide styling are checked after F05, F11 and F18 merge.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  loadInitialSettings,
  saveSettingsSafely,
  SETTINGS_MESSAGES,
} from '../src/features/settings/settings-helpers.ts';

const defaults = { textSize: 'standard', colorScheme: 'light', reduceMotion: false };
const saved = { textSize: 'large', colorScheme: 'dark', reduceMotion: true };

test('nothing saved yet: uses the defaults with no error', async () => {
  const result = await loadInitialSettings(async () => null, defaults);
  assert.deepEqual(result, { settings: defaults, error: null });
});

test('saved preferences are used', async () => {
  const result = await loadInitialSettings(async () => saved, defaults);
  assert.deepEqual(result, { settings: saved, error: null });
});

test('load failure: uses the defaults and gives a safe message', async () => {
  const result = await loadInitialSettings(async () => {
    throw new Error('corrupt data');
  }, defaults);
  assert.deepEqual(result, { settings: defaults, error: SETTINGS_MESSAGES.loadFailed });
});

test('a successful save returns no error', async () => {
  const written = [];
  const error = await saveSettingsSafely(async (s) => { written.push(s); }, saved);
  assert.equal(error, null);
  assert.deepEqual(written, [saved]);
});

test('a failed save does not claim success', async () => {
  const error = await saveSettingsSafely(async () => {
    throw new Error('disk full');
  }, saved);
  assert.equal(error, SETTINGS_MESSAGES.saveFailed);
});
