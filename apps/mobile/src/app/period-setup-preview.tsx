import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings } from '@/foundation/contracts';
import {
  PeriodSetupScreen, defaultPeriodSetup, type PeriodSetup,
} from '@/features/onboarding/period-setup-screen';

/** Temporary preview for S3-09 period setup flow. Remove before release. */
export default function PeriodSetupPreview() {
  const [setup, setSetup] = useState<PeriodSetup>(defaultPeriodSetup);
  const appearance = getAppearance(defaultSettings);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <View style={styles.root}>
      <PeriodSetupScreen
        initialValue={setup}
        today={today}
        appearance={appearance}
        onSave={async (next) => { setSetup(next); }}
        onFinish={() => {}}
        onExit={() => {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
