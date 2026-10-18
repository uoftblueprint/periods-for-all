// F01: shares accessibility settings with the whole app and saves changes.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { defaultSettings, type Settings } from '@/foundation/contracts';
import { loadSettings, saveSettings } from './settings-storage';
import { loadInitialSettings, saveSettingsSafely } from './settings-helpers';

type SettingsContextValue = {
  settings: Settings;
  updateSettings: (next: Settings) => Promise<void>;
  error: string | null;
};

// A shared box that any screen can open with useSettings().
const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // When the app starts, load saved preferences once.
  useEffect(() => {
    async function load() {
      const result = await loadInitialSettings(loadSettings, defaultSettings);
      setSettings(result.settings);
      setError(result.error);
      setLoaded(true);
    }
    void load();
  }, []);

  // Called when the user changes a setting: show it now, then save it.
  async function updateSettings(next: Settings) {
    setSettings(next);
    const saveError = await saveSettingsSafely(saveSettings, next);
    setError(saveError);
  }

  if (!loaded) return null;

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, error }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) {
    throw new Error('useSettings() must be used inside <SettingsProvider>.');
  }
  return value;
}
