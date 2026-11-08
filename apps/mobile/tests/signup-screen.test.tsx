import { expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SignUpScreen } from '@/features/auth/signup-screen';
import type { SignUpResult, SignupScreenProps } from '@/features/auth/signup-contracts';

const mockBlockers = new Map<object, boolean>();
const mockBackHandlers = new Map<object, () => void>();

jest.mock('expo-router/react-navigation', () => ({
  usePreventRemove: (enabled: boolean, onBack: () => void) => {
    const React = require('react');
    const id = React.useRef({}).current;
    React.useEffect(() => {
      mockBlockers.set(id, enabled);
      mockBackHandlers.set(id, onBack);
      return () => { mockBlockers.delete(id); mockBackHandlers.delete(id); };
    }, [id, enabled, onBack]);
  },
}));

test('disables navigation blockers before notifying successful signup', async () => {
  const onSignedIn = jest.fn(() => {
    expect([...mockBlockers.values()]).toEqual([false, false]);
  });
  render(<SignUpScreen
    signUp={async () => ({ status: 'signedIn' })}
    onSignedIn={onSignedIn}
    onBackToLogin={jest.fn()}
  />);
  fireEvent.changeText(screen.getByLabelText('First name'), 'Sam');
  fireEvent.changeText(screen.getByLabelText('Email address'), 'sam@example.com');
  fireEvent.press(screen.getByLabelText('Next'));
  expect([...mockBlockers.values()]).toEqual([false, true]);
  fireEvent.changeText(screen.getByLabelText('Password'), 'Password!');
  await act(async () => { fireEvent.press(screen.getByLabelText('Next')); });
  expect(onSignedIn).toHaveBeenCalledTimes(1);
});


function renderSignup(signUp = jest.fn<SignupScreenProps['signUp']>()) {
  const onSignedIn = jest.fn();
  const onBackToLogin = jest.fn();
  render(<SignUpScreen signUp={signUp} onSignedIn={onSignedIn} onBackToLogin={onBackToLogin} />);
  return { signUp, onSignedIn, onBackToLogin };
}

function enterDetails(firstName = 'Sam', email = 'sam@example.com') {
  fireEvent.changeText(screen.getByLabelText('First name'), firstName);
  fireEvent.changeText(screen.getByLabelText('Email address'), email);
  fireEvent.press(screen.getByLabelText('Next'));
}

function goBack() {
  act(() => {
    const activeBlocker = [...mockBlockers.entries()].find(([, enabled]) => enabled);
    expect(activeBlocker).toBeDefined();
    mockBackHandlers.get(activeBlocker![0])!();
  });
}

test('shows check-email instructions and returns to login on request', async () => {
  const { signUp, onSignedIn, onBackToLogin } = renderSignup(
    jest.fn<SignupScreenProps['signUp']>().mockResolvedValue({ status: 'checkEmail' }),
  );
  enterDetails('  Sam  ', '  sam@example.com  ');
  fireEvent.changeText(screen.getByLabelText('Password'), 'Password!');
  await act(async () => { fireEvent.press(screen.getByLabelText('Next')); });

  expect(signUp).toHaveBeenCalledWith({ firstName: 'Sam', email: 'sam@example.com', password: 'Password!' });
  expect(screen.getByText(/Check your email for next steps/)).toBeTruthy();
  expect(screen.queryByLabelText('Password')).toBeNull();
  expect([...mockBlockers.values()]).toEqual([false, false]);
  expect(onSignedIn).not.toHaveBeenCalled();
  expect(onBackToLogin).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Back to login'));
  expect(onBackToLogin).toHaveBeenCalledTimes(1);
});

test.each(['returned', 'thrown'] as const)('displays %s errors and allows retry', async (kind) => {
  const signUp = jest.fn<SignupScreenProps['signUp']>();
  if (kind === 'returned') {
    signUp.mockResolvedValueOnce({ status: 'error', message: 'Unable to create account.' });
  } else {
    signUp.mockRejectedValueOnce(new Error('Network unavailable'));
  }
  signUp.mockResolvedValueOnce({ status: 'signedIn' });
  const { onSignedIn, onBackToLogin } = renderSignup(signUp);
  enterDetails();
  fireEvent.changeText(screen.getByLabelText('Password'), 'Password!');
  await act(async () => { fireEvent.press(screen.getByLabelText('Next')); });

  expect(screen.getByRole('alert').props.children).toBe(kind === 'returned'
    ? 'Unable to create account.' : 'An unexpected error occurred. Please try again.');
  expect(screen.getByLabelText('Next')).toBeEnabled();
  expect(screen.getByLabelText('Password')).toHaveProp('editable', true);
  expect(onSignedIn).not.toHaveBeenCalled();
  expect(onBackToLogin).not.toHaveBeenCalled();
  await act(async () => { fireEvent.press(screen.getByLabelText('Next')); });
  expect(signUp).toHaveBeenCalledTimes(2);
  expect(onSignedIn).toHaveBeenCalledTimes(1);
});

test('ignores repeated submissions and disables password controls while pending', async () => {
  let finish!: (result: SignUpResult) => void;
  const signUp = jest.fn(() => new Promise<SignUpResult>((resolve) => { finish = resolve; }));
  const { onSignedIn } = renderSignup(signUp);
  enterDetails();
  fireEvent.changeText(screen.getByLabelText('Password'), 'Password!');
  // Batch presses to exercise the ref guard before disabled state renders.
  const button = screen.getByLabelText('Next');
  act(() => {
    fireEvent.press(button);
    fireEvent.press(button);
    fireEvent.press(button);
  });
  expect(signUp).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Signing up...')).toBeDisabled();
  expect(screen.getByLabelText('Password')).toHaveProp('editable', false);
  expect(screen.getByLabelText('Show password')).toBeDisabled();
  fireEvent.press(screen.getByLabelText('Signing up...'));
  expect(signUp).toHaveBeenCalledTimes(1);
  await act(async () => { finish({ status: 'signedIn' }); });
  expect(onSignedIn).toHaveBeenCalledTimes(1);
});

test('back from details returns to login', () => {
  const { onBackToLogin, signUp } = renderSignup();
  goBack();
  expect(onBackToLogin).toHaveBeenCalledTimes(1);
  expect(signUp).not.toHaveBeenCalled();
});

test('back from password preserves details and clears validation errors', () => {
  const { onBackToLogin, signUp } = renderSignup();
  enterDetails();
  fireEvent.press(screen.getByLabelText('Next'));
  expect(screen.getByRole('alert')).toBeTruthy();
  goBack();
  expect(screen.getByLabelText('First name')).toHaveProp('value', 'Sam');
  expect(screen.getByLabelText('Email address')).toHaveProp('value', 'sam@example.com');
  expect(screen.queryByRole('alert')).toBeNull();
  expect(onBackToLogin).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Next'));
  expect(screen.getByLabelText('Password')).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(signUp).not.toHaveBeenCalled();
});

test.each([
  ['', '', ['Enter your first name.', 'Enter a valid email address.']],
  ['   ', 'sam@example.com', ['Enter your first name.']],
  ['Sam', 'invalid', ['Enter a valid email address.']],
  ['Sam', 'sam@', ['Enter a valid email address.']],
  ['Sam', 'sam@example', ['Enter a valid email address.']],
  ['Sam', 'sam @example.com', ['Enter a valid email address.']],
])('rejects invalid details (%j, %j)', (name, email, messages) => {
  const { signUp } = renderSignup();
  enterDetails(name, email);
  for (const message of messages) expect(screen.getByText(message)).toBeTruthy();
  expect(screen.queryByLabelText('Password')).toBeNull();
  expect(signUp).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('First name'), 'Sam');
  fireEvent.changeText(screen.getByLabelText('Email address'), 'sam@example.com');
  expect(screen.queryByRole('alert')).toBeNull();
  fireEvent.press(screen.getByLabelText('Next'));
  expect(screen.getByLabelText('Password')).toBeTruthy();
});

test.each([
  ['', ['Be at least 8 characters long', 'Have one special character', 'Have one upper case letter']],
  ['Short!', ['Be at least 8 characters long']],
  ['Password1', ['Have one special character']],
  ['password!', ['Have one upper case letter']],
])('rejects password %j and clears the error when edited', (password, missing) => {
  const { signUp } = renderSignup();
  enterDetails();
  fireEvent.changeText(screen.getByLabelText('Password'), password);
  fireEvent.press(screen.getByLabelText('Next'));
  expect(screen.getByRole('alert').props.children).toBe(
    `Password is missing requirements: ${missing.join('; ')}.`,
  );
  expect(signUp).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('Password'), 'Password!');
  expect(screen.queryByRole('alert')).toBeNull();
  for (const rule of ['Be at least 8 characters long', 'Have one special character', 'Have one upper case letter']) {
    expect(screen.getByLabelText(`Requirement met: ${rule}`)).toBeTruthy();
  }
});