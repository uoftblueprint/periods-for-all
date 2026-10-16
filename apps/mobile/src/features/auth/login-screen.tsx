import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/app-button';
import { TextField } from '@/components/text-field';
import type { LoginScreenProps } from '@/foundation/contracts';

export function LoginScreen(props: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);

  async function handleLogin() {
    if (pending.current) return;
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter an email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password.trim()) {
      setError('Password is required.');
      return;
    }

    pending.current = true;
    setError(null);
    setLoading(true);
    try {
      const result = await props.signIn({ email: trimmedEmail, password });
      if (result.ok) props.onSignedIn(result.user);
      else setError(result.message);
    } catch {
      setError('We couldn\'t sign you in. Try again.');
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }

  return (
    <View>
      <TextField
        label="Email address"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!loading}
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        editable={!loading}
      />
      {error && <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="assertive">{error}</Text>}
      {loading && <ActivityIndicator accessibilityLabel="Signing in" />}
      <AppButton
        label={loading ? 'Signing in' : 'Login'}
        busy={loading}
        onPress={handleLogin}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  error: {
    color: 'red',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 12,
  },
});
