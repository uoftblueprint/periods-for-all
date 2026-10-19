import { Text, Pressable, View } from 'react-native';
import { Colors, Spacing } from '../constants/theme';
import type { AppButtonProps } from '../foundation/contracts';

/**
 * A simple button component that can be used throughout the app. It supports a label, onPress handler, disabled state, and busy state.
 * 
 * @components
 * @param {AppButtonProps} props - The properties for the button component, including label, onPress handler, disabled state, and busy state.
 * @param {string} props.label - The text label for the button.
 * @param {() => void} props.onPress - The function to call when the button is pressed.
 * @param {boolean} [props.disabled=false] - Whether the button is disabled. Defaults to false.
 * @param {boolean} [props.busy=false] - Whether the button is in a busy state. Defaults to false.
 * @returns A button component that can be used throughout the app.
 */
export function AppButton({ label, onPress, disabled = false, busy = false }: AppButtonProps) {
    return (
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
                opacity: (disabled || busy || pressed) ? 0.5 : 1,
                padding: Spacing.two
        }]}>
                <Text>{label}</Text>
        </Pressable>
    )
}

export default AppButton;