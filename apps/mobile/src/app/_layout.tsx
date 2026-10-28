import {
  AtkinsonHyperlegible_400Regular,
  AtkinsonHyperlegible_700Bold,
  useFonts,
} from '@expo-google-fonts/atkinson-hyperlegible';
import { Stack } from 'expo-router';
import { Text } from 'react-native';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_700Bold,
  });

  if (fontError) throw fontError;
  if (!fontsLoaded) return null;

  // These open preview routes and fake accounts must not ship as a real app.
  if (!__DEV__) return <Text>This development starter is not a release build.</Text>;
  return (
    <Stack
      screenOptions={{
        headerTitle: 'Periods for All · Development',
        contentStyle: { backgroundColor: '#FCFBF8' },
      }}
    >
      <Stack.Screen name="display-setup-preview" options={{ headerShown: false }} />
    </Stack>
  );
}
