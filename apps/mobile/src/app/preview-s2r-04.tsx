import { useState } from 'react';
import { ScrollView } from 'react-native';
import { DisplayIntro } from '@/features/onboarding/display-intro';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings, type Settings } from '@/foundation/contracts';

/**
 * Temporary preview route for the display introduction screen.
 * Toggles between light/dark and standard/large to verify appearance handling.
 * Remove before release.
 */
export default function PreviewS2R04() {
  const [settings] = useState<Settings>(defaultSettings);
  const appearance = getAppearance(settings);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: appearance.colors.background }} contentContainerStyle={{ flexGrow: 1 }}>
      <DisplayIntro appearance={appearance} />
    </ScrollView>
  );
}
