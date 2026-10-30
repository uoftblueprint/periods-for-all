import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import type { Appearance } from '@/features/settings/appearance';

// Temporary extended text sizes until S2R-01 merges into contracts.ts.
export type ExtendedTextSize = 'standard' | 'large' | 'extraLarge' | 'largest';
export const EXTENDED_FONT_SCALE: Record<ExtendedTextSize, number> = {
  standard: 1,
  large: 1.25,
  extraLarge: 1.5,
  largest: 1.75,
};

const choices: { key: ExtendedTextSize; label: string }[] = [
  { key: 'standard', label: 'Standard (1x)' },
  { key: 'large', label: 'Large (1.25x)' },
  { key: 'extraLarge', label: 'Extra Large (1.5x)' },
  { key: 'largest', label: 'Largest (1.75x)' },
];

export type FontSizeStepProps = {
  value: ExtendedTextSize;
  onChange: (size: ExtendedTextSize) => void;
  appearance: Appearance;
};

/** Onboarding step: pick a text size from four labelled choices with a live sample. */
export function FontSizeStep({ value, onChange, appearance }: FontSizeStepProps) {
  const { colors } = appearance;
  const previewScale = EXTENDED_FONT_SCALE[value];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text
        accessibilityRole="header"
        style={[styles.heading, { color: colors.text }]}
      >
        Font Sizes
      </Text>

      <Text style={[styles.explanation, { color: colors.textSecondary }]}>
        This will change how large the font is on screen.
      </Text>

      {/* Four labelled choices */}
      <View style={styles.choices}>
        {choices.map(({ key, label }) => {
          const selected = key === value;
          return (
            <Pressable
              key={key}
              onPress={() => onChange(key)}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ selected }}
              style={[
                styles.choice,
                {
                  backgroundColor: selected ? colors.backgroundSelected : colors.backgroundElement,
                  borderColor: selected ? colors.text : 'transparent',
                },
              ]}
            >
              <Text style={{ color: colors.text, fontSize: 16 * EXTENDED_FONT_SCALE[key] }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Live sample text that scales with the selected size */}
      <View style={[styles.sample, { backgroundColor: colors.backgroundElement }]}>
        <Text style={{ color: colors.text, fontSize: 16 * previewScale, lineHeight: 24 * previewScale }}>
          The text size will adjust based on the choice above. This sample shows how your text will look.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.five,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.two,
  },
  explanation: {
    fontSize: 16,
    marginBottom: Spacing.three,
  },
  choices: {
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
  choice: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
    borderWidth: 2,
  },
  sample: {
    padding: Spacing.three,
    borderRadius: 12,
  },
});
