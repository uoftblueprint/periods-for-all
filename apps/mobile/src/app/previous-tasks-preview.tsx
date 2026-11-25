import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings, textSizes } from '@/foundation/contracts';
import type { Settings } from '@/foundation/contracts';
import { Pressable } from 'react-native';
import { PreviousTasks } from '@/features/spoons/previous-tasks';
import type { SpoonTask, SpoonMove } from '@/features/spoons/contracts';

/** Fabricated previous tasks for preview. */
const SAMPLE_TASKS: SpoonTask[] = [
  {
    id: 'prev-1', date: '2026-11-24', name: 'Change bedsheets',
    kind: 'spend', amount: 3, completion: null,
  },
  {
    id: 'prev-2', date: '2026-11-24', name: 'Shower',
    kind: 'spend', amount: 2, completion: null,
  },
  {
    id: 'prev-3', date: '2026-11-23', name: 'Grocery shopping',
    kind: 'spend', amount: 4, completion: null,
  },
];

/** Preview route for S4-07 previous tasks section. */
export default function PreviousTasksPreview() {
  const [textSize, setTextSize] = useState<Settings['textSize']>('standard');
  const appearance = getAppearance({ ...defaultSettings, textSize });
  const { colors, fontScale } = appearance;

  const [tasks, setTasks] = useState(SAMPLE_TASKS);

  // Simulate moving a task: remove from previous list after a short delay.
  async function handleMove(input: SpoonMove) {
    await new Promise((r) => setTimeout(r, 300));
    setTasks((prev) => prev.filter((t) => t.id !== input.taskId));
  }

  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.scroll}
    >
      {/* Text size switcher */}
      <View style={styles.sizeRow}>
        {textSizes.map((size) => (
          <Pressable
            key={size}
            onPress={() => setTextSize(size)}
            accessibilityRole="button"
            accessibilityLabel={`Text size ${size}`}
            style={[
              styles.sizeButton,
              {
                backgroundColor: size === textSize ? colors.backgroundSelected : colors.backgroundElement,
                borderColor: size === textSize ? colors.text : 'transparent',
              },
            ]}
          >
            <Text style={{ color: colors.text, fontSize: 12 * fontScale }}>{size}</Text>
          </Pressable>
        ))}
      </View>

      <PreviousTasks
        tasks={tasks}
        todayDate={today}
        todayRevision={0}
        appearance={appearance}
        onMove={handleMove}
      />

      {tasks.length === 0 && (
        <Text style={{ color: colors.textSecondary, fontSize: 14 * fontScale, textAlign: 'center' }}>
          All previous tasks moved or none exist.
        </Text>
      )}

      {/* Reset button to bring tasks back */}
      {tasks.length < SAMPLE_TASKS.length && (
        <Pressable
          onPress={() => setTasks(SAMPLE_TASKS)}
          accessibilityRole="button"
          accessibilityLabel="Reset sample tasks"
          style={[styles.resetButton, { backgroundColor: colors.backgroundElement }]}
        >
          <Text style={{ color: colors.text, fontSize: 14 * fontScale }}>Reset sample tasks</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.three, gap: Spacing.three },
  sizeRow: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  sizeButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: 8,
    borderWidth: 2,
  },
  resetButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: 12,
    marginTop: Spacing.three,
  },
});
