import { AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold } from '@expo-google-fonts/atkinson-hyperlegible';
import { useFonts } from 'expo-font';
import { Stack, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/app-button';
import { OnboardingColors, OnboardingFonts } from '@/constants/theme';
import { getAppearance } from '@/features/settings/appearance';
import { MAX_SPOONS } from '@/features/spoons/balance';
import { createSampleSpoonStore } from '@/features/spoons/sample-spoon-store';
import { createSpendTaskActions } from '@/features/spoons/spend-task-actions';
import { SpendTaskList, SpoonIcon } from '@/features/spoons/spend-task-list';
import { defaultSettings } from '@/foundation/contracts';

const DATE = '2026-11-22';
const assets = {
  full: require('@/assets/images/spoons/spoon-full.png'),
  empty: require('@/assets/images/spoons/spoon-empty.png'),
  plus: require('@/assets/images/spoons/plus.svg'),
};
const tabs = [
  { name: 'Home', icon: require('@/assets/images/spoons/home.svg') },
  { name: 'Calendar', icon: require('@/assets/images/spoons/calendar.svg') },
  { name: 'Period', icon: require('@/assets/images/spoons/period.svg') },
  { name: 'Spoons', icon: require('@/assets/images/spoons/tab-spoon.svg') },
];

function createPreview(scenario: string | undefined, injectFailure: boolean) {
  const { store, failNextWrite } = createSampleSpoonStore({ now: () => new Date(2026, 10, 22, 11, 7) });
  let id = 0;
  const nextId = () => `spend-preview-${++id}`;
  let initialized: Promise<void> | undefined;
  async function seed() {
    let day = await store.getDay(DATE);
    const command = () => ({ date: DATE, expectedRevision: day.revision, operationId: nextId() });
    if (scenario !== 'unanswered') {
      [day] = await store.setStartingEnergy({ ...command(), amount: scenario === 'low' ? 1 : scenario === 'zero' ? 0 : 5 });
    }
    const drafts = [
      { name: 'Change bedsheets', amount: 3 },
      scenario === 'completed'
        ? { name: 'Shower', amount: 2, priority: 'low' as const, time: '17:00' }
        : { name: 'Shower', amount: 2 },
      ...(scenario === 'completed' ? [] : [{ name: 'Doctor Phone Call', amount: 1 }]),
    ];
    for (const draft of drafts) {
      [day] = await store.createTask({ ...command(), draft: { ...draft, kind: 'spend' } });
    }
    if (scenario === 'completed') {
      await store.completeTask({ ...command(), taskId: day.tasks[0].id });
    }
    if (injectFailure) failNextWrite();
  }
  const scopedStore = {
    getDay: async (date: string) => {
      await (initialized ??= seed());
      return store.getDay(date);
    },
    completeTask: store.completeTask,
    undoCompletion: store.undoCompletion,
  };
  return createSpendTaskActions(scopedStore, DATE, nextId);
}

export default function SpendTaskPreview() {
  const { scenario, theme, textSize, fail } = useLocalSearchParams<{
    scenario?: string; theme?: string; textSize?: string; fail?: string;
  }>();
  const actions = useMemo(() => createPreview(scenario, fail === '1'), [scenario, fail]);
  const state = useSyncExternalStore(actions.subscribe, actions.getSnapshot);
  const [fontsLoaded] = useFonts({ AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold });
  const { width } = useWindowDimensions();
  const colorScheme = theme === 'dark' || theme === 'highContrast' ? theme : 'light';
  const settings = getAppearance({ ...defaultSettings, colorScheme, textSize: textSize === 'largest' ? 'largest' : 'standard' });
  if (textSize === '200') settings.fontScale = 2;
  const light = colorScheme === 'light';
  const appearance = light ? {
    ...settings,
    colors: { ...settings.colors, text: '#31281b', textSecondary: '#56442b', background: '#faf8f5' },
  } : settings;
  const colors = appearance.colors;
  const border = light ? OnboardingColors.border : colors.backgroundSelected;
  const accent = light ? OnboardingColors.brand : colorScheme === 'dark' ? '#de7470' : '#740900';
  const label = { fontFamily: fontsLoaded ? OnboardingFonts.regular : undefined, color: colors.text, fontSize: 16 * appearance.fontScale };
  const bold = { fontFamily: fontsLoaded ? OnboardingFonts.bold : undefined };
  const balance = state.day?.balance;
  const spoonSize = Math.min(64, (width - 56) / MAX_SPOONS);

  useEffect(() => { void actions.load(); }, [actions]);

  const decorativeAction = (title: string, plus = false) => (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[styles.decorativeAction, { borderColor: light ? '#ffb9b5' : border, borderBottomColor: light ? '#ff8e89' : border,
        backgroundColor: light ? OnboardingColors.brandSoft : colors.backgroundElement }]}>
      {plus && <SpoonIcon source={assets.plus} size={24} />}
      <Text style={[label, bold, { color: accent }]}>{title}</Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <View style={[styles.frame, { borderColor: border }]}>
        <View style={[styles.header, { borderColor: border }]}>
          <Text accessibilityRole="header" style={[label, scenario === 'completed' && bold, { fontSize: 19 * appearance.fontScale }]}>Spoons</Text>
        </View>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={[styles.summary, { borderColor: border }]}>
            <Text style={[label, { color: colors.textSecondary, fontSize: 23 * appearance.fontScale }]}>
              Today’s Spoons · <Text style={[bold, { color: colors.text }]}>{balance == null ? 'Not set' : `${balance} ${balance === 1 ? 'Spoon' : 'Spoons'}`}</Text>
            </Text>
            <View style={styles.spoons}>
              {Array.from({ length: MAX_SPOONS }, (_, index) => (
                <SpoonIcon key={index} source={index < (balance ?? 0) ? assets.full : assets.empty} size={spoonSize} />
              ))}
            </View>
            {decorativeAction('Edit Spoons')}
          </View>
          <View style={[styles.divider, { backgroundColor: border }]} />
          {state.day && fontsLoaded ? <SpendTaskList
            day={state.day} warning={state.warning?.task ?? null} busy={state.busy} error={state.error}
            canRetry={state.canRetry} announcement={state.announcement} appearance={appearance} accent={accent} border={border}
            onToggle={actions.toggle} onConfirm={actions.confirm} onCancel={actions.cancel} onRetry={actions.retry}
          /> : <View style={styles.feedback}>
            <Text style={label} accessibilityRole={state.error ? 'alert' : undefined} accessibilityLiveRegion="polite">{state.error ?? 'Loading today’s spoons…'}</Text>
            {state.canRetry && <AppButton label="Retry" appearance={appearance} onPress={actions.retry} />}
          </View>}
          <View style={styles.add}>{decorativeAction('Add a task', true)}</View>
        </ScrollView>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.tabs, { borderColor: border }]}>
          {tabs.map(({ name, icon }) => (
            <View key={name} style={[styles.tab, name === 'Spoons' && { borderColor: border, backgroundColor: light ? '#f9f4ec' : colors.backgroundElement }]}>
              <SpoonIcon source={icon} size={24} tintColor={light ? undefined : name === 'Spoons' ? accent : colors.textSecondary} />
              <Text style={[label, { fontSize: 14 * appearance.fontScale, color: name === 'Spoons' ? accent : colors.textSecondary },
                name === 'Spoons' && bold]}>{name}</Text>
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  frame: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: 800 },
  header: { minHeight: 68, padding: 12, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1 },
  scroll: { flexGrow: 1 },
  summary: { padding: 24, gap: 8, borderBottomWidth: 1 },
  spoons: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, width: '100%', maxWidth: 430 },
  decorativeAction: { minHeight: 44, padding: 8, gap: 8, borderRadius: 28, borderWidth: 1, borderBottomWidth: 2,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  add: { marginTop: 'auto', padding: 24, paddingTop: 20 },
  divider: { height: 8, opacity: 0.55 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-evenly', gap: 4, paddingTop: 8,
    paddingHorizontal: 8, paddingBottom: 6, minHeight: 72, borderTopWidth: 4 },
  tab: { borderWidth: 1, borderColor: 'transparent', borderRadius: 8, alignItems: 'center', justifyContent: 'center', padding: 4, gap: 2 },
  feedback: { padding: 24, gap: 8 },
});
