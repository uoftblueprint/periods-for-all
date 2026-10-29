import { useEffect, useRef, type ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/app-button';
import { PreviewScreen } from '@/foundation/preview-screen';
import { getAppearance, type Appearance } from '@/features/settings/appearance';
import { DisplaySetup } from './display-setup';
import type { GatePresentation } from './onboarding-gate';

export function OnboardingShell({ model, navigator, appearance, bypass = false, sessionId, workKey, getWorkKey, onHomeReady }: {
  model: GatePresentation;
  navigator: ReactNode;
  appearance: Appearance;
  bypass?: boolean;
  sessionId: number;
  workKey: string;
  getWorkKey: () => string | null;
  onHomeReady: () => void;
}) {
  const setupSession = useRef<number | null>(null);
  const blocked = !bypass && model.view !== 'home' && model.view !== 'signedOut';
  const gateAppearance = model.view === 'setup' && model.setup ? getAppearance(model.setup.settings) : appearance;

  useEffect(() => {
    if (!bypass && model.view === 'setup') setupSession.current = sessionId;
    if (!bypass && model.view === 'home' && getWorkKey() === workKey && setupSession.current === sessionId) {
      setupSession.current = null;
      onHomeReady();
    }
  }, [bypass, model.view, sessionId, workKey, getWorkKey, onHomeReady]);

  return <View style={{ flex: 1, backgroundColor: appearance.colors.background }}>
    <View
      testID="app-navigator"
      style={{ flex: 1, display: blocked ? 'none' : 'flex', pointerEvents: blocked ? 'none' : 'auto' }}
      aria-hidden={blocked}
      accessibilityElementsHidden={blocked}
      importantForAccessibility={blocked ? 'no-hide-descendants' : 'auto'}
    >{navigator}</View>
    {blocked && <SafeAreaView style={{ flex: 1, backgroundColor: gateAppearance.colors.background }}>
      {model.view === 'setup' && model.setup ? <DisplaySetup {...model.setup} /> : <PreviewScreen
        title={model.view === 'error' ? 'We couldn’t check if you’re signed in' : 'Checking if you’re signed in'}
        appearance={appearance}
        autoFocusTitle
      >
        {model.view === 'error' ? <>
          <Text accessibilityRole="alert" style={{ color: appearance.colors.text, fontSize: 16 * appearance.fontScale }}>
            {model.error ?? 'Please try again.'}
          </Text>
          <AppButton label="Try again" appearance={appearance} onPress={model.retry} />
        </> : <>
          <ActivityIndicator accessibilityLabel="Loading display setup" color={appearance.colors.text} />
          <Text accessibilityLiveRegion="polite" style={{ color: appearance.colors.text, fontSize: 16 * appearance.fontScale }}>
            Loading display setup…
          </Text>
        </>}
      </PreviewScreen>}
    </SafeAreaView>}
  </View>;
}
