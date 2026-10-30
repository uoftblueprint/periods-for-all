import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings } from '@/foundation/contracts';
import { FontSizeStep, type ExtendedTextSize, EXTENDED_FONT_SCALE } from '@/features/onboarding/font-size-step';
import { MotionStep } from '@/features/onboarding/motion-step';

/**
 * Temporary preview for S2R-02 font-size and motion steps.
 * Tabs between the two screens. Remove before release.
 */
export default function PreviewS2R02() {
  const [tab, setTab] = useState<'font' | 'motion'>('font');
  const [textSize, setTextSize] = useState<ExtendedTextSize>('standard');
  const [reduceMotion, setReduceMotion] = useState(false);

  // Build appearance using the extended scale so the preview reflects the chosen size.
  const appearance = {
    ...getAppearance(defaultSettings),
    fontScale: EXTENDED_FONT_SCALE[textSize],
    reduceMotion,
  };

  return (
    <View style={styles.root}>
      {/* Tab bar */}
      <View style={styles.tabs}>
        {(['font', 'motion'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
            style={[styles.tab, tab === t && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'font' ? 'Font Size' : 'Motion'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Active step */}
      {tab === 'font' ? (
        <FontSizeStep value={textSize} onChange={setTextSize} appearance={appearance} />
      ) : (
        <MotionStep value={reduceMotion} onChange={setReduceMotion} appearance={appearance} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.backgroundElement,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.light.text,
  },
  tabText: { color: Colors.light.textSecondary },
  tabTextActive: { color: Colors.light.text, fontWeight: '600' },
});
