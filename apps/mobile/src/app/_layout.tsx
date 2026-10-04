import { Stack } from 'expo-router';
import { Text } from 'react-native';

export default function RootLayout() {
  // These open preview routes and fake accounts must not ship as a real app.
  if (!__DEV__) return <Text>This development starter is not a release build.</Text>;
  return <Stack screenOptions={{ headerTitle: 'Periods for All · Development', contentStyle: { backgroundColor: '#fff' } }} />;
}
