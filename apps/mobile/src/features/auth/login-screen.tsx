import { Text, TextInput, View, Button, StyleSheet, ActivityIndicator } from 'react-native';
import type { LoginScreenProps } from '@/foundation/contracts';
import {useState} from 'react'

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

export function LoginScreen(props: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);  // for storing result.message



  async function handleLogin(){
    setResult(null); // reset result in case user needs to login again

    // form validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if(email.trim().length===0){
      setError("Please enter an email address.");
      return;
    }

    if(!emailRegex.test(email.trim())){
      setError("Please enter a valid email address.");
      return;
    }

    if (password.trim() === '') {
      setError('Password is required.');
      return;
    }

    setError(null)

    //actually authenticating
    setLoading(true); // to disable button and show loading spinner
    try {
      const result = await props.signIn({
        email: email.trim(),
        password,
      });

      if(result.ok){
          props.onSignedIn(result.user);
        }else{
          setResult(result.message)
      }
    }catch(err){
      setError("Error occurred, please try again.");
    }finally {
      setLoading(false);
    }
  }

  return <View>
    <TextInput
      value={email} onChangeText={setEmail}
      placeholder="Email" keyboardType="email-address"
      autoCapitalize='none' autoCorrect={false}
      style={styles.input} editable={!loading}
      accessibilityLabel="Email address"
      />
    <TextInput
      value={password} onChangeText={setPassword}
      placeholder="Password" secureTextEntry
      style={styles.input} editable={!loading}
      accessibilityLabel="Password"
      />
    {error && <Text style={styles.error} accessibilityLiveRegion="polite" accessibilityRole="alert">{error}</Text>}
    {loading && <ActivityIndicator size="small" color="purple" style={styles.spinner} accessibilityLabel="Signing in"/>}
    {result && <Text style={styles.error} accessibilityLiveRegion="polite" accessibilityRole="alert">{result}</Text>}
    <Button title={loading ? "Logging in..." : "Login"} onPress={handleLogin} disabled={loading} accessibilityLabel="Login button"/>
  </View>
}
