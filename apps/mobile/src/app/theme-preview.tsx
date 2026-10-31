import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemeStep } from '@/features/onboarding/theme-step';
import { defaultSettings, type Settings } from '@/foundation/contracts';
import { getAppearance } from '@/features/settings/appearance';

const accent = '#B30B00';

export default function ThemePreview() {
  const router = useRouter();
  const [value, setValue] = useState<Settings['colorScheme']>('light');
  const appearance = getAppearance({ ...defaultSettings, colorScheme: value });
  const { colors, fontScale } = appearance;
  const isDark = value === 'dark';
  const background = isDark ? colors.background : '#FCFBF8';
  const textColor = isDark ? colors.text : '#332B20';
  const selectionColor = isDark ? '#FFB4AA' : accent;
  const bodyText = { color: textColor, fontSize: 16 * fontScale, lineHeight: 22 * fontScale };

  const onBack = () => router.canGoBack() ? router.back() : router.replace('/');
  const onContinue = () => Alert.alert('Theme selected', 'Period Information is not connected in this preview yet.');
  const onSkip = () => router.replace('/');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style={isDark ? 'light' : 'dark'} />
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
              { backgroundColor: isDark ? colors.backgroundElement : '#FFFFFF', opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View style={[styles.backChevron, { borderColor: textColor }]} />
          </Pressable>
          <View style={styles.heading}>
            <Text style={bodyText}>Step 3 of 3</Text>
            <Text accessibilityRole="header" style={[styles.title, { color: textColor, fontSize: 22 * fontScale }]}>
              Colour Themes
            </Text>
          </View>
          <View style={styles.headerBalance} />
        </View>

        <View style={styles.spacer} />

        <ThemeStep value={value} onChange={setValue} appearance={appearance} />

        <View style={styles.footer}>
          <View accessible accessibilityLabel="Step 3 of 3" style={styles.progress}>
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={[styles.dot, styles.activeDot, { backgroundColor: selectionColor }]} />
          </View>
          <Pressable
            onPress={onContinue}
            accessibilityRole="button"
            aria-disabled={false}
            accessibilityState={{ disabled: false }}
            style={({ pressed }) => [styles.continueButton, { opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={[styles.continueText, { fontSize: 16 * fontScale, lineHeight: 22 * fontScale }]}>
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
            <Text style={[styles.skipText, { color: selectionColor, fontSize: 16 * fontScale, lineHeight: 24 * fontScale }]}>
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
  backButton: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: '#F0E4D5', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px #332B200D' },
  backChevron: { width: 10, height: 10, borderLeftWidth: 2, borderBottomWidth: 2, transform: [{ rotate: '45deg' }], marginLeft: 4 },
  heading: { flex: 1, alignItems: 'center', gap: 2 },
  title: { fontWeight: '700', textAlign: 'center' },
  headerBalance: { width: 48 },
  spacer: { flex: 1, minHeight: 64 },
  footer: { marginTop: 76, alignItems: 'center', gap: 16 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#BAAA93' },
  activeDot: { width: 16 },
  continueButton: { width: '100%', minHeight: 48, borderRadius: 32, backgroundColor: accent, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 20 },
  continueText: { color: '#FFFFFF', fontWeight: '700', textAlign: 'center' },
  skipButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16, marginTop: 4 },
  skipText: { fontWeight: '700', textAlign: 'center', textDecorationLine: 'underline' },
});
