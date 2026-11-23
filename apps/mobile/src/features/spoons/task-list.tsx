import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { OnboardingFonts } from '@/constants/theme';
import type { Appearance } from '@/features/settings/appearance';
import type { SpoonTask } from '@/features/spoons/contracts';
import { getTaskUIColors } from '@/features/spoons/task-ui-colors';

export type TaskListProps = {
  tasks: readonly SpoonTask[];
  appearance: Appearance;
  disabled?: boolean;
  onAddTask: () => void;
  onEditTask: (task: SpoonTask) => void;
  onToggleCompletion: (task: SpoonTask) => void;
};

export function TaskList({
  tasks, appearance, disabled = false, onAddTask, onEditTask, onToggleCompletion,
}: TaskListProps) {
  const colors = getTaskUIColors(appearance);
  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Text
        accessibilityRole="header"
        accessibilityLabel={`${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`}
        style={[styles.title, { color: colors.text, fontSize: 23 * appearance.fontScale }]}
      >
        Tasks · {tasks.length}
      </Text>
      <FlatList
        data={[...tasks]}
        keyExtractor={(task) => task.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={(
          <View style={styles.empty}>
            <Text style={{ color: colors.text, fontSize: 19 * appearance.fontScale }}>No tasks yet</Text>
            <Text style={{ color: colors.secondaryText }}>Plan something that spends or restores spoons.</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TaskRow
            task={item} appearance={appearance} disabled={disabled}
            onEdit={() => onEditTask(item)} onToggle={() => onToggleCompletion(item)}
          />
        )}
      />
      <Pressable
        accessibilityRole="button" accessibilityLabel="Add a task" accessibilityState={{ disabled }}
        disabled={disabled} onPress={onAddTask}
        style={[styles.add, { borderColor: colors.selectedBorder, backgroundColor: colors.selectedFill }]}
      >
        <Text style={{ color: disabled ? colors.disabled : colors.text, fontSize: 16 * appearance.fontScale }}>Add a task</Text>
      </Pressable>
    </View>
  );
}

function TaskRow({
  task, appearance, disabled, onEdit, onToggle,
}: { task: SpoonTask; appearance: Appearance; disabled: boolean; onEdit: () => void; onToggle: () => void }) {
  const colors = getTaskUIColors(appearance);
  const completed = task.completion !== null;
  const details = [
    `${task.amount} ${task.amount === 1 ? 'spoon' : 'spoons'} ${task.kind === 'spend' ? 'spent' : 'restored'}`,
    task.priority ? `${task.priority[0].toUpperCase()}${task.priority.slice(1)} priority` : null,
    task.time,
    task.subtasks?.length
      ? `${task.subtasks.filter((subtask) => subtask.done).length} of ${task.subtasks.length} subtasks complete`
      : null,
    completed ? 'Completed' : null,
  ].filter(Boolean).join(' · ');
  return (
    <View style={[styles.row, { borderColor: colors.border, backgroundColor: colors.field }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={`Mark ${task.name} ${completed ? 'incomplete' : 'complete'}`}
        accessibilityState={{ checked: completed, disabled }}
        disabled={disabled}
        onPress={onToggle}
        style={[styles.checkbox, { borderColor: colors.selectedBorder }]}
      >
        <Text style={{ color: colors.text, fontSize: 18 }}>{completed ? '✓' : ''}</Text>
      </Pressable>
      <View style={styles.rowText}>
        <Text style={[styles.name, { color: colors.text, fontSize: 19 * appearance.fontScale }]}>{task.name}</Text>
        <Text style={{ color: colors.secondaryText, fontSize: 14 * appearance.fontScale }}>{details}</Text>
      </View>
      {!completed && (
        <Pressable
          accessibilityRole="button" accessibilityLabel={`Edit ${task.name}`} accessibilityState={{ disabled }}
          disabled={disabled} onPress={onEdit}
          style={[styles.edit, { borderColor: colors.border }]}
        >
          <Text style={{ color: disabled ? colors.disabled : colors.text }}>Edit</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 16, padding: 24 },
  title: { fontFamily: OnboardingFonts.bold },
  list: { gap: 12, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 48 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderRadius: 12, padding: 12 },
  checkbox: { width: 44, height: 44, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 6 },
  name: { fontFamily: OnboardingFonts.bold, flexShrink: 1 },
  edit: { minWidth: 44, minHeight: 44, borderWidth: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  add: { minHeight: 48, borderWidth: 1, borderRadius: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
});
