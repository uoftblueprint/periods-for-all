import { useState } from 'react';
import { Button, Switch, Text, View } from 'react-native';
import { MonthCalendar } from '@/features/calendar/month-calendar';
import { getAppearance } from '@/features/settings/appearance';
import { defaultSettings } from '@/foundation/contracts';
import { PreviewScreen } from '@/foundation/preview-screen';

// Made-up sample data from the ticket: period on October 5–9, today October 14.
const TODAY = '2026-10-14';
const SAMPLE_PERIOD = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'];

export default function CalendarPreview() {
  const [month, setMonth] = useState('2026-10');
  const [selectedDate, setSelectedDate] = useState<string | null>(TODAY);
  const [periodDates, setPeriodDates] = useState(SAMPLE_PERIOD);
  const [dark, setDark] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [message, setMessage] = useState('Tap a date, change month, or press Edit Period Dates.');

  const appearance = getAppearance({
    ...defaultSettings,
    colorScheme: dark ? 'dark' : 'light',
    textSize: largeText ? 'large' : 'standard',
  });

  return (
    <PreviewScreen title="Calendar preview (sample dates)">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Switch accessibilityLabel="Dark appearance" value={dark} onValueChange={setDark} />
        <Text>Dark</Text>
        <Switch accessibilityLabel="Large text" value={largeText} onValueChange={setLargeText} />
        <Text>Large text</Text>
      </View>
      <Button title="Show leap-year February 2028" onPress={() => setMonth('2028-02')} />
      <Button
        title={periodDates.length ? 'Clear period dates' : 'Restore sample period dates'}
        onPress={() => setPeriodDates(periodDates.length ? [] : SAMPLE_PERIOD)}
      />

      <View style={{ backgroundColor: appearance.colors.background, padding: 16, borderRadius: 12 }}>
        <MonthCalendar
          month={month}
          selectedDate={selectedDate}
          today={TODAY}
          periodDates={periodDates}
          onSelectDate={(date) => {
            setSelectedDate(date);
            setMessage(`Selected ${date}`);
          }}
          onChangeMonth={(next) => {
            setMonth(next);
            setMessage(`Month changed to ${next}`);
          }}
          onEditPeriodDates={() => setMessage('Edit Period Dates callback received (no editor in this ticket).')}
          appearance={appearance}
        />
      </View>

      <Text accessibilityLiveRegion="polite">{message}</Text>
    </PreviewScreen>
  );
}
