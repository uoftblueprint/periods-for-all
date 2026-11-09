import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { DisplaySetup } from '@/features/onboarding/display-setup';
import { defaultSettings } from '@/foundation/contracts';

type Outcome = 'running' | 'finished' | 'exited';

export default function DisplaySetupPreview() {
  const { debug } = useLocalSearchParams<{ debug?: string }>();
  const [settings, setSettings] = useState(defaultSettings);
  const [rejectFinish, setRejectFinish] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>('running');

  function restart() {
    setSettings(defaultSettings);
    setOutcome('running');
  }

  if (outcome !== 'running') {
    return (
      <View style={styles.result}>
        <Text style={styles.resultTitle}>
          {outcome === 'finished' ? 'Display setup finished.' : 'Display setup exited.'}
        </Text>
        <Text>{JSON.stringify(settings)}</Text>
        <Pressable accessibilityRole="button" onPress={restart} style={styles.restart}>
          <Text style={styles.restartLabel}>Restart preview</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {debug === 'true' && (
        <View style={styles.previewControls}>
          <Text style={styles.previewLabel}>Reject finish (test failure and retry)</Text>
          <Switch
            accessibilityLabel="Reject finish"
            accessibilityHint="Makes the next finish attempt fail so retry behavior can be tested"
            value={rejectFinish}
            onValueChange={setRejectFinish}
          />
        </View>
      )}
      <DisplaySetup
        settings={settings}
        onChange={setSettings}
        onExit={() => setOutcome('exited')}
        onFinish={async () => {
          await new Promise((resolve) => setTimeout(resolve, 500));
          if (rejectFinish) throw new Error('The preview save was rejected.');
          setOutcome('finished');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  previewControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    padding: Spacing.three,
    backgroundColor: '#FFF3CD',
  },
  previewLabel: { flex: 1, color: '#3B3000', fontWeight: '600' },
  result: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  resultTitle: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  restart: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    backgroundColor: '#111',
    borderRadius: 10,
  },
  restartLabel: { color: '#fff', fontWeight: '700' },
});
