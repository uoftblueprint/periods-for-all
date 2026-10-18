import assert from 'node:assert/strict';
import test from 'node:test';
import { Colors } from '../src/constants/theme.ts';
import { getAppearance } from '../src/features/settings/appearance.ts';

const base = { textSize: 'standard', colorScheme: 'light', reduceMotion: false };

test('text size maps to the preview font scale', () => {
  assert.equal(getAppearance({ ...base, textSize: 'standard' }).fontScale, 1);
  assert.equal(getAppearance({ ...base, textSize: 'large' }).fontScale, 1.25);
  assert.equal(getAppearance({ ...base, textSize: 'extraLarge' }).fontScale, 1.5);
  assert.equal(getAppearance({ ...base, textSize: 'largest' }).fontScale, 1.75);
});

test('colour scheme selects the existing palette', () => {
  assert.equal(getAppearance({ ...base, colorScheme: 'light' }).colors, Colors.light);
  assert.equal(getAppearance({ ...base, colorScheme: 'dark' }).colors, Colors.dark);
  assert.equal(getAppearance({ ...base, colorScheme: 'highContrast' }).colors, Colors.highContrast);
});

test('reduce motion is passed through unchanged', () => {
  assert.equal(getAppearance({ ...base, reduceMotion: false }).reduceMotion, false);
  assert.equal(getAppearance({ ...base, reduceMotion: true }).reduceMotion, true);
});

for (const textSize of ['standard', 'large']) {
  for (const colorScheme of ['light', 'dark']) {
    for (const reduceMotion of [false, true]) {
      test(`appearance preserves frozen settings: ${textSize}, ${colorScheme}, reduceMotion=${reduceMotion}`, () => {
        const settings = Object.freeze({ textSize, colorScheme, reduceMotion });

        assert.deepEqual(getAppearance(settings), {
          colors: Colors[colorScheme],
          fontScale: textSize === 'large' ? 1.25 : 1,
          reduceMotion,
        });
        assert.deepEqual(settings, { textSize, colorScheme, reduceMotion });
      });
    }
  }
}

// WCAG 2.x relative luminance and contrast ratio.
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

for (const scheme of ['light', 'dark', 'highContrast']) {
  test(`${scheme} text meets WCAG AA (4.5:1) on every surface`, () => {
    const c = Colors[scheme];
    for (const surface of ['background', 'backgroundElement', 'backgroundSelected']) {
      for (const text of ['text', 'textSecondary']) {
        const ratio = contrast(c[text], c[surface]);
        assert.ok(ratio >= 4.5, `${text} on ${surface}: ${ratio.toFixed(2)}:1`);
      }
    }
  });
}
