import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthService, User } from '@/foundation/contracts';

export type AuthStatus = 'checking' | 'signedOut' | 'signedIn' | 'error';

export type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  error: string | null;
  signIn: AuthService['signIn'];
  signOut: () => Promise<void>;
  retry: () => void;
};

type AuthState = Pick<AuthContextValue, 'status' | 'user' | 'error'>;

const checking: AuthState = { status: 'checking', user: null, error: null };

function stateFromUser(user: User | null): AuthState {
  return user ? { status: 'signedIn', user, error: null } : { status: 'signedOut', user: null, error: null };
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ service, children }: { service: AuthService; children: ReactNode }) {
  const [state, setState] = useState<AuthState>(checking);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let receivedEvent = false;
    const unsubscribe = service.subscribe((user) => {
      if (!active) return;
      receivedEvent = true;
      setState(stateFromUser(user));
    });
    service.getUser().then(
      (user) => {
        if (active && !receivedEvent) setState(stateFromUser(user));
      },
      (cause: unknown) => {
        if (!active || receivedEvent) return;
        const message = cause instanceof Error ? cause.message : 'Could not check sign-in status.';
        setState({ status: 'error', user: null, error: message });
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [service, attempt]);

  const retry = useCallback(() => {
    setState(checking);
    setAttempt((n) => n + 1);
  }, []);
  const signOut = useCallback(() => service.signOut(), [service]);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, signIn: service.signIn, signOut, retry }),
    [state, service, signOut, retry],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth() must be used inside <AuthProvider>.');
  return value;
}
