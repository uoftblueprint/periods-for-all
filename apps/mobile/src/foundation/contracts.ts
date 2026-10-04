// Shared agreements. Discuss changes here before changing a screen's props.
export type User = { id: string; email: string };
export type Credentials = { email: string; password: string };
export type SignInResult =
  | { ok: true; user: User }
  | { ok: false; message: string };

export type AuthService = {
  getUser: () => Promise<User | null>;
  signIn: (credentials: Credentials) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  // The real adapter will forward Supabase auth changes through this listener.
  subscribe: (listener: (user: User | null) => void) => () => void;
};

export type Settings = {
  textSize: 'standard' | 'large';
  colorScheme: 'light' | 'dark';
  reduceMotion: boolean;
};
export const defaultSettings: Settings = {
  textSize: 'standard', colorScheme: 'light', reduceMotion: false,
};

export type LoginScreenProps = {
  signIn: AuthService['signIn'];
  onSignedIn: (user: User) => void;
};
export type SettingsScreenProps = {
  settings: Settings;
  onChange: (settings: Settings) => void;
};

// Interfaces for the reusable components the team will implement.
export type AppButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
};
export type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
};
