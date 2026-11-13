import { Stack } from 'expo-router';
import { useState } from 'react';
import {
  Button,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { PeriodDateEditor } from '@/features/calendar/period-date-editor';
import type { LocalDate } from '@/features/health/contracts';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings } from '@/foundation/contracts';

const TODAY = '2026-10-14';
const INITIAL_MONTH = '2026-10';
const SAMPLE_DATES: LocalDate[] = [
  '2026-08-26',
  '2026-08-27',
  '2026-08-28',
  '2026-08-29',
  '2026-08-30',
  '2026-09-23',
  '2026-09-24',
  '2026-09-25',
  '2026-09-26',
  '2026-09-27',
  '2026-10-05',
  '2026-10-06',
  '2026-10-07',
  '2026-10-08',
  '2026-10-09',
];

const wait = (milliseconds: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, milliseconds);
});

export default function PeriodEditorPreview() {
  const [editorKey, setEditorKey] = useState(0);
  const [edgeTouchActive, setEdgeTouchActive] = useState(false);
  const [savedDates, setSavedDates] = useState(() => new Set(SAMPLE_DATES));
  const [dark, setDark] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [failNextLoad, setFailNextLoad] = useState(false);
  const [failNextSave, setFailNextSave] = useState(false);
  const [event, setEvent] = useState(
    'Edit dates, then save or cancel. Failure switches apply once.',
  );
  const [lastPayload, setLastPayload] = useState<string | null>(null);

  const appearance = getAppearance({
    ...defaultSettings,
    colorScheme: dark ? 'dark' : 'light',
    textSize: largeText ? 'large' : 'standard',
  });

  const resetEditor = (message: string) => {
    setEditorKey((current) => current + 1);
    setEvent(message);
  };

  return (
    <View style={[styles.screen, { backgroundColor: appearance.colors.background }]}>
      <Stack.Screen options={{
        gestureEnabled: !edgeTouchActive,
        title: 'Period editor preview',
      }} />

      <ScrollView
        style={styles.controlsScroll}
        contentContainerStyle={[
          styles.controls,
          { backgroundColor: appearance.colors.backgroundElement },
        ]}>
        <View style={styles.switches}>
          <ControlSwitch
            label="Dark"
            textColor={appearance.colors.text}
            value={dark}
            onValueChange={setDark}
          />
          <ControlSwitch
            label="Large text"
            textColor={appearance.colors.text}
            value={largeText}
            onValueChange={setLargeText}
          />
          <ControlSwitch
            label="Fail next month load"
            textColor={appearance.colors.text}
            value={failNextLoad}
            onValueChange={setFailNextLoad}
          />
          <ControlSwitch
            label="Fail next save"
            textColor={appearance.colors.text}
            value={failNextSave}
            onValueChange={setFailNextSave}
          />
        </View>

        <Button
          title="Restore sample dates"
          onPress={() => {
            setSavedDates(new Set(SAMPLE_DATES));
            setLastPayload(null);
            resetEditor('Sample dates restored.');
          }}
        />

        <Text
          accessibilityLiveRegion="polite"
          style={{ color: appearance.colors.text }}>
          {event}
        </Text>
        {lastPayload && (
          <Text
            selectable
            style={[styles.payload, { color: appearance.colors.textSecondary }]}>
            Last onSave payload: {lastPayload}
          </Text>
        )}
      </ScrollView>

      <View style={styles.editor}>
        <PeriodDateEditor
          key={editorKey}
          appearance={appearance}
          initialDates={[...savedDates].filter((date) => (
            date.startsWith(`${INITIAL_MONTH}-`)
          ))}
          initialMonth={INITIAL_MONTH}
          loadDates={async (from, to) => {
            await wait(250);
            if (failNextLoad) {
              setFailNextLoad(false);
              setEvent('Month load failed once. Press Retry in the editor.');
              throw new Error('Preview month load failure');
            }
            setEvent(`Loaded dates from ${from} to ${to}.`);
            return [...savedDates].filter((date) => date >= from && date <= to);
          }}
          onCancel={() => resetEditor('Cancelled. Draft changes were discarded.')}
          onEdgeTouchActiveChange={setEdgeTouchActive}
          onDone={() => resetEditor('Saved. The editor reopened with committed dates.')}
          onSave={async (change) => {
            await wait(250);
            setLastPayload(JSON.stringify(change));
            if (failNextSave) {
              setFailNextSave(false);
              setEvent('Save failed once. The draft is still available.');
              throw new Error('Preview save failure');
            }
            setSavedDates((current) => {
              const next = new Set(current);
              change.remove.forEach((date) => next.delete(date));
              change.add.forEach((date) => next.add(date));
              return next;
            });
          }}
          today={TODAY}
        />
      </View>
    </View>
  );
}

type ControlSwitchProps = {
  label: string;
  textColor: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

function ControlSwitch({
  label,
  textColor,
  value,
  onValueChange,
}: ControlSwitchProps) {
  return (
    <View style={styles.switchControl}>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
      />
      <Text style={{ color: textColor }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  controlsScroll: {
    flexGrow: 0,
    maxHeight: 220,
  },
  controls: {
    gap: 8,
    padding: 12,
  },
  switches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  switchControl: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  payload: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  editor: {
    flex: 1,
    minHeight: 420,
  },
});
