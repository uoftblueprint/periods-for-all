import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { router, Stack, usePathname } from 'expo-router';
import { Text } from 'react-native';
import { AuthProvider, useAuth } from '@/features/auth/auth-provider';
import { createSessionAuth } from '@/features/auth/session-auth';
import { OnboardingGate } from '@/features/onboarding/onboarding-gate';
import { OnboardingShell } from '@/features/onboarding/onboarding-shell';
import { deviceCompletionStore } from '@/features/onboarding/device-completion-store';
import { getAppearance } from '@/features/settings/appearance';
import { SettingsProvider, useSettings } from '@/features/settings/settings-provider';
import { createDemoAuth } from '@/foundation/demo-auth';

export const unstable_settings = { anchor: 'login' };

export default function RootLayout() {
  if (!__DEV__) return <Text>This development starter is not a release build.</Text>;
  return <DevelopmentApp />;
}

async function loadAuth() {
  const mode = process.env.EXPO_PUBLIC_AUTH_MODE ?? 'demo';
  if (mode === 'demo') return createDemoAuth();
  if (mode !== 'supabase') throw new Error('Set EXPO_PUBLIC_AUTH_MODE to demo or supabase, then restart Expo.');
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local, then restart Expo.');
  }
  const { createSupabaseAuth } = await import('@/features/auth/supabase-auth');
  return createSupabaseAuth();
}

function DevelopmentApp() {
  const [session] = useState(() => createSessionAuth(loadAuth));
  return <AuthProvider service={session.service}>
    <SettingsProvider><AuthRoutes session={session} /></SettingsProvider>
  </AuthProvider>;
}

function AuthRoutes({ session }: { session: ReturnType<typeof createSessionAuth> }) {
  const auth = useAuth();
  const preferences = useSettings();
  const identity = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const pathname = usePathname();
  const appearance = getAppearance(preferences.settings);
  const previousStatus = useRef(auth.status);
  const onHomeReady = useCallback(() => router.replace('/home'), []);
  const matchesUser = auth.user?.id === identity.userId;
  const checking = identity.pending || (auth.status === 'signedIn' && !matchesUser);

  useEffect(() => {
    if (previousStatus.current === 'signedIn' && auth.status === 'signedOut') router.replace('/login');
    previousStatus.current = auth.status;
  }, [auth.status]);

  const navigator = <Stack screenOptions={{
    headerTitle: 'Periods for All · Development',
    animation: appearance.reduceMotion ? 'none' : 'default',
    headerStyle: { backgroundColor: appearance.colors.background },
    headerTintColor: appearance.colors.text,
    headerTitleStyle: { fontSize: 18 * appearance.fontScale },
    contentStyle: { backgroundColor: appearance.colors.background },
  }}>
    <Stack.Screen name="login" />
    <Stack.Protected guard={auth.status === 'signedIn' && matchesUser}>
      <Stack.Screen name="home" />
    </Stack.Protected>
  </Stack>;

  return <OnboardingGate
    auth={checking ? { ...auth, status: 'checking' } : auth}
    sessionId={identity.generation}
    sessionKey={identity.key}
    getSessionKey={session.getWorkKey}
    settings={preferences.isLoading || preferences.loadError ? null : preferences.settings}
    settingsError={preferences.loadError}
    onRetry={() => {
      if (auth.status === 'error') auth.retry();
      if (preferences.loadError) preferences.retryLoad();
    }}
    saveSettings={preferences.updateSettings}
    completionStore={deviceCompletionStore}
    render={(model) => <OnboardingShell
      model={model}
      navigator={navigator}
      appearance={appearance}
      bypass={!['/login', '/home', '/settings'].includes(pathname)}
      sessionId={identity.generation}
      workKey={identity.key}
      getWorkKey={session.getWorkKey}
      onHomeReady={onHomeReady}
    />}
  />;
}
