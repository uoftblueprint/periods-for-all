import { useRef, useState } from 'react';
import { Link } from 'expo-router';
import { Text } from 'react-native';
import { AppButton } from '@/components/app-button';
import { useAuth } from '@/features/auth/auth-provider';
import { PreviewScreen } from '@/foundation/preview-screen';

export default function HomeRoute() {
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);

  async function handleSignOut() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await signOut();
    } catch {
      setError('We couldn’t sign you out. Try again.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <PreviewScreen title="Home">
      <Text>Signed in as {user?.email}.</Text>
      {error && <Text accessibilityRole="alert">{error}</Text>}
      <AppButton label={busy ? 'Signing out…' : 'Sign out'} busy={busy} onPress={handleSignOut} />
      <Link href="/settings">Open settings.</Link>
      <Link href="/">Back to developer starting point</Link>

    </PreviewScreen>
  );
}
