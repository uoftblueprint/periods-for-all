import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import type { Appearance } from '@/features/settings/appearance';

// Temporary local type until S3-01 merges.
export type Mood = 'verySad' | 'sad' | 'neutral' | 'happy' | 'veryHappy';

// Unicode emoji as placeholders until Figma face assets are provided.
const MOODS: { key: Mood; label: string; face: string }[] = [
  { key: 'verySad', label: 'Very Sad', face: '\u{1F622}' },
  { key: 'sad', label: 'Sad', face: '\u{1F61E}' },
  { key: 'neutral', label: 'Neutral', face: '\u{1F610}' },
  { key: 'happy', label: 'Happy', face: '\u{1F60A}' },
  { key: 'veryHappy', label: 'Very Happy', face: '\u{1F604}' },
];

/** Props for the mood picker control. */
export type MoodPickerProps = {
  value: Mood | null;
  onChange: (v: Mood | null) => void;
  appearance: Appearance;
};

/**
 * Five mood faces in a row. Selected face is shown larger with its text label.
 * Does not own state — parent controls value via onChange.
 */
export function MoodPicker({ value, onChange, appearance }: MoodPickerProps) {
  const { colors, fontScale } = appearance;
  // Look up the selected mood's label and face for display.
  const selected = value ? MOODS.find((m) => m.key === value) : null;

  return (
    <View style={styles.container}>
      {/* Label showing current mood or placeholder */}
      <Text style={{ color: colors.textSecondary, fontSize: 16 * fontScale }}>
        I am feeling:{' '}
        <Text style={{ color: colors.text, fontWeight: '700' }}>
          {selected ? selected.label : 'Mood'}
        </Text>
      </Text>

      {/* Mood faces — selected is larger */}
      <View style={styles.row}>
        {MOODS.map(({ key, label, face }) => {
          const isSelected = key === value;
          return (
            <Pressable
              key={key}
              onPress={() => onChange(key)}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ checked: isSelected }}
              style={styles.choice}
            >
              {/* Selected face scales up from center (40/28 ratio) per issue requirement */}
              <Text style={{
                fontSize: 28 * fontScale,
                textAlign: 'center',
                transform: [{ scale: isSelected ? 40 / 28 : 1 }],
              }}>
                {face}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  row: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  choice: { alignItems: 'center', justifyContent: 'center', padding: Spacing.one, height: 56 },
});
