import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, Text } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { AppButton } from '@/components/app-button';
import type { SignupScreenProps } from '@/features/auth/signup-contracts';
import { usePreventRemove } from 'expo-router/react-navigation';


const styles = StyleSheet.create({
  input:{
    borderColor: "black",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },

  error: {
    color: '#B00020',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 12,
  },

  passwordField: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 0,
  },

  passwordInput: {
    flex: 1,
    minWidth: 0,
    padding: 12,
  },

  passwordToggle: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  spinner:{
    marginBottom: 12
  }
})

export function SignUpScreen(props: SignupScreenProps) {
    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                contentContainerStyle={{ flexGrow: 1, padding: 24 }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
            >
                <SignUpForm {...props} />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

function SignUpForm(props: SignupScreenProps) {
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
        setNameError(null);
        setEmailError(null);
        setPasswordError('');
        if (state === 'checkEmail') {
            AccessibilityInfo.announceForAccessibility(
                'Check your email for next steps. If you already have an account, log in.'
            );
        }
    }, [state]);

    usePreventRemove(state === 'details', () => {
        props.onBackToLogin();
    });

    usePreventRemove(state === 'password', () => {
        setState('details');
    });

    const passwordChecks = [
        { label: 'Be at least 8 characters long', valid: password.length >= 8 },
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
            setPasswordError(`Password is missing requirements: ${unmetRules.map(check => check.label).join('; ')}.`);
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
                    <Text accessibilityRole="alert" style={styles.error}>
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
                    placeholder="example@mail.com"
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
                    <Text accessibilityRole="alert" style={styles.error}>{emailError}</Text>
                )}

                <AppButton label="Next" onPress={() => {
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

            </View>
       ) 
    }

    else if (state === 'password') {

        return (
            <View>
                <Text>
                    Password
                </Text>
                <View style={[styles.input, styles.passwordField]}>
                    <TextInput
                        accessibilityLabel="Password"
                        accessibilityHint={passwordError || 'Required. Use at least 8 characters, one uppercase letter, and one special character.'}
                        placeholder="Enter your password"
                        value={password}
                        onChangeText={value => {
                            setPassword(value);
                            setPasswordError('');
                        }}
                        editable={!isSubmitting}
                        secureTextEntry={!passwordVisible}
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={styles.passwordInput}
                    />

                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                        accessibilityState={{ disabled: isSubmitting }}
                        onPress={() => setPasswordVisible(visible => !visible)}
                        disabled={isSubmitting}
                        style={({ pressed }) => [styles.passwordToggle, { opacity: isSubmitting ? 0.5 : pressed ? 0.75 : 1 }]}
                    >
                        <SymbolView
                            name={passwordVisible
                                ? { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' }
                                : { ios: 'eye', android: 'visibility', web: 'visibility' }}
                            size={22}
                            tintColor="black"
                        />
                    </Pressable>
                </View>

                {!!passwordError && (
                    <Text accessibilityRole="alert" style={styles.error}>{passwordError}</Text>
                )}

                <Text>
                    Passwords must
                </Text>

                {passwordChecks.map(check => (
                    <Text
                        key={check.label}
                        accessibilityLabel={`${check.valid ? 'Requirement met' : 'Requirement not met'}: ${check.label}`}
                        style={{ color: check.valid ? '#216E39' : '#595959', marginBottom: 8 }}
                    >
                        {check.valid ? '✓' : '○'} {check.label}
                    </Text>
                ))}
                <AppButton
                    label={isSubmitting ? 'Signing up...' : 'Next'}
                    busy={isSubmitting}
                    onPress={handleSignUp}
                    disabled={isSubmitting}
                />

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
                <AppButton
                    label="Back to login"
                    onPress={props.onBackToLogin}
                />
            </View>
        );
    }
}
