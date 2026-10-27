import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Settings } from '../../foundation/contracts';
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

const accent = '#B30B00';
const previewColors = {
  light: { background: '#FCFBF8', surface: '#F9F5ED', border: '#F0E4D5', text: '#332B20' },
  dark: { background: '#93938B', surface: '#25251F', border: '#D8D8CF', text: '#FCFBF8' },
};

export function ThemeStep(props: ThemeStepProps) {
  const { colors, fontScale } = props.appearance;
  // currently high contrast will use light style/color as high contrast is not currently within the system, change it after SR2-01 has been completed
  const isDark = props.value === 'dark';
  const background = isDark ? colors.background : previewColors.light.background;
  const textColor = isDark ? colors.text : previewColors.light.text;
  const selectionColor = isDark ? '#FFB4AA' : accent;
  const bodyText = { color: textColor, fontSize: 16 * fontScale, lineHeight: 22 * fontScale };

  return (
    <View style={[styles.selection, { backgroundColor: background }]}>
      <Text style={bodyText}>Choose your colour theme settings.</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Colour theme" style={styles.options}>
        {/*mapping over all the themes and creating Pressables*/}
        {themeOptions.map((theme) => {
          const selected = props.value === theme.value;
          const preview = previewColors[theme.value];

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
                  { borderColor: selected ? (isDark ? '#5D3531' : '#FFE3E1') : 'transparent' },
                ]}
              >
                <View style={[styles.cardBorder, { borderColor: selected ? selectionColor : 'transparent' }]}>
                  <View style={[styles.card, { backgroundColor: preview.background, borderColor: preview.border }]}>
                    <View style={[styles.sample, { backgroundColor: preview.surface, borderColor: preview.border }]}>
                      <Text accessible={false} style={[styles.sampleText, { color: preview.text, fontSize: 32 * fontScale }]}>
                        Aa
                      </Text>
                    </View>
                    {/*separated the checkmark from the label so that the checkmark is able to wrap properly*/}
                    {selected && (
                      <View style={styles.checkmark}>
                        <Text accessible={false} style={styles.checkmarkText}>✓</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
              <Text style={[styles.optionLabel, { color: selected ? selectionColor : textColor, fontSize: 16 * fontScale }]}>
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
  checkmark: { position: 'absolute', bottom: 10, right: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' },
  checkmarkText: { color: '#FFFFFF', fontSize: 20, lineHeight: 26 },
  optionLabel: { fontWeight: '700' },
});
