import { Redirect } from 'expo-router';
import { Text } from 'react-native';
import { LoginScreen } from '@/features/auth/login-screen';
import { useAuth } from '@/features/auth/auth-provider';
import { PreviewScreen } from '@/foundation/preview-screen';

export default function LoginRoute() {
  const { status, signIn } = useAuth();
  if (status === 'signedIn') return <Redirect href="/home" />;
  return (
    <PreviewScreen title="Login">
      <Text>{process.env.EXPO_PUBLIC_AUTH_MODE === 'supabase'
        ? 'Use your test account to sign in.'
        : 'Use demo@example.com with password demo-only. Reloading the app signs you out.'}</Text>
      {/* Routes follow the shared session, not this callback. */}
      <LoginScreen signIn={signIn} onSignedIn={() => {}} />
    </PreviewScreen>
  );
}
