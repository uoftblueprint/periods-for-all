export type SignUpInput = { firstName: string; email: string; password: string };

export type SignUpResult =
  | { status: 'signedIn' }
  | { status: 'checkEmail' }
  | { status: 'error'; message: string };

export type SignUp = (input: SignUpInput) => Promise<SignUpResult>;

export type SignupScreenProps = {
  signUp: SignUp;
  onSignedIn: () => void;
  onBackToLogin: () => void;
};