import { SignUpScreen } from '@/features/auth/signup-screen';
import { PreviewScreen } from '@/foundation/preview-screen';
import { router } from 'expo-router';

export default function SignUpScreenPreview() {
    return (
        <PreviewScreen title="Sign Up preview (fake accounts)">
            <SignUpScreen signUp={async () => {
                return { status: 'checkEmail' };

            }} onSignedIn={() => {
                console.log('User signed in');
                
            }} onBackToLogin={() => {
                console.log('Back to login');
                router.push('/');
            }}/>
        </PreviewScreen>
    )
}