import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import type { Appearance } from '@/features/settings/appearance';

export type MotionStepProps = {
  value: boolean;
  onChange: (reduceMotion: boolean) => void;
  appearance: Appearance;
};

/** Onboarding step: toggle reduced motion on or off. */
export function MotionStep({ value, onChange, appearance }: MotionStepProps) {
  const { colors, fontScale } = appearance;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text
        accessibilityRole="header"
        style={[styles.heading, { color: colors.text, fontSize: 22 * fontScale }]}
      >
        Motion Controls
      </Text>

      <Text style={[styles.explanation, { color: colors.textSecondary, fontSize: 16 * fontScale, lineHeight: 24 * fontScale }]}>
        This will change how much motion there is throughout the app.
      </Text>

      {/* Toggle row */}
      <View style={[styles.toggleRow, { borderColor: colors.backgroundSelected }]}>
        <Text style={{ color: colors.text, fontSize: 16 * fontScale, flex: 1, fontWeight: '500' }}>
          Reduce Motion
        </Text>
        <Switch
          value={value}
          onValueChange={onChange}
          accessibilityLabel="Reduce motion"
        />
      </View>

      <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: 14 * fontScale }]}>
        Less animation throughout the app.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.five,
  },
  heading: {
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.four,
  },
  explanation: {
    marginBottom: Spacing.three,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
  },
  subtitle: {
    marginTop: Spacing.two,
    marginLeft: Spacing.one,
  },
});
