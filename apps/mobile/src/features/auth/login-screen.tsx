import { Text } from 'react-native';
import type { LoginScreenProps } from '@/foundation/contracts';

export function LoginScreen(_props: LoginScreenProps) {
  // Build the form here. Await props.signIn({ email, password }).
  // If result.ok, call props.onSignedIn(result.user); otherwise show result.message.
  return <Text>Login form goes here. See the playground for fake success/error responses.</Text>;
}
