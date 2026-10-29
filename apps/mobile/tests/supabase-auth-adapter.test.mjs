// F09 independent checks: adapter behaviour against controlled (fake) client
// responses. No network, no real Supabase project, no real credentials.
// These do NOT prove real login works; that check needs F02's backend.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createAuthFromClient,
  SIGN_IN_MESSAGES,
} from '../src/features/auth/supabase-auth-adapter.ts';

const supabaseUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'synthetic@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const authError = (code, message = 'raw server detail that must not leak') => ({
  name: 'AuthApiError',
  code,
  message,
  status: 400,
});

/** Builds a fake Supabase auth client; each test overrides only the methods it needs. */
function fakeClient(overrides = {}) {
  const calls = { signOut: 0, unsubscribe: 0 };
  let capturedCallback;
  const client = {
    getSession: async () => ({ data: { session: null }, error: null }),
    signInWithPassword: async () => ({ data: { user: null, session: null }, error: null }),
    signOut: async () => {
      calls.signOut += 1;
      return { error: null };
    },
    onAuthStateChange: (cb) => {
      capturedCallback = cb;
      return { data: { subscription: { unsubscribe: () => { calls.unsubscribe += 1; } } } };
    },
    ...overrides,
  };
  return {
    auth: createAuthFromClient(client),
    calls,
    emit: (event, session) => capturedCallback?.(event, session),
  };
}

// --- signIn ---------------------------------------------------------------

test('successful sign-in maps the Supabase user to { id, email } only', async () => {
  const { auth } = fakeClient({
    signInWithPassword: async () => ({
      data: { user: supabaseUser(), session: {} },
      error: null,
    }),
  });
  const result = await auth.signIn({ email: 'synthetic@example.com', password: 'x' });
  assert.deepEqual(result, { ok: true, user: { id: 'user-123', email: 'synthetic@example.com' } });
});

test('wrong password returns a safe message, not the raw server error', async () => {
  const { auth } = fakeClient({
    signInWithPassword: async () => ({
      data: { user: null, session: null },
      error: authError('invalid_credentials'),
    }),
  });
  const result = await auth.signIn({ email: 'synthetic@example.com', password: 'wrong' });
  assert.deepEqual(result, { ok: false, message: SIGN_IN_MESSAGES.invalidCredentials });
  assert.ok(!JSON.stringify(result).includes('raw server detail'));
});

test('unknown sign-in error falls back to the generic safe message', async () => {
  const { auth } = fakeClient({
    signInWithPassword: async () => ({
      data: { user: null, session: null },
      error: authError('unexpected_failure'),
    }),
  });
  const result = await auth.signIn({ email: 'a@example.com', password: 'x' });
  assert.deepEqual(result, { ok: false, message: SIGN_IN_MESSAGES.unavailable });
});

test('a thrown error (e.g. network down) still resolves to a safe result', async () => {
  const { auth } = fakeClient({
    signInWithPassword: async () => {
      throw new Error('fetch failed: secret-ish internals');
    },
  });
  const result = await auth.signIn({ email: 'a@example.com', password: 'x' });
  assert.deepEqual(result, { ok: false, message: SIGN_IN_MESSAGES.unavailable });
});

test('a user with no email is rejected explicitly and the session is cleared', async () => {
  const { auth, calls } = fakeClient({
    signInWithPassword: async () => ({
      data: { user: supabaseUser({ email: undefined }), session: {} },
      error: null,
    }),
  });
  const result = await auth.signIn({ email: 'a@example.com', password: 'x' });
  assert.deepEqual(result, { ok: false, message: SIGN_IN_MESSAGES.missingEmail });
  assert.equal(calls.signOut, 1);
});

test('missing email: if clearing the session fails, sign-in reports a general failure', async () => {
  const { auth } = fakeClient({
    signInWithPassword: async () => ({
      data: { user: supabaseUser({ email: undefined }), session: {} },
      error: null,
    }),
    signOut: async () => ({ error: authError('unexpected_failure', 'sign-out failed') }),
  });
  const result = await auth.signIn({ email: 'a@example.com', password: 'x' });
  assert.deepEqual(result, { ok: false, message: SIGN_IN_MESSAGES.unavailable });
});

// --- getUser --------------------------------------------------------------

test('getUser returns null when there is no saved session', async () => {
  const { auth } = fakeClient();
  assert.equal(await auth.getUser(), null);
});

test('getUser maps the user from a saved session', async () => {
  const { auth } = fakeClient({
    getSession: async () => ({ data: { session: { user: supabaseUser() } }, error: null }),
  });
  assert.deepEqual(await auth.getUser(), { id: 'user-123', email: 'synthetic@example.com' });
});

test('restored session with no email: getUser returns null and clears the session', async () => {
  const { auth, calls } = fakeClient({
    getSession: async () => ({
      data: { session: { user: supabaseUser({ email: undefined }) } },
      error: null,
    }),
  });
  assert.equal(await auth.getUser(), null);
  assert.equal(calls.signOut, 1);
});

test('restored session with no email: a failed cleanup is reported, not hidden', async () => {
  const { auth } = fakeClient({
    getSession: async () => ({
      data: { session: { user: supabaseUser({ email: undefined }) } },
      error: null,
    }),
    signOut: async () => ({ error: authError('unexpected_failure', 'sign-out failed') }),
  });
  await assert.rejects(() => auth.getUser());
});

test('a normal restored session does not sign the user out', async () => {
  const { auth, calls } = fakeClient({
    getSession: async () => ({ data: { session: { user: supabaseUser() } }, error: null }),
  });
  await auth.getUser();
  assert.equal(calls.signOut, 0);
});

// --- signOut --------------------------------------------------------------

test('sign-out failure is not swallowed', async () => {
  const { auth } = fakeClient({
    signOut: async () => ({ error: authError('unexpected_failure', 'sign-out failed') }),
  });
  await assert.rejects(() => auth.signOut());
});

test('sign-out resolves when Supabase succeeds', async () => {
  const { auth } = fakeClient();
  await assert.doesNotReject(() => auth.signOut());
});

// --- subscribe ------------------------------------------------------------

test('subscribe forwards future changes and skips the initial event', () => {
  const { auth, emit } = fakeClient();
  const seen = [];
  auth.subscribe((user) => seen.push(user));

  emit('INITIAL_SESSION', { user: supabaseUser() });
  emit('SIGNED_IN', { user: supabaseUser() });
  emit('SIGNED_OUT', null);

  assert.deepEqual(seen, [{ id: 'user-123', email: 'synthetic@example.com' }, null]);
});

test('subscribe returns a cleanup that unsubscribes', () => {
  const { auth, calls } = fakeClient();
  const stop = auth.subscribe(() => {});
  stop();
  assert.equal(calls.unsubscribe, 1);
});