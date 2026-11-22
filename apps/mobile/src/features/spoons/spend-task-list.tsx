import { useEffect, useRef } from 'react';
import { Image } from 'expo-image';
import { AccessibilityInfo, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/app-button';
import { OnboardingFonts, Spacing } from '@/constants/theme';
import type { Appearance } from '@/features/settings/appearance';
import { focusHeading } from '@/foundation/preview-screen';
import type { SpoonDay, SpoonTask } from '@/features/spoons/contracts';
import { groupSpendTasks, spoonCount } from '@/features/spoons/spend-task-actions';

const icons = {
  check: require('@/assets/images/spoons/check.svg'),
  clock: require('@/assets/images/spoons/clock.svg'),
  cost: require('@/assets/images/spoons/cost-spoon.svg'),
  list: require('@/assets/images/spoons/list.svg'),
  mutedCost: require('@/assets/images/spoons/muted-cost.svg'),
  priority: require('@/assets/images/spoons/priority.svg'),
  warning: require('@/assets/images/spoons/warning.svg'),
};

export function SpoonIcon({ source, size, tintColor }: { source: number; size: number; tintColor?: string }) {
  return (
    <Image
      source={source}
      accessible={false}
      importantForAccessibility="no"
      contentFit="contain"
      tintColor={tintColor}
      style={{ width: size, height: size }}
    />
  );
}

export function SpendTaskList({
  day, warning, busy, error, canRetry, announcement, appearance, accent, border, onToggle, onConfirm, onCancel, onRetry,
}: {
  day: SpoonDay;
  warning: SpoonTask | null;
  busy: boolean;
  error: string | null;
  canRetry: boolean;
  announcement: string;
  appearance: Appearance;
  accent: string;
  border: string;
  onToggle: (taskId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const { colors, fontScale } = appearance;
  const heading = useRef<Text>(null);
  const modalHeading = useRef<Text>(null);
  const { planned, completed, overBudget } = groupSpendTasks(day);
  const body = { color: colors.text, fontFamily: OnboardingFonts.regular, fontSize: 16 * fontScale };
  const title = { ...body, fontFamily: OnboardingFonts.bold, fontSize: 23 * fontScale };
  const label = { ...body, fontSize: 14 * fontScale, color: colors.textSecondary };
  useEffect(() => {
    const message = announcement || error;
    if (Platform.OS === 'ios' && message) {
      AccessibilityInfo.announceForAccessibilityWithOptions(message, { queue: true });
    }
  }, [announcement, error]);

  function row(task: SpoonTask) {
    const checked = task.completion !== null;
    const strike = checked ? { textDecorationLine: 'line-through' as const } : undefined;
    const timeParts = task.time?.split(':').map(Number);
    const time = timeParts
      ? `${timeParts[0] % 12 || 12}:${String(timeParts[1]).padStart(2, '0')} ${timeParts[0] >= 12 ? 'PM' : 'AM'}`
      : undefined;
    const disabled = busy || canRetry;
    const keyboard = Platform.OS === 'web' ? {
      onKeyDown: (event: Pick<KeyboardEvent, 'key' | 'repeat' | 'preventDefault'>) => {
        if (event.key !== ' ') return;
        event.preventDefault();
        if (!disabled && !event.repeat) onToggle(task.id);
      },
    } : {};
    return (
      <Pressable key={task.id} {...keyboard} accessibilityRole="checkbox"
        accessibilityLabel={[task.name, spoonCount(task.amount), time].filter(Boolean).join(', ')}
        accessibilityHint={checked ? 'Undo completion' : 'Complete task'}
        accessibilityState={{ checked, disabled, busy }} aria-checked={checked}
        disabled={disabled} onPress={() => onToggle(task.id)} style={styles.row}>
        <View style={[styles.checkbox, { borderColor: checked ? accent : colors.textSecondary, backgroundColor: checked ? accent : 'transparent' }]}>
          {checked && <SpoonIcon source={icons.check} size={24} />}
        </View>
        <View style={styles.details}>
          <View style={styles.inline}>
            {task.priority === 'low' && <SpoonIcon source={icons.priority} size={12} />}
            <Text style={[body, strike, styles.taskName]}>{task.name}</Text>
          </View>
          {time && <View style={styles.inline}><SpoonIcon source={icons.clock} size={16} tintColor={colors.textSecondary} /><Text style={[label, strike]}>{time}</Text></View>}
          <View style={styles.inline}>
            {Array.from({ length: task.amount }, (_, index) => (
              <SpoonIcon key={index} source={checked ? icons.mutedCost : icons.cost} size={12} />
            ))}
            <Text style={[label, strike, styles.costLabel]}>{spoonCount(task.amount)}</Text>
          </View>
        </View>
      </Pressable>
    );
  }

  function dismiss(action: () => void) {
    action();
    if (Platform.OS === 'web') requestAnimationFrame(() => focusHeading(heading.current));
  }

  return (
    <>
      <View style={styles.list}>
        <View style={styles.listHeader}>
          <Text ref={heading} tabIndex={-1} accessibilityRole="header" style={title}>
            Today’s Tasks <Text style={{ ...body, fontSize: 19 * fontScale }}>{planned.length + completed.length + overBudget.length}</Text>
          </Text>
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
            style={[styles.listIcon, { borderColor: border }]}><SpoonIcon source={icons.list} size={24} tintColor={colors.textSecondary} /></View>
        </View>
        {planned.map(row)}
        {completed.map(row)}
      </View>
      {overBudget.length > 0 && (
        <View style={[styles.list, styles.warningList, { borderColor: border }]}>
          <View style={styles.inline}>
            <SpoonIcon source={icons.warning} size={20} />
            <Text accessibilityRole="header" style={[body, styles.taskName, { fontFamily: OnboardingFonts.bold }]}>
              Tasks Over Today’s Spoons
            </Text>
          </View>
          {overBudget.map(row)}
        </View>
      )}
      {error && <View style={styles.feedback}>
        <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={body}>{error}</Text>
        {canRetry && <AppButton label="Retry" appearance={appearance} onPress={onRetry} />}
      </View>}
      {Platform.OS !== 'ios' && (
        <Text accessibilityLiveRegion="polite" aria-live="polite" style={styles.announcement}>{announcement}</Text>
      )}
      <Modal transparent visible={warning !== null} animationType="none"
        onRequestClose={() => dismiss(onCancel)}
        onShow={() => focusHeading(modalHeading.current)} onDismiss={() => focusHeading(heading.current)}>
        <View style={styles.overlay}>
          <ScrollView accessibilityViewIsModal keyboardShouldPersistTaps="handled"
            style={[styles.dialog, { backgroundColor: colors.background, borderColor: border }]}
            contentContainerStyle={styles.dialogBody}>
            <Text ref={modalHeading} tabIndex={-1} accessibilityRole="header" style={title}>Not enough spoons</Text>
            <Text style={body}>
              {warning ? `${warning.name} costs ${spoonCount(warning.amount)}. You have ${spoonCount(day.balance ?? 0)} left. If you continue, you’ll have 0 spoons left.` : ''}
            </Text>
            <AppButton label="Cancel" appearance={appearance} onPress={() => dismiss(onCancel)} />
            <AppButton label="Continue" appearance={appearance} onPress={() => dismiss(onConfirm)} />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 24, paddingTop: 24 },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  listIcon: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: { minHeight: 56, paddingVertical: 8, paddingLeft: 10, flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  checkbox: { width: 18, height: 18, marginTop: 2, borderWidth: 2, borderRadius: 2, alignItems: 'center', justifyContent: 'center' },
  details: { flex: 1, gap: 2 },
  inline: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 3 },
  taskName: { flexShrink: 1 },
  costLabel: { marginLeft: 3 },
  warningList: { borderTopWidth: 1, paddingTop: 15, marginTop: 10 },
  feedback: { padding: Spacing.four, gap: Spacing.two },
  announcement: { position: 'absolute', width: 1, height: 1, overflow: 'hidden' },
  overlay: { backgroundColor: '#0007', flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { flexGrow: 0, width: '100%', maxWidth: 520, maxHeight: '90%', borderRadius: 16, borderWidth: 1 },
  dialogBody: { padding: Spacing.four, gap: Spacing.three },
});
