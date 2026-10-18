import { View, Text, TextInput } from 'react-native';
import { TextFieldProps } from '../foundation/contracts';
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
export function TextField({ label, value, onChangeText, error, secureTextEntry, keyboardType }: TextFieldProps) {

    return (
        <View style={{
            marginBottom: Spacing.two,
        }}>
            <Text style={{
                fontFamily: Fonts.sans,
            }}
            >
                {label}
            </Text>
            <TextInput style={{
                borderWidth: 1,
                borderColor: error ? 'red' : 'gray',
                padding: Spacing.one,
                borderRadius: 4,
            }}
                placeholder={`Enter ${label.toLowerCase()}`}
                onChangeText={onChangeText}
                autoCorrect={value.toLowerCase() === 'email' || value.toLowerCase() === 'password' ? false : true}
                autoCapitalize={value.toLowerCase() === 'email' || value.toLowerCase() === 'password' ? 'none' : 'sentences'}
                value={value}
                secureTextEntry={secureTextEntry}
                keyboardType={keyboardType}
                accessibilityLabel={label}
                accessibilityHint={`Input field for ${label}`}
            />
            {error ? <Text accessibilityRole="alert">{error}</Text> :null}
        </View>
    )
}

export default TextField;
