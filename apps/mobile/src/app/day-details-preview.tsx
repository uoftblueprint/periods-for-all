import { useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DayDetails, type DayDetailsProps } from '@/features/calendar/day-details';
import { FLOW_OPTIONS, MOOD_OPTIONS } from '@/features/health/catalog';
import { getAppearance } from '@/features/settings/appearance';
import { Colors, FontScale, MaxContentWidth, Spacing } from '@/constants/theme';
import { defaultSettings, type Settings } from '@/foundation/contracts';

const today = '2026-11-06';
const empty: DayDetailsProps['log'] = {
  date: today, mood: null, flow: null, physicalSymptoms: null, emotionalSymptoms: null, reflection: null,
};
const filled: DayDetailsProps['log'] = {
  ...empty, date: '2026-11-05', mood: 'happy', flow: 'heavy',
  physicalSymptoms: ['headache', 'menstrualCramps'], emotionalSymptoms: ['fatigue'],
  reflection: 'I took a walk and rested this afternoon.',
};
const examples = [
  { name: 'Empty', log: empty },
  { name: 'Filled', log: filled },
  { name: 'Explicit none', log: { ...empty, date: '2026-11-04', flow: 'none', physicalSymptoms: [], emotionalSymptoms: [] } },
  { name: 'Long reflection', log: { ...filled, date: '2026-11-03', reflection: 'A quiet day. I took breaks, drank water and wrote down how I felt. '.repeat(25) } },
  { name: 'Future', log: { ...empty, date: '2026-11-07' } },
] satisfies { name: string; log: DayDetailsProps['log'] }[];
const moods = MOOD_OPTIONS.map(({ id }) => id);
const flows = FLOW_OPTIONS.map(({ id }) => id);
const themes = Object.keys(Colors) as Settings['colorScheme'][];
const sizes = Object.keys(FontScale) as Settings['textSize'][];

export default function DayDetailsPreview() {
  const [visible, setVisible] = useState(true);
  const [example, setExample] = useState(0);
  const [theme, setTheme] = useState(0);
  const [size, setSize] = useState(0);
  const [mood, setMood] = useState(3);
  const [flow, setFlow] = useState(4);
  const [edited, setEdited] = useState('No edit requested');
  const appearance = getAppearance({ ...defaultSettings, colorScheme: themes[theme], textSize: sizes[size] });
  const artwork = example === 1 || example === 3;
  const log = { ...examples[example].log, ...(artwork && { mood: moods[mood], flow: flows[flow] }) };
  return (
    <View style={[styles.page, { backgroundColor: appearance.colors.backgroundElement }]}>
      <ScrollView style={styles.controls} contentContainerStyle={{ gap: Spacing.two }}>
        <Button title="Show card" disabled={visible} onPress={() => setVisible(true)} />
        <Button title={`Example: ${examples[example].name}`} onPress={() => setExample((example + 1) % examples.length)} />
        <Button title={`Theme: ${themes[theme]}`} onPress={() => setTheme((theme + 1) % themes.length)} />
        <Button title={`Text size: ${sizes[size]}`} onPress={() => setSize((size + 1) % sizes.length)} />
        <Button title={`Mood artwork: ${moods[mood]}`} disabled={!artwork} onPress={() => setMood((mood + 1) % moods.length)} />
        <Button title={`Flow artwork: ${flows[flow]}`} disabled={!artwork} onPress={() => setFlow((flow + 1) % flows.length)} />
        <Text accessibilityLiveRegion="polite" style={{ color: appearance.colors.text }}>{edited}</Text>
      </ScrollView>
      <View style={styles.host}>
        {visible && <DayDetails onClose={() => setVisible(false)} log={log} isPeriodDay={artwork} today={today} appearance={appearance} onEdit={(date) => setEdited(`Edit requested: ${date}`)} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: Spacing.two },
  controls: { maxHeight: '30%', flexGrow: 0, marginBottom: Spacing.two },
  host: { flex: 1, justifyContent: 'flex-end' },
});
