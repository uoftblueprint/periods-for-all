import { Pressable, StyleSheet, Text, View } from 'react-native';

import { OnboardingColors, OnboardingFonts, Spacing } from '@/constants/theme';
import type { Appearance } from '@/features/settings/appearance';

export type MotionStepProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  appearance: Appearance;
};

export function MotionStep({ value, onChange, appearance }: MotionStepProps) {
  const { colors, fontScale } = appearance;

  return (
    <View style={styles.content}>
      <Text
        style={[
          styles.body,
          { color: colors.text, fontSize: 16 * fontScale, lineHeight: 20 * fontScale },
        ]}
      >
        This will change how much motion there is throughout the app.
      </Text>

      <View style={styles.controlGroup}>
        <View
          style={[
            styles.row,
            {
              backgroundColor:
                colors.background === '#FCFBF8' ? OnboardingColors.white : colors.backgroundElement,
            },
          ]}
        >
          <Text
            style={[
              styles.label,
              { color: colors.text, fontSize: 16 * fontScale, lineHeight: 20 * fontScale },
            ]}
          >
            Reduce Motion
          </Text>
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel="Reduce Motion"
            accessibilityHint="Less animation throughout the app"
            accessibilityState={{ checked: value }}
            onPress={() => onChange(!value)}
            style={({ pressed }) => [
              styles.toggle,
              { backgroundColor: value ? OnboardingColors.brand : '#D0D0D0' },
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.knob, value ? styles.knobOn : styles.knobOff]} />
            {!value && <View style={styles.offIndicator} />}
          </Pressable>
        </View>
        <Text
          style={[
            styles.helper,
            {
              color: colors.textSecondary,
              fontSize: 16 * fontScale,
              lineHeight: 20 * fontScale,
            },
          ]}
        >
          Less animation throughout the app.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', gap: Spacing.three },
  body: { fontFamily: OnboardingFonts.regular },
  controlGroup: { width: '100%', gap: Spacing.two },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    padding: 12,
    borderWidth: 1,
    borderColor: OnboardingColors.border,
    borderRadius: 12,
    shadowColor: OnboardingColors.border,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  label: { flex: 1, fontFamily: OnboardingFonts.bold },
  toggle: {
    width: 56,
    height: 32,
    justifyContent: 'center',
    borderRadius: 100,
    paddingHorizontal: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  knob: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: OnboardingColors.white,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 1,
    elevation: 2,
  },
  knobOff: { left: 2 },
  knobOn: { right: 2 },
  offIndicator: {
    position: 'absolute',
    right: 7,
    width: 10,
    height: 10,
    borderWidth: 1,
    borderColor: OnboardingColors.white,
    borderRadius: 5,
  },
  helper: { paddingLeft: 12, fontFamily: OnboardingFonts.regular },
  pressed: { opacity: 0.72 },
});
