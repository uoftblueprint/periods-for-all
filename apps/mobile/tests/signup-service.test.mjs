// S2R-10 independent checks with a FAKE Supabase client (no network).
// These do not prove real signup works; the development backend check does.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSignUpFromClient,
  SIGN_UP_MESSAGES,
} from '../src/features/auth/signup-service.ts';

const input = { firstName: '  Sam  ', email: '  sam@example.com ', password: ' pass word ' };

/** Fake client that records every signUp call and returns `response`. */
function fakeClient(response) {
  const calls = [];
  return {
    calls,
    signUp: async (credentials) => {
      calls.push(credentials);
      return typeof response === 'function' ? response(credentials) : response;
    },
  };
}

const authError = (code, name = 'AuthApiError') => ({ name, code, message: 'raw server detail', status: 400 });

test('sends trimmed name/email, untouched password, and first_name metadata', async () => {
  const client = fakeClient({ data: { user: {}, session: null }, error: null });
  await createSignUpFromClient(client)(input);
  assert.deepEqual(client.calls, [{
    email: 'sam@example.com',
    password: ' pass word ',
    options: { data: { first_name: 'Sam' } },
  }]);
});

test('session present: returns signedIn', async () => {
  const client = fakeClient({ data: { user: { id: 'u1' }, session: { access_token: 't' } }, error: null });
  assert.deepEqual(await createSignUpFromClient(client)(input), { status: 'signedIn' });
});

test('user returned but no session: returns checkEmail, not signedIn', async () => {
  const client = fakeClient({ data: { user: { id: 'u1' }, session: null }, error: null });
  assert.deepEqual(await createSignUpFromClient(client)(input), { status: 'checkEmail' });
});

test('existing account: safe message that points to login', async () => {
  const client = fakeClient({ data: { user: null, session: null }, error: authError('user_already_exists') });
  const result = await createSignUpFromClient(client)(input);
  assert.deepEqual(result, { status: 'error', message: SIGN_UP_MESSAGES.alreadyRegistered });
  assert.ok(!JSON.stringify(result).includes('raw server detail'));
});

test('server validation error (weak password) is shown, not crashed on', async () => {
  const client = fakeClient({ data: { user: null, session: null }, error: authError('weak_password') });
  assert.deepEqual(await createSignUpFromClient(client)(input), {
    status: 'error', message: SIGN_UP_MESSAGES.weakPassword,
  });
});

test('network failure reported by Supabase: readable network message', async () => {
  const client = fakeClient({
    data: { user: null, session: null },
    error: authError(undefined, 'AuthRetryableFetchError'),
  });
  assert.deepEqual(await createSignUpFromClient(client)(input), {
    status: 'error', message: SIGN_UP_MESSAGES.network,
  });
});

test('unexpected throw: still a readable error, no crash', async () => {
  const client = fakeClient(() => { throw new Error('boom'); });
  assert.deepEqual(await createSignUpFromClient(client)(input), {
    status: 'error', message: SIGN_UP_MESSAGES.network,
  });
});

test('unknown server error: generic message', async () => {
  const client = fakeClient({ data: { user: null, session: null }, error: authError('unexpected_failure') });
  assert.deepEqual(await createSignUpFromClient(client)(input), {
    status: 'error', message: SIGN_UP_MESSAGES.unavailable,
  });
});

test('blank name or email: error without calling Supabase', async () => {
  const client = fakeClient({ data: { user: null, session: null }, error: null });
  const signUp = createSignUpFromClient(client);
  assert.deepEqual(await signUp({ ...input, firstName: '   ' }), { status: 'error', message: SIGN_UP_MESSAGES.missingName });
  assert.deepEqual(await signUp({ ...input, email: '  ' }), { status: 'error', message: SIGN_UP_MESSAGES.missingEmail });
  assert.equal(client.calls.length, 0);
});

test('repeated submit while waiting: only one signup request', async () => {
  let release;
  const client = fakeClient(() => new Promise((resolve) => {
    release = () => resolve({ data: { user: {}, session: null }, error: null });
  }));
  const signUp = createSignUpFromClient(client);
  const first = signUp(input);
  const second = signUp(input);
  release();
  assert.deepEqual(await Promise.all([first, second]), [{ status: 'checkEmail' }, { status: 'checkEmail' }]);
  assert.equal(client.calls.length, 1);
});

test('after a signup finishes, a new submit sends a new request', async () => {
  const client = fakeClient({ data: { user: {}, session: null }, error: null });
  const signUp = createSignUpFromClient(client);
  await signUp(input);
  await signUp(input);
  assert.equal(client.calls.length, 2);
});