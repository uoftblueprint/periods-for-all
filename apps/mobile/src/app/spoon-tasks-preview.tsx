import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getAppearance } from '@/features/settings/appearance';
import type { SpoonTask, SpoonTaskDraft } from '@/features/spoons/contracts';
import { QuickTaskEditor } from '@/features/spoons/quick-task-editor';
import { TaskEditor, type TaskEditorMode } from '@/features/spoons/task-editor';
import { TaskList } from '@/features/spoons/task-list';
import { getTaskUIColors } from '@/features/spoons/task-ui-colors';
import { defaultSettings } from '@/foundation/contracts';

type Scenario = 'empty' | 'planned' | 'optionals' | 'completed' | 'spend' | 'recharge' | 'saving' | 'failure';
const TODAY = '2026-11-22';
const planned: SpoonTask = {
  id: 'planned', date: TODAY, name: 'Take a short walk', kind: 'spend', amount: 2, completion: null,
};
const optionals: SpoonTask = {
  ...planned, id: 'optionals', name: 'Prepare for a long accessible task example', amount: 3,
  time: '09:30', priority: 'high', notes: 'Bring water and take breaks.',
  subtasks: [{ id: 'water', name: 'Pack water', done: true }, { id: 'shoes', name: 'Wear shoes', done: false }],
};
const completed: SpoonTask = {
  ...planned,
  id: 'completed',
  completion: {
    taskId: 'completed', kind: 'complete', requestedAmount: 2, appliedChange: -2, at: '2026-11-22T10:00:00.000Z',
  },
};
const scenarios: readonly { id: Scenario; label: string }[] = [
  { id: 'empty', label: 'Empty' }, { id: 'planned', label: 'Planned' },
  { id: 'optionals', label: 'Filled optionals' }, { id: 'completed', label: 'Completed blocked' },
  { id: 'spend', label: 'Spend' }, { id: 'recharge', label: 'Recharge' },
  { id: 'saving', label: 'Saving' }, { id: 'failure', label: 'Injected failure' },
];

const wait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export default function SpoonTasksPreview() {
  const [scenario, setScenario] = useState<Scenario>('empty');
  const [lastDraft, setLastDraft] = useState<SpoonTaskDraft | null>(null);
  const appearance = getAppearance(defaultSettings);
  const colors = getTaskUIColors(appearance);
  const mode: TaskEditorMode = {
    type: 'create', kind: scenario === 'recharge' ? 'recharge' : 'spend', defaultDate: TODAY,
  };
  const save = async (draft: SpoonTaskDraft) => {
    setLastDraft(draft);
    if (scenario === 'saving') await wait(1500);
    if (scenario === 'failure') throw new Error('Injected preview failure');
  };

  let preview;
  if (scenario === 'empty' || scenario === 'planned' || scenario === 'optionals') {
    const tasks = scenario === 'empty' ? [] : [scenario === 'planned' ? planned : optionals];
    preview = (
      <TaskList
        tasks={tasks} appearance={appearance}
        onAddTask={() => setScenario('spend')}
        onEditTask={() => setScenario('spend')}
        onToggleCompletion={() => {}}
      />
    );
  } else if (scenario === 'completed') {
    preview = (
      <TaskEditor
        mode={{ type: 'edit', task: completed, defaultDate: TODAY }} balance={3} appearance={appearance}
        createSubtaskId={() => `preview-${Date.now()}`} onSave={save} onCancel={() => setScenario('planned')}
        onDelete={async () => {}} onRequestUndo={() => setScenario('planned')}
      />
    );
  } else if (scenario === 'saving' || scenario === 'failure') {
    preview = (
      <QuickTaskEditor
        mode={mode} appearance={appearance} createSubtaskId={() => `preview-${Date.now()}`}
        onSave={save} onCancel={() => setScenario('empty')} onOpenDetails={() => setScenario('spend')}
      />
    );
  } else {
    preview = (
      <TaskEditor
        mode={mode} balance={3} appearance={appearance} createSubtaskId={() => `preview-${Date.now()}`}
        onSave={save} onCancel={() => setScenario('empty')}
      />
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <Stack.Screen options={{ title: 'Spoon task preview' }} />
      <ScrollView horizontal contentContainerStyle={styles.controls} style={styles.controlScroll}>
        {scenarios.map((item) => (
          <Pressable
            key={item.id} accessibilityRole="button" onPress={() => setScenario(item.id)}
            style={[styles.scenario, { borderColor: scenario === item.id ? colors.selectedBorder : colors.border }]}
          >
            <Text style={{ color: colors.text }}>{item.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text accessibilityLiveRegion="polite" style={[styles.status, { color: colors.secondaryText }]}>
        {scenario === 'saving' ? 'Saves stay pending for 1.5 seconds.'
          : scenario === 'failure' ? 'The next save rejects.'
            : lastDraft ? `Last save: ${lastDraft.name}` : 'Choose a scenario.'}
      </Text>
      <View style={styles.preview}>{preview}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  controlScroll: { flexGrow: 0 },
  controls: { gap: 8, padding: 12 },
  scenario: { minHeight: 44, borderWidth: 1, borderRadius: 22, justifyContent: 'center', paddingHorizontal: 14 },
  status: { paddingHorizontal: 12, paddingBottom: 8 },
  preview: { flex: 1 },
});
