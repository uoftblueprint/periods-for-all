import {
  AtkinsonHyperlegible_400Regular,
  AtkinsonHyperlegible_700Bold,
  useFonts,
} from '@expo-google-fonts/atkinson-hyperlegible';
import { useEffect, useRef, useState } from 'react';
import { router, Stack } from 'expo-router';
import { ActivityIndicator, Text } from 'react-native';
import { AppButton } from '@/components/app-button';
import { AuthProvider, useAuth } from '@/features/auth/auth-provider';
import type { AuthService } from '@/foundation/contracts';
import { createDemoAuth } from '@/foundation/demo-auth';
import { PreviewScreen } from '@/foundation/preview-screen';

export const unstable_settings = { anchor: 'login' };

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_700Bold,
  });

  if (fontError) throw fontError;
  if (!fontsLoaded) return null;

  // These open preview routes and fake accounts must not ship as a real app.
  if (!__DEV__) return <Text>This development starter is not a release build.</Text>;
  return <DevelopmentAuth />;
}

function DevelopmentAuth() {
  const [service, setService] = useState<AuthService | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);

  useEffect(() => {
    const mode = process.env.EXPO_PUBLIC_AUTH_MODE ?? 'demo';
    if (mode === 'demo') {
      setService(createDemoAuth());
      return;
    }
    if (mode !== 'supabase') {
      setSetupError('Set EXPO_PUBLIC_AUTH_MODE to demo or supabase, then restart Expo.');
      return;
    }
    if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
      setSetupError('Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local, then restart Expo.');
      return;
    }

    // Load Supabase only when selected; ignore results after unmount.
    let active = true;
    import('@/features/auth/supabase-auth')
      .then(({ createSupabaseAuth }) => {
        if (active) setService(createSupabaseAuth());
      })
      .catch(() => {
        if (active) setSetupError('Could not start sign-in. Check .env.local and restart Expo.');
      });
    return () => { active = false; };
  }, []);

  if (setupError) {
    return (
      <PreviewScreen title="Sign-in setup error">
        <Text accessibilityRole="alert">{setupError}</Text>
      </PreviewScreen>
    );
  }
  if (!service) return <Text accessibilityLiveRegion="polite">Loading…</Text>;
  return <AuthProvider service={service}><AuthRoutes /></AuthProvider>;
}

function AuthRoutes() {
  const { status, retry } = useAuth();
  const previousStatus = useRef(status);
  useEffect(() => {
    // Return to login when signing out from any preview.
    if (previousStatus.current === 'signedIn' && status === 'signedOut') {
      router.replace('/login');
    }
    previousStatus.current = status;
  }, [status]);
  if (status === 'checking') {
    return (
      <PreviewScreen title="Checking if you’re signed in">
        <ActivityIndicator accessibilityLabel="Checking if you’re signed in" />
        <Text accessibilityLiveRegion="polite">Checking if you’re signed in…</Text>
      </PreviewScreen>
    );
  }
  if (status === 'error') {
    return (
      <PreviewScreen title="We couldn’t check if you’re signed in">
        <Text accessibilityRole="alert">Please try again.</Text>
        <AppButton label="Try again" onPress={retry} />
      </PreviewScreen>
    );
  }
  return (
    <Stack screenOptions={{ headerTitle: 'Periods for All · Development', contentStyle: { backgroundColor: '#fff' } }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="display-setup-preview" options={{ headerShown: false }} />
      <Stack.Protected guard={status === 'signedIn'}>
        <Stack.Screen name="home" />
      </Stack.Protected>
    </Stack>
  );
}
