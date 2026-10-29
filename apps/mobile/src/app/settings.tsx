import { Text } from 'react-native';
import { AppButton } from '@/components/app-button';
import { SettingsScreen } from '@/features/settings/settings-screen';
import { useSettings } from '@/features/settings/settings-provider';
import { getAppearance } from '@/features/settings/appearance';
import { PreviewScreen } from '@/foundation/preview-screen';

export default function SettingsRoute() {
  const { settings, updateSettings, error, isLoading, loadError, retryLoad } = useSettings();
  const appearance = getAppearance(settings);
  const textStyle = { color: appearance.colors.text, fontSize: 16 * appearance.fontScale };
  return <PreviewScreen title="Settings" appearance={appearance} autoFocusTitle>
    {isLoading ? <Text style={textStyle} accessibilityLiveRegion="polite">Loading saved settings…</Text> : loadError ? <>
      <Text style={textStyle} accessibilityRole="alert">{loadError}</Text>
      <AppButton label="Try again" appearance={appearance} onPress={retryLoad} />
    </> : <>
      <Text style={textStyle}>Text size: {settings.textSize === 'extraLarge' ? 'extra large' : settings.textSize}. Colour theme: {settings.colorScheme === 'highContrast' ? 'high contrast' : settings.colorScheme}.</Text>
      {error && <Text style={textStyle} accessibilityRole="alert">{error}</Text>}
      <SettingsScreen settings={settings} appearance={appearance} onChange={(next) => {
        // The provider displays the error and retains the optimistic selection.
        void updateSettings(next).catch(() => {});
      }} />
    </>}
  </PreviewScreen>;
}
