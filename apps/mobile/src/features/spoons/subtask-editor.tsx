import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { OnboardingFonts } from '@/constants/theme';
import type { Appearance } from '@/features/settings/appearance';
import type { TaskDraftSubtask } from '@/features/spoons/task-editor-state';
import { getTaskUIColors } from '@/features/spoons/task-ui-colors';

export type SubtaskEditorProps = {
  subtasks: readonly TaskDraftSubtask[];
  appearance: Appearance;
  createSubtaskId: () => string;
  onAdd: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onCheck: (id: string, done: boolean) => void;
  onRemove: (id: string) => void;
  errors?: Readonly<Record<string, string>>;
  disabled?: boolean;
};

export function SubtaskEditor({
  subtasks, appearance, createSubtaskId, onAdd, onRename, onCheck, onRemove,
  errors = {}, disabled = false,
}: SubtaskEditorProps) {
  const colors = getTaskUIColors(appearance);
  const add = () => onAdd(createSubtaskId());
  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: colors.text, fontSize: 19 * appearance.fontScale }]}>Subtasks</Text>
      {subtasks.map((subtask, index) => {
        const name = subtask.name.trim() || `subtask ${index + 1}`;
        return (
          <View key={subtask.id} style={styles.item}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={`Mark ${name} ${subtask.done ? 'incomplete' : 'complete'}`}
              accessibilityState={{ checked: subtask.done, disabled }}
              disabled={disabled}
              onPress={() => onCheck(subtask.id, !subtask.done)}
              style={[styles.squareAction, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.text, fontSize: 18 }}>{subtask.done ? '✓' : ''}</Text>
            </Pressable>
            <View style={styles.inputColumn}>
              <TextInput
                accessibilityLabel={`Subtask ${index + 1}`}
                value={subtask.name}
                onChangeText={(value) => onRename(subtask.id, value)}
                editable={!disabled}
                multiline
                placeholder="Subtask name"
                placeholderTextColor={colors.secondaryText}
                style={[
                  styles.input,
                  { color: colors.text, backgroundColor: colors.field, borderColor: errors[subtask.id] ? colors.error : colors.border },
                ]}
              />
              {errors[subtask.id] && (
                <Text accessibilityRole="alert" style={{ color: colors.error }}>{errors[subtask.id]}</Text>
              )}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${name}`}
              accessibilityState={{ disabled }}
              disabled={disabled}
              onPress={() => onRemove(subtask.id)}
              style={[styles.squareAction, { borderColor: colors.border }]}
            >
              <Text style={{ color: disabled ? colors.disabled : colors.error, fontSize: 20 }}>×</Text>
            </Pressable>
          </View>
        );
      })}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={subtasks.length === 0 ? 'Break down your task' : 'Add subtask'}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={add}
        style={[styles.addButton, { borderColor: colors.border, backgroundColor: colors.field }]}
      >
        <Text style={{ color: disabled ? colors.disabled : colors.text, fontSize: 16 * appearance.fontScale }}>
          {subtasks.length === 0 ? 'Break down your task' : 'Add subtask'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  heading: { fontFamily: OnboardingFonts.bold },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  inputColumn: { flex: 1, gap: 4 },
  input: {
    minHeight: 48, borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8, textAlignVertical: 'top',
  },
  squareAction: {
    width: 44, height: 44, borderWidth: 1, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  addButton: {
    minHeight: 56, borderWidth: 1, borderStyle: 'dashed', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16,
  },
});
