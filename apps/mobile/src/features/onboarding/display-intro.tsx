import { StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import type { Appearance } from '@/features/settings/appearance';

export type DisplayIntroProps = { appearance: Appearance };

export function DisplayIntro({ appearance }: DisplayIntroProps) {
  const { colors, fontScale } = appearance;

  return (
    <View style={[styles.content, { backgroundColor: colors.background }]}>
      <View
        style={[styles.illustration, { backgroundColor: colors.backgroundElement }]}
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text style={{ fontSize: 48 * fontScale, color: colors.textSecondary }}>🎨</Text>
      </View>
      <Text style={[styles.heading, { color: colors.text, fontSize: 24 * fontScale }]}>
        Let&apos;s set up your display settings now!
      </Text>
      <Text
        style={[
          styles.explanation,
          { color: colors.textSecondary, fontSize: 16 * fontScale, lineHeight: 24 * fontScale },
        ]}
      >
        These are to control how your app looks.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.five,
  },
  illustration: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.five,
  },
  heading: { fontWeight: '700', textAlign: 'center', marginBottom: Spacing.three },
  explanation: { textAlign: 'center' },
});
