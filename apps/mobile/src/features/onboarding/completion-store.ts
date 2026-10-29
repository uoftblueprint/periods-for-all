export interface CompletionStore {
  isComplete(userId: string): Promise<boolean>;
  markComplete(userId: string): Promise<void>;
}

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

const KEY_PREFIX = 'display-setup:v1:';
const COMPLETE_MARKER = 'true';

function keyFor(userId: string): string {
  if (userId.trim().length === 0) {
    throw new Error('User ID must not be empty.');
  }

  return `${KEY_PREFIX}${userId}`;
}

export function createCompletionStore(storage: KeyValueStore): CompletionStore {
  return {
    async isComplete(userId) {
      return (await storage.getItem(keyFor(userId))) === COMPLETE_MARKER;
    },

    async markComplete(userId) {
      await storage.setItem(keyFor(userId), COMPLETE_MARKER);
    },
  };
}
