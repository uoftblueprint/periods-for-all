import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FontScale, Spacing } from '@/constants/theme';
import type { Settings } from '@/foundation/contracts';
import type { Appearance } from '@/features/settings/appearance';

type TextSize = Settings['textSize'];

const choices: { key: TextSize; label: string }[] = [
  { key: 'standard', label: 'Standard (1x)' },
  { key: 'large', label: 'Large (1.25x)' },
  { key: 'extraLarge', label: 'Extra Large (1.5x)' },
  { key: 'largest', label: 'Largest (1.75x)' },
];

export type FontSizeStepProps = {
  value: TextSize;
  onChange: (size: TextSize) => void;
  appearance: Appearance;
};

/** Onboarding step: pick a text size from four labelled choices with a live sample. */
export function FontSizeStep({ value, onChange, appearance }: FontSizeStepProps) {
  const { colors, fontScale } = appearance;
  const previewScale = FontScale[value];

  return (
    <View style={styles.content}>
      <Text style={[styles.explanation, { color: colors.textSecondary, fontSize: 16 * fontScale, lineHeight: 24 * fontScale }]}>
        This will change how large the font is on screen.
      </Text>

      <View style={styles.choices}>
        {choices.map(({ key, label }) => {
          const selected = key === value;
          return (
            <Pressable
              key={key}
              onPress={() => onChange(key)}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ checked: selected }}
              style={[
                styles.choice,
                {
                  backgroundColor: selected ? colors.backgroundSelected : colors.backgroundElement,
                  borderColor: selected ? colors.text : 'transparent',
                },
              ]}
            >
              <Text style={{ color: colors.text, fontSize: 16 * FontScale[key] }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Sample text that scales with the selected size */}
      <View style={[styles.sample, { backgroundColor: colors.backgroundElement }]}>
        <Text style={{ color: colors.text, fontSize: 16 * previewScale, lineHeight: 24 * previewScale }}>
          The text size will adjust based on the choice above. This sample shows how your text will look.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  explanation: {
    fontSize: 16,
  },
  choices: {
    gap: Spacing.two,
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
