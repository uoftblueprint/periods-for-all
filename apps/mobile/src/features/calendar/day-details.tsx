import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useFonts } from 'expo-font';
import { AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold } from '@expo-google-fonts/atkinson-hyperlegible';
import { Colors, Fonts, OnboardingFonts, Spacing } from '@/constants/theme';
import type { DailyLog, Flow, Mood } from '@/features/health/contracts';
import {
  EMOTIONAL_SYMPTOM_OPTIONS, FLOW_OPTIONS, MOOD_OPTIONS, PHYSICAL_SYMPTOM_OPTIONS,
} from '@/features/health/catalog';
import type { Appearance } from '@/features/settings/appearance';
import { MONTH_NAMES, WEEKDAY_NAMES, parseDate, weekday } from './calendar-dates';

export type DayDetailsProps = {
  log: DailyLog;
  isPeriodDay: boolean;
  today: string;
  appearance: Appearance;
  onEdit: (date: string) => void;
  onClose: () => void;
};
const symptomOptions = [...PHYSICAL_SYMPTOM_OPTIONS, ...EMOTIONAL_SYMPTOM_OPTIONS];
const lightColors = {
  ...Colors.light, background: '#fcfbf8', text: '#31281b', textSecondary: '#5a482f',
  backgroundElement: '#f2eade', backgroundSelected: '#f2eade',
};

const moodImages: Record<Mood, number> = {
  verySad: require('@/assets/images/day-details/mood-verySad.svg'),
  sad: require('@/assets/images/day-details/mood-sad.svg'),
  neutral: require('@/assets/images/day-details/mood-neutral.svg'),
  happy: require('@/assets/images/day-details/mood-happy.svg'),
  veryHappy: require('@/assets/images/day-details/mood-veryHappy.svg'),
};
const flowImages: Record<Flow, number> = {
  none: require('@/assets/images/day-details/flow-none.svg'),
  veryLight: require('@/assets/images/day-details/flow-veryLight.svg'),
  light: require('@/assets/images/day-details/flow-light.svg'),
  normal: require('@/assets/images/day-details/flow-normal.svg'),
  heavy: require('@/assets/images/day-details/flow-heavy.svg'),
  veryHeavy: require('@/assets/images/day-details/flow-veryHeavy.svg'),
};
const symptomImages = new Map<string, number>([
  ['headache', require('@/assets/images/day-details/symptom-headache.svg')],
  ['menstrualCramps', require('@/assets/images/day-details/symptom-menstrualCramps.svg')],
  ['backPain', require('@/assets/images/day-details/symptom-backPain.svg')],
  ['migraines', require('@/assets/images/day-details/symptom-migraines.svg')],
  ['stomachPain', require('@/assets/images/day-details/symptom-stomachPain.svg')],
  ['fatigue', require('@/assets/images/day-details/symptom-fatigue.svg')],
  ['moodSwings', require('@/assets/images/day-details/symptom-moodSwings.svg')],
  ['difficultyConcentrating', require('@/assets/images/day-details/symptom-difficultyConcentrating.svg')],
  ['anxiety', require('@/assets/images/day-details/symptom-anxiety.svg')],
  ['lowMotivation', require('@/assets/images/day-details/symptom-lowMotivation.svg')],
]);

export function DayDetails({ log, isPeriodDay, today, appearance, onEdit, onClose }: DayDetailsProps) {
  const [fontLoaded] = useFonts({
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_700Bold,
  });
  const [expanded, setExpanded] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const { fontScale } = appearance;
  const light = appearance.colors === Colors.light;
  const dark = appearance.colors === Colors.dark;
  const contrast = appearance.colors === Colors.highContrast;
  const colors = light ? lightColors : appearance.colors;
  const chip = contrast ? { fill: colors.backgroundElement, ink: colors.text, border: colors.text }
    : dark ? { fill: colors.backgroundElement, ink: colors.text, border: colors.backgroundSelected }
    : { fill: '#f2eade', ink: '#31281b', border: '#e4d7c4' };
  const action = contrast ? { fill: colors.text, ink: colors.background } : { fill: '#a90d02', ink: '#fff' };
  const text = { color: colors.text, fontFamily: fontLoaded ? OnboardingFonts.regular : Fonts.sans, fontSize: 16 * fontScale };
  const bold = { fontFamily: fontLoaded ? OnboardingFonts.bold : Fonts.sans, fontWeight: '700' as const };
  const date = parseDate(log.date);
  const answered = [log.mood, log.flow, log.physicalSymptoms, log.emotionalSymptoms, log.reflection]
    .some((value) => value !== null);
  const canEdit = date && parseDate(today) && log.date <= today;
  useEffect(() => {
    setExpanded(false);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [log.date]);
  const handle = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderRelease: ({ nativeEvent }, { x0, y0 }) => {
      // Release coordinates keep coalesced move events from changing the snap distance.
      const dx = nativeEvent.pageX - x0;
      const dy = nativeEvent.pageY - y0;
      if (Math.abs(dy) >= 32 && Math.abs(dy) > Math.abs(dx)) setExpanded(dy < 0);
    },
  }), []);

  return (
    <View style={[styles.card, {
      height: expanded ? '100%' : '50%',
      backgroundColor: colors.background, borderColor: colors.backgroundSelected,
      boxShadow: light ? '0px -2px 4px rgba(228,215,196,0.5)' : undefined,
    }]}>
      <View>
        <View {...handle.panHandlers} style={styles.handleArea}
          accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={[styles.handle, { backgroundColor: light ? '#e4d7c4' : colors.textSecondary }]} />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close details"
          onPress={onClose} style={styles.close}>
          <Image source={require('@/assets/images/day-details/close.svg')} contentFit="contain"
            tintColor={colors.textSecondary} accessible={false} accessibilityLabel="" style={styles.closeIcon} />
        </Pressable>
      </View>
      <ScrollView ref={scroll} style={styles.scroll} contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={[text, bold, { fontSize: 23 * fontScale }]}>
          {date ? `${WEEKDAY_NAMES[weekday(date.year, date.month, date.day)].slice(0, 3)}, ${MONTH_NAMES[date.month - 1]} ${date.day}` : 'Invalid date'}
        </Text>
        {isPeriodDay && <View style={[styles.periodBadge, { backgroundColor: chip.fill, borderColor: chip.border }]}>
          <Text style={[text, bold, { color: chip.ink, fontSize: 12 * fontScale }]}>Period day</Text>
        </View>}
        <Pressable accessibilityRole="button" aria-expanded={expanded}
          onPress={() => setExpanded(!expanded)} style={[styles.button, { borderColor: colors.textSecondary }]}>
          <Text style={[text, bold]}>{expanded ? 'Collapse details' : 'Expand details'}</Text>
        </Pressable>
        {!answered ? <Text style={text}>No experiences tracked on this day.</Text> : <>
          {(['mood', 'flow'] as const).map((field) => (
            <View key={field} style={[styles.section, { borderColor: colors.backgroundSelected }]}>
              <Text style={[text, { fontSize: 14 * fontScale }]}>{field === 'mood' ? 'Mood' : 'Period Flow'}</Text>
              <View style={styles.row}>
                <Text style={[text, bold, styles.value]}>{field === 'mood'
                  ? (log.mood === null ? 'Not recorded' : MOOD_OPTIONS.find(({ id }) => id === log.mood)?.label)
                  : (log.flow === null ? 'Not recorded' : FLOW_OPTIONS.find(({ id }) => id === log.flow)?.label)}</Text>
                {field === 'mood' && log.mood !== null && (
                  <Image source={moodImages[log.mood]} contentFit="contain"
                    accessible={false} accessibilityLabel="" style={styles.mood} />
                )}
                {field === 'flow' && log.flow !== null && (
                  <Image source={flowImages[log.flow]} contentFit="contain"
                    accessible={false} accessibilityLabel="" style={styles.flow} />
                )}
              </View>
            </View>
          ))}
          {(['physicalSymptoms', 'emotionalSymptoms'] as const).map((field) => (
            <View key={field} style={[styles.section, { borderColor: colors.backgroundSelected }]}>
              <Text style={[text, { fontSize: 14 * fontScale }]}>
                {field === 'physicalSymptoms' ? 'Physical Symptoms' : 'Emotional Symptoms'}
              </Text>
              <View style={styles.row}>
                {log[field]?.length ? log[field].map((id, index) => (
                  <View key={`${id}-${index}`} style={[styles.pill, { backgroundColor: chip.fill, borderColor: chip.border }]}>
                    {symptomImages.has(id) && <Image source={symptomImages.get(id)} contentFit="contain"
                      tintColor={dark ? chip.ink : undefined} accessible={false} accessibilityLabel="" style={styles.symptom} />}
                    <Text style={[text, bold, { color: chip.ink, flexShrink: 1 }]}>
                      {symptomOptions.find((option) => option.id === id)?.label ?? id}
                    </Text>
                  </View>
                )) : <Text style={text}>
                  {log[field] === null ? 'Not recorded'
                    : field === 'physicalSymptoms' ? 'No physical symptoms' : 'No emotional symptoms'}
                </Text>}
              </View>
            </View>
          ))}
          <View style={[styles.section, { borderColor: colors.backgroundSelected }]}>
            <Text style={[text, { fontSize: 14 * fontScale }]}>Daily Reflection</Text>
            <Text style={text}>{log.reflection ?? 'Not recorded'}</Text>
          </View>
        </>}
        {canEdit && <Pressable accessibilityRole="button" onPress={() => onEdit(log.date)}
          style={[styles.button, { marginTop: 'auto', backgroundColor: action.fill, borderColor: contrast ? colors.text : action.fill }]}>
          <Text style={[text, bold, { color: action.ink }]}>{answered ? 'Edit Log' : 'Track'}</Text>
        </Pressable>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, overflow: 'hidden' },
  close: { position: 'absolute', left: 14, top: 6, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  closeIcon: { width: 24, height: 24 },
  handleArea: { marginHorizontal: 64, minHeight: 52, paddingTop: 16, alignItems: 'center' },
  handle: { width: 134, height: 4, borderRadius: 2 },
  scroll: { flex: 1 },
  content: { flexGrow: 1, padding: Spacing.four, paddingTop: 0, paddingBottom: 40, gap: Spacing.three },
  section: { borderTopWidth: 1, paddingTop: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
  value: { flexGrow: 1, flexShrink: 1 },
  periodBadge: { alignSelf: 'flex-start', borderRadius: 100, borderWidth: 1, paddingVertical: 4, paddingHorizontal: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: 100, borderWidth: 1,
    minHeight: 40, paddingVertical: Spacing.two, paddingHorizontal: 12, maxWidth: '100%' },
  button: { minHeight: 48, padding: 12, borderRadius: 100, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  mood: { width: 32, height: 32 },
  flow: { width: 135, height: 32, maxWidth: '100%' },
  symptom: { width: 24, height: 24 },
});
