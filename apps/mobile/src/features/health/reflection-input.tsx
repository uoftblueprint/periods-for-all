import { TextField } from '@/components/text-field';
import { ReflectionInputProps } from '@/features/health/contracts';

export function ReflectionInput({value, onChangeText, onBlur, appearance}: ReflectionInputProps) {

    return (
        <>
            <TextField
                label="Daily Reflection"
                value={value}
                onChangeText={onChangeText}
                error={undefined}
                maxLength={1000}
                multiline={true}
                onBlur={onBlur}
                appearance={appearance}
                placeholder="How was today?"
            />
        </>
    )
}

export default ReflectionInput;