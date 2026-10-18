// F09: maps Supabase Auth onto the team's AuthService contract.

import type { AuthError, SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js';
import type { AuthService, Credentials, User } from '@/foundation/contracts';

/** The four Supabase auth methods this adapter uses. Tests fake only these. */
export type AuthClient = Pick<
  SupabaseClient['auth'],
  'getSession' | 'signInWithPassword' | 'signOut' | 'onAuthStateChange'
>;

export function toAppUser(user: SupabaseUser | null | undefined): User | null {
  if (!user) return null;
  if (!user.email) return null;
  return { id: user.id, email: user.email };
}

export const SIGN_IN_MESSAGES = {
  invalidCredentials: 'Incorrect email or password.',
  emailNotConfirmed: 'Please confirm your email address before signing in.',
  tooManyAttempts: 'Too many attempts. Please wait a moment and try again.',
  missingEmail: 'This account cannot sign in with email. Please contact support.',
  unavailable: 'Could not sign in right now. Please try again.',
} as const;

function signInMessage(error: AuthError): string {
  if (error.code === 'invalid_credentials') return SIGN_IN_MESSAGES.invalidCredentials;
  if (error.code === 'email_not_confirmed') return SIGN_IN_MESSAGES.emailNotConfirmed;
  if (error.code === 'over_request_rate_limit') return SIGN_IN_MESSAGES.tooManyAttempts;
  return SIGN_IN_MESSAGES.unavailable;
}

export function createAuthFromClient(auth: AuthClient): AuthService {
  return {
    // Reads the session Supabase saved on the device, so a user who reopens
    // the app is still signed in. Refresh is configured in lib/supabase.ts.
    async getUser() {
      const { data, error } = await auth.getSession();
      if (error) throw error;
      return toAppUser(data.session?.user);
    },

    async signIn({ email, password }: Credentials) {
      try {
        const { data, error } = await auth.signInWithPassword({ email, password });
        if (error) return { ok: false, message: signInMessage(error) };

        const user = toAppUser(data.user);
        if (!user) {
          // Signed in but unusable for this app: don't leave a session behind.
          await auth.signOut().catch(() => undefined);
          return { ok: false, message: SIGN_IN_MESSAGES.missingEmail };
        }
        return { ok: true, user };
      } catch {
        // Network failure or an unexpected throw: still a safe result.
        return { ok: false, message: SIGN_IN_MESSAGES.unavailable };
      }
    },

    async signOut() {
      const { error } = await auth.signOut();
      if (error) throw error;
    },

    // Forwards FUTURE changes only. Supabase also fires INITIAL_SESSION as
    // soon as you subscribe; callers get the current user from getUser().
    subscribe(listener) {
      const { data } = auth.onAuthStateChange((event, session) => {
        if (event === 'INITIAL_SESSION') return;
        listener(toAppUser(session?.user));
      });
      return () => data.subscription.unsubscribe();
    },
  };
}
