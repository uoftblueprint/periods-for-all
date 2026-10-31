import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { OnboardingFonts, Spacing } from '@/constants/theme';
import type { Appearance } from '@/features/settings/appearance';

const displayWrench = require('../../../assets/onboarding/display-wrench.png');

export type DisplayIntroProps = { appearance: Appearance };

export function DisplayIntro({ appearance }: DisplayIntroProps) {
  const { colors, fontScale } = appearance;

  return (
    <View style={styles.content}>
      <Image
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        source={displayWrench}
        contentFit="contain"
        style={styles.illustration}
      />
      <View style={styles.copy}>
        <Text
          accessibilityRole="header"
          style={[
            styles.heading,
            { color: colors.text, fontSize: 33 * fontScale, lineHeight: 38 * fontScale },
          ]}
        >
          Let’s set up your display settings now!
        </Text>
        <Text
          style={[
            styles.explanation,
            { color: colors.text, fontSize: 16 * fontScale, lineHeight: 20 * fontScale },
          ]}
        >
          These are to control how your app looks.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', alignItems: 'center', gap: Spacing.three },
  illustration: { width: 160, height: 160 },
  copy: { width: '100%', alignItems: 'center', gap: Spacing.three },
  heading: { fontFamily: OnboardingFonts.bold, textAlign: 'center' },
  explanation: { fontFamily: OnboardingFonts.regular, textAlign: 'center' },
});
