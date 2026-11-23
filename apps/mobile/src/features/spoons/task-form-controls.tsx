import { Image, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { OnboardingFonts } from '@/constants/theme';
import type { Appearance } from '@/features/settings/appearance';
import type { SpoonPriority, SpoonTaskKind } from '@/features/spoons/contracts';
import { getTaskUIColors } from '@/features/spoons/task-ui-colors';

const spendFilled = require('@/assets/images/spoons/spend-filled.png');
const rechargeFilled = require('@/assets/images/spoons/recharge-filled.png');
const empty = require('@/assets/images/spoons/empty.png');

type SharedProps = { appearance: Appearance; disabled?: boolean; error?: string };

type SpoonAmountSelectorProps = SharedProps & {
  kind: SpoonTaskKind;
  value: number;
  onChange: (amount: number) => void;
};

function ErrorMessage({ error, appearance }: Pick<SharedProps, 'error' | 'appearance'>) {
  if (!error) return null;
  return (
    <Text accessibilityRole="alert" style={{ color: getTaskUIColors(appearance).error }}>
      {error}
    </Text>
  );
}

export function SpoonAmountSelector({
  kind, value, onChange, appearance, disabled = false, error,
}: SpoonAmountSelectorProps) {
  const colors = getTaskUIColors(appearance);
  const action = kind === 'spend' ? 'energy spent' : 'energy restored';
  const filled = kind === 'spend' ? spendFilled : rechargeFilled;
  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: colors.text, fontSize: 19 * appearance.fontScale }]}>
        {kind === 'spend' ? 'Spoon Cost' : 'Spoon Worth'}
      </Text>
      <View accessibilityRole="radiogroup" style={styles.optionRow}>
        {Array.from({ length: 6 }, (_, amount) => {
          const selected = value === amount;
          return (
            <Pressable
              key={amount}
              accessibilityRole="radio"
              accessibilityLabel={`${amount} spoons, ${action}`}
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(amount)}
              style={[
                styles.spoonOption,
                { borderColor: selected ? colors.selectedBorder : colors.border },
                selected && { backgroundColor: colors.selectedFill },
              ]}
            >
              <Image source={selected && amount > 0 ? filled : empty} style={styles.spoonImage} />
              <Text style={{ color: disabled ? colors.disabled : colors.text }}>{amount}</Text>
            </Pressable>
          );
        })}
      </View>
      <ErrorMessage error={error} appearance={appearance} />
    </View>
  );
}

type PrioritySelectorProps = SharedProps & {
  value?: SpoonPriority;
  onChange: (priority: SpoonPriority) => void;
};

const priorities: readonly { value: SpoonPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export function PrioritySelector({
  value, onChange, appearance, disabled = false, error,
}: PrioritySelectorProps) {
  const colors = getTaskUIColors(appearance);
  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: colors.text, fontSize: 19 * appearance.fontScale }]}>Priority</Text>
      <View accessibilityRole="radiogroup" style={styles.optionRow}>
        {priorities.map((priority) => {
          const selected = value === priority.value;
          return (
            <Pressable
              key={priority.value}
              accessibilityRole="radio"
              accessibilityLabel={`${priority.label} priority`}
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(priority.value)}
              style={[
                styles.priorityOption,
                { borderColor: selected ? colors.selectedBorder : colors.border },
                selected && { backgroundColor: colors.selectedFill },
              ]}
            >
              <Text style={{ color: disabled ? colors.disabled : colors.text, fontSize: 16 * appearance.fontScale }}>
                {priority.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <ErrorMessage error={error} appearance={appearance} />
    </View>
  );
}

type OptionalScheduleFieldsProps = {
  appearance: Appearance;
  disabled?: boolean;
  dateEnabled: boolean;
  date: string;
  timeEnabled: boolean;
  time: string;
  errors?: { date?: string; time?: string };
  onDateEnabledChange: (enabled: boolean) => void;
  onDateChange: (date: string) => void;
  onTimeEnabledChange: (enabled: boolean) => void;
  onTimeChange: (time: string) => void;
};

export function OptionalScheduleFields(props: OptionalScheduleFieldsProps) {
  const { appearance, disabled = false } = props;
  const colors = getTaskUIColors(appearance);
  const rows = [
    {
      label: 'Date', enabled: props.dateEnabled, value: props.date,
      placeholder: 'YYYY-MM-DD', inputLabel: 'Task date', error: props.errors?.date,
      onToggle: props.onDateEnabledChange, onChange: props.onDateChange,
    },
    {
      label: 'Time', enabled: props.timeEnabled, value: props.time,
      placeholder: 'HH:mm', inputLabel: 'Task time', error: props.errors?.time,
      onToggle: props.onTimeEnabledChange, onChange: props.onTimeChange,
    },
  ];
  return (
    <View style={styles.section}>
      {rows.map((row) => (
        <View key={row.label} style={[styles.scheduleRow, { borderColor: colors.border }]}>
          <View style={styles.toggleRow}>
            <Text style={[styles.heading, { color: colors.text, fontSize: 19 * appearance.fontScale }]}>{row.label}</Text>
            <Switch
              accessibilityLabel={`Include ${row.label.toLowerCase()}`}
              accessibilityState={{ checked: row.enabled, disabled }}
              disabled={disabled}
              value={row.enabled}
              onValueChange={row.onToggle}
            />
          </View>
          {row.enabled && (
            <>
              <TextInput
                accessibilityLabel={row.inputLabel}
                value={row.value}
                onChangeText={row.onChange}
                editable={!disabled}
                placeholder={row.placeholder}
                placeholderTextColor={colors.secondaryText}
                inputMode="numeric"
                style={[
                  styles.input,
                  { color: colors.text, backgroundColor: colors.field, borderColor: row.error ? colors.error : colors.border },
                ]}
              />
              <Text style={{ color: colors.secondaryText }}>No reminder will be sent.</Text>
              <ErrorMessage error={row.error} appearance={appearance} />
            </>
          )}
        </View>
      ))}
    </View>
  );
}

type TaskNotesFieldProps = SharedProps & { value: string; onChangeText: (notes: string) => void };

export function TaskNotesField({
  value, onChangeText, appearance, disabled = false, error,
}: TaskNotesFieldProps) {
  const colors = getTaskUIColors(appearance);
  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: colors.text, fontSize: 19 * appearance.fontScale }]}>Notes</Text>
      <TextInput
        accessibilityLabel="Task notes"
        value={value}
        onChangeText={onChangeText}
        editable={!disabled}
        multiline
        placeholder="Write down your notes here..."
        placeholderTextColor={colors.secondaryText}
        style={[styles.input, styles.notes, { color: colors.text, backgroundColor: colors.field, borderColor: colors.border }]}
      />
      <ErrorMessage error={error} appearance={appearance} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  heading: { fontFamily: OnboardingFonts.bold },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  spoonOption: {
    minWidth: 72, minHeight: 88, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderRadius: 12, padding: 4,
  },
  spoonImage: { width: 64, height: 64, resizeMode: 'contain' },
  priorityOption: {
    minHeight: 44, minWidth: 72, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderRadius: 22, paddingHorizontal: 12,
  },
  scheduleRow: { borderBottomWidth: 1, gap: 8, paddingVertical: 12 },
  toggleRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 },
  notes: { minHeight: 80, textAlignVertical: 'top' },
});
