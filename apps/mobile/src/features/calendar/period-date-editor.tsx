import { SymbolView } from 'expo-symbols';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

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
  type PeriodDateChange,
} from './period-date-editor-state';

const PRIMARY = '#A90D02';
const PRIMARY_PRESSED = '#7D1912';
const SECONDARY = '#FEE4E2';
const TODAY_ICON_NAME = {
  android: 'calendar_today',
  ios: 'calendar',
  web: 'calendar_today',
} as const;
const MONTH_ARROW_NAMES = {
  left: {
    android: 'chevron_left',
    ios: 'chevron.left',
    web: 'chevron_left',
  },
  right: {
    android: 'chevron_right',
    ios: 'chevron.right',
    web: 'chevron_right',
  },
} as const;

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
  const [pendingRemovalChange, setPendingRemovalChange] = useState<
    PeriodDateChange | null
  >(null);
  const loadedMonths = useRef(new Set(
    validInitialMonth ? [props.initialMonth] : [],
  ));
  const loadingMonths = useRef(new Set<string>());
  const mounted = useRef(true);
  const saveInFlight = useRef(false);
  const doneCalled = useRef(false);
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

  const cancel = useCallback(() => {
    if (saveInFlight.current) return;
    props.onCancel();
  }, [props.onCancel]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        cancel();
        return true;
      },
    );
    return () => subscription.remove();
  }, [cancel]);

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
    if (saveInFlight.current || !monthLoaded
      || !isSelectablePeriodDate(date, props.today)) return;
    setSaveError(null);
    setOverrides((current) => setDraftDateSelected(
      savedDates,
      current,
      date,
      selected,
    ));
  };

  const submitChange = async (change: PeriodDateChange) => {
    if (saveInFlight.current || doneCalled.current) return;
    saveInFlight.current = true;
    setSaving(true);
    setSaveError(null);

    try {
      await props.onSave(change);
      if (mounted.current && !doneCalled.current) {
        doneCalled.current = true;
        props.onDone();
      }
    } catch {
      if (mounted.current) {
        setSaveError('Could not save dates. Try again.');
      }
    } finally {
      saveInFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  const requestSave = () => {
    if (!monthLoaded || saveInFlight.current || doneCalled.current) return;
    const change = getPeriodDateChange(savedDates, overrides);
    if (change.remove.length > 0) {
      setPendingRemovalChange(change);
      return;
    }
    void submitChange(change);
  };

  const confirmRemoval = () => {
    if (!pendingRemovalChange) return;
    const change = pendingRemovalChange;
    setPendingRemovalChange(null);
    void submitChange(change);
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
            direction="left"
            disabled={!parsedMonth || saving}
            onPress={() => changeMonth(-1)}
          />
          <HeaderIconButton
            accessibilityLabel="Next month"
            appearance={props.appearance}
            direction="right"
            disabled={!parsedMonth || saving}
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
          onPress={cancel}
          variant="secondary"
        />
        <FooterButton
          appearance={props.appearance}
          busy={saving}
          disabled={!monthLoaded || pendingRemovalChange !== null}
          label={saving ? 'Saving…' : 'Save Dates'}
          onPress={requestSave}
          variant="primary"
        />
      </View>

      <Modal
        animationType={props.appearance.reduceMotion ? 'none' : 'fade'}
        onRequestClose={() => setPendingRemovalChange(null)}
        transparent
        visible={pendingRemovalChange !== null}>
        <View
          style={{
            alignItems: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            flex: 1,
            justifyContent: 'center',
            padding: Spacing.four,
          }}>
          <View
            accessibilityRole="alert"
            accessibilityViewIsModal
            style={{
              backgroundColor: colors.background,
              borderColor: colors.backgroundElement,
              borderRadius: 16,
              borderWidth: 1,
              gap: Spacing.three,
              maxWidth: 520,
              padding: Spacing.four,
              width: '100%',
            }}>
            <Text
              accessibilityRole="header"
              style={{
                color: colors.text,
                fontSize: 20 * fontScale,
                fontWeight: '700',
              }}>
              Remove saved period dates?
            </Text>
            <Text style={{ color: colors.text, fontSize: 16 * fontScale }}>
              The dates will be removed from your period history. Symptoms
              recorded on those dates will stay.
            </Text>
            <View style={{ flexDirection: 'row', gap: Spacing.two }}>
              <FooterButton
                appearance={props.appearance}
                label="Keep Dates"
                onPress={() => setPendingRemovalChange(null)}
                variant="secondary"
              />
              <FooterButton
                appearance={props.appearance}
                label="Remove and Save"
                onPress={confirmRemoval}
                variant="primary"
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

type HeaderPillProps = {
  accessibilityLabel: string;
  appearance: Appearance;
  disabled: boolean;
  label: string;
  onPress: () => void;
};

function HeaderPill({
  accessibilityLabel,
  appearance,
  disabled,
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
      <SymbolView
        accessibilityElementsHidden
        name={TODAY_ICON_NAME}
        size={16}
        tintColor={appearance.colors.text}
        weight="regular"
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
  direction: keyof typeof MONTH_ARROW_NAMES;
  disabled: boolean;
  onPress: () => void;
};

function HeaderIconButton({
  accessibilityLabel,
  appearance,
  direction,
  disabled,
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
      <SymbolView
        accessibilityElementsHidden
        name={MONTH_ARROW_NAMES[direction]}
        size={24}
        tintColor={appearance.colors.text}
        weight="semibold"
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
