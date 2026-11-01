import { expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { LoginScreen } from '@/features/auth/login-screen';
import type { SignInResult } from '@/foundation/contracts';

test('ignores extra presses while sign-in is in progress', async () => {
  let finish!: (r: SignInResult) => void;
  const signIn = jest.fn(() => new Promise<SignInResult>((r) => { finish = r; }));
  const onSignedIn = jest.fn();

  render(<LoginScreen signIn={signIn} onSignedIn={onSignedIn} />);
  fireEvent.changeText(screen.getByLabelText('Email address'), 'demo@example.com');
  fireEvent.changeText(screen.getByLabelText('Password'), 'demo-only');

  const button = screen.getByRole('button', { name: 'Login' });
  fireEvent.press(button);
  fireEvent.press(button);
  fireEvent.press(button);
  expect(signIn).toHaveBeenCalledTimes(1);
  expect(signIn).toHaveBeenCalledWith({ email: 'demo@example.com', password: 'demo-only' });

  const user = { id: '1', email: 'demo@example.com' };
  await act(async () => finish({ ok: true, user }));
  expect(onSignedIn).toHaveBeenCalledWith(user);
});
