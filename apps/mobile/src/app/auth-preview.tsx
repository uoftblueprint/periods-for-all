import { useState } from 'react';
import { Button, Text } from 'react-native';
import type { AuthService } from '@/foundation/contracts';
import { createDemoAuth } from '@/foundation/demo-auth';
import { PreviewScreen } from '@/foundation/preview-screen';
import { AuthProvider, useAuth } from '@/features/auth/auth-provider';

type Scenario = 'normal' | 'slow' | 'failOnce';

const scenarios: { id: Scenario; label: string; hint: string }[] = [
  { id: 'normal', label: 'Normal', hint: 'Initial check resolves immediately.' },
  { id: 'slow', label: 'Slow check', hint: 'getUser() takes 3s. Sign in while checking: the late result must not undo it.' },
  { id: 'failOnce', label: 'Failing check', hint: 'getUser() fails until Retry is pressed.' },
];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Wraps shared demo service to simulate a slow or failing initial check.
function createScenarioService(base: AuthService, scenario: Scenario, onListenerChange: (delta: number) => void): AuthService {
  let failuresLeft = scenario === 'failOnce' ? 1 : 0;
  return {
    ...base,
    async getUser() {
      if (failuresLeft > 0) {
        failuresLeft -= 1;
        throw new Error('Network error while checking sign-in.');
      }
      // Read first, then delay: the slow result is stale by the time it lands.
      const user = await base.getUser();
      if (scenario === 'slow') await wait(3000);
      return user;
    },
    // Counts live listeners so unmount cleanup is visible.
    subscribe(listener) {
      const unsubscribe = base.subscribe(listener);
      onListenerChange(1);
      return () => {
        unsubscribe();
        onListenerChange(-1);
      };
    },
  };
}

export default function AuthPreview() {
  // One service for the whole preview; scenarios only wrap its getUser().
  const [base] = useState(createDemoAuth);
  const [scenario, setScenario] = useState<Scenario>('normal');
  const [mounted, setMounted] = useState(true);
  const [run, setRun] = useState(0);
  const [listenerCount, setListenerCount] = useState(0);
  const [service, setService] = useState(() => createScenarioService(base, 'normal', countListeners));

  function countListeners(delta: number) {
    setListenerCount((n) => n + delta);
  }

  function choose(next: Scenario) {
    setScenario(next);
    setService(createScenarioService(base, next, countListeners));
    setRun((n) => n + 1);
  }

  return (
    <PreviewScreen title="Auth state preview">
      <Text>Demo account only. No backend is called.</Text>
      {scenarios.map((s) => (
        <Button
          key={s.id}
          title={`${scenario === s.id ? '- ' : ''}${s.label}`}
          onPress={() => choose(s.id)}
        />
      ))}
      <Text>{scenarios.find((s) => s.id === scenario)?.hint}</Text>
      <Button title={mounted ? 'Unmount provider' : 'Mount provider'} onPress={() => setMounted((m) => !m)} />
      <Text accessibilityLiveRegion="polite">Active listeners: {listenerCount} (expect 0 when unmounted)</Text>
      {mounted && (
        <AuthProvider key={run} service={service}>
          <AuthConsumer />
        </AuthProvider>
      )}
    </PreviewScreen>
  );
}

// Shows what useAuth() returns.
function AuthConsumer() {
  const { status, user, error, signIn, signOut, retry } = useAuth();
  const [message, setMessage] = useState('');

  async function tryLogin(password: string) {
    const result = await signIn({ email: 'demo@example.com', password });
    setMessage(result.ok ? '' : result.message);
  }

  return (
    <>
      <Text accessibilityLiveRegion="polite">Status: {status}</Text>
      <Text>User: {user ? user.email : '—'}</Text>
      {error && <Text>Error: {error}</Text>}
      {message !== '' && <Text>Sign-in message: {message}</Text>}
      <Button title="Sign in" onPress={() => void tryLogin('demo-only')} />
      <Button title="Sign in (wrong password)" onPress={() => void tryLogin('wrong')} />
      <Button title="Sign out" onPress={() => void signOut()} />
      <Button title="Retry" onPress={retry} />
    </>
  );
}
