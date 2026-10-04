import { Text } from 'react-native';
import type { SettingsScreenProps } from '@/foundation/contracts';

export function SettingsScreen(props: SettingsScreenProps) {
  // Build controls here; call props.onChange({ ...props.settings, textSize: 'large' }).
  // This component receives data through props; it does not own storage.
  return <Text>Settings controls go here. Current text size: {props.settings.textSize}.</Text>;
}
