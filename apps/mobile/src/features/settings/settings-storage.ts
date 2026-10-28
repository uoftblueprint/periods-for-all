import 'expo-sqlite/localStorage/install';

import { normalizeSettings } from '@/features/settings/normalize-settings';
import { defaultSettings, type Settings } from '@/foundation/contracts';

const SETTINGS_KEY = 'accessibility-settings';

export async function loadSettings(): Promise<Settings | null> {
  const stored = localStorage.getItem(SETTINGS_KEY);
  if (stored === null) return null;

  try {
    return normalizeSettings(JSON.parse(stored));
  } catch {
    return { ...defaultSettings };
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
