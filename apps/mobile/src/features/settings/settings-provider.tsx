import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { defaultSettings, type Settings } from '@/foundation/contracts';
import { loadSettings, saveSettings } from './settings-storage';
import { loadInitialSettings, saveSettingsSafely } from './settings-helpers';

type SettingsContextValue = {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  error: string | null;
  isLoading: boolean;
  loadError: string | null;
  retryLoad: () => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const latest = useRef<Settings>(defaultSettings);
  const loaded = useRef(false);
  const mounted = useRef(true);
  const pending = useRef<Partial<Settings>>({});
  const waiting = useRef<{ resolve: () => void; reject: (error: Error) => void }[]>([]);
  const saveCount = useRef(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  const save = useCallback(async (next: Settings) => {
    const id = ++saveCount.current;
    const run = saveQueue.current.then(() => saveSettingsSafely(saveSettings, next));
    // Queue recovery is separate from the caller's rejected save promise.
    saveQueue.current = run.then(() => {}, () => {});
    const message = await run;
    if (mounted.current && id === saveCount.current) setError(message);
    if (message) throw new Error(message);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      waiting.current.splice(0).forEach(({ reject }) => reject(new Error('Settings provider was closed.')));
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      await saveQueue.current;
      const result = await loadInitialSettings(loadSettings, defaultSettings);
      if (!active) return;
      setLoadError(result.error);
      setError(result.error);
      if (result.error) {
        const failure = new Error(result.error);
        waiting.current.splice(0).forEach(({ reject }) => reject(failure));
        setIsLoading(false);
        return;
      }
      const changes = pending.current;
      pending.current = {};
      const callers = waiting.current.splice(0);
      const next = { ...result.settings, ...changes };
      latest.current = next;
      loaded.current = true;
      setSettings(next);
      try {
        if (Object.keys(changes).length) await save(next);
        callers.forEach(({ resolve }) => resolve());
      } catch (cause) {
        const failure = cause instanceof Error ? cause : new Error('Could not save settings.');
        callers.forEach(({ reject }) => reject(failure));
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [attempt, save]);

  const retryLoad = useCallback(() => {
    loaded.current = false;
    setIsLoading(true);
    setLoadError(null);
    setAttempt((n) => n + 1);
  }, []);

  async function updateSettings(patch: Partial<Settings>) {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setSettings(next);
    if (!loaded.current) {
      pending.current = { ...pending.current, ...patch };
      return new Promise<void>((resolve, reject) => waiting.current.push({ resolve, reject }));
    }
    await save(next);
  }

  return <SettingsContext.Provider value={{ settings, updateSettings, error, isLoading, loadError, retryLoad }}>
    {children}
  </SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings() must be used inside <SettingsProvider>.');
  return value;
}
