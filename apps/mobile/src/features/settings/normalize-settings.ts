import { colorSchemes, defaultSettings, textSizes, type Settings } from '@/foundation/contracts';

function isOneOf<T extends string>(allowed: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Converts stored data into valid settings, preserving valid fields and replacing
 * invalid or missing fields with defaults.
 */
export function normalizeSettings(raw: unknown): Settings {
  if (!isRecord(raw)) return { ...defaultSettings };

  return {
    textSize: isOneOf(textSizes, raw.textSize) ? raw.textSize : defaultSettings.textSize,
    colorScheme: isOneOf(colorSchemes, raw.colorScheme)
      ? raw.colorScheme
      : defaultSettings.colorScheme,
    reduceMotion:
      typeof raw.reduceMotion === 'boolean' ? raw.reduceMotion : defaultSettings.reduceMotion,
  };
}
