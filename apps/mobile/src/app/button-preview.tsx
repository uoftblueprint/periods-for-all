import AppButton from '../components/app-button';
import { Text, View } from 'react-native';

/**
 * 
 * @returns Returns 3 simple buttons. Button 1 is clickable. Button 2 and 3 are disabled and busy respectively.
 */
export default function ButtonPreview() {
    return (
        <View>
            <Text>Button Preview</Text>
            <AppButton label="Click Me" onPress={() => alert('Button clicked!')} />
            <AppButton label="Disabled" onPress={() => {}} disabled />
            <AppButton label="Busy" onPress={() => {}} busy />
        </View>
    );
}