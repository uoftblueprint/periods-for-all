import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings, type Settings } from '@/foundation/contracts';
import { FontSizeStep } from '@/features/onboarding/font-size-step';
import { MotionStep } from '@/features/onboarding/motion-step';

/**
 * Temporary preview for S2R-02 font-size and motion steps.
 * Tabs between the two screens. Remove before release.
 */
export default function PreviewS2R02() {
  const [tab, setTab] = useState<'font' | 'motion'>('font');
  const [textSize, setTextSize] = useState<Settings['textSize']>('standard');
  const [reduceMotion, setReduceMotion] = useState(false);

  const appearance = getAppearance({ ...defaultSettings, textSize, reduceMotion });

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

      {/* Active step wrapped in ScrollView since components no longer scroll themselves */}
      <ScrollView contentContainerStyle={styles.stepContent}>
        {tab === 'font' ? (
          <FontSizeStep value={textSize} onChange={setTextSize} appearance={appearance} />
        ) : (
          <MotionStep value={reduceMotion} onChange={setReduceMotion} appearance={appearance} />
        )}
      </ScrollView>
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
  stepContent: { paddingTop: Spacing.five, paddingBottom: Spacing.five },
});
