import { useState } from 'react';
import { router } from 'expo-router';
import { LoginScreen } from '@/features/auth/login-screen';
import { createDemoAuth } from '@/foundation/demo-auth';
import { PreviewScreen } from '@/foundation/preview-screen';

export default function LoginPreview() {
  const [auth] = useState(createDemoAuth);
  return (
    <PreviewScreen title="Login preview (fake accounts)">
      <LoginScreen signIn={auth.signIn} onSignedIn={() => router.push('/home')} />
    </PreviewScreen>
  );
}
