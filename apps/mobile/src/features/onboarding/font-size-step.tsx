import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FontScale, Spacing } from '@/constants/theme';
import type { Appearance } from '@/features/settings/appearance';
import { textSizes, type Settings } from '@/foundation/contracts';

export type FontSizeStepProps = {
  value: Settings['textSize'];
  onChange: (value: Settings['textSize']) => void;
  appearance: Appearance;
};

const labels: Record<Settings['textSize'], string> = {
  standard: 'Standard',
  large: 'Large',
  extraLarge: 'Extra large',
  largest: 'Largest',
};

export function FontSizeStep({ value, onChange, appearance }: FontSizeStepProps) {
  const { colors, fontScale } = appearance;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Text
        style={[
          {
            color: colors.textSecondary,
            fontSize: 16 * fontScale,
            lineHeight: 24 * fontScale,
          },
        ]}
      >
        Choose the text size that is most comfortable for you to read.
      </Text>
      <View accessibilityRole="radiogroup" style={styles.choices}>
        {textSizes.map((size) => {
          const selected = size === value;
          return (
            <Pressable
              key={size}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(size)}
              style={({ pressed }) => [
                styles.choice,
                {
                  backgroundColor: selected ? colors.backgroundSelected : colors.backgroundElement,
                  borderColor: selected ? colors.text : 'transparent',
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text
                style={{ color: colors.text, fontSize: 16 * FontScale[size], fontWeight: '600' }}
              >
                {selected ? '✓ ' : ''}
                {labels[size]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.sample, { backgroundColor: colors.backgroundElement }]}>
        <Text style={{ color: colors.text, fontSize: 18 * fontScale, lineHeight: 26 * fontScale }}>
          Preview: Your care information will appear at this size.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.four },
  choices: { gap: Spacing.two },
  choice: {
    minHeight: 52,
    justifyContent: 'center',
    padding: Spacing.three,
    borderWidth: 2,
    borderRadius: 12,
  },
  sample: { padding: Spacing.four, borderRadius: 12 },
});
