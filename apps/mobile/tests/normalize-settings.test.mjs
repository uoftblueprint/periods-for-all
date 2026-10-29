import assert from 'node:assert/strict';
import test from 'node:test';
import { colorSchemes, defaultSettings, textSizes } from '../src/foundation/contracts.ts';
import { normalizeSettings } from '../src/features/settings/normalize-settings.ts';

const sample = { textSize: 'large', colorScheme: 'dark', reduceMotion: true };

for (const textSize of textSizes) {
  for (const colorScheme of colorSchemes) {
    for (const reduceMotion of [false, true]) {
      test(`valid settings pass through: ${textSize}, ${colorScheme}, reduceMotion=${reduceMotion}`, () => {
        const settings = Object.freeze({ textSize, colorScheme, reduceMotion });

        assert.deepEqual(normalizeSettings(settings), settings);
      });
    }
  }
}

test('an old saved settings object still works', () => {
  assert.deepEqual(normalizeSettings({ textSize: 'large', colorScheme: 'dark', reduceMotion: true }), sample);
});

// only  bad or missing field falls back; the valid fields are kept.
for (const [description, input, expected] of [
  ['unknown text size', { ...sample, textSize: 'huge' }, { ...sample, textSize: 'standard' }],
  ['non-string text size', { ...sample, textSize: 1 }, { ...sample, textSize: 'standard' }],
  ['unknown colour scheme', { ...sample, colorScheme: 'sepia' }, { ...sample, colorScheme: 'light' }],
  ['non-string colour scheme', { ...sample, colorScheme: 1 }, { ...sample, colorScheme: 'light' }],
  ['string motion value', { ...sample, reduceMotion: 'true' }, { ...sample, reduceMotion: false }],
  ['numeric motion value', { ...sample, reduceMotion: 1 }, { ...sample, reduceMotion: false }],
  ['missing text size', { colorScheme: 'dark', reduceMotion: true }, { ...sample, textSize: 'standard' }],
  ['missing colour scheme', { textSize: 'large', reduceMotion: true }, { ...sample, colorScheme: 'light' }],
  ['missing motion value', { textSize: 'large', colorScheme: 'highContrast' }, { textSize: 'large', colorScheme: 'highContrast', reduceMotion: false }],
  ['extra keys', { ...sample, username: 'abc' }, sample],
]) {
  test(`${description} falls back field by field`, () => {
    assert.deepEqual(normalizeSettings(Object.freeze(input)), expected);
  });
}

for (const [description, input] of [
  ['undefined', undefined],
  ['null', null],
  ['array', []],
  ['string', 'large'],
  ['number', 1],
  ['boolean', false],
  ['empty object', {}],
]) {
  test(`${description} gives the defaults`, () => {
    assert.deepEqual(normalizeSettings(input), defaultSettings);
  });
}

test('returns a new object, not the input or the shared defaults', () => {
  const input = { ...sample };

  assert.notEqual(normalizeSettings(input), input);
  assert.notEqual(normalizeSettings(null), defaultSettings);
});
