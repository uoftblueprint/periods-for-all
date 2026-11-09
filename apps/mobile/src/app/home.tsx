import { useRef, useState } from 'react';
import { Link } from 'expo-router';
import { Text } from 'react-native';
import { AppButton } from '@/components/app-button';
import { useAuth } from '@/features/auth/auth-provider';
import { useSettings } from '@/features/settings/settings-provider';
import { getAppearance } from '@/features/settings/appearance';
import { PreviewScreen } from '@/foundation/preview-screen';

export default function HomeRoute() {
  const { user, signOut } = useAuth();
  const appearance = getAppearance(useSettings().settings);
  const textStyle = { color: appearance.colors.text, fontSize: 16 * appearance.fontScale };
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
    <PreviewScreen title="Home" appearance={appearance} autoFocusTitle>
      <Text style={textStyle}>Signed in as {user?.email}.</Text>
      {error && <Text style={textStyle} accessibilityRole="alert">{error}</Text>}
      <AppButton appearance={appearance} label={busy ? 'Signing out…' : 'Sign out'} busy={busy} onPress={handleSignOut} />
      <Link style={textStyle} href="/settings">Open settings.</Link>
      <Link style={textStyle} href="/">Back to developer starting point</Link>

    </PreviewScreen>
  );
}
