import { TextField } from '@/components/text-field';
import { useState } from 'react';
import { Text } from 'react-native';

export function ReflectionInput() {
    const [value, setValue] = useState('');

    return (
        <>
            <Text> Daily Reflection </Text>
            <TextField
                label="Daily Reflection"
                value={value}
                onChangeText={(text) => setValue(text)}
                error={undefined}
                
            />
        </>
    )
}

export default ReflectionInput;