import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import type { Appearance } from '@/features/settings/appearance';
import type { SpoonTask, SpoonMove } from '@/features/spoons/contracts';

/** Props for the previous-tasks section. */
export type PreviousTasksProps = {
  tasks: readonly SpoonTask[];
  todayDate: string;
  todayRevision: number;
  appearance: Appearance;
  onMove: (input: SpoonMove) => Promise<void>;
};

/**
 * Collapsible section listing unfinished tasks from earlier days.
 * Each task has a "Move to Today" action that calls onMove once.
 * Parent provides tasks via listUnfinishedPreviousTasks and handles store updates.
 */
export function PreviousTasks({
  tasks, todayDate, todayRevision, appearance, onMove,
}: PreviousTasksProps) {
  const { colors, fontScale } = appearance;
  const [expanded, setExpanded] = useState(true);

  if (tasks.length === 0) return null;

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => setExpanded(!expanded)}
        accessibilityRole="button"
        accessibilityLabel={`Previous Tasks ${tasks.length}, ${expanded ? 'collapse' : 'expand'}`}
        style={styles.header}
      >
        <Text style={[styles.headerText, { color: colors.text, fontSize: 20 * fontScale }]}>
          Previous Tasks{' '}
          <Text style={{ color: colors.textSecondary, fontWeight: '400' }}>
            {tasks.length}
          </Text>
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 20 * fontScale }}>
          {expanded ? '∧' : '∨'}
        </Text>
      </Pressable>

      {expanded && (
        <View style={styles.list}>
          {tasks.map((task) => (
            <PreviousTaskRow
              key={task.id}
              task={task}
              todayDate={todayDate}
              todayRevision={todayRevision}
              onMove={onMove}
              colors={colors}
              fontScale={fontScale}
            />
          ))}
        </View>
      )}
    </View>
  );
}

type Colors = Appearance['colors'];

/** Single previous task row with spoon icons and move-to-today action. */
function PreviousTaskRow({ task, todayDate, todayRevision, onMove, colors, fontScale }: {
  task: SpoonTask; todayDate: string; todayRevision: number;
  onMove: PreviousTasksProps['onMove']; colors: Colors; fontScale: number;
}) {
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleMove() {
    if (moving) return;
    setMoving(true);
    setError(null);
    try {
      await onMove({
        date: task.date,
        operationId: `move-${task.id}-${Date.now()}`,
        expectedRevision: 0,
        taskId: task.id,
        destinationDate: todayDate,
        expectedDestinationRevision: todayRevision,
      });
    } catch {
      setError('Could not move task. Try again.');
    } finally {
      setMoving(false);
    }
  }

  return (
    <View style={styles.taskRow}>
      <Pressable
        onPress={handleMove}
        disabled={moving}
        accessibilityRole="button"
        accessibilityLabel={`Move ${task.name} to today`}
        style={[styles.moveButton, { borderColor: colors.backgroundElement }]}
      >
        {/* Empty checkbox-style square — tapping moves the task to today */}
        <View style={[styles.checkbox, { borderColor: colors.textSecondary }]} />
      </Pressable>

      <View style={styles.taskDetails}>
        <Text style={{
          color: colors.text,
          fontSize: 16 * fontScale,
          opacity: moving ? 0.5 : 1,
        }}>
          {task.name}
        </Text>
        <View style={styles.spoonRow}>
          {/* Spoon icons matching Figma — one per spoon, capped at amount */}
          {Array.from({ length: task.amount }, (_, i) => (
            <Text key={i} style={{ fontSize: 14 * fontScale }}>🥄</Text>
          ))}
          <Text style={{ color: colors.textSecondary, fontSize: 13 * fontScale, marginLeft: 2 }}>
            {task.amount} {task.amount === 1 ? 'spoon' : 'spoons'}
          </Text>
        </View>
        {error && (
          <Text style={{ color: '#A3151C', fontSize: 12 * fontScale }}>{error}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  headerText: { fontWeight: '700' },
  list: { gap: Spacing.two },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  moveButton: { paddingTop: 2 },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderRadius: 4,
  },
  taskDetails: { flex: 1, gap: 2 },
  spoonRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
