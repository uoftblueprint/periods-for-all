import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Fonts, Spacing } from '@/constants/theme';
import type { Appearance } from '@/features/settings/appearance';
import { describeDate, parseDate } from './calendar-dates';

// S3-01's written contract; replace these types and labels with its exports before merge.
type LocalDate = string;
type Mood = 'verySad' | 'sad' | 'neutral' | 'happy' | 'veryHappy';
type Flow = 'none' | 'veryLight' | 'light' | 'normal' | 'heavy' | 'veryHeavy';
type DailyLog = {
  date: LocalDate;
  mood: Mood | null;
  flow: Flow | null;
  physicalSymptoms: string[] | null;
  emotionalSymptoms: string[] | null;
  reflection: string | null;
};
export type DayDetailsProps = {
  log: DailyLog;
  isPeriodDay: boolean;
  today: string;
  appearance: Appearance;
  onEdit: (date: string) => void;
};
const moodLabels: Record<Mood, string> = {
  verySad: 'Very Sad', sad: 'Sad', neutral: 'Neutral', happy: 'Happy', veryHappy: 'Very Happy',
};
const flowLabels: Record<Flow, string> = {
  none: 'No Flow', veryLight: 'Very Light', light: 'Light', normal: 'Normal', heavy: 'Heavy', veryHeavy: 'Very Heavy',
};
const symptomLabels: Record<string, string> = {
  headache: 'Headache', menstrualCramps: 'Menstrual Cramps', backPain: 'Back Pain',
  migraines: 'Migraines', stomachPain: 'Stomach Pain', moodSwings: 'Mood Swings',
  difficultyConcentrating: 'Difficulty Concentrating', anxiety: 'Anxiety',
  fatigue: 'Fatigue', lowMotivation: 'Low Motivation',
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

export function DayDetails({ log, isPeriodDay, today, appearance, onEdit }: DayDetailsProps) {
  const [expanded, setExpanded] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const { colors, fontScale } = appearance;
  const text = { color: colors.text, fontFamily: Fonts.sans, fontSize: 16 * fontScale };
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
    }]}>
      <View {...handle.panHandlers} style={styles.handleArea}
        accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[styles.handle, { backgroundColor: colors.textSecondary }]} />
      </View>
      <ScrollView ref={scroll} style={styles.scroll} contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={[text, styles.bold, { fontSize: 23 * fontScale }]}>
          {date ? describeDate(date) : 'Invalid date'}
        </Text>
        <Text style={[text, { color: colors.textSecondary }]}>
          {isPeriodDay ? 'Recorded period day' : 'Not marked as a period day'}
        </Text>
        <Pressable accessibilityRole="button" aria-expanded={expanded}
          onPress={() => setExpanded(!expanded)} style={styles.button}>
          <Text style={[text, styles.bold]}>{expanded ? 'Collapse details' : 'Expand details'}</Text>
        </Pressable>
        {!answered ? <Text style={text}>Nothing recorded for this day</Text> : <>
          {(['mood', 'flow'] as const).map((field) => (
            <View key={field} style={[styles.section, { borderColor: colors.backgroundSelected }]}>
              <Text style={[text, { fontSize: 14 * fontScale }]}>{field === 'mood' ? 'Mood' : 'Flow'}</Text>
              <View style={styles.row}>
                <Text style={[text, styles.bold, styles.value]}>{field === 'mood'
                  ? (log.mood === null ? 'Not recorded' : moodLabels[log.mood])
                  : (log.flow === null ? 'Not recorded' : flowLabels[log.flow])}</Text>
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
                {field === 'physicalSymptoms' ? 'Physical symptoms' : 'Emotional symptoms'}
              </Text>
              <View style={styles.row}>
                {log[field]?.length ? log[field].map((id, index) => (
                  <Text key={`${id}-${index}`} style={[text, styles.pill, { backgroundColor: colors.backgroundElement }]}>
                    {symptomLabels[id] ?? id}
                  </Text>
                )) : <Text style={text}>
                  {log[field] === null ? 'Not recorded'
                    : field === 'physicalSymptoms' ? 'No physical symptoms' : 'No emotional symptoms'}
                </Text>}
              </View>
            </View>
          ))}
          <View style={[styles.section, { borderColor: colors.backgroundSelected }]}>
            <Text style={[text, { fontSize: 14 * fontScale }]}>Reflection</Text>
            <Text style={text}>{log.reflection ?? 'Not recorded'}</Text>
          </View>
        </>}
        {canEdit && <Pressable accessibilityRole="button" onPress={() => onEdit(log.date)}
          style={[styles.button, { backgroundColor: colors.text }]}>
          <Text style={[text, styles.bold, { color: colors.background }]}>{answered ? 'Edit' : 'Track'}</Text>
        </Pressable>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, overflow: 'hidden' },
  handleArea: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 100, height: 4, borderRadius: 2 },
  scroll: { flex: 1 },
  content: { padding: Spacing.four, paddingTop: 0, gap: Spacing.three },
  section: { borderTopWidth: 1, paddingTop: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
  value: { flexGrow: 1, flexShrink: 1 },
  bold: { fontWeight: '700' },
  pill: { borderRadius: 12, padding: Spacing.two, maxWidth: '100%' },
  button: { minHeight: 44, padding: Spacing.two, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  mood: { width: 32, height: 32 },
  flow: { width: 135, height: 32, maxWidth: '100%' },
});
