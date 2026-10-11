import AppButton from '../components/app-button';
import { Text, View } from 'react-native';

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