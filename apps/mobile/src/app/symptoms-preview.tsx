import { ReflectionInput } from '@/features/health/reflection-input';
import { Text } from 'react-native';
import { SymptomPicker } from '@/features/health/symptom-picker';
import { useState } from 'react';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings } from '@/foundation/contracts';
import { PHYSICAL_SYMPTOM_OPTIONS, EMOTIONAL_SYMPTOM_OPTIONS } from '@/features/health/catalog';


export function SymptomsPreview() {
    const [text, setText] = useState('');
    const [physicalSymptoms, setPhysicalSymptoms] = useState<string[] | null>(null);
    const [emotionalSymptoms, setEmotionalSymptoms] = useState<string[] | null>(null);
    const appearance = getAppearance(defaultSettings);
    
    return (
        <>
            <Text> Symptoms Preview </Text>

            <SymptomPicker
                label={"Physical Symptoms"}
                options={PHYSICAL_SYMPTOM_OPTIONS}
                value={physicalSymptoms}
                onChange={setPhysicalSymptoms}
                appearance={appearance}
            ></SymptomPicker>
    
            <SymptomPicker 
                label="Emotional Symptoms"
                options={EMOTIONAL_SYMPTOM_OPTIONS}
                value={emotionalSymptoms}
                onChange={setEmotionalSymptoms}
                appearance={appearance}
            ></SymptomPicker>

            <ReflectionInput 
                value={text}
                onChangeText={(text) => setText(text)}
                onBlur={() => console.log('Reflection input blurred')}
                appearance={appearance}
            />
        </>
    )
}

export default SymptomsPreview;
