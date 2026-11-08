import { StyleSheet, Switch, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import type { Appearance } from '@/features/settings/appearance';

export type MotionStepProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  appearance: Appearance;
  disabled?: boolean;
};

export function MotionStep({ value, onChange, appearance, disabled = false }: MotionStepProps) {
  const { colors, fontScale } = appearance;

  return (
    <View style={[styles.content, { backgroundColor: colors.background }]}>
      <View style={[styles.row, { backgroundColor: colors.backgroundElement }]}>
        <View style={styles.copy}>
          <Text style={[styles.label, { color: colors.text, fontSize: 18 * fontScale }]}>
            Reduce Motion
          </Text>
          <Text
            nativeID="reduce-motion-description"
            style={{
              color: colors.textSecondary,
              fontSize: 15 * fontScale,
              lineHeight: 22 * fontScale,
            }}
          >
            Limits movement and animated effects throughout the app.
          </Text>
        </View>
        <Switch
          disabled={disabled}
          value={value}
          onValueChange={onChange}
          accessibilityLabel="Reduce Motion"
          accessibilityHint="Limits movement and animated effects throughout the app"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: 12,
  },
  copy: { flex: 1, gap: Spacing.two },
  label: { fontWeight: '700' },
});
