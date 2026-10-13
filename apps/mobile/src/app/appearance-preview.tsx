import { useEffect, useRef, useState } from 'react';
import { Animated, Switch, Text, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import { defaultSettings, type Settings } from '@/foundation/contracts';
import { PreviewScreen } from '@/foundation/preview-screen';
import { getAppearance } from '@/features/settings/appearance';

const combinations: Settings[] = (['light', 'dark'] as const).flatMap((colorScheme) =>
  (['standard', 'large'] as const).map((textSize) => ({ ...defaultSettings, colorScheme, textSize })),
);

function Sample({ settings }: { settings: Settings }) {
  const { colors, fontScale } = getAppearance(settings);
  return (
    <View style={{ backgroundColor: colors.background, padding: Spacing.three, gap: Spacing.two, borderRadius: 12, borderWidth: 1, borderColor: colors.backgroundSelected }}>
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 24 * fontScale, lineHeight: 32 * fontScale, fontWeight: 600 }}>
        {settings.colorScheme} · {settings.textSize} ({fontScale}×)
      </Text>
      <Text style={{ color: colors.text, fontSize: 16 * fontScale, lineHeight: 24 * fontScale }}>
        Body text should wrap onto new lines instead of being cut off when the text is larger.
      </Text>
      <View style={{ backgroundColor: colors.backgroundElement, padding: Spacing.two, borderRadius: 8 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 14 * fontScale, lineHeight: 20 * fontScale }}>
          Secondary text on an element surface.
        </Text>
      </View>
      <View style={{ backgroundColor: colors.backgroundSelected, padding: Spacing.two, borderRadius: 8 }}>
        <Text style={{ color: colors.text, fontSize: 14 * fontScale, lineHeight: 20 * fontScale }}>Selected surface</Text>
      </View>
    </View>
  );
}

function MotionSample({ reduceMotion }: { reduceMotion: boolean }) {
  const { colors } = getAppearance(defaultSettings);
  const offset = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    // Reduced motion: stop the loop and rest at the start position.
    if (reduceMotion) {
      offset.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(offset, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(offset, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [offset, reduceMotion]);
  const translateX = offset.interpolate({ inputRange: [0, 1], outputRange: [0, 120] });
  return (
    <View style={{ height: 40, justifyContent: 'center' }}>
      <Animated.View
        accessibilityLabel={reduceMotion ? 'Static square' : 'Moving square'}
        style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: colors.text, transform: [{ translateX }] }}
      />
    </View>
  );
}

export default function AppearancePreview() {
  const [reduceMotion, setReduceMotion] = useState(defaultSettings.reduceMotion);
  return (
    <PreviewScreen title="Appearance preview (temporary values)">
      <Text>Each card applies getAppearance() to a literal Settings value.</Text>
      {combinations.map((settings) => (
        <Sample key={`${settings.colorScheme}-${settings.textSize}`} settings={settings} />
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
        <Switch value={reduceMotion} onValueChange={setReduceMotion} accessibilityLabel="Reduce motion" />
        <Text>Reduce motion: {String(getAppearance({ ...defaultSettings, reduceMotion }).reduceMotion)}</Text>
      </View>
      <MotionSample reduceMotion={getAppearance({ ...defaultSettings, reduceMotion }).reduceMotion} />
    </PreviewScreen>
  );
}
