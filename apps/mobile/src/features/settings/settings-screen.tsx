import { StyleSheet, Switch, Text, View } from 'react-native';
import { FontSizeStep } from '@/features/onboarding/font-size-step';
import { ThemeStep } from '@/features/onboarding/theme-step';
import { getAppearance, type Appearance } from './appearance';
import type { SettingsScreenProps } from '@/foundation/contracts';

export function SettingsScreen(props: SettingsScreenProps & { appearance?: Appearance }) {
  const appearance = props.appearance ?? getAppearance(props.settings);
  const labelStyle = [styles.label, { color: appearance.colors.text, fontSize: 16 * appearance.fontScale }];
  return (
    <View style={styles.controls}>
      <View>
        <Text style={labelStyle}>Text size</Text>
        <FontSizeStep
          appearance={appearance}
          value={props.settings.textSize}
          onChange={(textSize) => props.onChange({ ...props.settings, textSize })}
        />
      </View>
      <View>
        <Text style={labelStyle}>Colour theme</Text>
        <ThemeStep
          appearance={appearance}
          value={props.settings.colorScheme}
          onChange={(colorScheme) => props.onChange({ ...props.settings, colorScheme })}
        />
      </View>
      <View style={styles.row}>
        <Text style={labelStyle}>Reduce motion</Text>
        <Switch
          accessibilityLabel="Reduce motion"
          hitSlop={8}
          value={props.settings.reduceMotion}
          onValueChange={(value) => props.onChange({ ...props.settings, reduceMotion: value })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  controls: { gap: 24 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, minHeight: 48 },
  label: { fontSize: 16, flexShrink: 1 },
});
