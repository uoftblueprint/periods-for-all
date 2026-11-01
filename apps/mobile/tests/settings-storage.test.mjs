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
const { defaultSettings } = await import('../src/foundation/contracts.ts');

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

for (const textSize of ['standard', 'large', 'extraLarge', 'largest']) {
  for (const colorScheme of ['light', 'dark', 'highContrast']) {
    for (const reduceMotion of [false, true]) {
      test(`fake storage round-trip: ${textSize}, ${colorScheme}, reduceMotion=${reduceMotion}`, async () => {
        const settings = Object.freeze({ textSize, colorScheme, reduceMotion });

        await saveSettings(settings);

        assert.deepEqual(await loadSettings(), settings);
      });
    }
  }
}

// Field-by-field rules are covered in normalize-settings.test.mjs; these check loading uses them.
for (const [description, settings, expected] of [
  ['unknown text size', { ...sample, textSize: 'huge' }, { ...sample, textSize: 'standard' }],
  ['unknown colour scheme', { ...sample, colorScheme: 'sepia' }, { ...sample, colorScheme: 'light' }],
  ['string motion value', { ...sample, reduceMotion: 'false' }, { ...sample, reduceMotion: false }],
  ['missing motion value', { textSize: 'large', colorScheme: 'dark' }, { ...sample, reduceMotion: false }],
  ['extra keys', { ...sample, username: 'abc' }, sample],
  ['null', null, defaultSettings],
  ['array', [], defaultSettings],
  ['string', 'large', defaultSettings],
]) {
  test(`loading ${description} falls back to defaults`, async () => {
    records.set(SETTINGS_KEY, JSON.stringify(settings));

    assert.deepEqual(await loadSettings(), expected);
  });
}

test('load returns null when nothing is saved', async () => {
  assert.equal(await loadSettings(), null);
});

test('loading corrupt JSON falls back to defaults', async () => {
  records.set(SETTINGS_KEY, '{invalid JSON');

  assert.deepEqual(await loadSettings(), defaultSettings);
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
