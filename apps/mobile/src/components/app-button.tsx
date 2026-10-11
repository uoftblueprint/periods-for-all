import { Text, Pressable, View } from 'react-native';
import { Colors, Spacing } from '../constants/theme';
import type { AppButtonProps } from '../foundation/contracts';

export default function AppButton({ label, onPress, disabled = false, busy = false }: AppButtonProps) {
    return (
        <View style={ { backgroundColor: Colors.light.background, padding: Spacing.four } }>
            <Pressable onPress={onPress} disabled={disabled || busy} style={({ pressed }) => [{
                    backgroundColor: (disabled || busy || !pressed) ? Colors.light.backgroundElement : Colors.light.backgroundSelected,
                    padding: Spacing.two, borderRadius: Spacing.one
            }]}>
                    <Text accessibilityLabel="title">{label}</Text>
            </Pressable>
        </View>
    )
}