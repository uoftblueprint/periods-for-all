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
                options={[{ id: 'headache', label: 'Headache' }, { id: 'menstrualCramps', label: 'Menstrual Cramps' }, {'id': 'backPain', label: 'Back Pain'}, {'id': 'migraines', label: 'Migraines'}, {'id': 'stomachPain', label: 'Stomach Pain'}]}
                value={physicalSymptoms}
                onChange={setPhysicalSymptoms}
                appearance={appearance}
            ></SymptomPicker>
    
            <SymptomPicker 
                label="Emotional Symptoms"
                options={[{ id: 'moodSwings', label: 'Mood Swings' }, { id: 'lowMotivation', label: 'Low Motivation' }, {'id': 'difficultyConcentrating', label: 'Difficulty Concentrating'}, {'id': 'anxiety', label: 'Anxiety'}, {'id': 'fatigue', label: 'Fatigue'}]}
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
