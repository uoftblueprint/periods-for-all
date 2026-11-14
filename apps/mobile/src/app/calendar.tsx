// S3-08: the real calendar for the signed-in user.
// Loads period days and the selected day's log, and connects MonthCalendar,
// the day card (S3-07) and navigation to the period editor and daily log.
import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { AppButton } from '@/components/app-button';
import { MonthCalendar } from '@/features/calendar/month-calendar';
import {
  DayDetails, RequireHealthStore, localToday, useLoad, visibleRange, type HealthStore,
} from '@/features/health/health-routes';
import { getAppearance, type Appearance } from '@/features/settings/appearance';
import { useSettings } from '@/features/settings/settings-provider';
import { PreviewScreen } from '@/foundation/preview-screen';

export default function CalendarRoute() {
  const appearance = getAppearance(useSettings().settings);
  return (
    <PreviewScreen title="Calendar" appearance={appearance}>
      <RequireHealthStore appearance={appearance}>
        {/* key: a different account gets a completely fresh calendar. */}
        {(store, userId) => <CalendarContent key={userId} store={store} appearance={appearance} />}
      </RequireHealthStore>
    </PreviewScreen>
  );
}

function CalendarContent({ store, appearance }: { store: HealthStore; appearance: Appearance }) {
  const [today] = useState(localToday);
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(today);
  const [refresh, setRefresh] = useState(0);
  const text = { color: appearance.colors.text, fontSize: 16 * appearance.fontScale };

  // Coming back from the period editor or daily log reloads marks and day details.
  // The first focus is the initial load, which useLoad already does.
  const focusedBefore = useRef(false);
  useFocusEffect(useCallback(() => {
    if (focusedBefore.current) setRefresh((n) => n + 1);
    focusedBefore.current = true;
  }, []));

  const range = visibleRange(month);
  const periodDays = useLoad(`${month}|${refresh}`, () => store.getPeriodDays(range.from, range.to));
  const dayLog = useLoad(`${selectedDate}|${refresh}`, () => store.getDailyLog(selectedDate));

  if (periodDays.status === 'loading') {
    return <Loading label="Loading your calendar…" style={text} />;
  }
  if (periodDays.status === 'error') {
    // Never show an empty calendar for a failed load: that would look like deleted data.
    return <Failed message="We couldn’t load your period dates." onRetry={periodDays.retry} appearance={appearance} />;
  }

  const selectedInMonth = selectedDate.slice(0, 7) === month;
  return (
    <View style={{ gap: 16 }}>
      <MonthCalendar
        month={month}
        selectedDate={selectedDate}
        today={today}
        periodDates={periodDays.data}
        onSelectDate={setSelectedDate}
        onChangeMonth={setMonth}
        onEditPeriodDates={() => router.push({ pathname: '/period-edit', params: { month } })}
        appearance={appearance}
      />
      {!selectedInMonth ? (
        <Text style={text}>Select a day to see what was recorded.</Text>
      ) : dayLog.status === 'loading' ? (
        <Loading label="Loading this day…" style={text} />
      ) : dayLog.status === 'error' ? (
        <Failed message="We couldn’t load this day." onRetry={dayLog.retry} appearance={appearance} />
      ) : (
        <DayDetails
          log={dayLog.data}
          isPeriodDay={periodDays.data.includes(selectedDate)}
          today={today}
          appearance={appearance}
          // Only the date goes in the URL, never health answers.
          onEdit={(date) => router.push({ pathname: '/daily-log', params: { date } })}
        />
      )}
    </View>
  );
}

function Loading({ label, style }: { label: string; style: object }) {
  return (
    <View>
      <ActivityIndicator accessibilityLabel={label} />
      <Text accessibilityLiveRegion="polite" style={style}>{label}</Text>
    </View>
  );
}

function Failed({ message, onRetry, appearance }: { message: string; onRetry: () => void; appearance: Appearance }) {
  return (
    <View>
      <Text accessibilityRole="alert" style={{ color: appearance.colors.text, fontSize: 16 * appearance.fontScale }}>
        {message}
      </Text>
      <AppButton appearance={appearance} label="Try again" onPress={onRetry} />
    </View>
  );
}
