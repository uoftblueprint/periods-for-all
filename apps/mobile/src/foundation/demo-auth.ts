import type { AuthService, User } from './contracts';

// Fake, in-memory accounts for UI work. Never imports or calls Supabase.
export function createDemoAuth(): AuthService {
  let user: User | null = null;
  const listeners = new Set<(user: User | null) => void>();
  function publish(nextUser: User | null) {
    user = nextUser;
    listeners.forEach((listener) => listener(user));
  }
  return {
    getUser: async () => user,
    async signIn({ email, password }) {
      if (email !== 'demo@example.com' || password !== 'demo-only') {
        return { ok: false, message: 'Use the demo account shown in the playground.' };
      }
      const nextUser = { id: 'demo-user', email };
      publish(nextUser);
      return { ok: true, user: nextUser };
    },
    async signOut() { publish(null); },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
