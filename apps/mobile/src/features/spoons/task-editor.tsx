import { useEffect, useReducer, useRef, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { OnboardingFonts } from '@/constants/theme';
import type { LocalDate } from '@/features/health/contracts';
import type { Appearance } from '@/features/settings/appearance';
import type { SpoonTaskDraft } from '@/features/spoons/contracts';
import {
  createTaskDraftState, reduceTaskDraft, validateTaskDraft,
  type TaskDraftErrors, type TaskDraftSource, type TaskDraftState,
} from '@/features/spoons/task-editor-state';
import {
  OptionalScheduleFields, PrioritySelector, SpoonAmountSelector, TaskNotesField,
} from '@/features/spoons/task-form-controls';
import { SubtaskEditor } from '@/features/spoons/subtask-editor';
import { getTaskUIColors } from '@/features/spoons/task-ui-colors';

export type TaskEditorMode = TaskDraftSource & {
  defaultDate: LocalDate;
  initialState?: TaskDraftState;
};

export type TaskEditorProps = {
  mode: TaskEditorMode;
  balance: number | null;
  budgetWarning?: string | null;
  appearance: Appearance;
  createSubtaskId: () => string;
  onSave: (draft: SpoonTaskDraft) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
  onRequestUndo?: () => void;
};

export function TaskEditor(props: TaskEditorProps) {
  const source = props.mode.initialState ?? (props.mode.type === 'edit' ? props.mode.task : props.mode.kind);
  const identity = `${props.mode.type}:${props.mode.defaultDate}:${JSON.stringify(source)}`;
  return <TaskEditorContent key={identity} {...props} />;
}

function TaskEditorContent({
  mode, balance, budgetWarning, appearance, createSubtaskId,
  onSave, onCancel, onDelete, onRequestUndo,
}: TaskEditorProps) {
  const [state, dispatch] = useReducer(
    reduceTaskDraft,
    mode,
    (source) => createTaskDraftState(source, source.initialState),
  );
  const [errors, setErrors] = useState<TaskDraftErrors>({});
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const mountedRef = useRef(true);
  const colors = getTaskUIColors(appearance);
  const completed = mode.type === 'edit' && mode.task.completion !== null;

  useEffect(() => () => { mountedRef.current = false; }, []);

  const runMutation = async (operation: () => Promise<void>, failureTitle: string) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      await operation();
    } catch {
      Alert.alert(failureTitle, 'Your task is still here. Try again.');
    } finally {
      pendingRef.current = false;
      if (mountedRef.current) setPending(false);
    }
  };

  const save = () => {
    if (completed || pendingRef.current) return;
    const result = validateTaskDraft(state);
    setErrors(result.errors);
    if (!result.draft) return;
    void runMutation(() => onSave(result.draft!), 'Could not save task');
  };

  const confirmDelete = () => {
    if (completed || pendingRef.current || !onDelete) return;
    Alert.alert('Delete task?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (!mountedRef.current) return;
          void runMutation(onDelete, 'Could not delete task');
        },
      },
    ]);
  };

  if (completed) {
    return (
      <View style={[styles.blocked, { backgroundColor: colors.surface }]}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Task Details</Text>
        <Text style={{ color: colors.text }}>Undo completion before editing or deleting this task.</Text>
        {onRequestUndo && (
          <ActionButton label="Undo completion" onPress={onRequestUndo} appearance={appearance} />
        )}
        <ActionButton label="Cancel editing" onPress={onCancel} appearance={appearance} secondary />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.surface }]}
    >
      <View style={[styles.header, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <ActionButton label="Cancel editing" onPress={onCancel} appearance={appearance} secondary disabled={pending} />
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Task Details</Text>
        <ActionButton label="Save task" onPress={save} appearance={appearance} disabled={pending} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ color: colors.secondaryText }}>
          Today’s Spoons · {balance === null ? 'Not set' : `${balance} Spoons`}
        </Text>
        {budgetWarning && (
          <Text accessibilityRole="alert" accessibilityLabel={budgetWarning} style={{ color: colors.error }}>
            {budgetWarning}
          </Text>
        )}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Task name</Text>
          <TextInput
            accessibilityLabel="Task name"
            value={state.name}
            onChangeText={(name) => dispatch({ type: 'setName', name })}
            editable={!pending}
            autoCapitalize="sentences"
            style={[styles.nameInput, { color: colors.text, backgroundColor: colors.field, borderColor: errors.name ? colors.error : colors.border }]}
          />
          {errors.name && <Text accessibilityRole="alert" style={{ color: colors.error }}>{errors.name}</Text>}
        </View>
        <SubtaskEditor
          subtasks={state.subtasks}
          appearance={appearance}
          createSubtaskId={createSubtaskId}
          disabled={pending}
          errors={errors.subtasks}
          onAdd={(id) => dispatch({ type: 'addSubtask', id })}
          onRename={(id, name) => dispatch({ type: 'renameSubtask', id, name })}
          onCheck={(id, done) => dispatch({ type: 'setSubtaskDone', id, done })}
          onRemove={(id) => dispatch({ type: 'removeSubtask', id })}
        />
        <SpoonAmountSelector
          kind={state.kind} value={state.amount} appearance={appearance} disabled={pending}
          error={errors.amount} onChange={(amount) => dispatch({ type: 'setAmount', amount })}
        />
        <OptionalScheduleFields
          appearance={appearance} disabled={pending}
          dateEnabled={state.dateEnabled} date={state.date}
          timeEnabled={state.timeEnabled} time={state.time}
          errors={{ date: errors.date, time: errors.time }}
          onDateEnabledChange={(enabled) => {
            dispatch({ type: 'setDateEnabled', enabled });
            if (enabled && !state.date) dispatch({ type: 'setDate', date: mode.defaultDate });
          }}
          onDateChange={(date) => dispatch({ type: 'setDate', date })}
          onTimeEnabledChange={(enabled) => dispatch({ type: 'setTimeEnabled', enabled })}
          onTimeChange={(time) => dispatch({ type: 'setTime', time })}
        />
        <PrioritySelector
          value={state.priority} appearance={appearance} disabled={pending}
          onChange={(priority) => dispatch({ type: 'setPriority', priority })}
        />
        <TaskNotesField
          value={state.notes} appearance={appearance} disabled={pending}
          onChangeText={(notes) => dispatch({ type: 'setNotes', notes })}
        />
        {mode.type === 'edit' && onDelete && (
          <ActionButton label="Delete task" onPress={confirmDelete} appearance={appearance} destructive disabled={pending} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ActionButton({
  label, onPress, appearance, disabled = false, secondary = false, destructive = false,
}: {
  label: string; onPress: () => void; appearance: Appearance;
  disabled?: boolean; secondary?: boolean; destructive?: boolean;
}) {
  const colors = getTaskUIColors(appearance);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.action,
        { borderColor: destructive ? colors.error : colors.selectedBorder },
        !secondary && !destructive && { backgroundColor: colors.selectedFill },
      ]}
    >
      <Text style={{ color: disabled ? colors.disabled : (destructive ? colors.error : colors.text) }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  blocked: { flex: 1, gap: 16, padding: 24 },
  header: {
    minHeight: 72, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 8, paddingHorizontal: 16, paddingVertical: 8,
  },
  title: { fontFamily: OnboardingFonts.bold, fontSize: 19 },
  content: { gap: 24, padding: 24, paddingBottom: 48 },
  fieldGroup: { gap: 8 },
  label: { fontFamily: OnboardingFonts.bold, fontSize: 16 },
  nameInput: { minHeight: 56, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 },
  action: {
    minHeight: 44, minWidth: 44, borderWidth: 1, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 8,
  },
});
