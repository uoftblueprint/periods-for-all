import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemeStep } from '@/features/onboarding/theme-step';
import { defaultSettings, type Settings } from '@/foundation/contracts';
import { getAppearance } from '@/features/settings/appearance';

function getStatusBarStyle(background: string): 'light' | 'dark' {
  // The existing palettes use opaque hex backgrounds; linearize sRGB for relative luminance.
  const [r, g, b] = [1, 3, 5].map((offset) => {
    const channel = parseInt(background.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const darkIconContrast = (luminance + 0.05) / 0.05;
  const lightIconContrast = 1.05 / (luminance + 0.05);
  return darkIconContrast >= lightIconContrast ? 'dark' : 'light';
}

export default function ThemePreview() {
  const router = useRouter();
  const [value, setValue] = useState<Settings['colorScheme']>('light');
  const appearance = getAppearance({ ...defaultSettings, colorScheme: value });
  const { colors, fontScale } = appearance;
  const background = colors.background;
  const bodyText = { color: colors.text, fontSize: 16 * fontScale, lineHeight: 22 * fontScale };

  const onBack = () => router.canGoBack() ? router.back() : router.replace('/');
  const onContinue = () => Alert.alert('Theme selected', 'Period Information is not connected in this preview yet.');
  const onSkip = () => router.replace('/');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style={getStatusBarStyle(background)} />
      <ScrollView style={{ backgroundColor: background }} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            aria-disabled={false}
            accessibilityState={{ disabled: false }}
            style={({ pressed }) => [
              styles.backButton,
              {
                backgroundColor: colors.backgroundElement,
                borderColor: colors.textSecondary,
                boxShadow: `0 1px 4px ${colors.backgroundSelected}`,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <View style={[styles.backChevron, { borderColor: colors.text }]} />
          </Pressable>
          <View style={styles.heading}>
            <Text style={bodyText}>Step 3 of 3</Text>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text, fontSize: 22 * fontScale }]}>
              Colour Themes
            </Text>
          </View>
          <View style={styles.headerBalance} />
        </View>

        <View style={styles.spacer} />

        <ThemeStep value={value} onChange={setValue} appearance={appearance} />

        <View style={styles.footer}>
          <View accessible accessibilityLabel="Step 3 of 3" style={styles.progress}>
            <View style={[styles.dot, { backgroundColor: colors.textSecondary }]} />
            <View style={[styles.dot, { backgroundColor: colors.textSecondary }]} />
            <View style={[styles.dot, styles.activeDot, { backgroundColor: colors.text }]} />
          </View>
          <Pressable
            onPress={onContinue}
            accessibilityRole="button"
            aria-disabled={false}
            accessibilityState={{ disabled: false }}
            style={({ pressed }) => [styles.continueButton, { backgroundColor: colors.text, opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={[styles.continueText, { color: colors.background, fontSize: 16 * fontScale, lineHeight: 22 * fontScale }]}>
              Continue to Period Information
            </Text>
          </Pressable>
          <Pressable
            onPress={onSkip}
            accessibilityRole="button"
            aria-disabled={false}
            accessibilityState={{ disabled: false }}
            style={({ pressed }) => [styles.skipButton, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.skipText, { color: colors.text, fontSize: 16 * fontScale, lineHeight: 24 * fontScale }]}>
              Skip for now
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backButton: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  backChevron: { width: 10, height: 10, borderLeftWidth: 2, borderBottomWidth: 2, transform: [{ rotate: '45deg' }], marginLeft: 4 },
  heading: { flex: 1, alignItems: 'center', gap: 2 },
  title: { fontWeight: '700', textAlign: 'center' },
  headerBalance: { width: 48 },
  spacer: { flex: 1, minHeight: 64 },
  footer: { marginTop: 76, alignItems: 'center', gap: 16 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  activeDot: { width: 16 },
  continueButton: { width: '100%', minHeight: 48, borderRadius: 32, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 20 },
  continueText: { fontWeight: '700', textAlign: 'center' },
  skipButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16, marginTop: 4 },
  skipText: { fontWeight: '700', textAlign: 'center', textDecorationLine: 'underline' },
});
