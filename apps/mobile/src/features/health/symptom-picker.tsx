import { AppButton } from '@/components/app-button';
import { useState } from 'react';
import { View, Text} from 'react-native';



export function SymptomPicker ({title, symptoms}: {title: string, symptoms: string[]}) {


    return (
        <>
        <Text> {title} </Text>
        
        {symptoms.map((symptom) => (
            handleSymptomCreation({ symptom })
        ))}

        </>
    )
}

function handleSymptomCreation ( { symptom }: { symptom: string }) {
    const [selected, setSelected] = useState(false);

    return (
        <AppButton
        label={symptom} 
        onPress={() => 
            setSelected(!selected)
        } 
        />
    )
}

export default SymptomPicker;