import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, TextInput, Button, View, Text } from 'react-native';
import { router } from 'expo-router';
import type { SignupScreenProps } from '@/features/auth/signup-contracts';

const styles = StyleSheet.create({
  input:{
    borderColor: "black",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },

  error: {
    color: 'red',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 12,
  },

  spinner:{
    marginBottom: 12
  }
})

export function SignUpScreen(props: SignupScreenProps) {
    const [state, setState] = useState<'password' | 'details' | 'checkEmail'>('details');
    const [firstName, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [nameError, setNameError] = useState<string | null>(null);
    const [emailError, setEmailError] = useState<string | null>(null);
    const nameInput = useRef<TextInput>(null);
    const emailInput = useRef<TextInput>(null);
    const [passwordError, setPasswordError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const submitting = useRef(false);
    useEffect(() => {
        const errors = [nameError, emailError, passwordError].filter(Boolean).join(' ');
        if (errors) AccessibilityInfo.announceForAccessibility(errors);
    }, [nameError, emailError, passwordError]);

    useEffect(() => {
        if (state === 'checkEmail') {
            AccessibilityInfo.announceForAccessibility(
                'Check your email for next steps. If you already have an account, log in.'
            );
        }
    }, [state]);
    const passwordChecks = [
        { label: 'Be at least 8 characters', valid: password.length >= 8 },
        {
            label: 'Have one special character',
            valid: /[^\p{L}\p{N}\s]/u.test(password),
        },
        { label: 'Have one upper case letter', valid: /[A-Z]/.test(password) }
    ];

    async function handleSignUp() { // form validation

        if (submitting.current) return; // prevent multiple submissions

        const unmetRules = passwordChecks.filter(check => !check.valid);
        if (unmetRules.length) {
            setPasswordError(`Password must have: ${unmetRules.map(check => check.label).join('; ')}.`);
            return;
        }
        setPasswordError('');

        submitting.current = true; // set current to true to indicate submission is loading
        setIsSubmitting(true); // set state to true to show loading spinner

        // Sanity check for validating name and email before proceeding
        if (nameError || emailError) {
            submitting.current = false;
            setIsSubmitting(false);
            return;
        }

        try {
            if (firstName.trim() === '') {
                alert('First name is required.');
                return;
            }

            if (email.trim() === '') {
                alert('Email is required.');
                return;
            }

            // Call the signUp function passed in props
            const result = await props.signUp({ 
                firstName: firstName.trim(), 
                email: email.trim(), 
                password: password
            });

            if (result.status === 'signedIn') {
                setPassword(''); // Clear password for security
                props.onSignedIn();

            } else if (result.status === 'checkEmail') {
                setState('checkEmail');
                setPassword(''); // Clear password for security
            } else if (result.status === 'error') {
                setPasswordError(result.message);
            } 
        } catch (error) {
            setPasswordError('An unexpected error occurred. Please try again.');
        } finally {
            submitting.current = false; // reset current to false after submission is complete
            setIsSubmitting(false); // reset state to false after submission is complete
        }
    }

    if (state === 'details') {
        return (
            <View>
                <Text>
                    Name
                </Text>
                <TextInput
                    ref={nameInput}
                    accessibilityLabel="First name"
                    accessibilityHint={nameError || 'Required. Enter your first name.'}
                    placeholder="Enter your first name"
                    value={firstName}
                    onChangeText={value => {
                        setName(value);
                        if (nameError !== null) {
                            setNameError(value.trim() ? '' : 'Enter your first name.');
                        }
                    }}
                    style={styles.input}
                />

                {!!nameError && (
                    <Text style={styles.error}>
                        {nameError}
                    </Text>
                )}

                <Text>
                    Email
                </Text>

                <TextInput
                    ref={emailInput}
                    accessibilityLabel="Email address"
                    accessibilityHint={emailError || 'Required. Enter a valid email address.'}
                    placeholder="Enter your email"
                    value={email}
                    onChangeText={value => {
                        setEmail(value);
                        if (emailError !== null) {
                            setEmailError(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
                                ? '' : 'Enter a valid email address.');
                        }
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                />

                {!!emailError && (
                    <Text style={styles.error}>{emailError}</Text>
                )}

                <Button title="Next" accessibilityLabel="Continue to password" onPress={() => {
                    const nextNameError = firstName.trim()
                        ? ''
                        : 'Enter your first name.';

                    const nextEmailError = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
                        ? ''
                        : 'Enter a valid email address.';

                    if (nextNameError || nameError !== null) setNameError(nextNameError);
                    if (nextEmailError || emailError !== null) setEmailError(nextEmailError);

                    if (nextNameError || nextEmailError) {
                        (nextNameError ? nameInput : emailInput).current?.focus();
                        return;
                    } else {
                        setState('password');
                    }

                }} />

                <Button title="Back to login" onPress={props.onBackToLogin} />

            </View>
       ) 
    }

    else if (state === 'password') {

        return (
            <View>
                <Text>
                    Password
                </Text>
                <TextInput
                    accessibilityLabel="Password"
                    accessibilityHint={passwordError || 'Required. Use at least 8 characters, one uppercase letter, and one special character.'}
                    placeholder="Enter your password"
                    value={password}
                    onChangeText={value => {
                        setPassword(value);
                        setPasswordError('');
                    }}
                    secureTextEntry={!passwordVisible}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                />

                <Button
                    title={passwordVisible ? 'Hide password' : 'Show password'}
                    onPress={() => setPasswordVisible(visible => !visible)}
                    accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                />

                {!!passwordError && (
                    <Text style={styles.error}>{passwordError}</Text>
                )}

                <Text>
                    Passwords must
                </Text>

                {passwordChecks.map(check => (
                    <Text
                        key={check.label}
                        accessibilityLabel={`${check.valid ? 'Requirement met' : 'Requirement not met'}: ${check.label}`}
                        style={{ color: check.valid ? 'green' : 'gray', marginBottom: 8 }}
                    >
                        {check.valid ? '✓' : '○'} {check.label}
                    </Text>
                ))}
                <Button
                    title={isSubmitting ? 'Signing up...' : 'Next'}
                    accessibilityLabel={isSubmitting ? 'Signing up' : 'Create account'}
                    accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
                    onPress={handleSignUp}
                    disabled={isSubmitting}
                />
                <Button title="Back" accessibilityLabel="Back to name and email" onPress={() => setState('details')} />

            </View>
        )
    }

    else if (state === 'checkEmail') {
        return (
            <View>
                <Text>
                    Check your email for next steps. If you already have an
                    account, log in.
                </Text>
                <Button
                    title="Back to login"
                    onPress={props.onBackToLogin}
                />
            </View>
        );
    }
}
