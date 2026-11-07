import { Image } from 'expo-image';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import type { LocalDate } from '@/features/health/contracts';
import type { Appearance } from '@/features/settings/appearance';

import {
  addMonths,
  formatMonth,
  monthTitle,
  parseDate,
  parseMonth,
} from './calendar-dates';
import { EditablePeriodMonthGrid } from './editable-period-month-grid';
import {
  getMonthRange,
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

type MonthLoadStatus = 'loaded' | 'loading' | 'error';

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
 * Period-date editor. Saved dates and draft overrides remain separate so
 * loading another month never replaces changes the user already made.
 */
export function PeriodDateEditor(props: PeriodDateEditorProps) {
  const { colors, fontScale } = props.appearance;
  const validInitialMonth = parseMonth(props.initialMonth) !== null;
  const [currentMonth, setCurrentMonth] = useState(props.initialMonth);
  const [savedDates, setSavedDates] = useState(() => new Set(
    props.initialDates.filter((date) => (
      isSelectablePeriodDate(date, props.today)
    )),
  ));
  const [overrides, setOverrides] = useState<Map<LocalDate, boolean>>(
    () => new Map(),
  );
  const [monthStatuses, setMonthStatuses] = useState<
    Record<string, MonthLoadStatus>
  >(() => validInitialMonth ? { [props.initialMonth]: 'loaded' } : {});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const loadedMonths = useRef(new Set(
    validInitialMonth ? [props.initialMonth] : [],
  ));
  const loadingMonths = useRef(new Set<string>());
  const mounted = useRef(true);
  const parsedMonth = parseMonth(currentMonth);
  const monthStatus = monthStatuses[currentMonth];
  const monthLoaded = monthStatus === 'loaded';
  const todayMonth = parseDate(props.today) ? props.today.slice(0, 7) : null;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const selectedDates = useMemo(() => {
    const knownDates = new Set([...savedDates, ...overrides.keys()]);
    return [...knownDates]
      .filter((date) => isDraftDateSelected(savedDates, overrides, date))
      .sort();
  }, [overrides, savedDates]);

  const loadMonth = useCallback(async (month: string) => {
    const range = getMonthRange(month);
    if (!range || loadedMonths.current.has(month)
      || loadingMonths.current.has(month)) return;

    loadingMonths.current.add(month);
    setMonthStatuses((current) => ({ ...current, [month]: 'loading' }));

    try {
      const loadedDates = await props.loadDates(range.from, range.to);
      if (!mounted.current) return;

      setSavedDates((current) => {
        const next = new Set(
          [...current].filter((date) => date < range.from || date > range.to),
        );
        for (const date of loadedDates) {
          if (date >= range.from && date <= range.to
            && isSelectablePeriodDate(date, props.today)) {
            next.add(date);
          }
        }
        return next;
      });
      loadedMonths.current.add(month);
      setMonthStatuses((current) => ({ ...current, [month]: 'loaded' }));
    } catch {
      if (!mounted.current) return;
      setMonthStatuses((current) => ({ ...current, [month]: 'error' }));
    } finally {
      loadingMonths.current.delete(month);
    }
  }, [props.loadDates, props.today]);

  const showMonth = (month: string) => {
    setSaveError(null);
    setCurrentMonth(month);
    void loadMonth(month);
  };

  const changeMonth = (delta: number) => {
    if (!parsedMonth) return;
    showMonth(formatMonth(addMonths(parsedMonth, delta)));
  };

  const changeDate = (date: LocalDate, selected: boolean) => {
    if (!monthLoaded || !isSelectablePeriodDate(date, props.today)) return;
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
          disabled={!todayMonth || saving}
          icon={TODAY_ICON}
          label="Today"
          onPress={() => {
            if (todayMonth) showMonth(todayMonth);
          }}
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
            disabled={!parsedMonth || saving}
            icon={CHEVRON_LEFT}
            onPress={() => changeMonth(-1)}
          />
          <HeaderIconButton
            accessibilityLabel="Next month"
            appearance={props.appearance}
            disabled={!parsedMonth || saving}
            icon={CHEVRON_RIGHT}
            onPress={() => changeMonth(1)}
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
          {parsedMonth ? monthTitle(parsedMonth) : currentMonth}
        </Text>

        {monthStatus === 'loading' && (
          <Text
            accessibilityLiveRegion="polite"
            style={{
              color: colors.textSecondary,
              fontSize: 14 * fontScale,
              paddingBottom: Spacing.two,
              paddingHorizontal: Spacing.four,
            }}>
            Loading dates…
          </Text>
        )}

        {parsedMonth && monthStatus === 'error' && (
          <View
            accessibilityRole="alert"
            style={{
              alignItems: 'center',
              gap: Spacing.two,
              paddingBottom: Spacing.three,
              paddingHorizontal: Spacing.four,
            }}>
            <Text style={{ color: colors.text, fontSize: 14 * fontScale }}>
              Could not load dates. Try again.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void loadMonth(currentMonth)}
              style={{
                backgroundColor: colors.backgroundElement,
                borderRadius: 999,
                minHeight: 44,
                paddingHorizontal: Spacing.three,
                justifyContent: 'center',
              }}>
              <Text style={{ color: colors.text, fontSize: 14 * fontScale }}>
                Retry
              </Text>
            </Pressable>
          </View>
        )}

        <EditablePeriodMonthGrid
          appearance={props.appearance}
          disabled={!monthLoaded || saving}
          month={currentMonth}
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
          disabled={!monthLoaded}
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
  onPress: () => void;
};

function HeaderPill({
  accessibilityLabel,
  appearance,
  disabled,
  icon,
  label,
  onPress,
}: HeaderPillProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
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
  onPress: () => void;
};

function HeaderIconButton({
  accessibilityLabel,
  appearance,
  disabled,
  icon,
  onPress,
}: HeaderIconButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
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
