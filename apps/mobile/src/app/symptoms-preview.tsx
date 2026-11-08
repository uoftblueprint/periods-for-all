import { ReflectionInput } from '@/features/health/reflection-input';
import { Text } from 'react-native';
import { SymptomPicker } from '@/features/health/symptom-picker';
import { useState } from 'react';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings } from '@/foundation/contracts';


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
            options={[{ id: '1', label: 'Headache' }, { id: '2', label: 'Menstrual Cramps' }, {'id': '3', label: 'Back Pain'}, {'id': '4', label: 'Migraines'}, {'id': '5', label: 'Stomach Pain'}]}
            value={physicalSymptoms}
            onChange={setPhysicalSymptoms}
            appearance={appearance}
        ></SymptomPicker>

        <SymptomPicker 
            label="Emotional Symptoms"
            options={[{ id: '6', label: 'Mood Swings' }, { id: '7', label: 'Low Motivation' }, {'id': '8', label: 'Difficulty Concentrating'}, {'id': '9', label: 'Anxiety'}, {'id': '10', label: 'Fatigue'}]}
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
