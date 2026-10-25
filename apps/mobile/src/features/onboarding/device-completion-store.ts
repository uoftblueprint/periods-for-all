import 'expo-sqlite/localStorage/install';

import { createCompletionStore, type KeyValueStore } from './completion-store';

const deviceStorage: KeyValueStore = {
  async getItem(key) {
    return localStorage.getItem(key);
  },

  async setItem(key, value) {
    localStorage.setItem(key, value);
  },
};

export const deviceCompletionStore = createCompletionStore(deviceStorage);
