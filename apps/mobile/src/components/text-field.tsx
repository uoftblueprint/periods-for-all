import { View, Text, TextInput } from 'react-native';
import type { TextFieldProps } from '../foundation/contracts';
import { Fonts, Spacing } from '../constants/theme';

/** A labeled, controlled input with optional validation feedback. */
export function TextField({ label, error, ...inputProps }: TextFieldProps) {
  return (
    <View style={{ marginBottom: Spacing.two }}>
      <Text style={{ fontFamily: Fonts.sans }}>{label}</Text>
      <TextInput
        {...inputProps}
        placeholder={`Enter ${label.toLowerCase()}`}
        accessibilityLabel={label}
        accessibilityHint={`Input field for ${label}`}
      />
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}

export default TextField;
