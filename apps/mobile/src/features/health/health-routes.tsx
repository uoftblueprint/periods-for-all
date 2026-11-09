// S3-08: shared code for the real health routes (calendar, period-edit, daily-log):
// the per-user HealthStore, loading that ignores late results, and small date/navigation helpers.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { AppButton } from '@/components/app-button';
import { addDays, daysInMonth, formatDate, parseMonth } from '@/features/calendar/calendar-dates';
import type { Appearance } from '@/features/settings/appearance';
import { createPlaceholderHealthStore, type HealthStore } from './s3-08-placeholders';

// ---- Pieces owned by other Sprint 3 tickets: the ONE place routes get them from ----
// While those tickets are unmerged, these point at s3-08-placeholders.tsx.
// When one merges, change only its line here; the routes don't change.
// TODO(S3-01): from './contracts'
export type { DailyLog, DailyLogPatch, HealthStore, LocalDate } from './s3-08-placeholders';
// TODO(S3-07): export { DayDetails } from '@/features/calendar/day-details';
export { PlaceholderDayDetails as DayDetails } from './s3-08-placeholders';
// TODO(S3-03): export { PeriodDateEditor } from '@/features/calendar/period-date-editor';
export { PlaceholderPeriodDateEditor as PeriodDateEditor } from './s3-08-placeholders';
// TODO(S3-06): export { DailyLogScreen } from './daily-log-screen';
export { PlaceholderDailyLogScreen as DailyLogScreen } from './s3-08-placeholders';

// ---- Creating the store for one signed-in user ----
export async function loadHealthStore(userId: string): Promise<HealthStore> {
  const mode = process.env.EXPO_PUBLIC_AUTH_MODE ?? 'demo';
  // Demo accounts get a fresh in-memory store with made-up data only.
  // TODO(S3-01): use the real demo store here.
  if (mode !== 'supabase') return createPlaceholderHealthStore();
  // TODO(S3-02): create the real store bound to `userId`, loaded lazily like
  // supabase-auth in _layout.tsx. Until then, say so instead of showing fake data.
  void userId;
  throw new Error('Health records are not connected to the development backend yet (S3-02).');
}

// ---- One store per signed-in user ----
type StoreState =
  | { status: 'signedOut' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; store: HealthStore; userId: string };

type HealthStoreValue = StoreState & { retry: () => void };

const HealthStoreContext = createContext<HealthStoreValue | null>(null);

/**
 * Creates a new store whenever the signed-in user changes, so a store (and anything it
 * cached) never outlives its account. `userId` is null when nobody is signed in.
 */
export function HealthStoreProvider({ userId, createStore, children }: {
  userId: string | null;
  createStore: (userId: string) => Promise<HealthStore>;
  children: ReactNode;
}) {
  const [state, setState] = useState<StoreState>({ status: userId ? 'loading' : 'signedOut' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!userId) {
      setState({ status: 'signedOut' });
      return;
    }
    let active = true;
    setState({ status: 'loading' });
    createStore(userId).then(
      (store) => { if (active) setState({ status: 'ready', store, userId }); },
      () => { if (active) setState({ status: 'error' }); },
    );
    return () => { active = false; };
  }, [userId, createStore, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // Right after the user changes, the old store is still in state until the effect runs.
  // Never hand it out under the new account.
  const current: StoreState =
    state.status === 'ready' && state.userId !== userId ? { status: userId ? 'loading' : 'signedOut' } : state;

  return <HealthStoreContext.Provider value={{ ...current, retry }}>{children}</HealthStoreContext.Provider>;
}

export function useHealthStore(): HealthStoreValue {
  const value = useContext(HealthStoreContext);
  if (!value) throw new Error('useHealthStore() must be used inside <HealthStoreProvider>.');
  return value;
}

/** Shows loading / error + retry until the user's store is ready, then renders children with it. */
export function RequireHealthStore({ appearance, children }: {
  appearance: Appearance;
  children: (store: HealthStore, userId: string) => ReactNode;
}) {
  const health = useHealthStore();
  const text = { color: appearance.colors.text, fontSize: 16 * appearance.fontScale };
  if (health.status === 'ready') return <>{children(health.store, health.userId)}</>;
  if (health.status === 'error') {
    return (
      <View>
        <Text accessibilityRole="alert" style={text}>We couldn’t open your health records.</Text>
        <AppButton appearance={appearance} label="Try again" onPress={health.retry} />
      </View>
    );
  }
  if (health.status === 'signedOut') return <Text style={text}>Sign in to see your calendar.</Text>;
  return (
    <View>
      <ActivityIndicator accessibilityLabel="Loading your health records" />
      <Text accessibilityLiveRegion="polite" style={text}>Loading…</Text>
    </View>
  );
}

// ---- Loading data ----
export type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: T };

/**
 * Runs `load` whenever `key` changes (or on retry). A result from an older key is ignored,
 * so a slow response for a previous month, day or account can never replace newer data.
 * A failed load is reported as 'error', never as empty data.
 */
export function useLoad<T>(key: string, load: () => Promise<T>): LoadState<T> & { retry: () => void } {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    // `load` is read from the render that changed `key`, which is the one it belongs to.
    load().then(
      (data) => { if (active) setState({ status: 'ready', data }); },
      () => { if (active) setState({ status: 'error' }); },
    );
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}

// ---- Date and navigation helpers ----
/** Today's date on this device, as YYYY-MM-DD in local time (never UTC). */
export function localToday(now: Date = new Date()): string {
  return formatDate({ year: now.getFullYear(), month: now.getMonth() + 1 }, now.getDate());
}

/**
 * Dates to load for a calendar month. Includes the day before the 1st and the day after
 * the last, so a period running across a month edge is drawn as one continuous bar.
 */
export function visibleRange(month: string): { from: string; to: string } {
  const ym = parseMonth(month);
  if (!ym) throw new Error(`Not a month: ${month}`);
  const first = addDays({ ...ym, day: 1 }, -1);
  const last = addDays({ ...ym, day: daysInMonth(ym) }, 1);
  return { from: formatDate(first, first.day), to: formatDate(last, last.day) };
}

/** Go back to the screen we came from, or to the calendar if there isn't one. */
export function leaveToCalendar() {
  if (router.canGoBack()) router.back();
  else router.replace('/calendar');
}
