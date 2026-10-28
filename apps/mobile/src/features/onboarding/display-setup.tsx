import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingColors, OnboardingFonts, Spacing } from '@/constants/theme';
import { getAppearance } from '@/features/settings/appearance';
import type { Settings } from '@/foundation/contracts';

import { DisplayIntro } from './display-intro';
import {
  resolveDisplaySettingsChange,
  transitionDisplayFlow,
  type DisplayAction,
  type DisplayPosition,
} from './display-flow';
import { FontSizeStep } from './font-size-step';
import { MotionStep } from './motion-step';
import { ThemeStep } from './theme-step';

const backButtonImage = require('../../../assets/onboarding/back-button.png');

export type DisplaySetupProps = {
  settings: Settings;
  onChange: (next: Settings) => void;
  onFinish: () => Promise<void>;
  onExit: () => void;
};

type StepDetails = {
  title: string;
  step: 1 | 2 | 3;
  continueLabel: string;
  skipLabel: string;
};

const stepDetails: Record<Exclude<DisplayPosition, 'introduction'>, StepDetails> = {
  font: { title: 'Font Sizes', step: 1, continueLabel: 'Continue', skipLabel: 'Skip for now' },
  motion: {
    title: 'Motion Controls',
    step: 2,
    continueLabel: 'Continue',
    skipLabel: 'Skip for now',
  },
  theme: {
    title: 'Colour Themes',
    step: 3,
    continueLabel: 'Continue to Period Information',
    skipLabel: 'Skip for now',
  },
};

export function DisplaySetup({ settings, onChange, onFinish, onExit }: DisplaySetupProps) {
  const [position, setPosition] = useState<DisplayPosition>('introduction');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finishInFlight = useRef(false);
  const appearance = getAppearance(settings);
  const { colors, fontScale } = appearance;

  async function finish() {
    if (finishInFlight.current) return;
    finishInFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      await onFinish();
    } catch {
      setError("We couldn't save your display settings. Please try again.");
    } finally {
      finishInFlight.current = false;
      setSaving(false);
    }
  }

  function updateSettings(next: Settings) {
    const accepted = resolveDisplaySettingsChange(settings, next, finishInFlight.current);
    if (accepted !== settings) onChange(accepted);
  }

  function navigate(action: DisplayAction) {
    if (saving) return;
    const { navigation } = transitionDisplayFlow({ position, settings }, action);
    setError(null);
    if (navigation.type === 'position') setPosition(navigation.position);
    else if (navigation.type === 'exit') onExit();
    else void finish();
  }

  const details = position === 'introduction' ? null : stepDetails[position];
  const continueLabel = details?.continueLabel ?? 'Continue';
  const skipLabel = details?.skipLabel ?? 'Skip to period information';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={[styles.frame, { backgroundColor: colors.background }]}>
        <DisplayHeader
          details={details}
          fontScale={fontScale}
          color={colors.text}
          disabled={saving}
          onBack={() => navigate('back')}
        />

        <ScrollView
          style={styles.scroller}
          contentContainerStyle={styles.scrollerContent}
          showsVerticalScrollIndicator={false}
        >
          <View
            accessibilityState={{ disabled: saving }}
            style={[
              styles.contentAndActions,
              position === 'font'
                ? styles.fontSpacing
                : details
                  ? styles.stepSpacing
                  : styles.introSpacing,
              saving && styles.disabledContent,
            ]}
          >
            <View style={styles.stepContent}>
              {position === 'introduction' && <DisplayIntro appearance={appearance} />}
              {position === 'font' && (
                <FontSizeStep
                  value={settings.textSize}
                  onChange={(textSize) => updateSettings({ ...settings, textSize })}
                  appearance={appearance}
                />
              )}
              {position === 'motion' && (
                <MotionStep
                  value={settings.reduceMotion}
                  onChange={(reduceMotion) => updateSettings({ ...settings, reduceMotion })}
                  appearance={appearance}
                />
              )}
              {position === 'theme' && (
                <ThemeStep
                  value={settings.colorScheme}
                  onChange={(colorScheme) => updateSettings({ ...settings, colorScheme })}
                  appearance={appearance}
                />
              )}
            </View>

            <DisplayActions
              details={details}
              continueLabel={saving ? 'Saving…' : continueLabel}
              skipLabel={skipLabel}
              disabled={saving}
              error={error}
              fontScale={fontScale}
              textColor={colors.text}
              onContinue={() => navigate('continue')}
              onSkip={() => navigate('skip')}
            />
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

type DisplayHeaderProps = {
  details: StepDetails | null;
  fontScale: number;
  color: string;
  disabled: boolean;
  onBack: () => void;
};

function DisplayHeader({ details, fontScale, color, disabled, onBack }: DisplayHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          accessibilityState={{ disabled }}
          disabled={disabled}
          hitSlop={8}
          onPress={onBack}
          style={({ pressed }) => [
            styles.backButton,
            { opacity: disabled ? 0.45 : pressed ? 0.7 : 1 },
          ]}
        >
          <Image source={backButtonImage} contentFit="contain" style={styles.backButtonImage} />
        </Pressable>

        {details && (
          <View style={styles.heading}>
            <Text
              style={[
                styles.stepLabel,
                { color, fontSize: 16 * fontScale, lineHeight: 20 * fontScale },
              ]}
            >
              Step {details.step} of 3
            </Text>
            <Text
              accessibilityRole="header"
              style={[
                styles.title,
                { color, fontSize: 23 * fontScale, lineHeight: 27 * fontScale },
              ]}
            >
              {details.title}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

type DisplayActionsProps = {
  details: StepDetails | null;
  continueLabel: string;
  skipLabel: string;
  disabled: boolean;
  error: string | null;
  fontScale: number;
  textColor: string;
  onContinue: () => void;
  onSkip: () => void;
};

function DisplayActions({
  details,
  continueLabel,
  skipLabel,
  disabled,
  error,
  fontScale,
  textColor,
  onContinue,
  onSkip,
}: DisplayActionsProps) {
  return (
    <View style={styles.actions}>
      {error && (
        <Text
          accessibilityRole="alert"
          style={[
            styles.error,
            { color: textColor, fontSize: 15 * fontScale, lineHeight: 20 * fontScale },
          ]}
        >
          {error}
        </Text>
      )}

      {details && (
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 1, max: 3, now: details.step }}
          accessibilityLabel={`Step ${details.step} of 3`}
          style={styles.dots}
        >
          {[1, 2, 3].map((step) => (
            <View
              key={step}
              style={[
                styles.dot,
                {
                  width: step === details.step ? 16 : 8,
                  backgroundColor:
                    step === details.step
                      ? OnboardingColors.brand
                      : OnboardingColors.progressInactive,
                },
              ]}
            />
          ))}
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled, busy: disabled && continueLabel === 'Saving…' }}
        disabled={disabled}
        onPress={onContinue}
        style={({ pressed }) => [
          styles.primaryButton,
          { opacity: disabled ? 0.45 : pressed ? 0.82 : 1 },
        ]}
      >
        <Text
          style={[
            styles.primaryButtonLabel,
            { fontSize: 16 * fontScale, lineHeight: 24 * fontScale },
          ]}
        >
          {continueLabel}
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onSkip}
        style={({ pressed }) => [
          styles.skipButton,
          { opacity: disabled ? 0.45 : pressed ? 0.65 : 1 },
        ]}
      >
        <Text
          style={[
            styles.skipButtonLabel,
            { fontSize: 16 * fontScale, lineHeight: 20 * fontScale },
          ]}
        >
          {skipLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  frame: { flex: 1, width: '100%', maxWidth: 402, alignSelf: 'center' },
  header: { minHeight: 98, paddingTop: Spacing.five, paddingBottom: Spacing.three },
  headerBar: { minHeight: 50, justifyContent: 'center' },
  backButton: {
    position: 'absolute',
    left: Spacing.four,
    top: 0,
    zIndex: 1,
    width: 50,
    height: 50,
  },
  backButtonImage: { position: 'absolute', left: -4, top: -4, width: 58, height: 58 },
  heading: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 80 },
  stepLabel: { fontFamily: OnboardingFonts.regular, textAlign: 'center' },
  title: { fontFamily: OnboardingFonts.bold, textAlign: 'center' },
  scroller: { flex: 1 },
  scrollerContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.four,
    paddingBottom: 40,
  },
  contentAndActions: { width: '100%' },
  introSpacing: { gap: 150 },
  fontSpacing: { gap: 74 },
  stepSpacing: { gap: 80 },
  stepContent: { width: '100%' },
  disabledContent: { pointerEvents: 'none' },
  actions: { width: '100%', alignItems: 'center', gap: Spacing.three },
  error: { width: '100%', fontFamily: OnboardingFonts.regular, textAlign: 'center' },
  dots: { height: 8, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dot: { height: 8, borderRadius: 4 },
  primaryButton: {
    width: '100%',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: 12,
    borderRadius: 100,
    backgroundColor: OnboardingColors.brand,
    shadowColor: OnboardingColors.brandPressed,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  primaryButtonLabel: {
    color: OnboardingColors.white,
    fontFamily: OnboardingFonts.bold,
    textAlign: 'center',
  },
  skipButton: {
    minHeight: 51,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: 12,
  },
  skipButtonLabel: {
    color: OnboardingColors.brand,
    fontFamily: OnboardingFonts.bold,
    textAlign: 'center',
    textDecorationLine: 'underline',
    textDecorationColor: OnboardingColors.brand,
  },
});
