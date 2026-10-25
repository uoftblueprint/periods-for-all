import assert from 'node:assert/strict';
import test from 'node:test';

import { createCompletionStore } from '../src/features/onboarding/completion-store.ts';

function createMemoryStorage(entries = []) {
  const records = new Map(entries);

  return {
    records,
    storage: {
      async getItem(key) {
        return records.get(key) ?? null;
      },

      async setItem(key, value) {
        records.set(key, value);
      },
    },
  };
}

test('a missing completion marker returns false', async () => {
  const { storage } = createMemoryStorage();
  const completionStore = createCompletionStore(storage);

  assert.equal(await completionStore.isComplete('test-user-a'), false);
});

test('marking an account complete saves the expected marker', async () => {
  const { records, storage } = createMemoryStorage();
  const completionStore = createCompletionStore(storage);

  await completionStore.markComplete('test-user-a');

  assert.equal(records.get('display-setup:v1:test-user-a'), 'true');
  assert.equal(await completionStore.isComplete('test-user-a'), true);
});

for (const marker of ['', 'false', 'TRUE', '1', '{"complete":true}']) {
  test(`the invalid marker ${JSON.stringify(marker)} returns false`, async () => {
    const { storage } = createMemoryStorage([
      ['display-setup:v1:test-user-a', marker],
    ]);
    const completionStore = createCompletionStore(storage);

    assert.equal(await completionStore.isComplete('test-user-a'), false);
  });
}

test('completion is isolated by account', async () => {
  const { storage } = createMemoryStorage();
  const completionStore = createCompletionStore(storage);

  await completionStore.markComplete('test-user-a');

  assert.equal(await completionStore.isComplete('test-user-a'), true);
  assert.equal(await completionStore.isComplete('test-user-b'), false);
});

test('a storage read failure reaches the caller unchanged', async () => {
  const failure = new Error('Fake read failure');
  const completionStore = createCompletionStore({
    async getItem() {
      throw failure;
    },
    async setItem() {},
  });

  await assert.rejects(
    completionStore.isComplete('test-user-a'),
    (error) => error === failure,
  );
});

test('a storage write failure reaches the caller unchanged', async () => {
  const failure = new Error('Fake write failure');
  const completionStore = createCompletionStore({
    async getItem() {
      return null;
    },
    async setItem() {
      throw failure;
    },
  });

  await assert.rejects(
    completionStore.markComplete('test-user-a'),
    (error) => error === failure,
  );
});

for (const userId of ['', '   ', '\t\n']) {
  test(`the empty user ID ${JSON.stringify(userId)} is rejected before storage`, async () => {
    let calls = 0;
    const completionStore = createCompletionStore({
      async getItem() {
        calls += 1;
        return null;
      },
      async setItem() {
        calls += 1;
      },
    });

    await assert.rejects(completionStore.isComplete(userId), /User ID must not be empty/);
    await assert.rejects(completionStore.markComplete(userId), /User ID must not be empty/);
    assert.equal(calls, 0);
  });
}
