import assert from 'node:assert/strict';
import test from 'node:test';

import { Colors, FontScale } from '../src/constants/theme.ts';
import { getAppearance } from '../src/features/settings/appearance.ts';
import { colorSchemes, textSizes } from '../src/foundation/contracts.ts';

const base = { textSize: 'standard', colorScheme: 'light', reduceMotion: false };

for (const textSize of textSizes) {
  test(`${textSize} maps to its font scale`, () => {
    assert.equal(getAppearance({ ...base, textSize }).fontScale, FontScale[textSize]);
  });
}

for (const colorScheme of colorSchemes) {
  test(`${colorScheme} maps to its palette`, () => {
    assert.equal(getAppearance({ ...base, colorScheme }).colors, Colors[colorScheme]);
  });
}

test('reduce motion passes through unchanged', () => {
  assert.equal(getAppearance({ ...base, reduceMotion: false }).reduceMotion, false);
  assert.equal(getAppearance({ ...base, reduceMotion: true }).reduceMotion, true);
});

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((index) => {
    const channel = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(first, second) {
  const [high, low] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (high + 0.05) / (low + 0.05);
}

for (const colorScheme of colorSchemes) {
  test(`${colorScheme} text meets WCAG AA on every surface`, () => {
    const palette = Colors[colorScheme];
    for (const surface of ['background', 'backgroundElement', 'backgroundSelected']) {
      for (const textColor of ['text', 'textSecondary']) {
        const ratio = contrast(palette[textColor], palette[surface]);
        assert.ok(ratio >= 4.5, `${textColor} on ${surface}: ${ratio.toFixed(2)}:1`);
      }
    }
  });
}
