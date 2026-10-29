import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import type { Appearance } from '@/features/settings/appearance';

/** Props for the display introduction screen. */
export type DisplayIntroProps = { appearance: Appearance };

/**
 * Introduction screen shown before display settings setup.
 * Renders a placeholder illustration, heading, and explanation.
 * Content only — navigation buttons are owned by S2R-05.
 */
export function DisplayIntro({ appearance }: DisplayIntroProps) {
  const { colors, fontScale } = appearance;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Placeholder illustration — replace with exported artwork when available */}
      <View
        style={[styles.illustration, { backgroundColor: colors.backgroundElement }]}
        accessibilityElementsHidden={true}
        importantForAccessibility="no-hide-descendants"
      >
        <Text style={{ fontSize: 48 * fontScale, color: colors.textSecondary }}>🎨</Text>
      </View>

      <Text style={[styles.heading, { color: colors.text, fontSize: 24 * fontScale }]}>
        Let's set up your display settings now!
      </Text>

      <Text style={[styles.explanation, { color: colors.textSecondary, fontSize: 16 * fontScale, lineHeight: 24 * fontScale }]}>
        These are to control how your app looks.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.six,
    paddingBottom: Spacing.five,
  },
  illustration: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.five,
  },
  heading: {
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.three,
  },
  explanation: {
    textAlign: 'center',
  },
});
