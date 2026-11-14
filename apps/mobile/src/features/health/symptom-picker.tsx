import { AppButton } from '@/components/app-button';
import { Text, View } from 'react-native';
import type { SymptomPickerProps } from '@/features/health/contracts';

export function SymptomPicker({ label, options, value, onChange, appearance }: SymptomPickerProps) {
    
    function toggleSymptom(symptomId: string) {
        if (value?.includes(symptomId)) {
            onChange(value.filter((id) => id !== symptomId));
        } else {
            onChange([...(value ?? []), symptomId]);
        }
    }

    return (
        <View>
            <Text style={{ color: appearance.colors.text, fontSize: 16 * appearance.fontScale }}>{label}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {options.map((option) => (
                    <AppButton key={option.id} label={option.label}
                        selected={value?.includes(option.id) ?? false}
                        onPress={() => toggleSymptom(option.id)} appearance={appearance} />
                ))}

                <AppButton label="No symptoms" onPress={() => onChange([])} appearance={appearance} selected={value?.length === 0} />
                <AppButton label="Clear answer" onPress={() => onChange(null)} appearance={appearance} />
            </View>
        </View>
    );
}

export default SymptomPicker;
