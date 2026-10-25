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

for (const textSize of ['standard', 'large']) {
  for (const colorScheme of ['light', 'dark']) {
    for (const reduceMotion of [false, true]) {
      test(`fake storage round-trip: ${textSize}, ${colorScheme}, reduceMotion=${reduceMotion}`, async () => {
        const settings = Object.freeze({ textSize, colorScheme, reduceMotion });

        await saveSettings(settings);

        assert.deepEqual(await loadSettings(), settings);
      });
    }
  }
}

for (const [description, settings] of [
  ['non-string text size', { ...sample, textSize: 1 }],
  ['unknown colour scheme', { ...sample, colorScheme: 'sepia' }],
  ['non-string colour scheme', { ...sample, colorScheme: 1 }],
  ['string motion value', { ...sample, reduceMotion: 'false' }],
  ['numeric motion value', { ...sample, reduceMotion: 0 }],
  ['missing text size', { colorScheme: 'dark', reduceMotion: true }],
  ['missing colour scheme', { textSize: 'large', reduceMotion: true }],
  ['missing motion value', { textSize: 'large', colorScheme: 'dark' }],
  ['null', null],
  ['array', []],
  ['string', 'large'],
  ['number', 1],
  ['boolean', false],
]) {
  test(`loading ${description} rejects`, async () => {
    records.set(SETTINGS_KEY, JSON.stringify(settings));

    await assert.rejects(loadSettings(), /Invalid settings/);
  });
}

test('load returns null when nothing is saved', async () => {
  assert.equal(await loadSettings(), null);
});

test('loading invalid values rejects', async () => {
  records.set(
    SETTINGS_KEY,
    JSON.stringify({ ...sample, textSize: 'huge' })
  );

  await assert.rejects(loadSettings(), /Invalid settings/);
});

test('loading extra keys rejects', async () => {
  records.set(
    SETTINGS_KEY,
    JSON.stringify({ ...sample, username: 'abc' })
  );

  await assert.rejects(loadSettings(), /Invalid settings/);
});

test('loading corrupt JSON rejects', async () => {
  records.set(SETTINGS_KEY, '{invalid JSON');

  await assert.rejects(loadSettings(), /Invalid settings/);
});

test('fake storage read failure rejects', async () => {
  failRead = true;

  await assert.rejects(loadSettings(), /Fake read failure/);
});

test('fake storage write failure rejects', async () => {
  failWrite = true;

  await assert.rejects(saveSettings(sample), /Fake write failure/);
});

test('saving does not mutate its input', async () => {
  const settings = { ...sample };
  const original = { ...settings };

  await saveSettings(settings);

  assert.deepEqual(settings, original);
});
