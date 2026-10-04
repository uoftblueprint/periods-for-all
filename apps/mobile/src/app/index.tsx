import { Link } from 'expo-router';
import { Text } from 'react-native';
import { PreviewScreen } from '@/foundation/preview-screen';

export default function StartScreen() {
  return (
    <PreviewScreen title="Developer starting point">
      <Text>Preview screens independently. Fake accounts only; nothing is saved after reload.</Text>
      <Link href="/login">Open login preview</Link>
      <Link href="/settings">Open settings preview</Link>
      <Link href="/home">Open home placeholder</Link>
      <Link href="/playground">Open component playground</Link>
    </PreviewScreen>
  );
}
