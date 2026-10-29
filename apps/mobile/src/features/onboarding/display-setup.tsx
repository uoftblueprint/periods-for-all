import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { getAppearance } from '@/features/settings/appearance';
import type { Settings } from '@/foundation/contracts';
import { focusHeading } from '@/foundation/preview-screen';

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

export type DisplaySetupProps = {
  settings: Settings;
  onChange: (next: Settings) => void;
  onFinish: () => Promise<void>;
  onExit: () => void;
};

const stepDetails: Record<Exclude<DisplayPosition, 'introduction'>, { title: string; dot: number }> = {
  font: { title: 'Font Sizes', dot: 0 },
  motion: { title: 'Motion Controls', dot: 1 },
  theme: { title: 'Colour Themes', dot: 2 },
};

/**
 * Renders the controlled four-stage display setup flow. Draft settings remain owned
 * by the parent; finish requests are deduplicated and failures remain retryable.
 */
export function DisplaySetup({ settings, onChange, onFinish, onExit }: DisplaySetupProps) {
  const [position, setPosition] = useState<DisplayPosition>('introduction');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finishInFlight = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const heading = useRef<Text>(null);
  const focusedHeading = useRef<Text | null>(null);
  const appearance = getAppearance(settings);
  const { colors, fontScale } = appearance;
  const { fontScale: systemFontScale } = useWindowDimensions();

  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [position]);

  /** Runs onFinish at most once concurrently and clears saving state when it settles. */
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
    if (finishInFlight.current) return;
    const { navigation } = transitionDisplayFlow({ position, settings }, action);
    setError(null);
    if (navigation.type === 'position') setPosition(navigation.position);
    else if (navigation.type === 'exit') onExit();
    else void finish();
  }

  const details = position === 'introduction' ? null : stepDetails[position];

  return (
    <ScrollView
      // Refresh iOS text measurements after a live Dynamic Type change.
      key={Platform.OS === 'ios' ? systemFontScale : undefined}
      ref={scroll}
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.screen}
    >
      <Text
        ref={heading}
        tabIndex={-1}
        accessibilityRole="header"
        onLayout={() => {
          if (heading.current && focusedHeading.current !== heading.current) {
            focusedHeading.current = heading.current;
            focusHeading(heading.current);
          }
        }}
        style={{ color: colors.text, fontSize: 20 * fontScale, padding: 16 }}
      >Display setup</Text>
      {details && (
        <View style={styles.heading}>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: colors.text, fontSize: 26 * fontScale }]}
          >
            {details.title}
          </Text>
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 1, max: 3, now: details.dot + 1 }}
            aria-valuemin={1}
            aria-valuemax={3}
            aria-valuenow={details.dot + 1}
            accessibilityLabel={`Step ${details.dot + 1} of 3`}
            style={styles.dots}
          >
            {[0, 1, 2].map((dot) => (
              <View
                key={dot}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      dot === details.dot ? colors.text : colors.backgroundSelected,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      )}

      <View
        accessibilityState={{ disabled: saving }}
        style={[styles.content, saving && styles.disabledContent]}
      >
        {position === 'introduction' && <DisplayIntro appearance={appearance} />}
        {position === 'font' && (
          <FontSizeStep
            disabled={saving}
            value={settings.textSize}
            onChange={(textSize) => updateSettings({ ...settings, textSize })}
            appearance={appearance}
          />
        )}
        {position === 'motion' && (
          <MotionStep
            disabled={saving}
            value={settings.reduceMotion}
            onChange={(reduceMotion) => updateSettings({ ...settings, reduceMotion })}
            appearance={appearance}
          />
        )}
        {position === 'theme' && (
          <ThemeStep
            disabled={saving}
            value={settings.colorScheme}
            onChange={(colorScheme) => updateSettings({ ...settings, colorScheme })}
            appearance={appearance}
          />
        )}
      </View>

      {error && (
        <Text
          accessibilityRole="alert"
          style={[
            styles.error,
            { color: colors.text, fontSize: 15 * fontScale, lineHeight: 22 * fontScale },
          ]}
        >
          {error}
        </Text>
      )}

      <View style={[styles.actions, { borderTopColor: colors.backgroundSelected }]}>
        <FlowButton
          label="Back"
          disabled={saving}
          fontScale={fontScale}
          onPress={() => navigate('back')}
          color={colors.text}
          backgroundColor={colors.backgroundElement}
        />
        <FlowButton
          label={saving ? 'Saving…' : 'Continue'}
          disabled={saving}
          fontScale={fontScale}
          onPress={() => navigate('continue')}
          color={colors.background}
          backgroundColor={colors.text}
        />
        <FlowButton
          label="Skip"
          disabled={saving}
          fontScale={fontScale}
          onPress={() => navigate('skip')}
          color={colors.text}
          backgroundColor={colors.backgroundElement}
        />
      </View>
    </ScrollView>
  );
}

type FlowButtonProps = {
  label: string;
  disabled: boolean;
  fontScale: number;
  onPress: () => void;
  color: string;
  backgroundColor: string;
};

function FlowButton({ label, disabled, fontScale, onPress, color, backgroundColor }: FlowButtonProps) {
  const { fontScale: systemFontScale } = useWindowDimensions();
  return (
    <Pressable
      accessibilityRole="button"
      aria-busy={disabled && label === 'Saving…'}
      accessibilityState={{ disabled, busy: disabled && label === 'Saving…' }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          minWidth: 90 * fontScale,
          flexBasis: 90 * fontScale * systemFontScale,
          opacity: disabled ? 0.45 : pressed ? 0.72 : 1,
        },
      ]}
    >
      <Text style={[styles.buttonLabel, { color, fontSize: 16 * fontScale }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1 },
  heading: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  title: { fontWeight: '700', textAlign: 'center' },
  dots: { flexDirection: 'row', gap: Spacing.two },
  dot: { width: 10, height: 10, borderRadius: 5 },
  content: { flexGrow: 1 },
  disabledContent: { pointerEvents: 'none' },
  error: { marginHorizontal: Spacing.four, marginBottom: Spacing.two },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    padding: Spacing.three,
    borderTopWidth: 1,
  },
  button: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.three,
  },
  buttonLabel: { fontSize: 16, fontWeight: '700' },
});
