import { useState } from 'react';
import { Button, Text } from 'react-native';
import { createDemoAuth } from '@/foundation/demo-auth';
import { PreviewScreen } from '@/foundation/preview-screen';

export default function Playground() {
  const [auth] = useState(createDemoAuth);
  const [message, setMessage] = useState('Choose a fake result below.');
  async function tryLogin(password: string) {
    const result = await auth.signIn({ email: 'demo@example.com', password });
    setMessage(result.ok ? `Fake login succeeded: ${result.user.email}` : result.message);
  }
  return (
    <PreviewScreen title="Component playground">
      <Text>Fake account: demo@example.com / demo-only. Never use real credentials here.</Text>
      <Button title="Try fake success" onPress={() => void tryLogin('demo-only')} />
      <Button title="Try fake error" onPress={() => void tryLogin('wrong')} />
      <Text accessibilityLiveRegion="polite">{message}</Text>
      <Text>Add your component below to check it without waiting for another screen.</Text>
      {/* Example: <AppButton label="Continue" onPress={() => setMessage('Pressed')} /> */}
    </PreviewScreen>
  );
}
