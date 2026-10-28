import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeSettings } from '../src/features/settings/normalize-settings.ts';
import {
  colorSchemes,
  defaultSettings,
  textSizes,
} from '../src/foundation/contracts.ts';

const sample = { textSize: 'large', colorScheme: 'dark', reduceMotion: true };

for (const textSize of textSizes) {
  for (const colorScheme of colorSchemes) {
    for (const reduceMotion of [false, true]) {
      test(`valid settings pass through: ${textSize}, ${colorScheme}, ${reduceMotion}`, () => {
        const settings = Object.freeze({ textSize, colorScheme, reduceMotion });
        assert.deepEqual(normalizeSettings(settings), settings);
      });
    }
  }
}

for (const [description, input, expected] of [
  ['unknown text size', { ...sample, textSize: 'huge' }, { ...sample, textSize: 'standard' }],
  ['non-string text size', { ...sample, textSize: 1 }, { ...sample, textSize: 'standard' }],
  ['unknown colour scheme', { ...sample, colorScheme: 'sepia' }, { ...sample, colorScheme: 'light' }],
  ['non-string colour scheme', { ...sample, colorScheme: 1 }, { ...sample, colorScheme: 'light' }],
  ['string motion', { ...sample, reduceMotion: 'true' }, { ...sample, reduceMotion: false }],
  ['missing text size', { colorScheme: 'dark', reduceMotion: true }, { ...sample, textSize: 'standard' }],
  ['missing colour scheme', { textSize: 'large', reduceMotion: true }, { ...sample, colorScheme: 'light' }],
  ['missing motion', { textSize: 'large', colorScheme: 'highContrast' }, { textSize: 'large', colorScheme: 'highContrast', reduceMotion: false }],
  ['extra keys', { ...sample, username: 'example' }, sample],
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
  test(`${description} produces a copy of the defaults`, () => {
    const result = normalizeSettings(input);
    assert.deepEqual(result, defaultSettings);
    assert.notEqual(result, defaultSettings);
  });
}
