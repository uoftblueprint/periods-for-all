import { useEffect, useState, useSyncExternalStore } from 'react';
import { Button, ScrollView, Switch, Text, View } from 'react-native';
import { AuthProvider, useAuth } from '@/features/auth/auth-provider';
import { createSessionAuth } from '@/features/auth/session-auth';
import { OnboardingGate } from '@/features/onboarding/onboarding-gate';
import { OnboardingShell } from '@/features/onboarding/onboarding-shell';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings, type AuthService, type Settings, type User } from '@/foundation/contracts';

const operations = {
  authLoad: 'Auth load', signIn: 'Sign-in', signOut: 'Sign-out',
  preferences: 'Preference load', completionRead: 'Completion read',
  save: 'Preference save', completionWrite: 'Completion write',
} as const;
type Operation = keyof typeof operations;

// Fake records survive a simulated reopen, not a browser reload.
function createPreviewServices(refresh: () => void) {
  let user: User | null = null;
  let saved = { ...defaultSettings };
  const complete = new Set<string>();
  const listeners = new Set<(next: User | null) => void>();
  const controls = Object.fromEntries(
    Object.keys(operations).map((key) => [key, { delay: false, fail: false, calls: 0 }]),
  ) as Record<Operation, { delay: boolean; fail: boolean; calls: number }>;
  const waiting = new Set<() => void>();
  let notifications = true;

  function publish(next: User | null) {
    user = next;
    if (notifications) listeners.forEach((listener) => listener(next));
  }
  async function run(operation: Operation) {
    controls[operation].calls += 1;
    refresh();
    if (controls[operation].delay) {
      await new Promise<void>((resolve) => { waiting.add(resolve); refresh(); });
    }
    if (controls[operation].fail) throw new Error(`Fake ${operations[operation].toLowerCase()} failure`);
  }
  const auth: AuthService = {
    async getUser() { const snapshot = user; await run('authLoad'); return snapshot; },
    async signIn({ email }) {
      await run('signIn');
      if (email !== 'a@example.test' && email !== 'b@example.test') return { ok: false, message: 'Choose account A or B.' };
      const next = { id: email === 'a@example.test' ? 'test-a' : 'test-b', email };
      publish(next);
      return { ok: true, user: next };
    },
    async signOut() { await run('signOut'); publish(null); },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
  return {
    auth, controls,
    getNotifications: () => notifications,
    setNotifications(next: boolean) { notifications = next; refresh(); },
    repeatUser() { listeners.forEach((listener) => listener(user)); },
    getWaitingCount: () => waiting.size,
    release() { const pending = [...waiting]; waiting.clear(); pending.forEach((resolve) => resolve()); refresh(); },
    async loadSettings() { const snapshot = { ...saved }; await run('preferences'); return snapshot; },
    async saveSettings(next: Settings) { await run('save'); saved = { ...next }; },
    completionStore: {
      async isComplete(userId: string) { const snapshot = complete.has(userId); await run('completionRead'); return snapshot; },
      async markComplete(userId: string) { await run('completionWrite'); complete.add(userId); },
    },
  };
}
type PreviewServices = ReturnType<typeof createPreviewServices>;

export default function OnboardingPreview() {
  'use no memo'; // Test controls read deliberately mutable fake-service state.
  const [, setVersion] = useState(0);
  const [services] = useState(() => createPreviewServices(() => setVersion((n) => n + 1)));
  const [run, setRun] = useState(0);
  const [showControls, setShowControls] = useState(false);
  return <View style={{ flex: 1, backgroundColor: 'white' }}>
    <Text style={{ padding: 12 }}>Fake accounts and storage. Reload clears records; simulated reopen keeps them.</Text>
    <Button title="Show test controls" onPress={() => setShowControls((shown) => !shown)} />
    {showControls && <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={{ padding: 12, gap: 12 }}>
      {(Object.keys(operations) as Operation[]).map((operation) => <View key={operation} style={{ gap: 8 }}>
        <Text>{operations[operation]}: {services.controls[operation].calls} calls</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <Text>Delay {operations[operation].toLowerCase()}</Text>
          <Switch accessibilityLabel={`Delay ${operations[operation].toLowerCase()}`} value={services.controls[operation].delay}
            onValueChange={(value) => { services.controls[operation].delay = value; setVersion((n) => n + 1); }} />
          <Text>Fail {operations[operation].toLowerCase()}</Text>
          <Switch accessibilityLabel={`Fail ${operations[operation].toLowerCase()}`} value={services.controls[operation].fail}
            onValueChange={(value) => { services.controls[operation].fail = value; setVersion((n) => n + 1); }} />
        </View>
      </View>)}
      <Text>Send auth notifications</Text>
      <Switch accessibilityLabel="Send auth notifications" value={services.getNotifications()} onValueChange={services.setNotifications} />
      <Text accessibilityLiveRegion="polite">Waiting operations: {services.getWaitingCount()}</Text>
      <Button title="Release delayed operations" onPress={services.release} />
      <Button title="Repeat user notification" onPress={services.repeatUser} />
      <Button title="Simulate reopen" onPress={() => setRun((n) => n + 1)} />
    </ScrollView>}
    <FakeSession key={run} services={services} />
  </View>;
}

function FakeSession({ services }: { services: PreviewServices }) {
  const [session] = useState(() => createSessionAuth(async () => services.auth));
  return <AuthProvider service={session.service}><PreviewContent services={services} session={session} /></AuthProvider>;
}

function PreviewContent({ services, session }: { services: PreviewServices; session: ReturnType<typeof createSessionAuth> }) {
  const auth = useAuth();
  const identity = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState('');
  const [preferences, setPreferences] = useState<{ key: string; settings: Settings | null; error: string | null }>({
    key: '', settings: null, error: null,
  });
  const checking = identity.pending || (auth.status === 'signedIn' && auth.user?.id !== identity.userId);

  useEffect(() => {
    if (auth.status !== 'signedIn' || checking) return;
    let active = true;
    const current = () => active && session.getWorkKey() === identity.key;
    setPreferences({ key: identity.key, settings: null, error: null });
    void services.loadSettings().then(
      (settings) => { if (current()) setPreferences({ key: identity.key, settings, error: null }); },
      () => { if (current()) setPreferences({ key: identity.key, settings: null, error: 'Could not load preferences. Try again.' }); },
    );
    return () => { active = false; };
  }, [services, session, identity.key, auth.status, checking, attempt]);

  function signIn(account: 'a' | 'b') {
    setMessage('');
    void auth.signIn({ email: `${account}@example.test`, password: 'preview-only' }).then(
      (result) => { if (!result.ok) setMessage(result.message); },
      () => setMessage('Sign-in failed. Try again.'),
    );
  }
  const currentPreferences = preferences.key === identity.key ? preferences : null;
  const appearance = getAppearance(currentPreferences?.settings ?? defaultSettings);

  return <View style={{ flex: 1 }}>
    <View style={{ gap: 8, padding: 12 }}>
      <Text>Account: {auth.user?.email ?? 'signed out'} · Session: {identity.key}</Text>
      {message ? <Text accessibilityRole="alert">{message}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Button title="Sign in as A" onPress={() => signIn('a')} />
        <Button title="Sign in as B" onPress={() => signIn('b')} />
        <Button title="Sign out" onPress={() => { setMessage(''); void auth.signOut().catch(() => setMessage('Sign-out failed. Try again.')); }} />
        <Button title="Sign out and back in as A" onPress={() => {
          setMessage('');
          void auth.signOut().then(() => signIn('a')).catch(() => setMessage('Sign-out failed. Try again.'));
        }} />
      </View>
    </View>
    <OnboardingGate
      auth={checking ? { ...auth, status: 'checking' } : auth}
      sessionId={identity.generation}
      sessionKey={identity.key}
      getSessionKey={session.getWorkKey}
      settings={currentPreferences?.settings ?? null}
      settingsError={currentPreferences?.error ?? null}
      onRetry={() => { if (auth.status === 'error') auth.retry(); if (currentPreferences?.error) setAttempt((n) => n + 1); }}
      saveSettings={async (next) => {
        await services.saveSettings(next);
        if (session.getWorkKey() === identity.key) setPreferences({ key: identity.key, settings: next, error: null });
      }}
      completionStore={services.completionStore}
      render={(model) => <OnboardingShell
        model={model}
        navigator={<View style={{ padding: 16 }}>
          <Text accessibilityRole="header" style={{ color: appearance.colors.text, fontSize: 24 * appearance.fontScale }}>
            {auth.user ? 'Home placeholder' : 'Sign in with a test account to try display setup.'}
          </Text>
          {auth.user && <Text style={{ color: appearance.colors.text }}>Saved choices: {JSON.stringify(currentPreferences?.settings)}</Text>}
        </View>}
        appearance={appearance}
        sessionId={identity.generation}
        workKey={identity.key}
        getWorkKey={session.getWorkKey}
        onHomeReady={() => {}}
      />}
    />
  </View>;
}
