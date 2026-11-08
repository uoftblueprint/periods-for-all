import { useEffect, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { Text, View } from 'react-native';
import { useAuth } from '@/features/auth/auth-provider';
import { loadSupabaseSignUp } from '@/features/auth/load-supabase-signup';
import { SignUpScreen } from '@/features/auth/signup-screen';
import type { SignUp } from '@/features/auth/signup-contracts';

// Demo mode has no real accounts, so it shows the check-email step without
// sending anything anywhere.
const demoSignUp: SignUp = async () => ({ status: 'checkEmail' });

// Picks the signup function for the current auth mode. Supabase is loaded only
// in Supabase mode, the same way _layout.tsx loads the real sign-in service.
function useSignUpForMode() {
  const [signUp, setSignUp] = useState<SignUp | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);

  useEffect(() => {
    // Read inside the effect (not at the top of the file) so tests can set it.
    const mode = process.env.EXPO_PUBLIC_AUTH_MODE ?? 'demo';
    if (mode !== 'supabase') {
      // `() => demoSignUp` because useState treats a plain function as an updater.
      setSignUp(() => demoSignUp);
      return;
    }

    let active = true;
    loadSupabaseSignUp()
      .then((realSignUp) => {
        if (active) setSignUp(() => realSignUp);
      })
      .catch(() => {
        if (active) setSetupError('Could not start sign-up. Check .env.local and restart Expo.');
      });
    return () => { active = false; };
  }, []);

  return { signUp, setupError };
}

export default function SignUpRoute() {
  const { status } = useAuth();
  const { signUp, setupError } = useSignUpForMode();

  // Routes follow the shared session, like login: once the auth subscription
  // reports the new session, go to the existing signed-in destination.
  if (status === 'signedIn') return <Redirect href="/home" />;
  if (setupError) return <Text accessibilityRole="alert">{setupError}</Text>;
  if (!signUp) return <Text accessibilityLiveRegion="polite">Loading…</Text>;

  return (
    <View style={{ flex: 1 }}>
      <SignUpScreen
        signUp={signUp}
        // Navigation happens above, when the shared auth state says signedIn.
        onSignedIn={() => {}}
        // Go back to the login screen we came from, if there is one.
        onBackToLogin={() => (router.canGoBack() ? router.back() : router.replace('/login'))}
      />
    </View>
  );
}