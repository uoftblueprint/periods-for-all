import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import type { Appearance } from '@/features/settings/appearance';

// Temporary local type until S3-01 merges.
export type Flow = 'none' | 'veryLight' | 'light' | 'normal' | 'heavy' | 'veryHeavy';

// The five nonzero flow levels, ordered lightest to heaviest.
const FLOW_LEVELS: { key: Flow; label: string }[] = [
  { key: 'veryLight', label: 'Very Light' },
  { key: 'light', label: 'Light' },
  { key: 'normal', label: 'Normal' },
  { key: 'heavy', label: 'Heavy' },
  { key: 'veryHeavy', label: 'Very Heavy' },
];

/** Props for the flow picker control. */
export type FlowPickerProps = {
  value: Flow | null;
  onChange: (v: Flow | null) => void;
  appearance: Appearance;
};

/**
 * Five drop icons with progressive fill, plus No Flow and Clear.
 * Selecting a level fills that drop and all previous drops.
 * Does not own state — parent controls value via onChange.
 */
export function FlowPicker({ value, onChange, appearance }: FlowPickerProps) {
  const { colors, fontScale } = appearance;
  // Index of the selected nonzero level (-1 if null or 'none').
  const selectedIndex = value && value !== 'none'
    ? FLOW_LEVELS.findIndex((l) => l.key === value)
    : -1;
  const selectedLabel = value === 'none' ? 'No Flow'
    : selectedIndex >= 0 ? FLOW_LEVELS[selectedIndex].label
    : '';

  return (
    <View style={styles.container}>
      {/* Label showing current flow level */}
      <Text style={{ color: colors.textSecondary, fontSize: 16 * fontScale }}>
        Today's Flow:{' '}
        <Text style={{ color: colors.text, fontWeight: '700' }}>
          {selectedLabel}
        </Text>
      </Text>

      {/* Five drops — progressive fill up to the selected level */}
      <View style={styles.row}>
        {FLOW_LEVELS.map(({ key, label }, i) => {
          const filled = selectedIndex >= 0 && i <= selectedIndex;
          return (
            <Pressable
              key={key}
              onPress={() => onChange(key)}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ checked: key === value }}
              style={styles.dropChoice}
            >
              <View style={{
                backgroundColor: filled ? '#A3151C' : '#E8D5C4',
                width: 38 * fontScale,
                height: 38 * fontScale,
                // Circle with one sharp corner, rotated so the point faces up.
                borderRadius: 19 * fontScale,
                borderTopLeftRadius: 0,
                transform: [{ rotate: '45deg' }],
              }} />
            </Pressable>
          );
        })}
      </View>

      {/* No Flow and Clear actions */}
      <View style={styles.actionRow}>
        <Pressable
          onPress={() => onChange('none')}
          accessibilityRole="radio"
          accessibilityLabel="No Flow"
          accessibilityState={{ checked: value === 'none' }}
          style={[
            styles.noFlowButton,
            {
              backgroundColor: value === 'none' ? colors.backgroundSelected : colors.backgroundElement,
              borderColor: value === 'none' ? colors.text : 'transparent',
            },
          ]}
        >
          <Text style={{ color: colors.text, fontSize: 14 * fontScale }}>
            No Flow
          </Text>
        </Pressable>

        {/* Clear returns null (unanswered) — only shown when a value is set */}
        {value != null && (
          <Pressable
            onPress={() => onChange(null)}
            accessibilityRole="button"
            accessibilityLabel="Clear flow"
          >
            <Text style={{
              color: colors.textSecondary,
              fontSize: 14 * fontScale,
              textDecorationLine: 'underline',
            }}>
              Clear
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  row: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  dropChoice: { alignItems: 'center', padding: Spacing.one },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  noFlowButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
    borderWidth: 2,
  },
});
