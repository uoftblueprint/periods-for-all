export type User = { id: string; email: string };
export type Credentials = { email: string; password: string };
export type SignInResult =
  | { ok: true; user: User }
  | { ok: false; message: string };

export type AuthService = {
  getUser: () => Promise<User | null>;
  signIn: (credentials: Credentials) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  subscribe: (listener: (user: User | null) => void) => () => void;
};

export const textSizes = ['standard', 'large', 'extraLarge', 'largest'] as const;
export const colorSchemes = ['light', 'highContrast', 'dark'] as const;

export type TextSize = (typeof textSizes)[number];
export type ColorScheme = (typeof colorSchemes)[number];

export type Settings = {
  textSize: TextSize;
  colorScheme: ColorScheme;
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
