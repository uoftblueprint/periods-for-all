import { Text, Pressable, View } from 'react-native';
import { Colors, Spacing } from '../constants/theme';
import type { AppButtonProps } from '../foundation/contracts';

export default function AppButton({ label, onPress, disabled = false, busy = false }: AppButtonProps) {
    return (
        <View style={ { backgroundColor: Colors.light.background, padding: Spacing.four } }>
            <Pressable 
                onPress={onPress} 
                disabled={disabled || busy} 
                accessibilityRole="button" 
                accessibilityLabel={label} 
                accessibilityState={{disabled: disabled || busy, busy}} 
                style={({ pressed }) => [{
                    minHeight: 44,
                    minWidth: 44,
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingHorizontal: Spacing.two,
                    paddingVertical: Spacing.two,
                    borderRadius: Spacing.one,
                    backgroundColor: (disabled || busy || !pressed) ? Colors.light.backgroundElement : Colors.light.backgroundSelected,
                    padding: Spacing.two
            }]}>
                    <Text>{label}</Text>
            </Pressable>
        </View>
    )
}