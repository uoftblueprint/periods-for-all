import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import type { LocalDate } from '@/features/health/contracts';
import type { Appearance } from '@/features/settings/appearance';

import { monthTitle, parseMonth } from './calendar-dates';
import { EditablePeriodMonthGrid } from './editable-period-month-grid';
import {
  getPeriodDateChange,
  isDraftDateSelected,
  isSelectablePeriodDate,
  setDraftDateSelected,
} from './period-date-editor-state';

const PRIMARY = '#A90D02';
const PRIMARY_PRESSED = '#7D1912';
const SECONDARY = '#FEE4E2';
const TODAY_ICON = require('@/assets/images/calendar-today.png');
const CHEVRON_LEFT = require('@/assets/images/calendar-chevron-left.png');
const CHEVRON_RIGHT = require('@/assets/images/calendar-chevron-right.png');

export type PeriodDateEditorProps = {
  initialDates: LocalDate[];
  initialMonth: string;
  today: LocalDate;
  appearance: Appearance;
  loadDates: (from: LocalDate, to: LocalDate) => Promise<LocalDate[]>;
  onSave: (change: {
    add: LocalDate[];
    remove: LocalDate[];
  }) => Promise<void>;
  onDone: () => void;
  onCancel: () => void;
};

/**
 * Period-date editor shell. This first vertical slice edits the supplied month;
 * loading additional months is added separately so unloaded data is never
 * mistaken for an empty month.
 */
export function PeriodDateEditor(props: PeriodDateEditorProps) {
  const { colors, fontScale } = props.appearance;
  const [savedDates] = useState(() => new Set(
    props.initialDates.filter((date) => (
      isSelectablePeriodDate(date, props.today)
    )),
  ));
  const [overrides, setOverrides] = useState<Map<LocalDate, boolean>>(
    () => new Map(),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const parsedMonth = parseMonth(props.initialMonth);

  const selectedDates = useMemo(() => {
    const knownDates = new Set([...savedDates, ...overrides.keys()]);
    return [...knownDates]
      .filter((date) => isDraftDateSelected(savedDates, overrides, date))
      .sort();
  }, [overrides, savedDates]);

  const changeDate = (date: LocalDate, selected: boolean) => {
    if (!isSelectablePeriodDate(date, props.today)) return;
    setSaveError(null);
    setOverrides((current) => setDraftDateSelected(
      savedDates,
      current,
      date,
      selected,
    ));
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);

    try {
      await props.onSave(getPeriodDateChange(savedDates, overrides));
      props.onDone();
    } catch {
      setSaveError('Could not save dates. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ backgroundColor: colors.background, flex: 1 }}>
      <View
        style={{
          alignItems: 'center',
          borderBottomColor: colors.backgroundElement,
          borderBottomWidth: 1,
          flexDirection: 'row',
          gap: Spacing.two,
          justifyContent: 'space-between',
          paddingHorizontal: Spacing.three,
          paddingVertical: Spacing.two,
        }}>
        <HeaderPill
          accessibilityLabel="Go to today"
          appearance={props.appearance}
          disabled
          icon={TODAY_ICON}
          label="Today"
        />

        <Text
          accessibilityRole="header"
          style={{
            color: colors.text,
            flex: 1,
            fontSize: 19 * fontScale,
            fontWeight: '700',
            textAlign: 'center',
          }}>
          Track Period
        </Text>

        <View
          style={{
            backgroundColor: colors.background,
            borderColor: colors.backgroundElement,
            borderRadius: 999,
            borderWidth: 1,
            flexDirection: 'row',
          }}>
          <HeaderIconButton
            accessibilityLabel="Previous month"
            appearance={props.appearance}
            disabled
            icon={CHEVRON_LEFT}
          />
          <HeaderIconButton
            accessibilityLabel="Next month"
            appearance={props.appearance}
            disabled
            icon={CHEVRON_RIGHT}
          />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: Spacing.three }}>
        <Text
          accessibilityRole="header"
          style={{
            color: colors.text,
            fontSize: 28 * fontScale,
            fontWeight: '700',
            paddingBottom: Spacing.two,
            paddingHorizontal: Spacing.four,
          }}>
          {parsedMonth ? monthTitle(parsedMonth) : props.initialMonth}
        </Text>

        <EditablePeriodMonthGrid
          appearance={props.appearance}
          month={props.initialMonth}
          onChangeDate={changeDate}
          selectedDates={selectedDates}
          today={props.today}
        />
      </ScrollView>

      {saveError && (
        <Text
          accessibilityLiveRegion="assertive"
          accessibilityRole="alert"
          style={{
            color: PRIMARY,
            fontSize: 14 * fontScale,
            paddingHorizontal: Spacing.four,
            paddingTop: Spacing.two,
            textAlign: 'center',
          }}>
          {saveError}
        </Text>
      )}

      <View
        style={{
          borderTopColor: colors.backgroundElement,
          borderTopWidth: 1,
          flexDirection: 'row',
          gap: Spacing.two,
          padding: Spacing.four,
        }}>
        <FooterButton
          appearance={props.appearance}
          disabled={saving}
          label="Cancel"
          onPress={props.onCancel}
          variant="secondary"
        />
        <FooterButton
          appearance={props.appearance}
          busy={saving}
          label={saving ? 'Saving…' : 'Save Dates'}
          onPress={save}
          variant="primary"
        />
      </View>
    </View>
  );
}

type HeaderPillProps = {
  accessibilityLabel: string;
  appearance: Appearance;
  disabled: boolean;
  icon: number;
  label: string;
};

function HeaderPill({
  accessibilityLabel,
  appearance,
  disabled,
  icon,
  label,
}: HeaderPillProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={{
        alignItems: 'center',
        backgroundColor: appearance.colors.background,
        borderColor: appearance.colors.backgroundElement,
        borderRadius: 999,
        borderWidth: 1,
        flexDirection: 'row',
        gap: Spacing.two,
        minHeight: 42,
        opacity: disabled ? 0.5 : 1,
        paddingHorizontal: 12,
      }}>
      <Image
        accessibilityElementsHidden
        contentFit="contain"
        source={icon}
        style={{ height: 16, width: 16 }}
      />
      <Text style={{
        color: appearance.colors.text,
        fontSize: 16 * appearance.fontScale,
      }}>
        {label}
      </Text>
    </Pressable>
  );
}

type HeaderIconButtonProps = {
  accessibilityLabel: string;
  appearance: Appearance;
  disabled: boolean;
  icon: number;
};

function HeaderIconButton({
  accessibilityLabel,
  appearance,
  disabled,
  icon,
}: HeaderIconButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={{
        alignItems: 'center',
        height: 42,
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
        width: 39,
      }}>
      <Image
        accessibilityElementsHidden
        contentFit="contain"
        source={icon}
        style={{ height: 24, width: 24 }}
      />
    </Pressable>
  );
}

type FooterButtonProps = {
  appearance: Appearance;
  busy?: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
  variant: 'primary' | 'secondary';
};

function FooterButton({
  appearance,
  busy = false,
  disabled = false,
  label,
  onPress,
  variant,
}: FooterButtonProps) {
  const unavailable = busy || disabled;
  const primary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: unavailable }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: primary
          ? pressed ? PRIMARY_PRESSED : PRIMARY
          : SECONDARY,
        borderRadius: 999,
        flex: 1,
        justifyContent: 'center',
        minHeight: 48,
        opacity: unavailable ? 0.55 : 1,
        paddingHorizontal: Spacing.four,
        paddingVertical: 12,
      })}>
      <Text style={{
        color: primary ? '#FFFFFF' : PRIMARY,
        fontSize: 16 * appearance.fontScale,
        fontWeight: '700',
        textAlign: 'center',
      }}>
        {label}
      </Text>
    </Pressable>
  );
}
