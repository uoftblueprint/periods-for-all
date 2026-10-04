import assert from 'node:assert/strict';
import test from 'node:test';
import { createDemoAuth } from '../src/foundation/demo-auth.ts';

const credentials = { email: 'demo@example.com', password: 'demo-only' };

test('fake login publishes the user; sign-out clears it', async () => {
  const auth = createDemoAuth();
  const changes = [];
  auth.subscribe((user) => changes.push(user));
  assert.equal(await auth.getUser(), null);
  const result = await auth.signIn(credentials);
  assert.equal(result.ok, true);
  assert.deepEqual(await auth.getUser(), result.user);
  await auth.signOut();
  assert.equal(await auth.getUser(), null);
  assert.deepEqual(changes, [result.user, null]);
});

test('a wrong password does not create a user', async () => {
  const auth = createDemoAuth();
  const result = await auth.signIn({ ...credentials, password: 'wrong' });
  assert.equal(result.ok, false);
  assert.ok(result.message);
  assert.equal(await auth.getUser(), null);
});

test('removing a listener stops updates; previews have independent state', async () => {
  const auth = createDemoAuth();
  let calls = 0;
  const unsubscribe = auth.subscribe(() => calls++);
  unsubscribe();
  await auth.signIn(credentials);
  assert.equal(calls, 0);
  assert.equal(await createDemoAuth().getUser(), null);
});
