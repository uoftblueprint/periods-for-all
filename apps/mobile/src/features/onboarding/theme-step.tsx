import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Settings } from '../../foundation/contracts';
import { Colors } from '../../constants/theme';
import type { Appearance } from '../settings/appearance';

export interface ThemeStepProps {
  value: Settings['colorScheme'];
  onChange: (value: Settings['colorScheme']) => void;
  appearance: Appearance;
}

type ColorScheme = Settings['colorScheme'];

// using themeOptions, we can map over it to create a button for each theme
// when a new theme is needed/added, we can simply update this array rather than creating another button component
const themeOptions: {
  value: ColorScheme;
  label: string;
}[] = [
  { value: 'light', label: 'Default' },
  // { value: 'highContrast', label: 'High Contrast' }, commented out for now since its not a proper type/value yet
  { value: 'dark', label: 'Dark Mode' },
];

// const accent = '#B30B00';

export function ThemeStep(props: ThemeStepProps) {
  const { colors, fontScale } = props.appearance;
  const background = colors.background;
  const bodyText = {color: colors.text, fontSize: 16 * fontScale, lineHeight: 22 * fontScale };

  return (
    <View style={[styles.selection, { backgroundColor: background }]}>
      <Text style={bodyText}>Choose your colour theme settings.</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Colour theme" style={styles.options}>
        {/*mapping over all the themes and creating Pressables*/}
        {themeOptions.map((theme) => {
          const selected = props.value === theme.value;
          const preview = Colors[theme.value];

          return (
            <Pressable
              key={theme.value}
              onPress={() => props.onChange(theme.value)}
              accessibilityRole="radio"
              aria-checked={props.value === theme.value} // for web version
              accessibilityState={{ checked: props.value === theme.value }}
              accessibilityLabel={theme.label}
              style={({ pressed }) => [styles.option, { width: 104 * fontScale, opacity: pressed ? 0.75 : 1 }]}
            >
              <View
                style={[
                  styles.selectionRing,
                  { borderColor: selected ? colors.backgroundSelected: 'transparent'},
                ]}
              >
                <View style={[styles.cardBorder, { borderColor: selected ? colors.text : 'transparent' }]}>
                  <View style={[styles.card, { backgroundColor: preview.backgroundElement, borderColor: preview.backgroundSelected}]}>
                    <View style={[styles.sample, { backgroundColor: preview.background, borderColor:preview.backgroundSelected}]}>
                      <Text accessible={false} style={[styles.sampleText, { color: preview.text, fontSize: 32 * fontScale }]}>
                        Aa
                      </Text>
                    </View>
                    {/*separated the checkmark from the label so that the checkmark is able to wrap properly*/}
                    {selected && (
                      <View style={[
                          styles.checkmark,
                          { backgroundColor: colors.text },
                        ]}>
                          {/* separated the checkmark to make it theme aware*/}
                        <Text accessible={false}
                          style={[
                            styles.checkmarkText,
                            { color: colors.background },
                          ]}>
                          ✓
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
              <Text style={[styles.optionLabel, { color: selected ? colors.text : colors.textSecondary, fontSize: 16 * fontScale }]}>
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
  sample: { position: 'absolute', top: 16, left: 16, right: -1, bottom: -1, borderWidth: 1, borderTopLeftRadius: 12, paddingTop: 16, paddingLeft: 16 },
  sampleText: { fontWeight: '700' },
  checkmark: { position: 'absolute', bottom: 10, right: 10, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  checkmarkText: { fontSize: 20, lineHeight: 26 },
  optionLabel: { fontWeight: '700' },
});
