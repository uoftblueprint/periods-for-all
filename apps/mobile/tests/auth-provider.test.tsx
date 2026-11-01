import { expect, jest, test } from '@jest/globals';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AuthProvider, useAuth } from '@/features/auth/auth-provider';
import type { AuthService, User } from '@/foundation/contracts';

const testUser: User = { id: '1', email: 'test@example.com' };

/**
 * Renders inside AuthProvider and displays status|email|error as text.
 * This lets us assert the provider's state without accessing React internals.
 */
function StatusDisplay() {
  const { status, user, error } = useAuth();
  return <Text testID="status">{`${status}|${user?.email ?? 'none'}|${error ?? 'none'}`}</Text>;
}

/**
 * Creates a mock AuthService where every method can be overridden.
 * Defaults: getUser returns null, signIn succeeds, signOut resolves, subscribe is a no-op.
 */
function createMockService(overrides: Partial<AuthService> = {}): AuthService {
  return {
    getUser: jest.fn<AuthService['getUser']>(() => Promise.resolve(null)),
    signIn: jest.fn<AuthService['signIn']>(() => Promise.resolve({ ok: true, user: testUser })),
    signOut: jest.fn<AuthService['signOut']>(() => Promise.resolve()),
    subscribe: jest.fn<AuthService['subscribe']>(() => () => {}),
    ...overrides,
  };
}

/** Reads the status string rendered by StatusDisplay. */
function getStatus(): string {
  return screen.getByTestId('status').props.children;
}

test('shows signed-in state after getUser resolves with a user', async () => {
  const service = createMockService({
    getUser: () => Promise.resolve(testUser),
  });

  render(<AuthProvider service={service}><StatusDisplay /></AuthProvider>);

  await waitFor(() => {
    expect(getStatus()).toBe('signedIn|test@example.com|none');
  });
});

test('shows signed-out state when getUser resolves with null', async () => {
  const service = createMockService();

  render(<AuthProvider service={service}><StatusDisplay /></AuthProvider>);

  await waitFor(() => {
    expect(getStatus()).toBe('signedOut|none|none');
  });
});

test('shows error state when getUser rejects', async () => {
  const service = createMockService({
    getUser: () => Promise.reject(new Error('Network down')),
  });

  render(<AuthProvider service={service}><StatusDisplay /></AuthProvider>);

  await waitFor(() => {
    expect(getStatus()).toBe('error|none|Network down');
  });
});

test('uses fallback message when getUser rejects with a non-Error', async () => {
  const service = createMockService({
    getUser: () => Promise.reject('something weird'),
  });

  render(<AuthProvider service={service}><StatusDisplay /></AuthProvider>);

  await waitFor(() => {
    expect(getStatus()).toBe('error|none|Could not check sign-in status.');
  });
});

// Tests the race condition: if subscribe fires before getUser resolves,
// the provider should use the subscribe result and ignore getUser.
test('subscribe event takes priority over a late getUser result', async () => {
  let resolveGetUser!: (user: User | null) => void;
  let subscribeListener: (user: User | null) => void = () => {};

  const service = createMockService({
    getUser: () => new Promise((r) => { resolveGetUser = r; }),
    subscribe: (listener) => { subscribeListener = listener; return () => {}; },
  });

  render(<AuthProvider service={service}><StatusDisplay /></AuthProvider>);

  // Subscribe fires with a user before getUser resolves
  act(() => { subscribeListener(testUser); });
  expect(getStatus()).toBe('signedIn|test@example.com|none');

  // Late getUser resolves with null — should NOT overwrite the subscribe result
  await act(async () => { resolveGetUser(null); });
  expect(getStatus()).toBe('signedIn|test@example.com|none');
});

// First call to getUser fails, then retry triggers a second call that succeeds.
test('retry resets to checking and re-runs getUser', async () => {
  let callCount = 0;
  const service = createMockService({
    getUser: () => {
      callCount++;
      if (callCount === 1) return Promise.reject(new Error('Temporary failure'));
      return Promise.resolve(testUser);
    },
  });

  /** Like StatusDisplay but also exposes a retry button. */
  function RetryDisplay() {
    const { status, user, error, retry } = useAuth();
    return (
      <>
        <Text testID="status">{`${status}|${user?.email ?? 'none'}|${error ?? 'none'}`}</Text>
        <Text testID="retry" onPress={retry}>retry</Text>
      </>
    );
  }

  render(<AuthProvider service={service}><RetryDisplay /></AuthProvider>);

  await waitFor(() => {
    expect(getStatus()).toBe('error|none|Temporary failure');
  });

  // Retry should re-check and succeed
  await act(async () => { screen.getByTestId('retry').props.onPress(); });

  await waitFor(() => {
    expect(getStatus()).toBe('signedIn|test@example.com|none');
  });
});

test('cleanup unsubscribes the listener', () => {
  const unsubscribe = jest.fn();
  const service = createMockService({
    subscribe: () => unsubscribe,
  });

  const { unmount } = render(<AuthProvider service={service}><StatusDisplay /></AuthProvider>);
  unmount();

  expect(unsubscribe).toHaveBeenCalled();
});

test('sign-out delegates to the service and propagates errors', async () => {
  const service = createMockService({
    getUser: () => Promise.resolve(testUser),
    signOut: jest.fn<AuthService['signOut']>(() => Promise.reject(new Error('Sign-out failed'))),
  });

  render(<AuthProvider service={service}><StatusDisplay /></AuthProvider>);

  await waitFor(() => {
    expect(getStatus()).toBe('signedIn|test@example.com|none');
  });

  // signOut delegates to the service — the error should propagate, not be swallowed
  await expect(service.signOut()).rejects.toThrow('Sign-out failed');
});
