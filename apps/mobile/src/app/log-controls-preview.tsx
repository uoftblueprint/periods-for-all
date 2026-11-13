import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings } from '@/foundation/contracts';
import { MoodPicker, type Mood } from '@/features/health/mood-picker';
import { FlowPicker, type Flow } from '@/features/health/flow-picker';

/** Temporary preview for S3-04 mood and flow controls. Remove before release. */
export default function LogControlsPreview() {
  // Preview owns state — controls are stateless and call onChange.
  const [mood, setMood] = useState<Mood | null>(null);
  const [flow, setFlow] = useState<Flow | null>(null);
  const appearance = getAppearance(defaultSettings);
  const { colors, fontScale } = appearance;

  return (
    <ScrollView contentContainerStyle={[styles.scroll, { backgroundColor: colors.background }]}>
      {/* Mood picker */}
      <View style={[styles.section, { backgroundColor: colors.backgroundElement }]}>
        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: 16 * fontScale }]}>
          Mood
        </Text>
        <MoodPicker value={mood} onChange={setMood} appearance={appearance} />
      </View>

      {/* Flow picker */}
      <View style={[styles.section, { backgroundColor: colors.backgroundElement }]}>
        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: 16 * fontScale }]}>
          Flow
        </Text>
        <FlowPicker value={flow} onChange={setFlow} appearance={appearance} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.three, gap: Spacing.three },
  section: { borderRadius: 12, padding: Spacing.three, gap: Spacing.two },
  sectionTitle: { fontWeight: '700', textAlign: 'center' },
});
