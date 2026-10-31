import { Pressable, StyleSheet, Text, View } from 'react-native';

import { OnboardingColors, OnboardingFonts, Spacing } from '@/constants/theme';
import type { Appearance } from '@/features/settings/appearance';
import { colorSchemes, type Settings } from '@/foundation/contracts';

export type ThemeStepProps = {
  value: Settings['colorScheme'];
  onChange: (value: Settings['colorScheme']) => void;
  appearance: Appearance;
};

const options: Record<
  Settings['colorScheme'],
  { label: string; outer: string; inner: string; text: string; innerBorder: string }
> = {
  light: {
    label: 'Default',
    outer: OnboardingColors.white,
    inner: '#F9F4EC',
    text: '#31281B',
    innerBorder: OnboardingColors.border,
  },
  highContrast: {
    label: 'High Contrast',
    outer: OnboardingColors.white,
    inner: '#FCFBF8',
    text: '#000000',
    innerBorder: '#5A482F',
  },
  dark: {
    label: 'Dark Mode',
    outer: OnboardingColors.darkPreviewSurface,
    inner: OnboardingColors.darkPreview,
    text: '#FCFBF8',
    innerBorder: OnboardingColors.darkPreview,
  },
};

export function ThemeStep({ value, onChange, appearance }: ThemeStepProps) {
  const { colors, fontScale } = appearance;

  return (
    <View style={styles.content}>
      <Text
        style={[
          styles.body,
          { color: colors.text, fontSize: 16 * fontScale, lineHeight: 20 * fontScale },
        ]}
      >
        Choose your colour theme settings.
      </Text>
      <View accessibilityRole="radiogroup" style={styles.cards}>
        {colorSchemes.map((scheme) => {
          const selected = scheme === value;
          const option = options[scheme];
          return (
            <View key={scheme} style={styles.option}>
              <Pressable
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                accessibilityState={{ checked: selected }}
                onPress={() => onChange(scheme)}
                style={({ pressed }) => [
                  styles.selectionHalo,
                  selected ? styles.selectionHaloSelected : styles.selectionHaloUnselected,
                  pressed && styles.pressed,
                ]}
              >
                <View
                  style={[
                    styles.preview,
                    {
                      backgroundColor: option.outer,
                      borderColor: selected ? OnboardingColors.brand : OnboardingColors.border,
                      borderWidth: selected ? 4 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.previewInset,
                      { backgroundColor: option.inner, borderColor: option.innerBorder },
                    ]}
                  >
                    <Text style={[styles.previewLetters, { color: option.text }]}>
                      <Text style={styles.previewLargeLetter}>A</Text>
                      <Text style={styles.previewSmallLetter}>A</Text>
                    </Text>
                  </View>
                  {selected && (
                    <View style={styles.check}>
                      <Text style={styles.checkmark}>✓</Text>
                    </View>
                  )}
                </View>
              </Pressable>
              <Text
                style={[
                  styles.label,
                  {
                    color: selected ? OnboardingColors.brand : colors.text,
                    fontSize: 16 * fontScale,
                    lineHeight: 20 * fontScale,
                  },
                ]}
              >
                {option.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', gap: Spacing.three },
  body: { fontFamily: OnboardingFonts.regular },
  cards: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  option: { flex: 1, minWidth: 0, gap: 8 },
  selectionHalo: { width: '100%', height: 107, borderRadius: 16 },
  selectionHaloSelected: { padding: 8, backgroundColor: OnboardingColors.brandSoft },
  selectionHaloUnselected: { padding: 0 },
  preview: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    paddingLeft: 12,
    paddingTop: 12,
    borderRadius: 12,
  },
  previewInset: {
    width: '86%',
    height: '82%',
    justifyContent: 'center',
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderTopWidth: 1,
    borderTopLeftRadius: 12,
  },
  previewLetters: { fontFamily: OnboardingFonts.bold, lineHeight: 38 },
  previewLargeLetter: { fontSize: 33 },
  previewSmallLetter: { fontSize: 23 },
  check: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: OnboardingColors.brand,
  },
  checkmark: {
    color: OnboardingColors.white,
    fontFamily: OnboardingFonts.bold,
    fontSize: 15,
    lineHeight: 18,
  },
  label: { fontFamily: OnboardingFonts.bold },
  pressed: { opacity: 0.72 },
});
