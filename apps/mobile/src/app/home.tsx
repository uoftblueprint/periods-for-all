import { Link } from 'expo-router';
import { Text } from 'react-native';
import { PreviewScreen } from '@/foundation/preview-screen';
import  ButtonPreview  from '../app/button-preview';
import { Button } from 'expo-router/build/react-navigation';

export default function HomePreview() {
  return (
    <PreviewScreen title="Home placeholder">
      <Text>This route is open for development. Real login protection is still to be built.</Text>
      <Link href="/settings">Open settings</Link>
      <Link href="/">Back to developer starting point</Link>
      <ButtonPreview></ButtonPreview>
    </PreviewScreen>
  );
}
