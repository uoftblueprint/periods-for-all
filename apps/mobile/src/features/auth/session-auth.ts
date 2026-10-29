import type { AuthService, Credentials, User } from '@/foundation/contracts';

// Operations fence gate work immediately; confirmed boundaries identify sessions.
export function createSessionAuth(loadService: () => Promise<AuthService>) {
  let generation = 0;
  let revision = 0;
  let events = 0;
  let user: User | null = null;
  let operation: { boundarySeen: boolean } | null = null;
  let source: Promise<AuthService> | null = null;
  let unsubscribe: (() => void) | null = null;
  const listeners = new Set<(next: User | null) => void>();
  const observers = new Set<() => void>();
  let snapshot = { generation, key: '0:0', pending: false, userId: null as string | null };

  function notify() {
    snapshot = { generation, key: `${generation}:${revision}`, pending: operation !== null, userId: user?.id ?? null };
    observers.forEach((listener) => listener());
  }

  function publish(next: User | null, forceBoundary = false) {
    if ((user?.id !== next?.id || forceBoundary) && (!operation || !operation.boundarySeen)) {
      generation += 1;
      if (operation) operation.boundarySeen = true;
    }
    user = next;
    notify();
    listeners.forEach((listener) => listener(next));
  }

  function connect(service: AuthService) {
    if (listeners.size && !unsubscribe) {
      unsubscribe = service.subscribe((next) => {
        events += 1;
        publish(next);
      });
    }
    return service;
  }

  function getService() {
    source ??= Promise.resolve().then(loadService).then(connect).catch((error) => {
      source = null;
      throw error;
    });
    return source.then(connect);
  }

  function begin() {
    if (operation) throw new Error('Please wait for the current sign-in action to finish.');
    const next = { boundarySeen: false };
    operation = next;
    revision += 1;
    notify();
    return next;
  }

  function end(current: NonNullable<typeof operation>) {
    if (operation === current) {
      operation = null;
      notify();
    }
  }

  const service: AuthService = {
    async getUser() {
      const startRevision = revision;
      const startEvents = events;
      try {
        const next = await (await getService()).getUser();
        if (startRevision === revision && startEvents === events && !operation) publish(next);
        return user;
      } catch (error) {
        if (startRevision !== revision || startEvents !== events) return user;
        throw error;
      }
    },
    async signIn(credentials: Credentials) {
      if (snapshot.pending) return { ok: false, message: 'Please wait for the current sign-in action to finish.' };
      const current = begin();
      try {
        const result = await (await getService()).signIn(credentials);
        // A different account notification supersedes this operation's late result.
        if (result.ok && operation === current &&
            (!current.boundarySeen || user?.id === result.user.id)) {
          publish(result.user, !current.boundarySeen);
        }
        return result;
      } finally {
        end(current);
      }
    },
    async signOut() {
      const current = begin();
      try {
        await (await getService()).signOut();
        if (operation === current && (!current.boundarySeen || user === null)) {
          publish(null);
        }
      } finally {
        end(current);
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      // getUser reports initialization failures through the existing provider.
      void getService().catch(() => {});
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          unsubscribe?.();
          unsubscribe = null;
        }
      };
    },
  };

  return {
    service,
    getSnapshot: () => snapshot,
    getWorkKey: () => operation || !user ? null : snapshot.key,
    subscribe(listener: () => void) {
      observers.add(listener);
      return () => { observers.delete(listener); };
    },
  };
}
