import { SignUpScreen } from '@/features/auth/signup-screen';
import { View } from 'react-native';
import { router } from 'expo-router';

export default function SignUpScreenPreview() {
    return (
        <View style={{ flex: 1 }}>
            <SignUpScreen signUp={async () => {
                return { status: 'checkEmail' };

            }} onSignedIn={() => {
                console.log('User signed in');
                
            }} onBackToLogin={() => {
                console.log('Back to login');
                router.push('/');
            }}/>
        </View>
    )
}