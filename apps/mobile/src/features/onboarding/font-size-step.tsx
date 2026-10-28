import { useMemo, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import {
  OnboardingColors,
  OnboardingFonts,
  Spacing,
} from '@/constants/theme';
import type { Appearance } from '@/features/settings/appearance';
import { textSizes, type Settings } from '@/foundation/contracts';

export type FontSizeStepProps = {
  value: Settings['textSize'];
  onChange: (value: Settings['textSize']) => void;
  appearance: Appearance;
};

const labels: Record<Settings['textSize'], string> = {
  standard: 'Standard',
  large: 'Large',
  extraLarge: 'Extra large',
  largest: 'Largest',
};

export function FontSizeStep({ value, onChange, appearance }: FontSizeStepProps) {
  const { colors, fontScale } = appearance;

  return (
    <View style={styles.content}>
      <Text
        style={[
          styles.body,
          { color: colors.text, fontSize: 16 * fontScale, lineHeight: 20 * fontScale },
        ]}
      >
        This will change how large the font is on screen.
      </Text>

      <View style={[styles.card, { backgroundColor: colors.background === '#FCFBF8' ? OnboardingColors.white : colors.backgroundElement }]}>
        <Text
          style={[
            styles.body,
            { color: colors.text, fontSize: 16 * fontScale, lineHeight: 20 * fontScale },
          ]}
        >
          The text size will adjust based on the slider below.
        </Text>
        <TextSizeSlider value={value} onChange={onChange} appearance={appearance} />
      </View>
    </View>
  );
}

function TextSizeSlider({ value, onChange, appearance }: FontSizeStepProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const selectedIndex = textSizes.indexOf(value);
  const selectedPercent = (selectedIndex / (textSizes.length - 1)) * 100;

  function selectFromPosition(position: number) {
    if (trackWidth <= 0) return;
    const bounded = Math.max(0, Math.min(trackWidth, position));
    const index = Math.round((bounded / trackWidth) * (textSizes.length - 1));
    const next = textSizes[index];
    if (next !== value) onChange(next);
  }

  function adjust(direction: 1 | -1) {
    const nextIndex = Math.max(0, Math.min(textSizes.length - 1, selectedIndex + direction));
    const next = textSizes[nextIndex];
    if (next !== value) onChange(next);
  }

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => selectFromPosition(event.nativeEvent.locationX),
        onPanResponderMove: (event) => selectFromPosition(event.nativeEvent.locationX),
      }),
    // The responder must follow the latest controlled value and measured width.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trackWidth, value],
  );

  function onTrackLayout(event: LayoutChangeEvent) {
    setTrackWidth(event.nativeEvent.layout.width);
  }

  const { colors, fontScale } = appearance;

  return (
    <View style={[styles.sliderCard, { backgroundColor: colors.background === '#FCFBF8' ? OnboardingColors.white : colors.backgroundElement }]}>
      <View style={styles.sliderRow}>
        <Text
          style={[
            styles.body,
            styles.smallA,
            { color: colors.text, fontSize: 16 * fontScale, lineHeight: 20 * fontScale },
          ]}
        >
          A
        </Text>
        <View
          accessibilityRole="adjustable"
          accessibilityLabel="Text size"
          accessibilityHint="Swipe up or down, or drag along the slider, to change the text size"
          accessibilityValue={{
            min: 1,
            max: textSizes.length,
            now: selectedIndex + 1,
            text: labels[value],
          }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) =>
            adjust(event.nativeEvent.actionName === 'increment' ? 1 : -1)
          }
          onLayout={onTrackLayout}
          style={styles.trackTouchTarget}
          {...responder.panHandlers}
        >
          <View style={styles.track}>
            <View style={[styles.trackProgress, { width: `${selectedPercent}%` }]} />
          </View>
          <View pointerEvents="none" style={styles.ticks}>
            {textSizes.map((size) => (
              <View key={size} style={styles.tick} />
            ))}
          </View>
          <View
            pointerEvents="none"
            style={[
              styles.thumb,
              { left: `${selectedPercent}%`, transform: [{ translateX: -16 }] },
            ]}
          />
        </View>
        <Text
          style={[
            styles.body,
            styles.largeA,
            { color: colors.text, fontSize: 32 * fontScale, lineHeight: 38 * fontScale },
          ]}
        >
          A
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', gap: Spacing.three },
  body: { fontFamily: OnboardingFonts.regular },
  card: {
    width: '100%',
    gap: Spacing.four,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: OnboardingColors.border,
    borderRadius: 16,
    shadowColor: OnboardingColors.border,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  sliderCard: {
    width: '100%',
    minHeight: 70,
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: OnboardingColors.border,
    borderRadius: 12,
  },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  smallA: { width: 16, textAlign: 'center' },
  largeA: { minWidth: 25, textAlign: 'center' },
  trackTouchTarget: { flex: 1, height: 36, justifyContent: 'center' },
  track: {
    height: 4,
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: OnboardingColors.inactiveTrack,
  },
  trackProgress: {
    height: 4,
    borderRadius: 8,
    backgroundColor: '#5A482F',
  },
  ticks: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tick: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#91918C' },
  thumb: {
    position: 'absolute',
    top: 8,
    width: 32,
    height: 20,
    borderWidth: 1,
    borderColor: OnboardingColors.border,
    borderRadius: 16,
    backgroundColor: OnboardingColors.white,
    shadowColor: '#645538',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
});
