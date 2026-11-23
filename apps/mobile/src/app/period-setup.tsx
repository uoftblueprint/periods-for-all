// S3-10: real route for period setup. The screens are S3-09's; this file loads and saves the
// signed-in user's answers through their HealthStore, so setup can resume where it stopped.
import { useCallback, useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { AppButton } from '@/components/app-button';
import { RequireHealthStore, localToday, type HealthStore } from '@/features/health/health-routes';
import {
  StalePeriodSetupError, createPeriodSetupSession, startingPoint,
  type PeriodSetup, type PeriodSetupSession,
} from '@/features/onboarding/period-setup-progress';
import { PeriodSetupScreen } from '@/features/onboarding/period-setup-screen';
import { getAppearance, type Appearance } from '@/features/settings/appearance';
import { useSettings } from '@/features/settings/settings-provider';

/** Back to where the user came from (home, or the display-setup hand-off), or home if nothing. */
function leavePeriodSetup() {
  if (router.canGoBack()) router.back();
  else router.replace('/home');
}

export default function PeriodSetupRoute() {
  const appearance = getAppearance(useSettings().settings);
  return (
    <View style={{ flex: 1, backgroundColor: appearance.colors.background }}>
      <RequireHealthStore appearance={appearance}>
        {/* A new key per account, so nothing from the previous account stays on screen. */}
        {(store, userId) => <PeriodSetupContent key={userId} store={store} userId={userId} appearance={appearance} />}
      </RequireHealthStore>
    </View>
  );
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; session: PeriodSetupSession; initialValue: PeriodSetup };

function PeriodSetupContent({ store, userId, appearance }: {
  store: HealthStore;
  userId: string;
  appearance: Appearance;
}) {
  const [today] = useState(localToday);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const text = { color: appearance.colors.text, fontSize: 16 * appearance.fontScale };
  // Finishing can be reported more than once (e.g. by both the save and a re-render);
  // leave only once, so Back never pops past the screen we came from.
  const left = useRef(false);
  const leave = useCallback(() => {
    if (left.current) return;
    left.current = true;
    leavePeriodSetup();
  }, []);

  useEffect(() => {
    // One session per load. Disposing it when this screen goes away (leaving, sign-out or an
    // account switch) makes any late load or save reject instead of finishing setup.
    const session = createPeriodSetupSession({ userId, store, today });
    setState({ status: 'loading' });
    session.load().then(
      (setup) => setState({ status: 'ready', session, initialValue: startingPoint(setup) }),
      (error) => { if (!(error instanceof StalePeriodSetupError)) setState({ status: 'error' }); },
    );
    return () => session.dispose();
  }, [userId, store, today, attempt]);

  if (state.status === 'loading') {
    return (
      <View style={{ padding: 24, gap: 16 }}>
        <ActivityIndicator accessibilityLabel="Loading your period setup" />
        <Text accessibilityLiveRegion="polite" style={text}>Loading your period setup…</Text>
      </View>
    );
  }
  if (state.status === 'error') {
    // Never open the screens from a failed read: saving from empty answers would erase real ones.
    return (
      <View style={{ padding: 24, gap: 16 }}>
        <Text accessibilityRole="alert" style={text}>We couldn’t load your period setup.</Text>
        <AppButton appearance={appearance} label="Try again" onPress={() => setAttempt((n) => n + 1)} />
        <AppButton appearance={appearance} label="Back to home" onPress={leavePeriodSetup} />
      </View>
    );
  }
  return (
    <PeriodSetupScreen
      initialValue={state.initialValue}
      today={today}
      appearance={appearance}
      // Each step is saved before the screen moves on; a failed save keeps the user on the step.
      onSave={state.session.save}
      onFinish={leave}
      onExit={leave}
    />
  );
}
