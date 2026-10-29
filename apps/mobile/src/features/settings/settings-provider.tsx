// F01: shares accessibility settings with the whole app and saves changes.

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { defaultSettings, type Settings } from '@/foundation/contracts';
import { loadSettings, saveSettings } from './settings-storage';
import { loadInitialSettings, saveSettingsSafely } from './settings-helpers';

type SettingsContextValue = {
  settings: Settings;
  // Pass only the fields that changed, e.g. updateSettings({ textSize: 'large' }).
  // A full Settings object is still accepted.
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  error: string | null;
};

// A shared box that any screen can open with useSettings().
const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [error, setError] = useState<string | null>(null);

  // Refs change immediately, without waiting for the screen to redraw.
  const latest = useRef<Settings>(defaultSettings);  // newest settings
  const loaded = useRef(false);                       // has the first load finished?
  const pending = useRef<Partial<Settings>>({});      // changes made before it finished
  const saveCount = useRef(0);                        // numbers each save
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve()); // saves run one at a time

  // Saves in order, and only the newest save decides the message.
  async function save(next: Settings) {
    const id = ++saveCount.current;
    // Wait for earlier saves to finish first, so an older save can never land
    // after a newer one and leave old settings on the device.
    const run = saveQueue.current.then(() => saveSettingsSafely(saveSettings, next));
    saveQueue.current = run;
    const saveError = await run;
    if (id === saveCount.current) setError(saveError);
  }

  // When the app starts, load saved preferences once.
  useEffect(() => {
    let cancelled = false; // set if React cleans this effect up before it finishes

    async function load() {
      const result = await loadInitialSettings(loadSettings, defaultSettings);
      if (cancelled) return;

      // Keep any change the user made while loading, on top of what was saved.
      const changedWhileLoading = pending.current;
      pending.current = {};
      const merged = { ...result.settings, ...changedWhileLoading };
      latest.current = merged;
      setSettings(merged);
      setError(result.error);
      loaded.current = true;

      if (Object.keys(changedWhileLoading).length > 0) {
        await save(merged);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Called when the user changes a setting: merge it in, show it now, then save.
  async function updateSettings(patch: Partial<Settings>) {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setSettings(next);

    if (!loaded.current) {
      // Saved preferences aren't known yet, and saving now could overwrite
      // them. Remember the change; it is saved once loading finishes.
      pending.current = { ...pending.current, ...patch };
      return;
    }
    await save(next);
  }

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