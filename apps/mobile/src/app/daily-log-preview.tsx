import { useMemo, useRef, useState } from 'react';
import { Button, Switch, Text, View } from 'react-native';
import { DailyLogScreen } from '@/features/health/daily-log-screen';
import type { DailyLog, DailyLogPatch, HealthStore, LocalDate } from '@/features/health/health-types';
import { getAppearance } from '@/features/settings/appearance';
import { colorSchemes, defaultSettings, textSizes } from '@/foundation/contracts';
import { PreviewScreen } from '@/foundation/preview-screen';

// made-up sample data. TODAY is fixed so the preview always looks the same.
const TODAY = '2026-11-07';
const SAMPLE: Record<LocalDate, DailyLog> = {
  '2026-11-06': {
    date: '2026-11-06', mood: 'happy', flow: 'light',
    physicalSymptoms: ['cramps'], emotionalSymptoms: [], reflection: 'Went for a walk.',
  },
};

type Controls = { slow: boolean; failSaves: boolean; failLoads: boolean };
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const blank = (date: LocalDate): DailyLog => ({
  date, mood: null, flow: null, physicalSymptoms: null, emotionalSymptoms: null, reflection: null,
});

// temp in-memory store until S3-01.
function createPreviewStore(controls: { current: Controls }, record: (line: string) => void): HealthStore {
  const days: Record<LocalDate, DailyLog> = structuredClone(SAMPLE);
  return {
    async getDailyLog(date) {
      if (controls.current.slow) await wait(1500);
      if (controls.current.failLoads) throw new Error('Could not reach the sample store.');
      return { ...(days[date] ?? blank(date)) };
    },
    async patchDailyLog(date, patch: DailyLogPatch) {
      if (controls.current.slow) await wait(2000);
      if (controls.current.failSaves) {
        record(`✗ ${date}: save of ${Object.keys(patch).join(', ')} failed`);
        throw new Error('Could not reach the sample store.');
      }
      days[date] = { ...(days[date] ?? blank(date)), ...patch };
      record(`✓ ${date}: saved ${Object.keys(patch).join(', ')}`);
      return { ...days[date] };
    },
    getPeriodDays: async () => [],
    updatePeriodDays: async () => {},
    getPeriodSetup: async () => ({ lastPeriodStart: null, cycleLength: null, periodLength: null, step: 'intro' }),
    savePeriodSetup: async () => {},
  };
}

export default function DailyLogPreview() {
  const [date, setDate] = useState(TODAY);
  const [controls, setControls] = useState<Controls>({ slow: false, failSaves: false, failLoads: false });
  const controlsRef = useRef(controls);
  controlsRef.current = controls;
  const [scheme, setScheme] = useState(0);
  const [size, setSize] = useState(0);
  const [events, setEvents] = useState<string[]>([]);
  const store = useMemo(
    () => createPreviewStore(controlsRef, (line) => setEvents((list) => [line, ...list].slice(0, 6))),
    [],
  );

  const settings = { ...defaultSettings, colorScheme: colorSchemes[scheme], textSize: textSizes[size] };
  const appearance = getAppearance(settings);
  const toggle = (key: keyof Controls) => (value: boolean) => setControls((c) => ({ ...c, [key]: value }));

  return (
    <PreviewScreen title="Daily log preview (sample data)">
      <Text>Today is {TODAY}. November 6 has sample answers; other days start blank.</Text>
      {(['slow', 'failSaves', 'failLoads'] as const).map((key) => (
        <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Switch accessibilityLabel={labels[key]} value={controls[key]} onValueChange={toggle(key)} />
          <Text>{labels[key]}</Text>
        </View>
      ))}
      <Button title={`Theme: ${settings.colorScheme}`} onPress={() => setScheme((n) => (n + 1) % colorSchemes.length)} />
      <Button title={`Text size: ${settings.textSize}`} onPress={() => setSize((n) => (n + 1) % textSizes.length)} />

      <View style={{ borderWidth: 1, borderRadius: 12, overflow: 'hidden', minHeight: 400 }}>
        <DailyLogScreen
          date={date}
          today={TODAY}
          store={store}
          appearance={appearance}
          onDateChange={setDate}
          onExit={() => setEvents((list) => ['onExit called', ...list].slice(0, 6))}
        />
      </View>

      <Text>Store activity (newest first):</Text>
      {events.map((line, i) => <Text key={i}>{line}</Text>)}
    </PreviewScreen>
  );
}

const labels: Record<keyof Controls, string> = {
  slow: 'Slow store (2 s saves)',
  failSaves: 'Make saves fail',
  failLoads: 'Make loads fail',
};
