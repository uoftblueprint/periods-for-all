import assert from 'node:assert/strict';
import test from 'node:test';

import {
  displayPositions,
  resolveDisplaySettingsChange,
  transitionDisplayFlow,
} from '../src/features/onboarding/display-flow.ts';

const expected = {
  introduction: {
    continue: { type: 'position', position: 'font' },
    back: { type: 'exit' },
    skip: { type: 'finish' },
  },
  font: {
    continue: { type: 'position', position: 'motion' },
    back: { type: 'position', position: 'introduction' },
    skip: { type: 'position', position: 'motion' },
  },
  motion: {
    continue: { type: 'position', position: 'theme' },
    back: { type: 'position', position: 'font' },
    skip: { type: 'position', position: 'theme' },
  },
  theme: {
    continue: { type: 'finish' },
    back: { type: 'position', position: 'motion' },
    skip: { type: 'finish' },
  },
};

for (const position of displayPositions) {
  for (const action of ['continue', 'back', 'skip']) {
    test(`${action} from ${position}`, () => {
      const settings = Object.freeze({
        textSize: 'largest',
        colorScheme: 'dark',
        reduceMotion: true,
      });
      const result = transitionDisplayFlow({ position, settings }, action);

      assert.deepEqual(result.navigation, expected[position][action]);
      assert.equal(result.settings, settings);
    });
  }
}

test('setting changes are rejected while finish is in flight', () => {
  const current = Object.freeze({ textSize: 'large', colorScheme: 'dark', reduceMotion: true });
  const next = { ...current, colorScheme: 'light' };

  assert.equal(resolveDisplaySettingsChange(current, next, true), current);
  assert.equal(resolveDisplaySettingsChange(current, next, false), next);
});
