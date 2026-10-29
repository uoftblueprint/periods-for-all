import { View, Text, TextInput } from 'react-native';
import type { Appearance } from '@/features/settings/appearance';
import type { TextFieldProps } from '../foundation/contracts';
import { Fonts, Spacing } from '../constants/theme';

/**
 * Renders a labeled, controlled text input with optional validation feedback.
 * @components
 * @TextFieldProps The props for the TextField component, including label, value, onChangeText, error, secureTextEntry, and keyboardType.
 * @TextfieldProps label - The label for the input field.
 * @TextfieldProps value - The current value of the input field.
 * @TextfieldProps onChangeText - Callback function to handle text changes.
 * @TextfieldProps error - Optional error message to display below the input field.
 * @TextfieldProps secureTextEntry - Boolean indicating if the input should be masked (for passwords).
 * @TextfieldProps keyboardType - The type of keyboard to display. It is either 'default', 'email-address'.
 * @returns The field container, including its label, input, and optional error.
 */
export function TextField({
    label, value, onChangeText, error, secureTextEntry, keyboardType, editable, appearance,
    autoCorrect = keyboardType === 'email-address' || secureTextEntry ? false : true,
    autoCapitalize = keyboardType === 'email-address' || secureTextEntry ? 'none' : 'sentences',
}: TextFieldProps & { appearance?: Appearance }) {

    return (
        <View style={{
            marginBottom: Spacing.two,
        }}>
            <Text style={{
                fontFamily: Fonts.sans,
                color: appearance?.colors.text,
                fontSize: appearance ? 16 * appearance.fontScale : undefined,
            }}
            >
                {label}
            </Text>
            <TextInput style={{
                borderWidth: 1,
                borderColor: error ? 'red' : (appearance?.colors.textSecondary ?? 'gray'),
                color: appearance?.colors.text,
                backgroundColor: appearance?.colors.backgroundElement,
                fontSize: appearance ? 16 * appearance.fontScale : undefined,
                padding: Spacing.one,
                borderRadius: 4,
            }}
                placeholderTextColor={appearance?.colors.textSecondary}
                placeholder={`Enter ${label.toLowerCase()}`}
                onChangeText={onChangeText}
                autoCorrect={autoCorrect}
                autoCapitalize={autoCapitalize}
                editable={editable}
                value={value}
                secureTextEntry={secureTextEntry}
                keyboardType={keyboardType}
                accessibilityLabel={label}
                accessibilityHint={`Input field for ${label}`}
            />
            {error ? <Text style={appearance && { color: appearance.colors.text, fontSize: 14 * appearance.fontScale }} accessibilityRole="alert">{error}</Text> :null}
        </View>
    )
}

export default TextField;
