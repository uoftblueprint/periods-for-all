import { Redirect } from 'expo-router';
import { Text } from 'react-native';
import { LoginScreen } from '@/features/auth/login-screen';
import { useAuth } from '@/features/auth/auth-provider';
import { useSettings } from '@/features/settings/settings-provider';
import { getAppearance } from '@/features/settings/appearance';
import { PreviewScreen } from '@/foundation/preview-screen';

export default function LoginRoute() {
  const { status, signIn } = useAuth();
  const appearance = getAppearance(useSettings().settings);
  if (status === 'signedIn') return <Redirect href="/home" />;
  return (
    <PreviewScreen title="Login" appearance={appearance} autoFocusTitle>
      <Text style={{ color: appearance.colors.text, fontSize: 16 * appearance.fontScale }}>{process.env.EXPO_PUBLIC_AUTH_MODE === 'supabase'
        ? 'Use your test account to sign in.'
        : 'Use demo@example.com with password demo-only. Reloading the app signs you out.'}</Text>
      {/* Routes follow the shared session, not this callback. */}
      <LoginScreen appearance={appearance} signIn={signIn} onSignedIn={() => {}} />
    </PreviewScreen>
  );
}
