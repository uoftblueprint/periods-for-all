import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import type { Appearance } from '@/features/settings/appearance';
import { colorSchemes, type Settings } from '@/foundation/contracts';

export type ThemeStepProps = {
  value: Settings['colorScheme'];
  onChange: (value: Settings['colorScheme']) => void;
  appearance: Appearance;
};

const labels: Record<Settings['colorScheme'], string> = {
  light: 'Default',
  highContrast: 'High Contrast',
  dark: 'Dark Mode',
};

export function ThemeStep({ value, onChange, appearance }: ThemeStepProps) {
  return (
    <ScrollView
      style={{ backgroundColor: appearance.colors.background }}
      contentContainerStyle={styles.content}
    >
      <Text
        style={{
          color: appearance.colors.textSecondary,
          fontSize: 16 * appearance.fontScale,
          lineHeight: 24 * appearance.fontScale,
        }}
      >
        Choose the colour theme that makes the app easiest for you to use.
      </Text>
      <View accessibilityRole="radiogroup" style={styles.cards}>
        {colorSchemes.map((scheme) => {
          const selected = scheme === value;
          const palette = Colors[scheme];
          return (
            <Pressable
              key={scheme}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(scheme)}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: palette.background,
                  borderColor: selected ? appearance.colors.text : palette.textSecondary,
                },
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.swatch, { backgroundColor: palette.backgroundElement }]}>
                <View style={[styles.swatchLine, { backgroundColor: palette.text }]} />
                <View
                  style={[
                    styles.swatchLine,
                    { width: '55%', backgroundColor: palette.textSecondary },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.cardLabel,
                  { color: palette.text, fontSize: 17 * appearance.fontScale },
                ]}
              >
                {selected ? '✓ ' : ''}
                {labels[scheme]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.four },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  card: {
    flexGrow: 1,
    flexBasis: 150,
    minHeight: 150,
    padding: Spacing.three,
    borderWidth: 2,
    borderRadius: 12,
    gap: Spacing.three,
  },
  swatch: {
    height: 72,
    borderRadius: 8,
    padding: Spacing.three,
    gap: Spacing.two,
    justifyContent: 'center',
  },
  swatchLine: { height: 8, width: '80%', borderRadius: 4 },
  cardLabel: { fontWeight: '700' },
  pressed: { opacity: 0.75 },
});
