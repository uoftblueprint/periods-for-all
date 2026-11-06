// S2R-10: the signup ROUTE uses the real Supabase signup in Supabase mode,
// and lets the shared auth state (not the route) decide when to navigate.
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import SignUpRoute from '@/app/signup';
import { AuthProvider } from '@/features/auth/auth-provider';
import type { SignUp } from '@/features/auth/signup-contracts';
import type { AuthService, User } from '@/foundation/contracts';

const mockRedirect = jest.fn();
const mockRealSignUp = jest.fn<SignUp>();
const mockLoadSupabaseSignUp = jest.fn(async () => mockRealSignUp);

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => { mockRedirect(href); return null; },
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => false) },
}));
jest.mock('expo-router/react-navigation', () => ({ usePreventRemove: () => {} }));
// Stands in for the real Supabase loader, so we can see whether the route used it.
jest.mock('@/features/auth/load-supabase-signup', () => ({
  loadSupabaseSignUp: () => mockLoadSupabaseSignUp(),
}));

const originalMode = process.env.EXPO_PUBLIC_AUTH_MODE;
beforeEach(() => {
  jest.clearAllMocks();
  // Set every time, in case the jest config resets mock implementations.
  mockLoadSupabaseSignUp.mockImplementation(async () => mockRealSignUp);
  process.env.EXPO_PUBLIC_AUTH_MODE = 'supabase';
});
afterEach(() => {
  // Assigning undefined to process.env stores the text "undefined",
  // so delete the key instead when it wasn't set to begin with.
  if (originalMode === undefined) delete process.env.EXPO_PUBLIC_AUTH_MODE;
  else process.env.EXPO_PUBLIC_AUTH_MODE = originalMode;
});

const newUser: User = { id: 'u1', email: 'sam@example.com' };

/** Fake AuthService whose subscription the test can trigger with `emit`. */
function createAuthService() {
  let listener: (user: User | null) => void = () => {};
  const service: AuthService = {
    getUser: async () => null,
    signIn: async () => ({ ok: false, message: 'not used' }),
    signOut: async () => {},
    subscribe: (next) => { listener = next; return () => {}; },
  };
  return { service, emit: (user: User | null) => listener(user) };
}

async function renderRoute() {
  const auth = createAuthService();
  render(<AuthProvider service={auth.service}><SignUpRoute /></AuthProvider>);
  await screen.findByLabelText('First name'); // waits for the signup function to load
  return auth;
}

async function fillAndSubmit() {
  fireEvent.changeText(screen.getByLabelText('First name'), '  Sam ');
  fireEvent.changeText(screen.getByLabelText('Email address'), 'sam@example.com');
  fireEvent.press(screen.getByLabelText('Next'));
  fireEvent.changeText(screen.getByLabelText('Password'), 'Password!');
  await act(async () => { fireEvent.press(screen.getByLabelText('Next')); });
}

test('Supabase mode: the route sends the form to the real signup, not the fake', async () => {
  mockRealSignUp.mockResolvedValue({ status: 'checkEmail' });
  await renderRoute();
  await fillAndSubmit();

  expect(mockLoadSupabaseSignUp).toHaveBeenCalledTimes(1);
  expect(mockRealSignUp).toHaveBeenCalledWith({ firstName: 'Sam', email: 'sam@example.com', password: 'Password!' });
  expect(screen.getByText(/Check your email for next steps/)).toBeTruthy();
  expect(mockRedirect).not.toHaveBeenCalled();
});

test('signedIn: waits for the shared auth state, then goes to /home', async () => {
  mockRealSignUp.mockResolvedValue({ status: 'signedIn' });
  const auth = await renderRoute();
  await fillAndSubmit();

  // signUp alone does not navigate or create a user.
  expect(mockRedirect).not.toHaveBeenCalled();

  // The auth subscription reports the new session; AuthProvider updates.
  act(() => { auth.emit(newUser); });
  await waitFor(() => expect(mockRedirect).toHaveBeenCalledWith('/home'));
});

test('demo mode: never loads Supabase', async () => {
  process.env.EXPO_PUBLIC_AUTH_MODE = 'demo';
  await renderRoute();
  await fillAndSubmit();

  expect(mockLoadSupabaseSignUp).not.toHaveBeenCalled();
  expect(mockRealSignUp).not.toHaveBeenCalled();
  expect(screen.getByText(/Check your email for next steps/)).toBeTruthy();
});