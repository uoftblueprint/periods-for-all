import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings, textSizes, type Settings } from '@/foundation/contracts';
import { MoodPicker, type Mood } from '@/features/health/mood-picker';
import { FlowPicker, type Flow } from '@/features/health/flow-picker';

/** Temporary preview for S3-04 mood and flow controls. Remove before release. */
export default function LogControlsPreview() {
  // Preview owns state — controls are stateless and call onChange.
  const [mood, setMood] = useState<Mood | null>(null);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [textSize, setTextSize] = useState<Settings['textSize']>('standard');
  const appearance = getAppearance({ ...defaultSettings, textSize });
  const { colors, fontScale } = appearance;

  return (
    <ScrollView contentContainerStyle={[styles.scroll, { backgroundColor: colors.background }]}>
      {/* Text size switcher */}
      <View style={styles.sizeRow}>
        {textSizes.map((size) => (
          <Pressable
            key={size}
            onPress={() => setTextSize(size)}
            style={[
              styles.sizeButton,
              {
                backgroundColor: size === textSize ? colors.text : colors.backgroundElement,
              },
            ]}
          >
            <Text style={{
              color: size === textSize ? colors.background : colors.text,
              fontSize: 12,
              fontWeight: '600',
            }}>
              {size}
            </Text>
          </Pressable>
        ))}
      </View>

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
  sizeRow: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  sizeButton: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.two, borderRadius: 8 },
  section: { borderRadius: 12, padding: Spacing.three, gap: Spacing.two },
  sectionTitle: { fontWeight: '700', textAlign: 'center' },
});
