import { StyleSheet, Switch, Text, View } from 'react-native';
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
    <View style={styles.content}>
      <Text style={{ color: colors.textSecondary, fontSize: 16 * fontScale, lineHeight: 24 * fontScale }}>
        This will change how much motion there is throughout the app.
      </Text>

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
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
  },
  subtitle: {
    marginLeft: Spacing.one,
  },
});
