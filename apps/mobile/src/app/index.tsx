import { Link } from 'expo-router';
import { Text } from 'react-native';
import { PreviewScreen } from '@/foundation/preview-screen';

export default function StartScreen() {
  return (
    <PreviewScreen title="Developer starting point">
      <Text>Component previews use separate demo accounts.</Text>
      <Link href="/login">Open login.</Link>
      <Link href="/settings">Open settings.</Link>
      <Link href="/home">Open home.</Link>
      <Text>Sign-in required.</Text>
      <Link href="/appearance-preview">Open appearance preview</Link>
      <Link href="/playground">Open component playground</Link>
      <Link href="/auth-preview">Open auth state preview</Link>
    </PreviewScreen>
  );
}
