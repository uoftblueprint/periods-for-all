// S2R-10: connects the signup form to Supabase's signUp.
//
// Only `import type` lines, so tests can pass in a fake client.
// supabase-auth.ts plugs in the app's single real client.

import type { AuthError, SupabaseClient } from '@supabase/supabase-js';
import type { SignUp, SignUpInput, SignUpResult } from './signup-contracts';

/** The one Supabase auth method signup uses. Tests fake only this. */
export type SignUpClient = Pick<SupabaseClient['auth'], 'signUp'>;

/** Messages safe to show on screen. Raw Supabase errors never reach the UI. */
export const SIGN_UP_MESSAGES = {
  missingName: 'Please enter your first name.',
  missingEmail: 'Please enter your email address.',
  invalidEmail: 'Please enter a valid email address.',
  weakPassword: 'Please choose a stronger password.',
  // Existing account: no promise a new account was made, no account details.
  alreadyRegistered: 'We could not create an account with this email. If you already have one, please log in.',
  tooManyAttempts: 'Too many attempts. Please wait a moment and try again.',
  network: 'Could not connect. Check your internet connection and try again.',
  unavailable: 'Could not create your account right now. Please try again.',
} as const;

function signUpMessage(error: AuthError): string {
  // Supabase reports "no internet / no response" as this error type.
  if (error.name === 'AuthRetryableFetchError') return SIGN_UP_MESSAGES.network;
  switch (error.code) {
    case 'user_already_exists':
    case 'email_exists':
      return SIGN_UP_MESSAGES.alreadyRegistered;
    case 'weak_password':
      return SIGN_UP_MESSAGES.weakPassword;
    case 'email_address_invalid':
      return SIGN_UP_MESSAGES.invalidEmail;
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return SIGN_UP_MESSAGES.tooManyAttempts;
    default:
      return SIGN_UP_MESSAGES.unavailable;
  }
}

export function createSignUpFromClient(auth: SignUpClient): SignUp {
  // If the form is submitted twice quickly, reuse the request already running
  // instead of creating a second signup.
  let inFlight: Promise<SignUpResult> | null = null;

  async function run({ firstName, email, password }: SignUpInput): Promise<SignUpResult> {
    // Trim name and email only. Passwords are sent exactly as typed.
    const name = firstName.trim();
    const trimmedEmail = email.trim();
    if (!name) return { status: 'error', message: SIGN_UP_MESSAGES.missingName };
    if (!trimmedEmail) return { status: 'error', message: SIGN_UP_MESSAGES.missingEmail };

    try {
      const { data, error } = await auth.signUp({
        email: trimmedEmail,
        password,
        options: { data: { first_name: name } }, // user metadata, not a role
      });
      if (error) return { status: 'error', message: signUpMessage(error) };

      // signedIn ONLY with a real session. The existing auth subscription
      // (F09/F10) picks it up and updates shared state; no User is made here.
      if (data.session) return { status: 'signedIn' };

      // A user object without a session means email confirmation is needed.
      // Supabase also answers this way for an already-registered email, so
      // this must not be read as "a new account was created".
      return { status: 'checkEmail' };
    } catch {
      return { status: 'error', message: SIGN_UP_MESSAGES.network };
    }
  }

  return (input) => {
    if (!inFlight) {
      inFlight = run(input).finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  };
}