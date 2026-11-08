import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { createAutosave, type Answers, type Autosave, type SaveStatus } from '@/features/health/autosave';
import type { HealthStore, LocalDate } from '@/features/health/health-types';

export type DailyLogState =
  | { phase: 'loading' }
  | { phase: 'error'; retry: () => void }
  | { phase: 'ready'; autosave: Autosave; draft: Answers; status: SaveStatus };

const noSubscribe = () => () => {};
const noSnapshot = () => null;

// loads one day and passes its answers to an autosave controller for that day
export function useDailyLog(store: HealthStore, date: LocalDate): DailyLogState {
  const [autosave, setAutosave] = useState<Autosave | null>(null);
  const [failedDate, setFailedDate] = useState<LocalDate | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let created: Autosave | null = null;
    setFailedDate(null);
    store.getDailyLog(date).then(
      ({ date: _date, ...answers }) => {
        if (!active) return; // a newer date, account or retry took over
        created = createAutosave({ date, store, initial: answers });
        setAutosave(created);
      },
      () => {
        if (active) setFailedDate(date);
      },
    );
    return () => {
      active = false;
      created?.dispose();
      setAutosave(null); // a disposed controller must never be shown again
    };
  }, [store, date, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // only show a controller once this date's load finishes, never another day's
  const current = autosave?.date === date ? autosave : null;
  // re-renders whenever controller reports a change.
  const snapshot = useSyncExternalStore(
    current ? current.subscribe : noSubscribe,
    current ? current.getSnapshot : noSnapshot,
  );

  if (current && snapshot) return { phase: 'ready', autosave: current, ...snapshot };
  if (failedDate === date) return { phase: 'error', retry };
  return { phase: 'loading' };
}
