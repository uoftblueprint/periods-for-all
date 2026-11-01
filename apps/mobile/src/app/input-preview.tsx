import { useState } from 'react';
import TextField from '../components/text-field';

/**
 * Simple local check for input preview. Renders the username and password fields with an error message.
 *
 * @returns The controlled email and password field preview.
 */
export default function InputPreview() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

        return (
            <>
            {/* Email field */}
            <TextField
                label="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
            />

            {/* Password field */}
            
            <TextField
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                error={password.length > 0 && password.length < 8
                    ? 'Password must be at least 8 characters.'
                    : undefined}
                />
            </>
            
    );
}
