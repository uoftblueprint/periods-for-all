import { useEffect, useReducer, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { Appearance } from '@/features/settings/appearance';
import type { SpoonTaskDraft } from '@/features/spoons/contracts';
import {
  createTaskDraftState, reduceTaskDraft, validateTaskDraft,
  type TaskDraftErrors, type TaskDraftState,
} from '@/features/spoons/task-editor-state';
import { OptionalScheduleFields, SpoonAmountSelector } from '@/features/spoons/task-form-controls';
import type { TaskEditorMode } from '@/features/spoons/task-editor';
import { getTaskUIColors } from '@/features/spoons/task-ui-colors';

export type QuickTaskEditorProps = {
  mode: TaskEditorMode;
  appearance: Appearance;
  createSubtaskId: () => string;
  onSave: (draft: SpoonTaskDraft) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
  onOpenDetails: (state: TaskDraftState) => void;
};

export function QuickTaskEditor(props: QuickTaskEditorProps) {
  const source = props.mode.initialState ?? (props.mode.type === 'edit' ? props.mode.task : props.mode.kind);
  const identity = `${props.mode.type}:${props.mode.defaultDate}:${JSON.stringify(source)}`;
  return <QuickTaskEditorContent key={identity} {...props} />;
}

function QuickTaskEditorContent({ mode, appearance, onSave, onCancel, onDelete, onOpenDetails }: QuickTaskEditorProps) {
  const [state, dispatch] = useReducer(
    reduceTaskDraft,
    mode,
    (source) => createTaskDraftState(source, source.initialState),
  );
  const [errors, setErrors] = useState<TaskDraftErrors>({});
  const [panel, setPanel] = useState<'spoons' | 'schedule' | null>(null);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const mountedRef = useRef(true);
  const colors = getTaskUIColors(appearance);
  const completed = mode.type === 'edit' && mode.task.completion !== null;

  useEffect(() => () => { mountedRef.current = false; }, []);

  const mutate = async (operation: () => Promise<void>, title: string) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      await operation();
    } catch {
      Alert.alert(title, 'Your task is still here. Try again.');
    } finally {
      pendingRef.current = false;
      if (mountedRef.current) setPending(false);
    }
  };

  const save = () => {
    if (pendingRef.current) return;
    const result = validateTaskDraft(state);
    setErrors(result.errors);
    if (result.draft) void mutate(() => onSave(result.draft!), 'Could not save task');
  };

  const remove = () => {
    if (!onDelete || pendingRef.current) return;
    Alert.alert('Delete task?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void mutate(onDelete, 'Could not delete task') },
    ]);
  };

  if (completed) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={{ color: colors.text }}>Undo completion before editing this task.</Text>
        <QuickAction label="Cancel editing" onPress={onCancel} appearance={appearance} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.selectedBorder }]}
    >
      <TextInput
        accessibilityLabel="Task name"
        autoFocus
        value={state.name}
        onChangeText={(name) => dispatch({ type: 'setName', name })}
        onSubmitEditing={save}
        editable={!pending}
        returnKeyType="done"
        style={[styles.name, { color: colors.text, backgroundColor: colors.field, borderColor: errors.name ? colors.error : colors.border }]}
      />
      {errors.name && <Text accessibilityRole="alert" style={{ color: colors.error }}>{errors.name}</Text>}
      <View style={styles.actionRow}>
        <QuickAction label="Date & Time" onPress={() => setPanel(panel === 'schedule' ? null : 'schedule')} appearance={appearance} disabled={pending} />
        <QuickAction label="Spoons" onPress={() => setPanel(panel === 'spoons' ? null : 'spoons')} appearance={appearance} disabled={pending} />
        <QuickAction label="More details" onPress={() => onOpenDetails(state)} appearance={appearance} disabled={pending} />
      </View>
      {panel === 'spoons' && (
        <SpoonAmountSelector
          kind={state.kind} value={state.amount} appearance={appearance} disabled={pending}
          error={errors.amount} onChange={(amount) => dispatch({ type: 'setAmount', amount })}
        />
      )}
      {panel === 'schedule' && (
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
      )}
      <View style={styles.actionRow}>
        <QuickAction label="Save task" onPress={save} appearance={appearance} disabled={pending} />
        <QuickAction label="Cancel editing" onPress={onCancel} appearance={appearance} disabled={pending} />
        {mode.type === 'create' ? (
          <QuickAction label="Discard new task" onPress={onCancel} appearance={appearance} disabled={pending} destructive />
        ) : onDelete ? (
          <QuickAction label="Delete task" onPress={remove} appearance={appearance} disabled={pending} destructive />
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

function QuickAction({
  label, onPress, appearance, disabled = false, destructive = false,
}: { label: string; onPress: () => void; appearance: Appearance; disabled?: boolean; destructive?: boolean }) {
  const colors = getTaskUIColors(appearance);
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
      disabled={disabled} onPress={onPress}
      style={[styles.action, { borderColor: destructive ? colors.error : colors.border }]}
    >
      <Text style={{ color: disabled ? colors.disabled : (destructive ? colors.error : colors.text) }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth: 2, borderStyle: 'dashed', borderRadius: 12, gap: 12, padding: 12 },
  name: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: {
    minHeight: 44, borderWidth: 1, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14,
  },
});
