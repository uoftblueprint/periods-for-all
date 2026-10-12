import { View, Text, TextInput } from 'react-native';
import { TextFieldProps } from '../foundation/contracts';
import { Fonts, Spacing } from '../constants/theme';

/**
 * Renders a labeled, controlled text input with optional validation feedback.
 *
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
            <TextInput
                placeholder={`Enter ${label.toLowerCase()}`}
                onChangeText={onChangeText}
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
