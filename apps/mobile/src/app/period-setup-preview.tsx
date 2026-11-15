import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings } from '@/foundation/contracts';
import {
  PeriodSetupScreen, defaultPeriodSetup, type PeriodSetup,
} from '@/features/onboarding/period-setup-screen';

/** Preview route for S3-09 period setup flow. */
export default function PeriodSetupPreview() {
  const [setup, setSetup] = useState<PeriodSetup>(defaultPeriodSetup);
  const appearance = getAppearance(defaultSettings);
  // Local date, not UTC — toISOString() can shift the date near midnight.
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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
