import { StyleSheet, Switch, Text, View } from 'react-native';
import type { SettingsScreenProps } from '@/foundation/contracts';

export function SettingsScreen(props: SettingsScreenProps) {
  return (
    <View style={styles.controls}>
      <View style={styles.row}>
        <Text style={styles.label}>Large text</Text>
        <Switch
          accessibilityLabel="Large text"
          hitSlop={8}
          value={props.settings.textSize === 'large'}
          onValueChange={(value) => props.onChange({ ...props.settings, textSize: value ? 'large' : 'standard' })}
        />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Dark mode</Text>
        <Switch
          accessibilityLabel="Dark mode"
          hitSlop={8}
          value={props.settings.colorScheme === 'dark'}
          onValueChange={(value) => props.onChange({ ...props.settings, colorScheme: value ? 'dark' : 'light' })}
        />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Reduce motion</Text>
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
