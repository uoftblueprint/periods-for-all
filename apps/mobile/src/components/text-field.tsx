import { View, Text, TextInput } from 'react-native';
import type { TextFieldProps } from '../foundation/contracts';
import { Colors, Fonts, Spacing } from '../constants/theme';

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
 * @TextfieldProps maxLength - The maximum number of characters that can be entered in the input field.
 * @TextfieldProps multiline - Boolean indicating if the input should be a multi-line text area.
 * @TextfieldProps onBlur - Callback function to handle the input field losing focus.
 * @returns The field container, including its label, input, and optional error.
 * @TextfieldProps appearance - The appearance of the input field.
 */
export function TextField({
    label, value, onChangeText, error, secureTextEntry, keyboardType, editable, maxLength, multiline, onBlur, placeholder,
    autoCorrect = keyboardType === 'email-address' || secureTextEntry ? false : true,
    autoCapitalize = keyboardType === 'email-address' || secureTextEntry ? 'none' : 'sentences',
    appearance,
}: TextFieldProps) {
    const colors = appearance?.colors ?? Colors.light;
    const fontSize = 14 * (appearance?.fontScale ?? 1);

    return (
        <View style={{
            marginBottom: Spacing.two,
        }}>
            <Text style={{
                fontFamily: Fonts.sans,
                color: colors.text,
                fontSize,
            }}
            >
                {label}
            </Text>
            <TextInput style={{
                borderWidth: 1,
                borderColor: error ? 'red' : colors.textSecondary,
                color: colors.text,
                backgroundColor: colors.background,
                fontSize,
                padding: Spacing.one,
                borderRadius: 4,
            }}
                placeholder={placeholder || `Enter ${label.toLowerCase()}`}
                placeholderTextColor={colors.textSecondary}
                onChangeText={onChangeText}
                autoCorrect={autoCorrect}
                autoCapitalize={autoCapitalize}
                editable={editable}
                value={value}
                secureTextEntry={secureTextEntry}
                keyboardType={keyboardType}
                maxLength={maxLength}
                multiline={multiline}
                accessibilityLabel={label}
                accessibilityHint={`Input field for ${label}`}
                onBlur={onBlur}
            />
            {error ? <Text accessibilityRole="alert" style={{ color: colors.text, fontSize }}>{error}</Text> :null}
        </View>
    )
}

export default TextField;
