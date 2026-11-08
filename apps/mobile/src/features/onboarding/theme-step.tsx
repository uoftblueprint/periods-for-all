import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, OnboardingColors } from '@/constants/theme';
import type { Appearance } from '@/features/settings/appearance';
import type { Settings } from '@/foundation/contracts';

export interface ThemeStepProps {
  value: Settings['colorScheme'];
  onChange: (value: Settings['colorScheme']) => void;
  appearance: Appearance;
}

type ColorScheme = Settings['colorScheme'];

const themeOptions: { value: ColorScheme; label: string }[] = [
  { value: 'light', label: 'Default' },
  { value: 'highContrast', label: 'High Contrast' },
  { value: 'dark', label: 'Dark Mode' },
];

export function ThemeStep({ value, onChange, appearance }: ThemeStepProps) {
  const { colors, fontScale } = appearance;
  const isDark = value === 'dark';
  const backgroundColor = isDark ? colors.background : '#FCFBF8';
  const selectionColor = isDark ? '#FFB4AA' : OnboardingColors.brand;
  const selectionHalo = isDark ? '#5D3531' : OnboardingColors.brandSoft;

  return (
    <View style={[styles.selection, { backgroundColor }]}>
      <Text
        style={{ color: colors.text, fontSize: 16 * fontScale, lineHeight: 22 * fontScale }}
      >
        Choose your colour theme settings.
      </Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Colour theme"
        style={styles.options}
      >
        {themeOptions.map((theme) => {
          const selected = value === theme.value;
          const preview = Colors[theme.value];

          return (
            <Pressable
              key={theme.value}
              onPress={() => onChange(theme.value)}
              accessibilityRole="radio"
              aria-checked={selected}
              accessibilityState={{ checked: selected }}
              accessibilityLabel={theme.label}
              style={({ pressed }) => [
                styles.option,
                { width: 104 * fontScale, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <View
                style={[
                  styles.selectionRing,
                  { borderColor: selected ? selectionHalo : 'transparent' },
                ]}
              >
                <View
                  style={[
                    styles.cardBorder,
                    { borderColor: selected ? selectionColor : 'transparent' },
                  ]}
                >
                  <View
                    style={[
                      styles.card,
                      {
                        backgroundColor: preview.backgroundElement,
                        borderColor: preview.backgroundSelected,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.sample,
                        {
                          backgroundColor: preview.background,
                          borderColor: preview.backgroundSelected,
                        },
                      ]}
                    >
                      <Text
                        accessible={false}
                        style={[
                          styles.sampleText,
                          { color: preview.text, fontSize: 32 * fontScale },
                        ]}
                      >
                        Aa
                      </Text>
                    </View>
                    {selected && (
                      <View style={[styles.checkmark, { backgroundColor: selectionColor }]}>
                        <Text
                          accessible={false}
                          style={styles.checkmarkText}
                        >
                          ✓
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
              <Text
                style={[
                  styles.optionLabel,
                  {
                    color: selected ? selectionColor : colors.textSecondary,
                    fontSize: 16 * fontScale,
                  },
                ]}
              >
                {theme.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  selection: { gap: 16 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' },
  option: { maxWidth: '100%', gap: 12 },
  selectionRing: { aspectRatio: 1, borderWidth: 4, borderRadius: 22, margin: -8 },
  cardBorder: { flex: 1, borderWidth: 4, borderRadius: 18 },
  card: { flex: 1, borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  sample: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: -1,
    bottom: -1,
    borderWidth: 1,
    borderTopLeftRadius: 12,
    paddingTop: 16,
    paddingLeft: 16,
  },
  sampleText: { fontWeight: '700' },
  checkmark: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: { color: OnboardingColors.white, fontSize: 20, lineHeight: 26 },
  optionLabel: { fontWeight: '700' },
});
