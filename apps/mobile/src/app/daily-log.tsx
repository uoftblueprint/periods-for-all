// S3-08: real route for one day's log. The screen itself is S3-06's.
// Every way of leaving (header Back, swipe back, the screen's own Back) first waits for
// the screen's pending saves. If saving fails, the user stays with Retry / Stay.
import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove, type NavigationAction } from 'expo-router/react-navigation';
import { Text, View } from 'react-native';
import { AppButton } from '@/components/app-button';
import { parseDate } from '@/features/calendar/calendar-dates';
import { DailyLogScreen, RequireHealthStore, leaveToCalendar, localToday } from '@/features/health/health-routes';
import { getAppearance } from '@/features/settings/appearance';
import { useSettings } from '@/features/settings/settings-provider';
import { PreviewScreen } from '@/foundation/preview-screen';

/** Resolves true when everything is saved, false if something is still unsaved. */
type ExitGuard = () => Promise<boolean>;

export default function DailyLogRoute() {
  const appearance = getAppearance(useSettings().settings);
  const [today] = useState(localToday);
  const params = useLocalSearchParams<{ date?: string }>();
  const date = typeof params.date === 'string' ? params.date : '';
  const text = { color: appearance.colors.text, fontSize: 16 * appearance.fontScale };

  // ---- Leave only after saving ----
  const navigation = useNavigation();
  const guard = useRef<ExitGuard | null>(null); // the screen's "save everything now"
  const checking = useRef(false); // ignores a second swipe while the first is still saving
  const [failedExit, setFailedExit] = useState<NavigationAction | null>(null); // kept for Retry
  const [leaving, setLeaving] = useState<NavigationAction | null>(null);

  // The screen hands us its guard; calling the returned function removes it.
  const registerExitGuard = useCallback((next: ExitGuard) => {
    guard.current = next;
    return () => { if (guard.current === next) guard.current = null; };
  }, []);

  async function tryToLeave(action: NavigationAction) {
    if (checking.current) return;
    checking.current = true;
    setFailedExit(null);
    let saved: boolean;
    try {
      saved = guard.current ? await guard.current() : true;
    } catch {
      saved = false;
    }
    checking.current = false;
    if (saved) setLeaving(action);
    else setFailedExit(action);
  }

  // Stops the screen closing until tryToLeave says it's safe.
  usePreventRemove(leaving === null, ({ data }) => { void tryToLeave(data.action); });

  // Runs after the blocker is turned off, so the original Back/swipe can finish.
  useEffect(() => {
    if (leaving) navigation.dispatch(leaving);
  }, [leaving, navigation]);

  const saveFailed = failedExit && (
    <View accessibilityRole="alert">
      <Text style={text}>Your changes couldn’t be saved.</Text>
      <AppButton appearance={appearance} label="Retry" onPress={() => { void tryToLeave(failedExit); }} />
      <AppButton appearance={appearance} label="Stay" onPress={() => setFailedExit(null)} />
    </View>
  );

  if (!parseDate(date) || date > today) {
    return (
      <PreviewScreen title="Daily log" appearance={appearance}>
        <View>
          <Text accessibilityRole="alert" style={text}>This day can’t be logged.</Text>
          <AppButton appearance={appearance} label="Back to calendar" onPress={leaveToCalendar} />
        </View>
      </PreviewScreen>
    );
  }

  return (
    <PreviewScreen title="Daily log" appearance={appearance}>
      {saveFailed}
      <RequireHealthStore appearance={appearance}>
        {(store, userId) => (
          <DailyLogScreen
            key={userId}
            date={date}
            today={today}
            store={store}
            appearance={appearance}
            onDateChange={(next) => router.setParams({ date: next })}
            onExit={leaveToCalendar}
            registerExitGuard={registerExitGuard}
          />
        )}
      </RequireHealthStore>
    </PreviewScreen>
  );
}