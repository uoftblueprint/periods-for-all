// F01: two small helpers used by settings-provider.tsx.
// They have no React in them, so they can be tested with fake storage.

import type { Settings } from '@/foundation/contracts';

/** Messages that are safe to show on screen. */
export const SETTINGS_MESSAGES = {
  loadFailed: 'Could not load your saved preferences, so the defaults are being used.',
  saveFailed: 'Could not save your preferences. Your change is showing now but may be lost when the app restarts.',
} as const;

/**
 * Loads saved preferences when the app starts.
 */

export async function loadInitialSettings(
  load: () => Promise<Settings | null>,
  defaults: Settings,
): Promise<{ settings: Settings; error: string | null }> {
  try {
    const saved = await load();
    if (saved === null) {
      return { settings: defaults, error: null };
    }
    return { settings: saved, error: null };
  } catch {
    return { settings: defaults, error: SETTINGS_MESSAGES.loadFailed };
  }
}

/**
 * Saves preferences.
 * Returns null if the save worked, or an error message if it failed.
 */
export async function saveSettingsSafely(
  save: (settings: Settings) => Promise<void>,
  settings: Settings,
): Promise<string | null> {
  try {
    await save(settings);
    return null;
  } catch {
    return SETTINGS_MESSAGES.saveFailed;
  }
}
