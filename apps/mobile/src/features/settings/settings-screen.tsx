import { StyleSheet, Switch, Text, View } from 'react-native';
import type { Appearance } from './appearance';
import type { SettingsScreenProps } from '@/foundation/contracts';

export function SettingsScreen(props: SettingsScreenProps & { appearance?: Appearance }) {
  return (
    <View style={styles.controls}>
      <View style={styles.row}>
        <Text style={[styles.label, props.appearance && { color: props.appearance.colors.text, fontSize: 16 * props.appearance.fontScale }]}>Large text</Text>
        <Switch
          accessibilityLabel="Large text"
          hitSlop={8}
          value={props.settings.textSize !== 'standard'}
          onValueChange={(value) => props.onChange({ ...props.settings, textSize: value ? 'large' : 'standard' })}
        />
      </View>
      <View style={styles.row}>
        <Text style={[styles.label, props.appearance && { color: props.appearance.colors.text, fontSize: 16 * props.appearance.fontScale }]}>Dark mode</Text>
        <Switch
          accessibilityLabel="Dark mode"
          hitSlop={8}
          value={props.settings.colorScheme === 'dark'}
          onValueChange={(value) => props.onChange({ ...props.settings, colorScheme: value ? 'dark' : 'light' })}
        />
      </View>
      <View style={styles.row}>
        <Text style={[styles.label, props.appearance && { color: props.appearance.colors.text, fontSize: 16 * props.appearance.fontScale }]}>Reduce motion</Text>
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
