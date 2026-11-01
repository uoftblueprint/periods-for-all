// S2R-10: shared signup types. S2R-09 (screens) imports these.
// Separate from AuthService on purpose: signup is its own operation.

export type SignUpInput = { firstName: string; email: string; password: string };

export type SignUpResult =
  | { status: 'signedIn' }   // a real session exists
  | { status: 'checkEmail' } // no session yet: the user must confirm by email
  | { status: 'error'; message: string };

export type SignUp = (input: SignUpInput) => Promise<SignUpResult>;

export type SignupScreenProps = {
  signUp: SignUp;
  onSignedIn: () => void;
  onBackToLogin: () => void;
};