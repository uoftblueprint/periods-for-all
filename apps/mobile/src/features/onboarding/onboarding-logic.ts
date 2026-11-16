import type { Settings } from '@/foundation/contracts';
import type { AuthStatus } from '@/features/auth/auth-provider';

import type { CompletionStore } from './completion-store';

export function getGateView(input: {
  authStatus: AuthStatus;
  settingsReady: boolean;
  error: string | null;
  complete: boolean | null;
  exited: boolean;
}) {
  if (input.authStatus === 'checking') return 'loading';
  if (input.authStatus === 'signedOut') return 'signedOut';
  if (input.authStatus === 'error' || input.error) return 'error';
  if (!input.settingsReady || input.complete === null) return 'loading';
  return input.complete || input.exited ? 'home' : 'setup';
}

export async function readCompletion(
  store: CompletionStore,
  userId: string,
  isCurrent: () => boolean,
): Promise<boolean | undefined> {
  if (!isCurrent()) return;
  try {
    const complete = await store.isComplete(userId);
    return isCurrent() ? complete : undefined;
  } catch (error) {
    if (isCurrent()) throw error;
  }
}

export const finishInProgress = new Error('Settings are already being saved.');

export function createFinishHandler() {
  let pending: { sessionKey: string } | null = null;

  return {
    isPending: (sessionKey: string) => pending?.sessionKey === sessionKey,
    async finish({ sessionKey, userId, settings, isCurrent, saveSettings, completionStore }: {
      sessionKey: string;
      userId: string;
      settings: Settings;
      isCurrent: () => boolean;
      saveSettings: (next: Settings) => Promise<void>;
      completionStore: CompletionStore;
    }) {
      const checkSession = () => {
        if (!isCurrent()) throw new Error('This sign-in session has ended.');
      };
      checkSession();
      if (pending?.sessionKey === sessionKey) throw finishInProgress;
      const attempt = { sessionKey };
      pending = attempt;
      try {
        await saveSettings({ ...settings });
        checkSession();
        await completionStore.markComplete(userId);
        checkSession();
      } finally {
        // A previous session must not unlock a newer session's attempt.
        if (pending === attempt) pending = null;
      }
    },
  };
}
