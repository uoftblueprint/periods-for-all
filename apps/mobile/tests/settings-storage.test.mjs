import assert from 'node:assert/strict';
import test, { beforeEach, mock } from 'node:test';

// Mock Expo SQLite so tests don't need a real device.
mock.module('expo-sqlite/localStorage/install', {});

// Fake localStorage for testing.
const SETTINGS_KEY = 'accessibility-settings';
const records = new Map();

let failRead = false;
let failWrite = false;

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem(key) {
      if (failRead) throw new Error('Fake read failure');
      return records.get(key) ?? null;
    },

    setItem(key, value) {
      if (failWrite) throw new Error('Fake write failure');
      records.set(key, String(value));
    },
  },
});

// Import the functions we're testing.
const { saveSettings, loadSettings } =
  await import('../src/features/settings/settings-storage.ts');

const sample = {
  textSize: 'large',
  colorScheme: 'dark',
  reduceMotion: true,
};

// Reset fake storage before each test.
beforeEach(() => {
  records.clear();
  failRead = false;
  failWrite = false;
});

// Test 1: Save and load settings.
test('save and load preserves all settings', async () => {
  await saveSettings(sample);

  const loaded = await loadSettings();

  assert.deepEqual(loaded, sample);
});

// Test 2: No settings saved.
test('load returns null when nothing is saved', async () => {
  assert.equal(await loadSettings(), null);
});

// Test 3: Invalid settings values.
test('loading invalid values rejects', async () => {
  records.set(
    SETTINGS_KEY,
    JSON.stringify({ ...sample, textSize: 'huge' })
  );

  await assert.rejects(loadSettings(), /Invalid settings/);
});

// Test 4: Unexpected fields.
test('loading extra keys rejects', async () => {
  records.set(
    SETTINGS_KEY,
    JSON.stringify({ ...sample, username: 'abc' })
  );

  await assert.rejects(loadSettings(), /Invalid settings/);
});

// Test 5: Corrupted JSON.
test('loading corrupt JSON rejects', async () => {
  records.set(SETTINGS_KEY, '{invalid JSON');

  await assert.rejects(loadSettings(), '/Invalid settings/');
});

// Test 6: Fake read failure.
test('fake storage read failure rejects', async () => {
  failRead = true;

  await assert.rejects(loadSettings(), /Fake read failure/);
});

// Test 7: Fake write failure.
test('fake storage write failure rejects', async () => {
  failWrite = true;

  await assert.rejects(saveSettings(sample), /Fake write failure/);
});

// Test 8: Original object is not modified.
test('saving does not mutate its input', async () => {
  const settings = { ...sample };
  const original = { ...settings };

  await saveSettings(settings);

  assert.deepEqual(settings, original);
});