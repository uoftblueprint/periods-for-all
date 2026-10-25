import assert from 'node:assert/strict';
import test, { beforeEach, mock } from 'node:test';

mock.module('expo-sqlite/localStorage/install', {});

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

const { loadSettings, saveSettings } =
  await import('../src/features/settings/settings-storage.ts');
const { colorSchemes, defaultSettings, textSizes } =
  await import('../src/foundation/contracts.ts');

const sample = { textSize: 'large', colorScheme: 'dark', reduceMotion: true };

beforeEach(() => {
  records.clear();
  failRead = false;
  failWrite = false;
});

for (const textSize of textSizes) {
  for (const colorScheme of colorSchemes) {
    for (const reduceMotion of [false, true]) {
      test(`storage round-trip: ${textSize}, ${colorScheme}, ${reduceMotion}`, async () => {
        const settings = Object.freeze({ textSize, colorScheme, reduceMotion });
        await saveSettings(settings);
        assert.deepEqual(await loadSettings(), settings);
      });
    }
  }
}

for (const [description, stored, expected] of [
  ['unknown text size', { ...sample, textSize: 'huge' }, { ...sample, textSize: 'standard' }],
  ['unknown colour scheme', { ...sample, colorScheme: 'sepia' }, { ...sample, colorScheme: 'light' }],
  ['invalid motion', { ...sample, reduceMotion: 'false' }, { ...sample, reduceMotion: false }],
  ['missing motion', { textSize: 'large', colorScheme: 'dark' }, { ...sample, reduceMotion: false }],
  ['extra keys', { ...sample, username: 'example' }, sample],
  ['null', null, defaultSettings],
  ['array', [], defaultSettings],
]) {
  test(`loading ${description} normalizes stored settings`, async () => {
    records.set(SETTINGS_KEY, JSON.stringify(stored));
    assert.deepEqual(await loadSettings(), expected);
  });
}

test('load returns null when nothing is saved', async () => {
  assert.equal(await loadSettings(), null);
});

test('corrupt JSON falls back to defaults', async () => {
  records.set(SETTINGS_KEY, '{invalid JSON');
  assert.deepEqual(await loadSettings(), defaultSettings);
});

test('storage read and write failures reject', async () => {
  failRead = true;
  await assert.rejects(loadSettings(), /Fake read failure/);
  failRead = false;
  failWrite = true;
  await assert.rejects(saveSettings(sample), /Fake write failure/);
});
